using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Episode
{
    public class UpdateEpisodeRequest
    {
        public string? Title { get; set; }
        public int EpisodeNumber { get; set; }
        public int EpisodeTypeId { get; set; }
    }
}
