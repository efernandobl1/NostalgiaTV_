using System.ComponentModel.DataAnnotations;

namespace ApplicationCore.DTOs;

public sealed record LoginRequest(
    [Required, StringLength(100)] string Username,
    [Required, StringLength(128)] string Password,
    bool RememberMe);

public sealed record RegisterRequest(
    [Required, StringLength(50, MinimumLength = 3), RegularExpression(@"^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$")] string Username,
    [Required, StringLength(128, MinimumLength = 12)] string Password);

public sealed record ChangePasswordRequest(
    [Required, StringLength(128)] string CurrentPassword,
    [Required, StringLength(128, MinimumLength = 12)] string NewPassword);

/// <summary>Credentials the API turns into HttpOnly cookies; never serialized to clients.</summary>
public sealed record AuthTokens(string AccessToken, string RefreshToken, DateTime RefreshExpiresUtc, bool Persistent);

public sealed record MenuNode(int Id, string Name, string Caption, string Icon, string Url, int SortOrder, IReadOnlyList<MenuNode> Children);

/// <summary>The signed-in account as seen by the public site, the dashboard and the TV app.</summary>
public sealed record MeResponse(int Id, string Username, string Role, bool CanUseDashboard, bool HasPassword,
    IReadOnlyList<string> ExternalLogins, IReadOnlyList<MenuNode> Menus);

/// <summary>Identifies the server to the TV app; DeviceAuthorizationVersion changes only when the device flow breaks compatibility.</summary>
public sealed record ServerInfoResponse(string Product, int ApiVersion, int DeviceAuthorizationVersion, bool RegistrationEnabled, bool GoogleEnabled);
