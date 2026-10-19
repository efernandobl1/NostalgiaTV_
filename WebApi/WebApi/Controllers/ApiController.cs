using System.Security.Claims;
using ApplicationCore.Exceptions;
using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers;

/// <summary>Thin HTTP layer: controllers translate requests and cookies; repositories own the rules.</summary>
[ApiController, ApiVersion("1")]
public abstract class ApiController : ControllerBase
{
    protected int UserId => CurrentUserId ?? throw new UnauthorizedException("Inicia sesión para continuar.");

    protected int? CurrentUserId => User.Identity?.IsAuthenticated == true && int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
        ? id : null;

    protected string IpAddress => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
