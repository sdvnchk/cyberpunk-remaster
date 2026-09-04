import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const view = read('runtime/world-city-map-view.mjs');
const adapter = read('runtime/world-city-map-leaflet.mjs');
const controllers = [
  'runtime/neuro-archive-controller.mjs',
  'runtime/cyber-archive-controller.mjs',
  'runtime/neo-archive-controller.mjs',
].map((file) => [file, read(file)]);

test('2.8.52 archive-link opening requests a dedicated close focus zoom in all three archives', () => {
  assert.match(view, /export const WORLD_MAP_ARCHIVE_FOCUS_ZOOM = 5/u);
  for (const [file, source] of controllers) {
    assert.match(source, /WORLD_MAP_ARCHIVE_FOCUS_ZOOM/u, `${file} must import the shared focus zoom`);
    assert.match(source, /focusZoom:\s*focusMarkerId\s*\?\s*WORLD_MAP_ARCHIVE_FOCUS_ZOOM\s*:\s*null/u, `${file} must request close zoom only for archive-link focusing`);
  }
});

test('2.8.52 initial archive marker focus passes its zoom to Leaflet while ordinary in-map focus remains zoom-neutral', () => {
  assert.match(view, /mapController\.focusMarker\(selectedMarkerId,\s*\{\s*zoom:\s*context\.focusZoom\s*\}\)/u);
  assert.match(view, /function centerMarker\(markerId\)[\s\S]{0,180}focusMarker\?\.\(markerId\)/u);
  assert.doesNotMatch(view, /function centerMarker\(markerId\)[\s\S]{0,180}WORLD_MAP_ARCHIVE_FOCUS_ZOOM/u);
});

test('2.8.52 explicit marker focus wins over the deferred initial fit', () => {
  const focus = adapter.match(/function focusMarker\(markerId, \{ zoom = null \} = \{\}\) \{[\s\S]*?\n  \}/u)?.[0] ?? '';
  assert.match(focus, /initialFitDone\s*=\s*true/u);
  assert.match(focus, /map\.setView\(marker\.getLatLng\(\), targetZoom/u);
});
