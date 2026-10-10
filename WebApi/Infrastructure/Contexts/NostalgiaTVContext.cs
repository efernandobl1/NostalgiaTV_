using ApplicationCore.Entities;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace Infrastructure.Contexts
{
    public class NostalgiaTVContext : DbContext
    {
        public NostalgiaTVContext(DbContextOptions<NostalgiaTVContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Rol> Roles { get; set; }
        public DbSet<Menu> Menus { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<Series> Series { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Episode> Episodes { get; set; }
        public DbSet<EpisodeType> EpisodeTypes { get; set; }
        public DbSet<Channel> Channels { get; set; }
        public DbSet<ChannelState> ChannelStates { get; set; }
        public DbSet<ChannelScheduleEntry> ChannelScheduleEntries { get; set; }
        public DbSet<ChannelEra> ChannelEras { get; set; }
        public DbSet<ChannelEraSeries> ChannelEraSeries { get; set; }
        public DbSet<ChannelEraSelectedSeason> ChannelEraSelectedSeasons { get; set; }
        public DbSet<ChannelBumper> ChannelBumpers { get; set; }
        public DbSet<ActivityLog> ActivityLogs { get; set; }
        public DbSet<MetadataProvider> MetadataProviders { get; set; }
        public DbSet<SeriesExternalId> SeriesExternalIds { get; set; }
        public DbSet<MetadataImportRun> MetadataImportRuns { get; set; }
        public DbSet<SeriesComment> SeriesComments { get; set; }
        public DbSet<ChannelEraSelection> ChannelEraSelections { get; set; }
        public DbSet<EpisodeBreakPoint> EpisodeBreakPoints { get; set; }
        public DbSet<Interlude> Interludes { get; set; }
        public DbSet<ChannelEraInterlude> ChannelEraInterludes { get; set; }
        public DbSet<ChannelEraBreakRule> ChannelEraBreakRules { get; set; }
        public DbSet<ScheduledProgram> ScheduledPrograms { get; set; }
        public DbSet<ScheduledAdBreak> ScheduledAdBreaks { get; set; }
        public DbSet<ScheduledPlaybackSegment> ScheduledPlaybackSegments { get; set; }
        public DbSet<MediaProcessingJob> MediaProcessingJobs { get; set; }
        public DbSet<MediaWorkerState> MediaWorkerStates { get; set; }
        public DbSet<MediaResourcePolicy> MediaResourcePolicies { get; set; }
        public DbSet<ViewerProfile> ViewerProfiles { get; set; }
        public DbSet<ViewerDevice> ViewerDevices { get; set; }
        public DbSet<ViewerPairingCode> ViewerPairingCodes { get; set; }
        public DbSet<DeviceAuthorization> DeviceAuthorizations { get; set; }
        public DbSet<ViewerProgress> ViewerProgress { get; set; }
        public DbSet<ViewerWatchRange> ViewerWatchRanges { get; set; }
        public DbSet<ChannelComment> ChannelComments { get; set; }
        public DbSet<PlatformSettings> PlatformSettings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<User>().Property(user => user.GoogleSubject).HasMaxLength(255);
            modelBuilder.Entity<User>().HasIndex(user => user.GoogleSubject).IsUnique();
            modelBuilder.Entity<Rol>().HasIndex(role => role.IsViewerRole).IsUnique().HasFilter("[IsViewerRole] = 1");
            modelBuilder.Entity<RefreshToken>().Property(token => token.Token).HasMaxLength(64);
            modelBuilder.Entity<RefreshToken>().Property(token => token.ReplacedByToken).HasMaxLength(64);
            modelBuilder.Entity<RefreshToken>().HasIndex(token => token.Token).IsUnique();
            modelBuilder.Entity<RefreshToken>().HasIndex(token => new { token.UserId, token.RevokedAt });
            modelBuilder.Entity<Episode>().Property(episode => episode.IsAvailable).HasDefaultValue(true);
            modelBuilder.ConfigureViewing();
            modelBuilder.Entity<PlatformSettings>(settings =>
            {
                settings.Property(item => item.Id).ValueGeneratedNever();
                settings.Property(item => item.TimeZoneId).HasMaxLength(100);
                settings.ToTable("PlatformSettings", table =>
                {
                    table.HasCheckConstraint("CK_PlatformSettings_Singleton", "[Id] = 1");
                    table.HasCheckConstraint("CK_PlatformSettings_Limits",
                        "[NoRepeatWindowHours] BETWEEN 0 AND 72 AND [MaxSpecialsPerDay] BETWEEN 0 AND 50 " +
                        "AND [MaxSpecialsPerSeriesPerDay] BETWEEN 0 AND [MaxSpecialsPerDay] " +
                        "AND [MaxMoviesPerDay] BETWEEN 0 AND 20 AND [MaxMoviesPerSeriesPerDay] BETWEEN 0 AND [MaxMoviesPerDay]");
                });
                settings.HasData(new PlatformSettings());
            });

            modelBuilder.Entity<MediaProcessingJob>(job =>
            {
                job.Property(item => item.Worker).HasMaxLength(20);
                job.Property(item => item.Status).HasMaxLength(20);
                job.Property(item => item.Fingerprint).HasMaxLength(64);
                job.Property(item => item.SourcePath).HasMaxLength(2048);
                job.Property(item => item.OutputPath).HasMaxLength(2048);
                job.Property(item => item.Message).HasMaxLength(500);
                job.HasIndex(item => new { item.Worker, item.Fingerprint }).IsUnique();
                job.HasIndex(item => new { item.Worker, item.Status, item.Id });
                job.HasOne<Series>().WithMany().HasForeignKey(item => item.SeriesId).OnDelete(DeleteBehavior.Cascade);
                job.HasOne<MediaWorkerState>().WithMany().HasForeignKey(item => item.Worker).OnDelete(DeleteBehavior.Restrict);
            });
            modelBuilder.Entity<MediaWorkerState>(worker =>
            {
                worker.Property(item => item.Id).HasMaxLength(20);
                worker.HasData(new MediaWorkerState { Id = "transcode" }, new MediaWorkerState { Id = "index" });
            });

            modelBuilder.Entity<Menu>()
                .HasMany(m => m.Roles)
                .WithMany(r => r.Menus)
                .UsingEntity("MenuRol");

            modelBuilder.Entity<Series>()
                .HasMany(s => s.Categories)
                .WithMany(c => c.Series)
                .UsingEntity(j => j.ToTable("SeriesCategories"));

            // Seed Rol
            modelBuilder.Entity<Rol>().HasData(new Rol
            {
                Id = 1,
                Name = "Administrador",
                Description = "Full access"
            });

            // Seed Menus - grupos padre
            modelBuilder.Entity<Menu>().HasData(
                // Grupos padre (sin URL, solo agrupadores)
                new Menu { Id = 2, Name = "Seguridad", Caption = "SEGURIDAD", Icon = "security", Url = "", IsVisible = true, SortOrder = 1 },
                new Menu { Id = 1, Name = "Contenido", Caption = "CONTENIDO", Icon = "movie", Url = "", IsVisible = true, SortOrder = 2 },

                // Hijos de Seguridad
                new Menu { Id = 6, Name = "Roles", Caption = "Roles", Icon = "admin_panel_settings", Url = "/dashboard/roles", IsVisible = true, SortOrder = 1, ParentId = 2 },
                new Menu { Id = 7, Name = "Users", Caption = "Usuarios", Icon = "people", Url = "/dashboard/users", IsVisible = true, SortOrder = 2, ParentId = 2 },
                new Menu { Id = 12, Name = "Settings", Caption = "Configuración", Icon = "settings", Url = "/dashboard/settings", IsVisible = true, SortOrder = 3, ParentId = 2 },

                // Hijos de Contenido
                new Menu { Id = 3, Name = "Series", Caption = "Series", Icon = "movie", Url = "/dashboard/series", IsVisible = true, SortOrder = 1, ParentId = 1 },
                new Menu { Id = 4, Name = "Episodes", Caption = "Episodios", Icon = "video_library", Url = "/dashboard/episodes", IsVisible = true, SortOrder = 2, ParentId = 1 },
                new Menu { Id = 5, Name = "Channels", Caption = "Canales", Icon = "live_tv", Url = "/dashboard/channels", IsVisible = true, SortOrder = 3, ParentId = 1 },
                new Menu { Id = 8, Name = "Categories", Caption = "Categorías", Icon = "category", Url = "/dashboard/categories", IsVisible = true, SortOrder = 4, ParentId = 1 },
                new Menu { Id = 9, Name = "Channel Eras", Caption = "Eras", Icon = "history_edu", Url = "/dashboard/channel-eras", IsVisible = true, SortOrder = 5, ParentId = 1 },
                new Menu { Id = 10, Name = "Channel Bumpers", Caption = "Bumpers", Icon = "movie_filter", Url = "/dashboard/channel-bumpers", IsVisible = true, SortOrder = 6, ParentId = 1 },
                new Menu { Id = 11, Name = "Transcoding", Caption = "Transcodificación", Icon = "video_settings", Url = "/dashboard/transcoding", IsVisible = true, SortOrder = 7, ParentId = 1 }

            );

            modelBuilder.Entity("MenuRol").HasData(
                new { MenusId = 1, RolesId = 1 },
                new { MenusId = 2, RolesId = 1 },
                new { MenusId = 3, RolesId = 1 },
                new { MenusId = 4, RolesId = 1 },
                new { MenusId = 5, RolesId = 1 },
                new { MenusId = 6, RolesId = 1 },
                new { MenusId = 7, RolesId = 1 },
                new { MenusId = 8, RolesId = 1 },
                new { MenusId = 9, RolesId = 1 },
                new { MenusId = 10, RolesId = 1 },
                new { MenusId = 11, RolesId = 1 },
                new { MenusId = 12, RolesId = 1 }
            );

            // Seed User
            modelBuilder.Entity<User>().HasData(new User
            {
                Id = 1,
                Username = "admin",
                PasswordHash = "!bootstrap-required",
                RolId = 1
            });

            modelBuilder.Entity<EpisodeType>().HasData(
                new EpisodeType { Id = 1, Name = "Regular" },
                new EpisodeType { Id = 2, Name = "Special" },
                new EpisodeType { Id = 3, Name = "Christmas Special" },
                new EpisodeType { Id = 4, Name = "Halloween Special" },
                new EpisodeType { Id = 5, Name = "Movie" }
            );

            modelBuilder.Entity<ChannelEra>()
                .HasOne(e => e.Channel)
                .WithMany(c => c.Eras)
                .HasForeignKey(e => e.ChannelId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ChannelEra>()
                .HasMany(e => e.Series)
                .WithMany(s => s.ChannelEras)
                .UsingEntity<ChannelEraSeries>(
                    right => right.HasOne(link => link.Series).WithMany().HasForeignKey(link => link.SeriesId),
                    left => left.HasOne(link => link.ChannelEra).WithMany(era => era.SeriesLinks).HasForeignKey(link => link.ChannelEraId),
                    join =>
                    {
                        join.ToTable("ChannelEraSeries");
                        join.HasKey(link => new { link.ChannelEraId, link.SeriesId });
                        join.Property(link => link.ChannelEraId).HasColumnName("ChannelErasId");
                    });

            modelBuilder.Entity<ChannelEraSelectedSeason>(season =>
            {
                season.HasKey(item => new { item.ChannelEraId, item.SeriesId, item.SeasonNumber });
                season.Property(item => item.ChannelEraId).HasColumnName("ChannelErasId");
                season.ToTable("ChannelEraSelectedSeasons");
                season.HasOne(item => item.ChannelEraSeries)
                    .WithMany(link => link.SelectedSeasons)
                    .HasForeignKey(item => new { item.ChannelEraId, item.SeriesId })
                    .OnDelete(DeleteBehavior.Cascade);
                season.ToTable(table => table.HasCheckConstraint("CK_ChannelEraSelectedSeasons_SeasonNumber", "[SeasonNumber] >= 0"));
            });

            modelBuilder.Entity<ChannelBumper>()
                .HasOne(b => b.ChannelEra)
                .WithMany(e => e.Bumpers)
                .HasForeignKey(b => b.ChannelEraId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ChannelScheduleEntry>()
                .HasOne(e => e.Episode)
                .WithMany()
                .HasForeignKey(e => e.EpisodeId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ActivityLog>()
                .HasIndex(activity => activity.CreatedAtUtc);

            modelBuilder.Entity<ChannelScheduleEntry>()
                .HasOne(e => e.Bumper)
                .WithMany()
                .HasForeignKey(e => e.BumperId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.ConfigureRetroBroadcast();
        }
    }
}
