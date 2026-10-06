using System.Security.Claims;
using System.Text.Json;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using WebApi.Controllers;
using Xunit;

namespace Infrastructure.Tests;

public class ViewerIntegrationTests
{
    [SqlMediaFact]
    public async Task PairingSharesOnlyViewerHistoryIsSingleUseAndCanBeRevoked()
    {
        var database = "NostalgiaTV_ViewingTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = database };
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        using var services = new ServiceCollection().AddSingleton<IHostEnvironment>(new TestEnvironment { EnvironmentName = "Production" }).BuildServiceProvider();
        try
        {
            await context.Database.MigrateAsync();
            var resources = new TranscodingController(context, Options.Create(new MediaProcessingSettings()));
            Assert.IsType<BadRequestObjectResult>(await resources.Resources(new(3, 4, true, 0, 300, "America/Guatemala"), CancellationToken.None));
            Assert.IsType<BadRequestObjectResult>(await resources.Resources(new(1, 4, true, 0, 0, "America/Guatemala"), CancellationToken.None));
            Assert.IsType<BadRequestObjectResult>(await resources.Resources(new(1, 4, true, 0, 300, "Invalid/Zone"), CancellationToken.None));
            Assert.IsType<NoContentResult>(await resources.Resources(new(2, 4, true, 0, 300, "America/Guatemala"), CancellationToken.None));
            var policy = await context.MediaResourcePolicies.SingleAsync();
            Assert.Equal(2, policy.DayCores);
            Assert.Equal(4, policy.NightCores);
            Assert.Equal(300, policy.NightEndMinute);
            var series = new Series { Name = "Test", Seasons = 1 };
            var channel = new Channel { Name = "Retro Test" };
            context.AddRange(series, channel);
            await context.SaveChangesAsync();
            var episode = new Episode { SeriesId = series.Id, EpisodeTypeId = 1, Season = 1, EpisodeNumber = 1, Title = "Test" };
            context.Episodes.Add(episode);
            await context.SaveChangesAsync();

            var tv = Controller(context, services);
            Assert.IsType<OkObjectResult>(await tv.Start(new("Living room TV")));
            var tvCookie = tv.Response.Headers.SetCookie.ToString().Split(';')[0];
            Assert.StartsWith("__Host-viewer_device=", tvCookie);
            Assert.Contains("httponly", tv.Response.Headers.SetCookie.ToString().ToLowerInvariant());
            Assert.Contains("samesite=strict", tv.Response.Headers.SetCookie.ToString().ToLowerInvariant());
            Assert.Contains("secure", tv.Response.Headers.SetCookie.ToString().ToLowerInvariant());
            tv.Request.Headers.Cookie = tvCookie;
            Assert.IsType<OkObjectResult>(await tv.Progress(new(episode.Id, 0, 40, 100, 40)));

            var pc = Controller(context, services);
            Assert.IsType<OkObjectResult>(await pc.Start(new("Computer")));
            pc.Request.Headers.Cookie = pc.Response.Headers.SetCookie.ToString().Split(';')[0];
            Assert.IsType<OkObjectResult>(await pc.Progress(new(episode.Id, 40, 80, 100, 80)));
            var code = Json(await tv.CreateCode()).GetProperty("Code").GetString()!;
            Assert.IsType<NoContentResult>(await pc.Pair(new(code)));
            Assert.IsType<BadRequestObjectResult>(await pc.Pair(new(code)));
            Assert.IsType<OkObjectResult>(await pc.Progress(new(episode.Id, 80, 96, 100, 96)));
            var television = Json(await tv.GetSession());
            var computer = Json(await pc.GetSession());
            Assert.Equal(computer.GetProperty("ProfileId").GetString(), television.GetProperty("ProfileId").GetString());
            Assert.True(television.GetProperty("Progress")[0].GetProperty("Completed").GetBoolean());
            Assert.Equal(2, television.GetProperty("Devices").GetArrayLength());

            var outsider = Controller(context, services);
            await outsider.Start(new("Other viewer"));
            outsider.Request.Headers.Cookie = outsider.Response.Headers.SetCookie.ToString().Split(';')[0];
            Assert.Empty(Json(await outsider.GetSession()).GetProperty("Progress").EnumerateArray());
            var televisionId = television.GetProperty("Devices").EnumerateArray().Single(device => device.GetProperty("Current").GetBoolean()).GetProperty("Id").GetGuid();
            Assert.IsType<NotFoundResult>(await outsider.Unlink(televisionId));
            Assert.IsType<NoContentResult>(await pc.Unlink(televisionId));
            Assert.IsType<UnauthorizedResult>(await tv.GetSession());
            Assert.IsType<NoContentResult>(await pc.Reset(series.Id));
            Assert.Empty(Json(await pc.GetSession()).GetProperty("Progress").EnumerateArray());

            var expired = Json(await pc.CreateCode()).GetProperty("Code").GetString()!;
            await context.ViewerPairingCodes.ExecuteUpdateAsync(update => update.SetProperty(item => item.ExpiresAtUtc, DateTime.UtcNow.AddMinutes(-1)));
            Assert.IsType<BadRequestObjectResult>(await outsider.Pair(new(expired)));
            Assert.IsType<UnauthorizedResult>(await Controller(context, services).Progress(new(episode.Id, 0, 5, 100, 5)));

            var identity = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "1")], "test"));
            var channelComments = new ChannelCommentsController(context) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = identity } } };
            var seriesComments = new SeriesCommentsController(context) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = identity } } };
            Assert.IsType<AcceptedResult>(await channelComments.Post(channel.Id, new("<script>Not executable</script>", null)));
            Assert.IsType<AcceptedResult>(await seriesComments.Post(series.Id, new("A retro memory", null)));
            Assert.Empty(Json(await channelComments.Get(channel.Id)).EnumerateArray());
            Assert.Equal(2, Json(await seriesComments.GetModerationQueue()).GetProperty("TotalCount").GetInt32());
            var comment = await context.ChannelComments.SingleAsync();
            Assert.IsType<NoContentResult>(await channelComments.Moderate(channel.Id, comment.Id, new("Approved")));
            Assert.Single(Json(await channelComments.Get(channel.Id)).EnumerateArray());
            Assert.IsType<BadRequestResult>(await channelComments.Moderate(channel.Id, comment.Id, new("Invalid")));
        }
        finally
        {
            if (!context.Database.GetDbConnection().Database.StartsWith("NostalgiaTV_ViewingTest_", StringComparison.Ordinal))
                throw new InvalidOperationException("Refusing to remove an unrelated database.");
            await context.Database.EnsureDeletedAsync();
        }
    }

    private static ViewerController Controller(NostalgiaTVContext context, IServiceProvider services) => new(context)
    { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { RequestServices = services } } };
    private static JsonElement Json(IActionResult result) => JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(result).Value);
    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "ViewingTests";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
