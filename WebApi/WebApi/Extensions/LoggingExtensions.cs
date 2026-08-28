using System.Security.Claims;
using Serilog;
using Serilog.Events;
using WebApi.Logging;
using WebApi.Middleware;

namespace WebApi.Extensions
{
    public static class LoggingExtensions
    {
        public static IServiceCollection AddSecureLogging(this IServiceCollection services)
        {
            services.AddSingleton<IHttpPayloadLogger, HttpPayloadLogger>();
            return services;
        }

        public static IApplicationBuilder UseSecureRequestLogging(this IApplicationBuilder app)
        {
            app.UseMiddleware<RequestLogContextMiddleware>();

            app.UseSerilogRequestLogging(options =>
            {
                options.GetLevel = (context, _, exception) =>
                {
                    if (exception is not null || context.Response.StatusCode >= StatusCodes.Status500InternalServerError)
                        return LogEventLevel.Error;

                    if (context.Response.StatusCode >= StatusCodes.Status400BadRequest)
                        return LogEventLevel.Warning;

                    // Un sondeo de salud exitoso no debe ahogar el tráfico real en Docker/Loki.
                    return context.Request.Path.StartsWithSegments("/health")
                        ? LogEventLevel.Debug
                        : LogEventLevel.Information;
                };

                options.EnrichDiagnosticContext = (diagnostics, context) =>
                {
                    diagnostics.Set("RequestId", context.TraceIdentifier);
                    diagnostics.Set("UserId", context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "anonymous");
                    diagnostics.Set("ClientIp", context.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "unknown");
                };
            });

            app.UseMiddleware<RequestResponseLoggingMiddleware>();
            return app;
        }
    }
}
