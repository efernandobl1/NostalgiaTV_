using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using ApplicationCore.Settings;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Repositories;

public sealed class SeriesRepository(NostalgiaTVContext context, MediaLibrary library, LibraryImporter importer,
    IScheduleRepository schedule, IOptions<SeriesUploadSettings> uploads, ILogger<SeriesRepository> logger) : ISeriesRepository
{
    // ── Admin ──

    public async Task<IReadOnlyList<SeriesListItem>> ListAsync(string? search)
    {
        var query = context.Series.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(series => series.Name.Contains(search.Trim()));
        return await query.OrderBy(series => series.Name)
            .Select(series => new SeriesListItem(series.Id, series.Name, series.LogoPath, series.StartDate, series.EndDate, series.Rating,
                series.Categories.Where(link => link.Category.DeletedAtUtc == null).OrderBy(link => link.Category.Name)
                    .Select(link => new IdName(link.CategoryId, link.Category.Name)).ToList(),
                series.Seasons.OrderBy(season => season.SeasonNumber).Select(season => season.SeasonNumber).ToList(),
                context.Episodes.Count(episode => episode.SeriesId == series.Id && episode.IsAvailable && episode.FilePath != null),
                context.Episodes.Count(episode => episode.SeriesId == series.Id && (!episode.IsAvailable || episode.FilePath == null)),
                context.ChannelEraSelections.Count(selection => context.ChannelEraSeries.Any(link =>
                    link.ChannelEraId == selection.ChannelEraId && link.SeriesId == series.Id))))
            .ToListAsync();
    }

    public async Task<SeriesDetail> GetAsync(int id)
    {
        var series = await context.Series.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        var categories = await context.SeriesCategories.AsNoTracking().Where(link => link.SeriesId == id && link.Category.DeletedAtUtc == null)
            .OrderBy(link => link.Category.Name).Select(link => new IdName(link.CategoryId, link.Category.Name)).ToListAsync();
        var seasons = await context.SeriesSeasons.AsNoTracking().Where(season => season.SeriesId == id).OrderBy(season => season.SeasonNumber)
            .Select(season => new SeasonSummary(season.SeasonNumber,
                season.Episodes.Count(episode => episode.DeletedAtUtc == null && episode.IsAvailable && episode.FilePath != null),
                season.Episodes.Count(episode => episode.DeletedAtUtc == null && (!episode.IsAvailable || episode.FilePath == null))))
            .ToListAsync();
        var externalIds = await context.SeriesExternalIds.AsNoTracking().Where(external => external.SeriesId == id)
            .OrderBy(external => external.Provider.Code)
            .Select(external => new ExternalIdItem(external.ProviderId, external.Provider.Code, external.Provider.Name, external.ExternalId))
            .ToListAsync();
        return new SeriesDetail(series.Id, series.Name, series.Description, series.History, series.LogoPath, series.FolderPath,
            series.Rating, series.StartDate, series.EndDate, categories, seasons, externalIds);
    }

    public async Task<SeriesDetail> CreateAsync(SeriesRequest request, FileUpload? logo)
    {
        var categories = await ValidCategoriesAsync(request.CategoryIds);
        var series = new Series();
        Apply(series, request);
        await using var transaction = await context.Database.BeginTransactionAsync();
        context.Series.Add(series);
        await context.SaveChangesAsync();
        var seasons = Enumerable.Range(1, request.InitialSeasons).ToList();
        context.SeriesSeasons.AddRange(seasons.Select(number => new SeriesSeason { SeriesId = series.Id, SeasonNumber = number }));
        context.SeriesCategories.AddRange(categories.Select(category => new SeriesCategory { SeriesId = series.Id, CategoryId = category }));
        series.FolderPath = library.CreateSeriesFolder(series.Name, series.Id, seasons);
        if (logo != null) series.LogoPath = await library.SaveImageAsync(logo, MediaStorageLayout.RelativeFolder(library.Root, series.FolderPath));
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return await GetAsync(series.Id);
    }

    public async Task<SeriesDetail> UpdateAsync(int id, SeriesRequest request, FileUpload? logo)
    {
        var series = await context.Series.Include(item => item.Categories).SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        Apply(series, request);
        if (request.CategoryIds != null) await ReplaceCategoriesAsync(series, request.CategoryIds);
        series.FolderPath ??= library.CreateSeriesFolder(series.Name, series.Id, await SeasonNumbersAsync(id));
        if (logo != null)
        {
            var previous = series.LogoPath;
            series.LogoPath = await library.SaveImageAsync(logo, MediaStorageLayout.RelativeFolder(library.Root, series.FolderPath));
            library.DeleteIfExists(previous);
        }
        await context.SaveChangesAsync();
        return await GetAsync(id);
    }

    public async Task DeleteAsync(int id)
    {
        var series = await context.Series.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        var channels = await ChannelsAiringAsync(id);
        var now = DateTime.UtcNow;
        await using var transaction = await context.Database.BeginTransactionAsync();
        // Leaving every lineup also removes its season filters and series-scoped interludes (cascade).
        await context.ChannelEraSeries.Where(link => link.SeriesId == id).ExecuteDeleteAsync();
        await context.Episodes.Where(episode => episode.SeriesId == id)
            .ExecuteUpdateAsync(update => update.SetProperty(episode => episode.DeletedAtUtc, now).SetProperty(episode => episode.IsAvailable, false));
        await context.SeriesSeasons.Where(season => season.SeriesId == id).ExecuteUpdateAsync(update => update.SetProperty(season => season.DeletedAtUtc, now));
        await context.SeriesExternalIds.Where(external => external.SeriesId == id).ExecuteUpdateAsync(update => update.SetProperty(external => external.DeletedAtUtc, now));
        series.DeletedAtUtc = now;
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        await RefreshAsync(channels);
    }

    public async Task<SeriesDetail> SetCategoriesAsync(int id, CategoriesRequest request)
    {
        var series = await context.Series.Include(item => item.Categories).SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        await ReplaceCategoriesAsync(series, request.CategoryIds);
        await context.SaveChangesAsync();
        return await GetAsync(id);
    }

    public async Task<SeriesDetail> AddSeasonAsync(int id, SeasonRequest request)
    {
        var series = await context.Series.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        if (await context.SeriesSeasons.AnyAsync(season => season.SeriesId == id && season.SeasonNumber == request.SeasonNumber))
            throw new ConflictException("Esa temporada ya existe.");
        await importer.EnsureSeasonAsync(id, request.SeasonNumber);
        series.FolderPath ??= library.CreateSeriesFolder(series.Name, series.Id, []);
        library.CreateSeasonFolder(series.FolderPath, request.SeasonNumber);
        await context.SaveChangesAsync();
        return await GetAsync(id);
    }

    public async Task<SeriesDetail> RemoveSeasonAsync(int id, int seasonNumber)
    {
        var season = await context.SeriesSeasons.SingleOrDefaultAsync(item => item.SeriesId == id && item.SeasonNumber == seasonNumber)
            ?? throw new NotFoundException("Temporada no encontrada.");
        if (await context.Episodes.AnyAsync(episode => episode.SeriesId == id && episode.SeasonNumber == seasonNumber))
            throw new ConflictException("La temporada tiene episodios; elimínalos o muévelos primero.");
        var channels = await ChannelsAiringAsync(id);
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.ChannelEraSelectedSeasons.Where(item => item.SeriesId == id && item.SeasonNumber == seasonNumber).ExecuteDeleteAsync();
        season.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        await RefreshAsync(channels);
        return await GetAsync(id);
    }

    public async Task<IReadOnlyList<EpisodeItem>> ListEpisodesAsync(int seriesId, int? seasonNumber)
    {
        if (!await context.Series.AnyAsync(series => series.Id == seriesId)) throw NotFound();
        var query = context.Episodes.AsNoTracking().Where(episode => episode.SeriesId == seriesId);
        if (seasonNumber.HasValue) query = query.Where(episode => episode.SeasonNumber == seasonNumber);
        var episodes = await query.OrderBy(episode => episode.SeasonNumber).ThenBy(episode => episode.EpisodeTypeId)
            .ThenBy(episode => episode.EpisodeNumber).ThenBy(episode => episode.Part).ThenBy(episode => episode.Id)
            .Select(episode => new EpisodeItem(episode.Id, episode.SeriesId, episode.SeasonNumber, episode.EpisodeNumber, episode.EpisodeTypeId,
                episode.EpisodeType.Name, episode.Title, episode.FilePath, episode.IsAvailable, null,
                episode.BreakPoints.Count(point => point.DeletedAtUtc == null), episode.Part))
            .ToListAsync();
        return episodes.Select(episode => episode with { FileSizeBytes = library.FileSize(episode.FilePath) }).ToList();
    }

    public async Task<EpisodeItem> UpdateEpisodeAsync(int episodeId, EpisodeRequest request)
    {
        var episode = await context.Episodes.SingleOrDefaultAsync(item => item.Id == episodeId) ?? throw new NotFoundException("Episodio no encontrado.");
        if (!await context.EpisodeTypes.AnyAsync(type => type.Id == request.EpisodeTypeId)) throw new BadRequestException("El tipo de episodio no existe.");
        var part = string.IsNullOrWhiteSpace(request.EpisodePart) ? null : request.EpisodePart.Trim().ToUpperInvariant();
        if (await context.Episodes.AnyAsync(item => item.Id != episodeId && item.SeriesId == episode.SeriesId && item.SeasonNumber == request.SeasonNumber
            && item.EpisodeTypeId == request.EpisodeTypeId && item.EpisodeNumber == request.EpisodeNumber && item.Part == part))
            throw new ConflictException("Ya existe un episodio con esa temporada, tipo, número y parte.");
        await importer.EnsureSeasonAsync(episode.SeriesId, request.SeasonNumber);
        episode.Title = request.Title.Trim();
        episode.SeasonNumber = request.SeasonNumber;
        episode.EpisodeNumber = request.EpisodeNumber;
        episode.Part = part;
        episode.EpisodeTypeId = request.EpisodeTypeId;
        await context.SaveChangesAsync();
        return (await ListEpisodesAsync(episode.SeriesId, request.SeasonNumber)).Single(item => item.Id == episodeId);
    }

    public async Task DeleteEpisodeAsync(int episodeId)
    {
        var episode = await context.Episodes.SingleOrDefaultAsync(item => item.Id == episodeId) ?? throw new NotFoundException("Episodio no encontrado.");
        var channels = await ChannelsAiringAsync(episode.SeriesId);
        episode.DeletedAtUtc = DateTime.UtcNow;
        episode.IsAvailable = false;
        await context.EpisodeBreakPoints.Where(point => point.EpisodeId == episodeId)
            .ExecuteUpdateAsync(update => update.SetProperty(point => point.DeletedAtUtc, DateTime.UtcNow));
        await context.SaveChangesAsync();
        await RefreshAsync(channels);
    }

    public async Task<IReadOnlyList<BreakPointItem>> ListBreakPointsAsync(int episodeId)
    {
        if (!await context.Episodes.AnyAsync(episode => episode.Id == episodeId)) throw new NotFoundException("Episodio no encontrado.");
        return await context.EpisodeBreakPoints.AsNoTracking().Where(point => point.EpisodeId == episodeId).OrderBy(point => point.OffsetSeconds)
            .Select(point => new BreakPointItem(point.Id, point.EpisodeId, point.OffsetSeconds, point.Label)).ToListAsync();
    }

    public async Task<BreakPointItem> AddBreakPointAsync(int episodeId, BreakPointRequest request)
    {
        if (!await context.Episodes.AnyAsync(episode => episode.Id == episodeId)) throw new NotFoundException("Episodio no encontrado.");
        var offset = decimal.Round(request.OffsetSeconds, 3);
        if (await context.EpisodeBreakPoints.AnyAsync(point => point.EpisodeId == episodeId && point.OffsetSeconds == offset))
            throw new ConflictException("Ya existe un punto de corte en ese segundo.");
        var point = new EpisodeBreakPoint { EpisodeId = episodeId, OffsetSeconds = offset, Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim() };
        context.EpisodeBreakPoints.Add(point);
        await context.SaveChangesAsync();
        return new BreakPointItem(point.Id, point.EpisodeId, point.OffsetSeconds, point.Label);
    }

    public async Task<IReadOnlyList<int>> DeleteBreakPointAsync(int episodeId, int breakPointId)
    {
        var point = await context.EpisodeBreakPoints.SingleOrDefaultAsync(item => item.Id == breakPointId && item.EpisodeId == episodeId)
            ?? throw new NotFoundException("Punto de corte no encontrado.");
        // Upcoming programs that break at this point are rebuilt without it.
        var channels = await context.ScheduledAdBreaks.AsNoTracking().Where(item => item.EpisodeBreakPointId == breakPointId)
            .Select(item => item.ScheduledProgram.ChannelEra.ChannelId).Distinct().ToListAsync();
        point.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
        await RefreshAsync(channels);
        return channels;
    }

    public async Task<IReadOnlyList<EpisodeUploadResult>> UploadEpisodesAsync(int seriesId, EpisodeUploadTarget target,
        IReadOnlyList<FileUpload> files, CancellationToken token)
    {
        var series = await context.Series.SingleOrDefaultAsync(item => item.Id == seriesId, token) ?? throw NotFound();
        if (files.Count == 0) throw new BadRequestException("No se recibió ningún archivo.");
        series.FolderPath ??= library.CreateSeriesFolder(series.Name, series.Id, await SeasonNumbersAsync(seriesId));
        await context.SaveChangesAsync(token);
        if (target.SeasonNumber is int season) await importer.EnsureSeasonAsync(seriesId, season, token);
        var folder = MediaStorageLayout.RelativeFolder(library.Root, series.FolderPath) + "/" +
            (target.Folder == "season" ? $"season {target.SeasonNumber}" : target.Folder);
        var maxBytes = (long)Math.Max(1, uploads.Value.MaxFileSizeMB) * 1024 * 1024;

        var results = new List<EpisodeUploadResult>();
        foreach (var file in files)
        {
            var name = Path.GetFileName(file.FileName ?? "");
            try
            {
                var (path, info) = await library.SaveVideoAsync(file, folder, null, maxBytes, token);
                if (!info.Compatible)
                {
                    results.Add(new(name, true, "Guardado. El procesador lo convertirá a MP4 compatible antes de publicarlo: " + info.IncompatibilityReason, null));
                    continue;
                }
                // Dashboard uploads are complete and validated; they skip the SFTP settling delay.
                var episodeId = await importer.ImportAsync(library.Describe(seriesId, path), token);
                results.Add(new(name, true, null, episodeId));
            }
            catch (BadRequestException error) { results.Add(new(name, false, error.Message, null)); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(error, "Episode upload {File} for series {SeriesId} failed", name, seriesId);
                results.Add(new(name, false, "No se pudo validar o guardar el video. Comprueba formato, espacio y permisos.", null));
            }
        }
        if (results.Any(result => result.EpisodeId != null)) await RefreshAsync(await ChannelsAiringAsync(seriesId));
        return results;
    }

    public async Task<ScanResult> ScanFolderAsync(int seriesId, CancellationToken token)
    {
        var series = await context.Series.AsNoTracking().SingleOrDefaultAsync(item => item.Id == seriesId, token) ?? throw NotFound();
        if (string.IsNullOrEmpty(series.FolderPath) || !Directory.Exists(series.FolderPath))
            throw new BadRequestException("La carpeta de la serie no existe.");
        var missing = await importer.ReconcileAsync(seriesId, series.FolderPath, token);
        int imported = 0, pending = 0;
        foreach (var file in library.Files(seriesId, series.FolderPath))
        {
            // Originals kept next to their web copy are not pending: the copy is the episode.
            if (MediaFilePolicy.IsConverted(file.FullPath)) continue;
            if (file.ModifiedUtc > DateTime.UtcNow - LibraryImporter.SettleTime) { pending++; continue; }
            try { await importer.ImportAsync(file, token); imported++; }
            catch (IOException) { pending++; /* Incompatible or unfinished files wait for the media worker. */ }
        }
        if (imported > 0 || missing > 0) await RefreshAsync(await ChannelsAiringAsync(seriesId));
        return new ScanResult(imported, missing, pending);
    }

    // ── Public ──

    public async Task<PagedResult<PublicSeriesCard>> SearchAsync(SeriesQuery query)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var series = context.Series.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search)) series = series.Where(item => item.Name.Contains(query.Search.Trim()));
        if (query.CategoryIds is { Length: > 0 } categories)
            series = series.Where(item => item.Categories.Any(link => categories.Contains(link.CategoryId)));
        if (query.Decade is int decade)
        {
            var from = new DateOnly(decade, 1, 1);
            var to = from.AddYears(10);
            series = series.Where(item => item.StartDate >= from && item.StartDate < to);
        }
        var onAir = context.ChannelEraSelections.SelectMany(selection => context.ChannelEraSeries
            .Where(link => link.ChannelEraId == selection.ChannelEraId), (selection, link) => new { selection.ChannelId, link.SeriesId });
        if (query.OnAirToday) series = series.Where(item => onAir.Any(link => link.SeriesId == item.Id));
        if (query.ChannelId is int channelId) series = series.Where(item => onAir.Any(link => link.SeriesId == item.Id && link.ChannelId == channelId));
        // Only series with something to watch are public.
        series = series.Where(item => context.Episodes.Any(episode => episode.SeriesId == item.Id && episode.IsAvailable && episode.FilePath != null));

        var total = await series.CountAsync();
        series = query.Sort switch
        {
            "rating" => series.OrderByDescending(item => item.Rating).ThenBy(item => item.Name),
            "oldest" => series.OrderBy(item => item.StartDate).ThenBy(item => item.Name),
            "newest" => series.OrderByDescending(item => item.StartDate).ThenBy(item => item.Name),
            _ => series.OrderBy(item => item.Name)
        };
        var items = await series.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(item => new
            {
                item.Id, item.Name, item.LogoPath, item.StartDate, item.EndDate, item.Rating,
                Categories = item.Categories.Where(link => link.Category.DeletedAtUtc == null).Select(link => link.Category.Name).ToList(),
                Seasons = item.Seasons.Count(season => season.Episodes.Any(episode => episode.DeletedAtUtc == null && episode.IsAvailable)),
                Episodes = context.Episodes.Count(episode => episode.SeriesId == item.Id && episode.IsAvailable && episode.FilePath != null)
            }).ToListAsync();
        var ids = items.Select(item => item.Id).ToList();
        var channels = await OnAirAsync(ids);
        return new PagedResult<PublicSeriesCard>(items.Select(item => new PublicSeriesCard(item.Id, item.Name, item.LogoPath, item.StartDate.Year,
            item.EndDate?.Year, item.Rating, item.Categories, channels[item.Id].ToList(), item.Seasons, item.Episodes)).ToList(), total, page, pageSize);
    }

    public async Task<PublicSeriesDetail> GetPublicAsync(int id)
    {
        var series = await context.Series.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        var categories = await context.SeriesCategories.AsNoTracking().Where(link => link.SeriesId == id && link.Category.DeletedAtUtc == null)
            .Select(link => link.Category.Name).OrderBy(name => name).ToListAsync();
        var seasons = await context.Episodes.AsNoTracking().Where(episode => episode.SeriesId == id && episode.IsAvailable && episode.FilePath != null)
            .Select(episode => episode.SeasonNumber).Distinct().OrderBy(number => number).ToListAsync();
        var comments = await context.SeriesComments.CountAsync(link => link.SeriesId == id && link.Comment.Status == CommentStatus.Approved
            && link.Comment.DeletedAtUtc == null);
        return new PublicSeriesDetail(series.Id, series.Name, series.Description, series.History, series.LogoPath, series.StartDate,
            series.EndDate, series.Rating, categories, seasons, (await OnAirAsync([id]))[id].ToList(), comments);
    }

    public async Task<IReadOnlyList<PublicEpisode>> PublicEpisodesAsync(int seriesId, int? seasonNumber)
    {
        if (!await context.Series.AnyAsync(series => series.Id == seriesId)) throw NotFound();
        var query = context.Episodes.AsNoTracking().Where(episode => episode.SeriesId == seriesId && episode.IsAvailable && episode.FilePath != null);
        if (seasonNumber.HasValue) query = query.Where(episode => episode.SeasonNumber == seasonNumber);
        return await query.OrderBy(episode => episode.SeasonNumber).ThenBy(episode => episode.EpisodeTypeId).ThenBy(episode => episode.EpisodeNumber)
            .ThenBy(episode => episode.Part)
            .Select(episode => new PublicEpisode(episode.Id, episode.SeasonNumber, episode.EpisodeNumber, episode.EpisodeType.Name, episode.Title, episode.FilePath!,
                episode.Part))
            .ToListAsync();
    }

    // ── Helpers ──

    private static NotFoundException NotFound() => new("Serie no encontrada.");

    private static void Apply(Series series, SeriesRequest request)
    {
        series.Name = request.Name.Trim();
        series.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        series.History = string.IsNullOrWhiteSpace(request.History) ? null : request.History.Trim();
        series.Rating = request.Rating;
        series.StartDate = request.StartDate;
        series.EndDate = request.EndDate;
    }

    private async Task<List<int>> ValidCategoriesAsync(IReadOnlyList<int>? ids)
    {
        var requested = (ids ?? []).Distinct().ToList();
        if (requested.Count > 0 && await context.Categories.CountAsync(category => requested.Contains(category.Id)) != requested.Count)
            throw new BadRequestException("Una o más categorías no existen.");
        return requested;
    }

    private async Task ReplaceCategoriesAsync(Series series, IReadOnlyList<int> ids)
    {
        var requested = await ValidCategoriesAsync(ids);
        context.SeriesCategories.RemoveRange(series.Categories.Where(link => !requested.Contains(link.CategoryId)));
        foreach (var category in requested.Where(category => series.Categories.All(link => link.CategoryId != category)))
            context.SeriesCategories.Add(new SeriesCategory { SeriesId = series.Id, CategoryId = category });
    }

    private Task<List<int>> SeasonNumbersAsync(int seriesId) =>
        context.SeriesSeasons.Where(season => season.SeriesId == seriesId).Select(season => season.SeasonNumber).ToListAsync();

    private Task<List<int>> ChannelsAiringAsync(int seriesId) =>
        context.ChannelEraSelections.Where(selection => context.ChannelEraSeries.Any(link =>
            link.ChannelEraId == selection.ChannelEraId && link.SeriesId == seriesId)).Select(selection => selection.ChannelId).ToListAsync();

    private async Task<ILookup<int, OnAirChannel>> OnAirAsync(IReadOnlyCollection<int> seriesIds) =>
        (await (from selection in context.ChannelEraSelections.AsNoTracking()
                join link in context.ChannelEraSeries.AsNoTracking() on selection.ChannelEraId equals link.ChannelEraId
                join channel in context.Channels.AsNoTracking() on selection.ChannelId equals channel.Id
                where seriesIds.Contains(link.SeriesId)
                select new { link.SeriesId, channel.Id, channel.Name }).ToListAsync())
        .ToLookup(item => item.SeriesId, item => new OnAirChannel(item.Id, item.Name));

    private async Task RefreshAsync(IEnumerable<int> channels)
    {
        foreach (var channelId in channels.Distinct()) await schedule.RegenerateAsync(channelId, replaceCurrent: false);
    }
}
