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
            result.getString("expiresAtUtc"), result.getInt("interval"))
    }

    suspend fun redeemDevice(code: String): Boolean =
        json("viewer/authorization/redeem", JSONObject().put("deviceCode", code)).getString("status") == "connected"

    suspend fun channels(): List<Channel> = array("public/channels").objects().map {
        Channel(it.getInt("id"), it.getString("name"), it.nullableString("logoPath"))
    }

    suspend fun categories(): List<Category> = array("public/categories").objects().map { Category(it.getInt("id"), it.getString("name")) }

    suspend fun series(page: Int, filter: SeriesFilter = SeriesFilter()): SeriesPage {
        val query = base.newBuilder().addQueryParameter("Page", page.toString()).addQueryParameter("PageSize", "24")
        if (filter.name.isNotBlank()) query.addQueryParameter("Name", filter.name.trim())
        filter.channelId?.let { query.addQueryParameter("ChannelId", it.toString()) }
        filter.categoryId?.let { query.addQueryParameter("CategoryId", it.toString()) }
        val result = json("public/series?${query.build().encodedQuery}")
        return SeriesPage(result.getJSONArray("items").objects().map {
            Series(it.getInt("id"), it.getString("name"), it.nullableString("logoPath"), it.optInt("episodeCount"))
        }, result.getInt("totalCount"))
    }

    suspend fun schedule(channelId: Int): List<ScheduleEntry> = array("public/channels/$channelId/schedule").objects().map {
        ScheduleEntry(it.getLong("id"), if (it.optBoolean("isBumper")) it.optString("bumperTitle", "Pausa del canal") else it.optString("seriesName"),
            it.optString("episodeTitle"), utcMillis(it.getString("startTime")), utcMillis(it.getString("endTime")))
    }.sortedBy { it.startsAt }

    suspend fun episodes(seriesId: Int): List<Episode> = array("public/series/$seriesId/episodes").objects()
        .filter { !it.nullableString("filePath").isNullOrBlank() }
        .map { Episode(it.getInt("id"), it.getString("title"), it.getString("filePath"),
            it.getInt("season"), it.getInt("episodeNumber")) }.inBroadcastOrder()

    suspend fun channelState(channelId: Int): ChannelState {
        val result = json("public/channels/$channelId/state")
        return ChannelState(result.getLong("segmentId"), result.optInt("episodeId"),
            if (result.optBoolean("isBumper")) result.nullableString("bumperTitle") ?: "Pausa del canal"
            else result.optString("episodeTitle"), result.optString("seriesName"), result.getString("filePath"),
            result.optDouble("currentSecond", 0.0), result.optDouble("secondsUntilNext", 10.0), result.optBoolean("isBumper"), result.optInt("seriesId"))
    }

    suspend fun viewerSession(): ViewerSession = parseSession(json("viewer/session"))
    suspend fun startViewer(name: String): ViewerSession = parseSession(json("viewer/session", JSONObject().put("name", name)))
    suspend fun logoutViewer(id: String) { request("viewer/devices/$id", delete = true) }
    suspend fun pairingCode(): PairingCode {
        val result = json("viewer/code", JSONObject())
        return PairingCode(result.getString("code"), result.getString("expiresAtUtc"))
    }

    suspend fun progress(episodeId: Int, start: Double, end: Double, duration: Double): Boolean =
        json("viewer/progress", JSONObject().put("episodeId", episodeId).put("startSecond", start)
            .put("endSecond", end).put("duration", duration).put("currentSecond", end)).getBoolean("completed")

    private fun parseSession(result: JSONObject) = ViewerSession(result.getString("profileId"),
        result.getJSONArray("devices").length(), result.getJSONArray("progress").objects().map {
            WatchProgress(it.getInt("episodeId"), it.getDouble("currentSecond"), it.getBoolean("completed"), it.optInt("seriesId"))
        }, result.getJSONArray("devices").objects().firstOrNull { it.optBoolean("current") }?.getString("id"), result.optBoolean("accountLinked"))

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
private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

private fun utcMillis(value: String): Long = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
    .apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(value)?.time ?: throw IOException("Invalid schedule time")
