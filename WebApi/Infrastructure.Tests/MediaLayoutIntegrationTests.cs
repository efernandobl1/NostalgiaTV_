using ApplicationCore.DTOs.Channel;
using ApplicationCore.DTOs.ChannelEra;
using ApplicationCore.DTOs.Series;
using ApplicationCore.Interfaces;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Infrastructure.Services.Media;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using WebApi.Controllers;
using Xunit;

namespace Infrastructure.Tests;

public class MediaLayoutIntegrationTests
{
    [SqlMediaFact]
    public async Task CreatingAndEditingContentKeepsFilesInTheirEntityFolders()
    {
        var database = "NostalgiaTV_LayoutTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = database };
        var directory = Directory.CreateTempSubdirectory("nostalgia-layout-sql-test-");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = connection.ConnectionString,
            ["MediaSettings:BasePath"] = directory.FullName,
            ["FFmpeg:BinaryFolder"] = "",
            ["FileUpload:MaxFileSizeMB"] = "1",
            ["FileUpload:AllowedExtensions:0"] = ".webp"
        }).Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration);
        services.AddSignalR();
        services.AddInfrastructure(configuration);
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
        try
        {
            await context.Database.MigrateAsync();
            using var image = new MemoryStream([1, 2, 3]);
            var upload = new FormFile(image, 0, image.Length, "logo", "cover.webp");
            var seriesService = scope.ServiceProvider.GetRequiredService<ISeriesService>();
            var series = await seriesService.CreateAsync(new SeriesRequest { Name = "Retro", Seasons = 1, Logo = upload });
            Assert.EndsWith($"Retro-{series.Id}", series.FolderPath);
            Assert.StartsWith($"/uploads/series/Retro-{series.Id}/", series.LogoPath);
            var originalFolder = series.FolderPath;
            var updated = await seriesService.UpdateAsync(series.Id, new SeriesRequest { Name = "Renamed", Seasons = 2, Logo = upload });
            Assert.Equal(originalFolder, updated.FolderPath);
            Assert.True(Directory.Exists(Path.Combine(originalFolder!, "season 2")));
            Assert.StartsWith($"/uploads/series/Retro-{series.Id}/", updated.LogoPath);

            var probe = provider.GetRequiredService<MediaProbe>();
            var source = Path.Combine(directory.FullName, "test-upload.mp4");
            await provider.GetRequiredService<MediaProcessRunner>().RunAsync(probe.Binary("ffmpeg"),
                ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=160x120:rate=25", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", source],
                TimeSpan.FromSeconds(30), CancellationToken.None);
            await using var video = File.OpenRead(source);
            var result = await seriesService.UploadEpisodeFilesAsync(series.Id, new SeriesUploadRequest {
                Season = 1, Files = [new FormFile(video, 0, video.Length, "files", "Retro S01E01 - Upload.mp4")] });
            Assert.True(result.Single().Success);
            // No worker or two-minute waiting period is necessary for a compatible dashboard upload.
            Assert.Single(await seriesService.ScanFolderAsync(series.Id));
            var episode = await context.Episodes.AsNoTracking().SingleAsync(item => item.SeriesId == series.Id);
            File.Delete(scope.ServiceProvider.GetRequiredService<MediaLibraryService>().ResolveEpisodePath(episode.FilePath!));
            Assert.Empty(await seriesService.ScanFolderAsync(series.Id));
            Assert.Single(await context.Episodes.AsNoTracking().Where(item => item.SeriesId == series.Id && !item.IsAvailable).ToListAsync());

            var channelService = scope.ServiceProvider.GetRequiredService<IChannelService>();
            var channel = await channelService.CreateAsync(new ChannelRequest { Name = "Retro TV", Logo = upload });
            Assert.StartsWith($"/uploads/channels/channel-{channel.Id}/", channel.LogoPath);
            var eraService = scope.ServiceProvider.GetRequiredService<IChannelEraService>();
            var era = await eraService.CreateAsync(channel.Id, new ChannelEraRequest { Name = "City" });
            Assert.EndsWith(Path.Combine($"channel-{channel.Id}", "eras", $"era-{era.Id}"), era.FolderPath);
            Assert.False(Directory.Exists(Path.Combine(era.FolderPath!, "bumpers")));

            var now = DateTime.UtcNow;
            var historical = new ScheduledProgram { ChannelEraId = era.Id, EpisodeId = episode.Id, GeneratedAtUtc = now.AddHours(-2) };
            var future = new ScheduledProgram { ChannelEraId = era.Id, EpisodeId = episode.Id, GeneratedAtUtc = now };
            context.ScheduledPlaybackSegments.AddRange(
                new ScheduledPlaybackSegment { ScheduledProgram = historical, Sequence = 1, StartsAtUtc = now.AddHours(-2), EndsAtUtc = now.AddHours(-1), MediaStartSecond = 0, MediaEndSecond = 2 },
                new ScheduledPlaybackSegment { ScheduledProgram = future, Sequence = 1, StartsAtUtc = now.AddMinutes(-1), EndsAtUtc = now.AddMinutes(5), MediaStartSecond = 0, MediaEndSecond = 2 });
            await context.SaveChangesAsync();
            var schedules = new ChannelScheduleService(context, NullLogger<ChannelScheduleService>.Instance);
            await schedules.EnsureScheduleGeneratedAsync(channel.Id, now.AddHours(24));
            Assert.True(await context.ScheduledPrograms.AnyAsync(item => item.Id == historical.Id));
            Assert.False(await context.ScheduledPrograms.AnyAsync(item => item.Id == future.Id));
            Assert.True(await context.Episodes.AnyAsync(item => item.Id == episode.Id));

            var storageResult = Assert.IsType<OkObjectResult>(await new DashboardController(context)
                .GetStorage(provider.GetRequiredService<MediaStorageMeter>(), CancellationToken.None));
            using var storageJson = JsonDocument.Parse(JsonSerializer.Serialize(storageResult.Value));
            var seriesStorage = storageJson.RootElement.GetProperty("Series").EnumerateArray().Single();
            Assert.Equal(0, seriesStorage.GetProperty("EpisodeCount").GetInt32());
            Assert.Equal(1, seriesStorage.GetProperty("MissingEpisodeCount").GetInt32());
            Assert.True(seriesStorage.GetProperty("SizeBytes").GetInt64() > 0);
        }
        finally
        {
            if (!context.Database.GetDbConnection().Database.StartsWith("NostalgiaTV_LayoutTest_", StringComparison.Ordinal))
                throw new InvalidOperationException("Refusing to remove an unrelated database.");
            await context.Database.EnsureDeletedAsync();
            directory.Delete(recursive: true);
        }
    }
}
