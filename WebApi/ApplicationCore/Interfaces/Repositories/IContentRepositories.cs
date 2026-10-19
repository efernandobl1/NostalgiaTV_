using ApplicationCore.DTOs;
using ApplicationCore.Models;

namespace ApplicationCore.Interfaces.Repositories;

public interface ISeriesRepository
{
    // Admin
    Task<IReadOnlyList<SeriesListItem>> ListAsync(string? search);
    Task<SeriesDetail> GetAsync(int id);
    Task<SeriesDetail> CreateAsync(SeriesRequest request, FileUpload? logo);
    Task<SeriesDetail> UpdateAsync(int id, SeriesRequest request, FileUpload? logo);
    Task DeleteAsync(int id);
    Task<SeriesDetail> SetCategoriesAsync(int id, CategoriesRequest request);
    Task<SeriesDetail> AddSeasonAsync(int id, SeasonRequest request);
    Task<SeriesDetail> RemoveSeasonAsync(int id, int seasonNumber);

    Task<IReadOnlyList<EpisodeItem>> ListEpisodesAsync(int seriesId, int? seasonNumber);
    Task<EpisodeItem> UpdateEpisodeAsync(int episodeId, EpisodeRequest request);
    Task DeleteEpisodeAsync(int episodeId);
    Task<IReadOnlyList<BreakPointItem>> ListBreakPointsAsync(int episodeId);
    Task<BreakPointItem> AddBreakPointAsync(int episodeId, BreakPointRequest request);
    /// <summary>Returns the channels whose upcoming schedule must be rebuilt.</summary>
    Task<IReadOnlyList<int>> DeleteBreakPointAsync(int episodeId, int breakPointId);
    Task<IReadOnlyList<EpisodeUploadResult>> UploadEpisodesAsync(int seriesId, EpisodeUploadTarget target, IReadOnlyList<FileUpload> files, CancellationToken token);
    Task<ScanResult> ScanFolderAsync(int seriesId, CancellationToken token);

    // Public
    Task<PagedResult<PublicSeriesCard>> SearchAsync(SeriesQuery query);
    Task<PublicSeriesDetail> GetPublicAsync(int id);
    Task<IReadOnlyList<PublicEpisode>> PublicEpisodesAsync(int seriesId, int? seasonNumber);
}

public interface IMetadataRepository
{
    Task<IReadOnlyList<ExternalIdItem>> ListExternalIdsAsync(int seriesId);
    Task<ExternalIdItem> SetExternalIdAsync(int seriesId, int providerId, ExternalIdRequest request);
    Task RemoveExternalIdAsync(int seriesId, int providerId);
    Task<MetadataImportResult> ImportAsync(int seriesId, MetadataImportRequest request, CancellationToken token);
    Task<IReadOnlyList<MetadataImportItem>> HistoryAsync(int seriesId);
}

public interface IInterludeRepository
{
    Task<IReadOnlyList<InterludeItem>> ListAsync(InterludeQuery query);
    Task<InterludeItem> UploadAsync(InterludeRequest request, FileUpload file, CancellationToken token);
    /// <summary>Returns the channels whose schedule changes because they air this interlude.</summary>
    Task<(InterludeItem Item, IReadOnlyList<int> AffectedChannels)> UpdateAsync(int id, InterludeRequest request);
    Task<IReadOnlyList<int>> SetApprovalAsync(int id, bool approved);
    Task DeleteAsync(int id);
}

public interface IChannelRepository
{
    Task<IReadOnlyList<ChannelListItem>> ListAsync();
    Task<ChannelDetail> GetAsync(int id);
    Task<ChannelDetail> CreateAsync(ChannelRequest request, FileUpload? logo);
    Task<ChannelDetail> UpdateAsync(int id, ChannelRequest request, FileUpload? logo);
    Task DeleteAsync(int id);

    Task<EraItem> CreateEraAsync(int channelId, EraRequest request);
    Task<EraItem> UpdateEraAsync(int channelId, int eraId, EraRequest request);
    Task DeleteEraAsync(int channelId, int eraId);
    Task ActivateEraAsync(int channelId, int eraId);
    Task<IReadOnlyList<EraSeriesItem>> ListEraSeriesAsync(int channelId, int eraId);
    Task<IReadOnlyList<EraSeriesItem>> SetEraSeriesAsync(int channelId, int eraId, EraSeriesRequest request);
    Task<BreakRuleItem?> GetBreakRuleAsync(int channelId, int eraId);
    Task<BreakRuleItem> SetBreakRuleAsync(int channelId, int eraId, BreakRuleRequest request);
    Task RemoveBreakRuleAsync(int channelId, int eraId);
    Task<IReadOnlyList<EraInterludeItem>> ListEraInterludesAsync(int channelId, int eraId);
    Task<EraInterludeItem> AssignInterludeAsync(int channelId, int eraId, int interludeId, int? seriesId, EraInterludeRequest request);
    Task RemoveInterludeAsync(int channelId, int eraId, int interludeId, int? seriesId);
    /// <summary>True when the era is the one on air (its changes require a schedule rebuild).</summary>
    Task<bool> IsActiveEraAsync(int channelId, int eraId);

    // Public
    Task<IReadOnlyList<PublicChannelCard>> PublicListAsync();
    Task<PublicChannelDetail> PublicGetAsync(int id);
}

/// <summary>Channel packages: a channel exported as versioned JSON and imported into another library.</summary>
public interface IChannelPackageRepository
{
    Task<ChannelPackageFile> ExportAsync(int channelId);
    Task<ChannelPackagePreview> PreviewAsync(FileUpload file, CancellationToken token);
    /// <summary>Name overrides the package's channel name (needed when that name is already taken).</summary>
    Task<ChannelPackageImportResult> ImportAsync(FileUpload file, string? name, CancellationToken token);
}

public interface IScheduleRepository
{
    Task EnsureGeneratedAsync(int channelId, DateTime untilUtc, CancellationToken token = default);
    /// <summary>Drops the future schedule (and the current program when replaceCurrent) and generates it again.</summary>
    Task RegenerateAsync(int channelId, bool replaceCurrent, CancellationToken token = default);
    Task<IReadOnlyList<ScheduleProgram>> GetProgramsAsync(int channelId, DateTime fromUtc, DateTime toUtc);
    Task<IReadOnlyList<GuideRow>> GetGuideAsync(DateOnly localDay, int? channelId);
    Task<ChannelState?> GetStateAsync(int channelId, CancellationToken token = default);
    Task<IReadOnlyList<int>> ChannelIdsAsync(CancellationToken token = default);
    Task CleanupAsync(CancellationToken token = default);
}

public interface ICommentRepository
{
    Task<PagedResult<PublicComment>> ChannelCommentsAsync(int channelId, int page);
    Task<PagedResult<PublicComment>> SeriesCommentsAsync(int seriesId, int page);
    Task<CommentPosted> PostChannelCommentAsync(int channelId, int userId, CommentRequest request);
    Task<CommentPosted> PostSeriesCommentAsync(int seriesId, int userId, CommentRequest request);
    Task<IReadOnlyList<MyComment>> MyCommentsAsync(int userId);
    Task<MyComment> EditMyCommentAsync(int userId, long commentId, CommentEditRequest request);
    Task DeleteMyCommentAsync(int userId, long commentId);
    Task<ModerationPage> ModerationQueueAsync(string status, string? search, int page, int pageSize);
    Task ModerateAsync(IReadOnlyList<long> commentIds, string status);
}
