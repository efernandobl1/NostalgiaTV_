using System.Security.Claims;
using System.Text;
using ApplicationCore.Interfaces.Repositories;
using Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using WebApi.Http;

namespace WebApi.Extensions;

public static class AuthenticationExtensions
{
    /// <summary>JWT read from the HttpOnly access cookie; every request also checks that its refresh session is still active.</summary>
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        if (Encoding.UTF8.GetByteCount(configuration["Jwt:Key"] ?? "") < 32 ||
            string.IsNullOrWhiteSpace(configuration["Jwt:Issuer"]) || string.IsNullOrWhiteSpace(configuration["Jwt:Audience"]))
            throw new InvalidOperationException("Configure a random JWT key of at least 32 bytes, issuer and audience.");
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!)),
                    ValidateIssuer = true,
                    ValidIssuer = configuration["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = configuration["Jwt:Audience"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        context.Token = context.Request.Cookies[AuthCookies.Access];
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = async context =>
                    {
                        var principal = context.Principal!;
                        if (!int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ||
                            !int.TryParse(principal.FindFirstValue(TokenIssuer.VersionClaim), out var version) ||
                            (principal.FindFirstValue(TokenIssuer.SessionClaim) ?? principal.FindFirstValue(ClaimTypes.Sid)) is not { Length: 64 } session)
                        {
                            context.Fail("Invalid session.");
                            return;
                        }
                        var auth = context.HttpContext.RequestServices.GetRequiredService<IAuthRepository>();
                        if (!await auth.IsSessionActiveAsync(userId, session, version, context.HttpContext.RequestAborted))
                            context.Fail("Session expired or revoked.");
                    }
                };
            });
        return services;
    }
}
