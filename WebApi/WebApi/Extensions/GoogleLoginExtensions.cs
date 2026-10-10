using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;

namespace WebApi.Extensions;

public static class GoogleLoginExtensions
{
    public const string ExternalCookie = "GoogleExternal";
    public const string Scheme = "Google";

    public static bool GoogleConfigured(this IConfiguration configuration) =>
        !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientId"]) &&
        !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientSecret"]);

    public static IServiceCollection AddGoogleLogin(this IServiceCollection services, IConfiguration configuration)
    {
        if (!configuration.GoogleConfigured()) return services;
        services.AddAuthentication().AddCookie(ExternalCookie, options => {
            options.Cookie.Name = "__Host-google_external";
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.ExpireTimeSpan = TimeSpan.FromMinutes(2);
            options.SlidingExpiration = false;
        }).AddOpenIdConnect(Scheme, options => {
            options.SignInScheme = ExternalCookie;
            options.Authority = "https://accounts.google.com";
            options.ClientId = configuration["Authentication:Google:ClientId"]!;
            options.ClientSecret = configuration["Authentication:Google:ClientSecret"]!;
            options.CallbackPath = "/api/v1/auth/google/callback";
            options.ResponseType = "code";
            options.ResponseMode = "query";
            options.UsePkce = true;
            options.SaveTokens = false;
            options.MapInboundClaims = false;
            options.Scope.Clear(); options.Scope.Add("openid"); options.Scope.Add("profile"); options.Scope.Add("email");
            options.Events.OnRemoteFailure = context => {
                context.HandleResponse(); context.Response.Redirect("/login?error=google"); return Task.CompletedTask;
            };
        });
        return services;
    }
}
