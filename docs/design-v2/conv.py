"""Convert design .dc.html artboards into Angular-template drafts with Tailwind classes.

- inline style -> Tailwind utilities (design tokens where the value matches)
- dynamic values ({{x}}) -> [style.prop]="x"
- sc-for/sc-if -> @for/@if ; sc-raw-* -> plain tags
- sc-camel-on-click -> (click)
Output: conv/<file>.html (template) + conv/<file>.js (logic class)
"""
import re, glob, os, sys, html

COLORS = {
    '#0E0E0C': 'ink', '#0B0B09': 'ink-2', '#050504': 'ink-3', '#121210': 'rail', '#171714': 'panel',
    '#1A1A16': 'panel-2', '#1F1F1B': 'raised', '#24241F': 'raised-2', '#2C2C27': 'line', '#3A3A33': 'edge',
    '#4A4A42': 'edge-2', '#ECE8DC': 'fg', '#D6D2C6': 'fg-2', '#A29E91': 'muted', '#8C887D': 'dim',
    '#5E5B52': 'faint', '#FFB547': 'amber', '#FFD08A': 'amber-hi', '#1A1206': 'on-amber', '#FFF3DA': 'cream',
    '#24231C': 'amber-wash', '#FF8A80': 'danger', '#FF6B5E': 'live', '#1A0906': 'on-live', '#8BE08F': 'ok',
    '#6FD0EA': 'info', '#B8A6FF': 'violet',
}
FONTS = {"'Chakra Petch'": 'font-display', "'IBM Plex Mono'": 'font-mono', "'IBM Plex Sans'": 'font-sans'}
RADII = {'0': 'rounded-none', '2px': 'rounded-xs', '4px': 'rounded-sm', '6px': 'rounded-md', '8px': 'rounded-lg',
         '12px': 'rounded-xl', '16px': 'rounded-2xl', '24px': 'rounded-3xl', '50%': 'rounded-full', '999px': 'rounded-full'}
WEIGHT = {'400': 'font-normal', '500': 'font-medium', '600': 'font-semibold', '700': 'font-bold'}


def arb(v):
    return v.strip().replace(' ', '_')


def sp(v):
    """spacing value -> tailwind suffix"""
    v = v.strip()
    if v == '0':
        return '0'
    if v == 'auto':
        return 'auto'
    m = re.fullmatch(r'(-?\d+(?:\.\d+)?)px', v)
    if m:
        n = float(m.group(1)) / 4
        if n * 2 == int(n * 2):
            s = ('%g' % n)
            return s
    return '[' + arb(v) + ']'


def col(v):
    u = v.strip().upper()
    if u in COLORS:
        return COLORS[u]
    if v.strip() in ('transparent', 'inherit', 'currentColor', 'currentcolor', 'white', 'black'):
        return {'currentColor': 'current', 'currentcolor': 'current'}.get(v.strip(), v.strip())
    return '[' + arb(v) + ']'


def box(prefix, v):
    parts = v.split()
    if len(parts) == 1:
        return [f'{prefix}-{sp(parts[0])}']
    if len(parts) == 2:
        y, x = parts
        if y == x:
            return [f'{prefix}-{sp(y)}']
        return [f'{prefix}y-{sp(y)}', f'{prefix}x-{sp(x)}']
    if len(parts) == 3:
        t, x, b = parts
        return [f'{prefix}t-{sp(t)}', f'{prefix}x-{sp(x)}', f'{prefix}b-{sp(b)}']
    t, r, b, l = parts[:4]
    out = []
    if t == b:
        out.append(f'{prefix}y-{sp(t)}')
    else:
        out += [f'{prefix}t-{sp(t)}', f'{prefix}b-{sp(b)}']
    if r == l:
        out.append(f'{prefix}x-{sp(r)}')
    else:
        out += [f'{prefix}r-{sp(r)}', f'{prefix}l-{sp(l)}']
    return out


def border(side, v):
    side_cls = {'': 'border', 'top': 'border-t', 'bottom': 'border-b', 'left': 'border-l', 'right': 'border-r'}[side]
    v = v.strip()
    if v in ('0', 'none'):
        return [side_cls + '-0']
    m = re.fullmatch(r'(\d+(?:\.\d+)?px)\s+(solid|dashed|dotted)\s+(.+)', v)
    if m:
        w, style, c = m.groups()
        out = [side_cls if w == '1px' else f'{side_cls}-[{w}]']
        if style != 'solid':
            out.append('border-' + style)
        out.append('border-' + col(c))
        return out
    return [f'[{"border" if not side else "border-" + side}:{arb(v)}]']


def conv_decl(prop, val):
    p, v = prop.strip().lower(), val.strip()
    if not v:
        return []
    if p == 'display':
        return [{'flex': 'flex', 'inline-flex': 'inline-flex', 'grid': 'grid', 'block': 'block', 'none': 'hidden',
                 'inline-block': 'inline-block', 'inline': 'inline', 'contents': 'contents'}.get(v, f'[display:{v}]')]
    if p == 'flex-direction':
        return [{'column': 'flex-col', 'row': 'flex-row', 'column-reverse': 'flex-col-reverse'}.get(v, f'[flex-direction:{v}]')]
    if p == 'flex-wrap':
        return [{'wrap': 'flex-wrap', 'nowrap': 'flex-nowrap'}.get(v, f'[flex-wrap:{v}]')]
    if p == 'align-items':
        return ['items-' + {'center': 'center', 'flex-end': 'end', 'flex-start': 'start', 'baseline': 'baseline',
                             'stretch': 'stretch', 'end': 'end', 'start': 'start'}.get(v, v)]
    if p == 'align-self':
        return ['self-' + {'center': 'center', 'flex-end': 'end', 'flex-start': 'start', 'stretch': 'stretch', 'end': 'end', 'start': 'start'}.get(v, v)]
    if p == 'justify-content':
        return ['justify-' + {'space-between': 'between', 'center': 'center', 'flex-end': 'end', 'flex-start': 'start',
                               'space-around': 'around', 'end': 'end', 'start': 'start'}.get(v, v)]
    if p == 'gap':
        parts = v.split()
        if len(parts) == 2:
            return [f'gap-y-{sp(parts[0])}', f'gap-x-{sp(parts[1])}']
        return [f'gap-{sp(v)}']
    if p in ('row-gap', 'column-gap'):
        return [('gap-y-' if p == 'row-gap' else 'gap-x-') + sp(v)]
    if p == 'padding':
        return box('p', v)
    if p.startswith('padding-'):
        return [{'top': 'pt', 'bottom': 'pb', 'left': 'pl', 'right': 'pr'}[p[8:]] + '-' + sp(v)]
    if p == 'margin':
        return box('m', v)
    if p.startswith('margin-'):
        return [{'top': 'mt', 'bottom': 'mb', 'left': 'ml', 'right': 'mr'}[p[7:]] + '-' + sp(v)]
    if p in ('width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'):
        pre = {'width': 'w', 'height': 'h', 'min-width': 'min-w', 'min-height': 'min-h', 'max-width': 'max-w', 'max-height': 'max-h'}[p]
        if v == '100%':
            return [pre + '-full']
        if v == '100vh':
            return [pre + '-screen']
        if v in ('auto', 'fit-content', 'min-content', 'max-content'):
            return [pre + '-' + {'fit-content': 'fit', 'min-content': 'min', 'max-content': 'max'}.get(v, v)]
        return [pre + '-' + sp(v)]
    if p == 'font-size':
        return [f'text-[{v}]']
    if p == 'font-weight':
        return [WEIGHT.get(v, f'font-[{v}]')]
    if p == 'font-family':
        for k, c in FONTS.items():
            if k in v:
                return [c]
        if 'inherit' in v:
            return ['[font-family:inherit]']
        return [f'[font-family:{arb(v)}]']
    if p == 'font':
        if v == 'inherit':
            return ['[font:inherit]']
        return [f'[font:{arb(v)}]']
    if p == 'letter-spacing':
        return [f'tracking-[{v}]']
    if p == 'line-height':
        return [f'leading-[{v}]' if not re.fullmatch(r'\d+(\.\d+)?', v) else f'leading-[{v}]']
    if p == 'color':
        return ['text-' + col(v)]
    if p in ('background', 'background-color'):
        if re.fullmatch(r'#[0-9A-Fa-f]{3,8}|transparent|rgba?\([^)]*\)|inherit', v):
            return ['bg-' + col(v)]
        return [f'[background:{arb(v)}]']
    if p == 'border':
        return border('', v)
    if p.startswith('border-') and p[7:] in ('top', 'bottom', 'left', 'right'):
        return border(p[7:], v)
    if p == 'border-radius':
        return [RADII.get(v, f'rounded-[{arb(v)}]')]
    if p == 'box-sizing':
        return []  # preflight already border-box
    if p == 'cursor':
        return [f'cursor-{v}']
    if p == 'position':
        return [v]
    if p in ('top', 'left', 'right', 'bottom', 'inset'):
        return [f'{p}-{sp(v)}']
    if p == 'z-index':
        return [f'z-[{v}]']
    if p == 'flex':
        return [{'1': 'flex-1', 'none': 'flex-none', '0 0 auto': 'flex-none', 'auto': 'flex-auto'}.get(v, f'flex-[{arb(v)}]')]
    if p == 'flex-shrink':
        return ['shrink-0' if v == '0' else f'shrink-[{v}]']
    if p == 'grid-template-columns':
        return [f'grid-cols-[{arb(v)}]']
    if p == 'text-decoration':
        return ['no-underline' if v == 'none' else 'underline']
    if p == 'text-align':
        return ['text-' + v]
    if p in ('overflow', 'overflow-x', 'overflow-y'):
        return [p + '-' + v]
    if p == 'white-space':
        return ['whitespace-' + v]
    if p == 'text-overflow':
        return ['text-ellipsis' if v == 'ellipsis' else f'[text-overflow:{v}]']
    if p == 'opacity':
        return [f'opacity-[{v}]']
    if p == 'aspect-ratio':
        return [f'aspect-[{arb(v).replace("/", "/")}]']
    if p == 'box-shadow':
        return [f'shadow-[{arb(v)}]']
    if p == 'text-transform':
        return [v]
    if p == 'pointer-events':
        return ['pointer-events-' + v]
    if p == 'resize':
        return ['resize-none' if v == 'none' else 'resize-y' if v == 'vertical' else f'[resize:{v}]']
    if p == 'outline':
        return ['outline-none' if v in ('none', '0') else f'[outline:{arb(v)}]']
    if p == 'list-style':
        return ['list-none' if v == 'none' else f'[list-style:{arb(v)}]']
    if p == 'vertical-align':
        return ['align-' + v]
    if p == 'transform':
        return [f'[transform:{arb(v)}]']
    if p == 'accent-color':
        return ['accent-' + col(v)]
    if p == 'color-scheme':
        return [f'[color-scheme:{v}]']
    return [f'[{p}:{arb(v)}]']


def conv_style(style):
    classes, binds = [], []
    for decl in style.split(';'):
        if ':' not in decl:
            continue
        prop, val = decl.split(':', 1)
        val = html.unescape(val).strip()
        if '{{' in val:
            # whole value dynamic, or partial (e.g. "{{c.pct}}%")
            m = re.fullmatch(r'\{\{\s*([^}]+?)\s*\}\}(%|px)?', val)
            if m:
                expr, unit = m.groups()
                key = prop.strip() + ('.' + unit.replace('%', '%') if unit else '')
                binds.append(f'[style.{prop.strip()}{"." + unit if unit else ""}]="{expr}"')
            else:
                expr = re.sub(r'\{\{\s*([^}]+?)\s*\}\}', r"' + \1 + '", val)
                binds.append(f'[style.{prop.strip()}]="\'{expr}\'"')
            continue
        classes += conv_decl(prop, val)
    # collapse overflow-hidden + text-ellipsis + whitespace-nowrap into truncate
    s = set(classes)
    if {'overflow-hidden', 'text-ellipsis', 'whitespace-nowrap'} <= s:
        classes = [c for c in classes if c not in ('overflow-hidden', 'text-ellipsis', 'whitespace-nowrap')] + ['truncate']
    return classes, binds


ROUTES = {
    'Main': '/admin', 'Schedule': '/admin/programacion', 'Channels': '/admin/canales', 'Series': '/admin/series',
    'Interludes': '/admin/interludios', 'Viewers': '/admin/espectadores', 'Comments': '/admin/comentarios',
    'Media': '/admin/media', 'Access': '/admin/acceso', 'Settings': '/admin/ajustes',
    'Login': '/login', 'SignUp': '/registro', 'Logout': '/sesion-cerrada', 'ForgotPassword': '/recuperar',
    'ResetPassword': '/nueva-contrasena', 'PubHome': '/', 'PubCatalog': '/series', 'PubSeries': '/series/1',
    'PubChannel': '/canal/5', 'PubWatch': '/ver/5', 'PubFullscreen': '/ver/5/pantalla-completa', 'PubGuide': '/guia',
    'PubProfile': '/perfil', 'PubPair': '/vincular',
}


def conv_tag_attrs(attrs):
    out_cls, out = [], []
    for m in re.finditer(r'([a-zA-Z_:@\-]+)(?:="([^"]*)")?', attrs):
        name, val = m.group(1), m.group(2)
        if name == 'style':
            c, b = conv_style(val or '')
            out_cls += c
            out += b
        elif name == 'sc-camel-on-click':
            expr = re.sub(r'^\{\{\s*|\s*\}\}$', '', val)
            out.append(f'(click)="{expr}()"')
        elif name == 'href' and val is not None:
            mm = re.fullmatch(r'(\w+)\.dc\.html', val)
            if mm:
                out.append(f'routerLink="{ROUTES.get(mm.group(1), "/" + mm.group(1))}"')
            elif '{{' in val:
                out.append(f'[routerLink]="{re.sub(r"^\{\{\s*|\s*\}\}$", "", val)}"')
            else:
                out.append(f'href="{val}"')
        elif name.startswith('hint-'):
            continue
        elif val is not None and '{{' in val:
            expr = re.sub(r'^\{\{\s*|\s*\}\}$', '', val)
            if re.fullmatch(r'\{\{[^}]+\}\}', val):
                out.append(f'[attr.{name}]="{expr}"')
            else:
                out.append(f'{name}="{val}"')
        elif val is None:
            out.append(name)
        else:
            out.append(f'{name}="{val}"')
    if out_cls:
        out.insert(0, 'class="' + ' '.join(dict.fromkeys(out_cls)) + '"')
    return (' ' + ' '.join(out)) if out else ''


def convert(src):
    body = re.search(r'</helmet>(.*)</x-dc>', src, re.S)
    body = body.group(1) if body else src
    helmet = re.search(r'<helmet>(.*?)</helmet>', src, re.S)
    css = ''
    if helmet:
        css = '\n'.join(s for s in re.findall(r'<style>(.*?)</style>', helmet.group(1), re.S) if s.strip())

    def tag(m):
        closing, name, attrs, selfclose = m.group(1), m.group(2), m.group(3) or '', m.group(4)
        if name == 'sc-for':
            if closing:
                return '}'
            lst = re.search(r'list="\{\{\s*([^}]+?)\s*\}\}"', attrs).group(1)
            alias = re.search(r'as="([^"]+)"', attrs).group(1)
            return f'@for ({alias} of {lst}; track $index) {{'
        if name == 'sc-if':
            if closing:
                return '}'
            val = re.search(r'value="\{\{\s*([^}]+?)\s*\}\}"', attrs).group(1)
            return f'@if ({val}) {{'
        if name.startswith('sc-raw-'):
            name = name[7:]
        if name == 'dc-import':
            if closing:
                return ''
            return f'<!-- DC-IMPORT {attrs.strip()} -->'
        if closing:
            return f'</{name}>'
        return f'<{name}{conv_tag_attrs(attrs)}{" /" if selfclose else ""}>'

    out = re.sub(r'<(/?)([a-zA-Z][\w-]*)((?:\s+[^>]*?)?)\s*(/?)>', tag, body)
    return out.strip(), css


def main(indir, outdir):
    os.makedirs(outdir, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(indir, '*.html'))):
        src = open(f, encoding='utf-8').read()
        tpl, css = convert(src)
        logic = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', src, re.S)
        props = re.search(r'data-props=(?:"([^"]*)"|\'([^\']*)\')', src)
        base = os.path.splitext(os.path.basename(f))[0]
        title = re.search(r'<title>(.*?)</title>', src)
        with open(os.path.join(outdir, base + '.html'), 'w', encoding='utf-8') as o:
            o.write(f'<!-- {title.group(1) if title else base} -->\n')
            if css:
                o.write('<!-- CSS:\n' + css.strip() + '\n-->\n')
            o.write(tpl + '\n')
        with open(os.path.join(outdir, base + '.js'), 'w', encoding='utf-8') as o:
            if props:
                o.write('// props: ' + html.unescape(props.group(1) or props.group(2)) + '\n')
            o.write((logic.group(1).strip() if logic else '') + '\n')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
