using ApplicationCore.DTOs;
using ApplicationCore.Interfaces.Repositories;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Broadcasting;

/// <summary>
/// Pushes each channel's live state every second, and a "ChannelChanged" notice to the lineup group when a channel
/// starts a new segment, its schedule is rewritten or it is added or removed. The segment on air is cached until it
/// ends or the channel's schedule changes, so a steady-state tick issues no database queries.
/// </summary>
public sealed class ChannelBroadcaster(IServiceScopeFactory scopes, IHubContext<ChannelHub> hub, ScheduleSignals signals,
    ILogger<ChannelBroadcaster> logger) : BackgroundService
{
    private static readonly TimeSpan ChannelRefresh = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan HorizonRefresh = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan Cleanup = TimeSpan.FromHours(1);
    private readonly Dictionary<int, (ChannelState State, long Version)> cache = [];
    /// <summary>Schedule version last seen per channel; a channel not in it yet has nothing to compare with.</summary>
    private readonly Dictionary<int, long> versions = [];
    private IReadOnlyList<int> channels = [];
    private DateTime channelsAt = DateTime.MinValue, horizonAt = DateTime.MinValue, cleanupAt = DateTime.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        do
        {
            try { await TickAsync(DateTime.UtcNow, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogError(error, "Channel broadcast tick failed"); }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>One broadcast pass; <paramref name="now"/> drives the refresh intervals (tests move it forward).</summary>
    internal async Task TickAsync(DateTime now, CancellationToken token)
    {
        using var scope = scopes.CreateScope();
        var schedule = scope.ServiceProvider.GetRequiredService<IScheduleRepository>();
        if (now - channelsAt > ChannelRefresh)
        {
            var previous = channels;
            channels = await schedule.ChannelIdsAsync(token);
            foreach (var removed in cache.Keys.Except(channels).ToList()) cache.Remove(removed);
            foreach (var removed in versions.Keys.Except(channels).ToList()) versions.Remove(removed);
            // The first load is the starting point, not a change.
            if (channelsAt != DateTime.MinValue)
                foreach (var changed in previous.Except(channels).Concat(channels.Except(previous)))
                    await NotifyAsync(new(changed, ChannelChange.Lineup), token);
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
            var known = versions.TryGetValue(channelId, out var seen);
            versions[channelId] = version;
            var rewritten = known && seen != version;
            if (rewritten) await NotifyAsync(new(channelId, ChannelChange.Schedule), token);
            var cached = cache.TryGetValue(channelId, out var entry);
            if (!cached || entry.Version != version || entry.State.EndsAtUtc <= now)
            {
                var state = await schedule.GetStateAsync(channelId, token);
                if (known && !rewritten && state?.SegmentId != (cached ? entry.State.SegmentId : null))
                    await NotifyAsync(new(channelId, ChannelChange.Segment, state?.Kind), token);
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

    private Task NotifyAsync(ChannelChange change, CancellationToken token) =>
        hub.Clients.Group(ChannelHub.LineupGroup).SendAsync(ChannelHub.ChangedMethod, change, token);
}
