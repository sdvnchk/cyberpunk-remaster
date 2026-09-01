import { CyberwareTab } from "../sheets/CyberwareTab.js";
import {
  DEVICE_TRAIT_ORDER,
  DEVICE_TRAITS,
  FORGE_FLAG,
  FORGE_ITEM_TYPES,
  FORGE_VERSION,
  ITEM_PACK_ID,
  ITEM_PACK_IDS,
  MODULE_ID,
  REMASTER_MODULE_ID,
} from "./constants.mjs";
import { pick } from "./random.mjs";

const catalogCache = new Map();

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

export function catalogNameKeys(value) {
  const normalized = String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[«»„“”"']/gu, "")
    .replace(/[‐‑‒–—]/gu, "-")
    .replace(/\s*:\s*/gu, ":")
    .replace(/\s+/gu, " ")
    .trim();
  if (!normalized) return [];

  // CPEL and Remaster have gone through several naming migrations. PKT
  // journals can therefore refer to the same component as either
  // “ПКТ: Foo” or “Foo ПКТ”. Keep both shapes as aliases without fuzzy
  // substring matching, which could otherwise merge unrelated upgrades.
  const keys = new Set([normalized]);
  const withoutPrefix = normalized.replace(/^пкт\s*:\s*/u, "").trim();
  const withoutSuffix = normalized.replace(/\s+пкт$/u, "").trim();
  if (withoutPrefix) keys.add(withoutPrefix);
  if (withoutSuffix) keys.add(withoutSuffix);
  const withoutBoth = withoutPrefix.replace(/\s+пкт$/u, "").trim();
  if (withoutBoth) keys.add(withoutBoth);
  return [...keys];
}

function sourceModuleForDocument(_document) {
  return MODULE_ID;
}

function normalizeSources(_sources = {}) {
  return new Set([MODULE_ID]);
}

function sourceCacheKey(_sources) {
  return MODULE_ID;
}

function packSource(pack) {
  const collection = String(pack?.collection ?? pack?.metadata?.id ?? pack?.metadata?.name ?? "");
  const packageName = String(pack?.metadata?.packageName ?? pack?.metadata?.package ?? collection.split(".")[0] ?? "");
  if (packageName === MODULE_ID || collection.startsWith(`${MODULE_ID}.`)) return MODULE_ID;
  return null;
}

function itemDedupeKey(entry) {
  return [entry.document?.type ?? "", normalize(entry.name), entry.category, entry.level].join("|");
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
  const sourceModule = sourceModuleForDocument(document);
  return {
    id: document.id,
    sourceModule,
    sourceLabel: "Cyberpunk Remaster",
    uuid: document.uuid ?? `Compendium.${document.pack ?? ITEM_PACK_ID}.Item.${document.id}`,
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
  const rawEntries = collectionValues(documents)
    .filter((document) => FORGE_ITEM_TYPES.has(document.type))
    .map(catalogEntry)
    .sort((left, right) => {
      const l = left.sourceModule === MODULE_ID ? 0 : 1;
      const r = right.sourceModule === MODULE_ID ? 0 : 1;
      return l - r;
    });

  // Dedupe equivalent entries inside Remaster while preserving stable lookup aliases.
  const deduped = new Map();
  const canonicalForRaw = new Map();
  for (const entry of rawEntries) {
    const key = itemDedupeKey(entry);
    if (!deduped.has(key)) deduped.set(key, entry);
    canonicalForRaw.set(entry, deduped.get(key));
  }
  const entries = [...deduped.values()];

  const byId = new Map();
  const byUuid = new Map();
  const byAnyId = new Map();
  const byNameKey = new Map();
  for (const entry of entries) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
    byUuid.set(entry.uuid, entry);
  }
  // Preserve IDs and names of duplicate copies that were removed above.
  // This is essential when a PKT model journal comes from Remaster but the
  // canonical generated item is the equivalent CPEL document (or vice versa).
  // The old code threw the duplicate ID away, so valid mixed-source models
  // were incorrectly labelled “[неполная библиотека]”.
  for (const rawEntry of rawEntries) {
    const canonical = canonicalForRaw.get(rawEntry) ?? rawEntry;
    if (rawEntry.id && !byAnyId.has(rawEntry.id)) byAnyId.set(rawEntry.id, canonical);
    if (rawEntry.uuid && !byUuid.has(rawEntry.uuid)) byUuid.set(rawEntry.uuid, canonical);
    for (const key of catalogNameKeys(rawEntry.name)) {
      const matches = byNameKey.get(key) ?? [];
      if (!matches.includes(canonical)) matches.push(canonical);
      byNameKey.set(key, matches);
    }
  }
  for (const entry of entries) {
    if (entry.id && !byAnyId.has(entry.id)) byAnyId.set(entry.id, entry);
    for (const key of catalogNameKeys(entry.name)) {
      const matches = byNameKey.get(key) ?? [];
      if (!matches.includes(entry)) matches.push(entry);
      byNameKey.set(key, matches);
    }
  }
  const sourceStats = {
    cpel: 0,
    remaster: rawEntries.length,
  };
  return {
    entries,
    byId,
    byUuid,
    byAnyId,
    byNameKey,
    sourceStats,
    weapons: entries.filter((entry) => entry.category === "weapon"),
    ammo: entries.filter((entry) => entry.category === "ammo"),
    armor: entries.filter((entry) => entry.category === "armor"),
    gear: entries.filter((entry) => ["gear", "substance"].includes(entry.category)),
    cyberware: entries.filter((entry) => entry.cyberware),
    quickhacks: entries.filter((entry) => entry.category === "quickhack"),
    programs: entries.filter((entry) => entry.category === "program"),
  };
}

export function catalogResolveEntry(catalog, itemId, name = "") {
  const rawId = String(itemId ?? "");
  if (rawId) {
    const parsedId = rawId.match(/(?:^|\.Item\.)([A-Za-z0-9]{16})$/u)?.[1] ?? rawId;
    const direct = catalog?.byId?.get?.(parsedId) ?? catalog?.byAnyId?.get?.(parsedId);
    if (direct) return direct;
    const uuid = catalog?.byUuid?.get?.(rawId);
    if (uuid) return uuid;
  }

  for (const key of catalogNameKeys(name)) {
    const matches = catalog?.byNameKey?.get?.(key) ?? [];
    if (matches.length) {
      // buildCatalog keeps the first canonical Remaster entry deterministically.
      return matches[0];
    }
  }
  return null;
}

export async function loadCyberpunkCatalog({ refresh = false, sources = {} } = {}) {
  const cacheKey = sourceCacheKey(sources);
  if (refresh) catalogCache.delete(cacheKey);
  if (catalogCache.has(cacheKey)) return catalogCache.get(cacheKey);

  const enabled = normalizeSources(sources);
  const allPacks = collectionValues(globalThis.game?.packs);
  const discovered = allPacks.filter((pack) => {
    const documentName = pack?.documentName ?? pack?.metadata?.type;
    const source = packSource(pack);
    return source && enabled.has(source) && documentName === "Item";
  });

  // Preserve the canonical Remaster item pack first, then any additional Remaster Item packs discovered dynamically.
  const configured = enabled.has(MODULE_ID)
    ? ITEM_PACK_IDS.map((packId) => globalThis.game?.packs?.get?.(packId)).filter(Boolean)
    : [];
  const packs = [...new Map([...configured, ...discovered].map((pack) => [
    pack.collection ?? pack.metadata?.id ?? pack.metadata?.name,
    pack,
  ])).values()].sort((left, right) => {
    const ls = packSource(left) === MODULE_ID ? 0 : 1;
    const rs = packSource(right) === MODULE_ID ? 0 : 1;
    return ls - rs;
  });

  if (!packs.length) {
    throw new Error("Не найдены Item-компендиумы Cyberpunk Remaster.");
  }
  const groups = await Promise.all(packs.map((pack) => pack.getDocuments()));
  const catalog = buildCatalog(groups.flat());
  catalog.packIds = packs.map((pack) => pack.collection ?? pack.metadata?.id ?? pack.metadata?.name).filter(Boolean);
  catalog.sources = { cpel: false, remaster: true };
  catalog.sourceWarnings = [];
  if (!packs.some((pack) => packSource(pack) === MODULE_ID)) {
    catalog.sourceWarnings.push("Item-компендиумы Cyberpunk Remaster не найдены.");
  }
  catalogCache.set(cacheKey, catalog);
  return catalog;
}

export function clearCyberpunkCatalog() {
  catalogCache.clear();
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

const ROLE_WEAPON_FLAVOR = Object.freeze({
  assault: ["штурм", "автомат", "винтов", "карабин", "smg", "пистолет-пулем", "тактич"],
  defender: ["дробов", "карабин", "пистолет", "несмерт", "шок", "тяжел", "тяжёл"],
  heavy: ["пулем", "ракет", "гранатом", "тяжел", "тяжёл", "автопуш", "heavy"],
  sniper: ["снайпер", "точн", "винтов", "marksman", "precision", "дальн"],
  skirmisher: ["пистолет", "smg", "пистолет-пулем", "карабин", "нож", "меч", "легк"],
  infiltrator: ["пистолет", "скрыт", "conceal", "глуш", "нож", "моно", "компакт"],
  netrunner: ["пистолет", "smg", "компакт", "smart", "умн", "tech", "электр"],
  technician: ["пистолет", "дробов", "tech", "тех", "электр", "инструмент"],
  medic: ["пистолет", "несмерт", "шок", "компакт", "защит"],
  leader: ["пистолет", "карабин", "служеб", "тактич", "умн"],
  merchant: ["пистолет", "компакт", "скрыт", "несмерт"],
  forensic: ["пистолет", "служеб", "несмерт", "шок"],
  demolitions: ["гранатом", "взрыв", "дробов", "пистолет", "tech"],
  droneOperator: ["пистолет", "карабин", "smart", "умн", "tech"],
  driver: ["пистолет", "smg", "компакт", "карабин"],
  laborer: ["дробов", "дубин", "молот", "пистолет", "инструмент"],
  service: ["пистолет", "компакт", "несмерт"],
  clerk: ["пистолет", "компакт", "несмерт"],
  civilian: ["пистолет", "дубин", "шок", "несмерт", "компакт"],
  cyberpsycho: ["тяжел", "тяжёл", "пулем", "дробов", "клин", "моно", "ракет"],
  pkt: ["тяжел", "тяжёл", "штурм", "пулем", "ракет", "гранатом", "tech"],
});

const GROUP_WEAPON_FLAVOR = Object.freeze({
  law: ["служеб", "несмерт", "шок", "тактич", "пистолет", "карабин", "дробов", "полиц"],
  corporate: ["серийн", "тактич", "smart", "умн", "корпорат", "штурм", "пистолет"],
  street: ["улич", "самодел", "кустар", "дешев", "пистолет", "дробов", "нож", "smg"],
  civilian: ["компакт", "несмерт", "пистолет", "дубин", "шок"],
  specialist: ["точн", "служеб", "tech", "умн", "пистолет", "карабин"],
});

const ROLE_ARMOR_FLAVOR = Object.freeze({
  assault: ["armorjack", "брон", "тактич", "боев", "kevlar"],
  defender: ["тяжел", "тяжёл", "metal", "flak", "брон", "защит"],
  heavy: ["тяжел", "тяжёл", "metal", "flak", "брон"],
  sniper: ["легк", "маскир", "скрыт", "kevlar", "тактич"],
  skirmisher: ["легк", "гибк", "armorjack", "kevlar"],
  infiltrator: ["скрыт", "маскир", "делов", "легк", "kevlar", "костюм"],
  netrunner: ["легк", "сет", "bodyweight", "костюм", "kevlar"],
  technician: ["рабоч", "защит", "легк", "костюм", "kevlar"],
  medic: ["мед", "легк", "защит", "костюм", "kevlar"],
  leader: ["делов", "executive", "тактич", "брон", "костюм"],
  merchant: ["делов", "executive", "костюм", "легк"],
  forensic: ["служеб", "легк", "защит", "kevlar"],
  demolitions: ["flak", "взрыв", "тяжел", "тяжёл", "защит"],
  droneOperator: ["легк", "тактич", "костюм", "kevlar"],
  driver: ["легк", "куртк", "kevlar", "тактич"],
  laborer: ["рабоч", "защит", "куртк", "kevlar"],
  service: ["одеж", "костюм", "легк"],
  clerk: ["делов", "костюм", "одеж"],
  civilian: ["одеж", "костюм", "легк", "kevlar"],
  cyberpsycho: ["тяжел", "тяжёл", "metal", "flak", "брон"],
  pkt: ["тяжел", "тяжёл", "metal", "брон", "тактич"],
});

const GROUP_GEAR_FLAVOR = Object.freeze({
  law: ["наруч", "жетон", "раци", "коммуник", "фонар", "аптеч", "скан", "детектор", "камера", "служеб"],
  corporate: ["агент", "коммуник", "скан", "аптеч", "делов", "контракт", "идентиф", "маяч"],
  street: ["отмыч", "трос", "фонар", "агент", "буст", "улич", "ремонт", "аптеч"],
  civilian: ["агент", "коммуник", "гигиен", "фляг", "поход", "инструмент", "рабоч"],
  specialist: ["скан", "анализ", "инструмент", "набор", "аптеч", "детектор", "коммуник"],
});

const NARRATIVE_HARD_REJECT = Object.freeze({
  law: /чёрн(?:ое|ый) кружев|black lace|берсерк|киберпсих|позер.?чип|животн|зверин|боевой хвост/iu,
  corporate: /киберпсих|боевой хвост|кустарн.{0,16}наркот|позер.?чип/iu,
  civilian: /пулем|ракет|гранатом|берсерк|киберпсих|боевой хвост|штурмов.{0,12}брон/iu,
});

const GROUP_AMMO_FLAVOR = Object.freeze({
  law: ["резинов", "несмерт", "nonlethal", "базов", "basic", "бронебойн", "armor-piercing"],
  corporate: ["умн", "smart", "бронебойн", "armor-piercing", "проникающ", "penetrat", "базов", "basic"],
  street: ["дешев", "cheap", "базов", "basic", "трасс", "tracer", "разрыв", "explosive"],
  civilian: ["резинов", "несмерт", "nonlethal", "базов", "basic"],
  specialist: ["умн", "smart", "бронебойн", "armor-piercing", "проникающ", "penetrat", "базов", "basic"],
});

const ROLE_AMMO_FLAVOR = Object.freeze({
  assault: ["бронебойн", "armor-piercing", "проникающ", "penetrat", "трасс", "tracer"],
  defender: ["резинов", "nonlethal", "бронебойн", "armor-piercing", "базов", "basic"],
  heavy: ["разрыв", "explosive", "зажигат", "incendiary", "бронебойн", "armor-piercing"],
  sniper: ["бронебойн", "armor-piercing", "проникающ", "penetrat", "умн", "smart"],
  skirmisher: ["трасс", "tracer", "умн", "smart", "базов", "basic"],
  infiltrator: ["умн", "smart", "базов", "basic"],
  netrunner: ["умн", "smart", "электр", "shock", "базов", "basic"],
  technician: ["умн", "smart", "разрыв", "explosive", "базов", "basic"],
  medic: ["резинов", "nonlethal", "несмерт", "базов", "basic"],
  leader: ["умн", "smart", "базов", "basic"],
  cyberpsycho: ["разрыв", "explosive", "бронебойн", "armor-piercing", "зажигат", "incendiary"],
  pkt: ["бронебойн", "armor-piercing", "разрыв", "explosive", "умн", "smart"],
});

// Lore-driven loadout signatures. They are strong preferences, not hard
// whitelists: role, level, weapon profile and compatibility still win when a
// canonical faction item is unavailable in the selected libraries.
const FACTION_LOADOUT_PROFILES = Object.freeze([
  {
    test: /danger gal/iu,
    weaponPrimary: ["hello cutie", "sanroo", "microcutie", "fisher kitty", "hidden cougar", "happy dancer", "1truluv", "gun-gun friend-friend", "my friend the ocelot", "janus hex", "modball gun", "hypurr-hammer", "thundercat bat"],
    weaponSecondary: ["concealable", "скрыт", "nonlethal", "несмерт", "пистолет", "smg"],
    ammoPrimary: ["modball", "scent ball", "dazzle", "ouchie", "slippy", "splashie"],
    ammoSecondary: ["умн", "smart", "резинов", "nonlethal", "базов", "basic"],
    armorPrimary: ["danger gal", "light armorjack", "kevlar"],
    armorSecondary: ["тактич", "tactical", "легк"],
    gearPrimary: ["danger gal", "agent", "carryall", "computer", "bug detector", "audio recorder", "memory chip", "braindance", "smart lens"],
    gearSecondary: ["коммуник", "скан", "камера", "аптеч"],
  },
  {
    test: /max-?tac|maxtac/iu,
    weaponPrimary: ["militech", "lexington", "omaha", "ajax", "achilles", "crusher", "defender", "ashura", "cyclone", "gyro", "hurricane", "super chief"],
    weaponSecondary: ["heavy", "тяжел", "тяжёл", "sniper", "снайпер", "shotgun", "дробов"],
    ammoPrimary: ["бронебойн", "armor-piercing", "проникающ", "penetrat", "разрыв", "explosive"],
    ammoSecondary: ["умн", "smart", "базов", "basic"],
    armorPrimary: ["max-tac", "maxtac", "full metal", "metal gear", "тяжел", "тяжёл", "flak"],
    armorSecondary: ["тактич", "tactical", "брон"],
    gearPrimary: ["тактич", "tactical", "коммуник", "скан", "детектор", "аптеч", "наруч"],
    weaponReject: /\bemp\b|\bэмп\b/iu,
    ammoReject: /\bemp\b|\bэмп\b/iu,
  },
  {
    test: /\bncpd\b/iu,
    weaponPrimary: ["m-10af lexington", "saratoga", "ajax", "m2038 tactician", "defender", "copperhead"],
    weaponSecondary: ["militech", "служеб", "nonlethal", "несмерт", "stun", "шок", "taser", "пистолет", "shotgun", "дробов"],
    ammoPrimary: ["резинов", "rubber", "несмерт", "nonlethal", "базов", "basic"],
    ammoSecondary: ["бронебойн", "armor-piercing"],
    armorPrimary: ["ncpd", "police", "полиц", "riot", "armorjack"],
    armorSecondary: ["тактич", "tactical", "бронежилет", "kevlar"],
    gearPrimary: ["наруч", "handcuff", "radio", "раци", "коммуник", "фонар", "flashlight", "badge", "жетон", "bodycam", "камера", "аптеч"],
    gearSecondary: ["скан", "детектор", "идентиф"],
  },
  {
    test: /trauma team/iu,
    weaponPrimary: ["trauma team"],
    weaponSecondary: ["пистолет", "smg", "винтов", "rifle", "nonlethal", "несмерт", "служеб"],
    ammoPrimary: ["базов", "basic", "резинов", "rubber", "nonlethal", "несмерт"],
    armorPrimary: ["trauma team", "medical", "мед", "armorjack"],
    armorSecondary: ["тактич", "tactical", "защит"],
    gearPrimary: ["trauma team", "medtech", "medscan", "медскан", "аптеч", "first aid", "гипоспрей", "hypo", "derma", "стабилиз", "носил", "oxygen", "дых"],
    gearSecondary: ["коммуник", "скан", "carryall"],
  },
  {
    test: /\barasaka\b/iu,
    weaponPrimary: ["arasaka", "setsuko-arasaka", "barrett-arasaka", "masamune", "minami", "susano", "dahiyari", "hiyari", "kajiya", "waa bullpup", "wss sniper"],
    weaponSecondary: ["katana", "катан", "tanto", "танто", "smart", "умн", "tech", "тех"],
    ammoPrimary: ["умн", "smart", "бронебойн", "armor-piercing", "проникающ", "penetrat"],
    ammoSecondary: ["базов", "basic"],
    armorPrimary: ["arasaka", "blackjack", "stealth", "скрыт", "черн", "чёрн"],
    armorSecondary: ["тактич", "tactical", "armorjack"],
    gearPrimary: ["arasaka", "ecm", "scanner", "скан", "radar", "радар", "lie detector", "детектор лжи", "laser mike", "коммуник", "radio"],
    gearSecondary: ["briefcase", "кейс", "идентиф", "наблюден"],
  },
  {
    test: /\bmilitech\b/iu,
    weaponPrimary: ["militech", "lexington", "omaha", "ajax", "achilles", "crusher", "saratoga", "ronin", "bulldog", "hotshot", "starshot", "mk. 31", "mk 31"],
    weaponSecondary: ["rifle", "винтов", "shotgun", "дробов", "heavy", "тяжел", "тяжёл", "тактич"],
    ammoPrimary: ["бронебойн", "armor-piercing", "проникающ", "penetrat", "трасс", "tracer"],
    ammoSecondary: ["разрыв", "explosive", "базов", "basic"],
    armorPrimary: ["militech", "tactical", "тактич", "flak", "metal"],
    armorSecondary: ["тяжел", "тяжёл", "armorjack"],
    gearPrimary: ["militech", "тактич", "tactical", "коммуник", "дрон", "развед", "бинок", "скан", "аптеч"],
    gearSecondary: ["пояс", "фонар", "навига"],
  },
  {
    test: /biotechnica/iu,
    weaponPrimary: ["biotechnica"],
    weaponSecondary: ["nonlethal", "несмерт", "stun", "шок", "пистолет", "smg"],
    ammoPrimary: ["биотокс", "biotoxin", "отрав", "poison", "резинов", "rubber"],
    ammoSecondary: ["базов", "basic"],
    armorPrimary: ["biotechnica", "hazmat", "chemical", "хим", "защит"],
    armorSecondary: ["легк", "light", "armorjack"],
    gearPrimary: ["biotechnica", "анализатор", "chemical", "хим", "образец", "sample", "мед", "скан", "детектор", "аптеч"],
    gearSecondary: ["коммуник", "контейнер", "лаборатор"],
  },
  {
    test: /tyger claws?/iu,
    weaponPrimary: ["katana", "катан", "tanto", "танто", "ceramic", "керамич"],
    weaponSecondary: ["arasaka", "пистолет", "smg", "пистолет-пулем", "автомат"],
    ammoPrimary: ["базов", "basic", "умн", "smart"],
    armorPrimary: ["легк", "light", "kevlar", "куртк"],
    armorSecondary: ["тактич", "tactical"],
    gearPrimary: ["glitter", "мото", "agent", "коммуник", "стиль", "тату"],
    gearSecondary: ["фонар", "скан"],
  },
  {
    test: /6th street|sixth street/iu,
    weaponPrimary: ["militech", "kendachi", "ajax", "lexington", "ronin"],
    weaponSecondary: ["assault", "штурм", "rifle", "винтов", "shotgun", "дробов", "пистолет", "гранат"],
    ammoPrimary: ["бронебойн", "armor-piercing", "трасс", "tracer", "базов", "basic"],
    ammoSecondary: ["разрыв", "explosive"],
    armorPrimary: ["tactical", "тактич", "flak", "armorjack", "kevlar"],
    armorSecondary: ["medium", "средн"],
    gearPrimary: ["тактич", "tactical", "бинок", "коммуник", "пояс", "аптеч", "фонар", "воен", "field"],
    gearSecondary: ["ремонт", "навига", "маяч"],
  },
  {
    test: /maelstrom/iu,
    weaponPrimary: ["tech", "тех", "smart", "умн", "shotgun", "дробов", "smg", "пистолет-пулем", "machete", "мачете"],
    weaponSecondary: ["electric", "электр", "heavy", "тяжел", "тяжёл"],
    ammoPrimary: ["умн", "smart", "разрыв", "explosive", "бронебойн", "armor-piercing"],
    ammoSecondary: ["базов", "basic"],
    armorPrimary: ["metal", "металл", "tactical", "тактич"],
    armorSecondary: ["light", "medium", "легк", "средн"],
    gearPrimary: ["techscanner", "техскан", "braindance", "брейнданс", "наркот", "drug", "ремонт", "инструмент"],
    gearSecondary: ["детектор", "скан", "буст"],
  },
  {
    test: /the mox|шельм/iu,
    weaponPrimary: ["bat", "club", "бита", "дубин", "axe", "топор", "labrys"],
    weaponSecondary: ["pistol", "пистолет", "smg", "tyger", "katana", "tanto"],
    ammoPrimary: ["базов", "basic", "резинов", "rubber", "nonlethal", "несмерт"],
    armorPrimary: ["bitch v.13", "fashion", "стил", "легк", "light"],
    armorSecondary: ["kevlar", "armorjack"],
    gearPrimary: ["braindance", "брейнданс", "agent", "аптеч", "мед", "club", "клуб", "космет"],
    gearSecondary: ["коммуник", "стиль", "украш"],
  },
  {
    test: /animals|животн/iu,
    weaponPrimary: ["heavy melee", "тяжелое оружие ближнего", "молот", "hammer", "bat", "club", "дубин", "melee", "ближн"],
    weaponSecondary: ["shotgun", "дробов"],
    ammoPrimary: ["базов", "basic", "дешев", "cheap"],
    armorPrimary: ["легк", "light", "защит"],
    gearPrimary: ["juice", "стероид", "гормон", "adrenal", "адреналин", "сыворот", "буст"],
    gearSecondary: ["аптеч", "пояс"],
  },
  {
    test: /valentinos?/iu,
    weaponPrimary: ["machete", "мачете", "gold", "золот", "silver", "серебр"],
    weaponSecondary: ["pistol", "пистолет", "smg", "shotgun", "дробов", "revolver", "револьвер"],
    ammoPrimary: ["базов", "basic", "трасс", "tracer"],
    armorPrimary: ["легк", "light", "куртк", "armorjack"],
    gearPrimary: ["agent", "авто", "car", "ремонт", "стиль", "украш", "jewelry"],
    gearSecondary: ["коммуник", "фонар"],
  },
  {
    test: /scavengers|\bscavs\b|\bscavvers\b/iu,
    weaponPrimary: ["poor", "дешев", "cheap", "junk", "самодел", "кустар", "shotgun", "дробов", "smg", "machete", "мачете"],
    ammoPrimary: ["дешев", "cheap", "базов", "basic"],
    armorPrimary: ["дешев", "cheap", "легк", "light", "armorjack"],
    gearPrimary: ["мед", "аптеч", "хирург", "анализатор", "carryall", "сумка", "tool", "инструмент", "ремонт"],
    gearSecondary: ["скан", "фонар", "контейнер"],
  },
  {
    test: /wraiths|raffen shiv/iu,
    weaponPrimary: ["rifle", "винтов", "sniper", "снайпер", "shotgun", "дробов", "heavy", "тяжел", "тяжёл"],
    weaponSecondary: ["machete", "мачете", "пистолет"],
    ammoPrimary: ["бронебойн", "armor-piercing", "трасс", "tracer", "зажигат", "incendiary", "базов", "basic"],
    armorPrimary: ["flak", "tactical", "тактич", "medium", "средн", "heavy", "тяжел", "тяжёл"],
    gearPrimary: ["repair", "ремонт", "трос", "навига", "vehicle", "транспорт", "fuel", "топлив", "бинок", "маяч"],
    gearSecondary: ["фонар", "коммуник", "аптеч"],
  },
  {
    test: /voodoo boys.*net|net cell/iu,
    weaponPrimary: ["machete", "мачете", "knife", "нож", "conceal", "скрыт", "needle", "игл"],
    weaponSecondary: ["smart", "умн", "tech", "тех", "pistol", "пистолет", "smg", "электр", "shock"],
    ammoPrimary: ["умн", "smart", "базов", "basic"],
    armorPrimary: ["cooling", "охлажд", "легк", "light", "stealth", "скрыт"],
    gearPrimary: ["cyberdeck", "кибердек", "agent", "computer", "компьютер", "net", "сеть", "коммуник", "скан", "jammer", "глуш"],
    gearSecondary: ["braindance", "брейнданс", "маяч"],
  },
  {
    test: /voodoo boys/iu,
    weaponPrimary: ["melee", "ближн", "pistol", "пистолет"],
    weaponSecondary: ["conceal", "скрыт"],
    ammoPrimary: ["базов", "basic"],
    armorPrimary: ["легк", "light"],
    gearPrimary: ["drug", "наркот", "agent", "коммуник", "audio", "аудио"],
  },
  {
    test: /inquisitors?/iu,
    weaponPrimary: ["analog", "аналог", "shotgun", "дробов", "rifle", "винтов", "melee", "ближн", "machete", "мачете"],
    ammoPrimary: ["базов", "basic", "бронебойн", "armor-piercing"],
    armorPrimary: ["обыч", "kevlar", "armorjack", "легк", "medium", "средн"],
    gearPrimary: ["аптеч", "фонар", "трос", "наруч", "инструмент"],
    weaponReject: /smart|умн|\btech\b|технол/iu,
    gearReject: /кибердек|cyberdeck|нейро|киберскан/iu,
  },
  {
    test: /iron sights/iu,
    weaponPrimary: ["arasaka", "rifle", "винтов", "smg", "heavy", "тяжел", "тяжёл"],
    ammoPrimary: ["бронебойн", "armor-piercing", "разрыв", "explosive"],
    armorPrimary: ["medium", "средн", "tactical", "тактич", "брон"],
    gearPrimary: ["буст", "наркот", "agent", "ремонт", "техскан"],
  },
  {
    test: /red chrome legion/iu,
    weaponPrimary: ["poor", "дешев", "heavy pistol", "тяжелый пистолет", "тяжёлый пистолет", "big knife", "большой нож"],
    weaponSecondary: ["rifle", "винтов", "smg"],
    ammoPrimary: ["дешев", "cheap", "базов", "basic"],
    armorPrimary: ["medium", "средн", "тактич", "tactical"],
    gearPrimary: ["agent", "коммуник", "фонар", "пояс"],
  },
  {
    test: /bozos/iu,
    weaponPrimary: ["exotic", "экзот", "grenade", "гранат", "shotgun", "дробов", "melee", "ближн"],
    ammoPrimary: ["разрыв", "explosive", "зажигат", "incendiary", "отрав", "poison"],
    armorPrimary: ["легк", "light", "fashion", "стил"],
    gearPrimary: ["наркот", "drug", "позер", "космет", "игруш", "шоу", "bust", "буст"],
  },
  {
    test: /prime-time players/iu,
    weaponPrimary: ["superchrome", "glam", "пистолет", "conceal", "скрыт"],
    ammoPrimary: ["трасс", "tracer", "базов", "basic"],
    armorPrimary: ["fashion", "стил", "костюм", "легк", "light"],
    gearPrimary: ["camera", "камера", "audio", "аудио", "braindance", "брейнданс", "agent", "микрофон", "стиль"],
  },
  {
    test: /piranhas/iu,
    weaponPrimary: ["пистолет", "smg", "conceal", "скрыт", "melee", "ближн"],
    ammoPrimary: ["базов", "basic", "дешев", "cheap"],
    armorPrimary: ["none", "легк", "light"],
    gearPrimary: ["drug", "наркот", "алког", "party", "вечерин", "agent", "коммуник", "стиль"],
  },
  {
    test: /reckoners/iu,
    weaponPrimary: ["poor", "дешев", "shotgun", "дробов", "rifle", "винтов", "melee", "ближн"],
    ammoPrimary: ["дешев", "cheap", "базов", "basic"],
    armorPrimary: ["легк", "light", "medium", "средн"],
    gearPrimary: ["survival", "выжив", "поход", "фонар", "аптеч", "фляг", "трос"],
  },
  {
    test: /generation red/iu,
    weaponPrimary: ["дешев", "cheap", "пистолет", "melee", "ближн", "conceal", "скрыт"],
    ammoPrimary: ["дешев", "cheap", "базов", "basic"],
    armorPrimary: ["легк", "light", "одеж"],
    gearPrimary: ["agent", "коммуник", "фонар", "трос", "аптеч", "инструмент"],
  },
  {
    test: /network 54/iu,
    weaponPrimary: ["conceal", "скрыт", "пистолет", "nonlethal", "несмерт"],
    ammoPrimary: ["резинов", "rubber", "nonlethal", "несмерт", "базов", "basic"],
    armorPrimary: ["делов", "костюм", "легк", "light"],
    gearPrimary: ["camera", "камера", "audio recorder", "диктофон", "микрофон", "agent", "коммуник", "braindance", "брейнданс"],
  },
  {
    test: /rocklin augmentics/iu,
    weaponPrimary: ["tech", "тех", "nonlethal", "несмерт", "smg", "пистолет"],
    ammoPrimary: ["умн", "smart", "резинов", "rubber", "базов", "basic"],
    armorPrimary: ["lab", "лаборатор", "тактич", "tactical", "легк", "light"],
    gearPrimary: ["techscanner", "техскан", "repair", "ремонт", "инструмент", "скан", "анализатор", "computer", "компьютер"],
  },
  {
    test: /sovoil|petrochem/iu,
    weaponPrimary: ["rifle", "винтов", "shotgun", "дробов", "heavy", "тяжел", "тяжёл"],
    ammoPrimary: ["бронебойн", "armor-piercing", "разрыв", "explosive", "базов", "basic"],
    armorPrimary: ["industrial", "промыш", "flak", "tactical", "тактич", "heavy", "тяжел", "тяжёл"],
    gearPrimary: ["detector", "детектор", "radiation", "радиац", "chemical", "хим", "огнетуш", "repair", "ремонт", "аптеч"],
  },
  {
    test: /ziggurat/iu,
    weaponPrimary: ["smart", "умн", "tech", "тех", "nonlethal", "несмерт", "пистолет", "smg"],
    ammoPrimary: ["умн", "smart", "резинов", "rubber", "базов", "basic"],
    armorPrimary: ["легк", "light", "сет", "network"],
    gearPrimary: ["computer", "компьютер", "agent", "коммуник", "скан", "network", "сеть", "detector", "детектор"],
  },
  {
    test: /zhirafa/iu,
    weaponPrimary: ["nonlethal", "несмерт", "smart", "умн", "пистолет", "smg"],
    ammoPrimary: ["резинов", "rubber", "базов", "basic"],
    armorPrimary: ["рабоч", "industrial", "промыш", "легк", "light", "medium", "средн"],
    gearPrimary: ["drone", "дрон", "repair", "ремонт", "tool", "инструмент", "scanner", "скан", "навига", "маяч"],
  },
]);

function factionLoadoutProfile(context = {}) {
  const signature = normalize(`${context.presetId ?? ""} ${context.presetLabel ?? ""} ${context.faction ?? ""}`);
  return FACTION_LOADOUT_PROFILES.find((profile) => profile.test.test(signature)) ?? null;
}

function keywordFlavorScore(text, keywords, weight) {
  let score = 0;
  for (const keyword of keywords ?? []) {
    const normalized = normalize(keyword);
    if (normalized && text.includes(normalized)) score += weight;
  }
  return score;
}

function factionNarrativeFlavorScore(entry, context = {}, kind = "gear") {
  const profile = factionLoadoutProfile(context);
  if (!profile) return 0;
  const text = narrativeText(entry);
  if (!text) return 0;
  const reject = profile[`${kind}Reject`];
  let score = reject?.test?.(text) ? -14 : 0;
  score += keywordFlavorScore(text, profile[`${kind}Primary`], 10);
  score += keywordFlavorScore(text, profile[`${kind}Secondary`], 4);
  return score;
}


function narrativeText(entry) {
  return normalize(`${entry?.name ?? ""} ${entry?.path ?? ""} ${entry?.text ?? ""}`);
}

const ROLE_FLAVOR_ALIAS = Object.freeze({
  pointman: "assault", gunfighter: "skirmisher", breacher: "assault", bodyguard: "defender",
  scout: "infiltrator", controller: "defender", suppressor: "heavy", saboteur: "technician",
  hunter: "sniper", interrogator: "leader", commando: "assault", support: "technician",
});

function flavorRoleId(roleId) {
  return ROLE_FLAVOR_ALIAS[roleId] ?? roleId;
}

function narrativeFlavorScore(entry, context = {}, kind = "gear") {
  const text = narrativeText(entry);
  const rawRoleId = String(context.roleId ?? "");
  const roleId = flavorRoleId(rawRoleId);
  const group = String(context.group ?? context.presetGroup ?? "");
  if (!text) return 0;
  if (NARRATIVE_HARD_REJECT[group]?.test(text)) return -100;
  if (kind === "weapon" && group === "civilian" && entry.weaponProfiles?.includes("heavy")) return -100;
  if (kind === "gear" && entry.category === "substance") {
    const allowsSubstance = ["street", "specialist"].includes(group) || ["medic", "cyberpsycho"].includes(roleId);
    if (!allowsSubstance) return -80;
  }

  const roleKeywords = kind === "weapon"
    ? ROLE_WEAPON_FLAVOR[roleId]
    : kind === "armor"
      ? ROLE_ARMOR_FLAVOR[roleId]
      : kind === "ammo"
        ? ROLE_AMMO_FLAVOR[roleId]
        : kind === "gear"
          ? context.roleGearKeywords
          : [];
  const groupKeywords = kind === "weapon"
    ? GROUP_WEAPON_FLAVOR[group]
    : kind === "gear"
      ? GROUP_GEAR_FLAVOR[group]
      : kind === "ammo"
        ? GROUP_AMMO_FLAVOR[group]
        : [];
  let score = factionNarrativeFlavorScore(entry, context, kind);
  for (const keyword of roleKeywords ?? []) if (text.includes(normalize(keyword))) score += 3;
  for (const keyword of groupKeywords ?? []) if (text.includes(normalize(keyword))) score += 2;

  const factionWords = normalize(context.faction ?? "")
    .split(/[^a-zа-я0-9]+/u)
    .filter((word) => word.length >= 5);
  for (const word of factionWords) if (text.includes(word)) score += 2;

  const labelWords = normalize(context.presetLabel ?? "")
    .split(/[^a-zа-я0-9]+/u)
    .filter((word) => word.length >= 6);
  for (const word of labelWords) if (text.includes(word)) score += 1;

  if (kind === "weapon" && entry.traits?.has?.("nonlethal") && group === "law") score += 7;
  if (kind === "weapon" && entry.traits?.has?.("tech") && ["corporate", "specialist"].includes(group)) score += 2;
  if (kind === "armor" && group === "civilian" && entry.armorProfile === "heavy") score -= 10;
  if (entry?.unique && !context.allowUnique) score -= 8;
  return score;
}

function pickNarrativeEntryByLevel(entries, level, random, context, kind, options = {}) {
  const allowUnique = options.allowUnique === true;
  const allowance = Number.isFinite(Number(options.allowance)) ? Number(options.allowance) : 1;
  const candidates = entries
    .filter((entry) => rarityAllowed(entry, allowUnique))
    .filter((entry) => acceptableLevel(entry, level, allowance))
    .map((entry) => ({ entry, score: narrativeFlavorScore(entry, { ...context, allowUnique }, kind) }))
    .filter(({ score }) => score > -70);
  if (!candidates.length) return null;
  const positive = candidates.filter(({ score }) => score > 0);
  const narrativePool = positive.length ? positive : candidates;
  const weighted = [];
  for (const { entry, score } of narrativePool) {
    const distance = Math.abs(level - entry.level);
    const levelWeight = Math.max(1, 6 - Math.min(5, distance));
    const flavorWeight = Math.max(1, Math.min(16, 5 + score));
    const weight = Math.max(1, levelWeight + flavorWeight);
    for (let index = 0; index < weight; index += 1) weighted.push(entry);
  }
  return pick(weighted, random);
}

export function selectWeapon(catalog, profiles, level, random, options = {}) {
  const requested = new Set(profiles?.length ? profiles : ["any"]);
  let candidates = catalog.weapons.filter((entry) =>
    entry.weaponProfiles.some((profile) => requested.has(profile)),
  );
  if (!candidates.length) candidates = catalog.weapons;
  const narrativeContext = options.narrativeContext ?? {};
  return pickNarrativeEntryByLevel(candidates, level, random, narrativeContext, "weapon", options)
    ?? pickByLevel(candidates, level, random, options);
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
  const narrativeContext = options.narrativeContext ?? {};
  return pickNarrativeEntryByLevel(candidates, level, random, narrativeContext, "armor", options)
    ?? pickByLevel(candidates, level, random, options);
}

function ammoProfileForName(value) {
  const text = normalize(value);
  if (/ракет/iu.test(text)) return "rocket";
  if (/гранатом|гранатн.{0,12}(?:патрон|выстрел)/iu.test(text)) return "grenade";
  if (/дробов|ружейн|картеч|shotgun/iu.test(text)) return "shotgun";
  if (/снайпер|винтов|карабин|пулем|rifle|machine.?gun/iu.test(text)) return "rifle";
  if (/пистолет.?пулем|пистолет|smg|handgun/iu.test(text)) return "pistol";
  return null;
}

function ammoCompatibilityKeys(document) {
  const system = document?.system ?? {};
  return new Set([
    system?.ammo?.baseType,
    system?.ammo?.type,
    system?.baseItem,
    system?.group,
    system?.category,
  ].filter(Boolean).map((value) => normalize(value)));
}

export function compatibleAmmo(
  catalog,
  weapon,
  level,
  random,
  { allowance = 2, allowUnique = false, narrativeContext = {} } = {},
) {
  if (!weapon) return null;
  const weaponKeys = ammoCompatibilityKeys(weapon.document);
  const weaponProfile = ammoProfileForName(`${weapon.name} ${weapon.path ?? ""}`);
  let candidates = catalog.ammo.filter((entry) => {
    const ammoKeys = ammoCompatibilityKeys(entry.document);
    const exact = [...weaponKeys].some((key) => ammoKeys.has(key));
    if (!exact) return false;
    const ammoProfile = ammoProfileForName(`${entry.name} ${entry.path ?? ""}`);
    return !weaponProfile || !ammoProfile || ammoProfile === weaponProfile;
  });
  if (!candidates.length && weaponProfile) {
    candidates = catalog.ammo.filter((entry) =>
      ammoProfileForName(`${entry.name} ${entry.path ?? ""}`) === weaponProfile,
    );
  }
  if (!candidates.length) return null;
  return pickNarrativeEntryByLevel(
    candidates,
    level,
    random,
    narrativeContext,
    "ammo",
    { allowance, allowUnique },
  ) ?? pickByLevel(candidates, level, random, { allowance, allowUnique });
}

const FORGE_UTILITY_GEAR_RE = /(?:аптеч|медскан|гипоспр|дерма|стим|сыворот|drug|наркот|инъектор|inject|first aid|medkit|tool|инструмент|набор|kit|ремонт|repair|техскан|scanner|сканер|скан|анализатор|analy[sz]er|детектор|detector|коммуник|communicator|radio|раци|agent|агент|камера|camera|бинок|фонар|flashlight|наруч|handcuff|отмыч|lockpick|маяч|beacon|навига|navigation|трос|rope|deton|детон|взрыв|explosive|огнетуш|extinguisher|идентифик|badge|жетон|microphone|микрофон|computer|компьютер|cyberdeck|кибердек|drone|дрон|лаборатор|laboratory|образец|sample|контейнер|container|кислород|oxygen|носил|stretcher)/iu;

function isForgeConsumableOrTool(entry) {
  const document = entry?.document;
  if (!document) return false;
  if (entry.category === "substance" || document.type === "consumable") return true;
  if (!["equipment", "backpack"].includes(document.type)) return false;
  // "Обычные предметы" in Forge means mission consumables and practical
  // tools/devices, not random clothing, treasure, lifestyle goods or bags.
  return FORGE_UTILITY_GEAR_RE.test(`${entry.name ?? ""} ${entry.path ?? ""} ${entry.text ?? ""}`);
}

export function selectGear(
  catalog,
  level,
  random,
  {
    count = 1,
    keywords = [],
    allowUnique = false,
    narrativeContext = {},
    fillFromNarrative = false,
    allowance = 1,
  } = {},
) {
  const normalizedKeywords = keywords.map(normalize).filter(Boolean);
  const roleAndFactionContext = { ...narrativeContext, roleGearKeywords: normalizedKeywords };
  const fullPool = catalog.gear.filter(
    (entry) => rarityAllowed(entry, allowUnique) && isForgeConsumableOrTool(entry),
  );
  const preferredPool = fullPool.filter((entry) => {
    const roleMatch = normalizedKeywords.some((keyword) => entry.text.includes(keyword));
    const factionMatch = factionNarrativeFlavorScore(entry, roleAndFactionContext, "gear") > 0;
    return roleMatch || factionMatch;
  });
  // “Кто это” and profession both influence gear. Faction-specific equipment
  // is allowed into the pool even when it is not part of the short role list.
  let candidates = preferredPool.length ? preferredPool : fullPool;
  const selected = [];
  const usedSeries = new Set();
  while (selected.length < count) {
    const available = candidates.filter(
      (entry) => !usedSeries.has(itemSeries(entry)),
    );
    const entry = pickNarrativeEntryByLevel(
      available,
      level,
      random,
      roleAndFactionContext,
      "gear",
      { allowUnique, allowance },
    );
    if (!entry) break;
    selected.push(entry);
    usedSeries.add(itemSeries(entry));
  }

  // Rich loadouts may exhaust the short role-keyword list quickly. Fill the
  // rest from the complete gear catalog, but still pass every item through
  // the narrative hard-reject/scoring rules so a lawman does not receive
  // random street drugs and a civilian does not receive assault hardware.
  if (fillFromNarrative) {
    while (selected.length < count) {
      const available = catalog.gear.filter(
        (entry) =>
          !usedSeries.has(itemSeries(entry)) &&
          rarityAllowed(entry, allowUnique) &&
          isForgeConsumableOrTool(entry),
      );
      const entry = pickNarrativeEntryByLevel(
        available,
        level,
        random,
        roleAndFactionContext,
        "gear",
        { allowUnique, allowance: 1 },
      );
      if (!entry) break;
      selected.push(entry);
      usedSeries.add(itemSeries(entry));
    }
  }
  return selected;
}

function baseGradeIndex(base) {
  if (!base || base.implantType !== "base") return 0;

  // Grade is part of the canonical base name (I–V). Reading it from the name
  // is important for PKT-compatible data too, because their item levels use a
  // different progression than ordinary bases.
  const name = String(base.name ?? "").trim();
  const match = name.match(/(?:^|\s)(V|IV|III|II|I)(?=\s*(?:\(ПКТ\))?\s*$)/iu);
  if (match) {
    return { I: 1, II: 2, III: 3, IV: 4, V: 5 }[match[1].toUpperCase()] ?? 0;
  }

  // Legacy/custom ordinary bases may not contain a Roman grade in the name.
  // Their established progression is I=0, II=4, III=8, IV=12, V=16.
  const level = Math.max(0, Number(base.level ?? 0));
  if (level >= 16) return 5;
  if (level >= 12) return 4;
  if (level >= 8) return 3;
  if (level >= 4) return 2;
  return 1;
}

function baseMaxModuleLevel(base) {
  const grade = baseGradeIndex(base);
  return grade > 0 ? grade * 4 : 0;
}

function moduleFitsBaseGrade(module, base) {
  const moduleLevel = Math.max(0, Number(module?.level ?? 0));
  const maximum = baseMaxModuleLevel(base);
  // Forge randomization follows the base-grade ladder strictly:
  // I → 1–4, II → 1–8, III → 1–12, IV → 1–16, V → 1–20.
  return moduleLevel >= 1 && maximum >= 1 && moduleLevel <= maximum;
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


const PROFESSIONAL_ROLE_FIT = Object.freeze({
  "рокербой": new Set(["leader", "service", "merchant", "civilian"]),
  "техник": new Set(["technician", "demolitions", "droneOperator", "laborer"]),
  "медтех": new Set(["medic", "forensic"]),
  "фиксер": new Set(["merchant", "leader", "civilian", "service"]),
  "нетраннер": new Set(["netrunner", "technician", "droneOperator"]),
  "соло": new Set(["assault", "defender", "heavy", "sniper", "skirmisher", "infiltrator", "leader", "cyberpsycho", "pointman", "gunfighter", "breacher", "bodyguard", "scout", "controller", "suppressor", "hunter", "commando"]),
});

const GROUP_PROFESSION_ALLOW = Object.freeze({
  law: new Set(["соло", "техник", "медтех", "нетраннер"]),
  corporate: new Set(["соло", "техник", "медтех", "фиксер", "нетраннер"]),
  civilian: new Set(["рокербой", "техник", "медтех", "фиксер", "нетраннер"]),
});

const ROLE_CHROME_FLAVOR = Object.freeze({
  assault: ["боев", "тактич", "рефлекс", "прицел", "брон", "сил", "стабилиз", "угроз"],
  defender: ["брон", "защит", "стойк", "биомонитор", "тактич", "связ", "резерв"],
  heavy: ["тяжел", "тяжёл", "сил", "гидрав", "брон", "отдач", "стабилиз"],
  sniper: ["прицел", "оптик", "дальн", "баллист", "стабилиз", "увелич", "наблюден"],
  skirmisher: ["скорост", "рефлекс", "движ", "ног", "равновес", "акробат", "маневр"],
  infiltrator: ["скрыт", "маскир", "бесшум", "сигнатур", "наблюден", "оптик", "аудио"],
  netrunner: ["сет", "net", "компьют", "ice", "кибердек", "интерфейс", "памят", "сигнал", "протокол", "данн"],
  technician: ["ремонт", "диагност", "инструмент", "тех", "скан", "калибр", "сборк", "измер"],
  medic: ["мед", "леч", "био", "диагност", "гемостат", "реаним", "пациент", "аптеч"],
  leader: ["команд", "репутац", "диплом", "переговор", "связ", "контракт", "тактич"],
  merchant: ["репутац", "диплом", "рынок", "контракт", "сделк", "гарант", "контрагент"],
  forensic: ["криминал", "след", "анализ", "скан", "запис", "идентиф", "диагност"],
  demolitions: ["взрыв", "сапер", "сапёр", "инженер", "дистанц", "детон", "тех"],
  droneOperator: ["дрон", "телеметр", "сеть", "интерфейс", "прицел", "сигнал", "дистанц"],
  driver: ["навигац", "транспорт", "скорост", "стабилиз", "ног", "рефлекс", "маршрут"],
  laborer: ["сил", "нагруз", "инструмент", "рук", "ног", "гидрав", "ремонт"],
  service: ["аудио", "голос", "репутац", "общен", "стил", "сцен"],
  clerk: ["данн", "памят", "сеть", "документ", "идентиф", "интерфейс"],
  civilian: ["коммуник", "идентиф", "памят", "аудио", "оптик", "стил"],
});

// Soft profession-specific balance for standalone chrome. These are weights,
// not hard bans: Forge can still vary between NPCs, but a combat role should
// no longer become almost entirely Internal while External never appears.
const ROLE_STANDALONE_MIX = Object.freeze({
  assault: { internal: 4, external: 5, fashion: 1 },
  defender: { internal: 5, external: 5, fashion: 1 },
  heavy: { internal: 5, external: 6, fashion: 0.5 },
  sniper: { internal: 4, external: 3, fashion: 1 },
  skirmisher: { internal: 4, external: 4, fashion: 1.5 },
  infiltrator: { internal: 3, external: 4, fashion: 3 },
  netrunner: { internal: 5, external: 2.5, fashion: 2 },
  technician: { internal: 4, external: 3, fashion: 1.5 },
  medic: { internal: 6, external: 2.5, fashion: 1 },
  leader: { internal: 3, external: 2.5, fashion: 4 },
  merchant: { internal: 2.5, external: 2, fashion: 5 },
  driver: { internal: 4, external: 3.5, fashion: 1 },
  laborer: { internal: 5, external: 5, fashion: 0.5 },
  service: { internal: 2, external: 2, fashion: 6 },
  clerk: { internal: 4, external: 1.5, fashion: 3 },
  forensic: { internal: 5, external: 2.5, fashion: 1 },
  demolitions: { internal: 4, external: 5, fashion: 0.5 },
  droneOperator: { internal: 4, external: 3, fashion: 1.5 },
  pointman: { internal: 4, external: 5, fashion: 0.5 },
  gunfighter: { internal: 3.5, external: 4, fashion: 2 },
  breacher: { internal: 5, external: 5, fashion: 0.5 },
  bodyguard: { internal: 5, external: 4, fashion: 1 },
  scout: { internal: 3.5, external: 3.5, fashion: 2 },
  controller: { internal: 4, external: 3, fashion: 1.5 },
  suppressor: { internal: 5, external: 5, fashion: 0.5 },
  saboteur: { internal: 4, external: 3.5, fashion: 1.5 },
  hunter: { internal: 4, external: 3.5, fashion: 1 },
  interrogator: { internal: 3, external: 2.5, fashion: 3.5 },
  commando: { internal: 4.5, external: 5, fashion: 0.5 },
  support: { internal: 4.5, external: 3, fashion: 1.5 },
  cyberpsycho: { internal: 6, external: 6, fashion: 0.25 },
  pkt: { internal: 5, external: 5, fashion: 0.5 },
  civilian: { internal: 3, external: 2, fashion: 4 },
});

function standaloneMix(context = {}) {
  const roleId = flavorRoleId(String(context.roleId ?? ""));
  const group = String(context.group ?? context.presetGroup ?? "");
  const base = { ...(ROLE_STANDALONE_MIX[roleId] ?? ROLE_STANDALONE_MIX.civilian) };
  if (group === "street") {
    base.external = Number(base.external ?? 1) + 0.75;
    base.fashion = Number(base.fashion ?? 1) + 0.5;
  } else if (group === "corporate") {
    base.internal = Number(base.internal ?? 1) + 0.75;
  } else if (group === "law") {
    base.external = Number(base.external ?? 1) + 0.75;
    base.fashion = Math.max(0.25, Number(base.fashion ?? 1) - 0.5);
  }
  return base;
}

const GROUP_CHROME_FLAVOR = Object.freeze({
  law: ["тактич", "охран", "полиц", "идентиф", "запис", "прицел", "связ", "биомонитор", "защит", "несмерт"],
  corporate: ["корпорат", "тактич", "защит", "связ", "идентиф", "репутац", "протокол", "делов"],
  civilian: ["быт", "коммуник", "професс", "идентиф", "стил", "памят", "здоров"],
  street: ["улич", "скрыт", "боев", "стил", "рефлекс", "страх", "репутац"],
  specialist: ["професс", "диагност", "анализ", "инструмент", "интерфейс", "тактич"],
});

const EXOTIC_BEHAVIOR_RE = /животн|animal|зверин|зверь|поведенческ.{0,24}(?:живот|звер)|behavior.{0,24}(?:animal|beast)|киберхвост|боевой хвост|лисий|лисьи|кошач|собач|волч|птичь/iu;
const EXTREME_COMBAT_RE = /киберпсих|берсерк|боевой хвост|штурмов|военн|убийц|хищник/iu;

function professionMarker(entry) {
  const path = normalize(entry?.path);
  if (!path.includes("професс")) return null;
  for (const marker of Object.keys(PROFESSIONAL_ROLE_FIT)) {
    if (path.includes(marker)) return marker;
  }
  return null;
}

export function cyberwareNarrativeScore(entry, context = {}) {
  const rawRoleId = String(context.roleId ?? "");
  const roleId = flavorRoleId(rawRoleId);
  const group = String(context.group ?? context.presetGroup ?? "");
  const text = normalize(`${entry?.name ?? ""} ${entry?.path ?? ""} ${entry?.text ?? ""}`);
  if (!text) return 0;

  // Exotic animal-behavior/body chrome is opt-in. It belongs to specific
  // gangs/characters (for example Animals), not to a random profession.
  const exoticContext = normalize(`${context.faction ?? ""} ${context.presetLabel ?? ""}`);
  const sovietContext = /sovoil|soviet|совет|нео.?сов/iu.test(exoticContext);
  if (/нео.?совет|neo.?soviet/iu.test(text) && !sovietContext) return -100;
  const allowsExoticChrome = /animals|animal|звер|экзот|позер/iu.test(exoticContext);
  if (EXOTIC_BEHAVIOR_RE.test(text) && !allowsExoticChrome) return -100;
  if (group === "civilian" && EXTREME_COMBAT_RE.test(text)) return -80;

  let score = 0;
  const profession = professionMarker(entry);
  if (profession) {
    const groupAllows = !GROUP_PROFESSION_ALLOW[group] || GROUP_PROFESSION_ALLOW[group].has(profession);
    const fits = PROFESSIONAL_ROLE_FIT[profession]?.has(rawRoleId) === true || PROFESSIONAL_ROLE_FIT[profession]?.has(roleId) === true;
    if (!groupAllows || !fits) return -90;
    score += 14;
  }

  for (const keyword of ROLE_CHROME_FLAVOR[roleId] ?? []) {
    if (text.includes(keyword)) score += 2;
  }
  for (const keyword of GROUP_CHROME_FLAVOR[group] ?? []) {
    if (text.includes(keyword)) score += 1;
  }

  const preferredFamilies = Array.isArray(context.preferredFamilies)
    ? context.preferredFamilies
    : [];
  const familyIndex = preferredFamilies.findIndex(
    (family) => family === entry?.family || family === entry?.implantType,
  );
  if (familyIndex >= 0) score += Math.max(2, 9 - familyIndex * 2);
  else if (
    preferredFamilies.length &&
    ["base", "module"].includes(entry?.implantType)
  ) {
    // Non-profile host families remain possible for variety, but they should
    // lose against profession-relevant ones most of the time.
    score -= 3;
  }

  if (["internal", "external", "fashion"].includes(entry?.implantType)) {
    const weight = Number(standaloneMix(context)[entry.implantType] ?? 1);
    score += Math.max(0, Math.min(6, Math.round(weight)));
  }

  const factionWords = normalize(context.faction ?? "").split(/[^a-zа-я0-9]+/u).filter((word) => word.length >= 5);
  for (const word of factionWords) if (text.includes(word)) score += 1;

  if (entry?.implantType === "fashion" && ["law", "corporate"].includes(group)) score -= 3;
  if (entry?.unique && !context.allowUnique) score -= 8;
  return score;
}

export function pickNarrativeCyberwareByLevel(
  entries,
  level,
  random = Math.random,
  context = {},
  { allowUnique = false, allowance = 1 } = {},
) {
  const scored = entries
    .filter((entry) => rarityAllowed(entry, allowUnique))
    .filter((entry) => acceptableLevel(entry, level, allowance))
    .map((entry) => ({ entry, score: cyberwareNarrativeScore(entry, { ...context, allowUnique }) }))
    .filter(({ score }) => score > -70);
  if (!scored.length) return null;

  const positive = scored.filter(({ score }) => score > 0);
  const narrativePool = positive.length ? positive : scored;
  const weighted = [];
  for (const { entry, score } of narrativePool) {
    const distance = Math.abs(level - entry.level);
    const levelWeight = Math.max(1, 6 - Math.min(5, distance));
    const flavorWeight = Math.max(1, Math.min(12, 4 + score));
    const weight = Math.max(1, levelWeight + flavorWeight);
    for (let i = 0; i < weight; i++) weighted.push(entry);
  }
  return pick(weighted, random);
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
    narrativeContext = {},
    levelAllowance = 1,
    standaloneLimits = { internal: 7, external: 7, fashion: 7 },
  },
) {
  const selected = [];
  const usedSources = new Set();
  const usedSeries = new Set();
  const usedExclusiveFamilies = new Set();
  const baseFamilyCounts = new Map();
  const standaloneCounts = new Map([
    ["internal", 0],
    ["external", 0],
    ["fashion", 0],
  ]);
  const installedBases = [];
  let installedModuleCount = 0;
  let hasNeuralAccelerator = false;
  let hostSerial = 0;

  // Ordinary chrome has physical host limits. Eyes/arms/legs can exist as a
  // left/right pair; audio suites and neural links are single host systems.
  const PAIRED_BASE_FAMILIES = new Set(["optics", "arm", "leg"]);
  const baseFamilyLimit = (entry) => {
    switch (entry?.family) {
      case "optics":
      case "arm":
      case "leg":
        return 2;
      case "audio":
      case "neural":
        return 1;
      default:
        return 1;
    }
  };
  const baseInstallCount = (entry) =>
    PAIRED_BASE_FAMILIES.has(entry?.family) ? 2 : 1;
  const canInstallBase = (entry) =>
    (baseFamilyCounts.get(entry?.family ?? "other") ?? 0) +
      baseInstallCount(entry) <=
    baseFamilyLimit(entry);
  const canReuseBaseSource = (entry) => baseFamilyLimit(entry) > 1;
  const rememberBase = (entry) => {
    const family = entry?.family ?? "other";
    baseFamilyCounts.set(family, (baseFamilyCounts.get(family) ?? 0) + 1);
    installedBases.push({
      entry,
      freeSlots: Math.max(0, Number(entry?.slots ?? 0)),
      moduleCount: 0,
    });
  };
  const canInstallStandalone = (entry) => {
    const type = entry?.implantType;
    if (!standaloneCounts.has(type)) return true;
    const limit = Math.max(0, Number(standaloneLimits?.[type] ?? 0));
    return (standaloneCounts.get(type) ?? 0) < limit;
  };

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
  const rememberEntry = (entry) => {
    usedSources.add(entry.id);
    usedSeries.add(itemSeries(entry));
    rememberInstallationLimits(entry);
    if (standaloneCounts.has(entry.implantType)) {
      standaloneCounts.set(
        entry.implantType,
        (standaloneCounts.get(entry.implantType) ?? 0) + 1,
      );
    }
  };
  const installBase = (base) => {
    const installed = [];
    const copies = baseInstallCount(base);
    for (let index = 0; index < copies; index += 1) {
      hostSerial += 1;
      const instance = {
        ...base,
        forgeHostKey: `${base.id}#${hostSerial}`,
        forgePairIndex: copies > 1 ? index + 1 : null,
        forgePairSize: copies,
      };
      selected.push(instance);
      rememberEntry(base);
      rememberBase(instance);
      installed.push(instance);
    }
    return installed;
  };

  // `families` is a preference from “Кто это”, not a hard whitelist. The
  // previous implementation made whole implant categories impossible for
  // many professions, especially External chrome. All legal hosts remain in
  // the pool; narrative scoring keeps the profession-specific bias.
  const bases = familyCandidates(catalog, [], "base");
  const standalone = catalog.cyberware.filter(
    (entry) =>
      !entry.pktOnly &&
      !entry.pktBody &&
      !entry.pktBiosystem &&
      ["internal", "external", "fashion"].includes(entry.implantType),
  );

  const availableBases = ({ allowPairOverflow = false } = {}) =>
    bases.filter(
      (entry) =>
        canInstallBase(entry) &&
        (allowPairOverflow || selected.length + baseInstallCount(entry) <= count) &&
        (canReuseBaseSource(entry) || !usedSources.has(entry.id)) &&
        (canReuseBaseSource(entry) || !usedSeries.has(itemSeries(entry))) &&
        respectsInstallationLimits(entry) &&
        rarityAllowed(entry, allowUnique),
    );

  const availableStandalone = (broad = false) =>
    (broad
      ? catalog.cyberware.filter(
          (entry) =>
            !entry.pktOnly &&
            !entry.pktBody &&
            !entry.pktBiosystem &&
            ["internal", "external", "fashion"].includes(entry.implantType),
        )
      : standalone
    ).filter(
      (entry) =>
        !usedSources.has(entry.id) &&
        !usedSeries.has(itemSeries(entry)) &&
        canInstallStandalone(entry) &&
        respectsInstallationLimits(entry) &&
        rarityAllowed(entry, allowUnique),
    );

  const availableModules = () => {
    if (!installedBases.length) return [];
    return catalog.cyberware.filter(
      (entry) =>
        !entry.pktOnly &&
        entry.implantType === "module" &&
        !usedSources.has(entry.id) &&
        !usedSeries.has(itemSeries(entry)) &&
        respectsInstallationLimits(entry) &&
        rarityAllowed(entry, allowUnique) &&
        installedBases.some(
          (state) =>
            state.moduleCount < 2 &&
            state.freeSlots >= Math.max(0, Number(entry.slotsUsed ?? 0)) &&
            moduleFitsBaseGrade(entry, state.entry) &&
            moduleMatchesBase(entry, state.entry),
        ),
    );
  };

  const installModule = (module) => {
    const required = Math.max(0, Number(module.slotsUsed ?? 0));
    const hosts = installedBases
      .filter(
        (state) =>
          state.moduleCount < 2 &&
          state.freeSlots >= required &&
          moduleFitsBaseGrade(module, state.entry) &&
          moduleMatchesBase(module, state.entry),
      )
      .sort((left, right) =>
        left.moduleCount - right.moduleCount || right.freeSlots - left.freeSlots,
      );
    if (!hosts.length) return false;
    // Fill the least-used compatible host first. A generated base receives at
    // most two modules, which prevents one six-slot arm from swallowing the
    // entire preset while other installed bases stay empty.
    const fewestModules = hosts[0].moduleCount;
    const bestFree = Math.max(
      ...hosts
        .filter((state) => state.moduleCount === fewestModules)
        .map((state) => state.freeSlots),
    );
    const tied = hosts.filter(
      (state) => state.moduleCount === fewestModules && state.freeSlots === bestFree,
    );
    const host = tied[Math.floor(random() * tied.length)] ?? hosts[0];
    selected.push({
      ...module,
      parentSourceId: host.entry.id,
      parentHostKey: host.entry.forgeHostKey ?? null,
    });
    host.freeSlots = Math.max(0, host.freeSlots - required);
    host.moduleCount += 1;
    installedModuleCount += 1;
    rememberEntry(module);
    return true;
  };

  // Every chromed NPC starts with a neural link. This is a world baseline,
  // not a profession preference: the only hard exception is handled by the
  // Forge preset layer (Inquisitors receive no chrome at all). The baseline
  // may use an item up to +4 levels, matching the Forge's global rare-upgrade
  // ceiling, so low-level NPCs do not silently lose their required Neural Link.
  if (count > 0 && (baseFamilyCounts.get("neural") ?? 0) === 0) {
    const neuralPool = catalog.cyberware.filter(
      (entry) =>
        !entry.pktOnly &&
        !entry.pktBody &&
        !entry.pktBiosystem &&
        entry.implantType === "base" &&
        entry.family === "neural" &&
        respectsInstallationLimits(entry) &&
        rarityAllowed(entry, allowUnique),
    );
    const neural = pickNarrativeCyberwareByLevel(
      neuralPool,
      level,
      random,
      { ...narrativeContext, preferredFamilies: ["neural", ...(narrativeContext.preferredFamilies ?? [])] },
      { allowUnique, allowance: Math.max(4, levelAllowance) },
    );
    if (neural) installBase(neural);
  }

  // Build a body plan instead of repeatedly rolling one global pool. Roughly
  // 30% of the preset is hosts, ~20–34% modules (depending on the preset's
  // module bias), and the rest standalone chrome. This is intentionally soft:
  // paired eyes/arms/legs can move the final numbers by one host.
  let baseGoal = count > 0
    ? Math.min(5, count, Math.max(1, Math.round(count * 0.3)))
    : 0;
  if (count >= 8) {
    const variation = random();
    if (variation < 0.22) baseGoal = Math.max(2, baseGoal - 1);
    else if (variation > 0.78) baseGoal = Math.min(5, baseGoal + 1);
  }
  const moduleShare = 0.2 + Math.max(0, Math.min(1, Number(moduleChance) || 0)) * 0.14;
  const moduleGoal = Math.min(
    Math.max(0, count - baseGoal),
    baseGoal * 2,
    Math.max(0, Math.round(count * moduleShare)),
  );
  const standaloneGoal = Math.max(0, count - baseGoal - moduleGoal);

  // Deliberately create multiple physical hosts before modules. Eyes, arms and
  // legs are atomic pairs, so choosing one family creates both sides.
  while (selected.length < count && installedBases.length < baseGoal) {
    const pool = availableBases();
    if (!pool.length) break;
    const chosen = pickNarrativeCyberwareByLevel(
      pool,
      level,
      random,
      narrativeContext,
      { allowUnique, allowance: levelAllowance },
    );
    if (!chosen) break;
    installBase(chosen);
  }

  const standaloneTypeWeights = standaloneMix(narrativeContext);
  const standaloneCount = () =>
    [...standaloneCounts.values()].reduce((sum, value) => sum + value, 0);
  const chooseStandalone = (pool) => {
    const byType = new Map();
    for (const entry of pool) {
      const list = byType.get(entry.implantType) ?? [];
      list.push(entry);
      byType.set(entry.implantType, list);
    }
    const typeCandidates = [...byType.entries()].map(([type, entries]) => {
      const current = standaloneCounts.get(type) ?? 0;
      const roleWeight = Math.max(0.1, Number(standaloneTypeWeights[type] ?? 1));
      // New categories get a strong first-pick bonus, then the pressure falls
      // as that category accumulates. This keeps Internal/External/Fashion
      // visibly mixed without making every NPC identical.
      const novelty = current === 0 ? 2.2 : 0;
      const priority = roleWeight / (1 + current * 1.35) + novelty + random() * 0.9;
      return { type, entries, priority };
    });
    typeCandidates.sort((left, right) => right.priority - left.priority);
    const chosenType = typeCandidates[0];
    if (!chosenType) return null;
    return pickNarrativeCyberwareByLevel(
      chosenType.entries,
      level,
      random,
      narrativeContext,
      { allowUnique, allowance: levelAllowance },
    );
  };

  while (selected.length < count) {
    const basePool = availableBases();
    const modulePool = availableModules();
    const standalonePool = availableStandalone(false);
    const modes = [
      {
        mode: "base",
        pool: basePool,
        deficit: Math.max(0, baseGoal - installedBases.length),
        target: Math.max(1, baseGoal),
      },
      {
        mode: "module",
        pool: modulePool,
        deficit: Math.max(0, moduleGoal - installedModuleCount),
        target: Math.max(1, moduleGoal),
      },
      {
        mode: "standalone",
        pool: standalonePool,
        deficit: Math.max(0, standaloneGoal - standaloneCount()),
        target: Math.max(1, standaloneGoal),
      },
    ].filter((entry) => entry.pool.length);
    if (!modes.length) break;

    const wanted = modes.filter((entry) => entry.deficit > 0);
    const ranked = (wanted.length ? wanted : modes)
      .map((entry) => ({
        ...entry,
        pressure: entry.deficit / entry.target + random() * 0.18,
      }))
      .sort((left, right) => right.pressure - left.pressure);
    // Once the planned mix is met, prefer a standalone implant over forcing
    // extra modules into bases merely because Capacity remains.
    let mode = ranked[0]?.mode ?? null;
    if (!wanted.length && standalonePool.length) mode = "standalone";

    const chosen = mode === "standalone"
      ? chooseStandalone(standalonePool)
      : pickNarrativeCyberwareByLevel(
          mode === "base" ? basePool : modulePool,
          level,
          random,
          narrativeContext,
          { allowUnique, allowance: levelAllowance },
        );
    if (!chosen) {
      const alternatives = [basePool, modulePool, standalonePool].filter(
        (entries) => entries.length,
      );
      if (!alternatives.length) break;
      const alternate = pickNarrativeCyberwareByLevel(
        alternatives.flat(),
        level,
        random,
        narrativeContext,
        { allowUnique, allowance: levelAllowance },
      );
      if (!alternate) break;
      if (alternate.implantType === "base") {
        installBase(alternate);
      } else if (alternate.implantType === "module") {
        if (!installModule(alternate)) break;
      } else {
        selected.push(alternate);
        rememberEntry(alternate);
      }
      continue;
    }

    if (mode === "base") {
      installBase(chosen);
    } else if (mode === "module") {
      if (!installModule(chosen)) break;
    } else {
      selected.push(chosen);
      rememberEntry(chosen);
    }
  }

  // If a narrow family profile runs out, fill only with legal standalone
  // chrome. Internal/external/fashion caps are never exceeded by the fallback.
  while (selected.length < count) {
    const fallback = availableStandalone(true);
    const chosen = chooseStandalone(fallback);
    if (!chosen) break;
    selected.push(chosen);
    rememberEntry(chosen);
  }
  return selected;
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
    hostKey = null,
    parentHostKey = null,
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
      hostKey,
      parentHostKey,
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
  return item?.flags?.[MODULE_ID]?.[FORGE_FLAG] ?? null;
}
