package tv.nostalgia.android

import android.app.Application
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import tv.nostalgia.android.core.SecureHttp

class NostalgiaApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        SingletonImageLoader.setSafe { context ->
            ImageLoader.Builder(context).components {
                add(OkHttpNetworkFetcherFactory(callFactory = { SecureHttp.create(context) }))
            }.build()
        }
    }
}
