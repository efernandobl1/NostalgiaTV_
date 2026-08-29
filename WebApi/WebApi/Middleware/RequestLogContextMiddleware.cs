using System.Security.Claims;
using Serilog.Context;

namespace WebApi.Middleware
{
    /// <summary>Agrega identificadores de correlación (RequestId, UserId, ClientIp) a todos los
    /// eventos de log producidos durante un request. No registra username ni datos personales.</summary>
    public class RequestLogContextMiddleware
    {
        private readonly RequestDelegate _next;
        public RequestLogContextMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext context)
        {
            var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "anonymous";
            var clientIp = context.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "unknown";

            using (LogContext.PushProperty("RequestId", context.TraceIdentifier))
            using (LogContext.PushProperty("UserId", userId))
            using (LogContext.PushProperty("ClientIp", clientIp))
                await _next(context);
        }
    }
}
