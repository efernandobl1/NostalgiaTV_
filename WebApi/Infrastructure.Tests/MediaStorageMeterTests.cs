using ApplicationCore.Settings;
using Infrastructure.Services.Media;
using Microsoft.Extensions.Options;
using Xunit;

namespace Infrastructure.Tests;

public class MediaStorageMeterTests
{
    [Fact]
    public async Task MeasuresPhysicalFilesIncludingOriginalsWithoutInventingMissingFolderSizes()
    {
        var root = Directory.CreateTempSubdirectory("nostalgia-storage-test-");
        try
        {
            var first = Directory.CreateDirectory(Path.Combine(root.FullName, "series", "First", "season 1"));
            var second = Directory.CreateDirectory(Path.Combine(root.FullName, "series", "Second"));
            await File.WriteAllBytesAsync(Path.Combine(first.FullName, "original.mkv"), new byte[100]);
            await File.WriteAllBytesAsync(Path.Combine(first.FullName, "episode.mp4"), new byte[50]);
            await File.WriteAllBytesAsync(Path.Combine(second.FullName, "cover.png"), new byte[20]);
            var meter = new MediaStorageMeter(Options.Create(new MediaSettings { BasePath = root.FullName }));
            var folders = new Dictionary<int, string?> { [1] = first.Parent!.FullName, [2] = second.FullName,
                [3] = Path.Combine(root.FullName, "missing"), [4] = root.FullName + "-outside" };
            var result = await meter.MeasureAsync(folders, CancellationToken.None);
            Assert.Equal(170, result.LibraryBytes);
            Assert.Equal(150, result.SeriesBytes[1]);
            Assert.Equal(20, result.SeriesBytes[2]);
            Assert.Null(result.SeriesBytes[3]);
            Assert.Null(result.SeriesBytes[4]);
            Assert.True(result.TotalBytes > 0);
            Assert.True(result.AvailableBytes >= 0);
            Assert.Same(result, await meter.MeasureAsync(folders, CancellationToken.None));
        }
        finally { root.Delete(recursive: true); }
    }
}
