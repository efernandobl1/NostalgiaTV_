using System.ComponentModel.DataAnnotations;

namespace ApplicationCore.DTOs;

public sealed record MediaWorkerItem(string Id, bool Enabled, DateTime? HeartbeatUtc, bool Online);

public sealed record ResourcePolicyItem(int DayCores, int NightCores, bool NightEnabled, int NightStartMinute, int NightEndMinute,
    string TimeZoneId, int AvailableCores, int CurrentCores, bool NightNow);

public sealed record ResourcePolicyRequest([Range(1, 2)] int DayCores, [Range(1, 4)] int NightCores, bool NightEnabled,
    [Range(0, 1439)] int NightStartMinute, [Range(0, 1439)] int NightEndMinute) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (NightStartMinute == NightEndMinute)
            yield return new("El inicio y el fin nocturno no pueden coincidir.", [nameof(NightEndMinute)]);
    }
}

/// <summary>SeriesName is the series, or "Channel · Era" for an era folder's bumper.</summary>
public sealed record MediaJobItem(long Id, string Worker, int? SeriesId, string SeriesName, string Status, double Progress,
    string SourcePath, string? OutputPath, long SourceSize, string? Message, DateTime CreatedAtUtc, DateTime UpdatedAtUtc);

public sealed record MediaQuery(string Worker = "all", string View = "pending", int Page = 1, int PageSize = 20);

public sealed record MediaStatus(IReadOnlyList<MediaWorkerItem> Workers, ResourcePolicyItem Resources,
    IReadOnlyDictionary<string, int> Counts, IReadOnlyList<MediaJobItem> Jobs, int TotalJobs, int Page, int PageSize);

public sealed record WorkerRequest(bool Enabled);

public sealed record JobIdsRequest([Required, MinLength(1), MaxLength(200)] IReadOnlyList<long> JobIds);

/// <summary>Clearing the queue is destructive; the caller must type LIMPIAR. Jobs being processed are never removed.</summary>
public sealed record ClearQueueRequest(
    [Required] string Confirmation,
    [Required, MinLength(1)] IReadOnlyList<string> Statuses,
    int? SeriesId = null,
    string? Worker = null,
    [Range(1, 3650)] int? OlderThanDays = null);

public sealed record StorageReport(DateTime MeasuredAtUtc, long? LibraryBytes, long? TotalBytes, long? AvailableBytes,
    IReadOnlyList<SeriesStorage> Series);

public sealed record SeriesStorage(int SeriesId, string Name, int EpisodeCount, int MissingEpisodeCount, long? SizeBytes);

// ── Admin: Resumen ──

public sealed record DashboardSummary(int SeriesCount, int EpisodeCount, int MissingEpisodeFiles, int ChannelCount,
    int LiveChannelCount, int EraCount, int UserCount, int ActiveDevices, int PendingComments, int QueuedMediaJobs,
    int FailedMediaJobs, IReadOnlyList<ChannelListItem> Channels, IReadOnlyList<ActivityItem> LatestActivity);
