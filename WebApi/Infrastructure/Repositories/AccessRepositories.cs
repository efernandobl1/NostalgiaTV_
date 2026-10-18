using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Infrastructure.Persistence;
using Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public sealed class UserRepository(NostalgiaTVContext context) : IUserRepository
{
    public async Task<IReadOnlyList<UserListItem>> ListAsync()
    {
        var now = DateTime.UtcNow;
        return await context.Users.AsNoTracking().OrderBy(user => user.Username)
            .Select(user => new UserListItem(user.Id, user.Username, user.RoleId, user.Role.Name,
                user.ExternalLogins.Select(login => login.Provider).ToList(), user.FailedLoginAttempts, user.LockedUntilUtc,
                context.RefreshTokens.Count(token => token.UserId == user.Id && token.RevokedAt == null && token.ExpiresAt > now)))
            .ToListAsync();
    }

    public async Task<UserDetail> GetAsync(int id)
    {
        var now = DateTime.UtcNow;
        return await context.Users.AsNoTracking().Where(user => user.Id == id)
            .Select(user => new UserDetail(user.Id, user.Username, user.RoleId, user.Role.Name, user.FailedLoginAttempts,
                user.LockedUntilUtc, user.SessionVersion,
                context.RefreshTokens.Count(token => token.UserId == user.Id && token.RevokedAt == null && token.ExpiresAt > now),
                user.ExternalLogins.OrderBy(login => login.Provider).Select(login => new ExternalLoginItem(login.Provider, login.CreatedAtUtc)).ToList()))
            .SingleOrDefaultAsync() ?? throw new NotFoundException("Usuario no encontrado.");
    }

    public async Task<UserDetail> CreateAsync(CreateUserRequest request)
    {
        var username = request.Username.Trim();
        await RequireRoleAsync(request.RoleId);
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("login-" + Secrets.Hash(username.ToUpperInvariant()));
        if (await context.Users.AnyAsync(user => user.Username == username)) throw new ConflictException("Ese nombre de usuario ya existe.");
        var user = new User { Username = username, PasswordHash = PasswordHasher.Hash(request.Password), RoleId = request.RoleId };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return await GetAsync(user.Id);
    }

    public async Task<UserDetail> UpdateAsync(int id, UpdateUserRequest request, int actingUserId)
    {
        var username = request.Username.Trim();
        await RequireRoleAsync(request.RoleId);
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("user-" + id);
        var user = await context.Users.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Usuario no encontrado.");
        if (await context.Users.AnyAsync(item => item.Username == username && item.Id != id)) throw new ConflictException("Ese nombre de usuario ya existe.");
        if (id == actingUserId && request.RoleId != user.RoleId && user.RoleId == SeedIds.AdministratorRole)
            throw new BadRequestException("No puedes quitarte el rol de administrador a ti mismo.");
        await EnsureAnotherAdministratorAsync(user, request.RoleId);

        var roleChanged = user.RoleId != request.RoleId;
        var passwordChanged = !string.IsNullOrEmpty(request.Password);
        user.Username = username;
        user.RoleId = request.RoleId;
        if (passwordChanged)
        {
            if (request.Password!.Length < 12) throw new BadRequestException("La contraseña debe tener entre 12 y 128 caracteres.");
            if (PasswordHasher.Verify(request.Password, user.PasswordHash)) throw new BadRequestException("La nueva contraseña debe ser distinta de la actual.");
            user.PasswordHash = PasswordHasher.Hash(request.Password);
            user.FailedLoginAttempts = 0;
            user.LockedUntilUtc = null;
        }
        // A new role or password must not keep old sessions alive.
        if (roleChanged || passwordChanged) await RevokeAsync(user);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return await GetAsync(id);
    }

    public async Task DeactivateAsync(int id, int actingUserId)
    {
        if (id == actingUserId) throw new BadRequestException("No puedes desactivar tu propia cuenta.");
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("user-" + id);
        var user = await context.Users.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Usuario no encontrado.");
        await EnsureAnotherAdministratorAsync(user, null);
        user.DeletedAtUtc = DateTime.UtcNow;
        await RevokeAsync(user);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task UnlockAsync(int id)
    {
        var changed = await context.Users.Where(user => user.Id == id)
            .ExecuteUpdateAsync(update => update.SetProperty(user => user.FailedLoginAttempts, 0).SetProperty(user => user.LockedUntilUtc, (DateTime?)null));
        if (changed == 0) throw new NotFoundException("Usuario no encontrado.");
    }

    public async Task RevokeSessionsAsync(int id)
    {
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("user-" + id);
        var user = await context.Users.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Usuario no encontrado.");
        await RevokeAsync(user);
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task UnlinkExternalLoginAsync(int id, string provider)
    {
        var removed = await context.UserExternalLogins.Where(login => login.UserId == id && login.Provider == provider).ExecuteDeleteAsync();
        if (removed == 0) throw new NotFoundException("Ese inicio de sesión externo no está vinculado.");
    }

    private async Task RevokeAsync(User user)
    {
        user.SessionVersion++;
        await context.RefreshTokens.Where(token => token.UserId == user.Id && token.RevokedAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(token => token.RevokedAt, DateTime.UtcNow));
    }

    private async Task RequireRoleAsync(int roleId)
    {
        if (!await context.Roles.AnyAsync(role => role.Id == roleId)) throw new BadRequestException("El rol no existe.");
    }

    /// <summary>The platform must always keep at least one active administrator.</summary>
    private async Task EnsureAnotherAdministratorAsync(User user, int? newRoleId)
    {
        if (user.RoleId != SeedIds.AdministratorRole || newRoleId == SeedIds.AdministratorRole) return;
        if (!await context.Users.AnyAsync(item => item.Id != user.Id && item.RoleId == SeedIds.AdministratorRole))
            throw new BadRequestException("Debe quedar al menos un administrador activo.");
    }
}

public sealed class RoleRepository(NostalgiaTVContext context) : IRoleRepository
{
    public async Task<IReadOnlyList<RoleListItem>> ListAsync()
    {
        var viewerRole = await context.PlatformSettings.Select(settings => settings.ViewerRoleId).SingleAsync();
        return await context.Roles.AsNoTracking().OrderBy(role => role.Id)
            .Select(role => new RoleListItem(role.Id, role.Name, role.Description, role.Id == viewerRole, role.Id == SeedIds.AdministratorRole,
                context.Users.Count(user => user.RoleId == role.Id),
                role.Menus.Where(link => link.Menu.DeletedAtUtc == null).Select(link => link.MenuId).ToList()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<MenuItem>> ListMenusAsync() =>
        await context.Menus.AsNoTracking().OrderBy(menu => menu.ParentId ?? menu.Id).ThenBy(menu => menu.ParentId).ThenBy(menu => menu.SortOrder)
            .Select(menu => new MenuItem(menu.Id, menu.ParentId, menu.Name, menu.Caption, menu.Icon, menu.Url, menu.SortOrder, menu.IsVisible))
            .ToListAsync();

    public async Task<RoleListItem> CreateAsync(RoleRequest request)
    {
        var name = request.Name.Trim();
        if (await context.Roles.AnyAsync(role => role.Name == name)) throw new ConflictException("Ya existe un rol con ese nombre.");
        var role = new Role { Name = name, Description = request.Description?.Trim() ?? "" };
        context.Roles.Add(role);
        await context.SaveChangesAsync();
        return await GetAsync(role.Id);
    }

    public async Task<RoleListItem> UpdateAsync(int id, RoleRequest request)
    {
        var role = await context.Roles.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Rol no encontrado.");
        var name = request.Name.Trim();
        if (await context.Roles.AnyAsync(item => item.Name == name && item.Id != id)) throw new ConflictException("Ya existe un rol con ese nombre.");
        role.Name = name;
        role.Description = request.Description?.Trim() ?? "";
        await context.SaveChangesAsync();
        return await GetAsync(id);
    }

    public async Task<RoleListItem> SetMenusAsync(int id, RoleMenusRequest request)
    {
        if (id == SeedIds.AdministratorRole) throw new BadRequestException("El administrador siempre tiene acceso completo.");
        var role = await context.Roles.Include(item => item.Menus).SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Rol no encontrado.");
        var viewerRole = await context.PlatformSettings.Select(settings => settings.ViewerRoleId).SingleAsync();
        var requested = request.MenuIds.Distinct().ToList();
        if (id == viewerRole && requested.Count > 0)
            throw new BadRequestException("El rol de espectador no puede recibir permisos del panel. Asigna otro rol al usuario.");
        var menus = await context.Menus.Where(menu => requested.Contains(menu.Id)).ToListAsync();
        if (menus.Count != requested.Count) throw new BadRequestException("Uno o más menús no existen.");
        // Selecting a screen grants its group so the sidebar can show it.
        var ids = menus.Select(menu => menu.Id).Concat(menus.Where(menu => menu.ParentId != null).Select(menu => menu.ParentId!.Value)).ToHashSet();
        context.RoleMenus.RemoveRange(role.Menus.Where(link => !ids.Contains(link.MenuId)));
        foreach (var menuId in ids.Where(menuId => role.Menus.All(link => link.MenuId != menuId)))
            context.RoleMenus.Add(new RoleMenu { RoleId = id, MenuId = menuId });
        await context.SaveChangesAsync();
        return await GetAsync(id);
    }

    public async Task DeleteAsync(int id)
    {
        var viewerRole = await context.PlatformSettings.Select(settings => settings.ViewerRoleId).SingleAsync();
        if (id == SeedIds.AdministratorRole || id == viewerRole) throw new BadRequestException("Este rol del sistema no se puede eliminar.");
        var role = await context.Roles.SingleOrDefaultAsync(item => item.Id == id) ?? throw new NotFoundException("Rol no encontrado.");
        if (await context.Users.AnyAsync(user => user.RoleId == id)) throw new ConflictException("Reasigna a sus usuarios antes de eliminar el rol.");
        role.DeletedAtUtc = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    private async Task<RoleListItem> GetAsync(int id) => (await ListAsync()).Single(role => role.Id == id);
}

public sealed class ActivityRepository(NostalgiaTVContext context) : IActivityRepository
{
    public async Task LogAsync(int? userId, string action, string resource, string description, CancellationToken token = default)
    {
        context.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            Action = Truncate(action, 100),
            Resource = Truncate(resource, 400),
            Description = description,
            CreatedAtUtc = DateTime.UtcNow
        });
        await context.SaveChangesAsync(token);
    }

    public async Task<PagedResult<ActivityItem>> ListAsync(int days, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = context.ActivityLogs.AsNoTracking();
        if (days > 0) query = query.Where(log => log.CreatedAtUtc >= DateTime.UtcNow.AddDays(-days));
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(log => log.CreatedAtUtc).ThenByDescending(log => log.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(log => new ActivityItem(log.Id, log.CreatedAtUtc, log.UserId,
                log.UserId == null ? "sistema" : context.Users.IgnoreQueryFilters().Where(user => user.Id == log.UserId).Select(user => user.Username).FirstOrDefault() ?? "sistema",
                log.Action, log.Resource, log.Description))
            .ToListAsync();
        return new PagedResult<ActivityItem>(items, total, page, pageSize);
    }

    private static string Truncate(string value, int length) => value.Length > length ? value[..length] : value;
}
