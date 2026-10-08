using System.ComponentModel.DataAnnotations;
using System.Reflection;
using ApplicationCore.Entities;
using ApplicationCore.Settings;
using Infrastructure.Contexts;
using Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using WebApi.Controllers;
using Xunit;

namespace Infrastructure.Tests;

public class PlatformSettingsTests
{
    [Theory]
    [InlineData("Invalid/Zone", 24, 2, 5, 2, 2)]
    [InlineData("Central Standard Time", 24, 2, 5, 2, 2)]
    [InlineData("UTC", 73, 2, 5, 2, 2)]
    [InlineData("UTC", 24, 6, 5, 2, 2)]
    [InlineData("UTC", 24, 2, 5, 3, 2)]
    [InlineData("UTC", 24, -1, 5, 2, 2)]
    public void InvalidSettingsAreRejected(string zone, int gap, int specialsPerSeries, int specials, int moviesPerSeries, int movies)
    {
        var settings = new PlatformSettingsValues
        {
            TimeZoneId = zone, NoRepeatWindowHours = gap,
            MaxSpecialsPerSeriesPerDay = specialsPerSeries, MaxSpecialsPerDay = specials,
            MaxMoviesPerSeriesPerDay = moviesPerSeries, MaxMoviesPerDay = movies
        };
        Assert.False(Validator.TryValidateObject(settings, new(settings), [], true));
    }

    [Fact]
    public void SettingsRequireAdminWhileOnlyThePublicProjectionIsAnonymous()
    {
        var controller = typeof(PlatformSettingsController);
        Assert.Equal("Admin", controller.GetCustomAttribute<AuthorizeAttribute>()?.Policy);
        Assert.Null(controller.GetMethod("Update")!.GetCustomAttribute<AllowAnonymousAttribute>());
        Assert.Null(controller.GetMethod("Get")!.GetCustomAttribute<AllowAnonymousAttribute>());
        Assert.NotNull(controller.GetMethod("GetPublic")!.GetCustomAttribute<AllowAnonymousAttribute>());
    }

    [Fact]
    public void EpisodeAndInterludeSeasonalPoliciesAreIndependent()
    {
        var halloween = new DateTime(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);
        var christmas = new DateTime(2026, 12, 15, 12, 0, 0, DateTimeKind.Utc);
        var rules = new PlatformSettings { SeasonalInterludesEnabled = false }.ToSchedulingRules();
        Assert.Equal(InterludeSeason.AllYear, SeasonalProgrammingPolicy.InterludeSeasonAt(halloween, rules));
        Assert.True(SeasonalProgrammingPolicy.EpisodePreferenceAt(halloween, rules)!(new() { EpisodeType = new() { Name = "Halloween Special" } }));
        Assert.True(SeasonalProgrammingPolicy.EpisodePreferenceAt(christmas, rules)!(new() { EpisodeType = new() { Name = "Christmas Special" } }));
        rules = new PlatformSettings { SeasonalEpisodesEnabled = false }.ToSchedulingRules();
        Assert.Null(SeasonalProgrammingPolicy.EpisodePreferenceAt(halloween, rules));
        Assert.Equal(InterludeSeason.Halloween, SeasonalProgrammingPolicy.InterludeSeasonAt(halloween, rules));
        Assert.Null(SeasonalProgrammingPolicy.EpisodePreferenceAt(new DateTime(2026, 9, 15), new()));
    }

    [SqlMediaFact]
    public async Task MigrationPersistsSettingsAndPublishesOnlyAppearanceValues()
    {
        var database = "NostalgiaTV_SettingsTest_" + Guid.NewGuid().ToString("N");
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("NOSTALGIA_MEDIA_TEST_SQL")) { InitialCatalog = database };
        await using var context = new NostalgiaTVContext(new DbContextOptionsBuilder<NostalgiaTVContext>().UseSqlServer(connection.ConnectionString).Options);
        try
        {
            await context.Database.MigrateAsync();
            Assert.Equal(1, await context.PlatformSettings.CountAsync());
            Assert.True(await context.Menus.AnyAsync(menu => menu.Id == 12 && menu.Url == "/dashboard/settings"));
            var controller = new PlatformSettingsController(context);
            Assert.IsType<OkObjectResult>(await controller.Update(new()
            {
                SeasonalThemesEnabled = false, SeasonalEpisodesEnabled = false, TimeZoneId = "UTC", NoRepeatWindowHours = 48
            }, CancellationToken.None));
            context.ChangeTracker.Clear();
            var persisted = await context.PlatformSettings.SingleAsync();
            Assert.False(persisted.SeasonalThemesEnabled);
            Assert.False(persisted.ToSchedulingRules().SeasonalEpisodesEnabled);
            Assert.Equal(48, persisted.ToSchedulingRules().NoRepeatWindowHours);
            var result = Assert.IsType<OkObjectResult>(await controller.GetPublic(CancellationToken.None));
            var properties = result.Value!.GetType().GetProperties().Select(property => property.Name).ToArray();
            Assert.Equal(new[] { "SeasonalThemesEnabled", "SeasonalEffectsEnabled", "TimeZoneId" }, properties);
            persisted.MaxSpecialsPerSeriesPerDay = 6;
            await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        }
        finally { await context.Database.EnsureDeletedAsync(); }
    }
}
