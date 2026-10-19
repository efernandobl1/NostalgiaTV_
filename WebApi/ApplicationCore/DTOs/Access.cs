using System.ComponentModel.DataAnnotations;

namespace ApplicationCore.DTOs;

public sealed record UserListItem(int Id, string Username, int RoleId, string Role, IReadOnlyList<string> ExternalLogins,
    int FailedLoginAttempts, DateTime? LockedUntilUtc, int ActiveSessions);

public sealed record UserDetail(int Id, string Username, int RoleId, string Role, int FailedLoginAttempts, DateTime? LockedUntilUtc,
    int SessionVersion, int ActiveSessions, IReadOnlyList<ExternalLoginItem> ExternalLogins);

public sealed record ExternalLoginItem(string Provider, DateTime LinkedAtUtc);

public sealed record CreateUserRequest(
    [Required, StringLength(50, MinimumLength = 3), RegularExpression(@"^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$")] string Username,
    [Required, StringLength(128, MinimumLength = 12)] string Password,
    [Range(1, int.MaxValue)] int RoleId);

/// <summary>Password is optional: empty keeps the current one.</summary>
public sealed record UpdateUserRequest(
    [Required, StringLength(50, MinimumLength = 3), RegularExpression(@"^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$")] string Username,
    [StringLength(128)] string? Password,
    [Range(1, int.MaxValue)] int RoleId);

public sealed record RoleListItem(int Id, string Name, string Description, bool IsViewerRole, bool IsAdministrator, int UserCount, IReadOnlyList<int> MenuIds);

public sealed record RoleRequest([Required, StringLength(100)] string Name, [StringLength(4000)] string? Description);

public sealed record RoleMenusRequest([Required] IReadOnlyList<int> MenuIds);

public sealed record MenuItem(int Id, int? ParentId, string Name, string Caption, string Icon, string Url, int SortOrder, bool IsVisible);

public sealed record ActivityItem(long Id, DateTime CreatedAtUtc, int? UserId, string User, string Action, string Resource, string Description);
