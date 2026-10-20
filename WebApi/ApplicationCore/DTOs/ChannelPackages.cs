namespace ApplicationCore.DTOs;

// ── Admin: channel packages (export / preview / import) ──

/// <summary>
/// Versioned JSON package of a channel: its eras, lineups (series by name and external ids), season
/// filters, break rules and interlude assignments (interludes by media-library path and title). No media
/// files travel in it: on import every reference is matched against the local library.
/// </summary>
public sealed record ChannelPackage(
    string Format,
    int Version,
    DateTime ExportedAtUtc,
    PackageChannel Channel,
    IReadOnlyList<PackageSeries> Series,
    IReadOnlyList<PackageInterlude> Interludes,
    IReadOnlyList<PackageEra> Eras)
{
    public const string FormatName = "nostalgiatv-channel";
    public const int CurrentVersion = 1;
    public const int MaxBytes = 1024 * 1024;
}

public sealed record PackageChannel(Guid ShareId, string Name, string? History, DateTime StartDate, DateTime? EndDate);

/// <summary>Key is local to the package; external ids are matched first, then the name (and start date on ties).</summary>
public sealed record PackageSeries(string Key, string Name, DateOnly StartDate, IReadOnlyList<PackageExternalId> ExternalIds);

public sealed record PackageExternalId(string Provider, string Id);

/// <summary>FilePath is the stored "/uploads/..." path; Title, Kind and BumperType match when the path does not.</summary>
public sealed record PackageInterlude(string Key, string Title, string Kind, string? BumperType, string Season, string FilePath);

public sealed record PackageEra(
    string Name,
    string? Description,
    DateTime HistoricalStartDate,
    DateTime? HistoricalEndDate,
    bool OnAir,
    PackageBreakRule? BreakRule,
    IReadOnlyList<PackageEraSeries> Series,
    IReadOnlyList<PackageEraInterlude> Interludes);

/// <summary>Series key plus its season filter; an empty Seasons list means every season.</summary>
public sealed record PackageEraSeries(string Series, IReadOnlyList<int> Seasons);

/// <summary>Interlude key assigned to the whole era (Series null) or only around one of its series.</summary>
public sealed record PackageEraInterlude(string Interlude, string? Series, int Weight, int MinimumGapSeconds);

public sealed record PackageBreakRule(int MinimumAds, int MaximumAds, int MaximumBreakSeconds);

/// <summary>Package export ready to download.</summary>
public sealed record ChannelPackageFile(string FileName, byte[] Content);

/// <summary>What an import would create, and which references the local library is missing.</summary>
public sealed record ChannelPackagePreview(
    int Version,
    string Name,
    bool NameTaken,
    int? SourceChannelId,
    IReadOnlyList<PackagePreviewEra> Eras,
    IReadOnlyList<PackagePreviewSeries> Series,
    IReadOnlyList<PackagePreviewInterlude> Interludes);

public sealed record PackagePreviewEra(string Name, int HistoricalStartYear, int? HistoricalEndYear, bool OnAir, PackageBreakRule? BreakRule,
    int SeriesCount, int MissingSeries, int InterludeCount, int MissingInterludes);

/// <summary>Status is "matched", "missing" or "ambiguous"; MatchedBy is "externalId" or "name".</summary>
public sealed record PackagePreviewSeries(string Key, string Name, int StartYear, string Status, int? SeriesId, string? MatchedBy,
    IReadOnlyList<int> MissingSeasons);

/// <summary>Status is "matched", "missing" or "ambiguous"; MatchedBy is "filePath" or "title".</summary>
public sealed record PackagePreviewInterlude(string Key, string Title, string Kind, string? BumperType, string Status, int? InterludeId,
    string? MatchedBy);

public sealed record ChannelPackageImportResult(int ChannelId, string Name, int Eras, int SeriesLinked, int SeriesSkipped,
    int InterludesLinked, int InterludesSkipped);
