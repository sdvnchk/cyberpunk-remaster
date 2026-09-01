// v1.4.29 — narrative stat profiles for Киберпанк-Кузница NPC.
// Role profiles remain the primary chassis. "Кто это" then nudges automatic
// ability modifiers, saves and skills toward the selected faction/occupation.
// Manual Forge overrides always win after these profiles are applied.

const TIER_ORDER = Object.freeze(["terrible", "low", "moderate", "high", "extreme"]);

export function shiftStatTier(tier, steps = 0) {
  const index = TIER_ORDER.indexOf(String(tier ?? "moderate"));
  const base = index >= 0 ? index : TIER_ORDER.indexOf("moderate");
  const next = Math.max(0, Math.min(TIER_ORDER.length - 1, base + Math.trunc(Number(steps) || 0)));
  return TIER_ORDER[next];
}

function mergeShift(target, source = {}) {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[key] = (Number(target[key]) || 0) + (Number(value) || 0);
  }
  return target;
}

function mergeSkills(target, source = {}) {
  for (const [slug, tier] of Object.entries(source ?? {})) {
    const current = target[slug];
    if (!current) {
      target[slug] = tier;
      continue;
    }
    const currentIndex = TIER_ORDER.indexOf(current);
    const nextIndex = TIER_ORDER.indexOf(tier);
    if (nextIndex > currentIndex) target[slug] = tier;
  }
  return target;
}

const GROUP_PROFILES = Object.freeze({
  corporate: {
    abilities: { int: 1, wis: 1 },
    saves: { will: 1 },
    skills: { society: "moderate", computers: "moderate" },
  },
  law: {
    abilities: { con: 1, wis: 1 },
    saves: { fortitude: 1, will: 1 },
    skills: { society: "moderate", intimidation: "moderate" },
  },
  street: {
    abilities: { dex: 1 },
    saves: { reflex: 1 },
    skills: { intimidation: "moderate", thievery: "low" },
  },
  specialist: {
    abilities: { int: 1 },
    saves: { will: 1 },
    skills: { crafting: "moderate" },
  },
  civilian: {
    abilities: { cha: 1 },
    saves: {},
    skills: { society: "moderate" },
  },
  independent: {
    abilities: { wis: 1 },
    saves: { will: 1 },
    skills: { survival: "low" },
  },
  extreme: {
    abilities: { str: 1, con: 1 },
    saves: { fortitude: 1 },
    skills: { athletics: "high", intimidation: "high" },
  },
});

// These profiles intentionally describe tendencies rather than hard templates.
// Role still matters: a Danger Gal netrunner and a Danger Gal assault operative
// will share the faction bias, but their role chassis remains very different.
const WHO_PROFILES = Object.freeze([
  {
    test: /danger gal/iu,
    abilities: { dex: 1, int: 1, wis: 1 },
    saves: { reflex: 1, will: 1 },
    skills: { society: "high", stealth: "high", computers: "moderate", diplomacy: "moderate" },
  },
  {
    test: /max-?tac|maxtac/iu,
    abilities: { str: 1, dex: 1, con: 1 },
    saves: { fortitude: 1, reflex: 1, will: 1 },
    skills: { athletics: "high", intimidation: "high", computers: "moderate" },
  },
  {
    test: /\bncpd\b|lawman|bounty/iu,
    abilities: { con: 1, wis: 1 },
    saves: { fortitude: 1, will: 1 },
    skills: { society: "high", intimidation: "moderate", athletics: "moderate", diplomacy: "moderate" },
  },
  {
    test: /trauma team/iu,
    abilities: { int: 1, wis: 1, con: 1 },
    saves: { fortitude: 1, will: 1 },
    skills: { medicine: "high", crafting: "moderate", piloting: "moderate" },
  },
  {
    test: /\barasaka\b/iu,
    abilities: { dex: 1, int: 1, wis: 1 },
    saves: { reflex: 1, will: 1 },
    skills: { computers: "high", society: "high", stealth: "moderate", deception: "moderate" },
  },
  {
    test: /\bmilitech\b/iu,
    abilities: { str: 1, dex: 1, con: 1 },
    saves: { fortitude: 1, reflex: 1 },
    skills: { athletics: "high", crafting: "moderate", intimidation: "moderate", survival: "moderate" },
  },
  {
    test: /biotechnica/iu,
    abilities: { int: 1, wis: 1 },
    saves: { fortitude: 1, will: 1 },
    skills: { medicine: "high", crafting: "high", computers: "moderate", survival: "moderate" },
  },
  {
    test: /ziggurat|network\s*54/iu,
    abilities: { int: 1, wis: 1, cha: 1 },
    saves: { will: 1 },
    skills: { computers: "high", society: "high", diplomacy: "moderate" },
  },
  {
    test: /petrochem|sovoil/iu,
    abilities: { con: 1, str: 1, int: 1 },
    saves: { fortitude: 1 },
    skills: { survival: "high", crafting: "moderate", athletics: "moderate" },
  },
  {
    test: /rocklin augmentics|rocklin/iu,
    abilities: { int: 1, dex: 1 },
    saves: { reflex: 1 },
    skills: { crafting: "high", computers: "high", medicine: "moderate" },
  },
  {
    test: /zhirafa/iu,
    abilities: { int: 1, wis: 1 },
    saves: { reflex: 1 },
    skills: { piloting: "high", crafting: "high", computers: "moderate" },
  },
  {
    test: /maelstrom/iu,
    abilities: { str: 1, con: 1 },
    saves: { fortitude: 1 },
    skills: { athletics: "high", intimidation: "high", crafting: "moderate" },
  },
  {
    test: /tyger claws?/iu,
    abilities: { dex: 1, cha: 1 },
    saves: { reflex: 1, will: 1 },
    skills: { acrobatics: "high", stealth: "high", intimidation: "moderate" },
  },
  {
    test: /6th street|sixth street/iu,
    abilities: { str: 1, con: 1, wis: 1 },
    saves: { fortitude: 1, will: 1 },
    skills: { athletics: "high", survival: "high", intimidation: "moderate" },
  },
  {
    test: /the mox|\bmox\b/iu,
    abilities: { dex: 1, cha: 1, wis: 1 },
    saves: { reflex: 1, will: 1 },
    skills: { diplomacy: "high", intimidation: "high", performance: "moderate", stealth: "moderate" },
  },
  {
    test: /animals|животн/iu,
    abilities: { str: 1, con: 1 },
    saves: { fortitude: 1 },
    skills: { athletics: "extreme", intimidation: "high" },
  },
  {
    test: /valentinos?/iu,
    abilities: { dex: 1, cha: 1 },
    saves: { reflex: 1, will: 1 },
    skills: { intimidation: "high", performance: "moderate", diplomacy: "moderate" },
  },
  {
    test: /scavengers|\bscavs\b|scavvers/iu,
    abilities: { dex: 1, int: 1, con: 1 },
    saves: { reflex: 1, fortitude: 1 },
    skills: { thievery: "high", crafting: "high", stealth: "moderate", survival: "moderate" },
  },
  {
    test: /wraiths?/iu,
    abilities: { dex: 1, con: 1, wis: 1 },
    saves: { reflex: 1, fortitude: 1 },
    skills: { survival: "high", piloting: "high", stealth: "moderate" },
  },
  {
    test: /voodoo boys|netcell|netwatch/iu,
    abilities: { int: 1, wis: 1, dex: 1 },
    saves: { will: 1, reflex: 1 },
    skills: { computers: "extreme", crafting: "high", stealth: "moderate", society: "moderate" },
  },
  {
    test: /inquisitor/iu,
    abilities: { wis: 1, con: 1 },
    saves: { will: 1, fortitude: 1 },
    skills: { survival: "high", intimidation: "high", society: "moderate" },
  },
  {
    test: /red chrome legion/iu,
    abilities: { str: 1, con: 1 },
    saves: { fortitude: 1, will: 1 },
    skills: { intimidation: "high", athletics: "high", survival: "moderate" },
  },
  {
    test: /bozos?/iu,
    abilities: { cha: 1, dex: 1 },
    saves: { reflex: 1 },
    skills: { performance: "high", deception: "high", intimidation: "high" },
  },
  {
    test: /piranhas?/iu,
    abilities: { cha: 1, dex: 1 },
    saves: { reflex: 1, will: 1 },
    skills: { performance: "high", diplomacy: "moderate", deception: "moderate" },
  },
  {
    test: /prime-time players|rockerboy|media/iu,
    abilities: { cha: 1, int: 1 },
    saves: { will: 1 },
    skills: { performance: "high", diplomacy: "high", society: "high", deception: "moderate" },
  },
  {
    test: /reckoners?/iu,
    abilities: { wis: 1, cha: 1 },
    saves: { will: 1 },
    skills: { intimidation: "high", survival: "moderate", society: "moderate" },
  },
  {
    test: /generation red/iu,
    abilities: { dex: 1, wis: 1 },
    saves: { reflex: 1, will: 1 },
    skills: { stealth: "high", survival: "high", thievery: "moderate" },
  },
  {
    test: /nomad|driver|courier|taxi/iu,
    abilities: { dex: 1, wis: 1 },
    saves: { reflex: 1 },
    skills: { piloting: "high", survival: "moderate", crafting: "moderate" },
  },
  {
    test: /ripperdoc|clinic|medic/iu,
    abilities: { int: 1, wis: 1 },
    saves: { will: 1 },
    skills: { medicine: "high", crafting: "high" },
  },
  {
    test: /technician|weaponsmith|mechanic|factory|construction|demolition|drone|bd-tech/iu,
    abilities: { int: 1, dex: 1 },
    saves: { reflex: 1 },
    skills: { crafting: "high", computers: "moderate", thievery: "moderate" },
  },
  {
    test: /fixer|shopkeeper|street-vendor|merchant|exec/iu,
    abilities: { cha: 1, int: 1 },
    saves: { will: 1 },
    skills: { diplomacy: "high", society: "high", deception: "moderate" },
  },
  {
    test: /investigator|detective|forensic/iu,
    abilities: { int: 1, wis: 1 },
    saves: { will: 1 },
    skills: { society: "high", computers: "moderate", medicine: "moderate", deception: "moderate" },
  },
]);

function profileSignature(preset = {}) {
  return `${preset.id ?? ""} ${preset.label ?? ""} ${preset.faction ?? ""} ${preset.group ?? ""}`;
}

export function automaticStatBias(preset = {}) {
  const abilities = {};
  const saves = {};
  const skills = {};
  const groupProfile = GROUP_PROFILES[preset.group] ?? {};
  mergeShift(abilities, groupProfile.abilities);
  mergeShift(saves, groupProfile.saves);
  mergeSkills(skills, groupProfile.skills);

  const signature = profileSignature(preset);
  for (const profile of WHO_PROFILES) {
    if (!profile.test.test(signature)) continue;
    mergeShift(abilities, profile.abilities);
    mergeShift(saves, profile.saves);
    mergeSkills(skills, profile.skills);
    break;
  }
  for (const target of [abilities, saves]) {
    for (const key of Object.keys(target)) {
      target[key] = Math.max(-1, Math.min(1, Number(target[key]) || 0));
    }
  }
  return { abilities, saves, skills };
}

export function resolveAutomaticAbilityTiers(role = {}, preset = {}) {
  const bias = automaticStatBias(preset).abilities;
  return Object.fromEntries(
    Object.entries(role.abilities ?? {}).map(([ability, tier]) => [
      ability,
      shiftStatTier(tier, bias[ability] ?? 0),
    ]),
  );
}

export function resolveAutomaticSaveTiers(role = {}, preset = {}) {
  const bias = automaticStatBias(preset).saves;
  const keys = ["fortitude", "reflex", "will"];
  return Object.fromEntries(
    keys.map((key) => [key, shiftStatTier(role.tiers?.[key] ?? "moderate", bias[key] ?? 0)]),
  );
}

export function presetSkillTiers(preset = {}) {
  return { ...automaticStatBias(preset).skills };
}
