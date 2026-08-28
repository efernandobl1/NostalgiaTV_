using System;

namespace ApplicationCore.DTOs.ChannelBumper
{
    public class ChannelBumperResponse
    {
        public int Id { get; set; }
        public int ChannelEraId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? FilePath { get; set; }
        public int Order { get; set; }
    }
}
