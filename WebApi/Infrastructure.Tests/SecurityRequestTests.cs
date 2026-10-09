using System.Net;
using Infrastructure.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using WebApi.Extensions;
using WebApi.Middleware;
using Xunit;

namespace Infrastructure.Tests;

public class SecurityRequestTests
{
    [Theory]
    [InlineData("https://attacker.example", "cross-site", 403)]
    [InlineData("", "cross-site", 403)]
    [InlineData("https://nostalgia.example", "same-origin", 200)]
    [InlineData("", "", 200)]
    public async Task UnsafeOriginsAreRejectedButNativeClientsRemainSupported(string origin, string site, int expected)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["Cors:AllowedOrigins:0"] = "https://nostalgia.example" }).Build();
        var request = new DefaultHttpContext();
        request.Request.Path = "/api/v1/auth/token";
        request.Request.Method = "POST";
        request.Request.Headers.Origin = origin;
        request.Request.Headers["Sec-Fetch-Site"] = site;
        var middleware = new SecurityRequestMiddleware(_ => Task.CompletedTask, configuration, NullLogger<SecurityRequestMiddleware>.Instance);
        await middleware.InvokeAsync(request);
        Assert.Equal(expected, request.Response.StatusCode);
        Assert.Equal("no-store", request.Response.Headers.CacheControl);
    }

    [Fact]
    public async Task OversizedApiBodiesAreRejectedBeforeTheBodyIsRead()
    {
        var request = new DefaultHttpContext();
        request.Request.Path = "/api/v1/users";
        request.Request.Method = "POST";
        request.Request.ContentLength = 2 * 1024 * 1024;
        var called = false;
        await new SecurityRequestMiddleware(_ => { called = true; return Task.CompletedTask; },
            new ConfigurationBuilder().Build(), NullLogger<SecurityRequestMiddleware>.Instance).InvokeAsync(request);
        Assert.False(called);
        Assert.Equal(413, request.Response.StatusCode);
    }

    [Theory]
    [InlineData("127.0.0.1", "192.0.2.1")]
    [InlineData("203.0.113.20", "203.0.113.20")]
    public async Task ForwardedAddressesAreOnlyAcceptedFromTheConfiguredProxy(string remote, string expected)
    {
        var request = new DefaultHttpContext();
        request.Connection.RemoteIpAddress = IPAddress.Parse(remote);
        request.Request.Headers["X-Forwarded-For"] = "192.0.2.1";
        request.Request.Headers["X-Forwarded-Proto"] = "https";
        request.Request.Scheme = "http";
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["ReverseProxy:ProxyHost"] = "localhost" }).Build();
        var middleware = new TrustedProxyMiddleware(_ => Task.CompletedTask, configuration, NullLoggerFactory.Instance);
        await middleware.InvokeAsync(request);
        Assert.Equal(expected, request.Connection.RemoteIpAddress!.ToString());
        Assert.Equal(remote == "127.0.0.1" ? "https" : "http", request.Request.Scheme);
    }

    [Theory]
    [InlineData("Server=sqlserver;User Id=sa;Password=test;Encrypt=True;TrustServerCertificate=False")]
    [InlineData("Server=sqlserver;User Id=nostalgia_app;Password=test;Encrypt=False")]
    [InlineData("Server=sqlserver;User Id=nostalgia_app;Password=test;Encrypt=True;TrustServerCertificate=True")]
    public void UnsafeDatabaseConnectionsFailClosed(string connection) =>
        Assert.Throws<InvalidOperationException>(() => DatabaseConnectionPolicy.Validate(connection));

    [Fact]
    public void VerifiedRestrictedDatabaseConnectionsAreAccepted() => DatabaseConnectionPolicy.Validate(
        "Server=sqlserver;User Id=nostalgia_app;Password=test;Encrypt=True;TrustServerCertificate=False");

    [Fact]
    public async Task AuthenticationLimitsArePartitionedByClientAndReturnRetryAfter()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.ConfigureKestrel(server => server.Listen(IPAddress.Loopback, 0));
        builder.Services.AddRateLimitingConfig();
        await using var app = builder.Build();
        app.UseRouting();
        // Test-only addresses simulate two callers without trusting forwarded headers in production.
        app.Use((context, next) => { context.Connection.RemoteIpAddress = IPAddress.Parse(context.Request.Headers["X-Test-IP"]!); return next(); });
        app.UseRateLimiter();
        app.MapPost("/api/v1/auth/probe", () => Results.Ok()).RequireRateLimiting("AuthPolicy");
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>()
            .Features.Get<IServerAddressesFeature>()!.Addresses.Single()) };
        client.DefaultRequestHeaders.Add("X-Test-IP", "192.0.2.1");
        for (var index = 0; index < 20; index++) Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/v1/auth/probe", null)).StatusCode);
        using var rejected = await client.PostAsync("/api/v1/auth/probe", null);
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.NotNull(rejected.Headers.RetryAfter);
        client.DefaultRequestHeaders.Remove("X-Test-IP");
        client.DefaultRequestHeaders.Add("X-Test-IP", "192.0.2.2");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/v1/auth/probe", null)).StatusCode);
        await app.StopAsync();
    }
}
