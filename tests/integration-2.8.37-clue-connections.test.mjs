import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const helperUrl = new URL("../runtime/archive-clue-connections.mjs", import.meta.url);

for (const file of [
  "neuro-archive-controller.mjs",
  "cyber-archive-controller.mjs",
  "neo-archive-controller.mjs",
]) {
  test(`${file} exposes independent clue connection rows`, () => {
    const source = readFileSync(new URL(`../runtime/${file}`, import.meta.url), "utf8");
    assert.match(source, /connections:\s*\[\]/u);
    assert.match(source, /data-action="add-clue-connection"/u);
    assert.match(source, /data-clue-connection-id/u);
    assert.match(source, /data-clue-connection-field="title"/u);
    assert.match(source, /data-clue-connection-field="text"/u);
    assert.match(source, /data-clue-connection-field="personId"/u);
    assert.match(source, /data-clue-connection-field="locationId"/u);
    assert.match(source, /data-action="delete-clue-connection"/u);
    assert.match(source, /pcm-clue-connections-read/u);
  });
}

test("clue connection model normalizes, edits, adds and removes independent rows", async () => {
  assert.equal(existsSync(fileURLToPath(helperUrl)), true, "archive-clue-connections.mjs must exist");
  const {
    normalizeClueConnections,
    createClueConnection,
    updateClueConnection,
    removeClueConnection,
  } = await import(`${helperUrl.href}?v=2837`);

  let ids = 0;
  const makeId = () => `link-${++ids}`;
  const normalized = normalizeClueConnections([
    null,
    { title: "  Первая связь  ", text: 42, personId: "p1", locationId: "l1" },
    { id: "same", title: "Вторая", text: "Текст" },
    { id: "same", title: "Третья" },
  ], makeId);

  assert.equal(normalized.length, 3);
  assert.deepEqual(normalized[0], {
    id: "link-1",
    title: "Первая связь",
    text: "42",
    personId: "p1",
    locationId: "l1",
  });
  assert.equal(new Set(normalized.map((item) => item.id)).size, 3);

  const created = createClueConnection(makeId);
  assert.deepEqual(created, {
    id: "link-3",
    title: "",
    text: "",
    personId: "",
    locationId: "",
  });
  normalized.push(created);

  assert.equal(updateClueConnection(normalized, created.id, "title", "Новая связь"), true);
  assert.equal(updateClueConnection(normalized, created.id, "personId", "p2"), true);
  assert.equal(updateClueConnection(normalized, created.id, "bogus", "x"), false);
  assert.equal(normalized.at(-1).title, "Новая связь");
  assert.equal(normalized.at(-1).personId, "p2");

  assert.equal(removeClueConnection(normalized, created.id), true);
  assert.equal(normalized.some((item) => item.id === created.id), false);
  assert.equal(removeClueConnection(normalized, "missing"), false);
});
