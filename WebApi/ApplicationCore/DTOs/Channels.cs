using System.ComponentModel.DataAnnotations;

namespace ApplicationCore.DTOs;

// ── Admin: Canales y eras ──

public sealed record ChannelListItem(int Id, Guid ShareId, string Name, string? LogoPath, DateTime StartDate, DateTime? EndDate,
    int? ActiveEraId, string? ActiveEraName, int EraCount, int SeriesCount, NowPlaying? Now);

public sealed record ChannelDetail(int Id, Guid ShareId, string Name, string? History, string? LogoPath, DateTime StartDate,
    DateTime? EndDate, int? ActiveEraId, IReadOnlyList<EraItem> Eras);

public sealed record ChannelRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [StringLength(20000)] string? History,
    DateTime StartDate,
    DateTime? EndDate) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (EndDate < StartDate) yield return new("La fecha de fin no puede ser anterior al inicio.", [nameof(EndDate)]);
    }
}

public sealed record EraItem(int Id, int ChannelId, string Name, string? Description, DateTime HistoricalStartDate,
    DateTime? HistoricalEndDate, bool IsActive, int SeriesCount, int InterludeCount, BreakRuleItem? BreakRule);

public sealed record EraRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [StringLength(4000)] string? Description,
    DateTime HistoricalStartDate,
    DateTime? HistoricalEndDate) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (HistoricalEndDate < HistoricalStartDate)
            yield return new("La fecha de fin de la era no puede ser anterior al inicio.", [nameof(HistoricalEndDate)]);
    }
}

/// <summary>Series of an era; an empty Seasons list means every season.</summary>
public sealed record EraSeriesItem(int SeriesId, string Name, IReadOnlyList<int> AvailableSeasons, IReadOnlyList<int> Seasons, int EpisodeCount);

public sealed record EraSeriesSelection([Range(1, int.MaxValue)] int SeriesId, IReadOnlyList<int>? Seasons);

public sealed record EraSeriesRequest([Required] IReadOnlyList<EraSeriesSelection> Series);

public sealed record BreakRuleItem(int MinimumAds, int MaximumAds, int MaximumBreakSeconds);

public sealed record BreakRuleRequest([Range(1, 12)] int MinimumAds, [Range(1, 12)] int MaximumAds, [Range(1, 1800)] int MaximumBreakSeconds)
    : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (MaximumAds < MinimumAds) yield return new("El máximo de anuncios no puede ser menor que el mínimo.", [nameof(MaximumAds)]);
    }
}

/// <summary>An interlude assigned to the whole era (SeriesId null) or to one of its series.</summary>
public sealed record EraInterludeItem(int InterludeId, string Title, string Kind, string? BumperType, string Season,
    decimal DurationSeconds, bool ApprovedForBroadcast, int Weight, int MinimumGapSeconds, int? SeriesId, string? SeriesName);

public sealed record EraInterludeRequest([Range(1, 100)] int Weight, [Range(0, 604800)] int MinimumGapSeconds);

// ── Schedule (admin "Programación" and public guide) ──

public sealed record NowPlaying(long SegmentId, string Kind, int? EpisodeId, int? SeriesId, string? SeriesName, string Title,
    int? SeasonNumber, int? EpisodeNumber, DateTime StartsAtUtc, DateTime EndsAtUtc, double Progress);

/// <summary>One program block: the episode plus the bumpers and ads that air inside it.</summary>
public sealed record ScheduleProgram(long Id, int EpisodeId, int SeriesId, string SeriesName, string Title, int SeasonNumber,
    int EpisodeNumber, string EpisodeType, DateTime StartsAtUtc, DateTime EndsAtUtc, IReadOnlyList<ScheduleSegment> Segments);

public sealed record ScheduleSegment(long Id, string Kind, int? InterludeId, string Title, DateTime StartsAtUtc, DateTime EndsAtUtc,
    decimal? MediaStartSecond, decimal? MediaEndSecond, bool InAdBreak);

public sealed record GuideRow(int ChannelId, string ChannelName, string? LogoPath, IReadOnlyList<GuideSlot> Slots);

public sealed record GuideSlot(long ProgramId, int EpisodeId, int SeriesId, string SeriesName, string Title, int SeasonNumber,
    int EpisodeNumber, string EpisodeType, bool IsSpecial, bool IsNow, DateTime StartsAtUtc, DateTime EndsAtUtc);

// ── Public channels ──

public sealed record PublicChannelCard(int Id, Guid ShareId, string Name, string? LogoPath, string? EraName, bool OnAir,
    IReadOnlyList<string> Categories, NowPlaying? Now, GuideSlot? Next);

public sealed record PublicChannelDetail(int Id, Guid ShareId, string Name, string? History, string? LogoPath, DateTime StartDate,
    DateTime? EndDate, int? ActiveEraId, IReadOnlyList<PublicEra> Eras, IReadOnlyList<GuideSlot> Upcoming, int CommentCount);

public sealed record PublicEra(int Id, string Name, string? Description, DateTime HistoricalStartDate, DateTime? HistoricalEndDate,
    bool IsActive, IReadOnlyList<PublicEraSeries> Series);

public sealed record PublicEraSeries(int SeriesId, string Name, string? LogoPath, IReadOnlyList<int> Seasons);

/// <summary>Live state pushed every second over SignalR and returned by GET .../state.</summary>
public sealed record ChannelState(int ChannelId, long SegmentId, string Kind, int? EpisodeId, int? SeriesId, string? SeriesName,
    string? SeriesLogoPath, string Title, int? SeasonNumber, int? EpisodeNumber, string FilePath, double MediaStartSecond, double CurrentSecond,
    double SecondsUntilNext, string? NextTitle, DateTime StartsAtUtc, DateTime EndsAtUtc);
