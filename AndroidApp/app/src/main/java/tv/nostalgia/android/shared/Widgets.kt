package tv.nostalgia.android.shared

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.*
import coil3.compose.AsyncImage

@Composable
fun RetroButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, selected: Boolean = false) {
    if (LocalTvDevice.current) {
        Button(onClick = onClick, modifier = modifier, enabled = enabled,
            shape = ButtonDefaults.shape(RoundedCornerShape(6.dp)),
            colors = ButtonDefaults.colors(containerColor = if (selected) Retro.Gold else Retro.Panel,
                contentColor = if (selected) Retro.Background else Retro.Cream,
                focusedContainerColor = Retro.Gold, focusedContentColor = Retro.Background),
            scale = ButtonDefaults.scale(focusedScale = 1.025f)) {
            Text(label, fontSize = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    } else {
        androidx.compose.material3.Button(onClick = onClick, modifier = modifier.heightIn(min = 48.dp), enabled = enabled,
            shape = RoundedCornerShape(6.dp),
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                containerColor = if (selected) Retro.Gold else Retro.Panel,
                contentColor = if (selected) Retro.Background else Retro.Cream)) {
            Text(label, color = if (selected) Retro.Background else Retro.Cream, fontSize = 16.sp,
                maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun RetroSurface(onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    if (LocalTvDevice.current) {
        Card(onClick = onClick, modifier = modifier,
            colors = CardDefaults.colors(containerColor = Retro.Panel, contentColor = Retro.Cream,
                focusedContainerColor = Retro.Cream, focusedContentColor = Retro.Background),
            scale = CardDefaults.scale(focusedScale = 1.025f),
            shape = CardDefaults.shape(RoundedCornerShape(8.dp))) { content() }
    } else {
        androidx.compose.material3.Card(onClick = onClick, modifier = modifier,
            shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, Retro.Line.copy(alpha = 0.45f)),
            colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = Retro.Panel, contentColor = Retro.Cream)) {
            CompositionLocalProvider(LocalContentColor provides Retro.Cream) { content() }
        }
    }
}

@Composable
fun Logo(image: String?, name: String, modifier: Modifier = Modifier) {
    Box(modifier.background(Retro.Cream, RoundedCornerShape(5.dp)), contentAlignment = Alignment.Center) {
        if (image != null) AsyncImage(image, contentDescription = null,
            modifier = Modifier.fillMaxSize().padding(8.dp), contentScale = ContentScale.Fit)
        else Text(name.take(1), color = Retro.Panel, fontFamily = FontFamily.Monospace, fontSize = 30.sp)
    }
}

@Composable
fun TapeCard(name: String, image: String?, detail: String, onClick: () -> Unit, modifier: Modifier = Modifier, compact: Boolean = false) {
    val tv = LocalTvDevice.current
    RetroSurface(onClick, modifier.height(if (compact || !tv) 220.dp else 248.dp)) {
        Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Logo(image, name, Modifier.fillMaxWidth().height(if (tv) 110.dp else 96.dp))
            Text(name, modifier = Modifier.weight(1f), fontSize = if (tv) 20.sp else 17.sp,
                fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(detail, fontSize = if (tv) 16.sp else 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("▶", fontSize = 16.sp)
            }
        }
    }
}

@Composable
fun Message(text: String, action: String? = null, onAction: () -> Unit = {}) {
    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(text, color = Retro.Cream, fontSize = if (LocalTvDevice.current) 20.sp else 17.sp)
        if (action != null) RetroButton(action, onAction)
    }
}
