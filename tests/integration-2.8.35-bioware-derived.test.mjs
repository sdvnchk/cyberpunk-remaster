import assert from "node:assert/strict";
import test from "node:test";
import { CyberwareTab } from "../sheets/CyberwareTab.js";

function itemCollection(items) {
  const list = [...items];
  list.get = (id) => list.find((item) => item.id === id) ?? null;
  return list;
}

function fakeItem({
  id,
  name,
  type = "equipment",
  flags = {},
  source = "",
  description = "",
  publication = {},
  img = "",
  parent = null,
} = {}) {
  return {
    id,
    _id: id,
    name,
    type,
    flags,
    parent,
    actor: parent,
    img,
    _stats: { compendiumSource: source },
    system: {
      description: { value: description },
      publication,
      usage: type === "equipment" ? { value: "worn" } : undefined,
      equipped: type === "equipment" ? { carryType: "worn", invested: null } : undefined,
      traits: { value: [] },
      quantity: 1,
    },
  };
}

test("2.8.35 excludes Bioware-generated activation Actions from Chrome even with stale Remaster metadata", () => {
  const action = fakeItem({
    id: "bio-action",
    name: "Активация: Абляционная термодерма",
    type: "action",
    flags: {
      "cyberpunk-bio-sf2e": {
        bioActivationAction: true,
        sourceItemId: "bio-source",
      },
      "cyberpunk-remaster": {
        cyberware: true,
        implantType: "module",
        hardCost: 3,
      },
    },
    publication: {
      title: "Киберпанк — Биоимпланты",
      authors: "Ogorodnik",
    },
  });

  assert.equal(CyberwareTab.isExternalBioware(action), true);
  assert.equal(CyberwareTab.isCyberware(action), false);
  assert.equal(CyberwareTab.getImplantType(action), null);
});

test("2.8.35 excludes legacy Implant Creator Actions linked to a Bioware source item", () => {
  const source = fakeItem({
    id: "bio-source",
    name: "Абляционная термодерма",
    flags: {
      "cyberpunk-bio-sf2e": {
        bioware: true,
        installed: true,
        implantType: "module",
      },
    },
    source: "Compendium.cyberpunk-bio-sf2e.bioware-items.Item.nBYLg7osin5j9r7b",
    img: "modules/cyberpunk-bio-sf2e/assets/icons/implants/generated-bioware-v2_16_1/17C_bronevoe-dermalnoe-pletenie.webp",
  });
  const action = fakeItem({
    id: "legacy-action",
    name: "Активация: Абляционная термодерма",
    type: "action",
    flags: {
      "cyberpunk-implant-creator": {
        activationAction: true,
        activationSourceItemId: source.id,
      },
      "cyberpunk-remaster": {
        cyberware: true,
        implantType: "module",
        hardCost: 3,
      },
    },
  });
  const actor = { id: "actor", items: itemCollection([source, action]) };
  source.parent = actor;
  source.actor = actor;
  action.parent = actor;
  action.actor = actor;

  assert.equal(CyberwareTab.isExternalBioware(action), true);
  assert.equal(CyberwareTab.isCyberware(action), false);
  assert.equal(CyberwareTab.getImplantType(action), null);
});

test("2.8.35 excludes copied Bioware items using stable module provenance even when the primary flag is lost", () => {
  const copied = fakeItem({
    id: "copied-bio",
    name: "Абляционная термодерма",
    flags: {
      "cyberpunk-remaster": {
        cyberware: true,
        implantType: "module",
        hardCost: 3,
      },
    },
    publication: {
      title: "Киберпанк — Биоимпланты",
      authors: "Ogorodnik",
    },
    img: "modules/cyberpunk-bio-sf2e/assets/icons/implants/generated-bioware-v2_16_1/17C_bronevoe-dermalnoe-pletenie.webp",
  });

  assert.equal(CyberwareTab.isExternalBioware(copied), true);
  assert.equal(CyberwareTab.isCyberware(copied), false);
});

test("2.8.35 Chrome never treats generated Action/Effect documents as physical cyberware", () => {
  for (const type of ["action", "effect"]) {
    const generated = fakeItem({
      id: `generated-${type}`,
      name: type === "action" ? "Активация: Абляционная термодерма" : "Абляционный сброс",
      type,
      flags: {
        "cyberpunk-remaster": {
          cyberware: true,
          installed: false,
          implantType: "module",
          hardCost: 3,
        },
      },
    });

    assert.equal(CyberwareTab.isCyberware(generated), false, type);
    assert.equal(CyberwareTab.getImplantType(generated), null, type);
  }
});
