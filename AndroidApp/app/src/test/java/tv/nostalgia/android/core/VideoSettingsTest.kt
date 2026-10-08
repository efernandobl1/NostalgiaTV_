package tv.nostalgia.android.core

import org.junit.Assert.*
import org.junit.Test

class VideoSettingsTest {
    @Test fun clampsFilterRanges() {
        assertEquals(100, VideoSettings(intensity = 500).sanitized().intensity)
        assertEquals(0, VideoSettings(intensity = -1).sanitized().intensity)
        assertEquals(1, VideoSettings(density = 0).sanitized().density)
        assertEquals(10, VideoSettings(density = 50).sanitized().density)
    }

    @Test fun animationsAreOptIn() { assertFalse(VideoSettings().animation) }
}
