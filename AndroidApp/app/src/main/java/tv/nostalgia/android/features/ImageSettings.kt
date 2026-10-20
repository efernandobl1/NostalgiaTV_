package tv.nostalgia.android.features

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.math.roundToInt
import tv.nostalgia.android.core.VideoSettings
import tv.nostalgia.android.shared.*

// "La imagen de antes": every CRT filter control, shared by the settings screens and the player panel.

private val Intensity = 0..100
private val Density = 1..10
private const val INTENSITY_STEP = 5

/**
 * Applies a change to the latest saved settings rather than the ones last drawn, so fast remote presses
 * (or a held ◀ ▶) never step from a stale value.
 */
typealias VideoEdit = ((VideoSettings) -> VideoSettings) -> Unit

/** Steps a filter value inside its range; the TV remote moves it one step per press. */
fun stepValue(value: Int, delta: Int, range: IntRange): Int = (value + delta).coerceIn(range)

// ── Phone ──

@Composable
fun MobileImageControls(video: VideoSettings, edit: VideoEdit) {
    Column {
        Toggle("Efecto CRT", "Líneas de barrido sobre el video", video.enabled) { edit { it.copy(enabled = !it.enabled) } }
        Toggle("Curvatura", "Bordes como pantalla de tubo", video.curvature) { edit { it.copy(curvature = !it.curvature) } }
        Toggle("Oscurecer bordes", "Viñeta alrededor de la imagen", video.vignette) { edit { it.copy(vignette = !it.vignette) } }
        Toggle("Animación de líneas", "Las líneas avanzan como en un tubo", video.animation) { edit { it.copy(animation = !it.animation) } }
        ImageSlider("Intensidad de líneas", "${video.intensity}%", video.intensity, Intensity, INTENSITY_STEP) { value -> edit { it.copy(intensity = value) } }
        ImageSlider("Densidad de líneas", "${video.density}", video.density, Density, 1) { value -> edit { it.copy(density = value) } }
        MobileButton("Restablecer imagen", { edit { VideoSettings() } }, Modifier.fillMaxWidth().padding(top = 14.dp), height = 44.dp)
    }
}

@Composable
private fun ImageSlider(label: String, shown: String, value: Int, range: IntRange, step: Int, onChange: (Int) -> Unit) {
    Column(Modifier.fillMaxWidth().topLine(Ntv.Raised2, bottom = true).padding(top = 12.dp, bottom = 4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Txt(label, 15.sp, modifier = Modifier.weight(1f))
            Txt(shown, 14.sp, Ntv.Amber, font = Mono)
        }
        Slider(value.toFloat(), { onChange(((it / step).roundToInt() * step).coerceIn(range)) },
            valueRange = range.first.toFloat()..range.last.toFloat(), steps = (range.last - range.first) / step - 1,
            colors = SliderDefaults.colors(thumbColor = Ntv.Amber, activeTrackColor = Ntv.Amber, inactiveTrackColor = Ntv.Raised2,
                activeTickColor = Color.Transparent, inactiveTickColor = Color.Transparent))
    }
}

/** Player panel on phones: a sheet over the episode list in portrait, a side panel in landscape. */
@Composable
fun BoxScope.MobileImagePanel(video: VideoSettings, edit: VideoEdit, side: Boolean, onClose: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Ntv.Ink3.copy(alpha = .35f))
        .clickable(remember { MutableInteractionSource() }, indication = null, onClick = onClose))
    val shape = if (side) RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp) else RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
    Column((if (side) Modifier.align(Alignment.CenterEnd).width(360.dp).fillMaxHeight() else Modifier.align(Alignment.BottomCenter).fillMaxWidth().fillMaxHeight(.62f))
        .background(Ntv.Panel, shape).border(1.dp, Ntv.Line, shape)
        .clickable(remember { MutableInteractionSource() }, indication = null) {}
        .safeDrawingPadding().padding(start = 16.dp, end = 16.dp, top = 12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Txt("La imagen de antes", 20.sp, font = Display, weight = FontWeight.Bold)
                Txt("Los cambios se ven al instante", 12.sp, Ntv.Muted)
            }
            MobileButton("Listo", onClose, height = 40.dp)
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = 16.dp)) { MobileImageControls(video, edit) }
    }
}

// ── Android TV ──

/** D-pad friendly rows: OK toggles a switch; ◀ ▶ (or OK, which wraps) move a range one step. */
@Composable
fun TvImageControls(video: VideoSettings, edit: VideoEdit, first: FocusRequester? = null) {
    val yes = { on: Boolean -> if (on) "SÍ" else "NO" }
    TvImageLine("Efecto CRT", "Líneas de barrido sobre el video", yes(video.enabled), video.enabled, Modifier.then(first?.let { Modifier.focusRequester(it) } ?: Modifier),
        onClick = { edit { it.copy(enabled = !it.enabled) } })
    TvImageLine("Curvatura", "Bordes como pantalla de tubo", yes(video.curvature), video.curvature, onClick = { edit { it.copy(curvature = !it.curvature) } })
    TvImageLine("Oscurecer bordes", "Viñeta alrededor de la imagen", yes(video.vignette), video.vignette, onClick = { edit { it.copy(vignette = !it.vignette) } })
    TvImageLine("Animación de líneas", "Las líneas avanzan como en un tubo", yes(video.animation), video.animation,
        onClick = { edit { it.copy(animation = !it.animation) } })
    TvImageLine("Intensidad de líneas", "◀ ▶ para ajustar de 5 en 5", "${video.intensity}%", false,
        onClick = { edit { it.copy(intensity = if (it.intensity >= Intensity.last) Intensity.first else stepValue(it.intensity, INTENSITY_STEP, Intensity)) } },
        onAdjust = { direction -> edit { it.copy(intensity = stepValue(it.intensity, direction * INTENSITY_STEP, Intensity)) } })
    TvImageLine("Densidad de líneas", "◀ ▶ para ajustar de 1 a 10", "${video.density}", false,
        onClick = { edit { it.copy(density = if (it.density >= Density.last) Density.first else stepValue(it.density, 1, Density)) } },
        onAdjust = { direction -> edit { it.copy(density = stepValue(it.density, direction, Density)) } })
    TvImageLine("Restablecer imagen", "Vuelve a los valores de fábrica", "›", false, onClick = { edit { VideoSettings() } })
}

@Composable
private fun TvImageLine(label: String, hint: String, value: String, on: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit,
    onAdjust: ((Int) -> Unit)? = null) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(9.dp)
    val keys = if (onAdjust == null) Modifier else Modifier.onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
        when (event.key) {
            Key.DirectionLeft -> { onAdjust(-1); true }
            Key.DirectionRight -> { onAdjust(1); true }
            else -> false
        }
    }
    Row(modifier.fillMaxWidth().heightIn(min = 52.dp).onFocusChanged { focused = it.isFocused }.then(keys)
        .focusRing(shape, onClick, scale = 1f, ring = Color.Transparent)
        .background(if (focused) Ntv.Raised2 else Color.Transparent, shape).then(if (focused) Modifier.border(1.dp, Ntv.Edge, shape) else Modifier)
        .padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Txt(label, 13.sp, weight = FontWeight.SemiBold)
            Txt(hint, 9.5.sp, Ntv.Muted)
        }
        Txt(if (onAdjust != null && focused) "◀ $value ▶" else value, 11.sp, if (on) Ntv.Ok else Ntv.Fg2, font = Mono, lines = 1)
    }
}

/** Player panel on Android TV: a side column so the filters can be judged over the video. */
@Composable
fun BoxScope.TvImagePanel(video: VideoSettings, edit: VideoEdit, onClose: () -> Unit) {
    val first = remember { FocusRequester() }
    LaunchedEffect(Unit) { delay(50); runCatching { first.requestFocus() } }
    // Compose spends the first BACK on clearing focus; the panel closes on that first press instead.
    Column(Modifier.align(Alignment.CenterEnd).width(360.dp).fillMaxHeight().onPreviewKeyEvent { event ->
        if (event.key != Key.Back) return@onPreviewKeyEvent false
        if (event.type == KeyEventType.KeyUp) onClose()
        true
    }.background(Ntv.Ink2.copy(alpha = .94f))
        .verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Txt("La imagen de antes", 22.sp, font = Display, weight = FontWeight.Bold)
        Txt("Los cambios se ven al instante · ATRÁS para cerrar", 10.sp, Ntv.Muted, modifier = Modifier.padding(bottom = 6.dp))
        TvImageControls(video, edit, first)
    }
}
