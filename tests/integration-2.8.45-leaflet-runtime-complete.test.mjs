import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('2.8.45 ships a complete parseable local Leaflet browser runtime', () => {
  const js = read('vendor/leaflet/leaflet.js');
  const adapter = read('runtime/world-city-map-leaflet.mjs');
  assert.ok(js.length > 100_000, `Leaflet runtime looks truncated: ${js.length} bytes`);
  assert.doesNotThrow(() => new vm.Script(js, { filename: 'leaflet.js' }));
  assert.match(js, /window\.L/);
  assert.match(js, /1\.6\.0/);
  assert.match(adapter, /const LEAFLET_VERSION = ["']1\.6\.0["']/);
});

test('2.8.45 Leaflet loader rejects instead of waiting forever when the local runtime never initializes', async () => {
  const originalDocument = globalThis.document;
  const originalL = globalThis.L;
  const originalSetTimeout = globalThis.setTimeout;

  const listeners = new Map();
  const script = {
    dataset: {},
    addEventListener(type, handler) { listeners.set(type, handler); },
  };

  globalThis.L = undefined;
  globalThis.document = {
    head: { appendChild() {} },
    querySelector() { return null; },
    createElement(tag) {
      assert.equal(tag, 'script');
      return script;
    },
  };
  globalThis.setTimeout = (fn, delay, ...args) => originalSetTimeout(fn, Math.min(Number(delay) || 0, 1), ...args);

  try {
    const url = new URL('../runtime/world-city-map-leaflet.mjs', import.meta.url);
    const { loadWorldCityLeaflet } = await import(`${url.href}?timeout=${Date.now()}`);
    await assert.rejects(
      Promise.race([
        loadWorldCityLeaflet(),
        new Promise((_, reject) => originalSetTimeout(() => reject(new Error('loader hung forever')), 100)),
      ]),
      /Leaflet.*(timeout|время|initialize|загруз)/i,
    );
  } finally {
    globalThis.document = originalDocument;
    globalThis.L = originalL;
    globalThis.setTimeout = originalSetTimeout;
  }
});
