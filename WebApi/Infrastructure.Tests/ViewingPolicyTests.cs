using ApplicationCore.Entities;
using Infrastructure.Services.Media;
using Infrastructure.Services.Viewing;
using Xunit;

namespace Infrastructure.Tests;

public class ViewingPolicyTests
{
    [Theory]
    [InlineData("2026-10-07T05:59:59Z", 1)]
    [InlineData("2026-10-07T06:00:00Z", 4)]
    [InlineData("2026-10-07T10:59:59Z", 4)]
    [InlineData("2026-10-07T11:00:00Z", 1)]
    public void GuatemalaNightWindowIncludesMidnightAndExcludesFiveAm(string time, int cores)
    {
        var policy = new MediaResourcePolicy { DayCores = 1, NightCores = 4 };
        Assert.Equal(cores, MediaCpuGovernor.SelectCores(policy, DateTimeOffset.Parse(time), 4));
    }

    [Fact]
    public void CpuPolicyNeverExceedsTheContainerCeiling()
    {
        var policy = new MediaResourcePolicy { NightCores = 4 };
        Assert.Equal(1, MediaCpuGovernor.SelectCores(policy, DateTimeOffset.Parse("2026-10-07T07:00:00Z"), 1));
        policy.NightEnabled = false;
        Assert.Equal(1, MediaCpuGovernor.SelectCores(policy, DateTimeOffset.Parse("2026-10-07T07:00:00Z"), 4));
        policy.DayCores = 4;
        Assert.Equal(2, MediaCpuGovernor.SelectCores(policy, DateTimeOffset.Parse("2026-10-07T17:00:00Z"), 4));
    }

    [Fact]
    public void AWindowCanCrossMidnight()
    {
        var policy = new MediaResourcePolicy { NightStartMinute = 1380, NightEndMinute = 300, TimeZoneId = "UTC" };
        Assert.Equal(3, MediaCpuGovernor.SelectCores(policy, DateTimeOffset.Parse("2026-10-07T23:30:00Z"), 4));
        Assert.Equal(3, MediaCpuGovernor.SelectCores(policy, DateTimeOffset.Parse("2026-10-07T02:30:00Z"), 4));
        Assert.Equal(1, MediaCpuGovernor.SelectCores(policy, DateTimeOffset.Parse("2026-10-07T06:30:00Z"), 4));
    }

    [Fact]
    public void SeekingAndReplayDoNotCountAsWatchingAnEntireEpisode()
    {
        Assert.False(WatchCoverage.Completed([(0, 5), (99, 100)], 100));
        Assert.False(WatchCoverage.Completed([(0, 30), (0, 30), (0, 30), (0, 30)], 100));
        Assert.True(WatchCoverage.Completed([(0, 30), (25, 60), (60, 95)], 100));
        Assert.False(WatchCoverage.Completed([(0, 95)], double.NaN));
    }
}
