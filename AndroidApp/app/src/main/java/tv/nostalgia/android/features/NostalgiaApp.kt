package tv.nostalgia.android.features

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.runtime.*
import androidx.compose.material3.NavigationBarItem
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.Text
import tv.nostalgia.android.core.*
import tv.nostalgia.android.shared.*

@Composable
fun NostalgiaApp(model: AppViewModel) {
    val state by model.state.collectAsStateWithLifecycle()
    val tv = LocalTvDevice.current
    BackHandler(state.playback != null || state.selectedSeries != null || state.section != Section.Channels) { model.back() }
    state.playback?.let { PlayerScreen(model, it); return }
    val navFocus = remember { FocusRequester() }
    LaunchedEffect(tv) { if (tv) navFocus.requestFocus() }
    Box(Modifier.fillMaxSize().background(Retro.Background)) {
        RoomBackground(Modifier.fillMaxSize())
        Column(Modifier.fillMaxSize().then(if (tv) Modifier else Modifier.safeDrawingPadding())) {
            Header(model, state, navFocus)
            BoxWithConstraints(Modifier.weight(1f).fillMaxWidth().padding(horizontal = if (tv) 32.dp else 16.dp)) {
                when {
                    state.section == Section.Profile -> ProfileScreen(model, state)
                    state.selectedSeries != null -> EpisodesScreen(model, state)
                    state.section == Section.Channels -> ChannelsScreen(model, state, tv || maxWidth >= 700.dp || (maxWidth >= 480.dp && maxWidth > maxHeight))
                    else -> SeriesScreen(model, state)
                }
            }
            if (!tv) MobileNavigation(model, state.section)
        }
    }
}

@Composable
private fun Header(model: AppViewModel, state: AppState, navFocus: FocusRequester) {
    val tv = LocalTvDevice.current
    Row(Modifier.fillMaxWidth().padding(horizontal = if (tv) 32.dp else 20.dp, vertical = if (tv) 20.dp else 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NavigationGlyph(Section.Channels, Retro.Mint, Modifier.size(30.dp))
            Text("NostalgiaTV", color = Retro.Cream, fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold, fontSize = if (tv) 25.sp else 22.sp)
        }
        if (tv) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            RetroButton("Canales", { model.section(Section.Channels) }, Modifier.focusRequester(navFocus), selected = state.section == Section.Channels)
            RetroButton("Series", { model.section(Section.Series) }, selected = state.section == Section.Series)
            RetroButton("Mi perfil", { model.section(Section.Profile) }, selected = state.section == Section.Profile)
        }
    }
}

@Composable
private fun MobileNavigation(model: AppViewModel, selected: Section) {
    androidx.compose.material3.NavigationBar(containerColor = Retro.Background, tonalElevation = 0.dp, windowInsets = WindowInsets(0)) {
        for ((section, label) in listOf(Section.Channels to "Canales", Section.Series to "Series", Section.Profile to "Mi perfil")) {
            NavigationBarItem(selected = selected == section, onClick = { model.section(section) },
                icon = { NavigationGlyph(section, if (selected == section) Retro.Background else Retro.Lavender, Modifier.size(24.dp)) },
                label = { Text(label, color = if (selected == section) Retro.Gold else Retro.Lavender, fontSize = 13.sp) },
                colors = androidx.compose.material3.NavigationBarItemDefaults.colors(indicatorColor = Retro.Gold))
        }
    }
}

@Composable
private fun NavigationGlyph(section: Section, color: Color, modifier: Modifier) {
    Canvas(modifier) {
        val stroke = Stroke(2.dp.toPx())
        when (section) {
            Section.Channels -> {
                drawRoundRect(color, Offset(size.width * .08f, size.height * .18f), Size(size.width * .84f, size.height * .65f), CornerRadius(4.dp.toPx()), style = stroke)
                drawLine(color, Offset(size.width * .35f, size.height * .96f), Offset(size.width * .65f, size.height * .96f), stroke.width)
                drawLine(color, Offset(size.width * .32f, 0f), Offset(size.width * .5f, size.height * .18f), stroke.width)
            }
            Section.Series -> {
                drawRoundRect(color, Offset(size.width * .08f, size.height * .18f), Size(size.width * .84f, size.height * .65f), CornerRadius(2.dp.toPx()), style = stroke)
                drawCircle(color, size.width * .14f, Offset(size.width * .32f, size.height * .5f), style = stroke)
                drawCircle(color, size.width * .14f, Offset(size.width * .68f, size.height * .5f), style = stroke)
            }
            Section.Profile -> {
                drawCircle(color, size.width * .18f, Offset(size.width * .5f, size.height * .28f), style = stroke)
                drawRoundRect(color, Offset(size.width * .16f, size.height * .57f), Size(size.width * .68f, size.height * .32f), CornerRadius(6.dp.toPx()), style = stroke)
            }
        }
    }
}

@Composable
private fun ChannelsScreen(model: AppViewModel, state: AppState, wide: Boolean) {
    if (wide) Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(28.dp)) {
        Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Las tardes no se olvidan.", color = Retro.Gold, fontFamily = FontFamily.Monospace, fontSize = 26.sp)
            RetroRoom(Modifier.weight(1f).fillMaxWidth())
        }
        Column(Modifier.weight(.95f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("¿Qué vemos hoy?", color = Retro.Cream, fontFamily = FontFamily.Monospace, fontSize = 26.sp)
            CatalogMessage(model, state, state.channels.isEmpty())
            LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(6.dp)) {
                items(state.channels, key = { it.id }) { ChannelRow(model, it) }
            }
        }
    } else LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 18.dp)) {
        item {
            Text("Las tardes no se olvidan.", color = Retro.Gold, fontFamily = FontFamily.Monospace, fontSize = 24.sp)
            RetroRoom(Modifier.fillMaxWidth().height(310.dp))
            Text("¿Qué vemos hoy?", color = Retro.Cream, fontFamily = FontFamily.Monospace, fontSize = 22.sp)
            CatalogMessage(model, state, state.channels.isEmpty())
        }
        items(state.channels, key = { it.id }) { ChannelRow(model, it) }
    }
}

@Composable
private fun ChannelRow(model: AppViewModel, channel: Channel) {
    val tv = LocalTvDevice.current
    BoxWithConstraints(Modifier.fillMaxWidth()) {
      val compact = maxWidth < 350.dp
      RetroSurface({ model.playChannel(channel) }, Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(if (tv) 14.dp else 12.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Logo(imageUrl(model, channel.logoPath), channel.name, Modifier.width(if (compact) 62.dp else if (tv) 100.dp else 76.dp).height(64.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(channel.name, fontWeight = FontWeight.Bold, fontSize = if (tv && !compact) 20.sp else 18.sp, maxLines = if (compact) 3 else 2, overflow = TextOverflow.Ellipsis)
                Text("● En vivo", fontSize = if (tv) 16.sp else 14.sp)
            }
            Text("▶", fontSize = 22.sp)
        }
      }
    }
}

@Composable
private fun SeriesScreen(model: AppViewModel, state: AppState) {
    val tv = LocalTvDevice.current
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Tu colección de recuerdos.", color = Retro.Gold, fontFamily = FontFamily.Monospace, fontSize = if (tv) 28.sp else 24.sp)
        CatalogMessage(model, state, state.series.isEmpty())
        LazyVerticalGrid(GridCells.Adaptive(if (tv) 200.dp else 154.dp), modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp), contentPadding = PaddingValues(6.dp)) {
            items(state.series, key = { it.id }) { series ->
                TapeCard(series.name, imageUrl(model, series.logoPath), "${series.episodeCount} episodios", { model.openSeries(series) })
            }
        }
        if (state.totalSeries > 24) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            RetroButton("Anterior", { model.seriesPage(state.seriesPage - 1) }, enabled = state.seriesPage > 1 && !state.loading)
            Text("${state.seriesPage}", color = Retro.Cream, fontSize = 17.sp)
            RetroButton("Siguiente", { model.seriesPage(state.seriesPage + 1) }, enabled = state.seriesPage * 24 < state.totalSeries && !state.loading)
        }
    }
}

@Composable
private fun CatalogMessage(model: AppViewModel, state: AppState, empty: Boolean) {
    if (state.loading) Message("Conectando…")
    state.error?.let { Message(it, "Volver a intentar", model::loadCatalog) }
    if (!state.loading && state.error == null && empty) Message("Todavía no hay contenido disponible.", "Actualizar", model::loadCatalog)
}

@Composable
private fun EpisodesScreen(model: AppViewModel, state: AppState) {
    val series = state.selectedSeries ?: return
    val tv = LocalTvDevice.current
    val progress = remember(state.session) { state.session?.progress?.associateBy { it.episodeId }.orEmpty() }
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        RetroButton("Volver a series", model::back)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Logo(imageUrl(model, series.logoPath), series.name, Modifier.size(if (tv) 82.dp else 64.dp))
            Column(Modifier.weight(1f)) {
                Text(series.name, color = Retro.Gold, fontSize = if (tv) 28.sp else 22.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text("${state.episodes.size} episodios disponibles", color = Retro.Lavender, fontSize = if (tv) 18.sp else 15.sp)
            }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(4.dp)) {
            item { RetroButton("Todas", { model.season(null) }, selected = state.season == null) }
            items(state.episodes.map { it.season }.distinct(), key = { it }) { season ->
                RetroButton("Temporada $season", { model.season(season) }, selected = state.season == season)
            }
        }
        if (state.episodes.isEmpty()) Message("Esta serie todavía no tiene episodios disponibles.")
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(6.dp)) {
            items(state.episodes.filter { state.season == null || it.season == state.season }, key = { it.id }) { episode ->
                RetroSurface({ model.playEpisode(episode) }, Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(48.dp)) {
                            Text("T${episode.season}", fontSize = 13.sp)
                            Text(episode.episodeNumber.toString().padStart(2, '0'), fontFamily = FontFamily.Monospace, fontSize = 24.sp)
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(episode.title, fontSize = if (tv) 20.sp else 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(when {
                                progress[episode.id]?.completed == true -> "✓ Visto"
                                (progress[episode.id]?.currentSecond ?: 0.0) > 0 -> "Continuar viendo"
                                else -> "T${episode.season} · E${episode.episodeNumber}"
                            }, fontSize = if (tv) 16.sp else 14.sp)
                        }
                        Text("▶", fontSize = 20.sp)
                    }
                }
            }
        }
    }
}

private fun imageUrl(model: AppViewModel, path: String?): String? = path?.let {
    runCatching { MediaUrls.resolve(model.api.base, it) }.getOrNull()
}
