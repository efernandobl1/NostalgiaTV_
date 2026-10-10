package tv.nostalgia.android.features

import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import tv.nostalgia.android.core.*
import tv.nostalgia.android.shared.*
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@Composable
fun ConnectionScreen(model: AppViewModel, state: AppState) {
    val tv = LocalTvDevice.current
    val context = LocalContext.current
    val keyboard = LocalSoftwareKeyboardController.current
    var server by rememberSaveable(state.serverAddress) { mutableStateOf(state.serverAddress) }
    var username by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var scanned by remember { mutableStateOf<ServerQr?>(null) }
    var scanError by remember { mutableStateOf<String?>(null) }
    val focus = remember { FocusRequester() }
    val scanner = rememberLauncherForActivityResult(ScanContract()) { result ->
        result.contents?.let { contents ->
            try { scanned = ServerAddress.readQr(contents); scanError = null }
            catch (_: Exception) { scanError = "Este QR no es válido. Genera uno en Dashboard → Dispositivos." }
        }
    }
    BackHandler(state.connectionStep == ConnectionStep.Login || scanned != null) {
        if (scanned != null) scanned = null else model.chooseServer()
    }
    LaunchedEffect(state.connectionStep) {
        if (tv && state.connectionStep == ConnectionStep.Server) focus.requestFocus()
        if (tv && state.connectionStep == ConnectionStep.Login && state.authorization == null) model.createAuthorization()
    }
    LaunchedEffect(state.browserLogin) {
        state.browserLogin?.let { address ->
            try { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(address))) }
            catch (_: android.content.ActivityNotFoundException) { model.authorizationError(false) }
            model.browserOpened()
        }
    }
    AuthorizationPolling(model, state)
    Box(Modifier.fillMaxSize().background(Retro.Background)) {
        RoomBackground(Modifier.fillMaxSize())
        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().imePadding().padding(if (tv) 32.dp else 20.dp)) {
            val wide = maxWidth > 700.dp
            val content: @Composable () -> Unit = {
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("NostalgiaTV", color = Retro.Gold, fontFamily = RetroDisplay, fontSize = if (tv) 44.sp else 36.sp)
                    Text(if (state.connectionStep == ConnectionStep.Server) "Conecta tu servidor" else "Entra a tu señal",
                        color = Retro.Cream, fontSize = if (tv) 28.sp else 24.sp)
                    if (scanned != null) {
                        Text("Vas a vincular tu perfil con este servidor:", color = Retro.Cream, fontSize = 18.sp)
                        Text(scanned!!.server.toString(), color = Retro.Mint, fontSize = 20.sp)
                        Text("Confirma que es tu servidor. El QR caduca en dos minutos y solo se puede usar una vez.", color = Retro.Lavender, fontSize = 17.sp)
                        RetroButton("Conectar este dispositivo", {
                            val qr = scanned!!
                            scanned = null
                            model.connectServer(qr.server.toString(), qr.deviceCode)
                        }, enabled = !state.connectionBusy)
                        RetroButton("Cancelar", { scanned = null })
                    } else if (state.connectionStep == ConnectionStep.Server) {
                        Text("Usa el dominio o la IP con HTTPS de tu instalación.", color = Retro.Lavender, fontSize = 18.sp)
                        ConnectionField("Servidor", server, { server = it }, state.connectionBusy, keyboard = KeyboardType.Uri)
                        RetroButton(if (state.connectionBusy) "Comprobando…" else "Conectar", { model.connectServer(server) },
                            modifier = if (tv) Modifier.focusRequester(focus) else Modifier,
                            enabled = !state.connectionBusy && server.isNotBlank(), selected = true)
                    } else {
                        Text(state.serverAddress, color = Retro.Mint, fontSize = 17.sp)
                        if (tv) {
                            AuthorizationPanel(model, state)
                        } else {
                            ConnectionField("Usuario", username, { username = it }, state.connectionBusy)
                            ConnectionField("Contraseña", password, { password = it }, state.connectionBusy, secret = true)
                            RetroButton(if (state.connectionBusy) "Conectando…" else "Entrar", {
                                keyboard?.hide()
                                model.login(username, password)
                                password = ""
                            }, enabled = !state.connectionBusy && username.isNotBlank() && password.isNotEmpty(), selected = true)
                            if (state.serverFeatures.googleEnabled) RetroButton("Continuar con Google en el navegador", { model.browserLogin() }, enabled = !state.connectionBusy)
                            if (state.serverFeatures.registrationEnabled) RetroButton("Crear cuenta en este servidor", { model.browserLogin(true) }, enabled = !state.connectionBusy)
                            if (state.authorization != null) Text("Completa el acceso en el navegador y vuelve a la app. Tu perfil se conectará automáticamente.", color = Retro.Mint, fontSize = 17.sp)
                        }
                        RetroButton("Continuar sin cuenta", model::continueAsGuest, enabled = !state.connectionBusy)
                        RetroButton("Cambiar servidor", model::chooseServer, enabled = !state.connectionBusy)
                    }
                    if (!tv && scanned == null && context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY))
                        RetroButton("Escanear QR del dashboard", {
                            scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                                .setPrompt("Escanea el QR de Dashboard → Dispositivos").setBeepEnabled(false).setOrientationLocked(false))
                        }, enabled = !state.connectionBusy)
                    (state.connectionError ?: scanError)?.let { Text(it, color = Retro.Cream, fontSize = 18.sp) }
                }
            }
            if (tv && state.connectionStep == ConnectionStep.Login) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(28.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(.75f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("NostalgiaTV", color = Retro.Gold, fontFamily = RetroDisplay, fontSize = 36.sp)
                        Text("Conecta tu TV", color = Retro.Cream, fontSize = 24.sp)
                        Text("Servidor: ${state.serverAddress}", color = Retro.Mint, fontSize = 17.sp)
                        RetroButton("Continuar sin cuenta", model::continueAsGuest, enabled = !state.connectionBusy)
                        RetroButton("Cambiar servidor", model::chooseServer, enabled = !state.connectionBusy)
                    }
                    Column(Modifier.weight(1.2f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        AuthorizationPanel(model, state)
                        state.connectionError?.let { Text(it, color = Retro.Cream, fontSize = 17.sp) }
                    }
                }
            } else if (wide) Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(40.dp)) {
                RetroRoom(Modifier.weight(.8f).fillMaxHeight())
                Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.Center) { content() }
            } else Box(Modifier.fillMaxSize().widthIn(max = 560.dp), contentAlignment = Alignment.Center) { content() }
        }
    }
}

@Composable
private fun ConnectionField(label: String, value: String, change: (String) -> Unit, busy: Boolean,
    modifier: Modifier = Modifier, keyboard: KeyboardType = KeyboardType.Text, secret: Boolean = false) {
    OutlinedTextField(value, change, modifier.fillMaxWidth(), enabled = !busy, singleLine = true,
        label = { androidx.compose.material3.Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = if (secret) KeyboardType.Password else keyboard),
        visualTransformation = if (secret) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Retro.Cream, unfocusedTextColor = Retro.Cream,
            focusedBorderColor = Retro.Gold, unfocusedBorderColor = Retro.Lavender, focusedLabelColor = Retro.Gold,
            unfocusedLabelColor = Retro.Lavender, cursorColor = Retro.Mint))
}

@Composable
private fun AuthorizationPolling(model: AppViewModel, state: AppState) {
    val code = state.authorization
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(code) {
        if (code == null) return@LaunchedEffect
        val expires = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
            .parse(code.expiresAtUtc)?.time ?: 0L
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (System.currentTimeMillis() < expires) {
                delay(code.interval.coerceAtLeast(5) * 1000L)
                try { if (model.pollAuthorization(code.deviceCode)) return@repeatOnLifecycle }
                catch (exception: Exception) {
                    if (exception is CancellationException) throw exception
                    if (exception is ApiException && exception.status in listOf(401, 409, 410)) { model.authorizationError(true); break }
                    model.authorizationError(false)
                }
            }
            model.authorizationError(true)
        }
    }
}

@Composable
private fun AuthorizationPanel(model: AppViewModel, state: AppState) {
    val code = state.authorization
    if (code == null) Text("Preparando el código…", color = Retro.Lavender, fontSize = 18.sp)
    else {
        val page = requireNotNull(model.api.base.resolve("tv")).newBuilder().addQueryParameter("code", code.userCode).build().toString()
        val bitmap = remember(page) {
            val matrix = MultiFormatWriter().encode(page, BarcodeFormat.QR_CODE, 256, 256)
            android.graphics.Bitmap.createBitmap(256, 256, android.graphics.Bitmap.Config.ARGB_8888).apply {
                val pixels = IntArray(256 * 256) { index -> if (matrix[index % 256, index / 256]) android.graphics.Color.BLACK else android.graphics.Color.WHITE }
                setPixels(pixels, 0, 256, 0, 0, 256, 256)
            }.asImageBitmap()
        }
        Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Image(bitmap, "Escanea para autorizar esta pantalla", Modifier.size(128.dp).background(Color.White))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Escanea con tu celular", color = Retro.Cream, fontSize = 20.sp)
                Text(code.userCode, color = Retro.Mint, fontFamily = RetroDisplay, fontSize = 30.sp)
                Text("O abre /tv en este servidor e introduce el código.", color = Retro.Lavender, fontSize = 17.sp)
            }
        }
        Text("Solo reproducción e historial. Confirma el código en tu celular. Vence en diez minutos.", color = Retro.Lavender, fontSize = 17.sp)
        RetroButton("Generar otro código", model::createAuthorization, enabled = !state.connectionBusy)
    }
}
