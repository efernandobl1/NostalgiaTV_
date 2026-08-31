using System.Security.Claims;
using ApplicationCore.Entities;
using Infrastructure.Contexts;

namespace WebApi.Middleware;

public sealed class ActivityLoggingMiddleware
{
    private static readonly HashSet<string> TrackedMethods = ["POST", "PUT", "PATCH", "DELETE"];
    private readonly RequestDelegate _next;
    private readonly ILogger<ActivityLoggingMiddleware> _logger;

    public ActivityLoggingMiddleware(RequestDelegate next, ILogger<ActivityLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, NostalgiaTVContext database)
    {
        await _next(context);

        if (!ShouldTrack(context))
        {
            return;
        }

        try
        {
            var username = context.User.Identity?.Name ?? "Sistema";
            int? userId = int.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
                ? id
                : null;
            var path = context.Request.Path.Value ?? string.Empty;

            database.ActivityLogs.Add(new ActivityLog
            {
                UserId = userId,
                Username = username,
                Action = GetAction(context.Request.Method),
                Resource = GetResource(path),
                Description = BuildDescription(username, context.Request.Method, path),
                CreatedAtUtc = DateTime.UtcNow,
            });

            await database.SaveChangesAsync(context.RequestAborted);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Could not persist the activity entry");
        }
    }

    private static bool ShouldTrack(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        return context.Response.StatusCode < 400
            && TrackedMethods.Contains(context.Request.Method)
            && path.StartsWith("/api/v1/", StringComparison.OrdinalIgnoreCase)
            && !path.StartsWith("/api/v1/auth/", StringComparison.OrdinalIgnoreCase);
    }

    private static string GetAction(string method) => method switch
    {
        "POST" => "create",
        "PUT" or "PATCH" => "edit",
        "DELETE" => "delete",
        _ => "change",
    };

    private static string GetResource(string path)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length > 2 ? segments[2] : "dashboard";
    }

    private static string BuildDescription(string username, string method, string path)
    {
        var action = GetAction(method) switch
        {
            "create" => "creó o ejecutó",
            "edit" => "actualizó",
            "delete" => "eliminó",
            _ => "modificó",
        };

        return $"{username} {action} {GetResource(path)}";
    }
}
