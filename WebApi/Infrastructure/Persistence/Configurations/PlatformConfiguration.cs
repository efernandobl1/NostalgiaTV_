using ApplicationCore.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Configurations;

internal static class PlatformConfiguration
{
    public static void ConfigurePlatform(this ModelBuilder model)
    {
        model.Entity<MediaWorkerState>(worker => worker.Property(item => item.Id).HasMaxLength(20));

        model.Entity<MediaProcessingJob>(job =>
        {
            job.Property(item => item.Worker).HasMaxLength(20);
            job.Property(item => item.Fingerprint).HasMaxLength(64);
            job.Property(item => item.SourcePath).HasMaxLength(2048);
            job.Property(item => item.OutputPath).HasMaxLength(2048);
            job.Property(item => item.Status).HasMaxLength(20);
            job.Property(item => item.Message).HasMaxLength(500);
            job.HasIndex(item => new { item.Worker, item.Fingerprint }).IsUnique();
            job.HasIndex(item => new { item.Worker, item.Status, item.Id });
            job.HasIndex(item => new { item.SeriesId, item.Status });
            job.HasOne(item => item.Series).WithMany().HasForeignKey(item => item.SeriesId).OnDelete(DeleteBehavior.Restrict);
            job.HasOne<MediaWorkerState>().WithMany().HasForeignKey(item => item.Worker).OnDelete(DeleteBehavior.Restrict);
            job.ToTable(table =>
            {
                table.HasCheckConstraint("CK_MediaProcessingJobs_Status", "[Status] IN ('Queued', 'Processing', 'Completed', 'Failed', 'Skipped')");
                table.HasCheckConstraint("CK_MediaProcessingJobs_Progress", "[Progress] BETWEEN 0 AND 100");
            });
        });

        model.Entity<MediaResourcePolicy>(policy =>
        {
            policy.Property(item => item.Id).ValueGeneratedNever();
            policy.ToTable(table =>
            {
                table.HasCheckConstraint("CK_MediaResourcePolicies_Singleton", "[Id] = 1");
                table.HasCheckConstraint("CK_MediaResourcePolicies_NightMinutes",
                    "[NightStartMinute] BETWEEN 0 AND 1439 AND [NightEndMinute] BETWEEN 0 AND 1439");
            });
        });

        model.Entity<PlatformSettings>(settings =>
        {
            settings.Property(item => item.Id).ValueGeneratedNever();
            settings.Property(item => item.TimeZoneId).HasMaxLength(100);
            settings.HasOne(item => item.ViewerRole).WithMany().HasForeignKey(item => item.ViewerRoleId).OnDelete(DeleteBehavior.Restrict);
            settings.ToTable(table =>
            {
                table.HasCheckConstraint("CK_PlatformSettings_Limits",
                    "[NoRepeatWindowHours] BETWEEN 0 AND 72 AND [MaxSpecialsPerDay] BETWEEN 0 AND 50 " +
                    "AND [MaxSpecialsPerSeriesPerDay] BETWEEN 0 AND [MaxSpecialsPerDay] " +
                    "AND [MaxMoviesPerDay] BETWEEN 0 AND 20 AND [MaxMoviesPerSeriesPerDay] BETWEEN 0 AND [MaxMoviesPerDay]");
                table.HasCheckConstraint("CK_PlatformSettings_Singleton", "[Id] = 1");
            });
        });
    }

    public static void ConfigureViewers(this ModelBuilder model)
    {
        model.Entity<ViewerProfile>(profile =>
        {
            profile.Property(item => item.Id).ValueGeneratedNever();
            profile.HasIndex(item => item.UserId).IsUnique().HasFilter("[UserId] IS NOT NULL");
            profile.HasOne(item => item.User).WithOne().HasForeignKey<ViewerProfile>(item => item.UserId).OnDelete(DeleteBehavior.SetNull);
        });

        model.Entity<ViewerDevice>(device =>
        {
            device.Property(item => item.Id).ValueGeneratedNever();
            device.Property(item => item.Name).HasMaxLength(80);
            device.Property(item => item.TokenHash).HasMaxLength(64);
            device.HasIndex(item => item.TokenHash).IsUnique();
            device.HasIndex(item => item.ProfileId);
            device.HasIndex(item => item.ExpiresAtUtc);
            device.HasOne(item => item.Profile).WithMany().HasForeignKey(item => item.ProfileId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<ViewerPairingCode>(code =>
        {
            code.HasKey(item => item.Hash);
            code.Property(item => item.Hash).HasMaxLength(64);
            code.HasIndex(item => item.DeviceId).IsUnique();
            code.HasIndex(item => item.ExpiresAtUtc);
            code.HasOne(item => item.Device).WithOne().HasForeignKey<ViewerPairingCode>(item => item.DeviceId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<DeviceAuthorization>(authorization =>
        {
            authorization.HasKey(item => item.DeviceCodeHash);
            authorization.Property(item => item.DeviceCodeHash).HasMaxLength(64);
            authorization.Property(item => item.UserCodeHash).HasMaxLength(64);
            authorization.Property(item => item.Name).HasMaxLength(80);
            authorization.HasIndex(item => item.UserCodeHash).IsUnique();
            authorization.HasIndex(item => item.ProfileId);
            authorization.HasIndex(item => item.ExpiresAtUtc);
            authorization.HasOne(item => item.Profile).WithMany().HasForeignKey(item => item.ProfileId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<ViewerProgress>(progress =>
        {
            progress.HasKey(item => new { item.ProfileId, item.EpisodeId });
            progress.HasIndex(item => item.EpisodeId);
            progress.HasIndex(item => new { item.ProfileId, item.UpdatedAtUtc });
            progress.HasOne(item => item.Profile).WithMany().HasForeignKey(item => item.ProfileId).OnDelete(DeleteBehavior.Cascade);
            progress.HasOne(item => item.Episode).WithMany().HasForeignKey(item => item.EpisodeId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<ViewerWatchRange>(range =>
        {
            range.HasIndex(item => new { item.ProfileId, item.EpisodeId, item.StartSecond });
            range.HasOne<ViewerProgress>().WithMany()
                .HasForeignKey(item => new { item.ProfileId, item.EpisodeId }).OnDelete(DeleteBehavior.Cascade);
            range.ToTable(table => table.HasCheckConstraint("CK_ViewerWatchRanges_Range", "[StartSecond] >= 0 AND [EndSecond] > [StartSecond]"));
        });
    }
}
