package tv.nostalgia.android.features

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import tv.nostalgia.android.core.*
import tv.nostalgia.android.shared.*
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@Composable
fun CatalogFilters(model: AppViewModel, state: AppState, onClose: () -> Unit) {
    var name by remember { mutableStateOf(state.seriesFilter.name) }
    var channelId by remember { mutableStateOf(state.seriesFilter.channelId) }
    var categoryId by remember { mutableStateOf(state.seriesFilter.categoryId) }
    RetroDialog("Filtros de la videoteca", onClose) {
        Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            androidx.compose.material3.TextField(name, { name = it.take(100) }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                label = { androidx.compose.material3.Text("¿Qué serie recuerdas?") })
            BoxWithConstraints {
                val channels: @Composable () -> Unit = {
                    Text("Canal", color = Retro.Cream, fontSize = 17.sp)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(4.dp)) {
                        item { CinemaButton("Todos los canales", { channelId = null }, selected = channelId == null) }
                        items(state.channels, key = { it.id }) { CinemaButton(it.name, { channelId = it.id }, selected = channelId == it.id) }
                    }
                }
                val categories: @Composable () -> Unit = {
                    Text("Categoría", color = Retro.Cream, fontSize = 17.sp)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(4.dp)) {
                        item { CinemaButton("Todas las categorías", { categoryId = null }, selected = categoryId == null) }
                        items(state.categories, key = { it.id }) { CinemaButton(it.name, { categoryId = it.id }, selected = categoryId == it.id) }
                    }
                }
                if (maxWidth >= 500.dp) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) { channels() }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) { categories() }
                } else Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    channels()
                    categories()
                }
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CinemaButton("Aplicar filtros", { model.filterSeries(SeriesFilter(name.trim(), channelId, categoryId)); onClose() })
            CinemaButton("Quitar filtros", { model.filterSeries(SeriesFilter()); onClose() })
        }
    }
}

@Composable
fun GuideScreen(model: AppViewModel, state: AppState, onClose: () -> Unit) {
    var day by remember { mutableIntStateOf(0) }
    var retry by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf(false) }
    var schedules by remember { mutableStateOf<Map<Int, List<ScheduleEntry>>>(emptyMap()) }
    LaunchedEffect(retry) {
        loading = true
        error = false
        try {
            schedules = coroutineScope { state.channels.map { channel -> async { channel.id to model.api.schedule(channel.id) } }.awaitAll().toMap() }
        } catch (exception: Exception) {
            if (exception is CancellationException) throw exception
            error = true
        } finally { loading = false }
    }
    val start = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0); add(Calendar.DATE, day) }.timeInMillis
    val end = Calendar.getInstance().apply { timeInMillis = start; add(Calendar.DATE, 1) }.timeInMillis
    val now = System.currentTimeMillis()
    RetroDialog(if (day == 0) "La programación de hoy." else "La programación de mañana.", onClose) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CinemaButton("Hoy", { day = 0 }, selected = day == 0)
            CinemaButton("Mañana", { day = 1 }, selected = day == 1)
        }
        Text("Horarios en tu hora local. Al elegir un programa sintonizas la señal actual.", color = Retro.Lavender, fontSize = 15.sp)
        when {
            loading -> Message("Sintonizando la programación…")
            error -> Message("No se pudo cargar la guía.", "Reintentar", { retry++ })
            else -> LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(4.dp)) {
                for (channel in state.channels) {
                    val entries = schedules[channel.id].orEmpty().filter { it.startsAt < end && it.endsAt > maxOf(start, if (day == 0) now else start) }
                    item(key = "channel-${channel.id}") { Text(channel.name, color = Retro.Gold, fontFamily = RetroDisplay, fontSize = 28.sp, modifier = Modifier.padding(top = 12.dp)) }
                    items(entries, key = { "${channel.id}-${it.id}" }) { entry ->
                        RetroSurface({ model.playChannel(channel); onClose() }, Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("${SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(entry.startsAt))}${if (entry.startsAt <= now && entry.endsAt > now) " · Ahora" else ""}", fontSize = 16.sp)
                                Text(entry.title, fontSize = 20.sp)
                                if (entry.episodeTitle != entry.title) Text(entry.episodeTitle, fontSize = 16.sp)
                            }
                        }
                    }
                    if (entries.isEmpty()) item(key = "empty-${channel.id}") { Text("No hay programación para este día.", color = Retro.Lavender, fontSize = 17.sp) }
                }
            }
        }
    }
}
