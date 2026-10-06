using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Infrastructure.Services.Media;

public static class MediaFilePolicy
{
    private static readonly HashSet<string> Extensions = new(StringComparer.OrdinalIgnoreCase)
        { ".mp4", ".m4v", ".mkv", ".flv", ".avi", ".wmv", ".mov", ".webm", ".ogg", ".ogv", ".mpeg", ".mpg", ".ts" };

    public static bool IsCandidate(string path)
    {
        var name = Path.GetFileName(path);
        return Extensions.Contains(Path.GetExtension(path)) && !name.StartsWith('.') &&
            !name.Contains(".transcoding.", StringComparison.OrdinalIgnoreCase) &&
            !name.Contains(".web-compatible", StringComparison.OrdinalIgnoreCase);
    }

    public static string SafePath(string root, string path)
    {
        root = Path.GetFullPath(root);
        path = Path.GetFullPath(path);
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (!path.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, comparison))
            throw new IOException("Media path is outside the library.");
        for (var current = path; current != null; current = Path.GetDirectoryName(current))
        {
            if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("Symbolic links are not accepted in the media library.");
            if (current.Equals(root, comparison)) break;
        }
        return path;
    }

    public static string Fingerprint(int seriesId, string relativePath, long size, DateTime modified) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{seriesId}|{relativePath}|{size}|{modified.Ticks}")));

    public static string OutputPath(string source) => Path.Combine(Path.GetDirectoryName(source)!,
        Path.GetFileNameWithoutExtension(source) + (Path.GetExtension(source).Equals(".mp4", StringComparison.OrdinalIgnoreCase) ? ".web.mp4" : ".mp4"));

    public static (int Season, string Type)? FolderType(string folder)
    {
        if (folder.Equals("specials", StringComparison.OrdinalIgnoreCase)) return (0, "Special");
        if (folder.Equals("movies", StringComparison.OrdinalIgnoreCase)) return (0, "Movie");
        var match = Regex.Match(folder, @"^season (\d{1,3})$", RegexOptions.IgnoreCase);
        return match.Success && int.Parse(match.Groups[1].Value) > 0 ? (int.Parse(match.Groups[1].Value), "Regular") : null;
    }

    public static (string Title, int Number) EpisodeName(string path)
    {
        var name = Path.GetFileNameWithoutExtension(path);
        if (name.EndsWith(".web", StringComparison.OrdinalIgnoreCase)) name = name[..^4];
        if (name.Contains('Ã') || name.Contains('Â') || name.Contains("â€"))
        {
            var repaired = Encoding.UTF8.GetString(Encoding.Latin1.GetBytes(name));
            if (!repaired.Contains('�')) name = repaired;
        }
        var match = Regex.Match(name, @"[Ss]?\d{1,2}[xXeE](\d{1,3})");
        if (!match.Success) match = Regex.Match(name, @"^[Ee]?(\d{1,3})[\s.\-_]+");
        if (!match.Success) return (name, 0);
        var title = name[(match.Index + match.Length)..].Trim(' ', '-', '–', '—', '.', '_').Replace('_', ' ');
        return (string.IsNullOrWhiteSpace(title) ? name : title, int.Parse(match.Groups[1].Value));
    }
}
