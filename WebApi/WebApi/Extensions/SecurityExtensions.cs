using Microsoft.AspNetCore.HostFiltering;

namespace WebApi.Extensions;

public static class SecurityExtensions
{
    public static Task AddProxySecurityAsync(this WebApplicationBuilder builder)
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (!builder.Environment.IsDevelopment() && (origins.Length == 0 ||
            origins.Any(origin => !Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.AbsolutePath != "/")))
            throw new InvalidOperationException("Production requires explicit HTTPS origins.");
        var hosts = origins.Select(origin => new Uri(origin).Host).Concat(["localhost", "127.0.0.1"]).Distinct().ToList();
        builder.Services.PostConfigure<HostFilteringOptions>(options => options.AllowedHosts = hosts);
        return Task.CompletedTask;
    }
}
