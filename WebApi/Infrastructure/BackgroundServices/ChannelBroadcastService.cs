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

namespace Infrastructure.BackgroundServices
{
    public class ChannelBroadcastService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<ChannelHub> _hubContext;
        private readonly ILogger<ChannelBroadcastService> _logger;
        private readonly Dictionary<int, ChannelBroadcastState> _states = new();

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
            var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
            var scheduleService = scope.ServiceProvider.GetRequiredService<ChannelScheduleService>();

            foreach (var (channelId, state) in _states)
            {
                state.CurrentSecond = (DateTime.UtcNow - state.StartedAt).TotalSeconds;

                // Advance if current entry ended
                if (state.CurrentSecond >= state.DurationSeconds)
                {
                    // Extend schedule 24h ahead before fetching the next entry
                    await scheduleService.EnsureScheduleGeneratedAsync(channelId, DateTime.UtcNow.AddHours(24));

                    var entry = await scheduleService.GetCurrentEntryAsync(channelId);
                    if (entry == null)
                    {
                        // Force regenerate if still no entry
                        await scheduleService.EnsureScheduleGeneratedAsync(channelId, DateTime.UtcNow.AddHours(48));
                        entry = await scheduleService.GetCurrentEntryAsync(channelId);
                        if (entry == null) continue;
                    }

                    state.CurrentEpisodeId = entry.EpisodeId ?? 0;
                    state.CurrentSecond = (DateTime.UtcNow - entry.StartTime).TotalSeconds;
                    state.StartedAt = entry.StartTime;
                    state.DurationSeconds = (entry.EndTime - entry.StartTime).TotalSeconds;
                }

                ChannelStateResponse response;

                // Check if current entry is a bumper
                var currentEntry = await scheduleService.GetCurrentEntryAsync(channelId);
                if (currentEntry != null && currentEntry.EpisodeId == null && currentEntry.BumperId != null)
                {
                    // This is a bumper entry
                    var bumper = await context.ChannelBumpers.FindAsync(currentEntry.BumperId);

                    if (bumper == null) continue;

                    response = new ChannelStateResponse
                    {
                        ChannelId = channelId,
                        EpisodeId = 0,
                        EpisodeTitle = bumper.Title,
                        FilePath = bumper.FilePath!.Replace("wwwroot", "").Replace("\\", "/"),
                        SeriesName = "",
                        SeriesLogoPath = null,
                        CurrentSecond = state.CurrentSecond,
                        NextEpisodeId = 0,
                        NextEpisodeTitle = null,
                        SecondsUntilNext = state.DurationSeconds - state.CurrentSecond,
                        IsBumper = true,
                        BumperTitle = bumper.Title
                    };
                }
                else
                {
                    var episode = await context.Episodes
                        .Include(e => e.Series)
                        .FirstOrDefaultAsync(e => e.Id == state.CurrentEpisodeId);

                    if (episode == null) continue;

                    var next = await scheduleService.GetNextEntryAsync(channelId);

                    response = new ChannelStateResponse
                    {
                        ChannelId = channelId,
                        EpisodeId = episode.Id,
                        EpisodeTitle = episode.Title,
                        FilePath = episode.FilePath!.Replace("wwwroot", "").Replace("\\", "/"),
                        SeriesName = episode.Series.Name,
                        SeriesLogoPath = episode.Series.LogoPath,
                        CurrentSecond = state.CurrentSecond,
                        NextEpisodeId = next?.EpisodeId ?? 0,
                        NextEpisodeTitle = next?.Episode?.Title,
                        SecondsUntilNext = state.DurationSeconds - state.CurrentSecond,
                        IsBumper = false
                    };
                }

                await _hubContext.Clients.Group($"channel-{channelId}")
                    .SendAsync("ChannelState", response);
            }
        }

        public ChannelBroadcastState? GetState(int channelId) =>
            _states.TryGetValue(channelId, out var state) ? state : null;

        public async Task<ChannelStateResponse?> GetStateResponseAsync(int channelId)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
            var scheduleService = scope.ServiceProvider.GetRequiredService<ChannelScheduleService>();

            var entry = await scheduleService.GetCurrentEntryAsync(channelId);
            if (entry == null) return null;

            var next = await scheduleService.GetNextEntryAsync(channelId);
            var currentSecond = (DateTime.UtcNow - entry.StartTime).TotalSeconds;
            var duration = (entry.EndTime - entry.StartTime).TotalSeconds;

            if (entry.EpisodeId == null && entry.BumperId != null)
            {
                var bumper = await context.ChannelBumpers.FindAsync(entry.BumperId);
                return new ChannelStateResponse
                {
                    ChannelId = channelId,
                    EpisodeId = 0,
                    EpisodeTitle = bumper?.Title ?? "Bumper",
                    FilePath = bumper?.FilePath?.Replace("wwwroot", "").Replace("\\", "/") ?? "",
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
                ChannelId = channelId,
                EpisodeId = entry.EpisodeId ?? 0,
                EpisodeTitle = entry.Episode?.Title ?? "",
                FilePath = entry.Episode?.FilePath?.Replace("wwwroot", "").Replace("\\", "/") ?? "",
                SeriesName = entry.Episode?.Series?.Name ?? "",
                SeriesLogoPath = entry.Episode?.Series?.LogoPath,
                CurrentSecond = currentSecond,
                NextEpisodeId = next?.EpisodeId ?? 0,
                NextEpisodeTitle = next?.Episode?.Title,
                SecondsUntilNext = duration - currentSecond,
                IsBumper = false
            };
        }

        public async Task ReloadChannelAsync(int channelId)
        {
            using var scope = _scopeFactory.CreateScope();
            var scheduleService = scope.ServiceProvider.GetRequiredService<ChannelScheduleService>();

            var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();

            // Delete ALL schedule entries for this channel (past and future)
            var old = await context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId)
                .ToListAsync();
            context.ChannelScheduleEntries.RemoveRange(old);
            await context.SaveChangesAsync();

            // Regenerate full 24h schedule from now
            await scheduleService.EnsureScheduleGeneratedAsync(channelId, DateTime.UtcNow.AddHours(24));

            var entry = await scheduleService.GetCurrentEntryAsync(channelId);
            if (entry == null)
            {
                _states.Remove(channelId);
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
