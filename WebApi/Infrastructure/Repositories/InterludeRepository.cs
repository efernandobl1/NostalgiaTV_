using System.Data;
using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using ApplicationCore.Settings;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Infrastructure.Repositories;

/// <summary>Bumpers and ads library. Only approved interludes reach the schedule.</summary>
public sealed class InterludeRepository(NostalgiaTVContext context, MediaLibrary library, MediaProbe probe, IScheduleRepository schedule,
    IOptions<SeriesUploadSettings> uploads) : IInterludeRepository
{
    /// <summary>Weight and gap of a scanned bumper, the same defaults as the "Asignar interludio" dialog.</summary>
    private const int ScanWeight = 3, ScanGapSeconds = 900;

    public async Task<IReadOnlyList<InterludeItem>> ListAsync(InterludeQuery query)
    {
        var interludes = context.Interludes.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Kind)) interludes = interludes.Where(item => item.Kind == query.Kind);
        if (!string.IsNullOrWhiteSpace(query.Season)) interludes = interludes.Where(item => item.Season == query.Season);
        if (query.Approved is bool approved) interludes = interludes.Where(item => item.ApprovedForBroadcast == approved);
        if (!string.IsNullOrWhiteSpace(query.Search)) interludes = interludes.Where(item => item.Title.Contains(query.Search.Trim()));
        return await Project(interludes.OrderBy(item => item.Kind).ThenBy(item => item.Title)).ToListAsync();
    }

    public async Task<InterludeItem> UploadAsync(InterludeRequest request, FileUpload file, CancellationToken token)
    {
        var maxBytes = (long)Math.Max(1, uploads.Value.MaxFileSizeMB) * 1024 * 1024;
        var (path, info) = await library.SaveVideoAsync(file, MediaStorageLayout.BroadcastFolder(request.Kind), null, maxBytes, token);
        if (!info.Compatible || info.Duration <= 0)
        {
            library.DeleteIfExists(library.PublicPath(path));
            throw new BadRequestException("Los interludios deben ser MP4 H.264/AAC compatibles con el navegador. " + info.IncompatibilityReason);
        }
        var interlude = new Interlude
        {
            FilePath = library.PublicPath(path),
            DurationSeconds = decimal.Round((decimal)info.Duration, 3)
        };
        Apply(interlude, request, Path.GetFileNameWithoutExtension(file.FileName));
        context.Interludes.Add(interlude);
        try { await context.SaveChangesAsync(token); }
        catch
        {
            library.DeleteIfExists(interlude.FilePath);
            throw;
        }
        return await GetAsync(interlude.Id);
    }

    public async Task<(InterludeItem Item, IReadOnlyList<int> AffectedChannels)> UpdateAsync(int id, InterludeRequest request)
    {
        var interlude = await context.Interludes.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        // The file stays where it was uploaded; only the metadata changes.
        Apply(interlude, request, interlude.Title);
        await context.SaveChangesAsync();
        var channels = await RefreshAsync(id);
        return (await GetAsync(id), channels);
    }

    public async Task<IReadOnlyList<int>> SetApprovalAsync(int id, bool approved)
    {
        var interlude = await context.Interludes.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        if (interlude.ApprovedForBroadcast == approved) return [];
        interlude.ApprovedForBroadcast = approved;
        await context.SaveChangesAsync();
        return await RefreshAsync(id);
    }

    /// <summary>Soft delete: past schedule rows keep pointing at it, upcoming ones are rebuilt without it.</summary>
    public async Task DeleteAsync(int id)
    {
        var interlude = await context.Interludes.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        var channels = await ChannelsAiringAsync(id);
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.ChannelEraInterludes.Where(item => item.InterludeId == id).ExecuteDeleteAsync();
        await context.ChannelEraSeriesInterludes.Where(item => item.InterludeId == id).ExecuteDeleteAsync();
        interlude.ApprovedForBroadcast = false;
        interlude.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        foreach (var channelId in channels) await schedule.RegenerateAsync(channelId, replaceCurrent: false);
    }

    public async Task<EraFolderScan> ScanEraFolderAsync(int channelId, int eraId, CancellationToken token)
    {
        var era = await context.ChannelEras.SingleOrDefaultAsync(item => item.Id == eraId && item.ChannelId == channelId, token)
            ?? throw new NotFoundException("Era no encontrada.");
        var folder = await EraFolderAsync(era, token);
        var known = (await context.Interludes.IgnoreQueryFilters().AsNoTracking()
                .Select(item => new { item.Id, item.FilePath, Deleted = item.DeletedAtUtc != null }).ToListAsync(token))
            .DistinctBy(item => item.FilePath, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(item => item.FilePath, StringComparer.OrdinalIgnoreCase);

        // Web copies made by the transcoder are complete; anything else may still be uploading.
        var converted = (await context.MediaProcessingJobs.AsNoTracking()
                .Where(job => job.ChannelEraId == era.Id && job.Status == MediaJobStatus.Completed && job.OutputPath != null)
                .Select(job => job.OutputPath!).ToListAsync(token))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Probe outside the transaction: ffprobe can take a while per file.
        var compatible = new List<(string PublicPath, string Title, double Duration)>();
        var existing = new List<int>();
        int converting = 0, skipped = 0;
        foreach (var file in EraFiles(folder))
        {
            token.ThrowIfCancellationRequested();
            // An original kept next to its web copy: the copy is the bumper.
            if (MediaFilePolicy.IsConverted(file.FullPath)) continue;
            var publicPath = MediaLibrary.PublicPrefix + file.RelativePath;
            if (known.TryGetValue(publicPath, out var interlude))
            {
                // A bumper deleted from the library stays deleted.
                if (interlude.Deleted) skipped++;
                else existing.Add(interlude.Id);
                continue;
            }
            if (!converted.Contains(file.RelativePath) && file.ModifiedUtc > DateTime.UtcNow - LibraryImporter.SettleTime) { skipped++; continue; }
            MediaInfo info;
            try { info = await probe.ReadAsync(file.FullPath, token); }
            catch (IOException) { skipped++; continue; }
            if (info.Compatible) compatible.Add((publicPath, BumperTitle(file.FullPath), info.Duration));
            else if (await QueueConversionAsync(era.Id, file, info, token)) converting++;
            else skipped++;
        }

        var assignedNow = new List<int>();
        await using (var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, token))
        {
            await context.Database.LockAsync($"era-interludes-{era.Id}", token);
            var added = new List<Interlude>();
            foreach (var (publicPath, title, duration) in compatible)
            {
                // A concurrent scan may have imported it after the probe.
                if (await context.Interludes.IgnoreQueryFilters().AnyAsync(item => item.FilePath == publicPath, token)) { skipped++; continue; }
                var interlude = new Interlude
                {
                    Title = title, Kind = InterludeKind.Bumper, BumperType = BumperType.Generic, Season = InterludeSeason.AllYear,
                    FilePath = publicPath, DurationSeconds = decimal.Round((decimal)duration, 3), ApprovedForBroadcast = true
                };
                context.Interludes.Add(interlude);
                added.Add(interlude);
            }
            await context.SaveChangesAsync(token);
            var assigned = await context.ChannelEraInterludes.Where(link => link.ChannelEraId == era.Id).Select(link => link.InterludeId).ToListAsync(token);
            assignedNow = added.Select(item => item.Id).Concat(existing).Except(assigned).ToList();
            foreach (var id in assignedNow)
                context.ChannelEraInterludes.Add(new ChannelEraInterlude { ChannelEraId = era.Id, InterludeId = id, Weight = ScanWeight, MinimumGapSeconds = ScanGapSeconds });
            await context.SaveChangesAsync(token);
            await transaction.CommitAsync(token);
        }
        // Bumpers already in the library and already assigned to the era are left as they are.
        skipped += existing.Except(assignedNow).Count();
        if (assignedNow.Count > 0 && await context.ChannelEraSelections.AnyAsync(selection => selection.ChannelId == channelId && selection.ChannelEraId == era.Id, token))
            await schedule.RegenerateAsync(channelId, replaceCurrent: false);
        return new EraFolderScan(MediaLibrary.PublicPrefix + MediaStorageLayout.RelativeFolder(library.Root, folder), assignedNow.Count, converting, skipped);
    }

    /// <summary>
    /// The era's folder: the one created with the era, or the v1 folder kept by the data migration (an absolute path that
    /// must still be inside the media library). Eras without one get the standard folder.
    /// </summary>
    private async Task<string> EraFolderAsync(ChannelEra era, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(era.FolderPath))
        {
            era.FolderPath = MediaStorageLayout.EraFolder(era.ChannelId, era.Id);
            await context.SaveChangesAsync(token);
        }
        var path = Path.GetFullPath(Path.IsPathRooted(era.FolderPath) ? era.FolderPath : Path.Combine(library.Root, era.FolderPath));
        string relative;
        try { relative = MediaStorageLayout.RelativeFolder(library.Root, path); }
        catch (IOException) { throw new BadRequestException("La carpeta de la era está fuera de la biblioteca de medios."); }
        try { return library.CreateFolder(relative); }
        catch (IOException) { throw new BadRequestException("La carpeta de la era no es válida (no se aceptan enlaces simbólicos)."); }
    }

    /// <summary>Video files directly in the era folder and in its "bumpers" subfolder (the v1 layout).</summary>
    private IEnumerable<LibraryFile> EraFiles(string folder)
    {
        var bumpers = Path.Combine(folder, "bumpers");
        foreach (var directory in Directory.Exists(bumpers) ? [folder, bumpers] : new[] { folder })
        {
            MediaFilePolicy.SafePath(library.Root, directory);
            foreach (var path in Directory.EnumerateFiles(directory).Where(MediaFilePolicy.IsCandidate).Order(StringComparer.OrdinalIgnoreCase))
            {
                var file = library.Describe(0, path);
                if (file.Size > 0) yield return file;
            }
        }
    }

    /// <summary>Hands an incompatible file to the transcode worker once; returns whether it is (still) converting.</summary>
    private async Task<bool> QueueConversionAsync(int eraId, LibraryFile file, MediaInfo info, CancellationToken token)
    {
        var status = await context.MediaProcessingJobs.AsNoTracking()
            .Where(job => job.Worker == MediaWorkers.Transcode && job.Fingerprint == file.Fingerprint).Select(job => job.Status).FirstOrDefaultAsync(token);
        if (status != null) return status is MediaJobStatus.Queued or MediaJobStatus.Processing;
        var now = DateTime.UtcNow;
        context.MediaProcessingJobs.Add(new MediaProcessingJob
        {
            Worker = MediaWorkers.Transcode, ChannelEraId = eraId, Fingerprint = file.Fingerprint, SourcePath = file.RelativePath,
            SourceSize = file.Size, SourceModifiedUtc = file.ModifiedUtc, Status = MediaJobStatus.Queued, CreatedAtUtc = now, UpdatedAtUtc = now,
            Message = "Conversión necesaria: " + info.IncompatibilityReason
        });
        await context.SaveChangesAsync(token);
        return true;
    }

    private static string BumperTitle(string path)
    {
        var name = Path.GetFileNameWithoutExtension(path);
        if (name.EndsWith(".web", StringComparison.OrdinalIgnoreCase)) name = name[..^4];
        name = name.Replace('_', ' ').Trim();
        return name.Length == 0 ? "Bumper" : name.Length > 300 ? name[..300] : name;
    }

    private async Task<InterludeItem> GetAsync(int id) =>
        await Project(context.Interludes.AsNoTracking().Where(item => item.Id == id)).SingleOrDefaultAsync() ?? throw NotFound();

    private IQueryable<InterludeItem> Project(IQueryable<Interlude> interludes) => interludes.Select(item => new InterludeItem(item.Id, item.Title,
        item.Kind, item.BumperType, item.Season, item.FilePath, item.DurationSeconds, item.ApprovedForBroadcast, item.RedistributionAllowed,
        item.License, item.SourceUrl, item.RegionCode, item.OriginalYearFrom, item.OriginalYearTo,
        context.ChannelEraInterludes.Where(link => link.InterludeId == item.Id && link.ChannelEra.DeletedAtUtc == null).Select(link => link.ChannelEraId)
            .Union(context.ChannelEraSeriesInterludes.Where(link => link.InterludeId == item.Id && link.ChannelEraSeries.ChannelEra.DeletedAtUtc == null)
                .Select(link => link.ChannelEraId)).Count()));

    private static void Apply(Interlude interlude, InterludeRequest request, string fallbackTitle)
    {
        var title = string.IsNullOrWhiteSpace(request.Title) ? fallbackTitle.Trim() : request.Title.Trim();
        interlude.Title = string.IsNullOrEmpty(title) ? "Interludio" : title.Length > 300 ? title[..300] : title;
        interlude.Kind = request.Kind;
        interlude.BumperType = request.Kind == InterludeKind.Bumper ? request.BumperType : null;
        interlude.Season = request.Season;
        interlude.RedistributionAllowed = request.RedistributionAllowed;
        interlude.License = string.IsNullOrWhiteSpace(request.License) ? null : request.License.Trim();
        interlude.SourceUrl = string.IsNullOrWhiteSpace(request.SourceUrl) ? null : request.SourceUrl.Trim();
        interlude.RegionCode = string.IsNullOrWhiteSpace(request.RegionCode) ? null : request.RegionCode.Trim().ToUpperInvariant();
        interlude.OriginalYearFrom = request.OriginalYearFrom;
        interlude.OriginalYearTo = request.OriginalYearTo;
    }

    /// <summary>Channels whose era on air uses the interlude, era-wide or for one of its series.</summary>
    private Task<List<int>> ChannelsAiringAsync(int interludeId) =>
        context.ChannelEraSelections.Where(selection =>
                context.ChannelEraInterludes.Any(link => link.ChannelEraId == selection.ChannelEraId && link.InterludeId == interludeId)
                || context.ChannelEraSeriesInterludes.Any(link => link.ChannelEraId == selection.ChannelEraId && link.InterludeId == interludeId))
            .Select(selection => selection.ChannelId).ToListAsync();

    private async Task<IReadOnlyList<int>> RefreshAsync(int interludeId)
    {
        var channels = await ChannelsAiringAsync(interludeId);
        foreach (var channelId in channels) await schedule.RegenerateAsync(channelId, replaceCurrent: false);
        return channels;
    }

    private static NotFoundException NotFound() => new("Interludio no encontrado.");
}
