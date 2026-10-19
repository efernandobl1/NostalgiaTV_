using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Infrastructure.Tests;

public class BroadcastIntegrationTests
{
    /// <summary>Builds a channel from scratch and checks the generated retro schedule end to end.</summary>
    [SqlFact]
    public async Task ChannelAirsItsEraLineupWithRetroCommercialBreaks()
    {
        await using var server = await TestServer.StartAsync();
        var world = await BroadcastWorld.CreateAsync(server);
        var now = DateTime.UtcNow;

        var programs = await server.RunAsync<IScheduleRepository, IReadOnlyList<ScheduleProgram>>(schedule =>
            schedule.GetProgramsAsync(world.ChannelId, now.AddMinutes(-30), now.AddHours(24)));
        Assert.True(programs.Count >= 24 * 60 / 11, $"Only {programs.Count} programs for a day of 10-minute episodes.");
        Assert.True(programs[^1].EndsAtUtc >= now.AddHours(23));

        // Airtime is continuous: every segment starts where the previous one ended.
        var segments = programs.SelectMany(program => program.Segments).ToList();
        Assert.All(segments.Zip(segments.Skip(1)), pair => Assert.Equal(pair.First.EndsAtUtc, pair.Second.StartsAtUtc));
        Assert.All(programs.Zip(programs.Skip(1)), pair => Assert.NotEqual(pair.First.EpisodeId, pair.Second.EpisodeId));
        Assert.All(programs, program => Assert.Contains(program.EpisodeId, world.EpisodeIds));

        // The episode with a break point is split around "Ya viene" + ads + "Continuamos con".
        var withBreak = programs.Where(program => program.EpisodeId == world.EpisodeWithBreakId).ToList();
        Assert.NotEmpty(withBreak);
        foreach (var program in withBreak)
        {
            var episode = program.Segments.Where(segment => segment.Kind == "Episode").ToList();
            Assert.Equal(2, episode.Count);
            Assert.Equal(0m, episode[0].MediaStartSecond);
            Assert.Equal(300m, episode[0].MediaEndSecond);
            Assert.Equal(300m, episode[1].MediaStartSecond);
            var adBreak = program.Segments.Where(segment => segment.InAdBreak).ToList();
            Assert.InRange(adBreak.Count, 3, 4);
            Assert.Equal(world.ComingUpId, adBreak[0].InterludeId);
            Assert.Equal(world.WeContinueWithId, adBreak[^1].InterludeId);
            Assert.All(adBreak[1..^1], segment => Assert.Contains(segment.InterludeId!.Value, world.AdIds));
            Assert.True(adBreak[^1].EndsAtUtc == episode[1].StartsAtUtc);
        }
        Assert.Contains(segments, segment => segment.InterludeId == world.GenericId && !segment.InAdBreak);

        var state = await server.RunAsync<IScheduleRepository, ChannelState?>(schedule => schedule.GetStateAsync(world.ChannelId));
        Assert.NotNull(state);
        Assert.InRange(state.CurrentSecond, state.MediaStartSecond, state.MediaStartSecond + 601);
        Assert.StartsWith("/uploads/", state.FilePath);

        var guide = await server.RunAsync<IScheduleRepository, IReadOnlyList<GuideRow>>(schedule =>
            schedule.GetGuideAsync(DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(now, TimeZoneInfo.FindSystemTimeZoneById("America/Guatemala"))), null));
        Assert.Single(guide);
        Assert.Contains(guide[0].Slots, slot => slot.IsNow);

        var cards = await server.RunAsync<IChannelRepository, IReadOnlyList<PublicChannelCard>>(channels => channels.PublicListAsync());
        var card = Assert.Single(cards);
        Assert.True(card.OnAir);
        Assert.Equal("Era dorada", card.EraName);
        Assert.Contains("Animación", card.Categories);
        Assert.NotNull(card.Next);
    }

    [SqlFact]
    public async Task ScheduleFollowsCatalogAndInterludeChanges()
    {
        await using var server = await TestServer.StartAsync();
        var world = await BroadcastWorld.CreateAsync(server);
        var removedAd = world.AdIds[0];

        // Withdrawn ads and deleted episodes disappear from the upcoming schedule.
        await server.RunAsync<IInterludeRepository>(interludes => interludes.SetApprovalAsync(removedAd, false));
        await server.RunAsync<ISeriesRepository>(series => series.DeleteEpisodeAsync(world.EpisodeIds[1]));
        var current = await server.RunAsync<IScheduleRepository, ChannelState?>(schedule => schedule.GetStateAsync(world.ChannelId));
        var programs = await server.RunAsync<IScheduleRepository, IReadOnlyList<ScheduleProgram>>(schedule =>
            schedule.GetProgramsAsync(world.ChannelId, current!.EndsAtUtc.AddMinutes(15), DateTime.UtcNow.AddHours(20)));
        Assert.NotEmpty(programs);
        Assert.DoesNotContain(programs, program => program.EpisodeId == world.EpisodeIds[1]);
        Assert.DoesNotContain(programs.SelectMany(program => program.Segments), segment => segment.InterludeId == removedAd);

        // Switching eras replaces even the program on air.
        var era = await server.RunAsync<IChannelRepository, EraItem>(channels =>
            channels.CreateEraAsync(world.ChannelId, new("Era nueva", null, new DateTime(1999, 1, 1), null)));
        await server.RunAsync<IChannelRepository>(channels => channels.ActivateEraAsync(world.ChannelId, era.Id));
        Assert.Null(await server.RunAsync<IScheduleRepository, ChannelState?>(schedule => schedule.GetStateAsync(world.ChannelId)));
        await server.RunAsync<IChannelRepository>(channels =>
            channels.SetEraSeriesAsync(world.ChannelId, era.Id, new([new(world.SeriesId, [1])])));
        var onAir = await server.RunAsync<IScheduleRepository, ChannelState?>(schedule => schedule.GetStateAsync(world.ChannelId));
        Assert.NotNull(onAir);
        Assert.NotEqual(world.SpecialId, onAir.EpisodeId);

        await server.RunAsync<IChannelRepository>(channels => channels.DeleteAsync(world.ChannelId));
        Assert.Empty(await server.RunAsync<IScheduleRepository, IReadOnlyList<int>>(schedule => schedule.ChannelIdsAsync()));
        Assert.False(await server.DbAsync(context => context.ScheduledPlaybackSegments.AnyAsync(segment => segment.EndsAtUtc > DateTime.UtcNow)));
    }

    /// <summary>"T1E02A"/"T1E02B" import as parts of one episode and always air together, A then B.</summary>
    [SqlFact]
    public async Task SplitEpisodePartsAirBackToBack()
    {
        await using var server = await TestServer.StartAsync();
        var series = await server.RunAsync<ISeriesRepository, SeriesDetail>(repository => repository.CreateAsync(
            new("Esponja", null, null, null, new DateOnly(1999, 1, 1), null, [], 1), null));
        var old = DateTime.UtcNow.AddMinutes(-10);
        foreach (var name in new[] { "T1E01 Uno", "T1E02A Mitad A", "T1E02B Mitad B", "T1E03 Tres" })
        {
            var path = Path.Combine(series.FolderPath!, "season 1", name + ".mp4");
            await TestServer.WriteVideoAsync(path, 300);
            File.SetLastWriteTimeUtc(path, old);
        }
        await server.RunAsync<ISeriesRepository, ScanResult>(repository => repository.ScanFolderAsync(series.Id, CancellationToken.None));
        var episodes = await server.RunAsync<ISeriesRepository, IReadOnlyList<EpisodeItem>>(repository => repository.ListEpisodesAsync(series.Id, 1));
        Assert.Equal(["1", "2A", "2B", "3"], episodes.Select(episode => $"{episode.EpisodeNumber}{episode.EpisodePart}"));
        var partA = episodes[1].Id;
        var partB = episodes[2].Id;

        var channel = await server.RunAsync<IChannelRepository, ChannelDetail>(channels =>
            channels.CreateAsync(new("Canal Partes", null, new DateTime(1999, 1, 1), null), null));
        var era = await server.RunAsync<IChannelRepository, EraItem>(channels =>
            channels.CreateEraAsync(channel.Id, new("Tarde", null, new DateTime(1999, 1, 1), null)));
        await server.RunAsync<IChannelRepository>(async channels =>
        {
            await channels.SetEraSeriesAsync(channel.Id, era.Id, new([new(series.Id, null)]));
            await channels.ActivateEraAsync(channel.Id, era.Id);
        });
        var programs = await server.RunAsync<IScheduleRepository, IReadOnlyList<ScheduleProgram>>(schedule =>
            schedule.GetProgramsAsync(channel.Id, DateTime.UtcNow.AddMinutes(-10), DateTime.UtcNow.AddHours(12)));
        var ids = programs.Select(program => program.EpisodeId).ToList();
        Assert.Contains(partA, ids);
        for (var index = 0; index < ids.Count; index++)
        {
            if (ids[index] == partA && index + 1 < ids.Count) Assert.Equal(partB, ids[index + 1]);
            if (ids[index] == partB && index > 0) Assert.Equal(partA, ids[index - 1]);
        }
        Assert.All(programs.Where(program => program.EpisodeId == partB), program => Assert.Equal("B", program.EpisodePart));
    }
}

/// <summary>A series with three episodes and a special, interludes, and a channel era on air.</summary>
public sealed record BroadcastWorld(int SeriesId, int ChannelId, int EraId, IReadOnlyList<int> EpisodeIds, int SpecialId, int EpisodeWithBreakId,
    int ComingUpId, int WeContinueWithId, int GenericId, IReadOnlyList<int> AdIds)
{
    public static async Task<BroadcastWorld> CreateAsync(TestServer server)
    {
        var category = await server.RunAsync<ICatalogRepository, CatalogItem>(catalog => catalog.CreateCategoryAsync(new("Animación")));
        var series = await server.RunAsync<ISeriesRepository, SeriesDetail>(repository => repository.CreateAsync(
            new("Retro Show", "Serie de prueba", null, 8, new DateOnly(1990, 1, 1), null, [category.Id], 1), null));
        Assert.NotNull(series.FolderPath);
        var old = DateTime.UtcNow.AddMinutes(-10);
        foreach (var (folder, name) in new[] { ("season 1", "S01E01 Uno"), ("season 1", "S01E02 Dos"), ("season 1", "S01E03 Tres"), ("specials", "E01 Especial") })
        {
            var path = Path.Combine(series.FolderPath, folder, name + ".mp4");
            await TestServer.WriteVideoAsync(path, 600);
            File.SetLastWriteTimeUtc(path, old);
        }
        var scan = await server.RunAsync<ISeriesRepository, ScanResult>(repository => repository.ScanFolderAsync(series.Id, CancellationToken.None));
        Assert.Equal(4, scan.Imported);
        var episodes = await server.RunAsync<ISeriesRepository, IReadOnlyList<EpisodeItem>>(repository => repository.ListEpisodesAsync(series.Id, null));
        var regular = episodes.Where(episode => episode.SeasonNumber == 1).OrderBy(episode => episode.EpisodeNumber).ToList();
        Assert.Equal([1, 2, 3], regular.Select(episode => episode.EpisodeNumber));
        Assert.Equal("Uno", regular[0].Title);
        var special = Assert.Single(episodes, episode => episode.SeasonNumber == 0);
        Assert.Equal(SeedIds.Special, special.EpisodeTypeId);
        await server.RunAsync<ISeriesRepository, BreakPointItem>(repository => repository.AddBreakPointAsync(regular[0].Id, new(300, "Corte 1")));

        async Task<int> Interlude(string kind, string? bumper, int seconds)
        {
            var file = Path.Combine(server.Media.FullName, $"tmp-{Guid.NewGuid():N}.mp4");
            await TestServer.WriteVideoAsync(file, seconds);
            var upload = new FileUpload(kind + ".mp4", new FileInfo(file).Length, "video/mp4", () => File.OpenRead(file));
            var item = await server.RunAsync<IInterludeRepository, InterludeItem>(interludes => interludes.UploadAsync(
                new(null, kind, bumper, InterludeSeason.AllYear, false, null, null, null, null, null), upload, CancellationToken.None));
            Assert.InRange(item.DurationSeconds, seconds - 1, seconds + 1);
            await server.RunAsync<IInterludeRepository>(interludes => interludes.SetApprovalAsync(item.Id, true));
            File.Delete(file);
            return item.Id;
        }
        var comingUp = await Interlude(InterludeKind.Bumper, BumperType.ComingUp, 5);
        var weContinue = await Interlude(InterludeKind.Bumper, BumperType.WeContinueWith, 5);
        var generic = await Interlude(InterludeKind.Bumper, BumperType.Generic, 3);
        var ads = new[] { await Interlude(InterludeKind.Advertisement, null, 10), await Interlude(InterludeKind.Advertisement, null, 10) };

        var channel = await server.RunAsync<IChannelRepository, ChannelDetail>(channels =>
            channels.CreateAsync(new("Canal Retro", "Historia", new DateTime(1985, 1, 1), null), null));
        var era = await server.RunAsync<IChannelRepository, EraItem>(channels =>
            channels.CreateEraAsync(channel.Id, new("Era dorada", null, new DateTime(1990, 1, 1), new DateTime(1995, 12, 31))));
        await server.RunAsync<IChannelRepository>(async channels =>
        {
            await channels.SetEraSeriesAsync(channel.Id, era.Id, new([new(series.Id, null)]));
            await channels.SetBreakRuleAsync(channel.Id, era.Id, new(1, 2, 120));
            foreach (var id in new[] { comingUp, weContinue, generic }.Concat(ads))
                await channels.AssignInterludeAsync(channel.Id, era.Id, id, null, new(1, 0));
            await channels.ActivateEraAsync(channel.Id, era.Id);
        });
        return new BroadcastWorld(series.Id, channel.Id, era.Id, regular.Select(episode => episode.Id).Append(special.Id).ToList(), special.Id,
            regular[0].Id, comingUp, weContinue, generic, ads);
    }
}
