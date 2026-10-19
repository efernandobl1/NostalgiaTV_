using Infrastructure;
using Infrastructure.Broadcasting;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;
using WebApi.Authorization;
using WebApi.Extensions;
using WebApi.HealthChecks;
using WebApi.Http;

namespace WebApi;

public class Program
{
    public static async Task Main(string[] args)
    {
        if (args.Contains("--migrate"))
        {
            await DatabaseMigrationHost.RunAsync(args);
            return;
        }
        if (args.Contains("--media-worker"))
        {
            await MediaWorkerHost.RunAsync(args);
            return;
        }
        var builder = WebApplication.CreateBuilder(args);
        if (!builder.Environment.IsDevelopment())
            await DatabaseConnectionPolicy.ValidateAsync(builder.Configuration.GetConnectionString("DefaultConnection"));
        if (builder.Environment.IsDevelopment())
            builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true).AddEnvironmentVariables();

        // No revelar el servidor (Kestrel) en las cabeceras de respuesta.
        builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);
        builder.Host.UseSerilog((context, config) => config.ReadFrom.Configuration(context.Configuration).Enrich.FromLogContext());

        builder.Services.AddSignalR();
        await builder.AddProxySecurityAsync();
        builder.Services.AddControllers();
        builder.Services.AddInfrastructure(builder.Configuration);
        builder.Services.AddSingleton<ViewerCookie>();
        builder.Services.AddApiVersioningConfig();
        builder.Services.AddRateLimitingConfig();
        builder.Services.AddJwtAuthentication(builder.Configuration);
        builder.Services.AddGoogleLogin(builder.Configuration);
        builder.Services.AddAdminAuthorization();
        builder.Services.AddOpenApiConfig();
        builder.Services.AddExceptionHandling();
        builder.Services.AddCorsConfig(builder.Configuration);
        builder.Services.AddSecureLogging();
        builder.Services.AddHealthChecks()
            .AddCheck<SqlServerHealthCheck>("sqlserver", failureStatus: HealthStatus.Unhealthy, tags: ["ready"], timeout: TimeSpan.FromSeconds(5));

        var app = builder.Build();
        app.UseMiddleware<Middleware.TrustedProxyMiddleware>();
        app.UseExceptionHandler();

        if (app.Configuration.GetValue("Database:ApplyMigrations", app.Environment.IsDevelopment()))
        {
            using var scope = app.Services.CreateScope();
            await DatabaseMigrationHost.MigrateAsync(scope.ServiceProvider, app.Configuration);
        }

        app.UseRouting();
        app.UseCors("DefaultPolicy");
        app.UseMiddleware<Middleware.SecurityRequestMiddleware>();
        if (app.Environment.IsDevelopment()) app.UseOpenApiConfig();

        // The public proxy terminates TLS; redirecting internal health checks causes loops.
        if (!app.Configuration.GetValue<bool>("ReverseProxy:TrustForwardedHeaders")) app.UseHttpsRedirection();

        app.UseAuthentication();
        app.UseRateLimiter();
        app.UseStaticFiles();
        app.UseSecureRequestLogging();
        app.UseAuthorization();
        app.UseMiddleware<Middleware.ActivityLoggingMiddleware>();
        app.MapControllers();

        // Liveness: confirma que el proceso HTTP responde sin depender de SQL.
        app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
        // Readiness: comprueba una conexión real desde la API hacia SQL Server.
        app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") }).AllowAnonymous();
        app.MapHub<ChannelHub>("/hubs/channel").AllowAnonymous();

        await app.RunAsync();
    }
}
