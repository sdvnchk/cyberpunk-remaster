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

test('2.8.49 the whole map sidebar can be collapsed independently from the GM block', () => {
  assert.match(view, /data-world-map-action="toggle-sidebar"/u);
  assert.match(view, /SIDEBAR_COLLAPSED_KEY/u);
  assert.match(css, /\.world-city-map-shell\.sidebar-collapsed/u);
});

test('2.8.49 manual marker color editing disables category-color inheritance and checkbox state can restore it', () => {
  assert.match(view, /if \(event\.target\.matches\?\.\('\[data-world-map-field="color"\]'\)\) \{[\s\S]{0,240}inherit\.checked = false/u);
  assert.match(view, /if \(target\.matches\?\.\("\[data-world-map-color-inherit\]"\)\) \{/u);
  assert.match(view, /if \(target\.checked && colorInput\) colorInput\.value = category\?\.color \|\| "#f6c85f";/u);
});

test('2.8.49 disabled categories and points stay in the sidebar as map-off rows instead of hidden rows', () => {
  assert.match(view, /map-off/u);
  assert.match(css, /\.world-city-map-category\.map-off/u);
  assert.match(css, /\.world-city-map-category\.hidden,\.world-city-map-category-point\.hidden\{display:revert/u);
});

test('2.8.49 atlas allows extra zoom beyond native detail without lying about the native ceiling', () => {
  assert.equal(manifest.maxNativeZoom, 5);
  assert.equal(manifest.maxZoom, 7);
  assert.match(adapter, /maxNativeZoom:\s*DEFAULT_NIGHT_CITY_TILESET\.maxNativeZoom/u);
  assert.match(adapter, /maxZoom:\s*Number\(manifest\.maxZoom\)/u);
});
