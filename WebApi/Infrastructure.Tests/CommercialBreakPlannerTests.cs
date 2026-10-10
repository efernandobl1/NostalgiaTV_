using ApplicationCore.Entities;
using Infrastructure.Services;
using Xunit;

namespace Infrastructure.Tests;

public class CommercialBreakPlannerTests
{
    private static readonly DateTime Start = new(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);
    private static readonly ChannelEraBreakRule Rules = new() { MinimumAds = 1, MaximumAds = 1, MaximumBreakSeconds = 60 };
    private static List<BroadcastClip> Clips(InterludeSeason season, int firstId) =>
        new[] { BreakRole.BreakOpener, BreakRole.Advertisement, BreakRole.BreakCloser }.Select((role, index) => new BroadcastClip(
            new() { InterludeId = firstId + index, Role = role, Weight = 1, MinimumGapSeconds = 60 },
            new() { Id = firstId + index, Season = season, Kind = role == BreakRole.Advertisement
                ? InterludeKind.Advertisement : InterludeKind.Bumper, DurationSeconds = 10, ApprovedForBroadcast = true })).ToList();

    [Theory]
    [InlineData(InterludeSeason.Halloween)]
    [InlineData(InterludeSeason.Christmas)]
    public void SeasonalBumpersAndAdsTakePriorityWithinAnEligibleBreak(InterludeSeason season)
    {
        var clips = Clips(InterludeSeason.AllYear, 1).Concat(Clips(InterludeSeason.Halloween, 10))
            .Concat(Clips(InterludeSeason.Christmas, 20)).ToList();
        for (var i = 0; i < 20; i++)
        {
            var result = CommercialBreakPlanner.Plan(clips, Rules, [], Start, season);
            Assert.Equal(3, result.Count);
            Assert.All(result, clip => Assert.Equal(season, clip.Season));
            Assert.Equal(new[] { InterludeKind.Bumper, InterludeKind.Advertisement, InterludeKind.Bumper }, result.Select(clip => clip.Kind));
        }
    }

    [Fact]
    public void SeasonalClipsNeverAirOutsideTheirMonth()
    {
        var result = CommercialBreakPlanner.Plan(Clips(InterludeSeason.AllYear, 1)
            .Concat(Clips(InterludeSeason.Halloween, 10)).ToList(), Rules, [], Start, InterludeSeason.AllYear);
        Assert.Equal(3, result.Count);
        Assert.All(result, clip => Assert.Equal(InterludeSeason.AllYear, clip.Season));
        Assert.Empty(CommercialBreakPlanner.Plan(Clips(InterludeSeason.Christmas, 20), Rules, [], Start, InterludeSeason.Halloween));
    }

    [Fact]
    public void CooldownAndDurationStillAllowAnOrdinaryFallback()
    {
        var ordinary = Clips(InterludeSeason.AllYear, 1);
        var seasonal = Clips(InterludeSeason.Halloween, 10);
        seasonal[0].Clip.DurationSeconds = 100;
        var lastUse = new Dictionary<int, DateTime> { [11] = Start.AddSeconds(-1) };
        var result = CommercialBreakPlanner.Plan(ordinary.Concat(seasonal).ToList(), Rules, lastUse, Start, InterludeSeason.Halloween);
        Assert.Equal(new[] { 1, 2, 12 }, result.Select(clip => clip.Id));
        Assert.True(result.Sum(clip => clip.DurationSeconds) <= Rules.MaximumBreakSeconds);
        Assert.Single(lastUse);
    }

    [Fact]
    public void MissingClosingBumperNeverSchedulesAnIncompleteBreak() =>
        Assert.Empty(CommercialBreakPlanner.Plan(Clips(InterludeSeason.AllYear, 1).Take(2).ToList(), Rules, [], Start, InterludeSeason.AllYear));

    [Fact]
    public void SeriesClipsTakePriorityAndOtherSeriesCannotAir()
    {
        var generic = Clips(InterludeSeason.Halloween, 1);
        var specific = Clips(InterludeSeason.AllYear, 10);
        var other = Clips(InterludeSeason.Halloween, 20);
        specific.ForEach(item => item.Assignment.SeriesId = 7);
        other.ForEach(item => item.Assignment.SeriesId = 8);
        for (var i = 0; i < 20; i++)
            Assert.Equal(new[] { 10, 11, 12 }, CommercialBreakPlanner.Plan(
                generic.Concat(specific).Concat(other).ToList(), Rules, [], Start, InterludeSeason.Halloween, 7).Select(item => item.Id));
        Assert.Empty(CommercialBreakPlanner.Plan(other, Rules, [], Start, InterludeSeason.Halloween, 7));
    }

    [Fact]
    public void SeriesClipsFallBackToGenericWhenUnavailable()
    {
        var specific = Clips(InterludeSeason.AllYear, 10);
        specific.ForEach(item => item.Assignment.SeriesId = 7);
        specific[0].Clip.DurationSeconds = 100;
        specific[2].Clip.ApprovedForBroadcast = false;
        var lastUse = new Dictionary<int, DateTime> { [11] = Start };
        Assert.Equal(new[] { 1, 2, 3 }, CommercialBreakPlanner.Plan(
            Clips(InterludeSeason.AllYear, 1).Concat(specific).ToList(), Rules, lastUse, Start, InterludeSeason.AllYear, 7).Select(item => item.Id));
    }

    [Fact]
    public void ProgramIntroUsesUpcomingSeriesWithoutMixingBreakBumpers()
    {
        var clips = Clips(InterludeSeason.AllYear, 1);
        var generic = new BroadcastClip(new() { Role = BreakRole.ProgramIntro, Weight = 1 },
            new() { Id = 10, Kind = InterludeKind.Bumper, DurationSeconds = 10, ApprovedForBroadcast = true });
        var specific = new BroadcastClip(new() { Role = BreakRole.ProgramIntro, SeriesId = 7, Weight = 1, MinimumGapSeconds = 60 },
            new() { Id = 11, Kind = InterludeKind.Bumper, DurationSeconds = 10, ApprovedForBroadcast = true });
        clips.AddRange([generic, specific]);
        Assert.Equal(11, CommercialBreakPlanner.ProgramIntro(clips, [], Start, InterludeSeason.AllYear, 7)?.Id);
        Assert.Equal(10, CommercialBreakPlanner.ProgramIntro(clips, [], Start, InterludeSeason.AllYear, 8)?.Id);
        Assert.Equal(10, CommercialBreakPlanner.ProgramIntro(clips, new() { [11] = Start }, Start, InterludeSeason.AllYear, 7)?.Id);
        Assert.Null(CommercialBreakPlanner.ProgramIntro(Clips(InterludeSeason.AllYear, 1), [], Start, InterludeSeason.AllYear, 7));
    }
}
