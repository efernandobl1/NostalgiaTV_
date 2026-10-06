namespace ApplicationCore.Entities;

public class EpisodeBreakPoint
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public decimal OffsetSeconds { get; set; }
    public string? Label { get; set; }
}
