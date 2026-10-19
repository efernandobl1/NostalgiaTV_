using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using Infrastructure.Persistence;
using Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public sealed class AccountRepository(NostalgiaTVContext context) : IAccountRepository
{
    public async Task<MeResponse> GetMeAsync(int userId)
    {
        var user = await context.Users.AsNoTracking().Include(item => item.Role).Include(item => item.ExternalLogins)
            .SingleOrDefaultAsync(item => item.Id == userId) ?? throw new UnauthorizedException("La sesión ya no es válida.");
        var menus = await MenusAsync(user.RoleId);
        return new MeResponse(user.Id, user.Username, user.Role.Name, menus.Count > 0, PasswordHasher.IsUsable(user.PasswordHash),
            user.ExternalLogins.Select(login => login.Provider).Order().ToList(), menus);
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordRequest request)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("user-" + userId);
        var user = await context.Users.SingleAsync(item => item.Id == userId);
        if (PasswordHasher.IsUsable(user.PasswordHash) && !PasswordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            throw new BadRequestException("La contraseña actual no es correcta.");
        if (PasswordHasher.Verify(request.NewPassword, user.PasswordHash))
            throw new BadRequestException("La nueva contraseña debe ser distinta de la actual.");
        user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
        user.FailedLoginAttempts = 0;
        user.LockedUntilUtc = null;
        await SignOutEverywhereAsync(user);
        await transaction.CommitAsync();
    }

    public async Task RevokeAllSessionsAsync(int userId)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("user-" + userId);
        await SignOutEverywhereAsync(await context.Users.SingleAsync(item => item.Id == userId));
        await transaction.CommitAsync();
    }

    public async Task UnlinkExternalLoginAsync(int userId, string provider)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("user-" + userId);
        var user = await context.Users.Include(item => item.ExternalLogins).SingleAsync(item => item.Id == userId);
        var login = user.ExternalLogins.SingleOrDefault(item => item.Provider == provider)
            ?? throw new NotFoundException("Ese inicio de sesión externo no está vinculado.");
        // Never leave an account without any way to sign in.
        if (!PasswordHasher.IsUsable(user.PasswordHash) && user.ExternalLogins.Count == 1)
            throw new BadRequestException("Define una contraseña antes de desvincular tu único inicio de sesión.");
        context.UserExternalLogins.Remove(login);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public Task<bool> CanAccessMenuAsync(int userId, string? menuUrl, CancellationToken token) =>
        context.Users.AsNoTracking().AnyAsync(user => user.Id == userId && (user.RoleId == SeedIds.AdministratorRole
            || user.Role.Menus.Any(link => link.Menu.DeletedAtUtc == null && link.Menu.Url != ""
                && (menuUrl == null || link.Menu.Url == menuUrl))), token);

    /// <summary>Visible menus of a role as a two-level tree (group → screens).</summary>
    public async Task<IReadOnlyList<MenuNode>> MenusAsync(int roleId)
    {
        var menus = roleId == SeedIds.AdministratorRole
            ? await context.Menus.AsNoTracking().Where(menu => menu.IsVisible).ToListAsync()
            : await context.RoleMenus.AsNoTracking().Where(link => link.RoleId == roleId && link.Menu.IsVisible && link.Menu.DeletedAtUtc == null)
                .Select(link => link.Menu).ToListAsync();
        if (!menus.Any(menu => menu.Url != "")) return [];
        return menus.Where(menu => menu.ParentId == null).OrderBy(menu => menu.SortOrder)
            .Select(group => new MenuNode(group.Id, group.Name, group.Caption, group.Icon, group.Url, group.SortOrder,
                menus.Where(child => child.ParentId == group.Id).OrderBy(child => child.SortOrder)
                    .Select(child => new MenuNode(child.Id, child.Name, child.Caption, child.Icon, child.Url, child.SortOrder, [])).ToList()))
            .Where(group => group.Children.Count > 0 || group.Url != "").ToList();
    }

    private async Task SignOutEverywhereAsync(User user)
    {
        user.SessionVersion++;
        await context.SaveChangesAsync();
        await context.RefreshTokens.Where(item => item.UserId == user.Id && item.RevokedAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.RevokedAt, DateTime.UtcNow));
    }
}
