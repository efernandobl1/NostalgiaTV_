using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class Channel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? LogoPath { get; set; }
        public string? History { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public ICollection<Series> Series { get; set; } = [];
        public ICollection<ChannelEra> Eras { get; set; } = [];
        public ChannelState? State { get; set; }
    }
}
