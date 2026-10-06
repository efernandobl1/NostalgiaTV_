namespace ApplicationCore.Entities;

public class SeriesComment
{
    public long Id { get; set; }
    public int SeriesId { get; set; }
    public int UserId { get; set; }
    public long? ParentCommentId { get; set; }
    public string Body { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? EditedAtUtc { get; set; }
}
