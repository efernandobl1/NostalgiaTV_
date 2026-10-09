using Infrastructure.Contexts;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using WebApi.Logging;
using WebApi.Middleware;
using Xunit;

namespace Infrastructure.Tests;

public class ViewerPrivacyTests
{
    [Theory]
    [InlineData("/api/v1/viewer/code")]
    [InlineData("/api/v1/viewer/pair")]
    [InlineData("/api/v1/viewer/session")]
    [InlineData("/api/v1/viewer/progress")]
    public async Task PairingCodesAndViewerHistoryAreNotLogged(string path)
    {
        var request = new DefaultHttpContext();
        request.Request.Path = path;
        request.Request.Method = "POST";
        request.Request.ContentType = "application/json";
        using var logger = new PayloadRecorder();
        var called = false;
        var middleware = new RequestResponseLoggingMiddleware(_ => { called = true; return Task.CompletedTask; });
        await middleware.InvokeAsync(request, logger);
        Assert.True(called);
        Assert.Equal(0, logger.Calls);

        await using var database = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>()
            .UseSqlServer("Server=unused;Database=Unused_ViewerPrivacy;Integrated Security=True;TrustServerCertificate=True").Options);
        var activity = new ActivityLoggingMiddleware(_ => Task.CompletedTask, NullLogger<ActivityLoggingMiddleware>.Instance);
        await activity.InvokeAsync(request, database);
        Assert.Empty(database.ChangeTracker.Entries());
    }

    private sealed class PayloadRecorder : IHttpPayloadLogger
    {
        public int Calls { get; private set; }
        public void Request(string method, string path, long? contentLength, string? contentType, string body) => Calls++;
        public void Response(string method, string path, int statusCode, long elapsedMs, string? contentType, string body) => Calls++;
        public void Dispose() { }
    }
}
