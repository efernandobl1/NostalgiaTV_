package tv.nostalgia.android.shared

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import tv.nostalgia.android.R
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.darkColorScheme

object Retro {
    val Background = Color(0xFF17141F)
    val Panel = Color(0xFF30293D)
    val Cream = Color(0xFFF3ECDC)
    val Gold = Color(0xFFEAC17A)
    val Mint = Color(0xFFB4DFA1)
    val Lavender = Color(0xFFC3B8CC)
    val Line = Color(0xFF62536F)
}

val RetroDisplay = FontFamily(Font(R.font.vt323_regular))

val LocalTvDevice = staticCompositionLocalOf { true }

@Composable
fun RetroTheme(isTv: Boolean = true, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalTvDevice provides isTv) {
        MaterialTheme(colorScheme = darkColorScheme(
            primary = Retro.Gold, onPrimary = Retro.Background,
            background = Retro.Background, onBackground = Retro.Cream,
            surface = Retro.Panel, onSurface = Retro.Cream,
            secondary = Retro.Mint, onSecondary = Retro.Background,
        )) {
            androidx.compose.material3.MaterialTheme(colorScheme = androidx.compose.material3.darkColorScheme(
                primary = Retro.Gold, onPrimary = Retro.Background,
                background = Retro.Background, onBackground = Retro.Cream,
                surface = Retro.Panel, onSurface = Retro.Cream,
                secondary = Retro.Mint, onSecondary = Retro.Background,
            ), content = content)
        }
    }
}
