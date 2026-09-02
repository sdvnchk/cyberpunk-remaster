import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.5 visual fixes and changelog remain preserved", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  assert.equal(manifest.version, pkg.version);
  assert.match(read("CHANGELOG.md"), /## 2\.8\.5\b/u);
});

test("Neuro-Archive contact cards override the generic root button geometry", () => {
  const css = read("styles/neuro-archive.css");
  assert.match(css, /#pcm-root \.pcm-record-open\s*\{[^}]*min-height:\s*76px;[^}]*display:\s*grid;/su);
  assert.match(css, /#pcm-root \.pcm-record-open\s*\{[^}]*padding:\s*9px 12px;/su);
  assert.match(css, /#pcm-root \.pcm-tag-static\s*\{/u);
  assert.match(css, /#pcm-root \.pcm-contact-toolbar\s*\{/u);
});

test("Forge restores the classic red-gold Cyberpunk Remaster visual theme", () => {
  const css = read("styles/cyberpunk-forge.css");
  assert.match(css, /v2\.8\.5 — classic Cyberpunk Remaster forge theme/u);
  const marker = css.lastIndexOf("v2.8.5 — classic Cyberpunk Remaster forge theme");
  const finalTheme = css.slice(marker);
  assert.match(finalTheme, /--forge-red:\s*#b01822/u);
  assert.match(finalTheme, /--forge-red-bright:\s*#df2532/u);
  assert.match(finalTheme, /--forge-gold:\s*#e9ba63/u);
  assert.match(finalTheme, /rgba\(176,\s*24,\s*34,/u);
  assert.match(finalTheme, /rgba\(233,\s*186,\s*99,/u);
});
