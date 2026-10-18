using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Policies;
using Infrastructure.Broadcasting;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Repositories;

/// <summary>
/// Retro broadcast schedule: shuffled episodes per channel era, optional program intros and
/// commercial breaks at the episode's break points, materialized as continuous playback segments.
/// </summary>
public sealed class ScheduleRepository(NostalgiaTVContext context, MediaLibrary library, MediaProbe probe,
    ScheduleSignals signals, ILogger<ScheduleRepository> logger) : IScheduleRepository
{
    private const int MaxProgramsPerPass = 500;
    private static readonly TimeSpan Horizon = TimeSpan.FromHours(24);
    private static readonly TimeSpan History = TimeSpan.FromDays(3);

    public async Task EnsureGeneratedAsync(int channelId, DateTime untilUtc, CancellationToken token = default)
    {
        var gate = signals.Gate(channelId);
        await gate.WaitAsync(token);
        try
        {
            // Programs whose episode disappeared are dropped, even the one on air.
            var now = DateTime.UtcNow;
            var broken = await context.ScheduledPlaybackSegments.IgnoreQueryFilters()
                .Where(segment => segment.ScheduledProgram.ChannelEra.ChannelId == channelId && segment.EndsAtUtc > now
                    && (!segment.ScheduledProgram.Episode.IsAvailable || segment.ScheduledProgram.Episode.DeletedAtUtc != null))
                .MinAsync(segment => (DateTime?)segment.StartsAtUtc, token);
            if (broken.HasValue)
            {
                await DeleteProgramsAsync(channelId, broken.Value < now ? now : broken.Value, includeCurrent: true, token);
                signals.Changed(channelId);
            }
            if (await GenerateAsync(channelId, untilUtc, token)) signals.Changed(channelId);
        }
        finally { gate.Release(); }
    }

    public async Task RegenerateAsync(int channelId, bool replaceCurrent, CancellationToken token = default)
    {
        var gate = signals.Gate(channelId);
        await gate.WaitAsync(token);
        try
        {
            var now = DateTime.UtcNow;
            var currentProgram = await context.ScheduledPlaybackSegments
                .Where(segment => segment.ScheduledProgram.ChannelEra.ChannelId == channelId && segment.StartsAtUtc <= now && segment.EndsAtUtc > now)
                .Select(segment => (long?)segment.ScheduledProgramId).FirstOrDefaultAsync(token);
            // Keep the program on air unless the lineup itself changed (era switch).
            var from = !replaceCurrent && currentProgram.HasValue
                ? await context.ScheduledPlaybackSegments.Where(segment => segment.ScheduledProgramId == currentProgram).MaxAsync(segment => segment.EndsAtUtc, token)
                : now;
            await DeleteProgramsAsync(channelId, from, replaceCurrent, token);
            await GenerateAsync(channelId, now.Add(Horizon), token);
        }
        finally { gate.Release(); }
        signals.Changed(channelId);
    }

    public async Task<IReadOnlyList<ScheduleProgram>> GetProgramsAsync(int channelId, DateTime fromUtc, DateTime toUtc)
    {
        await EnsureGeneratedAsync(channelId, Clamp(toUtc));
        var programs = await context.ScheduledPrograms.AsNoTracking()
            .Where(program => program.ChannelEra.ChannelId == channelId
                && program.Segments.Any(segment => segment.EndsAtUtc > fromUtc) && program.Segments.Any(segment => segment.StartsAtUtc < toUtc))
            .Select(program => new
            {
                program.Id, program.EpisodeId, program.Episode.SeriesId, SeriesName = program.Episode.Season.Series.Name, program.Episode.Title,
                program.Episode.SeasonNumber, program.Episode.EpisodeNumber, EpisodeType = program.Episode.EpisodeType.Name,
                Segments = program.Segments.OrderBy(segment => segment.StartsAtUtc).Select(segment => new ScheduleSegment(segment.Id,
                    segment.InterludeId == null ? "Episode" : segment.Interlude!.Kind, segment.InterludeId,
                    segment.InterludeId == null ? program.Episode.Title : segment.Interlude!.Title,
                    segment.StartsAtUtc, segment.EndsAtUtc, segment.MediaStartSecond, segment.MediaEndSecond, segment.ScheduledAdBreakId != null)).ToList()
            }).ToListAsync();
        return programs.Where(program => program.Segments.Count > 0)
            .Select(program => new ScheduleProgram(program.Id, program.EpisodeId, program.SeriesId, program.SeriesName, program.Title,
                program.SeasonNumber, program.EpisodeNumber, program.EpisodeType, program.Segments[0].StartsAtUtc, program.Segments[^1].EndsAtUtc,
                program.Segments))
            .OrderBy(program => program.StartsAtUtc).ToList();
    }

    public async Task<IReadOnlyList<GuideRow>> GetGuideAsync(DateOnly localDay, int? channelId)
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(await context.PlatformSettings.Select(settings => settings.TimeZoneId).SingleAsync());
        var fromUtc = TimeZoneInfo.ConvertTimeToUtc(localDay.ToDateTime(TimeOnly.MinValue), timeZone);
        var toUtc = TimeZoneInfo.ConvertTimeToUtc(localDay.AddDays(1).ToDateTime(TimeOnly.MinValue), timeZone);
        var channels = await context.Channels.AsNoTracking().Where(channel => channelId == null || channel.Id == channelId)
            .OrderBy(channel => channel.Name).Select(channel => new { channel.Id, channel.Name, channel.LogoPath }).ToListAsync();
        var now = DateTime.UtcNow;
        var rows = new List<GuideRow>();
        foreach (var channel in channels)
        {
            var programs = toUtc > now ? await GetProgramsAsync(channel.Id, fromUtc, toUtc) : await ReadProgramsAsync(channel.Id, fromUtc, toUtc);
            rows.Add(new GuideRow(channel.Id, channel.Name, channel.LogoPath, programs.Select(program => Slot(program, now)).ToList()));
        }
        return rows;
    }

    public async Task<ChannelState?> GetStateAsync(int channelId, CancellationToken token = default)
    {
        var current = await CurrentSegmentAsync(channelId, token);
        if (current == null)
        {
            await EnsureGeneratedAsync(channelId, DateTime.UtcNow.Add(Horizon), token);
            current = await CurrentSegmentAsync(channelId, token);
            if (current == null) return null;
        }
        var now = DateTime.UtcNow;
        var next = await Segments(channelId).Where(segment => segment.StartsAtUtc >= current.EndsAtUtc)
            .OrderBy(segment => segment.StartsAtUtc)
            .Select(segment => segment.InterludeId == null ? segment.ScheduledProgram.Episode.Title : segment.Interlude!.Title)
            .FirstOrDefaultAsync(token);
        var elapsed = (now - current.StartsAtUtc).TotalSeconds;
        return new ChannelState(channelId, current.Id, current.Kind, current.EpisodeId, current.SeriesId, current.SeriesName, current.SeriesLogoPath,
            current.Title, current.SeasonNumber, current.EpisodeNumber, current.FilePath, (double)(current.MediaStartSecond ?? 0),
            (double)(current.MediaStartSecond ?? 0) + elapsed,
            (current.EndsAtUtc - now).TotalSeconds, next, current.StartsAtUtc, current.EndsAtUtc);
    }

    public async Task<IReadOnlyList<int>> ChannelIdsAsync(CancellationToken token = default) =>
        await context.Channels.AsNoTracking().OrderBy(channel => channel.Id).Select(channel => channel.Id).ToListAsync(token);

    /// <summary>Old programs are removed, except the latest shuffle cycle the selector still needs.</summary>
    public async Task CleanupAsync(CancellationToken token = default)
    {
        var cutoff = DateTime.UtcNow - History;
        var old = context.ScheduledPrograms.IgnoreQueryFilters().Where(program =>
            !program.Segments.Any(segment => segment.EndsAtUtc >= cutoff)
            && (program.ChannelEra.DeletedAtUtc != null || program.ShuffleCycle == null || program.ShuffleCycle != context.ScheduledPrograms
                .IgnoreQueryFilters().Where(item => item.ChannelEra.ChannelId == program.ChannelEra.ChannelId).Max(item => item.ShuffleCycle)));
        var ids = await old.OrderBy(program => program.Id).Select(program => program.Id).Take(5000).ToListAsync(token);
        if (ids.Count == 0) return;
        await context.ScheduledPlaybackSegments.Where(segment => ids.Contains(segment.ScheduledProgramId)).ExecuteDeleteAsync(token);
        await context.ScheduledAdBreaks.Where(adBreak => ids.Contains(adBreak.ScheduledProgramId)).ExecuteDeleteAsync(token);
        await context.ScheduledPrograms.Where(program => ids.Contains(program.Id)).ExecuteDeleteAsync(token);
    }

    // ── Generation ──

    private async Task<bool> GenerateAsync(int channelId, DateTime untilUtc, CancellationToken token)
    {
        var selection = await EnsureSelectionAsync(channelId, token);
        if (selection == null) return false;
        var lastEnd = await context.ScheduledPlaybackSegments.Where(segment => segment.ScheduledProgram.ChannelEra.ChannelId == channelId)
            .MaxAsync(segment => (DateTime?)segment.EndsAtUtc, token);
        var now = DateTime.UtcNow;
        var current = lastEnd is { } end && end > now ? end : now;
        if (current >= untilUtc) return false;

        var rules = SchedulingRules.From(await context.PlatformSettings.AsNoTracking().SingleAsync(token));
        var eraId = selection.ChannelEraId;
        var lineup = await context.ChannelEraSeries.AsNoTracking().Where(link => link.ChannelEraId == eraId)
            .Select(link => new { link.SeriesId, Seasons = link.SelectedSeasons.Select(season => season.SeasonNumber).ToList() }).ToListAsync(token);
        if (lineup.Count == 0) return false;
        var seriesIds = lineup.Select(link => link.SeriesId).ToList();
        var episodes = (await context.Episodes.AsNoTracking()
                .Where(episode => seriesIds.Contains(episode.SeriesId) && episode.IsAvailable && episode.FilePath != null && episode.Season.Series.DeletedAtUtc == null)
                .Select(episode => new { episode.Id, episode.SeriesId, episode.SeasonNumber, episode.EpisodeTypeId, episode.FilePath }).ToListAsync(token))
            .Where(episode => lineup.First(link => link.SeriesId == episode.SeriesId).Seasons is var seasons && (seasons.Count == 0 || seasons.Contains(episode.SeasonNumber)))
            .Select(episode => new EpisodeCandidate(episode.Id, episode.SeriesId, episode.EpisodeTypeId, episode.FilePath!)).ToList();
        if (episodes.Count == 0) return false;

        var breakRule = await context.ChannelEraBreakRules.AsNoTracking().SingleOrDefaultAsync(rule => rule.ChannelEraId == eraId, token);
        var clips = await ClipsAsync(eraId, token);
        var lastClipUse = await context.ScheduledPlaybackSegments.AsNoTracking()
            .Where(segment => segment.InterludeId != null && segment.ScheduledProgram.ChannelEra.ChannelId == channelId && segment.EndsAtUtc >= current.AddDays(-7))
            .GroupBy(segment => segment.InterludeId!.Value)
            .Select(group => new { group.Key, Last = group.Max(segment => segment.EndsAtUtc) })
            .ToDictionaryAsync(item => item.Key, item => item.Last, token);

        var latestCycle = await context.ScheduledPrograms.Where(program => program.ChannelEra.ChannelId == channelId)
            .MaxAsync(program => program.ShuffleCycle, token) ?? 1;
        var historyFrom = current - History;
        var previous = await context.ScheduledPrograms.AsNoTracking()
            .Where(program => program.ChannelEra.ChannelId == channelId && program.Segments.Any()
                && (program.ShuffleCycle == latestCycle || program.Segments.Any(segment => segment.StartsAtUtc >= historyFrom)))
            .Select(program => new PriorProgram(program.EpisodeId, program.Episode.SeriesId, program.Episode.EpisodeTypeId,
                program.Segments.Min(segment => segment.StartsAtUtc), program.Segments.Max(segment => segment.EndsAtUtc), program.ShuffleCycle))
            .ToListAsync(token);
        var selector = new ChannelEpisodeSelector(previous.Select(item => new EpisodeAiring(item.EpisodeId, item.StartsAtUtc, item.ShuffleCycle)));

        var eligible = episodes.Select(episode => episode.Id).ToHashSet();
        var durations = previous.Where(item => eligible.Contains(item.EpisodeId)).Select(item => (item.EndsAtUtc - item.StartsAtUtc).TotalSeconds)
            .Where(seconds => seconds > 0).ToList();
        var preferredGap = ChannelEpisodeSelector.EstimatePreferredGap(TimeSpan.FromHours(Math.Max(0, rules.NoRepeatWindowHours)),
            episodes.Count, durations.Count > 0 ? durations.Average() : 1800);
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(rules.TimeZoneId);
        var probed = new Dictionary<string, decimal>(StringComparer.Ordinal);
        var random = Random.Shared;

        var generated = 0;
        while (current < untilUtc && generated < MaxProgramsPerPass)
        {
            var episode = Pick(episodes, previous, current, preferredGap, selector, rules, timeZone, random);
            var duration = await DurationAsync(episode.FilePath, probed, token);
            var points = await context.EpisodeBreakPoints.AsNoTracking()
                .Where(point => point.EpisodeId == episode.Id && point.OffsetSeconds > 0 && point.OffsetSeconds < duration)
                .OrderBy(point => point.OffsetSeconds).Select(point => new { point.Id, point.OffsetSeconds }).ToListAsync(token);

            var programStart = current;
            await using var transaction = await context.Database.BeginTransactionAsync(token);
            var program = new ScheduledProgram { ChannelEraId = eraId, EpisodeId = episode.Id, ShuffleCycle = selector.ShuffleCycle, GeneratedAtUtc = DateTime.UtcNow };
            context.ScheduledPrograms.Add(program);
            await context.SaveChangesAsync(token);

            var cursor = current;
            var intro = CommercialBreakPlanner.ProgramIntro(clips, lastClipUse, cursor,
                SeasonalProgrammingPolicy.InterludeSeasonAt(cursor, rules), episode.SeriesId, random);
            if (intro != null) cursor = AddInterlude(program.Id, null, intro, cursor, lastClipUse);

            var offset = 0m;
            foreach (var point in points)
            {
                var breakStart = cursor.AddSeconds((double)(point.OffsetSeconds - offset));
                var planned = CommercialBreakPlanner.Plan(clips, breakRule, lastClipUse, breakStart,
                    SeasonalProgrammingPolicy.InterludeSeasonAt(breakStart, rules), episode.SeriesId, random);
                if (planned.Count == 0) continue;
                cursor = AddEpisodeSlice(program.Id, cursor, offset, point.OffsetSeconds);
                var adBreak = new ScheduledAdBreak { ScheduledProgramId = program.Id, EpisodeBreakPointId = point.Id };
                context.ScheduledAdBreaks.Add(adBreak);
                await context.SaveChangesAsync(token);
                foreach (var clip in planned) cursor = AddInterlude(program.Id, adBreak.Id, clip, cursor, lastClipUse);
                offset = point.OffsetSeconds;
            }
            current = AddEpisodeSlice(program.Id, cursor, offset, duration);
            await context.SaveChangesAsync(token);
            await transaction.CommitAsync(token);
            previous.Add(new PriorProgram(episode.Id, episode.SeriesId, episode.EpisodeTypeId, programStart, current, selector.ShuffleCycle));
            generated++;
        }
        if (generated >= MaxProgramsPerPass)
            logger.LogWarning("Schedule generation stopped after {Count} programs for channel {ChannelId}", generated, channelId);
        return generated > 0;
    }

    /// <summary>Channels without a selection broadcast their most recent era.</summary>
    private async Task<ChannelEraSelection?> EnsureSelectionAsync(int channelId, CancellationToken token)
    {
        var selection = await context.ChannelEraSelections.SingleOrDefaultAsync(item => item.ChannelId == channelId, token);
        if (selection != null)
        {
            // A soft-deleted era cannot stay on air.
            if (await context.ChannelEras.AnyAsync(era => era.Id == selection.ChannelEraId, token)) return selection;
            context.ChannelEraSelections.Remove(selection);
            await context.SaveChangesAsync(token);
        }
        var era = await context.ChannelEras.Where(item => item.ChannelId == channelId && item.Channel.DeletedAtUtc == null)
            .OrderByDescending(item => item.HistoricalStartDate).ThenByDescending(item => item.Id).FirstOrDefaultAsync(token);
        if (era == null) return null;
        selection = new ChannelEraSelection { ChannelId = channelId, ChannelEraId = era.Id, SelectedAtUtc = DateTime.UtcNow };
        context.ChannelEraSelections.Add(selection);
        await context.SaveChangesAsync(token);
        return selection;
    }

    private async Task<List<BroadcastClip>> ClipsAsync(int eraId, CancellationToken token)
    {
        var eraWide = await context.ChannelEraInterludes.AsNoTracking()
            .Where(item => item.ChannelEraId == eraId && item.Interlude.ApprovedForBroadcast && item.Interlude.DeletedAtUtc == null)
            .Select(item => new BroadcastClip(item.InterludeId, item.Interlude.Kind, item.Interlude.BumperType, item.Interlude.Season,
                item.Interlude.DurationSeconds, item.Weight, item.MinimumGapSeconds, null)).ToListAsync(token);
        var perSeries = await context.ChannelEraSeriesInterludes.AsNoTracking()
            .Where(item => item.ChannelEraId == eraId && item.Interlude.ApprovedForBroadcast && item.Interlude.DeletedAtUtc == null)
            .Select(item => new BroadcastClip(item.InterludeId, item.Interlude.Kind, item.Interlude.BumperType, item.Interlude.Season,
                item.Interlude.DurationSeconds, item.Weight, item.MinimumGapSeconds, item.SeriesId)).ToListAsync(token);
        return [.. eraWide, .. perSeries];
    }

    /// <summary>Daily caps for specials and movies, counted in the platform's local day.</summary>
    private static EpisodeCandidate Pick(List<EpisodeCandidate> episodes, List<PriorProgram> prior, DateTime current, TimeSpan preferredGap,
        ChannelEpisodeSelector selector, SchedulingRules rules, TimeZoneInfo timeZone, Random random)
    {
        var day = TimeZoneInfo.ConvertTimeFromUtc(current, timeZone).Date;
        var today = prior.Where(item => TimeZoneInfo.ConvertTimeFromUtc(item.StartsAtUtc, timeZone).Date == day).ToList();
        bool WithinCaps(EpisodeCandidate episode)
        {
            if (SeasonalProgrammingPolicy.IsMovie(episode.EpisodeTypeId))
                return today.Count(item => SeasonalProgrammingPolicy.IsMovie(item.EpisodeTypeId)) < rules.MaxMoviesPerDay
                    && today.Count(item => item.SeriesId == episode.SeriesId && SeasonalProgrammingPolicy.IsMovie(item.EpisodeTypeId)) < rules.MaxMoviesPerSeriesPerDay;
            if (SeasonalProgrammingPolicy.IsSpecial(episode.EpisodeTypeId))
                return today.Count(item => SeasonalProgrammingPolicy.IsSpecial(item.EpisodeTypeId)) < rules.MaxSpecialsPerDay
                    && today.Count(item => item.SeriesId == episode.SeriesId && SeasonalProgrammingPolicy.IsSpecial(item.EpisodeTypeId)) < rules.MaxSpecialsPerSeriesPerDay;
            return true;
        }
        var pool = episodes.Where(WithinCaps).ToList();
        return selector.Choose(pool.Count > 0 ? pool : episodes, current, preferredGap, random,
            SeasonalProgrammingPolicy.EpisodePreferenceAt(current, rules));
    }

    private DateTime AddEpisodeSlice(long programId, DateTime start, decimal from, decimal to)
    {
        var end = start.AddSeconds((double)(to - from));
        context.ScheduledPlaybackSegments.Add(new ScheduledPlaybackSegment
        {
            ScheduledProgramId = programId, StartsAtUtc = start, EndsAtUtc = end, MediaStartSecond = from, MediaEndSecond = to
        });
        return end;
    }

    private DateTime AddInterlude(long programId, long? adBreakId, BroadcastClip clip, DateTime start, Dictionary<int, DateTime> lastUse)
    {
        var end = start.AddSeconds((double)clip.DurationSeconds);
        context.ScheduledPlaybackSegments.Add(new ScheduledPlaybackSegment
        {
            ScheduledProgramId = programId, ScheduledAdBreakId = adBreakId, InterludeId = clip.InterludeId, StartsAtUtc = start, EndsAtUtc = end
        });
        lastUse[clip.InterludeId] = end;
        return end;
    }

    private async Task<decimal> DurationAsync(string publicPath, Dictionary<string, decimal> cache, CancellationToken token)
    {
        if (cache.TryGetValue(publicPath, out var value)) return value;
        decimal duration;
        try { duration = (decimal)(await probe.ReadAsync(MediaFilePolicy.SafePath(library.Root, library.ResolvePublicPath(publicPath)), token)).Duration; }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or System.ComponentModel.Win32Exception)
        {
            logger.LogWarning(error, "Duration of {Path} could not be read; assuming 30 minutes", publicPath);
            duration = 1800;
        }
        return cache[publicPath] = decimal.Round(Math.Max(1, duration), 3);
    }

    private async Task DeleteProgramsAsync(int channelId, DateTime fromUtc, bool includeCurrent, CancellationToken token)
    {
        // Programs of a just-deleted era or channel must go too, so soft-delete filters do not apply here.
        var programs = context.ScheduledPrograms.IgnoreQueryFilters().Where(program => program.ChannelEra.ChannelId == channelId);
        programs = includeCurrent
            ? programs.Where(program => program.Segments.Any(segment => segment.EndsAtUtc > fromUtc))
            : programs.Where(program => program.Segments.Min(segment => segment.StartsAtUtc) >= fromUtc);
        // Capture the ids first: the filter itself depends on the segments being deleted.
        var ids = await programs.Select(program => program.Id).ToListAsync(token);
        if (ids.Count == 0) return;
        await context.ScheduledPlaybackSegments.Where(segment => ids.Contains(segment.ScheduledProgramId)).ExecuteDeleteAsync(token);
        await context.ScheduledAdBreaks.Where(adBreak => ids.Contains(adBreak.ScheduledProgramId)).ExecuteDeleteAsync(token);
        await context.ScheduledPrograms.Where(program => ids.Contains(program.Id)).ExecuteDeleteAsync(token);
    }

    // ── Reading ──

    private IQueryable<ScheduledPlaybackSegment> Segments(int channelId) => context.ScheduledPlaybackSegments.AsNoTracking()
        .Where(segment => segment.ScheduledProgram.ChannelEra.ChannelId == channelId && segment.ScheduledProgram.Episode.IsAvailable);

    private Task<CurrentSegment?> CurrentSegmentAsync(int channelId, CancellationToken token)
    {
        var now = DateTime.UtcNow;
        return Segments(channelId).Where(segment => segment.StartsAtUtc <= now && segment.EndsAtUtc > now)
            .OrderBy(segment => segment.StartsAtUtc)
            .Select(segment => new CurrentSegment(segment.Id, segment.InterludeId == null ? "Episode" : segment.Interlude!.Kind,
                segment.InterludeId == null ? segment.ScheduledProgram.EpisodeId : null,
                segment.InterludeId == null ? segment.ScheduledProgram.Episode.SeriesId : null,
                segment.InterludeId == null ? segment.ScheduledProgram.Episode.Season.Series.Name : null,
                segment.InterludeId == null ? segment.ScheduledProgram.Episode.Season.Series.LogoPath : null,
                segment.InterludeId == null ? segment.ScheduledProgram.Episode.Title : segment.Interlude!.Title,
                segment.InterludeId == null ? segment.ScheduledProgram.Episode.SeasonNumber : null,
                segment.InterludeId == null ? segment.ScheduledProgram.Episode.EpisodeNumber : null,
                segment.InterludeId == null ? segment.ScheduledProgram.Episode.FilePath! : segment.Interlude!.FilePath,
                segment.MediaStartSecond, segment.StartsAtUtc, segment.EndsAtUtc))
            .FirstOrDefaultAsync(token);
    }

    /// <summary>Past days are read as they aired, without generating anything.</summary>
    private async Task<IReadOnlyList<ScheduleProgram>> ReadProgramsAsync(int channelId, DateTime fromUtc, DateTime toUtc) =>
        (await context.ScheduledPrograms.AsNoTracking()
            .Where(program => program.ChannelEra.ChannelId == channelId && program.Segments.Any(segment => segment.EndsAtUtc > fromUtc)
                && program.Segments.Any(segment => segment.StartsAtUtc < toUtc))
            .Select(program => new ScheduleProgram(program.Id, program.EpisodeId, program.Episode.SeriesId, program.Episode.Season.Series.Name,
                program.Episode.Title, program.Episode.SeasonNumber, program.Episode.EpisodeNumber, program.Episode.EpisodeType.Name,
                program.Segments.Min(segment => segment.StartsAtUtc), program.Segments.Max(segment => segment.EndsAtUtc), new List<ScheduleSegment>()))
            .ToListAsync()).OrderBy(program => program.StartsAtUtc).ToList();

    internal static GuideSlot Slot(ScheduleProgram program, DateTime now) => new(program.Id, program.EpisodeId, program.SeriesId, program.SeriesName,
        program.Title, program.SeasonNumber, program.EpisodeNumber, program.EpisodeType, program.EpisodeType != "Episodio",
        program.StartsAtUtc <= now && program.EndsAtUtc > now, program.StartsAtUtc, program.EndsAtUtc);

    private static DateTime Clamp(DateTime untilUtc)
    {
        var max = DateTime.UtcNow.AddHours(72);
        return untilUtc > max ? max : untilUtc;
    }

    private sealed record PriorProgram(int EpisodeId, int SeriesId, int EpisodeTypeId, DateTime StartsAtUtc, DateTime EndsAtUtc, int? ShuffleCycle);

    private sealed record CurrentSegment(long Id, string Kind, int? EpisodeId, int? SeriesId, string? SeriesName, string? SeriesLogoPath,
        string Title, int? SeasonNumber, int? EpisodeNumber, string FilePath, decimal? MediaStartSecond, DateTime StartsAtUtc, DateTime EndsAtUtc);
}
