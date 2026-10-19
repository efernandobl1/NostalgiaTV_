using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Infrastructure.Media;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Infrastructure.Tests;

public class InterludeScanIntegrationTests
{
    /// <summary>The v1 "scan the era folder for bumpers" flow on the v2 interlude library and media worker.</summary>
    [SqlFact]
    public async Task EraFolderScanImportsBumpersAndConvertsIncompatibleOnes()
    {
        await using var server = await TestServer.StartAsync();
        var channel = await server.RunAsync<IChannelRepository, ChannelDetail>(channels =>
            channels.CreateAsync(new("Canal Bumpers", null, new DateTime(1990, 1, 1), null), null));
        var era = await server.RunAsync<IChannelRepository, EraItem>(channels =>
            channels.CreateEraAsync(channel.Id, new("Era de prueba", null, new DateTime(1990, 1, 1), null)));
        var folder = Path.Combine(server.Media.FullName, MediaStorageLayout.EraFolder(channel.Id, era.Id));
        var old = DateTime.UtcNow.AddMinutes(-10);
        foreach (var (name, compatible) in new[] { ("Intro.mp4", true), ("bumpers/Ya viene.mp4", true), ("bumpers/Viejo.mkv", false) })
        {
            var path = Path.Combine(folder, name);
            await TestServer.WriteVideoAsync(path, 3, compatible);
            File.SetLastWriteTimeUtc(path, old);
        }
        // Still uploading: left for a later scan.
        await TestServer.WriteVideoAsync(Path.Combine(folder, "Subiendo.mp4"), 3);
        Task<EraFolderScan> Scan() => server.RunAsync<IInterludeRepository, EraFolderScan>(interludes =>
            interludes.ScanEraFolderAsync(channel.Id, era.Id, CancellationToken.None));

        var scan = await Scan();
        Assert.Equal((2, 1, 1), (scan.Imported, scan.Converting, scan.Skipped));
        Assert.Equal($"/uploads/{MediaStorageLayout.EraFolder(channel.Id, era.Id)}", scan.Folder);
        var assigned = await server.RunAsync<IChannelRepository, IReadOnlyList<EraInterludeItem>>(channels => channels.ListEraInterludesAsync(channel.Id, era.Id));
        Assert.Equal(["Intro", "Ya viene"], assigned.Select(item => item.Title).Order());
        Assert.All(assigned, item =>
        {
            Assert.Equal((InterludeKind.Bumper, BumperType.Generic, true, (int?)null), (item.Kind, item.BumperType, item.ApprovedForBroadcast, item.SeriesId));
            Assert.Equal((3, 900), (item.Weight, item.MinimumGapSeconds));
        });

        // Scanning again changes nothing while the conversion is pending.
        scan = await Scan();
        Assert.Equal((0, 1, 3), (scan.Imported, scan.Converting, scan.Skipped));

        // The transcode worker converts the era's file; the next scan imports the web copy, not the original.
        await server.RunAsync<IMediaRepository>(async media =>
        {
            await media.SetWorkerAsync(MediaWorkers.Transcode, true);
            await media.RunWorkerCycleAsync(MediaWorkers.Transcode, new MediaWorkerMemory(), CancellationToken.None);
        });
        var job = await server.DbAsync(context => context.MediaProcessingJobs.SingleAsync());
        Assert.Equal((MediaJobStatus.Completed, (int?)era.Id, (int?)null), (job.Status, job.ChannelEraId, job.SeriesId));
        var status = await server.RunAsync<IMediaRepository, MediaStatus>(media => media.StatusAsync(new("all", "all")));
        Assert.Equal("Canal Bumpers · Era de prueba", Assert.Single(status.Jobs).SeriesName);
        scan = await Scan();
        Assert.Equal((1, 0), (scan.Imported, scan.Converting));
        var converted = await server.DbAsync(context => context.Interludes.SingleAsync(item => item.Title == "Viejo"));
        Assert.Equal("/uploads/" + job.OutputPath, converted.FilePath);

        // A bumper removed from the library is not brought back.
        await server.RunAsync<IInterludeRepository>(interludes => interludes.DeleteAsync(converted.Id));
        scan = await Scan();
        Assert.Equal(0, scan.Imported);
        Assert.Equal(3, await server.DbAsync(context => context.Interludes.IgnoreQueryFilters().CountAsync()));

        await Assert.ThrowsAsync<NotFoundException>(() => server.RunAsync<IInterludeRepository, EraFolderScan>(interludes =>
            interludes.ScanEraFolderAsync(channel.Id + 1, era.Id, CancellationToken.None)));
    }

    /// <summary>Eras migrated from v1 keep their absolute folder; one outside the media library is refused.</summary>
    [SqlFact]
    public async Task EraFolderMustBeInsideTheLibrary()
    {
        await using var server = await TestServer.StartAsync();
        var channel = await server.RunAsync<IChannelRepository, ChannelDetail>(channels =>
            channels.CreateAsync(new("Canal v1", null, new DateTime(1990, 1, 1), null), null));
        var era = await server.RunAsync<IChannelRepository, EraItem>(channels =>
            channels.CreateEraAsync(channel.Id, new("Era v1", null, new DateTime(1990, 1, 1), null)));
        var legacy = Path.Combine(server.Media.FullName, "channels", "Canal v1", "Era v1");
        await TestServer.WriteVideoAsync(Path.Combine(legacy, "bumpers", "bumper_000.mp4"), 2);
        File.SetLastWriteTimeUtc(Path.Combine(legacy, "bumpers", "bumper_000.mp4"), DateTime.UtcNow.AddMinutes(-10));
        await server.DbAsync(context => context.ChannelEras.Where(item => item.Id == era.Id)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.FolderPath, legacy)));

        var scan = await server.RunAsync<IInterludeRepository, EraFolderScan>(interludes =>
            interludes.ScanEraFolderAsync(channel.Id, era.Id, CancellationToken.None));
        Assert.Equal(("/uploads/channels/Canal v1/Era v1", 1), (scan.Folder, scan.Imported));
        Assert.Equal("bumper 000", await server.DbAsync(context => context.Interludes.Select(item => item.Title).SingleAsync()));

        await server.DbAsync(context => context.ChannelEras.Where(item => item.Id == era.Id)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.FolderPath, Path.GetTempPath())));
        await Assert.ThrowsAsync<BadRequestException>(() => server.RunAsync<IInterludeRepository, EraFolderScan>(interludes =>
            interludes.ScanEraFolderAsync(channel.Id, era.Id, CancellationToken.None)));
    }
}
