import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const implantPath = path.join(root, "runtime", "implant-creator.mjs");

function installGlobals() {
  const hooks = new Map();
  globalThis.Hooks = {
    once(name, fn) { const list = hooks.get(name) ?? []; list.push(fn); hooks.set(name, list); },
    on(name, fn) { const list = hooks.get(name) ?? []; list.push(fn); hooks.set(name, list); },
    callAll() {},
  };
  globalThis.game = {
    user: { id: "GM", isGM: true },
    modules: new Map([["cyberpunk-remaster", { active: true, api: {} }]]),
    settings: { register() {}, get() { return undefined; }, async set() {} },
    actors: [],
    combat: { id: "COMBAT-1", round: 2 },
    time: { worldTime: 120 },
  };
  globalThis.CONFIG = { SF2E: {} };
  globalThis.foundry = { utils: { deepClone: (value) => structuredClone(value) } };
  globalThis.document = { querySelector() { return null; }, querySelectorAll() { return []; } };
}

test("2.8.34 encounter activation does not emit invalid native SF2e frequency", async () => {
  installGlobals();
  const implant = await import(`${pathToFileURL(implantPath).href}?v2834-frequency`);
  assert.equal(typeof implant.activationNativeFrequency, "function");
  assert.equal(implant.activationNativeFrequency({ frequency: "encounter", frequencyMax: 2 }), null);
});

test("2.8.34 encounter activation keeps the module encounter-period tracker", async () => {
  installGlobals();
  const implant = await import(`${pathToFileURL(implantPath).href}?v2834-period`);
  assert.equal(typeof implant.activationPeriodKey, "function");
  assert.equal(implant.activationPeriodKey({ frequency: "encounter" }), "encounter:COMBAT-1");
});

test("2.8.34 supported native frequencies remain unchanged", async () => {
  installGlobals();
  const implant = await import(`${pathToFileURL(implantPath).href}?v2834-supported`);
  assert.deepEqual(implant.activationNativeFrequency({ frequency: "round", frequencyMax: 3 }), { value: 3, max: 3, per: "round" });
  assert.deepEqual(implant.activationNativeFrequency({ frequency: "minute", frequencyMax: 1 }), { value: 1, max: 1, per: "PT1M" });
  assert.deepEqual(implant.activationNativeFrequency({ frequency: "hour", frequencyMax: 2 }), { value: 2, max: 2, per: "PT1H" });
  assert.deepEqual(implant.activationNativeFrequency({ frequency: "day", frequencyMax: 4 }), { value: 4, max: 4, per: "day" });
});

test("2.8.34 repair removes legacy invalid encounter frequency from managed Actions", async () => {
  installGlobals();
  const implant = await import(`${pathToFileURL(implantPath).href}?v2834-repair`);
  const update = implant.activationSchemaRepairUpdate({
    id: "ACTION-1",
    type: "action",
    flags: { "cyberpunk-implant-creator": { activationAction: true } },
    system: {
      rules: [],
      traits: { value: [], otherTags: [] },
      frequency: { value: 1, max: 1, per: "encounter" },
    },
  });
  assert.deepEqual(update, { _id: "ACTION-1", "system.frequency": null });
});
