package tv.nostalgia.android.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ApiException(val status: Int) : IOException("HTTP $status")

class NostalgiaApi(val base: HttpUrl, private val client: OkHttpClient, private val cookies: ViewerCookies? = null) {
    suspend fun verifyServer(): ServerFeatures {
        val info = json("server")
        require(info.optString("product") == "NostalgiaTV" && info.optInt("deviceAuthorizationVersion") == 1) { "Unsupported server" }
        return ServerFeatures(info.optBoolean("registrationEnabled"), info.optBoolean("googleEnabled"))
    }

    suspend fun loginViewer(username: String, password: String, name: String): ViewerSession {
        var authenticated = false
        try {
            request("auth/token", JSONObject().put("username", username).put("password", password).put("rememberMe", false))
            authenticated = true
            return startViewer(name)
        } finally {
            try { if (authenticated) request("auth/revoke", JSONObject()) }
            catch (_: IOException) { /* Administrative cookies are never retained by the player. */ }
            finally { cookies?.clearAuthentication() }
        }
    }

    suspend fun authorizeDevice(name: String): AuthorizationCode {
        val result = json("viewer/authorization", JSONObject().put("name", name))
        return AuthorizationCode(result.getString("deviceCode"), result.getString("userCode"),
            result.getString("expiresAtUtc"), result.getInt("intervalSeconds"))
    }

    suspend fun redeemDevice(code: String): Boolean =
        json("viewer/authorization/redeem", JSONObject().put("deviceCode", code)).getString("status") == "connected"

    suspend fun channels(): List<Channel> = array("public/channels").objects().map(::parseChannel)

    suspend fun publicSettings(): PublicSettings {
        val result = json("public/settings")
        return PublicSettings(result.optString("season", "AllYear"), result.optBoolean("seasonalThemesEnabled"), result.nullableString("timeZoneId"),
            result.optBoolean("seasonalEffectsEnabled"))
    }

    suspend fun channelDetail(channelId: Int): ChannelDetail {
        val it = json("public/channels/$channelId")
        return ChannelDetail(it.getInt("id"), it.getString("name"), it.nullableString("history"), it.nullableString("logoPath"),
            if (it.isNull("activeEraId")) null else it.optInt("activeEraId"),
            it.optJSONArray("eras").objects().map { era ->
                ChannelEra(era.getInt("id"), era.getString("name"), era.nullableString("description"),
                    era.nullableString("historicalStartDate")?.take(4)?.toIntOrNull(), era.nullableString("historicalEndDate")?.take(4)?.toIntOrNull(),
                    era.optBoolean("isActive"), era.optJSONArray("series").objects().map { series ->
                        EraSeries(series.getInt("seriesId"), series.getString("name"), series.nullableString("logoPath"))
                    })
            }, it.optJSONArray("upcoming").objects().map(::parseSlot), it.optInt("commentCount"))
    }

    /** The full-day guide of one local day (yyyy-MM-dd), optionally for a single channel. */
    suspend fun guide(day: String, channelId: Int? = null): List<GuideRow> {
        val query = base.newBuilder().addQueryParameter("day", day)
        channelId?.let { query.addQueryParameter("channelId", it.toString()) }
        return array("public/guide?${query.build().encodedQuery}").objects().map {
            GuideRow(it.getInt("channelId"), it.getString("channelName"), it.nullableString("logoPath"),
                it.optJSONArray("slots").objects().map(::parseSlot).sortedBy { slot -> slot.startsAt })
        }
    }

    /** Approved comments of a channel, oldest first. */
    suspend fun channelComments(channelId: Int): List<Comment> =
        json("channels/$channelId/comments").optJSONArray("items").objects().map {
            Comment(it.getLong("id"), it.optString("author"), it.optString("body"), utcMillis(it.getString("createdAtUtc")))
        }

    suspend fun categories(): List<Category> = array("public/categories").objects().map { Category(it.getInt("id"), it.getString("name")) }

    suspend fun series(page: Int, filter: SeriesFilter = SeriesFilter()): SeriesPage {
        val query = base.newBuilder().addQueryParameter("Page", page.toString()).addQueryParameter("PageSize", "24")
        if (filter.name.isNotBlank()) query.addQueryParameter("Search", filter.name.trim())
        filter.channelId?.let { query.addQueryParameter("ChannelId", it.toString()) }
        filter.categoryId?.let { query.addQueryParameter("CategoryIds", it.toString()) }
        filter.decade?.let { query.addQueryParameter("Decade", it.toString()) }
        if (filter.onAirToday) query.addQueryParameter("OnAirToday", "true")
        if (filter.sort != "name") query.addQueryParameter("Sort", filter.sort)
        val result = json("public/series?${query.build().encodedQuery}")
        return SeriesPage(result.getJSONArray("items").objects().map {
            Series(it.getInt("id"), it.getString("name"), it.nullableString("logoPath"), it.optInt("episodeCount"),
                it.nullableInt("startYear"), it.nullableInt("endYear"), it.nullableFloat("rating"), it.optJSONArray("categories").strings(),
                (it.optJSONArray("onAir")?.length() ?: 0) > 0)
        }, result.getInt("totalCount"))
    }

    suspend fun seriesDetail(seriesId: Int): SeriesDetail {
        val it = json("public/series/$seriesId")
        return SeriesDetail(it.getInt("id"), it.getString("name"), it.nullableString("description"), it.nullableString("logoPath"),
            it.nullableString("startDate")?.take(4)?.toIntOrNull(), it.nullableString("endDate")?.take(4)?.toIntOrNull(),
            it.nullableFloat("rating"), it.optJSONArray("categories").strings(),
            it.optJSONArray("seasons").let { seasons -> (0 until (seasons?.length() ?: 0)).map { index -> seasons!!.getInt(index) } },
            it.optJSONArray("onAir").objects().map { channel -> channel.getInt("channelId") to channel.getString("channelName") })
    }

    /** Upcoming program blocks (an episode plus the bumpers and ads inside it). */
    suspend fun schedule(channelId: Int): List<ScheduleEntry> = array("public/channels/$channelId/programs").objects().map {
        ScheduleEntry(it.getLong("id"), it.optString("seriesName"), it.optString("title"),
            utcMillis(it.getString("startsAtUtc")), utcMillis(it.getString("endsAtUtc")))
    }.sortedBy { it.startsAt }

    suspend fun episodes(seriesId: Int): List<Episode> = array("public/series/$seriesId/episodes").objects()
        .filter { !it.nullableString("filePath").isNullOrBlank() }
        .map { Episode(it.getInt("id"), it.getString("title"), it.getString("filePath"),
            it.getInt("seasonNumber"), it.getInt("episodeNumber"), it.optString("episodeType", "Episodio"), it.nullableString("episodePart")) }.inBroadcastOrder()

    suspend fun channelState(channelId: Int): ChannelState {
        val result = json("public/channels/$channelId/state")
        // Bumpers and ads air between episode slices; only "Episode" segments carry an episode.
        val interlude = result.optString("kind", "Episode") != "Episode"
        return ChannelState(result.getLong("segmentId"), if (interlude) 0 else result.optInt("episodeId"),
            result.nullableString("title") ?: "Pausa del canal", result.nullableString("seriesName") ?: "", result.getString("filePath"),
            result.optDouble("currentSecond", 0.0), result.optDouble("secondsUntilNext", 10.0), interlude, result.optInt("seriesId"),
            result.nullableInt("seasonNumber"), result.nullableInt("episodeNumber"), result.nullableString("nextTitle"),
            result.nullableString("startsAtUtc")?.let(::utcMillis) ?: 0, result.nullableString("endsAtUtc")?.let(::utcMillis) ?: 0,
            result.nullableString("episodePart"))
    }

    suspend fun viewerSession(): ViewerSession = parseSession(json("viewer/session"))
    suspend fun startViewer(name: String): ViewerSession = parseSession(json("viewer/session", JSONObject().put("name", name)))
    suspend fun logoutViewer(id: String) { request("viewer/devices/$id", delete = true) }
    suspend fun clearHistory() { request("viewer/history", delete = true) }
    suspend fun pairingCode(): PairingCode {
        val result = json("viewer/code", JSONObject())
        return PairingCode(result.getString("code"), result.getString("expiresAtUtc"))
    }

    suspend fun progress(episodeId: Int, start: Double, end: Double, duration: Double): Boolean =
        json("viewer/progress", JSONObject().put("episodeId", episodeId).put("startSecond", start)
            .put("endSecond", end).put("duration", duration).put("currentSecond", end)).getBoolean("completed")

    private fun parseSession(result: JSONObject): ViewerSession {
        val devices = result.getJSONArray("devices").objects()
        return ViewerSession(result.getString("profileId"), devices.size, result.getJSONArray("progress").objects().map {
            WatchProgress(it.getInt("episodeId"), it.getDouble("currentSecond"), it.getBoolean("completed"), it.optInt("seriesId"),
                it.optString("seriesName"), it.optString("episodeTitle"), it.optInt("seasonNumber"), it.optInt("episodeNumber"),
                it.nullableString("updatedAtUtc")?.let(::utcMillis) ?: 0, it.nullableString("episodePart"))
        }, devices.firstOrNull { it.optBoolean("current") }?.getString("id"), result.optBoolean("accountLinked"),
            result.nullableString("username"), devices.map {
                ViewerDevice(it.getString("id"), it.optString("name"), it.nullableString("lastSeenUtc")?.let(::utcMillis) ?: 0, it.optBoolean("current"))
            })
    }

    private fun parseChannel(it: JSONObject) = Channel(it.getInt("id"), it.getString("name"), it.nullableString("logoPath"),
        it.nullableString("eraName"), it.optBoolean("onAir"), it.optJSONArray("categories").strings(),
        it.optJSONObject("now")?.let { now ->
            NowPlaying(now.optString("kind", "Episode"), now.nullableInt("seriesId"), now.nullableString("seriesName"), now.optString("title"),
                now.nullableInt("seasonNumber"), now.nullableInt("episodeNumber"), utcMillis(now.getString("startsAtUtc")),
                utcMillis(now.getString("endsAtUtc")), now.optDouble("progress", 0.0).toFloat().coerceIn(0f, 1f), now.nullableString("episodePart"))
        }, it.optJSONObject("next")?.let(::parseSlot))

    private fun parseSlot(it: JSONObject) = GuideSlot(it.getLong("programId"), it.getInt("episodeId"), it.getInt("seriesId"),
        it.optString("seriesName"), it.optString("title"), it.optInt("seasonNumber"), it.optInt("episodeNumber"),
        it.optString("episodeType", "Episodio"), it.optBoolean("isSpecial"), it.optBoolean("isNow"),
        utcMillis(it.getString("startsAtUtc")), utcMillis(it.getString("endsAtUtc")), it.nullableString("episodePart"))

    private suspend fun array(path: String) = withContext(Dispatchers.Default) { JSONArray(request(path)) }
    private suspend fun json(path: String, body: JSONObject? = null) =
        withContext(Dispatchers.Default) { JSONObject(request(path, body)) }

    private suspend fun request(path: String, body: JSONObject? = null, delete: Boolean = false): String = suspendCancellableCoroutine { continuation ->
        val url = requireNotNull(base.resolve("api/v1/$path"))
        val request = Request.Builder().url(url).header("Accept", "application/json")
            .header("User-Agent", "NostalgiaTV-AndroidTV/0.1")
        if (body != null) request.post(body.toString().toRequestBody("application/json".toMediaType()))
        if (delete) request.delete()
        val call = client.newCall(request.build())
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWithException(e)
            }
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!continuation.isActive) return
                    try {
                        if (!it.isSuccessful) throw ApiException(it.code)
                        continuation.resume(it.body.string())
                    } catch (exception: Exception) { continuation.resumeWithException(exception) }
                }
            }
        })
    }
}

private fun JSONObject.nullableString(key: String): String? = if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }
private fun JSONObject.nullableInt(key: String): Int? = if (!has(key) || isNull(key)) null else optInt(key)
private fun JSONObject.nullableFloat(key: String): Float? = if (!has(key) || isNull(key)) null else optDouble(key).toFloat()
private fun JSONArray?.objects(): List<JSONObject> = if (this == null) emptyList() else (0 until length()).map { getJSONObject(it) }
private fun JSONArray?.strings(): List<String> = if (this == null) emptyList() else (0 until length()).map { getString(it) }

private fun utcMillis(value: String): Long = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    .apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(value)?.time ?: throw IOException("Invalid schedule time")
