using ApplicationCore.DTOs;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace WebApi.Controllers;

/// <summary>Public site, phone and TV catalog: channels, live state, guide and series.</summary>
[AllowAnonymous, Route("api/v{version:apiVersion}/public")]
public sealed class PublicController(ISettingsRepository settings, ICatalogRepository catalog, ISeriesRepository series,
    IChannelRepository channels, IScheduleRepository schedule) : ApiController
{
    private static readonly TimeSpan MaxProgramRange = TimeSpan.FromHours(24);

    [HttpGet("settings")]
    public Task<PublicSettingsResponse> Settings() => settings.GetPublicAsync();

    [HttpGet("categories")]
    public Task<IReadOnlyList<CategoryFacet>> Categories() => catalog.PublicCategoriesAsync();

    [HttpGet("series")]
    public Task<PagedResult<PublicSeriesCard>> Series([FromQuery] SeriesQuery query) => series.SearchAsync(query);

    [HttpGet("series/{id:int}")]
    public Task<PublicSeriesDetail> SeriesDetail(int id) => series.GetPublicAsync(id);

    [HttpGet("series/{id:int}/episodes")]
    public Task<IReadOnlyList<PublicEpisode>> Episodes(int id, int? season) => series.PublicEpisodesAsync(id, season);

    [HttpGet("channels")]
    public Task<IReadOnlyList<PublicChannelCard>> Channels() => channels.PublicListAsync();

    [HttpGet("channels/{id:int}")]
    public Task<PublicChannelDetail> Channel(int id) => channels.PublicGetAsync(id);

    /// <summary>What is on air now; viewers then follow the SignalR "ChannelState" stream.</summary>
    [HttpGet("channels/{id:int}/state"), EnableRateLimiting("ViewerPolicy")]
    public async Task<ChannelState> State(int id, CancellationToken token) =>
        await schedule.GetStateAsync(id, token) ?? throw new NotFoundException("El canal no tiene programación al aire.");

    [HttpGet("channels/{id:int}/programs")]
    public Task<IReadOnlyList<ScheduleProgram>> Programs(int id, DateTime? from, DateTime? to)
    {
        var (start, end) = Range(from, to);
        return schedule.GetProgramsAsync(id, start, end);
    }

    [HttpGet("guide")]
    public Task<IReadOnlyList<GuideRow>> Guide(DateOnly? day, int? channelId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var selected = day ?? today;
        if (selected < today.AddDays(-3) || selected > today.AddDays(2)) throw new BadRequestException("La guía cubre de tres días atrás a dos días adelante.");
        return schedule.GetGuideAsync(selected, channelId);
    }

    internal static (DateTime From, DateTime To) Range(DateTime? from, DateTime? to)
    {
        var start = (from ?? DateTime.UtcNow).ToUniversalTime();
        var end = (to ?? start.AddHours(6)).ToUniversalTime();
        if (end <= start || end - start > MaxProgramRange) throw new BadRequestException("Indica un rango de hasta 24 horas.");
        return (start, end);
    }
}

[Route("api/v{version:apiVersion}")]
public sealed class CommentsController(ICommentRepository comments) : ApiController
{
    [HttpGet("channels/{id:int}/comments"), AllowAnonymous]
    public Task<PagedResult<PublicComment>> ChannelComments(int id, int page = 1) => comments.ChannelCommentsAsync(id, page);

    [HttpGet("series/{id:int}/comments"), AllowAnonymous]
    public Task<PagedResult<PublicComment>> SeriesComments(int id, int page = 1) => comments.SeriesCommentsAsync(id, page);

    [HttpPost("channels/{id:int}/comments"), EnableRateLimiting("CommentPolicy")]
    public async Task<IActionResult> PostChannelComment(int id, CommentRequest request) =>
        Accepted(await comments.PostChannelCommentAsync(id, UserId, request));

    [HttpPost("series/{id:int}/comments"), EnableRateLimiting("CommentPolicy")]
    public async Task<IActionResult> PostSeriesComment(int id, CommentRequest request) =>
        Accepted(await comments.PostSeriesCommentAsync(id, UserId, request));
}
