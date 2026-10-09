using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.RateLimiting;

namespace WebApi.Middleware;

public sealed class SecurityRequestMiddleware(RequestDelegate next, IConfiguration configuration,
    ILogger<SecurityRequestMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api")) { await next(context); return; }
        context.Response.Headers.CacheControl = "no-store";
        var request = context.Request;
        if (request.Method is not ("GET" or "HEAD" or "OPTIONS"))
        {
            var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
            var origin = request.Headers.Origin.ToString();
            var trusted = origins.Contains(origin, StringComparer.OrdinalIgnoreCase);
            if ((!string.IsNullOrEmpty(origin) && !trusted &&
                 !origin.Equals($"{request.Scheme}://{request.Host}", StringComparison.OrdinalIgnoreCase)) ||
                (request.Headers["Sec-Fetch-Site"].ToString() is "cross-site" or "same-site" && !trusted))
            {
                logger.LogWarning("SecurityEvent CsrfRejected ClientIp={ClientIp} Path={Path}", context.Connection.RemoteIpAddress, request.Path);
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }
        }
        var upload = context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName == "UploadPolicy";
        var sizeLimit = upload ? context.GetEndpoint()?.Metadata.GetMetadata<IRequestSizeLimitMetadata>()?.MaxRequestBodySize ?? 10L * 1024 * 1024 : 1024 * 1024;
        var feature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (feature is { IsReadOnly: false }) feature.MaxRequestBodySize = sizeLimit;
        if (request.ContentLength > sizeLimit) { context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge; return; }
        if (upload && new DriveInfo(Path.GetPathRoot(Path.GetTempPath())!).AvailableFreeSpace <
            (request.ContentLength ?? sizeLimit) + 512L * 1024 * 1024)
        {
            logger.LogWarning("SecurityEvent UploadStorageUnavailable");
            context.Response.StatusCode = StatusCodes.Status507InsufficientStorage;
            return;
        }
        await next(context);
    }
}
