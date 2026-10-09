using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Infrastructure.Services;

namespace WebApi.Extensions
{
    public static class DatabaseExtensions
    {
        public static async Task ApplyMigrationsAsync(this WebApplication app)
        {
            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<NostalgiaTVContext>();
            await db.Database.MigrateAsync();
            await AuthBootstrap.InitializeAsync(db, app.Configuration["BootstrapAdminPassword"]);
        }
    }
}
