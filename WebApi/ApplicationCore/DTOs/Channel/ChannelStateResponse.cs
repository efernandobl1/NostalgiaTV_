using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Channel
{
    public class ChannelStateResponse
    {
        public int ChannelId { get; set; }
        public long SegmentId { get; set; }
        public int EpisodeId { get; set; }
        public int SeriesId { get; set; }
        public int Season { get; set; }
        public int EpisodeNumber { get; set; }
        public string EpisodeTitle { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public string SeriesName { get; set; } = string.Empty;
        public string? SeriesLogoPath { get; set; }
        public double CurrentSecond { get; set; }
        public int NextEpisodeId { get; set; }
        public string? NextEpisodeTitle { get; set; }
        public double SecondsUntilNext { get; set; }
        public bool IsBumper { get; set; }
        public string? BumperTitle { get; set; }
    }
}
