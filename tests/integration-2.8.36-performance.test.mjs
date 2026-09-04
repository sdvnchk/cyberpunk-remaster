import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "runtime", "implant-creator.mjs"), "utf8");

test("2.8.36 actor activation observer ignores mutations produced by its own control", () => {
  assert.match(
    source,
    /new MutationObserver\(\(mutations\) => \{[\s\S]*?mutation\.target\?\.closest\?\.\("\[data-cic-actor-activate\]"\)[\s\S]*?if \(!hasRelevantMutation\) return;/u,
  );
});

test("2.8.36 activation observer remains frame-coalesced for real actor-sheet mutations", () => {
  assert.match(source, /if \(scheduled\) return;[\s\S]*?scheduled = true;[\s\S]*?requestAnimationFrame\(\(\) => \{/u);
});
