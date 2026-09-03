import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const service = read("runtime/archive-share-service.mjs");
const css = read("styles/neuro-archive.css");

test("2.8.31 target selector uses a non-shrinking vertical scroll list", () => {
  assert.match(css, /\.archive-share-target-window \.archive-share-users\s*\{[^}]*display:\s*flex/isu);
  assert.match(css, /\.archive-share-target-window \.archive-share-users\s*\{[^}]*flex-direction:\s*column/isu);
  assert.match(css, /\.archive-share-target-window \.archive-share-users\s*\{[^}]*overflow-y:\s*auto/isu);
  assert.match(css, /\.archive-share-user\s*\{[^}]*flex:\s*0\s+0\s+auto/isu);
  assert.match(css, /\.archive-share-user-row\s*\{[^}]*min-height:\s*unset[^}]*height:\s*auto/isu);
});

test("2.8.31 actor rows grow with text and never collapse", () => {
  assert.match(css, /\.archive-share-target-window \.archive-share-actor\s*\{[^}]*min-height:\s*unset/isu);
  assert.match(css, /\.archive-share-target-window \.archive-share-actor\s*\{[^}]*height:\s*auto/isu);
  assert.match(css, /\.archive-share-target-window \.archive-share-actor\s*\{[^}]*flex:\s*0\s+0\s+auto/isu);
  assert.match(css, /\.archive-share-user-copy b,[\s\S]*\.archive-share-actor-copy b[\s\S]*white-space:\s*normal/isu);
});

test("2.8.31 only one user group stays expanded and it scrolls into view", () => {
  assert.match(service, /querySelectorAll\?\.\("\[data-archive-share-user\]"\)/u);
  assert.match(service, /otherToggle\?\.setAttribute\?\.\("aria-expanded",\s*"false"\)/u);
  assert.match(service, /otherActors\.hidden\s*=\s*true/u);
  assert.match(service, /group\?\.scrollIntoView\?\.\(\{\s*block:\s*"nearest"/u);
});

test("2.8.31 selecting an Actor updates recipient label and enables send", () => {
  assert.match(service, /data-archive-share-target-label/u);
  assert.match(service, /Получатель:/u);
  assert.match(service, /send\.disabled\s*=\s*!\(targetUserId\s*&&\s*targetActorId\)/u);
  assert.match(service, /actorButton\.scrollIntoView\?\.\(\{\s*block:\s*"nearest"/u);
});

test("2.8.31 footer remains fixed while only the middle list scrolls", () => {
  assert.match(css, /\.archive-share-target-window\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/isu);
  assert.match(css, /\.archive-share-footer\s*\{[^}]*flex:\s*0\s+0\s+auto/isu);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*\.archive-share-footer\s*\{[^}]*grid-template-columns:\s*1fr/isu);
});

test("2.8.31 metadata and changelog are synchronized", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const changelog = read("CHANGELOG.md");
  assert.equal(manifest.version, "2.8.31");
  assert.equal(pkg.version, "2.8.31");
  assert.match(changelog, /^## 2\.8\.31\b/mu);
});
