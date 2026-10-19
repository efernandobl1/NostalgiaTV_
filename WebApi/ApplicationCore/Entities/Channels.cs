namespace ApplicationCore.Entities;

public class Channel : ISoftDeletable
{
    public int Id { get; set; }
    public Guid ShareId { get; set; }
    public string Name { get; set; } = "";
    public string? History { get; set; }
    public string? LogoPath { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public ICollection<ChannelEra> Eras { get; set; } = [];
}

public class ChannelEra : ISoftDeletable
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? FolderPath { get; set; }
    public DateTime HistoricalStartDate { get; set; }
    public DateTime? HistoricalEndDate { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public Channel Channel { get; set; } = null!;
    public ChannelEraBreakRule? BreakRule { get; set; }
    public ICollection<ChannelEraSeries> Series { get; set; } = [];
    public ICollection<ChannelEraInterlude> Interludes { get; set; } = [];
}

/// <summary>The era each channel is broadcasting (1:1 with Channels).</summary>
public class ChannelEraSelection
{
    public int ChannelId { get; set; }
    public int ChannelEraId { get; set; }
    public DateTime SelectedAtUtc { get; set; }

    public ChannelEra ChannelEra { get; set; } = null!;
}

public class ChannelEraBreakRule
{
    public int ChannelEraId { get; set; }
    public int MinimumAds { get; set; }
    public int MaximumAds { get; set; }
    public int MaximumBreakSeconds { get; set; }

    public ChannelEra ChannelEra { get; set; } = null!;
}

/// <summary>Series in an era's lineup; a season filter exists when SelectedSeasons is not empty.</summary>
public class ChannelEraSeries
{
    public int ChannelEraId { get; set; }
    public int SeriesId { get; set; }

    public ChannelEra ChannelEra { get; set; } = null!;
    public Series Series { get; set; } = null!;
    public ICollection<ChannelEraSelectedSeason> SelectedSeasons { get; set; } = [];
    public ICollection<ChannelEraSeriesInterlude> Interludes { get; set; } = [];
}

public class ChannelEraSelectedSeason
{
    public int ChannelEraId { get; set; }
    public int SeriesId { get; set; }
    public int SeasonNumber { get; set; }

    public ChannelEraSeries ChannelEraSeries { get; set; } = null!;
}
