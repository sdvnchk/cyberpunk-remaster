import { CyberwareTab } from "../sheets/CyberwareTab.js";
import {
  DEVICE_TRAIT_ORDER,
  DEVICE_TRAITS,
  FORGE_FLAG,
  FORGE_ITEM_TYPES,
  FORGE_VERSION,
  ITEM_PACK_ID,
  MODULE_ID,
} from "./constants.mjs";
import { pick } from "./random.mjs";

let catalogCache = null;

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.values === "function") return [...collection.values()];
  return [...collection];
}

function normalize(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/\s+/gu, " ")
    .trim();
}

export function plainText(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&laquo;/gu, "«")
    .replace(/&raquo;/gu, "»")
    .replace(/&mdash;/gu, "—")
    .replace(/&ndash;/gu, "–")
    .replace(/&quot;/gu, '"')
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

export function compendiumFolderPath(document) {
  const names = [];
  const seen = new Set();
  let folder = document?.folder ?? null;
  while (folder && !seen.has(folder.id ?? folder._id ?? folder.name)) {
    seen.add(folder.id ?? folder._id ?? folder.name);
    if (folder.name) names.unshift(folder.name);
    folder = folder.folder ?? folder.parent ?? null;
  }
  return names.join(" / ");
}

function pathContains(path, fragment) {
  return normalize(path).includes(normalize(fragment));
}

function itemLevel(document) {
  const value = Number(document?.system?.level?.value ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function itemRarity(document) {
  return String(document?.system?.traits?.rarity ?? "common");
}

function itemTraits(document) {
  return new Set(
    Array.isArray(document?.system?.traits?.value)
      ? document.system.traits.value.map(String)
      : [],
  );
}

export function cyberwareFamily(
  document,
  path = compendiumFolderPath(document),
) {
  const name = normalize(document?.name);
  const folder = normalize(path);
  const flagged = CyberwareTab.getFlag(document, "pktFamily");
  if (typeof flagged === "string" && flagged) {
    if (flagged.includes("eye")) return "optics";
    if (flagged.includes("audio")) return "audio";
    if (flagged.includes("arm")) return "arm";
    if (flagged.includes("leg")) return "leg";
    if (flagged.includes("neural")) return "neural";
  }
  if (
    folder.includes("кибероптика") ||
    /кибер.?глаз|оптик|кироши/iu.test(name)
  ) {
    return "optics";
  }
  if (
    folder.includes("кибераудио") ||
    /кибер.?ух|аудио|слух|нейро.?аудио/iu.test(name)
  ) {
    return "audio";
  }
  if (folder.includes("киберрука") || /кибер.?рук/iu.test(name)) return "arm";
  if (folder.includes("кибернога") || /кибер.?ног/iu.test(name)) return "leg";
  if (
    folder.includes("нейронные импланты") ||
    /нейролинк|нейроинтерфейс|сопроцессор/iu.test(name)
  ) {
    return "neural";
  }
  if (folder.includes("стилевые импланты")) return "fashion";
  if (folder.includes("внутренние импланты")) return "internal";
  if (folder.includes("внешние импланты")) return "external";
  if (folder.startsWith("пкт")) return "pkt";
  return "other";
}

export function weaponProfiles(
  document,
  path = compendiumFolderPath(document),
) {
  if (document?.type !== "weapon") return [];
  const name = normalize(document.name);
  const traits = itemTraits(document);
  const profiles = new Set(["any"]);
  const ranged = Number(document.system?.range ?? 0) > 0;
  const folder = normalize(path);

  if (ranged) profiles.add("ranged");
  else profiles.add("melee");
  if (folder.includes("метательное") || traits.has("thrown")) {
    profiles.add("thrown");
  }
  if (/снайпер/iu.test(name)) profiles.add("sniper");
  if (/штурмов/iu.test(name)) profiles.add("rifle");
  if (/дробов/iu.test(name)) profiles.add("shotgun");
  if (/пистолет.?пулем|пистолет-пулем/iu.test(name)) profiles.add("smg");
  else if (/пистолет/iu.test(name)) profiles.add("pistol");
  if (/винтовк|карабин/iu.test(name)) profiles.add("rifle");
  if (/пулемет|пулемёт|гранатомет|гранатомёт|ракет|тяжел|тяжёл/iu.test(name)) {
    profiles.add("heavy");
  }
  if (traits.has("concealable")) profiles.add("concealable");
  if (traits.has("nonlethal")) profiles.add("nonlethal");
  if (traits.has("analog")) profiles.add("analog");
  if (traits.has("tech")) profiles.add("tech");
  return [...profiles];
}

export function armorProfile(document, path = compendiumFolderPath(document)) {
  if (document?.type !== "armor") return null;
  if (pathContains(path, "Лёгкие")) return "light";
  if (pathContains(path, "Средняя")) return "medium";
  if (pathContains(path, "Тяжёлые")) return "heavy";
  const category = String(document.system?.category ?? "");
  if (["light", "medium", "heavy"].includes(category)) return category;
  return "light";
}

function itemCategory(document, path) {
  const parts = path.split(" / ");
  const top = parts[0] ?? "";
  if (CyberwareTab.isCyberware(document)) return "cyberware";
  if (top === "Оружие" && document.type === "weapon") return "weapon";
  if (top === "Оружие" && document.type === "ammo") return "ammo";
  if (top === "Броня" && document.type === "armor") return "armor";
  if (document.type === "weapon") return "weapon";
  if (document.type === "ammo") return "ammo";
  if (document.type === "armor") return "armor";
  if (top === "Вещества") return "substance";
  if (top === "Предметы") return "gear";
  if (document.type === "spell") {
    return parts.includes("Квикхаки") ? "quickhack" : "program";
  }
  if (["Оружие", "Броня"].includes(top)) return "other";
  if (
    ["backpack", "consumable", "equipment", "shield", "treasure"].includes(
      document.type,
    )
  ) {
    return "gear";
  }
  return "other";
}

export function catalogEntry(document) {
  const path = compendiumFolderPath(document);
  const category = itemCategory(document, path);
  const implantType =
    category === "cyberware" ? CyberwareTab.getImplantType(document) : null;
  const family =
    category === "cyberware" ? cyberwareFamily(document, path) : null;
  const traits = itemTraits(document);
  return {
    id: document.id,
    uuid: document.uuid ?? `Compendium.${ITEM_PACK_ID}.Item.${document.id}`,
    name: document.name,
    document,
    path,
    category,
    level: itemLevel(document),
    rarity: itemRarity(document),
    traits,
    unique: itemRarity(document) === "unique" || pathContains(path, "Уникальн"),
    cyberware: category === "cyberware",
    implantType,
    family,
    pktOnly: category === "cyberware" && CyberwareTab.isPktOnly(document),
    pktBody: category === "cyberware" && CyberwareTab.isPktBody(document),
    pktBiosystem:
      category === "cyberware" && CyberwareTab.isPktBiosystem(document),
    slots:
      category === "cyberware" && implantType === "base"
        ? CyberwareTab.getSlots(document)
        : 0,
    slotsUsed:
      category === "cyberware" && implantType === "module"
        ? CyberwareTab.getSlotsUsed(document)
        : 0,
    weaponProfiles: weaponProfiles(document, path),
    armorProfile: armorProfile(document, path),
    text: normalize(
      `${document.name} ${path} ${plainText(document.system?.description?.value)}`,
    ),
  };
}

export function buildCatalog(documents) {
  const entries = collectionValues(documents)
    .filter((document) => FORGE_ITEM_TYPES.has(document.type))
    .map(catalogEntry);
  return {
    entries,
    byId: new Map(entries.map((entry) => [entry.id, entry])),
    weapons: entries.filter((entry) => entry.category === "weapon"),
    ammo: entries.filter((entry) => entry.category === "ammo"),
    armor: entries.filter((entry) => entry.category === "armor"),
    gear: entries.filter((entry) =>
      ["gear", "substance"].includes(entry.category),
    ),
    cyberware: entries.filter((entry) => entry.cyberware),
    quickhacks: entries.filter((entry) => entry.category === "quickhack"),
    programs: entries.filter((entry) => entry.category === "program"),
  };
}

export async function loadCyberpunkCatalog({ refresh = false } = {}) {
  if (catalogCache && !refresh) return catalogCache;
  const pack = globalThis.game?.packs?.get?.(ITEM_PACK_ID);
  if (!pack) {
    throw new Error(
      `Не найден собственный компендиум ${ITEM_PACK_ID}. Проверьте, что SF2E Cyberpunk Remaster активен.`,
    );
  }
  const documents = await pack.getDocuments();
  catalogCache = buildCatalog(documents);
  return catalogCache;
}

export function clearCyberpunkCatalog() {
  catalogCache = null;
}

function acceptableLevel(entry, level, allowance = 1) {
  return entry.level <= Math.max(0, level + allowance);
}

function rarityAllowed(entry, allowUnique) {
  return allowUnique || !entry.unique;
}

export function pickByLevel(
  entries,
  level,
  random = Math.random,
  { allowUnique = false, allowance = 1, fallback = false } = {},
) {
  const rarityPool = entries.filter((entry) =>
    rarityAllowed(entry, allowUnique),
  );
  const levelPool = rarityPool.filter((entry) =>
    acceptableLevel(entry, level, allowance),
  );
  const pool = levelPool.length ? levelPool : fallback ? rarityPool : [];
  if (!pool.length) return null;

  const weighted = pool.flatMap((entry) => {
    const distance = Math.abs(level - entry.level);
    const weight = Math.max(1, 6 - Math.min(5, distance));
    return Array.from({ length: weight }, () => entry);
  });
  return pick(weighted, random);
}

export function selectWeapon(catalog, profiles, level, random, options = {}) {
  const requested = new Set(profiles?.length ? profiles : ["any"]);
  let candidates = catalog.weapons.filter((entry) =>
    entry.weaponProfiles.some((profile) => requested.has(profile)),
  );
  if (!candidates.length) candidates = catalog.weapons;
  return pickByLevel(candidates, level, random, options);
}

export function selectArmor(catalog, profiles, level, random, options = {}) {
  const requested = new Set(profiles?.length ? profiles : ["light"]);
  if (requested.has("none")) {
    const nonNone = [...requested].filter((value) => value !== "none");
    if (!nonNone.length || random() < 0.35) return null;
    requested.delete("none");
  }
  let candidates = catalog.armor.filter((entry) =>
    requested.has(entry.armorProfile),
  );
  if (!candidates.length) candidates = catalog.armor;
  return pickByLevel(candidates, level, random, options);
}

export function compatibleAmmo(catalog, weapon, level, random) {
  const ammoBase = weapon?.document?.system?.ammo?.baseType;
  if (!ammoBase) return null;
  const candidates = catalog.ammo.filter(
    (entry) => entry.document.system?.baseItem === ammoBase,
  );
  return pickByLevel(candidates, level, random, { allowance: 2 });
}

export function selectGear(
  catalog,
  level,
  random,
  { count = 1, keywords = [], allowUnique = false } = {},
) {
  const normalizedKeywords = keywords.map(normalize).filter(Boolean);
  let candidates = catalog.gear.filter(
    (entry) =>
      rarityAllowed(entry, allowUnique) &&
      (!normalizedKeywords.length ||
        normalizedKeywords.some((keyword) => entry.text.includes(keyword))),
  );
  if (!candidates.length) candidates = catalog.gear;
  const selected = [];
  const usedSeries = new Set();
  while (selected.length < count) {
    const available = candidates.filter(
      (entry) => !usedSeries.has(itemSeries(entry)),
    );
    const entry = pickByLevel(available, level, random, { allowUnique });
    if (!entry) break;
    selected.push(entry);
    usedSeries.add(itemSeries(entry));
  }
  return selected;
}

function moduleMatchesBase(module, base) {
  if (module.implantType !== "module" || base.implantType !== "base") {
    return false;
  }
  if (module.family === base.family) return true;
  const familyPatterns = {
    optics: /кибер.?глаз|оптик/iu,
    audio: /кибер.?аудио|кибер.?ух|аудио/iu,
    arm: /кибер.?рук/iu,
    leg: /кибер.?ног/iu,
    neural: /нейролинк|нейроинтерфейс/iu,
  };
  const pattern = familyPatterns[base.family];
  return pattern ? pattern.test(module.text) : false;
}

function familyCandidates(catalog, families, type) {
  const requested = new Set(families ?? []);
  return catalog.cyberware.filter((entry) => {
    if (entry.pktOnly || entry.pktBody || entry.pktBiosystem) return false;
    if (entry.implantType !== type) return false;
    if (!requested.size) return true;
    return (
      requested.has(entry.family) ||
      requested.has("other") ||
      (requested.has("internal") && entry.implantType === "internal") ||
      (requested.has("external") && entry.implantType === "external")
    );
  });
}

export function itemSeries(entry) {
  return normalize(entry?.name)
    .replace(/\s*\[[^\]]+\]\s*$/u, "")
    .replace(/\s*\/.*$/u, "")
    .trim();
}

export function selectCyberwareLoadout(
  catalog,
  {
    level,
    random,
    count,
    families = [],
    moduleChance = 0.35,
    allowUnique = false,
  },
) {
  const selected = [];
  const usedSources = new Set();
  const usedSeries = new Set();
  const usedExclusiveFamilies = new Set();
  let hasNeuralAccelerator = false;
  const respectsInstallationLimits = (entry) => {
    const exclusiveFamily = CyberwareTab.getExclusiveFamily(entry.document);
    const allowsMultipleDecks =
      exclusiveFamily === "cyberdeck" &&
      CyberwareTab.getRuleSetting("allowMultipleCyberdecks") === true;
    if (
      exclusiveFamily &&
      !allowsMultipleDecks &&
      usedExclusiveFamilies.has(exclusiveFamily)
    ) {
      return false;
    }
    return !(
      entry.traits.has("neironn-uskoritell") &&
      hasNeuralAccelerator &&
      CyberwareTab.getRuleSetting("allowMultipleNeuralAccelerators") !== true
    );
  };
  const rememberInstallationLimits = (entry) => {
    const exclusiveFamily = CyberwareTab.getExclusiveFamily(entry.document);
    if (exclusiveFamily) usedExclusiveFamilies.add(exclusiveFamily);
    if (entry.traits.has("neironn-uskoritell")) hasNeuralAccelerator = true;
  };
  const bases = familyCandidates(catalog, families, "base");
  const standalone = catalog.cyberware.filter(
    (entry) =>
      !entry.pktOnly &&
      !entry.pktBody &&
      !entry.pktBiosystem &&
      ["internal", "external", "fashion"].includes(entry.implantType) &&
      (!families.length ||
        families.includes(entry.family) ||
        families.includes(entry.implantType)),
  );

  while (selected.length < count) {
    const wantsBase =
      bases.length > 0 &&
      (selected.every((entry) => entry.implantType !== "base") ||
        random() < moduleChance);
    const sourcePool = wantsBase ? bases : standalone;
    const available = sourcePool.filter(
      (entry) =>
        !usedSources.has(entry.id) &&
        !usedSeries.has(itemSeries(entry)) &&
        respectsInstallationLimits(entry) &&
        rarityAllowed(entry, allowUnique),
    );
    const chosen = pickByLevel(available, level, random, { allowUnique });
    if (!chosen) break;
    selected.push(chosen);
    usedSources.add(chosen.id);
    usedSeries.add(itemSeries(chosen));
    rememberInstallationLimits(chosen);

    if (
      chosen.implantType === "base" &&
      selected.length < count &&
      random() < moduleChance
    ) {
      let freeSlots = Math.max(0, chosen.slots);
      const modules = catalog.cyberware.filter(
        (entry) =>
          !entry.pktOnly &&
          !usedSources.has(entry.id) &&
          !usedSeries.has(itemSeries(entry)) &&
          respectsInstallationLimits(entry) &&
          moduleMatchesBase(entry, chosen) &&
          entry.slotsUsed <= freeSlots &&
          rarityAllowed(entry, allowUnique),
      );
      const module = pickByLevel(modules, level, random, { allowUnique });
      if (module) {
        selected.push({ ...module, parentSourceId: chosen.id });
        usedSources.add(module.id);
        usedSeries.add(itemSeries(module));
        rememberInstallationLimits(module);
        freeSlots -= module.slotsUsed;
      }
    }
  }
  return selected.slice(0, count);
}

export function selectPrograms(catalog, level, random, { count = 4 } = {}) {
  const maximumRank = Math.max(1, Math.min(10, Math.ceil(level / 2)));
  const available = [...catalog.quickhacks, ...catalog.programs].filter(
    (entry) => entry.level <= maximumRank && !entry.traits.has("focus"),
  );
  const result = [];
  const used = new Set();
  while (result.length < count) {
    const candidates = available.filter((entry) => !used.has(entry.id));
    const chosen = pickByLevel(candidates, maximumRank, random, {
      allowance: 0,
    });
    if (!chosen) break;
    result.push(chosen);
    used.add(chosen.id);
  }
  return result;
}

export function interfaceKeysForEntries(entries) {
  const keys = new Set();
  for (const entry of entries) {
    if (entry?.cyberware) keys.add("generic");
    if (entry?.family === "neural") keys.add("neural");
    if (entry?.family === "optics") keys.add("optics");
    if (entry?.family === "audio") keys.add("audio");
    if (entry?.family === "arm") keys.add("arm");
    if (entry?.family === "leg") keys.add("leg");
    if (
      entry?.category === "weapon" &&
      (entry.traits?.has?.("tech") ||
        /смартлинк|smartlink/iu.test(entry?.name ?? ""))
    ) {
      keys.add("generic");
      keys.add("weapon");
    }
    if (
      entry?.category === "armor" &&
      (entry.traits?.has?.("tech") ||
        /металлгир|talos|бравада/iu.test(entry.name))
    ) {
      keys.add("generic");
      keys.add("armor");
    }
  }
  return DEVICE_TRAIT_ORDER.filter((key) => keys.has(key));
}

export function interfaceTraitsHtml(keys) {
  if (!keys?.length) {
    return '<p class="cyberpunk-forge-interface-tags"><strong>Интерфейсы:</strong> отсутствуют.</p>';
  }
  const links = keys
    .map((key) => DEVICE_TRAITS[key])
    .filter(Boolean)
    .map((trait) => `@Trait[${trait.slug}]{${trait.label}}`)
    .join(" ");
  return `<p class="cyberpunk-forge-interface-tags"><strong>Интерфейсы:</strong> ${links}</p>`;
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function setPath(target, path, value) {
  const parts = path.split(".");
  let current = target;
  for (const part of parts.slice(0, -1)) current = current[part] ??= {};
  current[parts.at(-1)] = value;
}

export function cloneCatalogEntry(
  entry,
  {
    loadoutKey,
    kind = entry.category,
    installed = false,
    parentSourceId = null,
    quantity = 1,
  } = {},
) {
  const source = clone(entry.document.toObject());
  delete source._id;
  delete source.folder;
  delete source.ownership;
  delete source.sort;
  delete source._stats;
  source._stats = { compendiumSource: entry.uuid };
  source.flags ??= {};
  delete source.flags.babele;
  source.flags.core ??= {};
  source.flags.core.sourceId = entry.uuid;
  source.flags[MODULE_ID] ??= {};
  Object.assign(source.flags[MODULE_ID], {
    [FORGE_FLAG]: {
      generated: true,
      version: FORGE_VERSION,
      sourceId: entry.id,
      sourceUuid: entry.uuid,
      loadoutKey,
      kind,
      parentSourceId,
    },
  });
  if (
    Number.isFinite(Number(quantity)) &&
    "quantity" in (source.system ?? {})
  ) {
    source.system.quantity = Math.max(1, Math.trunc(Number(quantity)));
  }
  if (installed && entry.cyberware) {
    const installation = CyberwareTab.preCreateInstallationSource(
      entry.document,
    );
    for (const [path, value] of Object.entries(installation)) {
      setPath(source, path, value);
    }
  }
  if (source.type === "armor") {
    setPath(source, "system.equipped.carryType", "worn");
    setPath(source, "system.equipped.inSlot", true);
  } else if (source.type === "weapon") {
    setPath(source, "system.equipped.carryType", "held");
    setPath(
      source,
      "system.equipped.handsHeld",
      String(source.system?.usage?.value ?? "").includes("two-hand") ? 2 : 1,
    );
  }
  return source;
}

export function forgeFlag(item) {
  return CyberwareTab.getFlag(item, FORGE_FLAG);
}
