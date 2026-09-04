import assert from "node:assert/strict";
import test from "node:test";

const serviceUrl = new URL("../runtime/world-city-map-user-links.mjs", import.meta.url);

function makeMap(markers = [{ id: "m1", x: 0.2, y: 0.3, title: "Afterlife", categoryId: "poi" }]) {
  return JSON.stringify({ version: 3, markers, categories: [{ id: "poi", label: "Интерес" }] });
}

function mockFoundry({ userId = "u1", gm = false, ownedActors = ["a1"], markers } = {}) {
  let flag = null;
  let worldWrites = 0;
  const user = {
    id: userId,
    isGM: gm,
    getFlag(scope, key) {
      assert.equal(scope, "cyberpunk-remaster");
      assert.equal(key, "worldCityMapPersonalLinksV1");
      return flag;
    },
    async setFlag(scope, key, value) {
      assert.equal(scope, "cyberpunk-remaster");
      assert.equal(key, "worldCityMapPersonalLinksV1");
      flag = structuredClone(value);
      return value;
    },
  };
  const actorMap = new Map(ownedActors.map((id) => [id, {
    id,
    testUserPermission(candidate, level) {
      return candidate === user && level === "OWNER";
    },
  }]));
  actorMap.set("foreign", {
    id: "foreign",
    testUserPermission() { return false; },
  });
  globalThis.game = {
    user,
    actors: { get(id) { return actorMap.get(id) ?? null; } },
    settings: {
      register() {},
      get() { return makeMap(markers); },
      async set() { worldWrites += 1; },
    },
  };
  globalThis.Hooks = { callAll() {} };
  return {
    get flag() { return flag; },
    set flag(value) { flag = structuredClone(value); },
    get worldWrites() { return worldWrites; },
  };
}

async function loadService(tag) {
  const mod = await import(`${serviceUrl.href}?${tag}`).catch(() => null);
  assert.ok(mod, "personal world-map link service module must exist");
  return mod;
}

test("personal map links persist under current User and stay isolated by Actor", async () => {
  const env = mockFoundry({ ownedActors: ["a1", "a2"] });
  const mod = await loadService("persist");

  await mod.addPersonalWorldMapLink({ actorId: "a1", section: "people", entryId: "p1", markerId: "m1" });
  assert.deepEqual(env.flag, {
    version: 1,
    actors: { a1: [{ markerId: "m1", section: "people", entryId: "p1" }] },
  });
  assert.deepEqual(mod.getPersonalWorldMapLinks("a1"), [{ markerId: "m1", section: "people", entryId: "p1" }]);
  assert.deepEqual(mod.getPersonalWorldMapLinks("a2"), []);
  assert.equal(env.worldWrites, 0, "personal linking must not write the shared world map");
});

test("personal map links deduplicate identical associations and support entry/marker queries", async () => {
  mockFoundry();
  const mod = await loadService("dedupe");
  const link = { actorId: "a1", section: "notes", entryId: "n1", markerId: "m1" };

  await mod.addPersonalWorldMapLink(link);
  await mod.addPersonalWorldMapLink(link);

  assert.deepEqual(mod.personalLinksForArchiveEntry({ actorId: "a1", section: "notes", entryId: "n1" }), [
    { markerId: "m1", section: "notes", entryId: "n1" },
  ]);
  assert.deepEqual(mod.personalLinksForMarker({ actorId: "a1", markerId: "m1" }), [
    { markerId: "m1", section: "notes", entryId: "n1" },
  ]);
});

test("stale marker references are filtered on read and pruned by the next write", async () => {
  const env = mockFoundry({ markers: [{ id: "m1", x: 0.1, y: 0.1, categoryId: "poi" }] });
  env.flag = {
    version: 1,
    actors: {
      a1: [
        { markerId: "deleted", section: "people", entryId: "p-old" },
        { markerId: "m1", section: "people", entryId: "p1" },
      ],
    },
  };
  const mod = await loadService("stale");

  assert.deepEqual(mod.getPersonalWorldMapLinks("a1"), [{ markerId: "m1", section: "people", entryId: "p1" }]);
  await mod.addPersonalWorldMapLink({ actorId: "a1", section: "people", entryId: "p2", markerId: "m1" });
  assert.equal(env.flag.actors.a1.some((link) => link.markerId === "deleted"), false);
});

test("normal users cannot link records for Actors they do not own and invalid markers/sections are rejected", async () => {
  mockFoundry();
  const mod = await loadService("permissions");

  await assert.rejects(
    () => mod.addPersonalWorldMapLink({ actorId: "foreign", section: "people", entryId: "p1", markerId: "m1" }),
    /персонаж|влад/u,
  );
  await assert.rejects(
    () => mod.addPersonalWorldMapLink({ actorId: "a1", section: "bad", entryId: "p1", markerId: "m1" }),
    /раздел/u,
  );
  await assert.rejects(
    () => mod.addPersonalWorldMapLink({ actorId: "a1", section: "people", entryId: "p1", markerId: "missing" }),
    /точк/u,
  );
});

test("removing a personal link only updates the current User flag", async () => {
  const env = mockFoundry();
  const mod = await loadService("remove");
  const link = { actorId: "a1", section: "clues", entryId: "c1", markerId: "m1" };
  await mod.addPersonalWorldMapLink(link);
  const removed = await mod.removePersonalWorldMapLink(link);
  assert.equal(removed, true);
  assert.deepEqual(mod.getPersonalWorldMapLinks("a1"), []);
  assert.equal(env.worldWrites, 0);
});
