package tv.nostalgia.android.core

import android.content.Context

data class VideoSettings(
    val enabled: Boolean = true,
    val curvature: Boolean = true,
    val vignette: Boolean = true,
    val animation: Boolean = false,
    val intensity: Int = 25,
    val density: Int = 2,
) {
    fun sanitized() = copy(intensity = intensity.coerceIn(0, 100), density = density.coerceIn(1, 10))
}

class VideoPreferences(context: Context) {
    private val preferences = context.getSharedPreferences("video_settings", Context.MODE_PRIVATE)

    fun load() = VideoSettings(preferences.getBoolean("enabled", true), preferences.getBoolean("curvature", true),
        preferences.getBoolean("vignette", true), preferences.getBoolean("animation", false),
        preferences.getInt("intensity", 25), preferences.getInt("density", 2)).sanitized()

    fun save(settings: VideoSettings) {
        val safe = settings.sanitized()
        preferences.edit().putBoolean("enabled", safe.enabled).putBoolean("curvature", safe.curvature)
            .putBoolean("vignette", safe.vignette).putBoolean("animation", safe.animation)
            .putInt("intensity", safe.intensity).putInt("density", safe.density).apply()
    }
}
