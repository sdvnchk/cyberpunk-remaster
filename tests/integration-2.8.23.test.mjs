import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const service = read("runtime/archive-share-service.mjs");
const runtime = read("runtime/neuro-archive-runtime.mjs");
const neuro = read("runtime/neuro-archive-controller.mjs");
const cyber = read("runtime/cyber-archive-controller.mjs");
const neo = read("runtime/neo-archive-controller.mjs");
const css = read("styles/neuro-archive.css");

test("2.8.23 share overlays inherit active archive theme variables", () => {
  assert.match(service, /SHARE_THEME_PROPERTIES/u);
  assert.match(service, /captureArchiveShareTheme/u);
  assert.match(service, /themeSource/u);
  assert.match(service, /dataset\.archiveShareMode/u);
  assert.match(service, /style\.setProperty/u);
  for (const variable of ["--bg", "--panel", "--ink", "--muted", "--gold", "--teal", "--line", "--theme-node", "--theme-trace", "--theme-warning"]) {
    assert.ok(service.includes(`"${variable}"`), `${variable} must be copied into the share overlay`);
  }
});

test("2.8.23 share dialogs use semantic archive theme colors instead of fixed teal palette", () => {
  assert.match(css, /--archive-share-accent:\s*var\(--gold/u);
  assert.match(css, /\[data-archive-share-mode="neo"\][\s\S]*--archive-share-accent:\s*var\(--theme-node/u);
  assert.match(css, /\.archive-share-window\s*\{[\s\S]*background:\s*var\(--archive-share-bg/u);
  assert.match(css, /color:\s*var\(--archive-share-ink/u);
  assert.match(css, /border-color:\s*var\(--archive-share-line/u);
  assert.match(css, /\.archive-share-footer\s*>\s*button\.primary[\s\S]*background:\s*var\(--archive-share-accent/u);
});

test("2.8.23 all three archive entry share actions pass their own theme source and mode", () => {
  assert.match(neuro, /openArchiveShareDialog\(\{[\s\S]{0,800}themeSource:\s*state\.root[\s\S]{0,300}archiveMode:\s*"neuro"/u);
  assert.match(cyber, /openArchiveShareDialog\(\{[\s\S]{0,500}themeSource:\s*state\.root[\s\S]{0,200}archiveMode:\s*"cyber"/u);
  assert.match(neo, /openArchiveShareDialog\(\{[\s\S]{0,500}themeSource:\s*state\.root[\s\S]{0,200}archiveMode:\s*"neo"/u);
});

test("2.8.23 hub share scope and inbox pass active mode theme to body overlays", () => {
  assert.match(runtime, /openArchiveShareScopePicker\(snapshot,\s*\{[\s\S]{0,300}themeSource:/u);
  assert.match(runtime, /archiveMode:\s*this\.archiveMode/u);
  assert.match(runtime, /openArchiveShareInbox\(\{[\s\S]{0,500}themeSource:/u);
});

test("2.8.23 changelog remains documented and package versions stay synchronized", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const changelog = read("CHANGELOG.md");
  assert.equal(manifest.version, pkg.version);
  const parts = String(manifest.version).split(".").map(Number);
  assert.ok(parts[0] > 2 || (parts[0] === 2 && (parts[1] > 8 || (parts[1] === 8 && parts[2] >= 23))));
  assert.match(changelog, /^## 2\.8\.23\b/mu);
});
