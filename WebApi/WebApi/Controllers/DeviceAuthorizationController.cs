using System.Security.Claims;
using System.Security.Cryptography;
using ApplicationCore.Entities;
using Asp.Versioning;
using Infrastructure.Contexts;
using Infrastructure.Services.Viewing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Controllers;

[ApiController, ApiVersion("1"), Route("api/v{version:apiVersion}/viewer/authorization")]
public class DeviceAuthorizationController(NostalgiaTVContext context) : ControllerBase
{
    private ViewerSessions Sessions => new(context, HttpContext.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment());
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    [HttpPost, AllowAnonymous, EnableRateLimiting("PairingPolicy")]
    public Task<IActionResult> Start(DeviceRequest request) => Create(request, false);

    [HttpPost("qr"), Authorize, EnableRateLimiting("PairingPolicy")]
    public Task<IActionResult> DashboardQr(DeviceRequest request) => Create(request, true);

    private async Task<IActionResult> Create(DeviceRequest request, bool approved)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.DeviceAuthorizations.Where(item => item.ExpiresAtUtc < DateTime.UtcNow).ExecuteDeleteAsync();
        var deviceCode = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var userCode = new string(Enumerable.Range(0, 12).Select(_ => Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)]).ToArray());
        var authorization = new DeviceAuthorization { DeviceCodeHash = ViewerSessions.Hash(deviceCode),
            UserCodeHash = ViewerSessions.Hash(userCode), Name = ViewerSessions.SafeName(request.Name),
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(approved ? 2 : 10) };
        if (approved) await Approve(authorization);
        context.DeviceAuthorizations.Add(authorization);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { DeviceCode = deviceCode, UserCode = string.Join('-', Enumerable.Range(0, 4).Select(index => userCode.Substring(index * 3, 3))),
            ExpiresAtUtc = DateTime.SpecifyKind(authorization.ExpiresAtUtc, DateTimeKind.Utc), Interval = 5 });
    }

    [HttpPost("inspect"), Authorize, EnableRateLimiting("PairingPolicy")]
    public async Task<IActionResult> Inspect(CodeRequest request)
    {
        var code = NormalizeCode(request.Code);
        if (code == null) return BadRequest();
        var hash = ViewerSessions.Hash(code);
        var authorization = await context.DeviceAuthorizations.AsNoTracking().SingleOrDefaultAsync(item =>
            item.UserCodeHash == hash && item.ExpiresAtUtc > DateTime.UtcNow && item.ProfileId == null);
        return authorization == null ? NotFound() : Ok(new { authorization.Name, authorization.ExpiresAtUtc });
    }

    [HttpPost("approve"), Authorize, EnableRateLimiting("PairingPolicy")]
    public async Task<IActionResult> Confirm(CodeRequest request)
    {
        var code = NormalizeCode(request.Code);
        if (code == null) return BadRequest();
        await using var transaction = await context.Database.BeginTransactionAsync();
        var hash = ViewerSessions.Hash(code);
        await Sessions.LockAsync("device-user-code-" + hash);
        var authorization = await context.DeviceAuthorizations.SingleOrDefaultAsync(item =>
            item.UserCodeHash == hash && item.ExpiresAtUtc > DateTime.UtcNow && item.ProfileId == null);
        if (authorization == null) return NotFound();
        await Approve(authorization);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return NoContent();
    }

    private async Task Approve(DeviceAuthorization authorization)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var device = await Sessions.DeviceAsync(Request);
        var profile = await Sessions.AccountProfileAsync(userId, device?.ProfileId);
        authorization.ProfileId = profile.Id;
        authorization.SessionVersion = await context.Users.Where(user => user.Id == userId).Select(user => user.SessionVersion).SingleAsync();
    }

    [HttpPost("redeem"), AllowAnonymous, EnableRateLimiting("ViewerPolicy")]
    public async Task<IActionResult> Redeem(RedeemRequest request)
    {
        if (request.DeviceCode?.Length != 64 || !request.DeviceCode.All(Uri.IsHexDigit)) return BadRequest();
        await using var transaction = await context.Database.BeginTransactionAsync();
        var hash = ViewerSessions.Hash(request.DeviceCode);
        await Sessions.LockAsync("device-code-" + hash);
        var authorization = await context.DeviceAuthorizations.SingleOrDefaultAsync(item => item.DeviceCodeHash == hash);
        if (authorization == null || authorization.ExpiresAtUtc <= DateTime.UtcNow) return StatusCode(410);
        if (authorization.LastPolledAtUtc > DateTime.UtcNow.AddSeconds(-5))
        {
            Response.Headers.RetryAfter = "5";
            return StatusCode(429);
        }
        if (authorization.ProfileId == null)
        {
            authorization.LastPolledAtUtc = DateTime.UtcNow;
            await context.SaveChangesAsync();
            await transaction.CommitAsync();
            return Accepted(new { Status = "pending" });
        }
        await Sessions.LockAsync("viewer-profile-" + authorization.ProfileId);
        var user = await (from profile in context.ViewerProfiles join account in context.Users on profile.UserId equals account.Id
                          where profile.Id == authorization.ProfileId select account).SingleOrDefaultAsync();
        if (user == null || user.SessionVersion != authorization.SessionVersion) return Unauthorized();
        if (await context.ViewerDevices.CountAsync(item => item.ProfileId == authorization.ProfileId && item.ExpiresAtUtc > DateTime.UtcNow) >= 10)
            return Conflict(new { Message = "Este perfil ya tiene diez dispositivos. Desvincula uno primero." });
        await Sessions.CreateAsync(Response, authorization.ProfileId.Value, authorization.Name, user.SessionVersion);
        context.DeviceAuthorizations.Remove(authorization);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new { Status = "connected" });
    }

    private static string? NormalizeCode(string? value)
    {
        if (value == null || value.Length > 32) return null;
        var code = value.Replace("-", "").Replace(" ", "").ToUpperInvariant();
        return code.Length == 12 && code.All(Alphabet.Contains) ? code : null;
    }

    public sealed record DeviceRequest(string? Name);
    public sealed record CodeRequest(string? Code);
    public sealed record RedeemRequest(string? DeviceCode);
}
