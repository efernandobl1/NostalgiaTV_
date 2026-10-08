package tv.nostalgia.android.core

data class WatchRange(val start: Double, val end: Double)

class WatchSampler {
    private var last: Double? = null
    private var start: Double? = null

    fun sample(position: Double, playing: Boolean): WatchRange? {
        val previous = last
        last = position
        if (!playing || previous == null || position < previous || position - previous > 2.5) {
            start = if (playing) position else null
            return null
        }
        val first = start ?: previous.also { start = it }
        if (position - first < 15) return null
        start = position
        return WatchRange(first, position)
    }

    fun flush(): WatchRange? {
        val first = start
        val end = last
        start = null
        return if (first != null && end != null && end > first) WatchRange(first, end) else null
    }
}
