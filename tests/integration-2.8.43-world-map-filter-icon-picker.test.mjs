import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viewUrl = new URL("../runtime/world-city-map-view.mjs", import.meta.url);
const cssUrl = new URL("../styles/world-city-map.css", import.meta.url);
const source = readFileSync(viewUrl, "utf8");
const css = readFileSync(cssUrl, "utf8");

test("marker and category editors use visual icon pickers instead of text selects", () => {
  assert.match(source, /data-world-map-icon-trigger="marker"/u, "marker editor needs a visual icon trigger");
  assert.match(source, /data-world-map-icon-grid="marker"/u, "marker editor needs an icon grid");
  assert.match(source, /data-world-map-icon-trigger="category"/u, "category editor needs a visual icon trigger");
  assert.match(source, /data-world-map-icon-grid="category"/u, "category editor needs an icon grid");
  assert.doesNotMatch(source, /<select data-world-map-field="icon">/u, "marker icon must not be a text select");
  assert.doesNotMatch(source, /<select data-world-map-new-category-icon/u, "category icon must not be a text select");
  assert.match(css, /\.world-city-map-icon-grid[\s\S]{0,500}grid-template-columns:\s*repeat\(/u, "icon picker should be a visual grid");
});

test("category filters are expandable and list every point in the category", () => {
  assert.match(source, /data-world-map-expand-category=/u, "each category needs an expand control");
  assert.match(source, /expandedCategories/u, "expanded category state must be tracked");
  assert.match(source, /data-world-map-category-marker=/u, "expanded category must render marker rows");
  assert.match(source, /data-world-map-toggle-marker=/u, "each marker row needs an individual visibility control");
  assert.match(source, /data-world-map-focus-marker=/u, "marker row must be selectable/focusable");
  assert.match(css, /\.world-city-map-category-points/u, "expanded marker list needs dedicated layout");
});

test("individual hidden markers are filtered client-side and Show all restores them", () => {
  assert.match(source, /HIDDEN_MARKERS_KEY/u, "individual hidden points need their own client-only storage key");
  assert.match(source, /hiddenMarkers/u, "view must track individually hidden markers");
  assert.match(source, /hiddenMarkers\.has\(marker\.id\)/u, "visible marker filtering must exclude individually hidden markers");
  assert.match(source, /action === "show-all-categories"[\s\S]{0,420}hiddenMarkers\.clear\(\)/u, "Show all must restore individually hidden markers too");
});

test("category rows keep readable names and controls instead of collapsing to icon-only buttons", () => {
  assert.match(source, /world-city-map-category-main/u, "category needs a dedicated readable main row");
  assert.match(source, /world-city-map-category-label/u, "category label needs a dedicated element");
  assert.match(css, /\.world-city-map-category-main[\s\S]{0,320}grid-template-columns:/u);
  assert.match(css, /\.world-city-map-category-main[\s\S]{0,500}width:\s*100%/u);
  assert.match(css, /\.world-city-map-category-label[\s\S]{0,300}text-overflow:\s*ellipsis/u);
});
