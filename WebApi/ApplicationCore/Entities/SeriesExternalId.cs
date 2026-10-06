namespace ApplicationCore.Entities;

public class SeriesExternalId
{
    public int Id { get; set; }
    public int SeriesId { get; set; }
    public int ProviderId { get; set; }
    public string ExternalId { get; set; } = string.Empty;
}
