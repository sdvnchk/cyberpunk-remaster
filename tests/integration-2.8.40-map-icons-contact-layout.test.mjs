import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controllers = [
  "neuro-archive-controller.mjs",
  "cyber-archive-controller.mjs",
  "neo-archive-controller.mjs",
];

const runtimeUrl = new URL("../runtime/world-city-map.mjs", import.meta.url);

function readRuntime(name) {
  return readFileSync(new URL(`../runtime/${name}`, import.meta.url), "utf8");
}

test("contact relationship panels use Заказы wording and stable three-cell row markup", () => {
  for (const file of controllers) {
    const source = readRuntime(file);
    assert.doesNotMatch(source, /Гиги от контакта/u, `${file} must not label contact jobs as gigs`);
    assert.match(source, /data-action="add-person-gig"[^>]*>[\s\S]{0,90}Заказ/u, `${file} must label the create button as Заказ`);
    assert.match(source, /pcm-person-related-icon/u, `${file} must render a dedicated icon cell`);
    assert.match(source, /pcm-person-related-copy/u, `${file} must render a dedicated text cell`);
    assert.match(source, /pcm-person-related-arrow/u, `${file} must render a dedicated arrow cell`);
  }

  const css = readFileSync(new URL("../styles/neuro-archive.css", import.meta.url), "utf8");
  assert.match(css, /#pcm-root\s+\.pcm-related-row\.pcm-person-related-row[\s\S]{0,500}grid-template-columns:\s*24px\s+minmax\(0,\s*1fr\)\s+24px/u);
  assert.match(css, /\.pcm-person-related-copy[\s\S]{0,400}flex-direction:\s*column/u);
  assert.match(css, /\.pcm-person-related-copy\s*>\s*strong[\s\S]{0,300}text-overflow:\s*ellipsis/u);
  assert.match(css, /\.pcm-person-related-copy\s*>\s*small[\s\S]{0,300}white-space:\s*normal/u);
});

test("world map ships a broad Night City style category and icon preset library", async () => {
  const mod = await import(`${runtimeUrl.href}?v2840-presets=${Date.now()}`);
  assert.ok(mod.WORLD_MAP_ICON_PRESETS.length >= 20, "expected a real icon picker library");
  assert.ok(mod.DEFAULT_WORLD_MAP_CATEGORIES.length >= 20, "expected a broad default category set");

  const ids = new Set(mod.DEFAULT_WORLD_MAP_CATEGORIES.map((category) => category.id));
  for (const required of ["district", "fixer", "ncpd", "weapon", "ripperdoc", "bar", "tarot", "corporation", "megabuilding", "gang", "poi"]) {
    assert.ok(ids.has(required), `missing default category ${required}`);
  }
  for (const removed of ["contact", "gig", "clue", "cyberpsycho", "melee", "netrunner", "fast-travel", "drop-point", "npc"]) {
    assert.equal(ids.has(removed), false, `removed category ${removed} must not be a default row`);
    assert.ok(mod.WORLD_MAP_ICON_PRESETS.some((preset) => preset.id === removed), `icon preset ${removed} should remain available`);
  }

  for (const category of mod.DEFAULT_WORLD_MAP_CATEGORIES) {
    assert.match(category.color, /^#[0-9a-f]{6}$/iu, `${category.id} needs a hex color`);
    assert.ok(category.icon, `${category.id} needs an icon`);
  }
});

test("world map normalizes category colors and marker-level icon/color overrides", async () => {
  const mod = await import(`${runtimeUrl.href}?v2840-normalize=${Date.now()}`);
  const state = mod.normalizeWorldCityMap({
    categories: [{ id: "custom", label: "Custom", icon: "fa:fa-star", color: "#12ABef" }],
    markers: [
      { id: "inherit", x: 0.1, y: 0.2, categoryId: "custom", icon: "", color: "" },
      { id: "override", x: 0.3, y: 0.4, categoryId: "custom", icon: "fa:fa-bolt", color: "#FF0066" },
      { id: "bad", x: 0.5, y: 0.6, categoryId: "custom", color: "red" },
    ],
  });

  const custom = state.categories.find((category) => category.id === "custom");
  assert.equal(custom.color, "#12abef");
  assert.equal(custom.icon, "fa:fa-star");
  assert.equal(state.markers.find((marker) => marker.id === "inherit").icon, "");
  assert.equal(state.markers.find((marker) => marker.id === "inherit").color, "");
  assert.equal(state.markers.find((marker) => marker.id === "override").icon, "fa:fa-bolt");
  assert.equal(state.markers.find((marker) => marker.id === "override").color, "#ff0066");
  assert.equal(state.markers.find((marker) => marker.id === "bad").color, "");
});

test("world map view exposes icon and color pickers for categories and markers", () => {
  const source = readRuntime("world-city-map-view.mjs");
  assert.match(source, /data-world-map-new-category-icon/u);
  assert.match(source, /data-world-map-new-category-color/u);
  assert.match(source, /type="color"/u);
  assert.match(source, /data-world-map-edit-category/u);
  assert.match(source, /data-world-map-field="icon"/u);
  assert.match(source, /data-world-map-field="color"/u);
  assert.match(source, /worldMapIconHtml/u);
  assert.match(source, /--world-map-marker-color/u);
});

test("v1 world maps migrate legacy default glyphs to the new category icon library", async () => {
  const mod = await import(`${runtimeUrl.href}?v2840-migrate=${Date.now()}`);
  const state = mod.normalizeWorldCityMap({
    version: 1,
    categories: [
      { id: "district", label: "Районы", icon: "⌖" },
      { id: "gig", label: "Гиги", icon: "▤" },
      { id: "poi", label: "Интерес", icon: "◆" },
    ],
    markers: [
      { id: "legacy", x: 0.2, y: 0.3, categoryId: "gig", icon: "▤" },
      { id: "custom-icon", x: 0.4, y: 0.5, categoryId: "gig", icon: "⚡" },
    ],
  });

  assert.equal(state.version, mod.WORLD_CITY_MAP_VERSION);
  assert.equal(state.categories.some((category) => category.id === "gig"), false);
  assert.equal(state.markers.find((marker) => marker.id === "legacy").categoryId, "poi");
  assert.equal(state.markers.find((marker) => marker.id === "legacy").icon, "");
  assert.equal(state.markers.find((marker) => marker.id === "custom-icon").categoryId, "poi");
  assert.equal(state.markers.find((marker) => marker.id === "custom-icon").icon, "⚡");
});
