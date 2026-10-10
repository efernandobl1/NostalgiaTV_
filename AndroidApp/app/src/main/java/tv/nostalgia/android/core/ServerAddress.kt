package tv.nostalgia.android.core

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject

object ServerAddress {
    fun parse(value: String): HttpUrl {
        val address = value.trim()
        require(address.isNotEmpty() && address.length <= 300 && address.none { it.isWhitespace() || it == '\\' })
        val url = (if (address.contains("://")) address else "https://$address").toHttpUrl()
        require(url.scheme == "https" && url.username.isEmpty() && url.password.isEmpty() &&
            url.encodedPath == "/" && url.query == null && url.fragment == null)
        return url
    }

    fun readQr(value: String): ServerQr {
        require(value.length <= 1024)
        val qr = JSONObject(value)
        require(qr.getString("type") == "nostalgiatv-device" && qr.getInt("version") == 1)
        val code = qr.getString("deviceCode")
        require(code.length == 64 && code.all { it in "0123456789ABCDEF" })
        return ServerQr(parse(qr.getString("server")), code)
    }
}

data class ServerQr(val server: HttpUrl, val deviceCode: String)
