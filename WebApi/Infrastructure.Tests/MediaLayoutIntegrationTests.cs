using ApplicationCore.DTOs.Channel;
using ApplicationCore.DTOs.ChannelEra;
using ApplicationCore.DTOs.Series;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Infrastructure.Tests;

public class MediaLayoutIntegrationTests
{
    [SqlMediaFact]
    public async Task CreatingAndEditingContentKeepsFilesInTheirEntityFolders()
    {
        var database = "NostalgiaTV_LayoutTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = database };
        var directory = Directory.CreateTempSubdirectory("nostalgia-layout-sql-test-");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = connection.ConnectionString,
            ["MediaSettings:BasePath"] = directory.FullName,
            ["FFmpeg:BinaryFolder"] = "",
            ["FileUpload:MaxFileSizeMB"] = "1",
            ["FileUpload:AllowedExtensions:0"] = ".webp"
        }).Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration);
        services.AddSignalR();
        services.AddInfrastructure(configuration);
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
        try
        {
            await context.Database.MigrateAsync();
            using var image = new MemoryStream([1, 2, 3]);
            var upload = new FormFile(image, 0, image.Length, "logo", "cover.webp");
            var seriesService = scope.ServiceProvider.GetRequiredService<ISeriesService>();
            var series = await seriesService.CreateAsync(new SeriesRequest { Name = "Retro", Seasons = 1, Logo = upload });
            Assert.EndsWith($"Retro-{series.Id}", series.FolderPath);
            Assert.StartsWith($"/uploads/series/Retro-{series.Id}/", series.LogoPath);
            var originalFolder = series.FolderPath;
            var updated = await seriesService.UpdateAsync(series.Id, new SeriesRequest { Name = "Renamed", Seasons = 2, Logo = upload });
            Assert.Equal(originalFolder, updated.FolderPath);
            Assert.True(Directory.Exists(Path.Combine(originalFolder!, "season 2")));
            Assert.StartsWith($"/uploads/series/Retro-{series.Id}/", updated.LogoPath);

            var channelService = scope.ServiceProvider.GetRequiredService<IChannelService>();
            var channel = await channelService.CreateAsync(new ChannelRequest { Name = "Retro TV", Logo = upload });
            Assert.StartsWith($"/uploads/channels/channel-{channel.Id}/", channel.LogoPath);
            var eraService = scope.ServiceProvider.GetRequiredService<IChannelEraService>();
            var era = await eraService.CreateAsync(channel.Id, new ChannelEraRequest { Name = "City" });
            Assert.EndsWith(Path.Combine($"channel-{channel.Id}", "eras", $"era-{era.Id}"), era.FolderPath);
            Assert.False(Directory.Exists(Path.Combine(era.FolderPath!, "bumpers")));
        }
        finally
        {
            if (!context.Database.GetDbConnection().Database.StartsWith("NostalgiaTV_LayoutTest_", StringComparison.Ordinal))
                throw new InvalidOperationException("Refusing to remove an unrelated database.");
            await context.Database.EnsureDeletedAsync();
            directory.Delete(recursive: true);
        }
    }
}
