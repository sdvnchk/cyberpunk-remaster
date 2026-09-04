import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CyberwareTab } from "../sheets/CyberwareTab.js";

function fakeItem({
  id = "item",
  name = "Биоимплант",
  flags = {},
  description = "",
  source = "",
  installed = true,
} = {}) {
  return {
    id,
    _id: id,
    name,
    type: "equipment",
    flags,
    _stats: { compendiumSource: source },
    system: {
      description: { value: description },
      usage: { value: "worn" },
      equipped: { carryType: installed ? "implanted" : "worn", invested: null },
      traits: { value: ["biotech"] },
      quantity: 1,
    },
    getFlag(namespace, key) {
      return this.flags?.[namespace]?.[key];
    },
  };
}

test("2.8.33 Cyberpunk-Bioware items are not Chrome cyberware", () => {
  const bioware = fakeItem({
    flags: {
      "cyberpunk-bio-sf2e": {
        bioware: true,
        installed: true,
        implantType: "module",
        hardCost: 1,
        stressCost: "1d6",
      },
    },
    description:
      "<p>Тип импланта: Модуль</p><p>Hard Cost: 1</p><p>Stress Cost: 1d6</p>",
    source:
      "Compendium.cyberpunk-bio-sf2e.bioware-items.Item.YCeoVBGF7sIlub1I",
  });

  assert.equal(CyberwareTab.isCyberware(bioware), false);
  assert.equal(CyberwareTab.getImplantType(bioware), null);
});

test("2.8.33 Cyberpunk-Bioware compendium source is excluded even if flags are missing", () => {
  const copiedBioware = fakeItem({
    flags: {},
    description:
      "<p>Тип импланта: Внутренний</p><p>Hard Cost: 2</p><p>Stress Cost: 1d6</p>",
    source:
      "Compendium.cyberpunk-bio-sf2e.bioware-items.Item.1UMC8EwoJSMkzuJn",
  });

  assert.equal(CyberwareTab.isCyberware(copiedBioware), false);
  assert.equal(CyberwareTab.getImplantType(copiedBioware), null);
});

test("2.8.33 Bioware does not appear in Chrome lists or consume Chrome capacity", () => {
  const chrome = fakeItem({
    id: "chrome",
    name: "Киберимплант",
    flags: {
      "cyberpunk-remaster": {
        cyberware: true,
        installed: true,
        implantType: "internal",
      },
    },
  });
  const bioware = fakeItem({
    id: "bio",
    flags: {
      "cyberpunk-bio-sf2e": {
        bioware: true,
        installed: true,
        implantType: "internal",
      },
    },
    description:
      "<p>Тип импланта: Внутренний</p><p>Hard Cost: 1</p><p>Stress Cost: 1d6</p>",
  });
  const actor = {
    items: [chrome, bioware],
    flags: {},
    system: { abilities: { wis: { mod: 0 } } },
  };

  const view = CyberwareTab.prepareData(actor);
  assert.deepEqual(view.internals.map((entry) => entry.id), ["chrome"]);
  assert.deepEqual(CyberwareTab.implantCapacity(actor, "internal"), {
    used: 1,
    limit: 7,
    over: false,
  });
});

test("2.8.33 Chrome runtime no longer uses legacy -= deletion keys", () => {
  for (const file of [
    "../sheets/CyberwareTab.js",
    "../runtime/cyberware-runtime.mjs",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /flags\.\$\{[^}]+\}\.-=/u, file);
  }
});

test("2.8.33 native Bioware carry changes are ignored by Chrome synchronization", () => {
  const bioware = fakeItem({
    flags: {
      "cyberpunk-bio-sf2e": {
        bioware: true,
        installed: false,
        implantType: "module",
      },
    },
    installed: false,
  });
  bioware.actor = { items: { has: () => false } };
  const changes = { "system.equipped.carryType": "implanted" };

  CyberwareTab.synchronizeCarryChange(bioware, changes);

  assert.deepEqual(changes, { "system.equipped.carryType": "implanted" });
});

test("2.8.33 V14 flag removals use ForcedDeletion values", () => {
  const previousFoundry = globalThis.foundry;
  class ForcedDeletion {}
  globalThis.foundry = { data: { operators: { ForcedDeletion } } };
  try {
    const item = fakeItem({
      flags: {
        "cyberpunk-remaster": {
          cyberware: true,
          installed: true,
          implantType: "module",
          parentId: "base",
          previousCarryState: { carryType: "worn" },
        },
      },
    });
    const update = CyberwareTab.installationUpdate(item, false);
    assert.ok(
      update["flags.cyberpunk-remaster.parentId"] instanceof ForcedDeletion,
    );
    assert.ok(
      update["flags.cyberpunk-remaster.previousCarryState"] instanceof
        ForcedDeletion,
    );
  } finally {
    globalThis.foundry = previousFoundry;
  }
});
