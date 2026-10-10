using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using ApplicationCore.DTOs.Auth;
using ApplicationCore.DTOs.User;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WebApi.Authorization;
using WebApi.Controllers;
using WebApi.Extensions;
using Xunit;

namespace Infrastructure.Tests;

public class SecurityIntegrationTests
{
    [SqlMediaFact]
    public async Task RuntimeDatabaseRoleSupportsAuthenticationLocksWithoutSchemaPermissions()
    {
        await WithDatabase(async context =>
        {
            await context.Database.MigrateAsync();
            await context.Database.ExecuteSqlRawAsync("CREATE USER nostalgia_test_app WITHOUT LOGIN; ALTER ROLE db_datareader ADD MEMBER nostalgia_test_app; ALTER ROLE db_datawriter ADD MEMBER nostalgia_test_app;");
            await context.Database.OpenConnectionAsync();
            await Assert.ThrowsAsync<InvalidOperationException>(() => DatabaseConnectionPolicy.ValidatePermissionsAsync(context.Database.GetDbConnection()));
            await using var command = context.Database.GetDbConnection().CreateCommand();
            command.CommandText = """
                EXECUTE AS USER = 'nostalgia_test_app';
                BEGIN TRANSACTION;
                DECLARE @result int;
                EXEC @result = sp_getapplock @Resource = 'restricted-runtime-test', @LockMode = 'Exclusive', @LockOwner = 'Transaction';
                ROLLBACK TRANSACTION;
                IF @result < 0 THROW 50000, 'Authentication lock unavailable', 1;
                SELECT HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE');
                REVERT;
                """;
            Assert.Equal(0, Convert.ToInt32(await command.ExecuteScalarAsync()));
            command.CommandText = "EXECUTE AS USER = 'nostalgia_test_app';";
            await command.ExecuteNonQueryAsync();
            try { await DatabaseConnectionPolicy.ValidatePermissionsAsync(context.Database.GetDbConnection()); }
            finally
            {
                command.CommandText = "REVERT;";
                await command.ExecuteNonQueryAsync();
            }
        });
    }

    [SqlMediaFact]
    public async Task MigrationHashesLegacyTokensWithoutReplacingChangedAdministratorPasswords()
    {
        await WithDatabase(async context =>
        {
            var previous = context.Database.GetMigrations()
                .TakeWhile(value => !value.EndsWith("_HardenAuthenticationSessions", StringComparison.Ordinal)).Last();
            await context.GetService<IMigrator>().MigrateAsync(previous);
            var password = AuthService.HashPassword("Already-changed-admin-password");
            await context.Database.ExecuteSqlInterpolatedAsync($"UPDATE Users SET PasswordHash={password} WHERE Id=1");
            var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
            var replacement = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
            await context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO RefreshTokens(Token, UserId, IpAddress, CreatedAt, ExpiresAt, ReplacedByToken) VALUES ({token}, 1, '127.0.0.1', SYSUTCDATETIME(), DATEADD(day, 30, SYSUTCDATETIME()), {replacement})");
            await context.Database.MigrateAsync();
            Assert.Equal(password, (await context.Users.FindAsync(1))!.PasswordHash);
            var stored = await context.RefreshTokens.SingleAsync();
            Assert.Equal(AuthService.TokenHash(token), stored.Token);
            Assert.Equal(AuthService.TokenHash(replacement), stored.ReplacedByToken);
            await AuthBootstrap.InitializeAsync(context, "Do-not-overwrite-existing-password");
            Assert.Equal(password, (await context.Users.FindAsync(1))!.PasswordHash);
        });
    }

    [SqlMediaFact]
    public async Task BootstrapAndAccountLockoutFailClosed()
    {
        await WithDatabase(async context =>
        {
            await context.Database.MigrateAsync();
            Assert.Equal(AuthBootstrap.RequiredPassword, (await context.Users.FindAsync(1))!.PasswordHash);
            await Assert.ThrowsAsync<InvalidOperationException>(() => AuthBootstrap.InitializeAsync(context, null));
            await AuthBootstrap.InitializeAsync(context, "Unique-test-bootstrap-password");
            var auth = new AuthService(context, Configuration());
            for (var index = 0; index < 5; index++)
                await Assert.ThrowsAsync<UnauthorizedException>(() => auth.LoginAsync(
                    new LoginRequest { Username = "admin", Password = "Incorrect-password" }, new DefaultHttpContext().Response, "192.0.2.1"));
            await Assert.ThrowsAsync<UnauthorizedException>(() => auth.LoginAsync(
                new LoginRequest { Username = "admin", Password = "Unique-test-bootstrap-password" }, new DefaultHttpContext().Response, "192.0.2.2"));
            Assert.NotNull((await context.Users.FindAsync(1))!.LockedUntilUtc);
            Assert.Empty(await context.RefreshTokens.ToListAsync());
        });
    }

    [SqlMediaFact]
    public async Task CookiesAuthorizeRealRequestsAndLogoutPasswordChangesAndReplayRevokeAccess()
    {
        await WithDatabase(async context =>
        {
            await context.Database.MigrateAsync();
            var role = new Rol { Name = "Viewer" };
            var user = new User { Username = "viewer", PasswordHash = AuthService.HashPassword("Private-test-passphrase"), Rol = role };
            context.Users.Add(user);
            await context.SaveChangesAsync();
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Development" });
            builder.Configuration.AddConfiguration(Configuration());
            builder.WebHost.ConfigureKestrel(server => server.Listen(IPAddress.Loopback, 0));
            builder.Services.AddDbContext<NostalgiaTVContext>(options => options.UseSqlServer(context.Database.GetConnectionString()));
            builder.Services.AddScoped<IUserService, UserService>();
            builder.Services.AddControllers().AddApplicationPart(typeof(UserController).Assembly);
            builder.Services.AddApiVersioningConfig();
            builder.Services.AddJwtAuthentication(builder.Configuration);
            builder.Services.AddScoped<IAuthorizationHandler, MenuAccessHandler>();
            builder.Services.AddAuthorization(options => options.AddPolicy("Admin", policy =>
                policy.RequireAuthenticatedUser().AddRequirements(new MenuAccessRequirement(null))));
            await using var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            await app.StartAsync();
            using var client = new HttpClient { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>()
                .Features.Get<IServerAddressesFeature>()!.Addresses.Single()) };
            var auth = new AuthService(context, Configuration());
            var session = await Login(auth);
            var access = PersistentSessionIntegrationTests.CookieValue(session.Response, "access_token");
            var token = new JwtSecurityTokenHandler().ReadJwtToken(access);
            Assert.InRange((token.ValidTo - DateTime.UtcNow).TotalMinutes, 14, 15.1);
            client.DefaultRequestHeaders.Add("Cookie", $"access_token={access}");
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/users/me")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/dashboard/summary")).StatusCode);
            session.Request.Headers.Cookie = "refresh_token=" + PersistentSessionIntegrationTests.CookieValue(session.Response, "refresh_token");
            await auth.RevokeTokenAsync(session.Request, new DefaultHttpContext().Response, "127.0.0.1");
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/users/me")).StatusCode);

            session = await Login(auth);
            var oldRefresh = PersistentSessionIntegrationTests.CookieValue(session.Response, "refresh_token");
            var refresh = new DefaultHttpContext();
            refresh.Request.Headers.Cookie = "refresh_token=" + oldRefresh;
            await auth.RefreshTokenAsync(refresh.Request, refresh.Response, "127.0.0.1");
            client.DefaultRequestHeaders.Remove("Cookie");
            client.DefaultRequestHeaders.Add("Cookie", "access_token=" + PersistentSessionIntegrationTests.CookieValue(refresh.Response, "access_token"));
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/users/me")).StatusCode);
            var rotated = await context.RefreshTokens.SingleAsync(item => item.Token == AuthService.TokenHash(oldRefresh));
            rotated.RevokedAt = DateTime.UtcNow.AddMinutes(-1);
            await context.SaveChangesAsync();
            await Assert.ThrowsAsync<UnauthorizedException>(() => auth.RefreshTokenAsync(refresh.Request, new DefaultHttpContext().Response, "192.0.2.3"));
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/users/me")).StatusCode);

            session = await Login(auth);
            client.DefaultRequestHeaders.Remove("Cookie");
            client.DefaultRequestHeaders.Add("Cookie", "access_token=" + PersistentSessionIntegrationTests.CookieValue(session.Response, "access_token"));
            await new UserService(context).UpdateAsync(user.Id, new UserRequest { Username = "viewer", RolId = role.Id, Password = "Updated-private-passphrase" });
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/users/me")).StatusCode);
            await app.StopAsync();
        });
    }

    private static IConfiguration Configuration() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["Jwt:Key"] = "Isolated-security-test-key-never-used-in-production",
        ["Jwt:Issuer"] = "test", ["Jwt:Audience"] = "test"
    }).Build();

    private static async Task<DefaultHttpContext> Login(AuthService auth)
    {
        var session = new DefaultHttpContext();
        await auth.LoginAsync(new LoginRequest { Username = "viewer", Password = "Private-test-passphrase", RememberMe = true }, session.Response, "127.0.0.1");
        return session;
    }

    private static async Task WithDatabase(Func<NostalgiaTVContext, Task> test)
    {
        var name = "NostalgiaTV_SecurityTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = name };
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        try { await test(context); }
        finally
        {
            if (context.Database.GetDbConnection().Database != name) throw new InvalidOperationException("Refusing to remove an unrelated database.");
            await context.Database.EnsureDeletedAsync();
        }
    }
}
