
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
using WebApi.Services;
using Microsoft.Extensions.FileProviders;

namespace WebApi
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            if (args.Contains("--native-backup") || args.Contains("--native-health") || args.Contains("--native-check-database"))
            {
                await NativeMaintenance.RunAsync(args);
                return;
            }
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
            builder.Services.AddWindowsService(options => options.ServiceName = "NostalgiaTV");
            builder.Services.AddSingleton(TimeProvider.System);
            builder.Services.AddHttpClient("ServerReleases", client =>
            {
                client.Timeout = TimeSpan.FromSeconds(10);
                client.DefaultRequestHeaders.UserAgent.ParseAdd("NostalgiaTV/1.0");
            });
            builder.Services.AddSingleton(services => new ServerUpdates(
                services.GetRequiredService<IHttpClientFactory>().CreateClient("ServerReleases"),
                services.GetRequiredService<IConfiguration>(), services.GetRequiredService<TimeProvider>()));
            builder.Services.AddHostedService<UpdatePolicyPublisher>();
            if (!builder.Environment.IsDevelopment())
                await Infrastructure.Services.DatabaseConnectionPolicy.ValidateAsync(builder.Configuration.GetConnectionString("DefaultConnection"));

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
            await builder.AddProxySecurityAsync();
            builder.Services.AddControllers();
            builder.Services.AddApplicationCore(builder.Configuration);
            builder.Services.AddInfrastructure(builder.Configuration);
            builder.Services.AddApiVersioningConfig();
            builder.Services.AddRateLimitingConfig();
            builder.Services.AddJwtAuthentication(builder.Configuration);
            builder.Services.AddGoogleLogin(builder.Configuration);
            builder.Services.AddScoped<IAuthorizationHandler, MenuAccessHandler>();
            builder.Services.AddAuthorization(options =>
            {
                options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
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
            if (app.Configuration.GetValue<bool>("NativeHosting:Enabled"))
                app.Use(async (context, next) =>
                {
                    context.Response.Headers.XContentTypeOptions = "nosniff";
                    context.Response.Headers.XFrameOptions = "DENY";
                    context.Response.Headers["Referrer-Policy"] = "no-referrer";
                    context.Response.Headers.ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
                    if (context.Request.IsHttps) context.Response.Headers.StrictTransportSecurity = "max-age=31536000";
                    await next(context);
                });
            app.UseMiddleware<Middleware.TrustedProxyMiddleware>();
            app.UseExceptionHandler();

            if (app.Configuration.GetValue("Database:ApplyMigrations", app.Environment.IsDevelopment()))
                await app.ApplyMigrationsAsync();

            app.UseRouting();
            app.UseCors("DefaultPolicy");

            app.UseMiddleware<Middleware.SecurityRequestMiddleware>();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseOpenApiConfig();
            }


            // The public proxy terminates TLS; redirecting internal health checks causes loops.
            var usesTrustedReverseProxy = app.Configuration.GetValue<bool>("ReverseProxy:TrustForwardedHeaders");
            if (!usesTrustedReverseProxy)
            {
                app.UseHttpsRedirection();
            }

            app.UseAuthentication();
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
            if (app.Configuration.GetValue<bool>("NativeHosting:Enabled"))
                app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(Path.Combine(AppContext.BaseDirectory, "wwwroot")) });
            app.UseSecureRequestLogging();
            app.UseAuthorization();
            app.UseMiddleware<Middleware.ActivityLoggingMiddleware>();
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

            app.MapHub<ChannelHub>("/hubs/channel").AllowAnonymous();
            if (app.Configuration.GetValue<bool>("NativeHosting:Enabled"))
                app.MapFallback("{*path:nonfile}", async context =>
                {
                    if (new[] { "/api", "/uploads", "/hubs" }.Any(path => context.Request.Path.StartsWithSegments(path)))
                    { context.Response.StatusCode = 404; return; }
                    context.Response.ContentType = "text/html; charset=utf-8";
                    await context.Response.SendFileAsync(Path.Combine(AppContext.BaseDirectory, "wwwroot/index.html"));
                }).AllowAnonymous();

            app.Run();
        }
    }
}
