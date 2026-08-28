using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class ChannelScheduleEntry
    {
        public int Id { get; set; }
        public int ChannelId { get; set; }
        public Channel Channel { get; set; } = null!;
        public int? EpisodeId { get; set; }
        public Episode? Episode { get; set; }
        public int? BumperId { get; set; }
        public ChannelBumper? Bumper { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
    }
}
