
using ApplicationCore;
using Infrastructure;
using Infrastructure.Hubs;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;
using Serilog.Events;
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
                builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
            }

            builder.Host.UseSerilog((context, config) => config.ReadFrom.Configuration(context.Configuration));

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
            builder.Services.AddHealthChecks()
                .AddCheck<SqlServerHealthCheck>(
                    "sqlserver",
                    failureStatus: HealthStatus.Unhealthy,
                    tags: ["ready"],
                    timeout: TimeSpan.FromSeconds(5));

            var app = builder.Build();

            await app.ApplyMigrationsAsync();

            app.UseCors("DefaultPolicy");
            app.UseSerilogRequestLogging(options =>
            {
                options.GetLevel = (context, _, exception) =>
                {
                    if (exception is not null || context.Response.StatusCode >= 500)
                    {
                        return LogEventLevel.Error;
                    }

                    if (context.Request.Path.StartsWithSegments("/health"))
                    {
                        return LogEventLevel.Debug;
                    }

                    return context.Response.StatusCode >= 400
                        ? LogEventLevel.Warning
                        : LogEventLevel.Information;
                };
            });

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseOpenApiConfig();
            }


            app.UseExceptionHandler();
            app.UseHttpsRedirection();
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseRateLimiter();
            app.UseStaticFiles();
            app.MapControllers();

            app.MapHealthChecks("/health", new HealthCheckOptions
            {
                Predicate = _ => false
            });
            app.MapHealthChecks("/health/ready", new HealthCheckOptions
            {
                Predicate = check => check.Tags.Contains("ready")
            });

            app.MapHub<ChannelHub>("/hubs/channel");

            app.Run();
        }
    }
}
