using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class Series
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
        public ICollection<Category> Categories { get; set; } = [];
        public ICollection<Episode> Episodes { get; set; } = [];
        public ICollection<Channel> Channels { get; set; } = [];
        public ICollection<ChannelEra> ChannelEras { get; set; } = [];
    }
}
