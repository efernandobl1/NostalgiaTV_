using ApplicationCore.DTOs.Episode;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Infrastructure.Services.Media;
using Mapster;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace Infrastructure.Services
{
    public class EpisodeService : IEpisodeService
    {
        private readonly NostalgiaTVContext _context;
        private readonly IHostEnvironment _environment;
        private readonly MediaLibraryService? _library;

        public EpisodeService(NostalgiaTVContext context, IHostEnvironment environment, MediaLibraryService? library = null)
        {
            _context = context;
            _environment = environment;
            _library = library;
        }

        public async Task<List<EpisodeResponse>> GetBySeriesAsync(int seriesId)
        {
            var exists = await _context.Series.AnyAsync(s => s.Id == seriesId);
            if (!exists) throw new NotFoundException($"Series {seriesId} not found");

            var episodes = await _context.Episodes
                .Where(e => e.SeriesId == seriesId && e.IsAvailable)
                .Include(e => e.EpisodeType)
                .OrderBy(e => e.Season)
                .ProjectToType<EpisodeResponse>()
                .ToListAsync();

            foreach (var episode in episodes)
                episode.FileSizeBytes = GetFileSize(episode.FilePath);

            return episodes;
        }

        public async Task<EpisodeResponse> UpdateAsync(int id, UpdateEpisodeRequest request)
        {
            var episode = await _context.Episodes.FindAsync(id)
                ?? throw new NotFoundException("Episode not found");

            if (!string.IsNullOrWhiteSpace(request.Title))
                episode.Title = request.Title;

            if (request.EpisodeNumber > 0)
                episode.EpisodeNumber = request.EpisodeNumber;

            if (request.EpisodeTypeId > 0)
                episode.EpisodeTypeId = request.EpisodeTypeId;

            await _context.SaveChangesAsync();
            var response = episode.Adapt<EpisodeResponse>();
            response.FileSizeBytes = GetFileSize(response.FilePath);
            return response;
        }

        public async Task<IEnumerable<EpisodeTypeResponse>> GetTypesAsync()
        {
            return await _context.EpisodeTypes
                .Select(e => new EpisodeTypeResponse { Id = e.Id, Name = e.Name })
                .ToListAsync();
        }

        public async Task<IEnumerable<EpisodeResponse>> GetBySeriesPublicAsync(int seriesId)
        {
            return await _context.Episodes
                .Where(e => e.SeriesId == seriesId && e.IsAvailable && e.FilePath != null)
                .OrderBy(e => e.Season)
                .ThenBy(e => e.EpisodeNumber)
                .ProjectToType<EpisodeResponse>()
                .ToListAsync();
        }

        private long? GetFileSize(string? filePath)
        {
            if (_library != null) return _library.FileSize(filePath);
            if (string.IsNullOrWhiteSpace(filePath)) return null;
            try
            {
                var contentRoot = Path.GetFullPath(_environment.ContentRootPath);
                var relativePath = filePath.TrimStart('/', '\\').Replace('/', Path.DirectorySeparatorChar);
                var fullPath = Path.GetFullPath(Path.Combine(contentRoot, relativePath));
                var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
                if (!fullPath.StartsWith(contentRoot + Path.DirectorySeparatorChar, comparison)) return null;

                return File.Exists(fullPath) ? new FileInfo(fullPath).Length : null;
            }
            catch (ArgumentException) { return null; }
            catch (IOException) { return null; }
            catch (UnauthorizedAccessException) { return null; }
            catch (NotSupportedException) { return null; }
        }
    }
}
