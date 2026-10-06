namespace ApplicationCore.Entities;

public class ViewerProfile
{
    public Guid Id { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class ViewerDevice
{
    public Guid Id { get; set; }
    public Guid ProfileId { get; set; }
    public string TokenHash { get; set; } = "";
    public string Name { get; set; } = "";
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime LastSeenUtc { get; set; }
}

public class ViewerPairingCode
{
    public string Hash { get; set; } = "";
    public Guid DeviceId { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
}

public class ViewerProgress
{
    public Guid ProfileId { get; set; }
    public int EpisodeId { get; set; }
    public double CurrentSecond { get; set; }
    public bool Completed { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public class ViewerWatchRange
{
    public long Id { get; set; }
    public Guid ProfileId { get; set; }
    public int EpisodeId { get; set; }
    public double StartSecond { get; set; }
    public double EndSecond { get; set; }
}
