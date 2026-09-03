import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const service = read("runtime/archive-share-service.mjs");
const runtime = read("runtime/neuro-archive-runtime.mjs");
const neuro = read("runtime/neuro-archive-controller.mjs");
const cyber = read("runtime/cyber-archive-controller.mjs");
const neo = read("runtime/neo-archive-controller.mjs");
const template = read("templates/neuro-archive.hbs");
const css = read("styles/neuro-archive.css");

test("2.8.22 share selector is Actor-targeted and player Actor groups start collapsed", () => {
  assert.match(service, /data-archive-share-user-toggle/u);
  assert.match(service, /aria-expanded="false"/u);
  assert.match(service, /data-archive-share-actor/u);
  assert.match(service, /targetActorId/u);
  assert.match(service, /ОСНОВНОЙ ПЕРСОНАЖ/u);
  assert.match(service, /disabled[^>]*>[^<]*ОТПРАВИТЬ|data-archive-share-send/u);
});

test("2.8.22 pending shares live outside canonical archive data and require accept or decline", () => {
  assert.match(service, /neuroArchive\.shareInbox/u);
  assert.match(service, /Принять/u);
  assert.match(service, /Отклонить/u);
  assert.match(service, /Обновить существующее/u);
  assert.match(service, /Создать копию/u);
  assert.match(service, /Отмена/u);
});

test("2.8.22 share UI uses body overlay and stable fixed icon/text grid", () => {
  assert.match(service, /document\.body\.append/u);
  assert.match(css, /\.archive-share-overlay/u);
  assert.match(css, /grid-template-columns:\s*40px\s+minmax\(0,\s*1fr\)/u);
  assert.match(css, /min-width:\s*0/u);
  assert.match(css, /\.archive-share-actors\[hidden\]/u);
});

test("2.8.22 all three archive context menus expose the same share action", () => {
  for (const source of [neuro, cyber, neo]) {
    assert.match(source, /Поделиться/u);
    assert.match(source, /openArchiveShareDialog/u);
    assert.match(source, /getShareSnapshot/u);
  }
});

test("2.8.22 exposes common section/archive sharing and incoming packets", () => {
  assert.match(runtime, /data-archive-share-open/u);
  assert.match(runtime, /data-archive-share-inbox/u);
  assert.match(runtime, /Входящие/u);
  assert.match(runtime, /openArchiveShareScopePicker/u);
  assert.match(runtime, /openArchiveShareInbox/u);
  assert.match(runtime, /initializeArchiveSharing/u);
  assert.match(runtime, /archiveController\?\.flush/u);
});

test("2.8.22 changelog entry remains present after later releases", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const changelog = read("CHANGELOG.md");
  assert.equal(manifest.version, pkg.version);
  assert.ok(Number(manifest.version.split(".").at(-1)) >= 22);
  assert.match(changelog, /^## 2\.8\.22\b/mu);
});
