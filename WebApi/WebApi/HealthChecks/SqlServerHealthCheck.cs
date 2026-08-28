using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace WebApi.HealthChecks;

/// <summary>
/// Comprueba que la API pueda abrir una conexión real con SQL Server usando la
/// misma cadena de conexión de la aplicación. Se usa como readiness probe.
/// </summary>
public sealed class SqlServerHealthCheck(IServiceScopeFactory scopeFactory) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();

            return await dbContext.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy("SQL Server disponible.")
                : HealthCheckResult.Unhealthy("No fue posible conectar con SQL Server.");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("No fue posible conectar con SQL Server.", exception);
        }
    }
}
