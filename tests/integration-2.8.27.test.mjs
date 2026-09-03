import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const runtime = read("runtime/neuro-archive-runtime.mjs");
const css = read("styles/neuro-archive.css");
const changelog = read("CHANGELOG.md");
const moduleJson = JSON.parse(read("module.json"));
const packageJson = JSON.parse(read("package.json"));

test("2.8.27 mode toolbar uses stable text glyphs instead of Font Awesome for injected controls", () => {
  assert.match(runtime, /symbol\s*=\s*""/u);
  assert.match(runtime, /<b[^>]*>\$\{symbol\}<\/b>/u);
  assert.match(runtime, /symbol:\s*"⇄"/u);
  assert.match(runtime, /symbol:\s*"⇩"/u);
  assert.match(runtime, /symbol:\s*"≡"/u);
  const buttonFactory = runtime.slice(runtime.indexOf("_modeToolbarButton"), runtime.indexOf("_installModeToolbarControls"));
  assert.doesNotMatch(buttonFactory, /fa-solid/u);
});

test("2.8.27 compact implementation remains documented historically after later replacement", () => {
  assert.match(changelog, /## 2\.8\.27/u);
  assert.match(changelog, /двойн/u);
  assert.match(changelog, /compact|сворач/u);
});

test("2.8.27 metadata and changelog are synchronized", () => {
  assert.ok(Number(moduleJson.version.split(".").at(-1)) >= 27);
  assert.equal(packageJson.version, moduleJson.version);
  assert.match(changelog, /## 2\.8\.27/u);
  assert.match(changelog, /двойн/u);
  assert.match(changelog, /Поделиться/u);
});
