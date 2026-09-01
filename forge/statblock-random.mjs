import { pick } from "./random.mjs";

export const FALLBACK_SKILL_SLUGS = Object.freeze([
  "acrobatics",
  "athletics",
  "computers",
  "crafting",
  "deception",
  "diplomacy",
  "intimidation",
  "medicine",
  "performance",
  "piloting",
  "society",
  "stealth",
  "survival",
  "thievery",
]);

export const FALLBACK_LANGUAGE_SLUGS = Object.freeze([
  "pact-common",
  "akitonian",
  "brethedan",
  "castrovelian",
  "diasporan",
  "draconic",
  "eoxian",
  "trinary",
  "vercite",
  "vesk",
  "dwarven",
  "elven",
  "halfling",
]);

const PRESET_SKILLS = Object.freeze({
  "corporate-patrol": ["society", "computers", "athletics", "intimidation"],
  "corporate-response": ["athletics", "medicine", "computers", "crafting"],
  "corporate-sniper": ["survival", "stealth", "computers", "acrobatics"],
  "corporate-netwatch": ["computers", "society", "deception", "crafting"],
  "street-ganger": ["deception", "thievery", "performance", "intimidation"],
  "street-enforcer": ["athletics", "intimidation", "survival", "thievery"],
  scavenger: ["crafting", "survival", "thievery", "piloting"],
  "street-ripperdoc": ["medicine", "crafting", "deception", "computers"],
  solo: ["athletics", "acrobatics", "survival", "stealth"],
  fixer: ["diplomacy", "deception", "society", "intimidation"],
  nomad: ["piloting", "survival", "crafting", "athletics"],
  investigator: ["society", "deception", "diplomacy", "computers"],
  netrunner: ["computers", "crafting", "society", "stealth"],
  technician: ["crafting", "computers", "thievery", "piloting"],
  medic: ["medicine", "crafting", "diplomacy", "survival"],
  cyberpsycho: ["athletics", "intimidation", "acrobatics", "survival"],
  "pkt-operative": ["athletics", "computers", "piloting", "intimidation"],
});

const PRESET_LANGUAGES = Object.freeze({
  "corporate-patrol": ["vercite", "trinary", "vesk"],
  "corporate-response": ["vercite", "vesk", "trinary"],
  "corporate-sniper": ["vercite", "diasporan", "vesk"],
  "corporate-netwatch": ["trinary", "vercite", "aballonian"],
  "street-ganger": ["akitonian", "vercite", "diasporan"],
  "street-enforcer": ["akitonian", "vesk", "diasporan"],
  scavenger: ["akitonian", "diasporan", "trinary"],
  "street-ripperdoc": ["vercite", "akitonian", "eoxian"],
  solo: ["vercite", "vesk", "diasporan"],
  fixer: ["vercite", "akitonian", "castrovelian"],
  nomad: ["diasporan", "akitonian", "vesk"],
  investigator: ["vercite", "akitonian", "trinary"],
  netrunner: ["trinary", "aballonian", "vercite"],
  technician: ["trinary", "vercite", "diasporan"],
  medic: ["vercite", "castrovelian", "vesk"],
  cyberpsycho: ["akitonian", "vesk", "diasporan"],
  "pkt-operative": ["trinary", "vercite", "vesk"],
});

const ROLE_SPEED_ADJUSTMENTS = Object.freeze({
  assault: [0, 0, 5],
  defender: [-5, 0, 0],
  heavy: [-5, -5, 0],
  sniper: [0, 0, 5],
  skirmisher: [5, 5, 10],
  infiltrator: [0, 5, 5],
  netrunner: [-5, 0, 0],
  technician: [-5, 0, 0],
  medic: [0, 0, 5],
  leader: [0, 0, 5],
  civilian: [-5, 0, 0],
  cyberpsycho: [5, 5, 10],
  pkt: [0, 5, 5],
});

const PRESET_DEFENSE_PROFILES = Object.freeze({
  "corporate-patrol": ["none", "armored", "insulated"],
  "corporate-response": ["armored", "armored", "thermal", "insulated"],
  "corporate-sniper": ["none", "neural-firewall", "insulated"],
  "corporate-netwatch": ["neural-firewall", "insulated", "neural-firewall"],
  "street-ganger": ["none", "none", "cheap-chrome"],
  "street-enforcer": ["none", "armored", "cheap-chrome"],
  scavenger: ["none", "insulated", "cheap-chrome"],
  "street-ripperdoc": ["none", "toxin-filter", "disease-filter"],
  solo: ["none", "armored", "insulated", "neural-firewall"],
  fixer: ["none", "none", "neural-firewall"],
  nomad: ["none", "thermal", "insulated"],
  investigator: ["none", "none", "neural-firewall"],
  netrunner: ["neural-firewall", "insulated", "cheap-chrome"],
  technician: ["none", "insulated", "thermal"],
  medic: ["none", "toxin-filter", "disease-filter"],
  cyberpsycho: ["armored-chrome", "armored-chrome", "cheap-chrome"],
  "pkt-operative": [
    "full-conversion",
    "hardened-conversion",
    "full-conversion",
  ],
});

function removePick(values, random) {
  if (!values.length) return null;
  const index = Math.min(
    values.length - 1,
    Math.floor(random() * values.length),
  );
  return values.splice(index, 1)[0] ?? null;
}

function extraSkillTier(random, { final = false } = {}) {
  if (final) return random() < 0.35 ? "terrible" : "low";
  return pick(
    ["terrible", "low", "low", "low", "moderate", "moderate"],
    random,
  );
}

export function buildNpcSkillTiers({
  roleSkills,
  presetId,
  availableSkills = FALLBACK_SKILL_SLUGS,
  level = 0,
  random = Math.random,
}) {
  const allowed = new Set(availableSkills);
  const result = Object.fromEntries(
    Object.entries(roleSkills ?? {}).filter(([slug]) => allowed.has(slug)),
  );
  const preferred = (PRESET_SKILLS[presetId] ?? []).filter(
    (slug) => allowed.has(slug) && !Object.hasOwn(result, slug),
  );
  const preferredCount = Math.min(
    preferred.length,
    2 + Math.floor(random() * 2),
  );
  for (let index = 0; index < preferredCount; index += 1) {
    const slug = removePick(preferred, random);
    if (slug) result[slug] = pick(["low", "moderate", "moderate"], random);
  }

  const desired = Math.min(
    allowed.size,
    Math.max(
      7,
      7 + Math.floor(Math.max(-1, level) / 6) + Math.floor(random() * 3),
    ),
  );
  const remaining = [...allowed].filter((slug) => !Object.hasOwn(result, slug));
  while (Object.keys(result).length < desired && remaining.length) {
    const slug = removePick(remaining, random);
    if (!slug) break;
    const isFinal = Object.keys(result).length === desired - 1;
    result[slug] = extraSkillTier(random, { final: isFinal });
  }
  return result;
}

function languageTarget(intelligenceTier, random) {
  const base =
    {
      terrible: 1,
      low: 1,
      moderate: 2,
      high: 3,
      extreme: 4,
    }[intelligenceTier] ?? 2;
  return base + (random() < 0.3 ? 1 : 0);
}

export function selectNpcLanguages({
  ancestryLanguages = [],
  presetId,
  intelligenceTier = "moderate",
  availableLanguages = FALLBACK_LANGUAGE_SLUGS,
  random = Math.random,
}) {
  const allowed = new Set(availableLanguages);
  const result = [];
  const add = (slug) => {
    if (allowed.has(slug) && !result.includes(slug)) result.push(slug);
  };
  add(allowed.has("pact-common") ? "pact-common" : "common");
  ancestryLanguages.forEach(add);

  const preferred = (PRESET_LANGUAGES[presetId] ?? []).filter(
    (slug) => allowed.has(slug) && !result.includes(slug),
  );
  const remaining = [...allowed].filter((slug) => !result.includes(slug));
  const target = Math.max(
    result.length,
    languageTarget(intelligenceTier, random),
  );
  while (result.length < target && (preferred.length || remaining.length)) {
    const usePreferred =
      preferred.length && (random() < 0.8 || !remaining.length);
    const slug = removePick(usePreferred ? preferred : remaining, random);
    if (!slug) continue;
    add(slug);
    const duplicateIndex = remaining.indexOf(slug);
    if (duplicateIndex >= 0) remaining.splice(duplicateIndex, 1);
    const preferredIndex = preferred.indexOf(slug);
    if (preferredIndex >= 0) preferred.splice(preferredIndex, 1);
  }
  return result;
}

export function selectNpcSpeed({
  baseSpeed = 25,
  roleId,
  presetId,
  random = Math.random,
}) {
  const roleAdjustments = ROLE_SPEED_ADJUSTMENTS[roleId] ?? [0];
  const roleAdjustment = pick(roleAdjustments, random) ?? 0;
  const presetAdjustment = presetId === "nomad" && random() < 0.35 ? 5 : 0;
  return Math.max(
    15,
    Math.min(50, Number(baseSpeed) + roleAdjustment + presetAdjustment),
  );
}

function defenseValue(level) {
  return Math.max(2, Math.floor((Number(level) + 3) / 2));
}

function weaknessValue(level) {
  return Math.max(2, Math.floor((Number(level) + 2) / 2));
}

function defenseProfile(id, level) {
  const resistance = defenseValue(level);
  const weakness = weaknessValue(level);
  const profiles = {
    none: {
      label: "без особой защиты",
    },
    armored: {
      label: "баллистическая защита",
      resistances: [{ type: "physical", value: resistance }],
    },
    thermal: {
      label: "термозащита",
      resistances: [{ type: "fire", value: resistance }],
      weaknesses: [{ type: "cold", value: weakness }],
    },
    insulated: {
      label: "электроизоляция",
      resistances: [{ type: "electricity", value: resistance }],
    },
    "neural-firewall": {
      label: "нейронный экран",
      resistances: [{ type: "mental", value: resistance }],
    },
    "cheap-chrome": {
      label: "нестабильный дешёвый хром",
      weaknesses: [{ type: "electricity", value: weakness }],
    },
    "toxin-filter": {
      label: "токсин-фильтр",
      immunities: [{ type: "poison" }],
    },
    "disease-filter": {
      label: "медицинская фильтрация",
      immunities: [{ type: "disease" }],
    },
    "armored-chrome": {
      label: "бронированный хром",
      resistances: [{ type: "physical", value: resistance }],
      weaknesses: [{ type: "electricity", value: weakness }],
    },
    "full-conversion": {
      label: "полная синтетическая конверсия",
      immunities: [{ type: "bleed" }, { type: "disease" }, { type: "poison" }],
      resistances: [{ type: "physical", value: resistance }],
      weaknesses: [{ type: "electricity", value: weakness }],
    },
    "hardened-conversion": {
      label: "закалённая полная конверсия",
      immunities: [{ type: "bleed" }, { type: "disease" }, { type: "poison" }],
      resistances: [
        { type: "physical", value: resistance },
        { type: "electricity", value: Math.max(2, resistance - 1) },
      ],
    },
  };
  const selected = profiles[id] ?? profiles.none;
  return {
    id,
    label: selected.label,
    immunities: selected.immunities ?? [],
    resistances: selected.resistances ?? [],
    weaknesses: selected.weaknesses ?? [],
  };
}

export function selectNpcDefenses({
  presetId,
  level = 0,
  cyberwareCount = 0,
  random = Math.random,
}) {
  const candidates = PRESET_DEFENSE_PROFILES[presetId] ?? ["none"];
  let id = pick(candidates, random) ?? "none";
  if (["cheap-chrome", "armored-chrome"].includes(id) && cyberwareCount < 1) {
    id = "none";
  }
  return defenseProfile(id, level);
}

export function ammunitionQuantity(
  entry,
  intensity = "standard",
  random = Math.random,
) {
  if (!entry) return 0;
  const system = entry.document?.system ?? {};
  const sourceQuantity = Math.max(1, Math.trunc(Number(system.quantity) || 1));
  const baseItem = String(system.baseItem ?? "");
  if (baseItem === "battery") {
    return intensity === "minimal" ? 1 : intensity === "rich" ? 3 : 2;
  }
  if (sourceQuantity >= 10) {
    const magazines =
      intensity === "minimal"
        ? 1
        : intensity === "rich"
          ? pick([3, 4, 5], random)
          : 2;
    return sourceQuantity * magazines;
  }
  if (intensity === "rich") return 4 + Math.max(0, Math.floor(random() * 5));
  const maximum = intensity === "minimal" ? 2 : 3;
  return 1 + Math.max(1, Math.floor(random() * maximum));
}
