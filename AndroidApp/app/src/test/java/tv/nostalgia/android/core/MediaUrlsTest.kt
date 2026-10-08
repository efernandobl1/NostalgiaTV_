package tv.nostalgia.android.core

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.*
import org.junit.Test

class MediaUrlsTest {
    private val base = "https://nostalgia-tv.work.gd/".toHttpUrl()

    @Test fun resolvesLibraryPathsWithSpacesAndUnicode() {
        val result = MediaUrls.resolve(base, "wwwroot/uploads/series/Los padrinos mágicos/season 1/01x01.mp4")
        assertTrue(result.startsWith("https://nostalgia-tv.work.gd/uploads/"))
        assertTrue(result.contains("Los%20padrinos%20m%C3%A1gicos"))
    }

    @Test fun resolvesWindowsAndContainerPaths() {
        assertEquals("https://nostalgia-tv.work.gd/uploads/series/test.mp4",
            MediaUrls.resolve(base, "/app/wwwroot/uploads/series/test.mp4"))
        assertEquals("https://nostalgia-tv.work.gd/uploads/series/test.mp4",
            MediaUrls.resolve(base, "wwwroot\\uploads\\series\\test.mp4"))
    }

    @Test fun rejectsExternalServers() {
        assertThrows(IllegalArgumentException::class.java) { MediaUrls.resolve(base, "https://other.example/uploads/episode.mp4") }
        assertThrows(IllegalArgumentException::class.java) { MediaUrls.resolve(base, "https://nostalgia-tv.work.gd:444/uploads/episode.mp4") }
    }

    @Test fun rejectsPathsOutsideLibrary() {
        assertThrows(IllegalArgumentException::class.java) { MediaUrls.resolve(base, "/api/v1/users") }
        assertThrows(IllegalArgumentException::class.java) { MediaUrls.resolve(base, "/uploads/../../api/v1/users") }
        assertThrows(IllegalArgumentException::class.java) { MediaUrls.resolve(base, "/uploads/%2e%2e/api") }
    }
}
