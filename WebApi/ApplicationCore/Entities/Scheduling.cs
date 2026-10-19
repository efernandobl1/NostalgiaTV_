namespace ApplicationCore.Entities;

public class ScheduledProgram
{
    public long Id { get; set; }
    public int ChannelEraId { get; set; }
    public int EpisodeId { get; set; }
    public int? ShuffleCycle { get; set; }
    public DateTime GeneratedAtUtc { get; set; }

    public ChannelEra ChannelEra { get; set; } = null!;
    public Episode Episode { get; set; } = null!;
    public ICollection<ScheduledAdBreak> AdBreaks { get; set; } = [];
    public ICollection<ScheduledPlaybackSegment> Segments { get; set; } = [];
}

public class ScheduledAdBreak
{
    public long Id { get; set; }
    public long ScheduledProgramId { get; set; }
    public int EpisodeBreakPointId { get; set; }

    public ScheduledProgram ScheduledProgram { get; set; } = null!;
    public EpisodeBreakPoint EpisodeBreakPoint { get; set; } = null!;
}

/// <summary>One continuous piece of airtime: a slice of the episode or one interlude.</summary>
public class ScheduledPlaybackSegment
{
    public long Id { get; set; }
    public long ScheduledProgramId { get; set; }
    public long? ScheduledAdBreakId { get; set; }
    public int? InterludeId { get; set; }
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public decimal? MediaStartSecond { get; set; }
    public decimal? MediaEndSecond { get; set; }

    public ScheduledProgram ScheduledProgram { get; set; } = null!;
    public Interlude? Interlude { get; set; }
}
