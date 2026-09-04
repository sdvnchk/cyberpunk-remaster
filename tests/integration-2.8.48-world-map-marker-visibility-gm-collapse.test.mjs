import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const view = read('runtime/world-city-map-view.mjs');
const css = read('styles/world-city-map.css');
const adapter = read('runtime/world-city-map-leaflet.mjs');
const manifest = JSON.parse(read('assets/maps/night-city-2045/manifest.json'));

function shellSection() {
  const start = view.indexOf('function shellHtml');
  const end = view.indexOf('\n}\n\nexport function renderWorldCityMap', start);
  return view.slice(start, end);
}

test('2.8.48 map marker glyph itself stays visible inside the Leaflet pin', () => {
  assert.match(view, /world-city-map-marker-icon/u, 'marker HTML must carry a dedicated icon class');
  assert.match(css, /\.world-city-map-leaflet-div-icon \.world-city-map-marker-icon[\s\S]{0,400}display:\s*grid/u, 'marker icon class must be styled as visible content');
  assert.doesNotMatch(css, /\.world-city-map-leaflet-div-icon \.world-city-map-marker>i\s*\{[\s\S]{0,200}display:\s*none/u, 'generic <i> hiding must not suppress the actual marker icon');
});

test('2.8.48 sidebar no longer renders a separate bottom result list of points', () => {
  const shell = shellSection();
  assert.doesNotMatch(shell, /data-world-map-results/u, 'point rows must not be rendered as a second standalone block below categories');
});

test('2.8.48 category and point map-display toggles use checks instead of eye icons', () => {
  assert.match(view, /fa-square-check|fa-check/u, 'view must render a check-style visibility affordance');
  assert.doesNotMatch(view, /fa-eye-slash/u, 'old hide/show eye affordance should be removed from map display toggles');
});

test('2.8.48 GM control block can be collapsed', () => {
  assert.match(view, /data-world-map-action="toggle-gm"/u, 'GM block needs a collapse toggle button');
  assert.match(css, /\.world-city-map-gm\.collapsed/u, 'GM block needs a collapsed CSS state');
});

test('2.8.48 built-in RED atlas exposes the rebuilt z5 pyramid while allowing extra user zoom', () => {
  assert.equal(manifest.maxNativeZoom, 5);
  assert.equal(manifest.maxZoom, 7);
  assert.match(adapter, /maxNativeZoom:\s*DEFAULT_NIGHT_CITY_TILESET\.maxNativeZoom/u);
  assert.match(adapter, /maxZoom:\s*Number\(manifest\.maxZoom\)/u);
});
