namespace ApplicationCore.Entities;

public class ScheduledProgram
{
    public long Id { get; set; }
    public int ChannelEraId { get; set; }
    public ChannelEra ChannelEra { get; set; } = null!;
    public int EpisodeId { get; set; }
    public Episode Episode { get; set; } = null!;
    public int? ShuffleCycle { get; set; }
    public DateTime GeneratedAtUtc { get; set; }
}
