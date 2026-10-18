namespace ApplicationCore.Entities;

public class Interlude : ISoftDeletable
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Kind { get; set; } = InterludeKind.Bumper;
    /// <summary>Only for bumpers: ComingUp = "Ya viene", WeContinueWith = "Continuamos con", Generic.</summary>
    public string? BumperType { get; set; }
    public string Season { get; set; } = InterludeSeason.AllYear;
    public string FilePath { get; set; } = "";
    public decimal DurationSeconds { get; set; }
    public bool ApprovedForBroadcast { get; set; }
    public bool RedistributionAllowed { get; set; }
    public string? License { get; set; }
    public string? SourceUrl { get; set; }
    public string? RegionCode { get; set; }
    public int? OriginalYearFrom { get; set; }
    public int? OriginalYearTo { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
}

/// <summary>Era-wide bumper or ad; its break role derives from Interlude.Kind and BumperType.</summary>
public class ChannelEraInterlude
{
    public int ChannelEraId { get; set; }
    public int InterludeId { get; set; }
    public int Weight { get; set; }
    public int MinimumGapSeconds { get; set; }

    public ChannelEra ChannelEra { get; set; } = null!;
    public Interlude Interlude { get; set; } = null!;
}

/// <summary>Bumper or ad that only airs around one series of the era.</summary>
public class ChannelEraSeriesInterlude
{
    public int ChannelEraId { get; set; }
    public int SeriesId { get; set; }
    public int InterludeId { get; set; }
    public int Weight { get; set; }
    public int MinimumGapSeconds { get; set; }

    public ChannelEraSeries ChannelEraSeries { get; set; } = null!;
    public Interlude Interlude { get; set; } = null!;
}
