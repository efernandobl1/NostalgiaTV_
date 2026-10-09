using ApplicationCore.Entities;
using ApplicationCore.DTOs.Episode;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting.Internal;
using Xunit;

namespace Infrastructure.Tests;

public class EpisodeOrderingTests
{
    [SqlMediaFact]
    public async Task ListsAndUpdatesKeepNumericSeasonAndEpisodeOrder()
    {
        var database = "NostalgiaTV_EpisodeOrderTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = database };
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        try
        {
            await context.Database.MigrateAsync();
            var series = new Series { Name = "Episode order", Seasons = 5 };
            context.Series.Add(series);
            await context.SaveChangesAsync();
            foreach (var (season, number) in new[] { (5, 20), (5, 9), (1, 2), (5, 1) })
                context.Episodes.Add(new Episode { SeriesId = series.Id, EpisodeTypeId = 1, Season = season, EpisodeNumber = number, FilePath = "missing.mp4" });
            context.Episodes.Add(new Episode { SeriesId = series.Id, EpisodeTypeId = 1, Season = 1, EpisodeNumber = 1, IsAvailable = false });
            await context.SaveChangesAsync();
            var service = new EpisodeService(context, new HostingEnvironment { ContentRootPath = AppContext.BaseDirectory });
            var expected = new[] { (1, 2), (5, 1), (5, 9), (5, 20) };
            Assert.Equal(expected, (await service.GetBySeriesAsync(series.Id)).Select(e => (e.Season, e.EpisodeNumber)));
            Assert.Equal(expected, (await service.GetBySeriesPublicAsync(series.Id)).Select(e => (e.Season, e.EpisodeNumber)));
            var last = await context.Episodes.SingleAsync(e => e.SeriesId == series.Id && e.EpisodeNumber == 20);
            await service.UpdateAsync(last.Id, new UpdateEpisodeRequest { EpisodeNumber = 3, EpisodeTypeId = 1 });
            Assert.Equal(new[] { (1, 2), (5, 1), (5, 3), (5, 9) }, (await service.GetBySeriesAsync(series.Id)).Select(e => (e.Season, e.EpisodeNumber)));
        }
        finally
        {
            if (context.Database.GetDbConnection().Database != database) throw new InvalidOperationException("Refusing to delete an unrelated database.");
            await context.Database.EnsureDeletedAsync();
        }
    }
}
