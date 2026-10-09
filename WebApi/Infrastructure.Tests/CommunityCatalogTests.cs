using WebApi.Controllers;
using Xunit;

namespace Infrastructure.Tests;

public sealed class CommunityCatalogTests
{
    [Theory]
    [InlineData("https://catalog.example/", false, "https://catalog.example")]
    [InlineData("http://127.0.0.1:4390", true, "http://127.0.0.1:4390")]
    [InlineData("http://catalog.example", false, null)]
    [InlineData("http://127.0.0.1:4390", false, null)]
    [InlineData("https://user:password@catalog.example", false, null)]
    [InlineData("https://catalog.example?token=secret", false, null)]
    [InlineData("https://catalog.example/#publish", false, null)]
    [InlineData("https://catalog.example/other", false, null)]
    [InlineData("javascript:alert(1)", true, null)]
    [InlineData("", false, null)]
    public void CatalogLinksAcceptOnlyIndependentOrigins(string input, bool development, string? expected) =>
        Assert.Equal(expected, CommunityCatalogController.ValidateUrl(input, development));
}
