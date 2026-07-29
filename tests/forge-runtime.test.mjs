import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registered = new Map();
const settings = new Map();
const settingValues = new Map();
const moduleRecord = {};

globalThis.Hooks = {
  on(name, callback) {
    const callbacks = registered.get(name) ?? [];
    callbacks.push(callback);
    registered.set(name, callbacks);
  },
  once(name, callback) {
    this.on(name, callback);
  },
};
globalThis.game = {
  modules: new Map([["cyberpunk-remaster", moduleRecord]]),
  settings: {
    register(namespace, key, definition) {
      settings.set(`${namespace}.${key}`, definition);
    },
    get(namespace, key) {
      const setting = `${namespace}.${key}`;
      return settingValues.has(setting)
        ? structuredClone(settingValues.get(setting))
        : structuredClone(settings.get(setting)?.default);
    },
    async set(namespace, key, value) {
      const setting = `${namespace}.${key}`;
      settingValues.set(setting, structuredClone(value));
      return value;
    },
  },
};

await import("../forge/forge-runtime.mjs?runtime-test");

test("manifest loads the Forge runtime and stylesheet", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../module.json", import.meta.url)),
  );
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url)),
  );
  assert.equal(manifest.version, packageJson.version);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/u);
  assert.ok(manifest.esmodules.includes("forge/forge-runtime.mjs"));
  assert.ok(
    manifest.styles.some((entry) => entry.src === "styles/cyberpunk-forge.css"),
  );
});

test("author deploy ships the Forge code and its adapted-source license", () => {
  const deploy = readFileSync(
    new URL("../scripts/deploy-to-foundry.mjs", import.meta.url),
    "utf8",
  );
  assert.match(deploy, /"forge"/u);
  assert.match(deploy, /"licenses"/u);
});

test("Forge registers private storage and a public module API", () => {
  const init = registered.get("init")?.at(-1);
  assert.equal(typeof init, "function");
  init();

  for (const key of [
    "forgeCustomPresets",
    "forgeLastForm",
    "forgeRecentHistory",
  ]) {
    const definition = settings.get(`cyberpunk-remaster.${key}`);
    assert.ok(definition, key);
    assert.equal(definition.config, false);
  }
  assert.equal(typeof moduleRecord.api.forge.open, "function");
  assert.equal(typeof moduleRecord.api.forge.preview, "function");
  assert.equal(typeof moduleRecord.api.forge.generate, "function");
  assert.equal(typeof moduleRecord.api.forge.generateBatch, "function");
  assert.equal(typeof moduleRecord.api.forge.refreshInterfaces, "function");
  assert.equal(typeof moduleRecord.api.forge.refreshCatalog, "function");
});

test("saved forms and custom presets do not freeze a random seed", async () => {
  const { DEFAULT_FORM } = await import("../forge/constants.mjs");
  const { resolvePreset } = await import("../forge/presets.mjs");
  const {
    getCustomPresets,
    getLastForm,
    importCustomPresets,
    saveCustomPreset,
    setLastForm,
  } = await import("../forge/storage.mjs");

  assert.equal(getLastForm().preset, DEFAULT_FORM.preset);
  assert.equal(
    getLastForm().includePrograms,
    resolvePreset(DEFAULT_FORM.preset).includePrograms,
  );

  await setLastForm({
    preset: "netrunner",
    randomSeed: "one-eternal-netrunner",
  });
  assert.equal(getLastForm().preset, "netrunner");
  assert.equal(getLastForm().randomSeed, "");

  const presetId = await saveCustomPreset("Случайный нетраннер", {
    preset: "netrunner",
    randomSeed: "one-eternal-netrunner",
  });
  assert.equal(getCustomPresets()[presetId].values.randomSeed, "");

  await importCustomPresets({
    entries: {
      frozen: {
        name: "Импортированный нетраннер",
        values: {
          preset: "netrunner",
          randomSeed: "imported-eternal-netrunner",
        },
      },
    },
  });
  const imported = Object.values(getCustomPresets()).find(
    (entry) => entry.name === "Импортированный нетраннер",
  );
  assert.equal(imported.values.randomSeed, "");
});
