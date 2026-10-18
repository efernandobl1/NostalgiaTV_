using System.ComponentModel.DataAnnotations;
using ApplicationCore.Models;

namespace ApplicationCore.DTOs;

// ── Admin: Series y episodios ──

public sealed record SeriesListItem(int Id, string Name, string? LogoPath, DateOnly StartDate, DateOnly? EndDate, float? Rating,
    IReadOnlyList<IdName> Categories, IReadOnlyList<int> Seasons, int EpisodeCount, int MissingEpisodeCount, int OnAirChannelCount);

public sealed record SeriesDetail(int Id, string Name, string? Description, string? History, string? LogoPath, string? FolderPath,
    float? Rating, DateOnly StartDate, DateOnly? EndDate, IReadOnlyList<IdName> Categories, IReadOnlyList<SeasonSummary> Seasons,
    IReadOnlyList<ExternalIdItem> ExternalIds);

public sealed record SeasonSummary(int SeasonNumber, int EpisodeCount, int MissingCount);

/// <summary>Multipart body for creating or editing a series (the logo is optional).</summary>
public sealed record SeriesRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [StringLength(4000)] string? Description,
    [StringLength(20000)] string? History,
    [Range(0, 10)] float? Rating,
    DateOnly StartDate,
    DateOnly? EndDate,
    IReadOnlyList<int>? CategoryIds,
    [Range(0, 200)] int InitialSeasons = 0) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (EndDate < StartDate) yield return new("La fecha de fin no puede ser anterior al inicio.", [nameof(EndDate)]);
    }
}

public sealed record CategoriesRequest([Required] IReadOnlyList<int> CategoryIds);

public sealed record SeasonRequest([Range(0, 999)] int SeasonNumber);

public sealed record EpisodeItem(int Id, int SeriesId, int SeasonNumber, int EpisodeNumber, int EpisodeTypeId, string EpisodeType,
    string Title, string? FilePath, bool IsAvailable, long? FileSizeBytes, int BreakPointCount);

public sealed record EpisodeRequest(
    [Required, StringLength(300, MinimumLength = 1)] string Title,
    [Range(0, 999)] int SeasonNumber,
    [Range(0, 9999)] int EpisodeNumber,
    [Range(1, int.MaxValue)] int EpisodeTypeId);

public sealed record BreakPointItem(int Id, int EpisodeId, decimal OffsetSeconds, string? Label);

public sealed record BreakPointRequest([Range(typeof(decimal), "0.001", "86400")] decimal OffsetSeconds, [StringLength(200)] string? Label);

/// <summary>Where uploaded episode files go inside the series folder.</summary>
public sealed record EpisodeUploadTarget(string Folder, int? SeasonNumber)
{
    public static EpisodeUploadTarget? Parse(string? target, int? season) => (target ?? "season").Trim().ToLowerInvariant() switch
    {
        "season" when season is >= 1 and <= 999 => new("season", season),
        "specials" => new("specials", 0),
        "movies" => new("movies", 0),
        _ => null
    };
}

public sealed record EpisodeUploadResult(string FileName, bool Success, string? Message, int? EpisodeId);

public sealed record ScanResult(int Imported, int MarkedMissing, int Pending);

// ── Metadata ──

public sealed record ExternalIdItem(int ProviderId, string ProviderCode, string ProviderName, string ExternalId);

public sealed record ExternalIdRequest([Required, StringLength(300, MinimumLength = 1)] string ExternalId);

public sealed record MetadataImportRequest([Range(1, int.MaxValue)] int ProviderId, [StringLength(20)] string? LanguageCode,
    bool OverwriteDetails = true, bool OverwriteEpisodeTitles = true);

public sealed record MetadataImportItem(long Id, string Provider, string ExternalId, string? LanguageCode, string Status,
    DateTime StartedAtUtc, DateTime? FinishedAtUtc);

public sealed record MetadataImportResult(long RunId, string Status, int UpdatedEpisodes, string? Message);

// ── Public catalog ──

public sealed record SeriesQuery(string? Search, int[]? CategoryIds, int? Decade, bool OnAirToday = false, int? ChannelId = null,
    string Sort = "name", int Page = 1, int PageSize = 24);

public sealed record PublicSeriesCard(int Id, string Name, string? LogoPath, int StartYear, int? EndYear, float? Rating,
    IReadOnlyList<string> Categories, IReadOnlyList<OnAirChannel> OnAir, int SeasonCount, int EpisodeCount);

public sealed record OnAirChannel(int ChannelId, string ChannelName);

public sealed record PublicSeriesDetail(int Id, string Name, string? Description, string? History, string? LogoPath,
    DateOnly StartDate, DateOnly? EndDate, float? Rating, IReadOnlyList<string> Categories, IReadOnlyList<int> Seasons,
    IReadOnlyList<OnAirChannel> OnAir, int CommentCount);

public sealed record PublicEpisode(int Id, int SeasonNumber, int EpisodeNumber, string EpisodeType, string Title, string FilePath);

public sealed record CategoryFacet(int Id, string Name, int SeriesCount);
