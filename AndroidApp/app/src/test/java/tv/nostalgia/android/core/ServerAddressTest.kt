package tv.nostalgia.android.core

import org.junit.Assert.*
import org.junit.Test

class ServerAddressTest {
    @Test fun normalizesSecureOrigins() {
        assertEquals("https://nostalgia.example/", ServerAddress.parse(" nostalgia.example ").toString())
        assertEquals("https://10.77.77.1:8443/", ServerAddress.parse("https://10.77.77.1:8443").toString())
    }

    @Test fun rejectsUnsafeOrAmbiguousServers() {
        listOf("http://server.example", "https://user:password@server.example", "https://server.example/api",
            "https://server.example?next=evil", "https://server.example#token", "https://server.example\\path", "server example")
            .forEach { assertThrows(IllegalArgumentException::class.java) { ServerAddress.parse(it) } }
    }

    @Test fun onlyReadsExplicitDeviceQrPayloads() {
        val code = "A".repeat(64)
        val payload = """{"type":"nostalgiatv-device","version":1,"server":"https://server.example","deviceCode":"$code"}"""
        assertEquals(code, ServerAddress.readQr(payload).deviceCode)
        listOf(payload.replace("https:", "http:"), payload.replace("nostalgiatv-device", "login"),
            payload.replace("\"version\":1", "\"version\":2"), payload.replace(code, "short"))
            .forEach { assertThrows(IllegalArgumentException::class.java) { ServerAddress.readQr(it) } }
    }
}
