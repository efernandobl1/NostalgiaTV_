using System.Text;
using System.Text.Json;
using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Infrastructure.Tests;

public class ChannelPackageIntegrationTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>Exports a channel, imports it as a copy and checks the copy exports to the same package.</summary>
    [SqlFact]
    public async Task ExportedChannelImportsAsAnIdenticalCopy()
    {
        await using var server = await TestServer.StartAsync();
        var cartoon = await CreateSeriesAsync(server, "Caricaturas 90", 3, ("tmdb", "4242"));
        var sitcom = await CreateSeriesAsync(server, "Comedia de Barrio", 2);
        var comingUp = await CreateInterludeAsync(server, "Ya viene", InterludeKind.Bumper, BumperType.ComingUp, "/uploads/broadcast/bumpers/ya-viene.mp4");
        var ad = await CreateInterludeAsync(server, "Refresco", InterludeKind.Advertisement, null, "/uploads/broadcast/advertisements/refresco.mp4");

        var channel = await server.RunAsync<IChannelRepository, ChannelDetail>(channels =>
            channels.CreateAsync(new("Canal Original", "Historia del canal", new DateTime(1988, 3, 1), null), null));
        var golden = await server.RunAsync<IChannelRepository, EraItem>(channels =>
            channels.CreateEraAsync(channel.Id, new("Era dorada", "Los noventa", new DateTime(1990, 1, 1), new DateTime(1995, 12, 31))));
        var late = await server.RunAsync<IChannelRepository, EraItem>(channels =>
            channels.CreateEraAsync(channel.Id, new("Era tardía", null, new DateTime(1996, 1, 1), null)));
        await server.RunAsync<IChannelRepository>(async channels =>
        {
            await channels.SetEraSeriesAsync(channel.Id, golden.Id, new([new(cartoon, [1, 2]), new(sitcom, null)]));
            await channels.SetBreakRuleAsync(channel.Id, golden.Id, new(1, 3, 120));
            await channels.AssignInterludeAsync(channel.Id, golden.Id, comingUp, null, new(2, 60));
            await channels.AssignInterludeAsync(channel.Id, golden.Id, ad, cartoon, new(3, 0));
            await channels.SetEraSeriesAsync(channel.Id, late.Id, new([new(sitcom, [2])]));
            await channels.ActivateEraAsync(channel.Id, golden.Id);
        });

        var exported = await server.RunAsync<IChannelPackageRepository, ChannelPackageFile>(packages => packages.ExportAsync(channel.Id));
        Assert.Equal("canal-original.ntv.json", exported.FileName);
        var package = JsonSerializer.Deserialize<ChannelPackage>(exported.Content, Web)!;
        Assert.Equal(ChannelPackage.FormatName, package.Format);
        Assert.Equal(1, package.Version);
        Assert.Equal(["Era dorada", "Era tardía"], package.Eras.Select(era => era.Name));
        Assert.True(package.Eras[0].OnAir);
        Assert.Equal(new PackageExternalId("tmdb", "4242"), Assert.Single(package.Series, series => series.Name == "Caricaturas 90").ExternalIds.Single());

        var preview = await server.RunAsync<IChannelPackageRepository, ChannelPackagePreview>(packages => packages.PreviewAsync(Upload(exported), default));
        Assert.True(preview.NameTaken);
        Assert.Equal(channel.Id, preview.SourceChannelId);
        Assert.All(preview.Series, series => Assert.Equal("matched", series.Status));
        Assert.Equal("externalId", preview.Series.Single(series => series.SeriesId == cartoon).MatchedBy);
        Assert.Equal("name", preview.Series.Single(series => series.SeriesId == sitcom).MatchedBy);
        Assert.All(preview.Interludes, interlude => Assert.Equal("filePath", interlude.MatchedBy));
        Assert.All(preview.Eras, era => Assert.Equal((0, 0), (era.MissingSeries, era.MissingInterludes)));

        // Same name as the source channel: the import asks for another one.
        await Assert.ThrowsAsync<ConflictException>(() =>
            server.RunAsync<IChannelPackageRepository, ChannelPackageImportResult>(packages => packages.ImportAsync(Upload(exported), null, default)));

        var result = await server.RunAsync<IChannelPackageRepository, ChannelPackageImportResult>(packages =>
            packages.ImportAsync(Upload(exported), "Canal Copia", default));
        Assert.Equal(("Canal Copia", 2, 3, 0, 2, 0),
            (result.Name, result.Eras, result.SeriesLinked, result.SeriesSkipped, result.InterludesLinked, result.InterludesSkipped));

        var copy = await server.RunAsync<IChannelRepository, ChannelDetail>(channels => channels.GetAsync(result.ChannelId));
        Assert.NotEqual(channel.ShareId, copy.ShareId);
        Assert.Equal("Historia del canal", copy.History);
        Assert.Equal(copy.Eras.Single(era => era.Name == "Era dorada").Id, copy.ActiveEraId);
        Assert.Equal(new BreakRuleItem(1, 3, 120), copy.Eras.Single(era => era.Name == "Era dorada").BreakRule);
        Assert.Null(copy.Eras.Single(era => era.Name == "Era tardía").BreakRule);
        foreach (var era in copy.Eras) Assert.NotNull(await server.DbAsync(db => db.ChannelEras.Where(item => item.Id == era.Id).Select(item => item.FolderPath).SingleAsync()));
        Assert.True(Directory.Exists(Path.Combine(server.Media.FullName, "channels", $"channel-{copy.Id}")));

        var copiedLineup = await server.RunAsync<IChannelRepository, IReadOnlyList<EraSeriesItem>>(channels =>
            channels.ListEraSeriesAsync(copy.Id, copy.Eras.Single(era => era.Name == "Era dorada").Id));
        Assert.Equal([(cartoon, "1,2"), (sitcom, "")],
            copiedLineup.OrderBy(item => item.SeriesId).Select(item => (item.SeriesId, string.Join(',', item.Seasons))));
        var copiedInterludes = await server.RunAsync<IChannelRepository, IReadOnlyList<EraInterludeItem>>(channels =>
            channels.ListEraInterludesAsync(copy.Id, copy.Eras.Single(era => era.Name == "Era dorada").Id));
        Assert.Equal([(comingUp, (int?)null, 2, 60), (ad, cartoon, 3, 0)],
            copiedInterludes.OrderBy(item => item.SeriesId.HasValue).Select(item => (item.InterludeId, item.SeriesId, item.Weight, item.MinimumGapSeconds)));

        // Exporting the copy yields the same package apart from the channel identity and export time.
        var again = JsonSerializer.Deserialize<ChannelPackage>(
            (await server.RunAsync<IChannelPackageRepository, ChannelPackageFile>(packages => packages.ExportAsync(copy.Id))).Content, Web)!;
        Assert.Equal(Content(package), Content(again));
    }

    /// <summary>The preview names the series, seasons and interludes the local library lacks; the import skips them.</summary>
    [SqlFact]
    public async Task PreviewReportsMissingSeriesAndInterludes()
    {
        await using var server = await TestServer.StartAsync();
        var existing = await CreateSeriesAsync(server, "Serie Local", 1);
        var renamed = await CreateSeriesAsync(server, "Nombre Local", 2, ("tmdb", "77"));
        var byPath = await CreateInterludeAsync(server, "Bumper", InterludeKind.Bumper, BumperType.Generic, "/uploads/broadcast/bumpers/generic.mp4");
        var byTitle = await CreateInterludeAsync(server, "Anuncio de Juguetes", InterludeKind.Advertisement, null, "/uploads/broadcast/advertisements/x.mp4");

        var json = Package("""
            "series": [
              { "key": "local", "name": "serie local", "startDate": "1990-01-01", "externalIds": [] },
              { "key": "renamed", "name": "Nombre Original", "startDate": "1991-01-01", "externalIds": [{ "provider": "tmdb", "id": "77" }] },
              { "key": "ghost", "name": "Serie Fantasma", "startDate": "1992-01-01", "externalIds": [{ "provider": "tmdb", "id": "999" }] }
            ],
            "interludes": [
              { "key": "path", "title": "Otro título", "kind": "Bumper", "bumperType": "Generic", "season": "AllYear", "filePath": "/uploads/broadcast/bumpers/generic.mp4" },
              { "key": "title", "title": "Anuncio de juguetes", "kind": "Advertisement", "bumperType": null, "season": "AllYear", "filePath": "/uploads/old/toys.mp4" },
              { "key": "lost", "title": "Anuncio perdido", "kind": "Advertisement", "bumperType": null, "season": "Christmas", "filePath": "/uploads/old/lost.mp4" }
            ],
            "eras": [
              {
                "name": "Era única", "description": null, "historicalStartDate": "1990-01-01T00:00:00Z", "historicalEndDate": null, "onAir": true,
                "breakRule": { "minimumAds": 2, "maximumAds": 4, "maximumBreakSeconds": 180 },
                "series": [ { "series": "local", "seasons": [1, 5] }, { "series": "renamed", "seasons": [] }, { "series": "ghost", "seasons": [] } ],
                "interludes": [
                  { "interlude": "path", "series": null, "weight": 1, "minimumGapSeconds": 0 },
                  { "interlude": "title", "series": "renamed", "weight": 5, "minimumGapSeconds": 300 },
                  { "interlude": "lost", "series": null, "weight": 1, "minimumGapSeconds": 0 },
                  { "interlude": "path", "series": "ghost", "weight": 1, "minimumGapSeconds": 0 }
                ]
              }
            ]
            """);

        var preview = await server.RunAsync<IChannelPackageRepository, ChannelPackagePreview>(packages => packages.PreviewAsync(Upload(json), default));
        Assert.False(preview.NameTaken);
        Assert.Null(preview.SourceChannelId);
        var series = preview.Series.ToDictionary(item => item.Key);
        Assert.Equal(("matched", existing, "name"), (series["local"].Status, series["local"].SeriesId, series["local"].MatchedBy));
        Assert.Equal([5], series["local"].MissingSeasons);
        Assert.Equal(("matched", renamed, "externalId"), (series["renamed"].Status, series["renamed"].SeriesId, series["renamed"].MatchedBy));
        Assert.Equal(("missing", (int?)null), (series["ghost"].Status, series["ghost"].SeriesId));
        var interludes = preview.Interludes.ToDictionary(item => item.Key);
        Assert.Equal((byPath, "filePath"), (interludes["path"].InterludeId, interludes["path"].MatchedBy));
        Assert.Equal((byTitle, "title"), (interludes["title"].InterludeId, interludes["title"].MatchedBy));
        Assert.Equal("missing", interludes["lost"].Status);
        var era = Assert.Single(preview.Eras);
        Assert.Equal((2, 1, 2, 2), (era.SeriesCount, era.MissingSeries, era.InterludeCount, era.MissingInterludes));

        var result = await server.RunAsync<IChannelPackageRepository, ChannelPackageImportResult>(packages => packages.ImportAsync(Upload(json), null, default));
        Assert.Equal(("Canal Importado", 2, 1, 2, 2), (result.Name, result.SeriesLinked, result.SeriesSkipped, result.InterludesLinked, result.InterludesSkipped));
        var channel = await server.RunAsync<IChannelRepository, ChannelDetail>(channels => channels.GetAsync(result.ChannelId));
        var eraId = Assert.Single(channel.Eras).Id;
        Assert.Equal(eraId, channel.ActiveEraId);
        var lineup = await server.RunAsync<IChannelRepository, IReadOnlyList<EraSeriesItem>>(channels => channels.ListEraSeriesAsync(channel.Id, eraId));
        Assert.Equal([(existing, "1"), (renamed, "")], lineup.OrderBy(item => item.SeriesId).Select(item => (item.SeriesId, string.Join(',', item.Seasons))));
        var assigned = await server.RunAsync<IChannelRepository, IReadOnlyList<EraInterludeItem>>(channels => channels.ListEraInterludesAsync(channel.Id, eraId));
        Assert.Equal([(byPath, (int?)null, 1, 0), (byTitle, renamed, 5, 300)],
            assigned.OrderBy(item => item.SeriesId.HasValue).Select(item => (item.InterludeId, item.SeriesId, item.Weight, item.MinimumGapSeconds)));
    }

    [SqlFact]
    public async Task ImportRejectsPackagesOutsideTheFormat()
    {
        await using var server = await TestServer.StartAsync();
        var valid = Package("""
            "series": [], "interludes": [], "eras": []
            """);
        var cases = new (string Json, string Message)[]
        {
            (valid.Replace("\"version\": 1", "\"version\": 2"), "versión 2"),
            (valid.Replace("\"format\": \"nostalgiatv-channel\"", "\"format\": \"otro\""), "no es un paquete"),
            (valid.Replace("\"series\": []", "\"series\": [], \"extra\": true"), "formato"),
            (valid.Replace("\"history\": null,", ""), "formato"),
            (valid.Replace("\"name\": \"Canal Importado\"", "\"name\": null"), "formato"),
            (valid.Replace("\"interludes\": []", """
                "interludes": [{ "key": "x", "title": "X", "kind": "Bumper", "bumperType": null, "season": "AllYear", "filePath": "/uploads/../secret.mp4" }]
                """), "fuera de la biblioteca"),
            (valid.Replace("\"interludes\": []", """
                "interludes": [{ "key": "x", "title": "X", "kind": "Bumper", "bumperType": null, "season": "AllYear", "filePath": "C:/media/x.mp4" }]
                """), "fuera de la biblioteca"),
            ("{ not json", "JSON"),
        };
        foreach (var (json, message) in cases)
        {
            var error = await Assert.ThrowsAsync<BadRequestException>(() =>
                server.RunAsync<IChannelPackageRepository, ChannelPackagePreview>(packages => packages.PreviewAsync(Upload(json), default)));
            Assert.Contains(message, error.Message);
        }

        var tooLarge = new FileUpload("big.ntv.json", ChannelPackage.MaxBytes + 1, "application/json", () => new MemoryStream(new byte[ChannelPackage.MaxBytes + 1]));
        await Assert.ThrowsAsync<BadRequestException>(() =>
            server.RunAsync<IChannelPackageRepository, ChannelPackageImportResult>(packages => packages.ImportAsync(tooLarge, null, default)));
        var wrongType = new FileUpload("canal.zip", 10, "application/zip", () => new MemoryStream(Encoding.UTF8.GetBytes(valid)));
        await Assert.ThrowsAsync<BadRequestException>(() =>
            server.RunAsync<IChannelPackageRepository, ChannelPackageImportResult>(packages => packages.ImportAsync(wrongType, null, default)));
        Assert.False(await server.DbAsync(db => db.Channels.AnyAsync()));
    }

    // ── Fixtures ──

    private static async Task<int> CreateSeriesAsync(TestServer server, string name, int seasons, params (string Provider, string Id)[] externalIds)
    {
        var series = await server.RunAsync<ISeriesRepository, SeriesDetail>(repository =>
            repository.CreateAsync(new(name, null, null, null, new DateOnly(1990, 1, 1), null, [], seasons), null));
        foreach (var (provider, id) in externalIds)
        {
            var providerId = await server.DbAsync(db => db.MetadataProviders.Where(item => item.Code == provider).Select(item => item.Id).SingleAsync());
            await server.RunAsync<IMetadataRepository, ExternalIdItem>(metadata => metadata.SetExternalIdAsync(series.Id, providerId, new(id)));
        }
        return series.Id;
    }

    /// <summary>Interlude rows only: matching works on stored paths, so no video file is needed.</summary>
    private static Task<int> CreateInterludeAsync(TestServer server, string title, string kind, string? bumperType, string path) =>
        server.DbAsync(async db =>
        {
            var interlude = new Interlude
            {
                Title = title, Kind = kind, BumperType = bumperType, Season = InterludeSeason.AllYear, FilePath = path,
                DurationSeconds = 5, ApprovedForBroadcast = true
            };
            db.Interludes.Add(interlude);
            await db.SaveChangesAsync();
            return interlude.Id;
        });

    private static string Package(string body) => $$"""
        {
          "format": "nostalgiatv-channel",
          "version": 1,
          "exportedAtUtc": "2026-10-19T00:00:00Z",
          "channel": { "shareId": "{{Guid.NewGuid()}}", "name": "Canal Importado", "history": null, "startDate": "1985-01-01T00:00:00Z", "endDate": null },
          {{body}}
        }
        """;

    private static FileUpload Upload(ChannelPackageFile file) =>
        new(file.FileName, file.Content.Length, "application/json", () => new MemoryStream(file.Content));

    private static FileUpload Upload(string json)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        return new FileUpload("canal.ntv.json", bytes.Length, "application/json", () => new MemoryStream(bytes));
    }

    private static string Content(ChannelPackage package) => JsonSerializer.Serialize(new
    {
        package.Channel.History, package.Channel.StartDate, package.Channel.EndDate, package.Series, package.Interludes, package.Eras
    }, Web);
}
