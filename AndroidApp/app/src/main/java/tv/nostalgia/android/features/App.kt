package tv.nostalgia.android.features

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tv.nostalgia.android.core.MediaUrls
import tv.nostalgia.android.shared.*

/** Root: connection flow until a viewer session exists, then the TV or phone experience. */
@Composable
fun NostalgiaApp(model: AppViewModel) {
    val state by model.state.collectAsStateWithLifecycle()
    val tv = LocalTvDevice.current
    val context = LocalContext.current
    LaunchedEffect(state.browserLogin) {
        state.browserLogin?.let { address ->
            try { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(address))) }
            catch (_: android.content.ActivityNotFoundException) { model.authorizationError(false) }
            model.browserOpened()
        }
    }
    Box(Modifier.fillMaxSize().background(if (tv) Ntv.Ink2 else Ntv.Ink)) {
        if (state.connectionStep != ConnectionStep.Ready) {
            if (tv) TvConnection(model, state) else MobileConnection(model, state)
            return@Box
        }
        BackHandler(state.playback != null || state.backStack.isNotEmpty() || state.screen != Screen.Home) { model.back() }
        val playback = state.playback
        if (playback != null) PlayerScreen(model, playback)
        else if (tv) TvApp(model, state) else MobileApp(model, state)
    }
}

/** Absolute URL of a stored image, or null when it cannot be resolved. */
fun imageUrl(model: AppViewModel, path: String?): String? = path?.let { runCatching { MediaUrls.resolve(model.api.base, it) }.getOrNull() }
