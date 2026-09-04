import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controllers = ["neuro-archive-controller.mjs","cyber-archive-controller.mjs","neo-archive-controller.mjs"];
for (const file of controllers) {
  test(`${file} delegates citymap to the shared world map`, () => {
    const source = readFileSync(new URL(`../runtime/${file}`, import.meta.url), "utf8");
    assert.match(source, /world-city-map-view\.mjs/u);
    assert.match(source, /data-world-city-map-host/u);
    assert.match(source, /renderWorldCityMap\(/u);
    assert.match(source, /worldMapController\?\.destroy/u);
    assert.match(source, /openWorldMapArchiveLink/u);
    assert.match(source, /worldMapRecordCatalog/u);
    assert.doesNotMatch(source, /Карта хранится отдельно для выбранного персонажа/u);
  });
}

test("neuro archive exposes the shared map in navigation", () => {
  const source = readFileSync(new URL("../runtime/neuro-archive-controller.mjs", import.meta.url), "utf8");
  assert.match(source, /data-section="citymap"|nav\("citymap"/u);
  assert.match(source, /key === "citymap"/u);
});

test("runtime registers shared world map setting and module stylesheet", () => {
  const runtime = readFileSync(new URL("../runtime/neuro-archive-runtime.mjs", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  assert.match(runtime, /registerWorldCityMapSetting/u);
  assert.ok(manifest.styles.some((entry) => entry.src === "styles/world-city-map.css"));
});
