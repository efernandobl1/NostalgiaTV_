namespace ApplicationCore.Entities;

public class ChannelEraBreakRule
{
    public int ChannelEraId { get; set; }
    public int MinimumAds { get; set; }
    public int MaximumAds { get; set; }
    public int MaximumBreakSeconds { get; set; }
}
