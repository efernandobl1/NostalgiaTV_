package tv.nostalgia.android

import android.content.pm.PackageManager
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
        compose.waitUntil(15000) {
            compose.activity.getSharedPreferences("viewer_session", 0).contains("cookie")
        }
        val origin = BuildConfig.API_BASE_URL.toHttpUrl()
        val cookie = ViewerCookies(compose.activity, origin).loadForRequest(origin.resolve("api/v1/viewer/session")!!).single()
        val stored = compose.activity.getSharedPreferences("viewer_session", 0).getString("cookie", "")!!
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
}
