using System;
using System.Collections.Generic;
using System.Text;
using ApplicationCore.DTOs.ChannelEra;

namespace ApplicationCore.DTOs.Channel
{
    public class ChannelResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? LogoPath { get; set; }
        public string? History { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public List<int> SeriesIds { get; set; } = [];
        public List<ChannelEraResponse> Eras { get; set; } = [];
    }
}
