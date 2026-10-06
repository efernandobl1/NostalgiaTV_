using ApplicationCore.DTOs.Channel;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Collections.Concurrent;

namespace Infrastructure.Services;

public class ChannelScheduleService
{
    private readonly NostalgiaTVContext _context;
    private readonly ILogger<ChannelScheduleService> _logger;
    private readonly ChannelSchedulingSettings _rules;
    private static readonly ConcurrentDictionary<int, SemaphoreSlim> Locks = new();

    public ChannelScheduleService(
        NostalgiaTVContext context,
        ILogger<ChannelScheduleService> logger,
        IOptions<ChannelSchedulingSettings> rules)
    {
        _context = context;
        _logger = logger;
        _rules = rules.Value;
    }

    public async Task<List<ChannelScheduleEntryResponse>> GetScheduleAsync(int channelId)
    {
        var now = DateTime.UtcNow;
        await EnsureScheduleGeneratedAsync(channelId, now.AddHours(24));
        var entries = await LoadSegments(channelId)
            .Where(segment => segment.EndsAtUtc >= now.AddHours(-24)
                && segment.StartsAtUtc <= now.AddHours(24))
            .OrderBy(segment => segment.StartsAtUtc)
            .ToListAsync();

        return entries.Select(segment =>
        {
            var entry = ToEntry(segment);
            return new ChannelScheduleEntryResponse
            {
                Id = entry.SegmentId,
                ChannelId = channelId,
                EpisodeId = entry.EpisodeId,
                EpisodeTitle = entry.Episode?.Title ?? entry.Bumper?.Title ?? "",
                SeriesName = entry.Episode?.Series?.Name ?? "",
                SeriesLogoPath = entry.Episode?.Series?.LogoPath,
                FilePath = CleanPath(entry.Episode?.FilePath ?? entry.Bumper?.FilePath),
                StartTime = DateTime.SpecifyKind(entry.StartTime, DateTimeKind.Utc),
                EndTime = DateTime.SpecifyKind(entry.EndTime, DateTimeKind.Utc),
                Season = entry.Episode?.Season ?? 0,
                EpisodeNumber = entry.Episode?.EpisodeNumber ?? 0,
                BumperId = entry.BumperId,
                BumperTitle = entry.Bumper?.Title,
                IsBumper = entry.BumperId != null,
                ContentKind = segment.Interlude?.Kind.ToString() ?? "Episode",
                MediaStartSecond = segment.MediaStartSecond
            };
        }).ToList();
    }

    public async Task EnsureScheduleGeneratedAsync(int channelId, DateTime until)
    {
        var gate = Locks.GetOrAdd(channelId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        try
        {
            await GenerateScheduleCoreAsync(channelId, until);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task RegenerateAsync(int channelId, DateTime until, bool replaceCurrent = false)
    {
        var gate = Locks.GetOrAdd(channelId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        try
        {
            await using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                var now = DateTime.UtcNow;
                var currentProgramId = await _context.ScheduledPlaybackSegments
                    .Where(segment => segment.ScheduledProgram.ChannelEra.ChannelId == channelId
                        && segment.StartsAtUtc <= now && segment.EndsAtUtc > now)
                    .Select(segment => (long?)segment.ScheduledProgramId).FirstOrDefaultAsync();
                var from = !replaceCurrent && currentProgramId.HasValue
                    ? await _context.ScheduledPlaybackSegments.Where(segment => segment.ScheduledProgramId == currentProgramId)
                        .MaxAsync(segment => segment.EndsAtUtc)
                    : now;
                await DeleteChannelScheduleCoreAsync(channelId, from, replaceCurrent);
                await transaction.CommitAsync();
            }
            await GenerateScheduleCoreAsync(channelId, until);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<List<int>> DeleteBreakPointAsync(EpisodeBreakPoint point)
    {
        var channelIds = await _context.ScheduledAdBreaks.AsNoTracking()
            .Where(item => item.EpisodeBreakPointId == point.Id)
            .Select(item => item.ScheduledProgram.ChannelEra.ChannelId)
            .Distinct().OrderBy(id => id).ToListAsync();
        var gates = channelIds.Select(id => Locks.GetOrAdd(id, _ => new SemaphoreSlim(1, 1))).ToList();
        var acquired = new List<SemaphoreSlim>();
        try
        {
            foreach (var gate in gates)
            {
                await gate.WaitAsync();
                acquired.Add(gate);
            }
            await using var transaction = await _context.Database.BeginTransactionAsync();
            foreach (var channelId in channelIds)
                await DeleteChannelScheduleCoreAsync(channelId);
            _context.EpisodeBreakPoints.Remove(point);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return channelIds;
        }
        finally
        {
            foreach (var gate in acquired) gate.Release();
        }
    }

    private async Task GenerateScheduleCoreAsync(int channelId, DateTime until)
    {
            var selection = await EnsureEraSelectionAsync(channelId);
            if (selection == null) return;

            var lastEnd = await _context.ScheduledPlaybackSegments
                .Where(segment => segment.ScheduledProgram.ChannelEra.ChannelId == channelId)
                .MaxAsync(segment => (DateTime?)segment.EndsAtUtc);
            var current = lastEnd is { } end && end > DateTime.UtcNow ? end : DateTime.UtcNow;
            if (current >= until) return;

            var links = await _context.ChannelEraSeries
                .AsNoTracking()
                .Include(link => link.SelectedSeasons)
                .Where(link => link.ChannelEraId == selection.ChannelEraId)
                .ToListAsync();
            var seriesIds = links.Select(link => link.SeriesId).ToArray();
            if (seriesIds.Length == 0) return;

            var episodes = await _context.Episodes.AsNoTracking()
                .Include(episode => episode.EpisodeType)
                .Where(episode => seriesIds.Contains(episode.SeriesId) && episode.FilePath != null)
                .ToListAsync();
            episodes = episodes.Where(episode =>
            {
                var link = links.First(item => item.SeriesId == episode.SeriesId);
                return !link.HasSeasonFilter || link.SelectedSeasons.Any(season => season.SeasonNumber == episode.Season);
            }).ToList();
            if (episodes.Count == 0) return;

            var breakRule = await _context.ChannelEraBreakRules.AsNoTracking()
                .FirstOrDefaultAsync(rule => rule.ChannelEraId == selection.ChannelEraId);
            var clips = await (
                from assignment in _context.ChannelEraInterludes.AsNoTracking()
                join clip in _context.Interludes.AsNoTracking() on assignment.InterludeId equals clip.Id
                where assignment.ChannelEraId == selection.ChannelEraId
                    && clip.ApprovedForBroadcast
                select new EligibleClip(assignment, clip)).ToListAsync();
            var lastClipUse = await (
                from segment in _context.ScheduledPlaybackSegments.AsNoTracking()
                where segment.InterludeId != null
                    && segment.ScheduledProgram.ChannelEra.ChannelId == channelId
                    && segment.EndsAtUtc >= current.AddDays(-7)
                group segment by segment.InterludeId!.Value into uses
                select new { ClipId = uses.Key, LastEnd = uses.Max(item => item.EndsAtUtc) })
                .ToDictionaryAsync(item => item.ClipId, item => item.LastEnd);

            var latestCycle = await _context.ScheduledPrograms
                .Where(program => program.ChannelEra.ChannelId == channelId)
                .MaxAsync(program => program.ShuffleCycle);
            var legacyCycle = await _context.ChannelScheduleEntries
                .Where(entry => entry.ChannelId == channelId && entry.EpisodeId != null)
                .MaxAsync(entry => entry.ShuffleCycle);
            latestCycle = Math.Max(latestCycle ?? 1, legacyCycle ?? 1);
            var previous = await (
                from segment in _context.ScheduledPlaybackSegments.AsNoTracking()
                where segment.Sequence == 1
                    && segment.ScheduledProgram.ChannelEra.ChannelId == channelId
                    && (segment.StartsAtUtc >= current.AddDays(-3)
                        || segment.ScheduledProgram.ShuffleCycle == latestCycle)
                select new PriorProgram(
                    segment.ScheduledProgram.EpisodeId,
                    segment.ScheduledProgram.Episode.SeriesId,
                    segment.ScheduledProgram.Episode.EpisodeType.Name,
                    segment.StartsAtUtc,
                    _context.ScheduledPlaybackSegments.Where(item => item.ScheduledProgramId == segment.ScheduledProgramId)
                        .Max(item => item.EndsAtUtc),
                    segment.ScheduledProgram.ShuffleCycle)).ToListAsync();

            var legacyHistory = await _context.ChannelScheduleEntries.AsNoTracking()
                .Where(entry => entry.ChannelId == channelId && entry.EpisodeId != null && entry.StartTime < current
                    && (entry.StartTime >= current.AddDays(-3) || entry.ShuffleCycle == latestCycle))
                .Select(entry => new PriorProgram(entry.EpisodeId!.Value, entry.Episode!.SeriesId,
                    entry.Episode.EpisodeType.Name, entry.StartTime, entry.EndTime, entry.ShuffleCycle)).ToListAsync();
            previous.AddRange(legacyHistory);
            var selector = new ChannelEpisodeSelector(previous.Select(item => new EpisodeAiring(item.EpisodeId, item.StartsAtUtc, item.ShuffleCycle)));

            var durations = new Dictionary<string, decimal>(StringComparer.Ordinal);
            var eligibleIds = episodes.Select(episode => episode.Id).ToHashSet();
            var previousDurations = previous.Where(item => eligibleIds.Contains(item.EpisodeId))
                .Select(item => (item.EndsAtUtc - item.StartsAtUtc).TotalSeconds).Where(seconds => seconds > 0).ToList();
            var averageDuration = previousDurations.Count > 0 ? previousDurations.Average() : 1800;
            var preferredGap = ChannelEpisodeSelector.EstimatePreferredGap(
                TimeSpan.FromHours(Math.Max(0, _rules.NoRepeatWindowHours)), episodes.Count, averageDuration);
            var iterations = 0;
            while (current < until && iterations++ < 500)
            {
                var programStart = current;
                var episode = PickEpisode(episodes, previous, current, preferredGap, selector);
                var duration = await GetDurationAsync(episode.FilePath!, durations);
                var points = await _context.EpisodeBreakPoints.AsNoTracking()
                    .Where(point => point.EpisodeId == episode.Id
                        && point.OffsetSeconds > 0 && point.OffsetSeconds < duration)
                    .OrderBy(point => point.OffsetSeconds)
                    .ToListAsync();

                await using var transaction = await _context.Database.BeginTransactionAsync();
                var program = new ScheduledProgram
                {
                    ChannelEraId = selection.ChannelEraId,
                    EpisodeId = episode.Id,
                    ShuffleCycle = selector.ShuffleCycle,
                    GeneratedAtUtc = DateTime.UtcNow
                };
                _context.ScheduledPrograms.Add(program);
                await _context.SaveChangesAsync();

                var sequence = 0;
                var offset = 0m;
                var ordinal = 0;
                var startsAt = current;
                foreach (var point in points)
                {
                    var planned = PlanBreak(clips, breakRule, lastClipUse, startsAt.AddSeconds((double)(point.OffsetSeconds - offset)));
                    if (planned.Count == 0) continue;

                    startsAt = AddEpisodeSegment(program.Id, ++sequence, startsAt, offset, point.OffsetSeconds);
                    var adBreak = new ScheduledAdBreak
                    {
                        ScheduledProgramId = program.Id,
                        EpisodeBreakPointId = point.Id,
                        Ordinal = ++ordinal
                    };
                    _context.ScheduledAdBreaks.Add(adBreak);
                    await _context.SaveChangesAsync();

                    foreach (var clip in planned)
                    {
                        var endsAt = startsAt.AddSeconds((double)clip.DurationSeconds);
                        _context.ScheduledPlaybackSegments.Add(new ScheduledPlaybackSegment
                        {
                            ScheduledProgramId = program.Id,
                            ScheduledAdBreakId = adBreak.Id,
                            InterludeId = clip.Id,
                            Sequence = ++sequence,
                            StartsAtUtc = startsAt,
                            EndsAtUtc = endsAt
                        });
                        startsAt = endsAt;
                        lastClipUse[clip.Id] = endsAt;
                    }
                    offset = point.OffsetSeconds;
                }

                current = AddEpisodeSegment(program.Id, ++sequence, startsAt, offset, duration);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                previous.Add(new PriorProgram(episode.Id, episode.SeriesId, episode.EpisodeType.Name, programStart, current, selector.ShuffleCycle));
            }
            if (iterations >= 500)
                _logger.LogWarning("Schedule generation stopped after 500 episodes for channel {ChannelId}", channelId);
    }

    private async Task<ChannelEraSelection?> EnsureEraSelectionAsync(int channelId)
    {
        var selection = await _context.ChannelEraSelections.FindAsync(channelId);
        if (selection != null) return selection;

        var channel = await _context.Channels.Include(item => item.Series)
            .Include(item => item.Eras).FirstOrDefaultAsync(item => item.Id == channelId);
        if (channel == null) return null;

        var era = channel.Eras.OrderByDescending(item => item.StartDate).ThenByDescending(item => item.Id).FirstOrDefault();
        if (era == null)
        {
            era = new ChannelEra
            {
                ChannelId = channelId,
                Name = "Imported lineup",
                StartDate = channel.StartDate,
                EndDate = channel.EndDate
            };
            _context.ChannelEras.Add(era);
            await _context.SaveChangesAsync();
            _context.ChannelEraSeries.AddRange(channel.Series.Select(series => new ChannelEraSeries
            {
                ChannelEraId = era.Id,
                SeriesId = series.Id
            }));
        }
        selection = new ChannelEraSelection
        {
            ChannelId = channelId,
            ChannelEraId = era.Id,
            SelectedAtUtc = DateTime.UtcNow
        };
        _context.ChannelEraSelections.Add(selection);
        await _context.SaveChangesAsync();
        return selection;
    }

    private Episode PickEpisode(List<Episode> episodes, List<PriorProgram> prior, DateTime current, TimeSpan preferredGap, ChannelEpisodeSelector selector)
    {
        var day = current.Date;
        var todays = prior.Where(item => item.StartsAtUtc.Date == day).ToList();
        bool WithinCaps(Episode episode)
        {
            var name = episode.EpisodeType.Name;
            if (name.Equals("Movie", StringComparison.OrdinalIgnoreCase))
                return todays.Count(item => item.TypeName.Equals("Movie", StringComparison.OrdinalIgnoreCase)) < _rules.MaxMoviesPerDay
                    && todays.Count(item => item.SeriesId == episode.SeriesId && item.TypeName.Equals("Movie", StringComparison.OrdinalIgnoreCase)) < _rules.MaxMoviesPerSeriesPerDay;
            if (name.Contains("Special", StringComparison.OrdinalIgnoreCase))
                return todays.Count(item => item.TypeName.Contains("Special", StringComparison.OrdinalIgnoreCase)) < _rules.MaxSpecialsPerDay
                    && todays.Count(item => item.SeriesId == episode.SeriesId && item.TypeName.Contains("Special", StringComparison.OrdinalIgnoreCase)) < _rules.MaxSpecialsPerSeriesPerDay;
            return true;
        }
        var pool = episodes.Where(WithinCaps).ToList();
        if (pool.Count == 0) pool = episodes;
        return selector.Choose(pool, current, preferredGap, Random.Shared);
    }

    private static List<Interlude> PlanBreak(
        List<EligibleClip> clips,
        ChannelEraBreakRule? rule,
        Dictionary<int, DateTime> lastUse,
        DateTime startsAt)
    {
        if (rule == null) return [];
        var planned = new List<Interlude>();
        var proposedUse = new Dictionary<int, DateTime>(lastUse);
        var cursor = startsAt;
        var shortestAd = clips.Where(item => item.Assignment.Role == BreakRole.Advertisement
            && item.Clip.Kind == InterludeKind.Advertisement)
            .Select(item => item.Clip.DurationSeconds).DefaultIfEmpty(decimal.MaxValue).Min();
        var shortestCloser = clips.Where(item => item.Assignment.Role == BreakRole.BreakCloser
            && item.Clip.Kind == InterludeKind.Bumper)
            .Select(item => item.Clip.DurationSeconds).DefaultIfEmpty(decimal.MaxValue).Min();
        if (shortestAd == decimal.MaxValue || shortestCloser == decimal.MaxValue) return [];

        bool Add(BreakRole role, int remainingAds)
        {
            var candidates = clips.Where(item =>
                item.Assignment.Role == role
                && item.Clip.Kind == (role == BreakRole.Advertisement ? InterludeKind.Advertisement : InterludeKind.Bumper)
                && (!proposedUse.TryGetValue(item.Clip.Id, out var last)
                    || cursor >= last.AddSeconds(item.Assignment.MinimumGapSeconds))
                && (cursor - startsAt).TotalSeconds + (double)item.Clip.DurationSeconds
                    + (double)(shortestAd * remainingAds)
                    + (role == BreakRole.BreakCloser ? 0 : (double)shortestCloser)
                    <= rule.MaximumBreakSeconds)
                .ToList();
            if (candidates.Count == 0) return false;
            var total = candidates.Sum(item => item.Assignment.Weight);
            var choice = Random.Shared.Next(total);
            var selected = candidates.First(item => (choice -= item.Assignment.Weight) < 0);
            planned.Add(selected.Clip);
            cursor = cursor.AddSeconds((double)selected.Clip.DurationSeconds);
            proposedUse[selected.Clip.Id] = cursor;
            return true;
        }

        if (!Add(BreakRole.BreakOpener, rule.MinimumAds)) return [];
        var adCount = Random.Shared.Next(rule.MinimumAds, rule.MaximumAds + 1);
        for (var i = 0; i < adCount; i++)
            if (!Add(BreakRole.Advertisement, Math.Max(0, rule.MinimumAds - i - 1)))
                return i >= rule.MinimumAds && Add(BreakRole.BreakCloser, 0) ? planned : [];
        return Add(BreakRole.BreakCloser, 0) ? planned : [];
    }

    private DateTime AddEpisodeSegment(long programId, int sequence, DateTime start, decimal from, decimal to)
    {
        var end = start.AddSeconds((double)(to - from));
        _context.ScheduledPlaybackSegments.Add(new ScheduledPlaybackSegment
        {
            ScheduledProgramId = programId,
            Sequence = sequence,
            StartsAtUtc = start,
            EndsAtUtc = end,
            MediaStartSecond = from,
            MediaEndSecond = to
        });
        return end;
    }

    private static async Task<decimal> GetDurationAsync(string path, Dictionary<string, decimal> cache)
    {
        if (cache.TryGetValue(path, out var value)) return value;
        var duration = Math.Max(1, await VideoHelper.GetVideoDurationAsync(path));
        return cache[path] = decimal.Round((decimal)duration, 3);
    }

    private IQueryable<ScheduledPlaybackSegment> LoadSegments(int channelId) =>
        _context.ScheduledPlaybackSegments.AsNoTracking()
            .Include(segment => segment.ScheduledProgram).ThenInclude(program => program.ChannelEra)
            .Include(segment => segment.ScheduledProgram).ThenInclude(program => program.Episode).ThenInclude(episode => episode.Series)
            .Include(segment => segment.Interlude)
            .Where(segment => segment.ScheduledProgram.ChannelEra.ChannelId == channelId);

    private static ChannelScheduleEntry ToEntry(ScheduledPlaybackSegment segment)
    {
        var program = segment.ScheduledProgram;
        return new ChannelScheduleEntry
        {
            ChannelId = program.ChannelEra.ChannelId,
            SegmentId = segment.Id,
            EpisodeId = segment.InterludeId == null ? program.EpisodeId : null,
            Episode = segment.InterludeId == null ? program.Episode : null,
            BumperId = segment.InterludeId,
            Bumper = segment.Interlude is { } clip ? new ChannelBumper
            {
                Id = clip.Id,
                ChannelEraId = program.ChannelEraId,
                Title = clip.Title,
                FilePath = clip.FilePath
            } : null,
            StartTime = segment.StartsAtUtc,
            EndTime = segment.EndsAtUtc,
            MediaStartSecond = (double)(segment.MediaStartSecond ?? 0)
        };
    }

    public async Task<ChannelScheduleEntry?> GetCurrentEntryAsync(int channelId)
    {
        var now = DateTime.UtcNow;
        var segment = await LoadSegments(channelId)
            .Where(item => item.StartsAtUtc <= now && item.EndsAtUtc > now)
            .OrderBy(item => item.StartsAtUtc).FirstOrDefaultAsync();
        if (segment != null) return ToEntry(segment);
        await EnsureScheduleGeneratedAsync(channelId, now.AddHours(24));
        now = DateTime.UtcNow;
        segment = await LoadSegments(channelId)
            .Where(item => item.StartsAtUtc <= now && item.EndsAtUtc > now)
            .OrderBy(item => item.StartsAtUtc).FirstOrDefaultAsync();
        return segment == null ? null : ToEntry(segment);
    }

    public async Task<ChannelScheduleEntry?> GetNextEntryAsync(int channelId)
    {
        var now = DateTime.UtcNow;
        var segment = await LoadSegments(channelId)
            .Where(item => item.StartsAtUtc > now)
            .OrderBy(item => item.StartsAtUtc).FirstOrDefaultAsync();
        return segment == null ? null : ToEntry(segment);
    }

    private async Task DeleteChannelScheduleCoreAsync(int channelId, DateTime? from = null, bool includeCurrent = false)
    {
        var programs = _context.ScheduledPrograms.Where(item => item.ChannelEra.ChannelId == channelId);
        if (from.HasValue)
            programs = includeCurrent
                ? programs.Where(program => _context.ScheduledPlaybackSegments.Any(segment => segment.ScheduledProgramId == program.Id && segment.EndsAtUtc > from.Value))
                : programs.Where(program => _context.ScheduledPlaybackSegments.Where(segment => segment.ScheduledProgramId == program.Id).Min(segment => segment.StartsAtUtc) >= from.Value);
        var ids = programs.Select(item => item.Id);
        await _context.ScheduledPlaybackSegments.Where(item => ids.Contains(item.ScheduledProgramId)).ExecuteDeleteAsync();
        await _context.ScheduledAdBreaks.Where(item => ids.Contains(item.ScheduledProgramId)).ExecuteDeleteAsync();
        await programs.ExecuteDeleteAsync();
    }

    public async Task CleanupOldEntriesAsync()
    {
        var cutoff = DateTime.UtcNow.AddDays(-3);
        var old = _context.ScheduledPrograms.Where(program =>
            _context.ScheduledPlaybackSegments.Any(segment => segment.ScheduledProgramId == program.Id)
            && !_context.ScheduledPlaybackSegments.Any(segment => segment.ScheduledProgramId == program.Id
                && segment.EndsAtUtc >= cutoff)
            && (program.ShuffleCycle == null || program.ShuffleCycle != _context.ScheduledPrograms
                .Where(item => item.ChannelEra.ChannelId == program.ChannelEra.ChannelId).Max(item => item.ShuffleCycle)));
        var ids = old.Select(item => item.Id);
        await _context.ScheduledPlaybackSegments.Where(item => ids.Contains(item.ScheduledProgramId)).ExecuteDeleteAsync();
        await _context.ScheduledAdBreaks.Where(item => ids.Contains(item.ScheduledProgramId)).ExecuteDeleteAsync();
        await old.ExecuteDeleteAsync();
        await _context.ChannelScheduleEntries.Where(item => item.EndTime < cutoff && (item.ShuffleCycle == null
            || item.ShuffleCycle != (_context.ScheduledPrograms.Where(program => program.ChannelEra.ChannelId == item.ChannelId).Max(program => program.ShuffleCycle)
                ?? _context.ChannelScheduleEntries.Where(entry => entry.ChannelId == item.ChannelId).Max(entry => entry.ShuffleCycle)))).ExecuteDeleteAsync();
    }

    private static string CleanPath(string? path) => path?.Replace("wwwroot", "").Replace("\\", "/") ?? "";

    private sealed record EligibleClip(ChannelEraInterlude Assignment, Interlude Clip);
    private sealed record PriorProgram(int EpisodeId, int SeriesId, string TypeName, DateTime StartsAtUtc, DateTime EndsAtUtc, int? ShuffleCycle);
}
