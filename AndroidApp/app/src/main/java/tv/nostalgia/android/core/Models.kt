package tv.nostalgia.android.core

data class Channel(val id: Int, val name: String, val logoPath: String?)
data class Series(val id: Int, val name: String, val logoPath: String?, val episodeCount: Int)
data class Episode(val id: Int, val title: String, val filePath: String, val season: Int, val episodeNumber: Int)
data class SeriesPage(val items: List<Series>, val totalCount: Int)
data class Category(val id: Int, val name: String)
data class SeriesFilter(val name: String = "", val channelId: Int? = null, val categoryId: Int? = null)
data class ScheduleEntry(val id: Long, val title: String, val episodeTitle: String, val startsAt: Long, val endsAt: Long)
data class ChannelState(
    val segmentId: Long, val episodeId: Int, val title: String, val seriesName: String,
    val filePath: String, val currentSecond: Double, val secondsUntilNext: Double,
    val isBumper: Boolean,
    val seriesId: Int = 0,
)
data class WatchProgress(val episodeId: Int, val currentSecond: Double, val completed: Boolean, val seriesId: Int = 0)
data class ViewerSession(val profileId: String, val deviceCount: Int, val progress: List<WatchProgress>)
data class PairingCode(val code: String, val expiresAtUtc: String)
data class Playback(
    val title: String, val subtitle: String, val filePath: String,
    val episodeId: Int, val startSecond: Double = 0.0,
    val channel: Channel? = null, val segmentId: Long = 0,
    val secondsUntilNext: Double = 10.0,
    val seriesName: String = "", val logoPath: String? = null, val seriesId: Int = 0,
)

fun List<Episode>.inBroadcastOrder(): List<Episode> =
    sortedWith(compareBy<Episode> { it.season }.thenBy { it.episodeNumber }.thenBy { it.id })
