using Infrastructure.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace WebApi.Authorization;

public sealed record MenuAccessRequirement(string? MenuUrl) : IAuthorizationRequirement;

public sealed class MenuAccessHandler(NostalgiaTVContext context)
    : AuthorizationHandler<MenuAccessRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext authorizationContext,
        MenuAccessRequirement requirement)
    {
        if (!int.TryParse(authorizationContext.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return;

        var allowed = await context.Users.AnyAsync(user => user.Id == userId &&
            (user.RolId == 1 || requirement.MenuUrl != null &&
                user.Rol.Menus.Any(menu => menu.Url == requirement.MenuUrl)));

        if (allowed)
            authorizationContext.Succeed(requirement);
    }
}
