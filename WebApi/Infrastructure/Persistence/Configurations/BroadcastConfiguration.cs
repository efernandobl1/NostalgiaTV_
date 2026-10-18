using ApplicationCore.Entities;
using Microsoft.EntityFrameworkCore;
using static Infrastructure.Persistence.Configurations.SecurityConfiguration;

namespace Infrastructure.Persistence.Configurations;

internal static class BroadcastConfiguration
{
    public static void ConfigureComments(this ModelBuilder model)
    {
        model.Entity<Comment>(comment =>
        {
            comment.Property(item => item.Body).HasMaxLength(2000);
            comment.Property(item => item.Status).HasMaxLength(20);
            comment.HasIndex(item => item.UserId);
            comment.HasIndex(item => new { item.Status, item.CreatedAtUtc });
            comment.HasOne(item => item.User).WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
            comment.ToTable(table => table.HasCheckConstraint("CK_Comments_Status", "[Status] IN ('Pending', 'Approved', 'Rejected', 'Hidden')"));
        });

        model.Entity<ChannelComment>(comment =>
        {
            comment.HasKey(item => item.CommentId);
            comment.HasIndex(item => item.ChannelId);
            comment.HasOne(item => item.Comment).WithOne(parent => parent.Channel).HasForeignKey<ChannelComment>(item => item.CommentId).OnDelete(DeleteBehavior.Restrict);
            comment.HasOne(item => item.Channel).WithMany().HasForeignKey(item => item.ChannelId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<SeriesComment>(comment =>
        {
            comment.HasKey(item => item.CommentId);
            comment.HasAlternateKey(item => new { item.CommentId, item.SeriesId });
            comment.HasIndex(item => item.SeriesId);
            comment.HasIndex(item => new { item.ParentCommentId, item.SeriesId });
            comment.HasOne(item => item.Comment).WithOne(parent => parent.Series).HasForeignKey<SeriesComment>(item => item.CommentId).OnDelete(DeleteBehavior.Restrict);
            comment.HasOne(item => item.Series).WithMany().HasForeignKey(item => item.SeriesId).OnDelete(DeleteBehavior.Restrict);
            // Replies must belong to the same series as their parent.
            comment.HasOne<SeriesComment>().WithMany()
                .HasForeignKey(item => new { item.ParentCommentId, item.SeriesId })
                .HasPrincipalKey(item => new { item.CommentId, item.SeriesId })
                .OnDelete(DeleteBehavior.NoAction);
        });
    }

    public static void ConfigureChannels(this ModelBuilder model)
    {
        model.Entity<Channel>(channel =>
        {
            channel.Property(item => item.ShareId).HasDefaultValueSql("NEWID()");
            channel.Property(item => item.Name).HasMaxLength(200);
            channel.HasIndex(item => item.ShareId).IsUnique();
            channel.HasIndex(item => item.Name).IsUnique().HasFilter(ActiveRows);
            channel.ToTable(table => table.HasCheckConstraint("CK_Channels_Dates", "[EndDate] IS NULL OR [EndDate] >= [StartDate]"));
        });

        model.Entity<ChannelEra>(era =>
        {
            era.Property(item => item.Name).HasMaxLength(200);
            era.HasAlternateKey(item => new { item.ChannelId, item.Id });
            era.HasIndex(item => new { item.ChannelId, item.Name }).IsUnique().HasFilter(ActiveRows);
            era.HasOne(item => item.Channel).WithMany(channel => channel.Eras).HasForeignKey(item => item.ChannelId).OnDelete(DeleteBehavior.Restrict);
            era.ToTable(table => table.HasCheckConstraint("CK_ChannelEras_HistoricalDates",
                "[HistoricalEndDate] IS NULL OR [HistoricalEndDate] >= [HistoricalStartDate]"));
        });

        model.Entity<ChannelEraSelection>(selection =>
        {
            selection.HasKey(item => item.ChannelId);
            selection.Property(item => item.ChannelId).ValueGeneratedNever();
            selection.HasIndex(item => new { item.ChannelId, item.ChannelEraId });
            // The composite key guarantees the selected era belongs to the same channel.
            selection.HasOne(item => item.ChannelEra).WithMany()
                .HasForeignKey(item => new { item.ChannelId, item.ChannelEraId })
                .HasPrincipalKey(era => new { era.ChannelId, era.Id })
                .OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<ChannelEraBreakRule>(rule =>
        {
            rule.HasKey(item => item.ChannelEraId);
            rule.Property(item => item.ChannelEraId).ValueGeneratedNever();
            rule.HasOne(item => item.ChannelEra).WithOne(era => era.BreakRule)
                .HasForeignKey<ChannelEraBreakRule>(item => item.ChannelEraId).OnDelete(DeleteBehavior.Restrict);
            rule.ToTable(table =>
            {
                table.HasCheckConstraint("CK_ChannelEraBreakRules_AdCount", "[MinimumAds] >= 1 AND [MaximumAds] >= [MinimumAds]");
                table.HasCheckConstraint("CK_ChannelEraBreakRules_Duration", "[MaximumBreakSeconds] > 0");
            });
        });

        model.Entity<ChannelEraSeries>(link =>
        {
            link.HasKey(item => new { item.ChannelEraId, item.SeriesId });
            link.HasIndex(item => item.SeriesId);
            link.HasOne(item => item.ChannelEra).WithMany(era => era.Series).HasForeignKey(item => item.ChannelEraId).OnDelete(DeleteBehavior.Restrict);
            link.HasOne(item => item.Series).WithMany().HasForeignKey(item => item.SeriesId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<ChannelEraSelectedSeason>(season =>
        {
            season.HasKey(item => new { item.ChannelEraId, item.SeriesId, item.SeasonNumber });
            season.HasIndex(item => new { item.SeriesId, item.SeasonNumber });
            season.HasOne(item => item.ChannelEraSeries).WithMany(link => link.SelectedSeasons)
                .HasForeignKey(item => new { item.ChannelEraId, item.SeriesId }).OnDelete(DeleteBehavior.Cascade);
            season.HasOne<SeriesSeason>().WithMany()
                .HasForeignKey(item => new { item.SeriesId, item.SeasonNumber }).OnDelete(DeleteBehavior.NoAction);
        });
    }

    public static void ConfigureInterludes(this ModelBuilder model)
    {
        model.Entity<Interlude>(interlude =>
        {
            interlude.Property(item => item.Title).HasMaxLength(300);
            interlude.Property(item => item.Kind).HasMaxLength(30);
            interlude.Property(item => item.BumperType).HasMaxLength(30);
            interlude.Property(item => item.Season).HasMaxLength(30).HasDefaultValue(InterludeSeason.AllYear);
            interlude.Property(item => item.FilePath).HasMaxLength(1000);
            interlude.Property(item => item.License).HasMaxLength(500);
            interlude.Property(item => item.SourceUrl).HasMaxLength(1000);
            interlude.Property(item => item.RegionCode).HasMaxLength(20);
            interlude.HasIndex(item => new { item.Kind, item.BumperType, item.Season, item.ApprovedForBroadcast });
            interlude.ToTable(table =>
            {
                table.HasCheckConstraint("CK_Interludes_Duration", "[DurationSeconds] > 0");
                table.HasCheckConstraint("CK_Interludes_Kind", "[Kind] IN ('Bumper', 'Advertisement')");
                table.HasCheckConstraint("CK_Interludes_BumperType",
                    "([Kind] = 'Bumper' AND [BumperType] IN ('ComingUp', 'WeContinueWith', 'Generic')) OR ([Kind] = 'Advertisement' AND [BumperType] IS NULL)");
                table.HasCheckConstraint("CK_Interludes_OriginalYears",
                    "[OriginalYearTo] IS NULL OR [OriginalYearFrom] IS NULL OR [OriginalYearTo] >= [OriginalYearFrom]");
                table.HasCheckConstraint("CK_Interludes_Redistribution",
                    "[RedistributionAllowed] = 0 OR LEN(LTRIM(RTRIM([License]))) > 0 AND [License] IS NOT NULL");
                table.HasCheckConstraint("CK_Interludes_Season", "[Season] IN ('AllYear', 'Halloween', 'Christmas')");
            });
        });

        model.Entity<ChannelEraInterlude>(assignment =>
        {
            assignment.HasKey(item => new { item.ChannelEraId, item.InterludeId });
            assignment.HasIndex(item => item.InterludeId);
            assignment.HasOne(item => item.ChannelEra).WithMany(era => era.Interludes).HasForeignKey(item => item.ChannelEraId).OnDelete(DeleteBehavior.Restrict);
            assignment.HasOne(item => item.Interlude).WithMany().HasForeignKey(item => item.InterludeId).OnDelete(DeleteBehavior.Restrict);
            // SQL Server constraint names are unique per schema, so the DBML's CK_Weight/CK_Gap get a table prefix.
            assignment.ToTable(table =>
            {
                table.HasCheckConstraint("CK_ChannelEraInterludes_Weight", "[Weight] > 0");
                table.HasCheckConstraint("CK_ChannelEraInterludes_Gap", "[MinimumGapSeconds] >= 0");
            });
        });

        model.Entity<ChannelEraSeriesInterlude>(assignment =>
        {
            assignment.HasKey(item => new { item.ChannelEraId, item.SeriesId, item.InterludeId });
            assignment.HasIndex(item => item.InterludeId);
            assignment.HasOne(item => item.ChannelEraSeries).WithMany(link => link.Interludes)
                .HasForeignKey(item => new { item.ChannelEraId, item.SeriesId }).OnDelete(DeleteBehavior.Cascade);
            assignment.HasOne(item => item.Interlude).WithMany().HasForeignKey(item => item.InterludeId).OnDelete(DeleteBehavior.Restrict);
            assignment.ToTable(table =>
            {
                table.HasCheckConstraint("CK_ChannelEraSeriesInterludes_Weight", "[Weight] > 0");
                table.HasCheckConstraint("CK_ChannelEraSeriesInterludes_Gap", "[MinimumGapSeconds] >= 0");
            });
        });
    }

    public static void ConfigureScheduling(this ModelBuilder model)
    {
        model.Entity<ScheduledProgram>(program =>
        {
            program.HasIndex(item => new { item.ChannelEraId, item.GeneratedAtUtc });
            program.HasIndex(item => item.EpisodeId);
            program.HasOne(item => item.ChannelEra).WithMany().HasForeignKey(item => item.ChannelEraId).OnDelete(DeleteBehavior.Restrict);
            program.HasOne(item => item.Episode).WithMany().HasForeignKey(item => item.EpisodeId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<ScheduledAdBreak>(adBreak =>
        {
            adBreak.HasAlternateKey(item => new { item.Id, item.ScheduledProgramId });
            adBreak.HasIndex(item => new { item.ScheduledProgramId, item.EpisodeBreakPointId }).IsUnique();
            adBreak.HasIndex(item => item.EpisodeBreakPointId);
            adBreak.HasOne(item => item.ScheduledProgram).WithMany(program => program.AdBreaks).HasForeignKey(item => item.ScheduledProgramId).OnDelete(DeleteBehavior.Cascade);
            adBreak.HasOne(item => item.EpisodeBreakPoint).WithMany().HasForeignKey(item => item.EpisodeBreakPointId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<ScheduledPlaybackSegment>(segment =>
        {
            segment.HasIndex(item => new { item.ScheduledProgramId, item.StartsAtUtc }).IsUnique();
            segment.HasIndex(item => new { item.ScheduledAdBreakId, item.ScheduledProgramId });
            segment.HasIndex(item => new { item.StartsAtUtc, item.EndsAtUtc });
            segment.HasIndex(item => item.InterludeId);
            segment.HasOne(item => item.ScheduledProgram).WithMany(program => program.Segments).HasForeignKey(item => item.ScheduledProgramId).OnDelete(DeleteBehavior.Cascade);
            segment.HasOne<ScheduledAdBreak>().WithMany()
                .HasForeignKey(item => new { item.ScheduledAdBreakId, item.ScheduledProgramId })
                .HasPrincipalKey(item => new { item.Id, item.ScheduledProgramId })
                .OnDelete(DeleteBehavior.NoAction);
            segment.HasOne(item => item.Interlude).WithMany().HasForeignKey(item => item.InterludeId).OnDelete(DeleteBehavior.Restrict);
            segment.ToTable(table =>
            {
                table.HasCheckConstraint("CK_ScheduledPlaybackSegments_Content",
                    "([InterludeId] IS NULL AND [ScheduledAdBreakId] IS NULL AND [MediaStartSecond] IS NOT NULL AND [MediaEndSecond] IS NOT NULL " +
                    "AND [MediaStartSecond] >= 0 AND [MediaEndSecond] > [MediaStartSecond]) " +
                    "OR ([InterludeId] IS NOT NULL AND [MediaStartSecond] IS NULL AND [MediaEndSecond] IS NULL)");
                table.HasCheckConstraint("CK_ScheduledPlaybackSegments_Time", "[EndsAtUtc] > [StartsAtUtc]");
            });
        });
    }
}
