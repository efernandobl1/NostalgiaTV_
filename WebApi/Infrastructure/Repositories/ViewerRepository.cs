using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using ApplicationCore.Policies;
using Infrastructure.Persistence;
using Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Infrastructure.Repositories;

/// <summary>
/// Viewer profiles and devices. A device is identified by a random token kept in an HttpOnly cookie
/// (only its SHA-256 is stored); devices of an account profile are signed out when the account's
/// session version changes. Concurrent writes are serialized with sp_getapplock per device/profile.
/// </summary>
public sealed class ViewerRepository(NostalgiaTVContext context, IMemoryCache cache) : IViewerRepository
{
    public const int MaxDevicesPerProfile = 10;
    private static readonly TimeSpan DeviceLifetime = TimeSpan.FromDays(180);
    private static readonly TimeSpan PairingLifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan AuthorizationLifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan QrAuthorizationLifetime = TimeSpan.FromMinutes(2);
    private const int PollIntervalSeconds = 5;
    private const int MaxWatchRanges = 512;

    // ── Sessions ──

    public async Task<ViewerSessionStart> StartSessionAsync(string? deviceToken, int? userId, DeviceRequest request)
    {
        var device = await DeviceAsync(deviceToken);
        if (userId is not int accountId)
        {
            if (device != null) return new ViewerSessionStart(await SessionAsync(device), null, null);
            var now = DateTime.UtcNow;
            var profile = new ViewerProfile { Id = Guid.NewGuid(), CreatedAtUtc = now };
            context.ViewerProfiles.Add(profile);
            var (created, token) = NewDevice(profile.Id, request.Name, null);
            await context.SaveChangesAsync();
            return new ViewerSessionStart(await SessionAsync(created), token, created.ExpiresAtUtc);
        }

        await using var transaction = await context.Database.BeginTransactionAsync();
        var account = await AccountProfileAsync(accountId, device?.ProfileId);
        await context.Database.LockAsync("viewer-profile-" + account.Id);
        var version = await SessionVersionAsync(accountId);
        string? setToken = null;
        if (device != null && device.ProfileId != account.Id && !await IsAccountProfileAsync(device.ProfileId))
        {
            // An anonymous device that signs in brings its watch history to the account.
            await context.Database.LockAsync("viewer-profile-" + device.ProfileId);
            await EnsureCapacityAsync(account.Id);
            await MergeProfilesAsync(device.ProfileId, account.Id);
            device.ProfileId = account.Id;
        }
        if (device == null || device.ProfileId != account.Id)
        {
            await EnsureCapacityAsync(account.Id);
            (device, setToken) = NewDevice(account.Id, request.Name, version);
        }
        device.SessionVersion = version;
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return new ViewerSessionStart(await SessionAsync(device), setToken, setToken == null ? null : device.ExpiresAtUtc);
    }

    public async Task<ViewerSession?> GetSessionAsync(string? deviceToken)
    {
        var device = await DeviceAsync(deviceToken);
        return device == null ? null : await SessionAsync(device);
    }

    // ── Pairing (link a second device to the same anonymous profile) ──

    public async Task<PairingCode> CreatePairingCodeAsync(string? deviceToken)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        var device = await LockedDeviceAsync(deviceToken);
        var code = Secrets.NewUserCode();
        var now = DateTime.UtcNow;
        await context.ViewerPairingCodes.Where(item => item.DeviceId == device.Id || item.ExpiresAtUtc < now).ExecuteDeleteAsync();
        var expires = now.Add(PairingLifetime);
        context.ViewerPairingCodes.Add(new ViewerPairingCode { Hash = Secrets.Hash(code), DeviceId = device.Id, ExpiresAtUtc = expires });
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return new PairingCode(Secrets.FormatUserCode(code), expires);
    }

    public async Task PairAsync(string? deviceToken, PairRequest request)
    {
        var target = await DeviceAsync(deviceToken) ?? throw new UnauthorizedException("Sesión de espectador no válida.");
        var code = Secrets.NormalizeUserCode(request.Code) ?? throw new BadRequestException("El código no es válido o ya expiró.");
        var hash = Secrets.Hash(code);
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("viewer-code-" + hash);
        var pairing = await context.ViewerPairingCodes.SingleOrDefaultAsync(item => item.Hash == hash && item.ExpiresAtUtc > DateTime.UtcNow);
        if (pairing == null || pairing.DeviceId == target.Id) throw new BadRequestException("El código no es válido o ya expiró.");
        foreach (var id in new[] { pairing.DeviceId, target.Id }.Order()) await context.Database.LockAsync("viewer-device-" + id);
        var source = await context.ViewerDevices.SingleOrDefaultAsync(item => item.Id == pairing.DeviceId && item.ExpiresAtUtc > DateTime.UtcNow);
        await context.Entry(target).ReloadAsync();
        if (source == null || context.Entry(target).State == EntityState.Detached || target.ExpiresAtUtc <= DateTime.UtcNow)
            throw new BadRequestException("El código no es válido o ya expiró.");
        if (source.ProfileId != target.ProfileId)
        {
            foreach (var profile in new[] { source.ProfileId, target.ProfileId }.Order()) await context.Database.LockAsync("viewer-profile-" + profile);
            // Account profiles are only joined by signing in, never with a code.
            if (await IsAccountProfileAsync(source.ProfileId))
                throw new ConflictException("Usa el inicio de sesión para vincular un perfil con cuenta.");
            await EnsureCapacityAsync(target.ProfileId);
            await MergeProfilesAsync(source.ProfileId, target.ProfileId);
            source.ProfileId = target.ProfileId;
            var owner = await context.ViewerProfiles.Where(item => item.Id == target.ProfileId).Select(item => item.UserId).SingleAsync();
            source.SessionVersion = owner is int ownerId ? await SessionVersionAsync(ownerId) : null;
        }
        context.ViewerPairingCodes.Remove(pairing);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    // ── Progress ──

    public async Task<ProgressSaved> SaveProgressAsync(string? deviceToken, ProgressRequest request)
    {
        if (!double.IsFinite(request.Duration) || !double.IsFinite(request.CurrentSecond) || !double.IsFinite(request.StartSecond)
            || !double.IsFinite(request.EndSecond))
            throw new BadRequestException("Tramo de reproducción no válido.");
        if (!await context.Episodes.AnyAsync(item => item.Id == request.EpisodeId && item.IsAvailable))
            throw new NotFoundException("Episodio no encontrado.");
        await using var transaction = await context.Database.BeginTransactionAsync();
        var device = await LockedDeviceAsync(deviceToken);
        await context.Database.LockAsync("viewer-profile-" + device.ProfileId);
        var progress = await context.ViewerProgress.FindAsync(device.ProfileId, request.EpisodeId);
        if (progress == null)
        {
            progress = new ViewerProgress { ProfileId = device.ProfileId, EpisodeId = request.EpisodeId };
            context.ViewerProgress.Add(progress);
        }
        var stored = await context.ViewerWatchRanges.Where(range => range.ProfileId == device.ProfileId && range.EpisodeId == request.EpisodeId).ToListAsync();
        var merged = WatchCoverage.Merge(stored.Select(range => (range.StartSecond, range.EndSecond))
            .Append((Seconds(request.StartSecond), Seconds(request.EndSecond))));
        if (merged.Count > MaxWatchRanges) throw new BadRequestException("Demasiados tramos de reproducción.");
        context.ViewerWatchRanges.RemoveRange(stored);
        context.ViewerWatchRanges.AddRange(merged.Select(range => new ViewerWatchRange
            { ProfileId = device.ProfileId, EpisodeId = request.EpisodeId, StartSecond = range.Start, EndSecond = range.End }));
        progress.CurrentSecond = Seconds(request.CurrentSecond);
        progress.Completed |= WatchCoverage.Completed(merged, Seconds(request.Duration));
        progress.UpdatedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return new ProgressSaved(progress.Completed);
    }

    public async Task<IReadOnlyList<ProgressItem>> HistoryAsync(string? deviceToken)
    {
        var device = await DeviceAsync(deviceToken) ?? throw new UnauthorizedException("Sesión de espectador no válida.");
        return await ProgressAsync(device.ProfileId);
    }

    public async Task ResetSeriesProgressAsync(string? deviceToken, int seriesId)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        var device = await LockedDeviceAsync(deviceToken);
        await context.Database.LockAsync("viewer-profile-" + device.ProfileId);
        var episodes = context.Episodes.IgnoreQueryFilters().Where(episode => episode.SeriesId == seriesId).Select(episode => episode.Id);
        await context.ViewerWatchRanges.Where(range => range.ProfileId == device.ProfileId && episodes.Contains(range.EpisodeId)).ExecuteDeleteAsync();
        await context.ViewerProgress.Where(item => item.ProfileId == device.ProfileId && episodes.Contains(item.EpisodeId)).ExecuteDeleteAsync();
        await transaction.CommitAsync();
    }

    public async Task ClearHistoryAsync(string? deviceToken)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        var device = await LockedDeviceAsync(deviceToken);
        await context.Database.LockAsync("viewer-profile-" + device.ProfileId);
        await context.ViewerWatchRanges.Where(range => range.ProfileId == device.ProfileId).ExecuteDeleteAsync();
        await context.ViewerProgress.Where(item => item.ProfileId == device.ProfileId).ExecuteDeleteAsync();
        await transaction.CommitAsync();
    }

    public async Task<bool> UnlinkDeviceAsync(string? deviceToken, Guid deviceId)
    {
        var device = await DeviceAsync(deviceToken) ?? throw new UnauthorizedException("Sesión de espectador no válida.");
        await using var transaction = await context.Database.BeginTransactionAsync();
        foreach (var id in new[] { device.Id, deviceId }.Distinct().Order()) await context.Database.LockAsync("viewer-device-" + id);
        await context.ViewerPairingCodes.Where(item => item.DeviceId == deviceId).ExecuteDeleteAsync();
        if (await context.ViewerDevices.Where(item => item.Id == deviceId && item.ProfileId == device.ProfileId).ExecuteDeleteAsync() == 0)
            throw new NotFoundException("Dispositivo no encontrado.");
        await transaction.CommitAsync();
        return device.Id == deviceId;
    }

    // ── TV sign-in (device authorization grant) ──

    public async Task<DeviceAuthorizationStart> StartAuthorizationAsync(DeviceRequest request, int? approvedByUserId, string? approverDeviceToken)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.DeviceAuthorizations.Where(item => item.ExpiresAtUtc < DateTime.UtcNow).ExecuteDeleteAsync();
        var deviceCode = Secrets.NewToken();
        var userCode = Secrets.NewUserCode();
        var authorization = new DeviceAuthorization
        {
            DeviceCodeHash = Secrets.Hash(deviceCode),
            UserCodeHash = Secrets.Hash(userCode),
            Name = Secrets.SafeName(request.Name, "Televisor"),
            // A QR generated from a signed-in screen is pre-approved and short-lived.
            ExpiresAtUtc = DateTime.UtcNow.Add(approvedByUserId == null ? AuthorizationLifetime : QrAuthorizationLifetime)
        };
        if (approvedByUserId is int userId) await ApproveAsync(authorization, userId, approverDeviceToken);
        context.DeviceAuthorizations.Add(authorization);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return new DeviceAuthorizationStart(deviceCode, Secrets.FormatUserCode(userCode), authorization.ExpiresAtUtc, PollIntervalSeconds);
    }

    public async Task<DeviceAuthorizationInfo> InspectAuthorizationAsync(string userCode)
    {
        var hash = Secrets.Hash(Secrets.NormalizeUserCode(userCode) ?? throw new BadRequestException("Código no válido."));
        return await context.DeviceAuthorizations.AsNoTracking()
            .Where(item => item.UserCodeHash == hash && item.ExpiresAtUtc > DateTime.UtcNow && item.ProfileId == null)
            .Select(item => new DeviceAuthorizationInfo(item.Name, item.ExpiresAtUtc)).SingleOrDefaultAsync()
            ?? throw new NotFoundException("El código no existe o ya expiró.");
    }

    public async Task ApproveAuthorizationAsync(int userId, string userCode, string? approverDeviceToken)
    {
        var hash = Secrets.Hash(Secrets.NormalizeUserCode(userCode) ?? throw new BadRequestException("Código no válido."));
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("device-user-code-" + hash);
        var authorization = await context.DeviceAuthorizations
            .SingleOrDefaultAsync(item => item.UserCodeHash == hash && item.ExpiresAtUtc > DateTime.UtcNow && item.ProfileId == null)
            ?? throw new NotFoundException("El código no existe o ya expiró.");
        await ApproveAsync(authorization, userId, approverDeviceToken);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task<RedeemResult> RedeemAuthorizationAsync(string deviceCode)
    {
        if (deviceCode.Length != 64 || !deviceCode.All(Uri.IsHexDigit)) throw new BadRequestException("Código de dispositivo no válido.");
        var hash = Secrets.Hash(deviceCode);
        // The table has no poll timestamp: the polling interval is enforced per process.
        var pollKey = "device-poll-" + hash;
        if (cache.TryGetValue(pollKey, out _)) return new RedeemResult(RedeemStatus.SlowDown);
        cache.Set(pollKey, true, TimeSpan.FromSeconds(PollIntervalSeconds));

        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("device-code-" + hash);
        var authorization = await context.DeviceAuthorizations.SingleOrDefaultAsync(item => item.DeviceCodeHash == hash);
        if (authorization == null || authorization.ExpiresAtUtc <= DateTime.UtcNow) return new RedeemResult(RedeemStatus.Expired);
        if (authorization.ProfileId is not Guid profileId) return new RedeemResult(RedeemStatus.Pending);
        await context.Database.LockAsync("viewer-profile-" + profileId);
        var owner = await context.ViewerProfiles.Where(profile => profile.Id == profileId && profile.User != null)
            .Select(profile => new { profile.User!.Id, profile.User.SessionVersion }).SingleOrDefaultAsync();
        if (owner == null || owner.SessionVersion != authorization.SessionVersion)
        {
            context.DeviceAuthorizations.Remove(authorization);
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
            return new RedeemResult(RedeemStatus.Rejected);
        }
        if (await ActiveDevicesAsync(profileId) >= MaxDevicesPerProfile) return new RedeemResult(RedeemStatus.DeviceLimit);
        var (device, token) = NewDevice(profileId, authorization.Name, owner.SessionVersion);
        context.DeviceAuthorizations.Remove(authorization);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return new RedeemResult(RedeemStatus.Connected, token, device.ExpiresAtUtc);
    }

    // ── Admin ──

    public async Task<ViewerKpis> KpisAsync()
    {
        var now = DateTime.UtcNow;
        var watching = now.AddMinutes(-2);
        var week = now.AddDays(-7);
        return new ViewerKpis(
            await context.ViewerProfiles.CountAsync(),
            await context.ViewerProfiles.CountAsync(profile => profile.UserId != null),
            await context.ViewerDevices.CountAsync(device => device.ExpiresAtUtc > now),
            await context.ViewerProgress.Where(item => item.UpdatedAtUtc >= watching).Select(item => item.ProfileId).Distinct().CountAsync(),
            await context.ViewerProgress.CountAsync(item => item.Completed && item.UpdatedAtUtc >= week),
            await context.DeviceAuthorizations.CountAsync(item => item.ExpiresAtUtc > now));
    }

    public async Task<PagedResult<ViewerProfileItem>> ProfilesAsync(string? search, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var now = DateTime.UtcNow;
        var profiles = context.ViewerProfiles.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) profiles = profiles.Where(profile => profile.User != null && profile.User.Username.Contains(search.Trim()));
        var total = await profiles.CountAsync();
        var items = await profiles
            .Select(profile => new
            {
                profile.Id, Username = profile.User == null ? null : profile.User.Username, profile.CreatedAtUtc,
                Devices = context.ViewerDevices.Count(device => device.ProfileId == profile.Id && device.ExpiresAtUtc > now),
                Started = context.ViewerProgress.Count(item => item.ProfileId == profile.Id),
                Completed = context.ViewerProgress.Count(item => item.ProfileId == profile.Id && item.Completed),
                LastSeen = context.ViewerDevices.Where(device => device.ProfileId == profile.Id).Max(device => (DateTime?)device.LastSeenUtc)
            })
            .OrderByDescending(profile => profile.LastSeen).ThenBy(profile => profile.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedResult<ViewerProfileItem>(items.Select(item => new ViewerProfileItem(item.Id, item.Username, item.CreatedAtUtc, item.Devices,
            item.Started, item.Completed, item.LastSeen)).ToList(), total, page, pageSize);
    }

    public async Task<ViewerProfileDetail> ProfileAsync(Guid id)
    {
        var profile = await context.ViewerProfiles.AsNoTracking().Where(item => item.Id == id)
            .Select(item => new { item.Id, Username = item.User == null ? null : item.User.Username, item.CreatedAtUtc }).SingleOrDefaultAsync()
            ?? throw new NotFoundException("Perfil no encontrado.");
        return new ViewerProfileDetail(profile.Id, profile.Username, profile.CreatedAtUtc, await DevicesAsync(id, null), await ProgressAsync(id));
    }

    public async Task RevokeDeviceAsync(Guid deviceId)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("viewer-device-" + deviceId);
        await context.ViewerPairingCodes.Where(item => item.DeviceId == deviceId).ExecuteDeleteAsync();
        if (await context.ViewerDevices.Where(device => device.Id == deviceId).ExecuteDeleteAsync() == 0)
            throw new NotFoundException("Dispositivo no encontrado.");
        await transaction.CommitAsync();
    }

    public async Task<IReadOnlyList<PendingAuthorizationItem>> PendingAuthorizationsAsync() =>
        await context.DeviceAuthorizations.AsNoTracking().Where(item => item.ExpiresAtUtc > DateTime.UtcNow).OrderBy(item => item.ExpiresAtUtc)
            .Select(item => new PendingAuthorizationItem(item.Name, item.ExpiresAtUtc, item.ProfileId != null,
                item.Profile != null && item.Profile.User != null ? item.Profile.User.Username : null))
            .ToListAsync();

    // ── Helpers ──

    /// <summary>A device is valid while unexpired and, for account profiles, while the account session version matches.</summary>
    private Task<ViewerDevice?> DeviceAsync(string? token)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 128) return Task.FromResult<ViewerDevice?>(null);
        var hash = Secrets.Hash(token);
        var now = DateTime.UtcNow;
        return context.ViewerDevices.SingleOrDefaultAsync(device => device.TokenHash == hash && device.ExpiresAtUtc > now
            && (device.Profile.UserId == null || device.Profile.User != null && device.SessionVersion == device.Profile.User.SessionVersion));
    }

    /// <summary>Locks the caller's device inside the current transaction and re-reads it.</summary>
    private async Task<ViewerDevice> LockedDeviceAsync(string? token)
    {
        var device = await DeviceAsync(token) ?? throw new UnauthorizedException("Sesión de espectador no válida.");
        await context.Database.LockAsync("viewer-device-" + device.Id);
        await context.Entry(device).ReloadAsync();
        if (context.Entry(device).State == EntityState.Detached || device.ExpiresAtUtc <= DateTime.UtcNow)
            throw new UnauthorizedException("Sesión de espectador no válida.");
        return device;
    }

    private (ViewerDevice Device, string Token) NewDevice(Guid profileId, string? name, int? sessionVersion)
    {
        var token = Secrets.NewToken();
        var now = DateTime.UtcNow;
        var device = new ViewerDevice
        {
            Id = Guid.NewGuid(), ProfileId = profileId, TokenHash = Secrets.Hash(token), Name = Secrets.SafeName(name),
            SessionVersion = sessionVersion, LastSeenUtc = now, ExpiresAtUtc = now.Add(DeviceLifetime)
        };
        context.ViewerDevices.Add(device);
        return (device, token);
    }

    /// <summary>The caller owns a transaction; the account lock and a unique index prevent duplicate profiles.</summary>
    private async Task<ViewerProfile> AccountProfileAsync(int userId, Guid? preferred)
    {
        await context.Database.LockAsync("viewer-account-" + userId);
        var profile = await context.ViewerProfiles.SingleOrDefaultAsync(item => item.UserId == userId);
        if (profile != null) return profile;
        if (preferred != null)
        {
            await context.Database.LockAsync("viewer-profile-" + preferred);
            profile = await context.ViewerProfiles.SingleOrDefaultAsync(item => item.Id == preferred && item.UserId == null);
        }
        if (profile == null)
        {
            profile = new ViewerProfile { Id = Guid.NewGuid(), CreatedAtUtc = DateTime.UtcNow };
            context.ViewerProfiles.Add(profile);
        }
        profile.UserId = userId;
        var version = await SessionVersionAsync(userId);
        await context.SaveChangesAsync();
        await context.ViewerDevices.Where(device => device.ProfileId == profile.Id)
            .ExecuteUpdateAsync(update => update.SetProperty(device => device.SessionVersion, version));
        return profile;
    }

    private async Task ApproveAsync(DeviceAuthorization authorization, int userId, string? approverDeviceToken)
    {
        var approver = await DeviceAsync(approverDeviceToken);
        var profile = await AccountProfileAsync(userId, approver?.ProfileId);
        authorization.ProfileId = profile.Id;
        authorization.SessionVersion = await SessionVersionAsync(userId);
    }

    private async Task MergeProfilesAsync(Guid source, Guid target)
    {
        var progress = await context.ViewerProgress.Where(item => item.ProfileId == source).ToListAsync();
        foreach (var item in progress)
        {
            var existing = await context.ViewerProgress.FindAsync(target, item.EpisodeId);
            if (existing == null)
                context.ViewerProgress.Add(new ViewerProgress
                {
                    ProfileId = target, EpisodeId = item.EpisodeId, CurrentSecond = item.CurrentSecond, Completed = item.Completed,
                    UpdatedAtUtc = item.UpdatedAtUtc
                });
            else
            {
                existing.Completed |= item.Completed;
                if (item.UpdatedAtUtc > existing.UpdatedAtUtc)
                {
                    existing.CurrentSecond = item.CurrentSecond;
                    existing.UpdatedAtUtc = item.UpdatedAtUtc;
                }
            }
            var ranges = await context.ViewerWatchRanges
                .Where(range => (range.ProfileId == source || range.ProfileId == target) && range.EpisodeId == item.EpisodeId).ToListAsync();
            context.ViewerWatchRanges.RemoveRange(ranges);
            context.ViewerWatchRanges.AddRange(WatchCoverage.Merge(ranges.Select(range => (range.StartSecond, range.EndSecond)))
                .Select(range => new ViewerWatchRange { ProfileId = target, EpisodeId = item.EpisodeId, StartSecond = range.Start, EndSecond = range.End }));
        }
        context.ViewerProgress.RemoveRange(progress);
        await context.SaveChangesAsync();
        // Other devices of the merged anonymous profile follow it.
        await context.ViewerDevices.Where(device => device.ProfileId == source).ExecuteUpdateAsync(update => update.SetProperty(device => device.ProfileId, target));
        await context.ViewerWatchRanges.Where(range => range.ProfileId == source).ExecuteDeleteAsync();
    }

    private async Task EnsureCapacityAsync(Guid profileId)
    {
        if (await ActiveDevicesAsync(profileId) >= MaxDevicesPerProfile)
            throw new ConflictException("Este perfil ya tiene diez dispositivos. Desvincula uno primero.");
    }

    private Task<int> ActiveDevicesAsync(Guid profileId) =>
        context.ViewerDevices.CountAsync(device => device.ProfileId == profileId && device.ExpiresAtUtc > DateTime.UtcNow);

    private Task<bool> IsAccountProfileAsync(Guid profileId) =>
        context.ViewerProfiles.AnyAsync(profile => profile.Id == profileId && profile.UserId != null);

    private Task<int> SessionVersionAsync(int userId) =>
        context.Users.Where(user => user.Id == userId).Select(user => user.SessionVersion).SingleAsync();

    private async Task<ViewerSession> SessionAsync(ViewerDevice device)
    {
        var now = DateTime.UtcNow;
        if (now - device.LastSeenUtc > TimeSpan.FromMinutes(1))
            await context.ViewerDevices.Where(item => item.Id == device.Id).ExecuteUpdateAsync(update => update.SetProperty(item => item.LastSeenUtc, now));
        var username = await context.ViewerProfiles.Where(profile => profile.Id == device.ProfileId)
            .Select(profile => profile.User == null ? null : profile.User.Username).SingleOrDefaultAsync();
        return new ViewerSession(device.ProfileId, username != null, username, await DevicesAsync(device.ProfileId, device.Id),
            await ProgressAsync(device.ProfileId));
    }

    private async Task<IReadOnlyList<ViewerDeviceItem>> DevicesAsync(Guid profileId, Guid? current)
    {
        var now = DateTime.UtcNow;
        return await context.ViewerDevices.AsNoTracking().Where(device => device.ProfileId == profileId && device.ExpiresAtUtc > now)
            .OrderByDescending(device => device.LastSeenUtc)
            .Select(device => new ViewerDeviceItem(device.Id, device.Name, device.LastSeenUtc, device.ExpiresAtUtc, device.Id == current))
            .ToListAsync();
    }

    private async Task<IReadOnlyList<ProgressItem>> ProgressAsync(Guid profileId) =>
        await context.ViewerProgress.AsNoTracking().Where(item => item.ProfileId == profileId)
            .OrderByDescending(item => item.UpdatedAtUtc).Take(2000)
            .Select(item => new ProgressItem(item.Episode.SeriesId, item.Episode.Season.Series.Name, item.EpisodeId, item.Episode.Title,
                item.Episode.SeasonNumber, item.Episode.EpisodeNumber, item.CurrentSecond, item.Completed, item.UpdatedAtUtc, item.Episode.Part))
            .ToListAsync();

    private static decimal Seconds(double value) => decimal.Round((decimal)Math.Max(0, value), 3);
}
