import assert from "node:assert/strict";
import test from "node:test";

const storeModule = await import("../runtime/neuro-archive-store.mjs?2815-store-test");

test("unified archive merge keeps Remaster data and imports Field Archive sections", () => {
  const current = {
    version: 1,
    updatedAt: "2026-09-02T12:00:00.000Z",
    activeActorId: "actor-1",
    notebooks: {
      "actor-1": {
        actorId: "actor-1",
        actorName: "V",
        actorImg: "v.webp",
        updatedAt: "2026-09-02T12:00:00.000Z",
        entries: {
          people: [{
            id: "person-1",
            type: "people",
            title: "Raven",
            role: "Fixer",
            messages: [{ id: "m1", direction: "out", body: "ping" }],
            updatedAt: "2026-09-02T12:00:00.000Z"
          }],
          locations: [], quests: [], clues: [], sessions: [], notes: []
        }
      }
    }
  };

  const field = {
    version: 2,
    updatedAt: "2026-09-02T11:00:00.000Z",
    activeActorId: "actor-1",
    notebooks: {
      "actor-1": {
        actorId: "actor-1",
        actorName: "V",
        cityMap: { title: "Карта Найт-Сити", image: "map.webp", notes: "" },
        contactGroups: { lawman: ["NCPD"], noosphere: [], nomad: [] },
        entries: {
          people: [{
            id: "person-1",
            type: "people",
            title: "Raven",
            gang: "Mox",
            contactTypes: ["fixer"],
            updatedAt: "2026-09-02T11:00:00.000Z"
          }],
          gangs: [{ id: "gang-1", type: "gangs", title: "Mox", updatedAt: "2026-09-02T11:00:00.000Z" }],
          corporations: [], fixers: [], rippers: [], lawmen: [], noosphere: [], nomads: [],
          subscriptions: [], locations: [], quests: [], clues: [], books: [], sessions: [], notes: []
        }
      }
    }
  };

  const merged = storeModule.mergeArchiveStores(current, field);
  const book = merged.notebooks["actor-1"];
  const raven = book.entries.people.find((entry) => entry.id === "person-1");

  assert.equal(raven.title, "Raven");
  assert.equal(raven.role, "Fixer");
  assert.equal(raven.gang, "Mox");
  assert.equal(raven.messages[0].body, "ping");
  assert.deepEqual(raven.contactTypes, ["fixer"]);
  assert.equal(book.entries.gangs[0].title, "Mox");
  assert.equal(book.cityMap.image, "map.webp");
  assert.deepEqual(book.contactGroups.lawman, ["NCPD"]);
});

test("newer entry fields win but older unknown fields are preserved", () => {
  const older = {
    notebooks: {
      a: { entries: { people: [{ id: "p", type: "people", title: "Old", customOld: 7, updatedAt: "2026-09-01T10:00:00.000Z" }] } }
    }
  };
  const newer = {
    notebooks: {
      a: { entries: { people: [{ id: "p", type: "people", title: "New", customNew: 9, updatedAt: "2026-09-02T10:00:00.000Z" }] } }
    }
  };
  const merged = storeModule.mergeArchiveStores(older, newer);
  const person = merged.notebooks.a.entries.people[0];
  assert.equal(person.title, "New");
  assert.equal(person.customOld, 7);
  assert.equal(person.customNew, 9);
});

test("legacy server sources are merged into the canonical Remaster archive", () => {
  const user = {
    flags: {
      cyberpunkRemaster: { neuroArchive: { data: { notebooks: { a: { entries: { people: [{ id: "r", type: "people", title: "Remaster" }] } } } } } },
      nightCityFieldArchive: { data: { notebooks: { a: { entries: { gangs: [{ id: "g", type: "gangs", title: "Maelstrom" }] } } } } },
      personalChronicleMacro: { data: { notebooks: { a: { entries: { clues: [{ id: "c", type: "clues", title: "Legacy clue" }] } } } } }
    }
  };
  const merged = storeModule.readUnifiedServerData(user);
  assert.equal(merged.notebooks.a.entries.people[0].title, "Remaster");
  assert.equal(merged.notebooks.a.entries.gangs[0].title, "Maelstrom");
  assert.equal(merged.notebooks.a.entries.clues[0].title, "Legacy clue");
});

test("legacy archives are merged only until the canonical migration marker is saved", () => {
  const user = {
    flags: {
      cyberpunkRemaster: {
        neuroArchive: {
          data: {
            version: 3,
            _unifiedArchive: { legacyMergedVersion: 1 },
            notebooks: { a: { entries: { people: [] } } },
          },
        },
      },
      nightCityFieldArchive: {
        data: {
          notebooks: {
            a: { entries: { people: [{ id: "deleted-legacy", type: "people", title: "Must stay deleted" }] } },
          },
        },
      },
    },
  };
  const loaded = storeModule.readUnifiedServerData(user);
  assert.equal(loaded.notebooks.a.entries.people.length, 0);
  assert.equal(loaded._unifiedArchive.legacyMergedVersion, 1);
});

test("first legacy merge marks the canonical payload for one-time migration", () => {
  const user = {
    flags: {
      cyberpunkRemaster: { neuroArchive: { data: { notebooks: { a: { entries: { people: [] } } } } } },
      nightCityFieldArchive: { data: { notebooks: { a: { entries: { gangs: [{ id: "g", type: "gangs", title: "Mox" }] } } } } },
    },
  };
  const loaded = storeModule.readUnifiedServerData(user);
  assert.equal(loaded.notebooks.a.entries.gangs[0].title, "Mox");
  assert.equal(loaded._unifiedArchive.legacyMergedVersion, 1);
});

test("shared contact messages are appended once to the canonical person record", () => {
  const store = storeModule.mergeArchiveStores({
    notebooks: {
      a: {
        entries: {
          people: [{ id: "p", type: "people", title: "Raven", messages: [] }],
        },
      },
    },
  });
  const message = {
    id: "m-shared",
    direction: "out",
    body: "ping",
    createdAt: "2026-09-02T15:00:00.000Z",
    contactId: "p",
  };
  assert.equal(storeModule.appendUnifiedContactMessage(store, { actorId: "a", contactId: "p", message }), true);
  assert.equal(storeModule.appendUnifiedContactMessage(store, { actorId: "a", contactId: "p", message }), false);
  assert.equal(store.notebooks.a.entries.people[0].messages.length, 1);
  assert.equal(store.notebooks.a.entries.people[0].messages[0].body, "ping");
});

test("automatic Field Archive migration persists legacy server data without opening an archive window", async () => {
  assert.equal(typeof storeModule.migrateLegacyFieldArchiveUser, "function");
  const updates = [];
  const user = {
    id: "u1",
    flags: {
      nightCityFieldArchive: {
        data: {
          version: 2,
          updatedAt: "2026-09-02T10:00:00.000Z",
          notebooks: {
            a: { actorId: "a", entries: { people: [{ id: "old-p", type: "people", title: "Старый контакт", updatedAt: "2026-09-02T10:00:00.000Z" }] } },
          },
        },
      },
    },
    async update(payload) { updates.push(payload); },
  };

  const result = await storeModule.migrateLegacyFieldArchiveUser(user, {
    worldId: "world",
    currentUserId: "gm",
    includeLocal: false,
  });

  assert.equal(result.serverMerged, true);
  assert.equal(updates.length, 1);
  const saved = updates[0]["flags.cyberpunkRemaster.neuroArchive.data"];
  assert.equal(saved.notebooks.a.entries.people[0].title, "Старый контакт");
  assert.equal(saved._unifiedArchive.autoMigrationVersion, 1);
});

test("automatic migration imports a newer legacy browser draft for the current player", async () => {
  assert.equal(typeof storeModule.migrateLegacyFieldArchiveUser, "function");
  const updates = [];
  const local = new Map();
  local.set("night-city-field-archive:world:u1", JSON.stringify({
    version: 2,
    updatedAt: "2026-09-02T12:00:00.000Z",
    notebooks: {
      a: { actorId: "a", entries: { clues: [{ id: "local-c", type: "clues", title: "Локальная зацепка", updatedAt: "2026-09-02T12:00:00.000Z" }] } },
    },
  }));
  const storage = {
    getItem(key) { return local.get(key) ?? null; },
    setItem(key, value) { local.set(key, value); },
  };
  const user = {
    id: "u1",
    flags: {
      cyberpunkRemaster: { neuroArchive: { data: {
        version: 3,
        updatedAt: "2026-09-02T11:00:00.000Z",
        _unifiedArchive: { legacyMergedVersion: 1 },
        notebooks: { a: { actorId: "a", entries: { people: [] } } },
      } } },
    },
    async update(payload) { updates.push(payload); },
  };

  const result = await storeModule.migrateLegacyFieldArchiveUser(user, {
    worldId: "world",
    currentUserId: "u1",
    includeLocal: true,
    storage,
  });

  assert.equal(result.localMerged, true);
  const saved = updates[0]["flags.cyberpunkRemaster.neuroArchive.data"];
  assert.equal(saved.notebooks.a.entries.clues[0].title, "Локальная зацепка");
});

test("GM startup migration handles offline players while active players migrate themselves", async () => {
  assert.equal(typeof storeModule.migrateLegacyArchivesOnReady, "function");
  const migrated = [];
  const makeUser = (id, { active = false, isGM = false } = {}) => ({
    id, active, isGM,
    flags: { nightCityFieldArchive: { data: { notebooks: { [id]: { actorId: id, entries: { notes: [{ id: `${id}-n`, type: "notes", title: id }] } } } } } },
    async update() { migrated.push(id); },
  });
  const gm = makeUser("gm", { active: true, isGM: true });
  const activePlayer = makeUser("active", { active: true });
  const offlinePlayer = makeUser("offline", { active: false });
  const game = {
    user: gm,
    users: { contents: [gm, activePlayer, offlinePlayer], activeGM: gm },
    world: { id: "world" },
  };
  const storage = { getItem() { return null; }, setItem() {} };

  const result = await storeModule.migrateLegacyArchivesOnReady({ game, storage });
  assert.ok(result.migratedUsers >= 2);
  assert.ok(migrated.includes("gm"));
  assert.ok(migrated.includes("offline"));
  assert.ok(!migrated.includes("active"));
});
