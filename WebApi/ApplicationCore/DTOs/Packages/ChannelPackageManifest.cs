using ApplicationCore.Entities;

namespace ApplicationCore.DTOs.Packages;

public sealed class ChannelPackageManifest
{
    public int SchemaVersion { get; set; } = 1;
    public Guid PackageId { get; set; }
    public string Version { get; set; } = "1.0.0";
    public string SchedulingMode { get; set; } = "Shuffle";
    public string Name { get; set; } = "";
    public string? History { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? LogoAsset { get; set; }
    public string? SelectedEra { get; set; }
    public int ExcludedClips { get; set; }
    public List<PackageSeries> Series { get; set; } = [];
    public List<PackageEra> Eras { get; set; } = [];
    public List<PackageClip> Clips { get; set; } = [];
    public List<PackageAsset> Assets { get; set; } = [];
}

public sealed class PackageSeries
{
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public DateOnly StartDate { get; set; }
    public int Seasons { get; set; }
    public List<PackageExternalId> ExternalIds { get; set; } = [];
}
public sealed record PackageExternalId(string Provider, string ExternalId);
public sealed class PackageEra
{
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public List<PackageSeriesSelection> Series { get; set; } = [];
    public List<PackageClipAssignment> Clips { get; set; } = [];
    public PackageBreakRules? BreakRules { get; set; }
}
public sealed record PackageSeriesSelection(string SeriesKey, bool HasSeasonFilter, int[] Seasons);
public sealed record PackageClipAssignment(string ClipKey, BreakRole Role, int Weight, int MinimumGapSeconds);
public sealed record PackageBreakRules(int MinimumAds, int MaximumAds, int MaximumBreakSeconds);
public sealed class PackageClip
{
    public string Key { get; set; } = "";
    public string Title { get; set; } = "";
    public InterludeKind Kind { get; set; }
    public InterludeSeason Season { get; set; }
    public string Asset { get; set; } = "";
    public int? OriginalYearFrom { get; set; }
    public int? OriginalYearTo { get; set; }
    public string? RegionCode { get; set; }
    public string? SourceUrl { get; set; }
    public string License { get; set; } = "";
}
public sealed record PackageAsset(string Path, long Size, string Sha256);
public sealed record PackageSeriesMatch(string Key, string Name, int? ExistingId, int AvailableEpisodes);
public sealed record ChannelPackagePreview(ChannelPackageManifest Manifest, string Fingerprint,
    bool AlreadyInstalled, IReadOnlyList<PackageSeriesMatch> Series, long DownloadBytes);
public sealed record ChannelPackageImportResult(int ChannelId, int NewSeries, int ReusedSeries, int ImportedClips);
