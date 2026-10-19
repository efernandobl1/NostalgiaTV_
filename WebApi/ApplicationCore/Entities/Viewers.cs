namespace ApplicationCore.Entities;

/// <summary>Watch history owner: anonymous (device-only) or linked to an account.</summary>
public class ViewerProfile
{
    public Guid Id { get; set; }
    public int? UserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public User? User { get; set; }
}

public class ViewerDevice
{
    public Guid Id { get; set; }
    public Guid ProfileId { get; set; }
    public string Name { get; set; } = "";
    public string TokenHash { get; set; } = "";
    /// <summary>Account session version captured at link time; a mismatch signs the device out.</summary>
    public int? SessionVersion { get; set; }
    public DateTime LastSeenUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }

    public ViewerProfile Profile { get; set; } = null!;
}

public class ViewerPairingCode
{
    public string Hash { get; set; } = "";
    public Guid DeviceId { get; set; }
    public DateTime ExpiresAtUtc { get; set; }

    public ViewerDevice Device { get; set; } = null!;
}

/// <summary>TV sign-in request (device code flow) approved from a signed-in phone or browser.</summary>
public class DeviceAuthorization
{
    public string DeviceCodeHash { get; set; } = "";
    public string UserCodeHash { get; set; } = "";
    public Guid? ProfileId { get; set; }
    public string Name { get; set; } = "";
    public int? SessionVersion { get; set; }
    public DateTime ExpiresAtUtc { get; set; }

    public ViewerProfile? Profile { get; set; }
}

public class ViewerProgress
{
    public Guid ProfileId { get; set; }
    public int EpisodeId { get; set; }
    public decimal CurrentSecond { get; set; }
    public bool Completed { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public ViewerProfile Profile { get; set; } = null!;
    public Episode Episode { get; set; } = null!;
}

public class ViewerWatchRange
{
    public long Id { get; set; }
    public Guid ProfileId { get; set; }
    public int EpisodeId { get; set; }
    public decimal StartSecond { get; set; }
    public decimal EndSecond { get; set; }
}
