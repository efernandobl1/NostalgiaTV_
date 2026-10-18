using Microsoft.AspNetCore.SignalR;

namespace Infrastructure.Broadcasting;

/// <summary>Viewers join one group per channel and receive "ChannelState" every second.</summary>
public sealed class ChannelHub : Hub
{
    public const string StateMethod = "ChannelState";

    public static string Group(int channelId) => $"channel-{channelId}";

    public Task JoinChannel(int channelId) => channelId > 0
        ? Groups.AddToGroupAsync(Context.ConnectionId, Group(channelId))
        : throw new HubException("Canal no válido.");

    public Task LeaveChannel(int channelId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, Group(channelId));
}
