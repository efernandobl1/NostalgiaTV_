using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class ChannelEra
    {
        public int Id { get; set; }
        public int ChannelId { get; set; }
        public Channel Channel { get; set; } = null!;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? FolderPath { get; set; }
        public ICollection<Series> Series { get; set; } = [];
        public ICollection<ChannelBumper> Bumpers { get; set; } = [];
    }
}
