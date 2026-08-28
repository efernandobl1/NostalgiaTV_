using System;
using Microsoft.AspNetCore.Http;

namespace ApplicationCore.DTOs.ChannelBumper
{
    public class ChannelBumperRequest
    {
        public string Title { get; set; } = string.Empty;
        public IFormFile? File { get; set; }
        public int Order { get; set; }
    }
}
