namespace ApplicationCore.Entities;

public class ScheduledAdBreak
{
    public long Id { get; set; }
    public long ScheduledProgramId { get; set; }
    public ScheduledProgram ScheduledProgram { get; set; } = null!;
    public int EpisodeBreakPointId { get; set; }
    public EpisodeBreakPoint EpisodeBreakPoint { get; set; } = null!;
    public int Ordinal { get; set; }
}
