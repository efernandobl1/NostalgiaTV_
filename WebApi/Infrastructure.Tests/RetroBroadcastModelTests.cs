using ApplicationCore.Entities;
using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ApplicationCore.Settings;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using WebApi.Controllers;

namespace Infrastructure.Tests;

public class RetroBroadcastModelTests
{
    [Fact]
    public void SeriesSpecificClipsMustBelongToTheirEra()
    {
        using var context = CreateContext();
        var assignment = context.Model.FindEntityType(typeof(ChannelEraInterlude))!;
        var series = assignment.GetForeignKeys().Single(key => key.PrincipalEntityType.ClrType == typeof(ChannelEraSeries));
        Assert.Equal(new[] { "ChannelEraId", "SeriesId" }, series.Properties.Select(property => property.Name));
        Assert.Equal(DeleteBehavior.Restrict, series.DeleteBehavior);
    }

    [Fact]
    public async Task InvalidSeriesScopesAreRejectedBeforeQueryingTheDatabase()
    {
        using var context = CreateContext();
        var controller = new RetroBroadcastController(context, null!, null!, Options.Create(new MediaSettings()));
        Assert.IsType<BadRequestObjectResult>(await controller.AssignInterlude(1, 1, BreakRole.ProgramIntro, new(1, 0, -1)));
    }
    [Fact]
    public async Task InvalidAdvertisingSeasonsAreRejectedBeforeWritingFilesOrQueryingTheDatabase()
    {
        using var context = CreateContext();
        var controller = new RetroBroadcastController(context, null!, null!, Options.Create(new MediaSettings()));
        var invalid = (InterludeSeason)99;
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateInterlude(1, new("Bumper", null, null, null, invalid)));
        using var stream = new MemoryStream([1]);
        Assert.IsType<BadRequestObjectResult>(await controller.UploadInterlude(new()
        {
            Title = "Seasonal ad", Kind = InterludeKind.Advertisement, Season = invalid,
            File = new FormFile(stream, 0, 1, "file", "test.mp4")
        }, null!, CancellationToken.None));
    }

    private static NostalgiaTVContext CreateContext() => new(new DbContextOptionsBuilder<NostalgiaTVContext>()
        .UseSqlServer("Server=(local);Database=NostalgiaTvModelTests;Integrated Security=True;TrustServerCertificate=True")
        .Options);

    [Fact]
    public void ModelMatchesTheLatestMigration()
    {
        using var context = CreateContext();
        Assert.False(context.Database.HasPendingModelChanges());
    }

    [Fact]
    public void RepliesCannotReferenceACommentFromAnotherSeries()
    {
        using var context = CreateContext();
        var comment = context.Model.FindEntityType(typeof(SeriesComment))!;
        var parent = comment.GetForeignKeys().Single(key => key.PrincipalEntityType.ClrType == typeof(SeriesComment));
        Assert.Equal(new[] { "ParentCommentId", "SeriesId" }, parent.Properties.Select(property => property.Name));
        Assert.Equal(new[] { "Id", "SeriesId" }, parent.PrincipalKey.Properties.Select(property => property.Name));
    }

    [Fact]
    public void BreaksAndPlaybackSegmentsBelongToTheSameProgram()
    {
        using var context = CreateContext();
        var segment = context.Model.FindEntityType(typeof(ScheduledPlaybackSegment))!;
        var adBreak = segment.GetForeignKeys().Single(key => key.PrincipalEntityType.ClrType == typeof(ScheduledAdBreak));
        Assert.Equal(new[] { "ScheduledAdBreakId", "ScheduledProgramId" }, adBreak.Properties.Select(property => property.Name));
        Assert.Equal(DeleteBehavior.Restrict, adBreak.DeleteBehavior);
    }

    [Fact]
    public void EachEpisodeCutHasAUniqueOffset()
    {
        using var context = CreateContext();
        var point = context.Model.FindEntityType(typeof(EpisodeBreakPoint))!;
        Assert.Contains(point.GetIndexes(), index => index.IsUnique
            && index.Properties.Select(property => property.Name).SequenceEqual(new[] { "EpisodeId", "OffsetSeconds" }));
    }
}
