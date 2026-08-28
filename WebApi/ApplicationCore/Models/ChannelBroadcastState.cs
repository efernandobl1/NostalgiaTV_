using ApplicationCore.DTOs.Channel;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Models
{
    public class ChannelBroadcastState
    {
        public int ChannelId { get; set; }
        public int CurrentEpisodeId { get; set; }
        public double CurrentSecond { get; set; }
        public DateTime StartedAt { get; set; }
        public double DurationSeconds { get; set; }

        // Cached payload for the current schedule entry. Built once per entry (on transition)
        // and reused every broadcast tick; only the time-based fields are recomputed per tick.
        // Reset to null to force a rebuild on the next tick.
        public ChannelStateResponse? CachedResponse { get; set; }
    }
}
