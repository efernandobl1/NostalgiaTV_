using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Options;

namespace WebApi.Middleware;

// Resolve lazily: Compose starts the web proxy after the API becomes healthy.
public sealed class TrustedProxyMiddleware(RequestDelegate next, IConfiguration configuration, ILoggerFactory loggerFactory)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private IPAddress[] addresses = [];
    private DateTime expiresAt;

    public async Task InvokeAsync(HttpContext context)
    {
        var host = configuration["ReverseProxy:ProxyHost"];
        if (string.IsNullOrWhiteSpace(host) || !context.Request.Headers.ContainsKey("X-Forwarded-For"))
        { await next(context); return; }
        await gate.WaitAsync(context.RequestAborted);
        try
        {
            if (expiresAt <= DateTime.UtcNow)
            {
                try { addresses = await Dns.GetHostAddressesAsync(host, context.RequestAborted); }
                catch (SocketException) { addresses = []; }
                expiresAt = DateTime.UtcNow.AddSeconds(addresses.Length == 0 ? 5 : 30);
            }
        }
        finally { gate.Release(); }
        var remote = context.Connection.RemoteIpAddress;
        if (remote == null || !addresses.Any(address => address.MapToIPv6().Equals(remote.MapToIPv6())))
        { await next(context); return; }
        var options = new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
            ForwardLimit = 1
        };
        options.KnownProxies.Add(remote);
        await new ForwardedHeadersMiddleware(next, loggerFactory, Options.Create(options)).Invoke(context);
    }
}
