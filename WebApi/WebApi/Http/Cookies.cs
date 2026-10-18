using ApplicationCore.DTOs;
using ApplicationCore.Models;

namespace WebApi.Http;

/// <summary>Account session cookies. Credentials never travel in response bodies.</summary>
public static class AuthCookies
{
    public const string Access = "access_token";
    public const string Refresh = "refresh_token";

    public static void Write(HttpResponse response, AuthTokens tokens)
    {
        var expires = tokens.Persistent ? new DateTimeOffset(tokens.RefreshExpiresUtc) : (DateTimeOffset?)null;
        response.Cookies.Append(Access, tokens.AccessToken, Options(expires));
        response.Cookies.Append(Refresh, tokens.RefreshToken, Options(expires));
    }

    public static void Clear(HttpResponse response)
    {
        response.Cookies.Delete(Access, Options(null));
        response.Cookies.Delete(Refresh, Options(null));
    }

    private static CookieOptions Options(DateTimeOffset? expires) =>
        new() { HttpOnly = true, Secure = true, SameSite = SameSiteMode.Lax, Path = "/", Expires = expires, IsEssential = true };
}

/// <summary>
/// Device credential of the public player. "__Host-" pins it to the exact origin over HTTPS; local
/// development over plain HTTP uses an unprefixed cookie scoped to the viewer endpoints.
/// </summary>
public sealed class ViewerCookie(IHostEnvironment environment)
{
    private bool Development => environment.IsDevelopment();
    public string Name => Development ? "viewer_device" : "__Host-viewer_device";
    private string Path => Development ? "/api/v1/viewer" : "/";

    public string? Read(HttpRequest request) => request.Cookies[Name];

    public void Write(HttpResponse response, string token, DateTime expiresUtc) => response.Cookies.Append(Name, token, new CookieOptions
    {
        HttpOnly = true, Secure = !Development, SameSite = SameSiteMode.Strict, Path = Path, Expires = expiresUtc, IsEssential = true
    });

    public void Clear(HttpResponse response) =>
        response.Cookies.Delete(Name, new CookieOptions { HttpOnly = true, Secure = !Development, SameSite = SameSiteMode.Strict, Path = Path });
}

public static class FormFileExtensions
{
    public static FileUpload ToUpload(this IFormFile file) => new(file.FileName, file.Length, file.ContentType, file.OpenReadStream);
}
