using Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using WebApi.Controllers;
using WebApi.Extensions;
using Xunit;

namespace Infrastructure.Tests;

public class PublicAccountSecurityTests
{
    [Theory]
    [InlineData("https://attacker.example/tv", "/")]
    [InlineData("//attacker.example", "/")]
    [InlineData("/dashboard/users", "/")]
    [InlineData("/tv?code=ABC-DEF-GHJ-KLM&returnUrl=https://attacker.example", "/")]
    [InlineData("/tv?code=ABC-DEF-GHJ-KLM", "/tv?code=ABC-DEF-GHJ-KLM")]
    [InlineData("/tv", "/tv")]
    public void GoogleReturnUrlCannotLeaveTheViewerFlow(string requested, string expected) =>
        Assert.Equal(expected, AccountController.SafeDestination(requested));

    [Fact]
    public void GoogleConfigurationUsesPkceAndDoesNotReplaceJwtOrKeepProviderTokens()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["Authentication:Google:ClientId"] = "isolated-test-client",
            ["Authentication:Google:ClientSecret"] = "isolated-test-secret" }).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection();
        services.AddAuthentication("Bearer");
        services.AddGoogleLogin(configuration);
        using var provider = services.BuildServiceProvider();
        Assert.Equal("Bearer", provider.GetRequiredService<IOptions<AuthenticationOptions>>().Value.DefaultScheme);
        var options = provider.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(GoogleLoginExtensions.Scheme);
        Assert.True(options.UsePkce);
        Assert.False(options.SaveTokens);
        Assert.Equal("code", options.ResponseType);
        Assert.Equal("query", options.ResponseMode);
        Assert.Equal("/api/v1/auth/google/callback", options.CallbackPath.Value);
        Assert.Equal("https://accounts.google.com", options.Authority);
        var cookie = provider.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(GoogleLoginExtensions.ExternalCookie);
        Assert.True(cookie.Cookie.HttpOnly);
        Assert.Equal(Microsoft.AspNetCore.Http.CookieSecurePolicy.Always, cookie.Cookie.SecurePolicy);
    }

    [Fact]
    public void ExternalAccountsCannotUseTheirSentinelAsAPassword() =>
        Assert.False(AuthService.VerifyPassword("!google-only", "!google-only"));
}
