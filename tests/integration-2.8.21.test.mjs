import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimePath = path.join(root, "runtime", "implant-creator.mjs");
const runtime = readFileSync(runtimePath, "utf8");

function installImportGlobals() {
  const hooks = new Map();
  globalThis.Hooks = {
    once(name, fn) { const list = hooks.get(name) ?? []; list.push(fn); hooks.set(name, list); },
    on(name, fn) { const list = hooks.get(name) ?? []; list.push(fn); hooks.set(name, list); },
    callAll() {},
  };
  globalThis.game = {
    user: { isGM: true },
    modules: new Map([["cyberpunk-remaster", { active: true, api: { forge: {}, neuroArchive: {} } }]]),
    settings: { register() {}, get() { return undefined; }, async set() {} },
    actors: [],
  };
  globalThis.CONFIG = { SF2E: {} };
  globalThis.foundry = { utils: { deepClone: (value) => structuredClone(value) } };
  globalThis.document = { querySelector() { return null; }, querySelectorAll() { return []; } };
  return hooks;
}

test("embedded CIC 1.13.33 preserves the 2.8.21 activation source resolver", async () => {
  installImportGlobals();
  const module = await import(`${pathToFileURL(runtimePath).href}?cic-11333-resolver`);
  assert.match(runtime, /const MODULE_VERSION = "1\.13\.33"/u);
  assert.equal(typeof module.resolveActivationSourceReferences, "function");

  const item = { id: "WEAPON_ID", uuid: "Actor.A.Item.WEAPON_ID" };
  const source = {
    selector: "WEAPON_ID-damage:{item|parentItem.id}:{item|id}:{item|_id}:{sourceItem|id}",
    nested: ["{sourceItem|uuid}", { uuid: "{item|parentItem.uuid}" }],
  };
  const resolved = module.resolveActivationSourceReferences(source, item);
  assert.equal(resolved.selector, "WEAPON_ID-damage:WEAPON_ID:WEAPON_ID:WEAPON_ID:WEAPON_ID");
  assert.equal(resolved.nested[0], "Actor.A.Item.WEAPON_ID");
  assert.equal(resolved.nested[1].uuid, "Actor.A.Item.WEAPON_ID");
  assert.match(runtime, /const rules = resolveActivationSourceReferences\([\s\S]*?config\.effectRules/u);
});

test("2.8.21 exposes targeted activation artifact repair without render/update effect rebuild loops", async () => {
  const hooks = installImportGlobals();
  const remaster = game.modules.get("cyberpunk-remaster");
  await import(`${pathToFileURL(runtimePath).href}?cic-11333-api`);
  hooks.get("init")?.at(-1)?.();

  assert.equal(typeof remaster.api.implantCreator.repairActivationArtifacts, "function");
  assert.match(runtime, /async function repairLegacyActivationEffectsForActor/u);
  assert.match(runtime, /void repairActivationArtifacts\(\)\.catch/u);
  assert.doesNotMatch(runtime, /renderActorSheet[\s\S]{0,1800}syncActiveActivationEffectForImplant\(/u);
  assert.doesNotMatch(runtime, /Hooks\.on\("updateItem"[\s\S]{0,1200}syncActiveActivationEffectForImplant\(/u);
});

test("2.8.21 safely deletes stale activation actions to avoid missing Item race", () => {
  assert.match(runtime, /function isMissingEmbeddedItemError/u);
  assert.match(runtime, /async function safeDeleteActorEmbeddedItem/u);
  assert.match(runtime, /if \(existing\) await safeDeleteActorEmbeddedItem\(existing\)/u);
  assert.match(runtime, /safeDeleteActorEmbeddedItem\(action\).*delete linked action failed/u);
});

test("2.8.21 keeps Remaster-owned settings and merged API", () => {
  assert.match(runtime, /game\.settings\.register\(PACKAGE_ID,"implantCreatorShowDirectoryButton"/u);
  assert.match(runtime, /const module=game\.modules\.get\(PACKAGE_ID\)/u);
  assert.match(runtime, /module\.api=\{\.\.\.\(module\.api \?\? \{\}\), implantCreator\}/u);
});


test("2.8.21 changelog entry remains present after later releases", () => {
  const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  assert.match(changelog, /^## 2\.8\.21\b/mu);
});
