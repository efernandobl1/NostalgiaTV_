"""Extract a board's body into an Angular template, prefixing data keys.

usage: python page.py <board.html> <out.html> <prefix> <key1,key2,...> [start_marker] [end_marker]
- start defaults to the first element after the page <header> inside <main>; end to </main>.
"""
import re, sys

src, out, prefix, keys = sys.argv[1], sys.argv[2], sys.argv[3], [k for k in sys.argv[4].split(',') if k]
start = sys.argv[5] if len(sys.argv) > 5 else None
end = sys.argv[6] if len(sys.argv) > 6 else '</main>'
t = open(src, encoding='utf-8').read()
if start:
    a = t.find(start)
else:
    h = t.find('</header>', t.find('<main'))
    a = h + len('</header>')
b = t.rfind(end) if end else len(t)
body = t[a:b].strip('\n')

key_re = re.compile(r'(?<![\w.$])(' + '|'.join(map(re.escape, keys)) + r')\b') if keys else None


def fix(expr):
    return key_re.sub(prefix + r'.\1', expr) if key_re else expr


# expressions inside {{ }}, bindings, control flow
body = re.sub(r'\{\{(.*?)\}\}', lambda m: '{{' + fix(m.group(1)) + '}}', body)
body = re.sub(r'(\[[\w.%-]+\]|\([\w.]+\))="([^"]*)"', lambda m: m.group(1) + '="' + fix(m.group(2)) + '"', body)
body = re.sub(r'@for \((\w+) of ([^;]+);', lambda m: f'@for ({m.group(1)} of {fix(m.group(2))};', body)
body = re.sub(r'@if \((.*?)\) \{', lambda m: '@if (' + fix(m.group(1)) + ') {', body)

lines = body.split('\n')
ind = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
open(out, 'w', encoding='utf-8').write('\n'.join(l[ind:] for l in lines).strip() + '\n')
