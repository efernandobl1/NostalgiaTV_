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

    @Test fun verifiesServerAndPollsUntilExplicitlyApproved() = runTest {
        server.enqueue(MockResponse().setBody("""{"product":"NostalgiaTV","deviceAuthorizationVersion":1}"""))
        api.verifyServer()
        assertEquals("/api/v1/server", server.takeRequest().path)
        server.enqueue(MockResponse().setBody("""{"deviceCode":"secret","userCode":"ABC-DEF-GHJ-KLM","expiresAtUtc":"2026-10-10T12:00:00Z","interval":5}"""))
        assertEquals(5, api.authorizeDevice("TV").interval)
        assertEquals("/api/v1/viewer/authorization", server.takeRequest().path)
        server.enqueue(MockResponse().setResponseCode(202).setBody("""{"status":"pending"}"""))
        assertFalse(api.redeemDevice("secret"))
        server.enqueue(MockResponse().setBody("""{"status":"connected"}"""))
        assertTrue(api.redeemDevice("secret"))
    }

    @Test fun credentialsOnlyCreateViewerSessionAndRevokeAdministrativeLogin() = runTest {
        server.enqueue(MockResponse().setBody("{}"))
        server.enqueue(MockResponse().setBody("""{"profileId":"profile","accountLinked":true,"devices":[{"id":"device","current":true}],"progress":[]}"""))
        server.enqueue(MockResponse().setResponseCode(204))
        val session = api.loginViewer("viewer", "private-test-password", "Android")
        assertTrue(session.accountLinked)
        assertEquals("device", session.currentDeviceId)
        assertEquals("/api/v1/auth/token", server.takeRequest().path)
        assertEquals("/api/v1/viewer/session", server.takeRequest().path)
        assertEquals("/api/v1/auth/revoke", server.takeRequest().path)
    }

    @Test fun rejectsOtherServerProducts() = runTest {
        server.enqueue(MockResponse().setBody("""{"product":"Unrelated","deviceAuthorizationVersion":1}"""))
        try { api.verifyServer(); fail("Expected unsupported server") }
        catch (_: IllegalArgumentException) { }
    }

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

    @Test fun appliesCatalogFiltersWithoutBreakingSpecialCharacters() = runTest {
        server.enqueue(MockResponse().setBody("""{"items":[],"totalCount":0}"""))
        api.series(1, SeriesFilter("Simpson & Friends ñ", channelId = 2, categoryId = 4))
        val url = server.takeRequest().requestUrl!!
        assertEquals("Simpson & Friends ñ", url.queryParameter("Name"))
        assertEquals("2", url.queryParameter("ChannelId"))
        assertEquals("4", url.queryParameter("CategoryId"))
    }

    @Test fun loadsCategories() = runTest {
        server.enqueue(MockResponse().setBody("""[{"id":4,"name":"Animation"}]"""))
        assertEquals(Category(4, "Animation"), api.categories().single())
    }

    @Test fun sortsGuideAndParsesUtcTimesOnAndroidSix() = runTest {
        server.enqueue(MockResponse().setBody("""[
          {"id":2,"seriesName":"Series","episodeTitle":"Second","startTime":"2026-10-08T08:00:00Z","endTime":"2026-10-08T08:20:00Z"},
          {"id":1,"isBumper":true,"bumperTitle":"Bumper","startTime":"2026-10-08T07:40:00Z","endTime":"2026-10-08T08:00:00Z"}]
        """))
        val entries = api.schedule(1)
        assertEquals(listOf(1L, 2L), entries.map { it.id })
        assertEquals("Bumper", entries.first().title)
        assertEquals(20 * 60000L, entries[1].endsAt - entries[1].startsAt)
        assertEquals("/api/v1/public/channels/1/schedule", server.takeRequest().path)
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
