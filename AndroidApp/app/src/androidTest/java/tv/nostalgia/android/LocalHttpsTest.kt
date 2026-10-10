package tv.nostalgia.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import okhttp3.CookieJar
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import tv.nostalgia.android.core.SecureHttp
import java.io.IOException
import java.security.KeyStore

@RunWith(AndroidJUnit4::class)
class LocalHttpsTest {
    @Test fun acceptsExplicitLocalAuthorityButNeverAnUnknownCertificateOrWrongHostname() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val root = HeldCertificate.Builder().certificateAuthority(1).build()
        val roots = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
            load(null)
            setCertificateEntry("user:local-test", root.certificate)
        }
        for (hostname in listOf("localhost", "wrong.local")) {
            val leaf = HeldCertificate.Builder().signedBy(root).addSubjectAlternativeName(hostname).build()
            val tls = HandshakeCertificates.Builder().heldCertificate(leaf, root.certificate).build()
            MockWebServer().use { server ->
                server.useHttps(tls.sslSocketFactory(), false)
                server.enqueue(MockResponse().setBody("local HTTPS"))
                server.start()
                val origin = server.url("/")
                val trusted = SecureHttp.build(context, CookieJar.NO_COOKIES, origin, roots)
                val request = Request.Builder().url(origin).build()
                if (hostname == "localhost") {
                    trusted.newCall(request).execute().use { assertEquals("local HTTPS", it.body.string()) }
                    try {
                        SecureHttp.build(context, CookieJar.NO_COOKIES, origin, null).newCall(request).execute().close()
                        fail("An untrusted CA must be rejected")
                    } catch (_: IOException) { }
                    try {
                        trusted.newCall(Request.Builder().url("https://example.com/".toHttpUrl()).build()).execute().close()
                        fail("Local trust must not leave the configured origin")
                    } catch (_: IOException) { }
                } else {
                    try {
                        trusted.newCall(request).execute().close()
                        fail("A trusted CA does not excuse a hostname mismatch")
                    } catch (_: IOException) { }
                }
            }
        }
    }
}
