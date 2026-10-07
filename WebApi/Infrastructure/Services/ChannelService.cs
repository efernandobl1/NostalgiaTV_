using ApplicationCore.DTOs.Channel;
using ApplicationCore.DTOs.ChannelBumper;
using ApplicationCore.DTOs.ChannelEra;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.BackgroundServices;
using Infrastructure.Contexts;
using Infrastructure.Services.InternalServices;
using Infrastructure.Services.Media;
using Mapster;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class ChannelService : IChannelService
    {
        private readonly NostalgiaTVContext _context;
        private readonly FileUploadService _fileUploadService;
        private readonly ChannelBroadcastService _broadcastService;

        public ChannelService(NostalgiaTVContext context, FileUploadService fileUploadService, ChannelBroadcastService broadcastService)
        {
            _context = context;
            _fileUploadService = fileUploadService;
            _broadcastService = broadcastService;
        }

        public async Task<List<ChannelResponse>> GetAllAsync()
        {
            var channels = await _context.Channels
                .AsNoTracking()
                .Include(c => c.Series)
                .Include(c => c.Eras).ThenInclude(e => e.Series)
                .Include(c => c.Eras).ThenInclude(e => e.Bumpers)
                .ToListAsync();

            var responses = new List<ChannelResponse>();
            var selections = await _context.ChannelEraSelections.AsNoTracking()
                .ToDictionaryAsync(selection => selection.ChannelId, selection => selection.ChannelEraId);
            foreach (var channel in channels)
            {
                var response = channel.Adapt<ChannelResponse>();
                response.Eras = channel.Eras.Select(e => new ChannelEraResponse
                {
                    Id = e.Id,
                    IsActive = selections.GetValueOrDefault(channel.Id) == e.Id,
                    ChannelId = e.ChannelId,
                    ChannelName = channel.Name,
                    Name = e.Name,
                    Description = e.Description,
                    StartDate = e.StartDate,
                    EndDate = e.EndDate,
                    FolderPath = e.FolderPath,
                    SeriesIds = e.Series.Select(s => s.Id).ToList(),
                    Bumpers = e.Bumpers.Select(b => new ChannelBumperResponse
                    {
                        Id = b.Id,
                        ChannelEraId = b.ChannelEraId,
                        Title = b.Title,
                        FilePath = b.FilePath,
                        Order = b.Order
                    }).ToList()
                }).ToList();
                responses.Add(response);
            }

            return responses;
        }

        public async Task<ChannelResponse> CreateAsync(ChannelRequest request)
        {
            var channel = new Channel
            {
                Name = request.Name,
                LogoPath = string.Empty,
                History = request.History,
                StartDate = request.StartDate,
                EndDate = request.EndDate
            };
            await using var transaction = await _context.Database.BeginTransactionAsync();
            _context.Channels.Add(channel);
            await _context.SaveChangesAsync();
            if (request.Logo != null)
                channel.LogoPath = await _fileUploadService.UploadAsync(request.Logo, MediaStorageLayout.ChannelFolder(channel.Id));
            var era = new ChannelEra
            {
                ChannelId = channel.Id,
                Name = "Default lineup",
                StartDate = channel.StartDate,
                EndDate = channel.EndDate
            };
            _context.ChannelEras.Add(era);
            await _context.SaveChangesAsync();
            _context.ChannelEraSelections.Add(new ChannelEraSelection
            {
                ChannelId = channel.Id,
                ChannelEraId = era.Id,
                SelectedAtUtc = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return channel.Adapt<ChannelResponse>();
        }

        public async Task<ChannelResponse> AssignSeriesAsync(int channelId, AssignSeriesRequest request)
        {
            var channel = await _context.Channels
                .Include(c => c.Series)
                .FirstOrDefaultAsync(c => c.Id == channelId)
                ?? throw new NotFoundException($"Channel {channelId} not found");

            await using var transaction = await _context.Database.BeginTransactionAsync();
            channel.Series = await _context.Series
                .Where(s => request.SeriesIds.Contains(s.Id))
                .ToListAsync();

            await _context.SaveChangesAsync();
            var selectedEraId = await _context.ChannelEraSelections
                .Where(item => item.ChannelId == channelId)
                .Select(item => (int?)item.ChannelEraId)
                .FirstOrDefaultAsync();
            if (selectedEraId is int eraId)
            {
                await _context.ChannelEraSelectedSeasons
                    .Where(item => item.ChannelEraId == eraId).ExecuteDeleteAsync();
                await _context.ChannelEraSeries
                    .Where(item => item.ChannelEraId == eraId).ExecuteDeleteAsync();
                _context.ChannelEraSeries.AddRange(channel.Series.Select(series => new ChannelEraSeries
                {
                    ChannelEraId = eraId,
                    SeriesId = series.Id
                }));
                await _context.SaveChangesAsync();
            }
            await transaction.CommitAsync();
            await _broadcastService.ReloadChannelAsync(channelId);
            return channel.Adapt<ChannelResponse>();
        }

        public async Task<ChannelResponse> UpdateAsync(int id, ChannelRequest request)
        {
            var channel = await _context.Channels.FindAsync(id)
                ?? throw new NotFoundException($"Channel {id} not found");

            channel.Name = request.Name;
            channel.History = request.History;
            channel.StartDate = request.StartDate;
            channel.EndDate = request.EndDate;

            if (request.Logo != null)
                channel.LogoPath = await _fileUploadService.UploadAsync(request.Logo, MediaStorageLayout.ChannelFolder(channel.Id));

            await _context.SaveChangesAsync();
            return channel.Adapt<ChannelResponse>();
        }
    }
}
