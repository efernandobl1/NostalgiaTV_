package tv.nostalgia.android.core

import android.content.Context
import android.os.Build
import okhttp3.CookieJar
import okhttp3.OkHttpClient
import tv.nostalgia.android.R
import java.security.KeyStore
import java.security.cert.CertificateException
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

object SecureHttp {
    fun create(context: Context, cookies: CookieJar = CookieJar.NO_COOKIES): OkHttpClient {
        val builder = OkHttpClient.Builder().cookieJar(cookies)
            .connectTimeout(10, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS)
            .followRedirects(false).followSslRedirects(false)
        // Android 6 ignores network_security_config; validate chains with the official ISRG root as a fallback.
        if (Build.VERSION.SDK_INT == 23) {
            val system = trustManager(null)
            val roots = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
                load(null)
                context.resources.openRawResource(R.raw.isrg_root_x1).use {
                    setCertificateEntry("isrg-root-x1", CertificateFactory.getInstance("X.509").generateCertificate(it))
                }
            }
            val fallback = trustManager(roots)
            val trusted = object : X509TrustManager {
                override fun getAcceptedIssuers() = system.acceptedIssuers + fallback.acceptedIssuers
                override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = system.checkClientTrusted(chain, authType)
                override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
                    try { system.checkServerTrusted(chain, authType) }
                    catch (_: CertificateException) { fallback.checkServerTrusted(chain, authType) }
                }
            }
            val tls = SSLContext.getInstance("TLS").apply { init(null, arrayOf(trusted), null) }
            builder.sslSocketFactory(tls.socketFactory, trusted)
        }
        return builder.build()
    }

    private fun trustManager(roots: KeyStore?): X509TrustManager = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        .apply { init(roots) }.trustManagers.filterIsInstance<X509TrustManager>().single()
}
