import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  calculatePktModelPrices,
  MODULE_ITEM_PREFIX,
  parseCyberware,
  rewriteString,
  transformItems,
  transformJournals,
} from "../scripts/lib/content.mjs";
import { CyberwareTab, safeInt } from "../sheets/CyberwareTab.js";
import {
  addHumanityAdjustment,
  createHumanityRuleElement,
  HUMANITY_RULE_KEY,
  registerHumanityRuleElement,
} from "../rule-elements/HumanityRuleElement.js";

function fakeItem({
  id = "test",
  name = "Тест",
  type = "equipment",
  description = "",
  usage = { value: "implanted" },
  equipped = { carryType: "worn", invested: null },
  traits = [],
  flags = {},
} = {}) {
  return {
    id,
    _id: id,
    name,
    type,
    flags,
    system: {
      description: { value: description },
      usage,
      equipped,
      traits: { value: traits },
    },
    getFlag(namespace, key) {
      return this.flags?.[namespace]?.[key];
    },
  };
}

test("UUID rewrites cover world, relative, and PF2e references", () => {
  const source =
    "@UUID[Item.BANdFbfuD16lPHs4] " +
    "@UUID[Compendium.world.sf2e-cyberpunk-items.Item.abc123] " +
    "@UUID[Compendium.cyberpunk-remaster.cyberpunk-items.UIRRVbPxBWPV7zAm] " +
    "@UUID[Compendium.pf2e.conditionitems.Item.x]";
  const result = rewriteString(source);
  assert.match(
    result,
    new RegExp(`${MODULE_ITEM_PREFIX}\\.Item\\.BANdFbfuD16lPHs4`),
  );
  assert.match(
    result,
    new RegExp(`${MODULE_ITEM_PREFIX}\\.Item\\.UIRRVbPxBWPV7zAm`),
  );
  assert.doesNotMatch(result, /Compendium\.world|Compendium\.pf2e\./);
  assert.match(result, /Compendium\.sf2e\.conditions/);
});

test("cyberware parser normalizes HTML and extracts structured values", () => {
  const item = fakeItem({
    description:
      "<p>Тип&nbsp;импланта: Модуль</p><p>Слоты: 2</p>" +
      "<p>Stress Cost: [[/r 2d6 #Потеря Человечности]]</p>" +
      "<p>Hard Cost: 3</p>",
  });
  const parsed = parseCyberware(item);
  assert.equal(parsed.cyberware, true);
  assert.equal(parsed.implantType, "module");
  assert.equal(parsed.slots, 2);
  assert.equal(parsed.stressFormula, "2d6");
  assert.equal(parsed.hardCost, 3);
});

test("slot values are finite, integral and bounded", () => {
  assert.equal(safeInt("2"), 2);
  assert.equal(safeInt(-5), 0);
  assert.equal(safeInt(Number.NaN), 0);
  assert.equal(safeInt(999999), 1000);
});

test("cyberware description wins over stale structured flags", () => {
  const item = fakeItem({
    description: "<p>Тип импланта: База</p><p>Слоты: 4</p><p>Hard Cost: 3</p>",
    flags: {
      "cyberpunk-remaster": {
        implantType: "module",
        slots: "9",
        slotsUsed: "9",
        hardCost: 99,
      },
    },
  });
  assert.equal(CyberwareTab.getImplantType(item), "base");
  assert.equal(CyberwareTab.getSlots(item), 4);
  assert.equal(CyberwareTab.getSlotsUsed(item), 4);
  assert.equal(CyberwareTab.getHardCost(item), 3);

  item.system.description.value =
    "<p>Тип импланта: Модуль</p><p>Слоты: 2</p><p>Hard Cost: 7</p>";
  assert.equal(CyberwareTab.getImplantType(item), "module");
  assert.equal(CyberwareTab.getSlotsUsed(item), 2);
  assert.equal(CyberwareTab.getHardCost(item), 7);
});

test("legacy flags are read without calling an inactive Foundry scope", () => {
  const item = fakeItem({
    flags: {
      "cyberpunk-cyberware": {
        hardCost: 7,
        implantType: "internal",
      },
    },
  });
  item.getFlag = () => {
    throw new Error("Flag scope is not valid or not currently active");
  };

  assert.equal(CyberwareTab.getHardCost(item), 7);
  assert.equal(CyberwareTab.getImplantType(item), "internal");
});

test("legacy Humanity is read directly when its old module is inactive", () => {
  const actor = {
    items: [],
    flags: {
      "cyberpunk-cyberware": {
        humanity: { current: 13 },
      },
    },
    system: { abilities: { wis: { mod: 0 } } },
    getFlag() {
      throw new Error("Flag scope is not valid or not currently active");
    },
  };

  assert.deepEqual(CyberwareTab.getHumanity(actor), {
    current: 13,
    max: 40,
    maxPossible: 40,
  });
});

test("Humanity clamp is derived from installed Hard Cost", () => {
  const implant = fakeItem({
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        hardCost: 10,
        implantType: "internal",
      },
    },
  });
  const actor = {
    items: [implant],
    system: { abilities: { wis: { mod: 0 } } },
    getFlag(namespace, key) {
      if (namespace === "cyberpunk-remaster" && key === "humanity") {
        return { current: 40 };
      }
      return undefined;
    },
  };
  assert.deepEqual(CyberwareTab.getHumanity(actor), {
    current: 30,
    max: 30,
    maxPossible: 40,
  });
});

test("Humanity Rule Element adjustments apply before installed Hard Cost", () => {
  const implant = fakeItem({
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        hardCost: 10,
        implantType: "internal",
      },
    },
  });
  const actor = {
    items: [implant],
    flags: {},
    synthetics: {},
    system: { abilities: { wis: { mod: 0 } } },
  };
  addHumanityAdjustment(actor, {
    mode: "add",
    value: 10,
    source: "feat:add",
  });

  assert.deepEqual(CyberwareTab.getHumanity(actor), {
    current: 40,
    max: 40,
    maxPossible: 50,
  });

  addHumanityAdjustment(actor, {
    mode: "override",
    value: 60,
    source: "feat:override",
  });
  assert.deepEqual(CyberwareTab.getHumanity(actor), {
    current: 50,
    max: 50,
    maxPossible: 60,
  });
  assert.equal(
    addHumanityAdjustment(actor, {
      mode: "add",
      value: 999,
      source: "feat:add",
    }),
    false,
  );
  assert.equal(
    addHumanityAdjustment(actor, {
      mode: "add",
      value: Number.NaN,
      source: "feat:nan",
    }),
    false,
  );
});

test("CyberpunkHumanity Rule Element resolves and registers an adjustment", () => {
  class FakeRuleElement {
    static defineSchema() {
      return { priority: { initial: 100 } };
    }

    constructor(source, { parent, sourceIndex }) {
      Object.assign(this, source);
      this.parent = parent;
      this.sourceIndex = sourceIndex;
      this.label = parent.name;
    }

    get actor() {
      return this.parent.actor;
    }

    get item() {
      return this.parent;
    }

    test() {
      return true;
    }

    resolveValue(value) {
      return value;
    }

    failValidation(message) {
      throw new Error(message);
    }
  }
  class FakeField {
    constructor(options) {
      this.options = options;
    }
  }
  const RuleElement = createHumanityRuleElement(FakeRuleElement, {
    NumberField: FakeField,
    StringField: FakeField,
  });
  const actor = { synthetics: {} };
  const item = { id: "feat", name: "Человеческая стойкость", actor };
  const rule = new RuleElement(
    { key: HUMANITY_RULE_KEY, mode: "add", value: 15 },
    { parent: item, sourceIndex: 1 },
  );

  rule.beforePrepareData();
  assert.deepEqual(actor.synthetics["cyberpunk-remaster"].humanityAdjustments, [
    {
      mode: "add",
      value: 15,
      label: "Человеческая стойкость",
      source: "feat:1",
    },
  ]);
  assert.equal(
    CyberwareTab.hasHumanityRule({
      system: { rules: [{ key: HUMANITY_RULE_KEY }] },
    }),
    true,
  );
});

test("CyberpunkHumanity registers through the public SF2e custom registry", () => {
  const previous = {
    CONFIG: globalThis.CONFIG,
    foundry: globalThis.foundry,
    game: globalThis.game,
  };
  class FakeRuleElement {
    static defineSchema() {
      return {};
    }
  }
  class FakeField {
    constructor(options) {
      this.options = options;
    }
  }
  const custom = {};
  const module = {};
  globalThis.CONFIG = { PF2E: { ruleElementTypes: {} } };
  globalThis.foundry = {
    data: {
      fields: {
        NumberField: FakeField,
        StringField: FakeField,
      },
    },
  };
  globalThis.game = {
    i18n: { translations: {} },
    modules: { get: () => module },
    pf2e: {
      RuleElement: FakeRuleElement,
      RuleElements: { builtin: {}, custom },
    },
  };

  try {
    assert.equal(registerHumanityRuleElement(), true);
    assert.equal(typeof custom[HUMANITY_RULE_KEY], "function");
    assert.equal(
      globalThis.CONFIG.PF2E.ruleElementTypes[HUMANITY_RULE_KEY],
      "Предел человечности",
    );
    assert.equal(module.api.HumanityRuleElement, custom[HUMANITY_RULE_KEY]);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test("zero-slot modules fit a zero-slot or full base", async () => {
  const base = fakeItem({
    id: "base",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        implantType: "base",
        slots: 0,
      },
    },
  });
  const module = fakeItem({
    id: "module",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        implantType: "module",
        slotsUsed: 0,
      },
    },
  });
  let parentId = null;
  module.update = async (update) => {
    parentId = update["flags.cyberpunk-remaster.parentId"];
  };
  const actor = {
    items: [base, module],
    system: { abilities: { wis: { mod: 0 } } },
    getFlag: () => ({ current: 40 }),
    setFlag: async () => undefined,
  };
  actor.items.get = (id) => actor.items.find((item) => item.id === id);
  await CyberwareTab.attachModule(actor, module, base);
  assert.equal(parentId, "base");
});

test("a failed capacity check cannot partially install a module", async () => {
  const base = fakeItem({
    id: "base",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        implantType: "base",
        slots: 1,
      },
    },
  });
  const occupied = fakeItem({
    id: "occupied",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        implantType: "module",
        slotsUsed: 1,
        parentId: "base",
      },
    },
  });
  const candidate = fakeItem({
    id: "candidate",
    flags: {
      "cyberpunk-remaster": {
        installed: false,
        implantType: "module",
        slotsUsed: 1,
      },
    },
  });
  let updates = 0;
  candidate.update = async () => {
    updates++;
  };
  const actor = {
    items: [base, occupied, candidate],
    system: { abilities: { wis: { mod: 0 } } },
    getFlag: () => ({ current: 40 }),
    setFlag: async () => undefined,
  };
  actor.items.get = (id) => actor.items.find((item) => item.id === id);
  await assert.rejects(
    CyberwareTab.attachModule(actor, candidate, base),
    /Недостаточно слотов/,
  );
  assert.equal(updates, 0);
  assert.equal(CyberwareTab.isInstalled(candidate), false);
});

test("only one neural accelerator can be installed", () => {
  const installed = fakeItem({
    id: "first",
    traits: ["neironn-uskoritell"],
    flags: { "cyberpunk-remaster": { installed: true } },
  });
  const candidate = fakeItem({
    id: "second",
    traits: ["neironn-uskoritell"],
  });
  const message = CyberwareTab.installationValidation(
    { items: [installed, candidate] },
    candidate,
  );
  assert.match(message, /только один/);
});

test("only one implant from an exclusive family can be installed", () => {
  const installed = fakeItem({
    id: "deck-one",
    name: "Первая дека",
    flags: {
      "cyberpunk-remaster": {
        cyberware: true,
        installed: true,
        exclusiveFamily: "cyberdeck",
      },
    },
  });
  const candidate = fakeItem({
    id: "deck-two",
    name: "Вторая дека",
    flags: {
      "cyberpunk-remaster": {
        cyberware: true,
        exclusiveFamily: "cyberdeck",
      },
    },
  });
  const message = CyberwareTab.installationValidation(
    { items: [installed, candidate] },
    candidate,
  );
  assert.match(message, /кибердека/);
  assert.match(message, /только одн/);
});

test("world settings can relax deck limits and scale Hard Cost", (t) => {
  const previousGame = globalThis.game;
  t.after(() => {
    globalThis.game = previousGame;
  });
  const settings = new Map([
    ["allowMultipleCyberdecks", true],
    ["hardCostMultiplier", 1.5],
  ]);
  globalThis.game = {
    settings: {
      get(namespace, key) {
        assert.equal(namespace, "cyberpunk-remaster");
        return settings.has(key) ? settings.get(key) : undefined;
      },
    },
  };

  const installed = fakeItem({
    id: "deck-one",
    flags: {
      "cyberpunk-remaster": {
        cyberware: true,
        installed: true,
        exclusiveFamily: "cyberdeck",
        hardCost: 3,
      },
    },
  });
  const candidate = fakeItem({
    id: "deck-two",
    flags: {
      "cyberpunk-remaster": {
        cyberware: true,
        exclusiveFamily: "cyberdeck",
      },
    },
  });

  assert.equal(
    CyberwareTab.installationValidation(
      { items: [installed, candidate] },
      candidate,
    ),
    null,
  );
  const humanity = CyberwareTab.getHumanity({
    items: [installed],
    system: { abilities: { wis: { mod: 0 } } },
    flags: {},
  });
  assert.equal(humanity.max, 35);
});

test("world settings can relax PKT prerequisites, quality, and slots", (t) => {
  const previousGame = globalThis.game;
  t.after(() => {
    globalThis.game = previousGame;
  });
  const relaxed = new Set([
    "allowMultipleNeuralAccelerators",
    "allowMultiplePktBodies",
    "allowPktWithoutBody",
    "allowPktBodyWithoutBiosystem",
    "ignoreSlotLimits",
    "ignorePktQualityLimits",
  ]);
  globalThis.game = {
    settings: {
      get(_namespace, key) {
        return relaxed.has(key) ? true : undefined;
      },
    },
  };

  const firstAccelerator = fakeItem({
    id: "accelerator-one",
    traits: ["neironn-uskoritell"],
    flags: { "cyberpunk-remaster": { installed: true } },
  });
  const secondAccelerator = fakeItem({
    id: "accelerator-two",
    traits: ["neironn-uskoritell"],
  });
  assert.equal(
    CyberwareTab.installationValidation(
      { items: [firstAccelerator, secondAccelerator] },
      secondAccelerator,
    ),
    null,
  );

  const firstBody = fakeItem({
    id: "body-one",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBody: true,
        pktQuality: 0,
      },
    },
  });
  const secondBody = fakeItem({
    id: "body-two",
    flags: {
      "cyberpunk-remaster": {
        pktBody: true,
        pktQuality: 0,
      },
    },
  });
  assert.equal(
    CyberwareTab.installationValidation(
      { items: [firstBody, secondBody] },
      secondBody,
    ),
    null,
  );
  assert.equal(
    CyberwareTab.pktModelValidation(
      { items: [firstBody] },
      {
        key: "absolute-model",
        name: "Абсолютная модель",
        bodyQuality: 5,
        requiredBodyId: "absolute-body",
        requiredBodyName: "Абсолютный корпус",
      },
    ),
    null,
  );

  const base = fakeItem({
    id: "base",
    description: "Тип импланта: База Слоты: 0",
    flags: { "cyberpunk-remaster": { installed: true } },
  });
  const module = fakeItem({
    id: "module",
    description: "Тип импланта: Модуль Слоты: 2",
  });
  const view = CyberwareTab.prepareData({
    items: [base, module],
    flags: {},
    system: { abilities: { wis: { mod: 0 } } },
  });
  assert.equal(view.notInstalled[0].baseOptions[0].canFit, true);
});

test("multiple PKT bodies keep components bound to the remaining body", (t) => {
  const previousGame = globalThis.game;
  t.after(() => {
    globalThis.game = previousGame;
  });
  const settings = new Set([
    "allowMultiplePktBodies",
    "allowPktBodyWithoutBiosystem",
  ]);
  globalThis.game = {
    settings: {
      get(_namespace, key) {
        return settings.has(key) ? true : undefined;
      },
    },
  };

  const serialBody = fakeItem({
    id: "serial-body",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBody: true,
        pktQuality: 0,
      },
    },
  });
  const eliteBody = fakeItem({
    id: "elite-body",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBody: true,
        pktQuality: 4,
      },
    },
  });
  const serialComponent = fakeItem({
    id: "serial-component",
    traits: ["pkt"],
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBodyId: serialBody.id,
      },
    },
  });
  const eliteComponent = fakeItem({
    id: "elite-component",
    traits: ["pkt"],
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBodyId: eliteBody.id,
      },
    },
  });
  const genericComponent = fakeItem({
    id: "generic-component",
    traits: ["pkt"],
    flags: { "cyberpunk-remaster": { installed: true } },
  });
  const actor = {
    items: [
      serialBody,
      eliteBody,
      serialComponent,
      eliteComponent,
      genericComponent,
    ],
  };

  assert.equal(
    CyberwareTab.pktModelBody(actor, {
      bodyQuality: 4,
      requiredBodyId: "elite-source",
    }),
    eliteBody,
  );
  assert.deepEqual(
    CyberwareTab.pktEjectionUpdates(actor, serialBody.id).map(
      (update) => update._id,
    ),
    [serialComponent.id],
  );
});

test("installed cyberware grants and removes its managed focus item", async (t) => {
  const previousFromUuid = globalThis.fromUuid;
  t.after(() => {
    globalThis.fromUuid = previousFromUuid;
  });
  const focusUuid = "Compendium.sf2e.spells.Item.1gkdgFwKfAoQx163";
  globalThis.fromUuid = async (uuid) => ({
    toObject: () => ({
      _id: "source",
      name: "Warp Time",
      type: "spell",
      flags: {},
      system: { traits: { value: ["focus"] } },
      _stats: { compendiumSource: uuid },
    }),
  });
  const deck = fakeItem({
    id: "deck",
    flags: {
      "cyberpunk-remaster": {
        cyberware: true,
        installed: true,
        grantItemUuids: [focusUuid],
      },
    },
  });
  const actor = {
    items: [deck],
    async createEmbeddedDocuments(_type, sources) {
      const created = sources.map((source, index) => ({
        ...structuredClone(source),
        id: `grant-${index}`,
        _id: `grant-${index}`,
      }));
      this.items.push(...created);
      return created;
    },
    async deleteEmbeddedDocuments(_type, ids) {
      this.items = this.items.filter((item) => !ids.includes(item.id));
    },
  };

  const first = await CyberwareTab.reconcileGrantedItems(actor);
  assert.equal(first.created.length, 1);
  assert.equal(
    first.created[0].flags["cyberpunk-remaster"].grantedSourceUuid,
    focusUuid,
  );

  deck.flags["cyberpunk-remaster"].installed = false;
  const second = await CyberwareTab.reconcileGrantedItems(actor);
  assert.equal(second.deleted, 1);
  assert.deepEqual(actor.items, [deck]);
});

test("removing a PKT body ejects every installed PKT-only component", async () => {
  const component = fakeItem({
    id: "component",
    traits: ["pkt"],
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktOnly: true,
      },
    },
  });
  let updates = null;
  const actor = {
    items: [component],
    async updateEmbeddedDocuments(_type, payload) {
      updates = payload;
    },
  };
  const count = await CyberwareTab.ejectPktComponents(actor);
  assert.equal(count, 1);
  assert.equal(updates[0]._id, "component");
  assert.equal(updates[0]["flags.cyberpunk-remaster.installed"], false);
});

test("PKT body installation requires an installed Biosystem", () => {
  const body = fakeItem({
    id: "body",
    name: "Полная Конверсия Тела [Серийная]",
    flags: {
      "cyberpunk-remaster": {
        installed: false,
        pktBody: true,
      },
    },
  });
  const biosystem = fakeItem({
    id: "biosystem",
    name: "Биосистема",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBiosystem: true,
      },
    },
  });

  assert.match(
    CyberwareTab.installationValidation({ items: [body] }, body),
    /Биосистем/,
  );
  assert.equal(
    CyberwareTab.installationValidation({ items: [body, biosystem] }, body),
    null,
  );
});

test("installed Biosystem cannot be removed before the PKT body", () => {
  const body = fakeItem({
    id: "body",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBody: true,
      },
    },
  });
  const biosystem = fakeItem({
    id: "biosystem",
    name: "Биосистема",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBiosystem: true,
      },
    },
  });
  assert.match(
    CyberwareTab.removalValidation({ items: [body, biosystem] }, biosystem),
    /Сначала извлеките корпус/,
  );
});

test("PKT model readiness accepts a body of equal or higher quality", () => {
  const biosystem = fakeItem({
    id: "biosystem",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBiosystem: true,
      },
    },
  });
  const body = fakeItem({
    id: "body",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBody: true,
        pktQuality: 0,
      },
    },
  });
  const model = {
    key: "test-model",
    name: "Test model",
    requiredBodyId: "source-body",
    requiredBodyName: "Serial body",
    bodyQuality: 0,
    priceEddies: 6400,
  };

  assert.match(
    CyberwareTab.pktModelValidation({ items: [body] }, model),
    /Биосистем/,
  );
  assert.equal(
    CyberwareTab.pktModelValidation({ items: [biosystem, body] }, model),
    null,
  );
  assert.match(
    CyberwareTab.pktModelView({ items: [biosystem, body] }, model).priceLabel,
    /6.400/u,
  );
  body.flags["cyberpunk-remaster"].pktQuality = 1;
  assert.equal(
    CyberwareTab.pktModelValidation({ items: [biosystem, body] }, model),
    null,
  );
  assert.match(
    CyberwareTab.pktModelValidation(
      { items: [biosystem, body] },
      { ...model, bodyQuality: 2, requiredBodyName: "Advanced body" },
    ),
    /не ниже «Advanced body»/,
  );
});

test("PKT model cards require Biosystem and hide other installed models", () => {
  const biosystem = fakeItem({
    id: "biosystem",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBiosystem: true,
      },
    },
  });
  const body = fakeItem({
    id: "body",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBody: true,
        pktQuality: 2,
      },
    },
  });
  const models = ["first", "second"].map((key) => ({
    key,
    name: key,
    requiredBodyId: "body",
    requiredBodyName: "Body",
    bodyQuality: 0,
    priceEddies: 100,
    unique: [],
    components: [],
    choices: [],
  }));
  const actor = {
    items: [body],
    flags: {},
    system: { abilities: { wis: { mod: 0 } } },
  };

  let view = CyberwareTab.prepareData(actor, { pktModels: models });
  assert.equal(view.showPktModels, false);
  actor.items.push(biosystem);
  view = CyberwareTab.prepareData(actor, { pktModels: models });
  assert.equal(view.showPktModels, true);
  assert.deepEqual(
    view.pktModels.map((model) => model.key),
    ["first", "second"],
  );

  actor.items.push(
    fakeItem({
      id: "installed-model-component",
      flags: {
        "cyberpunk-remaster": {
          installed: true,
          implantType: "internal",
          pktModelKey: "second",
        },
      },
    }),
  );
  view = CyberwareTab.prepareData(actor, { pktModels: models });
  assert.deepEqual(
    view.pktModels.map((model) => model.key),
    ["second"],
  );
});

test("Chrome bases and dock are sorted alphabetically in Russian", () => {
  const base = (id, name) =>
    fakeItem({
      id,
      name,
      flags: {
        "cyberpunk-remaster": {
          installed: true,
          implantType: "base",
          slots: 2,
        },
      },
    });
  const actor = {
    items: [base("zeta", "Ядро"), base("alpha", "Альфа"), base("beta", "Бета")],
    flags: {},
    system: { abilities: { wis: { mod: 0 } } },
  };

  const view = CyberwareTab.prepareData(actor);
  assert.deepEqual(
    view.bases.map((entry) => entry.name),
    ["Альфа", "Бета", "Ядро"],
  );
  assert.deepEqual(
    view.baseDock.map((entry) => entry.name),
    ["Альфа", "Бета", "Ядро"],
  );
});

test("PKT model plan expands quantities and validates choices", () => {
  const model = {
    unique: [{ itemId: "unique", quantity: 1, stress: "waived" }],
    components: [
      {
        key: "arms",
        itemId: "arm",
        quantity: 2,
        stress: "waived",
      },
    ],
    choices: [
      {
        key: "appearance",
        choose: 1,
        itemIds: ["a", "b"],
        options: [
          { itemId: "a", name: "A" },
          { itemId: "b", name: "B" },
        ],
        stress: "normal",
      },
    ],
  };
  const plan = CyberwareTab.pktInstallationPlan(model, {
    appearance: "b",
  });

  assert.equal(plan.length, 4);
  assert.deepEqual(
    plan
      .filter((entry) => entry.componentKey === "arms")
      .map((entry) => entry.quantityIndex),
    [0, 1],
  );
  assert.equal(plan.at(-1).itemId, "b");
  assert.throws(
    () => CyberwareTab.pktInstallationPlan(model, { appearance: "wrong" }),
    /Выберите 1 вариант/,
  );
});

test("declared shipped PKT prices equal the component sums without bodies", () => {
  const models = JSON.parse(
    readFileSync(new URL("../data/pkt-models.json", import.meta.url), "utf8"),
  );
  const items = JSON.parse(
    readFileSync(
      new URL("../content/exports/items.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    models
      .map((model) => ({
        key: model.key,
        declared: model.priceEddies,
        calculated: calculatePktModelPrices(items, model),
      }))
      .every(
        (entry) =>
          entry.calculated.length === 1 &&
          entry.calculated[0] === entry.declared,
      ),
    true,
  );
});

test("PKT modules are distributed across compatible bases with slot checks", () => {
  const base = (id) =>
    fakeItem({
      id,
      flags: {
        "cyberpunk-remaster": {
          installed: true,
          implantType: "base",
          pktFamily: "eye",
          slots: 1,
        },
      },
    });
  const module = (id) =>
    fakeItem({
      id,
      flags: {
        "cyberpunk-remaster": {
          installed: true,
          implantType: "module",
          pktParentFamily: "eye",
          slotsUsed: 1,
        },
      },
    });
  const updates = CyberwareTab.pktModuleLinkUpdates([
    base("left"),
    base("right"),
    module("first"),
    module("second"),
  ]);

  assert.deepEqual(
    updates.map((update) => update["flags.cyberpunk-remaster.parentId"]),
    ["left", "right"],
  );
  assert.throws(
    () =>
      CyberwareTab.pktModuleLinkUpdates([
        base("only"),
        module("first"),
        module("second"),
      ]),
    /не хватает слотов/,
  );
});

test("PKT base replacement transfers modules and keeps model locks", async (t) => {
  const previousGame = globalThis.game;
  t.after(() => {
    globalThis.game = previousGame;
  });

  const body = fakeItem({
    id: "body",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBody: true,
        pktQuality: 0,
      },
    },
  });
  const oldBase = fakeItem({
    id: "old-base",
    name: "Кибер-глаз [Серийный]",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        implantType: "base",
        slots: 2,
        pktFamily: "cyber-eye",
        pktComponentQuality: 0,
        pktReplaceable: true,
        pktReplaceableBase: true,
        pktModelKey: "test-model",
        pktComponentKey: "eyes",
        pktModelSourceId: "old-source",
        pktLocked: true,
        pktBodyId: "body",
        pktQuantityIndex: 0,
      },
    },
  });
  const module = fakeItem({
    id: "eye-module",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        implantType: "module",
        slotsUsed: 1,
        parentId: "old-base",
        pktModelKey: "test-model",
        pktLocked: true,
      },
    },
  });
  const replacementSource = {
    id: "new-source",
    name: "Кибер-глаз [Тактический]",
    flags: {
      "cyberpunk-remaster": {
        cyberware: true,
        implantType: "base",
        slots: 2,
        hardCost: 3,
        pktOnly: true,
        pktFamily: "cyber-eye",
        pktComponentQuality: 1,
        pktReplaceable: true,
      },
    },
    system: {
      description: { value: "" },
      equipped: { carryType: "worn" },
      traits: { value: ["pkt"] },
      quantity: 1,
      price: { value: { sp: 2000 } },
    },
    toObject() {
      return structuredClone({
        _id: this.id,
        name: this.name,
        type: "equipment",
        flags: this.flags,
        system: this.system,
      });
    },
  };
  const actor = {
    items: [body, oldBase, module],
    flags: {},
    system: { abilities: { wis: { mod: 0 } } },
    async createEmbeddedDocuments(_type, sources) {
      const created = {
        ...structuredClone(sources[0]),
        id: "new-base",
        _id: "new-base",
      };
      created.flags["cyberpunk-remaster"].installed = true;
      created.system.equipped.carryType = "implanted";
      this.items.push(created);
      return [created];
    },
    async updateEmbeddedDocuments(_type, updates) {
      for (const update of updates) {
        const item = this.items.find((entry) => entry.id === update._id);
        item.flags["cyberpunk-remaster"].parentId =
          update["flags.cyberpunk-remaster.parentId"];
      }
    },
    async deleteEmbeddedDocuments(_type, ids) {
      this.items = this.items.filter((item) => !ids.includes(item.id));
    },
    async setFlag(namespace, key, value) {
      this.flags[namespace] ??= {};
      this.flags[namespace][key] = value;
    },
  };
  globalThis.game = {
    packs: new Map([
      [
        "cyberpunk-remaster.cyberpunk-items",
        { getDocument: async () => replacementSource },
      ],
    ]),
  };

  const options = CyberwareTab.pktBaseReplacementOptions(actor, oldBase, [
    {
      itemId: "new-source",
      name: replacementSource.name,
      family: "cyber-eye",
      quality: 1,
      replaceable: true,
      slots: 2,
    },
  ]);
  assert.equal(options[0].canUse, true);

  const result = await CyberwareTab.replacePktBase(
    actor,
    oldBase,
    "new-source",
  );
  assert.equal(result.transferredModules, 1);
  assert.equal(
    actor.items.some((item) => item.id === "old-base"),
    false,
  );
  assert.equal(module.flags["cyberpunk-remaster"].parentId, "new-base");
  const newBase = actor.items.find((item) => item.id === "new-base");
  assert.equal(newBase.flags["cyberpunk-remaster"].pktModelKey, "test-model");
  assert.equal(newBase.flags["cyberpunk-remaster"].pktLocked, true);
  assert.equal(newBase.flags["cyberpunk-remaster"].pktStress, "normal");
  assert.equal(newBase.flags["cyberpunk-remaster"].pktReplaceableBase, true);

  const tooGood = {
    ...replacementSource,
    id: "elite-source",
    flags: {
      "cyberpunk-remaster": {
        ...replacementSource.flags["cyberpunk-remaster"],
        pktComponentQuality: 2,
      },
    },
  };
  assert.match(
    CyberwareTab.pktBaseReplacementValidation(actor, newBase, tooGood),
    /максимум на одну ступень выше/,
  );
});

test("locked PKT model component can only be removed with model dismantle", () => {
  const component = fakeItem({
    id: "locked",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktLocked: true,
        pktModelKey: "model",
      },
    },
  });
  assert.match(
    CyberwareTab.removalValidation({ items: [component] }, component),
    /Демонтируйте всю модель/,
  );
});

test("failed PKT model linking rolls back every created component", async (t) => {
  const previousGame = globalThis.game;
  t.after(() => {
    globalThis.game = previousGame;
  });
  const sourceDocument = {
    toObject() {
      return {
        _id: "module-source",
        name: "Orphan module",
        type: "equipment",
        flags: {
          "cyberpunk-remaster": {
            cyberware: true,
            implantType: "module",
            slotsUsed: 1,
            stressFormula: "1d4",
          },
        },
        system: {
          description: { value: "" },
          equipped: { carryType: "worn" },
          traits: { value: ["pkt"] },
          quantity: 1,
        },
      };
    },
  };
  globalThis.game = {
    packs: new Map([
      [
        "cyberpunk-remaster.cyberpunk-items",
        { getDocument: async () => sourceDocument },
      ],
    ]),
  };

  const biosystem = fakeItem({
    id: "biosystem",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBiosystem: true,
      },
    },
  });
  const body = fakeItem({
    id: "body",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBody: true,
        pktQuality: 0,
      },
    },
  });
  let rolledBack = [];
  const actor = {
    items: [biosystem, body],
    async createEmbeddedDocuments(_type, sources) {
      const documents = sources.map((source, index) => ({
        ...source,
        id: `created-${index}`,
        _id: `created-${index}`,
        flags: {
          ...source.flags,
          "cyberpunk-remaster": {
            ...source.flags["cyberpunk-remaster"],
            installed: true,
          },
        },
      }));
      this.items.push(...documents);
      return documents;
    },
    async deleteEmbeddedDocuments(_type, ids) {
      rolledBack = ids;
      this.items = this.items.filter((item) => !ids.includes(item.id));
    },
  };
  const model = {
    key: "broken",
    name: "Broken",
    requiredBodyId: "body-source",
    requiredBodyName: "Body",
    bodyQuality: 0,
    unique: [],
    components: [
      {
        key: "orphan",
        itemId: "module-source",
        quantity: 1,
        parentFamily: "missing-base",
        locked: true,
        stress: "normal",
      },
    ],
    choices: [],
  };

  await assert.rejects(
    CyberwareTab.installPktModel(actor, model),
    /не создана база/,
  );
  assert.deepEqual(rolledBack, ["created-0"]);
  assert.equal(
    actor.items.some((item) => item.id === "created-0"),
    false,
  );
});

test("all shipped PKT models install with their real component data", async (t) => {
  const previousGame = globalThis.game;
  const previousFromUuid = globalThis.fromUuid;
  t.after(() => {
    globalThis.game = previousGame;
    globalThis.fromUuid = previousFromUuid;
  });
  const models = JSON.parse(
    readFileSync(new URL("../data/pkt-models.json", import.meta.url), "utf8"),
  );
  const exportedItems = JSON.parse(
    readFileSync(
      new URL("../content/exports/items.json", import.meta.url),
      "utf8",
    ),
  );
  const sourceById = new Map(
    exportedItems.map((source) => [
      source._id,
      {
        toObject: () => structuredClone(source),
      },
    ]),
  );
  globalThis.game = {
    packs: new Map([
      [
        "cyberpunk-remaster.cyberpunk-items",
        {
          getDocument: async (id) => sourceById.get(id),
        },
      ],
    ]),
  };
  globalThis.fromUuid = async (uuid) => ({
    toObject: () => ({
      _id: "granted-source",
      name: uuid,
      type: "spell",
      flags: {},
      system: {
        traits: { value: ["focus"] },
      },
      _stats: { compendiumSource: uuid },
    }),
  });

  for (const model of models) {
    let sequence = 0;
    const biosystem = fakeItem({
      id: "biosystem",
      flags: {
        "cyberpunk-remaster": {
          installed: true,
          pktBiosystem: true,
        },
      },
    });
    const body = fakeItem({
      id: "body",
      flags: {
        "cyberpunk-remaster": {
          installed: true,
          pktBody: true,
          pktQuality: model.bodyQuality,
        },
      },
    });
    const actor = {
      items: [biosystem, body],
      flags: {},
      system: { abilities: { wis: { mod: 0 } } },
      async createEmbeddedDocuments(_type, sources) {
        const documents = sources.map((source) => {
          const document = {
            ...source,
            id: `created-${sequence++}`,
            _id: `created-${sequence - 1}`,
            flags: structuredClone(source.flags),
            system: structuredClone(source.system),
          };
          document.flags["cyberpunk-remaster"].installed = true;
          if (document.type === "equipment") {
            document.system.equipped ??= {};
            document.system.equipped.carryType = "implanted";
          }
          return document;
        });
        this.items.push(...documents);
        return documents;
      },
      async updateEmbeddedDocuments(_type, updates) {
        for (const update of updates) {
          const item = this.items.find(
            (candidate) => candidate.id === update._id,
          );
          item.flags["cyberpunk-remaster"].parentId =
            update["flags.cyberpunk-remaster.parentId"];
        }
      },
      async deleteEmbeddedDocuments(_type, ids) {
        this.items = this.items.filter((item) => !ids.includes(item.id));
      },
      async setFlag(namespace, key, value) {
        this.flags[namespace] ??= {};
        this.flags[namespace][key] = value;
      },
    };
    const selections = Object.fromEntries(
      (model.choices ?? []).map((choice) => [choice.key, choice.itemIds[0]]),
    );
    const expected = CyberwareTab.pktInstallationPlan(model, selections).length;

    const result = await CyberwareTab.installPktModel(
      actor,
      { ...model, requiredBodyName: "Body" },
      selections,
    );
    assert.equal(result.created.length, expected, model.key);
    assert.ok(
      result.created.every(
        (item) => item.flags["cyberpunk-remaster"].installed === true,
      ),
      model.key,
    );
    assert.ok(
      result.created
        .filter((item) => item.flags["cyberpunk-remaster"].pktParentFamily)
        .every((item) => item.flags["cyberpunk-remaster"].parentId),
      model.key,
    );

    const removed = await CyberwareTab.removePktModel(actor, model.key);
    assert.equal(removed, expected, model.key);
    assert.equal(actor.items.length, 2, model.key);
  }
});

test("PKT Humanity exposes one combined player roll and keeps Hard Cost separate", () => {
  const plan = [
    { itemId: "waived", stress: "waived", stressFormula: "4d6" },
    { itemId: "light", stress: "normal", stressFormula: "1d4" },
    { itemId: "heavy", stress: "normal", stressFormula: "2d6" },
  ];
  const summary = CyberwareTab.pktHumanityLossSummary(plan);
  assert.deepEqual(summary, {
    complete: true,
    d4: 1,
    d6: 2,
    formula: "2d6 + 1d4",
    average: 9.5,
  });
  assert.equal(typeof CyberwareTab.applyPktHumanityLoss, "undefined");
  const confirmation = CyberwareTab.pktConfirmationContent(
    { name: "Тестовая модель", priceEddies: 1000 },
    plan,
  );
  assert.match(confirmation, /2d6 \+ 1d4/);
  assert.match(confirmation, /inline-формуле.*в журнале/iu);
  assert.doesNotMatch(confirmation, /автоматически применит/iu);
});

test("PKT body removal and component ejection use one managed batch", async () => {
  const body = fakeItem({
    id: "body",
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktBody: true,
      },
    },
  });
  const component = fakeItem({
    id: "component",
    traits: ["pkt"],
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        pktOnly: true,
      },
    },
  });
  let batch = null;
  let batchOptions = null;
  let calls = 0;
  const actor = {
    items: [body, component],
    system: { abilities: { wis: { mod: 0 } } },
    getFlag: () => ({ current: 40 }),
    setFlag: async () => undefined,
    async updateEmbeddedDocuments(_type, updates, options) {
      calls++;
      batch = updates;
      batchOptions = options;
    },
  };

  await CyberwareTab.setInstalled(actor, body, false);
  assert.equal(calls, 1);
  assert.equal(batchOptions.cyberpunkRemasterManaged, true);
  assert.deepEqual(
    new Set(batch.map((update) => update._id)),
    new Set(["body", "component"]),
  );
  assert.equal(
    batch.find((update) => update._id === "component")[
      "flags.cyberpunk-remaster.installed"
    ],
    false,
  );
});

test("removing an already uninstalled spare PKT body is a no-op", async () => {
  const body = fakeItem({
    id: "spare-body",
    flags: {
      "cyberpunk-remaster": {
        installed: false,
        pktBody: true,
      },
    },
  });
  let calls = 0;
  const result = await CyberwareTab.setInstalled(
    {
      items: [body],
      updateEmbeddedDocuments: async () => {
        calls++;
      },
    },
    body,
    false,
  );
  assert.equal(result, true);
  assert.equal(calls, 0);
});

test("native implanted carry transition records and applies system state", () => {
  const item = fakeItem({
    equipped: {
      carryType: "stowed",
      handsHeld: 1,
      inSlot: true,
      invested: false,
    },
    traits: ["invested"],
    flags: {
      "cyberpunk-remaster": {
        installed: false,
        cyberware: true,
      },
    },
  });
  item.system.containerId = "backpack";
  item.actor = { items: { has: () => true } };
  const changes = { "system.equipped.carryType": "implanted" };

  CyberwareTab.synchronizeCarryChange(item, changes);
  assert.equal(changes["flags.cyberpunk-remaster.installed"], true);
  assert.equal(changes["system.containerId"], null);
  assert.equal(changes["system.equipped.handsHeld"], 0);
  assert.equal(changes["system.equipped.invested"], true);
  assert.deepEqual(changes["flags.cyberpunk-remaster.previousCarryState"], {
    carryType: "stowed",
    handsHeld: 1,
    inSlot: true,
    invested: false,
    containerId: "backpack",
  });
});

test("native carry transition away from implanted clears stale state", () => {
  const item = fakeItem({
    equipped: {
      carryType: "implanted",
      handsHeld: 0,
      inSlot: false,
      invested: true,
    },
    traits: ["invested"],
    flags: {
      "cyberpunk-remaster": {
        installed: true,
        cyberware: true,
        previousCarryState: {
          carryType: "stowed",
          invested: false,
        },
      },
    },
  });
  item.actor = {};
  const changes = { "system.equipped.carryType": "worn" };

  CyberwareTab.synchronizeCarryChange(item, changes);
  assert.equal(changes["system.equipped.carryType"], "worn");
  assert.equal(changes["flags.cyberpunk-remaster.installed"], false);
  assert.equal(changes["flags.cyberpunk-remaster.-=parentId"], null);
  assert.equal(changes["flags.cyberpunk-remaster.-=previousCarryState"], null);
  assert.equal(changes["system.equipped.invested"], false);
});

test("nested subitems receive clean publication, ownership, and stats", () => {
  const parent = {
    _id: "HNUSVHVfSm0KY09F",
    name: "Оружие",
    type: "weapon",
    folder: null,
    img: "icons/svg/item-bag.svg",
    effects: [],
    flags: {},
    ownership: { default: 0, user: 3 },
    _stats: { lastModifiedBy: "user" },
    system: {
      description: { value: "" },
      publication: { title: "", authors: "" },
      traits: { value: [] },
      subitems: [
        {
          _id: "Frhp4iV5ZyhF89Ud",
          name: "Смартлинк",
          type: "equipment",
          folder: "dhVQBgF1EveVFcib",
          flags: {},
          ownership: { default: 0, user: 3 },
          _stats: {
            lastModifiedBy: "user",
            duplicateSource: "Item.old",
          },
          system: {
            description: { value: "" },
            publication: { title: "", authors: "" },
            traits: { value: [] },
            subitems: [],
          },
        },
      ],
    },
  };
  const [result] = transformItems([parent], []);
  const [subitem] = result.system.subitems;
  assert.equal(subitem.folder, null);
  assert.deepEqual(subitem.ownership, { default: 0 });
  assert.equal(subitem._stats.lastModifiedBy, undefined);
  assert.equal(subitem._stats.duplicateSource, undefined);
  assert.equal(subitem._stats.compendiumSource, null);
  assert.equal(subitem.system.publication.title, "SF2E Cyberpunk Remaster");
  assert.equal(subitem.system.publication.authors, "Ogorodnik");
});

test("derived item flags are rebuilt without deleting actor state", () => {
  const source = {
    _id: "abcdefghijklmnop",
    name: "Ordinary equipment",
    type: "equipment",
    folder: null,
    img: "icons/svg/item-bag.svg",
    effects: [],
    flags: {
      "cyberpunk-remaster": {
        schema: 1,
        cyberware: true,
        hardCost: 99,
        stressFormula: "99d6",
        slots: 99,
        pktFamily: "stale-family",
        pktQuality: 3,
        pktComponentQuality: 3,
        pktReplaceable: false,
        pktBiosystem: true,
        installed: true,
        customState: "keep",
      },
    },
    ownership: { default: 0 },
    _stats: {},
    system: {
      description: { value: "" },
      publication: { title: "", authors: "" },
      traits: { value: [] },
      usage: { value: "worn" },
      subitems: [],
    },
  };

  const [first] = transformItems([source], []);
  const flags = first.flags["cyberpunk-remaster"];
  assert.equal(flags.installed, true);
  assert.equal(flags.customState, "keep");
  assert.equal(flags.cyberware, undefined);
  assert.equal(flags.hardCost, undefined);
  assert.equal(flags.stressFormula, undefined);
  assert.equal(flags.slots, undefined);
  assert.equal(flags.pktFamily, undefined);
  assert.equal(flags.pktQuality, undefined);
  assert.equal(flags.pktComponentQuality, undefined);
  assert.equal(flags.pktReplaceable, undefined);
  assert.equal(flags.pktBiosystem, undefined);

  const [second] = transformItems([first], []);
  assert.deepEqual(second, first);
});

test("PKT component catalog derives family and quality idempotently", () => {
  const source = {
    _id: "WZzwXU0ef7Yx8itS",
    name: "Cyber-arm",
    type: "equipment",
    folder: null,
    img: "icons/svg/item-bag.svg",
    effects: [],
    flags: {},
    ownership: { default: 0 },
    _stats: {},
    system: {
      description: { value: "" },
      publication: { title: "", authors: "" },
      traits: { value: [] },
      usage: { value: "implanted" },
      subitems: [],
    },
  };
  const catalog = [
    {
      itemId: "WZzwXU0ef7Yx8itS",
      family: "cyber-arm",
      quality: 0,
    },
  ];

  const [first] = transformItems([source], [], catalog);
  assert.equal(first.flags["cyberpunk-remaster"].pktFamily, "cyber-arm");
  assert.equal(first.flags["cyberpunk-remaster"].pktComponentQuality, 0);
  assert.equal(first.flags["cyberpunk-remaster"].pktReplaceable, true);
  assert.equal(first.flags["cyberpunk-remaster"].pktQuality, undefined);
  const [second] = transformItems([first], [], catalog);
  assert.deepEqual(second, first);
});

test("PKT Biosystem receives its explicit derived flag", () => {
  const source = {
    _id: "CNILbId2Wtv3BJm6",
    name: "Biosystem",
    type: "equipment",
    folder: null,
    img: "icons/svg/item-bag.svg",
    effects: [],
    flags: {},
    ownership: { default: 0 },
    _stats: {},
    system: {
      description: { value: "" },
      publication: { title: "", authors: "" },
      traits: { value: [] },
      usage: { value: "worn" },
      subitems: [],
    },
  };

  const [first] = transformItems([source], []);
  const flags = first.flags["cyberpunk-remaster"];
  assert.equal(flags.cyberware, undefined);
  assert.equal(flags.implantType, undefined);
  assert.equal(flags.pktBiosystem, true);
  assert.equal(CyberwareTab.getImplantType(first), "internal");
  const [second] = transformItems([first], []);
  assert.deepEqual(second, first);
});

test("all six PKT body qualities are recognized", () => {
  const expected = new Map([
    ["uvmhsMeuPT9EsaH8", 0],
    ["tg2eHjiZMoKUxtTR", 1],
    ["tkeQt2AZwYxlo0G4", 2],
    ["Y6CGkTe62Gray49S", 3],
    ["Ozh4qKfrpO3vIyXD", 4],
    ["tVLVycxfLpejAKaO", 5],
  ]);
  for (const [id, quality] of expected) {
    const parsed = parseCyberware(
      fakeItem({
        id,
        name: `Body ${quality}`,
        usage: { value: "worn" },
      }),
    );
    assert.equal(parsed.pktBody, true, id);
    assert.equal(parsed.pktQuality, quality, id);
  }

  const oldActorCopy = fakeItem({
    id: "embedded-body",
    name: "Полная Конверсия Тела [Элитная]",
    flags: {
      "cyberpunk-remaster": {
        pktBody: true,
        pktQuality: 2,
      },
    },
  });
  oldActorCopy._stats = {
    compendiumSource:
      "Compendium.cyberpunk-remaster.cyberpunk-items.Item.Ozh4qKfrpO3vIyXD",
  };
  assert.equal(CyberwareTab.getPktBodyQuality(oldActorCopy), 4);
});

test("PKT journal placeholders are replaced and stale models are cleared", () => {
  const models = JSON.parse(
    readFileSync(new URL("../data/pkt-models.json", import.meta.url), "utf8"),
  );
  const source = {
    _id: "LRV1KlxZGvXDm9ny",
    name: "PKT models",
    folder: null,
    flags: {},
    ownership: { default: 0 },
    _stats: {},
    pages: [
      {
        _id: "ylsMSP9weB5au75z",
        name: "Overview",
        flags: {
          "cyberpunk-remaster": {
            pktModel: { key: "stale" },
          },
        },
        ownership: { default: -1 },
        _stats: {},
        text: { content: "" },
      },
      {
        _id: "HnzffVt4NYaOy28t",
        name: "Hammer",
        flags: {},
        ownership: { default: -1 },
        _stats: {},
        text: {
          content: "<p><em>Тут описание!</em></p><p>Model data.</p>",
        },
      },
    ],
  };

  const [first] = transformJournals([source], models);
  const overview = first.pages.find((page) => page._id === "ylsMSP9weB5au75z");
  const hammer = first.pages.find((page) => page._id === "HnzffVt4NYaOy28t");
  assert.match(overview.text.content, /z1FeeMMP0HblK71h/);
  assert.doesNotMatch(overview.text.content, /<h1\b/i);
  assert.equal(overview.flags["cyberpunk-remaster"]?.pktModel, undefined);
  assert.doesNotMatch(hammer.text.content, /Тут описание!/);

  const [second] = transformJournals([first], models);
  assert.deepEqual(second, first);
});

test("author update delegates an installed-module run to the workspace", async (t) => {
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "cyberpunk-author-update-"),
  );
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));
  const workspace = path.join(temporaryRoot, "workspace");
  const installed = path.join(
    temporaryRoot,
    "Data",
    "modules",
    "cyberpunk-remaster",
  );
  const marker = path.join(temporaryRoot, "delegated.json");
  await Promise.all([
    fs.mkdir(path.join(installed, "scripts", "lib"), { recursive: true }),
    fs.mkdir(workspace, { recursive: true }),
  ]);
  await Promise.all([
    fs.copyFile(
      new URL("../scripts/author-update.mjs", import.meta.url),
      path.join(installed, "scripts", "author-update.mjs"),
    ),
    fs.copyFile(
      new URL("../scripts/lib/author-paths.mjs", import.meta.url),
      path.join(installed, "scripts", "lib", "author-paths.mjs"),
    ),
    fs.writeFile(
      path.join(installed, "module.json"),
      JSON.stringify({ id: "cyberpunk-remaster" }),
    ),
    fs.writeFile(
      path.join(workspace, "module.json"),
      JSON.stringify({ id: "cyberpunk-remaster" }),
    ),
    fs.writeFile(
      path.join(workspace, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        scripts: { "author:update:workspace": "node verify-env.mjs" },
      }),
    ),
    fs.writeFile(
      path.join(workspace, "verify-env.mjs"),
      "import fs from 'node:fs';" +
        `fs.writeFileSync(${JSON.stringify(marker)}, ` +
        "JSON.stringify({cwd:process.cwd(),source:process.env.FOUNDRY_MODULE_PATH}));",
    ),
    fs.writeFile(
      path.join(installed, ".author-paths.local.json"),
      JSON.stringify({
        workspaceRoot: workspace,
        foundryDataRoot: path.join(temporaryRoot, "Data"),
      }),
    ),
  ]);

  const isolatedEnv = { ...process.env };
  for (const variable of [
    "CYBERPUNK_WORKSPACE_PATH",
    "MODULE_WORKSPACE_PATH",
    "FOUNDRY_DATA_PATH",
    "FOUNDRY_APP_PATH",
    "FOUNDRY_MODULE_PATH",
    "SOURCE_MODULE_ROOT",
    "TARGET_MODULE_ROOT",
  ]) {
    delete isolatedEnv[variable];
  }

  await promisify(execFile)(
    process.execPath,
    [path.join(installed, "scripts", "author-update.mjs")],
    { env: isolatedEnv, timeout: 30_000 },
  );
  const delegated = JSON.parse(await fs.readFile(marker, "utf8"));
  assert.equal(path.resolve(delegated.cwd), path.resolve(workspace));
  assert.equal(path.resolve(delegated.source), path.resolve(installed));
});
