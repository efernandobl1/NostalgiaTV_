using Microsoft.AspNetCore.HttpOverrides;

namespace WebApi.Extensions;

/// <summary>
/// Configura la confianza en las cabeceras reenviadas por un proxy inverso.
/// En Docker la API no publica puertos al host: Nginx (la webapp) es su único
/// vecino en la red web y el que termina TLS, así que reenvía el esquema/IP reales.
/// </summary>
public static class ReverseProxyExtensions
{
    private const string TrustForwardedHeadersKey = "ReverseProxy:TrustForwardedHeaders";

    public static IServiceCollection AddReverseProxyConfig(this IServiceCollection services, IConfiguration configuration)
    {
        if (!configuration.GetValue<bool>(TrustForwardedHeadersKey))
        {
            return services;
        }

        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor
                | ForwardedHeaders.XForwardedHost
                | ForwardedHeaders.XForwardedProto;

            // Sólo es seguro mientras la API no publique puertos al host (ver
            // docker-compose.production.yml): Nginx es entonces el único emisor.
            options.KnownNetworks.Clear();
            options.KnownProxies.Clear();
        });

        return services;
    }

    public static WebApplication UseReverseProxyConfig(this WebApplication app)
    {
        if (app.Configuration.GetValue<bool>(TrustForwardedHeadersKey))
        {
            app.UseForwardedHeaders();
        }

        return app;
    }
}
