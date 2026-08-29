using ApplicationCore.DTOs.Channel;
using ApplicationCore.Entities;
using Infrastructure.Contexts;
using Infrastructure.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Services
{
    public class ChannelScheduleService
    {
        private readonly NostalgiaTVContext _context;
        private readonly ILogger<ChannelScheduleService> _logger;
        private static readonly Dictionary<int, SemaphoreSlim> _locks = new();
        private static readonly object _lockDict = new();

        public ChannelScheduleService(NostalgiaTVContext context, ILogger<ChannelScheduleService> logger)
        {
            _context = context;
            _logger = logger;
        }

        private static SemaphoreSlim GetLock(int channelId)
        {
            lock (_lockDict)
            {
                if (!_locks.TryGetValue(channelId, out var sem))
                {
                    sem = new SemaphoreSlim(1, 1);
                    _locks[channelId] = sem;
                }
                return sem;
            }
        }

        // Returns schedule for next 24h for a channel
        public async Task<List<ChannelScheduleEntryResponse>> GetScheduleAsync(int channelId)
        {
            var now = DateTime.UtcNow;
            var until = now.AddHours(24);

            _logger.LogInformation("[SCHEDULE] GetScheduleAsync channelId={ch} from={from} to={to}", channelId, now, until);

            await EnsureScheduleGeneratedAsync(channelId, until);

            var entries = await _context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId && e.EndTime >= now && e.StartTime <= until)
                .Include(e => e.Episode).ThenInclude(e => e.Series)
                .Include(e => e.Bumper)
                .OrderBy(e => e.StartTime)
                .Select(e => new ChannelScheduleEntryResponse
                {
                    Id = e.Id,
                    ChannelId = e.ChannelId,
                    EpisodeId = e.EpisodeId,
                    EpisodeTitle = e.Episode != null ? e.Episode.Title : (e.Bumper != null ? e.Bumper.Title : ""),
                    SeriesName = e.Episode != null ? e.Episode.Series.Name : "",
                    SeriesLogoPath = e.Episode != null ? e.Episode.Series.LogoPath : null,
                    FilePath = e.Episode != null ? e.Episode.FilePath!.Replace("wwwroot", "").Replace("\\", "/") : (e.Bumper != null ? e.Bumper.FilePath!.Replace("wwwroot", "").Replace("\\", "/") : ""),
                    StartTime = DateTime.SpecifyKind(e.StartTime, DateTimeKind.Utc),
                    EndTime = DateTime.SpecifyKind(e.EndTime, DateTimeKind.Utc),
                    Season = e.Episode != null ? e.Episode.Season : 0,
                    EpisodeNumber = e.Episode != null ? e.Episode.EpisodeNumber : 0,
                    BumperId = e.BumperId,
                    BumperTitle = e.Bumper != null ? e.Bumper.Title : null,
                })
                .ToListAsync();

            _logger.LogInformation("[SCHEDULE] Returning {count} entries for channel {ch}", entries.Count, channelId);
            return entries;
        }

        public async Task EnsureScheduleGeneratedAsync(int channelId, DateTime until)
        {
            _logger.LogInformation("[SCHEDULE] EnsureScheduleGeneratedAsync channelId={ch} until={until}", channelId, until);

            var sem = GetLock(channelId);
            await sem.WaitAsync();

            try
            {
                var lastEntry = await _context.ChannelScheduleEntries
                    .Where(e => e.ChannelId == channelId)
                    .OrderByDescending(e => e.EndTime)
                    .FirstOrDefaultAsync();

                var generateFrom = lastEntry?.EndTime ?? DateTime.UtcNow;

                _logger.LogInformation("[SCHEDULE] Last entry ends at={last}, generateFrom={from}", lastEntry?.EndTime, generateFrom);

                if (generateFrom >= until)
                {
                    _logger.LogInformation("[SCHEDULE] No generation needed, generateFrom >= until");
                    return;
                }

                await GenerateScheduleAsync(channelId, generateFrom, until);
            }
            finally
            {
                sem.Release();
            }
        }

        private async Task GenerateScheduleAsync(int channelId, DateTime from, DateTime until)
        {
            _logger.LogInformation("[SCHEDULE] GenerateScheduleAsync channelId={ch} from={from} until={until}", channelId, from, until);

            var channel = await _context.Channels
                .Include(c => c.Eras).ThenInclude(e => e.Series)
                .Include(c => c.Eras).ThenInclude(e => e.Bumpers)
                .Include(c => c.Series)
                .FirstOrDefaultAsync(c => c.Id == channelId);

            if (channel == null)
            {
                _logger.LogWarning("[SCHEDULE] Channel {ch} not found", channelId);
                return;
            }

            var eras = channel.Eras.ToList();
            _logger.LogInformation("[SCHEDULE] Channel has {eraCount} eras, {seriesCount} direct series", eras.Count, channel.Series.Count);

            foreach (var era in eras)
            {
                _logger.LogInformation("[SCHEDULE] Era: id={id} name={name} start={start} end={end} series={series}",
                    era.Id, era.Name, era.StartDate, era.EndDate, era.Series.Count);
            }

            var random = new Random();
            var current = from;

            var seriesLastEpisodes = await _context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId && e.EpisodeId != null)
                .Include(e => e.Episode)
                .Where(e => e.Episode != null)
                .GroupBy(e => e.Episode!.SeriesId)
                .ToDictionaryAsync(
                    g => g.Key,
                    g => g.OrderByDescending(e => e.EndTime).Select(e => e.Episode).First()
                );

            var recentlyUsed = await _context.ChannelScheduleEntries
                .Where(e => e.ChannelId == channelId && e.StartTime >= DateTime.UtcNow.AddHours(-24))
                .Where(e => e.EpisodeId != null)
                .Select(e => e.EpisodeId!.Value)
                .ToHashSetAsync();

            int? lastEpisodeId = null;
            int? lastSeriesId = null;
            double lastDuration = 0;
            bool lastWasSpecial = false;
            const double MinDurationForSeriesRule = 1200;
            var durationCache = new Dictionary<string, double>();
            var batch = new List<ChannelScheduleEntry>();
            var totalGenerated = 0;
            var iterationCount = 0;
            var skipCount = 0;

            while (current < until)
            {
                iterationCount++;

                List<int> eraSeriesIds;
                List<ChannelBumper> eraBumpers;

                if (eras.Any())
                {
                    var activeEra = GetActiveEra(eras, current);
                    if (activeEra == null)
                    {
                        _logger.LogWarning("[SCHEDULE] Iteration {iter}: No active era for time={time}, skipping 30min", iterationCount, current);
                        current = current.AddMinutes(30);
                        skipCount++;
                        if (skipCount > 100) { _logger.LogError("[SCHEDULE] Too many skips, aborting"); break; }
                        continue;
                    }
                    eraSeriesIds = activeEra.Series.Select(s => s.Id).ToList();
                    eraBumpers = activeEra.Bumpers.Where(b => !string.IsNullOrEmpty(b.FilePath)).ToList();
                    _logger.LogInformation("[SCHEDULE] Iteration {iter}: Active era={era} with {series} series, {bumpers} bumpers",
                        iterationCount, activeEra.Name, eraSeriesIds.Count, eraBumpers.Count);
                }
                else
                {
                    eraSeriesIds = channel.Series.Select(s => s.Id).ToList();
                    eraBumpers = [];
                    _logger.LogInformation("[SCHEDULE] Iteration {iter}: No eras, using {series} direct channel series", iterationCount, eraSeriesIds.Count);
                }

                if (!eraSeriesIds.Any())
                {
                    _logger.LogWarning("[SCHEDULE] Iteration {iter}: No series in era/channel, skipping 30min", iterationCount);
                    current = current.AddMinutes(30);
                    skipCount++;
                    if (skipCount > 100) { _logger.LogError("[SCHEDULE] Too many skips, aborting"); break; }
                    continue;
                }

                var episodes = await _context.Episodes
                    .Include(e => e.EpisodeType)
                    .Include(e => e.Series)
                    .Where(e => eraSeriesIds.Contains(e.SeriesId) && e.FilePath != null)
                    .ToListAsync();

                _logger.LogInformation("[SCHEDULE] Iteration {iter}: Found {epCount} episodes for series [{seriesIds}]",
                    iterationCount, episodes.Count, string.Join(",", eraSeriesIds));

                if (!episodes.Any())
                {
                    _logger.LogWarning("[SCHEDULE] Iteration {iter}: No episodes found, skipping 30min", iterationCount);
                    current = current.AddMinutes(30);
                    skipCount++;
                    if (skipCount > 100) { _logger.LogError("[SCHEDULE] Too many skips, aborting"); break; }
                    continue;
                }

                // If last was special/movie, prefer regular episodes
                var preferredEpisodes = lastWasSpecial
                    ? episodes.Where(e => e.EpisodeType.Name.ToLower() == "regular").ToList()
                    : episodes;

                var pool = preferredEpisodes.Any() ? preferredEpisodes : episodes;

                var availableSeries = pool
                    .GroupBy(e => e.SeriesId)
                    .Where(g =>
                    {
                        var seriesId = g.Key;
                        var hasFreshEpisodes = g.Any(e => !recentlyUsed.Contains(e.Id));
                        var avoidsConsecutive = !g.Any(e => e.Id == lastEpisodeId);
                        var respectsSeriesRule = lastDuration < MinDurationForSeriesRule || seriesId != lastSeriesId;
                        return hasFreshEpisodes && avoidsConsecutive && respectsSeriesRule;
                    })
                    .Select(g => g.Key)
                    .ToList();

                if (!availableSeries.Any())
                {
                    availableSeries = pool
                        .Where(e => !recentlyUsed.Contains(e.Id)
                                 && e.Id != lastEpisodeId
                                 && (lastDuration < MinDurationForSeriesRule || e.SeriesId != lastSeriesId))
                        .Select(e => e.SeriesId)
                        .Distinct()
                        .ToList();
                }

                if (!availableSeries.Any())
                {
                    availableSeries = pool
                        .Where(e => e.Id != lastEpisodeId
                                 && (lastDuration < MinDurationForSeriesRule || e.SeriesId != lastSeriesId))
                        .Select(e => e.SeriesId)
                        .Distinct()
                        .ToList();
                    recentlyUsed.Clear();
                }

                if (!availableSeries.Any())
                {
                    availableSeries = pool
                        .Where(e => e.Id != lastEpisodeId)
                        .Select(e => e.SeriesId)
                        .Distinct()
                        .ToList();
                }

                if (!availableSeries.Any())
                {
                    availableSeries = pool.Select(e => e.SeriesId).Distinct().ToList();
                }

                var selectedSeriesId = availableSeries[random.Next(availableSeries.Count)];
                var seriesEpisodes = pool.Where(e => e.SeriesId == selectedSeriesId).ToList();
                if (!seriesEpisodes.Any())
                {
                    seriesEpisodes = episodes.Where(e => e.SeriesId == selectedSeriesId).ToList();
                }

                Episode? episode;
                if (seriesLastEpisodes.TryGetValue(selectedSeriesId, out var lastEpisode))
                {
                    episode = seriesEpisodes
                        .Where(e => e.Season > lastEpisode.Season ||
                                   (e.Season == lastEpisode.Season && e.EpisodeNumber > lastEpisode.EpisodeNumber))
                        .OrderBy(e => e.Season)
                        .ThenBy(e => e.EpisodeNumber)
                        .FirstOrDefault();

                    if (episode == null)
                    {
                        episode = seriesEpisodes
                            .OrderBy(e => e.Season)
                            .ThenBy(e => e.EpisodeNumber)
                            .First();
                    }
                }
                else
                {
                    // First time scheduling this series: start from a random episode
                    episode = seriesEpisodes[random.Next(seriesEpisodes.Count)];
                }

                _logger.LogInformation("[SCHEDULE] Iteration {iter}: Selected episode={ep} series={s} duration getting...",
                    iterationCount, episode.Title, episode.Series.Name);

                var duration = GetCachedDuration(episode.FilePath!, durationCache);

                _logger.LogInformation("[SCHEDULE] Iteration {iter}: Duration={dur}s for episode={ep}", iterationCount, duration, episode.Title);

                var end = current.AddSeconds(duration);
                batch.Add(new ChannelScheduleEntry
                {
                    ChannelId = channelId,
                    EpisodeId = episode.Id,
                    StartTime = current,
                    EndTime = end,
                });

                recentlyUsed.Add(episode.Id);
                lastEpisodeId = episode.Id;
                lastSeriesId = episode.SeriesId;
                lastDuration = duration;
                lastWasSpecial = episode.EpisodeType.Name.ToLower() != "regular";
                current = end;

                seriesLastEpisodes[selectedSeriesId] = episode;

                // Insert bumper after every episode if available
                if (eraBumpers.Any())
                {
                    var bumper = eraBumpers[random.Next(eraBumpers.Count)];
                    var bumperDuration = GetCachedDuration(bumper.FilePath!, durationCache);

                    var bumperEnd = current.AddSeconds(bumperDuration);
                    batch.Add(new ChannelScheduleEntry
                    {
                        ChannelId = channelId,
                        BumperId = bumper.Id,
                        StartTime = current,
                        EndTime = bumperEnd,
                    });

                    current = bumperEnd;
                }

                if (batch.Count >= 20)
                {
                    _context.ChannelScheduleEntries.AddRange(batch);
                    await _context.SaveChangesAsync();
                    totalGenerated += batch.Count;
                    _logger.LogInformation("[SCHEDULE] Saved batch of {count} entries (total={total})", batch.Count, totalGenerated);
                    batch.Clear();
                }
            }

            if (batch.Count > 0)
            {
                _context.ChannelScheduleEntries.AddRange(batch);
                await _context.SaveChangesAsync();
                totalGenerated += batch.Count;
            }

            _logger.LogInformation("[SCHEDULE] Generated {count} schedule entries for channel {id} in {iter} iterations ({skip} skips)",
                totalGenerated, channelId, iterationCount, skipCount);
        }

        private static double GetCachedDuration(string filePath, Dictionary<string, double> cache)
        {
            if (cache.TryGetValue(filePath, out var cached)) return cached;

            var duration = VideoHelper.GetVideoDurationAsync(filePath).GetAwaiter().GetResult();
            if (duration <= 0) duration = 1800;
            cache[filePath] = duration;
            return duration;
        }

        private ChannelEra? GetActiveEra(List<ChannelEra> eras, DateTime time)
        {
            // Pick the era with the latest start date (most recent era = current one)
            // Historical dates are informational only, not scheduling constraints
            return eras.OrderByDescending(e => e.StartDate).FirstOrDefault();
        }

        public async Task<ChannelScheduleEntry?> GetCurrentEntryAsync(int channelId)
        {
            var now = DateTime.UtcNow;

            var entry = await _context.ChannelScheduleEntries
                .Include(e => e.Episode).ThenInclude(e => e.Series)
                .Include(e => e.Bumper)
                .Where(e => e.ChannelId == channelId && e.StartTime <= now && e.EndTime > now)
                .FirstOrDefaultAsync();

            if (entry == null)
            {
                _logger.LogInformation("[SCHEDULE] No current entry for channel {ch}, regenerating...", channelId);
                await EnsureScheduleGeneratedAsync(channelId, now.AddHours(24));

                entry = await _context.ChannelScheduleEntries
                    .Include(e => e.Episode).ThenInclude(e => e.Series)
                    .Include(e => e.Bumper)
                    .Where(e => e.ChannelId == channelId && e.StartTime <= now && e.EndTime > now)
                    .FirstOrDefaultAsync();

                _logger.LogInformation("[SCHEDULE] After regeneration, current entry: {entry}", entry?.Episode?.Title ?? "null");
            }

            return entry;
        }

        public async Task<ChannelScheduleEntry?> GetNextEntryAsync(int channelId)
        {
            var now = DateTime.UtcNow;
            return await _context.ChannelScheduleEntries
                .Include(e => e.Episode).ThenInclude(e => e.Series)
                .Include(e => e.Bumper)
                .Where(e => e.ChannelId == channelId && e.StartTime > now)
                .OrderBy(e => e.StartTime)
                .FirstOrDefaultAsync();
        }

        public async Task CleanupOldEntriesAsync()
        {
            var cutoff = DateTime.UtcNow.AddHours(-24);
            var old = await _context.ChannelScheduleEntries
                .Where(e => e.EndTime < cutoff)
                .ToListAsync();
            _context.ChannelScheduleEntries.RemoveRange(old);
            await _context.SaveChangesAsync();
        }
    }
}
