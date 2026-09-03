import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const runtime = read("runtime/neuro-archive-runtime.mjs");
const css = read("styles/neuro-archive.css");
const changelog = read("CHANGELOG.md");
const moduleJson = JSON.parse(read("module.json"));
const packageJson = JSON.parse(read("package.json"));

test("2.8.28 leaves minimization to native ApplicationV2", () => {
  assert.match(runtime, /minimizable:\s*true/u);
  assert.doesNotMatch(runtime, /WINDOW_COMPACT_KEY/u);
  assert.doesNotMatch(runtime, /_toggleWindowCompact/u);
  assert.doesNotMatch(runtime, /_applyWindowCompactState/u);
  assert.doesNotMatch(runtime, /archive-window-compact/u);
  assert.doesNotMatch(runtime, /addEventListener\(["']dblclick["']/u);
  assert.doesNotMatch(runtime, /stopImmediatePropagation\(\)/u);
  assert.doesNotMatch(css, /\.neuro-archive-application\.archive-window-compact/u);
});

test("2.8.28 manual-tag editor spans the whole context menu and keeps action buttons usable", () => {
  assert.match(css, /\.archive-context-overlay-host \.pcm-context-tag-action\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/u);
  assert.match(css, /\.archive-context-overlay-host \.pcm-context-tag-editor\s*\{[\s\S]*?width:\s*100%/u);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+38px/u);
  assert.match(css, /\.archive-context-overlay-host \.pcm-context-tag-editor\s*>\s*(?:label|input)[\s\S]*?grid-column:\s*1\s*\/\s*-1/u);
  assert.match(css, /\.archive-context-overlay-host \.pcm-context-tag-editor label\s*>\s*span[\s\S]*?white-space:\s*nowrap/u);
});

test("2.8.28 changelog remains present in later synchronized builds", () => {
  assert.equal(moduleJson.version, packageJson.version);
  const [major, minor, patch] = moduleJson.version.split(".").map(Number);
  assert.ok(major > 2 || (major === 2 && (minor > 8 || (minor === 8 && patch >= 28))));
  assert.match(changelog, /## 2\.8\.28/u);
  assert.match(changelog, /ApplicationV2/u);
  assert.match(changelog, /Ручн/u);
});
