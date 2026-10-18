namespace ApplicationCore.Entities;

public class Category : ISoftDeletable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime? DeletedAtUtc { get; set; }
}

public class Series : ISoftDeletable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? History { get; set; }
    public string? LogoPath { get; set; }
    public string? FolderPath { get; set; }
    public float? Rating { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public ICollection<SeriesSeason> Seasons { get; set; } = [];
    public ICollection<SeriesCategory> Categories { get; set; } = [];
}

/// <summary>Real season entity; season 0 holds specials and movies.</summary>
public class SeriesSeason : ISoftDeletable
{
    public int SeriesId { get; set; }
    public int SeasonNumber { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public Series Series { get; set; } = null!;
    public ICollection<Episode> Episodes { get; set; } = [];
}

public class SeriesCategory
{
    public int SeriesId { get; set; }
    public int CategoryId { get; set; }

    public Series Series { get; set; } = null!;
    public Category Category { get; set; } = null!;
}

public class EpisodeType : ISoftDeletable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime? DeletedAtUtc { get; set; }
}

public class Episode : ISoftDeletable
{
    public int Id { get; set; }
    public int SeriesId { get; set; }
    public int SeasonNumber { get; set; }
    public int EpisodeTypeId { get; set; }
    public int EpisodeNumber { get; set; }
    public string Title { get; set; } = "";
    public string? FilePath { get; set; }
    public bool IsAvailable { get; set; } = true;
    public DateTime? DeletedAtUtc { get; set; }

    /// <summary>Episodes reference their series through the season (composite FK).</summary>
    public SeriesSeason Season { get; set; } = null!;
    public EpisodeType EpisodeType { get; set; } = null!;
    public ICollection<EpisodeBreakPoint> BreakPoints { get; set; } = [];
}

public class EpisodeBreakPoint : ISoftDeletable
{
    public int Id { get; set; }
    public int EpisodeId { get; set; }
    public decimal OffsetSeconds { get; set; }
    public string? Label { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public Episode Episode { get; set; } = null!;
}

public class MetadataProvider : ISoftDeletable
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public DateTime? DeletedAtUtc { get; set; }
}

public class SeriesExternalId : ISoftDeletable
{
    public int Id { get; set; }
    public int SeriesId { get; set; }
    public int ProviderId { get; set; }
    public string ExternalId { get; set; } = "";
    public DateTime? DeletedAtUtc { get; set; }

    public Series Series { get; set; } = null!;
    public MetadataProvider Provider { get; set; } = null!;
}

public class MetadataImportRun
{
    public long Id { get; set; }
    public int SeriesExternalId { get; set; }
    public string? LanguageCode { get; set; }
    public string Status { get; set; } = "";
    public DateTime StartedAtUtc { get; set; }
    public DateTime? FinishedAtUtc { get; set; }

    public SeriesExternalId External { get; set; } = null!;
}
