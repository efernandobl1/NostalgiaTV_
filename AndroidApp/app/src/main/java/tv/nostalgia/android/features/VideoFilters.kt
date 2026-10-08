package tv.nostalgia.android.features

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.tv.material3.Text
import kotlinx.coroutines.delay
import tv.nostalgia.android.core.VideoSettings
import tv.nostalgia.android.shared.*

@Composable
fun VideoFilters(settings: VideoSettings, modifier: Modifier = Modifier) {
    if (!settings.enabled) return
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val phase = produceState(0f, settings.animation, settings.density, settings.intensity, lifecycle) {
        value = 0f
        if (settings.animation && settings.intensity > 0) lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) { delay(150); value = (value + .25f) % 1f }
        }
    }
    // Repeated gradients are painted by the GPU above SurfaceView; video decoding remains hardware-backed.
    val period = settings.density * 2f
    val lines = remember(settings.intensity, period) { Brush.verticalGradient(
        0f to Color.Black.copy(alpha = settings.intensity / 100f), (1f / period) to Color.Black.copy(alpha = settings.intensity / 100f),
        (1.01f / period) to Color.Transparent, 1f to Color.Transparent, endY = period, tileMode = TileMode.Repeated) }
    Canvas(modifier.clearAndSetSemantics {}) {
        translate(top = phase.value * period) { drawRect(lines, topLeft = Offset(0f, -period), size = size.copy(height = size.height + period)) }
        if (settings.vignette || settings.curvature) {
            val opacity = if (settings.vignette && settings.curvature) .8f else if (settings.vignette) .7f else .5f
            drawRect(Brush.radialGradient(0f to Color.Transparent, .5f to Color.Transparent, 1f to Color.Black.copy(alpha = opacity),
                center = center, radius = size.minDimension * .8f))
        }
    }
}

@Composable
fun ImageSettings(model: AppViewModel, settings: VideoSettings, onClose: () -> Unit) {
    RetroDialog("La imagen de antes.", onClose) {
        BoxWithConstraints(Modifier.weight(1f, fill = false)) {
            val switches: @Composable () -> Unit = {
                FilterSwitch("Efecto CRT", settings.enabled) { model.updateVideoSettings(settings.copy(enabled = !settings.enabled)) }
                FilterSwitch("Curvatura", settings.curvature) { model.updateVideoSettings(settings.copy(curvature = !settings.curvature)) }
                FilterSwitch("Oscurecer bordes", settings.vignette) { model.updateVideoSettings(settings.copy(vignette = !settings.vignette)) }
                FilterSwitch("Animación de líneas", settings.animation) { model.updateVideoSettings(settings.copy(animation = !settings.animation)) }
            }
            val ranges: @Composable () -> Unit = {
                FilterRange("Intensidad de líneas", settings.intensity, 0..100, 5) { model.updateVideoSettings(settings.copy(intensity = it)) }
                FilterRange("Densidad de líneas", settings.density, 1..10, 1) { model.updateVideoSettings(settings.copy(density = it)) }
                CinemaButton("Restablecer imagen", { model.updateVideoSettings(VideoSettings()) })
            }
            if (maxWidth >= 600.dp) Row(Modifier.verticalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) { switches() }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(16.dp)) { ranges() }
            } else Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                switches()
                ranges()
            }
        }
    }
}

@Composable
private fun FilterSwitch(label: String, checked: Boolean, onClick: () -> Unit) {
    RetroSurface(onClick, Modifier.fillMaxWidth().semantics { stateDescription = if (checked) "Activado" else "Desactivado" }) {
        Row(Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, fontSize = 17.sp)
            Text(if (checked) "✓" else "—", fontSize = 20.sp)
        }
    }
}

@Composable
private fun FilterRange(label: String, value: Int, range: IntRange, step: Int, onChange: (Int) -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("$label · $value${if (range.last == 100) "%" else ""}", color = Retro.Cream, fontSize = 17.sp)
        if (LocalTvDevice.current) Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CinemaButton("−", { onChange((value - step).coerceIn(range)) }, enabled = value > range.first)
            CinemaButton("+", { onChange((value + step).coerceIn(range)) }, enabled = value < range.last)
        } else androidx.compose.material3.Slider(value.toFloat(), { onChange(it.toInt()) }, valueRange = range.first.toFloat()..range.last.toFloat())
    }
}
