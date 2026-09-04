import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controllers = [
  "neuro-archive-controller.mjs",
  "cyber-archive-controller.mjs",
  "neo-archive-controller.mjs",
];

test("all archive controllers use the shared image picker helper", () => {
  for (const file of controllers) {
    const source = readFileSync(new URL(`../runtime/${file}`, import.meta.url), "utf8");
    assert.match(source, /archive-file-picker\.mjs/u, `${file} must import the shared picker`);
    assert.match(source, /chooseArchiveImage\s+as\s+chooseImage/u, `${file} must alias the shared picker as chooseImage`);
  }
});

test("world map view has a shared picker fallback", () => {
  const source = readFileSync(new URL("../runtime/world-city-map-view.mjs", import.meta.url), "utf8");
  assert.match(source, /archive-file-picker\.mjs/u);
  assert.match(source, /context\.pickImage[^\n]*chooseArchiveImage|chooseArchiveImage[^\n]*context\.pickImage/u);
});

test("archive image picker prefers Foundry V14 ApplicationV2 implementation", async () => {
  const originalFoundry = globalThis.foundry;
  const originalFilePicker = globalThis.FilePicker;
  const calls = [];
  let selected = "";

  class ModernPicker {
    constructor(options) {
      calls.push(["construct-modern", options.current, options.type]);
      this.options = options;
    }
    async render(options) {
      calls.push(["render-modern", options]);
      this.options.callback("worlds/test/night-city.webp");
      return this;
    }
  }
  class LegacyPicker {
    constructor() {
      calls.push(["construct-legacy"]);
      throw new Error("legacy picker must not be selected on V14");
    }
  }

  try {
    globalThis.foundry = {
      applications: {
        apps: {
          FilePicker: {
            implementation: ModernPicker,
          },
        },
      },
    };
    globalThis.FilePicker = LegacyPicker;
    const url = new URL("../runtime/archive-file-picker.mjs", import.meta.url);
    const { chooseArchiveImage } = await import(`${url.href}?v14=${Date.now()}`);
    await chooseArchiveImage("old.webp", (path) => { selected = path; });

    assert.equal(selected, "worlds/test/night-city.webp");
    assert.deepEqual(calls[0], ["construct-modern", "old.webp", "image"]);
    assert.deepEqual(calls[1], ["render-modern", { force: true }]);
    assert.equal(calls.some(([name]) => name === "construct-legacy"), false);
  } finally {
    if (originalFoundry === undefined) delete globalThis.foundry;
    else globalThis.foundry = originalFoundry;
    if (originalFilePicker === undefined) delete globalThis.FilePicker;
    else globalThis.FilePicker = originalFilePicker;
  }
});

test("archive image picker keeps a legacy fallback for older Foundry", async () => {
  const originalFoundry = globalThis.foundry;
  const originalFilePicker = globalThis.FilePicker;
  const calls = [];

  class LegacyPicker {
    constructor(options) {
      this.options = options;
      calls.push(["construct", options.current]);
    }
    render(force) {
      calls.push(["render", force]);
      this.options.callback({ path: "legacy/map.webp" });
      return this;
    }
  }

  try {
    delete globalThis.foundry;
    globalThis.FilePicker = LegacyPicker;
    const url = new URL("../runtime/archive-file-picker.mjs", import.meta.url);
    const { chooseArchiveImage } = await import(`${url.href}?legacy=${Date.now()}`);
    let selected = "";
    await chooseArchiveImage("", (path) => { selected = path; });
    assert.equal(selected, "legacy/map.webp");
    assert.deepEqual(calls, [["construct", ""], ["render", true]]);
  } finally {
    if (originalFoundry === undefined) delete globalThis.foundry;
    else globalThis.foundry = originalFoundry;
    if (originalFilePicker === undefined) delete globalThis.FilePicker;
    else globalThis.FilePicker = originalFilePicker;
  }
});
