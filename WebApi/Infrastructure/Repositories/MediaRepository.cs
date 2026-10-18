using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Settings;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Repositories;

/// <summary>
/// Media processing queue: the admin "Media" screen and the worker process that indexes compatible
/// videos and transcodes incompatible ones (originals are always kept).
/// </summary>
public sealed class MediaRepository(NostalgiaTVContext context, MediaLibrary library, LibraryImporter importer, MediaProbe probe,
    MediaTranscoder transcoder, MediaStorageMeter meter, IOptions<MediaProcessingSettings> settings, ILogger<MediaRepository> logger)
    : IMediaRepository
{
    public const string ClearConfirmation = "LIMPIAR";
    private static readonly string[] Views = ["pending", "all", .. MediaJobStatus.All];

    // ── Admin ──

    public async Task<MediaStatus> StatusAsync(MediaQuery query)
    {
        if ((query.Worker != "all" && !MediaWorkers.All.Contains(query.Worker)) || !Views.Contains(query.View))
            throw new BadRequestException("Selecciona un servicio y un estado válidos.");
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var tolerance = TimeSpan.FromSeconds(Math.Clamp(settings.Value.PollSeconds, 10, 3600) * 2 + 120);
        var now = DateTime.UtcNow;
        var workers = (await context.MediaWorkerStates.AsNoTracking().OrderBy(worker => worker.Id).ToListAsync())
            .Select(worker => new MediaWorkerItem(worker.Id, worker.Enabled, worker.HeartbeatUtc, worker.HeartbeatUtc > now - tolerance)).ToList();

        var jobs = context.MediaProcessingJobs.AsNoTracking();
        if (query.Worker != "all") jobs = jobs.Where(job => job.Worker == query.Worker);
        var counts = await jobs.GroupBy(job => job.Status).Select(group => new { group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Key, item => item.Count);
        foreach (var status in MediaJobStatus.All) counts.TryAdd(status, 0);

        if (query.View == "pending") jobs = jobs.Where(job => job.Status == MediaJobStatus.Queued || job.Status == MediaJobStatus.Processing);
        else if (query.View != "all") jobs = jobs.Where(job => job.Status == query.View);
        var total = await jobs.CountAsync();
        var page = Math.Clamp(query.Page, 1, Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)));
        var ordered = query.View == "pending"
            ? jobs.OrderByDescending(job => job.Status == MediaJobStatus.Processing).ThenBy(job => job.Id)
            : jobs.OrderByDescending(job => job.UpdatedAtUtc).ThenByDescending(job => job.Id);
        var items = await ordered.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(job => new MediaJobItem(job.Id, job.Worker, job.SeriesId, job.Series.Name, job.Status, job.Progress, job.SourcePath,
                job.OutputPath, job.SourceSize, job.Message, job.CreatedAtUtc, job.UpdatedAtUtc))
            .ToListAsync();
        return new MediaStatus(workers, await ResourcesAsync(), counts, items, total, page, pageSize);
    }

    public async Task SetWorkerAsync(string worker, bool enabled)
    {
        if (await context.MediaWorkerStates.Where(state => state.Id == worker)
                .ExecuteUpdateAsync(update => update.SetProperty(state => state.Enabled, enabled)) == 0)
            throw new NotFoundException("Servicio de media no encontrado.");
    }

    public async Task<ResourcePolicyItem> SetResourcesAsync(ResourcePolicyRequest request)
    {
        var policy = await context.MediaResourcePolicies.SingleAsync();
        policy.DayCores = request.DayCores;
        policy.NightCores = request.NightCores;
        policy.NightEnabled = request.NightEnabled;
        policy.NightStartMinute = request.NightStartMinute;
        policy.NightEndMinute = request.NightEndMinute;
        await context.SaveChangesAsync();
        return await ResourcesAsync();
    }

    public async Task RetryAsync(IReadOnlyList<long> jobIds)
    {
        var ids = jobIds.Distinct().ToList();
        var changed = await context.MediaProcessingJobs.Where(job => ids.Contains(job.Id) && job.Status == MediaJobStatus.Failed)
            .ExecuteUpdateAsync(update => update.SetProperty(job => job.Status, MediaJobStatus.Queued).SetProperty(job => job.Progress, 0)
                .SetProperty(job => job.Message, (string?)null).SetProperty(job => job.UpdatedAtUtc, DateTime.UtcNow));
        if (changed == 0) throw new ConflictException("Solo se pueden reintentar trabajos fallidos.");
    }

    public async Task DeleteJobsAsync(IReadOnlyList<long> jobIds)
    {
        var ids = jobIds.Distinct().ToList();
        if (await context.MediaProcessingJobs.AnyAsync(job => ids.Contains(job.Id) && job.Status == MediaJobStatus.Processing))
            throw new ConflictException("Los trabajos en procesamiento no se pueden eliminar; deshabilita el servicio primero.");
        if (await context.MediaProcessingJobs.Where(job => ids.Contains(job.Id)).ExecuteDeleteAsync() == 0)
            throw new NotFoundException("Trabajo no encontrado.");
    }

    public async Task<int> ClearQueueAsync(ClearQueueRequest request)
    {
        if (!string.Equals(request.Confirmation?.Trim(), ClearConfirmation, StringComparison.OrdinalIgnoreCase))
            throw new BadRequestException("Escribe LIMPIAR para confirmar.");
        var statuses = request.Statuses.Distinct().ToList();
        if (statuses.Count == 0 || statuses.Any(status => !MediaJobStatus.All.Contains(status) || status == MediaJobStatus.Processing))
            throw new BadRequestException("Selecciona estados válidos; los trabajos en procesamiento no se pueden eliminar.");
        if (request.Worker != null && !MediaWorkers.All.Contains(request.Worker)) throw new BadRequestException("Servicio de media no válido.");
        var jobs = context.MediaProcessingJobs.Where(job => statuses.Contains(job.Status));
        if (request.SeriesId is int seriesId) jobs = jobs.Where(job => job.SeriesId == seriesId);
        if (request.Worker != null) jobs = jobs.Where(job => job.Worker == request.Worker);
        if (request.OlderThanDays is int days)
        {
            var cutoff = DateTime.UtcNow.AddDays(-days);
            jobs = jobs.Where(job => job.UpdatedAtUtc < cutoff);
        }
        return await jobs.ExecuteDeleteAsync();
    }

    public async Task<StorageReport> StorageAsync(CancellationToken token)
    {
        var series = await context.Series.AsNoTracking().OrderBy(item => item.Name)
            .Select(item => new
            {
                item.Id, item.Name, item.FolderPath,
                Episodes = context.Episodes.Count(episode => episode.SeriesId == item.Id && episode.IsAvailable && episode.FilePath != null),
                Missing = context.Episodes.Count(episode => episode.SeriesId == item.Id && (!episode.IsAvailable || episode.FilePath == null))
            }).ToListAsync(token);
        var storage = await meter.MeasureAsync(series.ToDictionary(item => item.Id, item => item.FolderPath), token);
        return new StorageReport(storage.MeasuredAtUtc, storage.LibraryBytes, storage.TotalBytes, storage.AvailableBytes,
            series.Select(item => new SeriesStorage(item.Id, item.Name, item.Episodes, item.Missing, storage.SeriesBytes.GetValueOrDefault(item.Id)))
                .OrderByDescending(item => item.SizeBytes ?? -1).ToList());
    }

    public async Task<int> CurrentCoresAsync(int ceiling, CancellationToken token)
    {
        var policy = await context.MediaResourcePolicies.AsNoTracking().SingleAsync(token);
        var timeZone = await context.PlatformSettings.AsNoTracking().Select(item => item.TimeZoneId).SingleAsync(token);
        return MediaCpuGovernor.SelectCores(policy, timeZone, DateTimeOffset.UtcNow, ceiling);
    }

    // ── Worker ──

    public async Task RunWorkerCycleAsync(string worker, MediaWorkerMemory memory, CancellationToken token)
    {
        if (!MediaWorkers.All.Contains(worker)) throw new ArgumentOutOfRangeException(nameof(worker));
        await HeartbeatAsync(worker, token);
        if (!memory.Recovered)
        {
            // Jobs interrupted by a restart start over.
            await context.MediaProcessingJobs.Where(job => job.Worker == worker && job.Status == MediaJobStatus.Processing)
                .ExecuteUpdateAsync(update => update.SetProperty(job => job.Status, MediaJobStatus.Queued).SetProperty(job => job.Progress, 0), token);
            memory.Recovered = true;
        }
        if (!await context.MediaWorkerStates.AnyAsync(state => state.Id == worker && state.Enabled, token)) return;

        await DiscoverAsync(worker, memory, token);
        var jobs = await context.MediaProcessingJobs.Where(job => job.Worker == worker && job.Status == MediaJobStatus.Queued)
            .OrderBy(job => job.Id).Take(20).ToListAsync(token);
        foreach (var job in jobs)
        {
            var claimed = await context.MediaProcessingJobs.Where(item => item.Id == job.Id && item.Status == MediaJobStatus.Queued
                    && context.MediaWorkerStates.Any(state => state.Id == worker && state.Enabled))
                .ExecuteUpdateAsync(update => update.SetProperty(item => item.Status, MediaJobStatus.Processing)
                    .SetProperty(item => item.Message, (string?)null).SetProperty(item => item.UpdatedAtUtc, DateTime.UtcNow), token);
            if (claimed == 0) break;
            await context.Entry(job).ReloadAsync(token);
            await ProcessAsync(worker, job, token);
            job.UpdatedAtUtc = DateTime.UtcNow;
            await context.SaveChangesAsync(token);
            await HeartbeatAsync(worker, token);
        }
    }

    /// <summary>A file is queued once it looks identical on two passes and is old enough to be a finished upload.</summary>
    private async Task DiscoverAsync(string worker, MediaWorkerMemory memory, CancellationToken token)
    {
        var stableAge = TimeSpan.FromSeconds(Math.Max(30, settings.Value.StableAgeSeconds));
        var series = await context.Series.AsNoTracking().OrderBy(item => item.Id).Select(item => new { item.Id, item.FolderPath }).ToListAsync(token);
        var seen = new HashSet<string>();
        foreach (var item in series)
        {
            try
            {
                if (worker == MediaWorkers.Index) await importer.ReconcileAsync(item.Id, item.FolderPath, token);
                foreach (var file in library.Files(item.Id, item.FolderPath))
                {
                    token.ThrowIfCancellationRequested();
                    seen.Add(file.RelativePath);
                    var stable = memory.Observations.TryGetValue(file.RelativePath, out var previous) && previous == file.Fingerprint;
                    memory.Observations[file.RelativePath] = file.Fingerprint;
                    if (!stable || file.ModifiedUtc > DateTime.UtcNow - stableAge) continue;
                    await QueueAsync(worker, file, token);
                }
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(error, "Media folder for series {SeriesId} is unavailable", item.Id);
            }
        }
        foreach (var key in memory.Observations.Keys.Where(key => !seen.Contains(key)).ToArray()) memory.Observations.Remove(key);
    }

    private async Task QueueAsync(string worker, LibraryFile file, CancellationToken token)
    {
        var previous = await context.MediaProcessingJobs.AsNoTracking()
            .Where(job => job.Worker == worker && job.Fingerprint == file.Fingerprint).Select(job => job.Status).FirstOrDefaultAsync(token);
        if (previous != null)
        {
            // A file that comes back after being marked missing is made available again.
            var publicPath = MediaLibrary.PublicPrefix + file.RelativePath;
            if (worker == MediaWorkers.Index && previous == MediaJobStatus.Completed
                && await context.Episodes.AnyAsync(episode => episode.SeriesId == file.SeriesId && !episode.IsAvailable && episode.FilePath == publicPath, token))
                await importer.ImportAsync(file, token);
            return;
        }
        // The converted copy already exists (for example after its job record was cleared).
        if (worker == MediaWorkers.Transcode && File.Exists(MediaFilePolicy.OutputPath(file.FullPath))) return;

        MediaInfo? info = null;
        string? error = null;
        try
        {
            if (worker == MediaWorkers.Transcode) info = await probe.ReadAsync(file.FullPath, token);
            MediaLibrary.EnsureUnchanged(file);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(exception, "Media file {Path} cannot be validated", file.RelativePath);
            error = "No se pudo validar el archivo; revisa el video y sus permisos antes de reintentar.";
        }
        var now = DateTime.UtcNow;
        var compatible = info?.Compatible == true;
        context.MediaProcessingJobs.Add(new MediaProcessingJob
        {
            Worker = worker, SeriesId = file.SeriesId, Fingerprint = file.Fingerprint, SourcePath = file.RelativePath, SourceSize = file.Size,
            SourceModifiedUtc = file.ModifiedUtc, CreatedAtUtc = now, UpdatedAtUtc = now,
            Status = error != null ? MediaJobStatus.Failed : compatible ? MediaJobStatus.Skipped : MediaJobStatus.Queued,
            Progress = compatible ? 100 : 0,
            Message = error ?? (info == null ? null : compatible ? "El archivo ya es compatible; no se recodifica." : "Conversión necesaria: " + info.IncompatibilityReason)
        });
        await context.SaveChangesAsync(token);
    }

    private async Task ProcessAsync(string worker, MediaProcessingJob job, CancellationToken token)
    {
        try
        {
            var path = MediaFilePolicy.SafePath(library.Root, Path.Combine(library.Root, job.SourcePath));
            var file = new LibraryFile(job.SeriesId, path, job.SourcePath, job.SourceSize, job.SourceModifiedUtc);
            MediaLibrary.EnsureUnchanged(file);
            var info = await probe.ReadAsync(path, token);
            if (worker == MediaWorkers.Index)
            {
                if (info.Compatible)
                {
                    await importer.ImportAsync(file, token);
                    job.Status = MediaJobStatus.Completed;
                }
                else
                {
                    job.Status = MediaJobStatus.Skipped;
                    job.Message = "Formato o códecs no compatibles; pendiente de conversión.";
                }
            }
            else
            {
                job.Message = info.Compatible ? "El archivo ya es compatible; no se recodifica." : "Conversión necesaria: " + info.IncompatibilityReason;
                await context.SaveChangesAsync(token);
                var lastUpdate = DateTime.MinValue;
                var output = await transcoder.ConvertAsync(file, async percent =>
                {
                    if (DateTime.UtcNow - lastUpdate < TimeSpan.FromSeconds(5)) return;
                    lastUpdate = DateTime.UtcNow;
                    var progress = Math.Clamp(percent, 0, 100);
                    await context.MediaProcessingJobs.Where(item => item.Id == job.Id)
                        .ExecuteUpdateAsync(update => update.SetProperty(item => item.Progress, progress).SetProperty(item => item.UpdatedAtUtc, lastUpdate), token);
                    await HeartbeatAsync(worker, token);
                }, token);
                job.OutputPath = MediaStorageLayout.RelativeFolder(library.Root, output);
                job.Status = output == path ? MediaJobStatus.Skipped : MediaJobStatus.Completed;
                job.Message = output == path ? "El archivo ya es compatible; no se recodifica."
                    : "Conversión validada; original conservado. Motivo: " + info.IncompatibilityReason;
            }
            job.Progress = 100;
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Media job {JobId} failed", job.Id);
            job.Status = MediaJobStatus.Failed;
            job.Message = exception.Message.StartsWith("Output already exists", StringComparison.Ordinal)
                ? "Ya existe un MP4 con ese nombre. No se sobrescribió; revisa el archivo existente antes de reintentar."
                : exception.Message.Contains("full-duration validation", StringComparison.Ordinal)
                ? "La conversión no conservó la duración completa. El original sigue intacto; revisa el video antes de reintentar."
                : "No se pudo validar o procesar el archivo. Revisa espacio, permisos y el video original antes de reintentar.";
        }
    }

    // ── Helpers ──

    /// <summary>Heartbeats never touch Enabled, so a pause from the dashboard is never overwritten.</summary>
    private Task HeartbeatAsync(string worker, CancellationToken token) =>
        context.MediaWorkerStates.Where(state => state.Id == worker)
            .ExecuteUpdateAsync(update => update.SetProperty(state => state.HeartbeatUtc, DateTime.UtcNow), token);

    private async Task<ResourcePolicyItem> ResourcesAsync()
    {
        var policy = await context.MediaResourcePolicies.AsNoTracking().SingleAsync();
        var timeZone = await context.PlatformSettings.AsNoTracking().Select(item => item.TimeZoneId).SingleAsync();
        // The API reports the cores visible to its own container; the worker applies its own ceiling.
        var available = Math.Clamp(Environment.ProcessorCount, 1, 4);
        var now = DateTimeOffset.UtcNow;
        return new ResourcePolicyItem(policy.DayCores, policy.NightCores, policy.NightEnabled, policy.NightStartMinute, policy.NightEndMinute,
            timeZone, available, MediaCpuGovernor.SelectCores(policy, timeZone, now, available), MediaCpuGovernor.IsNight(policy, timeZone, now));
    }
}
