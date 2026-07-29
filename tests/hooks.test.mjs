import assert from "node:assert/strict";
import test from "node:test";

const registered = new Map();
const settingDefinitions = new Map();
globalThis.Hooks = {
  on(name, callback) {
    const callbacks = registered.get(name) ?? [];
    callbacks.push(callback);
    registered.set(name, callbacks);
  },
  once(name, callback) {
    this.on(name, callback);
  },
};
globalThis.game = {
  user: { id: "test-user", isGM: true },
  actors: { filter: () => [] },
  modules: new Map(),
  settings: {
    register(namespace, key, definition) {
      settingDefinitions.set(`${namespace}.${key}`, definition);
    },
    get(namespace, key) {
      return settingDefinitions.get(`${namespace}.${key}`)?.default;
    },
  },
};
globalThis.ui = {
  notifications: {
    error() {},
    info() {},
    warn() {},
  },
};

const runtime = await import("../module.js?hook-tests");
const { CyberwareTab } = await import("../sheets/CyberwareTab.js");

function setPath(object, path, value) {
  const parts = path.split(".");
  const deletion = parts.at(-1).startsWith("-=");
  if (deletion) parts[parts.length - 1] = parts.at(-1).slice(2);
  let target = object;
  for (const part of parts.slice(0, -1)) target = target[part] ??= {};
  if (deletion) delete target[parts.at(-1)];
  else target[parts.at(-1)] = value;
}

function item({
  id,
  installed = false,
  traits = ["neironn-uskoritell"],
  flags = {},
} = {}) {
  const document = {
    id,
    name: id,
    type: "equipment",
    flags: {
      "cyberpunk-remaster": {
        cyberware: true,
        installed,
        ...flags,
      },
    },
    system: {
      containerId: null,
      description: { value: "" },
      equipped: {
        carryType: installed ? "implanted" : "worn",
        handsHeld: 0,
        inSlot: false,
        invested: false,
      },
      traits: { value: traits },
      usage: { value: "implanted" },
    },
    getFlag(namespace, key) {
      return this.flags?.[namespace]?.[key];
    },
    updateSource(update) {
      for (const [path, value] of Object.entries(update)) {
        setPath(this, path, value);
      }
    },
  };
  return document;
}

function hook(name) {
  const callbacks = registered.get(name) ?? [];
  assert.ok(callbacks.length, `Missing ${name} hook`);
  return callbacks.at(-1);
}

test("module registers configurable world rules", () => {
  hook("init")();
  const keys = [
    "allowMultipleCyberdecks",
    "allowMultipleNeuralAccelerators",
    "allowMultiplePktBodies",
    "allowPktWithoutBody",
    "allowPktBodyWithoutBiosystem",
    "ignoreSlotLimits",
    "ignorePktQualityLimits",
    "hardCostMultiplier",
  ];
  for (const key of keys) {
    const definition = settingDefinitions.get(
      `cyberpunk-remaster.${key}`,
    );
    assert.ok(definition, `Missing setting ${key}`);
    assert.equal(definition.scope, "world");
    assert.equal(definition.config, true);
  }
  assert.equal(
    settingDefinitions.get(
      "cyberpunk-remaster.allowMultipleCyberdecks",
    ).default,
    false,
  );
  assert.equal(
    settingDefinitions.get(
      "cyberpunk-remaster.hardCostMultiplier",
    ).default,
    1,
  );
});

test("batch creation cannot install two neural accelerators", () => {
  const first = item({ id: "first" });
  const second = item({ id: "second" });
  const actor = { type: "character", items: [] };
  first.actor = actor;
  second.actor = actor;
  const options = {};
  const preCreate = hook("preCreateItem");

  preCreate(first, {}, options, "test-user");
  preCreate(second, {}, options, "test-user");

  assert.equal(first.getFlag("cyberpunk-remaster", "installed"), true);
  assert.equal(second.getFlag("cyberpunk-remaster", "installed"), false);
});

test("batch update validates against earlier planned installation states", () => {
  const first = item({ id: "first" });
  const second = item({ id: "second" });
  const actor = { type: "character", items: [first, second] };
  first.actor = actor;
  second.actor = actor;
  const options = {};
  const preUpdate = hook("preUpdateItem");

  const firstResult = preUpdate(
    first,
    { "flags.cyberpunk-remaster.installed": true },
    options,
  );
  const secondResult = preUpdate(
    second,
    { "flags.cyberpunk-remaster.installed": true },
    options,
  );

  assert.equal(firstResult, undefined);
  assert.equal(secondResult, false);
});

test("ordered batch replacement can remove then install a unique implant", () => {
  const previous = item({ id: "previous", installed: true });
  const replacement = item({ id: "replacement" });
  const actor = {
    type: "character",
    items: [previous, replacement],
  };
  previous.actor = actor;
  replacement.actor = actor;
  const options = {};
  const preUpdate = hook("preUpdateItem");

  const removeResult = preUpdate(
    previous,
    { "flags.cyberpunk-remaster.installed": false },
    options,
  );
  const installResult = preUpdate(
    replacement,
    { "flags.cyberpunk-remaster.installed": true },
    options,
  );

  assert.equal(removeResult, undefined);
  assert.equal(installResult, undefined);
});

test("locked PKT component blocks manual deletion but permits model rollback", () => {
  const component = item({
    id: "model-component",
    installed: true,
    traits: ["pkt"],
    flags: {
      pktLocked: true,
      pktModelKey: "model",
    },
  });
  const actor = { type: "character", items: [component] };
  component.actor = actor;
  const preDelete = hook("preDeleteItem");

  assert.equal(
    preDelete(component, {}, "test-user"),
    false,
  );
  assert.equal(
    preDelete(
      component,
      { cyberpunkRemasterModelOperation: true },
      "test-user",
    ),
    undefined,
  );
});

test("migration normalizes legacy conflicting installation state", async (t) => {
  t.mock.method(console, "warn", () => {});
  const body = item({
    id: "body",
    installed: true,
    traits: [],
    flags: { pktBody: true },
  });
  const component = item({
    id: "component",
    installed: true,
    traits: ["pkt"],
    flags: { pktOnly: true },
  });
  const firstAccelerator = item({
    id: "accelerator-one",
    installed: true,
  });
  const secondAccelerator = item({
    id: "accelerator-two",
    installed: true,
  });
  const firstDeck = item({
    id: "deck-one",
    installed: true,
    traits: [],
    flags: { exclusiveFamily: "cyberdeck" },
  });
  const secondDeck = item({
    id: "deck-two",
    installed: true,
    traits: [],
    flags: { exclusiveFamily: "cyberdeck" },
  });
  const stale = item({
    id: "stale",
    installed: false,
    traits: [],
    flags: {
      schema: 1,
      implantType: "module",
      hardCost: 99,
      slotsUsed: 9,
    },
  });
  stale.system.description.value =
    "<p>Тип импланта: Внутренний</p><p>Слоты: 1</p><p>Hard Cost: 2</p>";
  stale.system.equipped.carryType = "implanted";
  const stowed = item({
    id: "stowed",
    installed: false,
    traits: [],
  });
  stowed.system.equipped.carryType = "stowed";
  stowed.system.containerId = "backpack";
  const interfaceScan = item({
    id: "embedded-interface-scan",
    installed: false,
    traits: [],
  });
  interfaceScan.type = "action";
  interfaceScan.system.slug = "сканирование-интерфейсов";
  interfaceScan.system.usage = null;
  interfaceScan.flags["cyberpunk-remaster"] = {};
  const actorFlags = {};
  const actor = {
    name: "Migration Test",
    type: "character",
    items: [
      body,
      component,
      firstAccelerator,
      secondAccelerator,
      firstDeck,
      secondDeck,
      stale,
      stowed,
      interfaceScan,
    ],
    system: { abilities: { wis: { mod: 0 } } },
    getFlag(namespace, key) {
      return actorFlags?.[namespace]?.[key];
    },
    async setFlag(namespace, key, value) {
      actorFlags[namespace] ??= {};
      actorFlags[namespace][key] = value;
    },
    async updateEmbeddedDocuments(_type, updates) {
      for (const update of updates) {
        const target = this.items.find(
          (candidate) => candidate.id === update._id,
        );
        for (const [path, value] of Object.entries(update)) {
          if (path !== "_id") setPath(target, path, value);
        }
      }
    },
    async deleteEmbeddedDocuments(_type, ids) {
      for (const id of ids) {
        const index = this.items.findIndex((candidate) => candidate.id === id);
        if (index >= 0) this.items.splice(index, 1);
      }
    },
  };
  actor.items.has = (id) =>
    actor.items.some((candidate) => candidate.id === id);
  for (const embedded of actor.items) embedded.actor = actor;

  const result = await runtime.migrateActor(actor);

  assert.deepEqual(result, {
    bodies: 1,
    neuralAccelerators: 1,
    exclusiveImplants: 1,
    pktComponents: 1,
    netrunnerActionsRemoved: 1,
    descriptionMetadata: 1,
  });
  assert.equal(body.getFlag("cyberpunk-remaster", "installed"), false);
  assert.equal(component.getFlag("cyberpunk-remaster", "installed"), false);
  assert.equal(
    firstAccelerator.getFlag("cyberpunk-remaster", "installed"),
    true,
  );
  assert.equal(
    secondAccelerator.getFlag("cyberpunk-remaster", "installed"),
    false,
  );
  assert.equal(firstDeck.getFlag("cyberpunk-remaster", "installed"), true);
  assert.equal(secondDeck.getFlag("cyberpunk-remaster", "installed"), false);
  assert.equal(stale.system.equipped.carryType, "worn");
  assert.equal(
    stale.flags["cyberpunk-remaster"].implantType,
    undefined,
  );
  assert.equal(stale.flags["cyberpunk-remaster"].hardCost, undefined);
  assert.equal(stale.flags["cyberpunk-remaster"].slotsUsed, undefined);
  assert.equal(stale.flags["cyberpunk-remaster"].cyberware, undefined);
  assert.equal(CyberwareTab.getHardCost(stale), 2);
  assert.equal(CyberwareTab.getImplantType(stale), "internal");
  assert.equal(stowed.system.equipped.carryType, "stowed");
  assert.equal(stowed.system.containerId, "backpack");
  assert.equal(actor.items.includes(interfaceScan), false);
});
