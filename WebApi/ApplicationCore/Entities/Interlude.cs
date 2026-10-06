namespace ApplicationCore.Entities;

public enum InterludeKind { Bumper, Advertisement }

public class Interlude
{
    public int Id { get; set; }
    public InterludeKind Kind { get; set; }
    public string Title { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public decimal DurationSeconds { get; set; }
    public int? OriginalYearFrom { get; set; }
    public int? OriginalYearTo { get; set; }
    public string? RegionCode { get; set; }
    public bool ApprovedForBroadcast { get; set; }
}
