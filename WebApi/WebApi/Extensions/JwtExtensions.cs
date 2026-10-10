using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Extensions;

public static class JwtExtensions
{
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        if (Encoding.UTF8.GetByteCount(configuration["Jwt:Key"] ?? "") < 32 ||
            string.IsNullOrWhiteSpace(configuration["Jwt:Issuer"]) || string.IsNullOrWhiteSpace(configuration["Jwt:Audience"]))
            throw new InvalidOperationException("Configure a random JWT key of at least 32 bytes, issuer and audience.");
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!)),
                    ValidateIssuer = true,
                    ValidIssuer = configuration["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = configuration["Jwt:Audience"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                    RoleClaimType = ClaimTypes.Role
                };

                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = async token =>
                    {
                        var principal = token.Principal!;
                        if (!int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ||
                            !int.TryParse(principal.FindFirstValue("sv"), out var version) ||
                            (principal.FindFirstValue("sid") ?? principal.FindFirstValue(ClaimTypes.Sid)) is not { Length: 64 } session)
                        {
                            token.Fail("Invalid session.");
                            return;
                        }
                        var database = token.HttpContext.RequestServices.GetRequiredService<NostalgiaTVContext>();
                        if (!await database.RefreshTokens.AsNoTracking().AnyAsync(item => item.Token == session &&
                            item.UserId == userId && item.User.SessionVersion == version &&
                            item.RevokedAt == null && item.ExpiresAt > DateTime.UtcNow, token.HttpContext.RequestAborted))
                            token.Fail("Session expired or revoked.");
                    },
                    OnMessageReceived = context =>
                    {
                        context.Token = context.Request.Cookies["access_token"];
                        return Task.CompletedTask;
                    }
                };
            });

        return services;
    }
}
