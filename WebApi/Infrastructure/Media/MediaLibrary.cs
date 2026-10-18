using System.Text.Json;
using ApplicationCore.Exceptions;
using ApplicationCore.Models;
using ApplicationCore.Settings;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Infrastructure.Media;

public sealed record LibraryFile(int SeriesId, string FullPath, string RelativePath, long Size, DateTime ModifiedUtc)
{
    public string Fingerprint => MediaFilePolicy.Fingerprint(SeriesId, RelativePath, Size, ModifiedUtc);
}

/// <summary>
/// File-system side of the media library (no database access): folders, safe paths, uploads and
/// public URLs. Stored paths are public URLs such as "/uploads/series/name-1/season 1/e01.mp4".
/// </summary>
public sealed class MediaLibrary(IOptions<MediaSettings> settings, IOptions<FileUploadSettings> uploadSettings,
    MediaProbe probe, MediaProcessRunner runner)
{
    public const string PublicPrefix = "/uploads/";

    public string Root => Path.GetFullPath(settings.Value.BasePath);

    public string PublicPath(string fullPath) => PublicPrefix + MediaStorageLayout.RelativeFolder(Root, fullPath);

    public string ResolvePublicPath(string path)
    {
        var relative = path.Replace('\\', '/');
        if (relative.StartsWith(PublicPrefix, StringComparison.OrdinalIgnoreCase)) relative = relative[PublicPrefix.Length..];
        return Path.GetFullPath(Path.Combine(Root, relative));
    }

    public long? FileSize(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        try { return new FileInfo(MediaFilePolicy.SafePath(Root, ResolvePublicPath(path))).Length; }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException) { return null; }
    }

    public bool Exists(string path)
    {
        try { MediaFilePolicy.SafePath(Root, ResolvePublicPath(path)); return true; }
        catch (Exception exception) when (exception is FileNotFoundException or DirectoryNotFoundException) { return false; }
    }

    /// <summary>Creates "series/name-id" with one "season N" folder per regular season.</summary>
    public string CreateSeriesFolder(string name, int seriesId, IEnumerable<int> seasons)
    {
        var folder = MediaStorageLayout.CreateDirectory(Root, MediaStorageLayout.SeriesFolder(name, seriesId));
        foreach (var season in seasons.Where(number => number > 0)) CreateSeasonFolder(folder, season);
        return folder;
    }

    public void CreateSeasonFolder(string seriesFolder, int season) =>
        MediaStorageLayout.CreateDirectory(Root, MediaStorageLayout.RelativeFolder(Root, seriesFolder) + (season > 0 ? $"/season {season}" : "/specials"));

    public string CreateFolder(string relative) => MediaStorageLayout.CreateDirectory(Root, relative);

    /// <summary>Episode candidates inside a series folder (season N, specials, movies).</summary>
    public IEnumerable<LibraryFile> Files(int seriesId, string? seriesFolder)
    {
        if (string.IsNullOrWhiteSpace(seriesFolder) || !Directory.Exists(seriesFolder)) yield break;
        var root = MediaFilePolicy.SafePath(Root, seriesFolder);
        foreach (var folder in Directory.EnumerateDirectories(root))
        {
            if (MediaFilePolicy.FolderType(Path.GetFileName(folder)) == null) continue;
            MediaFilePolicy.SafePath(Root, folder);
            foreach (var path in Directory.EnumerateFiles(folder).Where(MediaFilePolicy.IsCandidate))
            {
                MediaFilePolicy.SafePath(Root, path);
                var info = new FileInfo(path);
                if (info.Length == 0) continue;
                yield return new LibraryFile(seriesId, info.FullName, Path.GetRelativePath(Root, path).Replace('\\', '/'), info.Length, info.LastWriteTimeUtc);
            }
        }
    }

    public LibraryFile Describe(int seriesId, string fullPath)
    {
        var info = new FileInfo(MediaFilePolicy.SafePath(Root, fullPath));
        return new LibraryFile(seriesId, info.FullName, Path.GetRelativePath(Root, info.FullName).Replace('\\', '/'), info.Length, info.LastWriteTimeUtc);
    }

    public static void EnsureUnchanged(LibraryFile file)
    {
        var current = new FileInfo(file.FullPath);
        if (!current.Exists || current.Length != file.Size || current.LastWriteTimeUtc != file.ModifiedUtc)
            throw new IOException("Source file changed while processing; waiting for a complete upload.");
    }

    /// <summary>Stores an uploaded video under a unique name after probing it; incompatible files are kept for the transcoder.</summary>
    public async Task<(string FullPath, MediaInfo Info)> SaveVideoAsync(FileUpload file, string folder, string? fileName, long maxBytes, CancellationToken token)
    {
        var original = Path.GetFileName(file.FileName ?? "");
        if (string.IsNullOrWhiteSpace(original) || !MediaFilePolicy.IsCandidate(original))
            throw new BadRequestException($"El formato «{Path.GetExtension(original)}» no es compatible con el procesador de video.");
        if (file.Length <= 0 || file.Length > maxBytes)
            throw new BadRequestException($"El archivo debe pesar entre 1 byte y {maxBytes / 1024 / 1024} MB.");
        var directory = CreateFolder(folder);
        if (new DriveInfo(Path.GetPathRoot(directory)!).AvailableFreeSpace < file.Length + 512L * 1024 * 1024)
            throw new BadRequestException("No hay espacio libre suficiente para este archivo.");
        var destination = Path.Combine(directory, UniqueName(directory, fileName ?? SanitizeFileName(original)));
        var temporary = Path.Combine(directory, $".upload-{Guid.NewGuid():N}.part");
        try
        {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, FileOptions.Asynchronous))
            await using (var source = file.OpenReadStream())
                await source.CopyToAsync(stream, token);
            var info = await probe.ReadAsync(temporary, token, Path.GetExtension(original));
            File.Move(temporary, destination, overwrite: false);
            return (destination, info);
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    /// <summary>Decodes and re-encodes an image as WebP, dropping metadata and any appended payload.</summary>
    public async Task<string> SaveImageAsync(FileUpload file, string folder)
    {
        var limits = uploadSettings.Value;
        var maxBytes = (long)Math.Max(1, limits.MaxFileSizeMB) * 1024 * 1024;
        if (file.Length <= 0 || file.Length > maxBytes)
            throw new BadRequestException($"La imagen debe pesar como máximo {limits.MaxFileSizeMB} MB.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (limits.AllowedExtensions.Count > 0 && !limits.AllowedExtensions.Contains(extension))
            throw new BadRequestException($"El tipo de archivo «{extension}» no está permitido.");

        var directory = CreateFolder(folder);
        var output = Path.Combine(directory, $"{Guid.NewGuid():N}.webp");
        var temporary = Path.Combine(directory, $".upload-{Guid.NewGuid():N}.part");
        try
        {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew))
            await using (var source = file.OpenReadStream())
                await source.CopyToAsync(stream);
            var metadata = await runner.RunAsync(probe.Binary("ffprobe"),
                ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", temporary],
                TimeSpan.FromSeconds(10), CancellationToken.None);
            using var json = JsonDocument.Parse(metadata);
            var streams = json.RootElement.GetProperty("streams").EnumerateArray().ToArray();
            if (streams.Length != 1 || streams[0].GetProperty("codec_name").GetString() is not ("png" or "mjpeg" or "webp") ||
                streams[0].GetProperty("width").GetInt32() is < 1 or > 8192 ||
                streams[0].GetProperty("height").GetInt32() is < 1 or > 8192 ||
                (long)streams[0].GetProperty("width").GetInt32() * streams[0].GetProperty("height").GetInt32() > 16_000_000)
                throw new BadRequestException("Sube una imagen PNG, JPEG o WebP válida de hasta 16 megapíxeles.");
            await runner.RunAsync(probe.Binary("ffmpeg"),
                ["-v", "error", "-xerror", "-nostdin", "-threads", "1", "-protocol_whitelist", "file,pipe", "-i", temporary,
                 "-frames:v", "1", "-map_metadata", "-1", "-c:v", "libwebp", "-threads", "1", "-quality", "85", "-f", "webp", output],
                TimeSpan.FromSeconds(15), CancellationToken.None);
        }
        catch (Exception error) when (error is IOException or JsonException or KeyNotFoundException or InvalidOperationException or OperationCanceledException)
        {
            if (File.Exists(output)) File.Delete(output);
            throw new BadRequestException("La imagen no se pudo decodificar de forma segura.");
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
        return PublicPath(output);
    }

    /// <summary>Deletes a stored file if it is inside the library (never follows links).</summary>
    public void DeleteIfExists(string? publicPath)
    {
        if (string.IsNullOrWhiteSpace(publicPath)) return;
        try
        {
            var path = MediaFilePolicy.SafePath(Root, ResolvePublicPath(publicPath));
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
    }

    public static string SanitizeFileName(string fileName)
    {
        var invalid = new HashSet<char>(Path.GetInvalidFileNameChars()) { ':', '/', '\\' };
        var extension = Path.GetExtension(fileName);
        var name = new string(Path.GetFileNameWithoutExtension(fileName).Select(character => invalid.Contains(character) || char.IsControl(character) ? '-' : character).ToArray())
            .Trim().TrimEnd('.');
        return string.IsNullOrEmpty(name) ? $"video{extension}" : name + extension;
    }

    private static string UniqueName(string directory, string fileName)
    {
        if (!File.Exists(Path.Combine(directory, fileName))) return fileName;
        var name = Path.GetFileNameWithoutExtension(fileName);
        var extension = Path.GetExtension(fileName);
        for (var index = 1; ; index++)
        {
            var candidate = $"{name} ({index}){extension}";
            if (!File.Exists(Path.Combine(directory, candidate))) return candidate;
        }
    }
}
