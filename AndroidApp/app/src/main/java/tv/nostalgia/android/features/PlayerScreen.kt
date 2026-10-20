package tv.nostalgia.android.features

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.net.ConnectivityManager
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import tv.nostalgia.android.core.*
import tv.nostalgia.android.shared.*
import kotlin.math.abs

/** Shared playback controls handed to the TV and phone layouts; [keys] is the first button of the TV OSD row. */
class PlayerControls(val player: Player, val overlay: MutableState<Boolean>, val keys: FocusRequester = FocusRequester(), val poke: () -> Unit)

@androidx.annotation.OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(model: AppViewModel, playback: Playback) {
    val context = LocalContext.current
    val tv = LocalTvDevice.current
    val landscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE
    val fullscreen = tv || landscape
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val latestPlayback by rememberUpdatedState(playback)
    val appState by model.state.collectAsStateWithLifecycle()
    val preferences by model.preferences.collectAsStateWithLifecycle()
    val settings by model.videoSettings.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    val overlay = remember { mutableStateOf(true) }
    var interaction by remember { mutableLongStateOf(0L) }
    var guideOpen by remember { mutableStateOf(false) }
    var imageOpen by remember { mutableStateOf(false) }
    val wakeFocus = remember { FocusRequester() }
    // The OSD buttons sit inside the focusable player surface; the remote reaches them with ▶ (live) or ▼ (episodes).
    var surfaceFocused by remember { mutableStateOf(false) }
    val blockedByData = !tv && !preferences.mobileData &&
        context.getSystemService(ConnectivityManager::class.java)?.isActiveNetworkMetered == true
    val visibleError = if (blockedByData) "Reproducción con datos móviles desactivada. Conéctate a Wi-Fi o cámbialo en Perfil → Ajustes."
        else error ?: appState.error
    val player = remember {
        val http = OkHttpDataSource.Factory(SecureHttp.create(context, origin = model.api.base)).setUserAgent("NostalgiaTV-Android/2.0")
        ExoPlayer.Builder(context).setMediaSourceFactory(DefaultMediaSourceFactory(http))
            .setLoadControl(DefaultLoadControl.Builder().setBufferDurationsMs(10000, 30000, 1500, 2500)
                .setTargetBufferBytes(24 * 1024 * 1024).build()).build().apply {
                setHandleAudioBecomingNoisy(true)
                setAudioAttributes(androidx.media3.common.AudioAttributes.DEFAULT, true)
            }
    }
    val mediaSession = remember(player) { MediaSession.Builder(context, player).build() }
    val controls = remember(player) { PlayerControls(player, overlay) { interaction++; overlay.value = true } }
    BackHandler(guideOpen) { guideOpen = false; overlay.value = true }
    BackHandler(imageOpen) { imageOpen = false; overlay.value = true }
    LaunchedEffect(overlay.value, interaction, guideOpen, imageOpen, visibleError, fullscreen) {
        if (fullscreen && overlay.value && !guideOpen && !imageOpen && visibleError == null) {
            delay(5000)
            if (player.isPlaying) overlay.value = false
        }
    }
    LaunchedEffect(overlay.value, guideOpen, imageOpen) { if (tv && !guideOpen && !imageOpen) runCatching { wakeFocus.requestFocus() } }
    val openImage = { imageOpen = true; guideOpen = false }

    fun prepare() {
        if (blockedByData) return
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

    LaunchedEffect(playback.channel?.id, playback.segmentId, playback.filePath, blockedByData) { prepare() }
    LaunchedEffect(playback.channel?.id) {
        playback.channel?.let { channel ->
            model.updatePreferences(model.preferences.value.copy(lastChannelId = channel.id))
            if (!tv) model.loadComments(channel.id)
        }
    }

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
            override fun onIsPlayingChanged(isPlaying: Boolean) { interaction++; if (!isPlaying) overlay.value = true }
            override fun onPlayerError(exception: PlaybackException) {
                error = "No se pudo reproducir el video. Comprueba la conexión y vuelve a intentarlo."
                overlay.value = true
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
            // Rotating recreates the activity; only a player that is really closing gives the orientation back.
            if (!tv && activity?.isChangingConfigurations != true) activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    // Phones hide the system bars only in landscape fullscreen.
    DisposableEffect(fullscreen) {
        val window = (context as? ComponentActivity)?.window
        val bars = window?.let { WindowInsetsControllerCompat(it, it.decorView) }
        if (!tv) { if (fullscreen) bars?.hide(WindowInsetsCompat.Type.systemBars()) else bars?.show(WindowInsetsCompat.Type.systemBars()) }
        onDispose { if (!tv) bars?.show(WindowInsetsCompat.Type.systemBars()) }
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
                try { model.recordProgress(playback.episodeId, range.start, range.end, duration, playback.seriesId) }
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

    val video: @Composable (Modifier) -> Unit = { modifier ->
        Box(modifier.background(Color.Black)) {
            AndroidView(factory = { viewContext -> PlayerView(viewContext).apply {
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                this.player = player
                useController = false
            } }, modifier = Modifier.fillMaxSize(), onRelease = { it.player = null })
            VideoFilters(settings, Modifier.fillMaxSize())
        }
    }

    val live = playback.channel != null
    val keys = Modifier.focusRequester(wakeFocus).onFocusChanged { surfaceFocused = it.isFocused }.onPreviewKeyEvent { event ->
        if (event.nativeKeyEvent.action != KeyEvent.ACTION_DOWN || guideOpen || imageOpen) return@onPreviewKeyEvent false
        interaction++
        val code = event.nativeKeyEvent.keyCode
        if (tv && !surfaceFocused) return@onPreviewKeyEvent when (code) {
            // A button of the OSD row has focus: the D-pad moves between buttons and ▲ leaves the row.
            KeyEvent.KEYCODE_DPAD_UP -> { runCatching { wakeFocus.requestFocus() }; true }
            KeyEvent.KEYCODE_CHANNEL_UP -> { if (live) model.nextChannel(1); true }
            KeyEvent.KEYCODE_CHANNEL_DOWN -> { if (live) model.nextChannel(-1); true }
            KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_SETTINGS -> { openImage(); true }
            else -> false
        }
        if (tv && overlay.value && visibleError == null && (if (live) code == KeyEvent.KEYCODE_DPAD_RIGHT else code == KeyEvent.KEYCODE_DPAD_DOWN))
            return@onPreviewKeyEvent runCatching { controls.keys.requestFocus() }.isSuccess
        when (code) {
            KeyEvent.KEYCODE_CHANNEL_UP -> { if (live) model.nextChannel(1); true }
            KeyEvent.KEYCODE_CHANNEL_DOWN -> { if (live) model.nextChannel(-1); true }
            KeyEvent.KEYCODE_DPAD_UP -> if (live && tv) { model.nextChannel(1); true } else false
            KeyEvent.KEYCODE_DPAD_DOWN -> if (live && tv) { model.nextChannel(-1); true } else false
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> when {
                live && tv && overlay.value && visibleError == null -> { model.loadGuide(0); guideOpen = true; true }
                !overlay.value -> { overlay.value = true; true }
                else -> false
            }
            KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_SETTINGS -> { openImage(); true }
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> { if (player.isPlaying) player.pause() else player.play(); overlay.value = true; true }
            KeyEvent.KEYCODE_DPAD_LEFT -> if (!live && tv) { player.seekTo((player.currentPosition - 10_000).coerceAtLeast(0)); overlay.value = true; true } else false
            KeyEvent.KEYCODE_DPAD_RIGHT -> if (!live && tv) { player.seekTo(player.currentPosition + 10_000); overlay.value = true; true } else false
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.KEYCODE_VOLUME_MUTE -> false
            else -> if (!overlay.value) { overlay.value = true; true } else false
        }
    }.focusable()

    if (fullscreen) {
        Box(Modifier.fillMaxSize().background(Color.Black).then(keys).pointerInput(Unit) {
            awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial); interaction++ }
        }) {
            video(Modifier.fillMaxSize())
            // The green channel number flashes on every channel change.
            if (live && preferences.showChannelNumber) ChannelFlash(playback, overlay.value, tv)
            if (visibleError == null) {
                if (tv) { if (overlay.value && !imageOpen) TvOsd(model, appState, playback, controls, openImage) }
                else MobileFullscreenControls(model, appState, playback, controls, openImage)
            }
            visibleError?.let { PlayerError(it, { if (live) model.playChannel(playback.channel!!) else prepare() }, { model.back() }) }
            if (guideOpen) Box(Modifier.fillMaxSize().background(Ntv.Ink2.copy(alpha = .96f))) {
                TvGuide(model, appState) { guideOpen = false; overlay.value = true }
            }
            if (imageOpen) {
                if (tv) TvImagePanel(settings, model::editVideoSettings) { imageOpen = false; overlay.value = true }
                else MobileImagePanel(settings, model::editVideoSettings, side = true) { imageOpen = false }
            }
        }
    } else Box(Modifier.fillMaxSize()) {
        MobileLive(model, appState, playback, controls, visibleError, { modifier -> video(modifier) }, retry = {
            if (live) model.playChannel(playback.channel!!) else prepare()
        }, onImage = openImage)
        if (imageOpen) MobileImagePanel(settings, model::editVideoSettings, side = false) { imageOpen = false }
    }
}

@Composable
private fun BoxScope.ChannelFlash(playback: Playback, osd: Boolean, tv: Boolean) {
    var visible by remember(playback.channel?.id) { mutableStateOf(true) }
    LaunchedEffect(playback.channel?.id) { visible = true; delay(3000); visible = false }
    if (visible || osd) ChannelNumber(playback.channel?.number ?: "", if (tv) 60.sp else if (osd) 40.sp else 28.sp,
        Modifier.align(Alignment.TopEnd).padding(top = if (tv) 28.dp else 12.dp, end = if (tv) 48.dp else 52.dp), alpha = if (visible || osd) 1f else .4f)
}

@Composable
private fun BoxScope.PlayerError(message: String, retry: () -> Unit, back: () -> Unit) {
    val tv = LocalTvDevice.current
    Column(Modifier.align(Alignment.Center).widthIn(max = 560.dp).padding(24.dp).background(Ntv.Panel2, RoundedCornerShape(14.dp))
        .border(1.dp, Ntv.Edge, RoundedCornerShape(14.dp)).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Txt(message, if (tv) 16.sp else 15.sp, lineHeight = 22.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (tv) { TvPill("Volver a intentar", retry, primary = true); TvPill("Volver", back) }
            else { MobileButton("Volver a intentar", retry, primary = true); MobileButton("Volver", back) }
        }
    }
}

/** Playback position and duration, refreshed twice a second while visible. */
@Composable
private fun rememberPosition(player: Player): Pair<Long, Long> {
    var position by remember { mutableLongStateOf(player.currentPosition) }
    var duration by remember { mutableLongStateOf(0L) }
    LaunchedEffect(player) {
        while (true) {
            position = player.currentPosition.coerceAtLeast(0)
            duration = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0
            delay(500)
        }
    }
    return position to duration
}

private fun liveFraction(playback: Playback): Float {
    if (playback.endsAt <= playback.startsAt) return 0f
    return ((System.currentTimeMillis() - playback.startsAt).toFloat() / (playback.endsAt - playback.startsAt)).coerceIn(0f, 1f)
}

private fun Playback.detail(): String = listOf(episodeCode(seasonNumber, episodeNumber, part = part), title.takeIf { !isBumper && it != seriesName })
    .filter { !it.isNullOrBlank() }.joinToString(" · ")

// ── Android TV OSD ──

@Composable
private fun TvOsd(model: AppViewModel, state: AppState, playback: Playback, controls: PlayerControls, onImage: () -> Unit) {
    val live = playback.channel != null
    val (position, duration) = rememberPosition(controls.player)
    val channel = state.channels.firstOrNull { it.id == playback.channel?.id } ?: playback.channel
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth()
            .background(Brush.verticalGradient(0f to Ntv.Ink3.copy(alpha = 0f), .45f to Ntv.Ink3.copy(alpha = .96f)))
            .padding(start = 48.dp, end = 48.dp, top = 70.dp, bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                Box(Modifier.size(74.dp).background(Ntv.Panel2, RoundedCornerShape(11.dp)).border(1.dp, Ntv.Edge, RoundedCornerShape(11.dp)),
                    contentAlignment = Alignment.Center) {
                    if (live) Txt(channel?.number ?: "", 32.sp, Ntv.Amber, font = Display, weight = FontWeight.Bold)
                    else Icon(if (controls.player.isPlaying) NtvIcon.Pause else NtvIcon.Play, 26.dp, Ntv.Amber)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Txt(if (live) listOfNotNull(channel?.name?.uppercase(), channel?.eraName?.uppercase()).joinToString(" · ")
                        else playback.seriesName.uppercase(), 12.sp, Ntv.Amber, font = Mono, tracking = tracking(.1f), lines = 1)
                    Txt(if (playback.isBumper) playback.title else playback.seriesName.ifEmpty { playback.title }, 36.sp, font = Display,
                        weight = FontWeight.Bold, lineHeight = 36.sp, lines = 1)
                    Txt(if (playback.isBumper) "Pausa comercial" else playback.detail(), 14.sp, Ntv.Fg2, lines = 1)
                }
                if (live) Column(Modifier.width(220.dp).background(Ntv.Glass(.08f), RoundedCornerShape(9.dp)).padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Txt("A CONTINUACIÓN${if (playback.endsAt > 0) " · ${clock(playback.endsAt)}" else ""}", 10.sp, Ntv.Muted, font = Mono, tracking = tracking(.12f))
                    Txt(playback.nextTitle ?: channel?.next?.seriesName ?: "—", 15.sp, weight = FontWeight.SemiBold, lines = 1)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Txt(if (live) (if (playback.startsAt > 0) clock(playback.startsAt) else "") else playTime(position), 12.sp, Ntv.Muted, font = Mono)
                ProgressLine(if (live) liveFraction(playback) else if (duration > 0) position.toFloat() / duration else 0f, Modifier.weight(1f), 5.dp,
                    Color.White.copy(alpha = .15f))
                Txt(if (live) (if (playback.endsAt > 0) clock(playback.endsAt) else "") else playTime(duration), 12.sp, Ntv.Muted, font = Mono)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                if (live) {
                    Hint("▲ ▼", "Cambiar canal"); Hint("OK", "Guía"); Hint("▶", "Botones"); Hint("◀", "Volver")
                } else {
                    Hint("◀ ▶", "10 s"); Hint("▼", "Botones"); Hint("▶❚❚", "Pausa"); Hint("ATRÁS", "Volver")
                }
                Spacer(Modifier.weight(1f))
                OsdKey("Imagen", Modifier.focusRequester(controls.keys), onImage)
                if (live) {
                    OsdKey("CH−") { model.nextChannel(-1) }
                    OsdKey("CH+") { model.nextChannel(1) }
                } else {
                    val index = state.episodes.indexOfFirst { it.id == playback.episodeId }
                    if (index > 0) OsdKey("Anterior") { model.nextEpisode(-1) }
                    OsdKey(if (controls.player.isPlaying) "Pausa" else "Reproducir") {
                        if (controls.player.isPlaying) controls.player.pause() else controls.player.play()
                    }
                    if (index >= 0 && index < state.episodes.lastIndex) OsdKey("Siguiente") { model.nextEpisode(1) }
                }
            }
        }
    }
}

@Composable
private fun Hint(key: String, label: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        Txt(key, 11.sp, Ntv.Fg, font = Mono, weight = FontWeight.SemiBold)
        Txt(label, 11.sp, Ntv.Muted)
    }
}

@Composable
private fun OsdKey(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Box(modifier.focusRing(shape, onClick).heightIn(min = 32.dp).widthIn(min = 44.dp).border(1.dp, Ntv.Edge, shape).padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center) { Txt(label, 11.sp, font = Mono, weight = FontWeight.SemiBold) }
}

// ── Phone: live (portrait) ──

@Composable
private fun MobileLive(model: AppViewModel, state: AppState, playback: Playback, controls: PlayerControls, error: String?,
    video: @Composable (Modifier) -> Unit, retry: () -> Unit, onImage: () -> Unit) {
    val context = LocalContext.current
    val live = playback.channel != null
    val channel = state.channels.firstOrNull { it.id == playback.channel?.id } ?: playback.channel
    var tab by remember { mutableIntStateOf(0) }
    var muted by remember { mutableStateOf(controls.player.volume == 0f) }
    val (position, duration) = rememberPosition(controls.player)
    LaunchedEffect(channel?.id) { if (live && state.guide.none { it.channelId == channel?.id }) model.loadGuide(0) }
    val goFullscreen = { (context as? ComponentActivity)?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE }
    Column(Modifier.fillMaxSize().background(Ntv.Ink).safeDrawingPadding()) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f)) {
            video(Modifier.fillMaxSize())
            Box(Modifier.align(Alignment.TopStart).padding(6.dp).size(44.dp).clip(CircleShape).clickable { model.back() }, contentAlignment = Alignment.Center) {
                Icon(NtvIcon.Back, 22.dp, Ntv.Fg)
            }
            if (live) ChannelNumber(channel?.number ?: "", 32.sp, Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 14.dp))
            Row(Modifier.align(Alignment.BottomEnd).padding(end = 6.dp, bottom = 8.dp)) {
                ImageButton(onImage)
                Box(Modifier.size(44.dp).clip(CircleShape).clickable { muted = !muted; controls.player.volume = if (muted) 0f else 1f },
                    contentAlignment = Alignment.Center) { Icon(if (muted) NtvIcon.Muted else NtvIcon.Volume, 20.dp, Ntv.Fg) }
                Box(Modifier.size(44.dp).clip(CircleShape).clickable { goFullscreen() }, contentAlignment = Alignment.Center) {
                    Icon(NtvIcon.Fullscreen, 20.dp, Ntv.Fg)
                }
            }
            ProgressLine(if (live) liveFraction(playback) else if (duration > 0) position.toFloat() / duration else 0f,
                Modifier.align(Alignment.BottomCenter), 3.dp, Color.White.copy(alpha = .15f), round = false)
        }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (live) LiveBadge("EN VIVO", 11.sp)
                        Txt(if (live) "${channel?.name?.uppercase()} ›" else playback.seriesName.uppercase(), 11.sp, Ntv.Amber, font = Mono, lines = 1,
                            modifier = Modifier.clickable { if (live) model.navigate(Screen.ChannelInfo(channel!!.id)) })
                    }
                    Txt(if (playback.isBumper) playback.title else playback.seriesName.ifEmpty { playback.title }, 26.sp, font = Display,
                        weight = FontWeight.Bold, lines = 2)
                    Txt(listOf(if (playback.isBumper) "Pausa comercial" else playback.detail(),
                        if (live && playback.endsAt > 0) "termina ${clock(playback.endsAt)}" else null).filter { !it.isNullOrBlank() }.joinToString(" · "),
                        13.sp, Ntv.Muted)
                }
            }
            error?.let { message -> item { Notice(message, action = "Volver a intentar", onAction = retry) } }
            if (live) {
                item {
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (item in state.channels.filter { it.onAir }) MobileChip("${item.number} · ${item.name}", item.id == channel?.id,
                            { model.playChannel(item) })
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth().topLine(Ntv.Line, bottom = true)) {
                        listOf("Guía", "Comentarios").forEachIndexed { index, label ->
                            val on = index == tab
                            Box(Modifier.weight(1f).heightIn(min = 44.dp).clickable { tab = index }
                                .then(if (on) Modifier.topLine(Ntv.Amber, bottom = true).topLine(Ntv.Amber, bottom = true) else Modifier),
                                contentAlignment = Alignment.Center) { Txt(label, 14.sp, if (on) Ntv.Amber else Ntv.Muted, weight = FontWeight.SemiBold) }
                        }
                    }
                }
                if (tab == 0) {
                    val row = state.guide.firstOrNull { it.channelId == channel?.id }
                    val now = System.currentTimeMillis()
                    items(row?.slots.orEmpty().filter { it.endsAt > now }.take(8), key = { it.programId }) { slot ->
                        val current = slot.startsAt <= now
                        Row(Modifier.fillMaxWidth().then(if (current) Modifier.background(Ntv.AmberWash) else Modifier)
                            .topLine(Ntv.Raised2, bottom = true).padding(horizontal = 8.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Txt(clock(slot.startsAt), 13.sp, if (current) Ntv.Danger else Ntv.Fg, Modifier.width(48.dp), font = Mono)
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Txt(slot.seriesName, 14.sp, weight = FontWeight.SemiBold, lines = 1)
                                Txt(listOfNotNull(episodeCode(slot.seasonNumber, slot.episodeNumber, slot.episodeType, slot.part).ifEmpty { null },
                                    "ahora".takeIf { current }).joinToString(" · "), 12.sp, Ntv.Muted)
                            }
                        }
                    }
                } else {
                    if (state.comments.isEmpty()) item { Txt("Todavía no hay comentarios publicados en este canal.", 13.sp, Ntv.Muted) }
                    items(state.comments.reversed().take(30), key = { it.id }) { CommentLine(it) }
                    item { Txt("Para comentar, entra a NostalgiaTV desde la web con tu cuenta.", 12.sp, Ntv.Dim) }
                }
            } else {
                item {
                    val index = state.episodes.indexOfFirst { it.id == playback.episodeId }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SeekBar(position, duration, { controls.player.seekTo(it) })
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            MobileButton("−10 s", { controls.player.seekTo((position - 10_000).coerceAtLeast(0)) })
                            MobileButton(if (controls.player.isPlaying) "Pausa" else "Reproducir", {
                                if (controls.player.isPlaying) controls.player.pause() else controls.player.play()
                            }, Modifier.weight(1f), primary = true)
                            MobileButton("+10 s", { controls.player.seekTo(seekForward(position, duration)) })
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            MobileButton("Anterior", { model.nextEpisode(-1) }, Modifier.weight(1f), enabled = index > 0, icon = NtvIcon.Previous, height = 44.dp)
                            MobileButton("Siguiente", { model.nextEpisode(1) }, Modifier.weight(1f), enabled = index >= 0 && index < state.episodes.lastIndex,
                                icon = NtvIcon.Next, height = 44.dp)
                        }
                    }
                }
                items(state.episodes.filter { it.season == state.episodes.firstOrNull { e -> e.id == playback.episodeId }?.season }, key = { it.id }) { episode ->
                    val on = episode.id == playback.episodeId
                    Row(Modifier.fillMaxWidth().panel(if (on) Ntv.AmberWash else Ntv.Panel).clickable { model.playEpisode(episode) }.padding(10.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Txt(if (episode.season == 0) episode.episodeType else "E${episode.episodeNumber}${episode.part.orEmpty()}", 12.sp, Ntv.Amber, font = Mono)
                        Txt(episode.title, 14.sp, weight = if (on) FontWeight.SemiBold else FontWeight.Normal, lines = 1)
                    }
                }
            }
        }
        BottomNav(state.tab) { model.back(); model.navigate(it) }
    }
}

// ── Phone: fullscreen (landscape) ──

@Composable
private fun BoxScope.MobileFullscreenControls(model: AppViewModel, state: AppState, playback: Playback, controls: PlayerControls, onImage: () -> Unit) {
    val context = LocalContext.current
    var locked by remember { mutableStateOf(false) }
    var muted by remember { mutableStateOf(controls.player.volume == 0f) }
    val live = playback.channel != null
    val channel = state.channels.firstOrNull { it.id == playback.channel?.id } ?: playback.channel
    val (position, duration) = rememberPosition(controls.player)
    val exit = { (context as? ComponentActivity)?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
    Box(Modifier.fillMaxSize().clickable(indication = null, interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }) {
        if (!locked) controls.overlay.value = !controls.overlay.value
    })
    if (locked) {
        Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 20.dp).clip(RoundedCornerShape(22.dp)).background(Ntv.Ink2.copy(alpha = .75f))
            .clickable { locked = false; controls.poke() }.padding(horizontal = 18.dp, vertical = 12.dp)) {
            Txt("Controles bloqueados · toca para desbloquear", 13.sp, weight = FontWeight.Medium)
        }
        return
    }
    if (!controls.overlay.value) return
    Row(Modifier.align(Alignment.TopCenter).fillMaxWidth().background(Brush.verticalGradient(listOf(Ntv.Ink3.copy(alpha = .88f), Color.Transparent)))
        .padding(start = 44.dp, end = 44.dp, top = 12.dp, bottom = 40.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(44.dp).clip(CircleShape).clickable { exit() }, contentAlignment = Alignment.Center) { Icon(NtvIcon.Back, 22.dp, Ntv.Fg) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (live) LiveBadge("EN VIVO", 11.sp)
                Txt(if (live) channel?.name?.uppercase() ?: "" else playback.seriesName.uppercase(), 11.sp, Ntv.Amber, font = Mono, lines = 1)
            }
            Txt(listOf(if (playback.isBumper) playback.title else playback.seriesName.ifEmpty { playback.title }, episodeCode(playback.seasonNumber, playback.episodeNumber, part = playback.part))
                .filter { it.isNotEmpty() }.joinToString(" · "), 16.sp, weight = FontWeight.SemiBold, lines = 1)
        }
        ImageButton(onImage, Modifier.background(Ntv.Glass(.12f), CircleShape))
        Box(Modifier.size(44.dp).clip(CircleShape).background(Ntv.Glass(.12f)).clickable { locked = true }, contentAlignment = Alignment.Center) {
            Icon(NtvIcon.Lock, 18.dp, Ntv.Fg)
        }
    }
    Row(Modifier.align(Alignment.Center), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (live) 56.dp else 36.dp)) {
        val round = Modifier.clip(CircleShape).background(Ntv.Ink2.copy(alpha = .65f))
        if (live) {
            Box(round.size(64.dp).clickable { model.nextChannel(-1) }, contentAlignment = Alignment.Center) { Txt("CH−", 15.sp, font = Mono, weight = FontWeight.SemiBold) }
            Box(Modifier.clip(RoundedCornerShape(26.dp)).background(Ntv.Ink2.copy(alpha = .65f)).clickable { exit(); model.back(); model.navigate(Screen.Guide) }
                .height(52.dp).padding(horizontal = 20.dp), contentAlignment = Alignment.Center) { Txt("Guía", 14.sp, weight = FontWeight.SemiBold) }
            Box(round.size(64.dp).clickable { model.nextChannel(1) }, contentAlignment = Alignment.Center) { Txt("CH+", 15.sp, font = Mono, weight = FontWeight.SemiBold) }
        } else {
            val index = state.episodes.indexOfFirst { it.id == playback.episodeId }
            Box(round.size(48.dp).alpha(if (index > 0) 1f else .35f).clickable(enabled = index > 0) { model.nextEpisode(-1) },
                contentAlignment = Alignment.Center) { Icon(NtvIcon.Previous, 20.dp, Ntv.Fg) }
            Box(round.size(56.dp).clickable { controls.player.seekTo((position - 10_000).coerceAtLeast(0)); controls.poke() }, contentAlignment = Alignment.Center) {
                Txt("−10", 14.sp, font = Mono, weight = FontWeight.SemiBold) }
            Box(round.size(64.dp).clickable { if (controls.player.isPlaying) controls.player.pause() else controls.player.play() }, contentAlignment = Alignment.Center) {
                Icon(if (controls.player.isPlaying) NtvIcon.Pause else NtvIcon.Play, 24.dp, Ntv.Fg) }
            Box(round.size(56.dp).clickable { controls.player.seekTo(seekForward(position, duration)); controls.poke() }, contentAlignment = Alignment.Center) {
                Txt("+10", 14.sp, font = Mono, weight = FontWeight.SemiBold) }
            val next = index >= 0 && index < state.episodes.lastIndex
            Box(round.size(48.dp).alpha(if (next) 1f else .35f).clickable(enabled = next) { model.nextEpisode(1) },
                contentAlignment = Alignment.Center) { Icon(NtvIcon.Next, 20.dp, Ntv.Fg) }
        }
    }
    Row(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(Brush.verticalGradient(listOf(Color.Transparent, Ntv.Ink3.copy(alpha = .9f))))
        .padding(start = 44.dp, end = 44.dp, top = 40.dp, bottom = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(44.dp).clip(CircleShape).clickable { muted = !muted; controls.player.volume = if (muted) 0f else 1f }, contentAlignment = Alignment.Center) {
            Icon(if (muted) NtvIcon.Muted else NtvIcon.Volume, 20.dp, Ntv.Fg)
        }
        if (live) {
            Txt(if (playback.startsAt > 0) clock(playback.startsAt) else "", 11.sp, Ntv.Muted, font = Mono)
            ProgressLine(liveFraction(playback), Modifier.weight(1f), 4.dp, Color.White.copy(alpha = .18f))
            Txt(if (playback.endsAt > 0) clock(playback.endsAt) else "", 11.sp, Ntv.Muted, font = Mono)
        } else SeekBar(position, duration, { controls.player.seekTo(it); controls.poke() }, Modifier.weight(1f), inline = true, onDrag = controls.poke)
        if (live) (playback.nextTitle ?: channel?.next?.seriesName)?.let { Txt("Sigue: $it", 12.sp, Ntv.Fg2, lines = 1) }
    }
}

@Composable
private fun ImageButton(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(modifier.size(44.dp).clip(CircleShape).clickable(onClick = onClick).semantics { contentDescription = "Imagen" },
        contentAlignment = Alignment.Center) { Icon(NtvIcon.Tune, 20.dp, Ntv.Fg) }
}

/** +10 s that stops at the end instead of running past the duration. */
private fun seekForward(position: Long, duration: Long): Long = if (duration > 0) (position + 10_000).coerceAtMost(duration) else position + 10_000

/**
 * Seekable bar with "posición / duración". The thumb follows the finger and the player seeks once on release,
 * so dragging does not flood the decoder with seeks.
 */
@Composable
private fun SeekBar(position: Long, duration: Long, onSeek: (Long) -> Unit, modifier: Modifier = Modifier, inline: Boolean = false, onDrag: () -> Unit = {}) {
    var dragging by remember { mutableStateOf<Float?>(null) }
    val shown = dragging?.toLong() ?: position.coerceAtMost(duration)
    val colors = SliderDefaults.colors(thumbColor = Ntv.Amber, activeTrackColor = Ntv.Amber, inactiveTrackColor = Color.White.copy(alpha = .18f))
    val slider = @Composable { sliderModifier: Modifier ->
        Slider(shown.toFloat(), { dragging = it; onDrag() }, sliderModifier, enabled = duration > 0,
            valueRange = 0f..duration.coerceAtLeast(1).toFloat(), colors = colors,
            onValueChangeFinished = { dragging?.let { onSeek(it.toLong()) }; dragging = null })
    }
    if (inline) Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Txt(playTime(shown), 11.sp, Ntv.Muted, font = Mono)
        slider(Modifier.weight(1f))
        Txt(playTime(duration), 11.sp, Ntv.Muted, font = Mono)
    } else Column(modifier) {
        slider(Modifier.fillMaxWidth())
        Row {
            Txt(playTime(shown), 12.sp, Ntv.Fg2, font = Mono, modifier = Modifier.weight(1f))
            Txt(playTime(duration), 12.sp, Ntv.Muted, font = Mono)
        }
    }
}
