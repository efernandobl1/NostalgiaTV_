using ApplicationCore.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Contexts;

internal static class RetroBroadcastModelConfiguration
{
    public static void ConfigureRetroBroadcast(this ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Channel>().Property(item => item.ShareId).HasDefaultValueSql("NEWID()");
        modelBuilder.Entity<Channel>().HasIndex(item => item.ShareId).IsUnique();
        modelBuilder.Entity<ChannelEra>(era =>
        {
            era.Property(item => item.StartDate).HasColumnName("HistoricalStartDate");
            era.Property(item => item.EndDate).HasColumnName("HistoricalEndDate");
            era.HasAlternateKey(item => new { item.ChannelId, item.Id });
            era.ToTable(table => table.HasCheckConstraint(
                "CK_ChannelEras_HistoricalDates",
                "[HistoricalEndDate] IS NULL OR [HistoricalEndDate] >= [HistoricalStartDate]"));
        });

        modelBuilder.Entity<MetadataProvider>(provider =>
        {
            provider.Property(item => item.Code).HasMaxLength(80);
            provider.Property(item => item.Name).HasMaxLength(200);
            provider.HasIndex(item => item.Code).IsUnique();
        });

        modelBuilder.Entity<SeriesExternalId>(external =>
        {
            external.Property(item => item.ExternalId).HasMaxLength(300);
            external.HasIndex(item => new { item.ProviderId, item.ExternalId }).IsUnique();
            external.HasOne<Series>().WithMany().HasForeignKey(item => item.SeriesId).OnDelete(DeleteBehavior.Restrict);
            external.HasOne<MetadataProvider>().WithMany().HasForeignKey(item => item.ProviderId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MetadataImportRun>(run =>
        {
            run.Property(item => item.LanguageCode).HasMaxLength(20);
            run.Property(item => item.Status).HasMaxLength(40);
            run.HasOne<SeriesExternalId>().WithMany().HasForeignKey(item => item.SeriesExternalId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SeriesComment>(comment =>
        {
            comment.Property(item => item.Status).HasMaxLength(40);
            comment.HasAlternateKey(item => new { item.Id, item.SeriesId });
            comment.HasOne<Series>().WithMany().HasForeignKey(item => item.SeriesId).OnDelete(DeleteBehavior.Restrict);
            comment.HasOne<User>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
            comment.HasOne<SeriesComment>().WithMany()
                .HasForeignKey(item => new { item.ParentCommentId, item.SeriesId })
                .HasPrincipalKey(item => new { item.Id, item.SeriesId })
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ChannelEraSelection>(selection =>
        {
            selection.HasKey(item => item.ChannelId);
            selection.HasOne<Channel>().WithOne().HasForeignKey<ChannelEraSelection>(item => item.ChannelId)
                .OnDelete(DeleteBehavior.Restrict);
            selection.HasOne<ChannelEra>().WithMany()
                .HasForeignKey(item => new { item.ChannelId, item.ChannelEraId })
                .HasPrincipalKey(item => new { item.ChannelId, item.Id })
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<EpisodeBreakPoint>(point =>
        {
            point.Property(item => item.Label).HasMaxLength(200);
            point.Property(item => item.OffsetSeconds).HasColumnType("decimal(12,3)");
            point.HasIndex(item => new { item.EpisodeId, item.OffsetSeconds }).IsUnique();
            point.HasOne<Episode>().WithMany().HasForeignKey(item => item.EpisodeId).OnDelete(DeleteBehavior.Restrict);
            point.ToTable(table => table.HasCheckConstraint("CK_EpisodeBreakPoints_Offset", "[OffsetSeconds] > 0"));
        });

        modelBuilder.Entity<Interlude>(interlude =>
        {
            interlude.Property(item => item.Kind).HasConversion<string>().HasMaxLength(30);
            interlude.Property(item => item.Season).HasConversion<string>().HasMaxLength(30)
                .HasDefaultValue(InterludeSeason.AllYear);
            interlude.Property(item => item.Title).HasMaxLength(300);
            interlude.Property(item => item.FilePath).HasMaxLength(1000);
            interlude.Property(item => item.RegionCode).HasMaxLength(20);
            interlude.Property(item => item.SourceUrl).HasMaxLength(1000);
            interlude.Property(item => item.License).HasMaxLength(500);
            interlude.Property(item => item.DurationSeconds).HasColumnType("decimal(12,3)");
            interlude.ToTable(table =>
            {
                table.HasCheckConstraint("CK_Interludes_Duration", "[DurationSeconds] > 0");
                table.HasCheckConstraint("CK_Interludes_OriginalYears",
                    "[OriginalYearTo] IS NULL OR [OriginalYearFrom] IS NULL OR [OriginalYearTo] >= [OriginalYearFrom]");
                table.HasCheckConstraint("CK_Interludes_Kind", "[Kind] IN ('Bumper', 'Advertisement')");
                table.HasCheckConstraint("CK_Interludes_Season", "[Season] IN ('AllYear', 'Halloween', 'Christmas')");
                table.HasCheckConstraint("CK_Interludes_Redistribution", "[RedistributionAllowed] = 0 OR LEN(LTRIM(RTRIM([License]))) > 0 AND [License] IS NOT NULL");
            });
        });

        modelBuilder.Entity<ChannelEraInterlude>(assignment =>
        {
            assignment.HasKey(item => new { item.ChannelEraId, item.InterludeId, item.Role });
            assignment.Property(item => item.Role).HasConversion<string>().HasMaxLength(30);
            assignment.HasOne<ChannelEra>().WithMany().HasForeignKey(item => item.ChannelEraId)
                .OnDelete(DeleteBehavior.Restrict);
            assignment.HasOne<Interlude>().WithMany().HasForeignKey(item => item.InterludeId)
                .OnDelete(DeleteBehavior.Restrict);
            assignment.HasOne<ChannelEraSeries>().WithMany()
                .HasForeignKey(item => new { item.ChannelEraId, item.SeriesId })
                .HasPrincipalKey(item => new { item.ChannelEraId, item.SeriesId })
                .OnDelete(DeleteBehavior.Restrict);
            assignment.ToTable(table =>
            {
                table.HasCheckConstraint("CK_ChannelEraInterludes_Weight", "[Weight] > 0");
                table.HasCheckConstraint("CK_ChannelEraInterludes_Gap", "[MinimumGapSeconds] >= 0");
                table.HasCheckConstraint("CK_ChannelEraInterludes_Role",
                    "[Role] IN ('BreakOpener', 'Advertisement', 'BreakCloser', 'ProgramIntro')");
            });
        });

        modelBuilder.Entity<ChannelEraBreakRule>(rule =>
        {
            rule.HasKey(item => item.ChannelEraId);
            rule.HasOne<ChannelEra>().WithOne().HasForeignKey<ChannelEraBreakRule>(item => item.ChannelEraId)
                .OnDelete(DeleteBehavior.Restrict);
            rule.ToTable(table =>
            {
                table.HasCheckConstraint("CK_ChannelEraBreakRules_AdCount",
                    "[MinimumAds] >= 1 AND [MaximumAds] >= [MinimumAds]");
                table.HasCheckConstraint("CK_ChannelEraBreakRules_Duration", "[MaximumBreakSeconds] > 0");
            });
        });

        modelBuilder.Entity<ScheduledProgram>(program =>
        {
            program.HasOne(item => item.ChannelEra).WithMany().HasForeignKey(item => item.ChannelEraId)
                .OnDelete(DeleteBehavior.Restrict);
            program.HasOne(item => item.Episode).WithMany().HasForeignKey(item => item.EpisodeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ScheduledAdBreak>(adBreak =>
        {
            adBreak.HasAlternateKey(item => new { item.Id, item.ScheduledProgramId });
            adBreak.HasIndex(item => new { item.ScheduledProgramId, item.Ordinal }).IsUnique();
            adBreak.HasIndex(item => new { item.ScheduledProgramId, item.EpisodeBreakPointId }).IsUnique();
            adBreak.HasOne(item => item.ScheduledProgram).WithMany().HasForeignKey(item => item.ScheduledProgramId)
                .OnDelete(DeleteBehavior.Restrict);
            adBreak.HasOne(item => item.EpisodeBreakPoint).WithMany().HasForeignKey(item => item.EpisodeBreakPointId)
                .OnDelete(DeleteBehavior.Restrict);
            adBreak.ToTable(table => table.HasCheckConstraint("CK_ScheduledAdBreaks_Ordinal", "[Ordinal] > 0"));
        });

        modelBuilder.Entity<ScheduledPlaybackSegment>(segment =>
        {
            segment.Property(item => item.MediaStartSecond).HasColumnType("decimal(12,3)");
            segment.Property(item => item.MediaEndSecond).HasColumnType("decimal(12,3)");
            segment.HasIndex(item => new { item.ScheduledProgramId, item.Sequence }).IsUnique();
            segment.HasIndex(item => new { item.StartsAtUtc, item.EndsAtUtc });
            segment.HasOne(item => item.ScheduledProgram).WithMany().HasForeignKey(item => item.ScheduledProgramId)
                .OnDelete(DeleteBehavior.Restrict);
            segment.HasOne<ScheduledAdBreak>().WithMany()
                .HasForeignKey(item => new { item.ScheduledAdBreakId, item.ScheduledProgramId })
                .HasPrincipalKey(item => new { item.Id, item.ScheduledProgramId })
                .OnDelete(DeleteBehavior.Restrict);
            segment.HasOne(item => item.Interlude).WithMany().HasForeignKey(item => item.InterludeId)
                .OnDelete(DeleteBehavior.Restrict);
            segment.ToTable(table =>
            {
                table.HasCheckConstraint("CK_ScheduledPlaybackSegments_Sequence", "[Sequence] > 0");
                table.HasCheckConstraint("CK_ScheduledPlaybackSegments_Time", "[EndsAtUtc] > [StartsAtUtc]");
                table.HasCheckConstraint("CK_ScheduledPlaybackSegments_Content",
                    "([InterludeId] IS NULL AND [ScheduledAdBreakId] IS NULL AND [MediaStartSecond] IS NOT NULL " +
                    "AND [MediaEndSecond] IS NOT NULL AND [MediaStartSecond] >= 0 AND [MediaEndSecond] > [MediaStartSecond]) " +
                    "OR ([InterludeId] IS NOT NULL " +
                    "AND [MediaStartSecond] IS NULL AND [MediaEndSecond] IS NULL)");
            });
        });
    }
}
