using ApplicationCore.Interfaces.Repositories;
using Infrastructure;
using Infrastructure.Persistence;
using Infrastructure.Repositories;
using Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace WebApi;

/// <summary>
/// Applies the v2 schema and initializes the first administrator. A database created by the v1
/// migrations is never altered or dropped automatically: the process stops and asks for a manual reset.
/// </summary>
public static class DatabaseMigrationHost
{
    public static async Task RunAsync(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args.Where(argument => argument != "--migrate").ToArray());
        var connection = builder.Configuration.GetConnectionString("MigrationConnection")
            ?? throw new InvalidOperationException("Configure MigrationConnection for the isolated migration process.");
        if (!builder.Environment.IsDevelopment()) await DatabaseConnectionPolicy.ValidateAsync(connection, migration: true);
        builder.Services.AddDbContext<NostalgiaTVContext>(options => options.UseSqlServer(connection));
        builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
        builder.Services.AddSingleton<TokenIssuer>();
        builder.Services.AddScoped<IAuthRepository, AuthRepository>();
        using var host = builder.Build();
        using var scope = host.Services.CreateScope();
        await MigrateAsync(scope.ServiceProvider, builder.Configuration);
    }

    public static async Task MigrateAsync(IServiceProvider services, IConfiguration configuration)
    {
        var context = services.GetRequiredService<NostalgiaTVContext>();
        var known = context.Database.GetMigrations().ToHashSet();
        var foreign = (await context.Database.GetAppliedMigrationsAsync()).Where(migration => !known.Contains(migration)).ToList();
        if (foreign.Count > 0)
            throw new InvalidOperationException(
                $"The database contains {foreign.Count} migrations from the v1 schema (for example {foreign[0]}). " +
                "NostalgiaTV v2 starts from a clean database: back it up and follow docs/database/RESET.md. Nothing was changed.");
        await context.Database.MigrateAsync();
        await services.GetRequiredService<IAuthRepository>().InitializeAdministratorAsync(configuration["BootstrapAdminPassword"]);
    }
}
