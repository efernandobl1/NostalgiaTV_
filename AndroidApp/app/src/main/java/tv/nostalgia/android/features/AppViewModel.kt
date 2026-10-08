package tv.nostalgia.android.features

import android.app.Application
import android.os.Build
import android.content.pm.PackageManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.HttpUrl.Companion.toHttpUrl
import tv.nostalgia.android.BuildConfig
import tv.nostalgia.android.core.*
import java.util.concurrent.TimeUnit

enum class Section { Channels, Series, Profile }

data class AppState(
    val section: Section = Section.Channels,
    val channels: List<Channel> = emptyList(),
    val series: List<Series> = emptyList(),
    val seriesPage: Int = 1,
    val totalSeries: Int = 0,
    val selectedSeries: Series? = null,
    val episodes: List<Episode> = emptyList(),
    val season: Int? = null,
    val playback: Playback? = null,
    val loading: Boolean = true,
    val error: String? = null,
    val session: ViewerSession? = null,
    val profileError: String? = null,
    val pairingCode: PairingCode? = null,
    val pairing: Boolean = false,
    val linked: Boolean = false,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val origin = BuildConfig.API_BASE_URL.toHttpUrl()
    val api = NostalgiaApi(origin, SecureHttp.create(application, ViewerCookies(application, origin))
        .newBuilder().callTimeout(20, TimeUnit.SECONDS).build())
    private val mutableState = MutableStateFlow(AppState())
    val state = mutableState.asStateFlow()
    private var request: Job? = null
    private val sessionMutex = Mutex()

    init {
        loadCatalog()
        viewModelScope.launch {
            try { ensureSession() }
            catch (exception: Exception) {
                if (exception is CancellationException) throw exception
                mutableState.update { it.copy(profileError = "No se pudo conectar el historial. Puedes seguir viendo la TV.") }
            }
        }
    }

    fun loadCatalog() = load {
        val channels = async { api.channels() }
        val series = async { api.series(1) }
        val result = series.await()
        val channelList = channels.await()
        mutableState.update { it.copy(channels = channelList, series = result.items, totalSeries = result.totalCount, seriesPage = 1) }
    }

    fun section(section: Section) {
        request?.cancel()
        mutableState.update { it.copy(section = section, selectedSeries = null, season = null, error = null, loading = false) }
        if (section == Section.Profile) refreshSession()
    }

    fun seriesPage(page: Int) = load {
        val result = api.series(page)
        mutableState.update { it.copy(series = result.items, totalSeries = result.totalCount, seriesPage = page) }
    }

    fun openSeries(series: Series) = load {
        val episodes = api.episodes(series.id)
        mutableState.update { it.copy(selectedSeries = series, episodes = episodes, season = null) }
    }

    fun season(season: Int?) { mutableState.update { it.copy(season = season) } }

    fun playEpisode(episode: Episode) {
        val series = state.value.selectedSeries ?: return
        val progress = state.value.session?.progress?.find { it.episodeId == episode.id }
        mutableState.update { it.copy(playback = Playback(episode.title, "${series.name} · T${episode.season} E${episode.episodeNumber}",
            episode.filePath, episode.id, if (progress?.completed == false) progress.currentSecond else 0.0), error = null) }
    }

    fun playChannel(channel: Channel) = load {
        val live = api.channelState(channel.id)
        mutableState.update { it.copy(playback = live.playback(channel), error = null) }
    }

    fun nextChannel(offset: Int) {
        val channels = state.value.channels
        if (channels.isEmpty()) return
        val index = channels.indexOfFirst { it.id == state.value.playback?.channel?.id }
        playChannel(channels[(index + offset + channels.size) % channels.size])
    }

    fun back() {
        request?.cancel()
        mutableState.update {
            when {
                it.playback != null -> it.copy(playback = null, loading = false, error = null)
                it.selectedSeries != null -> it.copy(selectedSeries = null, loading = false, error = null)
                else -> it.copy(section = Section.Channels, error = null)
            }
        }
    }

    suspend fun liveState(channel: Channel): ChannelState = api.channelState(channel.id).also { live ->
        mutableState.update {
            if (it.playback?.channel?.id == channel.id) it.copy(playback = live.playback(channel)) else it
        }
    }

    suspend fun ensureSession(): ViewerSession = sessionMutex.withLock {
        val platform = if (getApplication<Application>().packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)) "Android TV" else "Android"
        state.value.session ?: api.startViewer("$platform · ${Build.MODEL}".take(80)).also { session ->
            mutableState.update { it.copy(session = session, profileError = null) }
        }
    }

    fun refreshSession() = viewModelScope.launch {
        try {
            ensureSession()
            val session = api.viewerSession()
            mutableState.update { it.copy(session = session, profileError = null) }
        } catch (exception: Exception) {
            if (exception is CancellationException) throw exception
            mutableState.update { it.copy(profileError = "No se pudo actualizar el perfil. Vuelve a intentarlo.") }
        }
    }

    fun createCode() = viewModelScope.launch {
        mutableState.update { it.copy(pairing = true, linked = false, pairingCode = null, profileError = null) }
        try {
            ensureSession()
            val code = api.pairingCode()
            mutableState.update { it.copy(pairingCode = code, pairing = false) }
        } catch (exception: Exception) {
            if (exception is CancellationException) throw exception
            mutableState.update { it.copy(pairing = false, profileError = "No se pudo generar el código. Vuelve a intentarlo.") }
        }
    }

    suspend fun checkPairing(): Boolean {
        val session = api.viewerSession()
        val changed = session.profileId != state.value.session?.profileId
        mutableState.update { it.copy(session = session, linked = it.linked || changed,
            pairingCode = if (changed) null else it.pairingCode) }
        return changed
    }

    suspend fun recordProgress(episodeId: Int, start: Double, end: Double, duration: Double) {
        ensureSession()
        val completed = api.progress(episodeId, start, end, duration)
        mutableState.update { state ->
            state.copy(session = state.session?.let { session -> session.copy(progress =
                session.progress.filterNot { it.episodeId == episodeId } + WatchProgress(episodeId, end, completed)) }, profileError = null)
        }
    }

    fun rememberPosition(position: Double) {
        mutableState.update { state -> state.copy(playback = state.playback?.let {
            if (it.channel == null) it.copy(startSecond = position.coerceAtLeast(0.0)) else it
        }) }
    }

    private fun load(block: suspend kotlinx.coroutines.CoroutineScope.() -> Unit) {
        request?.cancel()
        request = viewModelScope.launch {
            mutableState.update { it.copy(loading = true, error = null) }
            try { coroutineScope(block) }
            catch (exception: Exception) {
                if (exception is CancellationException) throw exception
                val message = when {
                    exception is ApiException && exception.status == 404 -> "Este canal aún no tiene programación. Prueba otro canal."
                    exception is ApiException && exception.status == 429 -> "Espera unos segundos antes de volver a intentarlo."
                    else -> "No se pudo conectar con NostalgiaTV. Comprueba la conexión y vuelve a intentarlo."
                }
                mutableState.update { it.copy(error = message) }
            } finally { if (isActive) mutableState.update { it.copy(loading = false) } }
        }
    }
}

private fun ChannelState.playback(channel: Channel) = Playback(title, if (isBumper || seriesName == channel.name) channel.name else "$seriesName · ${channel.name}",
    filePath, if (isBumper) 0 else episodeId, currentSecond.coerceAtLeast(0.0), channel, segmentId, secondsUntilNext)
