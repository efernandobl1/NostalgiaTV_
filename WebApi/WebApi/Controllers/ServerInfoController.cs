using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using WebApi.Extensions;

namespace WebApi.Controllers;

[ApiController, ApiVersion("1"), AllowAnonymous, Route("api/v{version:apiVersion}/server")]
public sealed class ServerInfoController(NostalgiaTVContext context, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get() => Ok(new { Product = "NostalgiaTV", DeviceAuthorizationVersion = 1,
        RegistrationEnabled = await context.PlatformSettings.Select(settings => settings.PublicRegistrationEnabled).SingleAsync(),
        GoogleEnabled = configuration.GoogleConfigured() });
}
