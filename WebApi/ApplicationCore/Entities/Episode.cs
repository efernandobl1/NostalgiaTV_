using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class Episode
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? FilePath { get; set; }
        public int EpisodeTypeId { get; set; }
        public EpisodeType EpisodeType { get; set; } = null!;
        public int Season { get; set; }
        public int EpisodeNumber { get; set; }
        public int SeriesId { get; set; }
        public Series Series { get; set; } = null!;
    }
}
