import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.10 cyberware keeps numeric capacity counters but removes fill bars", () => {
  const template = read("templates/cyberware-tab.hbs");
  const css = read("styles/cyberware.css");

  assert.doesNotMatch(template, /cw-capacity-bar/u);
  assert.doesNotMatch(css, /\.cw-capacity-bar\b/u);
  assert.match(template, /internalCapacity\.used[\s\S]*internalCapacity\.limit/u);
  assert.match(template, /externalCapacity\.used[\s\S]*externalCapacity\.limit/u);
  assert.match(template, /fashionCapacity\.used[\s\S]*fashionCapacity\.limit/u);
});

test("2.8.10 capacity cleanup does not require a module-owned Font Awesome family", () => {
  const css = read("styles/cyberpunk-windows.css");
  assert.doesNotMatch(css, /Font Awesome 6 Free/u);
  assert.doesNotMatch(css, /--fa-style-family/u);
});

test("2.8.10 metadata and changelog are synchronized", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const readme = read("README.md");
  const changelog = read("CHANGELOG.md");

  assert.equal(manifest.version, pkg.version);
  assert.ok(readme.includes(`Версия: **${manifest.version}**`));
  assert.match(changelog, /^## 2\.8\.10\b/mu);
  assert.match(changelog, /икон|Font Awesome/iu);
  assert.match(changelog, /шкал|полос.*загруз|индикатор.*заполн/iu);
});
