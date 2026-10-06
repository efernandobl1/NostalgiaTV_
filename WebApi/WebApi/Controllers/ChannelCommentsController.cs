using System.Security.Claims;
using ApplicationCore.Entities;
using Asp.Versioning;
using Infrastructure.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Controllers;

[ApiController, ApiVersion("1")]
[Route("api/v{version:apiVersion}/channels/{channelId:int}/comments")]
public class ChannelCommentsController(NostalgiaTVContext context) : ControllerBase
{
    [HttpGet, AllowAnonymous]
    public async Task<IActionResult> Get(int channelId, int page = 1)
    {
        if (page is < 1 or > 10000) return BadRequest();
        var comments = await (from comment in context.ChannelComments.AsNoTracking()
                         join user in context.Users on comment.UserId equals user.Id
                         where comment.ChannelId == channelId && comment.Status == "Approved"
                         orderby comment.CreatedAtUtc, comment.Id
                         select new { comment.Id, comment.Body, Author = user.Username, comment.CreatedAtUtc }).Skip((page - 1) * 50).Take(50).ToListAsync();
        return Ok(comments.Select(item => new { item.Id, item.Body, item.Author, CreatedAtUtc = DateTime.SpecifyKind(item.CreatedAtUtc, DateTimeKind.Utc) }));
    }

    [HttpPost, Authorize, EnableRateLimiting("CommentPolicy")]
    public async Task<IActionResult> Post(int channelId, CommentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Body) || request.Body.Length > 2000 || request.ParentCommentId != null) return BadRequest();
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        if (!await context.Channels.AnyAsync(item => item.Id == channelId)) return NotFound();
        if (!await context.Users.AnyAsync(item => item.Id == userId)) return Unauthorized();
        var comment = new ChannelComment { ChannelId = channelId, UserId = userId, Body = request.Body.Trim(), CreatedAtUtc = DateTime.UtcNow };
        context.ChannelComments.Add(comment);
        await context.SaveChangesAsync();
        return Accepted(new { comment.Id, comment.Status });
    }

    [HttpPut("{commentId:long}/moderation"), Authorize(Policy = "Admin")]
    public async Task<IActionResult> Moderate(int channelId, long commentId, ModerationRequest request)
    {
        if (request.Status is not ("Approved" or "Rejected" or "Hidden")) return BadRequest();
        var item = await context.ChannelComments.SingleOrDefaultAsync(comment => comment.Id == commentId && comment.ChannelId == channelId);
        if (item == null) return NotFound();
        item.Status = request.Status;
        await context.SaveChangesAsync();
        return NoContent();
    }
}
