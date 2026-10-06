using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Asp.Versioning;
using FFMpegCore;
using Infrastructure.BackgroundServices;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace WebApi.Controllers;

[ApiController]
[Authorize(Policy = "Admin")]
[ApiVersion("1")]
[Route("api/v{version:apiVersion}/retro")]
public class RetroBroadcastController : ControllerBase
{
    private readonly NostalgiaTVContext _context;
    private readonly ChannelBroadcastService _broadcast;
    private readonly ChannelScheduleService _schedule;
    private readonly MediaSettings _media;

    public RetroBroadcastController(
        NostalgiaTVContext context,
        ChannelBroadcastService broadcast,
        ChannelScheduleService schedule,
        IOptions<MediaSettings> media)
    {
        _context = context;
        _broadcast = broadcast;
        _schedule = schedule;
        _media = media.Value;
    }

    [HttpGet("episodes/{episodeId}/break-points")]
    public async Task<IActionResult> GetBreakPoints(int episodeId) =>
        Ok(await _context.EpisodeBreakPoints.AsNoTracking()
            .Where(point => point.EpisodeId == episodeId)
            .OrderBy(point => point.OffsetSeconds).ToListAsync());

    [HttpPost("episodes/{episodeId}/break-points")]
    public async Task<IActionResult> AddBreakPoint(int episodeId, BreakPointRequest request)
    {
        if (request.OffsetSeconds is <= 0 or > 86400 || request.Label?.Length > 200)
            return BadRequest("Invalid break point offset or label.");
        if (!await _context.Episodes.AnyAsync(episode => episode.Id == episodeId)) return NotFound();
        if (await _context.EpisodeBreakPoints.AnyAsync(point =>
            point.EpisodeId == episodeId && point.OffsetSeconds == request.OffsetSeconds))
            return Conflict("This break point already exists.");

        var point = new EpisodeBreakPoint
        {
            EpisodeId = episodeId,
            OffsetSeconds = request.OffsetSeconds,
            Label = request.Label?.Trim()
        };
        _context.EpisodeBreakPoints.Add(point);
        await _context.SaveChangesAsync();
        return Ok(point);
    }

    [HttpDelete("episodes/{episodeId}/break-points/{pointId}")]
    public async Task<IActionResult> DeleteBreakPoint(int episodeId, int pointId)
    {
        var point = await _context.EpisodeBreakPoints.FindAsync(pointId);
        if (point == null || point.EpisodeId != episodeId) return NotFound();
        var channelIds = await _schedule.DeleteBreakPointAsync(point);
        foreach (var channelId in channelIds)
            await _broadcast.ReloadChannelAsync(channelId);
        return NoContent();
    }

    [HttpGet("eras/{eraId}/break-rules")]
    public async Task<IActionResult> GetBreakRules(int eraId)
    {
        var rule = await _context.ChannelEraBreakRules.AsNoTracking()
            .FirstOrDefaultAsync(item => item.ChannelEraId == eraId);
        return rule == null ? NotFound() : Ok(rule);
    }

    [HttpDelete("eras/{eraId}/break-rules")]
    public async Task<IActionResult> DeleteBreakRules(int eraId)
    {
        var era = await _context.ChannelEras.FindAsync(eraId);
        if (era == null) return NotFound();
        await _context.ChannelEraBreakRules.Where(item => item.ChannelEraId == eraId).ExecuteDeleteAsync();
        await _broadcast.ReloadChannelAsync(era.ChannelId);
        return NoContent();
    }

    [HttpPut("eras/{eraId}/break-rules")]
    public async Task<IActionResult> SetBreakRules(int eraId, BreakRulesRequest request)
    {
        if (request.MinimumAds < 1 || request.MaximumAds < request.MinimumAds
            || request.MaximumAds > 12 || request.MaximumBreakSeconds is < 1 or > 1800)
            return BadRequest("Invalid commercial break limits.");

        var era = await _context.ChannelEras.FindAsync(eraId);
        if (era == null) return NotFound();
        var rule = await _context.ChannelEraBreakRules.FindAsync(eraId);
        if (rule == null)
        {
            rule = new ChannelEraBreakRule { ChannelEraId = eraId };
            _context.ChannelEraBreakRules.Add(rule);
        }
        rule.MinimumAds = request.MinimumAds;
        rule.MaximumAds = request.MaximumAds;
        rule.MaximumBreakSeconds = request.MaximumBreakSeconds;
        await _context.SaveChangesAsync();
        await _broadcast.ReloadChannelAsync(era.ChannelId);
        return Ok(rule);
    }

    [HttpGet("interludes")]
    public async Task<IActionResult> GetInterludes() =>
        Ok(await _context.Interludes.AsNoTracking().OrderBy(item => item.Title).ToListAsync());

    [HttpPost("interludes")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(524_288_000)]
    public async Task<IActionResult> UploadInterlude([FromForm] InterludeUploadRequest request, CancellationToken ct)
    {
        if (request.File == null || request.File.Length is <= 0 or > 524_288_000
            || !Path.GetExtension(request.File.FileName).Equals(".mp4", StringComparison.OrdinalIgnoreCase))
            return BadRequest("A compatible MP4 file under 500 MiB is required.");
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 300)
            return BadRequest("A title of at most 300 characters is required.");
        if (!Enum.IsDefined(request.Kind) || request.RegionCode?.Length > 20)
            return BadRequest("Invalid clip metadata.");
        if (request.OriginalYearTo < request.OriginalYearFrom)
            return BadRequest("The historical year range is invalid.");

        var name = $"{Guid.NewGuid():N}.mp4";
        var directory = Path.Combine(_media.BasePath, "interludes");
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, name);
        try
        {
            await using (var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write,
                FileShare.None, 81920, FileOptions.Asynchronous))
                await request.File.CopyToAsync(stream, ct);

            var info = await FFProbe.AnalyseAsync(path);
            if (info.Duration.TotalSeconds <= 0 || info.VideoStreams.Count == 0)
            {
                System.IO.File.Delete(path);
                return BadRequest("The uploaded file has no playable video.");
            }
            if (!string.Equals(info.VideoStreams[0].CodecName, "h264", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(info.VideoStreams[0].PixelFormat, "yuv420p", StringComparison.OrdinalIgnoreCase)
                || info.AudioStreams.Any(stream =>
                    !string.Equals(stream.CodecName, "aac", StringComparison.OrdinalIgnoreCase)))
            {
                System.IO.File.Delete(path);
                return BadRequest("The clip must use H.264/yuv420p video and AAC audio.");
            }

            var interlude = new Interlude
            {
                Kind = request.Kind,
                Title = request.Title.Trim(),
                FilePath = $"/uploads/interludes/{name}",
                DurationSeconds = decimal.Round((decimal)info.Duration.TotalSeconds, 3),
                OriginalYearFrom = request.OriginalYearFrom,
                OriginalYearTo = request.OriginalYearTo,
                RegionCode = request.RegionCode?.Trim(),
                ApprovedForBroadcast = false
            };
            _context.Interludes.Add(interlude);
            await _context.SaveChangesAsync(ct);
            return Ok(interlude);
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
            throw;
        }
    }

    [HttpPost("eras/{eraId}/import-bumpers")]
    public async Task<IActionResult> ImportBumpers(int eraId, CancellationToken ct)
    {
        var era = await _context.ChannelEras.AsNoTracking().FirstOrDefaultAsync(item => item.Id == eraId, ct);
        if (era == null) return NotFound();
        if (string.IsNullOrWhiteSpace(era.FolderPath)) return BadRequest("This era has no media folder.");
        var mediaRoot = Path.GetFullPath(_media.BasePath).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var folder = Path.GetFullPath(Path.Combine(era.FolderPath, "bumpers"));
        if (!folder.StartsWith(mediaRoot, StringComparison.Ordinal)) return BadRequest("Invalid era media folder.");
        if (!Directory.Exists(folder)) return Ok(new { Imported = 0, Skipped = Array.Empty<string>() });
        if ((System.IO.File.GetAttributes(folder) & FileAttributes.ReparsePoint) != 0)
            return BadRequest("Symbolic media folders are not supported.");
        var imported = 0;
        var inspected = 0;
        var skipped = new List<string>();
        foreach (var path in Directory.EnumerateFiles(folder, "*.mp4"))
        {
            ct.ThrowIfCancellationRequested();
            if ((System.IO.File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) { skipped.Add(Path.GetFileName(path)); continue; }
            var relative = "/uploads/" + Path.GetRelativePath(_media.BasePath, path).Replace('\\', '/');
            if (await _context.Interludes.AnyAsync(clip => clip.FilePath == relative, ct)) continue;
            if (++inspected > 100) break;
            IMediaAnalysis info;
            try
            {
                info = await FFProbe.AnalyseAsync(path);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            { skipped.Add(Path.GetFileName(path)); continue; }
            if (info.Duration.TotalSeconds <= 0 || info.VideoStreams.Count == 0
                || info.VideoStreams[0].CodecName != "h264" || info.VideoStreams[0].PixelFormat != "yuv420p"
                || info.AudioStreams.Any(stream => stream.CodecName != "aac"))
            { skipped.Add(Path.GetFileName(path)); continue; }
            _context.Interludes.Add(new Interlude { Title = Path.GetFileNameWithoutExtension(path), FilePath = relative,
                Kind = InterludeKind.Bumper, DurationSeconds = decimal.Round((decimal)info.Duration.TotalSeconds, 3), ApprovedForBroadcast = false });
            await _context.SaveChangesAsync(ct);
            imported++;
        }
        return Ok(new { Imported = imported, Skipped = skipped });
    }

    [HttpPut("interludes/{id}/approval")]
    public async Task<IActionResult> SetApproval(int id, ApprovalRequest request)
    {
        var clip = await _context.Interludes.FindAsync(id);
        if (clip == null) return NotFound();
        clip.ApprovedForBroadcast = request.Approved;
        await _context.SaveChangesAsync();
        var channelIds = await (
            from assignment in _context.ChannelEraInterludes.AsNoTracking()
            join era in _context.ChannelEras.AsNoTracking() on assignment.ChannelEraId equals era.Id
            where assignment.InterludeId == id
            select era.ChannelId).Distinct().ToListAsync();
        foreach (var channelId in channelIds)
            await _broadcast.ReloadChannelAsync(channelId);
        return NoContent();
    }

    [HttpPut("interludes/{id}")]
    public async Task<IActionResult> UpdateInterlude(int id, InterludeDetailsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 300
            || request.RegionCode?.Length > 20 || request.OriginalYearTo < request.OriginalYearFrom)
            return BadRequest("Invalid clip metadata.");
        var clip = await _context.Interludes.FindAsync(id);
        if (clip == null) return NotFound();
        clip.Title = request.Title.Trim();
        clip.OriginalYearFrom = request.OriginalYearFrom;
        clip.OriginalYearTo = request.OriginalYearTo;
        clip.RegionCode = request.RegionCode?.Trim();
        await _context.SaveChangesAsync();
        return Ok(clip);
    }

    [HttpDelete("interludes/{id}")]
    public async Task<IActionResult> DeleteInterlude(int id)
    {
        var clip = await _context.Interludes.FindAsync(id);
        if (clip == null) return NotFound();
        if (await _context.ChannelEraInterludes.AnyAsync(item => item.InterludeId == id)
            || await _context.ScheduledPlaybackSegments.AnyAsync(item => item.InterludeId == id))
            return Conflict("Remove this clip from its eras and wait for its schedule history to expire before deleting it.");
        _context.Interludes.Remove(clip);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("eras/{eraId}/interludes")]
    public async Task<IActionResult> GetEraInterludes(int eraId) =>
        Ok(await _context.ChannelEraInterludes.AsNoTracking()
            .Where(item => item.ChannelEraId == eraId).ToListAsync());

    [HttpPut("eras/{eraId}/interludes/{interludeId}/{role}")]
    public async Task<IActionResult> AssignInterlude(int eraId, int interludeId, BreakRole role, ClipAssignmentRequest request)
    {
        if (!Enum.IsDefined(role)) return BadRequest("Invalid break role.");
        if (request.Weight is < 1 or > 100 || request.MinimumGapSeconds is < 0 or > 604800)
            return BadRequest("Invalid clip scheduling limits.");
        var era = await _context.ChannelEras.FindAsync(eraId);
        var clip = await _context.Interludes.FindAsync(interludeId);
        if (era == null || clip == null) return NotFound();
        if (clip.Kind != (role == BreakRole.Advertisement ? InterludeKind.Advertisement : InterludeKind.Bumper))
            return BadRequest("The clip kind does not match its role.");

        var assignment = await _context.ChannelEraInterludes.FindAsync(eraId, interludeId, role);
        if (assignment == null)
        {
            assignment = new ChannelEraInterlude
            {
                ChannelEraId = eraId,
                InterludeId = interludeId,
                Role = role
            };
            _context.ChannelEraInterludes.Add(assignment);
        }
        assignment.Weight = request.Weight;
        assignment.MinimumGapSeconds = request.MinimumGapSeconds;
        await _context.SaveChangesAsync();
        await _broadcast.ReloadChannelAsync(era.ChannelId);
        return Ok(assignment);
    }

    [HttpDelete("eras/{eraId}/interludes/{interludeId}/{role}")]
    public async Task<IActionResult> RemoveInterlude(int eraId, int interludeId, BreakRole role)
    {
        var era = await _context.ChannelEras.FindAsync(eraId);
        if (era == null) return NotFound();
        var removed = await _context.ChannelEraInterludes.Where(item =>
            item.ChannelEraId == eraId && item.InterludeId == interludeId && item.Role == role)
            .ExecuteDeleteAsync();
        if (removed == 0) return NotFound();
        await _broadcast.ReloadChannelAsync(era.ChannelId);
        return NoContent();
    }
}

public sealed record BreakPointRequest(decimal OffsetSeconds, string? Label);
public sealed record BreakRulesRequest(int MinimumAds, int MaximumAds, int MaximumBreakSeconds);
public sealed record ApprovalRequest(bool Approved);
public sealed record InterludeDetailsRequest(string Title, int? OriginalYearFrom, int? OriginalYearTo, string? RegionCode);
public sealed record ClipAssignmentRequest(int Weight, int MinimumGapSeconds);
public sealed class InterludeUploadRequest
{
    public string Title { get; set; } = string.Empty;
    public InterludeKind Kind { get; set; }
    public IFormFile? File { get; set; }
    public int? OriginalYearFrom { get; set; }
    public int? OriginalYearTo { get; set; }
    public string? RegionCode { get; set; }
}
