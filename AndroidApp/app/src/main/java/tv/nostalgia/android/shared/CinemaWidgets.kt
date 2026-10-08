package tv.nostalgia.android.shared

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.tv.material3.*

@Composable
fun CinemaButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, selected: Boolean = false, enabled: Boolean = true) {
    val border = BorderStroke(1.dp, if (selected) Retro.Mint else Retro.Line)
    if (LocalTvDevice.current) Button(onClick, modifier.heightIn(min = 44.dp), enabled = enabled,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        shape = ButtonDefaults.shape(RoundedCornerShape(4.dp)),
        border = ButtonDefaults.border(border = Border(border), focusedBorder = Border(BorderStroke(2.dp, Retro.Gold))),
        colors = ButtonDefaults.colors(containerColor = Retro.Background.copy(alpha = .94f), contentColor = if (selected) Retro.Mint else Retro.Cream,
            focusedContainerColor = Retro.Gold, focusedContentColor = Retro.Background),
        scale = ButtonDefaults.scale(focusedScale = 1f)) {
        Text(label, fontSize = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    } else androidx.compose.material3.OutlinedButton(onClick, modifier.heightIn(min = 48.dp), enabled = enabled,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp), border = border, shape = RoundedCornerShape(4.dp),
        colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(containerColor = Retro.Background.copy(alpha = .94f),
            contentColor = if (selected) Retro.Mint else Retro.Cream)) {
        Text(label, color = if (selected) Retro.Mint else Retro.Cream, fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun RetroDialog(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val tv = LocalTvDevice.current
    val closeFocus = remember { FocusRequester() }
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().padding(if (tv) 24.dp else 12.dp), contentAlignment = Alignment.Center) {
            Column(Modifier.widthIn(max = 900.dp).fillMaxWidth().heightIn(max = maxHeight)
                .background(Retro.Background, RoundedCornerShape(6.dp)).border(1.dp, Retro.Line, RoundedCornerShape(6.dp))
                .padding(if (tv) 24.dp else 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(title, color = Retro.Cream, fontFamily = RetroDisplay, fontSize = if (tv) 36.sp else 30.sp, modifier = Modifier.weight(1f))
                    CinemaButton("Cerrar", onClose, Modifier.focusRequester(closeFocus))
                }
                content()
            }
        }
        LaunchedEffect(Unit) { if (tv) closeFocus.requestFocus() }
    }
}
