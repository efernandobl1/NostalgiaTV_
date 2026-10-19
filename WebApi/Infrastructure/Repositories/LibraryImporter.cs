using System.Data;
using ApplicationCore.Entities;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

/// <summary>
/// Turns validated video files of a series folder into catalog episodes and marks vanished files as
/// unavailable. Shared by dashboard uploads/scans and the media worker; never deletes episodes.
/// </summary>
public sealed class LibraryImporter(NostalgiaTVContext context, MediaLibrary library, MediaProbe probe)
{
    /// <summary>Files younger than this may still be uploading over SFTP.</summary>
    public static readonly TimeSpan SettleTime = TimeSpan.FromSeconds(120);

    public async Task<int> ImportAsync(LibraryFile file, CancellationToken token)
    {
        var info = await probe.ReadAsync(MediaFilePolicy.SafePath(library.Root, file.FullPath), token);
        if (!info.Compatible) throw new IOException("Only web-compatible MP4/H.264/AAC files can be indexed.");
        MediaLibrary.EnsureUnchanged(file);
        var (season, typeId) = MediaFilePolicy.FolderType(Path.GetFileName(Path.GetDirectoryName(file.FullPath)!))
            ?? throw new IOException("Unknown episode folder.");
        var publicPath = MediaLibrary.PublicPrefix + file.RelativePath;

        await using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, token);
        await context.Database.LockAsync($"media-series-{file.SeriesId}", token);
        // A transcoded file replaces its original: keep the episode (and its metadata) that pointed to the source.
        var original = await context.MediaProcessingJobs.AsNoTracking()
            .Where(job => job.SeriesId == file.SeriesId && job.Worker == MediaWorkers.Transcode
                && job.Status == MediaJobStatus.Completed && job.OutputPath == file.RelativePath)
            .OrderByDescending(job => job.Id).Select(job => job.SourcePath).FirstOrDefaultAsync(token);
        var aliases = original == null ? new[] { publicPath } : [publicPath, MediaLibrary.PublicPrefix + original];
        var existing = await context.Episodes.IgnoreQueryFilters()
            .Where(episode => episode.SeriesId == file.SeriesId && episode.DeletedAtUtc == null && aliases.Contains(episode.FilePath))
            .OrderByDescending(episode => episode.FilePath == publicPath).FirstOrDefaultAsync(token);
        int episodeId;
        if (existing != null)
        {
            existing.FilePath = publicPath;
            existing.IsAvailable = true;
            await context.SaveChangesAsync(token);
            episodeId = existing.Id;
        }
        else
        {
            if (!await context.Series.AnyAsync(series => series.Id == file.SeriesId, token)) throw new IOException("Series no longer exists.");
            await EnsureSeasonAsync(file.SeriesId, season, token);
            var (title, number, part) = MediaFilePolicy.EpisodeFile(file.FullPath);
            var (episodeNumber, episodePart) = await FreeEpisodeNumberAsync(file.SeriesId, season, typeId, number, part, token);
            var episode = new Episode
            {
                SeriesId = file.SeriesId,
                SeasonNumber = season,
                EpisodeTypeId = typeId,
                EpisodeNumber = episodeNumber,
                Part = episodePart,
                Title = title.Length > 300 ? title[..300] : title,
                FilePath = publicPath
            };
            context.Episodes.Add(episode);
            await context.SaveChangesAsync(token);
            episodeId = episode.Id;
        }
        await transaction.CommitAsync(token);
        return episodeId;
    }

    /// <summary>Only a path that is really missing makes an episode unavailable; unreadable mounts abort.</summary>
    public async Task<int> ReconcileAsync(int seriesId, string? folder, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(folder)) return 0;
        _ = Directory.GetFileSystemEntries(MediaFilePolicy.SafePath(library.Root, folder));
        var episodes = await context.Episodes.AsNoTracking()
            .Where(episode => episode.SeriesId == seriesId && episode.IsAvailable && episode.FilePath != null)
            .Select(episode => new { episode.Id, episode.FilePath }).ToListAsync(token);
        var missing = episodes.Where(episode => !library.Exists(episode.FilePath!)).Select(episode => episode.Id).ToList();
        if (missing.Count > 0)
            await context.Episodes.Where(episode => missing.Contains(episode.Id))
                .ExecuteUpdateAsync(update => update.SetProperty(episode => episode.IsAvailable, false), token);
        return missing.Count;
    }

    public async Task EnsureSeasonAsync(int seriesId, int season, CancellationToken token = default)
    {
        var row = await context.SeriesSeasons.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.SeriesId == seriesId && item.SeasonNumber == season, token);
        if (row == null) context.SeriesSeasons.Add(new SeriesSeason { SeriesId = seriesId, SeasonNumber = season });
        else row.DeletedAtUtc = null;
        await context.SaveChangesAsync(token);
    }

    /// <summary>
    /// Keeps the parsed number (and part) when free; unnumbered or duplicate files become a complete episode
    /// with the next number.
    /// </summary>
    private async Task<(int Number, string? Part)> FreeEpisodeNumberAsync(int seriesId, int season, int typeId, int wanted, string? part,
        CancellationToken token)
    {
        var used = await context.Episodes.Where(episode => episode.SeriesId == seriesId && episode.SeasonNumber == season && episode.EpisodeTypeId == typeId)
            .Select(episode => new { episode.EpisodeNumber, episode.Part }).ToListAsync(token);
        if (wanted > 0 && !used.Any(item => item.EpisodeNumber == wanted && item.Part == part)) return (wanted, part);
        return (used.Count == 0 ? 1 : used.Max(item => item.EpisodeNumber) + 1, null);
    }
}
