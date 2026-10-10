package tv.nostalgia.android.features

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.tv.material3.Text
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import tv.nostalgia.android.shared.*
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import androidx.activity.compose.BackHandler

@Composable
fun ProfileScreen(model: AppViewModel, state: AppState) {
    val tv = LocalTvDevice.current
    var changingServer by remember { mutableStateOf(false) }
    var loggingOut by remember { mutableStateOf(false) }
    BackHandler(changingServer) { changingServer = false }
    var expired by remember(state.pairingCode) { mutableStateOf(false) }
    var pollingError by remember(state.pairingCode) { mutableStateOf(false) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(state.pairingCode) {
        val code = state.pairingCode ?: return@LaunchedEffect
        val expires = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
            .parse(code.expiresAtUtc)?.time ?: 0L
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (System.currentTimeMillis() < expires) {
                delay(5000)
                try {
                    if (model.checkPairing()) break
                    pollingError = false
                } catch (exception: Exception) {
                    if (exception is CancellationException) throw exception
                    pollingError = true
                }
            }
            expired = !model.state.value.linked
        }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Text("Tus recuerdos viajan contigo.", color = Retro.Gold, fontFamily = FontFamily.Monospace, fontSize = if (tv) 30.sp else 24.sp)
        Text("Continúa tus episodios en la TV, el celular y la web con el mismo perfil.",
            color = Retro.Cream, fontSize = if (tv) 20.sp else 17.sp, modifier = Modifier.widthIn(max = 720.dp))
        state.profileError?.let { Message(it, "Volver a intentar", { model.refreshSession() }) }
        if (state.linked) Message("Dispositivo vinculado. Ya compartes el historial de tu perfil.")
        val code = state.pairingCode
        if (state.session?.accountLinked == true) {
            Text("Vinculado a tu cuenta. Entra con esa cuenta o autoriza otra pantalla desde Dashboard → Dispositivos.", color = Retro.Mint, fontSize = 18.sp)
        } else {
        when {
            state.pairing -> Message("Generando código…")
            code != null && !expired -> {
                Text(code.code, color = Retro.Mint, fontFamily = FontFamily.Monospace, fontSize = if (tv) 40.sp else 25.sp)
                Text("En tu PC o celular, abre NostalgiaTV → Mi perfil → Añadir dispositivo → La que ya uso e introduce este código.",
                    color = Retro.Cream, fontSize = 20.sp, modifier = Modifier.widthIn(max = 730.dp))
                Text("El código vence en 10 minutos. No lo compartas con otras personas.", color = Retro.Lavender, fontSize = 18.sp)
                if (pollingError) Text("Esperando conexión para confirmar la vinculación…", color = Retro.Cream, fontSize = 18.sp)
            }
            else -> {
                if (expired) Text("El código expiró. Genera uno nuevo para continuar.", color = Retro.Cream, fontSize = 20.sp)
                RetroButton(if (tv) "Vincular esta TV" else "Vincular este dispositivo", { model.createCode() })
            }
        }
        }
        state.session?.let { Text("${it.deviceCount} dispositivo(s) en este perfil", color = Retro.Lavender, fontSize = 18.sp) }
        Text("Servidor: ${state.serverAddress}", color = Retro.Lavender, fontSize = 17.sp)
        if (changingServer) {
            Text("La reproducción se detendrá. El historial y la sesión de este servidor seguirán guardados por separado.", color = Retro.Cream, fontSize = 17.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                RetroButton("Cancelar", { changingServer = false })
                RetroButton("Elegir otro servidor", model::chooseServer)
            }
        } else RetroButton("Cambiar de servidor", { changingServer = true })
        if (loggingOut) {
            Text("Solo se desvinculará esta pantalla. El historial del perfil no se borrará.", color = Retro.Cream, fontSize = 17.sp)
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                RetroButton("Cancelar", { loggingOut = false })
                RetroButton("Confirmar cierre de sesión", { model.logout() }, enabled = !state.connectionBusy)
            }
        } else RetroButton("Cerrar sesión en este servidor", { loggingOut = true })
    }
}
