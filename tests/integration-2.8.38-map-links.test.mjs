import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

for (const file of ["neuro-archive-controller.mjs","cyber-archive-controller.mjs","neo-archive-controller.mjs"]) {
  test(`${file} exposes archive record map links`, () => {
    const source = readFileSync(new URL(`../runtime/${file}`, import.meta.url), "utf8");
    assert.match(source, /Точки на карте/u);
    assert.match(source, /data-action="open-map-marker"/u);
    assert.match(source, /data-action="link-map-marker"/u);
    assert.match(source, /data-action="unlink-map-marker"/u);
    assert.match(source, /markersForArchiveEntry/u);
    assert.match(source, /linkMarkerToArchiveEntry/u);
    assert.match(source, /unlinkMarkerFromArchiveEntry/u);
  });
}

test("archive-side map link controls have dedicated responsive styling", () => {
  const css = readFileSync(new URL("../styles/world-city-map.css", import.meta.url), "utf8");
  assert.match(css, /\.pcm-world-map-links/u);
  assert.match(css, /\.pcm-world-map-link-row/u);
  assert.match(css, /\.pcm-world-map-link-add/u);
});
