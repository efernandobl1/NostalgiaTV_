
using ApplicationCore;
using Infrastructure;
using Infrastructure.Contexts;
using Infrastructure.Hubs;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;
using Microsoft.AspNetCore.Authorization;
using WebApi.Authorization;
using WebApi.Extensions;
using WebApi.HealthChecks;

namespace WebApi
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            if (args.Contains("--media-worker"))
            {
                await MediaWorkerHost.RunAsync(args);
                return;
            }
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
            builder.Services.AddScoped<IAuthorizationHandler, MenuAccessHandler>();
            builder.Services.AddAuthorization(options =>
            {
                options.AddPolicy("Admin", policyBuilder =>
                    policyBuilder.RequireAuthenticatedUser().AddRequirements(new MenuAccessRequirement(null)));

                foreach (var (policy, menuUrl) in new[]
                {
                    ("Series", "/dashboard/series"),
                    ("Episodes", "/dashboard/episodes"),
                    ("Channels", "/dashboard/channels"),
                    ("Categories", "/dashboard/categories"),
                    ("Eras", "/dashboard/channel-eras"),
                    ("Bumpers", "/dashboard/channel-bumpers"),
                    ("Transcoding", "/dashboard/transcoding")
                })
                    options.AddPolicy(policy, policyBuilder =>
                        policyBuilder.RequireAuthenticatedUser().AddRequirements(new MenuAccessRequirement(menuUrl)));
            });
            builder.Services.AddOpenApiConfig();
            builder.Services.AddExceptionHandling();
            builder.Services.AddValidationConfig();
            builder.Services.AddCorsConfig(builder.Configuration);
            builder.Services.AddSecureLogging();
            builder.Services.AddHealthChecks()
                .AddCheck<SqlServerHealthCheck>(
                    "sqlserver",
                    failureStatus: HealthStatus.Unhealthy,
                    tags: ["ready"],
                    timeout: TimeSpan.FromSeconds(5));

            var app = builder.Build();

            await app.ApplyMigrationsAsync();

            app.UseRouting();
            app.UseCors("DefaultPolicy");

            var allowedOrigins = app.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
            app.Use(async (context, next) =>
            {
                var method = context.Request.Method;
                if (context.Request.Path.StartsWithSegments("/api") &&
                    method is not ("GET" or "HEAD" or "OPTIONS"))
                {
                    var origin = context.Request.Headers.Origin.ToString();
                    var fetchSite = context.Request.Headers["Sec-Fetch-Site"].ToString();
                    var sameOrigin = $"{context.Request.Scheme}://{context.Request.Host}";
                    var trustedOrigin = allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase);
                    var originAllowed = string.IsNullOrEmpty(origin) ||
                        origin.Equals(sameOrigin, StringComparison.OrdinalIgnoreCase) ||
                        trustedOrigin;

                    if (!originAllowed || (fetchSite is "cross-site" or "same-site") && !trustedOrigin)
                    {
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        return;
                    }
                }

                await next(context);
            });

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseOpenApiConfig();
            }

            app.UseExceptionHandler();

            // The public proxy terminates TLS; redirecting internal health checks causes loops.
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
            app.Use(async (context, next) =>
            {
                if (context.Request.Path.StartsWithSegments("/uploads/.packages", StringComparison.OrdinalIgnoreCase))
                {
                    context.Response.StatusCode = StatusCodes.Status404NotFound;
                    return;
                }
                await next(context);
            });
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
