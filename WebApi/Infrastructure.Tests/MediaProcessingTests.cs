using System.Security.Cryptography;
using System.Text.Json;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services.Media;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Xunit;

namespace Infrastructure.Tests;

public class MediaProcessingTests
{
    private static string Metadata(string codec = "h264", string pixels = "yuv420p", string audio = "aac", int channels = 2) =>
        JsonSerializer.Serialize(new { format = new { duration = "1420.715", format_name = "mov,mp4,m4a,3gp,3g2,mj2" },
            streams = new object[] { new { codec_type = "video", codec_name = codec, pix_fmt = pixels, level = 40,
                width = 1920, height = 1080, avg_frame_rate = "30/1" },
                new { codec_type = "audio", codec_name = audio, channels, profile = "LC" } } });

    [Fact]
    public void AcceptsBroadlyCompatibleMp4() => Assert.True(MediaProbe.Parse(Metadata(), ".mp4").Compatible);

    [Fact]
    public void CompatibilityExplainsWhyAPlayableVideoNeedsConversion()
    {
        Assert.Null(MediaProbe.Parse(Metadata(), ".mp4").IncompatibilityReason);
        Assert.Contains("AAC-LC", MediaProbe.Parse(Metadata(audio: "mp3"), ".mp4").IncompatibilityReason);
        Assert.Contains("nivel H.264", MediaProbe.Parse(Metadata().Replace("\"level\":40", "\"level\":41"), ".mp4").IncompatibilityReason);
        Assert.Contains("FPS", MediaProbe.Parse(Metadata().Replace("30/1", "60/1"), ".mp4").IncompatibilityReason);
    }

    [Fact]
    public async Task CompatibleVideosAreNeverEncodedAgain()
    {
        var (probe, runner, transcoder) = Tools();
        var directory = Directory.CreateTempSubdirectory("nostalgia-compatible-test-");
        try
        {
            var input = Path.Combine(directory.FullName, "episode.mp4");
            await runner.RunAsync(probe.Binary("ffmpeg"), ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=160x120:rate=25",
                "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", input], TimeSpan.FromSeconds(30), CancellationToken.None);
            var info = new FileInfo(input);
            var hash = SHA256.HashData(await File.ReadAllBytesAsync(input));
            Assert.Equal(input, await transcoder.ConvertAsync(new LibraryFile(1, input, info.Name, info.Length, info.LastWriteTimeUtc),
                _ => throw new InvalidOperationException("Compatible input must not be encoded."), CancellationToken.None));
            Assert.Equal(hash, SHA256.HashData(await File.ReadAllBytesAsync(input)));
            Assert.Single(Directory.GetFiles(directory.FullName));
        }
        finally { directory.Delete(recursive: true); }
    }

    [Theory]
    [InlineData(".mkv", "h264", "yuv420p", "aac", 2)]
    [InlineData(".webm", "h264", "yuv420p", "aac", 2)]
    [InlineData(".mp4", "hevc", "yuv420p", "aac", 2)]
    [InlineData(".mp4", "h264", "yuv420p10le", "aac", 2)]
    [InlineData(".mp4", "h264", "yuv420p", "mp3", 2)]
    [InlineData(".mp4", "h264", "yuv420p", "aac", 6)]
    public void RejectsContainerOrCodecsThatAreNotBroadlyCompatible(string extension, string codec, string pixels, string audio, int channels) =>
        Assert.False(MediaProbe.Parse(Metadata(codec, pixels, audio, channels), extension).Compatible);

    [Theory]
    [InlineData("unfinished.mp4.part")]
    [InlineData("episode.mp4.transcoding.1234.mp4")]
    [InlineData("episode.mp4.web-compatible")]
    [InlineData(".upload-1234.part")]
    [InlineData("image.webp")]
    public void IgnoresNonVideosAndTemporaryArtifacts(string name) => Assert.False(MediaFilePolicy.IsCandidate(name));

    [Fact]
    public void DetectsTruncatedConversions()
    {
        Assert.False(MediaProbe.SameDuration(1420.715, 374.89));
        Assert.False(MediaProbe.SameDuration(1420.715, 1400));
        Assert.True(MediaProbe.SameDuration(1420.715, 1420.8));
        Assert.False(MediaProbe.SameDuration(double.NaN, 100));
        Assert.False(MediaProbe.SameDuration(0, 0));
    }

    [Fact]
    public void InvalidMetadataCannotProduceAnEpisode() => Assert.Throws<IOException>(() => MediaProbe.Parse("{}", ".mp4"));

    [Fact]
    public void PreservesEpisodeNumberAndRecognizesKnownFolders()
    {
        Assert.Equal(("El gran problema", 1), MediaFilePolicy.EpisodeName("Los padrinos mágicos S01E01 - El gran problema.web.mp4"));
        Assert.Equal((2, "Regular"), MediaFilePolicy.FolderType("season 2"));
        Assert.Equal((0, "Special"), MediaFilePolicy.FolderType("specials"));
        Assert.Null(MediaFilePolicy.FolderType("season 0"));
        Assert.Null(MediaFilePolicy.FolderType("originals"));
    }

    [Fact]
    public void PathCannotEscapeTheMediaRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), "nostalgia-library");
        Assert.Throws<IOException>(() => MediaFilePolicy.SafePath(root, root + "-other/video.mp4"));
        Assert.Throws<IOException>(() => MediaFilePolicy.SafePath(root, Path.Combine(root, "..", "secret.mp4")));
    }

    [Fact]
    public void ChangedFilesGetANewFingerprint()
    {
        var now = DateTime.UtcNow;
        var first = MediaFilePolicy.Fingerprint(1, "series/episode.mp4", 1024, now);
        Assert.NotEqual(first, MediaFilePolicy.Fingerprint(1, "series/episode.mp4", 2048, now));
        Assert.NotEqual(first, MediaFilePolicy.Fingerprint(1, "series/episode.mp4", 1024, now.AddSeconds(1)));
    }

    [Fact]
    public void ProcessingModelIncludesUniqueFingerprintAndPausedWorkers()
    {
        using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer("Server=unused;Database=unused").Options);
        var entity = context.Model.FindEntityType(typeof(MediaProcessingJob))!;
        Assert.Contains(entity.GetIndexes(), index => index.IsUnique && index.Properties.Select(property => property.Name).SequenceEqual(["Worker", "Fingerprint"]));
        Assert.Equal(2048, entity.FindProperty(nameof(MediaProcessingJob.SourcePath))!.GetMaxLength());
    }

    [Fact]
    public async Task RealConversionPreservesOriginalAndPublishesACompleteCompatibleMp4()
    {
        var (probe, runner, transcoder) = Tools();
        var directory = Directory.CreateTempSubdirectory("nostalgia-media-test-");
        try
        {
            var input = Path.Combine(directory.FullName, "Retro S01E01 - Test.mkv");
            await runner.RunAsync(probe.Binary("ffmpeg"), ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=160x120:rate=25",
                "-f", "lavfi", "-i", "sine=frequency=1000", "-t", "4", "-c:v", "ffv1", "-c:a", "pcm_s16le", input], TimeSpan.FromSeconds(30), CancellationToken.None);
            var hash = SHA256.HashData(await File.ReadAllBytesAsync(input));
            var source = await probe.ReadAsync(input, CancellationToken.None);
            Assert.False(source.Compatible);
            var info = new FileInfo(input);
            var file = new LibraryFile(1, input, info.Name, info.Length, info.LastWriteTimeUtc);
            var progress = new List<double>();
            var output = await transcoder.ConvertAsync(file, percent => { progress.Add(percent); return Task.CompletedTask; }, CancellationToken.None);
            var converted = await probe.ReadAsync(output, CancellationToken.None);
            Assert.True(converted.Compatible);
            Assert.True(MediaProbe.SameDuration(source.Duration, converted.Duration));
            Assert.Equal(hash, SHA256.HashData(await File.ReadAllBytesAsync(input)));
            Assert.NotEmpty(progress);
            Assert.Empty(Directory.GetFiles(directory.FullName, "*.transcoding.*.mp4"));
            await Assert.ThrowsAsync<IOException>(() => transcoder.ConvertAsync(file, _ => Task.CompletedTask, CancellationToken.None));
            Assert.True(File.Exists(output));
        }
        finally { directory.Delete(recursive: true); }
    }

    [Fact]
    public async Task CancellationStopsTheChildProcess()
    {
        var (probe, runner, _) = Tools();
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(250));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => runner.RunAsync(probe.Binary("ffmpeg"),
            ["-nostdin", "-v", "error", "-re", "-f", "lavfi", "-i", "testsrc=size=160x120:rate=25", "-t", "30", "-f", "null", "-"],
            TimeSpan.FromSeconds(40), cancellation.Token));
    }

    private static (MediaProbe Probe, MediaProcessRunner Runner, MediaTranscoder Transcoder) Tools()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["FFmpeg:BinaryFolder"] = Environment.GetEnvironmentVariable("FFMPEG_BINARY_FOLDER") ?? "" }).Build();
        var runner = new MediaProcessRunner();
        var probe = new MediaProbe(runner, configuration);
        return (probe, runner, new MediaTranscoder(probe, runner, Options.Create(new MediaProcessingSettings())));
    }
}
