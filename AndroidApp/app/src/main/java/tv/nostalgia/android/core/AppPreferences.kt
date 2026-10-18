package tv.nostalgia.android.core

import android.content.Context

/** Device-only player preferences (Ajustes → Reproducción). */
data class AppSettings(
    val showChannelNumber: Boolean = true,
    val seasonalEffects: Boolean = true,
    val mobileData: Boolean = true,
    val startOnLastChannel: Boolean = false,
    val lastChannelId: Int? = null,
)

class AppPreferences(context: Context) {
    private val preferences = context.getSharedPreferences("app_settings", Context.MODE_PRIVATE)

    fun load() = AppSettings(preferences.getBoolean("showChannelNumber", true), preferences.getBoolean("seasonalEffects", true),
        preferences.getBoolean("mobileData", true), preferences.getBoolean("startOnLastChannel", false),
        preferences.getInt("lastChannelId", 0).takeIf { it > 0 })

    fun save(settings: AppSettings) {
        preferences.edit().putBoolean("showChannelNumber", settings.showChannelNumber).putBoolean("seasonalEffects", settings.seasonalEffects)
            .putBoolean("mobileData", settings.mobileData).putBoolean("startOnLastChannel", settings.startOnLastChannel)
            .putInt("lastChannelId", settings.lastChannelId ?: 0).apply()
    }
}
