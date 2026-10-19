package tv.nostalgia.android

import android.content.pm.PackageManager
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.semantics.SemanticsActions
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import tv.nostalgia.android.core.*
import tv.nostalgia.android.features.*

/** Navigation of the v2 redesign from a fixed catalog state (no server needed). */
@RunWith(AndroidJUnit4::class)
class TvNavigationTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    private val tv get() = compose.activity.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)

    private fun showCatalog(): AppViewModel {
        val model = ViewModelProvider(compose.activity)[AppViewModel::class.java]
        val now = System.currentTimeMillis()
        compose.runOnUiThread {
            model.showState(AppState(connectionStep = ConnectionStep.Ready, loading = false, channels = listOf(
                Channel(5, "Canal 5 Retro", null, "Época dorada", true, listOf("Anime"),
                    NowPlaying("Episode", 1, "Dragon Ball Z", "El poder oculto de Gohan", 2, 14, now - 60_000, now + 600_000, .1f)),
                Channel(12, "Cartoon Clásico", null, null, false)),
                series = listOf(Series(1, "Los Simpson", null, 10, 1989, null, 8.7f, listOf("Comedia"), true)), totalSeries = 1,
                session = ViewerSession("p", 1, emptyList(), "d", false)))
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Cartoon Clásico").fetchSemanticsNodes().isNotEmpty() }
        return model
    }

    private fun tab(label: String) = compose.onAllNodesWithText(label).onFirst().performSemanticsAction(SemanticsActions.OnClick) { it() }

    @Test fun homeShowsChannelsAndWhatIsOnAir() {
        showCatalog()
        compose.onAllNodesWithText("Dragon Ball Z").onFirst().assertExists()
        compose.onAllNodesWithText(if (tv) "Ver en vivo" else "Canales").onFirst().assertExists()
    }

    @Test fun tabsSwitchBetweenScreens() {
        val model = showCatalog()
        tab("Series")
        compose.waitUntil(5_000) { model.state.value.screen == Screen.Catalog }
        compose.onAllNodesWithText("Los Simpson").onFirst().assertExists()
        tab("Vincular")
        compose.waitUntil(5_000) { model.state.value.screen == Screen.Pair }
        compose.onAllNodesWithText(if (tv) "Vincula este televisor" else "Escribe el código que ves en tu TV").onFirst().assertExists()
        tab("Guía")
        compose.waitUntil(5_000) { model.state.value.screen == Screen.Guide }
    }

    @Test fun backReturnsToChannels() {
        val model = showCatalog()
        tab("Series")
        compose.waitUntil(5_000) { model.state.value.screen == Screen.Catalog }
        compose.runOnUiThread { assertTrue(model.back()) }
        compose.waitUntil(5_000) { model.state.value.screen == Screen.Home }
        compose.runOnUiThread { assertFalse(model.back()) }
    }
}
