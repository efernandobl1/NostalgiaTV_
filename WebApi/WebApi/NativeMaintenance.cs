using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using Infrastructure.Services;
using Microsoft.Data.SqlClient;

namespace WebApi;

public static class NativeMaintenance
{
    public static async Task RunAsync(string[] args)
    {
        var backupIndex = Array.IndexOf(args, "--native-backup");
        string? destination = backupIndex >= 0 && backupIndex + 1 < args.Length ? args[backupIndex + 1] : null;
        var arguments = args.Where((_, index) => index != backupIndex && (backupIndex < 0 || index != backupIndex + 1))
            .Where(argument => argument is not ("--native-health" or "--native-check-database")).ToArray();
        var builder = Host.CreateApplicationBuilder(arguments);
        if (args.Contains("--native-check-database"))
        {
            builder.Configuration.AddJsonFile("migration.private.json", optional: false);
            await DatabaseConnectionPolicy.ValidateAsync(builder.Configuration.GetConnectionString("DefaultConnection"));
            await DatabaseConnectionPolicy.ValidateAsync(builder.Configuration.GetConnectionString("MigrationConnection"), migration: true);
            await using var maintenance = await OpenMaintenanceAsync(builder.Configuration);
            return;
        }
        if (destination is not null)
        {
            builder.Configuration.AddJsonFile("migration.private.json", optional: false);
            await using var database = await OpenMaintenanceAsync(builder.Configuration);
            if (database.Database != "NostalgiaTV") throw new InvalidOperationException("Select the NostalgiaTV database for backup.");
            await using var command = database.CreateCommand();
            command.CommandTimeout = 0;
            command.CommandText = "BACKUP DATABASE [NostalgiaTV] TO DISK=@path WITH COPY_ONLY,CHECKSUM; RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM;";
            command.Parameters.AddWithValue("@path", Path.GetFullPath(destination));
            await command.ExecuteNonQueryAsync();
            return;
        }
        if (!args.Contains("--native-health")) throw new ArgumentException("Provide a backup destination.");
        var root = X509CertificateLoader.LoadCertificateFromFile(Path.Combine(builder.Environment.ContentRootPath, "certificates/local-ca.cer"));
        var origin = new Uri(builder.Configuration["NativeHosting:PublicUrl"] ?? throw new InvalidOperationException("Configure the native server URL."));
        using var handler = new HttpClientHandler
        {
            AllowAutoRedirect = false,
            ServerCertificateCustomValidationCallback = (request, certificate, _, errors) =>
            {
                if (certificate is null || request.RequestUri?.Authority != origin.Authority || errors.HasFlag(SslPolicyErrors.RemoteCertificateNameMismatch)) return false;
                using var chain = new X509Chain();
                chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
                chain.ChainPolicy.CustomTrustStore.Add(root);
                chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
                return chain.Build(certificate);
            }
        };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(10) };
        (await client.GetAsync(new Uri(origin, "/health/ready"))).EnsureSuccessStatusCode();
    }

    private static async Task<SqlConnection> OpenMaintenanceAsync(IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("MaintenanceConnection")
            ?? throw new InvalidOperationException("Configure a separate backup/verification SQL login; do not elevate the runtime or migration login.");
        var user = new SqlConnectionStringBuilder(connection).UserID;
        if (string.IsNullOrWhiteSpace(user) || new[] { "DefaultConnection", "MigrationConnection" }.Any(name =>
            new SqlConnectionStringBuilder(configuration.GetConnectionString(name)).UserID.Equals(user, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("The backup login must be different from the runtime and migration logins.");
        await DatabaseConnectionPolicy.ValidateAsync(connection, migration: true);
        var database = new SqlConnection(connection);
        try
        {
            await database.OpenAsync();
            await using var command = database.CreateCommand();
            command.CommandText = "SELECT CASE WHEN HAS_PERMS_BY_NAME(NULL,NULL,'CREATE ANY DATABASE')=1 AND (IS_ROLEMEMBER('db_backupoperator')=1 OR IS_ROLEMEMBER('db_owner')=1) THEN 1 ELSE 0 END;";
            if (Convert.ToInt32(await command.ExecuteScalarAsync()) != 1)
                throw new InvalidOperationException("Grant only the separate maintenance login CREATE ANY DATABASE for VERIFYONLY and db_backupoperator in NostalgiaTV.");
            return database;
        }
        catch
        {
            await database.DisposeAsync();
            throw;
        }
    }
}
