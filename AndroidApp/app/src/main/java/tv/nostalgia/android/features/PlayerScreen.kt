package tv.nostalgia.android.features

import android.view.KeyEvent
import android.view.ViewGroup
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.repeatOnLifecycle
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import androidx.media3.ui.PlayerView
import androidx.tv.material3.Text
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import tv.nostalgia.android.core.*
import tv.nostalgia.android.shared.*
import kotlin.math.abs

@androidx.annotation.OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(model: AppViewModel, playback: Playback) {
    val context = LocalContext.current
    val tv = LocalTvDevice.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val latestPlayback by rememberUpdatedState(playback)
    val appState by model.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    var overlay by remember { mutableStateOf(true) }
    val visibleError = error ?: appState.error
    val player = remember {
        val http = OkHttpDataSource.Factory(SecureHttp.create(context)).setUserAgent("NostalgiaTV-AndroidTV/0.1")
        ExoPlayer.Builder(context).setMediaSourceFactory(DefaultMediaSourceFactory(http))
            .setLoadControl(DefaultLoadControl.Builder().setBufferDurationsMs(10000, 30000, 1500, 2500)
                .setTargetBufferBytes(24 * 1024 * 1024).build()).build().apply {
                setHandleAudioBecomingNoisy(true)
                setAudioAttributes(androidx.media3.common.AudioAttributes.DEFAULT, true)
            }
    }
    val mediaSession = remember(player) { MediaSession.Builder(context, player).build() }

    fun prepare() {
        try {
            val url = MediaUrls.resolve(model.api.base, latestPlayback.filePath)
            error = null
            player.setMediaItem(MediaItem.Builder().setUri(url).setMediaId(latestPlayback.episodeId.toString())
                .setMediaMetadata(androidx.media3.common.MediaMetadata.Builder()
                    .setTitle(latestPlayback.title).setArtist(latestPlayback.subtitle).build()).build(),
                (latestPlayback.startSecond * 1000).toLong())
            player.prepare()
            player.play()
        } catch (_: IllegalArgumentException) { error = "El archivo no tiene una dirección válida." }
    }

    LaunchedEffect(playback.channel?.id, playback.segmentId, playback.filePath) { prepare() }

    DisposableEffect(player, lifecycle) {
        val activity = context as? ComponentActivity
        activity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        var resume = true
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> { resume = player.playWhenReady; model.rememberPosition(player.currentPosition / 1000.0); player.pause() }
                Lifecycle.Event.ON_RESUME -> if (resume) player.play()
                else -> Unit
            }
        }
        val listener = object : Player.Listener {
            override fun onPlayerError(exception: PlaybackException) {
                error = "No se pudo reproducir el video. Comprueba la conexión y vuelve a intentarlo."
                overlay = true
            }
        }
        lifecycle.addObserver(observer)
        player.addListener(listener)
        onDispose {
            lifecycle.removeObserver(observer)
            player.removeListener(listener)
            mediaSession.release()
            player.release()
            activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    LaunchedEffect(playback.channel?.id) {
        val channel = playback.channel ?: return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                var waitSeconds = 10.0
                try {
                    val state = model.liveState(channel)
                    error = null
                    if (state.segmentId == latestPlayback.segmentId && player.playbackState == Player.STATE_READY &&
                        abs(player.currentPosition / 1000.0 - state.currentSecond) > 15) {
                        player.seekTo((state.currentSecond * 1000).toLong())
                    }
                    waitSeconds = state.secondsUntilNext.coerceIn(1.0, 10.0)
                } catch (exception: Exception) {
                    if (exception is CancellationException) throw exception
                    if (exception is ApiException && exception.status == 404) error = "El canal está sin programación. Prueba otro canal."
                }
                delay((waitSeconds * 1000).toLong())
            }
        }
    }

    LaunchedEffect(playback.episodeId, playback.segmentId, playback.filePath) {
        if (playback.episodeId <= 0) return@LaunchedEffect
        val sampler = WatchSampler()
        fun save(range: WatchRange?) {
            val duration = player.duration / 1000.0
            if (range != null && duration > 0 && player.duration != C.TIME_UNSET) scope.launch {
                try { model.recordProgress(playback.episodeId, range.start, range.end, duration) }
                catch (exception: Exception) { if (exception is CancellationException) throw exception }
            }
        }
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            try {
                while (true) {
                    save(sampler.sample(player.currentPosition / 1000.0, player.isPlaying))
                    if (player.playbackState == Player.STATE_ENDED) save(sampler.flush())
                    delay(1000)
                }
            } finally { save(sampler.flush()) }
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black).onPreviewKeyEvent { event ->
        if (event.nativeKeyEvent.action == KeyEvent.ACTION_DOWN && playback.channel != null) {
            when (event.nativeKeyEvent.keyCode) {
                KeyEvent.KEYCODE_CHANNEL_UP -> { model.nextChannel(1); true }
                KeyEvent.KEYCODE_CHANNEL_DOWN -> { model.nextChannel(-1); true }
                else -> false
            }
        } else false
    }) {
        AndroidView(factory = { viewContext -> PlayerView(viewContext).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            this.player = player
            controllerShowTimeoutMs = 5000
            setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { overlay = it == android.view.View.VISIBLE })
            if (tv) requestFocus()
        } }, modifier = Modifier.fillMaxSize(), update = {
            it.setShowRewindButton(playback.channel == null)
            it.setShowFastForwardButton(playback.channel == null)
            val visibility = if (playback.channel == null) android.view.View.VISIBLE else android.view.View.GONE
            for (id in listOf(androidx.media3.ui.R.id.exo_progress, androidx.media3.ui.R.id.exo_position, androidx.media3.ui.R.id.exo_duration)) {
                it.findViewById<android.view.View>(id)?.visibility = visibility
            }
        }, onRelease = { it.player = null })

        if (overlay || visibleError != null) {
            val bar = Modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.88f))
                .then(if (tv) Modifier else Modifier.safeDrawingPadding()).padding(if (tv) 24.dp else 14.dp)
            if (tv) Row(bar, horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                PlaybackTitle(playback, Modifier.weight(1f))
                PlaybackActions(model, playback)
            } else Column(bar, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                PlaybackTitle(playback)
                PlaybackActions(model, playback)
            }
        }
        visibleError?.let { message ->
            Column(Modifier.align(Alignment.Center).widthIn(max = 620.dp).background(Retro.Background).padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(message, color = Retro.Cream, fontSize = 22.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    RetroButton("Volver a intentar", { if (playback.channel != null) model.playChannel(playback.channel) else prepare() })
                    RetroButton("Volver", model::back)
                }
            }
        }
    }
}

@Composable
private fun PlaybackTitle(playback: Playback, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(playback.title.ifBlank { "En emisión" }, color = Retro.Cream, fontSize = 22.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text(playback.subtitle, color = Retro.Mint, fontSize = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun PlaybackActions(model: AppViewModel, playback: Playback) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (playback.channel != null) {
            RetroButton("Canal −", { model.nextChannel(-1) })
            RetroButton("Canal +", { model.nextChannel(1) })
        }
        RetroButton("Volver", model::back)
    }
}
