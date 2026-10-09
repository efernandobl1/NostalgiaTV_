using System.IO.Compression;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services.Media;
using Infrastructure.Services.Packages;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Infrastructure.Tests;

public class ChannelPackageIntegrationTests
{
    [SqlMediaFact]
    public async Task DirectUploadUsesFileNameAndPackagePermissionDoesNotChangeLocalRights()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL"))
        { InitialCatalog = "NostalgiaTV_PackageTest_" + Guid.NewGuid().ToString("N") };
        var directory = Directory.CreateTempSubdirectory("nostalgia-upload-test-");
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["FFmpeg:BinaryFolder"] = Environment.GetEnvironmentVariable("FFMPEG_BINARY_FOLDER") ?? "" }).Build();
        var runner = new MediaProcessRunner();
        var probe = new MediaProbe(runner, config);
        var settings = Options.Create(new MediaSettings { BasePath = directory.FullName });
        var service = new ChannelPackageService(context, settings, probe, runner);
        try
        {
            await context.Database.MigrateAsync();
            var input = Path.Combine(directory.FullName, "input.mp4");
            await runner.RunAsync(probe.Binary("ffmpeg"), ["-v", "error", "-f", "lavfi", "-i", "color=size=160x120:rate=25",
                "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", input], TimeSpan.FromSeconds(30), default);
            FFMpegCore.GlobalFFOptions.Configure(new FFMpegCore.FFOptions { BinaryFolder = config["FFmpeg:BinaryFolder"]! });
            await using var file = File.OpenRead(input);
            var controller = new WebApi.Controllers.RetroBroadcastController(context, null!, null!, settings);
            var response = Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(await controller.UploadInterlude(
                new WebApi.Controllers.InterludeUploadRequest {
                    File = new Microsoft.AspNetCore.Http.FormFile(file, 0, file.Length, "file", "City opener.mp4")
                }, probe, default));
            var clip = Assert.IsType<Interlude>(response.Value);
            Assert.Equal("City opener", clip.Title);
            Assert.False(clip.RedistributionAllowed);
            Assert.False(clip.ApprovedForBroadcast);
            Assert.Null(clip.License);
            var channel = new Channel { Name = "Cartoon Network", StartDate = new(2004, 1, 1) };
            context.Channels.Add(channel); await context.SaveChangesAsync();
            var era = new ChannelEra { ChannelId = channel.Id, Name = "City", StartDate = channel.StartDate };
            context.ChannelEras.Add(era); await context.SaveChangesAsync();
            context.ChannelEraInterludes.Add(new() { ChannelEraId = era.Id, InterludeId = clip.Id, Role = BreakRole.BreakOpener, Weight = 1 });
            await context.SaveChangesAsync();
            var privateExport = await service.ExportAsync(channel.Id, true, default, "  ");
            await using (var stream = File.OpenRead(privateExport))
                Assert.Empty((await service.PreviewAsync(stream, default)).Manifest.Clips);
            Directory.Delete(Path.GetDirectoryName(privateExport)!, true);
            const string permission = "Permission provided by the rights holder for this package";
            var sharedExport = await service.ExportAsync(channel.Id, true, default, permission);
            await using (var stream = File.OpenRead(sharedExport))
                Assert.Equal(permission, (await service.PreviewAsync(stream, default)).Manifest.Clips.Single().License);
            Assert.False((await context.Interludes.AsNoTracking().SingleAsync()).RedistributionAllowed);
            Assert.Null((await context.Interludes.AsNoTracking().SingleAsync()).License);
        }
        finally { await context.Database.EnsureDeletedAsync(); directory.Delete(true); }
    }
    [SqlMediaFact]
    public async Task MigrationPreservesExistingChannelsAndKeepsExistingClipsPrivate()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL"))
        { InitialCatalog = "NostalgiaTV_PackageMigrationTest_" + Guid.NewGuid().ToString("N") };
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        try
        {
            var previous = context.Database.GetMigrations().TakeWhile(value => !value.EndsWith("_AddChannelPackagesAndClipSharing", StringComparison.Ordinal)).Last();
            await context.GetService<IMigrator>().MigrateAsync(previous);
            await context.Database.ExecuteSqlRawAsync("INSERT INTO Channels (Name, StartDate) VALUES ('Existing channel one', '20040101'), ('Existing channel two', '20050101')");
            await context.Database.ExecuteSqlRawAsync("INSERT INTO Interludes (Kind, Season, Title, FilePath, DurationSeconds, ApprovedForBroadcast) VALUES ('Bumper', 'Halloween', 'Existing bumper', '/uploads/existing.mp4', 5, 1)");
            await context.Database.MigrateAsync();
            var channels = await context.Channels.ToListAsync();
            Assert.Equal(2, channels.Count);
            Assert.Equal(2, channels.Select(value => value.ShareId).Distinct().Count());
            Assert.DoesNotContain(channels, value => value.ShareId == Guid.Empty);
            var clip = await context.Interludes.SingleAsync();
            Assert.False(clip.RedistributionAllowed);
            Assert.True(clip.ApprovedForBroadcast);
            Assert.Equal(InterludeSeason.Halloween, clip.Season);
        }
        finally { await context.Database.EnsureDeletedAsync(); }
    }

    [SqlMediaFact]
    public async Task PackageRoundTripPreservesSeasonSelectionsBreakRulesAndPendingSeasonalClips()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL"))
        { InitialCatalog = "NostalgiaTV_PackageTest_" + Guid.NewGuid().ToString("N") };
        var directory = Directory.CreateTempSubdirectory("nostalgia-package-test-");
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["FFmpeg:BinaryFolder"] = Environment.GetEnvironmentVariable("FFMPEG_BINARY_FOLDER") ?? "" }).Build();
        var runner = new MediaProcessRunner();
        var probe = new MediaProbe(runner, config);
        var service = new ChannelPackageService(context, Options.Create(new MediaSettings { BasePath = directory.FullName }), probe, runner);
        try
        {
            await context.Database.MigrateAsync();
            var series = new Series { Name = "Retro", Seasons = 3, StartDate = new(2000, 1, 1) };
            var channel = new Channel { Name = "City", StartDate = new(2004, 1, 1), Series = [series] };
            context.Channels.Add(channel);
            await context.SaveChangesAsync();
            var era = new ChannelEra { ChannelId = channel.Id, Name = "City era", StartDate = channel.StartDate };
            context.ChannelEras.Add(era); await context.SaveChangesAsync();
            context.ChannelEraSeries.Add(new() { ChannelEraId = era.Id, SeriesId = series.Id, HasSeasonFilter = true,
                SelectedSeasons = [new() { SeasonNumber = 1 }, new() { SeasonNumber = 3 }] });
            context.ChannelEraBreakRules.Add(new() { ChannelEraId = era.Id, MinimumAds = 1, MaximumAds = 2, MaximumBreakSeconds = 120 });
            context.ChannelEraSelections.Add(new() { ChannelId = channel.Id, ChannelEraId = era.Id, SelectedAtUtc = DateTime.UtcNow });
            var folder = Directory.CreateDirectory(Path.Combine(directory.FullName, "broadcast", "advertisements"));
            var file = Path.Combine(folder.FullName, "test.mp4");
            await runner.RunAsync(probe.Binary("ffmpeg"), ["-v", "error", "-f", "lavfi", "-i", "color=size=160x120:rate=25", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file], TimeSpan.FromSeconds(30), default);
            foreach (var season in new[] { InterludeSeason.Halloween, InterludeSeason.Christmas })
            {
                var clip = new Interlude { Title = season.ToString(), Kind = InterludeKind.Advertisement, Season = season,
                    FilePath = "/uploads/broadcast/advertisements/test.mp4", DurationSeconds = 1, ApprovedForBroadcast = true,
                    RedistributionAllowed = true, License = "CC0" };
                context.Interludes.Add(clip); await context.SaveChangesAsync();
                context.ChannelEraInterludes.Add(new() { ChannelEraId = era.Id, InterludeId = clip.Id, Role = BreakRole.Advertisement, Weight = 2, MinimumGapSeconds = 3600 });
            }
            await context.SaveChangesAsync();
            var metadataPath = await service.ExportAsync(channel.Id, false, default);
            await using (var stream = File.OpenRead(metadataPath))
            {
                var preview = await service.PreviewAsync(stream, default);
                Assert.Empty(preview.Manifest.Clips);
                Assert.Equal(2, preview.Manifest.ExcludedClips);
            }
            Directory.Delete(Path.GetDirectoryName(metadataPath)!, true);
            var path = await service.ExportAsync(channel.Id, true, default);
            var contractFixture = Environment.GetEnvironmentVariable("NOSTALGIA_PACKAGE_CONTRACT_EXPORT");
            if (!string.IsNullOrEmpty(contractFixture)) File.Copy(path, contractFixture, overwrite: true);
            channel.ShareId = Guid.NewGuid(); await context.SaveChangesAsync();
            // A local contract test can import the exact file downloaded from Community.
            var importPath = Environment.GetEnvironmentVariable("NOSTALGIA_PACKAGE_CONTRACT_IMPORT") ?? path;
            await using var input = File.OpenRead(importPath);
            var info = await service.PreviewAsync(input, default);
            Assert.False(info.AlreadyInstalled);
            Assert.Equal(series.Id, info.Series.Single().ExistingId);
            Assert.Equal(2, info.Manifest.Clips.Count);
            using (var corrupted = new MemoryStream(await File.ReadAllBytesAsync(importPath)))
            {
                // Rebuild with the same manifest and size but altered media bytes.
                using var altered = new MemoryStream();
                using (var sourceZip = new ZipArchive(corrupted))
                using (var targetZip = new ZipArchive(altered, ZipArchiveMode.Create, true))
                    foreach (var entry in sourceZip.Entries)
                    {
                        using var bytes = new MemoryStream();
                        using (var sourceEntry = entry.Open()) await sourceEntry.CopyToAsync(bytes);
                        var content = bytes.ToArray();
                        if (entry.FullName.EndsWith(".mp4")) content[^1] ^= 1;
                        using var destination = targetZip.CreateEntry(entry.FullName).Open();
                        await destination.WriteAsync(content);
                    }
                altered.Position = 0;
                await Assert.ThrowsAsync<InvalidDataException>(() => service.ImportAsync(altered, info.Fingerprint, default));
                Assert.Equal(1, await context.Channels.CountAsync());
                Assert.Equal(2, await context.Interludes.CountAsync());
            }
            input.Position = 0;
            var result = await service.ImportAsync(input, info.Fingerprint, default);
            Assert.Equal(0, result.NewSeries); Assert.Equal(1, result.ReusedSeries); Assert.Equal(2, result.ImportedClips);
            var importedEra = await context.ChannelEras.SingleAsync(value => value.ChannelId == result.ChannelId);
            var selectedSeasons = await context.ChannelEraSelectedSeasons.Where(value => value.ChannelEraId == importedEra.Id).OrderBy(value => value.SeasonNumber).Select(value => value.SeasonNumber).ToArrayAsync();
            Assert.Equal(new[] { 1, 3 }, selectedSeasons);
            var rules = await context.ChannelEraBreakRules.SingleAsync(value => value.ChannelEraId == importedEra.Id);
            Assert.Equal(2, rules.MaximumAds); Assert.Equal(120, rules.MaximumBreakSeconds);
            Assert.Equal(importedEra.Id, (await context.ChannelEraSelections.SingleAsync(value => value.ChannelId == result.ChannelId)).ChannelEraId);
            var importedClips = await (from link in context.ChannelEraInterludes join clip in context.Interludes on link.InterludeId equals clip.Id where link.ChannelEraId == importedEra.Id select clip).ToListAsync();
            Assert.Equal([InterludeSeason.Halloween, InterludeSeason.Christmas], importedClips.OrderBy(value => value.Season).Select(value => value.Season));
            Assert.All(importedClips, clip => { Assert.False(clip.ApprovedForBroadcast); Assert.Equal("CC0", clip.License); Assert.True(File.Exists(Path.Combine(directory.FullName, clip.FilePath[9..]))); });
            input.Position = 0;
            await Assert.ThrowsAsync<ChannelPackageConflictException>(() => service.ImportAsync(input, info.Fingerprint, default));
            input.Position = 0;
            await Assert.ThrowsAsync<InvalidDataException>(() => service.ImportAsync(input, "changed", default));
            Assert.Equal(2, await context.Channels.CountAsync());
            Assert.Equal(1, await context.Series.CountAsync());
            using var metadataOnly = new MemoryStream();
            using (var zip = new ZipArchive(metadataOnly, ZipArchiveMode.Create, true))
            using (var metadata = zip.CreateEntry("manifest.json").Open())
                await System.Text.Json.JsonSerializer.SerializeAsync(metadata, ChannelPackageArchiveTests.Sample(), ChannelPackageArchive.Json);
            metadataOnly.Position = 0;
            var missingSeries = await service.PreviewAsync(metadataOnly, default);
            Assert.Null(missingSeries.Series.Single().ExistingId);
            metadataOnly.Position = 0;
            var metadataResult = await service.ImportAsync(metadataOnly, missingSeries.Fingerprint, default);
            Assert.Equal(1, metadataResult.NewSeries);
            Assert.Equal(0, metadataResult.ImportedClips);
            Assert.Empty(await context.Episodes.ToListAsync());
            Assert.True(Directory.Exists((await context.Series.SingleAsync(value => value.Name == "Retro series")).FolderPath));
        }
        finally
        {
            await context.Database.EnsureDeletedAsync();
            directory.Delete(true);
        }
    }
}
