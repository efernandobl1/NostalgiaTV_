package tv.nostalgia.android.features

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import tv.nostalgia.android.core.ServerAddress
import tv.nostalgia.android.core.ServerQr
import tv.nostalgia.android.shared.*

/** Phone connection: server address, then "Iniciar sesión" or continue without an account. */
@Composable
fun MobileConnection(model: AppViewModel, state: AppState) {
    val context = LocalContext.current
    val keyboard = LocalSoftwareKeyboardController.current
    var server by rememberSaveable(state.serverAddress) { mutableStateOf(state.serverAddress) }
    var username by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var scanned by remember { mutableStateOf<ServerQr?>(null) }
    var scanError by remember { mutableStateOf<String?>(null) }
    val scanner = rememberLauncherForActivityResult(ScanContract()) { result ->
        result.contents?.let { contents ->
            try { scanned = ServerAddress.readQr(contents); scanError = null }
            catch (_: Exception) { scanError = "Este QR no es válido. Genera uno desde la web en Vincular TV." }
        }
    }
    BackHandler(state.connectionStep == ConnectionStep.Login || scanned != null) { if (scanned != null) scanned = null else model.chooseServer() }
    AuthorizationPolling(model, state.authorization.takeIf { state.connectionStep == ConnectionStep.Login })
    val login = state.connectionStep == ConnectionStep.Login && scanned == null
    Column(Modifier.fillMaxSize().scanlines(Ntv.Ink, .025f).safeDrawingPadding().imePadding().verticalScroll(rememberScrollState())
        .padding(start = 20.dp, end = 20.dp, top = 48.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(NtvIcon.Logo, 56.dp, Ntv.Amber)
            Txt("NOSTALGIA TV", 22.sp, font = Display, weight = FontWeight.Bold, tracking = tracking(.08f))
            Txt("Tus clásicos, al aire otra vez.", 14.sp, Ntv.Muted, align = TextAlign.Center)
        }
        when {
            scanned != null -> {
                Txt("Vincular con este servidor", 26.sp, font = Display, weight = FontWeight.Bold)
                Txt(scanned!!.server.toString(), 15.sp, Ntv.Amber, font = Mono)
                Txt("Confirma que es tu servidor. El QR caduca en dos minutos y solo se puede usar una vez.", 14.sp, Ntv.Muted, lineHeight = 21.sp)
                MobileButton("Conectar este teléfono", { val qr = scanned!!; scanned = null; model.connectServer(qr.server.toString(), qr.deviceCode) },
                    Modifier.fillMaxWidth(), primary = true, enabled = !state.connectionBusy, height = 52.dp)
                MobileButton("Cancelar", { scanned = null }, Modifier.fillMaxWidth())
            }
            !login -> {
                Txt("Conecta tu servidor", 26.sp, font = Display, weight = FontWeight.Bold)
                Field("Servidor", server, { server = it }, KeyboardType.Uri, enabled = !state.connectionBusy) { model.connectServer(server) }
                MobileButton(if (state.connectionBusy) "Comprobando…" else "Conectar", { model.connectServer(server) }, Modifier.fillMaxWidth(),
                    primary = true, enabled = !state.connectionBusy && server.isNotBlank(), height = 52.dp)
                if (context.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_CAMERA_ANY))
                    MobileButton("Escanear QR de la web", {
                        scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Escanea el QR de tu servidor")
                            .setBeepEnabled(false).setOrientationLocked(false))
                    }, Modifier.fillMaxWidth(), icon = NtvIcon.Scan, enabled = !state.connectionBusy)
            }
            else -> {
                Txt("Iniciar sesión", 26.sp, font = Display, weight = FontWeight.Bold)
                Field("Usuario", username, { username = it }, enabled = !state.connectionBusy)
                Field("Contraseña", password, { password = it }, KeyboardType.Password, secret = true, enabled = !state.connectionBusy) {
                    keyboard?.hide(); model.login(username, password); password = ""
                }
                MobileButton(if (state.connectionBusy) "Conectando…" else "Ingresar", { keyboard?.hide(); model.login(username, password); password = "" },
                    Modifier.fillMaxWidth(), primary = true, enabled = !state.connectionBusy && username.isNotBlank() && password.isNotEmpty(), height = 52.dp)
                if (state.serverFeatures.googleEnabled) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.weight(1f).height(1.dp).background(Ntv.Line))
                        Txt("O", 11.sp, Ntv.Dim, font = Mono)
                        Box(Modifier.weight(1f).height(1.dp).background(Ntv.Line))
                    }
                    MobileButton("Continuar con Google", { model.browserLogin() }, Modifier.fillMaxWidth(), icon = NtvIcon.Google,
                        enabled = !state.connectionBusy, height = 52.dp)
                }
                if (state.authorization != null) Txt("Completa el acceso en el navegador y vuelve a la app: tu perfil se conectará solo.", 13.sp, Ntv.Ok)
                Box(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(enabled = !state.connectionBusy) { model.continueAsGuest() },
                    contentAlignment = Alignment.Center) { Txt("Ver canales sin cuenta", 15.sp, Ntv.Fg2) }
                Spacer(Modifier.height(12.dp))
                if (state.serverFeatures.registrationEnabled) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    Txt("¿No tienes cuenta? ", 14.sp, Ntv.Muted)
                    Txt("Crear cuenta", 14.sp, Ntv.Amber, Modifier.clickable { model.browserLogin(register = true) })
                }
                Row(Modifier.fillMaxWidth().clickable { model.chooseServer() }, horizontalArrangement = Arrangement.Center) {
                    Txt("${state.serverAddress.removePrefix("https://").trimEnd('/')} · Cambiar servidor", 12.sp, Ntv.Dim, lines = 1)
                }
            }
        }
        (state.connectionError ?: scanError)?.let { Txt(it, 14.sp, Ntv.Danger) }
    }
}

@Composable
private fun Field(label: String, value: String, onChange: (String) -> Unit, type: KeyboardType = KeyboardType.Text, secret: Boolean = false,
    enabled: Boolean = true, onDone: (() -> Unit)? = null) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(12.dp)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Txt(label, 13.sp, Ntv.Muted)
        BasicTextField(value, { onChange(it.take(200)) }, Modifier.fillMaxWidth().heightIn(min = 52.dp).onFocusChanged { focused = it.isFocused }
            .semantics { contentDescription = label }
            .background(Ntv.Panel, shape).border(if (focused) 2.dp else 1.dp, if (focused) Ntv.Amber else Ntv.Edge, shape)
            .padding(horizontal = 14.dp, vertical = 15.dp), enabled = enabled, singleLine = true,
            textStyle = TextStyle(color = Ntv.Fg, fontSize = 16.sp, fontFamily = Sans), cursorBrush = SolidColor(Ntv.Amber),
            visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = type, imeAction = if (onDone != null) ImeAction.Go else ImeAction.Next),
            keyboardActions = KeyboardActions(onGo = { onDone?.invoke() }))
    }
}
