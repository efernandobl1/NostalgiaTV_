namespace Infrastructure.Services.Viewing;

public static class WatchCoverage
{
    public static List<(double Start, double End)> Merge(IEnumerable<(double Start, double End)> ranges)
    {
        var merged = new List<(double Start, double End)>();
        foreach (var range in ranges.Where(item => double.IsFinite(item.Start) && double.IsFinite(item.End) && item.Start >= 0 && item.End > item.Start).OrderBy(item => item.Start))
        {
            if (merged.Count > 0 && range.Start <= merged[^1].End + 0.25)
                merged[^1] = (merged[^1].Start, Math.Max(merged[^1].End, range.End));
            else merged.Add(range);
        }
        return merged;
    }

    public static bool Completed(IEnumerable<(double Start, double End)> ranges, double duration) =>
        double.IsFinite(duration) && duration > 0 && Merge(ranges).Sum(item => Math.Min(duration, item.End) - Math.Min(duration, item.Start)) >= duration * 0.95;
}
