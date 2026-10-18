package tv.nostalgia.android.features

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.delay
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import tv.nostalgia.android.core.*
import tv.nostalgia.android.shared.*
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

// Phones follow the 390×844 design 1:1 in dp.

@Composable
fun MobileApp(model: AppViewModel, state: AppState) {
    LaunchedEffect(state.screen) { while (state.screen == Screen.Home) { delay(60_000); model.refreshChannels() } }
    Column(Modifier.fillMaxSize().background(Ntv.Ink).safeDrawingPadding()) {
        Box(Modifier.weight(1f)) {
            when (state.screen) {
                Screen.Home -> MobileHome(model, state)
                Screen.Guide -> MobileGuide(model, state)
                Screen.Catalog -> MobileCatalog(model, state)
                Screen.Pair -> MobilePair(model, state)
                Screen.Profile -> MobileProfile(model, state)
                is Screen.ChannelInfo -> MobileChannel(model, state)
                is Screen.SeriesInfo -> MobileSeries(model, state)
            }
        }
        BottomNav(state.tab) { model.navigate(it) }
    }
}

@Composable
fun BottomNav(selected: Screen, onSelect: (Screen) -> Unit) {
    Row(Modifier.fillMaxWidth().background(Ntv.Rail).topLine(Ntv.Raised2).padding(bottom = 8.dp)) {
        for ((screen, label) in listOf(Screen.Home to "Canales", Screen.Guide to "Guía", Screen.Catalog to "Series", Screen.Pair to "Vincular")) {
            val on = selected == screen || (screen == Screen.Pair && selected == Screen.Profile)
            Column(Modifier.weight(1f).heightIn(min = 60.dp).clickable { onSelect(screen) }, horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterVertically)) {
                Box(Modifier.size(24.dp, 4.dp).background(if (on) Ntv.Amber else Color.Transparent, RoundedCornerShape(2.dp)))
                Txt(label, 12.sp, if (on) Ntv.Amber else Ntv.Muted, weight = if (on) FontWeight.SemiBold else FontWeight.Normal)
            }
        }
    }
}

@Composable
private fun IconButton(icon: NtvIcon, onClick: () -> Unit, size: androidx.compose.ui.unit.Dp = 22.dp, modifier: Modifier = Modifier, tint: Color = Ntv.Fg) {
    Box(modifier.size(44.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) { Icon(icon, size, tint) }
}

@Composable
private fun ChipRow(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), content = content)
}

@Composable
private fun SectionTitle(text: String, size: androidx.compose.ui.unit.TextUnit = 18.sp, modifier: Modifier = Modifier) =
    Txt(text, size, modifier = modifier, font = Display, weight = FontWeight.Bold)

// ── Canales (inicio) ──

@Composable
private fun MobileHome(model: AppViewModel, state: AppState) {
    val preferences by model.preferences.collectAsState()
    val categories = remember(state.channels) { state.channels.flatMap { it.categories }.distinct().take(4) }
    var filter by rememberSaveable { mutableStateOf("Todos") }
    val channels = state.channels.filter { when (filter) { "Todos" -> true; "Al aire" -> it.onAir; else -> filter in it.categories } }
    val featured = state.channels.firstOrNull { it.now != null }
    val resume = remember(state.session) {
        state.session?.progress.orEmpty().filter { !it.completed && it.currentSecond > 0 && it.seriesName.isNotEmpty() }
            .sortedByDescending { it.updatedAt }.distinctBy { it.seriesId }.take(6)
    }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 12.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(NtvIcon.Logo, 28.dp, Ntv.Amber)
            Txt("NOSTALGIA TV", 17.sp, modifier = Modifier.weight(1f), font = Display, weight = FontWeight.Bold, tracking = tracking(.08f))
            IconButton(NtvIcon.Search, { model.navigate(Screen.Catalog) })
            IconButton(NtvIcon.Tv, { model.navigate(Screen.Pair) })
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)) {
            seasonBanner(state.settings, preferences.seasonalEffects)?.let { (title, text, colors) ->
                item {
                    Row(Modifier.fillMaxWidth().background(colors.first, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Txt(title, 11.sp, colors.second, font = Mono, tracking = tracking(.1f))
                        Txt(text, 13.sp, colors.second)
                    }
                }
            }
            if (featured?.now != null) item { HeroCard(model, featured, featured.now) }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SectionTitle("Canales", 24.sp)
                    ChipRow { for (label in listOf("Todos", "Al aire") + categories) MobileChip(label, filter == label, { filter = label }) }
                    when {
                        state.loading && state.channels.isEmpty() -> Notice("Sintonizando canales…")
                        state.error != null && state.channels.isEmpty() -> Notice(state.error, action = "Volver a intentar", onAction = model::loadCatalog)
                        channels.isEmpty() -> Notice("No hay canales con este filtro.")
                    }
                    for (channel in channels) ChannelRow(channel, { model.playChannel(channel) }, { model.navigate(Screen.ChannelInfo(channel.id)) })
                }
            }
            if (resume.isNotEmpty()) item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SectionTitle("Continuar viendo", 19.sp)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(resume, key = { it.episodeId }) { item ->
                            Column(Modifier.width(200.dp).clickable { model.navigate(Screen.SeriesInfo(item.seriesId)) }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                EpisodeThumb(episodeCode(item.seasonNumber, item.episodeNumber), 0f, Modifier.fillMaxWidth(), radius = 10.dp)
                                Txt(item.seriesName, 14.sp, weight = FontWeight.SemiBold, lines = 1)
                                Txt("${episodeCode(item.seasonNumber, item.episodeNumber)} · en ${playTime((item.currentSecond * 1000).toLong())}", 12.sp, Ntv.Muted, lines = 1)
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Seasonal strip when the platform is in Halloween or Christmas and the viewer keeps seasonal effects on. */
private fun seasonBanner(settings: PublicSettings, enabled: Boolean): Triple<String, String, Pair<Color, Color>>? = when {
    !enabled || !settings.seasonalThemes -> null
    settings.season == "Halloween" -> Triple("HALLOWEEN", "Especiales de terror hasta el 31", Color(0xFF2A1A0C) to Color(0xFFFFC48A))
    settings.season == "Christmas" -> Triple("NAVIDAD", "Especiales navideños todo diciembre", Color(0xFF12261A) to Color(0xFF9FE3B0))
    else -> null
}

@Composable
private fun HeroCard(model: AppViewModel, channel: Channel, now: NowPlaying) {
    val shape = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(Ntv.Panel).border(1.dp, Ntv.Line, shape).clickable { model.playChannel(channel) }) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).crtGlow(x = .5f, y = .5f, edge = Ntv.Ink2)) {
            imageUrl(model, channel.logoPath)?.let { coil3.compose.AsyncImage(it, null, Modifier.align(Alignment.Center).fillMaxSize(.4f).alpha(.6f)) }
            LiveBadge(size = 11.sp, modifier = Modifier.align(Alignment.TopStart).padding(10.dp))
            ChannelNumber(channel.number, 30.sp, Modifier.align(Alignment.TopEnd).padding(top = 6.dp, end = 12.dp))
            ProgressLine(now.progress, Modifier.align(Alignment.BottomCenter), 3.dp, Color.White.copy(alpha = .15f), round = false)
        }
        Column(Modifier.padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Txt(listOf(channel.name.uppercase(), episodeCode(now.seasonNumber, now.episodeNumber)).filter { it.isNotEmpty() }.joinToString(" · "),
                11.sp, Ntv.Amber, font = Mono, lines = 1)
            Txt(now.seriesName ?: now.title, 24.sp, font = Display, weight = FontWeight.Bold, lines = 2)
            channel.next?.let { Txt("Sigue: ${it.seriesName} a las ${clock(it.startsAt)}", 13.sp, Ntv.Muted, lines = 1) }
        }
    }
}

@Composable
private fun ChannelRow(channel: Channel, onClick: () -> Unit, onInfo: () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).clip(shape).background(Ntv.Panel).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(44.dp).background(Ntv.Raised2, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
            Txt(channel.number, 17.sp, Ntv.Amber, font = Display, weight = FontWeight.Bold)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Txt(channel.name, 15.sp, weight = FontWeight.SemiBold, lines = 1)
            Txt(channel.now?.let { "Ahora: ${it.seriesName ?: it.title}" } ?: "Fuera del aire", 12.sp, Ntv.Muted, lines = 1)
            ProgressLine(channel.now?.progress ?: 0f, height = 3.dp, track = Ntv.Line)
        }
        Box(Modifier.size(36.dp).clip(CircleShape).clickable(onClick = onInfo), contentAlignment = Alignment.Center) { Txt("›", 20.sp, Ntv.Muted) }
    }
}

// ── Guía ──

@Composable
private fun MobileGuide(model: AppViewModel, state: AppState) {
    var channelId by rememberSaveable { mutableStateOf<Int?>(null) }
    val row = state.guide.firstOrNull { it.channelId == channelId } ?: state.guide.firstOrNull()
    val list = rememberLazyListState()
    val now = System.currentTimeMillis()
    val nowIndex = row?.slots?.indexOfFirst { it.startsAt <= now && it.endsAt > now } ?: -1
    LaunchedEffect(row?.channelId, state.guideDay, nowIndex) { if (state.guideDay == 0 && nowIndex > 0) list.scrollToItem(nowIndex) }
    var jump by remember { mutableIntStateOf(0) }
    LaunchedEffect(jump) { if (jump > 0 && nowIndex >= 0) list.animateScrollToItem(nowIndex) }
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxWidth().topLine(Ntv.Raised2, bottom = true).padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                SectionTitle("Guía", 26.sp)
                Box(Modifier.heightIn(min = 40.dp).clip(RoundedCornerShape(20.dp)).border(1.dp, Ntv.Live, RoundedCornerShape(20.dp))
                    .clickable { if (state.guideDay != 0) model.loadGuide(0); jump++ }.padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
                    Txt("● Ir a ahora", 13.sp, Ntv.Danger, weight = FontWeight.SemiBold)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (day in 0..2) MobileChip(dayLabel(day), state.guideDay == day, { model.loadGuide(day) })
            }
            ChipRow {
                for (item in state.guide) MobileChip("${item.channelId.toString().padStart(2, '0')} ${item.channelName}", item.channelId == row?.channelId,
                    { channelId = item.channelId })
            }
        }
        when {
            state.guideLoading && state.guide.isEmpty() -> Notice("Cargando la guía…", Modifier.padding(horizontal = 16.dp))
            row == null || row.slots.isEmpty() -> Notice("No hay programación para este día.", Modifier.padding(horizontal = 16.dp))
            else -> LazyColumn(Modifier.fillMaxSize(), list, contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 16.dp)) {
                items(row.slots, key = { it.programId }) { slot ->
                    val live = slot.startsAt <= now && slot.endsAt > now
                    val past = slot.endsAt <= now
                    Row(Modifier.fillMaxWidth().alpha(if (past) .55f else 1f)
                        .then(if (live) Modifier.background(Ntv.AmberWash).drawLeftBar() else Modifier)
                        .topLine(Ntv.Raised2, bottom = true)
                        .clickable { if (live) model.playChannel(row.channelId) else model.navigate(Screen.SeriesInfo(slot.seriesId)) }
                        .padding(horizontal = 8.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Column(Modifier.width(52.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Txt(clock(slot.startsAt), 14.sp, when { live -> Ntv.Danger; past -> Ntv.Dim; else -> Ntv.Fg }, font = Mono)
                            Txt("${minutes(slot.startsAt, slot.endsAt)}m", 10.sp, Ntv.Dim, font = Mono)
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Txt(slot.seriesName, 15.sp, weight = FontWeight.SemiBold, lines = 1)
                            Txt(listOf(episodeCode(slot.seasonNumber, slot.episodeNumber, slot.episodeType), slot.title.takeIf { it != slot.seriesName })
                                .filter { !it.isNullOrBlank() }.joinToString(" · "), 12.sp, Ntv.Muted, lines = 2)
                            if (live) ProgressLine(((now - slot.startsAt).toFloat() / (slot.endsAt - slot.startsAt)), Modifier.padding(top = 4.dp), 3.dp, Ntv.Line)
                        }
                        val tag = if (live) "AHORA" else if (slot.isSpecial) "ESPECIAL" else ""
                        Txt(tag, 10.sp, if (live) Ntv.Danger else Ntv.Violet, font = Mono, tracking = tracking(.08f))
                    }
                }
            }
        }
    }
}

private fun Modifier.drawLeftBar(): Modifier = this.drawBehind {
    drawRect(Ntv.Amber, size = androidx.compose.ui.geometry.Size(3.dp.toPx(), size.height))
}

private fun dayLabel(offset: Int): String = when (offset) {
    0 -> "Hoy"
    1 -> "Mañana"
    else -> SimpleDateFormat("EEE d", Locale("es")).format(Calendar.getInstance().apply { add(Calendar.DATE, offset) }.time)
        .replaceFirstChar { it.uppercase() }.replace(".", "")
}

// ── Series (buscar y filtrar) ──

@Composable
private fun MobileCatalog(model: AppViewModel, state: AppState) {
    var query by rememberSaveable { mutableStateOf(state.seriesFilter.name) }
    val chips = remember(state.categories) {
        listOf("Todas" to SeriesFilter()) + state.categories.take(4).map { it.name to SeriesFilter(categoryId = it.id) } +
            listOf("80s" to SeriesFilter(decade = 1980), "90s" to SeriesFilter(decade = 1990), "Al aire" to SeriesFilter(onAirToday = true))
    }
    val active = chips.firstOrNull { it.second.copy(name = "", sort = "name") == state.seriesFilter.copy(name = "", sort = "name") }?.first ?: "Todas"
    val byRating = state.seriesFilter.sort == "rating"
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxWidth().topLine(Ntv.Raised2, bottom = true).padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionTitle("Series", 26.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val shape = RoundedCornerShape(22.dp)
                Row(Modifier.weight(1f).heightIn(min = 44.dp).background(Ntv.Panel, shape).border(1.dp, Ntv.Edge, shape).padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(NtvIcon.Search, 16.dp, Ntv.Muted)
                    Box(Modifier.weight(1f)) {
                        if (query.isEmpty()) Txt("Buscar series…", 15.sp, Ntv.Muted)
                        BasicTextField(query, { query = it.take(100) }, Modifier.fillMaxWidth(), singleLine = true,
                            textStyle = TextStyle(color = Ntv.Fg, fontSize = 15.sp, fontFamily = Sans), cursorBrush = SolidColor(Ntv.Amber),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(onSearch = { model.filterSeries(state.seriesFilter.copy(name = query)) }))
                    }
                }
                Box(Modifier.size(44.dp).clip(shape).border(1.dp, if (byRating) Ntv.Amber else Ntv.Edge, shape)
                    .clickable { model.filterSeries(state.seriesFilter.copy(name = query, sort = if (byRating) "name" else "rating")) },
                    contentAlignment = Alignment.Center) { Icon(NtvIcon.Sort, 18.dp, if (byRating) Ntv.Amber else Ntv.Fg) }
            }
            ChipRow { for ((label, filter) in chips) MobileChip(label, active == label, { model.filterSeries(filter.copy(name = query, sort = state.seriesFilter.sort)) }) }
            Txt("${state.totalSeries} resultados · ${if (byRating) "mejor calificadas" else "A–Z"}", 12.sp, Ntv.Muted)
        }
        when {
            state.loading && state.series.isEmpty() -> Notice("Buscando series…", Modifier.padding(horizontal = 16.dp))
            state.error != null && state.series.isEmpty() -> Notice(state.error, Modifier.padding(horizontal = 16.dp), "Volver a intentar", { model.seriesPage(1) })
            state.series.isEmpty() -> Txt("Ninguna serie coincide.", 14.sp, Ntv.Muted, Modifier.fillMaxWidth().padding(vertical = 32.dp, horizontal = 12.dp), align = TextAlign.Center)
            else -> LazyVerticalGrid(GridCells.Fixed(2), Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                itemsIndexed(state.series, key = { _, series -> series.id }) { index, series ->
                    if (index >= state.series.size - 4 && state.series.size < state.totalSeries && !state.loading)
                        LaunchedEffect(state.series.size) { model.seriesPage(state.seriesPage + 1) }
                    Column(Modifier.clickable { model.navigate(Screen.SeriesInfo(series.id)) }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Poster(series.name, imageUrl(model, series.logoPath), Modifier.fillMaxWidth().aspectRatio(2f / 3f), 12.dp, 16.sp, series.onAir, 9.sp,
                            border = true, padding = 10.dp)
                        Txt(listOfNotNull(years(series.startYear, series.endYear).ifEmpty { null }, series.rating?.let { "★ %.1f".format(it) }).joinToString(" · "),
                            11.sp, Ntv.Muted, font = Mono, lines = 1)
                    }
                }
            }
        }
    }
}

// ── Serie ──

@Composable
private fun MobileSeries(model: AppViewModel, state: AppState) {
    val series = state.seriesDetail
    if (series == null) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            IconButton(NtvIcon.Back, { model.back() })
            if (state.error != null) Notice(state.error, action = "Volver", onAction = { model.back() }) else Notice("Cargando la serie…")
        }
        return
    }
    val progress = remember(state.session) { state.session?.progress.orEmpty().associateBy { it.episodeId } }
    val resume = model.resumeEpisode()
    val seasons = remember(state.episodes) { state.episodes.map { it.season }.distinct().sortedWith(compareBy<Int> { it != 0 }.thenBy { it }) }
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            Box(Modifier.fillMaxWidth().scanlines(Ntv.Rail, .03f).topLine(Ntv.Raised2, bottom = true)) {
                IconButton(NtvIcon.Back, { model.back() }, modifier = Modifier.padding(6.dp))
                Row(Modifier.padding(start = 16.dp, end = 16.dp, top = 56.dp, bottom = 18.dp), verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Poster("", imageUrl(model, series.logoPath), Modifier.width(104.dp).aspectRatio(2f / 3f), 10.dp, border = true)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Txt(listOfNotNull(years(series.startYear, series.endYear).ifEmpty { null }, series.rating?.let { "★ %.1f".format(it) }).joinToString(" · "),
                            11.sp, Ntv.Amber, font = Mono)
                        Txt(series.name, 28.sp, font = Display, weight = FontWeight.Bold, lineHeight = 29.sp, lines = 3)
                        if (series.categories.isNotEmpty()) Txt(series.categories.joinToString(" · "), 12.sp, Ntv.Muted)
                    }
                }
            }
        }
        item {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                if (resume != null) {
                    val started = progress[resume.id]?.let { !it.completed && it.currentSecond > 0 } == true
                    MobileButton("${if (started) "Continuar" else "Reproducir"} ${episodeCode(resume.season, resume.episodeNumber, resume.episodeType)}",
                        { model.playEpisode(resume) }, Modifier.fillMaxWidth(), primary = true, icon = NtvIcon.Play)
                }
                series.onAir.firstOrNull()?.let { (channelId, name) ->
                    MobileButton("Al aire en $name", { model.playChannel(channelId) }, Modifier.fillMaxWidth())
                }
                series.description?.let { Txt(it, 14.sp, Ntv.Fg2, lineHeight = 21.7.sp) }
                if (state.episodes.isEmpty()) Notice("Esta serie todavía no tiene episodios disponibles.")
                else ChipRow { for (season in seasons) MobileChip(if (season == 0) "Especiales" else "T$season", season == state.season, { model.season(season) }) }
            }
        }
        items(state.episodes.filter { it.season == state.season }, key = { it.id }) { episode ->
            val item = progress[episode.id]
            Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Ntv.Panel)
                .clickable { model.playEpisode(episode) }.padding(8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                EpisodeThumb(if (episode.season == 0) episode.episodeType.uppercase() else "E${episode.episodeNumber}", if (item?.completed == true) 1f else 0f,
                    Modifier.width(112.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Txt(episode.title, 14.sp, weight = FontWeight.SemiBold, lineHeight = 17.5.sp, lines = 2)
                    val (label, color) = episodeState(item)
                    Txt(label, 11.sp, color, font = Mono)
                }
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

// ── Detalle de canal ──

@Composable
private fun MobileChannel(model: AppViewModel, state: AppState) {
    val channel = state.channelDetail
    val context = LocalContext.current
    if (channel == null) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            IconButton(NtvIcon.Back, { model.back() })
            if (state.error != null) Notice(state.error, action = "Volver", onAction = { model.back() }) else Notice("Cargando el canal…")
        }
        return
    }
    val live = state.channels.firstOrNull { it.id == channel.id }?.now != null
    var eraId by rememberSaveable(channel.id) { mutableStateOf(channel.eras.firstOrNull { it.isActive }?.id ?: channel.eras.firstOrNull()?.id) }
    val era = channel.eras.firstOrNull { it.id == eraId }
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            Box(Modifier.fillMaxWidth().scanlines(Ntv.Rail, .03f).topLine(Ntv.Raised2, bottom = true)) {
                IconButton(NtvIcon.Back, { model.back() }, modifier = Modifier.padding(6.dp))
                IconButton(NtvIcon.Link, {
                    val url = model.api.base.resolve("canal/${channel.id}")?.toString() ?: return@IconButton
                    context.startActivity(android.content.Intent.createChooser(android.content.Intent(android.content.Intent.ACTION_SEND)
                        .setType("text/plain").putExtra(android.content.Intent.EXTRA_TEXT, "${channel.name} en NostalgiaTV: $url"), "Compartir canal"))
                }, 20.dp, Modifier.align(Alignment.TopEnd).padding(6.dp))
                Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 52.dp, bottom = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Box(Modifier.size(72.dp).background(Ntv.Raised, RoundedCornerShape(14.dp)).border(1.dp, Ntv.Edge, RoundedCornerShape(14.dp)),
                            contentAlignment = Alignment.Center) { ChannelNumber(channel.id.toString().padStart(2, '0'), 32.sp) }
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                if (live) LiveBadge("EN VIVO", 10.sp)
                                channel.eras.firstOrNull { it.isActive }?.let { Txt(it.name.uppercase(), 10.sp, Ntv.Amber, font = Mono, lines = 1) }
                            }
                            Txt(channel.name, 26.sp, font = Display, weight = FontWeight.Bold, lineHeight = 27.sp, lines = 2)
                        }
                    }
                    channel.history?.let { Txt(it, 14.sp, Ntv.Fg2, lineHeight = 21.sp) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MobileButton("Ver en vivo", { model.playChannel(channel.id) }, Modifier.weight(1f), primary = true, icon = NtvIcon.Play)
                        MobileButton("Guía", { model.navigate(Screen.Guide) })
                    }
                }
            }
        }
        item {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                if (channel.eras.isNotEmpty()) Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SectionTitle("Eras")
                    ChipRow {
                        for (item in channel.eras) {
                            val on = item.id == eraId
                            val shape = RoundedCornerShape(10.dp)
                            Column(Modifier.clip(shape).background(if (on) Ntv.Amber else Ntv.Panel).border(1.dp, if (on) Ntv.Amber else Ntv.Edge, shape)
                                .clickable { eraId = item.id }.padding(horizontal = 14.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Txt(years(item.startYear, item.endYear), 10.sp, (if (on) Ntv.OnAmber else Ntv.Fg).copy(alpha = .85f), font = Mono)
                                Txt(item.name, 14.sp, if (on) Ntv.OnAmber else Ntv.Fg, weight = FontWeight.SemiBold, lines = 1)
                            }
                        }
                    }
                    era?.description?.let { Txt(it + if (era.isActive) " Al aire ahora." else "", 13.sp, Ntv.Muted, lineHeight = 19.5.sp) }
                }
                if (era != null && era.series.isNotEmpty()) Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SectionTitle("Series de esta era")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(era.series, key = { it.seriesId }) { series ->
                            Poster(series.name, imageUrl(model, series.logoPath), Modifier.width(110.dp).aspectRatio(2f / 3f)
                                .clickable { model.navigate(Screen.SeriesInfo(series.seriesId)) }, 10.dp, 13.sp, border = true, padding = 8.dp)
                        }
                    }
                }
                Column {
                    SectionTitle("Comentarios", modifier = Modifier.padding(bottom = 6.dp))
                    if (state.comments.isEmpty()) Txt("Todavía no hay comentarios publicados.", 13.sp, Ntv.Muted)
                    for (comment in state.comments.takeLast(2).reversed()) CommentLine(comment)
                    if (live) Box(Modifier.heightIn(min = 44.dp).clickable { model.playChannel(channel.id) }, contentAlignment = Alignment.CenterStart) {
                        Txt("Ver todos en vivo", 14.sp, Ntv.Amber)
                    }
                }
            }
        }
    }
}

@Composable
fun CommentLine(comment: Comment) {
    Column(Modifier.fillMaxWidth().topLine(Ntv.Raised2, bottom = true).padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Txt(comment.author, 12.sp, weight = FontWeight.SemiBold)
            Txt("· ${ago(comment.createdAt)}", 12.sp, Ntv.Dim)
        }
        Txt(comment.body, 14.sp, Ntv.Fg2, lineHeight = 20.sp)
    }
}

fun ago(millis: Long): String {
    if (millis <= 0) return ""
    val minutes = (System.currentTimeMillis() - millis) / 60_000
    return when {
        minutes < 1 -> "ahora"
        minutes < 60 -> "hace $minutes min"
        minutes < 24 * 60 -> "hace ${minutes / 60} h"
        minutes < 48 * 60 -> "ayer"
        minutes < 7 * 24 * 60 -> "hace ${minutes / (24 * 60)} días"
        else -> SimpleDateFormat("d MMM", Locale("es")).format(java.util.Date(millis))
    }
}

// ── Vincular TV ──

@Composable
private fun MobilePair(model: AppViewModel, state: AppState) {
    var code by rememberSaveable { mutableStateOf("") }
    val context = LocalContext.current
    val scanner = rememberLauncherForActivityResult(ScanContract()) { result ->
        val contents = result.contents ?: return@rememberLauncherForActivityResult
        // The TV's QR is the web address /vincular?code=… on this server.
        val scanned = contents.toHttpUrlOrNull()
        val value = scanned?.takeIf { it.host == model.api.base.host }?.queryParameter("code")
        if (value != null) model.approveTvInBrowser(value) else model.approveTvInBrowser(contents)
    }
    val session = state.session
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(start = 8.dp, top = 8.dp, end = 8.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            IconButton(NtvIcon.Back, { model.back() })
            Txt("Vincular TV", 18.sp, font = Display, weight = FontWeight.SemiBold)
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(22.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Txt("Escribe el código que ves en tu TV", 26.sp, font = Display, weight = FontWeight.Bold, lineHeight = 28.6.sp)
                Txt("Abre NostalgiaTV en el televisor y elige «Vincular». Confirmarás con tu cuenta en el navegador.", 14.sp, Ntv.Muted, lineHeight = 21.sp)
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Txt("Código", 13.sp, Ntv.Muted)
                val shape = RoundedCornerShape(12.dp)
                Box(Modifier.fillMaxWidth().heightIn(min = 64.dp).background(Ntv.Panel, shape).border(2.dp, Ntv.Edge, shape).padding(horizontal = 16.dp),
                    contentAlignment = Alignment.Center) {
                    if (code.isEmpty()) Txt("XXX-XXX-XXX-XXX", 22.sp, Ntv.Faint, font = Mono, weight = FontWeight.SemiBold, tracking = tracking(.12f))
                    BasicTextField(code, { value -> code = formatCode(value) }, Modifier.fillMaxWidth(), singleLine = true,
                        textStyle = TextStyle(color = Ntv.Fg, fontSize = 22.sp, fontFamily = Mono, fontWeight = FontWeight.SemiBold,
                            letterSpacing = tracking(.12f), textAlign = TextAlign.Center), cursorBrush = SolidColor(Ntv.Amber),
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { model.approveTvInBrowser(code) }))
                }
            }
            if (context.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_CAMERA_ANY))
                MobileButton("Escanear código QR", {
                    scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Escanea el QR que muestra tu TV")
                        .setBeepEnabled(false).setOrientationLocked(false))
                }, Modifier.fillMaxWidth(), icon = NtvIcon.Scan)
            MobileButton("Vincular", { model.approveTvInBrowser(code) }, Modifier.fillMaxWidth(), primary = true, height = 52.dp)
            state.profileError?.let { Txt(it, 13.sp, Ntv.Danger) }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth().panel().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Avatar(session?.username, 40.dp, 15.sp)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Txt(session?.username ?: "Invitado", 14.sp, weight = FontWeight.SemiBold)
                        Txt(if (session?.accountLinked == true) "Cuenta de espectador" else "Perfil sin cuenta", 12.sp, Ntv.Muted)
                    }
                    Box(Modifier.heightIn(min = 40.dp).clickable { model.navigate(Screen.Profile) }.padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                        Txt("Ver perfil", 13.sp, Ntv.Amber)
                    }
                }
                SectionTitle("Mis dispositivos", modifier = Modifier.padding(top = 8.dp))
                for (device in session?.devices.orEmpty()) DeviceRow(device) { model.removeDevice(device.id) }
            }
        }
    }
}

private fun formatCode(value: String): String =
    value.uppercase().filter { it.isLetterOrDigit() }.take(12).chunked(3).joinToString("-")

@Composable
private fun DeviceRow(device: ViewerDevice, onRemove: () -> Unit) {
    var confirm by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().heightIn(min = 60.dp).panel().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Txt(if (device.current) "Este dispositivo" else device.name, 14.sp, weight = FontWeight.SemiBold, lines = 1)
            Txt(if (device.current) "${device.name} · ahora" else ago(device.lastSeen).ifEmpty { "Vinculado" }, 12.sp, Ntv.Muted, lines = 1)
        }
        Box(Modifier.heightIn(min = 40.dp).clip(RoundedCornerShape(20.dp)).clickable { if (confirm) onRemove() else confirm = true }.padding(horizontal = 12.dp),
            contentAlignment = Alignment.Center) { Txt(if (confirm) "¿Quitar?" else "Quitar", 13.sp, Ntv.Danger, weight = FontWeight.Medium) }
    }
}

// ── Perfil e historial ──

@Composable
private fun MobileProfile(model: AppViewModel, state: AppState) {
    val preferences by model.preferences.collectAsState()
    val video by model.videoSettings.collectAsState()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var confirm by remember { mutableStateOf<String?>(null) }
    val session = state.session
    val history = session?.progress.orEmpty().filter { it.seriesName.isNotEmpty() }.sortedByDescending { it.updatedAt }
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Avatar(session?.username, 56.dp, 22.sp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Txt(session?.username ?: "Invitado", 22.sp, font = Display, weight = FontWeight.Bold, lines = 1)
                    Txt("${history.count { it.completed }} episodios vistos · ${session?.deviceCount ?: 1} dispositivo${if ((session?.deviceCount ?: 1) == 1) "" else "s"}", 12.sp, Ntv.Muted)
                }
            }
            Row(Modifier.fillMaxWidth().topLine(Ntv.Line, bottom = true)) {
                listOf("Historial", "Comentarios", "Ajustes").forEachIndexed { index, label ->
                    val on = index == tab
                    Box(Modifier.weight(1f).heightIn(min = 44.dp).clickable { tab = index; confirm = null }
                        .then(if (on) Modifier.drawBottomBar() else Modifier), contentAlignment = Alignment.Center) {
                        Txt(label, 14.sp, if (on) Ntv.Amber else Ntv.Muted, weight = FontWeight.SemiBold)
                    }
                }
            }
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            state.profileError?.let { Txt(it, 13.sp, Ntv.Danger) }
            when (tab) {
                0 -> {
                    if (history.isEmpty()) Notice("Todavía no has visto episodios en este perfil.")
                    for (item in history.take(50)) {
                        Row(Modifier.fillMaxWidth().panel().clickable { model.navigate(Screen.SeriesInfo(item.seriesId)) }.padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            EpisodeThumb("", if (item.completed) 1f else 0f, Modifier.width(96.dp))
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Txt(item.seriesName, 14.sp, weight = FontWeight.SemiBold, lines = 1)
                                Txt("${episodeCode(item.seasonNumber, item.episodeNumber)} · ${ago(item.updatedAt)}", 12.sp, Ntv.Muted, lines = 1)
                                Txt(if (item.completed) "✓ COMPLETADO" else "EN CURSO · ${playTime((item.currentSecond * 1000).toLong())}", 10.sp,
                                    if (item.completed) Ntv.Ok else Ntv.Amber, font = Mono)
                            }
                        }
                    }
                    if (history.isNotEmpty()) MobileButton(if (confirm == "history") "Toca otra vez para borrar todo" else "Borrar historial",
                        { if (confirm == "history") { confirm = null; model.clearHistory() } else confirm = "history" },
                        Modifier.fillMaxWidth().padding(top = 6.dp), danger = true, height = 44.dp)
                }
                1 -> {
                    Txt("Tus comentarios se escriben y moderan desde la web con tu cuenta.", 14.sp, Ntv.Muted, lineHeight = 20.sp)
                    MobileButton("Abrir mi perfil en la web", {
                        model.api.base.resolve("perfil")?.let { url -> model.openUrl(url.toString()) }
                    }, Modifier.fillMaxWidth())
                }
                else -> {
                    Toggle("Reproducir con datos móviles", "Si está apagado, solo con Wi-Fi", preferences.mobileData) {
                        model.updatePreferences(preferences.copy(mobileData = !preferences.mobileData)) }
                    Toggle("Mostrar número al cambiar de canal", "Número verde estilo TV de tubo", preferences.showChannelNumber) {
                        model.updatePreferences(preferences.copy(showChannelNumber = !preferences.showChannelNumber)) }
                    Toggle("Efectos de temporada", "Halloween y Navidad", preferences.seasonalEffects) {
                        model.updatePreferences(preferences.copy(seasonalEffects = !preferences.seasonalEffects)) }
                    Toggle("Imagen retro", "Líneas de barrido y bordes de TV de tubo", video.enabled) {
                        model.updateVideoSettings(video.copy(enabled = !video.enabled)) }
                    LinkRow("Mis dispositivos") { model.navigate(Screen.Pair) }
                    LinkRow("Servidor · ${state.serverAddress.removePrefix("https://").trimEnd('/')}",
                        if (confirm == "server") "Toca otra vez para cambiar" else "Cambiar") { if (confirm == "server") model.chooseServer() else confirm = "server" }
                    MobileButton(if (confirm == "logout") "Toca otra vez para cerrar sesión" else "Cerrar sesión",
                        { if (confirm == "logout") model.logout() else confirm = "logout" }, Modifier.fillMaxWidth().padding(top = 16.dp), danger = true)
                }
            }
        }
    }
}

private fun Modifier.drawBottomBar(): Modifier = this.drawBehind {
    drawRect(Ntv.Amber, topLeft = androidx.compose.ui.geometry.Offset(0f, size.height - 2.dp.toPx()),
        size = androidx.compose.ui.geometry.Size(size.width, 2.dp.toPx()))
}

@Composable
private fun Toggle(label: String, hint: String, on: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 60.dp).topLine(Ntv.Raised2, bottom = true).clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Txt(label, 15.sp)
            Txt(hint, 12.sp, Ntv.Muted)
        }
        androidx.compose.material3.Switch(on, { onClick() }, colors = androidx.compose.material3.SwitchDefaults.colors(
            checkedThumbColor = Ntv.OnAmber, checkedTrackColor = Ntv.Amber, uncheckedThumbColor = Ntv.Muted, uncheckedTrackColor = Ntv.Raised2,
            uncheckedBorderColor = Ntv.Edge))
    }
}

@Composable
private fun LinkRow(label: String, value: String = "›", onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).topLine(Ntv.Raised2, bottom = true).clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically) {
        Txt(label, 15.sp, modifier = Modifier.weight(1f), lines = 1)
        Txt(value, 14.sp, Ntv.Muted)
    }
}
