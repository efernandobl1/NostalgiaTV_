using System.Security.Claims;
using System.Text.RegularExpressions;
using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WebApi.Extensions;
using WebApi.Http;

namespace WebApi.Controllers;

[AllowAnonymous, EnableRateLimiting("AuthPolicy"), Route("api/v{version:apiVersion}/auth")]
public sealed partial class AuthController(IAuthRepository auth, IConfiguration configuration) : ApiController
{
    [HttpPost("token")]
    public async Task<IActionResult> Token(LoginRequest request)
    {
        AuthCookies.Write(Response, await auth.LoginAsync(request, IpAddress));
        return NoContent();
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        try { AuthCookies.Write(Response, await auth.RefreshAsync(Request.Cookies[AuthCookies.Refresh] ?? "", IpAddress)); }
        catch (UnauthorizedException)
        {
            AuthCookies.Clear(Response);
            throw;
        }
        return NoContent();
    }

    [HttpPost("revoke")]
    public async Task<IActionResult> Revoke()
    {
        await auth.RevokeAsync(Request.Cookies[AuthCookies.Refresh], IpAddress);
        AuthCookies.Clear(Response);
        return NoContent();
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        await auth.RegisterAsync(request);
        return StatusCode(StatusCodes.Status201Created);
    }

    [HttpGet("google")]
    public IActionResult Google(string? returnUrl)
    {
        if (!configuration.GoogleConfigured()) return NotFound();
        var properties = new AuthenticationProperties
        {
            RedirectUri = "/api/v1/auth/google/complete?returnUrl=" + Uri.EscapeDataString(SafeDestination(returnUrl))
        };
        return Challenge(properties, GoogleLoginExtensions.Scheme);
    }

    [HttpGet("google/complete")]
    public async Task<IActionResult> GoogleComplete(string? returnUrl)
    {
        if (!configuration.GoogleConfigured()) return NotFound();
        var ticket = await HttpContext.AuthenticateAsync(GoogleLoginExtensions.ExternalCookie);
        await HttpContext.SignOutAsync(GoogleLoginExtensions.ExternalCookie);
        var subject = ticket.Principal?.FindFirstValue("sub");
        if (!ticket.Succeeded || string.IsNullOrWhiteSpace(subject) || ticket.Properties?.ExpiresUtc <= DateTimeOffset.UtcNow ||
            !string.Equals(ticket.Principal?.FindFirstValue("email_verified"), "true", StringComparison.OrdinalIgnoreCase))
            return LocalRedirect("/login?error=google");
        try { AuthCookies.Write(Response, await auth.LoginExternalAsync(ExternalLoginProviders.Google, subject, IpAddress)); }
        catch (ForbiddenException) { return LocalRedirect("/login?error=registration"); }
        catch (UnauthorizedException) { return LocalRedirect("/login?error=google"); }
        return LocalRedirect(SafeDestination(returnUrl));
    }

    /// <summary>Only the home page and the TV pairing pages (/vincular, /tv) are valid post-login destinations.</summary>
    public static string SafeDestination(string? value) =>
        value is "/" or "/tv" or "/vincular" || (value?.Length <= 128 && TvCode().IsMatch(value)) ? value! : "/";

    [GeneratedRegex(@"^/(tv|vincular)\?code=[A-Za-z2-9-]{12,16}$")]
    private static partial Regex TvCode();
}

[Route("api/v{version:apiVersion}/account")]
public sealed class AccountController(IAccountRepository accounts, ICommentRepository comments) : ApiController
{
    [HttpGet("me")]
    public Task<MeResponse> Me() => accounts.GetMeAsync(UserId);

    [HttpPut("password"), EnableRateLimiting("AuthPolicy")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        await accounts.ChangePasswordAsync(UserId, request);
        AuthCookies.Clear(Response);
        return NoContent();
    }

    /// <summary>Signs out every browser, phone and TV linked to the account.</summary>
    [HttpPost("sessions/revoke")]
    public async Task<IActionResult> RevokeSessions()
    {
        await accounts.RevokeAllSessionsAsync(UserId);
        AuthCookies.Clear(Response);
        return NoContent();
    }

    [HttpDelete("logins/{provider}")]
    public async Task<IActionResult> UnlinkLogin(string provider)
    {
        await accounts.UnlinkExternalLoginAsync(UserId, provider);
        return NoContent();
    }

    [HttpGet("comments")]
    public Task<IReadOnlyList<MyComment>> MyComments() => comments.MyCommentsAsync(UserId);

    [HttpPut("comments/{id:long}"), EnableRateLimiting("CommentPolicy")]
    public Task<MyComment> EditComment(long id, CommentEditRequest request) => comments.EditMyCommentAsync(UserId, id, request);

    [HttpDelete("comments/{id:long}")]
    public async Task<IActionResult> DeleteComment(long id)
    {
        await comments.DeleteMyCommentAsync(UserId, id);
        return NoContent();
    }
}

[AllowAnonymous, Route("api/v{version:apiVersion}/server")]
public sealed class ServerController(IAuthRepository auth, IConfiguration configuration) : ApiController
{
    [HttpGet]
    public async Task<ServerInfoResponse> Get() =>
        new("NostalgiaTV", 2, 1, await auth.RegistrationEnabledAsync(), configuration.GoogleConfigured());
}
