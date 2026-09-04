import assert from 'node:assert/strict';
import test from 'node:test';

const url = new URL('../runtime/world-city-map.mjs', import.meta.url);

test('v2 image worlds migrate to the built-in tiled atlas without losing the legacy image path', async () => {
  const { normalizeWorldCityMap } = await import(`${url.href}?v3bg=1`);
  const migrated = normalizeWorldCityMap({
    version: 2,
    image: 'worlds/test/night-city-old.jpg',
    markers: [{ id: 'p1', x: 0.25, y: 0.75, title: 'Старая точка', categoryId: 'poi' }],
  });
  assert.equal(migrated.backgroundMode, 'tiles');
  assert.equal(migrated.tileset, 'night-city-2045');
  assert.equal(migrated.image, 'worlds/test/night-city-old.jpg');
  assert.equal(migrated.markers.length, 1);
  assert.equal(migrated.markers[0].x, 0.25);
  assert.equal(migrated.markers[0].y, 0.75);
});

test('v3 explicitly selected custom image mode survives normalization', async () => {
  const { normalizeWorldCityMap } = await import(`${url.href}?v3bg=2`);
  const state = normalizeWorldCityMap({ version: 3, backgroundMode: 'image', image: 'worlds/test/custom.jpg' });
  assert.equal(state.backgroundMode, 'image');
  assert.equal(state.image, 'worlds/test/custom.jpg');
});
