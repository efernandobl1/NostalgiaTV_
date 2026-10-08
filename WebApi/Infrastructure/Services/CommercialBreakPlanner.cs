using ApplicationCore.Entities;

namespace Infrastructure.Services;

public sealed record BroadcastClip(ChannelEraInterlude Assignment, Interlude Clip);

public static class CommercialBreakPlanner
{
    public static List<Interlude> Plan(List<BroadcastClip> clips, ChannelEraBreakRule? rule,
        Dictionary<int, DateTime> lastUse, DateTime startsAt, InterludeSeason season)
    {
        if (rule == null) return [];
        clips = clips.Where(item => item.Clip.Season == InterludeSeason.AllYear || item.Clip.Season == season).ToList();
        var planned = new List<Interlude>();
        var proposedUse = new Dictionary<int, DateTime>(lastUse);
        var cursor = startsAt;
        var shortestAd = clips.Where(item => item.Assignment.Role == BreakRole.Advertisement
            && item.Clip.Kind == InterludeKind.Advertisement)
            .Select(item => item.Clip.DurationSeconds).DefaultIfEmpty(decimal.MaxValue).Min();
        var shortestCloser = clips.Where(item => item.Assignment.Role == BreakRole.BreakCloser
            && item.Clip.Kind == InterludeKind.Bumper)
            .Select(item => item.Clip.DurationSeconds).DefaultIfEmpty(decimal.MaxValue).Min();
        if (shortestAd == decimal.MaxValue || shortestCloser == decimal.MaxValue) return [];

        bool Add(BreakRole role, int remainingAds)
        {
            var candidates = clips.Where(item =>
                item.Assignment.Role == role
                && item.Clip.Kind == (role == BreakRole.Advertisement ? InterludeKind.Advertisement : InterludeKind.Bumper)
                && (!proposedUse.TryGetValue(item.Clip.Id, out var last)
                    || cursor >= last.AddSeconds(item.Assignment.MinimumGapSeconds))
                && (cursor - startsAt).TotalSeconds + (double)item.Clip.DurationSeconds
                    + (double)(shortestAd * remainingAds)
                    + (role == BreakRole.BreakCloser ? 0 : (double)shortestCloser)
                    <= rule.MaximumBreakSeconds).ToList();
            if (candidates.Count == 0) return false;
            var seasonal = candidates.Where(item => item.Clip.Season != InterludeSeason.AllYear).ToList();
            if (seasonal.Count > 0) candidates = seasonal;
            var choice = Random.Shared.Next(candidates.Sum(item => item.Assignment.Weight));
            var selected = candidates.First(item => (choice -= item.Assignment.Weight) < 0);
            planned.Add(selected.Clip);
            cursor = cursor.AddSeconds((double)selected.Clip.DurationSeconds);
            proposedUse[selected.Clip.Id] = cursor;
            return true;
        }

        if (!Add(BreakRole.BreakOpener, rule.MinimumAds)) return [];
        var adCount = Random.Shared.Next(rule.MinimumAds, rule.MaximumAds + 1);
        for (var i = 0; i < adCount; i++)
            if (!Add(BreakRole.Advertisement, Math.Max(0, rule.MinimumAds - i - 1)))
                return i >= rule.MinimumAds && Add(BreakRole.BreakCloser, 0) ? planned : [];
        return Add(BreakRole.BreakCloser, 0) ? planned : [];
    }
}
