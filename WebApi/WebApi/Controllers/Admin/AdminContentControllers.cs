using ApplicationCore.DTOs;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WebApi.Authorization;
using WebApi.Http;

namespace WebApi.Controllers.Admin;

/// <summary>Resumen.</summary>
[Authorize(Policy = AdminPolicies.Summary), Route("api/v{version:apiVersion}/admin")]
public sealed class AdminSummaryController(IDashboardRepository dashboard, IActivityRepository activity) : ApiController
{
    [HttpGet("summary")]
    public Task<DashboardSummary> Summary(CancellationToken token) => dashboard.SummaryAsync(token);

    [HttpGet("activity")]
    public Task<PagedResult<ActivityItem>> Activity(int days = 7, int page = 1, int pageSize = 50) => activity.ListAsync(days, page, pageSize);
}

/// <summary>Programación: the generated schedule per channel and the full-day guide.</summary>
[Authorize(Policy = AdminPolicies.Schedule), Route("api/v{version:apiVersion}/admin/schedule")]
public sealed class AdminScheduleController(IScheduleRepository schedule) : ApiController
{
    [HttpGet("channels/{channelId:int}/programs")]
    public Task<IReadOnlyList<ScheduleProgram>> Programs(int channelId, DateTime? from, DateTime? to)
    {
        var (start, end) = PublicController.Range(from, to);
        return schedule.GetProgramsAsync(channelId, start, end);
    }

    [HttpGet("guide")]
    public Task<IReadOnlyList<GuideRow>> Guide(DateOnly day, int? channelId) => schedule.GetGuideAsync(day, channelId);

    /// <summary>Rebuilds the upcoming schedule, keeping the program on air.</summary>
    [HttpPost("channels/{channelId:int}/regenerate")]
    public async Task<IActionResult> Regenerate(int channelId)
    {
        await schedule.RegenerateAsync(channelId, replaceCurrent: false);
        return NoContent();
    }
}

/// <summary>Canales: channels, eras, lineups, break rules and interlude assignments.</summary>
[Authorize(Policy = AdminPolicies.Channels), Route("api/v{version:apiVersion}/admin/channels")]
public sealed class AdminChannelsController(IChannelRepository channels, IChannelPackageRepository packages) : ApiController
{
    [HttpGet]
    public Task<IReadOnlyList<ChannelListItem>> List() => channels.ListAsync();

    [HttpGet("{id:int}")]
    public Task<ChannelDetail> Get(int id) => channels.GetAsync(id);

    [HttpPost, EnableRateLimiting("UploadPolicy"), RequestSizeLimit(ImageLimit), RequestFormLimits(MultipartBodyLengthLimit = ImageLimit)]
    public Task<ChannelDetail> Create([FromForm] ChannelRequest request, IFormFile? logo) => channels.CreateAsync(request, logo?.ToUpload());

    [HttpPut("{id:int}"), EnableRateLimiting("UploadPolicy"), RequestSizeLimit(ImageLimit), RequestFormLimits(MultipartBodyLengthLimit = ImageLimit)]
    public Task<ChannelDetail> Update(int id, [FromForm] ChannelRequest request, IFormFile? logo) => channels.UpdateAsync(id, request, logo?.ToUpload());

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await channels.DeleteAsync(id);
        return NoContent();
    }

    [HttpPost("{id:int}/eras")]
    public Task<EraItem> CreateEra(int id, EraRequest request) => channels.CreateEraAsync(id, request);

    [HttpPut("{id:int}/eras/{eraId:int}")]
    public Task<EraItem> UpdateEra(int id, int eraId, EraRequest request) => channels.UpdateEraAsync(id, eraId, request);

    [HttpDelete("{id:int}/eras/{eraId:int}")]
    public async Task<IActionResult> DeleteEra(int id, int eraId)
    {
        await channels.DeleteEraAsync(id, eraId);
        return NoContent();
    }

    /// <summary>Puts the era on air; the current program is replaced by the new lineup.</summary>
    [HttpPost("{id:int}/eras/{eraId:int}/activate")]
    public async Task<IActionResult> ActivateEra(int id, int eraId)
    {
        await channels.ActivateEraAsync(id, eraId);
        return NoContent();
    }

    [HttpGet("{id:int}/eras/{eraId:int}/series")]
    public Task<IReadOnlyList<EraSeriesItem>> EraSeries(int id, int eraId) => channels.ListEraSeriesAsync(id, eraId);

    [HttpPut("{id:int}/eras/{eraId:int}/series")]
    public Task<IReadOnlyList<EraSeriesItem>> SetEraSeries(int id, int eraId, EraSeriesRequest request) => channels.SetEraSeriesAsync(id, eraId, request);

    [HttpGet("{id:int}/eras/{eraId:int}/break-rule")]
    public async Task<IActionResult> BreakRule(int id, int eraId) =>
        await channels.GetBreakRuleAsync(id, eraId) is { } rule ? Ok(rule) : NoContent();

    [HttpPut("{id:int}/eras/{eraId:int}/break-rule")]
    public Task<BreakRuleItem> SetBreakRule(int id, int eraId, BreakRuleRequest request) => channels.SetBreakRuleAsync(id, eraId, request);

    [HttpDelete("{id:int}/eras/{eraId:int}/break-rule")]
    public async Task<IActionResult> RemoveBreakRule(int id, int eraId)
    {
        await channels.RemoveBreakRuleAsync(id, eraId);
        return NoContent();
    }

    [HttpGet("{id:int}/eras/{eraId:int}/interludes")]
    public Task<IReadOnlyList<EraInterludeItem>> Interludes(int id, int eraId) => channels.ListEraInterludesAsync(id, eraId);

    /// <summary>Assigns an interlude to the whole era, or only around one series when seriesId is given.</summary>
    [HttpPut("{id:int}/eras/{eraId:int}/interludes/{interludeId:int}")]
    public Task<EraInterludeItem> AssignInterlude(int id, int eraId, int interludeId, int? seriesId, EraInterludeRequest request) =>
        channels.AssignInterludeAsync(id, eraId, interludeId, seriesId, request);

    [HttpDelete("{id:int}/eras/{eraId:int}/interludes/{interludeId:int}")]
    public async Task<IActionResult> RemoveInterlude(int id, int eraId, int interludeId, int? seriesId)
    {
        await channels.RemoveInterludeAsync(id, eraId, interludeId, seriesId);
        return NoContent();
    }

    /// <summary>Downloads the channel as a versioned .ntv.json package (references only, no media files).</summary>
    [HttpGet("{id:int}/export")]
    public async Task<IActionResult> Export(int id)
    {
        var package = await packages.ExportAsync(id);
        return File(package.Content, "application/json", package.FileName);
    }

    /// <summary>Validates a package and reports what an import would create and what the library is missing.</summary>
    [HttpPost("import/preview"), EnableRateLimiting("UploadPolicy"), RequestSizeLimit(PackageLimit), RequestFormLimits(MultipartBodyLengthLimit = PackageLimit)]
    public Task<ChannelPackagePreview> PreviewImport(IFormFile file, CancellationToken token) => packages.PreviewAsync(file.ToUpload(), token);

    /// <summary>Creates a new channel from a package; name overrides the package's channel name.</summary>
    [HttpPost("import"), EnableRateLimiting("UploadPolicy"), RequestSizeLimit(PackageLimit), RequestFormLimits(MultipartBodyLengthLimit = PackageLimit)]
    public Task<ChannelPackageImportResult> Import(IFormFile file, [FromForm] string? name, CancellationToken token) =>
        packages.ImportAsync(file.ToUpload(), name, token);

    private const long ImageLimit = 16L * 1024 * 1024;
    // The package itself is capped at 1 MiB; the rest is room for the multipart envelope.
    private const long PackageLimit = ChannelPackage.MaxBytes + 64 * 1024;
}

/// <summary>Series: catalog, seasons, episodes, break points, uploads and metadata.</summary>
[Authorize(Policy = AdminPolicies.Series), Route("api/v{version:apiVersion}/admin/series")]
public sealed class AdminSeriesController(ISeriesRepository series, IMetadataRepository metadata) : ApiController
{
    private const long ImageLimit = 16L * 1024 * 1024;
    private const long VideoLimit = 8L * 1024 * 1024 * 1024;

    [HttpGet]
    public Task<IReadOnlyList<SeriesListItem>> List(string? search) => series.ListAsync(search);

    [HttpGet("{id:int}")]
    public Task<SeriesDetail> Get(int id) => series.GetAsync(id);

    [HttpPost, EnableRateLimiting("UploadPolicy"), RequestSizeLimit(ImageLimit), RequestFormLimits(MultipartBodyLengthLimit = ImageLimit)]
    public Task<SeriesDetail> Create([FromForm] SeriesRequest request, IFormFile? logo) => series.CreateAsync(request, logo?.ToUpload());

    [HttpPut("{id:int}"), EnableRateLimiting("UploadPolicy"), RequestSizeLimit(ImageLimit), RequestFormLimits(MultipartBodyLengthLimit = ImageLimit)]
    public Task<SeriesDetail> Update(int id, [FromForm] SeriesRequest request, IFormFile? logo) => series.UpdateAsync(id, request, logo?.ToUpload());

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await series.DeleteAsync(id);
        return NoContent();
    }

    [HttpPut("{id:int}/categories")]
    public Task<SeriesDetail> Categories(int id, CategoriesRequest request) => series.SetCategoriesAsync(id, request);

    [HttpPost("{id:int}/seasons")]
    public Task<SeriesDetail> AddSeason(int id, SeasonRequest request) => series.AddSeasonAsync(id, request);

    [HttpDelete("{id:int}/seasons/{season:int}")]
    public Task<SeriesDetail> RemoveSeason(int id, int season) => series.RemoveSeasonAsync(id, season);

    [HttpGet("{id:int}/episodes")]
    public Task<IReadOnlyList<EpisodeItem>> Episodes(int id, int? season) => series.ListEpisodesAsync(id, season);

    /// <summary>Uploads episode videos into "season N", "specials" or "movies"; incompatible files wait for the transcoder.</summary>
    [HttpPost("{id:int}/episodes/upload"), EnableRateLimiting("UploadPolicy"),
     RequestSizeLimit(VideoLimit), RequestFormLimits(MultipartBodyLengthLimit = VideoLimit)]
    public Task<IReadOnlyList<EpisodeUploadResult>> Upload(int id, [FromForm] string? target, [FromForm] int? season,
        [FromForm] List<IFormFile> files, CancellationToken token)
    {
        var destination = EpisodeUploadTarget.Parse(target, season) ?? throw new BadRequestException("Elige una temporada, especiales o películas.");
        return series.UploadEpisodesAsync(id, destination, files.Select(file => file.ToUpload()).ToList(), token);
    }

    [HttpPost("{id:int}/scan")]
    public Task<ScanResult> Scan(int id, CancellationToken token) => series.ScanFolderAsync(id, token);

    [HttpPut("episodes/{episodeId:int}")]
    public Task<EpisodeItem> UpdateEpisode(int episodeId, EpisodeRequest request) => series.UpdateEpisodeAsync(episodeId, request);

    [HttpDelete("episodes/{episodeId:int}")]
    public async Task<IActionResult> DeleteEpisode(int episodeId)
    {
        await series.DeleteEpisodeAsync(episodeId);
        return NoContent();
    }

    [HttpGet("episodes/{episodeId:int}/break-points")]
    public Task<IReadOnlyList<BreakPointItem>> BreakPoints(int episodeId) => series.ListBreakPointsAsync(episodeId);

    [HttpPost("episodes/{episodeId:int}/break-points")]
    public Task<BreakPointItem> AddBreakPoint(int episodeId, BreakPointRequest request) => series.AddBreakPointAsync(episodeId, request);

    [HttpDelete("episodes/{episodeId:int}/break-points/{breakPointId:int}")]
    public async Task<IActionResult> DeleteBreakPoint(int episodeId, int breakPointId)
    {
        await series.DeleteBreakPointAsync(episodeId, breakPointId);
        return NoContent();
    }

    [HttpGet("{id:int}/external-ids")]
    public Task<IReadOnlyList<ExternalIdItem>> ExternalIds(int id) => metadata.ListExternalIdsAsync(id);

    [HttpPut("{id:int}/external-ids/{providerId:int}")]
    public Task<ExternalIdItem> SetExternalId(int id, int providerId, ExternalIdRequest request) => metadata.SetExternalIdAsync(id, providerId, request);

    [HttpDelete("{id:int}/external-ids/{providerId:int}")]
    public async Task<IActionResult> RemoveExternalId(int id, int providerId)
    {
        await metadata.RemoveExternalIdAsync(id, providerId);
        return NoContent();
    }

    [HttpPost("{id:int}/metadata/import"), EnableRateLimiting("UploadPolicy")]
    public Task<MetadataImportResult> ImportMetadata(int id, MetadataImportRequest request, CancellationToken token) =>
        metadata.ImportAsync(id, request, token);

    [HttpGet("{id:int}/metadata/history")]
    public Task<IReadOnlyList<MetadataImportItem>> MetadataHistory(int id) => metadata.HistoryAsync(id);
}

/// <summary>Interludios: bumpers and ads library.</summary>
[Authorize(Policy = AdminPolicies.Interludes), Route("api/v{version:apiVersion}/admin/interludes")]
public sealed class AdminInterludesController(IInterludeRepository interludes) : ApiController
{
    private const long VideoLimit = 512L * 1024 * 1024;

    [HttpGet]
    public Task<IReadOnlyList<InterludeItem>> List([FromQuery] InterludeQuery query) => interludes.ListAsync(query);

    [HttpPost, EnableRateLimiting("UploadPolicy"), RequestSizeLimit(VideoLimit), RequestFormLimits(MultipartBodyLengthLimit = VideoLimit)]
    public Task<InterludeItem> Upload([FromForm] InterludeRequest request, IFormFile file, CancellationToken token) =>
        interludes.UploadAsync(request, file.ToUpload(), token);

    [HttpPut("{id:int}")]
    public async Task<InterludeItem> Update(int id, InterludeRequest request) => (await interludes.UpdateAsync(id, request)).Item;

    [HttpPut("{id:int}/approval")]
    public async Task<IActionResult> Approval(int id, ApprovalRequest request)
    {
        await interludes.SetApprovalAsync(id, request.Approved);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await interludes.DeleteAsync(id);
        return NoContent();
    }
}
