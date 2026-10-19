package tv.nostalgia.android.shared

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import tv.nostalgia.android.R

/** Design tokens of NostalgiaTV v2 (same names as the web theme). */
object Ntv {
    val Ink = Color(0xFF0E0E0C)
    val Ink2 = Color(0xFF0B0B09)
    val Ink3 = Color(0xFF050504)
    val Rail = Color(0xFF121210)
    val Panel = Color(0xFF171714)
    val Panel2 = Color(0xFF1A1A16)
    val Raised = Color(0xFF1F1F1B)
    val Raised2 = Color(0xFF24241F)
    val Line = Color(0xFF2C2C27)
    val Edge = Color(0xFF3A3A33)
    val Edge2 = Color(0xFF4A4A42)
    val Fg = Color(0xFFECE8DC)
    val Fg2 = Color(0xFFD6D2C6)
    val Muted = Color(0xFFA29E91)
    val Dim = Color(0xFF8C887D)
    val Faint = Color(0xFF5E5B52)
    val Amber = Color(0xFFFFB547)
    val AmberHi = Color(0xFFFFD08A)
    val OnAmber = Color(0xFF1A1206)
    val AmberWash = Color(0xFF24231C)
    val Cream = Color(0xFFFFF3DA)
    val Danger = Color(0xFFFF8A80)
    val Live = Color(0xFFFF6B5E)
    val OnLive = Color(0xFF1A0906)
    val Ok = Color(0xFF8BE08F)
    val Info = Color(0xFF6FD0EA)
    val Violet = Color(0xFFB8A6FF)
    /** rgba(236,232,220,α): translucent cream used by secondary buttons and chips. */
    fun Glass(alpha: Float) = Color(0xFFECE8DC).copy(alpha = alpha)
}

val Display = FontFamily(
    Font(R.font.chakra_petch_medium, FontWeight.Medium),
    Font(R.font.chakra_petch_semibold, FontWeight.SemiBold),
    Font(R.font.chakra_petch_bold, FontWeight.Bold),
)

/** IBM Plex Sans ships as a variable font; Android 8+ applies the weight axis. */
@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
val Sans = FontFamily(listOf(400, 500, 600, 700).map { weight ->
    Font(R.font.ibm_plex_sans, FontWeight(weight), variationSettings = FontVariation.Settings(FontVariation.weight(weight)))
})

val Mono = FontFamily(
    Font(R.font.ibm_plex_mono_regular, FontWeight.Normal),
    Font(R.font.ibm_plex_mono_medium, FontWeight.Medium),
    Font(R.font.ibm_plex_mono_semibold, FontWeight.SemiBold),
)

val LocalTvDevice = staticCompositionLocalOf { true }

@Composable
fun NostalgiaTheme(isTv: Boolean = true, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalTvDevice provides isTv) {
        MaterialTheme(colorScheme = darkColorScheme(
            primary = Ntv.Amber, onPrimary = Ntv.OnAmber,
            background = Ntv.Ink, onBackground = Ntv.Fg,
            surface = Ntv.Panel, onSurface = Ntv.Fg,
            secondary = Ntv.Ok, onSecondary = Ntv.Ink2,
            error = Ntv.Danger,
        ), content = content)
    }
}
