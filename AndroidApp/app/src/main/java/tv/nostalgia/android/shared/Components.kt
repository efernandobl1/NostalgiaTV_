package tv.nostalgia.android.shared

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ── Text ──

@Composable
fun Txt(text: String, size: TextUnit, color: Color = Ntv.Fg, modifier: Modifier = Modifier, font: FontFamily = Sans,
    weight: FontWeight = FontWeight.Normal, tracking: TextUnit = TextUnit.Unspecified, lines: Int = Int.MAX_VALUE,
    lineHeight: TextUnit = TextUnit.Unspecified, align: TextAlign? = null) {
    Text(text, modifier, color = color, fontSize = size, fontFamily = font, fontWeight = weight, letterSpacing = tracking,
        maxLines = lines, overflow = TextOverflow.Ellipsis, lineHeight = lineHeight, textAlign = align)
}

/** Letter spacing given in em, as the design's tracking-[0.1em]. */
fun tracking(value: Float) = value.em

// ── Surfaces ──

/** Horizontal scanlines (1px every 3px) over a base color, as the design's repeating-linear-gradient. */
fun Modifier.scanlines(base: Color, alpha: Float = .04f): Modifier = drawBehind {
    drawRect(base)
    val period = 3.dp.toPx() / 1.5f
    drawRect(Brush.verticalGradient(0f to Color.White.copy(alpha = alpha), (1f / 3f) to Color.White.copy(alpha = alpha),
        (1.01f / 3f) to Color.Transparent, 1f to Color.Transparent, endY = period, tileMode = TileMode.Repeated))
}

/** Dark radial glow used by the live preview and video placeholders. */
fun Modifier.crtGlow(center: Color = Color(0xFF2C2A20), edge: Color = Ntv.Ink2, x: Float = .6f, y: Float = .4f, alpha: Float = .04f): Modifier = drawBehind {
    drawRect(Brush.radialGradient(listOf(center, edge), Offset(size.width * x, size.height * y), size.maxDimension * .7f))
    val period = 2.dp.toPx()
    drawRect(Brush.verticalGradient(0f to Color.White.copy(alpha = alpha), (1f / 3f) to Color.White.copy(alpha = alpha),
        (1.01f / 3f) to Color.Transparent, 1f to Color.Transparent, endY = period, tileMode = TileMode.Repeated))
}

/**
 * TV focus: the element grows slightly and gets the design's double ring (ink gap + cream or amber line).
 * On phones it is a plain clickable.
 */
@Composable
fun Modifier.focusRing(shape: Shape, onClick: () -> Unit, ring: Color = Ntv.Cream, scale: Float = 1.04f, enabled: Boolean = true,
    onFocus: () -> Unit = {}, onLongClick: (() -> Unit)? = null): Modifier {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val tv = LocalTvDevice.current
    LaunchedEffect(focused) { if (focused) onFocus() }
    val grow by animateFloatAsState(if (focused && tv) scale else 1f, label = "focus-scale")
    val clickable = if (onLongClick != null) Modifier.longClickable(interaction, enabled, onClick, onLongClick)
    else Modifier.clickable(interaction, indication = if (tv) null else androidx.compose.material3.ripple(), enabled = enabled, role = Role.Button, onClick = onClick)
    return this
        .graphicsLayer { scaleX = grow; scaleY = grow }
        .drawWithContent {
            drawContent()
            if (focused && tv) {
                val gap = 2.dp.toPx()
                val width = 2.dp.toPx()
                val expand = gap + width / 2
                val outline = shape.createOutline(Size(size.width + expand * 2, size.height + expand * 2), layoutDirection, this)
                translate(-expand, -expand) { drawOutline(outline, ring, style = Stroke(width)) }
            }
        }
        .then(clickable)
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
private fun Modifier.longClickable(interaction: MutableInteractionSource, enabled: Boolean, onClick: () -> Unit, onLongClick: () -> Unit) =
    this.then(Modifier.combinedClickable(interactionSource = interaction, indication = null, enabled = enabled, role = Role.Button,
        onLongClick = onLongClick, onClick = onClick))

// ── Buttons and chips ──

/** TV pill: 76px tall in the 1080p design (38dp). */
@Composable
fun TvPill(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, primary: Boolean = false, height: Dp = 38.dp,
    fontSize: TextUnit = 13.sp, icon: NtvIcon? = null, onFocus: () -> Unit = {}) {
    val shape = RoundedCornerShape(50)
    Row(modifier.focusRing(shape, onClick, onFocus = onFocus).height(height)
        .background(if (primary) Ntv.Amber else Ntv.Glass(.12f), shape).padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        icon?.let { Icon(it, 13.dp, if (primary) Ntv.OnAmber else Ntv.Fg) }
        Txt(label, fontSize, if (primary) Ntv.OnAmber else Ntv.Fg, weight = FontWeight.Bold, lines = 1)
    }
}

/** TV filter chip (64px tall in the design). */
@Composable
fun TvChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, height: Dp = 32.dp, onFocus: () -> Unit = {}) {
    val shape = RoundedCornerShape(50)
    Box(modifier.focusRing(shape, onClick, scale = 1.05f, onFocus = onFocus).height(height)
        .background(if (selected) Ntv.Amber else Ntv.Glass(.1f), shape).padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
        Txt(label, 11.sp, if (selected) Ntv.OnAmber else Ntv.Fg, weight = FontWeight.SemiBold, lines = 1)
    }
}

/** Phone chip: 40dp, 1dp border, amber when pressed. */
@Composable
fun MobileChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(20.dp)
    Box(modifier.clip(shape).focusRing(shape, onClick).heightIn(min = 40.dp)
        .background(if (selected) Ntv.Amber else Color.Transparent, shape)
        .border(1.dp, if (selected) Ntv.Amber else Ntv.Edge, shape).padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
        Txt(label, 13.sp, if (selected) Ntv.OnAmber else Ntv.Fg, weight = FontWeight.Medium, lines = 1)
    }
}

/** Phone button: amber primary, outlined secondary, or text-only danger. */
@Composable
fun MobileButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, primary: Boolean = false, danger: Boolean = false,
    enabled: Boolean = true, icon: NtvIcon? = null, height: Dp = 48.dp) {
    val shape = RoundedCornerShape(50)
    val content = when { primary -> Ntv.OnAmber; danger -> Ntv.Danger; else -> Ntv.Fg }
    Row(modifier.clip(shape).focusRing(shape, onClick, enabled = enabled).heightIn(min = height)
        .then(if (primary) Modifier.background(if (enabled) Ntv.Amber else Ntv.Edge, shape)
            else Modifier.border(1.dp, if (danger) Color(0xFF5A3A33) else Ntv.Edge, shape))
        .padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
        icon?.let { Icon(it, 16.dp, content) }
        Txt(label, 15.sp, if (enabled) content else Ntv.Dim, weight = if (primary) FontWeight.SemiBold else FontWeight.Medium, lines = 1)
    }
}

// ── Small pieces ──

@Composable
fun LiveBadge(text: String = "● EN VIVO", size: TextUnit = 10.sp, modifier: Modifier = Modifier) {
    Box(modifier.background(Ntv.Live, RoundedCornerShape(3.dp)).padding(horizontal = 6.dp, vertical = 2.dp)) {
        Txt(text, size, Ntv.OnLive, font = Mono, tracking = tracking(.1f), lines = 1)
    }
}

@Composable
fun ProgressLine(fraction: Float, modifier: Modifier = Modifier, height: Dp = 3.dp, track: Color = Color.White.copy(alpha = .12f), round: Boolean = true) {
    val shape = if (round) RoundedCornerShape(height / 2) else RoundedCornerShape(0.dp)
    Box(modifier.fillMaxWidth().height(height).background(track, shape)) {
        if (fraction > 0f) Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).fillMaxHeight().background(Ntv.Amber, shape))
    }
}

/** Glowing green channel number, like the OSD of a tube TV. */
@Composable
fun ChannelNumber(number: String, size: TextUnit, modifier: Modifier = Modifier, alpha: Float = 1f) {
    Txt(number, size, Ntv.Ok.copy(alpha = alpha), modifier, font = Display, weight = FontWeight.Bold, lines = 1,
        lineHeight = size)
}

@Composable
fun Avatar(name: String?, size: Dp, fontSize: TextUnit) {
    Box(Modifier.size(size).background(Ntv.Amber, CircleShape), contentAlignment = Alignment.Center) {
        Txt(initials(name), fontSize, Ntv.OnAmber, font = Display, weight = FontWeight.Bold, lines = 1)
    }
}

fun initials(name: String?): String = name?.filter { it.isLetterOrDigit() }?.take(2)?.uppercase()?.ifEmpty { null } ?: "TV"

@Composable
fun LogoWordmark(iconSize: Dp, textSize: TextUnit, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(iconSize / 3)) {
        Icon(NtvIcon.Logo, iconSize, Ntv.Amber)
        Txt("NOSTALGIA TV", textSize, font = Display, weight = FontWeight.Bold, tracking = tracking(.08f), lines = 1)
    }
}

/** Poster placeholder with scanlines; shows the series logo when there is one. */
@Composable
fun Poster(name: String, image: String?, modifier: Modifier = Modifier, radius: Dp = 8.dp, nameSize: TextUnit = 13.sp,
    onAir: Boolean = false, badgeSize: TextUnit = 8.sp, progress: Float = 0f, border: Boolean = false, padding: Dp = 9.dp) {
    val shape = RoundedCornerShape(radius)
    Box(modifier.clip(shape).scanlines(Ntv.Raised).then(if (border) Modifier.border(1.dp, Ntv.Line, shape) else Modifier)) {
        if (image != null) AsyncImage(image, contentDescription = null, contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize().padding(horizontal = padding * 1.4f).padding(top = padding * 2, bottom = padding * 4))
        if (onAir) Box(Modifier.align(Alignment.TopStart).padding(padding * .8f)) { LiveBadge("AL AIRE", badgeSize) }
        Txt(name, nameSize, font = Display, weight = FontWeight.Bold, lineHeight = nameSize * 1.1f, lines = 3,
            modifier = Modifier.align(Alignment.BottomStart).padding(padding))
        if (progress > 0f) ProgressLine(progress, Modifier.align(Alignment.BottomCenter), 3.dp, Color.White.copy(alpha = .08f), round = false)
    }
}

/** 16:9 episode thumbnail with the episode code and the watched portion. */
@Composable
fun EpisodeThumb(code: String, progress: Float, modifier: Modifier = Modifier, codeSize: TextUnit = 11.sp, radius: Dp = 6.dp) {
    val shape = RoundedCornerShape(radius)
    Box(modifier.aspectRatio(16f / 9f).clip(shape).scanlines(Ntv.Raised2)) {
        Txt(code, codeSize, Ntv.Amber, Modifier.padding(start = 6.dp, top = 4.dp), font = Mono, lines = 1)
        ProgressLine(progress, Modifier.align(Alignment.BottomCenter), 3.dp, Color.White.copy(alpha = .1f), round = false)
    }
}

/** Current local time, refreshed every minute. */
@Composable
fun rememberClock(): String {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(60_000 - System.currentTimeMillis() % 60_000); now = System.currentTimeMillis() } }
    return clock(now)
}

fun clock(millis: Long): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(millis))

fun minutes(fromMillis: Long, toMillis: Long): Int = ((toMillis - fromMillis) / 60_000).toInt().coerceAtLeast(0)

/** Empty, loading and error states share one quiet message block. */
@Composable
fun Notice(text: String, modifier: Modifier = Modifier, action: String? = null, onAction: () -> Unit = {}, size: TextUnit = 14.sp) {
    Column(modifier.padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Txt(text, size, Ntv.Muted)
        if (action != null) {
            if (LocalTvDevice.current) TvPill(action, onAction) else MobileButton(action, onAction)
        }
    }
}

fun Modifier.panel(color: Color = Ntv.Panel, radius: Dp = 12.dp, border: BorderStroke? = null): Modifier {
    val shape = RoundedCornerShape(radius)
    return this.clip(shape).background(color, shape).then(if (border != null) Modifier.border(border, shape) else Modifier)
}

/** 1dp separator on the top (or bottom) edge, like border-t / border-b. */
fun Modifier.topLine(color: Color, bottom: Boolean = false): Modifier = drawBehind {
    val y = if (bottom) size.height - .5.dp.toPx() else 0f
    drawLine(color, Offset(0f, y), Offset(size.width, y), 1.dp.toPx())
}
