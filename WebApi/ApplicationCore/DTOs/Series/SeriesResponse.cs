using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Series
{
    public class SeriesResponse
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }
        public string? History { get; set; }
        public DateOnly StartDate { get; set; }
        public DateOnly? EndDate { get; set; }
        public string? LogoPath { get; set; }
        public float? Rating { get; set; }
        public int Seasons { get; set; }
        public string? FolderPath { get; set; }
        public List<int> CategoryIds { get; set; } = [];
    }
}
