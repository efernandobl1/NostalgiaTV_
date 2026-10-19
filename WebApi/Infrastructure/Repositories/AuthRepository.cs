using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Configurations;
using Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Repositories;

public sealed class AuthRepository(NostalgiaTVContext context, TokenIssuer tokens, ILogger<AuthRepository> logger) : IAuthRepository
{
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(5);
    /// <summary>Parallel browser tabs may refresh with the same token; only older reuse is treated as theft.</summary>
    private static readonly TimeSpan ReuseGrace = TimeSpan.FromSeconds(30);

    public async Task<AuthTokens> LoginAsync(LoginRequest request, string ipAddress)
    {
        var username = request.Username.Trim();
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("login-" + Secrets.Hash(username.ToUpperInvariant()));
        var user = await context.Users.SingleOrDefaultAsync(item => item.Username == username);
        if (user != null)
        {
            await context.Database.LockAsync("user-" + user.Id);
            await context.Entry(user).ReloadAsync();
        }
        var now = DateTime.UtcNow;
        var locked = user?.LockedUntilUtc > now;
        // Always run Argon2 so unknown usernames and locked accounts take as long as wrong passwords.
        var valid = PasswordHasher.Verify(request.Password, user?.PasswordHash ?? PasswordHasher.DummyHash) && !locked;
        if (user == null || !valid || user.PasswordHash == SeedData.BootstrapPasswordHash)
        {
            if (user != null && !locked)
            {
                user.FailedLoginAttempts++;
                if (user.FailedLoginAttempts >= MaxFailedAttempts) user.LockedUntilUtc = now.Add(LockoutDuration);
                await context.SaveChangesAsync();
            }
            await transaction.CommitAsync();
            logger.LogWarning("SecurityEvent LoginRejected UserId={UserId} ClientIp={ClientIp}", user?.Id, ipAddress);
            throw new UnauthorizedException(locked
                ? $"Cuenta bloqueada por intentos fallidos. Intenta de nuevo a las {user!.LockedUntilUtc:HH:mm} UTC."
                : "Usuario o contraseña incorrectos.");
        }
        user.FailedLoginAttempts = 0;
        user.LockedUntilUtc = null;
        var issued = await IssueAsync(user, ipAddress, request.RememberMe);
        await transaction.CommitAsync();
        logger.LogInformation("SecurityEvent LoginSucceeded UserId={UserId} ClientIp={ClientIp}", user.Id, ipAddress);
        return issued;
    }

    public async Task<AuthTokens> LoginExternalAsync(string provider, string subject, string ipAddress)
    {
        if (string.IsNullOrWhiteSpace(subject) || subject.Length > 255) throw new UnauthorizedException("Identidad externa no válida.");
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync($"external-{provider}-" + Secrets.Hash(subject));
        // Include deactivated owners: their identity must not be re-registered as a new account.
        var login = await context.UserExternalLogins.IgnoreQueryFilters().Include(item => item.User)
            .SingleOrDefaultAsync(item => item.Provider == provider && item.Subject == subject);
        User user;
        if (login?.User is { DeletedAtUtc: null } existing) user = existing;
        else
        {
            if (login != null) throw new UnauthorizedException("Esta cuenta está desactivada.");
            if (!await RegistrationEnabledAsync()) throw new ForbiddenException("El administrador no permite crear cuentas en este servidor.");
            var viewerRole = await context.PlatformSettings.Select(settings => settings.ViewerRoleId).SingleAsync();
            // The stable provider subject, never an e-mail match, owns the account.
            user = new User
            {
                Username = $"{provider}-{Secrets.NewToken(6).ToLowerInvariant()}",
                PasswordHash = "!external-only",
                RoleId = viewerRole
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();
            context.UserExternalLogins.Add(new UserExternalLogin { Provider = provider, Subject = subject, UserId = user.Id, CreatedAtUtc = DateTime.UtcNow });
            await context.SaveChangesAsync();
        }
        await context.Database.LockAsync("user-" + user.Id);
        if (user.LockedUntilUtc > DateTime.UtcNow) throw new UnauthorizedException("La cuenta está bloqueada temporalmente.");
        var issued = await IssueAsync(user, ipAddress, persistent: true);
        await transaction.CommitAsync();
        logger.LogInformation("SecurityEvent ExternalLoginSucceeded UserId={UserId} Provider={Provider} ClientIp={ClientIp}", user.Id, provider, ipAddress);
        return issued;
    }

    public async Task<AuthTokens> RefreshAsync(string refreshToken, string ipAddress)
    {
        if (string.IsNullOrEmpty(refreshToken) || refreshToken.Length > 128) throw new UnauthorizedException("Sesión no válida.");
        var hash = Secrets.Hash(refreshToken);
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("refresh-" + hash);
        var token = await context.RefreshTokens.SingleOrDefaultAsync(item => item.Token == hash)
            ?? throw new UnauthorizedException("Sesión no válida.");
        await context.Database.LockAsync("user-" + token.UserId);
        await context.Entry(token).ReloadAsync();
        var user = await context.Users.SingleOrDefaultAsync(item => item.Id == token.UserId)
            ?? throw new UnauthorizedException("Sesión no válida.");

        var now = DateTime.UtcNow;
        if (token.RevokedAt != null)
        {
            // Reusing a rotated token means it leaked: sign the account out everywhere.
            if (token.RevokedAt < now - ReuseGrace)
            {
                await RevokeEverythingAsync(user);
                await transaction.CommitAsync();
                logger.LogWarning("SecurityEvent RefreshTokenReuse UserId={UserId} ClientIp={ClientIp}", user.Id, ipAddress);
            }
            throw new UnauthorizedException("Sesión no válida.");
        }
        if (token.ExpiresAt <= now) throw new UnauthorizedException("La sesión expiró.");

        token.RevokedAt = now;
        var issued = await IssueAsync(user, ipAddress, token.IsPersistent);
        token.ReplacedByTokenId = await context.RefreshTokens.Where(item => item.Token == Secrets.Hash(issued.RefreshToken))
            .Select(item => item.Id).SingleAsync();
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return issued;
    }

    public async Task RevokeAsync(string? refreshToken, string ipAddress)
    {
        if (string.IsNullOrEmpty(refreshToken) || refreshToken.Length > 128) return;
        var hash = Secrets.Hash(refreshToken);
        await using var transaction = await context.Database.BeginTransactionAsync();
        var token = await context.RefreshTokens.AsNoTracking().SingleOrDefaultAsync(item => item.Token == hash);
        if (token != null)
        {
            await context.Database.LockAsync("user-" + token.UserId);
            // Follow concurrent rotations so logout also ends the newest session of this chain.
            var current = (int?)token.Id;
            for (var hops = 0; current != null && hops < 32; hops++)
            {
                var id = current.Value;
                await context.RefreshTokens.Where(item => item.Id == id && item.RevokedAt == null)
                    .ExecuteUpdateAsync(update => update.SetProperty(item => item.RevokedAt, DateTime.UtcNow));
                current = await context.RefreshTokens.Where(item => item.Id == id).Select(item => item.ReplacedByTokenId).SingleAsync();
            }
        }
        await transaction.CommitAsync();
        logger.LogInformation("SecurityEvent Logout ClientIp={ClientIp}", ipAddress);
    }

    public async Task RegisterAsync(RegisterRequest request)
    {
        if (!await RegistrationEnabledAsync()) throw new ForbiddenException("El administrador no permite crear cuentas en este servidor.");
        var username = request.Username.Trim();
        await using var transaction = await context.Database.BeginTransactionAsync();
        await context.Database.LockAsync("login-" + Secrets.Hash(username.ToUpperInvariant()));
        if (await context.Users.IgnoreQueryFilters().AnyAsync(user => user.Username == username && user.DeletedAtUtc == null))
            throw new ConflictException("Ese nombre de usuario no está disponible.");
        var viewerRole = await context.PlatformSettings.Select(settings => settings.ViewerRoleId).SingleAsync();
        context.Users.Add(new User { Username = username, PasswordHash = PasswordHasher.Hash(request.Password), RoleId = viewerRole });
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public Task<bool> IsSessionActiveAsync(int userId, string sessionHash, int sessionVersion, CancellationToken token) =>
        context.RefreshTokens.AsNoTracking().AnyAsync(item => item.Token == sessionHash && item.UserId == userId
            && item.User.SessionVersion == sessionVersion && item.User.DeletedAtUtc == null
            && item.RevokedAt == null && item.ExpiresAt > DateTime.UtcNow, token);

    public async Task InitializeAdministratorAsync(string? password)
    {
        var admin = await context.Users.SingleOrDefaultAsync(user => user.Id == SeedIds.BootstrapAdmin);
        if (admin?.PasswordHash != SeedData.BootstrapPasswordHash) return;
        if (password is null || password.Length is < 12 or > 128)
            throw new InvalidOperationException("Set BootstrapAdminPassword to a unique password of 12 to 128 characters before initializing the administrator.");
        admin.PasswordHash = PasswordHasher.Hash(password);
        admin.SessionVersion++;
        await context.SaveChangesAsync();
    }

    public Task<bool> RegistrationEnabledAsync() =>
        context.PlatformSettings.Select(settings => settings.PublicRegistrationEnabled).SingleAsync();

    /// <summary>Removes expired refresh tokens, viewer devices and short-lived codes.</summary>
    public async Task<int> CleanupExpiredAsync(CancellationToken token)
    {
        var now = DateTime.UtcNow;
        var expired = context.RefreshTokens.Where(item => item.ExpiresAt < now).Select(item => item.Id);
        // Rotation links point at newer tokens; detach them before the targets are deleted.
        await context.RefreshTokens.Where(item => item.ReplacedByTokenId != null && expired.Contains(item.ReplacedByTokenId.Value))
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.ReplacedByTokenId, (int?)null), token);
        var removed = await context.RefreshTokens.Where(item => item.ExpiresAt < now).ExecuteDeleteAsync(token);
        await context.ViewerPairingCodes.Where(item => item.ExpiresAtUtc < now || item.Device.ExpiresAtUtc < now).ExecuteDeleteAsync(token);
        await context.DeviceAuthorizations.Where(item => item.ExpiresAtUtc < now).ExecuteDeleteAsync(token);
        removed += await context.ViewerDevices.Where(item => item.ExpiresAtUtc < now).ExecuteDeleteAsync(token);
        return removed;
    }

    private async Task<AuthTokens> IssueAsync(User user, string ipAddress, bool persistent)
    {
        var value = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
        var hash = Secrets.Hash(value);
        var now = DateTime.UtcNow;
        var expires = now.AddDays(persistent ? 30 : 7);
        context.RefreshTokens.Add(new RefreshToken
        {
            Token = hash,
            UserId = user.Id,
            IpAddress = ipAddress.Length > 45 ? ipAddress[..45] : ipAddress,
            IsPersistent = persistent,
            CreatedAt = now,
            ExpiresAt = expires
        });
        await context.SaveChangesAsync();
        return new AuthTokens(tokens.Issue(user, hash), value, expires, persistent);
    }

    private async Task RevokeEverythingAsync(User user)
    {
        user.SessionVersion++;
        await context.SaveChangesAsync();
        await context.RefreshTokens.Where(item => item.UserId == user.Id && item.RevokedAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.RevokedAt, DateTime.UtcNow));
    }
}
