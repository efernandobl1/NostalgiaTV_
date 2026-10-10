using ApplicationCore.DTOs.ChannelBumper;
using ApplicationCore.DTOs.ChannelEra;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services.InternalServices;
using Mapster;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services
{
    public class ChannelEraService : IChannelEraService
    {
        private readonly NostalgiaTVContext _context;
        private readonly SeriesFolderService _folderService;
        private readonly MediaSettings _mediaSettings;

        public ChannelEraService(NostalgiaTVContext context, SeriesFolderService folderService, IOptions<MediaSettings> mediaSettings)
        {
            _context = context;
            _folderService = folderService;
            _mediaSettings = mediaSettings.Value;
        }

        public async Task<List<ChannelEraResponse>> GetByChannelAsync(int channelId)
        {
            var eras = await _context.ChannelEras
                .AsNoTracking()
                .AsSplitQuery()
                .Include(e => e.Series)
                .Include(e => e.SeriesLinks).ThenInclude(link => link.SelectedSeasons)
                .Include(e => e.Bumpers)
                .Where(e => e.ChannelId == channelId)
                .ToListAsync();

            var channel = await _context.Channels
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == channelId)
                ?? throw new NotFoundException($"Channel {channelId} not found");

            var responses = new List<ChannelEraResponse>();
            var activeEraId = await _context.ChannelEraSelections.AsNoTracking()
                .Where(selection => selection.ChannelId == channelId)
                .Select(selection => (int?)selection.ChannelEraId).FirstOrDefaultAsync();
            foreach (var era in eras)
            {
                var response = new ChannelEraResponse
                {
                    Id = era.Id,
                    ChannelId = era.ChannelId,
                    IsActive = era.Id == activeEraId,
                    ChannelName = channel.Name,
                    Name = era.Name,
                    Description = era.Description,
                    StartDate = era.StartDate,
                    EndDate = era.EndDate,
                    FolderPath = era.FolderPath,
                    SeriesIds = era.Series.Select(s => s.Id).ToList(),
                    SeasonSelections = ReadSeasonSelections(era.SeriesLinks),
                    Bumpers = era.Bumpers.Select(b => new ChannelBumperResponse
                    {
                        Id = b.Id,
                        ChannelEraId = b.ChannelEraId,
                        Title = b.Title,
                        FilePath = b.FilePath,
                        Order = b.Order
                    }).ToList()
                };
                responses.Add(response);
            }

            return responses;
        }

        public async Task<ChannelEraResponse> GetByIdAsync(int eraId)
        {
            var era = await _context.ChannelEras
                .AsNoTracking()
                .AsSplitQuery()
                .Include(e => e.Series)
                .Include(e => e.SeriesLinks).ThenInclude(link => link.SelectedSeasons)
                .Include(e => e.Bumpers)
                .Include(e => e.Channel)
                .FirstOrDefaultAsync(e => e.Id == eraId)
                ?? throw new NotFoundException($"ChannelEra {eraId} not found");

            var response = era.Adapt<ChannelEraResponse>();
            response.ChannelName = era.Channel.Name;
            response.IsActive = await _context.ChannelEraSelections.AnyAsync(selection => selection.ChannelEraId == eraId);
            response.SeriesIds = era.Series.Select(series => series.Id).ToList();
            response.SeasonSelections = ReadSeasonSelections(era.SeriesLinks);
            response.Bumpers = era.Bumpers.Select(b => new ChannelBumperResponse
            {
                Id = b.Id,
                ChannelEraId = b.ChannelEraId,
                Title = b.Title,
                FilePath = b.FilePath,
                Order = b.Order
            }).ToList();

            return response;
        }

        public async Task<ChannelEraResponse> CreateAsync(int channelId, ChannelEraRequest request)
        {
            var channel = await _context.Channels.FindAsync(channelId)
                ?? throw new NotFoundException($"Channel {channelId} not found");

            await using var transaction = await _context.Database.BeginTransactionAsync();
            var era = new ChannelEra
            {
                ChannelId = channelId,
                Name = request.Name,
                Description = request.Description,
                StartDate = request.StartDate,
                EndDate = request.EndDate
            };

            _context.ChannelEras.Add(era);
            await _context.SaveChangesAsync();
            era.FolderPath = _folderService.CreateChannelEraFolder(channelId, era.Id);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var response = era.Adapt<ChannelEraResponse>();
            response.ChannelName = channel.Name;
            return response;
        }

        public async Task<ChannelEraResponse> UpdateAsync(int eraId, ChannelEraRequest request)
        {
            var era = await _context.ChannelEras
                .AsSplitQuery()
                .Include(item => item.Series)
                .Include(item => item.SeriesLinks).ThenInclude(link => link.SelectedSeasons)
                .FirstOrDefaultAsync(item => item.Id == eraId)
                ?? throw new NotFoundException($"ChannelEra {eraId} not found");

            era.Name = request.Name;
            era.Description = request.Description;
            era.StartDate = request.StartDate;
            era.EndDate = request.EndDate;

            await _context.SaveChangesAsync();

            var response = era.Adapt<ChannelEraResponse>();
            var channel = await _context.Channels.FindAsync(era.ChannelId);
            response.ChannelName = channel!.Name;
            response.SeriesIds = era.Series.Select(series => series.Id).ToList();
            response.SeasonSelections = ReadSeasonSelections(era.SeriesLinks);
            response.Bumpers = (await _context.ChannelBumpers.Where(b => b.ChannelEraId == eraId).ToListAsync())
                .Select(b => new ChannelBumperResponse
                {
                    Id = b.Id,
                    ChannelEraId = b.ChannelEraId,
                    Title = b.Title,
                    FilePath = b.FilePath,
                    Order = b.Order
                }).ToList();

            return response;
        }

        public async Task DeleteAsync(int eraId)
        {
            if (await _context.ChannelEraSelections.AnyAsync(selection => selection.ChannelEraId == eraId))
                throw new BadRequestException("Select another era before deleting this one.");
            if (await _context.ScheduledPrograms.AnyAsync(program => program.ChannelEraId == eraId))
                throw new BadRequestException("This era still has scheduled programs. Refresh the channel schedule first.");

            var era = await _context.ChannelEras
                .Include(e => e.Series)
                .Include(e => e.SeriesLinks)
                .Include(e => e.Bumpers)
                .FirstOrDefaultAsync(e => e.Id == eraId)
                ?? throw new NotFoundException($"ChannelEra {eraId} not found");

            await using var transaction = await _context.Database.BeginTransactionAsync();
            await _context.ChannelEraInterludes.Where(item => item.ChannelEraId == eraId).ExecuteDeleteAsync();
            await _context.ChannelEraBreakRules.Where(item => item.ChannelEraId == eraId).ExecuteDeleteAsync();
            era.Series.Clear();
            _context.ChannelBumpers.RemoveRange(era.Bumpers);
            _context.ChannelEras.Remove(era);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }

        public async Task<ChannelEraResponse> AssignSeriesAsync(int eraId, AssignSeriesToEraRequest request)
        {
            if (!await _context.ChannelEras.AnyAsync(e => e.Id == eraId))
                throw new NotFoundException($"ChannelEra {eraId} not found");

            var seriesIds = (request.SeriesIds ?? []).Distinct().ToList();
            var selections = (request.SeasonSelections ?? [])
                .Where(item => seriesIds.Contains(item.Key))
                .ToDictionary(item => item.Key, item => (item.Value ?? []).Distinct().Where(season => season >= 0).ToList());
            var existingCount = await _context.Series.CountAsync(series => seriesIds.Contains(series.Id));
            if (existingCount != seriesIds.Count) throw new NotFoundException("One or more series were not found");

            await using var transaction = await _context.Database.BeginTransactionAsync();

            await _context.ChannelEraSelectedSeasons
                .Where(season => season.ChannelEraId == eraId)
                .ExecuteDeleteAsync();
            await _context.ChannelEraInterludes
                .Where(item => item.ChannelEraId == eraId && item.SeriesId != null && !seriesIds.Contains(item.SeriesId.Value))
                .ExecuteDeleteAsync();
            await _context.ChannelEraSeries
                .Where(link => link.ChannelEraId == eraId && !seriesIds.Contains(link.SeriesId))
                .ExecuteDeleteAsync();

            var links = await _context.ChannelEraSeries.Where(link => link.ChannelEraId == eraId).ToListAsync();
            foreach (var seriesId in seriesIds)
            {
                var link = links.FirstOrDefault(item => item.SeriesId == seriesId);
                if (link == null)
                {
                    link = new ChannelEraSeries { ChannelEraId = eraId, SeriesId = seriesId };
                    _context.ChannelEraSeries.Add(link);
                }
                link.HasSeasonFilter = selections.ContainsKey(seriesId);
                link.SelectedSeasons = selections.GetValueOrDefault(seriesId, [])
                    .Select(season => new ChannelEraSelectedSeason { SeasonNumber = season })
                    .ToList();
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var refreshed = await _context.ChannelEras
                .AsNoTracking()
                .AsSplitQuery()
                .Include(e => e.Series)
                .Include(e => e.SeriesLinks).ThenInclude(link => link.SelectedSeasons)
                .Include(e => e.Bumpers)
                .Include(e => e.Channel)
                .FirstAsync(e => e.Id == eraId);

            var response = new ChannelEraResponse
            {
                Id = refreshed.Id,
                ChannelId = refreshed.ChannelId,
                ChannelName = refreshed.Channel.Name,
                Name = refreshed.Name,
                Description = refreshed.Description,
                StartDate = refreshed.StartDate,
                EndDate = refreshed.EndDate,
                FolderPath = refreshed.FolderPath,
                SeriesIds = refreshed.Series.Select(s => s.Id).ToList(),
                SeasonSelections = ReadSeasonSelections(refreshed.SeriesLinks),
                Bumpers = refreshed.Bumpers.Select(b => new ChannelBumperResponse
                {
                    Id = b.Id,
                    ChannelEraId = b.ChannelEraId,
                    Title = b.Title,
                    FilePath = b.FilePath,
                    Order = b.Order
                }).ToList()
            };

            return response;
        }

        private static Dictionary<int, List<int>> ReadSeasonSelections(IEnumerable<ChannelEraSeries> links) =>
            links.Where(link => link.HasSeasonFilter)
                .ToDictionary(link => link.SeriesId,
                    link => link.SelectedSeasons.Select(season => season.SeasonNumber).OrderBy(number => number).ToList());
    }
}
