package tv.nostalgia.android.core

/** What a channel is airing now (null when the channel is off the air). */
data class NowPlaying(val kind: String, val seriesId: Int?, val seriesName: String?, val title: String,
    val seasonNumber: Int?, val episodeNumber: Int?, val startsAt: Long, val endsAt: Long, val progress: Float, val part: String? = null) {
    val isEpisode get() = kind == "Episode"
}

/** One program of the guide: an episode block with its bumpers and ads. */
data class GuideSlot(val programId: Long, val episodeId: Int, val seriesId: Int, val seriesName: String, val title: String,
    val seasonNumber: Int, val episodeNumber: Int, val episodeType: String, val isSpecial: Boolean, val isNow: Boolean,
    val startsAt: Long, val endsAt: Long, val part: String? = null)

data class GuideRow(val channelId: Int, val channelName: String, val logoPath: String?, val slots: List<GuideSlot>)

data class Channel(val id: Int, val name: String, val logoPath: String?, val eraName: String? = null, val onAir: Boolean = false,
    val categories: List<String> = emptyList(), val now: NowPlaying? = null, val next: GuideSlot? = null) {
    /** Channels have no dial number in the catalog; the id is stable and short enough to show as one. */
    val number get() = id.toString().padStart(2, '0')
}

data class EraSeries(val seriesId: Int, val name: String, val logoPath: String?)
data class ChannelEra(val id: Int, val name: String, val description: String?, val startYear: Int?, val endYear: Int?,
    val isActive: Boolean, val series: List<EraSeries>)
data class ChannelDetail(val id: Int, val name: String, val history: String?, val logoPath: String?, val activeEraId: Int?,
    val eras: List<ChannelEra>, val upcoming: List<GuideSlot>, val commentCount: Int)

data class Comment(val id: Long, val author: String, val body: String, val createdAt: Long)

data class Series(val id: Int, val name: String, val logoPath: String?, val episodeCount: Int, val startYear: Int? = null,
    val endYear: Int? = null, val rating: Float? = null, val categories: List<String> = emptyList(), val onAir: Boolean = false)
data class SeriesDetail(val id: Int, val name: String, val description: String?, val logoPath: String?, val startYear: Int?,
    val endYear: Int?, val rating: Float?, val categories: List<String>, val seasons: List<Int>, val onAir: List<Pair<Int, String>>)
/** [part] is the segment letter of a split episode ("A", "B"…); null for a complete episode. */
data class Episode(val id: Int, val title: String, val filePath: String, val season: Int, val episodeNumber: Int,
    val episodeType: String = "Episodio", val part: String? = null)
data class SeriesPage(val items: List<Series>, val totalCount: Int)
data class Category(val id: Int, val name: String)
data class SeriesFilter(val name: String = "", val channelId: Int? = null, val categoryId: Int? = null, val decade: Int? = null,
    val onAirToday: Boolean = false, val sort: String = "name")
data class ScheduleEntry(val id: Long, val title: String, val episodeTitle: String, val startsAt: Long, val endsAt: Long)
data class ChannelState(
    val segmentId: Long, val episodeId: Int, val title: String, val seriesName: String,
    val filePath: String, val currentSecond: Double, val secondsUntilNext: Double,
    val isBumper: Boolean,
    val seriesId: Int = 0,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val nextTitle: String? = null,
    val startsAt: Long = 0,
    val endsAt: Long = 0,
    val part: String? = null,
)
data class WatchProgress(val episodeId: Int, val currentSecond: Double, val completed: Boolean, val seriesId: Int = 0,
    val seriesName: String = "", val episodeTitle: String = "", val seasonNumber: Int = 0, val episodeNumber: Int = 0, val updatedAt: Long = 0,
    val part: String? = null)
data class ViewerDevice(val id: String, val name: String, val lastSeen: Long, val current: Boolean)
data class ViewerSession(val profileId: String, val deviceCount: Int, val progress: List<WatchProgress>,
    val currentDeviceId: String? = null, val accountLinked: Boolean = false, val username: String? = null,
    val devices: List<ViewerDevice> = emptyList())
data class PairingCode(val code: String, val expiresAtUtc: String)
data class AuthorizationCode(val deviceCode: String, val userCode: String, val expiresAtUtc: String, val interval: Int)
data class ServerFeatures(val registrationEnabled: Boolean, val googleEnabled: Boolean)
/**
 * Public theming: the platform's current season (AllYear, Halloween or Christmas). [timeZoneId] is the platform's
 * zone: the guide's "day" is a calendar day there, not on the device.
 */
/** Public platform settings; seasonalEffects is the admin switch for on-screen Halloween and Christmas effects. */
data class PublicSettings(val season: String, val seasonalThemes: Boolean, val timeZoneId: String? = null, val seasonalEffects: Boolean = false)
data class Playback(
    val title: String, val subtitle: String, val filePath: String,
    val episodeId: Int, val startSecond: Double = 0.0,
    val channel: Channel? = null, val segmentId: Long = 0,
    val secondsUntilNext: Double = 10.0,
    val seriesName: String = "", val logoPath: String? = null, val seriesId: Int = 0,
    val seasonNumber: Int? = null, val episodeNumber: Int? = null, val nextTitle: String? = null,
    val startsAt: Long = 0, val endsAt: Long = 0, val isBumper: Boolean = false, val part: String? = null,
)

fun List<Episode>.inBroadcastOrder(): List<Episode> =
    sortedWith(compareBy<Episode> { it.season }.thenBy { it.episodeNumber }.thenBy { it.part ?: "" }.thenBy { it.id })

/** "T2 · E14" ("T2 · E5A" for part A of a split episode); specials and movies use their type name. */
fun episodeCode(season: Int?, episode: Int?, type: String? = null, part: String? = null): String = when {
    type != null && type != "Episodio" -> if (part != null) "$type $part" else type
    season == null || episode == null -> ""
    season == 0 -> "Especial"
    else -> "T$season · E$episode${part.orEmpty()}"
}
