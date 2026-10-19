package tv.nostalgia.android.features

import org.junit.Assert.assertEquals
import org.junit.Test

class DayKeyTest {
    // 2026-10-19 00:33 UTC is still 2026-10-18 in Guatemala (UTC-6).
    private val now = 1_792_369_980_000L

    @Test fun guideDayFollowsThePlatformZoneNotTheDevice() {
        assertEquals("2026-10-18", AppViewModel.dayKey(0, "America/Guatemala", now))
        assertEquals("2026-10-19", AppViewModel.dayKey(1, "America/Guatemala", now))
        assertEquals("2026-10-19", AppViewModel.dayKey(0, "UTC", now))
    }
}
