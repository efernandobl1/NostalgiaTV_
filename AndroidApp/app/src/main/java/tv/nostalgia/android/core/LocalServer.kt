package tv.nostalgia.android.core

import okhttp3.HttpUrl

object LocalServer {
    fun isPrivate(host: String): Boolean {
        if (host == "localhost" || host.endsWith(".localhost") || host.endsWith(".home.arpa") || host.endsWith(".local")) return true
        if (host.contains(':')) return host == "::1" || host.startsWith("fc", true) || host.startsWith("fd", true) ||
            Regex("^fe[89ab]", RegexOption.IGNORE_CASE).containsMatchIn(host)
        val parts = host.split('.').map { it.toIntOrNull() ?: return false }
        if (parts.size != 4 || parts.any { it !in 0..255 }) return false
        return parts[0] == 10 || parts[0] == 127 || parts[0] == 192 && parts[1] == 168 ||
            parts[0] == 172 && parts[1] in 16..31
    }

    fun sameOrigin(first: HttpUrl, second: HttpUrl) =
        first.scheme == second.scheme && first.host == second.host && first.port == second.port
}
