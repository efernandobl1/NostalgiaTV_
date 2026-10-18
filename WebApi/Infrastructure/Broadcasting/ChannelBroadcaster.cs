using ApplicationCore.DTOs;
using ApplicationCore.Interfaces.Repositories;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Broadcasting;

/// <summary>
/// Pushes each channel's live state every second. The segment on air is cached until it ends or the
/// channel's schedule changes, so a steady-state tick issues no database queries.
/// </summary>
public sealed class ChannelBroadcaster(IServiceScopeFactory scopes, IHubContext<ChannelHub> hub, ScheduleSignals signals,
    ILogger<ChannelBroadcaster> logger) : BackgroundService
{
    private static readonly TimeSpan ChannelRefresh = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan HorizonRefresh = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan Cleanup = TimeSpan.FromHours(1);
    private readonly Dictionary<int, (ChannelState State, long Version)> cache = [];
    private IReadOnlyList<int> channels = [];
    private DateTime channelsAt = DateTime.MinValue, horizonAt = DateTime.MinValue, cleanupAt = DateTime.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        do
        {
            try { await TickAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogError(error, "Channel broadcast tick failed"); }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task TickAsync(CancellationToken token)
    {
        var now = DateTime.UtcNow;
        using var scope = scopes.CreateScope();
        var schedule = scope.ServiceProvider.GetRequiredService<IScheduleRepository>();
        if (now - channelsAt > ChannelRefresh)
        {
            channels = await schedule.ChannelIdsAsync(token);
            foreach (var removed in cache.Keys.Except(channels).ToList()) cache.Remove(removed);
            channelsAt = now;
        }
        if (now - horizonAt > HorizonRefresh)
        {
            // Keeps a day of programming ahead even when nobody is watching.
            foreach (var channelId in channels) await schedule.EnsureGeneratedAsync(channelId, now.AddHours(24), token);
            horizonAt = now;
        }
        if (now - cleanupAt > Cleanup)
        {
            await schedule.CleanupAsync(token);
            cleanupAt = now;
        }

        foreach (var channelId in channels)
        {
            var version = signals.Version(channelId);
            if (!cache.TryGetValue(channelId, out var entry) || entry.Version != version || entry.State.EndsAtUtc <= now)
            {
                var state = await schedule.GetStateAsync(channelId, token);
                if (state == null) { cache.Remove(channelId); continue; }
                entry = (state, version);
                cache[channelId] = entry;
            }
            var elapsed = (now - entry.State.StartsAtUtc).TotalSeconds;
            await hub.Clients.Group(ChannelHub.Group(channelId)).SendAsync(ChannelHub.StateMethod, entry.State with
            {
                CurrentSecond = entry.State.MediaStartSecond + elapsed,
                SecondsUntilNext = Math.Max(0, (entry.State.EndsAtUtc - now).TotalSeconds)
            }, token);
        }
    }
}
