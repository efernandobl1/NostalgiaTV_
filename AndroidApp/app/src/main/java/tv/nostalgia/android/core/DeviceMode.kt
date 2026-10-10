package tv.nostalgia.android.core

import android.content.res.Configuration

object DeviceMode {
    fun isTv(hasLeanback: Boolean, modeType: Int): Boolean =
        hasLeanback || modeType == Configuration.UI_MODE_TYPE_TELEVISION
}
