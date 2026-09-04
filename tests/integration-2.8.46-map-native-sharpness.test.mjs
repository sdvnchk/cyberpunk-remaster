import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('2.8.46 keeps the complete built-in native pyramid through z5', () => {
  const manifest = JSON.parse(read('assets/maps/night-city-2045/manifest.json'));
  const adapter = read('runtime/world-city-map-leaflet.mjs');

  assert.equal(manifest.tileSize, 256);
  assert.equal(manifest.minNativeZoom, 0);
  assert.equal(manifest.maxNativeZoom, 5);
  assert.equal(manifest.maxZoom, 7);
  assert.equal(manifest.width, 10600);
  assert.equal(manifest.height, 16384);
  assert.deepEqual(manifest.levels.map(({ z }) => z), [0, 1, 2, 3, 4, 5]);

  const z5 = manifest.levels.find((level) => level.z === 5);
  assert.deepEqual(z5, {
    z: 5,
    width: 10600,
    height: 16384,
    columns: 42,
    rows: 64,
  });

  for (const { z, columns, rows } of manifest.levels) {
    const dir = path.join(ROOT, `assets/maps/night-city-2045/tiles/z${z}`);
    assert.ok(fs.statSync(dir).isDirectory(), `missing z${z}`);
    assert.equal(fs.readdirSync(dir).filter((name) => name.endsWith('.webp')).length, columns * rows);
  }

  assert.match(adapter, /width:\s*10600/);
  assert.match(adapter, /height:\s*16384/);
  assert.match(adapter, /maxNativeZoom:\s*5/);
  assert.match(adapter, /maxZoom:\s*7/);
});

test('2.8.46 does not add image-rendering pixelation to Leaflet map tiles', () => {
  const css = read('styles/world-city-map.css');
  const tileRule = css.match(/\.world-city-map-leaflet \.leaflet-tile\s*\{([\s\S]*?)\}/u)?.[1] ?? '';
  assert.doesNotMatch(tileRule, /image-rendering:\s*pixelated/u);
});
