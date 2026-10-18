using ApplicationCore.Entities;

namespace ApplicationCore.Policies;

/// <summary>An interlude assigned to the era (SeriesId null) or to one series of the era.</summary>
public sealed record BroadcastClip(int InterludeId, string Kind, string? BumperType, string Season, decimal DurationSeconds,
    int Weight, int MinimumGapSeconds, int? SeriesId = null);

public enum BreakRole { Opener, Advertisement, Closer, ProgramIntro }

/// <summary>
/// Builds retro commercial breaks: an opening bumper ("Ya viene"), between MinimumAds and MaximumAds
/// ads, and a closing bumper ("Continuamos con"), within MaximumBreakSeconds.
/// </summary>
public static class CommercialBreakPlanner
{
    /// <summary>Bumper types allowed per role, most specific first.</summary>
    private static readonly Dictionary<BreakRole, string[]> BumperTypes = new()
    {
        [BreakRole.Opener] = [BumperType.ComingUp, BumperType.Generic],
        [BreakRole.Closer] = [BumperType.WeContinueWith, BumperType.Generic],
        [BreakRole.ProgramIntro] = [BumperType.Generic],
    };

    public static List<BroadcastClip> Plan(IReadOnlyList<BroadcastClip> clips, ChannelEraBreakRule? rule,
        Dictionary<int, DateTime> lastUse, DateTime startsAt, string season, int seriesId, Random random)
    {
        if (rule == null) return [];
        var eligible = Eligible(clips, season, seriesId).ToList();
        var planned = new List<BroadcastClip>();
        var proposedUse = new Dictionary<int, DateTime>(lastUse);
        var cursor = startsAt;
        decimal Shortest(BreakRole role) => eligible.Where(item => Fits(item, role))
            .Select(item => item.DurationSeconds).DefaultIfEmpty(decimal.MaxValue).Min();
        var shortestAd = Shortest(BreakRole.Advertisement);
        var shortestCloser = Shortest(BreakRole.Closer);
        if (shortestAd == decimal.MaxValue || shortestCloser == decimal.MaxValue) return [];

        bool Add(BreakRole role, int remainingAds)
        {
            var candidates = eligible.Where(item => Fits(item, role)
                && Rested(item, proposedUse, cursor)
                && (cursor - startsAt).TotalSeconds + (double)item.DurationSeconds + (double)(shortestAd * remainingAds)
                    + (role == BreakRole.Closer ? 0 : (double)shortestCloser) <= rule.MaximumBreakSeconds).ToList();
            var selected = Choose(candidates, role, random);
            if (selected == null) return false;
            planned.Add(selected);
            cursor = cursor.AddSeconds((double)selected.DurationSeconds);
            proposedUse[selected.InterludeId] = cursor;
            return true;
        }

        if (!Add(BreakRole.Opener, rule.MinimumAds)) return [];
        var adCount = random.Next(rule.MinimumAds, rule.MaximumAds + 1);
        for (var i = 0; i < adCount; i++)
            if (!Add(BreakRole.Advertisement, Math.Max(0, rule.MinimumAds - i - 1)))
                return i >= rule.MinimumAds && Add(BreakRole.Closer, 0) ? planned : [];
        return Add(BreakRole.Closer, 0) ? planned : [];
    }

    /// <summary>Generic bumper that may air right before an episode starts.</summary>
    public static BroadcastClip? ProgramIntro(IReadOnlyList<BroadcastClip> clips, Dictionary<int, DateTime> lastUse,
        DateTime startsAt, string season, int seriesId, Random random) =>
        Choose(Eligible(clips, season, seriesId).Where(item => Fits(item, BreakRole.ProgramIntro) && Rested(item, lastUse, startsAt)).ToList(),
            BreakRole.ProgramIntro, random);

    public static bool Fits(BroadcastClip clip, BreakRole role) => role == BreakRole.Advertisement
        ? clip.Kind == InterludeKind.Advertisement
        : clip.Kind == InterludeKind.Bumper && BumperTypes[role].Contains(clip.BumperType);

    private static bool Rested(BroadcastClip clip, Dictionary<int, DateTime> uses, DateTime at) =>
        !uses.TryGetValue(clip.InterludeId, out var last) || at >= last.AddSeconds(clip.MinimumGapSeconds);

    private static IEnumerable<BroadcastClip> Eligible(IEnumerable<BroadcastClip> clips, string season, int seriesId) =>
        clips.Where(item => item.DurationSeconds > 0 && item.Weight > 0
            && (item.SeriesId == null || item.SeriesId == seriesId)
            && (item.Season == InterludeSeason.AllYear || item.Season == season));

    /// <summary>Series-specific, then seasonal, then the most specific bumper type; weighted random among the rest.</summary>
    private static BroadcastClip? Choose(List<BroadcastClip> candidates, BreakRole role, Random random)
    {
        if (candidates.Count == 0) return null;
        static List<BroadcastClip> Prefer(List<BroadcastClip> items, Func<BroadcastClip, bool> test)
        {
            var preferred = items.Where(test).ToList();
            return preferred.Count > 0 ? preferred : items;
        }
        candidates = Prefer(candidates, item => item.SeriesId != null);
        candidates = Prefer(candidates, item => item.Season != InterludeSeason.AllYear);
        if (BumperTypes.TryGetValue(role, out var types))
            candidates = Prefer(candidates, item => item.BumperType == types[0]);
        var choice = random.Next(candidates.Sum(item => item.Weight));
        return candidates.First(item => (choice -= item.Weight) < 0);
    }
}
