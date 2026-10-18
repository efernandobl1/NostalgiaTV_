using System.Security.Claims;
using ApplicationCore.Entities;
using ApplicationCore.Interfaces.Repositories;
using Microsoft.AspNetCore.Authorization;

namespace WebApi.Authorization;

/// <summary>One policy per admin screen; a role may use a screen when it has the screen's menu.</summary>
public static class AdminPolicies
{
    public const string Any = "admin";
    public const string Summary = "admin:" + AdminMenuUrls.Summary;
    public const string Schedule = "admin:" + AdminMenuUrls.Schedule;
    public const string Channels = "admin:" + AdminMenuUrls.Channels;
    public const string Series = "admin:" + AdminMenuUrls.Series;
    public const string Interludes = "admin:" + AdminMenuUrls.Interludes;
    public const string Viewers = "admin:" + AdminMenuUrls.Viewers;
    public const string Comments = "admin:" + AdminMenuUrls.Comments;
    public const string Media = "admin:" + AdminMenuUrls.Media;
    public const string Access = "admin:" + AdminMenuUrls.Access;
    public const string Settings = "admin:" + AdminMenuUrls.Settings;

    private static readonly string[] Screens =
    [
        AdminMenuUrls.Summary, AdminMenuUrls.Schedule, AdminMenuUrls.Channels, AdminMenuUrls.Series, AdminMenuUrls.Interludes,
        AdminMenuUrls.Viewers, AdminMenuUrls.Comments, AdminMenuUrls.Media, AdminMenuUrls.Access, AdminMenuUrls.Settings
    ];

    public static IServiceCollection AddAdminAuthorization(this IServiceCollection services)
    {
        services.AddScoped<IAuthorizationHandler, MenuAccessHandler>();
        services.AddAuthorization(options =>
        {
            // Endpoints are private unless they opt out with [AllowAnonymous].
            options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
            options.AddPolicy(Any, policy => policy.RequireAuthenticatedUser().AddRequirements(new MenuAccessRequirement(null)));
            foreach (var url in Screens)
                options.AddPolicy("admin:" + url, policy => policy.RequireAuthenticatedUser().AddRequirements(new MenuAccessRequirement(url)));
        });
        return services;
    }
}

public sealed record MenuAccessRequirement(string? MenuUrl) : IAuthorizationRequirement;

public sealed class MenuAccessHandler(IAccountRepository accounts) : AuthorizationHandler<MenuAccessRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, MenuAccessRequirement requirement)
    {
        if (!int.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return;
        var token = (context.Resource as HttpContext)?.RequestAborted ?? CancellationToken.None;
        if (await accounts.CanAccessMenuAsync(userId, requirement.MenuUrl, token)) context.Succeed(requirement);
    }
}
