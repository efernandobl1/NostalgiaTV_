namespace ApplicationCore.Entities;

public class MetadataImportRun
{
    public long Id { get; set; }
    public int SeriesExternalId { get; set; }
    public string? LanguageCode { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime StartedAtUtc { get; set; }
    public DateTime? FinishedAtUtc { get; set; }
}
