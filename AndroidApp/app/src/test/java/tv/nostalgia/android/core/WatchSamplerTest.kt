package tv.nostalgia.android.core

import org.junit.Assert.*
import org.junit.Test

class WatchSamplerTest {
    @Test fun recordsOnlyContinuousPlayback() {
        val sampler = WatchSampler()
        for (second in 0..14) assertNull(sampler.sample(second.toDouble(), true))
        assertEquals(WatchRange(0.0, 15.0), sampler.sample(15.0, true))
    }

    @Test fun seekingDoesNotMarkSkippedContentAsWatched() {
        val sampler = WatchSampler()
        sampler.sample(0.0, true)
        sampler.sample(1.0, true)
        assertNull(sampler.sample(600.0, true))
        assertNull(sampler.sample(601.0, true))
        assertEquals(WatchRange(600.0, 601.0), sampler.flush())
    }

    @Test fun pausedPlaybackDoesNotCount() {
        val sampler = WatchSampler()
        for (second in 0..20) assertNull(sampler.sample(second.toDouble(), false))
        assertNull(sampler.flush())
    }

    @Test fun flushDoesNotRepeatRanges() {
        val sampler = WatchSampler()
        sampler.sample(10.0, true)
        sampler.sample(11.0, true)
        assertEquals(WatchRange(10.0, 11.0), sampler.flush())
        assertNull(sampler.flush())
    }

    @Test fun episodesAreAlwaysOrderedBySeasonThenEpisode() {
        val episodes = listOf(Episode(1, "Third", "a", 2, 3), Episode(2, "First", "a", 1, 1), Episode(3, "Second", "a", 2, 1))
        assertEquals(listOf(2, 3, 1), episodes.inBroadcastOrder().map { it.id })
    }
}
