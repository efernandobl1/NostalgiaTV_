using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

/// <summary>
/// Comments on channels and series. Every new or edited comment waits for moderation; only
/// approved ones are public, and replies are only allowed to approved comments of the same series.
/// </summary>
public sealed class CommentRepository(NostalgiaTVContext context) : ICommentRepository
{
    private const int PublicPageSize = 50;
    private const string ChannelTarget = "channel";
    private const string SeriesTarget = "series";

    public async Task<PagedResult<PublicComment>> ChannelCommentsAsync(int channelId, int page)
    {
        if (!await context.Channels.AnyAsync(channel => channel.Id == channelId)) throw new NotFoundException("Canal no encontrado.");
        var query = context.ChannelComments.AsNoTracking()
            .Where(link => link.ChannelId == channelId && link.Comment.Status == CommentStatus.Approved && link.Comment.DeletedAtUtc == null)
            .Select(link => link.Comment);
        var (total, current) = (await query.CountAsync(), Page(page));
        var items = await query.OrderBy(comment => comment.CreatedAtUtc).ThenBy(comment => comment.Id)
            .Skip((current - 1) * PublicPageSize).Take(PublicPageSize)
            .Select(comment => new PublicComment(comment.Id, null, comment.User.Username, comment.Body, comment.CreatedAtUtc, comment.EditedAtUtc))
            .ToListAsync();
        return new PagedResult<PublicComment>(items, total, current, PublicPageSize);
    }

    public async Task<PagedResult<PublicComment>> SeriesCommentsAsync(int seriesId, int page)
    {
        if (!await context.Series.AnyAsync(series => series.Id == seriesId)) throw new NotFoundException("Serie no encontrada.");
        var query = context.SeriesComments.AsNoTracking()
            .Where(link => link.SeriesId == seriesId && link.Comment.Status == CommentStatus.Approved && link.Comment.DeletedAtUtc == null);
        var (total, current) = (await query.CountAsync(), Page(page));
        var items = await query.OrderBy(link => link.Comment.CreatedAtUtc).ThenBy(link => link.CommentId)
            .Skip((current - 1) * PublicPageSize).Take(PublicPageSize)
            .Select(link => new PublicComment(link.CommentId, link.ParentCommentId, link.Comment.User.Username, link.Comment.Body,
                link.Comment.CreatedAtUtc, link.Comment.EditedAtUtc))
            .ToListAsync();
        return new PagedResult<PublicComment>(items, total, current, PublicPageSize);
    }

    public async Task<CommentPosted> PostChannelCommentAsync(int channelId, int userId, CommentRequest request)
    {
        if (request.ParentCommentId != null) throw new BadRequestException("Los comentarios de canal no admiten respuestas.");
        if (!await context.Channels.AnyAsync(channel => channel.Id == channelId)) throw new NotFoundException("Canal no encontrado.");
        var comment = NewComment(userId, request.Body);
        comment.Channel = new ChannelComment { ChannelId = channelId };
        context.Comments.Add(comment);
        await context.SaveChangesAsync();
        return new CommentPosted(comment.Id, comment.Status);
    }

    public async Task<CommentPosted> PostSeriesCommentAsync(int seriesId, int userId, CommentRequest request)
    {
        if (!await context.Series.AnyAsync(series => series.Id == seriesId)) throw new NotFoundException("Serie no encontrada.");
        if (request.ParentCommentId is long parentId && !await context.SeriesComments.AnyAsync(link => link.CommentId == parentId
                && link.SeriesId == seriesId && link.Comment.Status == CommentStatus.Approved && link.Comment.DeletedAtUtc == null))
            throw new BadRequestException("Solo puedes responder a comentarios aprobados de esta serie.");
        var comment = NewComment(userId, request.Body);
        comment.Series = new SeriesComment { SeriesId = seriesId, ParentCommentId = request.ParentCommentId };
        context.Comments.Add(comment);
        await context.SaveChangesAsync();
        return new CommentPosted(comment.Id, comment.Status);
    }

    public async Task<IReadOnlyList<MyComment>> MyCommentsAsync(int userId) =>
        await Mine(context.Comments.AsNoTracking().Where(comment => comment.UserId == userId)
            .OrderByDescending(comment => comment.CreatedAtUtc).ThenByDescending(comment => comment.Id).Take(200)).ToListAsync();

    /// <summary>An edited comment goes back to the moderation queue.</summary>
    public async Task<MyComment> EditMyCommentAsync(int userId, long commentId, CommentEditRequest request)
    {
        var comment = await context.Comments.SingleOrDefaultAsync(item => item.Id == commentId && item.UserId == userId)
            ?? throw new NotFoundException("Comentario no encontrado.");
        if (comment.Status == CommentStatus.Hidden) throw new ForbiddenException("Este comentario fue ocultado por moderación.");
        var body = request.Body.Trim();
        if (body.Length == 0) throw new BadRequestException("El comentario no puede estar vacío.");
        if (body != comment.Body)
        {
            comment.Body = body;
            comment.Status = CommentStatus.Pending;
            comment.EditedAtUtc = DateTime.UtcNow;
            await context.SaveChangesAsync();
        }
        return (await Mine(context.Comments.AsNoTracking().Where(item => item.Id == commentId)).ToListAsync()).Single();
    }

    public async Task DeleteMyCommentAsync(int userId, long commentId)
    {
        var comment = await context.Comments.SingleOrDefaultAsync(item => item.Id == commentId && item.UserId == userId)
            ?? throw new NotFoundException("Comentario no encontrado.");
        comment.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    public async Task<ModerationPage> ModerationQueueAsync(string status, string? search, int page, int pageSize)
    {
        if (!CommentStatus.All.Contains(status)) throw new BadRequestException("Estado de moderación no válido.");
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = context.Comments.AsNoTracking().Where(comment => comment.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var text = search.Trim();
            query = query.Where(comment => comment.Body.Contains(text) || comment.User.Username.Contains(text));
        }
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(comment => comment.CreatedAtUtc).ThenByDescending(comment => comment.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(comment => new ModerationItem(comment.Id,
                comment.Channel != null ? ChannelTarget : SeriesTarget,
                comment.Channel != null ? comment.Channel.ChannelId : comment.Series!.SeriesId,
                comment.Channel != null ? comment.Channel.Channel.Name : comment.Series!.Series.Name,
                comment.Series != null ? comment.Series.ParentCommentId : null,
                comment.UserId, comment.User.Username, comment.Body, comment.Status, comment.CreatedAtUtc))
            .ToListAsync();
        var counts = await context.Comments.AsNoTracking().GroupBy(comment => comment.Status)
            .Select(group => new { group.Key, Count = group.Count() }).ToDictionaryAsync(item => item.Key, item => item.Count);
        foreach (var value in CommentStatus.All) counts.TryAdd(value, 0);
        return new ModerationPage(items, total, page, pageSize, counts);
    }

    public async Task ModerateAsync(IReadOnlyList<long> commentIds, string status)
    {
        if (!CommentStatus.All.Contains(status)) throw new BadRequestException("Estado de moderación no válido.");
        var ids = commentIds.Distinct().ToList();
        if (ids.Count == 0) return;
        var updated = await context.Comments.Where(comment => ids.Contains(comment.Id))
            .ExecuteUpdateAsync(update => update.SetProperty(comment => comment.Status, status));
        if (updated == 0) throw new NotFoundException("Comentario no encontrado.");
    }

    private static Comment NewComment(int userId, string body)
    {
        var text = body.Trim();
        if (text.Length == 0) throw new BadRequestException("El comentario no puede estar vacío.");
        return new Comment { UserId = userId, Body = text, Status = CommentStatus.Pending, CreatedAtUtc = DateTime.UtcNow };
    }

    private static IQueryable<MyComment> Mine(IQueryable<Comment> comments) => comments.Select(comment => new MyComment(comment.Id,
        comment.Channel != null ? ChannelTarget : SeriesTarget,
        comment.Channel != null ? comment.Channel.ChannelId : comment.Series!.SeriesId,
        comment.Channel != null ? comment.Channel.Channel.Name : comment.Series!.Series.Name,
        comment.Body, comment.Status, comment.CreatedAtUtc, comment.EditedAtUtc));

    private static int Page(int page) => Math.Clamp(page, 1, 10000);
}
