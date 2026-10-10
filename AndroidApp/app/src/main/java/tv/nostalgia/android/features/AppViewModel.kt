package tv.nostalgia.android.features

import android.app.Application
import android.app.UiModeManager
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
import kotlinx.coroutines.cancelChildren

enum class ConnectionStep { Server, Login, Ready }

enum class Section { Channels, Series, Profile }

data class AppState(
    val connectionStep: ConnectionStep = ConnectionStep.Server,
    val serverAddress: String = BuildConfig.API_BASE_URL,
    val connectionBusy: Boolean = false,
    val connectionError: String? = null,
    val authorization: AuthorizationCode? = null,
    val serverFeatures: ServerFeatures = ServerFeatures(false, false),
    val browserLogin: String? = null,
    val section: Section = Section.Channels,
    val channels: List<Channel> = emptyList(),
    val series: List<Series> = emptyList(),
    val seriesPage: Int = 1,
    val totalSeries: Int = 0,
    val categories: List<Category> = emptyList(),
    val seriesFilter: SeriesFilter = SeriesFilter(),
    val continueOnly: Boolean = false,
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

class AppViewModel @JvmOverloads constructor(application: Application,
    private val clientFactory: ((okhttp3.HttpUrl, ViewerCookies) -> NostalgiaApi)? = null) : AndroidViewModel(application) {
    private val serverPreferences = ServerPreferences(application)
    private val videoPreferences = VideoPreferences(application)
    private val mutableVideoSettings = MutableStateFlow(videoPreferences.load())
    val videoSettings = mutableVideoSettings.asStateFlow()
    private var cookies = ViewerCookies(application, serverPreferences.load() ?: BuildConfig.API_BASE_URL.toHttpUrl())
    var api = createApi(serverPreferences.load() ?: BuildConfig.API_BASE_URL.toHttpUrl())
        private set

    private fun createApi(origin: okhttp3.HttpUrl): NostalgiaApi {
        cookies = ViewerCookies(getApplication(), origin)
        clientFactory?.let { return it(origin, cookies) }
        return NostalgiaApi(origin, SecureHttp.create(getApplication(), cookies, origin)
            .newBuilder().callTimeout(20, TimeUnit.SECONDS).build(), cookies)
    }
    private val mutableState = MutableStateFlow(AppState())
    val state = mutableState.asStateFlow()
    private var request: Job? = null
    private val sessionMutex = Mutex()

    init {
        serverPreferences.load()?.let { connectServer(it.toString()) }
    }

    fun chooseServer() {
        viewModelScope.coroutineContext.cancelChildren()
        serverPreferences.clear()
        mutableState.value = AppState(serverAddress = api.base.toString(), loading = false)
    }

    fun connectServer(address: String, qrCode: String? = null) {
        if (state.value.connectionBusy) return
        viewModelScope.coroutineContext.cancelChildren()
        mutableState.value = AppState(serverAddress = address, connectionBusy = true, loading = false)
        viewModelScope.launch {
            try {
                val origin = ServerAddress.parse(address)
                api = createApi(origin)
                val features = api.verifyServer()
                serverPreferences.save(origin)
                mutableState.update { it.copy(serverAddress = origin.toString(), connectionStep = ConnectionStep.Login, serverFeatures = features) }
                val session = if (qrCode != null) {
                    check(api.redeemDevice(qrCode)) { "QR not approved" }
                    api.viewerSession()
                } else try { api.viewerSession() } catch (exception: ApiException) {
                    if (exception.status == 401) null else throw exception
                }
                if (session != null) enterCatalog(session)
                else if (isTv()) {
                    val authorization = api.authorizeDevice(deviceName())
                    mutableState.update { it.copy(authorization = authorization) }
                }
            } catch (exception: Exception) {
                if (exception is CancellationException) throw exception
                mutableState.update { it.copy(connectionError = when {
                    exception is ApiException && exception.status == 410 -> "El QR expiró o ya se usó. Genera otro en el dashboard."
                    exception is ApiException && exception.status == 409 -> "Tu perfil ya tiene diez dispositivos. Desvincula uno desde la web."
                    exception is IllegalArgumentException -> "Usa un servidor HTTPS válido, sin rutas ni contraseñas."
                    else -> "No se pudo conectar. Revisa la dirección, el certificado y que el servidor esté actualizado."
                }) }
            } finally { if (isActive) mutableState.update { it.copy(connectionBusy = false) } }
        }
    }

    private fun deviceName(): String {
        val platform = if (isTv()) "Android TV" else "Android"
        return "$platform · ${Build.MODEL}".take(80)
    }

    private fun isTv(): Boolean = DeviceMode.isTv(
        getApplication<Application>().packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK),
        getApplication<Application>().getSystemService(UiModeManager::class.java)?.currentModeType ?: 0)

    private fun enterCatalog(session: ViewerSession) {
        mutableState.update { it.copy(connectionStep = ConnectionStep.Ready, session = session, authorization = null, connectionError = null, loading = true) }
        loadCatalog()
    }

    fun login(username: String, password: String) = connectAction {
        enterCatalog(api.loginViewer(username.trim(), password, deviceName()))
    }

    fun continueAsGuest() = connectAction { enterCatalog(api.startViewer(deviceName())) }

    fun logout() = connectAction {
        state.value.session?.currentDeviceId?.let { api.logoutViewer(it) }
        cookies.clear()
        mutableState.value = AppState(connectionStep = ConnectionStep.Login, serverAddress = api.base.toString(), serverFeatures = state.value.serverFeatures, loading = false)
    }

    fun createAuthorization() = connectAction {
        mutableState.update { it.copy(authorization = api.authorizeDevice(deviceName())) }
    }

    fun browserLogin(register: Boolean = false) = connectAction {
        val code = api.authorizeDevice(deviceName())
        val destination = "/tv?code=${code.userCode}"
        val url = requireNotNull(api.base.resolve("login")).newBuilder().addQueryParameter("returnUrl", destination)
        if (register) url.addQueryParameter("mode", "register")
        mutableState.update { it.copy(authorization = code, browserLogin = url.build().toString()) }
    }
    fun browserOpened() { mutableState.update { it.copy(browserLogin = null) } }

    fun cancelAuthorization() { mutableState.update { it.copy(authorization = null, connectionError = null) } }

    suspend fun pollAuthorization(code: String): Boolean {
        val connected = api.redeemDevice(code)
        if (connected) enterCatalog(api.viewerSession())
        return connected
    }

    fun authorizationError(expired: Boolean) {
        mutableState.update { it.copy(connectionError = if (expired) "El código expiró o ya se usó. Genera uno nuevo."
            else "Esperando conexión. Comprueba la red o genera otro código.") }
    }

    private fun connectAction(block: suspend () -> Unit): Job = viewModelScope.launch {
        if (state.value.connectionBusy) return@launch
        mutableState.update { it.copy(connectionBusy = true, connectionError = null) }
        try { block() }
        catch (exception: Exception) {
            if (exception is CancellationException) throw exception
            mutableState.update { it.copy(connectionError = when {
                exception is ApiException && exception.status == 401 -> "Usuario o contraseña incorrectos. Revisa tus datos."
                exception is ApiException && exception.status == 409 -> "El perfil ya tiene diez dispositivos. Desvincula uno desde la web."
                exception is ApiException && exception.status == 429 -> "Espera un minuto antes de volver a intentarlo."
                else -> "No se pudo completar la conexión. Vuelve a intentarlo."
            }) }
        } finally { if (isActive) mutableState.update { it.copy(connectionBusy = false) } }
    }

    fun loadCatalog() = load {
        val channels = async { api.channels() }
        val series = async { api.series(1) }
        val categories = async { api.categories() }
        val result = series.await()
        val channelList = channels.await()
        val categoryList = categories.await()
        mutableState.update { it.copy(channels = channelList, categories = categoryList, series = result.items, totalSeries = result.totalCount, seriesPage = 1, seriesFilter = SeriesFilter()) }
    }

    fun section(section: Section) {
        request?.cancel()
        mutableState.update { it.copy(section = section, selectedSeries = null, season = null, error = null, loading = false) }
        if (section == Section.Profile || section == Section.Series) refreshSession()
    }

    fun showSeriesList() {
        request?.cancel()
        mutableState.update { it.copy(selectedSeries = null, season = null, error = null, loading = false) }
        refreshSession()
    }

    fun seriesPage(page: Int) = load {
        val result = api.series(page, state.value.seriesFilter)
        mutableState.update { it.copy(series = result.items, totalSeries = result.totalCount, seriesPage = page) }
    }

    fun filterSeries(filter: SeriesFilter) {
        mutableState.update { it.copy(seriesFilter = filter, continueOnly = false) }
        seriesPage(1)
    }

    fun continueOnly(enabled: Boolean) { mutableState.update { it.copy(continueOnly = enabled) } }

    fun updateVideoSettings(settings: VideoSettings) {
        val safe = settings.sanitized()
        videoPreferences.save(safe)
        mutableVideoSettings.value = safe
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
            episode.filePath, episode.id, if (progress?.completed == false) progress.currentSecond else 0.0,
            seriesName = series.name, logoPath = series.logoPath, seriesId = series.id), error = null) }
    }

    fun nextEpisode(offset: Int) {
        val episodes = state.value.episodes
        val index = episodes.indexOfFirst { it.id == state.value.playback?.episodeId }
        episodes.getOrNull(index + offset)?.let(::playEpisode)
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

    suspend fun recordProgress(episodeId: Int, start: Double, end: Double, duration: Double, seriesId: Int = 0) {
        ensureSession()
        val completed = api.progress(episodeId, start, end, duration)
        mutableState.update { state ->
            state.copy(session = state.session?.let { session -> session.copy(progress =
                session.progress.filterNot { it.episodeId == episodeId } + WatchProgress(episodeId, end, completed, seriesId)) }, profileError = null)
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
    filePath, if (isBumper) 0 else episodeId, currentSecond.coerceAtLeast(0.0), channel, segmentId, secondsUntilNext, seriesName, channel.logoPath, seriesId)
