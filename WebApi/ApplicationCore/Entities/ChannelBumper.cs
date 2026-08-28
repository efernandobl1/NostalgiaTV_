using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class ChannelBumper
    {
        public int Id { get; set; }
        public int ChannelEraId { get; set; }
        public ChannelEra ChannelEra { get; set; } = null!;
        public string Title { get; set; } = string.Empty;
        public string? FilePath { get; set; }
        public int Order { get; set; }
    }
}
