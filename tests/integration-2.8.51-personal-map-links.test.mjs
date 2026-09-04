import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controllerFiles = [
  "neuro-archive-controller.mjs",
  "cyber-archive-controller.mjs",
  "neo-archive-controller.mjs",
];

function readRuntime(name) {
  return readFileSync(new URL(`../runtime/${name}`, import.meta.url), "utf8");
}

test("all archive controllers expose personal player point associations without replacing GM shared links", () => {
  for (const file of controllerFiles) {
    const source = readRuntime(file);
    assert.match(source, /from "\.\/world-city-map-user-links\.mjs"/u, `${file} must import personal link service`);
    assert.match(source, /personalLinksForArchiveEntry/u, `${file} must read personal links`);
    assert.match(source, /addPersonalWorldMapLink/u, `${file} must add personal links`);
    assert.match(source, /removePersonalWorldMapLink/u, `${file} must remove personal links`);
    assert.match(source, /data-action="link-personal-map-marker"/u, `${file} must render player add control`);
    assert.match(source, /data-action="unlink-personal-map-marker"/u, `${file} must render player remove control`);
    assert.match(source, /action === "link-personal-map-marker"[\s\S]{0,700}!game\.user\?\.isGM/u, `${file} player write handler must be non-GM only`);
    assert.match(source, /action === "link-map-marker"[\s\S]{0,300}game\.user\?\.isGM/u, `${file} must keep GM shared-link handler`);
    assert.match(source, /activeActorId:\s*String\(state\.store\?\.activeActorId \|\| ""\)/u, `${file} must pass active Actor into map view`);
  }
});

test("player archive point rows distinguish shared read-only links from removable personal links", () => {
  for (const file of controllerFiles) {
    const source = readRuntime(file);
    assert.match(source, /pcm-world-map-link-row shared/u, `${file} must mark shared rows`);
    assert.match(source, /pcm-world-map-link-row personal/u, `${file} must mark personal rows`);
    assert.match(source, /sharedIds\.has\(marker\.id\)/u, `${file} must deduplicate shared and personal marker rows`);
  }
});

test("world map detail merges current Actor personal links with shared marker links and deduplicates archive records", () => {
  const source = readRuntime("world-city-map-view.mjs");
  assert.match(source, /personalLinksForMarker/u);
  assert.match(source, /const activeActorId = clean\(context\.activeActorId\)/u);
  assert.match(source, /function detailLinksForMarker/u);
  assert.match(source, /new Map\(\)/u);
  assert.match(source, /actorId:\s*activeActorId/u);
  assert.match(source, /detailLinksForMarker\(marker\)/u);
});
