using ApplicationCore.DTOs.Channel;
using ApplicationCore.DTOs.ChannelBumper;
using ApplicationCore.DTOs.ChannelEra;
using ApplicationCore.DTOs.Episode;
using ApplicationCore.DTOs.Rol;
using ApplicationCore.DTOs.Series;
using ApplicationCore.Entities;
using Mapster;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Mappings
{
    public static class MappingConfig
    {
        public static void Configure()
        {
            TypeAdapterConfig<Channel, ChannelResponse>.NewConfig()
                .Map(dest => dest.SeriesIds, src => src.Series.Select(s => s.Id).ToList())
                .Map(dest => dest.Eras, src => src.Eras.Select(e => new ChannelEraResponse
                {
                    Id = e.Id,
                    ChannelId = e.ChannelId,
                    ChannelName = e.Channel.Name,
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
                }).ToList());

            TypeAdapterConfig<SeriesRequest, Series>.NewConfig()
                .Map(dest => dest.StartDate, src => DateOnly.FromDateTime(src.StartDate))
                .Map(dest => dest.EndDate, src => src.EndDate.HasValue ? DateOnly.FromDateTime(src.EndDate.Value) : (DateOnly?)null);

            TypeAdapterConfig<Series, SeriesResponse>.NewConfig()
                .Map(dest => dest.CategoryIds, src => src.Categories.Select(c => c.Id).ToList())
                .Map(dest => dest.StartDate, src => src.StartDate.ToString("yyyy-MM-dd"))
                .Map(dest => dest.EndDate, src => src.EndDate.HasValue ? src.EndDate.Value.ToString("yyyy-MM-dd") : null);

            TypeAdapterConfig<Rol, RolResponse>.NewConfig()
                .Map(dest => dest.MenuIds, src => src.Menus.Select(m => m.Id).ToList());

            TypeAdapterConfig<Episode, EpisodeResponse>.NewConfig()
                .Map(dest => dest.EpisodeTypeName, src => src.EpisodeType.Name);
        }
    }
}
