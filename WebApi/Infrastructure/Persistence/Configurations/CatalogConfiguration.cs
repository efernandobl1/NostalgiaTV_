using ApplicationCore.Entities;
using Microsoft.EntityFrameworkCore;
using static Infrastructure.Persistence.Configurations.SecurityConfiguration;

namespace Infrastructure.Persistence.Configurations;

internal static class CatalogConfiguration
{
    public static void ConfigureCatalog(this ModelBuilder model)
    {
        model.Entity<Category>(category =>
        {
            category.Property(item => item.Name).HasMaxLength(100);
            category.HasIndex(item => item.Name).IsUnique().HasFilter(ActiveRows);
        });

        model.Entity<Series>(series =>
        {
            series.Property(item => item.Name).HasMaxLength(200);
            series.Property(item => item.Rating).HasColumnType("real");
            series.Property(item => item.StartDate).HasColumnType("date");
            series.Property(item => item.EndDate).HasColumnType("date");
            series.HasIndex(item => item.Name);
            series.ToTable(table => table.HasCheckConstraint("CK_Series_Dates", "[EndDate] IS NULL OR [EndDate] >= [StartDate]"));
        });

        model.Entity<SeriesSeason>(season =>
        {
            season.HasKey(item => new { item.SeriesId, item.SeasonNumber });
            season.HasOne(item => item.Series).WithMany(series => series.Seasons).HasForeignKey(item => item.SeriesId).OnDelete(DeleteBehavior.Restrict);
            season.ToTable(table => table.HasCheckConstraint("CK_SeriesSeasons_SeasonNumber", "[SeasonNumber] >= 0"));
        });

        model.Entity<SeriesCategory>(link =>
        {
            link.HasKey(item => new { item.SeriesId, item.CategoryId });
            link.HasIndex(item => item.CategoryId);
            link.HasOne(item => item.Series).WithMany(series => series.Categories).HasForeignKey(item => item.SeriesId).OnDelete(DeleteBehavior.Restrict);
            link.HasOne(item => item.Category).WithMany().HasForeignKey(item => item.CategoryId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<EpisodeType>(type =>
        {
            type.Property(item => item.Name).HasMaxLength(50);
            type.HasIndex(item => item.Name).IsUnique().HasFilter(ActiveRows);
        });

        model.Entity<Episode>(episode =>
        {
            episode.Property(item => item.Title).HasMaxLength(300);
            episode.Property(item => item.IsAvailable).HasDefaultValue(true);
            episode.HasIndex(item => new { item.SeriesId, item.SeasonNumber, item.EpisodeTypeId, item.EpisodeNumber }).IsUnique().HasFilter(ActiveRows);
            episode.HasIndex(item => item.EpisodeTypeId);
            episode.HasOne(item => item.Season).WithMany(season => season.Episodes)
                .HasForeignKey(item => new { item.SeriesId, item.SeasonNumber }).OnDelete(DeleteBehavior.Restrict);
            episode.HasOne(item => item.EpisodeType).WithMany().HasForeignKey(item => item.EpisodeTypeId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<EpisodeBreakPoint>(point =>
        {
            point.Property(item => item.Label).HasMaxLength(200);
            point.HasIndex(item => new { item.EpisodeId, item.OffsetSeconds }).IsUnique().HasFilter(ActiveRows);
            point.HasOne(item => item.Episode).WithMany(episode => episode.BreakPoints).HasForeignKey(item => item.EpisodeId).OnDelete(DeleteBehavior.Restrict);
            point.ToTable(table => table.HasCheckConstraint("CK_EpisodeBreakPoints_Offset", "[OffsetSeconds] > 0"));
        });

        model.Entity<MetadataProvider>(provider =>
        {
            provider.Property(item => item.Code).HasMaxLength(80);
            provider.Property(item => item.Name).HasMaxLength(200);
            provider.HasIndex(item => item.Code).IsUnique().HasFilter(ActiveRows);
        });

        model.Entity<SeriesExternalId>(external =>
        {
            external.Property(item => item.ExternalId).HasMaxLength(300);
            external.HasIndex(item => new { item.ProviderId, item.ExternalId }).IsUnique().HasFilter(ActiveRows);
            external.HasIndex(item => new { item.SeriesId, item.ProviderId }).IsUnique().HasFilter(ActiveRows);
            external.HasOne(item => item.Series).WithMany().HasForeignKey(item => item.SeriesId).OnDelete(DeleteBehavior.Restrict);
            external.HasOne(item => item.Provider).WithMany().HasForeignKey(item => item.ProviderId).OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<MetadataImportRun>(run =>
        {
            run.Property(item => item.LanguageCode).HasMaxLength(20);
            run.Property(item => item.Status).HasMaxLength(40);
            run.HasIndex(item => new { item.SeriesExternalId, item.StartedAtUtc });
            run.HasOne(item => item.External).WithMany().HasForeignKey(item => item.SeriesExternalId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
