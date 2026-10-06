namespace ApplicationCore.Entities
{
    public class ChannelEraSelectedSeason
    {
        public int ChannelEraId { get; set; }
        public int SeriesId { get; set; }
        public int SeasonNumber { get; set; }
        public ChannelEraSeries ChannelEraSeries { get; set; } = null!;
    }
}
