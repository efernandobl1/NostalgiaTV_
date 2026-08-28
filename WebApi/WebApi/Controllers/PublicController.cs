using ApplicationCore.DTOs.Channel;
using ApplicationCore.DTOs.Series;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Infrastructure.BackgroundServices;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Controllers
{
    [ApiController]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/public")]
    public class PublicController : ControllerBase
    {
        private readonly IChannelService _channelService;
        private readonly ChannelBroadcastService _broadcastService;
        private readonly IEpisodeService _episodeService;
        private readonly ISeriesService _seriesService;
        private readonly ChannelScheduleService _scheduleService;

        public PublicController(
            IChannelService channelService,
            ChannelBroadcastService broadcastService,
            IEpisodeService episodeService,
            ISeriesService seriesService,
            ChannelScheduleService scheduleService)
        {
            _channelService = channelService;
            _broadcastService = broadcastService;
            _episodeService = episodeService;
            _seriesService = seriesService;
            _seriesService = seriesService;
            _scheduleService = scheduleService;
        }

        [HttpGet("channels/{channelId}/state")]
        public async Task<IActionResult> GetChannelState(int channelId)
        {
            var response = await _broadcastService.GetStateResponseAsync(channelId);
            if (response == null) return NotFound();
            return Ok(response);
        }

        [HttpGet("channels")]
        public async Task<IActionResult> GetChannels() => Ok(await _channelService.GetAllAsync());

        [HttpGet("episode-types")]
        public async Task<IActionResult> GetEpisodeTypes() => Ok(await _episodeService.GetTypesAsync());

        [HttpGet("series")]
        public async Task<IActionResult> GetSeries([FromQuery] SeriesFilterRequest filter) => Ok(await _seriesService.GetPublicAsync(filter));

        [HttpGet("series/{seriesId}/episodes")]
        public async Task<IActionResult> GetEpisodesBySeries(int seriesId) => Ok(await _episodeService.GetBySeriesPublicAsync(seriesId));

        [HttpGet("channels/{channelId}/schedule")]
        public async Task<IActionResult> GetSchedule(int channelId) => Ok(await _scheduleService.GetScheduleAsync(channelId));

        [HttpGet("channels/{channelId}/eras")]
        public async Task<IActionResult> GetChannelEras(int channelId, [FromServices] IChannelEraService eraService) =>
            Ok(await eraService.GetByChannelAsync(channelId));

        [HttpGet("eras/{eraId}/bumpers")]
        public async Task<IActionResult> GetEraBumpers(int eraId, [FromServices] IChannelBumperService bumperService) =>
            Ok(await bumperService.GetByEraAsync(eraId));
    }
}