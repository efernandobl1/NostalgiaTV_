using ApplicationCore.DTOs.Auth;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces;
using Azure;
using Infrastructure.Contexts;
using Konscious.Security.Cryptography;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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

        public AuthService(NostalgiaTVContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task LoginAsync(LoginRequest request, HttpResponse response, string ipAddress)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == request.Username)
                ?? throw new UnauthorizedException("Invalid username or password");

            if (!VerifyPassword(request.Password, user.PasswordHash))
                throw new UnauthorizedException("Invalid username or password");

            await GenerateAndSetTokens(user, response, ipAddress, request.RememberMe);
        }

        public async Task RefreshTokenAsync(HttpRequest request, HttpResponse response, string ipAddress)
        {
            var token = request.Cookies["refresh_token"]
                ?? throw new UnauthorizedException("Refresh token not found");

            var refreshToken = await _context.RefreshTokens
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Token == token)
                ?? throw new UnauthorizedException("Invalid refresh token");

            // Token ya usado — posible robo, revocar toda la familia
            if (refreshToken.IsRevoked)
            {
                await RevokeTokenFamily(refreshToken.User, ipAddress);
                throw new UnauthorizedException("Token reuse detected, all sessions revoked");
            }

            if (refreshToken.IsExpired)
                throw new UnauthorizedException("Refresh token expired");

            // Revocar el token actual y generar nuevos
            refreshToken.RevokedAt = DateTime.UtcNow;
            var (newRefreshToken, _) = await GenerateAndSetTokens(refreshToken.User, response, ipAddress);
            refreshToken.ReplacedByToken = newRefreshToken;

            await _context.SaveChangesAsync();
        }

        public async Task RevokeTokenAsync(HttpRequest request, HttpResponse response, string ipAddress)
        {
            var token = request.Cookies["refresh_token"]
                ?? throw new UnauthorizedException("Refresh token not found");

            var refreshToken = await _context.RefreshTokens
                .FirstOrDefaultAsync(r => r.Token == token)
                ?? throw new UnauthorizedException("Invalid refresh token");

            if (!refreshToken.IsActive)
                throw new UnauthorizedException("Token already revoked or expired");

            refreshToken.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            response.Cookies.Delete("access_token");
            response.Cookies.Delete("refresh_token");
        }

        private async Task<(string refreshToken, string accessToken)> GenerateAndSetTokens(User user, HttpResponse response, string ipAddress, bool rememberMe = false)
        {
            var accessToken = GenerateJwt(user);
            var refreshTokenValue = GenerateRefreshTokenValue();

            var refreshExpiry = rememberMe ? DateTime.UtcNow.AddDays(30) : DateTime.UtcNow.AddDays(7);

            _context.RefreshTokens.Add(new RefreshToken
            {
                Token = refreshTokenValue,
                UserId = user.Id,
                IpAddress = ipAddress,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = refreshExpiry
            });

            await _context.SaveChangesAsync();

            response.Cookies.Append("access_token", accessToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.None,
                Expires = rememberMe ? DateTimeOffset.UtcNow.AddDays(30) : null
            });

            response.Cookies.Append("refresh_token", refreshTokenValue, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.None,
                Expires = rememberMe ? DateTimeOffset.UtcNow.AddDays(30) : null
            });

            return (refreshTokenValue, accessToken);
        }

        private async Task RevokeTokenFamily(User user, string ipAddress)
        {
            var activeTokens = await _context.RefreshTokens
                .Where(r => r.UserId == user.Id && r.RevokedAt == null)
                .ToListAsync();

            foreach (var token in activeTokens)
                token.RevokedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        private string GenerateJwt(User user)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username)
        };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private static string GenerateRefreshTokenValue() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

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
            var parts = storedHash.Split(':');
            var salt = Convert.FromBase64String(parts[0]);
            var expectedHash = Convert.FromBase64String(parts[1]);
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
    }
}
