package tv.nostalgia.android.features

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import tv.nostalgia.android.core.VideoSettings

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
