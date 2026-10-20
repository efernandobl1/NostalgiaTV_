package tv.nostalgia.android.features

import org.junit.Assert.*
import org.junit.Test
import tv.nostalgia.android.core.AppSettings
import tv.nostalgia.android.core.Channel
import tv.nostalgia.android.core.PublicSettings

class PreferencesTest {
    private val channels = listOf(Channel(5, "Canal 5 Retro", null), Channel(12, "Cartoon Clásico", null))

    @Test fun startupChannelNeedsTheSettingOn() {
        assertNull(AppViewModel.startupChannel(AppSettings(startOnLastChannel = false, lastChannelId = 12), channels))
        assertEquals(12, AppViewModel.startupChannel(AppSettings(startOnLastChannel = true, lastChannelId = 12), channels)?.id)
    }

    @Test fun startupChannelSkipsMissingChannels() {
        assertNull(AppViewModel.startupChannel(AppSettings(startOnLastChannel = true, lastChannelId = null), channels))
        assertNull(AppViewModel.startupChannel(AppSettings(startOnLastChannel = true, lastChannelId = 99), channels))
    }

    @Test fun seasonThemeFollowsServerSeasonAndViewerChoice() {
        assertEquals("HALLOWEEN", seasonTheme(PublicSettings("Halloween", false, seasonalEffects = true), true)?.title)
        assertEquals("NAVIDAD", seasonTheme(PublicSettings("Christmas", false, seasonalEffects = true), true)?.title)
        assertNull(seasonTheme(PublicSettings("AllYear", true, seasonalEffects = true), true))
        assertNull(seasonTheme(PublicSettings("Halloween", true, seasonalEffects = false), true))
        assertNull(seasonTheme(PublicSettings("Christmas", true, seasonalEffects = true), false))
    }

    @Test fun filterStepsStayInRange() {
        assertEquals(30, stepValue(25, 5, 0..100))
        assertEquals(100, stepValue(100, 5, 0..100))
        assertEquals(0, stepValue(0, -5, 0..100))
        assertEquals(1, stepValue(1, -1, 1..10))
        assertEquals(10, stepValue(9, 1, 1..10))
    }
}
