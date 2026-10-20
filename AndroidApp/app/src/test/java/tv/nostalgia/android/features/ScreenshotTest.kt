package tv.nostalgia.android.features

import android.graphics.Bitmap
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.core.app.ApplicationProvider
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import tv.nostalgia.android.core.*
import tv.nostalgia.android.shared.NostalgiaTheme
import java.io.File

/** Renders every redesigned screen with sample data and writes PNGs to build/screenshots for review. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class ScreenshotTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val now = System.currentTimeMillis()
    private fun slot(id: Long, series: String, title: String, season: Int, episode: Int, start: Int, minutes: Int, type: String = "Episodio") =
        GuideSlot(id, id.toInt(), id.toInt() % 5 + 1, series, title, season, episode, type, type != "Episodio",
            start <= 0 && start + minutes > 0, now + start * 60_000L, now + (start + minutes) * 60_000L)

    private val channels = listOf(
        Channel(5, "Canal 5 Retro", null, "Época dorada", true, listOf("Anime", "Caricaturas"),
            NowPlaying("Episode", 1, "Dragon Ball Z", "El poder oculto de Gohan", 2, 14, now - 8 * 60_000, now + 16 * 60_000, .34f),
            slot(2, "Pokémon", "La isla de los Pokémon gigantes", 3, 2, 16, 24)),
        Channel(12, "Cartoon Clásico", null, "Fines de los 90", true, listOf("Caricaturas", "Comedia"),
            NowPlaying("Episode", 4, "Hey Arnold!", "El paraguas verde", 1, 7, now - 17 * 60_000, now + 7 * 60_000, .71f)),
        Channel(23, "Anime 90s", null, "Tardes de anime", true, listOf("Anime"),
            NowPlaying("Episode", 5, "Los Caballeros del Zodiaco", "La armadura de Pegaso", 1, 31, now - 3 * 60_000, now + 21 * 60_000, .12f)),
        Channel(31, "Tarde de Sábado", null, "Sábados 2003", true, listOf("Anime"),
            NowPlaying("Episode", 3, "Digimon: La película", "Digimon: La película", 0, 1, now - 50 * 60_000, now + 39 * 60_000, .58f)),
        Channel(40, "Noche Retro", null, null, false),
    )

    private val guide = listOf(
        GuideRow(5, "Canal 5 Retro", null, listOf(slot(1, "Hey Arnold!", "El paraguas", 2, 4, -30, 22), slot(2, "Dragon Ball Z", "El poder oculto de Gohan", 2, 14, -8, 24),
            slot(3, "Pokémon", "La isla", 3, 2, 16, 24), slot(4, "Digimon: La película", "Digimon: La película", 0, 1, 40, 89, "Película"))),
        GuideRow(12, "Cartoon Clásico", null, listOf(slot(5, "Hey Arnold!", "El paraguas verde", 1, 7, -17, 40), slot(6, "Los Simpson", "Homer el grande", 5, 22, 23, 24),
            slot(7, "Los Simpson", "Marge contra el monorriel", 5, 23, 47, 56))),
        GuideRow(23, "Anime 90s", null, listOf(slot(8, "Caballeros del Zodiaco", "La armadura de Pegaso", 1, 31, -3, 36), slot(9, "Digimon Adventure", "Aparece Greymon", 1, 12, 33, 24))),
        GuideRow(31, "Tarde de Sábado", null, listOf(slot(10, "Digimon: La película", "Digimon: La película", 0, 1, -50, 62, "Película"), slot(11, "Pokémon", "Bulbasaur", 1, 5, 12, 58))),
        GuideRow(40, "Noche Retro", null, emptyList()),
    )

    private val series = listOf("Dragon Ball Z" to 1989, "Digimon Adventure" to 1999, "El Chavo del 8" to 1973, "Hey Arnold!" to 1996,
        "Los Caballeros del Zodiaco" to 1986, "Los Simpson" to 1989, "Las Tortugas Ninja" to 1987, "Pokémon" to 1997)
        .mapIndexed { index, (name, year) -> Series(index + 1, name, null, 40, year, year + 6, 8.8f - index * .1f, listOf("Anime"), index != 6) }

    private val episodes = (12..17).map { Episode(it, listOf("La batalla en Namek comienza", "La llegada de Freezer", "El poder oculto de Gohan",
        "Vegeta contra Zarbon", "Las esferas de Namek", "Resumen de la saga")[it - 12], "/uploads/e$it.mp4", 2, it) } +
        listOf(Episode(90, "Especial de Navidad", "/uploads/x.mp4", 0, 1, "Especial de Navidad"))

    private val session = ViewerSession("p", 3, listOf(
        WatchProgress(12, 1300.0, true, 1, "Dragon Ball Z", "La batalla en Namek comienza", 2, 12, now - 86_400_000),
        WatchProgress(13, 1300.0, true, 1, "Dragon Ball Z", "La llegada de Freezer", 2, 13, now - 7_200_000),
        WatchProgress(14, 812.0, false, 1, "Dragon Ball Z", "El poder oculto de Gohan", 2, 14, now - 600_000),
        WatchProgress(31, 290.0, false, 8, "Pokémon", "Pikachu", 3, 1, now - 90_000_000)), "d1", true, "fernando",
        listOf(ViewerDevice("d1", "Android · Pixel 8", now, true), ViewerDevice("d2", "Android TV · Sala", now - 180_000, false),
            ViewerDevice("d3", "Navegador", now - 2 * 86_400_000, false)))

    private val base = AppState(connectionStep = ConnectionStep.Ready, serverAddress = "https://tu-servidor.example/", loading = false,
        settings = PublicSettings("Halloween", true, seasonalEffects = true), channels = channels, guide = guide, series = series, totalSeries = series.size,
        categories = listOf(Category(1, "Anime"), Category(2, "Caricatura"), Category(3, "Comedia")), session = session,
        seriesDetail = SeriesDetail(1, "Dragon Ball Z", "Goku y sus amigos defienden la Tierra de enemigos cada vez más poderosos.", null,
            1989, 1996, 8.8f, listOf("Anime", "Acción", "Aventura"), listOf(0, 1, 2, 3, 4), listOf(5 to "Canal 5 Retro")),
        episodes = episodes, season = 2,
        channelDetail = ChannelDetail(5, "Canal 5 Retro", "Caricaturas y anime de la televisión abierta, con bloques de tarde y cortes comerciales de época.",
            null, 2, listOf(ChannelEra(1, "Inicios", "Primeras caricaturas dobladas.", 1991, 1995, false, listOf(EraSeries(5, "Caballeros del Zodiaco", null))),
                ChannelEra(2, "Época dorada", "Anime después de la escuela y los bumpers de «Ya viene».", 1996, 2001, true,
                    listOf(EraSeries(1, "Dragon Ball Z", null), EraSeries(6, "Los Simpson", null), EraSeries(4, "Hey Arnold!", null))),
                ChannelEra(3, "Era digital", null, 2002, 2007, false, emptyList()), ChannelEra(4, "Revival", null, 2008, null, false, emptyList())),
            guide[0].slots.drop(1), 2),
        comments = listOf(Comment(1, "lucia", "Los bumpers de Ya viene están idénticos.", now - 48 * 60_000),
            Comment(2, "maria.g", "¿Van a agregar la era de los 2000?", now - 30 * 60_000)),
        authorization = AuthorizationCode("x", "K7Q-2M9-XDA-4PL", "2099-01-01T00:00:00Z", 5))

    private fun model(state: AppState) = AppViewModel(ApplicationProvider.getApplicationContext()) { origin, cookies ->
        NostalgiaApi("https://tu-servidor.example/".toHttpUrl(), OkHttpClient(), cookies)
    }.also { it.showState(state) }

    private fun capture(name: String, tv: Boolean, state: AppState, content: @Composable (AppViewModel, AppState) -> Unit) {
        val model = model(state)
        // Clocks and live refresh loops never go idle; drive time manually.
        compose.mainClock.autoAdvance = false
        compose.setContent { NostalgiaTheme(tv) { Box(Modifier.fillMaxSize()) { content(model, state) } } }
        compose.mainClock.advanceTimeBy(1000)
        // Draw the view tree directly: Robolectric never delivers the frame captureToImage waits for.
        val root = compose.activity.window.decorView
        val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
        root.draw(android.graphics.Canvas(bitmap))
        val folder = File("build/screenshots").apply { mkdirs() }
        File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tvHome() = capture("tv-01-home", true, base) { m, s -> TvApp(m, s) }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tvGuide() = capture("tv-03-guide", true, base.copy(screen = Screen.Guide)) { m, s -> TvApp(m, s) }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tvCatalog() = capture("tv-05-catalog", true, base.copy(screen = Screen.Catalog)) { m, s -> TvApp(m, s) }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tvSeries() = capture("tv-06-series", true, base.copy(screen = Screen.SeriesInfo(1))) { m, s -> TvApp(m, s) }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tvChannel() = capture("tv-07-channel", true, base.copy(screen = Screen.ChannelInfo(5))) { m, s -> TvApp(m, s) }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tvSettings() = capture("tv-08-settings", true, base.copy(screen = Screen.Profile)) { m, s -> TvApp(m, s) }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tvPair() = capture("tv-04-pair", true,
        base.copy(connectionStep = ConnectionStep.Login, session = null)) { m, s -> TvPair(m, s) }

    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tvImagePanel() = capture("tv-09-image", true, base) { _, _ ->
        Box(Modifier.fillMaxSize()) { TvImagePanel(VideoSettings(), {}) {} } }

    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun phoneHome() = capture("phone-01-home", false, base) { m, s -> MobileApp(m, s) }
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun phoneGuide() = capture("phone-03-guide", false, base.copy(screen = Screen.Guide)) { m, s -> MobileApp(m, s) }
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun phoneCatalog() = capture("phone-04-catalog", false, base.copy(screen = Screen.Catalog)) { m, s -> MobileApp(m, s) }
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun phoneSeries() = capture("phone-05-series", false, base.copy(screen = Screen.SeriesInfo(1))) { m, s -> MobileApp(m, s) }
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun phonePair() = capture("phone-06-pair", false, base.copy(screen = Screen.Pair)) { m, s -> MobileApp(m, s) }
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun phoneChannel() = capture("phone-07-channel", false, base.copy(screen = Screen.ChannelInfo(5))) { m, s -> MobileApp(m, s) }
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun phoneProfile() = capture("phone-08-profile", false, base.copy(screen = Screen.Profile)) { m, s -> MobileApp(m, s) }
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun phoneImagePanel() = capture("phone-10-image", false, base) { _, _ ->
        Box(Modifier.fillMaxSize()) { MobileImagePanel(VideoSettings(), {}, side = false) {} } }
    @Test @Config(qualifiers = "w390dp-h844dp-xxhdpi") fun phoneLogin() = capture("phone-09-login", false,
        base.copy(connectionStep = ConnectionStep.Login, serverFeatures = ServerFeatures(true, true))) { m, s -> MobileConnection(m, s) }
}
