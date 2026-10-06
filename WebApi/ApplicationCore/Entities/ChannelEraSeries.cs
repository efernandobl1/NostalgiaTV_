namespace ApplicationCore.Entities
{
    public class ChannelEraSeries
    {
        public int ChannelEraId { get; set; }
        public ChannelEra ChannelEra { get; set; } = null!;
        public int SeriesId { get; set; }
        public Series Series { get; set; } = null!;
        public bool HasSeasonFilter { get; set; }
        public ICollection<ChannelEraSelectedSeason> SelectedSeasons { get; set; } = [];
    }
}
