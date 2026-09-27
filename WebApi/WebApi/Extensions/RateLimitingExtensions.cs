using Microsoft.AspNetCore.RateLimiting;

namespace WebApi.Extensions;

public static class RateLimitingExtensions
{
    public static IServiceCollection AddRateLimitingConfig(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
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
        });

        return services;
    }
}
