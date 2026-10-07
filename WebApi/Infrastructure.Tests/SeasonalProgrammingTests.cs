using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Services;
using Xunit;

namespace Infrastructure.Tests;

public class SeasonalProgrammingTests
{
    [Theory]
    [InlineData("2026-10-01T05:59:59Z", false)]
    [InlineData("2026-10-01T06:00:00Z", true)]
    [InlineData("2026-11-01T05:59:59Z", true)]
    [InlineData("2026-11-01T06:00:00Z", false)]
    [InlineData("2027-10-01T06:00:00Z", true)]
    public void HalloweenUsesTheBroadcastMonthInGuatemala(string utc, bool active) =>
        Assert.Equal(active, SeasonalProgrammingPolicy.IsHalloween(DateTime.Parse(utc).ToUniversalTime(), new()));

    [Fact]
    public void SeasonalProgrammingCanBeDisabled() =>
        Assert.False(SeasonalProgrammingPolicy.IsHalloween(new DateTime(2026, 10, 15), new() { HalloweenEnabled = false }));

    [Fact]
    public void HalloweenPreferenceDoesNotRepeatAnEpisodeBeforeTheCycleEnds()
    {
        var episodes = new List<Episode>
        {
            new() { Id = 1, EpisodeType = new() { Name = "Halloween Special" } },
            new() { Id = 2, EpisodeType = new() { Name = "Regular" } },
            new() { Id = 3, EpisodeType = new() { Name = "Special" } }
        };
        var selector = new ChannelEpisodeSelector([]);
        var start = new DateTime(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);
        var selected = Enumerable.Range(0, 3).Select(index => selector.Choose(episodes, start.AddHours(index),
            TimeSpan.Zero, new Random(index), SeasonalProgrammingPolicy.IsHalloweenSpecial).Id).ToList();
        Assert.Equal(1, selected[0]);
        Assert.Equal(3, selected.Distinct().Count());
        Assert.Equal(1, selector.ShuffleCycle);
    }

    [Fact]
    public void SeasonalPreferenceStillRespectsTheRestPeriod()
    {
        var start = new DateTime(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);
        var episodes = new List<Episode>
        {
            new() { Id = 1, EpisodeType = new() { Name = "Halloween Special" } },
            new() { Id = 2, EpisodeType = new() { Name = "Regular" } }
        };
        var selector = new ChannelEpisodeSelector([new(1, start.AddMinutes(-20), 1), new(2, start.AddDays(-1), 1)]);
        Assert.Equal(2, selector.Choose(episodes, start, TimeSpan.FromHours(4), new Random(1),
            SeasonalProgrammingPolicy.IsHalloweenSpecial).Id);
    }

    [Fact]
    public void AnOrdinaryEpisodeWithHalloweenInItsTitleIsNotAutomaticallyRetagged() =>
        Assert.False(SeasonalProgrammingPolicy.IsHalloweenSpecial(new() { Title = "Halloween trailer", EpisodeType = new() { Name = "Regular" } }));
}
