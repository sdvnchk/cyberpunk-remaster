import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("styles/neuro-archive.css");
const neuro = read("runtime/neuro-archive-controller.mjs");
const cyber = read("runtime/cyber-archive-controller.mjs");
const neo = read("runtime/neo-archive-controller.mjs");
const changelog = read("CHANGELOG.md");
const moduleJson = JSON.parse(read("module.json"));
const packageJson = JSON.parse(read("package.json"));

function personOverviewBody(source) {
  const marker = "function personOverview(book, person)";
  const start = source.lastIndexOf(marker);
  assert.notEqual(start, -1, "personOverview must exist");
  const end = source.indexOf("\n  function editorView", start);
  assert.notEqual(end, -1, "personOverview must end before editorView");
  return source.slice(start, end);
}

test("2.8.30 restores the meeting section to full dossier width in all archive modes", () => {
  for (const source of [neuro, cyber, neo]) {
    const body = personOverviewBody(source);
    assert.match(body, /pcm-detail-panel wide pcm-person-meetings/u);
  }
});

test("2.8.30 keeps location chips sequential while first/last meeting facts are compact", () => {
  for (const source of [neuro, cyber, neo]) {
    const body = personOverviewBody(source);
    assert.match(body, /pcm-person-meeting-meta/u);
    assert.match(body, /pcm-meeting-fact/u);
  }

  assert.match(
    css,
    /#pcm-root \.pcm-person-meetings \.pcm-location-chips\s*\{[\s\S]*?flex-direction:\s*row[\s\S]*?flex-wrap:\s*wrap/u,
  );
  assert.match(
    css,
    /#pcm-root \.pcm-person-meeting-meta\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(180px,\s*320px\)\)/u,
  );
});

test("2.8.30 stacks only meeting facts on narrow archive windows", () => {
  assert.match(
    css,
    /@container\s*\(max-width:\s*720px\)[\s\S]*?#pcm-root \.pcm-person-meeting-meta\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*320px\)/u,
  );
});

test("2.8.30 metadata and changelog remain preserved after later releases", () => {
  assert.equal(moduleJson.version, packageJson.version);
  assert.ok(Number(moduleJson.version.split(".").at(-1)) >= 30);
  assert.match(changelog, /## 2\.8\.30/u);
  assert.match(changelog, /Где встречали|Где пересекались/u);
  assert.match(changelog, /Первая встреча|Последняя встреча/u);
});
