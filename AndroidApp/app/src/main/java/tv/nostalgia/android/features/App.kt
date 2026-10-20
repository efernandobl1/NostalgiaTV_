package tv.nostalgia.android.features

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tv.nostalgia.android.core.MediaUrls
import tv.nostalgia.android.core.PublicSettings
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

/** Colors of the Halloween or Christmas season: the banner strip and the glow behind the live preview. */
data class SeasonTheme(val title: String, val text: String, val background: Color, val ink: Color, val glow: Color)

/** The season's look while the platform is in Halloween or Christmas with seasonal effects on, and the viewer keeps them on. */
fun seasonTheme(settings: PublicSettings, enabled: Boolean): SeasonTheme? = when {
    !enabled || !settings.seasonalEffects -> null
    settings.season == "Halloween" -> SeasonTheme("HALLOWEEN", "Especiales de terror hasta el 31", Color(0xFF2A1A0C), Color(0xFFFFC48A), Color(0xFF4A2A0E))
    settings.season == "Christmas" -> SeasonTheme("NAVIDAD", "Especiales navideños todo diciembre", Color(0xFF12261A), Color(0xFF9FE3B0), Color(0xFF173A24))
    else -> null
}

@Composable
fun SeasonBanner(theme: SeasonTheme, modifier: Modifier = Modifier) {
    val tv = LocalTvDevice.current
    Row(modifier.background(theme.background, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = if (tv) 7.dp else 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Txt(theme.title, if (tv) 10.sp else 11.sp, theme.ink, font = Mono, tracking = tracking(.1f))
        Txt(theme.text, if (tv) 12.sp else 13.sp, theme.ink, lines = 1)
    }
}
