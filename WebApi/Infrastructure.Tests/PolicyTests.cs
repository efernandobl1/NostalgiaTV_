using ApplicationCore.Entities;
using ApplicationCore.Policies;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Infrastructure.Repositories;
using Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using WebApi.Controllers;
using Xunit;

namespace Infrastructure.Tests;

public class CommercialBreakPlannerTests
{
    private static readonly ChannelEraBreakRule Rule = new() { MinimumAds = 2, MaximumAds = 3, MaximumBreakSeconds = 180 };
    private static readonly DateTime Start = new(2026, 3, 1, 20, 0, 0, DateTimeKind.Utc);

    private static List<BroadcastClip> Library() =>
    [
        new(1, InterludeKind.Bumper, BumperType.ComingUp, InterludeSeason.AllYear, 5, 1, 0),
        new(2, InterludeKind.Bumper, BumperType.WeContinueWith, InterludeSeason.AllYear, 5, 1, 0),
        new(3, InterludeKind.Bumper, BumperType.Generic, InterludeSeason.AllYear, 4, 1, 0),
        new(10, InterludeKind.Advertisement, null, InterludeSeason.AllYear, 30, 1, 0),
        new(11, InterludeKind.Advertisement, null, InterludeSeason.AllYear, 30, 1, 0),
        new(12, InterludeKind.Advertisement, null, InterludeSeason.AllYear, 30, 1, 0),
    ];

    [Fact]
    public void BreakOpensWithComingUpAndClosesWithWeContinueWith()
    {
        for (var seed = 0; seed < 50; seed++)
        {
            var plan = CommercialBreakPlanner.Plan(Library(), Rule, [], Start, InterludeSeason.AllYear, 7, new Random(seed));
            Assert.InRange(plan.Count, 4, 5);
            Assert.Equal(BumperType.ComingUp, plan[0].BumperType);
            Assert.Equal(BumperType.WeContinueWith, plan[^1].BumperType);
            Assert.All(plan[1..^1], clip => Assert.Equal(InterludeKind.Advertisement, clip.Kind));
            Assert.True(plan.Sum(clip => clip.DurationSeconds) <= Rule.MaximumBreakSeconds);
        }
    }

    [Fact]
    public void GenericBumpersFillMissingRolesAndNoRuleMeansNoBreak()
    {
        var generic = Library().Where(clip => clip.BumperType is null or BumperType.Generic).ToList();
        var plan = CommercialBreakPlanner.Plan(generic, Rule, [], Start, InterludeSeason.AllYear, 7, new Random(1));
        Assert.Equal(BumperType.Generic, plan[0].BumperType);
        Assert.Equal(BumperType.Generic, plan[^1].BumperType);
        Assert.Empty(CommercialBreakPlanner.Plan(Library(), null, [], Start, InterludeSeason.AllYear, 7, new Random(1)));
    }

    [Fact]
    public void BreakIsSkippedWhenTheMinimumAdsDoNotFit()
    {
        var tight = new ChannelEraBreakRule { MinimumAds = 3, MaximumAds = 3, MaximumBreakSeconds = 60 };
        Assert.Empty(CommercialBreakPlanner.Plan(Library(), tight, [], Start, InterludeSeason.AllYear, 7, new Random(1)));
    }

    [Fact]
    public void SeriesScopedAndSeasonalClipsArePreferredAndForeignSeriesAreIgnored()
    {
        var clips = Library();
        clips.Add(new(20, InterludeKind.Bumper, BumperType.ComingUp, InterludeSeason.AllYear, 5, 1, 0, SeriesId: 7));
        clips.Add(new(21, InterludeKind.Bumper, BumperType.WeContinueWith, InterludeSeason.Halloween, 5, 1, 0));
        clips.Add(new(22, InterludeKind.Bumper, BumperType.ComingUp, InterludeSeason.AllYear, 5, 100, 0, SeriesId: 8));
        var plan = CommercialBreakPlanner.Plan(clips, Rule, [], Start, InterludeSeason.Halloween, 7, new Random(3));
        Assert.Equal(20, plan[0].InterludeId);
        Assert.Equal(21, plan[^1].InterludeId);
        Assert.DoesNotContain(plan, clip => clip.InterludeId == 22);
        Assert.Null(CommercialBreakPlanner.ProgramIntro(clips.Where(clip => clip.InterludeId != 3).ToList(), [], Start, InterludeSeason.AllYear, 7, new Random(1)));
        Assert.Equal(3, CommercialBreakPlanner.ProgramIntro(clips, [], Start, InterludeSeason.AllYear, 7, new Random(1))!.InterludeId);
    }

    [Fact]
    public void MinimumGapKeepsAClipOffAir()
    {
        var clips = Library().Select(clip => clip with { MinimumGapSeconds = 3600 }).ToList();
        // Every opening bumper (specific and generic) aired ten minutes ago.
        var lastUse = new Dictionary<int, DateTime> { [1] = Start.AddMinutes(-10), [3] = Start.AddMinutes(-10) };
        Assert.Empty(CommercialBreakPlanner.Plan(clips, Rule, lastUse, Start, InterludeSeason.AllYear, 7, new Random(1)));
    }
}

public class SchedulingPolicyTests
{
    private static SchedulingRules Rules(bool seasonal = true) => new("America/Guatemala", seasonal, seasonal, 24, 5, 2, 2, 2);

    [Fact]
    public void SeasonsFollowThePlatformLocalCalendar()
    {
        // 1 Oct 03:00 UTC is still 30 Sep in Guatemala (UTC-6).
        Assert.Equal(InterludeSeason.AllYear, SeasonalProgrammingPolicy.SeasonAt(new(2026, 10, 1, 3, 0, 0, DateTimeKind.Utc), "America/Guatemala"));
        Assert.Equal(InterludeSeason.Halloween, SeasonalProgrammingPolicy.SeasonAt(new(2026, 10, 1, 7, 0, 0, DateTimeKind.Utc), "America/Guatemala"));
        Assert.Equal(InterludeSeason.Christmas, SeasonalProgrammingPolicy.SeasonAt(new(2026, 12, 24, 7, 0, 0, DateTimeKind.Utc), "America/Guatemala"));
        Assert.Equal(InterludeSeason.AllYear, SeasonalProgrammingPolicy.InterludeSeasonAt(new(2026, 10, 15, 7, 0, 0, DateTimeKind.Utc), Rules(false)));
    }

    [Fact]
    public void SeasonalSpecialsArePreferredOnlyWhenEnabled()
    {
        var october = new DateTime(2026, 10, 15, 18, 0, 0, DateTimeKind.Utc);
        var preference = SeasonalProgrammingPolicy.EpisodePreferenceAt(october, Rules())!;
        Assert.True(preference(new(1, 1, SeedIds.HalloweenSpecial, "/uploads/a.mp4")));
        Assert.False(preference(new(2, 1, SeedIds.ChristmasSpecial, "/uploads/b.mp4")));
        Assert.Null(SeasonalProgrammingPolicy.EpisodePreferenceAt(october, Rules(false)));
        Assert.True(SeasonalProgrammingPolicy.IsSpecial(SeedIds.Special));
        Assert.False(SeasonalProgrammingPolicy.IsSpecial(SeedIds.Movie));
    }

    [Fact]
    public void SelectorAirsEveryEpisodeOncePerCycleAndNeverTwiceInARow()
    {
        var episodes = Enumerable.Range(1, 5).Select(id => new EpisodeCandidate(id, 1, SeedIds.RegularEpisode, $"/uploads/{id}.mp4")).ToList();
        var selector = new ChannelEpisodeSelector([]);
        var time = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
        var aired = new List<int>();
        for (var index = 0; index < 15; index++)
        {
            aired.Add(selector.Choose(episodes, time, TimeSpan.Zero, new Random(index)).Id);
            time = time.AddMinutes(30);
        }
        foreach (var cycle in aired.Chunk(5)) Assert.Equal(5, cycle.Distinct().Count());
        Assert.All(aired.Zip(aired.Skip(1)), pair => Assert.NotEqual(pair.First, pair.Second));
        Assert.Equal(3, selector.ShuffleCycle);
    }

    [Fact]
    public void CoverageMergesRangesAndCompletesAtNinetyFivePercent()
    {
        var merged = WatchCoverage.Merge([(0m, 10m), (10.2m, 20m), (50m, 60m), (5m, 8m)]);
        Assert.Equal([(0m, 20m), (50m, 60m)], merged);
        Assert.False(WatchCoverage.Completed([(0m, 94m)], 100m));
        Assert.True(WatchCoverage.Completed([(0m, 50m), (50m, 95m)], 100m));
    }
}

public class SecurityPolicyTests
{
    [Fact]
    public void PasswordsUseArgon2AndUserCodesAreNormalized()
    {
        var hash = PasswordHasher.Hash("correct horse battery");
        Assert.True(PasswordHasher.Verify("correct horse battery", hash));
        Assert.False(PasswordHasher.Verify("wrong", hash));
        Assert.False(PasswordHasher.IsUsable("!external-only"));
        Assert.False(PasswordHasher.Verify("anything", "!bootstrap-required"));

        var code = Secrets.NewUserCode();
        Assert.Equal(code, Secrets.NormalizeUserCode(Secrets.FormatUserCode(code).ToLowerInvariant()));
        Assert.Null(Secrets.NormalizeUserCode("ABC-DEF-GHI-JK1"));
        Assert.Equal("Dispositivo", Secrets.SafeName(" \u0007 "));
        Assert.Equal(64, Secrets.Hash("x").Length);
    }

    [Theory]
    [InlineData("/", "/")]
    [InlineData("/tv", "/tv")]
    [InlineData("/tv?code=ABC-DEF-GHJ-KLM", "/tv?code=ABC-DEF-GHJ-KLM")]
    [InlineData("/vincular?code=ABC-DEF-GHJ-KLM", "/vincular?code=ABC-DEF-GHJ-KLM")]
    [InlineData("/vincular?code=ABC&next=//evil", "/")]
    [InlineData("https://evil.example/", "/")]
    [InlineData("//evil.example", "/")]
    [InlineData("/admin", "/")]
    public void LoginRedirectsOnlyToKnownPages(string requested, string expected) =>
        Assert.Equal(expected, AuthController.SafeDestination(requested));

    [Fact]
    public void LibraryFoldersMapToSeasonsAndEpisodeTypes()
    {
        Assert.Equal((3, SeedIds.RegularEpisode), MediaFilePolicy.FolderType("Season 3"));
        Assert.Equal((0, SeedIds.Special), MediaFilePolicy.FolderType("specials"));
        Assert.Equal((0, SeedIds.Movie), MediaFilePolicy.FolderType("movies"));
        Assert.Null(MediaFilePolicy.FolderType("season 0"));
        Assert.Null(MediaFilePolicy.FolderType("extras"));
    }

    [Theory]
    [InlineData("B.E T2E05A.1080p Lat.Www.Serieslandia.Com.web.mp4", 5, "A")]
    [InlineData("B.E T2E05B.1080p Lat.Www.Serieslandia.Com.web.mp4", 5, "B")]
    [InlineData("Padrinos 2x05b - Otra.mp4", 5, "B")]
    [InlineData("S02E05a.mkv", 5, "A")]
    [InlineData("05B - Segunda parte.mp4", 5, "B")]
    [InlineData("B.E T2E07 (1).1080p Lat.Www.Serieslandia.Com.mp4", 7, null)]
    [InlineData("01x02 Expediente X (1080p)[ReyBrena].mp4", 2, null)]
    [InlineData("Los Simpsons 5x20 - El niño que sabia demasiado.web.mp4", 20, null)]
    [InlineData("S01E05Bart.mp4", 5, null)]
    public void EpisodeFilesDetectSplitParts(string file, int number, string? part)
    {
        var parsed = MediaFilePolicy.EpisodeFile(file);
        Assert.Equal(number, parsed.Number);
        Assert.Equal(part, parsed.Part);
    }

    [Fact]
    public void FailedConversionsShowTheFfmpegCause()
    {
        var ffmpeg = new IOException("Media process failed (234): [mp4 @ 0x1] Starting second pass\n" +
            "[aost#0:1/aac @ 0x2] Error submitting a packet to the muxer: Invalid argument\n");
        Assert.EndsWith("Error submitting a packet to the muxer: Invalid argument", MediaRepository.FailureMessage(ffmpeg));
        Assert.StartsWith("No hay espacio", MediaRepository.FailureMessage(new IOException("Free space reserve reached; original preserved.")));
        Assert.True(MediaRepository.FailureMessage(new IOException("Media process failed (1): " + new string('x', 900))).Length <= 500);
    }
}

public class SchemaTests
{
    /// <summary>
    /// InitialCreate plus the migrations added since v2 went live must describe the current model exactly.
    /// </summary>
    [Fact]
    public void MigrationMatchesTheModel()
    {
        using var context = new DesignTimeContextFactory().CreateDbContext([]);
        Assert.False(context.Database.HasPendingModelChanges());
        Assert.EndsWith("_InitialCreate", context.Database.GetMigrations().First());
        Assert.Equal(42, context.Model.GetEntityTypes().Count());
    }
}
