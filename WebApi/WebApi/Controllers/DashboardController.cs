using Asp.Versioning;
using Infrastructure.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Controllers;

[ApiController]
[Authorize]
[ApiVersion("1")]
[Route("api/v{version:apiVersion}/dashboard")]
public sealed class DashboardController : ControllerBase
{
    private readonly NostalgiaTVContext _database;

    public DashboardController(NostalgiaTVContext database)
    {
        _database = database;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken cancellationToken)
    {
        var seriesCount = await _database.Series.CountAsync(cancellationToken);
        var episodeCount = await _database.Episodes.CountAsync(cancellationToken);
        var missingEpisodeFiles = await _database.Episodes.CountAsync(
            episode => episode.FilePath == null || episode.FilePath == string.Empty,
            cancellationToken);
        var activeChannelCount = await _database.Channels.CountAsync(cancellationToken);
        var eraCount = await _database.ChannelEras.CountAsync(cancellationToken);
        var userCount = await _database.Users.CountAsync(cancellationToken);
        var incompleteSeriesCount = await _database.Series.CountAsync(
            series => series.LogoPath == null || series.LogoPath == string.Empty || !series.ChannelEras.Any(),
            cancellationToken);

        var latestActivity = await _database.ActivityLogs
            .AsNoTracking()
            .OrderByDescending(activity => activity.CreatedAtUtc)
            .Take(6)
            .Select(activity => new
            {
                activity.Id,
                activity.Username,
                activity.Action,
                activity.Resource,
                activity.Description,
                activity.CreatedAtUtc,
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            seriesCount,
            episodeCount,
            missingEpisodeFiles,
            activeChannelCount,
            eraCount,
            userCount,
            incompleteSeriesCount,
            latestActivity,
        });
    }

    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity([FromQuery] int days = 7, CancellationToken cancellationToken = default)
    {
        var normalizedDays = days is 7 or 30 ? days : 0;
        var query = _database.ActivityLogs.AsNoTracking();

        if (normalizedDays > 0)
        {
            var since = DateTime.UtcNow.AddDays(-normalizedDays);
            query = query.Where(activity => activity.CreatedAtUtc >= since);
        }

        var activity = await query
            .OrderByDescending(entry => entry.CreatedAtUtc)
            .Take(100)
            .Select(entry => new
            {
                entry.Id,
                entry.Username,
                entry.Action,
                entry.Resource,
                entry.Description,
                entry.CreatedAtUtc,
            })
            .ToListAsync(cancellationToken);

        return Ok(activity);
    }
}
