namespace ApplicationCore.Entities;

/// <summary>Values allowed by CK_Comments_Status.</summary>
public static class CommentStatus
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
    public const string Hidden = "Hidden";
    public static readonly string[] All = [Pending, Approved, Rejected, Hidden];
}

/// <summary>Values allowed by CK_Interludes_Kind.</summary>
public static class InterludeKind
{
    public const string Bumper = "Bumper";
    public const string Advertisement = "Advertisement";
    public static readonly string[] All = [Bumper, Advertisement];
}

/// <summary>Values allowed by CK_Interludes_BumperType.</summary>
public static class BumperType
{
    /// <summary>"Ya viene": announces what airs after the break.</summary>
    public const string ComingUp = "ComingUp";
    /// <summary>"Continuamos con": returns from the break.</summary>
    public const string WeContinueWith = "WeContinueWith";
    public const string Generic = "Generic";
    public static readonly string[] All = [ComingUp, WeContinueWith, Generic];
}

/// <summary>Values allowed by CK_Interludes_Season.</summary>
public static class InterludeSeason
{
    public const string AllYear = "AllYear";
    public const string Halloween = "Halloween";
    public const string Christmas = "Christmas";
    public static readonly string[] All = [AllYear, Halloween, Christmas];
}

/// <summary>Values allowed by CK_MediaProcessingJobs_Status.</summary>
public static class MediaJobStatus
{
    public const string Queued = "Queued";
    public const string Processing = "Processing";
    public const string Completed = "Completed";
    public const string Failed = "Failed";
    public const string Skipped = "Skipped";
    public static readonly string[] All = [Queued, Processing, Completed, Failed, Skipped];
}

public static class MediaWorkers
{
    public const string Transcode = "transcode";
    public const string Index = "index";
    public static readonly string[] All = [Transcode, Index];
}

/// <summary>Seeded rows the business rules rely on.</summary>
public static class SeedIds
{
    public const int AdministratorRole = 1;
    public const int ViewerRole = 2;
    public const int EditorRole = 3;
    public const int BootstrapAdmin = 1;

    public const int RegularEpisode = 1;
    public const int Special = 2;
    public const int ChristmasSpecial = 3;
    public const int HalloweenSpecial = 4;
    public const int Movie = 5;
}

public static class ExternalLoginProviders
{
    public const string Google = "google";
}

/// <summary>Admin screen routes; the authorization policies check them against the user's role menus.</summary>
public static class AdminMenuUrls
{
    public const string Summary = "/admin";
    public const string Schedule = "/admin/programacion";
    public const string Channels = "/admin/canales";
    public const string Series = "/admin/series";
    public const string Interludes = "/admin/interludios";
    public const string Viewers = "/admin/espectadores";
    public const string Comments = "/admin/comentarios";
    public const string Media = "/admin/media";
    public const string Access = "/admin/acceso";
    public const string Settings = "/admin/ajustes";
}
