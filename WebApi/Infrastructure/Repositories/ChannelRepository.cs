using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Infrastructure.Media;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

/// <summary>Channels, their historical eras, lineups, break rules and interlude assignments.</summary>
public sealed class ChannelRepository(NostalgiaTVContext context, MediaLibrary library, IScheduleRepository schedule) : IChannelRepository
{
    // ── Channels ──

    public async Task<IReadOnlyList<ChannelListItem>> ListAsync()
    {
        var channels = await context.Channels.AsNoTracking().OrderBy(channel => channel.Name)
            .Select(channel => new
            {
                channel.Id, channel.ShareId, channel.Name, channel.LogoPath, channel.StartDate, channel.EndDate,
                Active = context.ChannelEraSelections.Where(selection => selection.ChannelId == channel.Id)
                    .Select(selection => new { selection.ChannelEraId, selection.ChannelEra.Name }).FirstOrDefault(),
                Eras = channel.Eras.Count(era => era.DeletedAtUtc == null),
                Series = context.ChannelEraSeries.Where(link => link.ChannelEra.ChannelId == channel.Id && link.ChannelEra.DeletedAtUtc == null)
                    .Select(link => link.SeriesId).Distinct().Count()
            }).ToListAsync();
        var items = new List<ChannelListItem>();
        foreach (var channel in channels)
            items.Add(new ChannelListItem(channel.Id, channel.ShareId, channel.Name, channel.LogoPath, channel.StartDate, channel.EndDate,
                channel.Active?.ChannelEraId, channel.Active?.Name, channel.Eras, channel.Series, await NowAsync(channel.Id)));
        return items;
    }

    public async Task<ChannelDetail> GetAsync(int id)
    {
        var channel = await context.Channels.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        var active = await ActiveEraIdAsync(id);
        var eras = await context.ChannelEras.AsNoTracking().Where(era => era.ChannelId == id)
            .OrderBy(era => era.HistoricalStartDate).ThenBy(era => era.Id)
            .Select(era => new EraItem(era.Id, era.ChannelId, era.Name, era.Description, era.HistoricalStartDate, era.HistoricalEndDate,
                era.Id == active, era.Series.Count(link => link.Series.DeletedAtUtc == null),
                era.Interludes.Count(link => link.Interlude.DeletedAtUtc == null)
                    + context.ChannelEraSeriesInterludes.Count(link => link.ChannelEraId == era.Id && link.Interlude.DeletedAtUtc == null),
                era.BreakRule == null ? null : new BreakRuleItem(era.BreakRule.MinimumAds, era.BreakRule.MaximumAds, era.BreakRule.MaximumBreakSeconds)))
            .ToListAsync();
        return new ChannelDetail(channel.Id, channel.ShareId, channel.Name, channel.History, channel.LogoPath, channel.StartDate,
            channel.EndDate, active, eras);
    }

    public async Task<ChannelDetail> CreateAsync(ChannelRequest request, FileUpload? logo)
    {
        var name = request.Name.Trim();
        if (await context.Channels.AnyAsync(channel => channel.Name == name)) throw new ConflictException("Ya existe un canal con ese nombre.");
        var channel = new Channel { ShareId = Guid.NewGuid() };
        Apply(channel, request);
        context.Channels.Add(channel);
        await context.SaveChangesAsync();
        library.CreateFolder(MediaStorageLayout.ChannelFolder(channel.Id));
        if (logo != null)
        {
            channel.LogoPath = await library.SaveImageAsync(logo, MediaStorageLayout.ChannelFolder(channel.Id));
            await context.SaveChangesAsync();
        }
        return await GetAsync(channel.Id);
    }

    public async Task<ChannelDetail> UpdateAsync(int id, ChannelRequest request, FileUpload? logo)
    {
        var channel = await context.Channels.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        var name = request.Name.Trim();
        if (await context.Channels.AnyAsync(item => item.Name == name && item.Id != id)) throw new ConflictException("Ya existe un canal con ese nombre.");
        Apply(channel, request);
        if (logo != null)
        {
            var previous = channel.LogoPath;
            channel.LogoPath = await library.SaveImageAsync(logo, MediaStorageLayout.ChannelFolder(channel.Id));
            library.DeleteIfExists(previous);
        }
        await context.SaveChangesAsync();
        return await GetAsync(id);
    }

    /// <summary>Soft delete: the channel goes off air and its upcoming schedule is dropped.</summary>
    public async Task DeleteAsync(int id)
    {
        var channel = await context.Channels.SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        var now = DateTime.UtcNow;
        await using (var transaction = await context.Database.BeginTransactionAsync())
        {
            await context.ChannelEraSelections.Where(selection => selection.ChannelId == id).ExecuteDeleteAsync();
            await context.ChannelEras.Where(era => era.ChannelId == id).ExecuteUpdateAsync(update => update.SetProperty(era => era.DeletedAtUtc, now));
            channel.DeletedAtUtc = now;
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        await schedule.RegenerateAsync(id, replaceCurrent: true);
    }

    // ── Eras ──

    public async Task<EraItem> CreateEraAsync(int channelId, EraRequest request)
    {
        await EnsureChannelAsync(channelId);
        var name = request.Name.Trim();
        if (await context.ChannelEras.AnyAsync(era => era.ChannelId == channelId && era.Name == name))
            throw new ConflictException("El canal ya tiene una era con ese nombre.");
        var era = new ChannelEra { ChannelId = channelId };
        Apply(era, request);
        context.ChannelEras.Add(era);
        await context.SaveChangesAsync();
        var folder = MediaStorageLayout.EraFolder(channelId, era.Id);
        library.CreateFolder(folder);
        era.FolderPath = folder;
        await context.SaveChangesAsync();
        return await EraAsync(channelId, era.Id);
    }

    public async Task<EraItem> UpdateEraAsync(int channelId, int eraId, EraRequest request)
    {
        var era = await FindEraAsync(channelId, eraId);
        var name = request.Name.Trim();
        if (await context.ChannelEras.AnyAsync(item => item.ChannelId == channelId && item.Name == name && item.Id != eraId))
            throw new ConflictException("El canal ya tiene una era con ese nombre.");
        Apply(era, request);
        await context.SaveChangesAsync();
        return await EraAsync(channelId, eraId);
    }

    /// <summary>Deleting the era on air switches the channel to its latest remaining era.</summary>
    public async Task DeleteEraAsync(int channelId, int eraId)
    {
        var era = await FindEraAsync(channelId, eraId);
        var wasActive = await IsActiveEraAsync(channelId, eraId);
        await using (var transaction = await context.Database.BeginTransactionAsync())
        {
            if (wasActive) await context.ChannelEraSelections.Where(selection => selection.ChannelId == channelId).ExecuteDeleteAsync();
            era.DeletedAtUtc = DateTime.UtcNow;
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        if (wasActive) await schedule.RegenerateAsync(channelId, replaceCurrent: true);
    }

    public async Task ActivateEraAsync(int channelId, int eraId)
    {
        await FindEraAsync(channelId, eraId);
        var selection = await context.ChannelEraSelections.SingleOrDefaultAsync(item => item.ChannelId == channelId);
        if (selection?.ChannelEraId == eraId) return;
        if (selection == null)
        {
            selection = new ChannelEraSelection { ChannelId = channelId };
            context.ChannelEraSelections.Add(selection);
        }
        selection.ChannelEraId = eraId;
        selection.SelectedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
        // A different era means a different lineup: the program on air is replaced too.
        await schedule.RegenerateAsync(channelId, replaceCurrent: true);
    }

    public async Task<bool> IsActiveEraAsync(int channelId, int eraId) =>
        await context.ChannelEraSelections.AnyAsync(selection => selection.ChannelId == channelId && selection.ChannelEraId == eraId);

    // ── Lineup ──

    public async Task<IReadOnlyList<EraSeriesItem>> ListEraSeriesAsync(int channelId, int eraId)
    {
        await FindEraAsync(channelId, eraId);
        var rows = await context.ChannelEraSeries.AsNoTracking().Where(link => link.ChannelEraId == eraId)
            .OrderBy(link => link.Series.Name)
            .Select(link => new
            {
                link.SeriesId, link.Series.Name,
                Available = link.Series.Seasons.OrderBy(season => season.SeasonNumber).Select(season => season.SeasonNumber).ToList(),
                Selected = link.SelectedSeasons.OrderBy(season => season.SeasonNumber).Select(season => season.SeasonNumber).ToList()
            }).ToListAsync();
        var seriesIds = rows.Select(row => row.SeriesId).ToList();
        var episodes = await context.Episodes.AsNoTracking()
            .Where(episode => seriesIds.Contains(episode.SeriesId) && episode.IsAvailable && episode.FilePath != null)
            .GroupBy(episode => new { episode.SeriesId, episode.SeasonNumber })
            .Select(group => new { group.Key.SeriesId, group.Key.SeasonNumber, Count = group.Count() }).ToListAsync();
        return rows.Select(row => new EraSeriesItem(row.SeriesId, row.Name, row.Available, row.Selected,
            episodes.Where(item => item.SeriesId == row.SeriesId && (row.Selected.Count == 0 || row.Selected.Contains(item.SeasonNumber)))
                .Sum(item => item.Count))).ToList();
    }

    /// <summary>Replaces the lineup; series that leave it lose their season filter and series-scoped interludes.</summary>
    public async Task<IReadOnlyList<EraSeriesItem>> SetEraSeriesAsync(int channelId, int eraId, EraSeriesRequest request)
    {
        await FindEraAsync(channelId, eraId);
        var wanted = request.Series.GroupBy(item => item.SeriesId)
            .ToDictionary(group => group.Key, group => (group.SelectMany(item => item.Seasons ?? []).Distinct().ToList()));
        var ids = wanted.Keys.ToList();
        if (await context.Series.CountAsync(series => ids.Contains(series.Id)) != ids.Count)
            throw new BadRequestException("Una o más series no existen.");
        var seasons = await context.SeriesSeasons.AsNoTracking().Where(season => ids.Contains(season.SeriesId))
            .Select(season => new { season.SeriesId, season.SeasonNumber }).ToListAsync();
        foreach (var (seriesId, numbers) in wanted)
            if (numbers.Any(number => !seasons.Any(season => season.SeriesId == seriesId && season.SeasonNumber == number)))
                throw new BadRequestException("Una o más temporadas seleccionadas no existen en la serie.");

        await using (var transaction = await context.Database.BeginTransactionAsync())
        {
            var current = await context.ChannelEraSeries.Include(link => link.SelectedSeasons).Where(link => link.ChannelEraId == eraId).ToListAsync();
            var removed = current.Where(link => !wanted.ContainsKey(link.SeriesId)).Select(link => link.SeriesId).ToList();
            if (removed.Count > 0)
            {
                await context.ChannelEraSeriesInterludes.Where(item => item.ChannelEraId == eraId && removed.Contains(item.SeriesId)).ExecuteDeleteAsync();
                await context.ChannelEraSelectedSeasons.Where(item => item.ChannelEraId == eraId && removed.Contains(item.SeriesId)).ExecuteDeleteAsync();
                await context.ChannelEraSeries.Where(item => item.ChannelEraId == eraId && removed.Contains(item.SeriesId)).ExecuteDeleteAsync();
            }
            foreach (var (seriesId, numbers) in wanted)
            {
                var link = current.FirstOrDefault(item => item.SeriesId == seriesId);
                if (link == null)
                {
                    link = new ChannelEraSeries { ChannelEraId = eraId, SeriesId = seriesId };
                    context.ChannelEraSeries.Add(link);
                }
                foreach (var stale in link.SelectedSeasons.Where(season => !numbers.Contains(season.SeasonNumber)).ToList())
                    context.ChannelEraSelectedSeasons.Remove(stale);
                foreach (var number in numbers.Where(number => link.SelectedSeasons.All(season => season.SeasonNumber != number)))
                    context.ChannelEraSelectedSeasons.Add(new ChannelEraSelectedSeason { ChannelEraId = eraId, SeriesId = seriesId, SeasonNumber = number });
            }
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        await RefreshIfActiveAsync(channelId, eraId);
        return await ListEraSeriesAsync(channelId, eraId);
    }

    // ── Break rules ──

    public async Task<BreakRuleItem?> GetBreakRuleAsync(int channelId, int eraId)
    {
        await FindEraAsync(channelId, eraId);
        return await context.ChannelEraBreakRules.AsNoTracking().Where(rule => rule.ChannelEraId == eraId)
            .Select(rule => new BreakRuleItem(rule.MinimumAds, rule.MaximumAds, rule.MaximumBreakSeconds)).SingleOrDefaultAsync();
    }

    public async Task<BreakRuleItem> SetBreakRuleAsync(int channelId, int eraId, BreakRuleRequest request)
    {
        await FindEraAsync(channelId, eraId);
        var rule = await context.ChannelEraBreakRules.SingleOrDefaultAsync(item => item.ChannelEraId == eraId);
        if (rule == null)
        {
            rule = new ChannelEraBreakRule { ChannelEraId = eraId };
            context.ChannelEraBreakRules.Add(rule);
        }
        rule.MinimumAds = request.MinimumAds;
        rule.MaximumAds = request.MaximumAds;
        rule.MaximumBreakSeconds = request.MaximumBreakSeconds;
        await context.SaveChangesAsync();
        await RefreshIfActiveAsync(channelId, eraId);
        return new BreakRuleItem(rule.MinimumAds, rule.MaximumAds, rule.MaximumBreakSeconds);
    }

    /// <summary>Without a rule the era airs episodes back to back, with no commercial breaks.</summary>
    public async Task RemoveBreakRuleAsync(int channelId, int eraId)
    {
        await FindEraAsync(channelId, eraId);
        if (await context.ChannelEraBreakRules.Where(rule => rule.ChannelEraId == eraId).ExecuteDeleteAsync() > 0)
            await RefreshIfActiveAsync(channelId, eraId);
    }

    // ── Interludes ──

    public async Task<IReadOnlyList<EraInterludeItem>> ListEraInterludesAsync(int channelId, int eraId)
    {
        await FindEraAsync(channelId, eraId);
        var eraWide = await context.ChannelEraInterludes.AsNoTracking().Where(link => link.ChannelEraId == eraId && link.Interlude.DeletedAtUtc == null)
            .Select(link => new EraInterludeItem(link.InterludeId, link.Interlude.Title, link.Interlude.Kind, link.Interlude.BumperType,
                link.Interlude.Season, link.Interlude.DurationSeconds, link.Interlude.ApprovedForBroadcast, link.Weight, link.MinimumGapSeconds,
                null, null)).ToListAsync();
        var perSeries = await context.ChannelEraSeriesInterludes.AsNoTracking().Where(link => link.ChannelEraId == eraId && link.Interlude.DeletedAtUtc == null)
            .Select(link => new EraInterludeItem(link.InterludeId, link.Interlude.Title, link.Interlude.Kind, link.Interlude.BumperType,
                link.Interlude.Season, link.Interlude.DurationSeconds, link.Interlude.ApprovedForBroadcast, link.Weight, link.MinimumGapSeconds,
                link.SeriesId, link.ChannelEraSeries.Series.Name)).ToListAsync();
        return [.. eraWide.Concat(perSeries).OrderBy(item => item.SeriesName).ThenBy(item => item.Kind).ThenBy(item => item.Title)];
    }

    public async Task<EraInterludeItem> AssignInterludeAsync(int channelId, int eraId, int interludeId, int? seriesId, EraInterludeRequest request)
    {
        await FindEraAsync(channelId, eraId);
        if (!await context.Interludes.AnyAsync(interlude => interlude.Id == interludeId)) throw new NotFoundException("Interludio no encontrado.");
        if (seriesId is int series)
        {
            if (!await context.ChannelEraSeries.AnyAsync(link => link.ChannelEraId == eraId && link.SeriesId == series))
                throw new BadRequestException("La serie no forma parte de la programación de esta era.");
            var assignment = await context.ChannelEraSeriesInterludes
                .SingleOrDefaultAsync(link => link.ChannelEraId == eraId && link.SeriesId == series && link.InterludeId == interludeId);
            if (assignment == null)
            {
                assignment = new ChannelEraSeriesInterlude { ChannelEraId = eraId, SeriesId = series, InterludeId = interludeId };
                context.ChannelEraSeriesInterludes.Add(assignment);
            }
            assignment.Weight = request.Weight;
            assignment.MinimumGapSeconds = request.MinimumGapSeconds;
        }
        else
        {
            var assignment = await context.ChannelEraInterludes.SingleOrDefaultAsync(link => link.ChannelEraId == eraId && link.InterludeId == interludeId);
            if (assignment == null)
            {
                assignment = new ChannelEraInterlude { ChannelEraId = eraId, InterludeId = interludeId };
                context.ChannelEraInterludes.Add(assignment);
            }
            assignment.Weight = request.Weight;
            assignment.MinimumGapSeconds = request.MinimumGapSeconds;
        }
        await context.SaveChangesAsync();
        await RefreshIfActiveAsync(channelId, eraId);
        return (await ListEraInterludesAsync(channelId, eraId)).Single(item => item.InterludeId == interludeId && item.SeriesId == seriesId);
    }

    public async Task RemoveInterludeAsync(int channelId, int eraId, int interludeId, int? seriesId)
    {
        await FindEraAsync(channelId, eraId);
        var removed = seriesId is int series
            ? await context.ChannelEraSeriesInterludes.Where(link => link.ChannelEraId == eraId && link.SeriesId == series && link.InterludeId == interludeId).ExecuteDeleteAsync()
            : await context.ChannelEraInterludes.Where(link => link.ChannelEraId == eraId && link.InterludeId == interludeId).ExecuteDeleteAsync();
        if (removed == 0) throw new NotFoundException("El interludio no está asignado a esta era.");
        await RefreshIfActiveAsync(channelId, eraId);
    }

    // ── Public ──

    public async Task<IReadOnlyList<PublicChannelCard>> PublicListAsync()
    {
        var channels = await context.Channels.AsNoTracking().OrderBy(channel => channel.Name)
            .Select(channel => new
            {
                channel.Id, channel.ShareId, channel.Name, channel.LogoPath,
                Era = context.ChannelEraSelections.Where(selection => selection.ChannelId == channel.Id)
                    .Select(selection => new { selection.ChannelEraId, selection.ChannelEra.Name }).FirstOrDefault()
            }).ToListAsync();
        var eraIds = channels.Where(channel => channel.Era != null).Select(channel => channel.Era!.ChannelEraId).ToList();
        var categories = (await context.ChannelEraSeries.AsNoTracking().Where(link => eraIds.Contains(link.ChannelEraId))
                .SelectMany(link => link.Series.Categories.Where(category => category.Category.DeletedAtUtc == null),
                    (link, category) => new { link.ChannelEraId, category.Category.Name })
                .Distinct().ToListAsync())
            .ToLookup(item => item.ChannelEraId, item => item.Name);

        var now = DateTime.UtcNow;
        var cards = new List<PublicChannelCard>();
        foreach (var channel in channels)
        {
            var current = await NowAsync(channel.Id);
            var next = (await schedule.GetProgramsAsync(channel.Id, now, now.AddHours(6)))
                .FirstOrDefault(program => program.StartsAtUtc > now);
            cards.Add(new PublicChannelCard(channel.Id, channel.ShareId, channel.Name, channel.LogoPath, channel.Era?.Name, current != null,
                channel.Era == null ? [] : categories[channel.Era.ChannelEraId].OrderBy(name => name).Take(6).ToList(),
                current, next == null ? null : ScheduleRepository.Slot(next, now)));
        }
        return cards;
    }

    public async Task<PublicChannelDetail> PublicGetAsync(int id)
    {
        var channel = await context.Channels.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id) ?? throw NotFound();
        var active = await ActiveEraIdAsync(id);
        var eras = await context.ChannelEras.AsNoTracking().Where(era => era.ChannelId == id)
            .OrderBy(era => era.HistoricalStartDate).ThenBy(era => era.Id)
            .Select(era => new PublicEra(era.Id, era.Name, era.Description, era.HistoricalStartDate, era.HistoricalEndDate, era.Id == active,
                era.Series.Where(link => link.Series.DeletedAtUtc == null).OrderBy(link => link.Series.Name)
                    .Select(link => new PublicEraSeries(link.SeriesId, link.Series.Name, link.Series.LogoPath,
                        link.SelectedSeasons.OrderBy(season => season.SeasonNumber).Select(season => season.SeasonNumber).ToList())).ToList()))
            .ToListAsync();
        var now = DateTime.UtcNow;
        var upcoming = (await schedule.GetProgramsAsync(id, now, now.AddHours(12))).Take(12).Select(program => ScheduleRepository.Slot(program, now)).ToList();
        var comments = await context.ChannelComments.CountAsync(link => link.ChannelId == id && link.Comment.Status == CommentStatus.Approved
            && link.Comment.DeletedAtUtc == null);
        return new PublicChannelDetail(channel.Id, channel.ShareId, channel.Name, channel.History, channel.LogoPath, channel.StartDate,
            channel.EndDate, active, eras, upcoming, comments);
    }

    // ── Helpers ──

    private static NotFoundException NotFound() => new("Canal no encontrado.");

    private async Task EnsureChannelAsync(int channelId)
    {
        if (!await context.Channels.AnyAsync(channel => channel.Id == channelId)) throw NotFound();
    }

    private async Task<ChannelEra> FindEraAsync(int channelId, int eraId)
    {
        await EnsureChannelAsync(channelId);
        return await context.ChannelEras.SingleOrDefaultAsync(era => era.Id == eraId && era.ChannelId == channelId)
            ?? throw new NotFoundException("Era no encontrada.");
    }

    private async Task<EraItem> EraAsync(int channelId, int eraId) => (await GetAsync(channelId)).Eras.Single(era => era.Id == eraId);

    private Task<int?> ActiveEraIdAsync(int channelId) =>
        context.ChannelEraSelections.Where(selection => selection.ChannelId == channelId).Select(selection => (int?)selection.ChannelEraId).FirstOrDefaultAsync();

    private async Task RefreshIfActiveAsync(int channelId, int eraId)
    {
        if (await IsActiveEraAsync(channelId, eraId)) await schedule.RegenerateAsync(channelId, replaceCurrent: false);
    }

    private async Task<NowPlaying?> NowAsync(int channelId)
    {
        var state = await schedule.GetStateAsync(channelId);
        if (state == null) return null;
        var total = (state.EndsAtUtc - state.StartsAtUtc).TotalSeconds;
        var elapsed = (DateTime.UtcNow - state.StartsAtUtc).TotalSeconds;
        return new NowPlaying(state.SegmentId, state.Kind, state.EpisodeId, state.SeriesId, state.SeriesName, state.Title, state.SeasonNumber,
            state.EpisodeNumber, state.StartsAtUtc, state.EndsAtUtc, total <= 0 ? 0 : Math.Clamp(elapsed / total, 0, 1));
    }

    private static void Apply(Channel channel, ChannelRequest request)
    {
        channel.Name = request.Name.Trim();
        channel.History = string.IsNullOrWhiteSpace(request.History) ? null : request.History.Trim();
        channel.StartDate = request.StartDate;
        channel.EndDate = request.EndDate;
    }

    private static void Apply(ChannelEra era, EraRequest request)
    {
        era.Name = request.Name.Trim();
        era.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        era.HistoricalStartDate = request.HistoricalStartDate;
        era.HistoricalEndDate = request.HistoricalEndDate;
    }
}
