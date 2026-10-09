using Microsoft.AspNetCore.RateLimiting;

using System.Security.Claims;
using System.Threading.RateLimiting;

namespace WebApi.Extensions;

public static class RateLimitingExtensions
{
    public static IServiceCollection AddRateLimitingConfig(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
                PartitionedRateLimiter.Create<HttpContext, string>(context =>
                context.Request.Path.StartsWithSegments("/api")
                    ? RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        _ => new FixedWindowRateLimiterOptions { PermitLimit = 300, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })
                    : RateLimitPartition.GetNoLimiter("media")),
                PartitionedRateLimiter.Create<HttpContext, string>(context =>
                    context.Request.Path.StartsWithSegments("/api/v1/auth")
                        ? RateLimitPartition.GetConcurrencyLimiter("authentication", _ => new ConcurrencyLimiterOptions { PermitLimit = 4, QueueLimit = 0 })
                        : context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName == "UploadPolicy"
                            ? RateLimitPartition.GetConcurrencyLimiter("uploads", _ => new ConcurrencyLimiterOptions { PermitLimit = 2, QueueLimit = 0 })
                            : RateLimitPartition.GetNoLimiter("ordinary")));
            options.OnRejected = (context, _) =>
            {
                context.HttpContext.Response.Headers.RetryAfter = "60";
                context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Security")
                    .LogWarning("SecurityEvent RateLimitRejected ClientIp={ClientIp} Path={Path}",
                        context.HttpContext.Connection.RemoteIpAddress, context.HttpContext.Request.Path);
                return ValueTask.CompletedTask;
            };
            foreach (var (name, limit) in new[] { ("ViewerPolicy", 120), ("PairingPolicy", 5), ("ViewerCreationPolicy", 10) })
                options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
                    { PermitLimit = limit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            options.AddPolicy("AuthPolicy", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            options.AddPolicy("UploadPolicy", context => RateLimitPartition.GetConcurrencyLimiter(
                context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous",
                _ => new ConcurrencyLimiterOptions { PermitLimit = 1, QueueLimit = 0 }));

            options.AddTokenBucketLimiter("DataPolicy", o =>
            {
                o.TokenLimit = 100;
                o.ReplenishmentPeriod = TimeSpan.FromMinutes(1);
                o.TokensPerPeriod = 50;
            });

            options.AddPolicy("CommentPolicy", context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? context.Connection.RemoteIpAddress?.ToString()
                        ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 5,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));
        });

        return services;
    }
}
