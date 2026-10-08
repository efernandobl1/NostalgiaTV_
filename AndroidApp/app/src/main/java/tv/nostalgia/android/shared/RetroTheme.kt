package tv.nostalgia.android.shared

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.darkColorScheme

object Retro {
    val Background = Color(0xFF171321)
    val Panel = Color(0xFF332842)
    val Cream = Color(0xFFFFF3D6)
    val Gold = Color(0xFFF2C76F)
    val Mint = Color(0xFF92D4CC)
    val Lavender = Color(0xFFBAA7D9)
    val Line = Color(0xFF6A577E)
}

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
