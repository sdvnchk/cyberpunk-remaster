import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.19 adds a full Archive Hub collapse control in the Foundry window header", () => {
  const runtime = read("runtime/neuro-archive-runtime.mjs");
  const css = read("styles/neuro-archive.css");
  assert.match(runtime, /neuro-archive-window-collapsed\.v1/u);
  assert.match(runtime, /data-archive-window-toggle/u);
  assert.match(runtime, /archive-window-collapsed/u);
  assert.match(css, /\.neuro-archive-application\.archive-window-collapsed/u);
  assert.match(css, /archive-window-collapsed[^}]*\.window-content/ums);
});

test("2.8.19 scales text from the user font setting in all three archive controllers", () => {
  for (const file of [
    "runtime/neuro-archive-controller.mjs",
    "runtime/cyber-archive-controller.mjs",
    "runtime/neo-archive-controller.mjs",
  ]) {
    const source = read(file);
    assert.match(source, /applyArchiveTextScale/u, `${file} must use shared text scaling`);
    assert.match(source, /observeArchiveTextScale/u, `${file} must refresh text scaling on resize`);
  }
});

test("2.8.19 protects icon-only glyphs and Font Awesome from text scaling", () => {
  const helper = read("runtime/archive-ui-utils.mjs");
  assert.match(helper, /FONT_AWESOME_CLASSES/u);
  assert.match(helper, /ICON_ONLY_SELECTOR/u);
  assert.match(helper, /style\.setProperty\("font-size"/u);
  assert.match(helper, /"important"/u);
});

test("2.8.19 font scale ratio is based on each archive native size", async () => {
  const { archiveFontScale } = await import("../runtime/archive-ui-utils.mjs");
  assert.equal(archiveFontScale(13, 13), 1);
  assert.equal(archiveFontScale(17, 13), 17 / 13);
  assert.equal(archiveFontScale(15, 15), 1);
  assert.equal(archiveFontScale(20, 15), 20 / 15);
});

test("2.8.19 remains documented after later releases", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const changelog = read("CHANGELOG.md");
  assert.equal(manifest.version, pkg.version);
  assert.match(changelog, /^## 2\.8\.19\b/mu);
});
