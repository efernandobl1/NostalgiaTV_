namespace ApplicationCore.Entities;

public class MediaWorkerState
{
    public string Id { get; set; } = "";
    public bool Enabled { get; set; }
    public DateTime? HeartbeatUtc { get; set; }
}

public class MediaProcessingJob
{
    public long Id { get; set; }
    public int SeriesId { get; set; }
    public string Worker { get; set; } = "";
    public string Fingerprint { get; set; } = "";
    public string SourcePath { get; set; } = "";
    public long SourceSize { get; set; }
    public DateTime SourceModifiedUtc { get; set; }
    public string? OutputPath { get; set; }
    public string Status { get; set; } = MediaJobStatus.Queued;
    public double Progress { get; set; }
    public string? Message { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public Series Series { get; set; } = null!;
}

/// <summary>Singleton (Id = 1). Times are evaluated in PlatformSettings.TimeZoneId.</summary>
public class MediaResourcePolicy
{
    public int Id { get; set; } = 1;
    public int DayCores { get; set; } = 1;
    public int NightCores { get; set; } = 3;
    public bool NightEnabled { get; set; } = true;
    public int NightStartMinute { get; set; }
    public int NightEndMinute { get; set; } = 300;
}

/// <summary>Singleton (Id = 1) with the platform-wide rules edited in Ajustes.</summary>
public class PlatformSettings
{
    public int Id { get; set; } = 1;
    public int ViewerRoleId { get; set; }
    public string TimeZoneId { get; set; } = "America/Guatemala";
    public bool PublicRegistrationEnabled { get; set; }
    public int NoRepeatWindowHours { get; set; } = 24;
    public int MaxSpecialsPerDay { get; set; } = 5;
    public int MaxSpecialsPerSeriesPerDay { get; set; } = 2;
    public int MaxMoviesPerDay { get; set; } = 2;
    public int MaxMoviesPerSeriesPerDay { get; set; } = 2;
    public bool SeasonalEffectsEnabled { get; set; } = true;
    public bool SeasonalEpisodesEnabled { get; set; } = true;
    public bool SeasonalInterludesEnabled { get; set; } = true;
    public bool SeasonalThemesEnabled { get; set; } = true;

    public Role ViewerRole { get; set; } = null!;
}
