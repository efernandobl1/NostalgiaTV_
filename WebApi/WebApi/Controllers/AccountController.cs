using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ApplicationCore.Entities;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Infrastructure.Services.Viewing;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using WebApi.Extensions;

namespace WebApi.Controllers;

[ApiController, ApiVersion("1"), AllowAnonymous, Route("api/v{version:apiVersion}/auth")]
public sealed class AccountController(NostalgiaTVContext context, IAuthService auth, IConfiguration configuration) : ControllerBase
{
    [HttpPost("register"), EnableRateLimiting("AuthPolicy")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        if (!await RegistrationEnabled()) return StatusCode(403, new { Message = "El administrador no permite crear cuentas en este servidor." });
        await using var transaction = await context.Database.BeginTransactionAsync();
        var username = request.Username.Trim();
        await new ViewerSessions(context, false).LockAsync("login-" + AuthService.TokenHash(username.ToUpperInvariant()));
        if (await context.Users.AnyAsync(user => user.Username == username)) return Conflict(new { Message = "Ese nombre de usuario no está disponible." });
        var role = await context.Roles.SingleAsync(role => role.IsViewerRole);
        var user = new User { Username = username, PasswordHash = AuthService.HashPassword(request.Password), RolId = role.Id };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return StatusCode(201);
    }

    [HttpGet("google"), EnableRateLimiting("AuthPolicy")]
    public IActionResult Google(string? returnUrl)
    {
        if (!configuration.GoogleConfigured()) return NotFound();
        var destination = SafeDestination(returnUrl);
        return Challenge(new AuthenticationProperties { RedirectUri = "/api/v1/auth/google/complete?returnUrl=" + Uri.EscapeDataString(destination) }, GoogleLoginExtensions.Scheme);
    }

    [HttpGet("google/complete"), EnableRateLimiting("AuthPolicy")]
    public async Task<IActionResult> GoogleComplete(string? returnUrl)
    {
        if (!configuration.GoogleConfigured()) return NotFound();
        var ticket = await HttpContext.AuthenticateAsync(GoogleLoginExtensions.ExternalCookie);
        await HttpContext.SignOutAsync(GoogleLoginExtensions.ExternalCookie);
        var subject = ticket.Principal?.FindFirstValue("sub");
        if (!ticket.Succeeded || string.IsNullOrWhiteSpace(subject) || subject.Length > 255 || ticket.Properties?.ExpiresUtc <= DateTimeOffset.UtcNow ||
            !string.Equals(ticket.Principal?.FindFirstValue("email_verified"), "true", StringComparison.OrdinalIgnoreCase))
            return LocalRedirect("/login?error=google");
        int userId;
        await using (var transaction = await context.Database.BeginTransactionAsync())
        {
            await new ViewerSessions(context, false).LockAsync("google-" + ViewerSessions.Hash(subject));
            var user = await context.Users.SingleOrDefaultAsync(user => user.GoogleSubject == subject);
            if (user == null)
            {
                if (!await RegistrationEnabled()) return LocalRedirect("/login?error=registration");
                var role = await context.Roles.SingleAsync(role => role.IsViewerRole);
                // Stable provider identity, never an email match, owns this account.
                user = new User { Username = "google-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(12)).ToLowerInvariant(),
                    GoogleSubject = subject, PasswordHash = "!google-only", RolId = role.Id };
                context.Users.Add(user);
                await context.SaveChangesAsync();
            }
            userId = user.Id;
            await transaction.CommitAsync();
        }
        await auth.SignInExternalAsync(userId, Response, HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        return LocalRedirect(SafeDestination(returnUrl));
    }

    public static string SafeDestination(string? value) => value == "/" || value == "/tv" ||
        value?.Length <= 128 && System.Text.RegularExpressions.Regex.IsMatch(value, @"^/tv\?code=[A-Za-z2-9-]{12,16}$") ? value! : "/";
    private Task<bool> RegistrationEnabled() => context.PlatformSettings.Select(settings => settings.PublicRegistrationEnabled).SingleAsync();
    public sealed record RegisterRequest([Required, StringLength(50, MinimumLength = 3), RegularExpression(@"^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$")] string Username,
        [Required, StringLength(128, MinimumLength = 12)] string Password);
}
