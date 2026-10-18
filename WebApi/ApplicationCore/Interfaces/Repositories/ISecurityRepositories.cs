using ApplicationCore.DTOs;
using ApplicationCore.Models;

namespace ApplicationCore.Interfaces.Repositories;

/// <summary>Sign-in, token rotation and account self-service.</summary>
public interface IAuthRepository
{
    Task<AuthTokens> LoginAsync(LoginRequest request, string ipAddress);
    /// <summary>Finds or (if registration is open) creates the account owning an external identity.</summary>
    Task<AuthTokens> LoginExternalAsync(string provider, string subject, string ipAddress);
    Task<AuthTokens> RefreshAsync(string refreshToken, string ipAddress);
    Task RevokeAsync(string? refreshToken, string ipAddress);
    Task RegisterAsync(RegisterRequest request);
    /// <summary>JWT validation: the session must exist, be active and match the user's session version.</summary>
    Task<bool> IsSessionActiveAsync(int userId, string sessionHash, int sessionVersion, CancellationToken token);
    /// <summary>Replaces the seeded placeholder password of the first administrator.</summary>
    Task InitializeAdministratorAsync(string? password);
    Task<bool> RegistrationEnabledAsync();
    /// <summary>Removes expired refresh tokens, viewer devices and codes; returns the credentials removed.</summary>
    Task<int> CleanupExpiredAsync(CancellationToken token);
}

public interface IAccountRepository
{
    Task<MeResponse> GetMeAsync(int userId);
    Task ChangePasswordAsync(int userId, ChangePasswordRequest request);
    /// <summary>Revokes every refresh token and increments the session version (signs out all devices).</summary>
    Task RevokeAllSessionsAsync(int userId);
    Task UnlinkExternalLoginAsync(int userId, string provider);
    /// <summary>True when the user may open the given admin screen (null = any admin screen).</summary>
    Task<bool> CanAccessMenuAsync(int userId, string? menuUrl, CancellationToken token);
}

public interface IUserRepository
{
    Task<IReadOnlyList<UserListItem>> ListAsync();
    Task<UserDetail> GetAsync(int id);
    Task<UserDetail> CreateAsync(CreateUserRequest request);
    Task<UserDetail> UpdateAsync(int id, UpdateUserRequest request, int actingUserId);
    Task DeactivateAsync(int id, int actingUserId);
    Task UnlockAsync(int id);
    Task RevokeSessionsAsync(int id);
    Task UnlinkExternalLoginAsync(int id, string provider);
}

public interface IRoleRepository
{
    Task<IReadOnlyList<RoleListItem>> ListAsync();
    Task<IReadOnlyList<MenuItem>> ListMenusAsync();
    Task<RoleListItem> CreateAsync(RoleRequest request);
    Task<RoleListItem> UpdateAsync(int id, RoleRequest request);
    Task<RoleListItem> SetMenusAsync(int id, RoleMenusRequest request);
    Task DeleteAsync(int id);
}

public interface IActivityRepository
{
    Task LogAsync(int? userId, string action, string resource, string description, CancellationToken token = default);
    Task<PagedResult<ActivityItem>> ListAsync(int days, int page, int pageSize);
}

public interface ISettingsRepository
{
    Task<PlatformSettingsResponse> GetAsync();
    Task<PlatformSettingsResponse> UpdateAsync(PlatformSettingsRequest request);
    Task<PublicSettingsResponse> GetPublicAsync();
}

/// <summary>Ajustes → Catálogos: categories, episode types and metadata providers.</summary>
public interface ICatalogRepository
{
    Task<IReadOnlyList<CatalogItem>> ListCategoriesAsync();
    Task<CatalogItem> CreateCategoryAsync(CatalogItemRequest request);
    Task<CatalogItem> RenameCategoryAsync(int id, CatalogItemRequest request);
    Task DeleteCategoryAsync(int id);
    Task<IReadOnlyList<CategoryFacet>> PublicCategoriesAsync();

    Task<IReadOnlyList<CatalogItem>> ListEpisodeTypesAsync();
    Task<CatalogItem> CreateEpisodeTypeAsync(CatalogItemRequest request);
    Task<CatalogItem> RenameEpisodeTypeAsync(int id, CatalogItemRequest request);
    Task DeleteEpisodeTypeAsync(int id);

    Task<IReadOnlyList<MetadataProviderItem>> ListProvidersAsync();
    Task<MetadataProviderItem> CreateProviderAsync(MetadataProviderRequest request);
    Task<MetadataProviderItem> UpdateProviderAsync(int id, MetadataProviderRequest request);
    Task DeleteProviderAsync(int id);
}
