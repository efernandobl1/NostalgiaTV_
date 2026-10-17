using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebApi.Services;

namespace WebApi.Controllers;

[ApiController, ApiVersion("1"), Authorize(Policy = "Admin"), Route("api/v{version:apiVersion}/server/updates")]
public sealed class ServerUpdatesController(ServerUpdates updates) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken) => Ok(await updates.GetAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> CreateRequest(CancellationToken cancellationToken) =>
        await updates.RequestAsync(cancellationToken) ? Accepted() : Conflict(new { message = "No hay una actualización disponible, ya está solicitada o el actualizador no está conectado." });
}
