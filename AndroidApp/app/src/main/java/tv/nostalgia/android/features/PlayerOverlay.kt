package tv.nostalgia.android.features

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.tv.material3.*
import kotlinx.coroutines.delay
import tv.nostalgia.android.core.*
import tv.nostalgia.android.shared.*

enum class PlayerPanel { Image, Guide, Series, Episodes, Profile }

@Composable
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
fun PlayerOverlay(model: AppViewModel, state: AppState, playback: Playback, player: Player, onPanel: (PlayerPanel) -> Unit) {
    val tv = LocalTvDevice.current
    val initialFocus = remember { FocusRequester() }
    var position by remember { mutableLongStateOf(player.currentPosition) }
    var duration by remember { mutableLongStateOf(0L) }
    var playing by remember { mutableStateOf(player.isPlaying) }
    var volume by remember { mutableFloatStateOf(player.volume) }
    var savedVolume by remember { mutableFloatStateOf(1f) }
    val sliderColors = androidx.compose.material3.SliderDefaults.colors(
        thumbColor = Retro.Mint, activeTrackColor = Retro.Mint, inactiveTrackColor = Retro.Line)
    LaunchedEffect(player) {
        while (true) {
            position = player.currentPosition.coerceAtLeast(0)
            duration = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0
            playing = player.isPlaying
            delay(500)
        }
    }
    BoxWithConstraints(Modifier.fillMaxSize().background(Brush.verticalGradient(
        0f to Color.Black.copy(alpha = .82f), .2f to Color.Black.copy(alpha = .3f), .4f to Color.Transparent,
        .55f to Color.Black.copy(alpha = .25f), .7f to Color.Black.copy(alpha = .78f), 1f to Color.Black.copy(alpha = .96f)))
        .then(if (tv) Modifier else Modifier.safeDrawingPadding()).padding(if (tv) 24.dp else 12.dp)) {
        val compact = maxHeight < 420.dp
        val wide = maxWidth >= 600.dp
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
            val actions: @Composable () -> Unit = {
                CinemaButton("Sincronizar", { model.refreshSession(); onPanel(PlayerPanel.Profile) })
                if (playback.channel != null) CinemaButton("Guía", { onPanel(PlayerPanel.Guide) })
                CinemaButton(if (playback.channel != null) "Series" else "Episodios", {
                    if (playback.channel != null) model.showSeriesList()
                    onPanel(if (playback.channel != null) PlayerPanel.Series else PlayerPanel.Episodes)
                })
                CinemaButton("Imagen", { onPanel(PlayerPanel.Image) }, Modifier.focusRequester(initialFocus))
                if (!tv) {
                    CinemaButton(if (volume == 0f) "Activar sonido" else "Silenciar", {
                        if (volume > 0) { savedVolume = volume; volume = 0f } else volume = savedVolume
                        player.volume = volume
                    })
                    androidx.compose.material3.Slider(volume, { volume = it; player.volume = it },
                        colors = sliderColors,
                        modifier = Modifier.width(100.dp).height(48.dp).semantics { contentDescription = "Volumen" },
                        thumb = { Box(Modifier.size(16.dp).background(Retro.Mint, CircleShape)) },
                        track = { androidx.compose.material3.SliderDefaults.Track(it, Modifier.height(4.dp), colors = sliderColors, thumbTrackGapSize = 0.dp) })
                }
                CinemaButton(if (tv) "Volver a la sala" else "Salir de pantalla completa", model::back)
            }
            if (wide) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.Top) {
                Text("NostalgiaTV", color = Retro.Cream, fontFamily = RetroDisplay, fontSize = if (compact) 28.sp else 34.sp,
                    maxLines = 1, modifier = Modifier.width(180.dp).padding(top = 6.dp))
                FlowRow(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End), verticalArrangement = Arrangement.spacedBy(8.dp)) { actions() }
            } else FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("NostalgiaTV", color = Retro.Cream, fontFamily = RetroDisplay, fontSize = 28.sp, maxLines = 1, modifier = Modifier.padding(top = 6.dp, end = 8.dp))
                actions()
            }
            Column(verticalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 10.dp)) {
                Text(if (playback.channel != null) "En vivo" else "A tu ritmo", color = Retro.Mint, fontSize = 14.sp)
                Text(playback.channel?.name ?: playback.seriesName, color = Retro.Cream, fontFamily = RetroDisplay,
                    fontSize = if (compact) 30.sp else 42.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(playback.title, color = Retro.Cream, fontSize = if (compact) 16.sp else 18.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (playback.channel != null) LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(4.dp)) {
                    items(state.channels, key = { it.id }) { channel ->
                        ChannelKey(model, channel, playback.channel.id == channel.id, compact)
                    }
                } else {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        val index = state.episodes.indexOfFirst { it.id == playback.episodeId }
                        CinemaButton("Anterior", { model.nextEpisode(-1) }, enabled = index > 0)
                        CinemaButton("−10 s", { player.seekTo((position - 10000).coerceAtLeast(0)) })
                        CinemaButton(if (playing) "Pausar" else "Reproducir", { if (player.isPlaying) player.pause() else player.play(); playing = player.isPlaying })
                        CinemaButton("+10 s", { player.seekTo((position + 10000).coerceAtMost(duration)) }, enabled = duration > 0)
                        CinemaButton("Siguiente", { model.nextEpisode(1) }, enabled = index >= 0 && index < state.episodes.lastIndex)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("${playTime(position)} / ${playTime(duration)}", color = Retro.Lavender, fontSize = 14.sp)
                        androidx.compose.material3.Slider(position.coerceAtMost(duration).toFloat(), { player.seekTo(it.toLong()) },
                            colors = sliderColors,
                            valueRange = 0f..duration.coerceAtLeast(1).toFloat(), enabled = duration > 0,
                            modifier = Modifier.weight(1f).height(40.dp).semantics { contentDescription = "Posición del episodio" }
                                .onPreviewKeyEvent { event ->
                                    if (event.nativeKeyEvent.action != android.view.KeyEvent.ACTION_DOWN) false
                                    else when (event.nativeKeyEvent.keyCode) {
                                        android.view.KeyEvent.KEYCODE_DPAD_LEFT -> { player.seekTo((position - 10000).coerceAtLeast(0)); true }
                                        android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> { player.seekTo((position + 10000).coerceAtMost(duration)); true }
                                        else -> false
                                    }
                                })
                    }
                }
            }
        }
    }
    LaunchedEffect(Unit) { if (tv) initialFocus.requestFocus() }
}

@Composable
private fun ChannelKey(model: AppViewModel, channel: Channel, selected: Boolean, compact: Boolean) {
    val content: @Composable () -> Unit = {
        Row(Modifier.width(if (compact) 220.dp else 250.dp).height(if (compact) 72.dp else 96.dp).padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Logo(channel.logoPath?.let { runCatching { MediaUrls.resolve(model.api.base, it) }.getOrNull() }, channel.name,
                Modifier.width(if (compact) 56.dp else 64.dp).height(if (compact) 40.dp else 48.dp))
            Text(channel.name, color = Retro.Cream, fontSize = 16.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
    }
    val border = BorderStroke(1.dp, if (selected) Retro.Mint else Retro.Line)
    if (LocalTvDevice.current) Card({ model.playChannel(channel) },
        colors = CardDefaults.colors(containerColor = Retro.Background.copy(alpha = .94f), focusedContainerColor = Retro.Panel),
        border = CardDefaults.border(border = Border(border), focusedBorder = Border(BorderStroke(2.dp, Retro.Gold))),
        shape = CardDefaults.shape(RoundedCornerShape(4.dp)), scale = CardDefaults.scale(focusedScale = 1f)) { content() }
    else androidx.compose.material3.Card({ model.playChannel(channel) }, border = border, shape = RoundedCornerShape(4.dp),
        colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = Retro.Background.copy(alpha = .94f))) { content() }
}

private fun playTime(milliseconds: Long): String = "%d:%02d".format(milliseconds / 60000, milliseconds / 1000 % 60)
