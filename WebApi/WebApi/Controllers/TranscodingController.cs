using Asp.Versioning;
using Infrastructure.Contexts;
using Infrastructure.Services.Media;
using ApplicationCore.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace WebApi.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Authorize(Policy = "Transcoding")]
[Route("api/v{version:apiVersion}/transcoding")]
public sealed class TranscodingController(NostalgiaTVContext context, IOptions<MediaProcessingSettings> settings) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Status(CancellationToken token, [FromQuery] string worker = "all",
        [FromQuery] string view = "pending", [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (worker is not ("all" or "transcode" or "index") ||
            view is not ("pending" or "Completed" or "Skipped" or "Failed" or "all") || page < 1 || pageSize is < 1 or > 100)
            return BadRequest(new { message = "Selecciona un servicio, estado y página válidos." });
        var workers = await context.MediaWorkerStates.AsNoTracking().ToListAsync(token);
        var counts = await context.MediaProcessingJobs.GroupBy(job => new { job.Worker, job.Status })
            .Select(group => new { group.Key.Worker, group.Key.Status, Count = group.Count() }).ToListAsync(token);
        var query = from job in context.MediaProcessingJobs.AsNoTracking()
                          join series in context.Series on job.SeriesId equals series.Id
                          select new { job.Id, job.Worker, job.Status, job.Progress, job.SourcePath, job.OutputPath,
                              job.SourceSize, job.Message, job.UpdatedAtUtc, SeriesName = series.Name };
        if (worker != "all") query = query.Where(job => job.Worker == worker);
        if (view == "pending") query = query.Where(job => job.Status == "Queued" || job.Status == "Processing");
        else if (view != "all") query = query.Where(job => job.Status == view);
        var total = await query.CountAsync(token);
        page = Math.Min(page, Math.Max(1, (int)Math.Ceiling((double)total / pageSize)));
        var ordered = view == "pending"
            ? query.OrderByDescending(job => job.Status == "Processing").ThenBy(job => job.Id)
            : query.OrderByDescending(job => job.UpdatedAtUtc).ThenByDescending(job => job.Id);
        var jobs = await ordered.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(token);
        return Ok(new
        {
            ResourcePolicy = await context.MediaResourcePolicies.AsNoTracking().SingleAsync(item => item.Id == 1, token),
            HeartbeatToleranceSeconds = Math.Clamp(settings.Value.PollSeconds, 10, 3600) * 2 + 120,
            Workers = workers.Select(worker => new { worker.Id, worker.Enabled,
                HeartbeatUtc = worker.HeartbeatUtc.HasValue ? DateTime.SpecifyKind(worker.HeartbeatUtc.Value, DateTimeKind.Utc) : (DateTime?)null }),
            Counts = counts,
            JobsTotal = total,
            Page = page,
            PageSize = pageSize,
            Jobs = jobs.Select(job => new { job.Id, job.Worker, job.Status, job.Progress, job.SourcePath, job.OutputPath,
                job.SourceSize, job.Message, job.SeriesName, UpdatedAtUtc = DateTime.SpecifyKind(job.UpdatedAtUtc, DateTimeKind.Utc) })
        });
    }

    [HttpPut("workers/{worker}")]
    public async Task<IActionResult> SetEnabled(string worker, WorkerRequest request, CancellationToken token)
    {
        if (worker is not ("transcode" or "index")) return BadRequest();
        var state = await context.MediaWorkerStates.SingleAsync(item => item.Id == worker, token);
        state.Enabled = request.Enabled;
        await context.SaveChangesAsync(token);
        return NoContent();
    }

    [HttpPut("resources")]
    public async Task<IActionResult> Resources(ResourceRequest request, CancellationToken token)
    {
        if (request.DayCores is < 1 or > 2 || request.NightCores is < 1 or > 4 ||
            request.NightStartMinute is < 0 or > 1439 || request.NightEndMinute is < 0 or > 1439 ||
            request.NightStartMinute == request.NightEndMinute || string.IsNullOrWhiteSpace(request.TimeZoneId) || request.TimeZoneId.Length > 100)
            return BadRequest(new { message = "Selecciona 1–2 núcleos de día, 1–4 de noche y un horario válido." });
        try { TimeZoneInfo.FindSystemTimeZoneById(request.TimeZoneId); }
        catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
        { return BadRequest(new { message = "La zona horaria no es válida." }); }
        var policy = await context.MediaResourcePolicies.SingleAsync(item => item.Id == 1, token);
        policy.DayCores = request.DayCores;
        policy.NightCores = request.NightCores;
        policy.NightEnabled = request.NightEnabled;
        policy.NightStartMinute = request.NightStartMinute;
        policy.NightEndMinute = request.NightEndMinute;
        policy.TimeZoneId = request.TimeZoneId;
        await context.SaveChangesAsync(token);
        return NoContent();
    }

    [HttpPost("jobs/{id:long}/retry")]
    public async Task<IActionResult> Retry(long id, CancellationToken token)
    {
        var changed = await context.MediaProcessingJobs.Where(job => job.Id == id && job.Status == "Failed")
            .ExecuteUpdateAsync(update => update.SetProperty(job => job.Status, "Queued")
                .SetProperty(job => job.Progress, 0).SetProperty(job => job.Message, (string?)null)
                .SetProperty(job => job.UpdatedAtUtc, DateTime.UtcNow), token);
        return changed == 1 ? NoContent() : Conflict(new { message = "Solo se pueden reintentar trabajos fallidos." });
    }

    public sealed record WorkerRequest(bool Enabled);
    public sealed record ResourceRequest(int DayCores, int NightCores, bool NightEnabled, int NightStartMinute, int NightEndMinute, string TimeZoneId);
}
