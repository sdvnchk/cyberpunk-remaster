import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('2.8.50 replaces the old tile pyramid with PDF-derived high-resolution levels', () => {
  const manifest = JSON.parse(read('assets/maps/night-city-2045/manifest.json'));
  assert.equal(manifest.width, 10600);
  assert.equal(manifest.height, 16384);
  assert.equal(manifest.sourceWidth, 6600);
  assert.equal(manifest.sourceHeight, 10200);
  assert.equal(manifest.maxNativeZoom, 5);
  assert.equal(manifest.maxZoom, 7);
  assert.equal(manifest.sourceKind, 'pdf-render');
  assert.deepEqual(manifest.levels.map(({ z, width, height, columns, rows }) => ({ z, width, height, columns, rows })), [
    { z: 0, width: 332, height: 512, columns: 2, rows: 2 },
    { z: 1, width: 663, height: 1024, columns: 3, rows: 4 },
    { z: 2, width: 1325, height: 2048, columns: 6, rows: 8 },
    { z: 3, width: 2650, height: 4096, columns: 11, rows: 16 },
    { z: 4, width: 5300, height: 8192, columns: 21, rows: 32 },
    { z: 5, width: 10600, height: 16384, columns: 42, rows: 64 },
  ]);

  const tilesRoot = path.join(ROOT, 'assets/maps/night-city-2045/tiles');
  const dirs = fs.readdirSync(tilesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(dirs, ['z0', 'z1', 'z2', 'z3', 'z4', 'z5']);

  for (const { z, columns, rows } of manifest.levels) {
    const dir = path.join(tilesRoot, `z${z}`);
    const tiles = fs.readdirSync(dir).filter((name) => name.endsWith('.webp'));
    assert.equal(tiles.length, columns * rows, `z${z} tile count`);
  }
});

test('2.8.50 Leaflet exposes the new PDF-derived z5 tiles and allows two extra zoom steps', () => {
  const adapter = read('runtime/world-city-map-leaflet.mjs');
  assert.match(adapter, /width:\s*10600/u);
  assert.match(adapter, /height:\s*16384/u);
  assert.match(adapter, /maxNativeZoom:\s*5/u);
  assert.match(adapter, /maxZoom:\s*7/u);
  assert.match(adapter, /maxNativeZoom:\s*DEFAULT_NIGHT_CITY_TILESET\.maxNativeZoom/u);
});
