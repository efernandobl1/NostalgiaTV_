using ApplicationCore.Entities;
using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Infrastructure.Tests;

public class RetroBroadcastModelTests
{
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
