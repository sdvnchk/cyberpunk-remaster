import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viewUrl = new URL("../runtime/world-city-map-view.mjs", import.meta.url);
const cssUrl = new URL("../styles/world-city-map.css", import.meta.url);
const adapterUrl = new URL("../runtime/world-city-map-leaflet.mjs", import.meta.url);
const source = readFileSync(viewUrl, "utf8");
const css = readFileSync(cssUrl, "utf8");
const adapter = readFileSync(adapterUrl, "utf8");

test("hidden categories always have a one-click restore path", () => {
  assert.match(source, /data-world-map-action="show-all-categories"/u, "map sidebar needs a Show all control");
  assert.match(source, /action === "show-all-categories"[\s\S]{0,300}hiddenCategories\.clear\(\)/u, "Show all must clear client hidden categories");
  assert.match(source, /data-world-map-toggle-category=/u, "each category still needs its own map-display control");
});

test("map markers are zoom-scaled icon pins with hover tooltip instead of inline labels", () => {
  const markerFnStart = source.indexOf("function markerButtonHtml");
  const markerFnEnd = source.indexOf("\n}\n\nfunction emptyHtml", markerFnStart);
  const markerFn = source.slice(markerFnStart, markerFnEnd);
  assert.match(markerFn, /data-world-map-tooltip=/u, "marker must carry tooltip text");
  assert.doesNotMatch(markerFn, /<small>/u, "marker must not render title inline on the map");
  assert.doesNotMatch(markerFn, /<i>/u, "marker must not render category inline on the map");
  assert.match(css, /world-city-map-marker-size-48[\s\S]{0,160}--world-map-marker-size:48px/u, "high zoom must provide a readable 48px marker box");
  assert.match(css, /world-city-map-marker::after[\s\S]{0,500}content:\s*attr\(data-world-map-tooltip\)/u, "marker hover must expose a tooltip");
  assert.match(adapter, /worldCityMarkerSizeForZoom/u, "Leaflet marker size must be driven by zoom");
  assert.match(adapter, /iconSize:\s*\[size, size\]/u, "Leaflet div icon must use the computed marker size");
  assert.match(adapter, /map\.on\("zoomend"/u, "Leaflet must refresh marker icons after zoom settles");
  assert.match(css, /#pcm-root \.world-city-map-leaflet-div-icon \.world-city-map-marker:hover:not\(:disabled\)[\s\S]{0,500}transform:\s*none!important/u, "legacy hover transforms must not move Leaflet-owned pins");
  assert.doesNotMatch(source, /--world-map-marker-scale/u, "Leaflet must own zoom positioning without inverse CSS scaling");
});

test("a GM click on a Leaflet marker opens its information even though markers are draggable", () => {
  assert.match(adapter, /draggable:\s*Boolean\(options\.isGM\)/u);
  assert.match(adapter, /leafletMarker\.on\("click", \(\) => options\.onMarkerClick\?\.\(id\)\)/u);
  assert.match(source, /onMarkerClick\(markerId\)[\s\S]{0,260}selectedMarkerId = clean\(markerId\)[\s\S]{0,180}renderInspector\(\)/u);
});

test("map links identify what kind of archive record they point to", () => {
  assert.match(source, /function recordTypeLabel/u);
  assert.match(source, /quests:\s*"ЗАКАЗ"/u);
  assert.match(source, /clues:\s*"ЗАЦЕПКА"/u);
  assert.match(source, /locations:\s*"МЕСТО"/u);
  assert.match(source, /recordLinkLabel/u);
  assert.doesNotMatch(source, /· связей \$\{marker\.links\.length\}/u, "sidebar should not show an unexplained link count");
});
