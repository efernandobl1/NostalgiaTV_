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
            foreach (var (name, limit) in new[] { ("ViewerPolicy", 120), ("PairingPolicy", 5), ("ViewerCreationPolicy", 10), ("PackagePolicy", 5) })
                options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
                    { PermitLimit = limit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            options.AddTokenBucketLimiter("AuthPolicy", o =>
            {
                o.TokenLimit = 10;
                o.ReplenishmentPeriod = TimeSpan.FromMinutes(1);
                o.TokensPerPeriod = 5;
                o.QueueLimit = 0;
            });

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
