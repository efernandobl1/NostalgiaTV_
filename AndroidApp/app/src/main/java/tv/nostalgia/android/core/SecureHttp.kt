package tv.nostalgia.android.core

import android.content.Context
import android.os.Build
import okhttp3.CookieJar
import okhttp3.OkHttpClient
import okhttp3.HttpUrl
import tv.nostalgia.android.R
import java.security.KeyStore
import java.security.cert.CertificateException
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import java.io.IOException

object SecureHttp {
    fun create(context: Context, cookies: CookieJar = CookieJar.NO_COOKIES, origin: HttpUrl? = null): OkHttpClient {
        val local = origin?.takeIf { it.scheme == "https" && LocalServer.isPrivate(it.host) }
        val authorities = if (local != null) KeyStore.getInstance("AndroidCAStore").apply { load(null) } else null
        return build(context, cookies, origin, authorities)
    }

    internal fun build(context: Context, cookies: CookieJar, origin: HttpUrl?, authorities: KeyStore?): OkHttpClient {
        val builder = OkHttpClient.Builder().cookieJar(cookies)
            .connectTimeout(10, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS)
            .followRedirects(false).followSslRedirects(false)
        // Android 6 ignores network_security_config; validate chains with the official ISRG root as a fallback.
        val local = origin?.takeIf { it.scheme == "https" && LocalServer.isPrivate(it.host) }
        if (Build.VERSION.SDK_INT == 23 || local != null) {
            val system = if (Build.VERSION.SDK_INT == 23) {
                val installed = KeyStore.getInstance("AndroidCAStore").apply { load(null) }
                val official = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
                    load(null)
                    installed.aliases().toList().filter { it.startsWith("system:") }.forEach { alias ->
                        setCertificateEntry(alias, installed.getCertificate(alias))
                    }
                }
                trustManager(official)
            } else trustManager(null)
            val roots = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
                load(null)
                context.resources.openRawResource(R.raw.isrg_root_x1).use {
                    setCertificateEntry("isrg-root-x1", CertificateFactory.getInstance("X.509").generateCertificate(it))
                }
                if (local != null) {
                    authorities?.aliases()?.toList()?.filter { it.startsWith("user:") }?.forEach { alias ->
                        setCertificateEntry(alias, authorities.getCertificate(alias))
                    }
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
        // A private CA is usable only on the selected origin, never on external artwork or redirects.
        if (local != null) builder.addInterceptor { chain ->
            if (!LocalServer.sameOrigin(local, chain.request().url)) throw IOException("Local certificate trust cannot leave the selected server")
            chain.proceed(chain.request())
        }
        return builder.build()
    }

    private fun trustManager(roots: KeyStore?): X509TrustManager = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        .apply { init(roots) }.trustManagers.filterIsInstance<X509TrustManager>().single()
}
