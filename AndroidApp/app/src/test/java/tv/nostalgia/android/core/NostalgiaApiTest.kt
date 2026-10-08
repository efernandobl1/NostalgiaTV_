package tv.nostalgia.android.core

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class NostalgiaApiTest {
    private lateinit var server: MockWebServer
    private lateinit var api: NostalgiaApi
    @Before fun setup() { server = MockWebServer(); server.start(); api = NostalgiaApi(server.url("/"), OkHttpClient()) }
    @After fun cleanup() { server.shutdown() }

    @Test fun loadsChannelLogos() = runTest {
        server.enqueue(MockResponse().setBody("""[{"id":1,"name":"Jetix","logoPath":"/uploads/channels/jetix.png"}]"""))
        assertEquals("/uploads/channels/jetix.png", api.channels().single().logoPath)
        assertEquals("/api/v1/public/channels", server.takeRequest().path)
    }

    @Test fun sortsEpisodesAndIgnoresMissingFiles() = runTest {
        server.enqueue(MockResponse().setBody("""[
            {"id":3,"title":"Third","filePath":"wwwroot/uploads/3.mp4","season":1,"episodeNumber":3},
            {"id":1,"title":"First","filePath":"wwwroot/uploads/1.mp4","season":1,"episodeNumber":1},
            {"id":2,"title":"Missing","filePath":null,"season":1,"episodeNumber":2}]
        """))
        assertEquals(listOf(1, 3), api.episodes(9).map { it.id })
    }

    @Test fun parsesPaginatedSeries() = runTest {
        server.enqueue(MockResponse().setBody("""{"items":[{"id":1,"name":"Los Simpson","logoPath":null,"episodeCount":178}],"totalCount":50}"""))
        val page = api.series(2)
        assertEquals(50, page.totalCount)
        assertEquals(178, page.items.single().episodeCount)
        assertEquals("/api/v1/public/series?Page=2&PageSize=24", server.takeRequest().path)
    }

    @Test fun keepsLiveSegmentAndPlaybackOffset() = runTest {
        server.enqueue(MockResponse().setBody("""{"segmentId":100,"episodeId":9,"episodeTitle":"Pilot","seriesName":"X","filePath":"wwwroot/uploads/9.mp4","currentSecond":345.5,"secondsUntilNext":20,"isBumper":false}"""))
        val state = api.channelState(1)
        assertEquals(100L, state.segmentId)
        assertEquals(345.5, state.currentSecond, 0.01)
    }

    @Test fun surfacesHttpErrors() = runTest {
        server.enqueue(MockResponse().setResponseCode(404))
        try { api.channelState(1); fail("Expected HTTP error") }
        catch (exception: ApiException) { assertEquals(404, exception.status) }
    }

    @Test fun sendsOnlyActualWatchedRanges() = runTest {
        server.enqueue(MockResponse().setBody("""{"completed":true}"""))
        assertTrue(api.progress(3, 10.0, 25.0, 1500.0))
        val request = server.takeRequest()
        assertEquals("/api/v1/viewer/progress", request.path)
        val json = org.json.JSONObject(request.body.readUtf8())
        assertEquals(10.0, json.getDouble("startSecond"), 0.01)
        assertEquals(25.0, json.getDouble("currentSecond"), 0.01)
    }
}
