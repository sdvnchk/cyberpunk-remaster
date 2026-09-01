import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const registered = new Map();
const moduleRecord = {};
const createdButtons = [];

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
  system: { id: "sf2e" },
  modules: new Map([["cyberpunk-remaster", moduleRecord]]),
};
globalThis.document = {
  createElement(tagName) {
    const listeners = new Map();
    const element = {
      tagName,
      dataset: {},
      addEventListener(name, callback) {
        listeners.set(name, callback);
      },
      listeners,
    };
    createdButtons.push(element);
    return element;
  },
};

await import("../runtime/neuro-archive-runtime.mjs?runtime-test");

test("manifest loads the modular Neuro Archive application", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../module.json", import.meta.url)),
  );
  assert.ok(manifest.esmodules.includes("runtime/neuro-archive-runtime.mjs"));
  assert.ok(
    manifest.styles.some((entry) => entry.src === "styles/neuro-archive.css"),
  );
  assert.match(
    readFileSync(
      new URL("../templates/neuro-archive.hbs", import.meta.url),
      "utf8",
    ),
    /id="pcm-root"/u,
  );
  assert.ok(
    manifest.styles.some(
      (entry) => entry.src === "styles/cyberpunk-windows.css",
    ),
  );
});

test("Neuro Archive registers a public module API", () => {
  const init = registered.get("init")?.at(-1);
  assert.equal(typeof init, "function");
  init();
  assert.equal(typeof moduleRecord.api.neuroArchive.open, "function");
  assert.equal(moduleRecord.api.neuroArchive.version, "4.1.0");
  assert.equal(typeof globalThis.CyberpunkRemaster.forge, "function");
  assert.equal(typeof globalThis.CyberpunkRemaster.archive, "function");
});

test("Neuro Archive opens as a movable and resizable ApplicationV2 window", async () => {
  class ApplicationV2 {
    constructor(options = {}) {
      this.position = options.position ?? {};
      this.rendered = false;
      this.broughtToFront = false;
    }

    async render() {
      this.rendered = true;
      return this;
    }

    bringToFront() {
      this.broughtToFront = true;
    }
  }

  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin: (Base) => Base,
      },
    },
  };
  globalThis.innerWidth = 1600;
  globalThis.innerHeight = 1000;

  const first = await moduleRecord.api.neuroArchive.open();
  assert.equal(first.rendered, true);
  assert.equal(first.constructor.DEFAULT_OPTIONS.window.resizable, true);
  assert.equal(first.constructor.DEFAULT_OPTIONS.window.minimizable, true);

  const second = await moduleRecord.api.neuroArchive.open();
  assert.equal(second, first);
  assert.equal(first.broughtToFront, true);
});

test("shared launchers get a full row after the native directory actions", async () => {
  const { ensureDirectoryLauncherGroup } =
    await import("../runtime/directory-launchers.mjs");
  let insertedGroup = null;
  const nativeActions = {
    after(element) {
      insertedGroup = element;
    },
    append() {
      throw new Error("Launchers must not shrink inside native actions.");
    },
  };
  const root = {
    querySelector(selector) {
      if (selector === "[data-cyberpunk-directory-tools]") return null;
      if (selector === ".header-actions") return nativeActions;
      return null;
    },
  };

  const group = ensureDirectoryLauncherGroup({ element: [root] });

  assert.equal(group, insertedGroup);
  assert.equal(group.dataset.cyberpunkDirectoryTools, "true");
  assert.doesNotMatch(group.className, /\bcyberpunk-directory-tools\b/u);
  assert.match(group.className, /\bheader-actions\b/u);
  assert.match(group.className, /\baction-buttons\b/u);
});

test("Neuro Archive launcher joins the unstyled native directory row", () => {
  const placed = [];
  const group = {
    append(element) {
      placed.push(element);
    },
  };
  const root = {
    querySelector(selector) {
      if (selector === "[data-cyberpunk-neuro-archive-launcher]") return null;
      if (selector === "[data-cyberpunk-directory-tools]") return group;
      return null;
    },
  };

  const renderDirectory = registered.get("renderActorDirectory")?.at(-1);
  assert.equal(typeof renderDirectory, "function");
  renderDirectory({ element: [root] });

  const archiveButton = placed.at(-1);
  assert.equal(archiveButton, createdButtons.at(-1));
  assert.equal(archiveButton.dataset.cyberpunkNeuroArchiveLauncher, "true");
  assert.match(archiveButton.innerHTML, /Нейро-Архив/u);

  const sharedStyles = readFileSync(
    new URL("../styles/cyberpunk-windows.css", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(sharedStyles, /cyberpunk-directory-tools/u);
  assert.doesNotMatch(
    sharedStyles,
    /cyberpunk-(?:forge|neuro-archive)-launcher/u,
  );
});

test("module keeps legacy archive data compatibility and a tiny launcher macro", () => {
  const controller = readFileSync(
    new URL("../runtime/neuro-archive-controller.mjs", import.meta.url),
    "utf8",
  );
  assert.match(controller, /flags\.personalChronicleMacro\?\.data/u);
  assert.match(controller, /personal-chronicle-macro:/u);

  const macros = JSON.parse(
    readFileSync(
      new URL("../content/exports/macros.json", import.meta.url),
      "utf8",
    ),
  );
  const launcherMacro = macros.find((macro) => macro.name === "НЕЙРО-АРХИВ");
  assert.ok(launcherMacro);
  assert.equal(launcherMacro.command, "CyberpunkRemaster.archive();");
  assert.ok(launcherMacro.command.length < 100);
});

test("Neuro Archive theme controls show all four palette colors", () => {
  const controller = readFileSync(
    new URL("../runtime/neuro-archive-controller.mjs", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(
    new URL("../styles/neuro-archive.css", import.meta.url),
    "utf8",
  );

  assert.match(controller, /class="pcm-theme-palette"/u);
  assert.match(controller, /--swatch-bg:/u);
  assert.match(controller, /--swatch-panel:/u);
  assert.match(controller, /--swatch-accent:/u);
  assert.match(controller, /--swatch-secondary:/u);
  assert.match(styles, /\.pcm-theme-palette i:nth-child\(4\)/u);
});

test("modular controller opens a legacy macro archive without migration", () => {
  const { NODE_V8_COVERAGE: _coverage, ...environment } = process.env;
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          "./fixtures/neuro-archive-controller-smoke.mjs",
          import.meta.url,
        ),
      ),
    ],
    {
      env: environment,
      stdio: "pipe",
    },
  );
});
