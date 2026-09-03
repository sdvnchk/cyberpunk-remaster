import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const css = read("styles/neuro-archive.css");

test("2.8.24 Neo media cards keep their own geometry after global button scaling", () => {
  assert.match(css, /2\.8\.24 — Neo Archive media geometry lock/u);
  assert.match(css, /\.archive-mode-neo[\s\S]{0,220}\.pcm-location-open[\s\S]{0,180}min-height:\s*145px\s*!important/u);
  assert.match(css, /\.archive-mode-neo[\s\S]{0,220}\.pcm-contact-open[\s\S]{0,180}min-height:\s*90px\s*!important/u);
  assert.match(css, /\.archive-mode-neo[\s\S]{0,220}\.pcm-person-open[\s\S]{0,180}min-height:\s*86px\s*!important/u);
  assert.match(css, /\.archive-mode-neo[\s\S]{0,220}\.pcm-record-open[\s\S]{0,180}min-height:\s*104px\s*!important/u);
});

test("2.8.24 Neo cover and avatar frames isolate intrinsic image size from grid layout", () => {
  for (const selector of [
    ".pcm-thumb",
    ".pcm-cover",
    ".pcm-location-image",
    ".pcm-location-hero-image",
    ".pcm-person-portrait",
    ".pcm-person-image",
    ".pcm-contact-photo",
    ".pcm-gallery-preview",
    ".pcm-faction-symbol",
    ".pcm-picker-avatar",
    ".pcm-record-avatar",
  ]) {
    assert.ok(css.includes(selector), `${selector} must be covered by the Neo media fix`);
  }
  assert.match(css, /position:\s*relative\s*!important/u);
  assert.match(css, /contain:\s*paint\s*!important/u);
  assert.match(css, /position:\s*absolute\s*!important/u);
  assert.match(css, /inset:\s*0\s*!important/u);
  assert.match(css, /object-position:\s*center\s*!important/u);
  assert.match(css, /transform:\s*none\s*!important/u);
});

test("2.8.24 Neo flow images remain centered without absolute positioning", () => {
  assert.match(css, /#pcm-root\.archive-mode-neo \.pcm-gallery-view img\s*\{[\s\S]{0,360}display:\s*block\s*!important/u);
  assert.match(css, /#pcm-root\.archive-mode-neo \.pcm-fragment-img,[\s\S]{0,700}margin-inline:\s*auto\s*!important/u);
  assert.match(css, /#pcm-root\.archive-mode-neo \.pcm-lightbox img\s*\{[\s\S]{0,220}object-fit:\s*contain\s*!important/u);
});

test("2.8.24 Neo location thumbnails adapt to the embedded Foundry window", () => {
  assert.match(css, /@container\s*\(max-width:\s*720px\)[\s\S]*\.archive-mode-neo[\s\S]{0,260}\.pcm-location-open[\s\S]{0,220}grid-template-columns:\s*100px\s+minmax\(0,\s*1fr\)\s+18px\s*!important/u);
});

test("2.8.24 metadata and changelog are synchronized", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const changelog = read("CHANGELOG.md");
  assert.equal(manifest.version, pkg.version);
  assert.ok(Number(manifest.version.split(".").at(-1)) >= 24);
  assert.match(changelog, /^## 2\.8\.24\b/mu);
});
