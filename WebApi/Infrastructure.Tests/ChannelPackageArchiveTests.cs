using System.IO.Compression;
using System.Text;
using System.Text.Json;
using ApplicationCore.DTOs.Packages;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services.Packages;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WebApi.Controllers;
using Xunit;

namespace Infrastructure.Tests;

public class ChannelPackageArchiveTests
{
    public static ChannelPackageManifest Sample() => new()
    {
        PackageId = Guid.NewGuid(), Name = "Cartoon City", StartDate = new(2004, 1, 1),
        SelectedEra = "city", Series = [new() { Key = "retro", Name = "Retro series", StartDate = new(2000, 1, 1), Seasons = 2 }],
        Eras = [new() { Key = "city", Name = "City", StartDate = new(2004, 1, 1),
            Series = [new("retro", true, [1, 2])], BreakRules = new(1, 3, 180) }]
    };

    [Fact]
    public async Task ConfigurationPackageRoundTripsWithoutPrivatePathsOrEpisodes()
    {
        using var stream = Zip(Sample());
        using var archive = new ZipArchive(stream);
        var (manifest, fingerprint) = await ChannelPackageArchive.ReadAsync(archive, default);
        Assert.Equal("Cartoon City", manifest.Name);
        Assert.Equal([1, 2], manifest.Eras[0].Series[0].Seasons);
        Assert.Equal(64, fingerprint.Length);
        Assert.Empty(manifest.Assets);
        var json = JsonSerializer.Serialize(manifest, ChannelPackageArchive.Json);
        Assert.DoesNotContain("folderPath", json);
        Assert.DoesNotContain("episodes", json);
    }

    [Theory]
    [InlineData("../evil.mp4")]
    [InlineData("assets/../evil.mp4")]
    [InlineData("/absolute.mp4")]
    [InlineData("assets/run.sh")]
    [InlineData("manifest.json")]
    public async Task UnexpectedPathsAndDuplicateEntriesAreRejected(string path)
    {
        using var stream = Zip(Sample(), path);
        using var archive = new ZipArchive(stream);
        await Assert.ThrowsAsync<InvalidDataException>(() => ChannelPackageArchive.ReadAsync(archive, default));
    }

    [Fact]
    public async Task UndeclaredAssetsAreRejected()
    {
        using var stream = Zip(Sample(), "assets/" + new string('a', 32) + ".mp4");
        using var archive = new ZipArchive(stream);
        await Assert.ThrowsAsync<InvalidDataException>(() => ChannelPackageArchive.ReadAsync(archive, default));
    }

    [Fact]
    public async Task UnknownFieldsAndNullCollectionsAreRejected()
    {
        foreach (var json in new[] { "{\"schemaVersion\":1,\"script\":\"malicious\"}", "{\"series\":null}" })
        {
            using var stream = new MemoryStream();
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
            using (var writer = new StreamWriter(zip.CreateEntry("manifest.json").Open())) writer.Write(json);
            stream.Position = 0;
            using var archive = new ZipArchive(stream);
            await Assert.ThrowsAsync<InvalidDataException>(() => ChannelPackageArchive.ReadAsync(archive, default));
        }
    }

    [Fact]
    public void UnsupportedSchedulesAndVersionsAreRejected()
    {
        var manifest = Sample(); manifest.SchedulingMode = "Fixed";
        Assert.Throws<InvalidDataException>(() => ChannelPackageArchive.Validate(manifest));
        manifest.SchedulingMode = "Shuffle"; manifest.SchemaVersion = 999;
        Assert.Throws<InvalidDataException>(() => ChannelPackageArchive.Validate(manifest));
    }

    [Fact]
    public void DuplicateSeriesAndInvalidSeasonSelectionsAreRejected()
    {
        var manifest = Sample(); manifest.Series.Add(new() { Key = "duplicate", Name = manifest.Series[0].Name, StartDate = manifest.Series[0].StartDate });
        Assert.Throws<InvalidDataException>(() => ChannelPackageArchive.Validate(manifest));
        manifest.Series.RemoveAt(1); manifest.Eras[0].Series[0] = new("retro", true, [1, 1]);
        Assert.Throws<InvalidDataException>(() => ChannelPackageArchive.Validate(manifest));
    }

    [Theory]
    [InlineData(InterludeSeason.Halloween)]
    [InlineData(InterludeSeason.Christmas)]
    public void SeasonalClipsRequireLicenseAndMatchingBreakRoles(InterludeSeason season)
    {
        var manifest = Sample();
        var path = "assets/" + new string('a', 32) + ".mp4";
        manifest.Assets.Add(new(path, 1, new string('a', 64)));
        manifest.Clips.Add(new() { Key = "ad", Title = "Seasonal ad", Kind = InterludeKind.Advertisement, Season = season, Asset = path, License = "CC0" });
        manifest.Eras[0].Clips.Add(new("ad", BreakRole.Advertisement, 1, 3600));
        ChannelPackageArchive.Validate(manifest);
        manifest.Clips[0].License = "";
        Assert.Throws<InvalidDataException>(() => ChannelPackageArchive.Validate(manifest));
        manifest.Clips[0].License = "CC0"; manifest.Eras[0].Clips[0] = new("ad", BreakRole.BreakOpener, 1, 0);
        Assert.Throws<InvalidDataException>(() => ChannelPackageArchive.Validate(manifest));
    }

    [Theory]
    [InlineData("file:///etc/passwd")]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://user:password@example.com/file")]
    public void UnsafeSourceUrlsAreRejected(string url) => Assert.Throws<InvalidDataException>(() => ChannelPackageArchive.ValidateSource(url));

    [Fact]
    public async Task UploadAndEditRejectSharingWithoutLicenseBeforeAccessingDatabase()
    {
        using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer("Server=(local);Database=Unused;Integrated Security=True").Options);
        var controller = new RetroBroadcastController(context, null!, null!, Options.Create(new MediaSettings()));
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateInterlude(1, new("Bumper", null, null, null, RedistributionAllowed: true)));
        using var stream = new MemoryStream([1]);
        Assert.IsType<BadRequestObjectResult>(await controller.UploadInterlude(new() { Title = "Bumper", RedistributionAllowed = true,
            File = new FormFile(stream, 0, 1, "file", "clip.mp4") }, default));
    }

    private static MemoryStream Zip(ChannelPackageManifest manifest, string? extraPath = null)
    {
        var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            using (var writer = new StreamWriter(zip.CreateEntry("manifest.json").Open(), Encoding.UTF8))
                writer.Write(JsonSerializer.Serialize(manifest, ChannelPackageArchive.Json));
            if (extraPath != null) using (var writer = new StreamWriter(zip.CreateEntry(extraPath).Open())) writer.Write("test");
        }
        stream.Position = 0;
        return stream;
    }
}
