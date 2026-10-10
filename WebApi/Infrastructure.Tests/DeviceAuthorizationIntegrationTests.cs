using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ApplicationCore.DTOs.Auth;
using ApplicationCore.DTOs.User;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Infrastructure.Services.Viewing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WebApi.Controllers;
using WebApi.Extensions;
using WebApi.Middleware;
using Xunit;

namespace Infrastructure.Tests;

public class DeviceAuthorizationIntegrationTests
{
    [SqlMediaFact]
    public async Task DeviceAuthorizationRequiresConsentIsSingleUseAndOnlyGrantsViewerAccess()
    {
        var database = "NostalgiaTV_DeviceAuthTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = database };
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        try
        {
            await context.Database.MigrateAsync();
            var account = await context.Users.FindAsync(1);
            account!.PasswordHash = AuthService.HashPassword("Isolated-device-test-passphrase");
            await context.SaveChangesAsync();
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                ["Jwt:Key"] = "Device-authorization-tests-only-long-signing-key-not-for-production",
                ["Jwt:Issuer"] = "test", ["Jwt:Audience"] = "test" }).Build();
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Production" });
            builder.Configuration.AddConfiguration(configuration);
            builder.WebHost.ConfigureKestrel(server => server.Listen(IPAddress.Loopback, 0));
            builder.Services.AddDbContext<NostalgiaTVContext>(options => options.UseSqlServer(connection.ConnectionString));
            builder.Services.AddScoped<IUserService, UserService>();
            builder.Services.AddScoped<IAuthService, AuthService>();
            builder.Services.AddControllers().AddApplicationPart(typeof(ViewerController).Assembly);
            builder.Services.AddApiVersioningConfig();
            builder.Services.AddJwtAuthentication(builder.Configuration);
            builder.Services.AddAuthorization();
            builder.Services.AddRateLimitingConfig();
            await using var app = builder.Build();
            app.UseRouting();
            app.UseMiddleware<SecurityRequestMiddleware>();
            app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter(); app.MapControllers();
            await app.StartAsync();
            using var client = new HttpClient(new HttpClientHandler { UseCookies = false }) { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>()
                .Features.Get<IServerAddressesFeature>()!.Addresses.Single()) };
            var auth = new AuthService(context, configuration);
            var login = new DefaultHttpContext();
            await auth.LoginAsync(new LoginRequest { Username = account.Username, Password = "Isolated-device-test-passphrase" }, login.Response, "127.0.0.1");
            var adminCookie = "access_token=" + PersistentSessionIntegrationTests.CookieValue(login.Response, "access_token");
            const string route = "/api/v1/viewer/authorization";
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/v1/auth/register", new { Username = "new-viewer", Password = "Private-registration-test-passphrase" })).StatusCode);
            await context.PlatformSettings.ExecuteUpdateAsync(update => update.SetProperty(item => item.PublicRegistrationEnabled, true));
            Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/v1/auth/register", new { Username = "new-viewer", Password = "Private-registration-test-passphrase", RolId = 1 })).StatusCode);
            var registered = await context.Users.Include(user => user.Rol).ThenInclude(role => role.Menus).SingleAsync(user => user.Username == "new-viewer");
            Assert.True(registered.Rol.IsViewerRole); Assert.Empty(registered.Rol.Menus); Assert.NotEqual(1, registered.RolId);
            var viewerLogin = new DefaultHttpContext();
            await auth.LoginAsync(new LoginRequest { Username = "new-viewer", Password = "Private-registration-test-passphrase" }, viewerLogin.Response, "127.0.0.1");
            client.DefaultRequestHeaders.Add("Cookie", "access_token=" + PersistentSessionIntegrationTests.CookieValue(viewerLogin.Response, "access_token"));
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/users/me")).StatusCode);
            await new UserService(context).UpdateAsync(registered.Id, new UserRequest { Username = registered.Username, RolId = 1 });
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/users/me")).StatusCode);
            client.DefaultRequestHeaders.Remove("Cookie");
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/register", new { Username = "short", Password = "short" })).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/v1/auth/register", new { Username = "new-viewer", Password = "Private-registration-test-passphrase" })).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/v1/auth/google")).StatusCode);
            var ticket = await Post(client, route, new { Name = "Living room TV" });
            var deviceCode = ticket.GetProperty("deviceCode").GetString()!;
            var userCode = ticket.GetProperty("userCode").GetString()!;
            var stored = await context.DeviceAuthorizations.SingleAsync();
            Assert.Equal(ViewerSessions.Hash(deviceCode), stored.DeviceCodeHash);
            Assert.DoesNotContain(deviceCode, stored.UserCodeHash);
            Assert.Null(stored.ProfileId);
            Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync(route + "/redeem", new { deviceCode })).StatusCode);
            Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync(route + "/redeem", new { deviceCode })).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync(route + "/approve", new { code = userCode })).StatusCode);
            using var crossSite = new HttpRequestMessage(HttpMethod.Post, route + "/approve") { Content = JsonContent.Create(new { code = userCode }) };
            crossSite.Headers.Add("Cookie", adminCookie); crossSite.Headers.Add("Origin", "https://attacker.example");
            Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(crossSite)).StatusCode);
            client.DefaultRequestHeaders.Add("Cookie", adminCookie);
            Assert.Equal("Living room TV", (await Post(client, route + "/inspect", new { code = userCode })).GetProperty("name").GetString());
            Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync(route + "/approve", new { code = userCode })).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync(route + "/approve", new { code = userCode })).StatusCode);
            client.DefaultRequestHeaders.Remove("Cookie");
            await context.DeviceAuthorizations.ExecuteUpdateAsync(update => update.SetProperty(item => item.LastPolledAtUtc, DateTime.UtcNow.AddSeconds(-10)));
            using var redeemed = await client.PostAsJsonAsync(route + "/redeem", new { deviceCode });
            Assert.Equal(HttpStatusCode.OK, redeemed.StatusCode);
            var viewerCookie = redeemed.Headers.GetValues("Set-Cookie").Single();
            Assert.StartsWith("__Host-viewer_device=", viewerCookie);
            Assert.Contains("secure", viewerCookie); Assert.Contains("httponly", viewerCookie);
            Assert.DoesNotContain("access_token", viewerCookie);
            Assert.Equal(HttpStatusCode.Gone, (await client.PostAsJsonAsync(route + "/redeem", new { deviceCode })).StatusCode);
            client.DefaultRequestHeaders.Add("Cookie", viewerCookie.Split(';')[0]);
            var session = await client.GetFromJsonAsync<JsonElement>("/api/v1/viewer/session");
            Assert.True(session.GetProperty("accountLinked").GetBoolean());
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/users/me")).StatusCode);
            client.DefaultRequestHeaders.Remove("Cookie");
            client.DefaultRequestHeaders.Add("Cookie", adminCookie);
            var browser = await Post(client, "/api/v1/viewer/session", new { Name = "Browser" });
            Assert.Equal(session.GetProperty("profileId").GetString(), browser.GetProperty("profileId").GetString());
            var qr = await Post(client, route + "/qr", new { Name = "Android" });
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(route + "/redeem", new { deviceCode = qr.GetProperty("deviceCode").GetString() })).StatusCode);
            client.DefaultRequestHeaders.Remove("Cookie");
            await context.Users.Where(item => item.Id == 1).ExecuteUpdateAsync(update => update.SetProperty(item => item.SessionVersion, item => item.SessionVersion + 1));
            client.DefaultRequestHeaders.Add("Cookie", viewerCookie.Split(';')[0]);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/viewer/session")).StatusCode);
            await app.StopAsync();
        }
        finally
        {
            if (!context.Database.GetDbConnection().Database.StartsWith("NostalgiaTV_DeviceAuthTest_", StringComparison.Ordinal))
                throw new InvalidOperationException("Refusing to remove an unrelated database.");
            await context.Database.EnsureDeletedAsync();
        }
    }

    private static async Task<JsonElement> Post(HttpClient client, string path, object value)
    {
        using var response = await client.PostAsJsonAsync(path, value);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
