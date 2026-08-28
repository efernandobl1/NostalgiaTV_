using ApplicationCore.DTOs.ChannelBumper;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers
{
    [ApiController]
    [Authorize]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/eras/{eraId}/bumpers")]
    public class ChannelBumperController : ControllerBase
    {
        private readonly IChannelBumperService _bumperService;

        public ChannelBumperController(IChannelBumperService bumperService) => _bumperService = bumperService;

        [HttpGet]
        public async Task<IActionResult> GetAll(int eraId) => Ok(await _bumperService.GetByEraAsync(eraId));

        [HttpGet("{bumperId}")]
        public async Task<IActionResult> GetById(int eraId, int bumperId) => Ok(await _bumperService.GetByIdAsync(bumperId));

        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Create(int eraId, [FromForm] ChannelBumperRequest request) =>
            Ok(await _bumperService.CreateAsync(eraId, request));

        [HttpPut("{bumperId}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Update(int eraId, int bumperId, [FromForm] ChannelBumperRequest request) =>
            Ok(await _bumperService.UpdateAsync(bumperId, request));

        [HttpDelete("{bumperId}")]
        public async Task<IActionResult> Delete(int eraId, int bumperId)
        {
            await _bumperService.DeleteAsync(bumperId);
            return NoContent();
        }

        [HttpGet("random")]
        public async Task<IActionResult> GetRandom(int eraId)
        {
            var bumper = await _bumperService.GetRandomBumperAsync(eraId);
            return bumper == null ? NotFound() : Ok(bumper);
        }

        [HttpPost("scan")]
        public async Task<IActionResult> ScanFolder(int eraId) =>
            Ok(await _bumperService.ScanFolderAsync(eraId));
    }
}
