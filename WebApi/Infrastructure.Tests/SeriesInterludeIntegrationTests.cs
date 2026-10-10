using ApplicationCore.DTOs.ChannelEra;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Infrastructure.Services.Media;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Infrastructure.Tests;

public class SeriesInterludeIntegrationTests
{
    [SqlMediaFact]
    public async Task UpcomingPromosAndBreaksKeepTheSeriesContextAndResumeAtTheCut()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL"))
        { InitialCatalog = "NostalgiaTV_InterludeTest_" + Guid.NewGuid().ToString("N") };
        var directory = Directory.CreateTempSubdirectory("nostalgia-interlude-test-");
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        try
        {
            await context.Database.MigrateAsync();
            var file = Path.Combine(directory.FullName, "episode.mp4");
            var ffmpeg = Path.Combine(Environment.GetEnvironmentVariable("FFMPEG_BINARY_FOLDER") ?? "", OperatingSystem.IsWindows() ? "ffmpeg.exe" : "ffmpeg");
            await new MediaProcessRunner().RunAsync(ffmpeg,
                ["-v", "error", "-f", "lavfi", "-i", "color=size=160x120:rate=25", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", file],
                TimeSpan.FromSeconds(30), default);
            var series = new Series { Name = "Dexter", Seasons = 1 };
            var otherSeries = new Series { Name = "Other program", Seasons = 1 };
            var channel = new Channel { Name = "Cartoon City" };
            var type = await context.EpisodeTypes.FirstAsync();
            context.AddRange(series, otherSeries, channel);
            await context.SaveChangesAsync();
            var episode = new Episode { SeriesId = series.Id, EpisodeTypeId = type.Id, Season = 1, EpisodeNumber = 1, FilePath = file };
            var era = new ChannelEra { ChannelId = channel.Id, Name = "City" };
            var otherEra = new ChannelEra { ChannelId = channel.Id, Name = "Check It" };
            context.AddRange(episode, era, otherEra);
            await context.SaveChangesAsync();
            context.ChannelEraSeries.AddRange(
                new() { ChannelEraId = era.Id, SeriesId = series.Id },
                new() { ChannelEraId = era.Id, SeriesId = otherSeries.Id },
                new() { ChannelEraId = otherEra.Id, SeriesId = series.Id });
            context.ChannelEraSelections.Add(new() { ChannelId = channel.Id, ChannelEraId = era.Id });
            context.ChannelEraBreakRules.Add(new() { ChannelEraId = era.Id, MinimumAds = 1, MaximumAds = 1, MaximumBreakSeconds = 10 });
            context.EpisodeBreakPoints.Add(new() { EpisodeId = episode.Id, OffsetSeconds = 1 });
            await context.SaveChangesAsync();
            var expected = new List<int>();
            foreach (var role in Enum.GetValues<BreakRole>())
            {
                foreach (var scope in new (int Era, int? Series)[] { (era.Id, null), (era.Id, series.Id),
                    (era.Id, (int?)otherSeries.Id), (otherEra.Id, (int?)series.Id) })
                {
                    var clip = new Interlude { Title = role.ToString(), FilePath = file, DurationSeconds = 1,
                        Kind = role == BreakRole.Advertisement ? InterludeKind.Advertisement : InterludeKind.Bumper,
                        ApprovedForBroadcast = true };
                    context.Interludes.Add(clip);
                    await context.SaveChangesAsync();
                    context.ChannelEraInterludes.Add(new() { ChannelEraId = scope.Era, InterludeId = clip.Id,
                        SeriesId = scope.Series, Role = role, Weight = 1 });
                    if (scope.Era == era.Id && scope.Series == series.Id) expected.Add(clip.Id);
                }
            }
            await context.SaveChangesAsync();
            var schedule = new ChannelScheduleService(context, NullLogger<ChannelScheduleService>.Instance);
            await schedule.EnsureScheduleGeneratedAsync(channel.Id, DateTime.UtcNow.AddSeconds(5));
            var segments = await context.ScheduledPlaybackSegments.AsNoTracking().OrderBy(item => item.Sequence).ToListAsync();
            Assert.Equal(new[] { expected[3], (int?)null, expected[0], expected[1], expected[2], null }, segments.Select(item => item.InterludeId));
            Assert.Null(segments[0].ScheduledAdBreakId);
            Assert.Equal(segments[2].ScheduledAdBreakId, segments[4].ScheduledAdBreakId);
            Assert.Equal(0m, segments[1].MediaStartSecond);
            Assert.Equal(1m, segments[1].MediaEndSecond);
            Assert.Equal(1m, segments[5].MediaStartSecond);
            Assert.Equal(2m, segments[5].MediaEndSecond);
            for (var i = 1; i < segments.Count; i++) Assert.Equal(segments[i - 1].EndsAtUtc, segments[i].StartsAtUtc);

            // Updating seasons retains scoped clips; removing a series removes only its assignments.
            context.ChangeTracker.Clear();
            var eraService = new ChannelEraService(context, null!, Options.Create(new MediaSettings()));
            await eraService.AssignSeriesAsync(era.Id, new AssignSeriesToEraRequest {
                SeriesIds = [series.Id, otherSeries.Id], SeasonSelections = new() { [series.Id] = [1] } });
            Assert.Equal(4, await context.ChannelEraInterludes.CountAsync(item => item.ChannelEraId == era.Id && item.SeriesId == series.Id));
            context.ChangeTracker.Clear();
            await eraService.AssignSeriesAsync(era.Id, new AssignSeriesToEraRequest { SeriesIds = [otherSeries.Id] });
            Assert.False(await context.ChannelEraInterludes.AnyAsync(item => item.ChannelEraId == era.Id && item.SeriesId == series.Id));
            Assert.Equal(4, await context.ChannelEraInterludes.CountAsync(item => item.ChannelEraId == era.Id && item.SeriesId == null));
            Assert.Equal(4, await context.ChannelEraInterludes.CountAsync(item => item.ChannelEraId == otherEra.Id));
        }
        finally
        {
            if (!context.Database.GetDbConnection().Database.StartsWith("NostalgiaTV_InterludeTest_", StringComparison.Ordinal))
                throw new InvalidOperationException("Refusing to remove an unrelated database.");
            await context.Database.EnsureDeletedAsync();
            directory.Delete(recursive: true);
        }
    }
}
