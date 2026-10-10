package tv.nostalgia.android.core

import android.content.res.Configuration
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceModeTest {
    @Test fun leanbackUsesTvModeByDefault() {
        assertTrue(DeviceMode.isTv(true, Configuration.UI_MODE_TYPE_NORMAL))
    }

    @Test fun televisionWithoutLeanbackStillUsesTvMode() {
        assertTrue(DeviceMode.isTv(false, Configuration.UI_MODE_TYPE_TELEVISION))
    }

    @Test fun phoneAndTabletKeepMobileMode() {
        assertFalse(DeviceMode.isTv(false, Configuration.UI_MODE_TYPE_NORMAL))
    }

    @Test fun unknownDeviceDoesNotAssumeTvMode() {
        assertFalse(DeviceMode.isTv(false, 0))
    }
}
