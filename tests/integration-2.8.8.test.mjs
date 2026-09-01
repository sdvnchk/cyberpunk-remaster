import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.8 Implant Creator delegates global capacity to the native Chrome rule when available", () => {
  const creator = read("runtime/implant-creator.mjs");
  assert.match(creator, /CyberwareTab\?\.implantCapacity\?\./u);
});



test("2.8.8 Implant Creator does not duplicate native Chrome capacity badges", () => {
  const creator = read("runtime/implant-creator.mjs");
  assert.match(creator, /root\.querySelector\(['"]\.cw-capacity-indicator['"]\)/u);
  assert.match(creator, /if \(root\.querySelector\(['"]\.cw-capacity-indicator['"]\)\)[\s\S]{0,240}return;/u);
});
test("2.8.8 native Chrome tab renders capacity indicators for all three implant groups", () => {
  const template = read("templates/cyberware-tab.hbs");
  assert.match(template, /internalCapacity/u);
  assert.match(template, /externalCapacity/u);
  assert.match(template, /fashionCapacity/u);
  assert.match(template, /cw-capacity-indicator/u);
});

test("2.8.8 contact overview creates hooks from the contact and no longer puts a plus button on notes", () => {
  const controller = read("runtime/neuro-archive-controller.mjs");
  assert.match(controller, /data-action="add-person-clue"/u);
  assert.match(controller, /personId:\s*entry\.id/u);
  assert.doesNotMatch(controller, /data-action="edit-person-notes"/u);
});

test("2.8.8 uses one responsive UI font across Forge, Neuro Archive and Implant Creator", () => {
  const shared = read("styles/cyberpunk-windows.css");
  assert.match(shared, /--cyber-ui-font:/u);
  assert.match(shared, /\.cpel-neon-forge-application/u);
  assert.match(shared, /\.neuro-archive-application/u);
  assert.match(shared, /\.cic-root/u);
  assert.match(shared, /container-type:\s*inline-size/u);
  assert.match(shared, /@container/u);
});



test("2.8.8 shared UI font also overrides tool headings and tables", () => {
  const shared = read("styles/cyberpunk-windows.css");
  assert.match(shared, /:is\(h1, h2, h3, h4, h5, h6,/u);
  assert.match(shared, /font-family:\s*var\(--cyber-ui-font\)\s*!important/u);
});

test("2.8.8 Implant Creator window clamp shrinks below legacy 820x560 minima on small viewports", () => {
  const creator = read("runtime/implant-creator.mjs");
  assert.match(creator, /const maxWidth = Math\.max\(320, viewportWidth - 24\)/u);
  assert.match(creator, /const minWidth = Math\.min\(820, maxWidth\)/u);
  assert.match(creator, /const minHeight = Math\.min\(560, maxHeight\)/u);
  assert.doesNotMatch(creator, /Math\.max\(geometry\?\.width \?\? 1180, 820\)/u);
});
test("2.8.8 NPC and character Chrome tab share the same explicit font and scrollable flex layout", () => {
  const tab = read("sheets/CyberwareTab.js");
  const styles = read("styles/cyberware.css");
  assert.match(tab, /content\.classList\.add\("cw-sheet-content-host"\)/u);
  assert.match(styles, /\.cw-sheet-content-host:has\(> section\.tab\.cyberware\.active\)/u);
  assert.match(styles, /grid-template-rows:\s*minmax\(0, 1fr\)/u);
  assert.match(styles, /section\.tab\.cyberware\.active/u);
  assert.match(styles, /font-family:\s*var\(--cyber-ui-font/u);
  assert.match(styles, /overflow-y:\s*auto/u);
  assert.match(styles, /container-type:\s*inline-size/u);
});

test("2.8.8 metadata and changelog are synchronized", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const changelog = read("CHANGELOG.md");
  const readme = read("README.md");
  assert.equal(manifest.version, pkg.version);
  assert.ok(Number(manifest.version.split(".").at(-1)) >= 8);
  assert.match(changelog, /^## 2\.8\.8\b/mu);
  assert.match(changelog, /7.*14|14.*7/u);
  assert.match(changelog, /Зацеп/u);
  assert.match(changelog, /адаптив/u);
  assert.match(readme, new RegExp(`Версия:\\s*\\*\\*${manifest.version.replaceAll(".", "\\.")}\\*\\*`, "u"));
});
