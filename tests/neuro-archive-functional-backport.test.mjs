import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controller = readFileSync(
  new URL("../runtime/neuro-archive-controller.mjs", import.meta.url),
  "utf8",
);
const runtime = readFileSync(
  new URL("../runtime/neuro-archive-runtime.mjs", import.meta.url),
  "utf8",
);
const constants = readFileSync(
  new URL("../runtime/neuro-archive-constants.mjs", import.meta.url),
  "utf8",
);

test("Neuro Archive functional backport keeps its own storage namespace", () => {
  assert.match(constants, /NEURO_ARCHIVE_VERSION = "4\.3\.0"/u);
  assert.match(controller, /flags\.cyberpunkRemaster\?\.neuroArchive\?\.data/u);
  assert.match(controller, /cyberpunk-remaster:neuro-archive:/u);
  assert.doesNotMatch(runtime, /__PERSONAL_CHRONICLE_MACRO__/u);
});

test("scene capture never stores the raw scene background", () => {
  assert.match(controller, /captureVisibleSceneFromToken/u);
  assert.match(controller, /sceneCaptureToken/u);
  assert.match(controller, /sceneCaptureMode = "token-vision"/u);
  assert.doesNotMatch(
    controller,
    /entry\.image\s*=\s*scene\.background\?\.src\s*\|\|\s*scene\.img/u,
  );
});

test("contacts support scoped search, role/tag filters and sorting", () => {
  assert.match(controller, /contactQuery/u);
  assert.match(controller, /contactRoleFilter/u);
  assert.match(controller, /contactTagFilter/u);
  assert.match(controller, /contactSort/u);
  assert.match(controller, /data-contact-search/u);
  assert.match(controller, /data-contact-role-filter/u);
  assert.match(controller, /data-contact-tag-filter/u);
  assert.match(controller, /data-contact-sort/u);
});

test("contact dossier has inline quick editing that covers legacy editor fields", () => {
  assert.match(controller, /quickEditPersonId/u);
  assert.match(controller, /data-quick-person-field/u);
  for (const field of [
    "title",
    "summary",
    "content",
    "image",
    "tags",
    "role",
    "ancestry",
    "status",
    "attitude",
    "relationship",
    "firstMet",
    "quotes",
    "promises",
    "secrets",
  ]) {
    assert.match(controller, new RegExp(`data-quick-person-field="${field}"`, "u"));
  }
  assert.match(controller, /pcm-quick-person-locations/u);
  assert.match(controller, /pcm-quick-person-gallery/u);
  assert.match(controller, /pcm-quick-person-fragments/u);
});

test("every archive entry gets a persistent context menu without prompt dialogs", () => {
  assert.match(controller, /contextMenu/u);
  assert.match(controller, /contextmenu/u);
  assert.match(controller, /data-context-action/u);
  assert.match(controller, /context-add-tag/u);
  assert.match(controller, /context-remove-tag/u);
  assert.match(controller, /context-delete/u);
  assert.match(controller, /context-pin/u);
  assert.match(controller, /context-edit/u);
  assert.doesNotMatch(controller, /window\.prompt\(/u);
  assert.doesNotMatch(controller, /prompt\(/u);
});

test("contact context menu supports quick attitude/status changes and stays open", () => {
  assert.match(controller, /context-person-attitude/u);
  assert.match(controller, /context-person-status/u);
  assert.match(controller, /refreshContextMenu/u);
  assert.match(controller, /closeContextMenu/u);
  assert.match(controller, /pointerdown/u);
});

test("context-menu tag editor is inline and supports removing individual tags", () => {
  assert.match(controller, /contextTagEditorOpen/u);
  assert.match(controller, /data-context-tag-input/u);
  assert.match(controller, /data-context-tag-remove/u);
  assert.match(controller, /data-context-action="context-add-tag-confirm"/u);
});
