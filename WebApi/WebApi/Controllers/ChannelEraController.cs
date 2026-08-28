using ApplicationCore.DTOs.ChannelEra;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers
{
    [ApiController]
    [Authorize]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/channels/{channelId}/eras")]
    public class ChannelEraController : ControllerBase
    {
        private readonly IChannelEraService _eraService;

        public ChannelEraController(IChannelEraService eraService) => _eraService = eraService;

        [HttpGet]
        public async Task<IActionResult> GetAll(int channelId) => Ok(await _eraService.GetByChannelAsync(channelId));

        [HttpGet("{eraId}")]
        public async Task<IActionResult> GetById(int channelId, int eraId) => Ok(await _eraService.GetByIdAsync(eraId));

        [HttpPost]
        public async Task<IActionResult> Create(int channelId, [FromBody] ChannelEraRequest request) =>
            Ok(await _eraService.CreateAsync(channelId, request));

        [HttpPut("{eraId}")]
        public async Task<IActionResult> Update(int channelId, int eraId, [FromBody] ChannelEraRequest request) =>
            Ok(await _eraService.UpdateAsync(eraId, request));

        [HttpDelete("{eraId}")]
        public async Task<IActionResult> Delete(int channelId, int eraId)
        {
            await _eraService.DeleteAsync(eraId);
            return NoContent();
        }

        [HttpPut("{eraId}/series")]
        public async Task<IActionResult> AssignSeries(int channelId, int eraId, [FromBody] AssignSeriesToEraRequest request) =>
            Ok(await _eraService.AssignSeriesAsync(eraId, request));
    }
}
