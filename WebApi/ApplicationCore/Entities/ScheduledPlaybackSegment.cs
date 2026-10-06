namespace ApplicationCore.Entities;

public class ScheduledPlaybackSegment
{
    public long Id { get; set; }
    public long ScheduledProgramId { get; set; }
    public ScheduledProgram ScheduledProgram { get; set; } = null!;
    public long? ScheduledAdBreakId { get; set; }
    public int? InterludeId { get; set; }
    public Interlude? Interlude { get; set; }
    public int Sequence { get; set; }
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public decimal? MediaStartSecond { get; set; }
    public decimal? MediaEndSecond { get; set; }
}
