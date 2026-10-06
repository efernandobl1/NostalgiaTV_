using ApplicationCore.Entities;
using Asp.Versioning;
using Infrastructure.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace WebApi.Controllers;

[ApiController]
[ApiVersion("1")]
[Route("api/v{version:apiVersion}/series/{seriesId}/comments")]
public class SeriesCommentsController : ControllerBase
{
    private readonly NostalgiaTVContext _context;

    public SeriesCommentsController(NostalgiaTVContext context) => _context = context;

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetApproved(int seriesId, int page = 1)
    {
        if (page < 1 || page > 10000) return BadRequest("Invalid page.");
        var comments = await (
            from comment in _context.SeriesComments.AsNoTracking()
            join author in _context.Users.AsNoTracking() on comment.UserId equals author.Id
            where comment.SeriesId == seriesId && comment.Status == "Approved"
            orderby comment.CreatedAtUtc, comment.Id
            select new
            {
                comment.Id,
                comment.ParentCommentId,
                Author = author.Username,
                comment.Body,
                comment.CreatedAtUtc,
                comment.EditedAtUtc
            }).Skip((page - 1) * 50).Take(50).ToListAsync();
        return Ok(comments.Select(item => new { item.Id, item.ParentCommentId, item.Author, item.Body,
            CreatedAtUtc = DateTime.SpecifyKind(item.CreatedAtUtc, DateTimeKind.Utc),
            EditedAtUtc = item.EditedAtUtc.HasValue ? DateTime.SpecifyKind(item.EditedAtUtc.Value, DateTimeKind.Utc) : (DateTime?)null }));
    }

    [HttpPost]
    [Authorize]
    [EnableRateLimiting("CommentPolicy")]
    public async Task<IActionResult> Post(int seriesId, CommentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Body) || request.Body.Length > 2000)
            return BadRequest("Comment length must be between 1 and 2000 characters.");
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized();
        if (!await _context.Series.AnyAsync(series => series.Id == seriesId)) return NotFound();
        if (!await _context.Users.AnyAsync(user => user.Id == userId)) return Unauthorized();
        if (request.ParentCommentId is long parentId
            && !await _context.SeriesComments.AnyAsync(comment =>
                comment.Id == parentId && comment.SeriesId == seriesId && comment.Status == "Approved"))
            return BadRequest("The parent comment must be approved and belong to this series.");

        var comment = new SeriesComment
        {
            SeriesId = seriesId,
            UserId = userId,
            ParentCommentId = request.ParentCommentId,
            Body = request.Body.Trim(),
            Status = "Pending",
            CreatedAtUtc = DateTime.UtcNow
        };
        _context.SeriesComments.Add(comment);
        await _context.SaveChangesAsync();
        return Accepted(new { comment.Id, comment.Status });
    }

    [HttpGet("pending")]
    [Authorize(Policy = "Admin")]
    public async Task<IActionResult> GetPending(int seriesId) =>
        Ok(await _context.SeriesComments.AsNoTracking()
            .Where(comment => comment.SeriesId == seriesId && comment.Status == "Pending")
            .OrderBy(comment => comment.CreatedAtUtc).Take(100).ToListAsync());

    [HttpGet("~/api/v{version:apiVersion}/moderation/comments")]
    [Authorize(Policy = "Admin")]
    public async Task<IActionResult> GetModerationQueue(string status = "Pending", int? seriesId = null, int page = 1)
    {
        if (status is not ("Pending" or "Approved" or "Rejected" or "Hidden") || page is < 1 or > 10000)
            return BadRequest("Invalid moderation filter.");
        var seriesQuery = from comment in _context.SeriesComments.AsNoTracking()
                    join author in _context.Users.AsNoTracking() on comment.UserId equals author.Id
                    join series in _context.Series.AsNoTracking() on comment.SeriesId equals series.Id
                    where comment.Status == status && (seriesId == null || comment.SeriesId == seriesId)
                    select new { comment.Id, SeriesId = (int?)comment.SeriesId, ChannelId = (int?)null, SeriesName = series.Name,
                        ChannelName = (string?)null, Author = author.Username, comment.ParentCommentId, comment.Body, comment.Status, comment.CreatedAtUtc };
        var channelsQuery = from comment in _context.ChannelComments.AsNoTracking()
                            join author in _context.Users on comment.UserId equals author.Id
                            join channel in _context.Channels on comment.ChannelId equals channel.Id
                            where comment.Status == status && seriesId == null
                            select new { comment.Id, SeriesId = (int?)null, ChannelId = (int?)comment.ChannelId, SeriesName = (string?)null,
                                ChannelName = channel.Name, Author = author.Username, ParentCommentId = (long?)null, comment.Body, comment.Status, comment.CreatedAtUtc };
        var query = seriesQuery.Concat(channelsQuery);
        var count = await query.CountAsync();
        var items = await query.OrderByDescending(comment => comment.CreatedAtUtc).ThenByDescending(comment => comment.Id)
            .Skip((page - 1) * 25).Take(25).ToListAsync();
        return Ok(new { Items = items.Select(item => new { item.Id, item.SeriesId, item.ChannelId, item.SeriesName, item.ChannelName,
            item.Author, item.ParentCommentId, item.Body, item.Status, CreatedAtUtc = DateTime.SpecifyKind(item.CreatedAtUtc, DateTimeKind.Utc) }), TotalCount = count });
    }

    [HttpPut("{commentId}/moderation")]
    [Authorize(Policy = "Admin")]
    public async Task<IActionResult> Moderate(int seriesId, long commentId, ModerationRequest request)
    {
        if (request.Status is not ("Approved" or "Rejected" or "Hidden"))
            return BadRequest("Invalid moderation status.");
        var comment = await _context.SeriesComments.FirstOrDefaultAsync(item =>
            item.Id == commentId && item.SeriesId == seriesId);
        if (comment == null) return NotFound();
        comment.Status = request.Status;
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

public sealed record CommentRequest(string Body, long? ParentCommentId);
public sealed record ModerationRequest(string Status);
