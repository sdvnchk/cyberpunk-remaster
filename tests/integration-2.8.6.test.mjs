import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("2.8.6 contact gig action and editable note field remain preserved", () => {
  const controller = read("runtime/neuro-archive-controller.mjs");
  assert.match(controller, /data-action="add-person-gig"/u);
  assert.match(controller, /action === "add-person-gig"/u);
  assert.match(controller, /giverId:\s*entry\.id/u);
  assert.match(controller, /data-quick-person-field="content"/u);
});

test("2.8.6 changelog entry remains preserved", () => {
  assert.match(read("CHANGELOG.md"), /## 2\.8\.6\b/u);
});
