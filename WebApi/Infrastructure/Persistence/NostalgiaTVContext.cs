using System.Linq.Expressions;
using ApplicationCore.Entities;
using Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Infrastructure.Persistence;

/// <summary>Schema v2 (normalized to 4NF). Mirrors docs/database/nostalgiatv_v2.dbml.</summary>
public class NostalgiaTVContext(DbContextOptions<NostalgiaTVContext> options) : DbContext(options)
{
    // Security & users
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Menu> Menus => Set<Menu>();
    public DbSet<RoleMenu> RoleMenus => Set<RoleMenu>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserExternalLogin> UserExternalLogins => Set<UserExternalLogin>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    // Catalog
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Series> Series => Set<Series>();
    public DbSet<SeriesSeason> SeriesSeasons => Set<SeriesSeason>();
    public DbSet<SeriesCategory> SeriesCategories => Set<SeriesCategory>();
    public DbSet<EpisodeType> EpisodeTypes => Set<EpisodeType>();
    public DbSet<Episode> Episodes => Set<Episode>();
    public DbSet<EpisodeBreakPoint> EpisodeBreakPoints => Set<EpisodeBreakPoint>();
    public DbSet<MetadataProvider> MetadataProviders => Set<MetadataProvider>();
    public DbSet<SeriesExternalId> SeriesExternalIds => Set<SeriesExternalId>();
    public DbSet<MetadataImportRun> MetadataImportRuns => Set<MetadataImportRun>();

    // Comments
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<ChannelComment> ChannelComments => Set<ChannelComment>();
    public DbSet<SeriesComment> SeriesComments => Set<SeriesComment>();

    // Channels & eras
    public DbSet<Channel> Channels => Set<Channel>();
    public DbSet<ChannelEra> ChannelEras => Set<ChannelEra>();
    public DbSet<ChannelEraSelection> ChannelEraSelections => Set<ChannelEraSelection>();
    public DbSet<ChannelEraBreakRule> ChannelEraBreakRules => Set<ChannelEraBreakRule>();
    public DbSet<ChannelEraSeries> ChannelEraSeries => Set<ChannelEraSeries>();
    public DbSet<ChannelEraSelectedSeason> ChannelEraSelectedSeasons => Set<ChannelEraSelectedSeason>();

    // Interludes
    public DbSet<Interlude> Interludes => Set<Interlude>();
    public DbSet<ChannelEraInterlude> ChannelEraInterludes => Set<ChannelEraInterlude>();
    public DbSet<ChannelEraSeriesInterlude> ChannelEraSeriesInterludes => Set<ChannelEraSeriesInterlude>();

    // Scheduling
    public DbSet<ScheduledProgram> ScheduledPrograms => Set<ScheduledProgram>();
    public DbSet<ScheduledAdBreak> ScheduledAdBreaks => Set<ScheduledAdBreak>();
    public DbSet<ScheduledPlaybackSegment> ScheduledPlaybackSegments => Set<ScheduledPlaybackSegment>();

    // Media & settings
    public DbSet<MediaWorkerState> MediaWorkerStates => Set<MediaWorkerState>();
    public DbSet<MediaProcessingJob> MediaProcessingJobs => Set<MediaProcessingJob>();
    public DbSet<MediaResourcePolicy> MediaResourcePolicies => Set<MediaResourcePolicy>();
    public DbSet<PlatformSettings> PlatformSettings => Set<PlatformSettings>();

    // Viewers & devices
    public DbSet<ViewerProfile> ViewerProfiles => Set<ViewerProfile>();
    public DbSet<ViewerDevice> ViewerDevices => Set<ViewerDevice>();
    public DbSet<ViewerPairingCode> ViewerPairingCodes => Set<ViewerPairingCode>();
    public DbSet<DeviceAuthorization> DeviceAuthorizations => Set<DeviceAuthorization>();
    public DbSet<ViewerProgress> ViewerProgress => Set<ViewerProgress>();
    public DbSet<ViewerWatchRange> ViewerWatchRanges => Set<ViewerWatchRange>();

    // Soft delete intentionally hides the dependents of a deleted row (e.g. the schedule of a deleted era).
    protected override void OnConfiguring(DbContextOptionsBuilder options) =>
        options.ConfigureWarnings(warnings => warnings.Ignore(CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning));

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.ConfigureSecurity();
        model.ConfigureCatalog();
        model.ConfigureComments();
        model.ConfigureChannels();
        model.ConfigureInterludes();
        model.ConfigureScheduling();
        model.ConfigurePlatform();
        model.ConfigureViewers();
        model.SeedReferenceData();

        // Soft-deleted rows are invisible unless a query calls IgnoreQueryFilters().
        foreach (var entity in model.Model.GetEntityTypes().Where(type => typeof(ISoftDeletable).IsAssignableFrom(type.ClrType)))
        {
            var row = Expression.Parameter(entity.ClrType, "row");
            var deleted = Expression.Property(row, nameof(ISoftDeletable.DeletedAtUtc));
            var filter = Expression.Lambda(Expression.Equal(deleted, Expression.Constant(null, typeof(DateTime?))), row);
            model.Entity(entity.ClrType).HasQueryFilter(filter);
        }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder conventions)
    {
        // Every decimal in the DBML (seconds and offsets) is decimal(12,3).
        conventions.Properties<decimal>().HavePrecision(12, 3);
        conventions.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }
}
