package tv.nostalgia.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import tv.nostalgia.android.core.SecureHttp
import javax.net.ssl.SSLHandshakeException

@RunWith(AndroidJUnit4::class)
class SecureHttpTest {
    @Test fun rejectsUntrustedCertificatesEvenWithLegacyRootFallback() {
        val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
        val serverTls = HandshakeCertificates.Builder().heldCertificate(certificate).build()
        MockWebServer().use { server ->
            server.useHttps(serverTls.sslSocketFactory(), false)
            server.enqueue(MockResponse().setBody("untrusted"))
            server.start()
            val client = SecureHttp.create(InstrumentationRegistry.getInstrumentation().targetContext)
            assertThrows(SSLHandshakeException::class.java) {
                client.newCall(Request.Builder().url(server.url("/")).build()).execute().use { }
            }
        }
    }
}
