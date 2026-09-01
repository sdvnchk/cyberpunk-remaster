import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.11 never overrides the Font Awesome family owned by Foundry", () => {
  const css = read("styles/cyberpunk-windows.css");
  assert.doesNotMatch(css, /Font Awesome 6 Free/u);
  assert.doesNotMatch(css, /--fa-style-family/u);
  assert.doesNotMatch(css, /\.fa-(?:solid|regular|brands)[^{]*\{[^}]*font-family/isu);
});

test("2.8.11 shared text typography excludes Font Awesome elements", () => {
  const css = read("styles/cyberpunk-windows.css");
  assert.match(css, /:not\(\[class\^="fa-"\]\)/u);
  assert.match(css, /:not\(\[class\*=" fa-"\]\)/u);
  assert.match(css, /:not\(\.fas\)/u);
  assert.match(css, /:not\(\.far\)/u);
  assert.match(css, /:not\(\.fab\)/u);
});

test("2.8.11 Chrome controls do not force inherited text font onto icon buttons", () => {
  const css = read("styles/cyberware.css");
  assert.doesNotMatch(css, /\.cw-tab\s+:is\(button,\s*input,\s*select,\s*textarea\)\s*\{\s*font-family:\s*inherit/isu);
  assert.match(css, /button:not\(\[class\^="fa-"\]\)/u);
});

test("2.8.11 changelog keeps the global icon-font regression documented", () => {
  const changelog = read("CHANGELOG.md");
  assert.match(changelog, /^## 2\.8\.11\b/mu);
  assert.match(changelog, /Font Awesome|икон/iu);
  assert.match(changelog, /Хром|Нейро|Кузниц|Implant/iu);
});
