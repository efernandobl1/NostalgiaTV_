using ApplicationCore.Entities;
using Infrastructure.Services;
using Xunit;

namespace Infrastructure.Tests;

public class ChannelEpisodeSelectorTests
{
    [Fact]
    public void PlaysEachEpisodeBeforeStartingAnotherCycle()
    {
        var selector = new ChannelEpisodeSelector([]);
        var episodes = Episodes(1, 2, 3, 4);
        var start = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);

        var selected = Enumerable.Range(0, episodes.Count * 3)
            .Select(index => selector.Choose(episodes, start.AddMinutes(index * 30), TimeSpan.FromHours(16), new Random(index)).Id)
            .ToList();

        for (var index = 0; index < selected.Count; index += episodes.Count)
            Assert.Equal(episodes.Count, selected.Skip(index).Take(episodes.Count).Distinct().Count());
        for (var index = 1; index < selected.Count; index++)
            Assert.NotEqual(selected[index - 1], selected[index]);
    }

    [Fact]
    public void ContinuesTheCurrentCycleFromSavedAirings()
    {
        var start = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);
        var history = new[]
        {
            new EpisodeAiring(1, start.AddHours(-3)),
            new EpisodeAiring(2, start.AddHours(-2)),
            new EpisodeAiring(3, start.AddHours(-1))
        };
        var selector = new ChannelEpisodeSelector(history);

        var chosen = selector.Choose(Episodes(1, 2, 3, 4), start, TimeSpan.FromHours(16), new Random(1));

        Assert.Equal(4, chosen.Id);
    }

    [Fact]
    public void UsesThePersistedCycleInsteadOfGuessingItsBoundary()
    {
        var start = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);
        var history = new[]
        {
            new EpisodeAiring(1, start.AddHours(-6), 1),
            new EpisodeAiring(2, start.AddHours(-5), 1),
            new EpisodeAiring(3, start.AddHours(-4), 1),
            new EpisodeAiring(4, start.AddHours(-3), 1),
            new EpisodeAiring(2, start.AddHours(-2), 2),
            new EpisodeAiring(1, start.AddHours(-1), 2)
        };
        var selector = new ChannelEpisodeSelector(history);

        var chosen = selector.Choose(Episodes(1, 2, 3, 4), start, TimeSpan.Zero, new Random(1));

        Assert.Equal(2, selector.ShuffleCycle);
        Assert.Contains(chosen.Id, new[] { 3, 4 });
    }

    [Fact]
    public void AvoidsAnImmediateReplayWhenThePlaylistChanges()
    {
        var start = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);
        var selector = new ChannelEpisodeSelector(
        [
            new EpisodeAiring(1, start.AddHours(-2), 2),
            new EpisodeAiring(2, start.AddHours(-1), 2)
        ]);

        var chosen = selector.Choose(Episodes(1, 2, 3), start, TimeSpan.Zero, new Random(1));

        Assert.Equal(3, chosen.Id);
        Assert.Equal(2, selector.ShuffleCycle);

        chosen = selector.Choose(Episodes(1, 2), start.AddHours(1), TimeSpan.Zero, new Random(1));

        Assert.NotEqual(3, chosen.Id);
        Assert.Equal(3, selector.ShuffleCycle);
    }

    [Fact]
    public void AvoidsTheSameTimeSlotWhenAnotherEpisodeIsAvailable()
    {
        var start = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);
        var selector = new ChannelEpisodeSelector(
        [
            new EpisodeAiring(1, start.AddDays(-1)),
            new EpisodeAiring(2, start.AddDays(-1).AddHours(-6))
        ]);

        var chosen = selector.Choose(Episodes(1, 2), start, TimeSpan.Zero, new Random(1));

        Assert.Equal(2, chosen.Id);
    }

    [Fact]
    public void ComparesTimeSlotsAcrossMidnight()
    {
        var start = new DateTime(2026, 10, 5, 0, 30, 0, DateTimeKind.Utc);
        var selector = new ChannelEpisodeSelector(
        [
            new EpisodeAiring(1, start.AddDays(-1).AddHours(-1)),
            new EpisodeAiring(2, start.AddDays(-1).AddHours(-6))
        ]);

        var chosen = selector.Choose(Episodes(1, 2), start, TimeSpan.Zero, new Random(1));

        Assert.Equal(2, chosen.Id);
    }

    [Fact]
    public void IgnoresTimeSlotsOlderThanThreeDays()
    {
        var start = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);
        var selector = new ChannelEpisodeSelector(
        [
            new EpisodeAiring(1, start.AddDays(-4), 1),
            new EpisodeAiring(2, start.AddDays(-2), 1)
        ]);

        var chosen = selector.Choose(Episodes(1, 2), start, TimeSpan.Zero, new Random(1));

        Assert.Equal(1, chosen.Id);
        Assert.Equal(2, selector.ShuffleCycle);
    }

    [Fact]
    public void ReducesThePreferredGapForOneDayOfContent()
    {
        var gap = ChannelEpisodeSelector.EstimatePreferredGap(TimeSpan.FromHours(24), 48, 1800);

        Assert.Equal(TimeSpan.FromHours(16.8), gap);
    }

    private static List<Episode> Episodes(params int[] ids) =>
        ids.Select(id => new Episode { Id = id }).ToList();
}
