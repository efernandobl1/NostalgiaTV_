
using ApplicationCore;
using Infrastructure;
using Infrastructure.Contexts;
using Infrastructure.Hubs;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;
using WebApi.Extensions;
using WebApi.HealthChecks;

namespace WebApi
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            if (builder.Environment.IsDevelopment())
            {
                builder.Configuration
                    .AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true)
                    .AddEnvironmentVariables();
            }

            // No revelar el servidor (Kestrel) en las cabeceras de respuesta.
            builder.WebHost.ConfigureKestrel(o => o.AddServerHeader = false);

            builder.Host.UseSerilog((context, config) => config.ReadFrom.Configuration(context.Configuration).Enrich.FromLogContext());

            // Add services to the container.
            builder.Services.AddSignalR();
            builder.Services.AddControllers();
            builder.Services.AddApplicationCore(builder.Configuration);
            builder.Services.AddInfrastructure(builder.Configuration);
            builder.Services.AddApiVersioningConfig();
            builder.Services.AddRateLimitingConfig();
            builder.Services.AddJwtAuthentication(builder.Configuration);
            builder.Services.AddOpenApiConfig();
            builder.Services.AddExceptionHandling();
            builder.Services.AddValidationConfig();
            builder.Services.AddCorsConfig(builder.Configuration);
            builder.Services.AddReverseProxyConfig(builder.Configuration);
            builder.Services.AddSecureLogging();
            builder.Services.AddHealthChecks()
                .AddCheck<SqlServerHealthCheck>(
                    "sqlserver",
                    failureStatus: HealthStatus.Unhealthy,
                    tags: ["ready"],
                    timeout: TimeSpan.FromSeconds(5));

            var app = builder.Build();

            // Debe ir antes de HTTPS/HSTS: Nginx informa el esquema público real
            // mediante X-Forwarded-Proto cuando el despliegue usa Docker Compose.
            app.UseReverseProxyConfig();

            await app.ApplyMigrationsAsync();

            app.UseCors("DefaultPolicy");

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseOpenApiConfig();
            }

            app.UseExceptionHandler();

            // Detrás de Nginx (que ya fuerza HTTPS y termina TLS) el redirect interno
            // provocaría bucles y falsos fallos del healthcheck que llama por HTTP a Kestrel.
            var usesTrustedReverseProxy = app.Configuration.GetValue<bool>("ReverseProxy:TrustForwardedHeaders");
            if (!usesTrustedReverseProxy)
            {
                app.UseHttpsRedirection();
            }

            app.UseAuthentication();
            app.UseSecureRequestLogging();
            app.UseAuthorization();
            app.UseMiddleware<Middleware.ActivityLoggingMiddleware>();
            app.UseRateLimiter();
            app.UseStaticFiles();
            app.MapControllers();

            // Liveness: confirma que el proceso HTTP responde sin depender de SQL.
            app.MapHealthChecks("/health", new HealthCheckOptions
            {
                Predicate = _ => false
            }).AllowAnonymous();

            // Readiness: comprueba una conexión real desde la API hacia SQL Server.
            app.MapHealthChecks("/health/ready", new HealthCheckOptions
            {
                Predicate = healthCheck => healthCheck.Tags.Contains("ready")
            }).AllowAnonymous();

            app.MapHub<ChannelHub>("/hubs/channel");

            app.Run();
        }
    }
}
