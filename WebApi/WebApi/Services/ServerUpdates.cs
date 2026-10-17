using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Services;

public sealed record ServerRelease(string Version, string Commit, string Url);
public sealed record UpdateAgentStatus(string State, DateTimeOffset Heartbeat, string? Message = null);
public sealed record ServerUpdateStatus(string CurrentCommit, ServerRelease? Release, bool Available,
    bool AgentConnected, string State, string? Message);

public sealed class ServerUpdates(HttpClient http, IConfiguration configuration, TimeProvider clock)
{
    private readonly SemaphoreSlim gate = new(1);
    private ServerRelease? latest;
    private DateTimeOffset checkedAt;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public string CurrentCommit => (string.IsNullOrEmpty(configuration["ServerUpdates:CurrentCommit"]) ? null : configuration["ServerUpdates:CurrentCommit"])
        ?? typeof(ServerUpdates).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(item => item.Key == "RepositoryCommit")?.Value ?? "development";
    private string? Requests => configuration["ServerUpdates:RequestsPath"];
    private string? StatusPath => configuration["ServerUpdates:StatusPath"];

    public async Task<ServerUpdateStatus> GetAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (checkedAt == default || clock.GetUtcNow() - checkedAt > TimeSpan.FromMinutes(30))
            {
                using var response = await http.GetAsync("https://api.github.com/repos/efernandobl1/NostalgiaTV_/releases/latest", cancellationToken);
                response.EnsureSuccessStatusCode();
                using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
                latest = ParseRelease(document.RootElement);
                checkedAt = clock.GetUtcNow();
            }
        }
        catch (HttpRequestException) { /* Keep the previous verified metadata during a registry outage. */ }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested) { }
        catch (JsonException) { }
        finally { gate.Release(); }
        UpdateAgentStatus? agent = null;
        try
        {
            if (StatusPath is not null && File.Exists(Path.Combine(StatusPath, "status.json")))
                agent = JsonSerializer.Deserialize<UpdateAgentStatus>(await File.ReadAllTextAsync(Path.Combine(StatusPath, "status.json"), cancellationToken), Json);
        }
        catch (IOException) { }
        catch (JsonException) { }
        var connected = agent is not null && agent.State != "unavailable" && clock.GetUtcNow() - agent.Heartbeat < TimeSpan.FromMinutes(10);
        return new(CurrentCommit, latest, latest is not null && CurrentCommit != latest.Commit,
            connected, connected ? agent!.State : "offline", agent?.Message);
    }

    public static ServerRelease? ParseRelease(JsonElement release)
    {
        if (release.ValueKind != JsonValueKind.Object ||
            !release.TryGetProperty("draft", out var draft) || draft.ValueKind != JsonValueKind.False ||
            !release.TryGetProperty("prerelease", out var preview) || preview.ValueKind != JsonValueKind.False ||
            !release.TryGetProperty("tag_name", out var name) || name.ValueKind != JsonValueKind.String ||
            !release.TryGetProperty("target_commitish", out var target) || target.ValueKind != JsonValueKind.String ||
            !release.TryGetProperty("assets", out var assets) || assets.ValueKind != JsonValueKind.Array) return null;
        var tag = name.GetString() ?? "";
        var commit = target.GetString() ?? "";
        if (!Regex.IsMatch(tag, @"^v\d+\.\d+\.\d+$") || !Regex.IsMatch(commit, "^[a-f0-9]{40}$")) return null;
        if (!assets.EnumerateArray().Any(asset => asset.ValueKind == JsonValueKind.Object &&
            asset.TryGetProperty("name", out var assetName) && assetName.ValueKind == JsonValueKind.String && assetName.GetString() == "release.json")) return null;
        return new(tag, commit, "https://github.com/efernandobl1/NostalgiaTV_/releases/tag/" + tag);
    }

    public async Task<bool> RequestAsync(CancellationToken cancellationToken)
    {
        var status = await GetAsync(cancellationToken);
        if (!status.Available || !status.AgentConnected || Requests is null || status.State is "updating" or "backing-up") return false;
        try
        {
            await using var file = new FileStream(Path.Combine(Requests, "update.json"), FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await JsonSerializer.SerializeAsync(file, new { requestedAt = clock.GetUtcNow() }, Json, cancellationToken);
            return true;
        }
        catch (IOException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
    }

    public async Task ExportPolicyAsync(bool enabled, int hour, string zone, CancellationToken cancellationToken)
    {
        if (Requests is null || !Directory.Exists(Requests)) return;
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(zone);
        var today = TimeZoneInfo.ConvertTime(clock.GetUtcNow(), timeZone).Date.AddHours(hour);
        var windowStartUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(today, DateTimeKind.Unspecified), timeZone);
        var temporary = Path.Combine(Requests, "policy-" + Guid.NewGuid().ToString("N") + ".tmp");
        try
        {
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(new { enabled, hour, timeZone = zone, windowStartUtc }, Json), cancellationToken);
            File.Move(temporary, Path.Combine(Requests, "policy.json"), overwrite: true);
        }
        finally { File.Delete(temporary); }
    }
}

public sealed class UpdatePolicyPublisher(IServiceScopeFactory scopes, ServerUpdates updates, ILogger<UpdatePolicyPublisher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var settings = await scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>().PlatformSettings.AsNoTracking().SingleAsync(stoppingToken);
                await updates.ExportPolicyAsync(settings.AutomaticUpdatesEnabled, settings.UpdateHour, settings.TimeZoneId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogWarning(error, "Unable to publish server update policy"); }
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
