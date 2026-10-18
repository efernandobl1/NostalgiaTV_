using ApplicationCore.DTOs;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WebApi.Http;

namespace WebApi.Controllers;

/// <summary>Viewer device sessions (web, phone and TV): history, pairing and linked devices.</summary>
[AllowAnonymous, EnableRateLimiting("ViewerPolicy"), Route("api/v{version:apiVersion}/viewer")]
public sealed class ViewerController(IViewerRepository viewers, ViewerCookie cookie) : ApiController
{
    private string? Device => cookie.Read(Request);

    /// <summary>Starts (or resumes) the device session; a signed-in account links the device to its profile.</summary>
    [HttpPost("session"), EnableRateLimiting("ViewerCreationPolicy")]
    public async Task<ViewerSession> Start(DeviceRequest request)
    {
        var started = await viewers.StartSessionAsync(Device, CurrentUserId, request);
        if (started.SetToken != null) cookie.Write(Response, started.SetToken, started.TokenExpiresUtc!.Value);
        return started.Session;
    }

    [HttpGet("session")]
    public async Task<ViewerSession> Session() =>
        await viewers.GetSessionAsync(Device) ?? throw new UnauthorizedException("Sesión de espectador no válida.");

    [HttpPost("code"), EnableRateLimiting("PairingPolicy")]
    public Task<PairingCode> PairingCode() => viewers.CreatePairingCodeAsync(Device);

    [HttpPost("pair"), EnableRateLimiting("PairingPolicy")]
    public async Task<IActionResult> Pair(PairRequest request)
    {
        await viewers.PairAsync(Device, request);
        return NoContent();
    }

    [HttpPost("progress")]
    public Task<ProgressSaved> Progress(ProgressRequest request) => viewers.SaveProgressAsync(Device, request);

    [HttpGet("history")]
    public Task<IReadOnlyList<ProgressItem>> History() => viewers.HistoryAsync(Device);

    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory()
    {
        await viewers.ClearHistoryAsync(Device);
        return NoContent();
    }

    [HttpDelete("series/{seriesId:int}/progress")]
    public async Task<IActionResult> ResetSeries(int seriesId)
    {
        await viewers.ResetSeriesProgressAsync(Device, seriesId);
        return NoContent();
    }

    [HttpDelete("devices/{id:guid}")]
    public async Task<IActionResult> Unlink(Guid id)
    {
        if (await viewers.UnlinkDeviceAsync(Device, id)) cookie.Clear(Response);
        return NoContent();
    }
}

/// <summary>
/// TV sign-in with a short code (device authorization grant): the TV starts and polls, a signed-in
/// phone or browser inspects and approves the code, or shows a pre-approved QR.
/// </summary>
[Route("api/v{version:apiVersion}/viewer/authorization")]
public sealed class ViewerAuthorizationController(IViewerRepository viewers, ViewerCookie cookie) : ApiController
{
    [HttpPost, AllowAnonymous, EnableRateLimiting("PairingPolicy")]
    public Task<DeviceAuthorizationStart> Start(DeviceRequest request) => viewers.StartAuthorizationAsync(request, null, null);

    [HttpPost("qr"), EnableRateLimiting("PairingPolicy")]
    public Task<DeviceAuthorizationStart> Qr(DeviceRequest request) => viewers.StartAuthorizationAsync(request, UserId, cookie.Read(Request));

    [HttpPost("inspect"), EnableRateLimiting("PairingPolicy")]
    public Task<DeviceAuthorizationInfo> Inspect(CodeRequest request) => viewers.InspectAuthorizationAsync(request.Code);

    [HttpPost("approve"), EnableRateLimiting("PairingPolicy")]
    public async Task<IActionResult> Approve(CodeRequest request)
    {
        await viewers.ApproveAuthorizationAsync(UserId, request.Code, cookie.Read(Request));
        return NoContent();
    }

    /// <summary>Polled by the TV: 202 pending, 429 too fast, 410 expired, 401 rejected, 409 device limit, 200 connected.</summary>
    [HttpPost("redeem"), AllowAnonymous, EnableRateLimiting("ViewerPolicy")]
    public async Task<IActionResult> Redeem(RedeemRequest request)
    {
        var result = await viewers.RedeemAuthorizationAsync(request.DeviceCode);
        switch (result.Status)
        {
            case RedeemStatus.Connected:
                cookie.Write(Response, result.SetToken!, result.TokenExpiresUtc!.Value);
                return Ok(new { Status = "connected" });
            case RedeemStatus.Pending:
                return Accepted(new { Status = "pending" });
            case RedeemStatus.SlowDown:
                Response.Headers.RetryAfter = "5";
                return StatusCode(StatusCodes.Status429TooManyRequests, new { Status = "slow_down" });
            case RedeemStatus.Expired:
                return StatusCode(StatusCodes.Status410Gone, new { Status = "expired" });
            case RedeemStatus.DeviceLimit:
                return Conflict(new { Status = "device_limit", Message = "Este perfil ya tiene diez dispositivos. Desvincula uno primero." });
            default:
                return Unauthorized(new { Status = "rejected" });
        }
    }
}
