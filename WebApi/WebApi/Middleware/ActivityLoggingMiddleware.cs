using System.Security.Claims;
using ApplicationCore.Interfaces.Repositories;

namespace WebApi.Middleware;

/// <summary>Records successful admin changes (Resumen → actividad reciente).</summary>
public sealed class ActivityLoggingMiddleware(RequestDelegate next, ILogger<ActivityLoggingMiddleware> logger)
{
    private static readonly HashSet<string> TrackedMethods = ["POST", "PUT", "PATCH", "DELETE"];

    public async Task InvokeAsync(HttpContext context, IActivityRepository activity)
    {
        await next(context);
        if (!ShouldTrack(context)) return;
        try
        {
            int? userId = int.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
            var username = context.User.Identity?.Name ?? "Sistema";
            var path = context.Request.Path.Value ?? "";
            var action = context.Request.Method switch { "POST" => "create", "DELETE" => "delete", _ => "edit" };
            var resource = Resource(path);
            var verb = action switch { "create" => "creó o ejecutó", "delete" => "eliminó", _ => "actualizó" };
            await activity.LogAsync(userId, action, resource, $"{username} {verb} {resource}", CancellationToken.None);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Could not persist the activity entry");
        }
    }

    private static bool ShouldTrack(HttpContext context) =>
        context.Response.StatusCode < 400 && TrackedMethods.Contains(context.Request.Method)
        && context.Request.Path.StartsWithSegments("/api/v1/admin");

    /// <summary>"/api/v1/admin/channels/3/eras" → "channels/eras".</summary>
    private static string Resource(string path)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries).Skip(3)
            .Where(segment => !segment.All(char.IsDigit) && !Guid.TryParse(segment, out _)).Take(3);
        var resource = string.Join('/', segments);
        return resource.Length == 0 ? "admin" : resource;
    }
}
