package tv.nostalgia.android

import android.os.Bundle
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.app.UiModeManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import tv.nostalgia.android.features.NostalgiaApp
import tv.nostalgia.android.core.DeviceMode
import tv.nostalgia.android.shared.RetroTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val isTv = DeviceMode.isTv(
            packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK),
            getSystemService(UiModeManager::class.java)?.currentModeType ?: 0,
        )
        if (isTv) requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        WindowInsetsControllerCompat(window, window.decorView).apply {
            if (isTv) hide(WindowInsetsCompat.Type.systemBars())
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        setContent { RetroTheme(isTv) { NostalgiaApp(viewModel()) } }
    }
}
