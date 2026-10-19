using ApplicationCore.Entities;

namespace ApplicationCore.Policies;

/// <summary>Snapshot of PlatformSettings used during one schedule-generation pass.</summary>
public sealed record SchedulingRules(
    string TimeZoneId,
    bool SeasonalEpisodesEnabled,
    bool SeasonalInterludesEnabled,
    int NoRepeatWindowHours,
    int MaxSpecialsPerDay,
    int MaxSpecialsPerSeriesPerDay,
    int MaxMoviesPerDay,
    int MaxMoviesPerSeriesPerDay)
{
    public static SchedulingRules From(PlatformSettings settings) => new(settings.TimeZoneId,
        settings.SeasonalEpisodesEnabled, settings.SeasonalInterludesEnabled, settings.NoRepeatWindowHours,
        settings.MaxSpecialsPerDay, settings.MaxSpecialsPerSeriesPerDay, settings.MaxMoviesPerDay, settings.MaxMoviesPerSeriesPerDay);
}

/// <summary>October is Halloween and December is Christmas, in the platform's local time.</summary>
public static class SeasonalProgrammingPolicy
{
    public static string SeasonAt(DateTime startsAtUtc, string timeZoneId) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(startsAtUtc, DateTimeKind.Utc),
            TimeZoneInfo.FindSystemTimeZoneById(timeZoneId)).Month switch
        {
            10 => InterludeSeason.Halloween,
            12 => InterludeSeason.Christmas,
            _ => InterludeSeason.AllYear
        };

    public static string InterludeSeasonAt(DateTime startsAtUtc, SchedulingRules rules) =>
        rules.SeasonalInterludesEnabled ? SeasonAt(startsAtUtc, rules.TimeZoneId) : InterludeSeason.AllYear;

    /// <summary>Seasonal specials are preferred (not forced) while their season lasts.</summary>
    public static Func<EpisodeCandidate, bool>? EpisodePreferenceAt(DateTime startsAtUtc, SchedulingRules rules)
    {
        if (!rules.SeasonalEpisodesEnabled) return null;
        return SeasonAt(startsAtUtc, rules.TimeZoneId) switch
        {
            InterludeSeason.Halloween => episode => episode.EpisodeTypeId == SeedIds.HalloweenSpecial,
            InterludeSeason.Christmas => episode => episode.EpisodeTypeId == SeedIds.ChristmasSpecial,
            _ => null
        };
    }

    public static bool IsMovie(int episodeTypeId) => episodeTypeId == SeedIds.Movie;

    public static bool IsSpecial(int episodeTypeId) =>
        episodeTypeId is SeedIds.Special or SeedIds.ChristmasSpecial or SeedIds.HalloweenSpecial;
}
