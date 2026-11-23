#!/usr/bin/env python3
"""Validate snapshot integrity and documentation references without network access."""
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).resolve().parents[1]
read = lambda path: json.loads((root / path).read_text())
manifest = read('data/manifest.json')
data = read('tokens/tokens.json')
sources = {s['path']: s for s in read('data/sources.json')}
tokens = {t['name']: t for t in data['tokens']}
assert len(tokens) == len(data['tokens']) == manifest['counts']['tokens']
assert len(sources) == manifest['counts']['sourceFiles']
assert set(data['modes']) == {'light', 'dark', 'colored', 'onOverlay', 'system'}
assert tokens['--control-main-primary-default']['resolved']['light'] == '#006cfd'
assert tokens['--text-primary-default']['resolved']['light'] == '#0d162e'
assert tokens['--unit_0']['value'] == '2px'
assert tokens['--unit_11']['value'] == '44px'
for token in data['tokens']:
    assert token['sourceFile'] in sources, token['name']
    assert token['name'] in sources[token['sourceFile']]['content'], token['name']
    assert set(token['resolved']) == set(data['modes'])
    assert all('var(' not in v for v in token['resolved'].values()), token['name']
    assert all(v for v in token['resolved'].values()), token['name']
for path in re.findall(r'data-source="([^"]+)"', (root / 'index.html').read_text()):
    assert path in sources, path
icons = read('data/icons.json')
assert len(icons) == manifest['counts']['icons']
for icon in icons:
    ET.fromstring(icon['svg'])
    assert (root / icon['path']).read_text().strip() == icon['svg']
    assert icon['source'] in sources
with zipfile.ZipFile(root / 'tokens/cian-design-tokens.zip') as archive:
    assert archive.testzip() is None
    assert 'README.md' in archive.namelist()
    for name in archive.namelist():
        assert archive.read(name) == (root / 'tokens' / name).read_bytes(), name
for asset in manifest['fontAssets']:
    name = asset['url'].rsplit('/', 1)[1]
    assert hashlib.sha256((root / 'assets/fonts' / name).read_bytes()).hexdigest() == asset['sha256']
for path in ['tokens/tokens.css', 'tokens/foundations.css']:
    css = (root / path).read_text()
    assert '@import' not in css and ':global(' not in css
print(f"OK: {len(tokens)} tokens, 5 modes, {len(icons)} SVGs, {len(sources)} sources; ZIP, fonts and links verified.")
