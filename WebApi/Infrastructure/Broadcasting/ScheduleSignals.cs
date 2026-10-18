using System.Collections.Concurrent;

namespace Infrastructure.Broadcasting;

/// <summary>
/// In-process change notifications: repositories bump a channel's version after rewriting its schedule
/// and the broadcaster drops its cached "now playing" for that channel.
/// </summary>
public sealed class ScheduleSignals
{
    private readonly ConcurrentDictionary<int, long> _versions = new();
    private readonly ConcurrentDictionary<int, SemaphoreSlim> _gates = new();

    public long Version(int channelId) => _versions.GetValueOrDefault(channelId);

    public void Changed(int channelId) => _versions.AddOrUpdate(channelId, 1, (_, version) => version + 1);

    /// <summary>Serializes schedule writes per channel within this process.</summary>
    public SemaphoreSlim Gate(int channelId) => _gates.GetOrAdd(channelId, _ => new SemaphoreSlim(1, 1));
}
