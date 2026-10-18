using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Infrastructure.Persistence;

public static class DatabaseLocks
{
    /// <summary>
    /// Exclusive application lock owned by the current transaction (sp_getapplock). It serializes
    /// work on one logical resource across API instances without requiring schema permissions.
    /// </summary>
    public static Task LockAsync(this DatabaseFacade database, string resource, CancellationToken token = default) =>
        database.ExecuteSqlInterpolatedAsync(
            $"DECLARE @result int; EXEC @result = sp_getapplock @Resource = {resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000; IF @result < 0 THROW 50000, 'Resource lock unavailable', 1;",
            token);
}
