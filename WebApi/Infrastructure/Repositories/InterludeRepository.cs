using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using ApplicationCore.Settings;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Infrastructure.Repositories;

/// <summary>Bumpers and ads library. Only approved interludes reach the schedule.</summary>
public sealed class InterludeRepository(NostalgiaTVContext context, MediaLibrary library, IScheduleRepository schedule,
    IOptions<SeriesUploadSettings> uploads) : IInterludeRepository
{
    public async Task<IReadOnlyList<InterludeItem>> ListAsync(InterludeQuery query)
    {
        var interludes = context.Interludes.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Kind)) interludes = interludes.Where(item => item.Kind == query.Kind);
        if (!string.IsNullOrWhiteSpace(query.Season)) interludes = interludes.Where(item => item.Season == query.Season);
        if (query.Approved is bool approved) interludes = interludes.Where(item => item.ApprovedForBroadcast == approved);
        if (!string.IsNullOrWhiteSpace(query.Search)) interludes = interludes.Where(item => item.Title.Contains(query.Search.Trim()));
        return await Project(interludes.OrderBy(item => item.Kind).ThenBy(item => item.Title)).ToListAsync();
    }

    public async Task<InterludeItem> UploadAsync(InterludeRequest request, FileUpload file, CancellationToken token)
    {
        var maxBytes = (long)Math.Max(1, uploads.Value.MaxFileSizeMB) * 1024 * 1024;
        var (path, info) = await library.SaveVideoAsync(file, MediaStorageLayout.BroadcastFolder(request.Kind), null, maxBytes, token);
        if (!info.Compatible || info.Duration <= 0)
        {
            library.DeleteIfExists(library.PublicPath(path));
            throw new BadRequestException("Los interludios deben ser MP4 H.264/AAC compatibles con el navegador. " + info.IncompatibilityReason);
        }
        var interlude = new Interlude
        {
            FilePath = library.PublicPath(path),
            DurationSeconds = decimal.Round((decimal)info.Duration, 3)
        };
        Apply(interlude, request, Path.GetFileNameWithoutExtension(file.FileName));
        context.Interludes.Add(interlude);
        try { await context.SaveChangesAsync(token); }
        catch
        {
            library.DeleteIfExists(interlude.FilePath);
            throw;
        }
        return await GetAsync(interlude.Id);
    }

    public async Task<(InterludeItem Item, IReadOnlyList<int> AffectedChannels)> UpdateAsync(int id, InterludeRequest request)
    {
        var interlude = await context.Interludes.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        // The file stays where it was uploaded; only the metadata changes.
        Apply(interlude, request, interlude.Title);
        await context.SaveChangesAsync();
        var channels = await RefreshAsync(id);
        return (await GetAsync(id), channels);
    }

    public async Task<IReadOnlyList<int>> SetApprovalAsync(int id, bool approved)
    {
        var interlude = await context.Interludes.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        if (interlude.ApprovedForBroadcast == approved) return [];
        interlude.ApprovedForBroadcast = approved;
        await context.SaveChangesAsync();
        return await RefreshAsync(id);
    }

    /// <summary>Soft delete: past schedule rows keep pointing at it, upcoming ones are rebuilt without it.</summary>
    public async Task DeleteAsync(int id)
    {
        var interlude = await context.Interludes.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        var channels = await ChannelsAiringAsync(id);
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.ChannelEraInterludes.Where(item => item.InterludeId == id).ExecuteDeleteAsync();
        await context.ChannelEraSeriesInterludes.Where(item => item.InterludeId == id).ExecuteDeleteAsync();
        interlude.ApprovedForBroadcast = false;
        interlude.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        foreach (var channelId in channels) await schedule.RegenerateAsync(channelId, replaceCurrent: false);
    }

    private async Task<InterludeItem> GetAsync(int id) =>
        await Project(context.Interludes.AsNoTracking().Where(item => item.Id == id)).SingleOrDefaultAsync() ?? throw NotFound();

    private IQueryable<InterludeItem> Project(IQueryable<Interlude> interludes) => interludes.Select(item => new InterludeItem(item.Id, item.Title,
        item.Kind, item.BumperType, item.Season, item.FilePath, item.DurationSeconds, item.ApprovedForBroadcast, item.RedistributionAllowed,
        item.License, item.SourceUrl, item.RegionCode, item.OriginalYearFrom, item.OriginalYearTo,
        context.ChannelEraInterludes.Where(link => link.InterludeId == item.Id && link.ChannelEra.DeletedAtUtc == null).Select(link => link.ChannelEraId)
            .Union(context.ChannelEraSeriesInterludes.Where(link => link.InterludeId == item.Id && link.ChannelEraSeries.ChannelEra.DeletedAtUtc == null)
                .Select(link => link.ChannelEraId)).Count()));

    private static void Apply(Interlude interlude, InterludeRequest request, string fallbackTitle)
    {
        var title = string.IsNullOrWhiteSpace(request.Title) ? fallbackTitle.Trim() : request.Title.Trim();
        interlude.Title = string.IsNullOrEmpty(title) ? "Interludio" : title.Length > 300 ? title[..300] : title;
        interlude.Kind = request.Kind;
        interlude.BumperType = request.Kind == InterludeKind.Bumper ? request.BumperType : null;
        interlude.Season = request.Season;
        interlude.RedistributionAllowed = request.RedistributionAllowed;
        interlude.License = string.IsNullOrWhiteSpace(request.License) ? null : request.License.Trim();
        interlude.SourceUrl = string.IsNullOrWhiteSpace(request.SourceUrl) ? null : request.SourceUrl.Trim();
        interlude.RegionCode = string.IsNullOrWhiteSpace(request.RegionCode) ? null : request.RegionCode.Trim().ToUpperInvariant();
        interlude.OriginalYearFrom = request.OriginalYearFrom;
        interlude.OriginalYearTo = request.OriginalYearTo;
    }

    /// <summary>Channels whose era on air uses the interlude, era-wide or for one of its series.</summary>
    private Task<List<int>> ChannelsAiringAsync(int interludeId) =>
        context.ChannelEraSelections.Where(selection =>
                context.ChannelEraInterludes.Any(link => link.ChannelEraId == selection.ChannelEraId && link.InterludeId == interludeId)
                || context.ChannelEraSeriesInterludes.Any(link => link.ChannelEraId == selection.ChannelEraId && link.InterludeId == interludeId))
            .Select(selection => selection.ChannelId).ToListAsync();

    private async Task<IReadOnlyList<int>> RefreshAsync(int interludeId)
    {
        var channels = await ChannelsAiringAsync(interludeId);
        foreach (var channelId in channels) await schedule.RegenerateAsync(channelId, replaceCurrent: false);
        return channels;
    }

    private static NotFoundException NotFound() => new("Interludio no encontrado.");
}
