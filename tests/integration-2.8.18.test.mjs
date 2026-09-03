import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.18 can collapse only the internal archive switcher and restore it", () => {
  const template = read("templates/neuro-archive.hbs");
  const runtime = read("runtime/neuro-archive-runtime.mjs");
  const css = read("styles/neuro-archive.css");

  assert.match(template, /data-archive-hub-toggle/u);
  assert.match(runtime, /neuro-archive-hub-collapsed\.v1/u);
  assert.match(runtime, /dataset\.hubCollapsed/u);
  assert.match(runtime, /data-archive-hub-toolbar/u);
  assert.match(css, /data-hub-collapsed=["']true["']/u);
  assert.match(css, /archive-hub-toolbar/u);
});

test("2.8.18 stores archive appearance independently for neuro, cyber and neo", async () => {
  const store = await import("../runtime/neuro-archive-store.mjs");
  assert.equal(typeof store.readArchiveAppearance, "function");
  assert.equal(typeof store.writeArchiveAppearance, "function");

  const notebook = { appearance: { preset: "legacy", fontSize: 15 } };
  const neuro = store.readArchiveAppearance(notebook, "neuro");
  const cyber = store.readArchiveAppearance(notebook, "cyber");
  const neo = store.readArchiveAppearance(notebook, "neo");
  assert.deepEqual(neuro, { preset: "legacy", fontSize: 15 });
  assert.deepEqual(cyber, { preset: "legacy", fontSize: 15 });
  assert.deepEqual(neo, { preset: "legacy", fontSize: 15 });

  store.writeArchiveAppearance(notebook, "cyber", { preset: "cyber-only", fontSize: 17 });
  assert.deepEqual(store.readArchiveAppearance(notebook, "cyber"), { preset: "cyber-only", fontSize: 17 });
  assert.deepEqual(store.readArchiveAppearance(notebook, "neuro"), { preset: "legacy", fontSize: 15 });
  assert.deepEqual(store.readArchiveAppearance(notebook, "neo"), { preset: "legacy", fontSize: 15 });
});

test("2.8.18 controllers bind their own appearance slot", () => {
  const neuro = read("runtime/neuro-archive-controller.mjs");
  const cyber = read("runtime/cyber-archive-controller.mjs");
  const neo = read("runtime/neo-archive-controller.mjs");
  assert.match(neuro, /readArchiveAppearance\(book,\s*["']neuro["']/u);
  assert.match(cyber, /readArchiveAppearance\(book,\s*["']cyber["']/u);
  assert.match(neo, /readArchiveAppearance\(book,\s*["']neo["']/u);
  assert.match(neuro, /writeArchiveAppearance\(notebook\(\),\s*["']neuro["']/u);
  assert.match(cyber, /writeArchiveAppearance\(notebook\(\),\s*["']cyber["']/u);
  assert.match(neo, /writeArchiveAppearance\(notebook\(\),\s*["']neo["']/u);
});

test("2.8.18 changelog remains documented after later releases", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const changelog = read("CHANGELOG.md");
  assert.equal(manifest.version, pkg.version);
  assert.match(changelog, /^## 2\.8\.18\b/mu);
});
