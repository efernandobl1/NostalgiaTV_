using ApplicationCore.Entities;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Settings;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Hosting;

/// <summary>Removes expired refresh tokens, viewer devices and codes every six hours.</summary>
public sealed class CredentialCleanupService(IServiceScopeFactory scopes, ILogger<CredentialCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(6));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var removed = await scope.ServiceProvider.GetRequiredService<IAuthRepository>().CleanupExpiredAsync(stoppingToken);
                logger.LogInformation("Removed {Count} expired credentials", removed);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogError(error, "Credential cleanup failed"); }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

/// <summary>One media worker loop (transcode or index); the worker process runs one instance of each.</summary>
public abstract class MediaWorkerService(IServiceScopeFactory scopes, IOptions<MediaProcessingSettings> settings, ILogger logger) : BackgroundService
{
    private readonly MediaWorkerMemory memory = new();

    protected abstract string Worker { get; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var delay = TimeSpan.FromSeconds(Math.Clamp(settings.Value.PollSeconds, 10, 3600));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IMediaRepository>().RunWorkerCycleAsync(Worker, memory, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogError(error, "Media worker {Worker} cycle failed", Worker); }
            await Task.Delay(delay, stoppingToken);
        }
    }
}

public sealed class MediaTranscodingService(IServiceScopeFactory scopes, IOptions<MediaProcessingSettings> settings,
    ILogger<MediaTranscodingService> logger) : MediaWorkerService(scopes, settings, logger)
{
    protected override string Worker => MediaWorkers.Transcode;
}

public sealed class MediaIndexingService(IServiceScopeFactory scopes, IOptions<MediaProcessingSettings> settings,
    ILogger<MediaIndexingService> logger) : MediaWorkerService(scopes, settings, logger)
{
    protected override string Worker => MediaWorkers.Index;
}
