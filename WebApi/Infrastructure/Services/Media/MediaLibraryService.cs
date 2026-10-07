using System.Data;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services.Media;

public sealed record LibraryFile(int SeriesId, string FullPath, string RelativePath, long Size, DateTime ModifiedUtc)
{
    public string Fingerprint => MediaFilePolicy.Fingerprint(SeriesId, RelativePath, Size, ModifiedUtc);
}

public sealed class MediaLibraryService(NostalgiaTVContext context, MediaProbe probe, IOptions<MediaSettings> settings)
{
    public string Root => Path.GetFullPath(settings.Value.BasePath);

    public IEnumerable<LibraryFile> Files(Series series)
    {
        if (string.IsNullOrWhiteSpace(series.FolderPath) || !Directory.Exists(series.FolderPath)) yield break;
        var root = MediaFilePolicy.SafePath(Root, series.FolderPath);
        foreach (var folder in Directory.EnumerateDirectories(root))
        {
            if (MediaFilePolicy.FolderType(Path.GetFileName(folder)) == null) continue;
            MediaFilePolicy.SafePath(Root, folder);
            foreach (var path in Directory.EnumerateFiles(folder).Where(MediaFilePolicy.IsCandidate))
            {
                MediaFilePolicy.SafePath(Root, path);
                var info = new FileInfo(path);
                if (info.Length == 0) continue;
                yield return new LibraryFile(series.Id, info.FullName, Path.GetRelativePath(Root, path).Replace('\\', '/'), info.Length, info.LastWriteTimeUtc);
            }
        }
    }

    public async Task ImportAsync(LibraryFile file, CancellationToken token)
    {
        var info = await probe.ReadAsync(MediaFilePolicy.SafePath(Root, file.FullPath), token);
        if (!info.Compatible) throw new IOException("Only web-compatible MP4/H.264/AAC files can be indexed.");
        EnsureUnchanged(file);
        var type = MediaFilePolicy.FolderType(Path.GetFileName(Path.GetDirectoryName(file.FullPath)!))
            ?? throw new IOException("Unknown episode folder.");
        var path = "wwwroot/uploads/" + file.RelativePath;
        await using var database = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>()
            .UseSqlServer(context.Database.GetConnectionString()).Options);
        // Both manual and automatic scans use the same transaction lock, without deleting episodes or schedules.
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, token);
        var resource = $"media-series-{file.SeriesId}";
        await database.Database.ExecuteSqlInterpolatedAsync($"DECLARE @result int; EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @result < 0 THROW 50000, 'Series scan lock unavailable', 1;", token);
        var conversion = await database.MediaProcessingJobs.AsNoTracking().Where(job => job.SeriesId == file.SeriesId &&
            job.Worker == "transcode" && job.Status == "Completed" && job.OutputPath == file.RelativePath)
            .OrderByDescending(job => job.Id).FirstOrDefaultAsync(token);
        var originalPath = conversion == null ? path : "wwwroot/uploads/" + conversion.SourcePath;
        var originalRelative = conversion?.SourcePath ?? file.RelativePath;
        var aliases = new[] { path, originalPath, "/uploads/" + file.RelativePath, "/uploads/" + originalRelative,
            file.FullPath, Path.Combine(Root, originalRelative) };
        var existing = await database.Episodes.Where(item => item.SeriesId == file.SeriesId &&
            aliases.Contains(item.FilePath)).OrderByDescending(item => item.FilePath == path).FirstOrDefaultAsync(token);
        if (existing != null)
        {
            existing.FilePath = path;
            existing.IsAvailable = true;
            await database.SaveChangesAsync(token);
        }
        else
        {
            var episodeType = await database.EpisodeTypes.SingleAsync(item => item.Name == type.Type, token);
            var (title, number) = MediaFilePolicy.EpisodeName(file.FullPath);
            database.Episodes.Add(new Episode { SeriesId = file.SeriesId, Title = title, EpisodeNumber = number,
                Season = type.Season, EpisodeTypeId = episodeType.Id, FilePath = path });
            var series = await database.Series.FindAsync([file.SeriesId], token) ?? throw new IOException("Series no longer exists.");
            series.Seasons = Math.Max(series.Seasons, type.Season);
            await database.SaveChangesAsync(token);
        }
        await transaction.CommitAsync(token);
    }

    public async Task ScanSeriesAsync(Series series, CancellationToken token)
    {
        await ReconcileAsync(series, token);
        foreach (var file in Files(series))
        {
            if (file.ModifiedUtc > DateTime.UtcNow.AddSeconds(-120)) continue;
            try
            {
                var info = await probe.ReadAsync(file.FullPath, token);
                if (info.Compatible) await ImportAsync(file, token);
            }
            catch (IOException) { /* Invalid or unfinished files are never added to the catalogue. */ }
        }
    }

    public string ResolveEpisodePath(string path)
    {
        var relative = path.Replace('\\', '/');
        if (relative.StartsWith("wwwroot/uploads/", StringComparison.OrdinalIgnoreCase)) relative = relative[16..];
        else if (relative.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase)) relative = relative[9..];
        return Path.GetFullPath(Path.Combine(Root, relative));
    }

    public long? FileSize(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        try { return new FileInfo(MediaFilePolicy.SafePath(Root, ResolveEpisodePath(path))).Length; }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException) { return null; }
    }

    public async Task ReconcileAsync(Series series, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(series.FolderPath)) return;
        // An absent/unreadable mount is not evidence that the user deleted every episode.
        var folder = MediaFilePolicy.SafePath(Root, series.FolderPath);
        _ = Directory.GetFileSystemEntries(folder);
        var episodes = await context.Episodes.AsNoTracking().Where(episode => episode.SeriesId == series.Id && episode.IsAvailable)
            .ToListAsync(token);
        var missing = new List<int>();
        foreach (var episode in episodes)
        {
            if (string.IsNullOrWhiteSpace(episode.FilePath)) continue;
            var path = ResolveEpisodePath(episode.FilePath);
            try { MediaFilePolicy.SafePath(Root, path); }
            catch (Exception exception) when (exception is FileNotFoundException or DirectoryNotFoundException)
            {
                // Only an actual missing path changes availability; permission and safety errors abort the scan.
                missing.Add(episode.Id);
            }
        }
        if (missing.Count > 0)
            await context.Episodes.Where(episode => missing.Contains(episode.Id))
                .ExecuteUpdateAsync(update => update.SetProperty(episode => episode.IsAvailable, false), token);
    }

    public static void EnsureUnchanged(LibraryFile file)
    {
        var current = new FileInfo(file.FullPath);
        if (!current.Exists || current.Length != file.Size || current.LastWriteTimeUtc != file.ModifiedUtc)
            throw new IOException("Source file changed while processing; waiting for a complete upload.");
    }
}
