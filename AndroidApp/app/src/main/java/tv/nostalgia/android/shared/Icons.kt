package tv.nostalgia.android.shared

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** The stroke icons of the design (24×24 viewBox, 2px round strokes); the logo uses a 36×36 viewBox. */
enum class NtvIcon(val viewport: Float, val stroke: String, val fill: String? = null) {
    Logo(36f, "M7,9 H29 A4,4 0 0 1 33,13 V27 A4,4 0 0 1 29,31 H7 A4,4 0 0 1 3,27 V13 A4,4 0 0 1 7,9 Z M12,3 L18,9 L24,3 M10,14 H22 A2,2 0 0 1 24,16 V24 A2,2 0 0 1 22,26 H10 A2,2 0 0 1 8,24 V16 A2,2 0 0 1 10,14 Z"),
    Search(24f, "M4,11 A7,7 0 1 0 18,11 A7,7 0 1 0 4,11 M20,20 L16.5,16.5"),
    Mic(24f, "M12,3 A3,3 0 0 1 15,6 V11 A3,3 0 0 1 9,11 V6 A3,3 0 0 1 12,3 Z M5,11 A7,7 0 0 0 19,11 M12,18 V21"),
    Tv(24f, "M4,5 H20 A2,2 0 0 1 22,7 V16 A2,2 0 0 1 20,18 H4 A2,2 0 0 1 2,16 V7 A2,2 0 0 1 4,5 Z M8,21 H16"),
    Back(24f, "M15,6 L9,12 L15,18"),
    Fullscreen(24f, "M4,9 V4 H9 M20,9 V4 H15 M4,15 V20 H9 M20,15 V20 H15"),
    Volume(24f, "M4,9 V15 H8 L13,19 V5 L8,9 Z M17,8 A5,5 0 0 1 17,16"),
    Muted(24f, "M4,9 V15 H8 L13,19 V5 L8,9 Z M17,9 L22,15 M22,9 L17,15"),
    Lock(24f, "M7,11 H17 A2,2 0 0 1 19,13 V18 A2,2 0 0 1 17,20 H7 A2,2 0 0 1 5,18 V13 A2,2 0 0 1 7,11 Z M8,11 V8 A4,4 0 0 1 16,8 V11"),
    Link(24f, "M10,14 A4,4 0 0 0 15.7,14 L18.7,11 A4,4 0 0 0 13,5.3 L12,6.3 M14,10 A4,4 0 0 0 8.3,10 L5.3,13 A4,4 0 0 0 11,18.7 L12,17.7"),
    Sort(24f, "M7,4 V20 M3,16 L7,20 L11,16 M17,20 V4 M13,8 L17,4 L21,8"),
    Scan(24f, "M4,8 V4 H8 M20,8 V4 H16 M4,16 V20 H8 M20,16 V20 H16 M9,9 H15 V15 H9 Z"),
    Check(24f, "M5,12 L10,17 L20,7"),
    Play(24f, "", "M7,4 L20,12 L7,20 Z"),
    Pause(24f, "", "M6,4 H10 V20 H6 Z M14,4 H18 V20 H14 Z"),
    Google(24f, "M3,12 A9,9 0 1 0 21,12 A9,9 0 1 0 3,12 M12,12 H20");

    val vector: ImageVector by lazy {
        ImageVector.Builder(name, viewport.dp, viewport.dp, viewport, viewport).apply {
            if (stroke.isNotEmpty()) addPath(PathParser().parsePathString(stroke).toNodes(), stroke = SolidColor(Color.White),
                strokeLineWidth = 2f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round)
            fill?.let { addPath(PathParser().parsePathString(it).toNodes(), fill = SolidColor(Color.White)) }
        }.build()
    }
}

@Composable
fun Icon(icon: NtvIcon, size: Dp, color: Color, modifier: Modifier = Modifier) {
    Image(rememberVectorPainter(icon.vector), contentDescription = null, modifier = modifier.size(size), colorFilter = ColorFilter.tint(color))
}

