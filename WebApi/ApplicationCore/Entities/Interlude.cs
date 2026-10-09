namespace ApplicationCore.Entities;

public enum InterludeKind { Bumper, Advertisement }
public enum InterludeSeason { AllYear, Halloween, Christmas }

public class Interlude
{
    public int Id { get; set; }
    public InterludeKind Kind { get; set; }
    public InterludeSeason Season { get; set; }
    public string Title { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public decimal DurationSeconds { get; set; }
    public int? OriginalYearFrom { get; set; }
    public int? OriginalYearTo { get; set; }
    public string? RegionCode { get; set; }
    public bool ApprovedForBroadcast { get; set; }
    public string? SourceUrl { get; set; }
    public string? License { get; set; }
    public bool RedistributionAllowed { get; set; }
}
