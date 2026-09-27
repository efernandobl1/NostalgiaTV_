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
using System.Text.Json;

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
                .Include(e => e.Series)
                .Include(e => e.Bumpers)
                .Where(e => e.ChannelId == channelId)
                .ToListAsync();

            var channel = await _context.Channels
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == channelId)
                ?? throw new NotFoundException($"Channel {channelId} not found");

            var responses = new List<ChannelEraResponse>();
            foreach (var era in eras)
            {
                var response = new ChannelEraResponse
                {
                    Id = era.Id,
                    ChannelId = era.ChannelId,
                    ChannelName = channel.Name,
                    Name = era.Name,
                    Description = era.Description,
                    StartDate = era.StartDate,
                    EndDate = era.EndDate,
                    FolderPath = era.FolderPath,
                    SeriesIds = era.Series.Select(s => s.Id).ToList(),
                    SeasonSelections = ReadSeasonSelections(era.SeriesSeasonsJson),
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
                .Include(e => e.Series)
                .Include(e => e.Bumpers)
                .Include(e => e.Channel)
                .FirstOrDefaultAsync(e => e.Id == eraId)
                ?? throw new NotFoundException($"ChannelEra {eraId} not found");

            var response = era.Adapt<ChannelEraResponse>();
            response.ChannelName = era.Channel.Name;
            response.SeasonSelections = ReadSeasonSelections(era.SeriesSeasonsJson);
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

            var eraFolderPath = _folderService.CreateChannelEraFolder(channel.Name, request.Name);

            var era = new ChannelEra
            {
                ChannelId = channelId,
                Name = request.Name,
                Description = request.Description,
                StartDate = request.StartDate,
                EndDate = request.EndDate,
                FolderPath = eraFolderPath
            };

            _context.ChannelEras.Add(era);
            await _context.SaveChangesAsync();

            var response = era.Adapt<ChannelEraResponse>();
            response.ChannelName = channel.Name;
            return response;
        }

        public async Task<ChannelEraResponse> UpdateAsync(int eraId, ChannelEraRequest request)
        {
            var era = await _context.ChannelEras.FindAsync(eraId)
                ?? throw new NotFoundException($"ChannelEra {eraId} not found");

            era.Name = request.Name;
            era.Description = request.Description;
            era.StartDate = request.StartDate;
            era.EndDate = request.EndDate;

            await _context.SaveChangesAsync();

            var response = era.Adapt<ChannelEraResponse>();
            var channel = await _context.Channels.FindAsync(era.ChannelId);
            response.ChannelName = channel!.Name;
            response.SeasonSelections = ReadSeasonSelections(era.SeriesSeasonsJson);
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
            var era = await _context.ChannelEras
                .Include(e => e.Series)
                .Include(e => e.Bumpers)
                .FirstOrDefaultAsync(e => e.Id == eraId)
                ?? throw new NotFoundException($"ChannelEra {eraId} not found");

            era.Series.Clear();
            _context.ChannelBumpers.RemoveRange(era.Bumpers);
            _context.ChannelEras.Remove(era);
            await _context.SaveChangesAsync();
        }

        public async Task<ChannelEraResponse> AssignSeriesAsync(int eraId, AssignSeriesToEraRequest request)
        {
            var era = await _context.ChannelEras
                .Include(e => e.Series)
                .FirstOrDefaultAsync(e => e.Id == eraId)
                ?? throw new NotFoundException($"ChannelEra {eraId} not found");

            var seriesIds = (request.SeriesIds ?? []).Distinct().ToList();
            var selections = (request.SeasonSelections ?? [])
                .Where(item => seriesIds.Contains(item.Key))
                .ToDictionary(item => item.Key, item => (item.Value ?? []).Distinct().Where(season => season >= 0).ToList());
            era.SeriesSeasonsJson = JsonSerializer.Serialize(selections);

            var existingCount = await _context.Series.CountAsync(series => seriesIds.Contains(series.Id));
            if (existingCount != seriesIds.Count) throw new NotFoundException("One or more series were not found");

            await using var transaction = await _context.Database.BeginTransactionAsync();

            await _context.Database.ExecuteSqlRawAsync(
                "DELETE FROM ChannelEraSeries WHERE ChannelErasId = {0}", eraId);

            foreach (var seriesId in seriesIds)
            {
                await _context.Database.ExecuteSqlRawAsync(
                    "INSERT INTO ChannelEraSeries (ChannelErasId, SeriesId) VALUES ({0}, {1})", eraId, seriesId);
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var refreshed = await _context.ChannelEras
                .AsNoTracking()
                .Include(e => e.Series)
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
                SeasonSelections = ReadSeasonSelections(refreshed.SeriesSeasonsJson),
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

        private static Dictionary<int, List<int>> ReadSeasonSelections(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return [];
            try { return JsonSerializer.Deserialize<Dictionary<int, List<int>>>(json) ?? []; }
            catch (JsonException) { return []; }
        }
    }
}
