using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Services.InternalServices;
using Infrastructure.Services.Media;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Infrastructure.Tests;

public class MediaStorageLayoutTests : IDisposable
{
    private readonly DirectoryInfo directory = Directory.CreateTempSubdirectory("nostalgia-layout-test-");

    [Fact]
    public void SeriesNamesAreSafeAndSeparateEntitiesCannotShareStorage()
    {
        var first = MediaStorageLayout.SeriesFolder("../Retro:TV\\Test", 1);
        var second = MediaStorageLayout.SeriesFolder("../Retro:TV\\Test", 2);
        Assert.NotEqual(first, second);
        var path = MediaStorageLayout.CreateDirectory(directory.FullName, first);
        Assert.Equal(first, MediaStorageLayout.RelativeFolder(directory.FullName, path));
        Assert.DoesNotContain("..", first);
        Assert.DoesNotContain(':', first);
    }

    [Fact]
    public void NewSeriesDoNotCreateUnusedMoviesAndSpecialsFolders()
    {
        var folders = new SeriesFolderService(Options.Create(new MediaSettings { BasePath = directory.FullName }));
        var root = folders.CreateSeriesFolder("Los padrinos mágicos", 2, 12);
        Assert.True(Directory.Exists(Path.Combine(root, "season 1")));
        Assert.True(Directory.Exists(Path.Combine(root, "season 2")));
        Assert.False(Directory.Exists(Path.Combine(root, "movies")));
        Assert.False(Directory.Exists(Path.Combine(root, "specials")));
        Assert.Empty(Directory.GetFiles(root));
    }

    [Fact]
    public void ExistingSeriesFoldersAreRetainedWhenSeasonsAreAdded()
    {
        var legacy = Directory.CreateDirectory(Path.Combine(directory.FullName, "series", "Retro"));
        Directory.CreateDirectory(Path.Combine(legacy.FullName, "season 1"));
        var folders = new SeriesFolderService(Options.Create(new MediaSettings { BasePath = directory.FullName }));
        folders.UpdateSeriesFolders(legacy.FullName, 2);
        Assert.True(Directory.Exists(Path.Combine(legacy.FullName, "season 2")));
        Assert.False(Directory.Exists(Path.Combine(directory.FullName, "series", "Retro-1")));
    }

    [Theory]
    [InlineData("../outside")]
    [InlineData("channels/../../outside")]
    public void StorageCannotEscapeTheRoot(string folder) =>
        Assert.Throws<IOException>(() => MediaStorageLayout.CreateDirectory(directory.FullName, folder));

    [Fact]
    public void SharedBroadcastMediaIsSeparatedByKind()
    {
        Assert.Equal("broadcast/bumpers", MediaStorageLayout.BroadcastFolder(InterludeKind.Bumper));
        Assert.Equal("broadcast/advertisements", MediaStorageLayout.BroadcastFolder(InterludeKind.Advertisement));
        Assert.Equal("channels/channel-3/eras/era-4", MediaStorageLayout.EraFolder(3, 4));
    }

    [Fact]
    public async Task ArtworkUsesTheSameFolderAsItsSeries()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["FFmpeg:BinaryFolder"] = Environment.GetEnvironmentVariable("FFMPEG_BINARY_FOLDER") ?? "" }).Build();
        var runner = new MediaProcessRunner();
        var sample = Path.Combine(directory.FullName, "sample.webp");
        await runner.RunAsync(new MediaProbe(runner, configuration).Binary("ffmpeg"),
            ["-v", "error", "-f", "lavfi", "-i", "color=black:s=32x32", "-frames:v", "1", sample],
            TimeSpan.FromSeconds(10), CancellationToken.None);
        var upload = new FileUploadService(Options.Create(new FileUploadSettings { MaxFileSizeMB = 1, AllowedExtensions = [".webp"] }),
            Options.Create(new MediaSettings { BasePath = directory.FullName }), configuration, runner);
        using var bytes = new MemoryStream(await File.ReadAllBytesAsync(sample));
        var file = new FormFile(bytes, 0, bytes.Length, "logo", "cover.webp");
        var path = await upload.UploadAsync(file, MediaStorageLayout.SeriesFolder("Retro", 5));
        Assert.StartsWith("/uploads/series/Retro-5/", path);
        Assert.True(File.Exists(Path.Combine(directory.FullName, path["/uploads/".Length..])));
        using var invalid = new MemoryStream([1, 2, 3]);
        await Assert.ThrowsAsync<ApplicationCore.Exceptions.BadRequestException>(() => upload.UploadAsync(
            new FormFile(invalid, 0, invalid.Length, "logo", "fake.webp")));
        Assert.Empty(Directory.EnumerateFiles(directory.FullName, "*.part", SearchOption.AllDirectories));
    }

    public void Dispose() => directory.Delete(recursive: true);
}
