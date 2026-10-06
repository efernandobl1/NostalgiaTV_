using System.Security.Cryptography;
using System.Text;
using ApplicationCore.Entities;
using Asp.Versioning;
using Infrastructure.Contexts;
using Infrastructure.Services.Viewing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Controllers;

[ApiController, ApiVersion("1"), AllowAnonymous]
[Route("api/v{version:apiVersion}/viewer")]
[EnableRateLimiting("ViewerPolicy")]
public class ViewerController(NostalgiaTVContext context) : ControllerBase
{
    private bool Development => HttpContext.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment();
    private string Cookie => Development ? "viewer_device" : "__Host-viewer_device";
    private string CookiePath => Development ? "/api/v1/viewer" : "/";
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private Task<ViewerDevice?> Device() => context.ViewerDevices.SingleOrDefaultAsync(item =>
        item.TokenHash == Hash(Request.Cookies[Cookie] ?? "") && item.ExpiresAtUtc > DateTime.UtcNow);

    [HttpPost("session"), EnableRateLimiting("ViewerCreationPolicy")]
    public async Task<IActionResult> Start(DeviceRequest request)
    {
        var device = await Device();
        if (device == null)
        {
            var now = DateTime.UtcNow;
            var profile = new ViewerProfile { Id = Guid.NewGuid(), CreatedAtUtc = now };
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            device = new ViewerDevice { Id = Guid.NewGuid(), ProfileId = profile.Id, TokenHash = Hash(token),
                Name = SafeName(request.Name), LastSeenUtc = now, ExpiresAtUtc = now.AddMonths(6) };
            context.ViewerProfiles.Add(profile);
            context.ViewerDevices.Add(device);
            Response.Cookies.Append(Cookie, token, new CookieOptions { HttpOnly = true, Secure = !Development,
                SameSite = SameSiteMode.Strict, Expires = device.ExpiresAtUtc, Path = CookiePath, IsEssential = true });
            await context.SaveChangesAsync();
        }
        return await Session(device);
    }

    [HttpGet("session")]
    public async Task<IActionResult> GetSession()
    {
        var device = await Device();
        return device == null ? Unauthorized() : await Session(device);
    }

    private async Task<IActionResult> Session(ViewerDevice device)
    {
        device.LastSeenUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
        var progress = await (from watched in context.ViewerProgress.AsNoTracking()
                              join episode in context.Episodes on watched.EpisodeId equals episode.Id
                              where watched.ProfileId == device.ProfileId
                              orderby watched.UpdatedAtUtc descending
                              select new { episode.SeriesId, EpisodeId = episode.Id, episode.Season, episode.EpisodeNumber,
                                  watched.CurrentSecond, watched.Completed, watched.UpdatedAtUtc }).Take(10000).ToListAsync();
        var devices = await context.ViewerDevices.AsNoTracking().Where(item => item.ProfileId == device.ProfileId && item.ExpiresAtUtc > DateTime.UtcNow)
            .Select(item => new { item.Id, item.Name, item.LastSeenUtc, Current = item.Id == device.Id }).ToListAsync();
        return Ok(new { device.ProfileId, Devices = devices.Select(item => new { item.Id, item.Name, LastSeenUtc = DateTime.SpecifyKind(item.LastSeenUtc, DateTimeKind.Utc), item.Current }), Progress = progress.Select(item => new { item.SeriesId, item.EpisodeId,
            item.Season, item.EpisodeNumber, item.CurrentSecond, item.Completed, UpdatedAtUtc = DateTime.SpecifyKind(item.UpdatedAtUtc, DateTimeKind.Utc) }) });
    }

    [HttpPost("code"), EnableRateLimiting("PairingPolicy")]
    public async Task<IActionResult> CreateCode()
    {
        var device = await Device();
        if (device == null) return Unauthorized();
        await using var transaction = await context.Database.BeginTransactionAsync();
        await Lock("viewer-device-" + device.Id);
        await context.Entry(device).ReloadAsync();
        if (context.Entry(device).State == EntityState.Detached || device.ExpiresAtUtc <= DateTime.UtcNow) return Unauthorized();
        var code = new string(Enumerable.Range(0, 12).Select(_ => Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)]).ToArray());
        await context.ViewerPairingCodes.Where(item => item.DeviceId == device.Id || item.ExpiresAtUtc < DateTime.UtcNow).ExecuteDeleteAsync();
        var expires = DateTime.UtcNow.AddMinutes(10);
        context.ViewerPairingCodes.Add(new ViewerPairingCode { Hash = Hash(code), DeviceId = device.Id, ExpiresAtUtc = expires });
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { Code = string.Join('-', Enumerable.Range(0, 4).Select(index => code.Substring(index * 3, 3))), ExpiresAtUtc = DateTime.SpecifyKind(expires, DateTimeKind.Utc) });
    }

    [HttpPost("pair"), EnableRateLimiting("PairingPolicy")]
    public async Task<IActionResult> Pair(PairRequest request)
    {
        var target = await Device();
        if (target == null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 32) return BadRequest();
        var code = request.Code.Replace("-", "").Replace(" ", "").ToUpperInvariant();
        if (code.Length != 12 || code.Any(character => !Alphabet.Contains(character))) return BadRequest();
        await using var transaction = await context.Database.BeginTransactionAsync();
        var hash = Hash(code);
        await Lock("viewer-code-" + hash);
        var pairing = await context.ViewerPairingCodes.SingleOrDefaultAsync(item => item.Hash == hash && item.ExpiresAtUtc > DateTime.UtcNow);
        if (pairing == null || pairing.DeviceId == target.Id) return BadRequest(new { message = "El código no es válido o ya expiró." });
        var source = await context.ViewerDevices.SingleOrDefaultAsync(item => item.Id == pairing.DeviceId && item.ExpiresAtUtc > DateTime.UtcNow);
        if (source == null) return BadRequest();
        foreach (var id in new[] { source.Id, target.Id }.Order()) await Lock("viewer-device-" + id);
        await context.Entry(source).ReloadAsync();
        await context.Entry(target).ReloadAsync();
        if (context.Entry(source).State == EntityState.Detached || context.Entry(target).State == EntityState.Detached ||
            source.ExpiresAtUtc <= DateTime.UtcNow || target.ExpiresAtUtc <= DateTime.UtcNow) return Unauthorized();
        if (source.ProfileId != target.ProfileId)
        {
            foreach (var profile in new[] { source.ProfileId, target.ProfileId }.Order()) await Lock("viewer-profile-" + profile);
            if (await context.ViewerDevices.CountAsync(item => item.ProfileId == target.ProfileId && item.ExpiresAtUtc > DateTime.UtcNow) >= 10)
                return Conflict(new { message = "Este perfil ya tiene diez dispositivos. Desvincula uno primero." });
            await MergeProfiles(source.ProfileId, target.ProfileId);
            source.ProfileId = target.ProfileId;
        }
        context.ViewerPairingCodes.Remove(pairing);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return NoContent();
    }

    private async Task MergeProfiles(Guid source, Guid target)
    {
        var progress = await context.ViewerProgress.Where(item => item.ProfileId == source).ToListAsync();
        foreach (var item in progress)
        {
            var existing = await context.ViewerProgress.FindAsync(target, item.EpisodeId);
            if (existing == null)
            {
                existing = new ViewerProgress { ProfileId = target, EpisodeId = item.EpisodeId, CurrentSecond = item.CurrentSecond,
                    Completed = item.Completed, UpdatedAtUtc = item.UpdatedAtUtc };
                context.ViewerProgress.Add(existing);
                await context.SaveChangesAsync();
            }
            else
            {
                existing.Completed |= item.Completed;
                if (item.UpdatedAtUtc > existing.UpdatedAtUtc) { existing.CurrentSecond = item.CurrentSecond; existing.UpdatedAtUtc = item.UpdatedAtUtc; }
            }
            var ranges = await context.ViewerWatchRanges.Where(range => (range.ProfileId == source || range.ProfileId == target) && range.EpisodeId == item.EpisodeId).ToListAsync();
            context.ViewerWatchRanges.RemoveRange(ranges.Where(range => range.ProfileId == target));
            context.ViewerWatchRanges.AddRange(WatchCoverage.Merge(ranges.Select(range => (range.StartSecond, range.EndSecond)))
                .Select(range => new ViewerWatchRange { ProfileId = target, EpisodeId = item.EpisodeId, StartSecond = range.Start, EndSecond = range.End }));
        }
    }

    [HttpPost("progress")]
    public async Task<IActionResult> Progress(ProgressRequest request)
    {
        var device = await Device();
        if (device == null) return Unauthorized();
        if (!double.IsFinite(request.Duration) || !double.IsFinite(request.CurrentSecond) || !double.IsFinite(request.StartSecond) || !double.IsFinite(request.EndSecond) ||
            request.Duration is <= 0 or > 28800 || request.StartSecond < 0 || request.EndSecond < request.StartSecond || request.EndSecond > request.Duration + 1 ||
            request.EndSecond - request.StartSecond > 45 || request.CurrentSecond < 0 || request.CurrentSecond > request.Duration + 1)
            return BadRequest();
        if (!await context.Episodes.AnyAsync(item => item.Id == request.EpisodeId)) return NotFound();
        await using var transaction = await context.Database.BeginTransactionAsync();
        await Lock("viewer-device-" + device.Id);
        await context.Entry(device).ReloadAsync();
        if (context.Entry(device).State == EntityState.Detached || device.ExpiresAtUtc <= DateTime.UtcNow) return Unauthorized();
        await Lock("viewer-profile-" + device.ProfileId);
        var item = await context.ViewerProgress.FindAsync(device.ProfileId, request.EpisodeId);
        if (item == null) { item = new ViewerProgress { ProfileId = device.ProfileId, EpisodeId = request.EpisodeId }; context.ViewerProgress.Add(item); await context.SaveChangesAsync(); }
        var stored = await context.ViewerWatchRanges.Where(range => range.ProfileId == device.ProfileId && range.EpisodeId == request.EpisodeId).ToListAsync();
        var merged = WatchCoverage.Merge(stored.Select(range => (range.StartSecond, range.EndSecond)).Append((request.StartSecond, request.EndSecond)));
        if (merged.Count > 512) return BadRequest(new { message = "Demasiados tramos de reproducción." });
        context.ViewerWatchRanges.RemoveRange(stored);
        context.ViewerWatchRanges.AddRange(merged.Select(range => new ViewerWatchRange { ProfileId = device.ProfileId, EpisodeId = request.EpisodeId, StartSecond = range.Start, EndSecond = range.End }));
        item.CurrentSecond = request.CurrentSecond;
        item.Completed |= WatchCoverage.Completed(merged, request.Duration);
        item.UpdatedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { item.Completed });
    }

    [HttpDelete("series/{seriesId:int}/progress")]
    public async Task<IActionResult> Reset(int seriesId)
    {
        var device = await Device();
        if (device == null) return Unauthorized();
        await using var transaction = await context.Database.BeginTransactionAsync();
        await Lock("viewer-device-" + device.Id);
        await context.Entry(device).ReloadAsync();
        if (context.Entry(device).State == EntityState.Detached || device.ExpiresAtUtc <= DateTime.UtcNow) return Unauthorized();
        await Lock("viewer-profile-" + device.ProfileId);
        await context.ViewerProgress.Where(item => item.ProfileId == device.ProfileId && context.Episodes.Any(episode => episode.Id == item.EpisodeId && episode.SeriesId == seriesId)).ExecuteDeleteAsync();
        await transaction.CommitAsync();
        return NoContent();
    }

    [HttpDelete("devices/{id:guid}")]
    public async Task<IActionResult> Unlink(Guid id)
    {
        var device = await Device();
        if (device == null) return Unauthorized();
        await using var transaction = await context.Database.BeginTransactionAsync();
        foreach (var deviceId in new[] { device.Id, id }.Distinct().Order()) await Lock("viewer-device-" + deviceId);
        await context.Entry(device).ReloadAsync();
        if (context.Entry(device).State == EntityState.Detached || device.ExpiresAtUtc <= DateTime.UtcNow) return Unauthorized();
        if (await context.ViewerDevices.Where(item => item.Id == id && item.ProfileId == device.ProfileId).ExecuteDeleteAsync() == 0) return NotFound();
        if (device.Id == id) Response.Cookies.Delete(Cookie, new CookieOptions { Path = CookiePath, Secure = !Development, HttpOnly = true, SameSite = SameSiteMode.Strict });
        await transaction.CommitAsync();
        return NoContent();
    }

    private Task Lock(string resource) => context.Database.ExecuteSqlInterpolatedAsync($"DECLARE @result int; EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @result < 0 THROW 50000, 'Viewer lock unavailable', 1;");
    private static string SafeName(string? name) => string.IsNullOrWhiteSpace(name) ? "Dispositivo" : new string(name.Where(character => !char.IsControl(character)).Take(80).ToArray());
    public sealed record DeviceRequest(string? Name);
    public sealed record PairRequest(string Code);
    public sealed record ProgressRequest(int EpisodeId, double StartSecond, double EndSecond, double Duration, double CurrentSecond);
}
