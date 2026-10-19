using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using ApplicationCore.Interfaces.Services;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

public sealed class TmdbSettings
{
    public string BaseUrl { get; set; } = "https://api.themoviedb.org/3/";
    /// <summary>A v4 read access token (sent as Bearer) or a v3 API key.</summary>
    public string? ApiKey { get; set; }
    public int MaxSeasons { get; set; } = 60;
}

/// <summary>The Movie Database (TMDB) TV endpoints: series details plus the episode titles of each season.</summary>
public sealed class TmdbMetadataClient(HttpClient http, IOptions<TmdbSettings> options) : IMetadataClient
{
    public string ProviderCode => "tmdb";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.Value.ApiKey);

    public async Task<ExternalSeries> GetSeriesAsync(string externalId, string? languageCode, CancellationToken token)
    {
        if (!int.TryParse(externalId, NumberStyles.None, CultureInfo.InvariantCulture, out var id) || id <= 0)
            throw new InvalidOperationException("TMDB series ids are positive integers.");
        var series = await GetAsync<TmdbSeries>($"tv/{id}", languageCode, token);
        var episodes = new List<ExternalEpisode>();
        foreach (var season in (series.Seasons ?? []).Where(item => item.SeasonNumber > 0).Take(Math.Max(1, options.Value.MaxSeasons)))
        {
            var details = await GetAsync<TmdbSeason>($"tv/{id}/season/{season.SeasonNumber}", languageCode, token);
            episodes.AddRange((details.Episodes ?? []).Where(item => !string.IsNullOrWhiteSpace(item.Name))
                .Select(item => new ExternalEpisode(item.SeasonNumber, item.EpisodeNumber, item.Name!)));
        }
        return new ExternalSeries(series.Name ?? "", series.Overview, Date(series.FirstAirDate), Date(series.LastAirDate),
            series.VoteAverage is > 0 ? (float)Math.Round(series.VoteAverage.Value, 1) : null, episodes);
    }

    private async Task<T> GetAsync<T>(string path, string? languageCode, CancellationToken token)
    {
        var key = options.Value.ApiKey ?? throw new InvalidOperationException("TMDB is not configured.");
        var bearer = key.Length > 40;
        var query = new List<string>();
        if (!string.IsNullOrWhiteSpace(languageCode)) query.Add("language=" + Uri.EscapeDataString(languageCode));
        if (!bearer) query.Add("api_key=" + Uri.EscapeDataString(key));
        using var request = new HttpRequestMessage(HttpMethod.Get, path + (query.Count > 0 ? "?" + string.Join('&', query) : ""));
        if (bearer) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        using var response = await http.SendAsync(request, token);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(token) ?? throw new InvalidOperationException("TMDB returned an empty response.");
    }

    private static DateOnly? Date(string? value) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? date : null;

    private sealed record TmdbSeries(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("overview")] string? Overview,
        [property: JsonPropertyName("first_air_date")] string? FirstAirDate,
        [property: JsonPropertyName("last_air_date")] string? LastAirDate,
        [property: JsonPropertyName("vote_average")] double? VoteAverage,
        [property: JsonPropertyName("seasons")] IReadOnlyList<TmdbSeasonSummary>? Seasons);

    private sealed record TmdbSeasonSummary([property: JsonPropertyName("season_number")] int SeasonNumber);

    private sealed record TmdbSeason([property: JsonPropertyName("episodes")] IReadOnlyList<TmdbEpisode>? Episodes);

    private sealed record TmdbEpisode(
        [property: JsonPropertyName("season_number")] int SeasonNumber,
        [property: JsonPropertyName("episode_number")] int EpisodeNumber,
        [property: JsonPropertyName("name")] string? Name);
}
