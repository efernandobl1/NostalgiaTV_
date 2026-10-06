using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services.Media;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.BackgroundServices;

public abstract class MediaProcessingWorker(IServiceScopeFactory scopes, IOptions<MediaProcessingSettings> settings,
    ILogger logger) : BackgroundService
{
    protected abstract string Worker { get; }
    private readonly Dictionary<string, string> observations = new();
    private bool recovered;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunCycleAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception) { logger.LogError(exception, "Media worker {Worker} cycle failed", Worker); }
            await Task.Delay(TimeSpan.FromSeconds(Math.Clamp(settings.Value.PollSeconds, 10, 3600)), stoppingToken);
        }
    }

    protected async Task RunCycleAsync(CancellationToken token)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
        var library = scope.ServiceProvider.GetRequiredService<MediaLibraryService>();
        var state = await context.MediaWorkerStates.SingleAsync(item => item.Id == Worker, token);
        state.HeartbeatUtc = DateTime.UtcNow;
        if (!recovered)
        {
            await context.MediaProcessingJobs.Where(item => item.Worker == Worker && item.Status == "Processing")
                .ExecuteUpdateAsync(update => update.SetProperty(item => item.Status, "Queued").SetProperty(item => item.Progress, 0), token);
            recovered = true;
        }
        await context.SaveChangesAsync(token);
        if (!state.Enabled) return;
        var series = await context.Series.AsNoTracking().OrderBy(item => item.Id).ToListAsync(token);
        var seen = new HashSet<string>();
        foreach (var item in series)
        {
            try
            {
                foreach (var file in library.Files(item))
                {
                    token.ThrowIfCancellationRequested();
                    seen.Add(file.RelativePath);
                    var stable = observations.TryGetValue(file.RelativePath, out var previous) && previous == file.Fingerprint;
                    observations[file.RelativePath] = file.Fingerprint;
                    if (!stable || file.ModifiedUtc > DateTime.UtcNow.AddSeconds(-Math.Max(30, settings.Value.StableAgeSeconds))) continue;
                    if (await context.MediaProcessingJobs.AnyAsync(job => job.Worker == Worker && job.Fingerprint == file.Fingerprint, token)) continue;
                    context.MediaProcessingJobs.Add(new MediaProcessingJob { Worker = Worker, SeriesId = file.SeriesId,
                        Fingerprint = file.Fingerprint, SourcePath = file.RelativePath, SourceSize = file.Size, SourceModifiedUtc = file.ModifiedUtc });
                    await context.SaveChangesAsync(token);
                }
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            { logger.LogWarning(exception, "Media folder for series {SeriesId} is unavailable", item.Id); }
        }
        foreach (var key in observations.Keys.Where(key => !seen.Contains(key)).ToArray()) observations.Remove(key);
        var jobs = await context.MediaProcessingJobs.Where(item => item.Worker == Worker && item.Status == "Queued")
            .OrderBy(item => item.Id).Take(20).ToListAsync(token);
        foreach (var job in jobs)
        {
            var claimed = await context.MediaProcessingJobs.Where(item => item.Id == job.Id && item.Status == "Queued" &&
                context.MediaWorkerStates.Any(state => state.Id == Worker && state.Enabled))
                .ExecuteUpdateAsync(update => update.SetProperty(item => item.Status, "Processing")
                    .SetProperty(item => item.Message, (string?)null).SetProperty(item => item.UpdatedAtUtc, DateTime.UtcNow), token);
            if (claimed == 0) break;
            await context.Entry(job).ReloadAsync(token);
            try
            {
                var path = MediaFilePolicy.SafePath(library.Root, Path.Combine(library.Root, job.SourcePath));
                var file = new LibraryFile(job.SeriesId, path, job.SourcePath, job.SourceSize, job.SourceModifiedUtc);
                MediaLibraryService.EnsureUnchanged(file);
                if (Worker == "index")
                {
                    var info = await scope.ServiceProvider.GetRequiredService<MediaProbe>().ReadAsync(path, token);
                    if (info.Compatible) { await library.ImportAsync(file, token); job.Status = "Completed"; }
                    else { job.Status = "Skipped"; job.Message = "Formato o códecs no compatibles; pendiente de conversión."; }
                }
                else
                {
                    var lastUpdate = DateTime.MinValue;
                    var output = await scope.ServiceProvider.GetRequiredService<MediaTranscoder>().ConvertAsync(file, async percent =>
                    {
                        if (DateTime.UtcNow - lastUpdate < TimeSpan.FromSeconds(5)) return;
                        lastUpdate = DateTime.UtcNow;
                        job.Progress = percent;
                        job.UpdatedAtUtc = lastUpdate;
                        state.HeartbeatUtc = lastUpdate;
                        // Reload the control row so a concurrent pause is never overwritten by a heartbeat.
                        await context.Entry(state).ReloadAsync(token);
                        state.HeartbeatUtc = lastUpdate;
                        await context.SaveChangesAsync(token);
                    }, token);
                    job.OutputPath = Path.GetRelativePath(library.Root, output).Replace('\\', '/');
                    job.Status = output == path ? "Skipped" : "Completed";
                    job.Message = output == path ? "El archivo ya es compatible." : "Conversión validada; original conservado.";
                }
                job.Progress = 100;
            }
            catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Media job {JobId} failed", job.Id);
                job.Status = "Failed";
                job.Message = exception.Message.StartsWith("Output already exists", StringComparison.Ordinal)
                    ? "Ya existe un MP4 con ese nombre. No se sobrescribió; revisa el archivo existente antes de reintentar."
                    : exception.Message.Contains("full-duration validation", StringComparison.Ordinal)
                    ? "La conversión no conservó la duración completa. El original sigue intacto; revisa el video antes de reintentar."
                    : "No se pudo validar o procesar el archivo. Revisa espacio, permisos y el video original antes de reintentar.";
            }
            job.UpdatedAtUtc = DateTime.UtcNow;
            await context.Entry(state).ReloadAsync(token);
            state.HeartbeatUtc = DateTime.UtcNow;
            await context.SaveChangesAsync(token);
        }
    }
}
