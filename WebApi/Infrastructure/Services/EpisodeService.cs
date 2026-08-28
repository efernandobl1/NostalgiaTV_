using ApplicationCore.DTOs.Episode;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class EpisodeService : IEpisodeService
    {
        private readonly NostalgiaTVContext _context;

        public EpisodeService(NostalgiaTVContext context) => _context = context;

        public async Task<List<EpisodeResponse>> GetBySeriesAsync(int seriesId)
        {
            var exists = await _context.Series.AnyAsync(s => s.Id == seriesId);
            if (!exists) throw new NotFoundException($"Series {seriesId} not found");

            return await _context.Episodes
                .Where(e => e.SeriesId == seriesId)
                .Include(e => e.EpisodeType)
                .OrderBy(e => e.Season)
                .ProjectToType<EpisodeResponse>()
                .ToListAsync();
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
            return episode.Adapt<EpisodeResponse>();
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
                .Where(e => e.SeriesId == seriesId && e.FilePath != null)
                .OrderBy(e => e.Season)
                .ThenBy(e => e.EpisodeNumber)
                .ProjectToType<EpisodeResponse>()
                .ToListAsync();
        }
    }
}
