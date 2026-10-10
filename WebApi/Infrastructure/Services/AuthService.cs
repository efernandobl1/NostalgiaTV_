using ApplicationCore.DTOs.Auth;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Infrastructure.Contexts;
using Konscious.Security.Cryptography;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly NostalgiaTVContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthService> _logger;
        private static readonly Lazy<string> DummyHash = new(() => HashPassword(Convert.ToHexString(RandomNumberGenerator.GetBytes(32))));
        public static string TokenHash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

        public AuthService(NostalgiaTVContext context, IConfiguration configuration, ILogger<AuthService>? logger = null)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger ?? NullLogger<AuthService>.Instance;
        }

        public async Task LoginAsync(LoginRequest request, HttpResponse response, string ipAddress)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            await LockAsync("login-" + TokenHash(request.Username.ToUpperInvariant()));
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (user != null)
            {
                await LockAsync("user-" + user.Id);
                await _context.Entry(user).ReloadAsync();
            }
            var valid = user?.LockedUntilUtc > DateTime.UtcNow ? false : VerifyPassword(request.Password, user?.PasswordHash ?? DummyHash.Value);
            if (user == null || !valid || user.LockedUntilUtc > DateTime.UtcNow)
            {
                if (user != null && (user.LockedUntilUtc == null || user.LockedUntilUtc <= DateTime.UtcNow))
                {
                    user.FailedLoginAttempts++;
                    if (user.FailedLoginAttempts >= 5) user.LockedUntilUtc = DateTime.UtcNow.AddMinutes(5);
                    await _context.SaveChangesAsync();
                }
                await transaction.CommitAsync();
                _logger.LogWarning("SecurityEvent LoginRejected UserId={UserId} ClientIp={ClientIp}", user?.Id, ipAddress);
                throw new UnauthorizedException("Invalid username or password");
            }
            user.FailedLoginAttempts = 0;
            user.LockedUntilUtc = null;
            await GenerateAndSetTokens(user, response, ipAddress, request.RememberMe);
            await transaction.CommitAsync();
            _logger.LogInformation("SecurityEvent LoginSucceeded UserId={UserId} ClientIp={ClientIp}", user.Id, ipAddress);
        }

        public async Task SignInExternalAsync(int userId, HttpResponse response, string ipAddress)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            await LockAsync("user-" + userId);
            var user = await _context.Users.SingleAsync(item => item.Id == userId);
            if (user.GoogleSubject == null || user.LockedUntilUtc > DateTime.UtcNow)
                throw new UnauthorizedException("Google login is unavailable for this account.");
            await GenerateAndSetTokens(user, response, ipAddress, true);
            await transaction.CommitAsync();
        }

        public async Task RefreshTokenAsync(HttpRequest request, HttpResponse response, string ipAddress)
        {
            var value = request.Cookies["refresh_token"]
                ?? throw new UnauthorizedException("Refresh token not found");
            if (value.Length > 128) throw new UnauthorizedException("Invalid refresh token");
            var token = TokenHash(value);
            await using var transaction = await _context.Database.BeginTransactionAsync();
            await LockAsync("refresh-" + token);

            var refreshToken = await _context.RefreshTokens
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Token == token)
                ?? throw new UnauthorizedException("Invalid refresh token");
            await LockAsync("user-" + refreshToken.UserId);
            await _context.Entry(refreshToken.User).ReloadAsync();
            await _context.Entry(refreshToken).ReloadAsync();

            // Reusing a rotated token revokes the user's active sessions.
            if (refreshToken.IsRevoked)
            {
                // Parallel browser refreshes are rejected without revoking unrelated tabs.
                if (refreshToken.RevokedAt < DateTime.UtcNow.AddSeconds(-30))
                {
                    await RevokeTokenFamily(refreshToken.User, ipAddress);
                    await transaction.CommitAsync();
                    _logger.LogWarning("SecurityEvent RefreshTokenReuse UserId={UserId} ClientIp={ClientIp}", refreshToken.UserId, ipAddress);
                }
                throw new UnauthorizedException("Invalid refresh token");
            }

            if (refreshToken.IsExpired)
                throw new UnauthorizedException("Refresh token expired");

            // Preserve the original persistence preference during rotation.
            refreshToken.RevokedAt = DateTime.UtcNow;
            if (refreshToken.User.PasswordHash == AuthBootstrap.RequiredPassword)
                throw new UnauthorizedException("Administrator setup is required.");
            var (newRefreshToken, _) = await GenerateAndSetTokens(refreshToken.User, response, ipAddress, refreshToken.IsPersistent);
            refreshToken.ReplacedByToken = newRefreshToken;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }

        public async Task RevokeTokenAsync(HttpRequest request, HttpResponse response, string ipAddress)
        {
            var value = request.Cookies["refresh_token"];
            if (!string.IsNullOrEmpty(value) && value.Length <= 128)
            {
                var hash = TokenHash(value);
                await using var transaction = await _context.Database.BeginTransactionAsync();
                var token = await _context.RefreshTokens.AsNoTracking().SingleOrDefaultAsync(item => item.Token == hash);
                if (token != null)
                {
                    await LockAsync("user-" + token.UserId);
                    // Follow a concurrent rotation so logout revokes the current session too.
                    var rotations = 0;
                    while (token != null && rotations++ < 32)
                    {
                        await _context.RefreshTokens.Where(item => item.Id == token.Id && item.RevokedAt == null)
                            .ExecuteUpdateAsync(update => update.SetProperty(item => item.RevokedAt, DateTime.UtcNow));
                        var replacement = await _context.RefreshTokens.Where(item => item.Id == token.Id).Select(item => item.ReplacedByToken).SingleAsync();
                        token = replacement == null ? null : await _context.RefreshTokens.AsNoTracking()
                            .SingleOrDefaultAsync(item => item.Token == replacement && item.UserId == token.UserId);
                    }
                    if (token != null)
                        await _context.RefreshTokens.Where(item => item.UserId == token.UserId && item.RevokedAt == null)
                            .ExecuteUpdateAsync(update => update.SetProperty(item => item.RevokedAt, DateTime.UtcNow));
                }
                await transaction.CommitAsync();
            }
            var cookie = new CookieOptions { Path = "/", Secure = true, HttpOnly = true, SameSite = SameSiteMode.Lax };
            response.Cookies.Delete("access_token", cookie);
            response.Cookies.Delete("refresh_token", cookie);
            _logger.LogInformation("SecurityEvent Logout ClientIp={ClientIp}", ipAddress);
        }

        private async Task<(string refreshToken, string accessToken)> GenerateAndSetTokens(User user, HttpResponse response, string ipAddress, bool rememberMe = false)
        {
            var refreshTokenValue = GenerateRefreshTokenValue();
            var hash = TokenHash(refreshTokenValue);
            var accessToken = GenerateJwt(user, hash);

            var refreshExpiry = rememberMe ? DateTime.UtcNow.AddDays(30) : DateTime.UtcNow.AddDays(7);

            _context.RefreshTokens.Add(new RefreshToken
            {
                Token = hash,
                UserId = user.Id,
                IpAddress = ipAddress,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = refreshExpiry,
                IsPersistent = rememberMe
            });

            await _context.SaveChangesAsync();

            response.Cookies.Append("access_token", accessToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Expires = rememberMe ? new DateTimeOffset(refreshExpiry) : null,
                Path = "/"
            });

            response.Cookies.Append("refresh_token", refreshTokenValue, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Expires = rememberMe ? new DateTimeOffset(refreshExpiry) : null,
                Path = "/"
            });

            return (hash, accessToken);
        }

        private async Task RevokeTokenFamily(User user, string ipAddress)
        {
            user.SessionVersion++;
            var activeTokens = await _context.RefreshTokens
                .Where(r => r.UserId == user.Id && r.RevokedAt == null)
                .ToListAsync();

            foreach (var token in activeTokens)
                token.RevokedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        private string GenerateJwt(User user, string session)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim("sid", session),
            new Claim("sv", user.SessionVersion.ToString())
        };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(15),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private static string GenerateRefreshTokenValue() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

        private Task LockAsync(string resource) => _context.Database.ExecuteSqlInterpolatedAsync(
            $"DECLARE @result int; EXEC @result=sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @result < 0 THROW 50000, 'Authentication lock unavailable', 1;");

        public static string HashPassword(string password)
        {
            var salt = RandomNumberGenerator.GetBytes(16);
            using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
            {
                Salt = salt,
                Iterations = 4,
                MemorySize = 65536,
                DegreeOfParallelism = 2
            };
            var hash = argon2.GetBytes(32);
            return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
        }

        public static bool VerifyPassword(string password, string storedHash)
        {
            try
            {
                var parts = storedHash.Split(':');
                if (parts.Length != 2) return false;
                var salt = Convert.FromBase64String(parts[0]);
                var expectedHash = Convert.FromBase64String(parts[1]);
                if (salt.Length != 16 || expectedHash.Length != 32) return false;
                using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
                {
                    Salt = salt,
                    Iterations = 4,
                    MemorySize = 65536,
                    DegreeOfParallelism = 2
                };
                var hash = argon2.GetBytes(32);
                return CryptographicOperations.FixedTimeEquals(hash, expectedHash);
            }
            catch (FormatException) { return false; }
        }
    }
}
