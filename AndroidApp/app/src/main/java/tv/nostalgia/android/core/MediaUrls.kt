package tv.nostalgia.android.core

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

object MediaUrls {
    fun resolve(base: HttpUrl, path: String): String {
        val normalized = path.replace('\\', '/')
        val relative = if ("wwwroot/" in normalized) {
            "/" + normalized.substringAfter("wwwroot/")
        } else normalized
        val url = if (relative.startsWith("https://")) relative.toHttpUrlOrNull()
            else base.resolve("/" + relative.trimStart('/'))
        require(url != null && url.scheme == base.scheme && url.host == base.host && url.port == base.port) {
            "Media must use the configured server."
        }
        require(url.encodedPath.startsWith("/uploads/") && url.fragment == null && url.query == null) {
            "Invalid media path."
        }
        return url.toString()
    }
}
