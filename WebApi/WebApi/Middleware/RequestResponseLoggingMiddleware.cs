using System.Diagnostics;
using WebApi.Logging;

namespace WebApi.Middleware;

// Record metadata only: do not buffer uploads, downloads, credentials or personal data.
public sealed class RequestResponseLoggingMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IHttpPayloadLogger logger)
    {
        if (context.Request.Path.StartsWithSegments("/health") || context.Request.Path.StartsWithSegments("/api/v1/viewer"))
        {
            await next(context);
            return;
        }
        var path = context.Request.Path.Value ?? "";
        var watch = Stopwatch.StartNew();
        logger.Request(context.Request.Method, path, context.Request.ContentLength, context.Request.ContentType, "[PAYLOAD NOT RECORDED]");
        try { await next(context); }
        finally
        {
            logger.Response(context.Request.Method, path, context.Response.StatusCode, watch.ElapsedMilliseconds,
                context.Response.ContentType, "[PAYLOAD NOT RECORDED]");
        }
    }
}
