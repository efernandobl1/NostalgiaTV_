using System;
using System.Collections.Generic;
using ApplicationCore.DTOs.ChannelBumper;

namespace ApplicationCore.DTOs.ChannelEra
{
    public class ChannelEraResponse
    {
        public int Id { get; set; }
        public int ChannelId { get; set; }
        public string ChannelName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? FolderPath { get; set; }
        public List<int> SeriesIds { get; set; } = [];
        public List<ChannelBumperResponse> Bumpers { get; set; } = [];
    }
}
