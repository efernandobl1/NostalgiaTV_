using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class ChannelState
    {
        public int Id { get; set; }
        public int ChannelId { get; set; }
        public Channel Channel { get; set; } = null!;
        public int CurrentEpisodeId { get; set; }
        public Episode CurrentEpisode { get; set; } = null!;
        public double CurrentSecond { get; set; }
        public DateTime LastUpdated { get; set; }
    }
}
