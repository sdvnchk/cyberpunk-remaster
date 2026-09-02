import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.16 automatically migrates Field Archive saves on Foundry ready", () => {
  const runtime = read("runtime/neuro-archive-runtime.mjs");
  assert.match(runtime, /migrateLegacyArchivesOnReady/u);
  assert.match(runtime, /Hooks\.once\("ready"/u);
});

test("2.8.16 migration explicitly reads the 7.1\/7.3 server flag and browser draft key", () => {
  const store = read("runtime/neuro-archive-store.mjs");
  assert.match(store, /nightCityFieldArchive\?\.data/u);
  assert.match(store, /night-city-field-archive:\$\{worldId\}:\$\{userId\}/u);
  assert.match(store, /migrateLegacyFieldArchiveUser/u);
});

test("2.8.16 metadata and changelog document automatic Field Archive migration", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const changelog = read("CHANGELOG.md");
  assert.ok(Number(manifest.version.split(".").at(-1)) >= 16);
  assert.equal(pkg.version, manifest.version);
  assert.match(changelog, /^## 2\.8\.16\b/mu);
  assert.match(changelog, /7\.1\.0/u);
  assert.match(changelog, /7\.3\.4/u);
  assert.match(changelog, /автомат/u);
});
