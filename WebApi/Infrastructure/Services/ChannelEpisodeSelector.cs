using ApplicationCore.Entities;

namespace Infrastructure.Services;

public readonly record struct EpisodeAiring(int EpisodeId, DateTime StartTime, int? ShuffleCycle = null);

public sealed class ChannelEpisodeSelector
{
    private static readonly TimeSpan SlotTolerance = TimeSpan.FromHours(2);
    private readonly HashSet<int> _playedInCycle = [];
    private readonly Dictionary<int, List<DateTime>> _airings = [];
    private int? _lastEpisodeId;
    public int ShuffleCycle { get; private set; }

    public ChannelEpisodeSelector(IEnumerable<EpisodeAiring> history)
    {
        var ordered = history.OrderByDescending(airing => airing.StartTime).ToList();
        _lastEpisodeId = ordered.Count > 0 ? ordered[0].EpisodeId : null;
        var latestCycle = ordered.FirstOrDefault(airing => airing.ShuffleCycle.HasValue).ShuffleCycle;
        ShuffleCycle = latestCycle ?? 1;

        if (latestCycle.HasValue)
        {
            foreach (var airing in ordered.Where(airing => airing.ShuffleCycle == latestCycle))
                _playedInCycle.Add(airing.EpisodeId);
        }
        else
        {
            // Older schedule rows have no cycle marker; use them only during migration.
            foreach (var airing in ordered)
            {
                if (!_playedInCycle.Add(airing.EpisodeId)) break;
            }
        }

        foreach (var airing in ordered)
        {
            if (!_airings.TryGetValue(airing.EpisodeId, out var times))
                _airings[airing.EpisodeId] = times = [];
            times.Add(airing.StartTime);
        }
    }

    public static TimeSpan EstimatePreferredGap(TimeSpan maximum, int episodeCount, double averageDurationSeconds) =>
        TimeSpan.FromSeconds(Math.Round(Math.Max(0, Math.Min(maximum.TotalSeconds, episodeCount * averageDurationSeconds * 0.7))));

    public Episode Choose(IReadOnlyList<Episode> available, DateTime current, TimeSpan preferredGap, Random random)
    {
        if (available.Count == 0) throw new ArgumentException("At least one episode is required.", nameof(available));

        var pool = available.Where(episode => !_playedInCycle.Contains(episode.Id)).ToList();
        if (pool.Count == 0)
        {
            _playedInCycle.Clear();
            ShuffleCycle++;
            pool = available.ToList();
        }

        if (pool.Count == 1 && pool[0].Id == _lastEpisodeId && available.Count > 1)
        {
            // A changing playlist must not force an immediate replay.
            _playedInCycle.Clear();
            ShuffleCycle++;
            pool = available.ToList();
        }

        if (pool.Count > 1)
            pool.RemoveAll(episode => episode.Id == _lastEpisodeId);

        var rested = pool.Where(episode =>
            !_airings.TryGetValue(episode.Id, out var times)
            || times.All(time => time <= current - preferredGap)).ToList();
        if (rested.Count > 0) pool = rested;

        var lowestPenalty = pool.Min(episode => SameSlotCount(episode.Id, current));
        var best = pool.Where(episode => SameSlotCount(episode.Id, current) == lowestPenalty).ToList();
        var chosen = best[random.Next(best.Count)];

        _playedInCycle.Add(chosen.Id);
        _lastEpisodeId = chosen.Id;
        if (!_airings.TryGetValue(chosen.Id, out var airings))
            _airings[chosen.Id] = airings = [];
        airings.Add(current);

        return chosen;
    }

    private int SameSlotCount(int episodeId, DateTime current)
    {
        if (!_airings.TryGetValue(episodeId, out var times)) return 0;

        var cutoff = current.AddDays(-3);
        var currentMinutes = current.TimeOfDay.TotalMinutes;
        return times.Count(time =>
        {
            if (time < cutoff || time >= current) return false;
            var difference = Math.Abs(currentMinutes - time.TimeOfDay.TotalMinutes);
            return Math.Min(difference, 1440 - difference) <= SlotTolerance.TotalMinutes;
        });
    }
}
