using System.ComponentModel.DataAnnotations;

namespace ApplicationCore.DTOs;

// ── Viewer devices (web, phone and TV) ──

public sealed record DeviceRequest([StringLength(80)] string? Name);

public sealed record ViewerSession(Guid ProfileId, bool AccountLinked, string? Username, IReadOnlyList<ViewerDeviceItem> Devices,
    IReadOnlyList<ProgressItem> Progress);

public sealed record ViewerDeviceItem(Guid Id, string Name, DateTime LastSeenUtc, DateTime ExpiresAtUtc, bool Current);

public sealed record ProgressItem(int SeriesId, string SeriesName, int EpisodeId, string EpisodeTitle, int SeasonNumber,
    int EpisodeNumber, decimal CurrentSecond, bool Completed, DateTime UpdatedAtUtc, string? EpisodePart);

/// <summary>Result of starting a session: SetToken is the new device credential, if one was issued.</summary>
public sealed record ViewerSessionStart(ViewerSession Session, string? SetToken, DateTime? TokenExpiresUtc);

public sealed record PairingCode(string Code, DateTime ExpiresAtUtc);

public sealed record PairRequest([Required, StringLength(32)] string Code);

public sealed record ProgressRequest(
    [Range(1, int.MaxValue)] int EpisodeId,
    [Range(0, 28800)] double StartSecond,
    [Range(0, 28801)] double EndSecond,
    [Range(0.001, 28800)] double Duration,
    [Range(0, 28801)] double CurrentSecond) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (EndSecond < StartSecond || EndSecond - StartSecond > 45 || EndSecond > Duration + 1 || CurrentSecond > Duration + 1)
            yield return new("Tramo de reproducción no válido.", [nameof(EndSecond)]);
    }
}

public sealed record ProgressSaved(bool Completed);

// ── TV sign-in (device authorization) ──

public sealed record DeviceAuthorizationStart(string DeviceCode, string UserCode, DateTime ExpiresAtUtc, int IntervalSeconds);

public sealed record DeviceAuthorizationInfo(string Name, DateTime ExpiresAtUtc);

public sealed record CodeRequest([Required, StringLength(32)] string Code);

public sealed record RedeemRequest([Required, StringLength(64, MinimumLength = 64)] string DeviceCode);

public enum RedeemStatus { Pending, SlowDown, Expired, Connected, Rejected, DeviceLimit }

public sealed record RedeemResult(RedeemStatus Status, string? SetToken = null, DateTime? TokenExpiresUtc = null);

// ── Admin: Espectadores ──

public sealed record ViewerKpis(int Profiles, int LinkedProfiles, int ActiveDevices, int WatchingNow, int EpisodesCompleted7d,
    int PendingAuthorizations);

public sealed record ViewerProfileItem(Guid Id, string? Username, DateTime CreatedAtUtc, int DeviceCount, int EpisodesStarted,
    int EpisodesCompleted, DateTime? LastSeenUtc);

public sealed record ViewerProfileDetail(Guid Id, string? Username, DateTime CreatedAtUtc, IReadOnlyList<ViewerDeviceItem> Devices,
    IReadOnlyList<ProgressItem> Progress);

public sealed record PendingAuthorizationItem(string Name, DateTime ExpiresAtUtc, bool Approved, string? Username);
