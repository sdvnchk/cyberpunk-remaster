import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const runtime = read("runtime/neuro-archive-runtime.mjs");
const template = read("templates/neuro-archive.hbs");
const css = read("styles/neuro-archive.css");
const changelog = read("CHANGELOG.md");
const moduleJson = JSON.parse(read("module.json"));
const packageJson = JSON.parse(read("package.json"));

test("2.8.25 moves Share and Inbox out of the global archive switcher", () => {
  assert.doesNotMatch(template, /data-archive-share-open/u);
  assert.doesNotMatch(template, /data-archive-share-inbox/u);
  assert.match(runtime, /_installModeToolbarControls/u);
  assert.match(runtime, /data-archive-share-open/u);
  assert.match(runtime, /data-archive-share-inbox/u);
  assert.match(runtime, /\.pcm-top-actions/u);
  assert.match(runtime, /header\.pcm-top/u);
});

test("2.8.25 puts the collapsed hub reveal control inside the active mode toolbar", () => {
  assert.doesNotMatch(template, /archive-hub-reveal/u);
  assert.match(runtime, /data-archive-hub-toolbar/u);
  assert.match(runtime, /Архивы/u);
  assert.match(css, /archive-hub-toolbar/u);
});

test("2.8.25 drops the custom fake full-window collapse and uses native ApplicationV2 minimization", () => {
  assert.match(runtime, /minimizable:\s*true/u);
  assert.doesNotMatch(runtime, /_ensureWindowCollapseControl/u);
  assert.doesNotMatch(runtime, /_updateWindowCollapsedState/u);
  assert.doesNotMatch(runtime, /archive-window-collapsed/u);
  assert.doesNotMatch(css, /\.neuro-archive-application\.archive-window-collapsed/u);
});

test("2.8.25 toolbar controls remain mode-local and responsive", () => {
  assert.match(runtime, /archive-mode-toolbar-button/u);
  assert.match(css, /archive-mode-toolbar-button/u);
  assert.match(css, /archive-share-inbox-count/u);
});

test("2.8.25 metadata and changelog are synchronized", () => {
  assert.ok(Number(moduleJson.version.split(".").at(-1)) >= 25);
  assert.equal(packageJson.version, moduleJson.version);
  assert.match(changelog, /## 2\.8\.25/u);
  assert.match(changelog, /Поделиться/u);
  assert.match(changelog, /двойн/u);
});
