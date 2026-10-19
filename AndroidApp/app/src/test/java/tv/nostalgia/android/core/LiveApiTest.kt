package tv.nostalgia.android.core

import kotlinx.coroutines.runBlocking
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Exercises [NostalgiaApi] against a running API v2 with seeded data (at least one channel on air with a series).
 * Skipped unless NOSTALGIA_LIVE_API is set, e.g. NOSTALGIA_LIVE_API=http://localhost:5155/
 */
class LiveApiTest {
    private val base = System.getenv("NOSTALGIA_LIVE_API")

    /** In-memory jar that also replays Secure cookies over http://localhost (the device jar is https-only). */
    private class MemoryCookies : CookieJar {
        private val cookies = mutableMapOf<String, Cookie>()
        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) = cookies.forEach { this.cookies[it.name] = it }
        override fun loadForRequest(url: HttpUrl) = cookies.values.filter { url.encodedPath.startsWith(it.path) }
            .map { Cookie.Builder().name(it.name).value(it.value).domain(url.host).path(it.path).build() }
    }

    @Test fun androidClientParsesEveryApiV2Response() = runBlocking {
        assumeTrue("NOSTALGIA_LIVE_API not set", !base.isNullOrBlank())
        val url = base!!.toHttpUrl()
        val client = OkHttpClient.Builder().cookieJar(MemoryCookies()).build()
        val api = NostalgiaApi(url, client)

        api.verifyServer()
        assertTrue(api.publicSettings().season.isNotBlank())

        val channels = api.channels()
        val channel = channels.first { it.onAir }
        assertNotNull("on-air channel has a program", channel.now)
        val detail = api.channelDetail(channel.id)
        assertEquals(channel.id, detail.id)
        assertNotNull(detail.activeEraId)

        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val row = api.guide(today, channel.id).single()
        assertTrue("guide has slots", row.slots.isNotEmpty())
        assertTrue("schedule has programs", api.schedule(channel.id).isNotEmpty())

        val state = api.channelState(channel.id)
        assertTrue(state.secondsUntilNext > 0)
        val media = MediaUrls.resolve(url, state.filePath)
        client.newCall(Request.Builder().url(media).header("Range", "bytes=0-1023").build()).execute().use {
            assertTrue("media is served (${it.code})", it.code == 200 || it.code == 206)
        }

        val page = api.series(1)
        val series = page.items.first()
        assertEquals(series.id, api.seriesDetail(series.id).id)
        val episodes = api.episodes(series.id)
        assertTrue("series has episodes", episodes.isNotEmpty())
        api.channelComments(channel.id)

        val session = api.startViewer("Android TV (prueba JVM)")
        assertNotNull(session.currentDeviceId)
        val episode = episodes.first()
        assertFalse(api.progress(episode.id, 0.0, 30.0, 90.0))
        assertTrue(api.viewerSession().progress.any { it.episodeId == episode.id && it.currentSecond >= 30.0 })

        val code = api.authorizeDevice("Android TV (prueba JVM)")
        assertTrue(code.userCode.matches(Regex("[A-Z0-9]{3}(-[A-Z0-9]{3}){3}")))
        assertFalse("pending until approved", api.redeemDevice(code.deviceCode))

        api.logoutViewer(session.currentDeviceId!!)
    }
}
