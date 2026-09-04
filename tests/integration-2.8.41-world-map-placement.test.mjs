import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viewUrl = new URL("../runtime/world-city-map-view.mjs", import.meta.url);
const cssUrl = new URL("../styles/world-city-map.css", import.meta.url);
const adapterUrl = new URL("../runtime/world-city-map-leaflet.mjs", import.meta.url);

const source = readFileSync(viewUrl, "utf8");
const css = readFileSync(cssUrl, "utf8");
const adapter = readFileSync(adapterUrl, "utf8");

test("map categories separate selection from visibility filtering", () => {
  assert.match(source, /data-world-map-select-category=/u, "category name must be a selectable control");
  assert.match(source, /data-world-map-toggle-category=/u, "visibility must have its own control");
  assert.doesNotMatch(source, /<label><input type="checkbox" data-world-map-category=/u, "category title must not toggle visibility through a wrapping label");
  assert.match(source, /selectedCategoryId/u, "GM placement must remember selected category");
});

test("map marker placement uses a Leaflet click and does not compete with map dragging", () => {
  assert.match(source, /onMapClick\(point\)[\s\S]{0,220}createMarkerAt\(point\)/u, "Leaflet click callback must create the marker");
  assert.match(adapter, /map\.on\("click"[\s\S]{0,180}if \(!placementMode\) return;[\s\S]{0,180}onMapClick/u, "adapter must gate placement on Leaflet click");
  assert.match(adapter, /if \(placementMode\) map\.dragging\?\.disable\?\.\(\);[\s\S]{0,120}else map\.dragging\?\.enable\?\.\(\)/u, "placement mode must disable Leaflet dragging");
  assert.doesNotMatch(source, /viewport\?\.addEventListener\("pointerdown"/u, "custom pointer pan handler must stay removed");
});

test("placement mode is visibly active and category visibility remains reversible", () => {
  assert.match(css, /\.world-city-map-category\.selected/u);
  assert.match(css, /\.world-city-map-viewport\.placing/u);
  assert.match(css, /\.world-city-map-category-visibility/u);
});
