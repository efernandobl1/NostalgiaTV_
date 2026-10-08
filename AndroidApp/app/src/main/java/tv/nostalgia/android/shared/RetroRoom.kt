package tv.nostalgia.android.shared

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import tv.nostalgia.android.R

@Composable
fun RoomBackground(modifier: Modifier = Modifier) {
    Canvas(modifier.clearAndSetSemantics {}) {
        drawRect(Brush.radialGradient(listOf(Color(0xFF3A2B48), Retro.Background),
            center = Offset(size.width * .25f, size.height * .35f), radius = size.width * .9f))
        val floor = size.height * .79f
        drawRect(Color(0xFF262035), topLeft = Offset(0f, floor), size = androidx.compose.ui.geometry.Size(size.width, size.height - floor))
        drawLine(Retro.Line.copy(alpha = .25f), Offset(0f, floor), Offset(size.width, floor), 1.dp.toPx())
        for (i in 0..8) drawLine(Retro.Line.copy(alpha = .13f), Offset(size.width * .5f, floor), Offset(size.width * i / 8, size.height), 1.dp.toPx())
    }
}

@Composable
fun RetroRoom(modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier, contentAlignment = Alignment.TopCenter) {
        val sceneHeight = maxHeight
        val sceneWidth = minOf(maxWidth, sceneHeight * .82f)
        Box(Modifier.width(sceneWidth).height(sceneHeight)) {
            Image(painterResource(R.drawable.retro_room), contentDescription = null,
                modifier = Modifier.fillMaxWidth().height(sceneHeight * .88f), contentScale = ContentScale.Fit)
            Column(Modifier.align(Alignment.TopCenter).offset(y = sceneHeight * .075f)
                .width(sceneWidth * .43f).height(sceneHeight * .17f),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Text("Ntv", color = Retro.Gold, fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold, fontSize = if (sceneHeight < 300.dp) 22.sp else 30.sp)
                if (sceneHeight >= 340.dp) Text("Estás en casa.", color = Retro.Cream, fontSize = 13.sp)
            }
            Image(painterResource(R.drawable.retro_viewer), contentDescription = null,
                modifier = Modifier.align(Alignment.BottomCenter).offset(x = sceneWidth * .12f)
                    .width(sceneWidth * .30f).height(sceneHeight * .31f), contentScale = ContentScale.Fit)
        }
    }
}
