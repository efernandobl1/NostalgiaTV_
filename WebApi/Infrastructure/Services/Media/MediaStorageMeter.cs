using ApplicationCore.Settings;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services.Media;

public sealed record StorageMeasurement(DateTime MeasuredAtUtc, long? LibraryBytes, long? TotalBytes,
    long? FreeBytes, long? AvailableBytes, IReadOnlyDictionary<int, long?> SeriesBytes);

public sealed class MediaStorageMeter(IOptions<MediaSettings> settings)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private StorageMeasurement? cached;
    private string? cacheKey;

    public async Task<StorageMeasurement> MeasureAsync(IReadOnlyDictionary<int, string?> folders, CancellationToken token)
    {
        await gate.WaitAsync(token);
        try
        {
            var key = string.Join('|', folders.OrderBy(item => item.Key).Select(item => $"{item.Key}:{item.Value}"));
            if (cached != null && cacheKey == key && DateTime.UtcNow - cached.MeasuredAtUtc < TimeSpan.FromSeconds(30)) return cached;
            cached = await Task.Run(() => Measure(folders, token), token);
            cacheKey = key;
            return cached;
        }
        finally { gate.Release(); }
    }

    private StorageMeasurement Measure(IReadOnlyDictionary<int, string?> folders, CancellationToken token)
    {
        var root = Path.GetFullPath(settings.Value.BasePath);
        long? total = null, free = null, available = null;
        try
        {
            if (Directory.Exists(root) && (File.GetAttributes(root) & FileAttributes.ReparsePoint) == 0)
            {
                var drive = DriveForPath(root);
                total = drive.TotalSize;
                free = drive.TotalFreeSpace;
                available = drive.AvailableFreeSpace;
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException) { }
        var sizes = folders.ToDictionary(item => item.Key, item => MeasureFolder(root, item.Value, token));
        return new StorageMeasurement(DateTime.UtcNow, MeasureFolder(root, root, token), total, free, available, sizes);
    }

    public static DriveInfo DriveForPath(string path)
    {
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        var fullPath = Path.GetFullPath(path);
        return DriveInfo.GetDrives().Where(drive => fullPath.Equals(drive.Name.TrimEnd(Path.DirectorySeparatorChar), comparison) ||
            fullPath.StartsWith(drive.Name.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, comparison))
            .OrderByDescending(drive => drive.Name.Length).First();
    }

    private static long? MeasureFolder(string root, string? folder, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(folder)) return null;
        try
        {
            folder = Path.GetFullPath(folder);
            if (folder == root)
            {
                if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) return null;
            }
            else MediaFilePolicy.SafePath(root, folder);
            var pending = new Stack<string>();
            pending.Push(folder);
            long bytes = 0;
            while (pending.TryPop(out var current))
            {
                token.ThrowIfCancellationRequested();
                foreach (var entry in Directory.EnumerateFileSystemEntries(current))
                {
                    var attributes = File.GetAttributes(entry);
                    if ((attributes & FileAttributes.ReparsePoint) != 0) continue;
                    if ((attributes & FileAttributes.Directory) != 0) pending.Push(entry);
                    else bytes = checked(bytes + new FileInfo(entry).Length);
                }
            }
            return bytes;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException) { return null; }
    }
}
