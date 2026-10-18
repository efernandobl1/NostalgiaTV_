package tv.nostalgia.android.features

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import tv.nostalgia.android.core.ApiException
import tv.nostalgia.android.core.AuthorizationCode
import tv.nostalgia.android.shared.*
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/** Connection flow on the TV: server address first, then the sign-in code. */
@Composable
fun TvConnection(model: AppViewModel, state: AppState) {
    LaunchedEffect(state.connectionStep) {
        if (state.connectionStep == ConnectionStep.Login && state.authorization == null && !state.connectionBusy) model.createAuthorization()
    }
    Box(Modifier.fillMaxSize().scanlines(Ntv.Ink2, .02f)) {
        if (state.connectionStep == ConnectionStep.Server) TvServer(model, state) else TvPair(model, state)
    }
}

@Composable
private fun TvServer(model: AppViewModel, state: AppState) {
    var server by remember(state.serverAddress) { mutableStateOf(state.serverAddress) }
    var focused by remember { mutableStateOf(false) }
    val field = remember { FocusRequester() }
    LaunchedEffect(Unit) { delay(50); runCatching { field.requestFocus() } }
    Column(Modifier.fillMaxSize().padding(horizontal = 60.dp, vertical = 36.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        LogoWordmark(24.dp, 15.sp)
        Spacer(Modifier.weight(1f))
        Txt("Conecta tu servidor", 36.sp, font = Display, weight = FontWeight.Bold, lineHeight = 38.sp)
        Txt("Escribe el dominio o la IP con HTTPS de tu instalación de NostalgiaTV.", 16.sp, Ntv.Fg2)
        val shape = RoundedCornerShape(10.dp)
        BasicTextField(server, { server = it.take(200) }, Modifier.width(520.dp).focusRequester(field).onFocusChanged { focused = it.isFocused }
            .background(Ntv.Panel2, shape).border(if (focused) 2.dp else 1.dp, if (focused) Ntv.Amber else Ntv.Edge, shape)
            .padding(horizontal = 18.dp, vertical = 14.dp), singleLine = true, enabled = !state.connectionBusy,
            textStyle = TextStyle(color = Ntv.Fg, fontSize = 18.sp, fontFamily = Mono), cursorBrush = SolidColor(Ntv.Amber),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { model.connectServer(server) }))
        TvPill(if (state.connectionBusy) "Comprobando…" else "Conectar", { if (server.isNotBlank()) model.connectServer(server) }, primary = true)
        state.connectionError?.let { Txt(it, 14.sp, Ntv.Danger) }
        Spacer(Modifier.weight(1f))
    }
}

/** "Vincula este televisor": the TV shows a code and a QR; the account approves it on the web at /vincular. */
@Composable
fun TvPair(model: AppViewModel, state: AppState) {
    val connected = state.connectionStep == ConnectionStep.Ready
    val linkedUser = state.session?.username.takeIf { connected && state.session?.accountLinked == true }
    val code = state.authorization
    AuthorizationPolling(model, code)
    val action = remember { FocusRequester() }
    LaunchedEffect(code?.userCode, linkedUser) { delay(50); runCatching { action.requestFocus() } }
    Column(Modifier.fillMaxSize().scanlines(Ntv.Ink2, .02f).padding(horizontal = 60.dp, vertical = 36.dp)) {
        LogoWordmark(24.dp, 15.sp)
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(60.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                if (linkedUser != null && code == null) {
                    Txt("Este televisor ya está vinculado", 36.sp, font = Display, weight = FontWeight.Bold, lineHeight = 38.sp)
                    Txt("Reproduce con el perfil de $linkedUser: el historial se sincroniza con la web y el teléfono.", 16.sp, Ntv.Fg2, lineHeight = 22.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        TvPill("Vincular otra cuenta", model::createAuthorization, Modifier.focusRequester(action))
                        TvPill("Ir a canales", { model.navigate(Screen.Home) })
                    }
                    return@Column
                }
                Txt("Vincula este televisor", 36.sp, font = Display, weight = FontWeight.Bold, lineHeight = 38.sp)
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Step("1", buildAnnotatedString {
                        append("En tu teléfono o computadora abre ")
                        withStyle(SpanStyle(color = Ntv.Amber, fontFamily = Mono, fontWeight = FontWeight.Medium)) {
                            append(state.serverAddress.removePrefix("https://").trimEnd('/') + "/vincular")
                        }
                    })
                    Step("2", buildAnnotatedString { append("Inicia sesión y escribe este código:") })
                }
                Box(Modifier.background(Ntv.Panel2, RoundedCornerShape(10.dp)).border(1.5.dp, Ntv.Amber, RoundedCornerShape(10.dp))
                    .padding(horizontal = 22.dp, vertical = 14.dp)) {
                    Txt(code?.userCode ?: "···-···-···-···", 36.sp, font = Mono, weight = FontWeight.Medium, tracking = tracking(.12f), lines = 1)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    Box(Modifier.size(13.dp).background(Ntv.Amber.copy(alpha = .2f), CircleShape), contentAlignment = Alignment.Center) {
                        Box(Modifier.size(7.dp).background(Ntv.Amber, CircleShape))
                    }
                    Txt(state.connectionError ?: code?.let { "Esperando confirmación · el código vence en ${countdown(it)}" } ?: "Preparando el código…",
                        13.sp, if (state.connectionError != null) Ntv.Danger else Ntv.Muted)
                }
                if (!connected) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    TvPill("Continuar sin cuenta", model::continueAsGuest, height = 32.dp, fontSize = 11.sp)
                    TvPill("Cambiar servidor", model::chooseServer, height = 32.dp, fontSize = 11.sp)
                }
            }
            Column(Modifier.width(210.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                val page = code?.let { model.api.base.resolve("vincular")?.newBuilder()?.addQueryParameter("code", it.userCode)?.build()?.toString() }
                val qr = remember(page) { page?.let(::qrBitmap) }
                Box(Modifier.size(180.dp).background(Ntv.Fg, RoundedCornerShape(12.dp)).padding(14.dp)) {
                    if (qr != null) Image(qr, "Escanea para vincular este televisor", Modifier.fillMaxSize())
                }
                Txt("O escanea con la cámara del teléfono", 12.sp, Ntv.Muted, align = androidx.compose.ui.text.style.TextAlign.Center)
                TvPill("Obtener otro código", model::createAuthorization, Modifier.focusRequester(action), height = 36.dp)
            }
        }
    }
}

@Composable
private fun Step(number: String, text: androidx.compose.ui.text.AnnotatedString) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Txt(number, 16.sp, Ntv.Amber, font = Display, weight = FontWeight.Bold)
        androidx.compose.material3.Text(text, color = Ntv.Fg, fontSize = 16.sp, fontFamily = Sans, lineHeight = 21.sp)
    }
}

@Composable
private fun countdown(code: AuthorizationCode): String {
    val expires = remember(code) { parseUtc(code.expiresAtUtc) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(code) { while (true) { delay(1000); now = System.currentTimeMillis() } }
    val left = ((expires - now) / 1000).coerceAtLeast(0)
    return "%d:%02d".format(left / 60, left % 60)
}

/** Polls the device code until the account approves it on the web, then the TV enters the catalog. */
@Composable
fun AuthorizationPolling(model: AppViewModel, code: AuthorizationCode?) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(code) {
        if (code == null) return@LaunchedEffect
        val expires = parseUtc(code.expiresAtUtc)
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (System.currentTimeMillis() < expires) {
                delay(code.interval.coerceAtLeast(5) * 1000L)
                try { if (model.pollAuthorization(code.deviceCode)) return@repeatOnLifecycle }
                catch (exception: Exception) {
                    if (exception is CancellationException) throw exception
                    if (exception is ApiException && exception.status in listOf(401, 409, 410)) { model.authorizationError(true); return@repeatOnLifecycle }
                    if (exception is ApiException && exception.status == 429) continue
                    model.authorizationError(false)
                }
            }
            model.authorizationError(true)
        }
    }
}

fun parseUtc(value: String): Long = runCatching {
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(value)?.time
}.getOrNull() ?: 0L

fun qrBitmap(text: String): androidx.compose.ui.graphics.ImageBitmap {
    val size = 256
    val matrix = MultiFormatWriter().encode(text, BarcodeFormat.QR_CODE, size, size)
    return android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888).apply {
        val pixels = IntArray(size * size) { index -> if (matrix[index % size, index / size]) 0xFF0B0B09.toInt() else 0xFFECE8DC.toInt() }
        setPixels(pixels, 0, size, 0, 0, size, size)
    }.asImageBitmap()
}
