using ApplicationCore.DTOs.Episode;
using ApplicationCore.DTOs.Series;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using ApplicationCore.Models;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services.InternalServices;
using Infrastructure.Services.Media;
using Mapster;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services
{
    public class SeriesService : ISeriesService
    {
        private readonly NostalgiaTVContext _context;
        private readonly FileUploadService _fileUploadService;
        private readonly SeriesFolderService _folderService;
        private readonly SeriesUploadSettings _uploadSettings;
        private readonly MediaLibraryService _library;
        private readonly MediaProbe _probe;

        public SeriesService(NostalgiaTVContext context, FileUploadService fileUploadService, SeriesFolderService folderService, IOptions<SeriesUploadSettings> uploadSettings, MediaLibraryService library, MediaProbe probe)
        {
            _context = context;
            _fileUploadService = fileUploadService;
            _folderService = folderService;
            _uploadSettings = uploadSettings.Value;
            _library = library;
            _probe = probe;
        }

        public async Task<List<SeriesResponse>> GetAllAsync()
        {
            var series = await _context.Series.ProjectToType<SeriesResponse>().ToListAsync();
            var seasons = await _context.Episodes.AsNoTracking()
                .Where(episode => episode.IsAvailable)
                .Select(episode => new { episode.SeriesId, episode.Season }).Distinct().ToListAsync();
            var bySeries = seasons.ToLookup(episode => episode.SeriesId, episode => episode.Season);
            foreach (var item in series)
                item.SeasonNumbers = bySeries[item.Id].Order().ToList();
            return series;
        }

        public async Task<SeriesResponse> GetByIdAsync(int id)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");
            return series.Adapt<SeriesResponse>();
        }

        public async Task<SeriesResponse> CreateAsync(SeriesRequest request)
        {
            var series = request.Adapt<Series>();
            await using var transaction = await _context.Database.BeginTransactionAsync();
            _context.Series.Add(series);
            await _context.SaveChangesAsync();
            series.FolderPath = _folderService.CreateSeriesFolder(request.Name, request.Seasons, series.Id);
            if (request.Logo != null)
                series.LogoPath = await _fileUploadService.UploadAsync(request.Logo,
                    MediaStorageLayout.RelativeFolder(_library.Root, series.FolderPath));
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return series.Adapt<SeriesResponse>();
        }

        public async Task<SeriesResponse> UpdateAsync(int id, SeriesRequest request)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");

            request.Adapt(series);

            if (!string.IsNullOrEmpty(series.FolderPath))
                _folderService.UpdateSeriesFolders(series.FolderPath, request.Seasons);
            else
                series.FolderPath = _folderService.CreateSeriesFolder(request.Name, request.Seasons, series.Id);

            if (request.Logo != null)
                series.LogoPath = await _fileUploadService.UploadAsync(request.Logo,
                    MediaStorageLayout.RelativeFolder(_library.Root, series.FolderPath));

            await _context.SaveChangesAsync();
            return series.Adapt<SeriesResponse>();
        }

        public async Task DeleteAsync(int id)
        {
            var series = await _context.Series.FindAsync(id)
                ?? throw new NotFoundException($"Series {id} not found");
            _context.Series.Remove(series);
            await _context.SaveChangesAsync();
        }

        public async Task<SeriesResponse> AssignCategoriesAsync(int seriesId, List<int> categoryIds)
        {
            var series = await _context.Series
                .Include(s => s.Categories)
                .FirstOrDefaultAsync(s => s.Id == seriesId)
                ?? throw new NotFoundException($"Series {seriesId} not found");

            series.Categories = await _context.Categories
                .Where(c => categoryIds.Contains(c.Id))
                .ToListAsync();

            await _context.SaveChangesAsync();
            return series.Adapt<SeriesResponse>();
        }

        public async Task<List<EpisodeResponse>> ScanFolderAsync(int seriesId)
        {
            var series = await _context.Series.FindAsync(seriesId)
                ?? throw new NotFoundException($"Series {seriesId} not found");

            if (string.IsNullOrEmpty(series.FolderPath) || !Directory.Exists(series.FolderPath))
                throw new BadRequestException("Series folder not found.");

            await _library.ScanSeriesAsync(series, CancellationToken.None);

            var episodes = await _context.Episodes
                .Where(e => e.SeriesId == seriesId && e.IsAvailable)
                .Include(e => e.EpisodeType)
                .OrderBy(e => e.Season)
                .ThenBy(e => e.EpisodeNumber)
                .ThenBy(e => e.Id)
                .ProjectToType<EpisodeResponse>()
                .ToListAsync();
            foreach (var episode in episodes)
                episode.FileSizeBytes = _library.FileSize(episode.FilePath);
            return episodes;
        }

        // Upload to a temporary file, probe it and publish atomically. Only compatible videos are indexed.
        public async Task<List<SeriesUploadResult>> UploadEpisodeFilesAsync(int seriesId, SeriesUploadRequest request)
        {
            var series = await _context.Series.FindAsync(seriesId)
                ?? throw new NotFoundException($"Series {seriesId} not found");

            if (request.Files is null || request.Files.Count == 0)
                throw new BadRequestException("No files received.");

            var target = (request.Target ?? "season").Trim().ToLowerInvariant();
            if (target is not ("season" or "specials" or "movies"))
                throw new BadRequestException($"Invalid target '{request.Target}'. Use 'season', 'specials' or 'movies'.");

            int? seasonNumber = null;
            if (target == "season")
            {
                seasonNumber = request.Season ?? series.Seasons;
                if (seasonNumber is < 1 or > 999)
                    throw new BadRequestException("Season must be between 1 and 999.");
            }

            if (string.IsNullOrEmpty(series.FolderPath))
                series.FolderPath = _folderService.CreateSeriesFolder(series.Name, series.Seasons, series.Id);

            var subfolder = target switch
            {
                "season" => $"season {seasonNumber}",
                "movies" => "movies",
                _ => "specials"
            };
            var targetDir = MediaStorageLayout.CreateDirectory(_library.Root,
                MediaStorageLayout.RelativeFolder(_library.Root, series.FolderPath) + "/" + subfolder);

            var maxBytes = (long)_uploadSettings.MaxFileSizeMB * 1024 * 1024;
            var results = new List<SeriesUploadResult>();
            var anySaved = false;

            foreach (var file in request.Files)
            {
                var originalName = Path.GetFileName(file.FileName ?? string.Empty);
                var result = new SeriesUploadResult { FileName = originalName };
                string? fullPath = null;

                try
                {
                    if (string.IsNullOrWhiteSpace(originalName))
                        throw new BadRequestException("Invalid file name.");

                    var ext = Path.GetExtension(originalName);
                    if (!MediaFilePolicy.IsCandidate(originalName))
                        throw new BadRequestException(
                            $"Video format '{ext}' is not supported by the media worker.");

                    if (IsTranscodeArtifact(originalName))
                        throw new BadRequestException("Temporary or transcoding files are not accepted.");

                    if (file.Length == 0)
                        throw new BadRequestException("File is empty.");

                    if (file.Length > maxBytes)
                        throw new BadRequestException($"File exceeds {_uploadSettings.MaxFileSizeMB}MB.");
                    if (new DriveInfo(Path.GetPathRoot(targetDir)!).AvailableFreeSpace < file.Length + 512L * 1024 * 1024)
                        throw new BadRequestException("Insufficient free storage for this upload.");

                    var finalName = GetUniqueFileName(targetDir, SanitizeFileName(originalName));
                    var destination = Path.GetFullPath(Path.Combine(targetDir, finalName));
                    MediaFilePolicy.SafePath(_library.Root, targetDir);
                    fullPath = Path.Combine(targetDir, $".upload-{Guid.NewGuid():N}.part");
                    await using (var stream = new FileStream(fullPath, FileMode.CreateNew))
                        await file.CopyToAsync(stream);
                    var info = await _probe.ReadAsync(fullPath, CancellationToken.None, ext);
                    File.Move(fullPath, destination, overwrite: false);
                    fullPath = destination;

                    // Dashboard uploads are already complete and validated; they need no SFTP settling delay.
                    if (info.Compatible)
                    {
                        var saved = new FileInfo(destination);
                        await _library.ImportAsync(new LibraryFile(seriesId, destination,
                            Path.GetRelativePath(_library.Root, destination).Replace('\\', '/'), saved.Length, saved.LastWriteTimeUtc),
                            CancellationToken.None);
                    }

                    result.Success = true;
                    result.FilePath = ToRelativePath(fullPath);
                    anySaved = true;
                }
                catch (BadRequestException ex)
                {
                    result.Error = ex.Message;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    // Escritos interrumpidos (disco lleno, permiso): no dejar archivos parciales.
                    if (fullPath is not null)
                        try { File.Delete(fullPath); } catch (IOException) { }
                    result.Error = "No se pudo validar o guardar el video. Comprueba formato, espacio y permisos.";
                }

                results.Add(result);
            }

            if (anySaved && seasonNumber.HasValue && seasonNumber > series.Seasons)
                series.Seasons = seasonNumber.Value;

            if (anySaved)
                await _context.SaveChangesAsync();

            return results;
        }

        private static bool IsTranscodeArtifact(string name) =>
            name.Contains(".transcoding.", StringComparison.OrdinalIgnoreCase) ||
            name.Contains(".web-compatible", StringComparison.OrdinalIgnoreCase) ||
            name.EndsWith(".part", StringComparison.OrdinalIgnoreCase) ||
            name.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase);

        private static string SanitizeFileName(string fileName)
        {
            var invalid = new HashSet<char>(Path.GetInvalidFileNameChars()) { ':', '/', '\\' };
            var ext = Path.GetExtension(fileName);
            var baseName = Path.GetFileNameWithoutExtension(fileName);
            var safe = new string(baseName.Select(c => invalid.Contains(c) || char.IsControl(c) ? '-' : c).ToArray())
                .Trim().TrimEnd('.');
            return string.IsNullOrEmpty(safe) ? $"video{ext}" : safe + ext;
        }

        private static string GetUniqueFileName(string dir, string fileName)
        {
            if (!File.Exists(Path.Combine(dir, fileName)))
                return fileName;

            var baseName = Path.GetFileNameWithoutExtension(fileName);
            var ext = Path.GetExtension(fileName);
            for (var i = 1; ; i++)
            {
                var candidate = $"{baseName} ({i}){ext}";
                if (!File.Exists(Path.Combine(dir, candidate)))
                    return candidate;
            }
        }

        // Convierte ruta absoluta a relativa desde wwwroot
        private static string ToRelativePath(string absolutePath)
        {
            var normalized = absolutePath.Replace("\\", "/");
            var wwwrootIndex = normalized.IndexOf("wwwroot", StringComparison.OrdinalIgnoreCase);
            return wwwrootIndex >= 0
                ? normalized[wwwrootIndex..]
                : normalized;
        }

        public async Task<PagedResult<SeriesResponse>> GetPublicAsync(SeriesFilterRequest filter)
        {
            var query = _context.Series.AsQueryable();

            if (!string.IsNullOrWhiteSpace(filter.Name))
                query = query.Where(s => s.Name.Contains(filter.Name));

            if (filter.ChannelId.HasValue)
                query = query.Where(s => s.Channels.Any(c => c.Id == filter.ChannelId));

            if (filter.CategoryId.HasValue)
                query = query.Where(s => s.Categories.Any(c => c.Id == filter.CategoryId));

            if (filter.EpisodeTypeId.HasValue)
                query = query.Where(s => s.Episodes.Any(e => e.IsAvailable && e.EpisodeTypeId == filter.EpisodeTypeId));

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderBy(s => s.Name)
                .Skip((filter.Page - 1) * filter.PageSize)
                .Take(filter.PageSize)
                .ProjectToType<SeriesResponse>()
                .ToListAsync();

            return new PagedResult<SeriesResponse>
            {
                Items = items,
                TotalCount = totalCount,
                Page = filter.Page,
                PageSize = filter.PageSize
            };
        }
    }
}
