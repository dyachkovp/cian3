#!/usr/bin/env python3
"""Rebuild the research snapshot from public Cian source maps; never execute them."""
import argparse
import hashlib
import html
import json
import re
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATE = '2026-11-12'
BASE = 'https://static.cdn-cian.ru/frontend/frontend-mainpage/'
ASSETS = {
    'main.js.map': BASE + 'main.4d7747028aec9769.js.map',
    'main.css.map': BASE + 'main.cfb081ae0c14cff3.css.map',
    'main.css': BASE + 'main.cfb081ae0c14cff3.css',
}
FONTS = {weight: 'https://static.cdn-cian.ru/frontend/fonts/h/lato-' + weight + '.woff2'
         for weight in ('regular', 'semibold', 'bold')}
PACKAGES = ('@cian/ui-kit/', '@cian/ui-kit-design-tokens/')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def dump(path, data):
    write(path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def blocks(css):
    """Read balanced CSS blocks, respecting comments and strings."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    start = 0
    depth = 0
    quote = None
    escaped = False
    header = None
    for i, char in enumerate(css):
        if escaped:
            escaped = False
            continue
        if char == '\\':
            escaped = True
            continue
        if quote:
            if char == quote:
                quote = None
            continue
        if char in ('"', "'"):
            quote = char
        elif char == '{':
            if depth == 0:
                header = css[start:i].strip()
                body_start = i + 1
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                yield header, css[body_start:i]
                start = i + 1


def declarations(body):
    return dict(re.findall(r'(?:^|;)\s*(--[\w-]+)\s*:\s*([^;]+)', body))


def clean_css(css):
    css = re.sub(r'@import\s+[^;]+;', '', css)
    return re.sub(r':global\(([^)]+)\)', r'\1', css).strip()


def resolve(value, environment, visited=()):
    def alias(match):
        name = match.group(1)
        if name in visited:
            raise ValueError('Circular token: ' + name)
        if name not in environment:
            raise ValueError('Unresolved token: ' + name)
        return resolve(environment[name], environment, visited + (name,))
    return re.sub(r'var\((--[\w-]+)\)', alias, value).replace(' !important', '').strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=Path('/tmp'))
    parser.add_argument('--fetch', action='store_true', help='Fetch the pinned public assets again')
    args = parser.parse_args()
    provenance = []
    loaded = {}
    for name, url in ASSETS.items():
        path = args.cache / ('cian-' + name)
        if args.fetch or not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(url, timeout=45) as response:
                path.write_bytes(response.read())
        raw = path.read_bytes()
        provenance.append({'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)})
        loaded[name] = json.loads(raw) if name.endswith('.map') else raw.decode('utf-8')
    font_assets = []
    for weight, url in FONTS.items():
        path = args.cache / ('cian-lato-' + weight + '.woff2')
        if args.fetch or not path.exists():
            with urllib.request.urlopen(url, timeout=45) as response:
                path.write_bytes(response.read())
        raw = path.read_bytes()
        if raw[:4] != b'wOF2':
            raise ValueError('Invalid font response: ' + url)
        target = ROOT / ('assets/fonts/lato-' + weight + '.woff2')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        font_assets.append({'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)})

    sources = {}
    classes = {}
    for name in ('main.js.map', 'main.css.map'):
        sm = loaded[name]
        for source, content in zip(sm['sources'], sm['sourcesContent']):
            if not content or '/node_modules/' not in source:
                continue
            path = source.split('/node_modules/', 1)[1]
            if not path.startswith(PACKAGES) or '/node_modules/' in path:
                continue
            if name == 'main.js.map' and path.endswith('.css'):
                pairs = dict(re.findall(r'"([^"\n]+)":\s*"([^"\n]+)"', content))
                # Rspack may minify exported keys; the local name remains in the class suffix.
                classes[path] = {value.split('--', 2)[-1]: value for value in pairs.values()}
                continue
            sources[path] = {'path': path, 'content': content, 'sourceMap': ASSETS[name], 'source': source}
    dump('data/sources.json', list(sources.values()))
    dump('data/classes.json', classes)

    raw_token_dir = 'tokens/source/'
    for path, record in sources.items():
        if path.startswith('@cian/ui-kit-design-tokens/') and path.endswith('.css'):
            write(raw_token_dir + path.split('@cian/ui-kit-design-tokens/', 1)[1], record['content'])

    def source(path):
        return sources[path]['content']

    prefix = '@cian/ui-kit-design-tokens/colors/'
    filenames = ['commonPalette.css', 'semanticPalette.css', 'gradientsPalette.css']
    token_css = '\n\n'.join('/* ' + prefix + f + ' */\n' + clean_css(source(prefix + f)) for f in filenames)
    write('tokens/tokens.css', '/* Cian public snapshot, ' + DATE + '. See manifest.json. */\n' + token_css + '\n')
    write('tokens/legacy.css', clean_css(source(prefix + 'deprecated/variables.css')) + '\n')
    foundations = ['@cian/ui-kit/units/variables.module.css', '@cian/ui-kit/typography/variables.module.css', '@cian/ui-kit/internal/styles/common.module.css']
    write('tokens/foundations.css', '\n\n'.join('/* ' + p + ' */\n' + clean_css(source(p)) for p in foundations) + '\n')

    common = declarations(next(blocks(clean_css(source(prefix + 'commonPalette.css'))))[1])
    gradients = declarations(next(blocks(clean_css(source(prefix + 'gradientsPalette.css'))))[1])
    legacy = declarations(next(blocks(clean_css(source(prefix + 'deprecated/variables.css'))))[1])
    modes = {}
    for selector, body in blocks(clean_css(source(prefix + 'semanticPalette.css'))):
        if selector.startswith('@media'):
            selector, body = next(blocks(body))
        name = re.search(r'design-theme--(\w+)', selector).group(1)
        modes[name] = declarations(body)
    groups = {'common': common, 'gradients': gradients, 'legacy': legacy}
    foundation_origins = {}
    for path in foundations:
        for _, body in blocks(clean_css(source(path))):
            groups.setdefault('foundations', {}).update(declarations(body))
            foundation_origins.update({name: path for name in declarations(body)})
    tokens = []
    for group, values in [('semantic', modes['light']), *groups.items()]:
        for name, value in values.items():
            source_file = foundation_origins.get(name) if group == 'foundations' else prefix + {
                'semantic': 'semanticPalette.css', 'common': 'commonPalette.css',
                'gradients': 'gradientsPalette.css', 'legacy': 'deprecated/variables.css',
            }[group]
            record = {'name': name, 'group': group, 'value': value, 'package': '/'.join(source_file.split('/')[:2]), 'sourceFile': source_file, 'sourceMap': ASSETS['main.css.map'], 'modes': {}, 'resolved': {}}
            for mode, semantic in modes.items():
                environment = {**common, **semantic, **gradients, **legacy, **groups['foundations']}
                actual = semantic.get(name, value) if group == 'semantic' else value
                record['modes'][mode] = actual
                record['resolved'][mode] = resolve(actual, environment)
            tokens.append(record)
    dump('tokens/tokens.json', {'snapshotDate': DATE, 'packageVersion': None, 'scope': 'Observed subset of public production assets, not a complete npm package', 'modes': list(modes), 'tokens': tokens})

    allowed = set(v for mapping in classes.values() for v in mapping.values())

    def filter_css(css):
        result = []
        for selector, body in blocks(css):
            if selector.startswith(('@media', '@supports', '@layer')):
                inner = filter_css(body)
                if inner:
                    result.append(selector + '{' + inner + '}')
            elif 'keyframes' in selector or selector.startswith('@property'):
                result.append(selector + '{' + body + '}')
            elif any(c in allowed for c in re.findall(r'\.([\w-]+)', selector)):
                result.append(selector + '{' + body + '}')
        return '\n'.join(result)

    write('data/ui-kit.css', '/* Compiled component rules from the pinned public mainpage bundle. */\n' + filter_css(loaded['main.css']) + '\n')

    icons = []
    attributes = {'viewBox', 'fill', 'stroke', 'strokeWidth', 'fillRule', 'clipRule', 'strokeLinecap', 'strokeLinejoin', 'd', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points', 'opacity'}
    attr_names = {'strokeWidth': 'stroke-width', 'fillRule': 'fill-rule', 'clipRule': 'clip-rule', 'strokeLinecap': 'stroke-linecap', 'strokeLinejoin': 'stroke-linejoin'}
    for path, rec in sources.items():
        if not re.search(r'ui-kit-design-tokens/(icons|pictograms)/', path):
            continue
        code = rec['content']
        # Only flat SVGs with literal attributes are exported automatically.
        nodes = re.findall(r'_jsx(?:s)?\("([\w]+)",\s*\{([^{}]*)\}', code, re.S)
        if re.search(r'_jsx(?:s)?\("(?:g|defs|mask|clipPath|linearGradient)"', code):
            continue
        viewbox = re.search(r'viewBox:\s*"([^"]+)"', code)
        if not viewbox:
            continue
        children = []
        for tag, props in nodes:
            if tag not in ('path', 'circle', 'rect', 'ellipse', 'line', 'polygon', 'polyline'):
                continue
            attrs = [(k, v) for k, v in re.findall(r'(\w+):\s*"([^"]*)"', props) if k in attributes]
            children.append('<' + tag + ''.join(' ' + attr_names.get(k, k) + '="' + html.escape(v, quote=True) + '"' for k, v in attrs) + '/>')
        if not children:
            continue
        size = path.split('/')[-2]
        name = Path(path).stem + size
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="' + viewbox.group(1) + '" fill="none">' + ''.join(children) + '</svg>'
        write('tokens/icons/' + name + '.svg', svg + '\n')
        icons.append({'name': name, 'size': int(size), 'category': path.split('/')[-3], 'path': 'tokens/icons/' + name + '.svg', 'source': path, 'svg': svg})
    dump('data/icons.json', icons)
    families = sorted({p.split('/')[2] for p in sources if p.startswith('@cian/ui-kit/') and not p.split('/')[2] in ('internal', 'utils', 'types', 'services', 'context', 'headless', 'responsive', 'root', 'theme', 'units')})
    manifest = {'snapshotDate': DATE, 'packageVersions': {'@cian/ui-kit': None, '@cian/ui-kit-design-tokens': None}, 'capturePage': 'https://www.cian.ru/', 'fontFamilyObserved': 'Lato, Arial, sans-serif', 'assets': provenance, 'counts': {'sourceFiles': len(sources), 'tokens': len(tokens), 'semanticTokens': len(modes['light']), 'icons': len(icons)}, 'componentFamilies': families, 'limitations': ['Tree-shaken mainpage snapshot; not the full package.', 'Package versions are not exposed by these source maps.', 'Component demos reproduce DOM/CSS; they do not execute the original React components.', 'Icons with nested SVG structure are preserved in sources.json but not automatically exported.', 'Foundations come from @cian/ui-kit; color palettes and icon vectors come from @cian/ui-kit-design-tokens.']}
    manifest['fontAssets'] = font_assets
    dump('data/manifest.json', manifest)
    dump('tokens/manifest.json', manifest)
    # Stable timestamps keep repeated extraction byte-for-byte reproducible.
    with zipfile.ZipFile(ROOT / 'tokens/cian-design-tokens.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((ROOT / 'tokens').rglob('*')):
            if path.is_file() and path.suffix != '.zip':
                info = zipfile.ZipInfo(str(path.relative_to(ROOT / 'tokens')), (2026, 11, 12, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, path.read_bytes())
    print(json.dumps(manifest['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
