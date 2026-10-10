package tv.nostalgia.android

import android.content.pm.PackageManager
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.semantics.SemanticsActions
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.*
import org.junit.Assume.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import tv.nostalgia.android.core.ViewerCookies
import tv.nostalgia.android.core.VideoPreferences
import tv.nostalgia.android.features.AppViewModel
import tv.nostalgia.android.features.AppState
import tv.nostalgia.android.features.EpisodesScreen
import tv.nostalgia.android.core.Episode
import tv.nostalgia.android.core.Series
import tv.nostalgia.android.shared.RetroTheme
import androidx.lifecycle.ViewModelProvider

@RunWith(AndroidJUnit4::class)
class TvNavigationTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    private fun waitForCatalog() {
        compose.waitUntil(30000) { compose.onAllNodesWithText("Los Simpson TV").fetchSemanticsNodes().isNotEmpty() }
    }

    @Test fun catalogHasRealChannelsAndRemoteNavigation() {
        assumeTrue(compose.activity.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK))
        waitForCatalog()
        compose.onNodeWithText("Jetix").assertIsDisplayed()
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        device.pressDPadDown()
        compose.waitForIdle()
        compose.onNode(hasText("Los Simpson TV")).assertIsFocused()
    }

    @Test fun seriesCanBeOpenedAndEpisodesAreReadable() {
        waitForCatalog()
        compose.onNodeWithText("Series").performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.waitUntil(15000) { compose.onAllNodesWithText("Los Simpson").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Los Simpson").performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.waitUntil(15000) { compose.onAllNodesWithText("Volver a series").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Temporada 1").assertIsDisplayed()
        compose.onAllNodes(hasText("T1 · E1", substring = true)).onFirst().assertIsDisplayed()
    }

    @Test fun profileShowsSimplePairingAndCookieIsEncrypted() {
        waitForCatalog()
        compose.onNodeWithText("Mi perfil").performSemanticsAction(SemanticsActions.OnClick) { it() }
        val tv = compose.activity.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        compose.onNodeWithText(if (tv) "Vincular esta TV" else "Vincular este dispositivo").assertIsDisplayed()
        val origin = BuildConfig.API_BASE_URL.toHttpUrl()
        val key = java.security.MessageDigest.getInstance("SHA-256").digest(origin.toString().toByteArray()).joinToString("") { "%02x".format(it) }
        val preferences = compose.activity.getSharedPreferences("viewer_session_$key", 0)
        compose.waitUntil(15000) { preferences.contains("cookie") }
        val cookie = ViewerCookies(compose.activity, origin).loadForRequest(origin.resolve("api/v1/viewer/session")!!).single()
        val stored = preferences.getString("cookie", "")!!
        assertFalse(stored.contains(cookie.value))
        assertTrue(cookie.secure)
        assertTrue(cookie.httpOnly)
        assertTrue(ViewerCookies(compose.activity, origin).loadForRequest(origin.resolve("uploads/a.mp4")!!).isEmpty())
    }

    @Test fun mobileNavigationRespondsToTouch() {
        assumeFalse(compose.activity.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK))
        waitForCatalog()
        compose.onNodeWithText("Series").performClick()
        compose.waitUntil(15000) { compose.onAllNodesWithText("Los Simpson").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Los Simpson").performClick()
        compose.waitUntil(15000) { compose.onAllNodesWithText("Volver a series").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Mi perfil").performClick()
        compose.onNodeWithText("Vincular este dispositivo").assertIsDisplayed()
    }

    @Test fun catalogFiltersOfferSearchChannelsAndCategories() {
        waitForCatalog()
        compose.onNodeWithText("Series").performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.onNodeWithText("Filtros").performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.onNodeWithText("¿Qué serie recuerdas?").assertIsDisplayed()
        compose.onNodeWithText("Todos los canales").assertIsDisplayed()
        compose.onNodeWithText("Todas las categorías").assertIsDisplayed()
        compose.onNodeWithText("Aplicar filtros").assertIsDisplayed()
    }

    @Test fun episodesRemainVisibleInShortPanels() {
        val model = ViewModelProvider(compose.activity)[AppViewModel::class.java]
        val tv = compose.activity.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        compose.runOnUiThread {
            compose.activity.setContent {
                RetroTheme(isTv = tv) {
                    Box(Modifier.fillMaxWidth().height(240.dp)) {
                        EpisodesScreen(model, AppState(selectedSeries = Series(1, "Test series", null, 1),
                            episodes = listOf(Episode(1, "Test episode", "/uploads/test.mp4", 1, 1))))
                    }
                }
            }
        }
        compose.onNodeWithText("Volver a series").assertIsDisplayed()
        compose.onNodeWithText("Test episode").assertIsDisplayed()
        compose.onNodeWithText("T1 · E1").assertIsDisplayed()
    }

    @Test fun playerOffersWebActionsAndPersistentImageFilters() {
        waitForCatalog()
        compose.onNodeWithText("Los Simpson TV").performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.waitUntil(20000) { compose.onAllNodesWithText("Imagen").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Sincronizar").assertIsDisplayed()
        compose.onNodeWithText("Guía").assertIsDisplayed()
        val tv = compose.activity.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        compose.onNodeWithText(if (tv) "Volver a la sala" else "Salir de pantalla completa").assertIsDisplayed()
        compose.onNodeWithText("Imagen").performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.onNodeWithText("La imagen de antes.").assertIsDisplayed()
        val before = VideoPreferences(compose.activity).load().enabled
        compose.onNodeWithText("Efecto CRT").performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.waitUntil { VideoPreferences(compose.activity).load().enabled != before }
        compose.onNodeWithText("Restablecer imagen").performScrollTo().performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.onNodeWithText("Cerrar").performSemanticsAction(SemanticsActions.OnClick) { it() }
        assertNotNull(ViewModelProvider(compose.activity)[AppViewModel::class.java].state.value.playback)
    }
}
