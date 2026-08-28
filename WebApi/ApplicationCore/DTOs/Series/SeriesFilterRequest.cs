using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Series
{
    public class SeriesFilterRequest
    {
        public string? Name { get; set; }
        public int? ChannelId { get; set; }
        public int? EpisodeTypeId { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }

    
}
