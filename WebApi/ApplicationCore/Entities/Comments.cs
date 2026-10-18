namespace ApplicationCore.Entities;

/// <summary>Shared comment row; exactly one of ChannelComment or SeriesComment points at it.</summary>
public class Comment : ISoftDeletable
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public string Body { get; set; } = "";
    public string Status { get; set; } = CommentStatus.Pending;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? EditedAtUtc { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public User User { get; set; } = null!;
    public ChannelComment? Channel { get; set; }
    public SeriesComment? Series { get; set; }
}

public class ChannelComment
{
    public long CommentId { get; set; }
    public int ChannelId { get; set; }

    public Comment Comment { get; set; } = null!;
    public Channel Channel { get; set; } = null!;
}

public class SeriesComment
{
    public long CommentId { get; set; }
    public int SeriesId { get; set; }
    public long? ParentCommentId { get; set; }

    public Comment Comment { get; set; } = null!;
    public Series Series { get; set; } = null!;
}
