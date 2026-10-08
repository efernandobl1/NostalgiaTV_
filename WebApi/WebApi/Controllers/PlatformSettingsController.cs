using ApplicationCore.Settings;
using Asp.Versioning;
using Infrastructure.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Controllers;

[ApiController]
[ApiVersion("1")]
[Authorize(Policy = "Admin")]
[Route("api/v{version:apiVersion}/settings")]
public class PlatformSettingsController(NostalgiaTVContext context) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken) =>
        Ok(await context.PlatformSettings.AsNoTracking().SingleAsync(cancellationToken));

    [HttpPut]
    public async Task<IActionResult> Update(PlatformSettingsValues request, CancellationToken cancellationToken)
    {
        var settings = await context.PlatformSettings.SingleAsync(cancellationToken);
        context.Entry(settings).CurrentValues.SetValues(request);
        await context.SaveChangesAsync(cancellationToken);
        return Ok(settings);
    }

    [AllowAnonymous]
    [HttpGet("~/api/v{version:apiVersion}/public/settings")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetPublic(CancellationToken cancellationToken)
    {
        var settings = await context.PlatformSettings.AsNoTracking().SingleAsync(cancellationToken);
        return Ok(new
        {
            settings.SeasonalThemesEnabled,
            settings.SeasonalEffectsEnabled,
            settings.TimeZoneId
        });
    }
}
