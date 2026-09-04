import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function manifestHasStyle(manifest, src) {
  return (manifest.styles ?? []).some((entry) => entry === src || entry?.src === src);
}

test('2.8.44+ vendors a local Leaflet runtime and registers local CSS', () => {
  const js = read('vendor/leaflet/leaflet.js');
  const css = read('vendor/leaflet/leaflet.css');
  const manifest = JSON.parse(read('module.json'));
  assert.match(js, /Leaflet|leaflet/i);
  assert.match(js, /window\.L/);
  assert.match(css, /leaflet-container/);
  assert.ok(manifestHasStyle(manifest, 'vendor/leaflet/leaflet.css'));
});

test('2.8.44+ ships the 256px Night City tile pyramid through the current native maximum', () => {
  const m = JSON.parse(read('assets/maps/night-city-2045/manifest.json'));
  assert.equal(m.width, 10600);
  assert.equal(m.height, 16384);
  assert.equal(m.tileSize, 256);
  assert.equal(m.minNativeZoom, 0);
  assert.equal(m.maxNativeZoom, 5);
  assert.equal(m.maxZoom, 7);
  assert.equal(m.urlTemplate, 'modules/cyberpunk-remaster/assets/maps/night-city-2045/tiles/z{z}/{x}-{y}.webp');
  assert.deepEqual(m.levels.map(({ z, width, height, columns, rows }) => ({ z, width, height, columns, rows })), [
    { z: 0, width: 332, height: 512, columns: 2, rows: 2 },
    { z: 1, width: 663, height: 1024, columns: 3, rows: 4 },
    { z: 2, width: 1325, height: 2048, columns: 6, rows: 8 },
    { z: 3, width: 2650, height: 4096, columns: 11, rows: 16 },
    { z: 4, width: 5300, height: 8192, columns: 21, rows: 32 },
    { z: 5, width: 10600, height: 16384, columns: 42, rows: 64 },
  ]);
  for (const { z, columns, rows } of m.levels) {
    const dir = path.join(ROOT, `assets/maps/night-city-2045/tiles/z${z}`);
    assert.ok(fs.statSync(dir).isDirectory());
    assert.equal(fs.readdirSync(dir).filter((n) => n.endsWith('.webp')).length, columns * rows);
  }
});

test('2.8.44 uses a dedicated Leaflet adapter and no custom pan/zoom renderer', () => {
  const adapter = read('runtime/world-city-map-leaflet.mjs');
  const view = read('runtime/world-city-map-view.mjs');
  assert.match(adapter, /L\.CRS\.Simple/);
  assert.match(adapter, /L\.tileLayer\(/);
  assert.match(adapter, /L\.imageOverlay\(/);
  assert.match(adapter, /L\.divIcon\(/);
  assert.match(adapter, /dragend/);
  assert.match(adapter, /map\.on\("click"/);
  assert.match(adapter, /map\.remove\(\)/);
  assert.match(view, /createWorldCityLeafletMap/);
  assert.match(view, /data-world-map-leaflet/);
  assert.match(view, /state\.backgroundMode === ["']image["']/);
  assert.doesNotMatch(view, /scene\.style\.transform/);
  assert.doesNotMatch(view, /viewport\?\.addEventListener\("wheel"/);
  assert.doesNotMatch(view, /viewport\?\.addEventListener\("pointerdown"/);
});

test('2.8.44+ module and package versions stay aligned', () => {
  const moduleVersion = JSON.parse(read('module.json')).version;
  const packageVersion = JSON.parse(read('package.json')).version;
  assert.equal(moduleVersion, packageVersion);
  assert.ok(moduleVersion.localeCompare('2.8.44', undefined, { numeric: true }) >= 0);
});

test('2.8.44 Leaflet marker hover cannot inherit the legacy translated map-marker transform', () => {
  const css = read('styles/world-city-map.css');
  assert.match(
    css,
    /#pcm-root \.world-city-map-leaflet-div-icon \.world-city-map-marker:hover:not\(:disabled\)[\s\S]{0,500}transform:\s*none!important/u,
  );
});
