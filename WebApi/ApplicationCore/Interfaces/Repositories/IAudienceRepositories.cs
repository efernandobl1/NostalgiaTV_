using ApplicationCore.DTOs;
using ApplicationCore.Models;

namespace ApplicationCore.Interfaces.Repositories;

/// <summary>Device sessions identified by an HttpOnly cookie token (web, phone and TV).</summary>
public interface IViewerRepository
{
    Task<ViewerSessionStart> StartSessionAsync(string? deviceToken, int? userId, DeviceRequest request);
    Task<ViewerSession?> GetSessionAsync(string? deviceToken);
    Task<PairingCode> CreatePairingCodeAsync(string? deviceToken);
    Task PairAsync(string? deviceToken, PairRequest request);
    Task<ProgressSaved> SaveProgressAsync(string? deviceToken, ProgressRequest request);
    Task<IReadOnlyList<ProgressItem>> HistoryAsync(string? deviceToken);
    Task ResetSeriesProgressAsync(string? deviceToken, int seriesId);
    Task ClearHistoryAsync(string? deviceToken);
    /// <summary>Returns true when the removed device is the caller's own.</summary>
    Task<bool> UnlinkDeviceAsync(string? deviceToken, Guid deviceId);

    // TV sign-in (device authorization grant)
    Task<DeviceAuthorizationStart> StartAuthorizationAsync(DeviceRequest request, int? approvedByUserId, string? approverDeviceToken);
    Task<DeviceAuthorizationInfo> InspectAuthorizationAsync(string userCode);
    Task ApproveAuthorizationAsync(int userId, string userCode, string? approverDeviceToken);
    Task<RedeemResult> RedeemAuthorizationAsync(string deviceCode);

    // Admin
    Task<ViewerKpis> KpisAsync();
    Task<PagedResult<ViewerProfileItem>> ProfilesAsync(string? search, int page, int pageSize);
    Task<ViewerProfileDetail> ProfileAsync(Guid id);
    Task RevokeDeviceAsync(Guid deviceId);
    Task<IReadOnlyList<PendingAuthorizationItem>> PendingAuthorizationsAsync();
}

public interface IMediaRepository
{
    Task<MediaStatus> StatusAsync(MediaQuery query);
    Task SetWorkerAsync(string worker, bool enabled);
    Task<ResourcePolicyItem> SetResourcesAsync(ResourcePolicyRequest request);
    Task RetryAsync(IReadOnlyList<long> jobIds);
    Task DeleteJobsAsync(IReadOnlyList<long> jobIds);
    Task<int> ClearQueueAsync(ClearQueueRequest request);
    Task<StorageReport> StorageAsync(CancellationToken token);

    /// <summary>One pass of a media worker process: discover files, queue jobs and run them.</summary>
    Task RunWorkerCycleAsync(string worker, MediaWorkerMemory memory, CancellationToken token);
    /// <summary>Cores the worker may use now, from the resource policy and the platform time zone.</summary>
    Task<int> CurrentCoresAsync(int ceiling, CancellationToken token);
}

/// <summary>Per-process worker memory: a file must look identical on two passes before it is processed.</summary>
public sealed class MediaWorkerMemory
{
    public Dictionary<string, string> Observations { get; } = [];
    public bool Recovered { get; set; }
}

public interface IDashboardRepository
{
    Task<DashboardSummary> SummaryAsync(CancellationToken token);
}
