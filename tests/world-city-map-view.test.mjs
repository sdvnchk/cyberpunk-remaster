import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const url = new URL("../runtime/world-city-map-view.mjs", import.meta.url);

test("world map marker filtering is category and search driven", async () => {
  const { filterWorldMapMarkers } = await import(`${url.href}?filter=1`);
  const state = {
    categories: [{ id: "gig", label: "Гиги" }, { id: "clue", label: "Зацепки" }],
    markers: [
      { id: "a", title: "Afterlife", description: "Fixer gig", categoryId: "gig", links: [] },
      { id: "b", title: "Blackwall", description: "Секрет", categoryId: "clue", links: [] },
    ],
  };
  assert.deepEqual(filterWorldMapMarkers(state, { hiddenCategories: new Set(["clue"]), query: "" }).map((m) => m.id), ["a"]);
  assert.deepEqual(filterWorldMapMarkers(state, { hiddenCategories: new Set(), query: "black" }).map((m) => m.id), ["b"]);
  assert.deepEqual(filterWorldMapMarkers(state, { hiddenCategories: new Set(), query: "гиги" }).map((m) => m.id), ["a"]);
});

test("world map coordinate helpers keep normalized points stable while zooming", async () => {
  const { clampWorldMapZoom, viewportPointToNormalized } = await import(`${url.href}?coords=1`);
  assert.equal(clampWorldMapZoom(0), 0.25);
  assert.equal(clampWorldMapZoom(99), 6);
  assert.deepEqual(viewportPointToNormalized({ clientX: 250, clientY: 200, rectLeft: 100, rectTop: 50, panX: 50, panY: 25, zoom: 2, width: 200, height: 100 }), { x: 0.25, y: 0.625 });
});

test("world map view delegates pan/zoom lifecycle to Leaflet and has no polling loop", () => {
  const source = readFileSync(url, "utf8");
  assert.doesNotMatch(source, /requestAnimationFrame\s*\(/u);
  assert.doesNotMatch(source, /setInterval\s*\(/u);
  assert.doesNotMatch(source, /Ticker|pixi|refreshVisibility|readPixels/iu);
  assert.match(source, /createWorldCityLeafletMap/u);
  assert.doesNotMatch(source, /viewport\?\.addEventListener\("wheel"/u);
  assert.doesNotMatch(source, /viewport\?\.addEventListener\("pointerdown"/u);
});

test("world map recenters a requested archive marker through the Leaflet controller", () => {
  const source = readFileSync(url, "utf8");
  assert.match(source, /focusMarker\(selectedMarkerId/u);
  assert.match(source, /data-world-map-leaflet/u);
});
