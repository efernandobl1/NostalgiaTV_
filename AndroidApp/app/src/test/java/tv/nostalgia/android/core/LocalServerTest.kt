package tv.nostalgia.android.core

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.*
import org.junit.Test

class LocalServerTest {
    @Test fun recognizesPrivateAddressesWithoutResolvingUntrustedNames() {
        listOf("192.168.1.10", "10.77.77.1", "172.16.0.1", "172.31.255.255", "127.0.0.1", "::1", "fd12::1", "fe80::1", "tv.home.arpa", "tv.local").forEach {
            assertTrue(it, LocalServer.isPrivate(it))
            assertEquals("https", ServerAddress.parse(it.let { host -> if (host.contains(':')) "[$host]" else host }).scheme)
        }
        listOf("8.8.8.8", "172.15.0.1", "172.32.0.1", "192.168.1.999", "192.168.1.1.evil.com", "localhost.evil.com", "home.arpa.evil.com", "example.com", "2001:db8::1").forEach {
            assertFalse(it, LocalServer.isPrivate(it))
        }
    }

    @Test fun limitsTrustToTheExactHttpsOrigin() {
        val server = "https://192.168.1.10/".toHttpUrl()
        assertTrue(LocalServer.sameOrigin(server, server.resolve("uploads/video.mp4")!!))
        listOf("http://192.168.1.10/", "https://192.168.1.10:8443/", "https://192.168.1.11/").forEach {
            assertFalse(LocalServer.sameOrigin(server, it.toHttpUrl()))
        }
    }
}
