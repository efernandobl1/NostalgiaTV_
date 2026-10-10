using Infrastructure.Contexts;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace WebApi;

public static class DatabaseMigrationHost
{
    public static async Task RunAsync(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args.Where(argument => argument != "--migrate").ToArray());
        var connection = builder.Configuration.GetConnectionString("MigrationConnection")
            ?? throw new InvalidOperationException("Configure MigrationConnection for the isolated migration process.");
        if (!builder.Environment.IsDevelopment()) await DatabaseConnectionPolicy.ValidateAsync(connection, migration: true);
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>()
            .UseSqlServer(connection).Options);
        await context.Database.MigrateAsync();
        await AuthBootstrap.InitializeAsync(context, builder.Configuration["BootstrapAdminPassword"]);
    }
}
