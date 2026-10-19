using System.Collections.Concurrent;
using ApplicationCore.DTOs;
using ApplicationCore.Interfaces.Repositories;
using Infrastructure.Broadcasting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Infrastructure.Tests;

public class ChannelBroadcasterTests
{
    /// <summary>Home and guide hear about schedule rewrites and new channels through the hub's lineup group.</summary>
    [SqlFact]
    public async Task LineupGroupHearsScheduleAndChannelChanges()
    {
        await using var server = await TestServer.StartAsync();
        var world = await BroadcastWorld.CreateAsync(server);
        var hub = new RecordingHub();
        var broadcaster = new ChannelBroadcaster(server.Services.GetRequiredService<IServiceScopeFactory>(), hub,
            server.Services.GetRequiredService<ScheduleSignals>(), NullLogger<ChannelBroadcaster>.Instance);
        var now = DateTime.UtcNow;
        List<ChannelChange> Changes() => [.. hub.Sent.Where(item => item.Group == ChannelHub.LineupGroup).Select(item => (ChannelChange)item.Payload)];

        // The first pass is the starting point; the picture keeps flowing to the channel's viewers.
        await broadcaster.TickAsync(now, CancellationToken.None);
        Assert.Empty(Changes());
        Assert.Contains(hub.Sent, item => item.Group == ChannelHub.Group(world.ChannelId) && item.Method == ChannelHub.StateMethod);

        // Putting another era on air rewrites the schedule.
        await server.RunAsync<IChannelRepository>(async channels =>
        {
            var era = await channels.CreateEraAsync(world.ChannelId, new("Era nueva", null, new DateTime(1996, 1, 1), null));
            await channels.SetEraSeriesAsync(world.ChannelId, era.Id, new([new(world.SeriesId, null)]));
            await channels.ActivateEraAsync(world.ChannelId, era.Id);
        });
        await broadcaster.TickAsync(now.AddSeconds(1), CancellationToken.None);
        Assert.Equal([new ChannelChange(world.ChannelId, ChannelChange.Schedule)], Changes());

        // A channel created from the dashboard shows up with the next lineup refresh.
        var added = await server.RunAsync<IChannelRepository, ChannelDetail>(channels =>
            channels.CreateAsync(new("Canal Nuevo", null, new DateTime(1990, 1, 1), null), null));
        await broadcaster.TickAsync(now.AddSeconds(31), CancellationToken.None);
        Assert.Equal(new ChannelChange(added.Id, ChannelChange.Lineup), Changes()[^1]);

        // Re-reading the segment on air (its end time has passed for the broadcaster's clock) is not a change.
        await broadcaster.TickAsync(now.AddHours(2), CancellationToken.None);
        Assert.DoesNotContain(Changes(), change => change.Reason == ChannelChange.Segment);
    }

    private sealed class RecordingHub : IHubContext<ChannelHub>
    {
        public ConcurrentQueue<(string Group, string Method, object Payload)> Sent { get; } = new();
        public IHubClients Clients => new Recipients(this);
        public IGroupManager Groups => throw new NotSupportedException();

        private sealed class Recipients(RecordingHub hub) : IHubClients
        {
            public IClientProxy Group(string groupName) => new Proxy(hub, groupName);
            public IClientProxy All => Group("*");
            public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => Group("*");
            public IClientProxy Client(string connectionId) => Group(connectionId);
            public IClientProxy Clients(IReadOnlyList<string> connectionIds) => Group("*");
            public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => Group(groupName);
            public IClientProxy Groups(IReadOnlyList<string> groupNames) => Group("*");
            public IClientProxy User(string userId) => Group(userId);
            public IClientProxy Users(IReadOnlyList<string> userIds) => Group("*");
        }

        private sealed class Proxy(RecordingHub hub, string group) : IClientProxy
        {
            public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
            {
                hub.Sent.Enqueue((group, method, args[0]!));
                return Task.CompletedTask;
            }
        }
    }
}
