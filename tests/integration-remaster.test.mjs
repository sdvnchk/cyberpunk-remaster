import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

function walkText(files) {
  return files.map((file) => [file, read(file)]);
}

test("integrated manifest and package versions are synchronized", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.compatibility.minimum, "14.360");
  assert.equal(manifest.compatibility.verified, "14.365");
  assert.equal(manifest.relationships.systems[0].compatibility.minimum, "1.4.0");
  assert.match(read("README.md"), new RegExp(`Версия:\\s*\\*\\*${manifest.version.replaceAll(".", "\\.")}\\*\\*`, "u"));
  assert.match(read("README.md"), /Foundry VTT:\s*\*\*14\.360\+\*\*.*14\.365/u);
  assert.match(read("README.md"), /SF2e:\s*\*\*1\.4\.0\+\*\*/u);
  assert.match(read("CHANGELOG.md"), new RegExp(`## ${manifest.version.replaceAll(".", "\\.")}\\b`, "u"));
});

test("Neuro-Archive 4.2 functionality is integrated in-place", () => {
  assert.match(read("runtime/neuro-archive-controller.mjs"), /contactFilteredPeople/u);
  assert.match(read("styles/neuro-archive.css"), /Neuro Archive 4\.2\.0/u);
  assert.match(read("styles/neuro-archive.css"), /\.pcm-contact-toolbar/u);
  assert.equal(existsSync(path.join(root, "neuro-archive")), false);
});

test("Neon Forge 1.4.31 functionality uses the remaster namespace and packs", () => {
  assert.equal(existsSync(path.join(root, "forge/customization.mjs")), true);
  assert.equal(existsSync(path.join(root, "forge/stat-profiles.mjs")), true);
  const constants = read("forge/constants.mjs");
  assert.match(constants, /MODULE_ID\s*=\s*"cyberpunk-remaster"/u);
  assert.match(constants, /cyberpunk-items/u);
  assert.match(read("templates/cyberpunk-forge.hbs"), /name="ability_\{\{slug\}\}"/u);
  assert.match(read("templates/cyberpunk-forge.hbs"), /name="save_\{\{slug\}\}_value"/u);
  assert.doesNotMatch(read("templates/cyberpunk-forge.hbs"), /name="sourceCpel"/u);
  for (const file of [
    "forge/forge-runtime.mjs",
    "forge/generator.mjs",
    "forge/storage.mjs",
    "templates/cyberpunk-forge.hbs",
  ]) {
    assert.doesNotMatch(read(file), /Neon-Кузниц/u, file);
  }
});

test("integrated runtime contains no dependency on the removed CPEL module", () => {
  const files = [
    "forge/catalog.mjs",
    "forge/constants.mjs",
    "forge/forge-runtime.mjs",
    "forge/generator.mjs",
    "forge/loadout.mjs",
    "forge/presets.mjs",
    "forge/random.mjs",
    "forge/statblock-random.mjs",
    "forge/storage.mjs",
    "forge/customization.mjs",
    "forge/stat-profiles.mjs",
    "runtime/cyberware-schema.mjs",
    "runtime/humanity.mjs",
    "runtime/pkt-catalog.mjs",
    "sheets/CyberwareTab.js",
    "templates/cyberpunk-forge.hbs",
    "templates/cyberware-tab.hbs",
  ];
  for (const [file, text] of walkText(files)) {
    assert.doesNotMatch(text, /cyberpunk-equipment-library/u, file);
  }
  assert.equal(existsSync(path.join(root, "styles/cyberware-remaster-mirror.css")), false);
});
