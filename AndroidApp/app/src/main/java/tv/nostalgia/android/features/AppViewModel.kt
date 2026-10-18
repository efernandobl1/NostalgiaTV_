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
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.cancelChildren

enum class ConnectionStep { Server, Login, Ready }

/** Screens of the redesign; the first five are the navigation tabs. */
sealed interface Screen {
    data object Home : Screen
    data object Guide : Screen
    data object Catalog : Screen
    data object Pair : Screen
    data object Profile : Screen
    data class ChannelInfo(val channelId: Int) : Screen
    data class SeriesInfo(val seriesId: Int) : Screen
}

data class AppState(
    val connectionStep: ConnectionStep = ConnectionStep.Server,
    val serverAddress: String = BuildConfig.API_BASE_URL,
    val connectionBusy: Boolean = false,
    val connectionError: String? = null,
    val authorization: AuthorizationCode? = null,
    val serverFeatures: ServerFeatures = ServerFeatures(false, false),
    val browserLogin: String? = null,
    val screen: Screen = Screen.Home,
    val backStack: List<Screen> = emptyList(),
    val settings: PublicSettings = PublicSettings("AllYear", false),
    val channels: List<Channel> = emptyList(),
    val series: List<Series> = emptyList(),
    val seriesPage: Int = 1,
    val totalSeries: Int = 0,
    val categories: List<Category> = emptyList(),
    val seriesFilter: SeriesFilter = SeriesFilter(),
    val guideDay: Int = 0,
    val guide: List<GuideRow> = emptyList(),
    val guideLoading: Boolean = false,
    val channelDetail: ChannelDetail? = null,
    val comments: List<Comment> = emptyList(),
    val seriesDetail: SeriesDetail? = null,
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
) {
    /** Navigation tab that owns the current screen. */
    val tab: Screen get() = (backStack.firstOrNull() ?: screen).let { if (it is Screen.ChannelInfo || it is Screen.SeriesInfo) Screen.Home else it }
}

class AppViewModel @JvmOverloads constructor(application: Application,
    private val clientFactory: ((okhttp3.HttpUrl, ViewerCookies) -> NostalgiaApi)? = null) : AndroidViewModel(application) {
    private val serverPreferences = ServerPreferences(application)
    private val videoPreferences = VideoPreferences(application)
    private val mutableVideoSettings = MutableStateFlow(videoPreferences.load())
    val videoSettings = mutableVideoSettings.asStateFlow()
    private val appPreferences = AppPreferences(application)
    private val mutablePreferences = MutableStateFlow(appPreferences.load())
    val preferences = mutablePreferences.asStateFlow()
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

    /** Screenshot tests render screens from a fixed state. */
    @androidx.annotation.VisibleForTesting
    internal fun showState(value: AppState) { mutableState.value = value }

    // ── Connection ──

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
                    exception is ApiException && exception.status == 410 -> "El QR expiró o ya se usó. Genera otro desde la web."
                    exception is ApiException && exception.status == 409 -> "Tu perfil ya tiene diez dispositivos. Desvincula uno desde la web."
                    exception is IllegalArgumentException -> "Usa un servidor HTTPS válido, sin rutas ni contraseñas."
                    else -> "No se pudo conectar. Revisa la dirección, el certificado y que el servidor esté actualizado."
                }) }
            } finally { if (isActive) mutableState.update { it.copy(connectionBusy = false) } }
        }
    }

    fun deviceName(): String {
        val platform = if (isTv()) "Android TV" else "Android"
        return "$platform · ${Build.MODEL}".take(80)
    }

    private fun isTv(): Boolean = DeviceMode.isTv(
        getApplication<Application>().packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK),
        getApplication<Application>().getSystemService(UiModeManager::class.java)?.currentModeType ?: 0)

    private fun enterCatalog(session: ViewerSession) {
        mutableState.update { it.copy(connectionStep = ConnectionStep.Ready, session = session, authorization = null, connectionError = null,
            loading = true, screen = if (it.connectionStep == ConnectionStep.Ready) it.screen else Screen.Home) }
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

    /** Opens the web sign-in; the TV code links this device once the user finishes there. */
    fun browserLogin(register: Boolean = false) = connectAction {
        val code = api.authorizeDevice(deviceName())
        val url = requireNotNull(api.base.resolve("login")).newBuilder().addQueryParameter("returnUrl", "/vincular?code=${code.userCode}")
        if (register) url.addQueryParameter("mode", "register")
        mutableState.update { it.copy(authorization = code, browserLogin = url.build().toString()) }
    }

    /** Approving a TV needs the account session, which only the web keeps: the phone opens /vincular there. */
    fun approveTvInBrowser(code: String) {
        val clean = code.uppercase().filter { it.isLetterOrDigit() }
        if (clean.length != 12) {
            mutableState.update { it.copy(profileError = "El código tiene 12 letras y números, como el que ves en tu TV.") }
            return
        }
        val url = requireNotNull(api.base.resolve("vincular")).newBuilder().addQueryParameter("code", clean.chunked(3).joinToString("-")).build()
        mutableState.update { it.copy(browserLogin = url.toString(), profileError = null) }
    }

    fun openUrl(url: String) { mutableState.update { it.copy(browserLogin = url) } }

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

    // ── Navigation ──

    /** Switches tab (clearing the detail stack) or pushes a detail screen. */
    fun navigate(screen: Screen) {
        request?.cancel()
        val tab = screen is Screen.Home || screen is Screen.Guide || screen is Screen.Catalog || screen is Screen.Pair || screen is Screen.Profile
        mutableState.update {
            if (tab) it.copy(screen = screen, backStack = emptyList(), error = null, loading = false)
            else it.copy(screen = screen, backStack = it.backStack + it.screen, error = null)
        }
        when (screen) {
            Screen.Home -> refreshChannels()
            Screen.Guide -> loadGuide(state.value.guideDay)
            Screen.Catalog -> if (state.value.series.isEmpty()) seriesPage(1)
            Screen.Profile, Screen.Pair -> refreshSession()
            is Screen.ChannelInfo -> loadChannel(screen.channelId)
            is Screen.SeriesInfo -> loadSeries(screen.seriesId)
        }
    }

    fun back(): Boolean {
        request?.cancel()
        val current = state.value
        return when {
            current.playback != null -> { mutableState.update { it.copy(playback = null, loading = false, error = null) }; refreshSession(); true }
            current.backStack.isNotEmpty() -> {
                mutableState.update { it.copy(screen = it.backStack.last(), backStack = it.backStack.dropLast(1), loading = false, error = null) }
                true
            }
            current.screen != Screen.Home -> { navigate(Screen.Home); true }
            else -> false
        }
    }

    // ── Catalog data ──

    fun loadCatalog() = load {
        val channels = async { api.channels() }
        val series = async { api.series(1) }
        val categories = async { api.categories() }
        val settings = async { runCatching { api.publicSettings() }.getOrNull() }
        val result = series.await()
        val channelList = channels.await()
        val categoryList = categories.await()
        mutableState.update { it.copy(channels = channelList, categories = categoryList, series = result.items, totalSeries = result.totalCount,
            seriesPage = 1, seriesFilter = SeriesFilter(), settings = settings.await() ?: it.settings) }
    }

    /** Updates what each channel is airing without blocking the screen. */
    fun refreshChannels() = viewModelScope.launch {
        try {
            val channels = api.channels()
            mutableState.update { it.copy(channels = channels) }
        } catch (exception: Exception) {
            if (exception is CancellationException) throw exception
        }
    }

    fun seriesPage(page: Int) = load {
        val result = api.series(page, state.value.seriesFilter)
        mutableState.update { it.copy(series = if (page == 1) result.items else it.series + result.items, totalSeries = result.totalCount, seriesPage = page) }
    }

    fun filterSeries(filter: SeriesFilter) {
        mutableState.update { it.copy(seriesFilter = filter) }
        seriesPage(1)
    }

    fun loadGuide(day: Int) {
        mutableState.update { it.copy(guideDay = day, guideLoading = true) }
        viewModelScope.launch {
            try {
                val rows = api.guide(dayKey(day))
                mutableState.update { if (it.guideDay == day) it.copy(guide = rows, guideLoading = false) else it }
            } catch (exception: Exception) {
                if (exception is CancellationException) throw exception
                mutableState.update { it.copy(guideLoading = false, error = "No se pudo cargar la guía. Vuelve a intentarlo.") }
            }
        }
    }

    private fun loadChannel(channelId: Int) = load {
        mutableState.update { it.copy(channelDetail = null, comments = emptyList()) }
        val detail = async { api.channelDetail(channelId) }
        val comments = async { runCatching { api.channelComments(channelId) }.getOrDefault(emptyList()) }
        mutableState.update { it.copy(channelDetail = detail.await(), comments = comments.await()) }
    }

    /** Comments of the channel on air, for the live screen's "Comentarios" tab. */
    fun loadComments(channelId: Int) = viewModelScope.launch {
        try {
            val comments = api.channelComments(channelId)
            mutableState.update { it.copy(comments = comments) }
        } catch (exception: Exception) {
            if (exception is CancellationException) throw exception
        }
    }

    private fun loadSeries(seriesId: Int) = load {
        mutableState.update { it.copy(seriesDetail = null, episodes = emptyList(), season = null) }
        val detail = async { api.seriesDetail(seriesId) }
        val episodes = async { api.episodes(seriesId) }
        val list = episodes.await()
        val progress = state.value.session?.progress.orEmpty().associateBy { it.episodeId }
        // Open on the season of the episode in progress, otherwise the first regular season.
        val resume = list.firstOrNull { progress[it.id]?.let { item -> !item.completed && item.currentSecond > 0 } == true }
        mutableState.update { it.copy(seriesDetail = detail.await(), episodes = list,
            season = resume?.season ?: list.map { episode -> episode.season }.filter { season -> season > 0 }.minOrNull() ?: list.firstOrNull()?.season) }
    }

    fun season(season: Int?) { mutableState.update { it.copy(season = season) } }

    // ── Playback ──

    fun playEpisode(episode: Episode) {
        val series = state.value.seriesDetail ?: return
        val progress = state.value.session?.progress?.find { it.episodeId == episode.id }
        mutableState.update { it.copy(playback = Playback(episode.title, "${series.name} · ${episodeCode(episode.season, episode.episodeNumber, episode.episodeType)}",
            episode.filePath, episode.id, if (progress?.completed == false) progress.currentSecond else 0.0,
            seriesName = series.name, logoPath = series.logoPath, seriesId = series.id,
            seasonNumber = episode.season, episodeNumber = episode.episodeNumber), error = null) }
    }

    /** The episode to continue: the one in progress, else the first unwatched one. */
    fun resumeEpisode(): Episode? {
        val progress = state.value.session?.progress.orEmpty().associateBy { it.episodeId }
        val episodes = state.value.episodes
        return episodes.firstOrNull { progress[it.id]?.let { item -> !item.completed && item.currentSecond > 0 } == true }
            ?: episodes.firstOrNull { progress[it.id]?.completed != true && it.season > 0 } ?: episodes.firstOrNull()
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

    fun playChannel(channelId: Int) {
        val channel = state.value.channels.firstOrNull { it.id == channelId } ?: Channel(channelId, state.value.channelDetail?.name ?: "", null)
        playChannel(channel)
    }

    fun nextChannel(offset: Int) {
        val channels = state.value.channels.filter { it.onAir }.ifEmpty { state.value.channels }
        if (channels.isEmpty()) return
        val index = channels.indexOfFirst { it.id == state.value.playback?.channel?.id }
        playChannel(channels[(index + offset + channels.size) % channels.size])
    }

    suspend fun liveState(channel: Channel): ChannelState = api.channelState(channel.id).also { live ->
        mutableState.update {
            if (it.playback?.channel?.id == channel.id) it.copy(playback = live.playback(channel)) else it
        }
    }

    // ── Viewer profile ──

    suspend fun ensureSession(): ViewerSession = sessionMutex.withLock {
        state.value.session ?: api.startViewer(deviceName()).also { session ->
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

    fun clearHistory() = viewModelScope.launch {
        try {
            api.clearHistory()
            refreshSession()
        } catch (exception: Exception) {
            if (exception is CancellationException) throw exception
            mutableState.update { it.copy(profileError = "No se pudo borrar el historial. Vuelve a intentarlo.") }
        }
    }

    fun removeDevice(deviceId: String) = viewModelScope.launch {
        if (deviceId == state.value.session?.currentDeviceId) { logout(); return@launch }
        try {
            api.logoutViewer(deviceId)
            refreshSession()
        } catch (exception: Exception) {
            if (exception is CancellationException) throw exception
            mutableState.update { it.copy(profileError = "No se pudo quitar el dispositivo. Vuelve a intentarlo.") }
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
            state.copy(session = state.session?.let { session ->
                val previous = session.progress.firstOrNull { it.episodeId == episodeId }
                session.copy(progress = listOf((previous ?: WatchProgress(episodeId, end, completed, seriesId))
                    .copy(currentSecond = end, completed = completed, updatedAt = System.currentTimeMillis())) +
                    session.progress.filterNot { it.episodeId == episodeId })
            }, profileError = null)
        }
    }

    fun rememberPosition(position: Double) {
        mutableState.update { state -> state.copy(playback = state.playback?.let {
            if (it.channel == null) it.copy(startSecond = position.coerceAtLeast(0.0)) else it
        }) }
    }

    fun updateVideoSettings(settings: VideoSettings) {
        val safe = settings.sanitized()
        videoPreferences.save(safe)
        mutableVideoSettings.value = safe
    }

    fun updatePreferences(preferences: AppSettings) {
        appPreferences.save(preferences)
        mutablePreferences.value = preferences
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

    companion object {
        /** Local calendar day as the guide expects it (yyyy-MM-dd). */
        fun dayKey(offset: Int): String = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            .format(Calendar.getInstance().apply { add(Calendar.DATE, offset) }.time)
    }
}

private fun ChannelState.playback(channel: Channel) = Playback(title, if (isBumper || seriesName == channel.name) channel.name else "$seriesName · ${channel.name}",
    filePath, if (isBumper) 0 else episodeId, currentSecond.coerceAtLeast(0.0), channel, segmentId, secondsUntilNext, seriesName, channel.logoPath, seriesId,
    seasonNumber, episodeNumber, nextTitle, startsAt, endsAt, isBumper)
