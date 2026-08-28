using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Series
{
    public class SeriesRequest
    {
        public string Name { get; set; }
        public string? Description { get; set; }
        public string? History { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public IFormFile? Logo { get; set; }
        public float? Rating { get; set; }
        public int Seasons { get; set; }
    }
}
