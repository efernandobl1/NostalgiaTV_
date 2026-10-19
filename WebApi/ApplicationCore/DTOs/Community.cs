using System.ComponentModel.DataAnnotations;

namespace ApplicationCore.DTOs;

public sealed record CommentRequest([Required, StringLength(2000, MinimumLength = 1)] string Body, long? ParentCommentId = null);

public sealed record CommentEditRequest([Required, StringLength(2000, MinimumLength = 1)] string Body);

public sealed record PublicComment(long Id, long? ParentCommentId, string Author, string Body, DateTime CreatedAtUtc, DateTime? EditedAtUtc);

public sealed record CommentPosted(long Id, string Status);

/// <summary>A comment written by the signed-in viewer (profile → "Mis comentarios").</summary>
public sealed record MyComment(long Id, string TargetType, int TargetId, string TargetName, string Body, string Status,
    DateTime CreatedAtUtc, DateTime? EditedAtUtc);

public sealed record ModerationItem(long Id, string TargetType, int TargetId, string TargetName, long? ParentCommentId,
    int UserId, string Author, string Body, string Status, DateTime CreatedAtUtc);

public sealed record ModerationPage(IReadOnlyList<ModerationItem> Items, int TotalCount, int Page, int PageSize,
    IReadOnlyDictionary<string, int> Counts);

public sealed record ModerationRequest([Required] string Status);

public sealed record BulkModerationRequest([Required, MinLength(1), MaxLength(200)] IReadOnlyList<long> CommentIds, [Required] string Status);
