package tv.nostalgia.android.core

import android.content.Context
import okhttp3.HttpUrl

class ServerPreferences(context: Context) {
    private val preferences = context.getSharedPreferences("server_connection", Context.MODE_PRIVATE)
    fun load(): HttpUrl? = preferences.getString("server", null)?.let { runCatching { ServerAddress.parse(it) }.getOrNull() }
    fun save(server: HttpUrl) { preferences.edit().putString("server", server.toString()).apply() }
    fun clear() { preferences.edit().clear().apply() }
}
