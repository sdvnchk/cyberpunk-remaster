import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "module.json"), "utf8"));
const runtimePath = path.join(root, "runtime", "implant-creator.mjs");
const stylePath = path.join(root, "styles", "implant-creator.css");

test("2.8.7 manifest integrates Implant Creator runtime and style", () => {
  assert.ok(manifest.esmodules.includes("runtime/implant-creator.mjs"));
  assert.ok(manifest.styles.some((entry) => entry.src === "styles/implant-creator.css"));
  assert.equal(existsSync(runtimePath), true);
  assert.equal(existsSync(stylePath), true);
});

test("integrated creator is Remaster-owned but preserves the legacy creator flag scope", () => {
  const source = existsSync(runtimePath) ? readFileSync(runtimePath, "utf8") : "";
  assert.match(source, /const PACKAGE_ID = "cyberpunk-remaster"/u);
  assert.match(source, /const MODULE_ID = "cyberpunk-implant-creator"/u);
  assert.match(source, /const MODULE_VERSION = "1\.13\.29"/u);
  assert.match(source, /game\.settings\.register\(PACKAGE_ID,"implantCreatorShowDirectoryButton"/u);
  assert.match(source, /game\.modules\.get\(PACKAGE_ID\)/u);
  assert.match(source, /implantCreator:/u);
  assert.match(source, /\[MODULE_ID\]: creatorFlag/u);
});

test("integrated creator merges its API without replacing Forge or Neuro Archive", async () => {
  assert.equal(existsSync(runtimePath), true);

  const hooks = new Map();
  globalThis.Hooks = {
    once(name, callback) {
      const list = hooks.get(name) ?? [];
      list.push(callback);
      hooks.set(name, list);
    },
    on(name, callback) {
      const list = hooks.get(name) ?? [];
      list.push(callback);
      hooks.set(name, list);
    },
    callAll() {},
  };
  const registeredSettings = [];
  const moduleRecord = {
    active: true,
    api: { forge: { open() {} }, neuroArchive: { open() {} } },
  };
  globalThis.game = {
    modules: new Map([["cyberpunk-remaster", moduleRecord]]),
    settings: {
      register(scope, key) {
        registeredSettings.push([scope, key]);
      },
      get() {
        return undefined;
      },
      async set() {},
    },
  };
  globalThis.CONFIG = { SF2E: {} };
  globalThis.foundry = { utils: { deepClone: (value) => structuredClone(value) } };
  globalThis.document = { querySelector() { return null; }, querySelectorAll() { return []; } };

  await import(`${pathToFileURL(runtimePath).href}?creator-smoke-287`);
  const init = hooks.get("init")?.at(-1);
  assert.equal(typeof init, "function");
  init();

  assert.equal(typeof moduleRecord.api.forge.open, "function");
  assert.equal(typeof moduleRecord.api.neuroArchive.open, "function");
  assert.equal(typeof moduleRecord.api.implantCreator.open, "function");
  assert.ok(
    registeredSettings.some(
      ([scope, key]) =>
        scope === "cyberpunk-remaster" &&
        key === "implantCreatorShowDirectoryButton",
    ),
  );
});

test("no nested standalone creator module manifest is shipped", () => {
  assert.equal(existsSync(path.join(root, "cyberpunk-implant-creator", "module.json")), false);
});

test("2.8.7 Implant Creator uses the shared Remaster visual language", () => {
  const style = existsSync(stylePath) ? readFileSync(stylePath, "utf8") : "";
  const common = readFileSync(path.join(root, "styles", "cyberpunk-windows.css"), "utf8");
  assert.match(style, /\.cic-window\s*\{[\s\S]*--cyber-accent:\s*#df2532/u);
  assert.match(style, /--cyber-secondary:\s*#46d9dc/u);
  assert.match(style, /font-family:\s*Consolas,\s*"Roboto Mono",\s*"Courier New",\s*monospace/u);
  assert.match(style, /background-size:\s*30px 30px/u);
  assert.match(style, /\.cic-primary[\s\S]*clip-path:\s*polygon/u);
  assert.match(common, /\.cic-window/u);
  assert.doesNotMatch(style, /(^|\n)button\s*\{/u);
});

test("integrated creator manual no longer instructs enabling a second module", () => {
  const source = readFileSync(runtimePath, "utf8");
  assert.doesNotMatch(source, /Активируйте Cyberpunk Implant Creator и Cyberpunk Remaster/u);
  assert.match(source, /Активируйте Cyberpunk Remaster/u);
});
