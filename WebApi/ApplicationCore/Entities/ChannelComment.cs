namespace ApplicationCore.Entities;

public class ChannelComment
{
    public long Id { get; set; }
    public int ChannelId { get; set; }
    public int UserId { get; set; }
    public string Body { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAtUtc { get; set; }
}
