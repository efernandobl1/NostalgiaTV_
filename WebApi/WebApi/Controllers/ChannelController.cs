using ApplicationCore.DTOs.Channel;
using ApplicationCore.Interfaces;
using Asp.Versioning;
using Infrastructure.BackgroundServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers
{
    [ApiController]
    [Authorize]
    [ApiVersion("1")]
    [Route("api/v{version:apiVersion}/channels")]
    public class ChannelController : ControllerBase
    {
        private readonly IChannelService _channelService;
        private readonly ChannelBroadcastService _broadcastService;

        public ChannelController(IChannelService channelService, ChannelBroadcastService broadcastService)
        {
            _channelService = channelService;
            _broadcastService = broadcastService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _channelService.GetAllAsync());

        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Create([FromForm] ChannelRequest request) => Ok(await _channelService.CreateAsync(request));

        [HttpPut("{id}")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Update(int id, [FromForm] ChannelRequest request) => Ok(await _channelService.UpdateAsync(id, request));

        [HttpPut("{id}/series")]
        public async Task<IActionResult> AssignSeries(int id, AssignSeriesRequest request) => Ok(await _channelService.AssignSeriesAsync(id, request));

        [HttpPost("{id}/schedule/refresh")]
        public async Task<IActionResult> RefreshSchedule(int id)
        {
            _ = Task.Run(async () =>
            {
                await _broadcastService.ReloadChannelAsync(id);
            });
            return Accepted();
        }
    }
}
