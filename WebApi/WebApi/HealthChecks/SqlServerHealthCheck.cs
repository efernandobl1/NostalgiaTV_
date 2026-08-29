using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace WebApi.HealthChecks;

public sealed class SqlServerHealthCheck(NostalgiaTVContext context) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext healthCheckContext,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await context.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("SQL Server is unavailable.");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("SQL Server readiness check failed.", exception);
        }
    }
}
