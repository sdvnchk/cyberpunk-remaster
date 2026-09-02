import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.17 labels all three archive modes as RED", () => {
  const template = read("templates/neuro-archive.hbs");
  assert.equal((template.match(/<small>RED<\/small>/gu) || []).length, 3);
  assert.doesNotMatch(template, /<small>7\.[13]<\/small>/u);
});

test("2.8.17 makes embedded archives responsive to the Foundry window container", () => {
  const css = read("styles/neuro-archive.css");
  assert.match(css, /\.neuro-archive-mode-host\s*\{[^}]*container-type:\s*size/ums);
  assert.match(css, /@container\s*\(max-width:\s*980px\)/u);
  assert.match(css, /@container\s*\(max-width:\s*720px\)/u);
  assert.match(css, /\.archive-mode-neo[^}]*\.pcm-tools-grid/u);
});

test("2.8.17 stabilizes Neo Archive tool icons", () => {
  const css = read("styles/neuro-archive.css");
  assert.match(css, /\.archive-mode-neo[^}]*\.pcm-tools-grid\s*>\s*button\s*>\s*b/ums);
  assert.match(css, /place-items:\s*center/u);
  assert.match(css, /line-height:\s*1/u);
});

test("2.8.17 uses the Field Archive neuro-link chat card in Neuro Archive", () => {
  const controller = read("runtime/neuro-archive-controller.mjs");
  assert.match(controller, /night-city-neuro-link-message/u);
  assert.match(controller, /НЕЙРО-СВЯЗЬ \/\//u);
  assert.match(controller, /#00d5d5/u);
});

test("2.8.17 gives Neuro Archive contact comms the neural channel surface", () => {
  const controller = read("runtime/neuro-archive-controller.mjs");
  const css = read("styles/neuro-archive.css");
  assert.match(controller, /NEURAL CHANNEL \/\/ PRIVATE/u);
  assert.match(controller, /pcm-neuro-status/u);
  assert.match(css, /\.pcm-contact-comms\.pcm-neuro-link-surface/u);
});

test("2.8.17 changelog entry remains documented", () => {
  const changelog = read("CHANGELOG.md");
  assert.match(changelog, /^## 2\.8\.17\b/mu);
});
