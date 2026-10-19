namespace ApplicationCore.Interfaces.Services;

/// <summary>External catalog web service (TMDB, TheTVDB...). Implementations live in Infrastructure/Services.</summary>
public interface IMetadataClient
{
    /// <summary>Provider code it serves, matching MetadataProviders.Code.</summary>
    string ProviderCode { get; }
    bool IsConfigured { get; }
    Task<ExternalSeries> GetSeriesAsync(string externalId, string? languageCode, CancellationToken token);
}

public sealed record ExternalSeries(string Name, string? Overview, DateOnly? FirstAirDate, DateOnly? LastAirDate, float? Rating,
    IReadOnlyList<ExternalEpisode> Episodes);

public sealed record ExternalEpisode(int SeasonNumber, int EpisodeNumber, string Title);
