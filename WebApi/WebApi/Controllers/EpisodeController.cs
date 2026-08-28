using ApplicationCore.DTOs.Episode;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers
{
    [ApiController]
    [Authorize]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/episodes")]
    public class EpisodeController : ControllerBase
    {
        private readonly IEpisodeService _episodeService;

        public EpisodeController(IEpisodeService episodeService) => _episodeService = episodeService;

        [HttpGet("series/{seriesId}")]
        public async Task<IActionResult> GetBySeries(int seriesId) => Ok(await _episodeService.GetBySeriesAsync(seriesId));

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, UpdateEpisodeRequest request) => Ok(await _episodeService.UpdateAsync(id, request));

    }
}
