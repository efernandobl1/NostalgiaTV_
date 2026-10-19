using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ApplicationCore.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Security;

public sealed class JwtSettings
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 15;
}

/// <summary>Short-lived access tokens bound to one refresh session ("sid") and the user's session version ("sv").</summary>
public sealed class TokenIssuer(IOptions<JwtSettings> options)
{
    public const string SessionClaim = "sid";
    public const string VersionClaim = "sv";

    public string Issue(User user, string sessionHash)
    {
        var settings = options.Value;
        var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Key)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: settings.Issuer,
            audience: settings.Audience,
            claims:
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(SessionClaim, sessionHash),
                new Claim(VersionClaim, user.SessionVersion.ToString())
            ],
            expires: DateTime.UtcNow.AddMinutes(Math.Clamp(settings.AccessTokenMinutes, 1, 60)),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
