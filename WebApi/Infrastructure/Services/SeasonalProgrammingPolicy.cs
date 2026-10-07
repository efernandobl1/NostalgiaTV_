using ApplicationCore.Entities;
using ApplicationCore.Settings;

namespace Infrastructure.Services;

public static class SeasonalProgrammingPolicy
{
    public static bool IsHalloween(DateTime startsAtUtc, ChannelSchedulingSettings rules) =>
        rules.HalloweenEnabled && TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.SpecifyKind(startsAtUtc, DateTimeKind.Utc),
            TimeZoneInfo.FindSystemTimeZoneById(rules.TimeZoneId)).Month == 10;

    public static bool IsHalloweenSpecial(Episode episode) =>
        episode.EpisodeType.Name.Equals("Halloween Special", StringComparison.OrdinalIgnoreCase);
}
