using ApplicationCore.Entities;

namespace Infrastructure.Services.Media;

public static class MediaStorageLayout
{
    public static string ChannelFolder(int id) => $"channels/channel-{PositiveId(id)}";
    public static string EraFolder(int channelId, int eraId) => $"{ChannelFolder(channelId)}/eras/era-{PositiveId(eraId)}";
    public static string SeriesFolder(string name, int id)
    {
        var invalid = Path.GetInvalidFileNameChars().Concat("<>:\"/\\|?*").ToHashSet();
        var safe = new string(name.Select(character => invalid.Contains(character) || char.IsControl(character) ? '-' : character).ToArray())
            .Trim(' ', '.', '-');
        if (safe.Length == 0) safe = "series";
        return $"series/{safe[..Math.Min(safe.Length, 80)]}-{PositiveId(id)}";
    }

    public static string BroadcastFolder(InterludeKind kind) => kind switch
    {
        InterludeKind.Bumper => "broadcast/bumpers",
        InterludeKind.Advertisement => "broadcast/advertisements",
        _ => throw new ArgumentOutOfRangeException(nameof(kind))
    };

    public static string RelativeFolder(string root, string path)
    {
        root = Path.GetFullPath(root);
        path = Path.GetFullPath(path);
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (!path.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, comparison))
            throw new IOException("Storage path is outside the media library.");
        return Path.GetRelativePath(root, path).Replace('\\', '/');
    }

    public static string CreateDirectory(string root, string folder)
    {
        root = Path.GetFullPath(root);
        var path = Path.GetFullPath(Path.Combine(root, folder));
        var relative = RelativeFolder(root, path);
        // Inspect each parent before creating children: a writable symlink must not redirect storage.
        var current = root;
        Directory.CreateDirectory(current);
        RejectLink(current);
        foreach (var part in relative.Split('/'))
        {
            current = Path.Combine(current, part);
            if (Directory.Exists(current) || File.Exists(current)) RejectLink(current);
            Directory.CreateDirectory(current);
        }
        return path;
    }

    private static void RejectLink(string path)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new IOException("Symbolic media folders are not supported.");
    }

    private static int PositiveId(int id) => id > 0 ? id : throw new ArgumentOutOfRangeException(nameof(id));
}
