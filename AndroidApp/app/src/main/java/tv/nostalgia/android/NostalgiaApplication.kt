package tv.nostalgia.android

import android.app.Application
import coil3.ImageLoader
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import tv.nostalgia.android.core.SecureHttp
import tv.nostalgia.android.core.ServerPreferences
import tv.nostalgia.android.core.LocalServer
import okhttp3.Call

class NostalgiaApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        SingletonImageLoader.setSafe { context ->
            ImageLoader.Builder(context).components {
                add(OkHttpNetworkFetcherFactory(callFactory = {
                    val publicClient = SecureHttp.create(context)
                    var localClient: Pair<okhttp3.HttpUrl, okhttp3.OkHttpClient>? = null
                    Call.Factory { request ->
                        val server = ServerPreferences(context).load()?.takeIf { LocalServer.sameOrigin(it, request.url) }
                        val client = if (server == null || !LocalServer.isPrivate(server.host)) publicClient else synchronized(publicClient) {
                            if (localClient?.first != server) localClient = server to SecureHttp.create(context, origin = server)
                            localClient.second
                        }
                        client.newCall(request)
                    }
                }))
            }.build()
        }
    }
}
