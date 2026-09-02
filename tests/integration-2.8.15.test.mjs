import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.15 exposes three archive modes in one ApplicationV2 shell", () => {
  const runtime = read("runtime/neuro-archive-runtime.mjs");
  const template = read("templates/neuro-archive.hbs");
  assert.match(runtime, /Нейро-Архив/u);
  assert.match(runtime, /Кибер-Архив/u);
  assert.match(runtime, /Нео-Архив/u);
  assert.match(runtime, /createCyberArchiveController/u);
  assert.match(runtime, /createNeoArchiveController/u);
  assert.match(template, /data-archive-mode="neuro"/u);
  assert.match(template, /data-archive-mode="cyber"/u);
  assert.match(template, /data-archive-mode="neo"/u);
  assert.match(template, /data-archive-mode-host/u);
});

test("2.8.15 all archive controllers use the shared canonical storage", () => {
  const current = read("runtime/neuro-archive-controller.mjs");
  const cyber = read("runtime/cyber-archive-controller.mjs");
  const neo = read("runtime/neo-archive-controller.mjs");
  for (const source of [current, cyber, neo]) {
    assert.match(source, /readUnifiedServerData/u);
    assert.match(source, /cyberpunkRemaster\.neuroArchive\.data/u);
  }
  assert.doesNotMatch(cyber, /flags\.nightCityFieldArchive\.data\s*:/u);
  assert.doesNotMatch(neo, /flags\.nightCityFieldArchive\.data\s*:/u);
});

test("2.8.15 field archive ports are host-mounted controllers, not independent body windows", () => {
  const cyber = read("runtime/cyber-archive-controller.mjs");
  const neo = read("runtime/neo-archive-controller.mjs");
  assert.match(cyber, /export async function createCyberArchiveController/u);
  assert.match(neo, /export async function createNeoArchiveController/u);
  assert.doesNotMatch(cyber, /document\.body\.appendChild\(root\)/u);
  assert.doesNotMatch(neo, /document\.body\.appendChild\(root\)/u);
  assert.doesNotMatch(cyber, /globalThis\[GLOBAL_KEY\]\s*=\s*api/u);
  assert.doesNotMatch(neo, /globalThis\[GLOBAL_KEY\]\s*=\s*api/u);
  assert.match(cyber, /flush\(\)/u);
  assert.match(neo, /flush\(\)/u);
});

test("2.8.15 metadata and changelog describe unified archive modes", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const changelog = read("CHANGELOG.md");
  assert.equal(manifest.version, pkg.version);
  assert.ok(Number(manifest.version.split(".").at(-1)) >= 15);
  assert.match(changelog, /^## 2\.8\.15\b/mu);
  assert.match(changelog, /Кибер-Архив/u);
  assert.match(changelog, /Нео-Архив/u);
  assert.match(changelog, /общ/u);
});

test("2.8.15 field archive messaging persists into the shared contact messages array", () => {
  const cyber = read("runtime/cyber-archive-controller.mjs");
  const neo = read("runtime/neo-archive-controller.mjs");
  for (const source of [cyber, neo]) {
    assert.match(source, /appendUnifiedContactMessage/u);
    assert.match(source, /direction:\s*"out"/u);
    assert.match(source, /direction:\s*"in"/u);
    assert.match(source, /writeUnifiedServerData/u);
  }
});

test("2.8.15 embedded field archive CSS wins after all standalone window rules", () => {
  for (const file of ["runtime/cyber-archive-controller.mjs", "runtime/neo-archive-controller.mjs"]) {
    const source = read(file);
    const fixedRules = [
      source.lastIndexOf(".pcm-window{pointer-events:auto;position:fixed"),
      source.lastIndexOf("#pcm-root .pcm-window{position:fixed!important}"),
    ];
    const lastStandaloneFixed = Math.max(...fixedRules);
    const lastEmbeddedOverride = source.lastIndexOf("${EMBEDDED_HOST_CSS}\n</style>");
    assert.ok(lastStandaloneFixed >= 0, `${file}: reference standalone fixed rule missing`);
    assert.ok(lastEmbeddedOverride > lastStandaloneFixed, `${file}: embedded host override interpolation must come after every pcm-window fixed rule`);
  }
});

test("2.8.15 migrates legacy Field Archive local drafts when canonical server data is absent", () => {
  const current = read("runtime/neuro-archive-controller.mjs");
  const cyber = read("runtime/cyber-archive-controller.mjs");
  const neo = read("runtime/neo-archive-controller.mjs");
  assert.match(current, /night-city-field-archive:\$\{worldId\}:\$\{userId\}/u);
  for (const source of [cyber, neo]) {
    assert.match(source, /night-city-field-archive:\$\{worldId\}:\$\{userId\}/u);
    assert.match(source, /const rawServer = serverData\(\)/u);
    assert.match(source, /!rawServer\s*\|\|/u);
  }
});
