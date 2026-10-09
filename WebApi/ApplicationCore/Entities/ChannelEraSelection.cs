namespace ApplicationCore.Entities;

public class ChannelEraSelection
{
    public int ChannelId { get; set; }
    public int ChannelEraId { get; set; }
    public DateTime SelectedAtUtc { get; set; }
}
