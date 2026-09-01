import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCatalog,
  clearCyberpunkCatalog,
  cloneCatalogEntry,
  interfaceKeysForEntries,
  interfaceTraitsHtml,
  pickByLevel,
  selectCyberwareLoadout,
  selectGear,
  selectPrograms,
} from "../forge/catalog.mjs";
import { FORGE_ITEM_TYPES, ITEM_PACK_ID } from "../forge/constants.mjs";
import { valueAt } from "../forge/creature-tables.mjs";
import { formationOffsets } from "../forge/deployment.mjs";
import {
  generateNpc,
  inferPresetFromPrompt,
  previewNpc,
  refreshNpcInterfaceSummary,
} from "../forge/generator.mjs";
import { PRESET_ABILITIES } from "../forge/preset-abilities.mjs";
import {
  CYBERPUNK_PRESETS,
  ROLE_PROFILES,
  normalizeForgeForm,
} from "../forge/presets.mjs";
import { seededRandom } from "../forge/random.mjs";
import {
  FALLBACK_SKILL_SLUGS,
  ammunitionQuantity,
  buildNpcSkillTiers,
  selectNpcDefenses,
  selectNpcLanguages,
} from "../forge/statblock-random.mjs";
import { CyberwareTab } from "../sheets/CyberwareTab.js";

function loadDocuments() {
  const items = JSON.parse(
    readFileSync(new URL("../content/exports/items.json", import.meta.url)),
  );
  const folders = JSON.parse(
    readFileSync(new URL("../data/item-folders.json", import.meta.url)),
  );
  const foldersById = new Map(
    folders.map((folder) => [folder._id, { ...folder }]),
  );
  for (const folder of foldersById.values()) {
    folder.folder = foldersById.get(folder.folder) ?? null;
  }
  return items.map((source) => ({
    ...source,
    id: source._id,
    uuid: `Compendium.${ITEM_PACK_ID}.Item.${source._id}`,
    folder: foldersById.get(source.folder) ?? null,
    toObject() {
      return structuredClone(source);
    },
  }));
}

const documents = loadDocuments();

test("Forge indexes only the module item compendium and preserves its categories", () => {
  const catalog = buildCatalog(documents);
  assert.equal(
    catalog.entries.length,
    documents.filter((document) => FORGE_ITEM_TYPES.has(document.type)).length,
  );
  assert.ok(catalog.weapons.length > 0);
  assert.ok(catalog.armor.length > 0);
  assert.ok(catalog.cyberware.length > 0);
  assert.ok(catalog.quickhacks.length > 0);
  assert.ok(catalog.programs.length > 0);
  assert.ok(
    catalog.programs.some((entry) => entry.traits.has("focus")),
    "В библиотеке должна распознаваться хотя бы одна фокусная программа кибердеки.",
  );
  assert.ok(
    catalog.quickhacks.every((entry) =>
      entry.path.split(" / ").includes("Квикхаки"),
    ),
  );
  assert.ok(
    catalog.entries.every((entry) =>
      entry.uuid.startsWith(`Compendium.${ITEM_PACK_ID}.Item.`),
    ),
  );

  const programs = selectPrograms(
    catalog,
    20,
    seededRandom("no-random-focus-programs"),
    { count: catalog.programs.length + catalog.quickhacks.length },
  );
  assert.ok(programs.length > 0);
  assert.ok(programs.every((entry) => !entry.traits.has("focus")));
});

test("level selection never silently equips an over-level item", () => {
  const result = pickByLevel(
    [
      { id: "too-high", level: 12, unique: false },
      { id: "also-high", level: 14, unique: false },
    ],
    3,
    seededRandom("strict-level"),
  );
  assert.equal(result, null);
});

test("random loadouts avoid duplicate qualities of the same item series", () => {
  const catalog = buildCatalog(documents);
  const gear = selectGear(catalog, 12, seededRandom("gear-series"), {
    count: 10,
    keywords: ["медсканер"],
  });
  assert.ok(gear.length > 0);
  assert.equal(
    gear.filter((entry) => entry.name.startsWith("Медсканер")).length,
    1,
  );

  const chrome = selectCyberwareLoadout(catalog, {
    level: 12,
    random: seededRandom("chrome-series"),
    count: 10,
    families: ["neural", "optics", "audio", "arm", "leg", "internal"],
    moduleChance: 0.65,
  });
  const series = chrome.map((entry) =>
    entry.name
      .toLocaleLowerCase("ru-RU")
      .replace(/\s*\[[^\]]+\]\s*$/u, "")
      .replace(/\s*\/.*$/u, ""),
  );
  assert.equal(new Set(series).size, series.length);
  assert.ok(chrome.every((entry) => entry.level <= 13));
  const exclusiveFamilies = chrome
    .map((entry) => CyberwareTab.getExclusiveFamily(entry.document))
    .filter(Boolean);
  assert.equal(
    new Set(exclusiveFamilies).size,
    exclusiveFamilies.length,
    "Ограниченные семейства имплантов не должны дублироваться.",
  );
  assert.ok(
    chrome.filter((entry) => entry.traits.has("neironn-uskoritell")).length <=
      1,
    "В стандартной сборке допустим только один нейронный ускоритель.",
  );
});

test("generated interface summary reflects installed chrome and tech equipment", () => {
  const catalog = buildCatalog(documents);
  const neural = catalog.cyberware.find(
    (entry) => entry.family === "neural" && entry.implantType === "base",
  );
  const techWeapon = catalog.weapons.find((entry) => entry.traits.has("tech"));
  const techArmor = catalog.armor.find((entry) => entry.traits.has("tech"));
  assert.ok(neural && techWeapon && techArmor);

  const keys = interfaceKeysForEntries([neural, techWeapon, techArmor]);
  assert.deepEqual(keys, ["generic", "neural", "weapon", "armor"]);
  const html = interfaceTraitsHtml(keys);
  assert.match(html, /@Trait\[ustroystvo\]/u);
  assert.match(html, /@Trait\[ustroystvo-neyro\]/u);
  assert.match(html, /@Trait\[ustroystvo-oruzhie\]/u);
  assert.match(html, /@Trait\[ustroystvo-bronya\]/u);
});

test("cloned implants keep compendium mechanics and install without Humanity data", () => {
  const catalog = buildCatalog(documents);
  const entry = catalog.cyberware.find(
    (candidate) =>
      candidate.implantType === "base" &&
      candidate.document.type === "equipment",
  );
  assert.ok(entry);
  const source = cloneCatalogEntry(entry, {
    installed: true,
    loadoutKey: "test-chrome",
  });

  assert.equal(source.flags.core.sourceId, entry.uuid);
  assert.equal(source._stats.compendiumSource, entry.uuid);
  assert.equal(source.flags["cyberpunk-remaster"].installed, true);
  assert.equal(source.system.equipped.carryType, "implanted");
  assert.deepEqual(source.system.rules, entry.document.system.rules);
  assert.equal(source.img, entry.document.img);
  assert.equal(source.flags["cyberpunk-remaster"].humanity, undefined);
});

test("preset previews are reproducible but different seeds vary the loadout", async () => {
  clearCyberpunkCatalog();
  globalThis.game = {
    packs: new Map([
      [
        ITEM_PACK_ID,
        {
          async getDocuments() {
            return documents;
          },
        },
      ],
    ]),
  };
  const form = {
    preset: "corporate-response",
    level: 8,
    randomSeed: "same-seed",
    includePrograms: true,
    includeConsumables: true,
  };
  const first = await previewNpc(form);
  const second = await previewNpc(form);
  assert.deepEqual(second, first);

  const variants = new Set();
  for (let index = 0; index < 12; index += 1) {
    const preview = await previewNpc({
      ...form,
      randomSeed: `variant-${index}`,
    });
    variants.add(
      preview.loadout.map((entry) => `${entry.label}:${entry.value}`).join("|"),
    );
  }
  assert.ok(variants.size >= 4);
});

test("manual combat tiers override the selected role and preview every core value", async () => {
  clearCyberpunkCatalog();
  globalThis.game = {
    packs: new Map([
      [
        ITEM_PACK_ID,
        {
          async getDocuments() {
            return documents;
          },
        },
      ],
    ]),
  };
  const preview = await previewNpc({
    preset: "corporate-response",
    level: 8,
    randomSeed: "manual-stat-tiers",
    tier_ac: "extreme",
    tier_hp: "low",
    tier_attack: "extreme",
    tier_damage: "extreme",
    tier_perception: "terrible",
    tier_dc: "high",
  });
  assert.equal(preview.stats.ac, valueAt("ac", 8, "extreme"));
  assert.equal(preview.stats.hp, valueAt("hp", 8, "low"));
  assert.equal(preview.stats.attack, valueAt("attack", 8, "extreme"));
  assert.equal(preview.stats.damage, valueAt("damage", 8, "extreme"));
  assert.equal(preview.stats.perception, valueAt("perception", 8, "terrible"));
  assert.equal(preview.stats.dc, valueAt("dc", 8, "high"));
  assert.ok(preview.stats.speed >= 15);
  assert.ok(preview.skillCount >= 7);
});

test("contextual statblock randomization adds useful weak skills, languages, defenses, and ammunition", () => {
  const skills = buildNpcSkillTiers({
    roleSkills: { computers: "extreme" },
    presetId: "netrunner",
    availableSkills: FALLBACK_SKILL_SLUGS,
    level: 5,
    random: seededRandom("extra-skills"),
  });
  assert.equal(skills.computers, "extreme");
  assert.ok(Object.keys(skills).length >= 7);
  assert.ok(
    Object.values(skills).some((tier) => ["terrible", "low"].includes(tier)),
  );

  const allowedLanguages = [
    "pact-common",
    "trinary",
    "vercite",
    "aballonian",
    "vesk",
  ];
  const languages = selectNpcLanguages({
    ancestryLanguages: ["pact-common"],
    presetId: "netrunner",
    intelligenceTier: "extreme",
    availableLanguages: allowedLanguages,
    random: seededRandom("languages"),
  });
  assert.ok(languages.length >= 4);
  assert.ok(languages.every((slug) => allowedLanguages.includes(slug)));

  const defenses = selectNpcDefenses({
    presetId: "pkt-operative",
    level: 12,
    cyberwareCount: 12,
    random: seededRandom("pkt-defenses"),
  });
  assert.ok(defenses.immunities.length > 0);
  assert.ok(defenses.resistances.length > 0);

  const bullets = {
    document: { system: { quantity: 10, baseItem: "pistoletnyye-patrony" } },
  };
  const battery = {
    document: { system: { quantity: 1, baseItem: "battery" } },
  };
  assert.equal(ammunitionQuantity(bullets, "standard"), 20);
  assert.equal(ammunitionQuantity(battery, "standard"), 2);
});

test("PKT preset resolves a real journal model and every component from the module pack", async () => {
  const journals = JSON.parse(
    readFileSync(new URL("../content/exports/journals.json", import.meta.url)),
  );
  clearCyberpunkCatalog();
  CyberwareTab.clearPktContentCache();
  globalThis.game = {
    packs: new Map([
      [
        ITEM_PACK_ID,
        {
          async getDocuments() {
            return documents;
          },
          async getIndex() {
            return documents;
          },
          async getDocument(id) {
            return documents.find((entry) => entry.id === id) ?? null;
          },
        },
      ],
      [
        "cyberpunk-remaster.cyberpunk-journals",
        {
          async getDocuments() {
            return journals;
          },
        },
      ],
    ]),
  };

  const preview = await previewNpc({
    preset: "pkt-operative",
    level: 12,
    randomSeed: "pkt-audit",
    chromeIntensity: "heavy",
    includePrograms: true,
    includeConsumables: true,
  });
  const pkt = preview.loadout.find((entry) => entry.label === "ПКТ");
  assert.ok(pkt);
  assert.notEqual(pkt.value, "—");
  assert.match(pkt.value, /компонент/iu);
  assert.match(
    pkt.value,
    /дополнительно:/iu,
    "ПКТ-пресет должен использовать совместимые неуникальные дополнения.",
  );
});

test("created NPC receives installed compendium chrome but no Humanity state", async () => {
  let nextId = 0;
  const setPath = (target, path, value) => {
    const parts = path.split(".");
    const deletion = parts.at(-1).startsWith("-=");
    if (deletion) parts[parts.length - 1] = parts.at(-1).slice(2);
    let object = target;
    for (const part of parts.slice(0, -1)) object = object[part] ??= {};
    if (deletion) delete object[parts.at(-1)];
    else object[parts.at(-1)] = value;
  };
  class FakeItem {
    constructor(source, actor) {
      Object.assign(this, structuredClone(source));
      this.id = this._id ?? `generated-item-${++nextId}`;
      this._id = this.id;
      this.actor = actor;
      this.traits = new Set(this.system?.traits?.value ?? []);
      this.sourceId =
        this.flags?.core?.sourceId ?? this._stats?.compendiumSource ?? null;
    }

    async update(changes) {
      for (const [path, value] of Object.entries(changes)) {
        setPath(this, path, value);
      }
      return this;
    }
  }
  class FakeActor {
    constructor(source) {
      Object.assign(this, structuredClone(source));
      this.id = "generated-actor";
      this.uuid = `Actor.${this.id}`;
      this.items = [];
      this.sheet = { render() {} };
    }

    async createEmbeddedDocuments(_type, sources) {
      // Foundry/SF2E normalizes publication metadata while constructing Items.
      // Generated sources therefore must not contain shared frozen objects.
      for (const source of sources) {
        if (source.system?.publication) {
          source.system.publication.title = String(
            source.system.publication.title ?? "",
          );
        }
      }
      const created = sources.map((source) => new FakeItem(source, this));
      this.items.push(...created);
      return created;
    }

    async updateEmbeddedDocuments(_type, updates) {
      for (const update of updates) {
        const item = this.items.find(
          (candidate) => candidate.id === update._id,
        );
        if (!item) continue;
        for (const [path, value] of Object.entries(update)) {
          if (path !== "_id") setPath(item, path, value);
        }
      }
      return updates;
    }

    async deleteEmbeddedDocuments(_type, ids) {
      this.items = this.items.filter((item) => !ids.includes(item.id));
      return ids;
    }

    async update(changes) {
      for (const [path, value] of Object.entries(changes)) {
        setPath(this, path, value);
      }
      return this;
    }
  }

  clearCyberpunkCatalog();
  globalThis.game = {
    system: { id: "sf2e" },
    user: { isGM: true },
    folders: [],
    packs: new Map([
      [
        ITEM_PACK_ID,
        {
          async getDocuments() {
            return documents;
          },
        },
      ],
    ]),
  };
  globalThis.Folder = {
    async create() {
      return { id: "forge-folder" };
    },
  };
  globalThis.Actor = {
    async create(source) {
      return new FakeActor(source);
    },
  };
  globalThis.fromUuid = async (uuid) =>
    documents.find((entry) => entry.uuid === uuid) ?? null;

  const result = await generateNpc({
    preset: "corporate-patrol",
    level: 8,
    randomSeed: "audit",
    chromeIntensity: "standard",
    includeConsumables: true,
    includePrograms: false,
    openSheet: false,
  });
  const chrome = result.actor.items.filter(
    (item) => item.flags?.["cyberpunk-remaster"]?.forge?.kind === "cyberware",
  );
  assert.ok(chrome.length > 0);
  assert.ok(
    chrome.every(
      (item) =>
        item.flags["cyberpunk-remaster"].installed === true &&
        item.flags["cyberpunk-remaster"].forge.sourceUuid.startsWith(
          `Compendium.${ITEM_PACK_ID}.Item.`,
        ),
    ),
  );
  assert.equal(result.actor.flags?.["cyberpunk-remaster"]?.humanity, undefined);
  assert.match(result.actor.system.details.publicNotes, /@Trait\[ustroystvo/iu);
  assert.equal(result.actor.system.attributes.hp.details, "");
  assert.equal(result.actor.system.details.languages.details, "");
  assert.ok(result.actor.system.details.languages.value.length > 0);
  assert.ok(Object.keys(result.actor.system.skills).length >= 7);
  assert.equal(
    result.actor.items.some(
      (item) =>
        item.flags?.["cyberpunk-remaster"]?.forge?.kind === "skill-panel",
    ),
    false,
  );
  const presetFeature = result.actor.items.find(
    (item) =>
      item.flags?.["cyberpunk-remaster"]?.forge?.kind === "preset-feature",
  );
  assert.ok(presetFeature);
  assert.doesNotMatch(presetFeature.system.description.value, /\{dc\}/u);

  result.actor.system.details.publicNotes += "<p>Авторская заметка.</p>";
  result.actor.items = result.actor.items.filter(
    (item) => item.type !== "armor" && item.type !== "weapon",
  );
  assert.equal(await refreshNpcInterfaceSummary(result.actor), true);
  assert.match(result.actor.system.details.publicNotes, /Авторская заметка/u);
  assert.doesNotMatch(
    result.actor.system.details.publicNotes,
    /@Trait\[ustroystvo-(?:oruzhie|bronya)\]/u,
  );
});

test("all built-in presets reference complete role profiles", () => {
  assert.deepEqual(
    new Set(Object.keys(PRESET_ABILITIES)),
    new Set(Object.keys(CYBERPUNK_PRESETS)),
  );
  for (const preset of Object.values(CYBERPUNK_PRESETS)) {
    assert.ok(preset.roles.length > 0, preset.id);
    assert.ok(preset.weaponProfiles.length > 0, preset.id);
    assert.ok(preset.armorProfiles.length > 0, preset.id);
    for (const role of preset.roles) {
      assert.ok(ROLE_PROFILES[role], `${preset.id}: ${role}`);
    }
  }
  assert.equal(
    inferPresetFromPrompt("корпоративный отряд NetWatch"),
    "corporate-netwatch",
  );
  assert.equal(
    inferPresetFromPrompt("уличный риппер и его охрана"),
    "street-ripperdoc",
  );
  assert.equal(normalizeForgeForm({ level: 999, count: 0 }).level, 20);
  assert.equal(normalizeForgeForm({ level: 999, count: 0 }).count, 1);
  assert.equal(
    normalizeForgeForm({
      preset: "netrunner",
      includePrograms: false,
    }).includePrograms,
    false,
  );
});

test("deployment formations return one unique position per NPC", () => {
  for (const mode of ["cluster", "line", "wedge", "ring"]) {
    const offsets = formationOffsets(9, mode, 2);
    assert.equal(offsets.length, 9);
    assert.equal(
      new Set(offsets.map(({ x, y }) => `${x}:${y}`)).size,
      offsets.length,
      mode,
    );
  }
});
