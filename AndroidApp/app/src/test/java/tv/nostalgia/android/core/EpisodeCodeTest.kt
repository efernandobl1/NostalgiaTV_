package tv.nostalgia.android.core

import org.junit.Assert.assertEquals
import org.junit.Test

class EpisodeCodeTest {
    @Test fun splitEpisodesShowTheirPartAndAirInOrder() {
        assertEquals("T2 · E5B", episodeCode(2, 5, "Episodio", "B"))
        assertEquals("T2 · E14", episodeCode(2, 14))
        assertEquals("Película", episodeCode(0, 1, "Película"))
        val order = listOf(Episode(3, "B", "/uploads/b.mp4", 2, 5, part = "B"), Episode(2, "Seis", "/uploads/6.mp4", 2, 6),
            Episode(1, "A", "/uploads/a.mp4", 2, 5, part = "A")).inBroadcastOrder()
        assertEquals(listOf(1, 3, 2), order.map { it.id })
    }
}
