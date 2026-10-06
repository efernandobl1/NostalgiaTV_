using ApplicationCore.DTOs.ChannelEra;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Infrastructure.Contexts;
using Infrastructure.BackgroundServices;
using ApplicationCore.Entities;

namespace WebApi.Controllers
{
    [ApiController]
    [Authorize(Policy = "Eras")]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/channels/{channelId}/eras")]
    public class ChannelEraController : ControllerBase
    {
        private readonly IChannelEraService _eraService;

        public ChannelEraController(IChannelEraService eraService) => _eraService = eraService;

        [HttpGet]
        public async Task<IActionResult> GetAll(int channelId) => Ok(await _eraService.GetByChannelAsync(channelId));

        [HttpGet("{eraId}")]
        public async Task<IActionResult> GetById(int channelId, int eraId, [FromServices] NostalgiaTVContext context)
        {
            if (!await context.ChannelEras.AnyAsync(era => era.Id == eraId && era.ChannelId == channelId))
                return NotFound();
            return Ok(await _eraService.GetByIdAsync(eraId));
        }

        [HttpPost]
        public async Task<IActionResult> Create(int channelId, [FromBody] ChannelEraRequest request) =>
            Ok(await _eraService.CreateAsync(channelId, request));

        [HttpPut("{eraId}")]
        public async Task<IActionResult> Update(int channelId, int eraId, [FromBody] ChannelEraRequest request,
            [FromServices] NostalgiaTVContext context)
        {
            if (!await context.ChannelEras.AnyAsync(era => era.Id == eraId && era.ChannelId == channelId))
                return NotFound();
            return Ok(await _eraService.UpdateAsync(eraId, request));
        }

        [HttpDelete("{eraId}")]
        public async Task<IActionResult> Delete(int channelId, int eraId, [FromServices] NostalgiaTVContext context)
        {
            if (!await context.ChannelEras.AnyAsync(era => era.Id == eraId && era.ChannelId == channelId))
                return NotFound();
            await _eraService.DeleteAsync(eraId);
            return NoContent();
        }

        [HttpPut("{eraId}/series")]
        public async Task<IActionResult> AssignSeries(int channelId, int eraId, [FromBody] AssignSeriesToEraRequest request,
            [FromServices] NostalgiaTVContext context, [FromServices] ChannelBroadcastService broadcast)
        {
            if (!await context.ChannelEras.AnyAsync(era => era.Id == eraId && era.ChannelId == channelId))
                return NotFound();
            var result = await _eraService.AssignSeriesAsync(eraId, request);
            if (await context.ChannelEraSelections.AnyAsync(selection =>
                selection.ChannelId == channelId && selection.ChannelEraId == eraId))
                await broadcast.ReloadChannelAsync(channelId);
            return Ok(result);
        }

        [HttpPut("{eraId}/activate")]
        public async Task<IActionResult> Activate(
            int channelId,
            int eraId,
            [FromServices] NostalgiaTVContext context,
            [FromServices] ChannelBroadcastService broadcast)
        {
            if (!await context.ChannelEras.AnyAsync(era => era.Id == eraId && era.ChannelId == channelId))
                return NotFound();

            var selection = await context.ChannelEraSelections.FindAsync(channelId);
            if (selection == null)
            {
                selection = new ChannelEraSelection { ChannelId = channelId };
                context.ChannelEraSelections.Add(selection);
            }
            selection.ChannelEraId = eraId;
            selection.SelectedAtUtc = DateTime.UtcNow;
            await context.SaveChangesAsync();
            await broadcast.ReloadChannelAsync(channelId, replaceCurrent: true);
            return NoContent();
        }
    }
}
