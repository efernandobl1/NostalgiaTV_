using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Interfaces.Services;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Repositories;

/// <summary>External ids per provider and metadata imports; the web service itself is an IMetadataClient.</summary>
public sealed class MetadataRepository(NostalgiaTVContext context, IEnumerable<IMetadataClient> clients, ILogger<MetadataRepository> logger)
    : IMetadataRepository
{
    public async Task<IReadOnlyList<ExternalIdItem>> ListExternalIdsAsync(int seriesId)
    {
        await EnsureSeriesAsync(seriesId);
        return await context.SeriesExternalIds.AsNoTracking().Where(external => external.SeriesId == seriesId)
            .OrderBy(external => external.Provider.Code)
            .Select(external => new ExternalIdItem(external.ProviderId, external.Provider.Code, external.Provider.Name, external.ExternalId))
            .ToListAsync();
    }

    public async Task<ExternalIdItem> SetExternalIdAsync(int seriesId, int providerId, ExternalIdRequest request)
    {
        await EnsureSeriesAsync(seriesId);
        var provider = await context.MetadataProviders.AsNoTracking().SingleOrDefaultAsync(item => item.Id == providerId)
            ?? throw new NotFoundException("Proveedor no encontrado.");
        var value = request.ExternalId.Trim();
        if (await context.SeriesExternalIds.AnyAsync(item => item.ProviderId == providerId && item.ExternalId == value && item.SeriesId != seriesId))
            throw new ConflictException("Ese identificador ya está vinculado a otra serie.");
        // A soft-deleted link is revived so its import history stays attached.
        var external = await context.SeriesExternalIds.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.SeriesId == seriesId && item.ProviderId == providerId);
        if (external == null)
        {
            external = new SeriesExternalId { SeriesId = seriesId, ProviderId = providerId };
            context.SeriesExternalIds.Add(external);
        }
        external.ExternalId = value;
        external.DeletedAtUtc = null;
        await context.SaveChangesAsync();
        return new ExternalIdItem(provider.Id, provider.Code, provider.Name, external.ExternalId);
    }

    public async Task RemoveExternalIdAsync(int seriesId, int providerId)
    {
        var external = await context.SeriesExternalIds.SingleOrDefaultAsync(item => item.SeriesId == seriesId && item.ProviderId == providerId)
            ?? throw new NotFoundException("La serie no tiene identificador para ese proveedor.");
        external.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    public async Task<MetadataImportResult> ImportAsync(int seriesId, MetadataImportRequest request, CancellationToken token)
    {
        var external = await context.SeriesExternalIds.Include(item => item.Provider)
            .SingleOrDefaultAsync(item => item.SeriesId == seriesId && item.ProviderId == request.ProviderId, token)
            ?? throw new BadRequestException("Vincula primero el identificador de la serie en ese proveedor.");
        var client = clients.FirstOrDefault(item => item.ProviderCode == external.Provider.Code);
        if (client is not { IsConfigured: true })
            throw new BadRequestException($"El proveedor «{external.Provider.Name}» no tiene una integración configurada.");

        var language = string.IsNullOrWhiteSpace(request.LanguageCode) ? null : request.LanguageCode.Trim();
        var run = new MetadataImportRun { SeriesExternalId = external.Id, LanguageCode = language, Status = "Running", StartedAtUtc = DateTime.UtcNow };
        context.MetadataImportRuns.Add(run);
        await context.SaveChangesAsync(token);

        ExternalSeries remote;
        try { remote = await client.GetSeriesAsync(external.ExternalId, language, token); }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or InvalidOperationException or System.Text.Json.JsonException)
        {
            logger.LogWarning(error, "Metadata import {RunId} from {Provider} failed", run.Id, external.Provider.Code);
            await FinishAsync(run, "Failed");
            return new MetadataImportResult(run.Id, run.Status, 0, "El proveedor no respondió o no reconoce ese identificador.");
        }

        var series = await context.Series.SingleAsync(item => item.Id == seriesId, token);
        if (request.OverwriteDetails)
        {
            if (!string.IsNullOrWhiteSpace(remote.Overview)) series.Description = Truncate(remote.Overview.Trim(), 4000);
            if (remote.FirstAirDate is { } start) series.StartDate = start;
            if (remote.LastAirDate is { } end && end >= series.StartDate) series.EndDate = end;
            if (remote.Rating is { } rating) series.Rating = Math.Clamp(rating, 0, 10);
        }
        var updated = 0;
        if (request.OverwriteEpisodeTitles && remote.Episodes.Count > 0)
        {
            var titles = remote.Episodes.Where(item => !string.IsNullOrWhiteSpace(item.Title))
                .GroupBy(item => (item.SeasonNumber, item.EpisodeNumber)).ToDictionary(group => group.Key, group => group.First().Title.Trim());
            var episodes = await context.Episodes.Where(episode => episode.SeriesId == seriesId && episode.EpisodeTypeId == SeedIds.RegularEpisode)
                .ToListAsync(token);
            foreach (var episode in episodes)
            {
                if (!titles.TryGetValue((episode.SeasonNumber, episode.EpisodeNumber), out var title)) continue;
                title = Truncate(title, 300);
                if (episode.Title == title) continue;
                episode.Title = title;
                updated++;
            }
        }
        run.Status = "Completed";
        run.FinishedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync(token);
        return new MetadataImportResult(run.Id, run.Status, updated, null);
    }

    public async Task<IReadOnlyList<MetadataImportItem>> HistoryAsync(int seriesId)
    {
        await EnsureSeriesAsync(seriesId);
        return await context.MetadataImportRuns.AsNoTracking().IgnoreQueryFilters()
            .Where(run => run.External.SeriesId == seriesId)
            .OrderByDescending(run => run.StartedAtUtc).Take(50)
            .Select(run => new MetadataImportItem(run.Id, run.External.Provider.Name, run.External.ExternalId, run.LanguageCode, run.Status,
                run.StartedAtUtc, run.FinishedAtUtc))
            .ToListAsync();
    }

    private async Task EnsureSeriesAsync(int seriesId)
    {
        if (!await context.Series.AnyAsync(series => series.Id == seriesId)) throw new NotFoundException("Serie no encontrada.");
    }

    private async Task FinishAsync(MetadataImportRun run, string status)
    {
        run.Status = status;
        run.FinishedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync(CancellationToken.None);
    }

    private static string Truncate(string value, int length) => value.Length > length ? value[..length] : value;
}
