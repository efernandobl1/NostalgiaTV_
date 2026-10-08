using ApplicationCore.Entities;
using ApplicationCore.Settings;

namespace Infrastructure.Services;

public static class SeasonalProgrammingPolicy
{
    public static InterludeSeason InterludeSeasonAt(DateTime startsAtUtc, ChannelSchedulingSettings rules)
    {
        if (!rules.SeasonalInterludesEnabled) return InterludeSeason.AllYear;
        var season = InterludeSeasonAt(startsAtUtc, rules.TimeZoneId);
        return season == InterludeSeason.Halloween && !rules.HalloweenEnabled ? InterludeSeason.AllYear : season;
    }

    public static InterludeSeason InterludeSeasonAt(DateTime startsAtUtc, string timeZoneId) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(startsAtUtc, DateTimeKind.Utc),
            TimeZoneInfo.FindSystemTimeZoneById(timeZoneId)).Month switch
        {
            10 => InterludeSeason.Halloween,
            12 => InterludeSeason.Christmas,
            _ => InterludeSeason.AllYear
        };

    public static bool IsHalloween(DateTime startsAtUtc, ChannelSchedulingSettings rules) =>
        rules.HalloweenEnabled && rules.SeasonalEpisodesEnabled
        && InterludeSeasonAt(startsAtUtc, rules.TimeZoneId) == InterludeSeason.Halloween;

    public static Func<Episode, bool>? EpisodePreferenceAt(DateTime startsAtUtc, ChannelSchedulingSettings rules)
    {
        if (!rules.SeasonalEpisodesEnabled) return null;
        var season = InterludeSeasonAt(startsAtUtc, rules.TimeZoneId);
        if (season == InterludeSeason.Halloween && rules.HalloweenEnabled) return IsHalloweenSpecial;
        return season == InterludeSeason.Christmas
            ? episode => episode.EpisodeType.Name.Equals("Christmas Special", StringComparison.OrdinalIgnoreCase)
            : null;
    }

    public static bool IsHalloweenSpecial(Episode episode) =>
        episode.EpisodeType.Name.Equals("Halloween Special", StringComparison.OrdinalIgnoreCase);
}
