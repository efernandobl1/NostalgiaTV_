using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebApi.Authorization;

namespace WebApi.Controllers.Admin;

/// <summary>Espectadores: profiles, devices and pending TV sign-ins.</summary>
[Authorize(Policy = AdminPolicies.Viewers), Route("api/v{version:apiVersion}/admin/viewers")]
public sealed class AdminViewersController(IViewerRepository viewers) : ApiController
{
    [HttpGet("kpis")]
    public Task<ViewerKpis> Kpis() => viewers.KpisAsync();

    [HttpGet]
    public Task<PagedResult<ViewerProfileItem>> Profiles(string? search, int page = 1, int pageSize = 25) => viewers.ProfilesAsync(search, page, pageSize);

    [HttpGet("{id:guid}")]
    public Task<ViewerProfileDetail> Profile(Guid id) => viewers.ProfileAsync(id);

    [HttpDelete("devices/{deviceId:guid}")]
    public async Task<IActionResult> RevokeDevice(Guid deviceId)
    {
        await viewers.RevokeDeviceAsync(deviceId);
        return NoContent();
    }

    [HttpGet("authorizations")]
    public Task<IReadOnlyList<PendingAuthorizationItem>> PendingAuthorizations() => viewers.PendingAuthorizationsAsync();
}

/// <summary>Comentarios: moderation queue.</summary>
[Authorize(Policy = AdminPolicies.Comments), Route("api/v{version:apiVersion}/admin/comments")]
public sealed class AdminCommentsController(ICommentRepository comments) : ApiController
{
    [HttpGet]
    public Task<ModerationPage> Queue(string status = CommentStatus.Pending, string? search = null, int page = 1, int pageSize = 25) =>
        comments.ModerationQueueAsync(status, search, page, pageSize);

    [HttpPut("{id:long}/status")]
    public async Task<IActionResult> Moderate(long id, ModerationRequest request)
    {
        await comments.ModerateAsync([id], request.Status);
        return NoContent();
    }

    [HttpPut("status")]
    public async Task<IActionResult> ModerateMany(BulkModerationRequest request)
    {
        await comments.ModerateAsync(request.CommentIds, request.Status);
        return NoContent();
    }
}

/// <summary>Media: processing queue, workers, CPU policy and storage.</summary>
[Authorize(Policy = AdminPolicies.Media), Route("api/v{version:apiVersion}/admin/media")]
public sealed class AdminMediaController(IMediaRepository media) : ApiController
{
    [HttpGet]
    public Task<MediaStatus> Status([FromQuery] MediaQuery query) => media.StatusAsync(query);

    [HttpPut("workers/{worker}")]
    public async Task<IActionResult> Worker(string worker, WorkerRequest request)
    {
        await media.SetWorkerAsync(worker, request.Enabled);
        return NoContent();
    }

    [HttpPut("resources")]
    public Task<ResourcePolicyItem> Resources(ResourcePolicyRequest request) => media.SetResourcesAsync(request);

    [HttpPost("jobs/retry")]
    public async Task<IActionResult> Retry(JobIdsRequest request)
    {
        await media.RetryAsync(request.JobIds);
        return NoContent();
    }

    [HttpPost("jobs/delete")]
    public async Task<IActionResult> DeleteJobs(JobIdsRequest request)
    {
        await media.DeleteJobsAsync(request.JobIds);
        return NoContent();
    }

    [HttpPost("jobs/clear")]
    public async Task<object> Clear(ClearQueueRequest request) => new { Deleted = await media.ClearQueueAsync(request) };

    [HttpGet("storage")]
    public Task<StorageReport> Storage(CancellationToken token) => media.StorageAsync(token);
}

/// <summary>Acceso: users, roles and the menus each role can open.</summary>
[Authorize(Policy = AdminPolicies.Access), Route("api/v{version:apiVersion}/admin/access")]
public sealed class AdminAccessController(IUserRepository users, IRoleRepository roles) : ApiController
{
    [HttpGet("users")]
    public Task<IReadOnlyList<UserListItem>> Users() => users.ListAsync();

    [HttpGet("users/{id:int}")]
    public Task<UserDetail> GetUser(int id) => users.GetAsync(id);

    [HttpPost("users")]
    public Task<UserDetail> CreateUser(CreateUserRequest request) => users.CreateAsync(request);

    [HttpPut("users/{id:int}")]
    public Task<UserDetail> UpdateUser(int id, UpdateUserRequest request) => users.UpdateAsync(id, request, UserId);

    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> DeactivateUser(int id)
    {
        await users.DeactivateAsync(id, UserId);
        return NoContent();
    }

    [HttpPost("users/{id:int}/unlock")]
    public async Task<IActionResult> Unlock(int id)
    {
        await users.UnlockAsync(id);
        return NoContent();
    }

    [HttpPost("users/{id:int}/sessions/revoke")]
    public async Task<IActionResult> RevokeSessions(int id)
    {
        await users.RevokeSessionsAsync(id);
        return NoContent();
    }

    [HttpDelete("users/{id:int}/logins/{provider}")]
    public async Task<IActionResult> UnlinkLogin(int id, string provider)
    {
        await users.UnlinkExternalLoginAsync(id, provider);
        return NoContent();
    }

    [HttpGet("roles")]
    public Task<IReadOnlyList<RoleListItem>> Roles() => roles.ListAsync();

    [HttpGet("menus")]
    public Task<IReadOnlyList<MenuItem>> Menus() => roles.ListMenusAsync();

    [HttpPost("roles")]
    public Task<RoleListItem> CreateRole(RoleRequest request) => roles.CreateAsync(request);

    [HttpPut("roles/{id:int}")]
    public Task<RoleListItem> UpdateRole(int id, RoleRequest request) => roles.UpdateAsync(id, request);

    [HttpPut("roles/{id:int}/menus")]
    public Task<RoleListItem> SetMenus(int id, RoleMenusRequest request) => roles.SetMenusAsync(id, request);

    [HttpDelete("roles/{id:int}")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        await roles.DeleteAsync(id);
        return NoContent();
    }
}

/// <summary>Ajustes: platform rules and catalogs (categories, episode types, metadata providers).</summary>
[Authorize(Policy = AdminPolicies.Settings), Route("api/v{version:apiVersion}/admin/settings")]
public sealed class AdminSettingsController(ISettingsRepository settings, ICatalogRepository catalog) : ApiController
{
    [HttpGet]
    public Task<PlatformSettingsResponse> Get() => settings.GetAsync();

    [HttpPut]
    public Task<PlatformSettingsResponse> Update(PlatformSettingsRequest request) => settings.UpdateAsync(request);

    [HttpPost("categories")]
    public Task<CatalogItem> CreateCategory(CatalogItemRequest request) => catalog.CreateCategoryAsync(request);

    [HttpPut("categories/{id:int}")]
    public Task<CatalogItem> RenameCategory(int id, CatalogItemRequest request) => catalog.RenameCategoryAsync(id, request);

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        await catalog.DeleteCategoryAsync(id);
        return NoContent();
    }

    [HttpPost("episode-types")]
    public Task<CatalogItem> CreateEpisodeType(CatalogItemRequest request) => catalog.CreateEpisodeTypeAsync(request);

    [HttpPut("episode-types/{id:int}")]
    public Task<CatalogItem> RenameEpisodeType(int id, CatalogItemRequest request) => catalog.RenameEpisodeTypeAsync(id, request);

    [HttpDelete("episode-types/{id:int}")]
    public async Task<IActionResult> DeleteEpisodeType(int id)
    {
        await catalog.DeleteEpisodeTypeAsync(id);
        return NoContent();
    }

    [HttpPost("providers")]
    public Task<MetadataProviderItem> CreateProvider(MetadataProviderRequest request) => catalog.CreateProviderAsync(request);

    [HttpPut("providers/{id:int}")]
    public Task<MetadataProviderItem> UpdateProvider(int id, MetadataProviderRequest request) => catalog.UpdateProviderAsync(id, request);

    [HttpDelete("providers/{id:int}")]
    public async Task<IActionResult> DeleteProvider(int id)
    {
        await catalog.DeleteProviderAsync(id);
        return NoContent();
    }
}

/// <summary>Catalog lists every admin screen needs (series forms, metadata); editing them belongs to Ajustes.</summary>
[Authorize(Policy = AdminPolicies.Any), Route("api/v{version:apiVersion}/admin/catalog")]
public sealed class AdminCatalogController(ICatalogRepository catalog) : ApiController
{
    [HttpGet("categories")]
    public Task<IReadOnlyList<CatalogItem>> Categories() => catalog.ListCategoriesAsync();

    [HttpGet("episode-types")]
    public Task<IReadOnlyList<CatalogItem>> EpisodeTypes() => catalog.ListEpisodeTypesAsync();

    [HttpGet("providers")]
    public Task<IReadOnlyList<MetadataProviderItem>> Providers() => catalog.ListProvidersAsync();
}
