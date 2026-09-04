import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('2.8.47 Leaflet respects the manifest native zoom ceiling instead of inventing extra sharpness', () => {
  const adapter = read('runtime/world-city-map-leaflet.mjs');
  const tileLayer = adapter.match(/L\.tileLayer\([\s\S]*?\)\.addTo\(map\)/u)?.[0] ?? '';
  assert.match(tileLayer, /maxNativeZoom:\s*DEFAULT_NIGHT_CITY_TILESET\.maxNativeZoom/u);
  assert.match(tileLayer, /maxZoom:\s*Number\(manifest\.maxZoom\)/u);
});

test('2.8.47 map fills the archive work area in all archive modes', () => {
  const css = read('styles/world-city-map.css');
  const shellRule = css.match(/\.world-city-map-shell\s*\{([^}]*)\}/u)?.[1] ?? '';
  assert.match(shellRule, /width:\s*100%/u);
  assert.match(shellRule, /height:\s*100%/u);
  assert.match(shellRule, /min-height:\s*0/u);
  assert.doesNotMatch(shellRule, /72vh|760px|520px/u);
  assert.match(css, /\.pcm-world-map-view\s*\{[^}]*height:\s*100%/su);
  assert.match(css, /\.pcm-world-map-view\s*>\s*\[data-world-city-map-host\]\s*\{[^}]*height:\s*100%/su);
});

test('2.8.47 Leaflet survives archive resizing and mode-layout settling', () => {
  const adapter = read('runtime/world-city-map-leaflet.mjs');
  assert.match(adapter, /ResizeObserver/u);
  assert.match(adapter, /map\.invalidateSize\(false\)/u);
});

test('2.8.47 focusing or creating a point does not force a zoom jump', () => {
  const adapter = read('runtime/world-city-map-leaflet.mjs');
  const view = read('runtime/world-city-map-view.mjs');
  assert.match(adapter, /:\s*map\.getZoom\(\)/u);
  assert.doesNotMatch(adapter, /Math\.max\(map\.getZoom\(\),\s*2\)/u);
  assert.doesNotMatch(view, /createMarkerAt[\s\S]{0,1600}centerMarker\(marker\.id\)/u);
});

test('2.8.47 point markers visibly use their category color instead of black fill', () => {
  const css = read('styles/world-city-map.css');
  const markerRule = css.match(/\.world-city-map-leaflet-div-icon \.world-city-map-marker\s*\{([\s\S]*?)\}/u)?.[1] ?? '';
  assert.match(markerRule, /background:[^\n]*var\(--world-map-marker-color/u);
  assert.doesNotMatch(markerRule, /background:\s*#05070d/u);
});
