using Microsoft.AspNetCore.SignalR;

namespace Infrastructure.Broadcasting;

/// <summary>
/// Viewers join one group per channel and receive "ChannelState" every second; screens listing channels (home, guide)
/// join the lineup group and receive "ChannelChanged" when any channel changes.
/// </summary>
public sealed class ChannelHub : Hub
{
    public const string StateMethod = "ChannelState";
    public const string ChangedMethod = "ChannelChanged";
    public const string LineupGroup = "lineup";

    public static string Group(int channelId) => $"channel-{channelId}";

    public Task WatchLineup() => Groups.AddToGroupAsync(Context.ConnectionId, LineupGroup);

    public Task UnwatchLineup() => Groups.RemoveFromGroupAsync(Context.ConnectionId, LineupGroup);

    public Task JoinChannel(int channelId) => channelId > 0
        ? Groups.AddToGroupAsync(Context.ConnectionId, Group(channelId))
        : throw new HubException("Canal no válido.");

    public Task LeaveChannel(int channelId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, Group(channelId));
}
