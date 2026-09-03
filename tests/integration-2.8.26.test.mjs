import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const runtime = read("runtime/neuro-archive-runtime.mjs");
const changelog = read("CHANGELOG.md");
const moduleJson = JSON.parse(read("module.json"));
const packageJson = JSON.parse(read("package.json"));

test("2.8.26 keeps the share runtime methods required by mode-local toolbar controls", () => {
  assert.match(runtime, /\n\s*_shareSnapshot\(\)\s*\{/u);
  assert.match(runtime, /\n\s*_shareActor\(snapshot\s*=\s*this\._shareSnapshot\(\)\)\s*\{/u);
  assert.match(runtime, /\n\s*_updateShareInboxBadge\(\)\s*\{/u);
  assert.match(runtime, /this\._updateShareInboxBadge\(\);/u);
  assert.match(runtime, /const snapshot = this\._shareSnapshot\(\);/u);
});


test("2.8.26 metadata and changelog are synchronized", () => {
  assert.ok(Number(moduleJson.version.split(".").at(-1)) >= 26);
  assert.equal(packageJson.version, moduleJson.version);
  assert.match(changelog, /## 2\.8\.26/u);
  assert.match(changelog, /_shareSnapshot/u);
  assert.match(changelog, /_updateShareInboxBadge/u);
});
