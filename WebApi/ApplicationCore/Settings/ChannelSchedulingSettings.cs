namespace ApplicationCore.Settings
{
    /// <summary>
    /// Configurable rules for random channel scheduling.
    /// Snapshot of the database settings used during one schedule-generation pass.
    /// </summary>
    public class ChannelSchedulingSettings
    {
        public string TimeZoneId { get; set; } = "America/Guatemala";
        public bool HalloweenEnabled { get; set; } = true;
        public bool SeasonalEpisodesEnabled { get; set; } = true;
        public bool SeasonalInterludesEnabled { get; set; } = true;

        /// <summary>Maximum preferred gap between airings; reduced for small catalogs.</summary>
        public int NoRepeatWindowHours { get; set; } = 24;

        /// <summary>Maximum specials per series and day.</summary>
        public int MaxSpecialsPerSeriesPerDay { get; set; } = 2;

        /// <summary>Maximum specials per day across all series.</summary>
        public int MaxSpecialsPerDay { get; set; } = 5;

        /// <summary>Maximum movies per series and day.</summary>
        public int MaxMoviesPerSeriesPerDay { get; set; } = 2;

        /// <summary>Maximum movies per day across all series.</summary>
        public int MaxMoviesPerDay { get; set; } = 2;
    }
}
