import assert from "node:assert/strict";
import test from "node:test";

const url = new URL("../runtime/world-city-map.mjs", import.meta.url);

function mockFoundry({ gm = true, initial = "" } = {}) {
  let stored = initial;
  let registration = null;
  const calls = [];
  globalThis.game = {
    user: { isGM: gm },
    settings: {
      register(_module, _key, config) {
        registration = config;
        if (!stored) stored = config.default;
      },
      get() { return stored; },
      async set(_module, _key, value) {
        calls.push(JSON.parse(value));
        stored = value;
        registration?.onChange?.(value);
        return value;
      },
    },
  };
  const hooks = [];
  globalThis.Hooks = { callAll(name, state) { hooks.push([name, state]); } };
  return { get stored() { return stored; }, calls, hooks, get registration() { return registration; } };
}

test("world city map normalizes categories, markers, coordinates and links", async () => {
  mockFoundry();
  const mod = await import(`${url.href}?normalize=1`);
  const state = mod.normalizeWorldCityMap({
    title: "  NC  ",
    image: 42,
    categories: [{ id: " custom ", label: "  Custom " }, { id: "custom", label: "Duplicate" }],
    markers: [{ id: "m1", x: 5, y: -2, title: "  Point ", categoryId: "missing", links: [{ actorId: " a ", section: "clues", entryId: " c " }] }],
  });
  assert.equal(state.title, "NC");
  assert.equal(state.image, "42");
  assert.equal(state.markers[0].x, 1);
  assert.equal(state.markers[0].y, 0);
  assert.equal(state.markers[0].categoryId, "poi");
  assert.deepEqual(state.markers[0].links[0], { actorId: "a", section: "clues", entryId: "c" });
  assert.equal(new Set(state.categories.map((c) => c.id)).size, state.categories.length);
  assert.ok(state.categories.some((c) => c.id === "poi"));
});

test("world city map setting registers as hidden world string and emits change hook", async () => {
  const env = mockFoundry();
  const mod = await import(`${url.href}?register=1`);
  mod.registerWorldCityMapSetting();
  assert.equal(env.registration.scope, "world");
  assert.equal(env.registration.config, false);
  assert.equal(env.registration.type, String);
  assert.ok(JSON.parse(env.registration.default).categories.length >= 5);
  await globalThis.game.settings.set("cyberpunk-remaster", "worldCityMap", env.registration.default);
  assert.equal(env.hooks.at(-1)[0], mod.WORLD_CITY_MAP_HOOK);
});

test("GM can create update delete and link markers; player writes are rejected", async () => {
  mockFoundry({ gm: true });
  const mod = await import(`${url.href}?crud=1`);
  mod.registerWorldCityMapSetting();
  const created = await mod.createWorldMapMarker({ x: 0.25, y: 0.75, title: "Afterlife", categoryId: "gig" });
  assert.equal(created.title, "Afterlife");
  assert.equal(mod.getWorldCityMap().markers.length, 1);
  await mod.updateWorldMapMarker(created.id, { x: 1.5, description: "Bar" });
  assert.equal(mod.getWorldCityMap().markers[0].x, 1);
  assert.equal(mod.getWorldCityMap().markers[0].description, "Bar");
  const link = { actorId: "actor-1", section: "quests", entryId: "gig-1" };
  await mod.linkMarkerToArchiveEntry(created.id, link);
  assert.equal(mod.markersForArchiveEntry(link).length, 1);
  await mod.unlinkMarkerFromArchiveEntry(created.id, link);
  assert.equal(mod.markersForArchiveEntry(link).length, 0);
  await mod.deleteWorldMapMarker(created.id);
  assert.equal(mod.getWorldCityMap().markers.length, 0);

  globalThis.game.user.isGM = false;
  await assert.rejects(() => mod.createWorldMapMarker({ x: 0.5, y: 0.5 }), /GM/u);
});

test("world map updates are serialized so later updates see earlier writes", async () => {
  const env = mockFoundry({ gm: true });
  const mod = await import(`${url.href}?queue=1`);
  mod.registerWorldCityMapSetting();
  await Promise.all([
    mod.updateWorldCityMap((state) => { state.title = "A"; }),
    mod.updateWorldCityMap((state) => { state.image = "map.webp"; }),
  ]);
  const state = mod.getWorldCityMap();
  assert.equal(state.title, "A");
  assert.equal(state.image, "map.webp");
  assert.equal(env.calls.length, 2);
});

test("world city map migrates v2 state to the built-in Night City tileset without moving POIs", async () => {
  mockFoundry();
  const mod = await import(`${url.href}?v3-migration=1`);
  const legacy = {
    version: 2,
    title: "Legacy map",
    image: "",
    categories: [{ id: "gig", label: "Заказы", icon: "fa:fa-briefcase", color: "#ff9f1c" }],
    markers: [{
      id: "m1",
      x: 0.123456,
      y: 0.987654,
      title: "Точка",
      categoryId: "gig",
      links: [{ actorId: "actor", section: "quests", entryId: "quest" }],
    }],
  };
  const state = mod.normalizeWorldCityMap(legacy);
  assert.equal(mod.WORLD_CITY_MAP_VERSION, 3);
  assert.equal(state.version, 3);
  assert.equal(state.tileset, "night-city-2045");
  assert.equal(state.image, "");
  assert.equal(state.markers[0].x, 0.123456);
  assert.equal(state.markers[0].y, 0.987654);
  assert.deepEqual(state.markers[0].links, [{ actorId: "actor", section: "quests", entryId: "quest" }]);
});

test("world city map keeps a legacy custom image as an image-overlay override", async () => {
  mockFoundry();
  const mod = await import(`${url.href}?v3-image=1`);
  const state = mod.normalizeWorldCityMap({ version: 2, image: "world/custom-map.webp" });
  assert.equal(state.tileset, "night-city-2045");
  assert.equal(state.image, "world/custom-map.webp");
});

test("removed default categories stay absent and legacy points migrate to Интерес without data loss", async () => {
  mockFoundry();
  const mod = await import(`${url.href}?removed-categories=1`);
  const removed = new Set(["contact", "gig", "clue", "cyberpsycho", "melee", "netrunner", "fast-travel", "drop-point", "npc"]);

  const fresh = mod.defaultWorldCityMap();
  assert.deepEqual(fresh.categories.filter((category) => removed.has(category.id)), []);

  const legacy = mod.normalizeWorldCityMap({
    version: 3,
    categories: [
      { id: "gig", label: "Старые заказы", icon: "fa:fa-briefcase", color: "#123456" },
      { id: "custom", label: "Своя", icon: "fa:fa-star", color: "#abcdef" },
    ],
    markers: [{
      id: "legacy-gig",
      x: 0.321,
      y: 0.654,
      title: "Старая точка",
      description: "Не потерять",
      categoryId: "gig",
      icon: "fa:fa-bolt",
      color: "#112233",
      links: [{ actorId: "actor-1", section: "quests", entryId: "quest-1" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    }],
  });

  assert.equal(legacy.categories.some((category) => category.id === "gig"), false);
  assert.equal(legacy.categories.some((category) => category.id === "custom"), true);
  assert.deepEqual(legacy.markers[0], {
    id: "legacy-gig",
    x: 0.321,
    y: 0.654,
    title: "Старая точка",
    description: "Не потерять",
    categoryId: "poi",
    icon: "fa:fa-bolt",
    color: "#112233",
    links: [{ actorId: "actor-1", section: "quests", entryId: "quest-1" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  });
});
