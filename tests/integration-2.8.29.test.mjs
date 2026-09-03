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

test("2.8.29 allows native minimized Archive window to collapse to header height", () => {
  assert.match(
    css,
    /\.neuro-archive-application\.minimized\s*\{[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?height:\s*auto\s*!important;/u,
  );
  assert.match(
    css,
    /\.neuro-archive-application\.minimized\s+\.window-content\s*\{[\s\S]*?display:\s*none\s*!important;/u,
  );
});

test("2.8.29 puts contact gallery after fragments in all three archive dossiers", () => {
  for (const source of [neuro, cyber, neo]) {
    const body = personOverviewBody(source);
    const fragmentsIndex = body.indexOf("readFragments(person)");
    const galleryIndex = Math.max(body.lastIndexOf("Галерея контакта"), body.lastIndexOf(">▧ Галерея<"));
    assert.ok(fragmentsIndex >= 0, "person dossier must render fragments");
    assert.ok(galleryIndex > fragmentsIndex, "gallery must render after fragments at the bottom");
  }
});

test("2.8.29 changelog preserves the historical compact meeting-layout change", () => {
  assert.match(changelog, /## 2\.8\.29[\s\S]*?(Где встречали|Где пересекались)/u);
});

test("2.8.29 metadata and changelog are synchronized", () => {
  assert.equal(moduleJson.version, packageJson.version);
  assert.ok(Number(moduleJson.version.split(".").at(-1)) >= 29);
  assert.match(changelog, /## 2\.8\.29/u);
  assert.match(changelog, /Галере/u);
  assert.match(changelog, /Где встречали|Где пересекались/u);
  assert.match(changelog, /minimized|сворач/u);
});
