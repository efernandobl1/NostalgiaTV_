using System.Text.Json;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WebApi.Controllers;
using Xunit;

namespace Infrastructure.Tests;

public class MediaQueueTests
{
    [SqlMediaFact]
    public async Task FiltersBeforePagingPreservesHistoryAndClampsShrinkingQueues()
    {
        var database = "NostalgiaTV_QueueTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = database };
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        try
        {
            await context.Database.MigrateAsync();
            var series = new Series { Name = "Retro queue", Seasons = 1 };
            context.Series.Add(series);
            await context.SaveChangesAsync();
            void Add(string worker, string state, int number) => context.MediaProcessingJobs.Add(new()
            {
                SeriesId = series.Id, Worker = worker, Status = state, Fingerprint = $"{worker}-{state}-{number}",
                SourcePath = $"series/Retro/season 1/{number}.mp4", UpdatedAtUtc = DateTime.UtcNow.AddMinutes(number)
            });
            Add("transcode", "Queued", -2);
            Add("transcode", "Processing", -1);
            Add("index", "Queued", 0);
            for (var i = 1; i <= 125; i++) Add("index", "Completed", i);
            Add("transcode", "Skipped", 1);
            Add("index", "Failed", 1);
            await context.SaveChangesAsync();
            var controller = new TranscodingController(context, Options.Create(new MediaProcessingSettings()));
            async Task<JsonElement> Read(string worker = "all", string view = "pending", int page = 1) =>
                JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(await controller.Status(CancellationToken.None, worker, view, page)).Value);
            var pending = await Read();
            Assert.Equal(3, pending.GetProperty("JobsTotal").GetInt32());
            Assert.Equal("Processing", pending.GetProperty("Jobs")[0].GetProperty("Status").GetString());
            Assert.All(pending.GetProperty("Jobs").EnumerateArray(), job => Assert.Contains(job.GetProperty("Status").GetString(), new[] { "Queued", "Processing" }));
            var history = await Read("index", "Completed", 7);
            Assert.Equal(125, history.GetProperty("JobsTotal").GetInt32());
            Assert.Equal(5, history.GetProperty("Jobs").GetArrayLength());
            Assert.Equal(7, history.GetProperty("Page").GetInt32());
            Assert.All(history.GetProperty("Jobs").EnumerateArray(), job => Assert.Equal("index", job.GetProperty("Worker").GetString()));
            Assert.Single((await Read("transcode", "Skipped")).GetProperty("Jobs").EnumerateArray());
            Assert.Single((await Read("index", "Failed")).GetProperty("Jobs").EnumerateArray());
            Assert.Equal(1, (await Read("transcode", "pending", int.MaxValue)).GetProperty("Page").GetInt32());
            Assert.Equal(0, (await Read("transcode", "Completed")).GetProperty("JobsTotal").GetInt32());
            Assert.Equal(130, (await Read("all", "all")).GetProperty("JobsTotal").GetInt32());
            Assert.Equal(130, await context.MediaProcessingJobs.CountAsync());
            Assert.Contains(history.GetProperty("Counts").EnumerateArray(), count => count.GetProperty("Status").GetString() == "Queued");
            Assert.IsType<BadRequestObjectResult>(await controller.Status(CancellationToken.None, "invalid"));
            Assert.IsType<BadRequestObjectResult>(await controller.Status(CancellationToken.None, view: "invalid"));
            Assert.IsType<BadRequestObjectResult>(await controller.Status(CancellationToken.None, page: 0));
            Assert.IsType<BadRequestObjectResult>(await controller.Status(CancellationToken.None, pageSize: 101));
        }
        finally
        {
            if (context.Database.GetDbConnection().Database != database) throw new InvalidOperationException("Refusing to delete an unrelated database.");
            await context.Database.EnsureDeletedAsync();
        }
    }
}
