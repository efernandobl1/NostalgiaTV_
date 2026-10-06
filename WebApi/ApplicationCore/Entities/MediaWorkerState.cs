namespace ApplicationCore.Entities;

public class MediaWorkerState
{
    public string Id { get; set; } = "";
    public bool Enabled { get; set; }
    public DateTime? HeartbeatUtc { get; set; }
}
