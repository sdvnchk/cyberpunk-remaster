import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.20 clamps archive context menus to the real viewport", async () => {
  const { contextMenuViewportPlacement } = await import("../runtime/archive-ui-utils.mjs");
  assert.deepEqual(
    contextMenuViewportPlacement({ x: 980, y: 740, width: 360, height: 520, viewportWidth: 1000, viewportHeight: 760, margin: 8 }),
    { left: 632, top: 232, maxWidth: 984, maxHeight: 744 },
  );
  assert.deepEqual(
    contextMenuViewportPlacement({ x: -50, y: -20, width: 300, height: 200, viewportWidth: 1000, viewportHeight: 760, margin: 8 }),
    { left: 8, top: 8, maxWidth: 984, maxHeight: 744 },
  );
});

test("2.8.20 Cyber and Neo context menus use a body-level overlay host", () => {
  for (const file of ["runtime/cyber-archive-controller.mjs", "runtime/neo-archive-controller.mjs"]) {
    const source = read(file);
    assert.match(source, /data-archive-context-overlay/u, `${file} must create the shared viewport overlay`);
    assert.match(source, /document\.body\.append/u, `${file} must mount the overlay outside the archive window`);
    assert.doesNotMatch(source, /state\.root\?\.insertAdjacentHTML\?\.\("beforeend", html\)/u, `${file} must not mount context menus inside the transformed archive root`);
  }
});

test("2.8.20 overlay context menus inherit archive theme variables and scroll inside viewport", () => {
  const css = read("styles/neuro-archive.css");
  assert.match(css, /\.archive-context-overlay-host/u);
  assert.match(css, /max-height:\s*calc\(100(?:dvh|vh)\s*-\s*16px\)/u);
  assert.match(css, /overflow:\s*auto/u);
});

test("2.8.20 changelog entry remains documented", () => {
  const changelog = read("CHANGELOG.md");
  assert.match(changelog, /^## 2\.8\.20\b/mu);
});
