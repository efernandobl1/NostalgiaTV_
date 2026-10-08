using ApplicationCore.DTOs.Auth;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Net.Http.Headers;
using Xunit;

namespace Infrastructure.Tests;

public class PersistentSessionIntegrationTests
{
    [SqlMediaFact]
    public async Task RememberedSessionsSurviveCookieRotationWhileOrdinarySessionsRemainNonPersistent()
    {
        var database = "NostalgiaTV_SessionTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = database };
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        try
        {
            var previous = context.Database.GetMigrations().Reverse().Skip(1).First();
            await context.GetService<IMigrator>().MigrateAsync(previous);
            await context.Database.ExecuteSqlRawAsync("INSERT INTO Interludes (Kind, Title, FilePath, DurationSeconds, ApprovedForBroadcast) VALUES ('Bumper', 'Existing bumper', '/uploads/test.mp4', 5, 1)");
            var user = new User { Username = "test-operator", PasswordHash = AuthService.HashPassword("test-passphrase"), RolId = 1 };
            context.Users.Add(user);
            await context.SaveChangesAsync();
            var created = DateTime.UtcNow;
            var expiry = created.AddDays(30);
            await context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO RefreshTokens (Token, UserId, IpAddress, CreatedAt, ExpiresAt) VALUES ('legacy-test-token', {user.Id}, '127.0.0.1', {created}, {expiry})");
            await context.Database.MigrateAsync();
            Assert.Equal(InterludeSeason.AllYear, (await context.Interludes.SingleAsync()).Season);
            Assert.True((await context.RefreshTokens.SingleAsync()).IsPersistent);
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "isolated-auth-test-key-never-used-in-production-2026",
                ["Jwt:Issuer"] = "test", ["Jwt:Audience"] = "test"
            }).Build();
            var service = new AuthService(context, configuration);
            foreach (var persistent in new[] { true, false })
            {
                var http = new DefaultHttpContext();
                await service.LoginAsync(new LoginRequest { Username = user.Username, Password = "test-passphrase", RememberMe = persistent }, http.Response, "127.0.0.1");
                AssertCookies(http.Response, persistent);
                var token = await context.RefreshTokens.OrderByDescending(item => item.Id).FirstAsync();
                Assert.Equal(persistent, token.IsPersistent);
                Assert.InRange((token.ExpiresAt - token.CreatedAt).TotalDays, persistent ? 29.99 : 6.99, persistent ? 30.01 : 7.01);
                for (var rotation = 0; rotation < 2; rotation++)
                {
                    var reopened = new DefaultHttpContext();
                    reopened.Request.Headers.Cookie = $"refresh_token={token.Token}";
                    await service.RefreshTokenAsync(reopened.Request, reopened.Response, "127.0.0.1");
                    AssertCookies(reopened.Response, persistent);
                    Assert.True(token.IsRevoked);
                    var replacement = await context.RefreshTokens.OrderByDescending(item => item.Id).FirstAsync();
                    Assert.Equal(replacement.Token, token.ReplacedByToken);
                    Assert.Equal(persistent, replacement.IsPersistent);
                    token = replacement;
                }
                token.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
                await context.SaveChangesAsync();
                var expired = new DefaultHttpContext();
                expired.Request.Headers.Cookie = $"refresh_token={token.Token}";
                await Assert.ThrowsAsync<UnauthorizedException>(() => service.RefreshTokenAsync(expired.Request, expired.Response, "127.0.0.1"));
                Assert.Equal(0, expired.Response.Headers.SetCookie.Count);
            }
        }
        finally
        {
            if (!context.Database.GetDbConnection().Database.StartsWith("NostalgiaTV_SessionTest_", StringComparison.Ordinal))
                throw new InvalidOperationException("Refusing to remove an unrelated database.");
            await context.Database.EnsureDeletedAsync();
        }
    }

    private static void AssertCookies(HttpResponse response, bool persistent)
    {
        var cookies = SetCookieHeaderValue.ParseList(response.Headers.SetCookie.Select(value => value!).ToList());
        Assert.Equal(2, cookies.Count);
        Assert.All(cookies, cookie =>
        {
            Assert.True(cookie.HttpOnly);
            Assert.True(cookie.Secure);
            Assert.Equal(Microsoft.Net.Http.Headers.SameSiteMode.Lax, cookie.SameSite);
            Assert.Equal("/", cookie.Path.ToString());
            Assert.Equal(persistent, cookie.Expires.HasValue);
            if (persistent) Assert.InRange((cookie.Expires!.Value - DateTimeOffset.UtcNow).TotalDays, 29.99, 30.01);
        });
    }
}
