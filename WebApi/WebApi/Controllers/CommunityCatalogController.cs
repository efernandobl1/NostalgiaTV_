using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers;

[ApiController, ApiVersion("1"), Authorize(Policy = "Admin")]
[Route("api/v{version:apiVersion}/community-catalog")]
public sealed class CommunityCatalogController(IConfiguration configuration, IHostEnvironment environment) : ControllerBase
{
    [HttpGet]
    public IActionResult Configuration() => Ok(new
    {
        publicUrl = ValidateUrl(configuration["CommunityCatalog:PublicUrl"], environment.IsDevelopment()),
    });

    public static string? ValidateUrl(string? value, bool development)
    {
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
            || !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment) || uri.AbsolutePath != "/") return null;
        if (uri.Scheme != Uri.UriSchemeHttps && !(development && uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback)) return null;
        return uri.GetLeftPart(UriPartial.Authority);
    }
}
