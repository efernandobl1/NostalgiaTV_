using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.BackgroundServices;
using Infrastructure.Contexts;
using Infrastructure.Services.Media;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Infrastructure.Tests;

public class SqlMediaFactAttribute : FactAttribute
{
    public SqlMediaFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")))
            Skip = "Set NOSTALGIA_MEDIA_TEST_SQL to test against an isolated SQL Server database.";
    }
}

public class MediaWorkerIntegrationTests
{
    [SqlMediaFact]
    public async Task BothWorkersIndexOnlyValidatedOutputsAndPreserveExistingEpisodeMetadata()
    {
        var database = "NostalgiaTV_MediaTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = database };
        var directory = Directory.CreateTempSubdirectory("nostalgia-worker-test-");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["MediaSettings:BasePath"] = directory.FullName,
            ["FFmpeg:BinaryFolder"] = Environment.GetEnvironmentVariable("FFMPEG_BINARY_FOLDER") ?? "",
            ["MediaProcessing:StableAgeSeconds"] = "30"
        }).Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration)
            .AddDbContext<NostalgiaTVContext>(options => options.UseSqlServer(connection.ConnectionString))
            .AddMediaProcessing(configuration);
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
        try
        {
            await context.Database.MigrateAsync();
            Assert.False(await context.MediaWorkerStates.AnyAsync(worker => worker.Enabled));
            Assert.True(await context.Menus.AnyAsync(menu => menu.Url == "/dashboard/transcoding"));
            var folder = Directory.CreateDirectory(Path.Combine(directory.FullName, "series", "Retro", "season 1"));
            var source = Path.Combine(folder.FullName, "Retro S01E02 - Test.mkv");
            var probe = provider.GetRequiredService<MediaProbe>();
            await provider.GetRequiredService<MediaProcessRunner>().RunAsync(probe.Binary("ffmpeg"),
                ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=160x120:rate=25", "-t", "3", "-c:v", "ffv1", source], TimeSpan.FromSeconds(30), CancellationToken.None);
            File.SetLastWriteTimeUtc(source, DateTime.UtcNow.AddMinutes(-5));
            var series = new Series { Name = "Retro", FolderPath = folder.Parent!.FullName, Seasons = 1 };
            context.Series.Add(series);
            foreach (var worker in await context.MediaWorkerStates.ToListAsync()) worker.Enabled = true;
            await context.SaveChangesAsync();
            var index = new TestWorker("index", provider);
            var transcode = new TestWorker("transcode", provider);
            await index.Cycle(); await index.Cycle();
            Assert.False(await context.Episodes.AnyAsync(episode => episode.SeriesId == series.Id));
            Assert.True(await context.MediaProcessingJobs.AnyAsync(job => job.Worker == "index" && job.Status == "Skipped"));
            var existing = new Episode { SeriesId = series.Id, EpisodeTypeId = 1, Season = 1, EpisodeNumber = 2,
                Title = "Manually edited title", FilePath = "wwwroot/uploads/series/Retro/season 1/" + Path.GetFileName(source) };
            context.Episodes.Add(existing);
            await context.SaveChangesAsync();
            await transcode.Cycle(); await transcode.Cycle();
            var output = MediaFilePolicy.OutputPath(source);
            Assert.True(File.Exists(source)); Assert.True(File.Exists(output));
            File.SetLastWriteTimeUtc(output, DateTime.UtcNow.AddMinutes(-5));
            await index.Cycle(); await index.Cycle(); await index.Cycle();
            await context.Entry(existing).ReloadAsync();
            Assert.EndsWith(".mp4", existing.FilePath);
            Assert.Equal("Manually edited title", existing.Title);
            Assert.Equal(2, existing.EpisodeNumber);
            Assert.Equal(1, await context.Episodes.CountAsync(episode => episode.SeriesId == series.Id));
            Assert.True(await context.MediaProcessingJobs.AnyAsync(job => job.Worker == "index" && job.Status == "Completed"));
            var state = await context.MediaWorkerStates.SingleAsync(worker => worker.Id == "transcode");
            state.Enabled = false;
            await context.SaveChangesAsync();
            var count = await context.MediaProcessingJobs.CountAsync();
            await transcode.Cycle();
            Assert.Equal(count, await context.MediaProcessingJobs.CountAsync());
        }
        finally
        {
            // This test owns only its uniquely named disposable database and media directory.
            if (!context.Database.GetDbConnection().Database.StartsWith("NostalgiaTV_MediaTest_", StringComparison.Ordinal))
                throw new InvalidOperationException("Refusing to remove an unrelated database.");
            await context.Database.EnsureDeletedAsync();
            directory.Delete(recursive: true);
        }
    }

    private sealed class TestWorker(string worker, IServiceProvider provider) : MediaProcessingWorker(
        provider.GetRequiredService<IServiceScopeFactory>(), provider.GetRequiredService<IOptions<MediaProcessingSettings>>(), NullLogger.Instance)
    {
        protected override string Worker => worker;
        public Task Cycle() => RunCycleAsync(CancellationToken.None);
    }
}
