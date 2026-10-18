using ApplicationCore.DTOs;
using ApplicationCore.Entities;
using ApplicationCore.Exceptions;
using ApplicationCore.Interfaces.Repositories;
using ApplicationCore.Models;
using Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Infrastructure.Tests;

public class AudienceIntegrationTests
{
    [SqlFact]
    public async Task MigrationSeedsTheV2CatalogAndFailsClosedOnV1Databases()
    {
        await using var server = await TestServer.StartAsync();
        Assert.Equal(3, await server.DbAsync(context => context.Roles.CountAsync()));
        Assert.Equal(5, await server.DbAsync(context => context.EpisodeTypes.CountAsync()));
        Assert.Equal(SeedIds.ViewerRole, await server.DbAsync(context => context.PlatformSettings.Select(item => item.ViewerRoleId).SingleAsync()));
        var tokens = await server.RunAsync<IAuthRepository, AuthTokens>(auth => auth.LoginAsync(new("admin", TestServer.AdminPassword, false), "127.0.0.1"));
        Assert.NotEmpty(tokens.AccessToken);

        // A database that still carries v1 migrations is never touched.
        await server.DbAsync(context => context.Database.ExecuteSqlRawAsync(
            "INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ('20261005213850_AddRetroBroadcastModel', '10.0.0')"));
        await using var scope = server.Scope();
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            WebApi.DatabaseMigrationHost.MigrateAsync(scope.ServiceProvider, new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build()));
        Assert.Contains("RESET.md", error.Message);
    }

    [SqlFact]
    public async Task LoginLocksOutAndRefreshTokenReuseSignsEverythingOut()
    {
        await using var server = await TestServer.StartAsync();
        await Assert.ThrowsAsync<ForbiddenException>(() => server.RunAsync<IAuthRepository>(auth => auth.RegisterAsync(new("viewer.one", "viewer-password-123"))));
        await server.DbAsync(context => context.PlatformSettings.ExecuteUpdateAsync(update => update.SetProperty(item => item.PublicRegistrationEnabled, true)));
        await server.RunAsync<IAuthRepository>(auth => auth.RegisterAsync(new("viewer.one", "viewer-password-123")));
        await Assert.ThrowsAsync<ConflictException>(() => server.RunAsync<IAuthRepository>(auth => auth.RegisterAsync(new("viewer.one", "viewer-password-123"))));

        for (var attempt = 0; attempt < 5; attempt++)
            await Assert.ThrowsAsync<UnauthorizedException>(() => server.RunAsync<IAuthRepository, AuthTokens>(auth =>
                auth.LoginAsync(new("viewer.one", "wrong-password", false), "127.0.0.1")));
        await Assert.ThrowsAsync<UnauthorizedException>(() => server.RunAsync<IAuthRepository, AuthTokens>(auth =>
            auth.LoginAsync(new("viewer.one", "viewer-password-123", false), "127.0.0.1")));
        await server.RunAsync<IUserRepository>(async users =>
            await users.UnlockAsync(await server.DbAsync(context => context.Users.Where(user => user.Username == "viewer.one").Select(user => user.Id).SingleAsync())));

        var first = await server.RunAsync<IAuthRepository, AuthTokens>(auth => auth.LoginAsync(new("viewer.one", "viewer-password-123", true), "127.0.0.1"));
        var second = await server.RunAsync<IAuthRepository, AuthTokens>(auth => auth.RefreshAsync(first.RefreshToken, "127.0.0.1"));
        Assert.True(second.Persistent);
        var user = await server.DbAsync(context => context.Users.SingleAsync(item => item.Username == "viewer.one"));
        Assert.True(await server.RunAsync<IAuthRepository, bool>(auth => auth.IsSessionActiveAsync(user.Id, Secrets.Hash(second.RefreshToken), user.SessionVersion, default)));
        Assert.False(await server.RunAsync<IAuthRepository, bool>(auth => auth.IsSessionActiveAsync(user.Id, Secrets.Hash(first.RefreshToken), user.SessionVersion, default)));

        // Replaying the rotated token after the grace period means it leaked.
        await server.DbAsync(context => context.RefreshTokens.Where(item => item.Token == Secrets.Hash(first.RefreshToken))
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.RevokedAt, DateTime.UtcNow.AddMinutes(-5))));
        await Assert.ThrowsAsync<UnauthorizedException>(() => server.RunAsync<IAuthRepository, AuthTokens>(auth => auth.RefreshAsync(first.RefreshToken, "127.0.0.1")));
        var version = await server.DbAsync(context => context.Users.Where(item => item.Id == user.Id).Select(item => item.SessionVersion).SingleAsync());
        Assert.Equal(user.SessionVersion + 1, version);
        Assert.False(await server.RunAsync<IAuthRepository, bool>(auth => auth.IsSessionActiveAsync(user.Id, Secrets.Hash(second.RefreshToken), version, default)));
    }

    [SqlFact]
    public async Task ViewerHistoryFollowsPairingSignInAndTvAuthorization()
    {
        await using var server = await TestServer.StartAsync();
        var episodeId = await SeedEpisodeAsync(server);
        await server.DbAsync(context => context.PlatformSettings.ExecuteUpdateAsync(update => update.SetProperty(item => item.PublicRegistrationEnabled, true)));
        await server.RunAsync<IAuthRepository>(auth => auth.RegisterAsync(new("family", "family-password-123")));
        var userId = await server.DbAsync(context => context.Users.Where(user => user.Username == "family").Select(user => user.Id).SingleAsync());

        var phone = await server.RunAsync<IViewerRepository, ViewerSessionStart>(viewers => viewers.StartSessionAsync(null, null, new("Teléfono")));
        var laptop = await server.RunAsync<IViewerRepository, ViewerSessionStart>(viewers => viewers.StartSessionAsync(null, null, new("Laptop")));
        Assert.NotNull(phone.SetToken);
        Assert.NotEqual(phone.Session.ProfileId, laptop.Session.ProfileId);
        var saved = await server.RunAsync<IViewerRepository, ProgressSaved>(viewers =>
            viewers.SaveProgressAsync(phone.SetToken, new(episodeId, 0, 40, 40, 40)));
        Assert.True(saved.Completed);
        await Assert.ThrowsAsync<BadRequestException>(() => server.RunAsync<IViewerRepository, ProgressSaved>(viewers =>
            viewers.SaveProgressAsync(phone.SetToken, new(episodeId, double.NaN, 40, 40, 40))));

        // Pairing moves the phone into the laptop's profile and keeps its history.
        var code = await server.RunAsync<IViewerRepository, PairingCode>(viewers => viewers.CreatePairingCodeAsync(phone.SetToken));
        await server.RunAsync<IViewerRepository>(viewers => viewers.PairAsync(laptop.SetToken, new(code.Code)));
        await Assert.ThrowsAsync<BadRequestException>(() => server.RunAsync<IViewerRepository>(viewers => viewers.PairAsync(laptop.SetToken, new(code.Code))));
        var merged = (await server.RunAsync<IViewerRepository, ViewerSession?>(viewers => viewers.GetSessionAsync(phone.SetToken)))!;
        Assert.Equal(laptop.Session.ProfileId, merged.ProfileId);
        Assert.Equal(2, merged.Devices.Count);
        Assert.True(Assert.Single(merged.Progress).Completed);

        // Signing in adopts the anonymous profile as the account profile.
        var signedIn = await server.RunAsync<IViewerRepository, ViewerSessionStart>(viewers => viewers.StartSessionAsync(laptop.SetToken, userId, new("Laptop")));
        Assert.Null(signedIn.SetToken);
        Assert.True(signedIn.Session.AccountLinked);
        Assert.Equal(laptop.Session.ProfileId, signedIn.Session.ProfileId);

        // TV sign-in: start, poll, approve from the laptop, redeem.
        var tv = await server.RunAsync<IViewerRepository, DeviceAuthorizationStart>(viewers => viewers.StartAuthorizationAsync(new("Sala"), null, null));
        Assert.Equal(RedeemStatus.Pending, (await server.RunAsync<IViewerRepository, RedeemResult>(viewers => viewers.RedeemAuthorizationAsync(tv.DeviceCode))).Status);
        Assert.Equal(RedeemStatus.SlowDown, (await server.RunAsync<IViewerRepository, RedeemResult>(viewers => viewers.RedeemAuthorizationAsync(tv.DeviceCode))).Status);
        Assert.Equal("Sala", (await server.RunAsync<IViewerRepository, DeviceAuthorizationInfo>(viewers => viewers.InspectAuthorizationAsync(tv.UserCode))).Name);
        await server.RunAsync<IViewerRepository>(viewers => viewers.ApproveAuthorizationAsync(userId, tv.UserCode, laptop.SetToken));
        server.Services.GetRequiredService<IMemoryCache>().Remove("device-poll-" + Secrets.Hash(tv.DeviceCode));
        var redeemed = await server.RunAsync<IViewerRepository, RedeemResult>(viewers => viewers.RedeemAuthorizationAsync(tv.DeviceCode));
        Assert.Equal(RedeemStatus.Connected, redeemed.Status);
        var tvSession = (await server.RunAsync<IViewerRepository, ViewerSession?>(viewers => viewers.GetSessionAsync(redeemed.SetToken)))!;
        Assert.Equal(laptop.Session.ProfileId, tvSession.ProfileId);
        Assert.Equal("family", tvSession.Username);
        Assert.Equal(3, tvSession.Devices.Count);

        // "Cerrar sesión en todos los dispositivos" also signs out every viewer device of the account.
        await server.RunAsync<IAccountRepository>(accounts => accounts.RevokeAllSessionsAsync(userId));
        Assert.Null(await server.RunAsync<IViewerRepository, ViewerSession?>(viewers => viewers.GetSessionAsync(redeemed.SetToken)));
        Assert.Null(await server.RunAsync<IViewerRepository, ViewerSession?>(viewers => viewers.GetSessionAsync(phone.SetToken)));

        var kpis = await server.RunAsync<IViewerRepository, ViewerKpis>(viewers => viewers.KpisAsync());
        Assert.Equal(1, kpis.LinkedProfiles);
        Assert.Equal(1, kpis.EpisodesCompleted7d);
    }

    [SqlFact]
    public async Task CommentsWaitForModerationAndRepliesStayInTheirSeries()
    {
        await using var server = await TestServer.StartAsync();
        await SeedEpisodeAsync(server);
        var seriesId = await server.DbAsync(context => context.Series.Select(series => series.Id).SingleAsync());
        var other = await server.RunAsync<ISeriesRepository, SeriesDetail>(series => series.CreateAsync(new("Otra", null, null, null, new DateOnly(1980, 1, 1), null, null), null));
        var admin = SeedIds.BootstrapAdmin;

        var posted = await server.RunAsync<ICommentRepository, CommentPosted>(comments => comments.PostSeriesCommentAsync(seriesId, admin, new("¡Qué recuerdos!")));
        Assert.Equal(CommentStatus.Pending, posted.Status);
        Assert.Empty((await server.RunAsync<ICommentRepository, PagedResult<PublicComment>>(comments => comments.SeriesCommentsAsync(seriesId, 1))).Items);
        await Assert.ThrowsAsync<BadRequestException>(() => server.RunAsync<ICommentRepository, CommentPosted>(comments =>
            comments.PostSeriesCommentAsync(seriesId, admin, new("Respuesta", posted.Id))));

        await server.RunAsync<ICommentRepository>(comments => comments.ModerateAsync([posted.Id], CommentStatus.Approved));
        Assert.Single((await server.RunAsync<ICommentRepository, PagedResult<PublicComment>>(comments => comments.SeriesCommentsAsync(seriesId, 1))).Items);
        var reply = await server.RunAsync<ICommentRepository, CommentPosted>(comments => comments.PostSeriesCommentAsync(seriesId, admin, new("Respuesta", posted.Id)));
        await Assert.ThrowsAsync<BadRequestException>(() => server.RunAsync<ICommentRepository, CommentPosted>(comments =>
            comments.PostSeriesCommentAsync(other.Id, admin, new("Fuera de lugar", posted.Id))));

        var edited = await server.RunAsync<ICommentRepository, MyComment>(comments => comments.EditMyCommentAsync(admin, posted.Id, new("Editado")));
        Assert.Equal(CommentStatus.Pending, edited.Status);
        Assert.Empty((await server.RunAsync<ICommentRepository, PagedResult<PublicComment>>(comments => comments.SeriesCommentsAsync(seriesId, 1))).Items);
        var queue = await server.RunAsync<ICommentRepository, ModerationPage>(comments => comments.ModerationQueueAsync(CommentStatus.Pending, null, 1, 25));
        Assert.Equal(2, queue.Counts[CommentStatus.Pending]);
        Assert.Contains(queue.Items, item => item.Id == reply.Id && item.ParentCommentId == posted.Id && item.TargetType == "series");
        Assert.Equal(2, (await server.RunAsync<ICommentRepository, IReadOnlyList<MyComment>>(comments => comments.MyCommentsAsync(admin))).Count);
    }

    [SqlFact]
    public async Task MediaWorkersTranscodeAndIndexStableFilesOnly()
    {
        await using var server = await TestServer.StartAsync();
        var series = await server.RunAsync<ISeriesRepository, SeriesDetail>(repository =>
            repository.CreateAsync(new("Worker Show", null, null, null, new DateOnly(1995, 1, 1), null, null, 1), null));
        var source = Path.Combine(series.FolderPath!, "season 1", "S01E01 Viejo.mkv");
        await TestServer.WriteVideoAsync(source, 4, compatible: false);
        File.SetLastWriteTimeUtc(source, DateTime.UtcNow.AddMinutes(-10));
        // Workers start disabled until an administrator turns them on.
        await server.RunAsync<IMediaRepository>(async media =>
        {
            await media.SetWorkerAsync(MediaWorkers.Transcode, true);
            await media.SetWorkerAsync(MediaWorkers.Index, true);
        });
        var transcode = new MediaWorkerMemory();
        var index = new MediaWorkerMemory();
        Task Cycle(string worker, MediaWorkerMemory memory) =>
            server.RunAsync<IMediaRepository>(media => media.RunWorkerCycleAsync(worker, memory, CancellationToken.None));

        // First pass only observes; the second sees an unchanged file and processes it.
        await Cycle(MediaWorkers.Transcode, transcode);
        Assert.False(await server.DbAsync(context => context.MediaProcessingJobs.AnyAsync()));
        await Cycle(MediaWorkers.Transcode, transcode);
        var job = await server.DbAsync(context => context.MediaProcessingJobs.SingleAsync(item => item.Worker == MediaWorkers.Transcode));
        Assert.Equal(MediaJobStatus.Completed, job.Status);
        var sourcePath = job.SourcePath;
        var output = Path.Combine(server.Media.FullName, job.OutputPath!);
        Assert.True(File.Exists(output));
        Assert.True(File.Exists(source));

        File.SetLastWriteTimeUtc(output, DateTime.UtcNow.AddMinutes(-10));
        await Cycle(MediaWorkers.Index, index);
        await Cycle(MediaWorkers.Index, index);
        var episode = await server.DbAsync(context => context.Episodes.SingleAsync());
        Assert.Equal("/uploads/" + job.OutputPath, episode.FilePath);
        Assert.Equal("Viejo", episode.Title);
        var status = await server.RunAsync<IMediaRepository, MediaStatus>(media => media.StatusAsync(new("all", "all")));
        Assert.All(status.Workers, worker => Assert.True(worker.Online));
        Assert.Contains(status.Jobs, item => item.Worker == MediaWorkers.Index && item.Status == MediaJobStatus.Skipped);

        await Assert.ThrowsAsync<BadRequestException>(() => server.RunAsync<IMediaRepository, int>(media =>
            media.ClearQueueAsync(new("borrar", [MediaJobStatus.Completed]))));
        await Assert.ThrowsAsync<BadRequestException>(() => server.RunAsync<IMediaRepository, int>(media =>
            media.ClearQueueAsync(new("LIMPIAR", [MediaJobStatus.Processing]))));
        Assert.Equal(2, await server.RunAsync<IMediaRepository, int>(media =>
            media.ClearQueueAsync(new("LIMPIAR", [MediaJobStatus.Completed], Worker: null))));

        // A cleared transcode record is not recreated once its output exists.
        await Cycle(MediaWorkers.Transcode, transcode);
        await Cycle(MediaWorkers.Transcode, transcode);
        Assert.False(await server.DbAsync(context => context.MediaProcessingJobs.AnyAsync(item =>
            item.Worker == MediaWorkers.Transcode && item.SourcePath == sourcePath)));
    }

    private static async Task<int> SeedEpisodeAsync(TestServer server)
    {
        var series = await server.RunAsync<ISeriesRepository, SeriesDetail>(repository =>
            repository.CreateAsync(new("Historia", null, null, null, new DateOnly(1992, 1, 1), null, null, 1), null));
        var path = Path.Combine(series.FolderPath!, "season 1", "S01E01 Piloto.mp4");
        await TestServer.WriteVideoAsync(path, 40);
        File.SetLastWriteTimeUtc(path, DateTime.UtcNow.AddMinutes(-10));
        Assert.Equal(1, (await server.RunAsync<ISeriesRepository, ScanResult>(repository => repository.ScanFolderAsync(series.Id, CancellationToken.None))).Imported);
        return await server.DbAsync(context => context.Episodes.Select(episode => episode.Id).SingleAsync());
    }
}
