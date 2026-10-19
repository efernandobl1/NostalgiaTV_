namespace ApplicationCore.Policies;

/// <summary>Merges watched ranges; an episode counts as completed once 95 % of it was actually played.</summary>
public static class WatchCoverage
{
    public static List<(decimal Start, decimal End)> Merge(IEnumerable<(decimal Start, decimal End)> ranges)
    {
        var merged = new List<(decimal Start, decimal End)>();
        foreach (var range in ranges.Where(item => item.Start >= 0 && item.End > item.Start).OrderBy(item => item.Start))
        {
            if (merged.Count > 0 && range.Start <= merged[^1].End + 0.25m)
                merged[^1] = (merged[^1].Start, Math.Max(merged[^1].End, range.End));
            else merged.Add(range);
        }
        return merged;
    }

    public static bool Completed(IEnumerable<(decimal Start, decimal End)> ranges, decimal duration) =>
        duration > 0 && Merge(ranges).Sum(item => Math.Min(duration, item.End) - Math.Min(duration, item.Start)) >= duration * 0.95m;
}
