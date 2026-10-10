using Microsoft.Data.SqlClient;
using System.Data.Common;

namespace Infrastructure.Services;

public static class DatabaseConnectionPolicy
{
    public static async Task ValidateAsync(string? connection, bool migration = false)
    {
        Validate(connection);
        await using var database = new SqlConnection(connection);
        await database.OpenAsync();
        await ValidatePermissionsAsync(database, migration);
    }

    public static async Task ValidatePermissionsAsync(DbConnection database, bool migration = false)
    {
        await using var command = database.CreateCommand();
        command.CommandTimeout = 15;
        command.CommandText = """
            SELECT CASE WHEN
                IS_SRVROLEMEMBER('sysadmin') = 1 OR IS_SRVROLEMEMBER('securityadmin') = 1 OR
                HAS_PERMS_BY_NAME(NULL, NULL, 'CONTROL SERVER') = 1 OR
                HAS_PERMS_BY_NAME(NULL, NULL, 'ALTER ANY LOGIN') = 1 OR
                (@migration = 0 AND (
                    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CONTROL') = 1 OR
                    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER') = 1 OR
                    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') = 1 OR
                    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER ANY USER') = 1))
                THEN 1 ELSE 0 END;
            """;
        var parameter = command.CreateParameter();
        parameter.ParameterName = "@migration";
        parameter.Value = migration;
        command.Parameters.Add(parameter);
        if (Convert.ToInt32(await command.ExecuteScalarAsync()) != 0)
            throw new InvalidOperationException("Use a database-scoped migration account and a runtime account without administrative or schema permissions.");
    }

    public static void Validate(string? connection)
    {
        if (string.IsNullOrWhiteSpace(connection)) throw new InvalidOperationException("A database connection is required.");
        var settings = new SqlConnectionStringBuilder(connection);
        if (settings.UserID.Equals("sa", StringComparison.OrdinalIgnoreCase) || settings.PersistSecurityInfo ||
            settings.TrustServerCertificate || settings.Encrypt == SqlConnectionEncryptOption.Optional)
            throw new InvalidOperationException("Production requires a dedicated SQL login and verified TLS; sa, disabled encryption and TrustServerCertificate are not allowed.");
    }
}
