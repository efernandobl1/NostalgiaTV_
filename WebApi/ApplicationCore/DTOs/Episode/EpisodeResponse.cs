using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Episode
{
    public class EpisodeResponse
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? FilePath { get; set; }
        public int Season { get; set; }
        public int EpisodeNumber { get; set; }
        public int EpisodeTypeId { get; set; }
        public string EpisodeTypeName { get; set; } = string.Empty;
        public int SeriesId { get; set; }
    }
}
