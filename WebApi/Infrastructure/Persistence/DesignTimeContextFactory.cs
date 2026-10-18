using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Infrastructure.Persistence;

/// <summary>Lets "dotnet ef migrations add" build the model without starting the API (no connection is opened).</summary>
public sealed class DesignTimeContextFactory : IDesignTimeDbContextFactory<NostalgiaTVContext>
{
    public NostalgiaTVContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<NostalgiaTVContext>()
        .UseSqlServer(Environment.GetEnvironmentVariable("NOSTALGIA_DESIGN_CONNECTION") ?? "Server=localhost;Database=NostalgiaTV_Design;Integrated Security=true;TrustServerCertificate=true")
        .Options);
}
