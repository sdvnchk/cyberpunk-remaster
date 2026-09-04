import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const view = read('runtime/world-city-map-view.mjs');
const worldMap = read('runtime/world-city-map.mjs');
const controllers = [
  'runtime/neuro-archive-controller.mjs',
  'runtime/cyber-archive-controller.mjs',
  'runtime/neo-archive-controller.mjs',
].map((file) => [file, read(file)]);

test('2.8.53 clicking a point inside an expanded category focuses it with the same close zoom used by Open on map', () => {
  assert.match(view, /const markerFocus = event\.target\.closest\?\.\("\[data-world-map-focus-marker\]"\)/u);
  assert.match(view, /function focusMarkerFromFilter\(markerId\)[\s\S]{0,220}focusMarker\?\.\(markerId,\s*\{\s*zoom:\s*WORLD_MAP_ARCHIVE_FOCUS_ZOOM\s*\}\)/u);
  assert.match(view, /markerFocus[\s\S]{0,900}focusMarkerFromFilter\(id\)/u);
});

test('2.8.53 world map exposes a readable category-plus-title marker label', () => {
  assert.match(worldMap, /export function worldMapMarkerDisplayLabel\(state, marker\)/u);
  assert.match(worldMap, /WORLD_MAP_ICON_PRESETS\.find\(\(preset\) => preset\.id === categoryId\)\?\.label/u);
  assert.match(worldMap, /return `\$\{categoryLabel\} — \$\{title\}`/u);
});

test('2.8.53 archive map-link panels use readable category labels instead of raw fa: icon tokens', () => {
  for (const [file, source] of controllers) {
    assert.match(source, /worldMapMarkerDisplayLabel/u, `${file} must import and use the readable marker label helper`);
    assert.match(source, /worldMapMarkerDisplayLabel\(map, marker\)/u, `${file} must render category + marker title`);
    const panelStart = source.indexOf('function worldMapLinksPanel(entry)');
    const panelEnd = source.indexOf('\n  async function openWorldMapArchiveLink', panelStart);
    const panel = source.slice(panelStart, panelEnd);
    assert.doesNotMatch(panel, /marker\.icon \|\| "⌖"/u, `${file} must not print raw icon tokens in map link rows/options`);
  }
});
