package tv.nostalgia.android

import android.content.pm.PackageManager
import androidx.activity.compose.setContent
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import okhttp3.Cookie
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.*
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import tv.nostalgia.android.core.*
import tv.nostalgia.android.features.*
import tv.nostalgia.android.shared.RetroTheme
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(AndroidJUnit4::class)
class ConnectionFlowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun connectsByDeviceAuthorizationOrCredentialsAndIsolatesServerSessions() {
        val context = compose.activity
        val tv = context.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
        val serverTls = HandshakeCertificates.Builder().heldCertificate(certificate).build()
        val clientTls = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
        val approved = AtomicBoolean(false)
        val expires = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(Date(System.currentTimeMillis() + 600000))
        MockWebServer().use { server ->
            server.useHttps(serverTls.sslSocketFactory(), false)
            server.dispatcher = object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    val path = request.path?.substringBefore('?')
                    val session = """{"profileId":"test-profile","accountLinked":true,"devices":[{"id":"test-device","current":true}],"progress":[]}"""
                    val viewer = MockResponse().setBody(session).addHeader("Set-Cookie", "__Host-viewer_device=test-secret; Path=/; Max-Age=10000; Secure; HttpOnly; SameSite=Strict")
                    return when (path) {
                        "/api/v1/server" -> MockResponse().setBody("""{"product":"NostalgiaTV","deviceAuthorizationVersion":1,"registrationEnabled":true,"googleEnabled":true}""")
                        "/api/v1/viewer/session" -> if (request.method == "POST") viewer else
                            if (request.getHeader("Cookie")?.contains("viewer_device") == true) MockResponse().setBody(session) else MockResponse().setResponseCode(401)
                        "/api/v1/viewer/authorization" -> MockResponse().setBody("""{"deviceCode":"${"A".repeat(64)}","userCode":"ABC-DEF-GHJ-KLM","expiresAtUtc":"$expires","interval":5}""")
                        "/api/v1/viewer/authorization/redeem" -> if (approved.get()) viewer.setBody("""{"status":"connected"}""") else MockResponse().setResponseCode(202).setBody("""{"status":"pending"}""")
                        "/api/v1/auth/token" -> MockResponse().setBody("{}").addHeader("Set-Cookie", "access_token=temporary; Path=/; Secure; HttpOnly")
                            .addHeader("Set-Cookie", "refresh_token=temporary-refresh; Path=/; Secure; HttpOnly")
                        "/api/v1/auth/revoke" -> MockResponse().setResponseCode(204)
                        "/api/v1/public/channels" -> MockResponse().setBody("""[{"id":1,"name":"Canal de prueba","logoPath":null}]""")
                        "/api/v1/public/series" -> MockResponse().setBody("""{"items":[],"totalCount":0}""")
                        "/api/v1/public/categories" -> MockResponse().setBody("[]")
                        else -> MockResponse().setResponseCode(404)
                    }
                }
            }
            server.start()
            val origin = server.url("/")
            ViewerCookies(context, origin).clear()
            val model = AppViewModel(context.application) { address, cookies ->
                NostalgiaApi(address, OkHttpClient.Builder().cookieJar(cookies).followRedirects(false)
                    .sslSocketFactory(clientTls.sslSocketFactory(), clientTls.trustManager).build(), cookies)
            }
            compose.runOnUiThread {
                model.chooseServer()
                context.setContent { RetroTheme(isTv = tv) { NostalgiaApp(model) } }
            }
            compose.onNodeWithText("Conecta tu servidor").assertIsDisplayed()
            capture(if (tv) "tv-server.png" else "phone-server.png")
            compose.runOnUiThread { model.connectServer(origin.toString()) }
            compose.waitUntil(15000) { model.state.value.connectionStep == ConnectionStep.Login && !model.state.value.connectionBusy }
            if (tv) {
                compose.waitUntil(15000) { model.state.value.authorization != null }
                compose.onNodeWithText("ABC-DEF-GHJ-KLM").assertIsDisplayed()
                assertTrue(compose.onAllNodesWithText("Usuario").fetchSemanticsNodes().isEmpty())
                assertTrue(compose.onAllNodesWithText("Contraseña").fetchSemanticsNodes().isEmpty())
                capture("tv-login.png")
                approved.set(true)
            } else {
                compose.onNodeWithText("Usuario").assertIsDisplayed()
                capture("phone-login.png")
                compose.onNodeWithText("Usuario").performTextInput("viewer")
                compose.onNodeWithText("Contraseña").performTextInput("private-test-password")
                compose.onNodeWithText("Entrar").performClick()
            }
            compose.waitUntil(20000) { model.state.value.connectionStep == ConnectionStep.Ready && !model.state.value.loading }
            if (!tv) compose.onNodeWithText("Canal de prueba").performScrollTo()
            compose.onNodeWithText("Canal de prueba").assertIsDisplayed()
            if (tv) {
                val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
                device.pressDPadDown(); compose.waitForIdle()
                compose.onNodeWithText("Canal de prueba").assertIsFocused()
            }
            val restored = ViewerCookies(context, origin)
            assertEquals(1, restored.loadForRequest(origin.resolve("api/v1/viewer/session")!!).size)
            assertTrue(restored.loadForRequest(origin.resolve("api/v1/users/me")!!).isEmpty())
            assertTrue(restored.loadForRequest(origin.resolve("api/v1/auth/revoke")!!).isEmpty())
            assertTrue(restored.loadForRequest(origin.newBuilder().port(origin.port + 1).build().resolve("api/v1/viewer/session")!!).isEmpty())
            assertTrue(ViewerCookies(context, "https://other.example/".toHttpUrl()).loadForRequest("https://other.example/api/v1/viewer/session".toHttpUrl()).isEmpty())
            compose.runOnUiThread { model.chooseServer() }
            compose.onNodeWithText("Conecta tu servidor").assertIsDisplayed()
            restored.clear()
        }
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(
            File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), name))
    }
}
