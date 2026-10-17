using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Text.Json;
using ApplicationCore.Settings;
using Microsoft.AspNetCore.Authorization;
using WebApi.Controllers;
using WebApi.Services;
using Xunit;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Tests;

public class ServerUpdateTests
{
    [Fact]
    public void UpdatesAreDisabledByDefaultAndHoursAreValidated()
    {
        var settings = new PlatformSettingsValues();
        Assert.False(settings.AutomaticUpdatesEnabled);
        Assert.Equal(3, settings.UpdateHour);
        settings.UpdateHour = 24;
        Assert.False(Validator.TryValidateObject(settings, new(settings), [], true));
    }

    [Fact]
    public void UpdateEndpointsRequireAdministratorAuthorization() =>
        Assert.Equal("Admin", typeof(ServerUpdatesController).GetCustomAttribute<AuthorizeAttribute>()!.Policy);

    [Theory]
    [InlineData("v0.3.9", false, true)]
    [InlineData("v0.3.9", true, false)]
    [InlineData("android-v0.2.9", false, false)]
    public void OnlyCompleteStableReleasesAreOffered(string tag, bool preview, bool accepted)
    {
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(new
        {
            draft = false, prerelease = preview, tag_name = tag, target_commitish = new string('a', 40),
            assets = new[] { new { name = "release.json" } }
        }));
        Assert.Equal(accepted, ServerUpdates.ParseRelease(document.RootElement) is not null);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("[]")]
    [InlineData("{\"draft\":false,\"prerelease\":false,\"tag_name\":42}")]
    public void InvalidRegistryMetadataDoesNotCrashTheDashboard(string json)
    {
        using var document = JsonDocument.Parse(json);
        Assert.Null(ServerUpdates.ParseRelease(document.RootElement));
    }

    [Fact]
    public async Task RegistryTimeoutDoesNotCrashTheDashboard()
    {
        using var client = new HttpClient(new TimeoutHandler());
        var updates = new ServerUpdates(client, new ConfigurationBuilder().Build(), TimeProvider.System);
        var status = await updates.GetAsync(CancellationToken.None);
        Assert.Null(status.Release);
        Assert.False(status.AgentConnected);
    }

    private sealed class TimeoutHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) =>
            throw new TaskCanceledException("Simulated registry timeout.");
    }
}
