using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Channel
{
    public class ChannelScheduleEntryResponse
    {
        public int Id { get; set; }
        public int ChannelId { get; set; }
        public int? EpisodeId { get; set; }
        public string EpisodeTitle { get; set; } = string.Empty;
        public string SeriesName { get; set; } = string.Empty;
        public string? SeriesLogoPath { get; set; }
        public string FilePath { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public int Season { get; set; }
        public int EpisodeNumber { get; set; }
        public int? BumperId { get; set; }
        public string? BumperTitle { get; set; }
    }
}
