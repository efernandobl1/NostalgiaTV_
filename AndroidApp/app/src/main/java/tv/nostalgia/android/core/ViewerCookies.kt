package tv.nostalgia.android.core

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import java.security.KeyStore
import java.io.IOException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class ViewerCookies(context: Context, private val origin: HttpUrl) : CookieJar {
    private val preferences = context.getSharedPreferences("viewer_session", Context.MODE_PRIVATE)
    private val alias = "nostalgia_viewer_cookie"
    private var cookies = restore()

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (url.host != origin.host || url.scheme != "https" || url.port != origin.port) return
        val viewer = cookies.lastOrNull {
            it.name == "__Host-viewer_device" && it.secure && it.httpOnly && it.hostOnly && it.path == "/"
        } ?: return
        this.cookies = if (viewer.expiresAt > System.currentTimeMillis()) listOf(viewer) else emptyList()
        if (this.cookies.isEmpty()) preferences.edit().clear().apply()
        else try { preferences.edit().putString("cookie", encrypt(viewer.toString())).apply() }
        catch (exception: Exception) { throw IOException("Could not protect viewer session", exception) }
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> =
        if (url.host == origin.host && url.port == origin.port && url.encodedPath.startsWith("/api/v1/viewer"))
            cookies.filter { it.matches(url) && it.expiresAt > System.currentTimeMillis() }
        else emptyList()

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        return Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    }

    private fun restore(): List<Cookie> = runCatching {
        val encrypted = preferences.getString("cookie", null) ?: return emptyList()
        val bytes = Base64.decode(encrypted, Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        }
        listOfNotNull(Cookie.parse(origin, String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)))
    }.getOrElse { preferences.edit().clear().apply(); emptyList() }
}
