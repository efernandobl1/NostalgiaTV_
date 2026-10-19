package tv.nostalgia.android.features

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.delay
import tv.nostalgia.android.BuildConfig
import tv.nostalgia.android.core.*
import tv.nostalgia.android.shared.*

// Android TV is laid out at 960×540dp: every size is half of the 1920×1080 design.

@Composable
fun TvApp(model: AppViewModel, state: AppState) {
    // Keep "now playing" fresh while browsing.
    LaunchedEffect(state.screen) { while (state.screen == Screen.Home) { delay(60_000); model.refreshChannels() } }
    Box(Modifier.fillMaxSize().scanlines(Ntv.Ink2, .02f)) {
        when (val screen = state.screen) {
            Screen.Home -> TvHome(model, state)
            Screen.Guide -> TvGuide(model, state)
            Screen.Catalog -> TvCatalog(model, state)
            Screen.Pair -> TvPair(model, state)
            Screen.Profile -> TvSettings(model, state)
            is Screen.ChannelInfo -> TvChannel(model, state)
            is Screen.SeriesInfo -> TvSeries(model, state)
        }
    }
}

@Composable
private fun TvHeader(model: AppViewModel, state: AppState, logo: Boolean = true, firstFocus: FocusRequester? = null) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        if (logo) LogoWordmark(22.dp, 14.sp) else Txt("NOSTALGIA TV", 14.sp, font = Display, weight = FontWeight.Bold, tracking = tracking(.08f))
        Row(horizontalArrangement = Arrangement.spacedBy(if (logo) 6.dp else 4.dp)) {
            for ((index, item) in listOf(Screen.Home to "Canales", Screen.Guide to "Guía", Screen.Catalog to "Series", Screen.Pair to "Vincular").withIndex()) {
                val selected = state.tab == item.first
                val shape = RoundedCornerShape(50)
                Box(Modifier.then(if (index == 0 && firstFocus != null) Modifier.focusRequester(firstFocus) else Modifier)
                    .focusRing(shape, { model.navigate(item.first) }).background(if (selected) Ntv.Fg else Color.Transparent, shape)
                    .padding(horizontal = if (logo) 14.dp else 13.dp, vertical = 6.dp)) {
                    Txt(item.second, 12.sp, if (selected) Ntv.Ink2 else Ntv.Muted, weight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
                }
            }
        }
        Spacer(Modifier.weight(1f))
        if (logo) Box(Modifier.size(28.dp).focusRing(CircleShape, { model.navigate(Screen.Catalog) }).background(Ntv.Glass(.1f), CircleShape),
            contentAlignment = Alignment.Center) { Icon(NtvIcon.Search, 13.dp, Ntv.Fg) }
        Txt(rememberClock(), if (logo) 16.sp else 15.sp, font = Display, weight = FontWeight.SemiBold)
        if (logo) Box(Modifier.focusRing(CircleShape, { model.navigate(Screen.Profile) })) {
            Avatar(state.session?.username, 28.dp, 11.sp)
        }
    }
}

// ── Canales (inicio) ──

@Composable
private fun TvHome(model: AppViewModel, state: AppState) {
    val categories = remember(state.channels) { state.channels.flatMap { it.categories }.distinct().take(4) }
    var filter by rememberSaveable { mutableStateOf("Todos") }
    val channels = state.channels.filter {
        when (filter) { "Todos" -> true; "Solo al aire" -> it.onAir; else -> filter in it.categories }
    }
    var featuredId by rememberSaveable { mutableStateOf<Int?>(null) }
    val featured = state.channels.firstOrNull { it.id == featuredId } ?: state.channels.firstOrNull { it.now != null } ?: state.channels.firstOrNull()
    val watch = remember { FocusRequester() }
    LaunchedEffect(featured != null) { if (featured != null) runCatching { watch.requestFocus() } }

    Box(Modifier.fillMaxSize()) {
        LivePreview(model, featured, Modifier.align(Alignment.TopEnd).width(550.dp).height(320.dp))
        Column(Modifier.fillMaxSize().padding(horizontal = 48.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            TvHeader(model, state)
            if (featured != null) Column(Modifier.width(410.dp).padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (featured.now != null) LiveBadge(size = 10.sp)
                    Txt("CH ${featured.number} · ${featured.name.uppercase()}", 11.sp, Ntv.Amber, font = Mono, lines = 1)
                }
                Txt(featured.now?.let { it.seriesName ?: it.title } ?: featured.name, 44.sp, font = Display, weight = FontWeight.Bold,
                    lineHeight = 44.sp, lines = 2)
                Txt(featured.now?.let { now -> listOf(episodeCode(now.seasonNumber, now.episodeNumber, part = now.part), now.title.takeIf { now.seriesName != null && it != now.seriesName },
                    "termina ${clock(now.endsAt)}").filter { !it.isNullOrBlank() }.joinToString(" · ") } ?: "Fuera del aire", 14.sp, Ntv.Fg2, lines = 2)
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    TvPill("Ver en vivo", { model.playChannel(featured) }, Modifier.focusRequester(watch), primary = true, fontSize = 14.sp, icon = NtvIcon.Play)
                    TvPill("Guía", { model.navigate(Screen.Guide) }, fontSize = 14.sp)
                }
            }
            Spacer(Modifier.weight(1f))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Txt("Canales", 16.sp, font = Display, weight = FontWeight.SemiBold, modifier = Modifier.padding(end = 8.dp))
                    for (label in listOf("Todos") + categories + "Solo al aire")
                        TvChip(label, filter == label, { filter = label }, height = 26.dp)
                }
                when {
                    state.loading && state.channels.isEmpty() -> Notice("Sintonizando canales…")
                    state.error != null && state.channels.isEmpty() -> Notice(state.error, action = "Volver a intentar", onAction = model::loadCatalog)
                    channels.isEmpty() -> Notice("No hay canales con este filtro.")
                    else -> LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp), contentPadding = PaddingValues(vertical = 6.dp, horizontal = 4.dp)) {
                        items(channels, key = { it.id }) { channel -> TvChannelCard(channel, { model.playChannel(channel) }, { featuredId = channel.id },
                            { model.navigate(Screen.ChannelInfo(channel.id)) }) }
                    }
                }
            }
        }
    }
}

@Composable
private fun LivePreview(model: AppViewModel, channel: Channel?, modifier: Modifier) {
    Box(modifier.crtGlow()) {
        val image = imageUrl(model, channel?.logoPath)
        if (image != null) AsyncImage(image, null, Modifier.align(Alignment.Center).fillMaxSize(.42f).alpha(.5f), contentScale = ContentScale.Fit)
        else if (channel != null) Txt("%02d".format(channel.id), 64.sp, Ntv.Faint, Modifier.align(Alignment.Center), font = Display)
        // Fade into the page so the hero text stays readable.
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(0f to Ntv.Ink2, .35f to Color.Transparent)))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(.6f to Color.Transparent, 1f to Ntv.Ink2)))
    }
}

@Composable
private fun TvChannelCard(channel: Channel, onClick: () -> Unit, onFocus: () -> Unit, onLongClick: () -> Unit) {
    val shape = RoundedCornerShape(9.dp)
    Column(Modifier.width(160.dp).focusRing(shape, onClick, onFocus = onFocus, onLongClick = onLongClick)
        .background(Ntv.Panel2, shape).border(1.dp, Ntv.Line, shape).padding(12.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Txt(channel.number, 22.sp, Ntv.Amber, font = Display, weight = FontWeight.Bold, lines = 1)
            Txt(channel.name, 12.sp, weight = FontWeight.SemiBold, lines = 2, lineHeight = 14.sp)
        }
        Txt(channel.now?.let { it.seriesName ?: it.title } ?: "Fuera del aire", 11.sp, Ntv.Fg2, lines = 1)
        ProgressLine(channel.now?.progress ?: 0f, height = 3.dp)
    }
}

// ── Guía ──

@Composable
fun TvGuide(model: AppViewModel, state: AppState, onTune: (() -> Unit)? = null) {
    val now = System.currentTimeMillis()
    val windowStart = now - now % (30 * 60_000)
    val windowEnd = windowStart + 150 * 60_000
    var selected by remember { mutableStateOf<Pair<GuideRow, GuideSlot>?>(null) }
    val firstSlot = remember { FocusRequester() }
    val rows = state.guide
    LaunchedEffect(rows.isNotEmpty()) { if (rows.isNotEmpty()) { delay(50); runCatching { firstSlot.requestFocus() } } }
    val pick = selected ?: rows.firstNotNullOfOrNull { row -> row.slots.firstOrNull { it.isNow }?.let { row to it } }
    Column(Modifier.fillMaxSize().padding(horizontal = 48.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(Modifier.height(150.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.Bottom)) {
                if (pick != null) {
                    val (row, slot) = pick
                    Txt("CH ${row.channelId.toString().padStart(2, '0')} ${row.channelName.uppercase()} · ${clock(slot.startsAt)}", 11.sp, Ntv.Amber,
                        font = Mono, tracking = tracking(.1f), lines = 1)
                    Txt(slot.seriesName, 32.sp, font = Display, weight = FontWeight.Bold, lineHeight = 32.sp, lines = 1)
                    Txt(listOf(episodeCode(slot.seasonNumber, slot.episodeNumber, slot.episodeType, slot.part), slot.title.takeIf { it != slot.seriesName })
                        .filter { !it.isNullOrBlank() }.joinToString(" · "), 13.sp, Ntv.Fg2, lines = 1)
                    Txt("OK para sintonizar · mantén OK para ver la serie", 11.sp, Ntv.Muted)
                } else Txt(if (state.guideLoading) "Cargando la guía…" else "No hay programación para hoy.", 13.sp, Ntv.Muted)
            }
            Box(Modifier.width(267.dp).fillMaxHeight().clip(RoundedCornerShape(9.dp)).scanlines(Ntv.Panel2)
                .border(1.dp, Ntv.Line, RoundedCornerShape(9.dp)), contentAlignment = Alignment.Center) {
                val logo = pick?.let { (row, _) -> imageUrl(model, row.logoPath) }
                if (logo != null) AsyncImage(logo, null, Modifier.fillMaxSize(.5f), contentScale = ContentScale.Fit)
                else pick?.let { (row, _) -> Txt("%02d".format(row.channelId), 48.sp, Ntv.Faint, font = Display) }
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row {
                Txt("Hoy", 13.sp, font = Display, weight = FontWeight.SemiBold, modifier = Modifier.width(130.dp))
                Row(Modifier.weight(1f)) {
                    for (column in 0 until 5) Txt(clock(windowStart + column * 30 * 60_000L), 11.sp, Ntv.Muted, Modifier.weight(1f), font = Mono)
                }
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(5.dp), contentPadding = PaddingValues(vertical = 4.dp)) {
                itemsIndexed(rows, key = { _, row -> row.channelId }) { rowIndex, row ->
                    Row(Modifier.height(52.dp)) {
                        Row(Modifier.width(130.dp).fillMaxHeight().padding(end = 8.dp), verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Txt(row.channelId.toString().padStart(2, '0'), 20.sp, Ntv.Amber, font = Display, weight = FontWeight.Bold, lines = 1)
                            Txt(row.channelName, 11.sp, weight = FontWeight.SemiBold, lines = 2, lineHeight = 13.sp)
                        }
                        val visible = row.slots.filter { it.endsAt > windowStart && it.startsAt < windowEnd }
                        Row(Modifier.weight(1f).fillMaxHeight(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            if (visible.isEmpty()) Box(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(7.dp)).background(Ntv.Panel2)
                                .padding(horizontal = 10.dp), contentAlignment = Alignment.CenterStart) {
                                Txt("Fuera del aire", 12.sp, Ntv.Muted, weight = FontWeight.SemiBold)
                            }
                            visible.forEachIndexed { slotIndex, slot ->
                                val span = (minOf(slot.endsAt, windowEnd) - maxOf(slot.startsAt, windowStart)).coerceAtLeast(60_000).toFloat()
                                GuideCell(slot, Modifier.weight(span).then(if (rowIndex == 0 && slotIndex == 0) Modifier.focusRequester(firstSlot) else Modifier),
                                    onFocus = { selected = row to slot },
                                    onClick = { model.playChannel(row.channelId); onTune?.invoke() },
                                    onLongClick = { onTune?.invoke(); model.navigate(Screen.SeriesInfo(slot.seriesId)) })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GuideCell(slot: GuideSlot, modifier: Modifier, onFocus: () -> Unit, onClick: () -> Unit, onLongClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(7.dp)
    Column(modifier.fillMaxHeight().onFocusChanged { focused = it.isFocused }
        .focusRing(shape, onClick, ring = Ntv.Amber, scale = 1.02f, onFocus = onFocus, onLongClick = onLongClick)
        .background(if (focused) Ntv.Fg else Ntv.Panel2, shape).then(if (focused) Modifier else Modifier.border(1.dp, Ntv.Raised2, shape))
        .padding(horizontal = 10.dp), verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically)) {
        val ink = if (focused) Ntv.Ink2 else Ntv.Fg
        Txt(slot.seriesName, 12.sp, ink, weight = FontWeight.SemiBold, lines = 1)
        Txt(listOf(episodeCode(slot.seasonNumber, slot.episodeNumber, slot.episodeType, slot.part), slot.title.takeIf { it != slot.seriesName })
            .filter { !it.isNullOrBlank() }.joinToString(" · "), 9.sp, ink.copy(alpha = .8f), font = Mono, lines = 1)
    }
}

// ── Series (buscar y filtrar) ──

@Composable
private fun TvCatalog(model: AppViewModel, state: AppState) {
    var query by rememberSaveable { mutableStateOf(state.seriesFilter.name) }
    val chips = remember(state.categories) {
        listOf("Todas" to SeriesFilter()) + state.categories.take(3).map { it.name to SeriesFilter(categoryId = it.id) } +
            listOf("80s" to SeriesFilter(decade = 1980), "90s" to SeriesFilter(decade = 1990), "Al aire" to SeriesFilter(onAirToday = true))
    }
    val active = chips.firstOrNull { it.second.copy(name = "") == state.seriesFilter.copy(name = "") }?.first ?: "Todas"
    Column(Modifier.fillMaxSize().padding(horizontal = 48.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        TvHeader(model, state, logo = false)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TvSearchField(query, { query = it }, { model.filterSeries(state.seriesFilter.copy(name = query)) })
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for ((label, filter) in chips) TvChip(label, active == label, { model.filterSeries(filter.copy(name = query)) })
            }
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Txt(if (active == "Todas") "Todas las series" else active, 15.sp, font = Display, weight = FontWeight.SemiBold)
            Txt("${state.totalSeries} series · ordenadas de la A a la Z", 11.sp, Ntv.Muted)
        }
        when {
            state.loading && state.series.isEmpty() -> Notice("Buscando series…")
            state.error != null && state.series.isEmpty() -> Notice(state.error, action = "Volver a intentar", onAction = { model.seriesPage(1) })
            state.series.isEmpty() -> Notice("Ninguna serie coincide.")
            else -> LazyVerticalGrid(GridCells.Fixed(6), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(6.dp)) {
                itemsIndexed(state.series, key = { _, series -> series.id }) { index, series ->
                    if (index >= state.series.size - 6 && state.series.size < state.totalSeries && !state.loading)
                        LaunchedEffect(state.series.size) { model.seriesPage(state.seriesPage + 1) }
                    val shape = RoundedCornerShape(8.dp)
                    Column(Modifier.focusRing(shape, { model.navigate(Screen.SeriesInfo(series.id)) }, ring = Ntv.Amber, scale = 1.05f),
                        verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Poster(series.name, imageUrl(model, series.logoPath), Modifier.fillMaxWidth().aspectRatio(2f / 3f), 8.dp, 13.sp, series.onAir)
                        Txt(years(series.startYear, series.endYear), 9.sp, Ntv.Muted, font = Mono, lines = 1)
                    }
                }
            }
        }
    }
}

@Composable
private fun TvSearchField(value: String, onChange: (String) -> Unit, onSearch: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val shape = RoundedCornerShape(50)
    Row(Modifier.width(280.dp).height(36.dp).background(Ntv.Panel2, shape)
        .then(if (focused) Modifier.border(2.dp, Ntv.Cream, shape) else Modifier).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(NtvIcon.Search, 15.dp, Ntv.Muted)
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Txt("Buscar por nombre", 11.sp, Ntv.Muted, weight = FontWeight.Medium, lines = 1)
            BasicTextField(value, { onChange(it.take(100)) }, Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused }.dpadLeavesField(focus) { value.isEmpty() },
                singleLine = true, textStyle = TextStyle(color = Ntv.Fg, fontSize = 11.sp, fontFamily = Sans), cursorBrush = SolidColor(Ntv.Amber),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { onSearch() }))
        }
        Icon(NtvIcon.Mic, 14.dp, Ntv.Muted)
    }
}

// ── Detalle de serie ──

@Composable
private fun TvSeries(model: AppViewModel, state: AppState) {
    val series = state.seriesDetail
    if (series == null) {
        Box(Modifier.fillMaxSize().padding(48.dp)) {
            if (state.error != null) Notice(state.error, action = "Volver", onAction = { model.back() }) else Notice("Cargando la serie…")
        }
        return
    }
    val progress = remember(state.session) { state.session?.progress.orEmpty().associateBy { it.episodeId } }
    val resume = model.resumeEpisode()
    val seasons = remember(state.episodes) { state.episodes.map { it.season }.distinct().sortedWith(compareBy<Int> { it != 0 }.thenBy { it }) }
    val play = remember { FocusRequester() }
    LaunchedEffect(series.id) { delay(50); runCatching { play.requestFocus() } }
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.align(Alignment.TopEnd).width(550.dp).height(340.dp).crtGlow(x = .65f)) {
            imageUrl(model, series.logoPath)?.let { AsyncImage(it, null, Modifier.align(Alignment.Center).fillMaxSize(.45f).alpha(.55f), contentScale = ContentScale.Fit) }
            Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(0f to Ntv.Ink2, .4f to Color.Transparent)))
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(.55f to Color.Transparent, 1f to Ntv.Ink2)))
        }
        Column(Modifier.fillMaxSize().padding(start = 48.dp, end = 48.dp, top = 24.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Txt("◀ Series", 11.sp, Ntv.Muted, font = Mono)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Txt(listOfNotNull(years(series.startYear, series.endYear).takeIf { it.isNotEmpty() },
                    seasons.count { it > 0 }.takeIf { it > 0 }?.let { "$it TEMPORADA${if (it == 1) "" else "S"}" },
                    series.rating?.let { "★ %.1f".format(it) }).joinToString(" · ").uppercase(), 11.sp, Ntv.Amber, font = Mono, tracking = tracking(.1f))
                Txt(series.name, 48.sp, modifier = Modifier.widthIn(max = 520.dp), font = Display, weight = FontWeight.Bold, lineHeight = 48.sp, lines = 2)
                if (series.categories.isNotEmpty()) Txt(series.categories.joinToString(" · "), 12.sp, Ntv.Fg2)
                series.description?.let { Txt(it, 13.sp, Ntv.Fg2, Modifier.widthIn(max = 460.dp), lineHeight = 19.5.sp, lines = 2) }
                Row(Modifier.padding(top = 5.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (resume != null) {
                        val started = progress[resume.id]?.let { !it.completed && it.currentSecond > 0 } == true
                        TvPill("${if (started) "Continuar" else "Reproducir"} ${episodeCode(resume.season, resume.episodeNumber, resume.episodeType, resume.part)}",
                            { model.playEpisode(resume) }, Modifier.focusRequester(play), primary = true, icon = NtvIcon.Play)
                    }
                    series.onAir.firstOrNull()?.let { (channelId, _) ->
                        TvPill("Sintonizar CH ${channelId.toString().padStart(2, '0')} (al aire)", { model.playChannel(channelId) })
                    }
                    TvPill("Próximas emisiones", { model.navigate(Screen.Guide) })
                }
            }
            Spacer(Modifier.weight(1f))
            if (state.episodes.isEmpty()) Notice("Esta serie todavía no tiene episodios disponibles.")
            else Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (season in seasons) {
                        val selected = season == state.season
                        val shape = RoundedCornerShape(50)
                        Box(Modifier.focusRing(shape, { model.season(season) }).height(30.dp)
                            .background(if (selected) Ntv.Fg else Color.Transparent, shape).padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
                            Txt(if (season == 0) "Especiales" else "T$season", 11.sp, if (selected) Ntv.Ink2 else Ntv.Muted, weight = FontWeight.SemiBold)
                        }
                    }
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp), contentPadding = PaddingValues(6.dp)) {
                    items(state.episodes.filter { it.season == state.season }, key = { it.id }) { episode ->
                        val item = progress[episode.id]
                        val shape = RoundedCornerShape(6.dp)
                        Column(Modifier.width(162.dp).focusRing(shape, { model.playEpisode(episode) }, ring = Ntv.Amber),
                            verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            EpisodeThumb(if (episode.season == 0) episode.episodeType.uppercase() else "E${episode.episodeNumber}${episode.part.orEmpty()}",
                                if (item?.completed == true) 1f else 0f, Modifier.fillMaxWidth(), 9.sp)
                            Txt(episode.title, 11.sp, weight = FontWeight.SemiBold, lines = 1)
                            val (label, color) = episodeState(item)
                            Txt(label, 8.5.sp, color, font = Mono, lines = 1)
                        }
                    }
                }
            }
        }
    }
}

fun episodeState(item: WatchProgress?): Pair<String, Color> = when {
    item?.completed == true -> "✓ VISTO" to Ntv.Ok
    item != null && item.currentSecond > 0 -> "EN CURSO · ${playTime((item.currentSecond * 1000).toLong())}" to Ntv.Amber
    else -> "SIN VER" to Ntv.Muted
}

fun years(start: Int?, end: Int?): String = when {
    start == null -> ""
    end == null -> "$start –"
    end == start -> "$start"
    else -> "$start–$end"
}

fun playTime(milliseconds: Long): String = "%d:%02d".format(milliseconds / 60000, milliseconds / 1000 % 60)

// ── Detalle de canal ──

@Composable
private fun TvChannel(model: AppViewModel, state: AppState) {
    val channel = state.channelDetail
    if (channel == null) {
        Box(Modifier.fillMaxSize().padding(48.dp)) {
            if (state.error != null) Notice(state.error, action = "Volver", onAction = { model.back() }) else Notice("Cargando el canal…")
        }
        return
    }
    val card = state.channels.firstOrNull { it.id == channel.id }
    val active = channel.eras.firstOrNull { it.isActive }
    val tune = remember { FocusRequester() }
    LaunchedEffect(channel.id) { delay(50); runCatching { tune.requestFocus() } }
    Column(Modifier.fillMaxSize().padding(start = 48.dp, end = 48.dp, top = 32.dp, bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Txt("◀ Canales", 11.sp, Ntv.Muted, font = Mono)
        Row(horizontalArrangement = Arrangement.spacedBy(32.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Box(Modifier.size(90.dp).background(Ntv.Panel2, RoundedCornerShape(14.dp)).border(1.dp, Ntv.Edge, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center) { ChannelNumber(channel.id.toString().padStart(2, '0'), 44.sp) }
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            if (card?.now != null) LiveBadge(size = 10.sp)
                            active?.let { Txt("ERA: ${it.name.uppercase()}", 10.sp, Ntv.Amber, font = Mono, tracking = tracking(.1f), lines = 1) }
                        }
                        Txt(channel.name, 42.sp, font = Display, weight = FontWeight.Bold, lineHeight = 42.sp, lines = 2)
                    }
                }
                channel.history?.let { Txt(it, 13.sp, Ntv.Fg2, Modifier.widthIn(max = 490.dp), lineHeight = 19.5.sp, lines = 4) }
                Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    TvPill("Sintonizar canal", { model.playChannel(channel.id) }, Modifier.focusRequester(tune), primary = true, icon = NtvIcon.Play)
                    TvPill("Guía del canal", { model.navigate(Screen.Guide) })
                }
            }
            Column(Modifier.width(280.dp).background(Ntv.Panel2, RoundedCornerShape(11.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Txt("Ahora y después", 14.sp, font = Display, weight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))
                if (channel.upcoming.isEmpty()) Txt("Sin programación próxima.", 11.sp, Ntv.Muted)
                for (slot in channel.upcoming.take(4)) {
                    Row(Modifier.fillMaxWidth().topLine(Ntv.Line).padding(vertical = 7.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Txt(clock(slot.startsAt), 11.sp, if (slot.isNow) Ntv.Danger else Ntv.Fg, Modifier.width(40.dp), font = Mono)
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Txt(slot.seriesName, 12.sp, weight = FontWeight.SemiBold, lines = 1)
                            Txt(listOfNotNull(episodeCode(slot.seasonNumber, slot.episodeNumber, slot.episodeType, slot.part).ifEmpty { null },
                                "ahora".takeIf { slot.isNow }).joinToString(" · "), 9.sp, Ntv.Muted, lines = 1)
                        }
                    }
                }
            }
        }
        Spacer(Modifier.weight(1f))
        if (channel.eras.isNotEmpty()) Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Txt("Eras del canal", 15.sp, font = Display, weight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                for (era in channel.eras.take(4)) {
                    val shape = RoundedCornerShape(9.dp)
                    val ink = if (era.isActive) Ntv.OnAmber else Ntv.Fg
                    Column(Modifier.weight(1f).background(if (era.isActive) Ntv.Amber else Ntv.Panel2, shape)
                        .then(if (era.isActive) Modifier else Modifier.border(1.dp, Ntv.Line, shape)).padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Txt(years(era.startYear, era.endYear), 9.sp, ink.copy(alpha = .85f), font = Mono)
                        Txt(era.name, 13.sp, ink, weight = FontWeight.Bold, lines = 1)
                        Txt("${era.series.size} serie${if (era.series.size == 1) "" else "s"}${if (era.isActive) " · al aire" else ""}", 9.sp, ink.copy(alpha = .85f))
                    }
                }
            }
        }
    }
}

// ── Perfil y ajustes ──

private data class SettingRow(val label: String, val hint: String, val value: String = "", val kind: String = "", val action: (() -> Unit)? = null)

@Composable
private fun TvSettings(model: AppViewModel, state: AppState) {
    val preferences by model.preferences.collectAsState()
    val video by model.videoSettings.collectAsState()
    var section by rememberSaveable { mutableIntStateOf(0) }
    var confirm by remember { mutableStateOf<String?>(null) }
    val session = state.session
    val yes = { on: Boolean -> if (on) "SÍ" else "NO" }
    val sections = listOf(
        "Perfil" to listOf(
            SettingRow("Usuario", if (session?.accountLinked == true) "Cuenta de espectador" else "Perfil sin cuenta en este TV",
                session?.username ?: "Invitado"),
            SettingRow("Historial de visualización", "${session?.progress?.count { it.completed } ?: 0} episodios vistos · se sincroniza con la web",
                "${session?.progress?.size ?: 0}"),
            SettingRow("Borrar historial", if (confirm == "history") "Pulsa OK otra vez para borrar todo el progreso" else "Elimina el progreso de todas las series",
                "›", "danger") { if (confirm == "history") { confirm = null; model.clearHistory() } else confirm = "history" },
            SettingRow("Cerrar sesión en este TV", if (confirm == "logout") "Pulsa OK otra vez para cerrar la sesión" else "Tendrás que vincularlo de nuevo",
                "›", "danger") { if (confirm == "logout") model.logout() else confirm = "logout" },
        ),
        "Reproducción" to listOf(
            SettingRow("Iniciar en el último canal", "Al abrir la app sintoniza el último canal visto", yes(preferences.startOnLastChannel),
                if (preferences.startOnLastChannel) "on" else "") { model.updatePreferences(preferences.copy(startOnLastChannel = !preferences.startOnLastChannel)) },
            SettingRow("Mostrar número al cambiar de canal", "Número verde estilo TV de tubo", yes(preferences.showChannelNumber),
                if (preferences.showChannelNumber) "on" else "") { model.updatePreferences(preferences.copy(showChannelNumber = !preferences.showChannelNumber)) },
            SettingRow("Efectos de temporada", "Halloween y Navidad en pantalla", yes(preferences.seasonalEffects),
                if (preferences.seasonalEffects) "on" else "") { model.updatePreferences(preferences.copy(seasonalEffects = !preferences.seasonalEffects)) },
        ),
        "Imagen" to listOf(
            SettingRow("Efecto CRT", "Líneas de barrido sobre el video", yes(video.enabled), if (video.enabled) "on" else "") {
                model.updateVideoSettings(video.copy(enabled = !video.enabled)) },
            SettingRow("Curvatura", "Bordes como pantalla de tubo", yes(video.curvature), if (video.curvature) "on" else "") {
                model.updateVideoSettings(video.copy(curvature = !video.curvature)) },
            SettingRow("Oscurecer bordes", "Viñeta alrededor de la imagen", yes(video.vignette), if (video.vignette) "on" else "") {
                model.updateVideoSettings(video.copy(vignette = !video.vignette)) },
            SettingRow("Intensidad de líneas", "OK para cambiar", "${video.intensity}%") {
                model.updateVideoSettings(video.copy(intensity = (video.intensity + 25) % 125)) },
        ),
        "Dispositivo" to listOf(
            SettingRow("Nombre", "Así aparece en Mis dispositivos", model.deviceName()),
            SettingRow("Dispositivos del perfil", "TV, teléfonos y navegadores vinculados", "${session?.deviceCount ?: 1}"),
            SettingRow("Desvincular este TV", if (confirm == "unlink") "Pulsa OK otra vez para desvincular" else "Cierra la sesión y borra el código",
                "›", "danger") { if (confirm == "unlink") model.logout() else confirm = "unlink" },
        ),
        "Acerca de" to listOf(
            SettingRow("Versión de la app", "Android TV", BuildConfig.VERSION_NAME),
            SettingRow("Servidor", "Donde está tu NostalgiaTV", state.serverAddress.removePrefix("https://").trimEnd('/')),
            SettingRow("Cambiar servidor", if (confirm == "server") "Pulsa OK otra vez para elegir otro servidor" else "Detiene la reproducción y vuelve al inicio",
                "›") { if (confirm == "server") model.chooseServer() else confirm = "server" },
        ),
    )
    val first = remember { FocusRequester() }
    LaunchedEffect(Unit) { delay(50); runCatching { first.requestFocus() } }
    Row(Modifier.fillMaxSize().padding(horizontal = 48.dp, vertical = 32.dp), horizontalArrangement = Arrangement.spacedBy(32.dp)) {
        Column(Modifier.width(260.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(Modifier.padding(bottom = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Avatar(session?.username, 44.dp, 17.sp)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Txt(session?.username ?: "Invitado", 20.sp, font = Display, weight = FontWeight.Bold, lines = 1)
                    Txt(model.deviceName(), 10.sp, Ntv.Muted, lines = 1)
                }
            }
            sections.forEachIndexed { index, (label, _) ->
                val selected = index == section
                val shape = RoundedCornerShape(50)
                Row(Modifier.fillMaxWidth().then(if (index == 0) Modifier.focusRequester(first) else Modifier)
                    .focusRing(shape, { section = index; confirm = null }, ring = Ntv.Amber, scale = 1f, onFocus = { section = index; confirm = null })
                    .height(40.dp).background(if (selected) Ntv.Fg else Color.Transparent, shape).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Txt(label, 13.sp, if (selected) Ntv.Ink2 else Ntv.Fg2, weight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Txt("›", 13.sp, (if (selected) Ntv.Ink2 else Ntv.Fg2).copy(alpha = .6f))
                }
            }
        }
        Column(Modifier.weight(1f).fillMaxHeight().background(Ntv.Panel2, RoundedCornerShape(14.dp)).padding(horizontal = 24.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Txt(sections[section].first, 24.sp, font = Display, weight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))
            state.profileError?.let { Txt(it, 11.sp, Ntv.Danger) }
            for (row in sections[section].second) SettingLine(row)
        }
    }
}

@Composable
private fun SettingLine(row: SettingRow) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(9.dp)
    val base = Modifier.fillMaxWidth().heightIn(min = 52.dp).onFocusChanged { focused = it.isFocused }
    Row((if (row.action != null) base.focusRing(shape, row.action, scale = 1f, ring = Color.Transparent) else base)
        .background(if (focused) Ntv.Raised2 else Color.Transparent, shape).then(if (focused) Modifier.border(1.dp, Ntv.Edge, shape) else Modifier)
        .padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Txt(row.label, 13.sp, if (row.kind == "danger") Ntv.Danger else Ntv.Fg, weight = FontWeight.SemiBold)
            Txt(row.hint, 9.5.sp, Ntv.Muted)
        }
        Txt(row.value, 11.sp, if (row.kind == "on") Ntv.Ok else Ntv.Fg2, font = Mono, lines = 1)
    }
}
