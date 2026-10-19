using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Interfaces.Repositories;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

/// <summary>Admin "Resumen": platform counters, channels on air and the latest activity.</summary>
public sealed class DashboardRepository(NostalgiaTVContext context, IChannelRepository channels, IActivityRepository activity) : IDashboardRepository
{
    public async Task<DashboardSummary> SummaryAsync(CancellationToken token)
    {
        var now = DateTime.UtcNow;
        var series = await context.Series.CountAsync(token);
        var episodes = await context.Episodes.CountAsync(episode => episode.IsAvailable && episode.FilePath != null, token);
        var missing = await context.Episodes.CountAsync(episode => !episode.IsAvailable || episode.FilePath == null, token);
        var channelCount = await context.Channels.CountAsync(token);
        var eras = await context.ChannelEras.CountAsync(token);
        var users = await context.Users.CountAsync(token);
        var devices = await context.ViewerDevices.CountAsync(device => device.ExpiresAtUtc > now, token);
        var pending = await context.Comments.CountAsync(comment => comment.Status == CommentStatus.Pending, token);
        var queued = await context.MediaProcessingJobs.CountAsync(job => job.Status == MediaJobStatus.Queued || job.Status == MediaJobStatus.Processing, token);
        var failed = await context.MediaProcessingJobs.CountAsync(job => job.Status == MediaJobStatus.Failed, token);
        var list = await channels.ListAsync();
        var latest = await activity.ListAsync(0, 1, 6);
        return new DashboardSummary(series, episodes, missing, channelCount, list.Count(channel => channel.Now != null), eras, users, devices,
            pending, queued, failed, list, latest.Items);
    }
}
