using ApplicationCore.DTOs.Channel;
using ApplicationCore.Entities;
using ApplicationCore.Models;
using Infrastructure.Contexts;
using Infrastructure.Helpers;
using Infrastructure.Hubs;
using Infrastructure.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;

namespace Infrastructure.BackgroundServices
{
    public class ChannelBroadcastService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<ChannelHub> _hubContext;
        private readonly ILogger<ChannelBroadcastService> _logger;
        private readonly ConcurrentDictionary<int, ChannelBroadcastState> _states = new();

        public ChannelBroadcastService(
            IServiceScopeFactory scopeFactory,
            IHubContext<ChannelHub> hubContext,
            ILogger<ChannelBroadcastService> logger)
        {
            _scopeFactory = scopeFactory;
            _hubContext = hubContext;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await InitializeStates();

            var tick = 0;
            while (!stoppingToken.IsCancellationRequested)
            {
                await BroadcastStates();

                // Cleanup old schedule entries every hour
                if (tick % 3600 == 0)
                {
                    using var scope = _scopeFactory.CreateScope();
                    var scheduleService = scope.ServiceProvider.GetRequiredService<ChannelScheduleService>();
                    await scheduleService.CleanupOldEntriesAsync();
                }

                tick++;
                await Task.Delay(1000, stoppingToken);
            }
        }

        private async Task InitializeStates()
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
            var scheduleService = scope.ServiceProvider.GetRequiredService<ChannelScheduleService>();

            var channels = await context.Channels.ToListAsync();

            foreach (var channel in channels)
            {
                var entry = await scheduleService.GetCurrentEntryAsync(channel.Id);
                if (entry == null) continue;

                var currentSecond = (DateTime.UtcNow - entry.StartTime).TotalSeconds;
                _states[channel.Id] = new ChannelBroadcastState
                {
                    ChannelId = channel.Id,
                    CurrentEpisodeId = entry.EpisodeId ?? 0,
                    CurrentSecond = currentSecond,
                    StartedAt = entry.StartTime,
                    DurationSeconds = (entry.EndTime - entry.StartTime).TotalSeconds
                };
            }
        }

        private async Task BroadcastStates()
        {
            using var scope = _scopeFactory.CreateScope();
            var scheduleService = scope.ServiceProvider.GetRequiredService<ChannelScheduleService>();

            foreach (var (channelId, state) in _states)
            {
                var now = DateTime.UtcNow;
                state.CurrentSecond = (now - state.StartedAt).TotalSeconds;

                // Rebuild the payload only when there is none yet or the current entry has ended.
                // Between transitions the cached response is reused and only the time-based
                // fields are recomputed below, so a steady-state tick issues no database queries.
                if (state.CachedResponse == null || state.CurrentSecond >= state.DurationSeconds)
                {
                    // Extend schedule 24h ahead before fetching the next entry
                    await scheduleService.EnsureScheduleGeneratedAsync(channelId, now.AddHours(24));

                    var entry = await scheduleService.GetCurrentEntryAsync(channelId);
                    if (entry == null)
                    {
                        // Force regenerate if still no entry
                        await scheduleService.EnsureScheduleGeneratedAsync(channelId, now.AddHours(48));
                        entry = await scheduleService.GetCurrentEntryAsync(channelId);
                        if (entry == null) continue;
                    }

                    // Skip episode entries whose episode row is missing (data integrity guard)
                    if (entry.EpisodeId != null && entry.Episode == null) continue;

                    state.CurrentEpisodeId = entry.EpisodeId ?? 0;
                    state.StartedAt = entry.StartTime;
                    state.DurationSeconds = (entry.EndTime - entry.StartTime).TotalSeconds;
                    state.CurrentSecond = (now - entry.StartTime).TotalSeconds;

                    var next = await scheduleService.GetNextEntryAsync(channelId);
                    state.CachedResponse = BuildStateResponse(entry, next, state.CurrentSecond, state.DurationSeconds);
                }

                var response = state.CachedResponse;
                response.CurrentSecond = state.CurrentSecond;
                response.SecondsUntilNext = state.DurationSeconds - state.CurrentSecond;

                await _hubContext.Clients.Group($"channel-{channelId}")
                    .SendAsync("ChannelState", response);
            }
        }

        // Builds the immutable-per-entry payload from an already-loaded schedule entry.
        // Relies on the Episode/Series/Bumper navigations being eagerly loaded by the schedule
        // service queries, so it performs no additional database access itself.
        private static ChannelStateResponse BuildStateResponse(
            ChannelScheduleEntry entry, ChannelScheduleEntry? next, double currentSecond, double duration)
        {
            if (entry.EpisodeId == null && entry.BumperId != null)
            {
                var bumper = entry.Bumper;
                return new ChannelStateResponse
                {
                    ChannelId = entry.ChannelId,
                    EpisodeId = 0,
                    EpisodeTitle = bumper?.Title ?? "Bumper",
                    FilePath = CleanPath(bumper?.FilePath),
                    SeriesName = "",
                    SeriesLogoPath = null,
                    CurrentSecond = currentSecond,
                    NextEpisodeId = next?.EpisodeId ?? 0,
                    NextEpisodeTitle = next?.Episode?.Title,
                    SecondsUntilNext = duration - currentSecond,
                    IsBumper = true,
                    BumperTitle = bumper?.Title
                };
            }

            return new ChannelStateResponse
            {
                ChannelId = entry.ChannelId,
                EpisodeId = entry.EpisodeId ?? 0,
                EpisodeTitle = entry.Episode?.Title ?? "",
                FilePath = CleanPath(entry.Episode?.FilePath),
                SeriesName = entry.Episode?.Series?.Name ?? "",
                SeriesLogoPath = entry.Episode?.Series?.LogoPath,
                CurrentSecond = currentSecond,
                NextEpisodeId = next?.EpisodeId ?? 0,
                NextEpisodeTitle = next?.Episode?.Title,
                SecondsUntilNext = duration - currentSecond,
                IsBumper = false
            };
        }

        private static string CleanPath(string? path) =>
            path?.Replace("wwwroot", "").Replace("\\", "/") ?? "";

        public ChannelBroadcastState? GetState(int channelId) =>
            _states.TryGetValue(channelId, out var state) ? state : null;

        public async Task<ChannelStateResponse?> GetStateResponseAsync(int channelId)
        {
            using var scope = _scopeFactory.CreateScope();
            var scheduleService = scope.ServiceProvider.GetRequiredService<ChannelScheduleService>();

            var entry = await scheduleService.GetCurrentEntryAsync(channelId);
            if (entry == null) return null;

            var next = await scheduleService.GetNextEntryAsync(channelId);
            var currentSecond = (DateTime.UtcNow - entry.StartTime).TotalSeconds;
            var duration = (entry.EndTime - entry.StartTime).TotalSeconds;

            return BuildStateResponse(entry, next, currentSecond, duration);
        }

        public async Task ReloadChannelAsync(int channelId)
        {
            using var scope = _scopeFactory.CreateScope();
            var scheduleService = scope.ServiceProvider.GetRequiredService<ChannelScheduleService>();

            var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();

            // Delete ALL schedule entries for this channel (past and future)
            await context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId)
                .ExecuteDeleteAsync();

            // Regenerate full 24h schedule from now
            await scheduleService.EnsureScheduleGeneratedAsync(channelId, DateTime.UtcNow.AddHours(24));

            var entry = await scheduleService.GetCurrentEntryAsync(channelId);
            if (entry == null)
            {
                _states.TryRemove(channelId, out _);
                return;
            }

            _states[channelId] = new ChannelBroadcastState
            {
                ChannelId = channelId,
                CurrentEpisodeId = entry.EpisodeId ?? 0,
                CurrentSecond = (DateTime.UtcNow - entry.StartTime).TotalSeconds,
                StartedAt = entry.StartTime,
                DurationSeconds = (entry.EndTime - entry.StartTime).TotalSeconds
            };
        }
    }
}
