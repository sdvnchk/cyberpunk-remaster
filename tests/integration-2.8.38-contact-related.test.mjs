import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
  "neuro-archive-controller.mjs",
  "cyber-archive-controller.mjs",
  "neo-archive-controller.mjs",
];

for (const file of files) {
  test(`${file} creates contact gigs and clues with persistent relationship fields`, () => {
    const source = readFileSync(new URL(`../runtime/${file}`, import.meta.url), "utf8");
    assert.match(source, /data-action="add-person-gig"/u);
    assert.match(source, /data-action="add-person-clue"/u);
    assert.match(source, /action === "add-person-gig"[\s\S]{0,700}giverId:\s*entry\.id/u);
    assert.match(source, /action === "add-person-clue"[\s\S]{0,700}personId:\s*entry\.id/u);
    assert.match(source, /type === "quests" && options\.giverId[\s\S]{0,120}entry\.giverId\s*=\s*options\.giverId/u);
    assert.match(source, /type === "clues" && options\.personId[\s\S]{0,120}entry\.personId\s*=\s*options\.personId/u);
  });
}

test("contact related cards use a dedicated compact class so descriptions cannot overlap titles", () => {
  for (const file of files) {
    const source = readFileSync(new URL(`../runtime/${file}`, import.meta.url), "utf8");
    assert.match(source, /pcm-person-related-row/u);
  }
  const css = readFileSync(new URL("../styles/neuro-archive.css", import.meta.url), "utf8");
  assert.match(css, /\.pcm-person-related-row\s+span/u);
  assert.match(css, /min-width:\s*0/u);
  assert.match(css, /overflow-wrap:\s*anywhere/u);
});
