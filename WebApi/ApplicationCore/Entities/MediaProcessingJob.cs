namespace ApplicationCore.Entities;

public class MediaProcessingJob
{
    public long Id { get; set; }
    public int SeriesId { get; set; }
    public string Worker { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    public string SourcePath { get; set; } = "";
    public string? OutputPath { get; set; }
    public long SourceSize { get; set; }
    public DateTime SourceModifiedUtc { get; set; }
    public string Status { get; set; } = "Queued";
    public double Progress { get; set; }
    public string? Message { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
