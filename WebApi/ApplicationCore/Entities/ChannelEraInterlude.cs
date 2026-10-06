namespace ApplicationCore.Entities;

public enum BreakRole { BreakOpener, Advertisement, BreakCloser }

public class ChannelEraInterlude
{
    public int ChannelEraId { get; set; }
    public int InterludeId { get; set; }
    public BreakRole Role { get; set; }
    public int Weight { get; set; }
    public int MinimumGapSeconds { get; set; }
}
