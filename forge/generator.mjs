// The creature-building flow is adapted from PF2E NPC Forge 0.13.0.
// See licenses/PF2E_NPC_FORGE_LICENSE.txt.

import { CyberwareTab } from "../sheets/CyberwareTab.js";
import {
  catalogEntry,
  cloneCatalogEntry,
  forgeFlag,
  interfaceKeysForEntries,
  interfaceTraitsHtml,
  loadCyberpunkCatalog,
} from "./catalog.mjs";
import {
  FORGE_BACKUP_FOLDER_NAME,
  FORGE_FLAG,
  FORGE_FOLDER_NAME,
  FORGE_VERSION,
  MODULE_ID,
} from "./constants.mjs";
import {
  buildLoadout,
  loadoutPreview,
  pickSecondaryWeapon,
} from "./loadout.mjs";
import { presetAbility } from "./preset-abilities.mjs";
import { normalizeForgeForm, resolvePreset, resolveRole } from "./presets.mjs";
import {
  deriveSeed,
  pick,
  randomName,
  randomSeed,
  seededRandom,
} from "./random.mjs";
import {
  FALLBACK_LANGUAGE_SLUGS,
  FALLBACK_SKILL_SLUGS,
  buildNpcSkillTiers,
  selectNpcDefenses,
  selectNpcLanguages,
  selectNpcSpeed,
} from "./statblock-random.mjs";
import { TIER_LABELS, eliteHpAdjustment, valueAt } from "./creature-tables.mjs";

const PUBLICATION = Object.freeze({
  authors: "Ogorodnik",
  license: "ORC",
  remaster: true,
  title: "SF2E Cyberpunk Remaster",
});

function publicationSource() {
  return { ...PUBLICATION };
}

const ANCESTRIES = Object.freeze({
  human: {
    label: "человек",
    trait: "human",
    speed: 25,
    languages: ["pact-common"],
    senses: [],
  },
  elf: {
    label: "эльф",
    trait: "elf",
    speed: 30,
    languages: ["pact-common", "elven"],
    senses: [{ type: "low-light-vision", acuity: "imprecise", range: null }],
  },
  dwarf: {
    label: "дварф",
    trait: "dwarf",
    speed: 20,
    languages: ["pact-common", "dwarven"],
    senses: [{ type: "darkvision", acuity: "precise", range: null }],
  },
  halfling: {
    label: "полурослик",
    trait: "halfling",
    speed: 25,
    languages: ["pact-common", "halfling"],
    senses: [],
  },
});

const ANCESTRY_POOL = Object.freeze([
  "human",
  "human",
  "human",
  "human",
  "human",
  "human",
  "elf",
  "dwarf",
  "halfling",
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return (
    String(value ?? "")
      .normalize("NFKD")
      .toLocaleLowerCase("ru-RU")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/gu, "") || "generated"
  );
}

function replaceDocumentData(data) {
  return typeof globalThis._replace === "function"
    ? globalThis._replace(data)
    : data;
}

function normalizeTier(table, tier) {
  if (tier === "terrible" && table !== "perception") return "low";
  if (table === "dc" && tier === "low") return "moderate";
  return tier;
}

function normalizeHpTier(tier) {
  if (tier === "terrible") return "low";
  if (tier === "extreme") return "high";
  return tier;
}

function resolveAbilities(role, level) {
  return Object.fromEntries(
    Object.entries(role.abilities).map(([ability, tier]) => [
      ability,
      {
        mod:
          tier === "terrible"
            ? -5
            : valueAt("ability", level, normalizeTier("ability", tier)),
      },
    ]),
  );
}

function configuredSlugs(configured, fallback) {
  return configured && typeof configured === "object"
    ? Object.keys(configured)
    : [...fallback];
}

function validSkillSlugs() {
  const configured = globalThis.CONFIG?.PF2E?.skills;
  return configuredSlugs(configured, FALLBACK_SKILL_SLUGS);
}

function validLanguageSlugs() {
  const configured = configuredSlugs(
    globalThis.CONFIG?.PF2E?.languages,
    FALLBACK_LANGUAGE_SLUGS,
  );
  let unavailable = new Set();
  try {
    const setting = globalThis.game?.settings?.get?.(
      "sf2e",
      "homebrew.languageRarities",
    );
    unavailable =
      setting?.unavailable instanceof Set
        ? setting.unavailable
        : new Set(setting?.unavailable ?? []);
  } catch {
    unavailable = new Set();
  }
  return configured.filter((slug) => !unavailable.has(slug));
}

function terribleSkillValue(level) {
  return valueAt("skill", level, "low") - 3;
}

function resolveSkills(role, preset, level, adjustment, random) {
  const valid = validSkillSlugs();
  const tiers = buildNpcSkillTiers({
    roleSkills: role.skills,
    presetId: preset.id,
    availableSkills: valid,
    level,
    random,
  });
  return Object.fromEntries(
    Object.entries(tiers).map(([slug, tier]) => [
      slug,
      {
        base:
          (tier === "terrible"
            ? terribleSkillValue(level)
            : valueAt("skill", level, normalizeTier("skill", tier))) +
          adjustment,
      },
    ]),
  );
}

function resolveTiers(form, role) {
  return Object.fromEntries(
    Object.keys(role.tiers).map((key) => {
      const override = form[`tier_${key}`];
      return [
        key,
        override && override !== "auto" ? override : role.tiers[key],
      ];
    }),
  );
}

function tierSummary(tiers) {
  return [
    ["КБ", tiers.ac],
    ["ОЗ", tiers.hp],
    ["Атака", tiers.attack],
    ["Урон", tiers.damage],
    ["Восприятие", tiers.perception],
    ["Стойкость", tiers.fortitude],
    ["Рефлекс", tiers.reflex],
    ["Воля", tiers.will],
    ["КС", tiers.dc],
  ]
    .map(([label, tier]) => `${label}: ${TIER_LABELS[tier] ?? tier}`)
    .join("; ");
}

function roleTactics(roleId) {
  const tactics = {
    assault: {
      opening: "занимает укрытие и открывает огонь по ближайшей опасной цели",
      routine: "перемещается между укрытиями и поддерживает давление",
      retreat: "отходит после потери половины группы или командира",
    },
    defender: {
      opening: "перекрывает проход и вынуждает врагов стрелять в него",
      routine: "держится рядом с союзником и не отдаёт позицию",
      retreat: "отступает последним, прикрывая остальных",
    },
    heavy: {
      opening: "выбирает сектор и готовит тяжёлое оружие",
      routine: "не двигается без необходимости и подавляет скопления целей",
      retreat: "отходит только при потере позиции или боеприпасов",
    },
    sniper: {
      opening: "стреляет из скрытой или дальней позиции",
      routine: "после раскрытия меняет позицию и снова прячется",
      retreat: "уходит сразу после потери дистанционного преимущества",
    },
    skirmisher: {
      opening: "заходит с фланга и проверяет слабое место построения",
      routine: "никогда не остаётся на одном месте два хода подряд",
      retreat: "разрывает дистанцию и уводит преследователей",
    },
    infiltrator: {
      opening: "атакует из скрытности или отключает важное устройство",
      routine: "работает по изолированным целям и избегает честного размена",
      retreat: "использует дым, двери и вертикальное пространство",
    },
    netrunner: {
      opening: "получает Доступ или запускает квикхак по совместимой цели",
      routine: "держится в укрытии и чередует программы с перемещением",
      retreat: "уходит при угрозе деке или потере защищённой позиции",
    },
    technician: {
      opening: "занимает место рядом с устройством, дроном или укрытием",
      routine: "чинит, ставит помехи и помогает основным бойцам",
      retreat: "забирает оборудование и отходит вместе с прикрытием",
    },
    medic: {
      opening: "остаётся рядом с наиболее уязвимым союзником",
      routine: "лечит раненых и стреляет только при отсутствии срочной работы",
      retreat: "эвакуирует раненого и избегает ближнего боя",
    },
    leader: {
      opening: "указывает приоритетную цель и распределяет позиции",
      routine: "поддерживает строй и меняет план при потерях",
      retreat: "организует отход до полного развала группы",
    },
    civilian: {
      opening: "ищет укрытие или пытается договориться",
      routine: "помогает подходящим навыком и избегает прямого боя",
      retreat: "сдаётся или убегает при первой безопасной возможности",
    },
    cyberpsycho: {
      opening: "несётся к самой заметной или опасной цели",
      routine: "продолжает атаковать, игнорируя безопасную позицию",
      retreat: "не отступает, пока физически способен действовать",
    },
    pkt: {
      opening: "использует сильнейшую систему корпуса для захвата инициативы",
      routine: "меняет оружие и импланты под текущую дистанцию",
      retreat: "отходит только по приказу или после критического повреждения",
    },
  };
  return tactics[roleId] ?? tactics.assault;
}

function validIwrEntries(entries, configKey) {
  const configured = globalThis.CONFIG?.PF2E?.[configKey];
  if (!configured || typeof configured !== "object") return entries;
  const allowed = new Set(Object.keys(configured));
  return entries.filter((entry) => allowed.has(entry.type));
}

function buildActorSystem({ form, preset, role, ancestry, loadout, random }) {
  const elite = form.quality === "elite";
  const adjustment = elite ? 2 : 0;
  const tiers = resolveTiers(form, role);
  const hpBase = valueAt("hp", form.level, normalizeHpTier(tiers.hp));
  const hp = hpBase + (elite ? eliteHpAdjustment(form.level) : 0);
  const skills = resolveSkills(role, preset, form.level, adjustment, random);
  const tactics = roleTactics(role.id);
  const interfaceHtml = interfaceTraitsHtml(loadout.interfaceKeys);
  const hasFocusProgram = linkedFocusIds(loadout.entries).length > 0;
  const languages = selectNpcLanguages({
    ancestryLanguages: ancestry.languages,
    presetId: preset.id,
    intelligenceTier: role.abilities.int,
    availableLanguages: validLanguageSlugs(),
    random,
  });
  const rawDefenses = selectNpcDefenses({
    presetId: preset.id,
    level: form.level,
    cyberwareCount:
      loadout.cyberware.length +
      (loadout.pkt ? loadout.pkt.components.length + 2 : 0),
    random,
  });
  const defenses = {
    ...rawDefenses,
    immunities: validIwrEntries(rawDefenses.immunities, "immunityTypes"),
    resistances: validIwrEntries(rawDefenses.resistances, "resistanceTypes"),
    weaknesses: validIwrEntries(rawDefenses.weaknesses, "weaknessTypes"),
  };
  const speed = selectNpcSpeed({
    baseSpeed: ancestry.speed,
    roleId: role.id,
    presetId: preset.id,
    random,
  });
  const dc =
    valueAt("dc", form.level, normalizeTier("dc", tiers.dc)) + adjustment;
  const areaDamage = valueAt("areaDamage", form.level, "moderate");
  const abilityDamage = elite ? `${areaDamage}+2` : areaDamage;
  const loadoutRows = loadoutPreview(loadout)
    .map(
      (row) =>
        `<li><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}</li>`,
    )
    .join("");
  const publicNotes = [
    interfaceHtml,
    `<p>${escapeHtml(ancestry.label)}, ${escapeHtml(preset.faction)}.</p>`,
    `<p><strong>Роль:</strong> ${escapeHtml(role.label)}. ${escapeHtml(
      role.description,
    )}</p>`,
  ].join("");
  const privateNotes = [
    `<h2>Тактика</h2>`,
    `<p><strong>Первый ход:</strong> ${escapeHtml(tactics.opening)}.</p>`,
    `<p><strong>Обычный цикл:</strong> ${escapeHtml(tactics.routine)}.</p>`,
    `<p><strong>Отступление:</strong> ${escapeHtml(tactics.retreat)}.</p>`,
    `<h2>Снаряжение Кузницы</h2><ul>${loadoutRows}</ul>`,
    `<p><strong>Шкалы:</strong> ${escapeHtml(tierSummary(tiers))}.</p>`,
    `<p><strong>Защитный профиль:</strong> ${escapeHtml(defenses.label)}.</p>`,
    loadout.warnings.length
      ? `<h3>Предупреждения</h3><ul>${loadout.warnings
          .map((warning) => `<li>${escapeHtml(warning)}</li>`)
          .join("")}</ul>`
      : "",
  ].join("");

  return {
    system: {
      abilities: resolveAbilities(role, form.level),
      attributes: {
        adjustment: null,
        ac: {
          details: loadout.armor?.name ?? "Без внешней брони",
          value:
            valueAt("ac", form.level, normalizeTier("ac", tiers.ac)) +
            adjustment,
        },
        allSaves: { value: "" },
        hp: {
          details: "",
          max: Math.max(1, hp),
          temp: 0,
          value: Math.max(1, hp),
        },
        immunities: defenses.immunities,
        resistances: defenses.resistances,
        speed: {
          details: "",
          otherSpeeds: [],
          value: speed,
        },
        weaknesses: defenses.weaknesses,
      },
      details: {
        alliance: "opposition",
        blurb: `${ancestry.label}, ${preset.faction}, роль «${role.label}»`,
        languages: {
          details: "",
          value: languages,
        },
        level: { value: form.level },
        publication: publicationSource(),
        publicNotes,
        privateNotes,
      },
      initiative: { statistic: role.initiative },
      perception: {
        details: "",
        mod: valueAt("perception", form.level, tiers.perception) + adjustment,
        senses: ancestry.senses,
        vision: true,
      },
      resources: {
        focus: {
          value: hasFocusProgram ? 1 : 0,
          max: hasFocusProgram ? 1 : 0,
        },
      },
      saves: {
        fortitude: {
          saveDetail: "",
          value:
            valueAt("perception", form.level, tiers.fortitude) + adjustment,
        },
        reflex: {
          saveDetail: "",
          value: valueAt("perception", form.level, tiers.reflex) + adjustment,
        },
        will: {
          saveDetail: "",
          value: valueAt("perception", form.level, tiers.will) + adjustment,
        },
      },
      skills,
      traits: {
        rarity: "common",
        size: { value: "med" },
        value: [ancestry.trait, "humanoid"],
      },
    },
    adjustment,
    abilityContext: {
      damage: abilityDamage,
      dc,
      healing: areaDamage,
      tempHp: Math.max(3, form.level + 3),
    },
    defenses,
    languages,
    skills,
    speed,
    tactics,
    tiers,
  };
}

export async function refreshNpcInterfaceSummary(actor) {
  if (
    actor?.type !== "npc" ||
    actor.flags?.[MODULE_ID]?.[FORGE_FLAG]?.generated !== true
  ) {
    return false;
  }
  const entries = [...actor.items]
    .filter(
      (item) =>
        !CyberwareTab.isCyberware(item) || CyberwareTab.isInstalled(item),
    )
    .map((item) => catalogEntry(item));
  const block = interfaceTraitsHtml(interfaceKeysForEntries(entries));
  const current = String(actor.system?.details?.publicNotes ?? "");
  const pattern = /<p class="cyberpunk-forge-interface-tags">[\s\S]*?<\/p>/iu;
  const updated = pattern.test(current)
    ? current.replace(pattern, block)
    : `${block}${current}`;
  if (updated === current) return false;
  await actor.update(
    { "system.details.publicNotes": updated },
    { cyberpunkForgeInterfaceUpdate: true },
  );
  return true;
}

function forgeItemFlags(kind, extra = {}) {
  return {
    [MODULE_ID]: {
      [FORGE_FLAG]: {
        generated: true,
        version: FORGE_VERSION,
        kind,
        ...extra,
      },
    },
  };
}

function validNpcAttackTraits(traits) {
  const configured = globalThis.CONFIG?.PF2E?.npcAttackTraits;
  const allowed =
    configured && typeof configured === "object"
      ? new Set(Object.keys(configured))
      : null;
  return [...new Set(traits)].filter((trait) => !allowed || allowed.has(trait));
}

function strikeDamageValue({ form, tiers, adjustment, weapon }) {
  const ranged = Number(weapon?.document?.system?.range ?? 0) > 0;
  const automaticExtreme = form.tier_damage === "auto";
  const damageTier =
    ranged && automaticExtreme && tiers.damage === "extreme"
      ? "high"
      : tiers.damage;
  const formula = valueAt(
    "damage",
    form.level,
    normalizeTier("damage", damageTier),
    "moderate",
  );
  return adjustment ? `${formula}+2` : formula;
}

function strikeSource({ form, tiers, adjustment, weapon }) {
  const document = weapon?.document;
  const ranged = Number(document?.system?.range ?? 0) > 0;
  const range = ranged ? Number(document.system.range) : null;
  const rawTraits = Array.isArray(document?.system?.traits?.value)
    ? document.system.traits.value
    : [];
  const traits = validNpcAttackTraits(rawTraits);
  const damage = strikeDamageValue({ form, tiers, adjustment, weapon });
  return {
    name: weapon?.name ?? "Безоружная атака",
    type: "melee",
    img: weapon?.document?.img ?? "systems/sf2e/icons/actions/OneAction.webp",
    flags: forgeItemFlags("strike", {
      sourceId: weapon?.id ?? null,
      sourceUuid: weapon?.uuid ?? null,
    }),
    system: {
      action: "strike",
      area: null,
      attackEffects: { value: [] },
      bonus: {
        value:
          valueAt("attack", form.level, normalizeTier("attack", tiers.attack)) +
          adjustment,
      },
      damageRolls: {
        main: {
          category: null,
          damage,
          damageType: document?.system?.damage?.damageType ?? "bludgeoning",
        },
      },
      description: {
        gm: "",
        value: weapon
          ? `<p>Рабочая NPC-атака для @UUID[${weapon.uuid}]{${escapeHtml(
              weapon.name,
            )}}. Урон рассчитан по уровню и роли NPC; физический предмет сохранён в инвентаре без изменения.</p>`
          : "<p>Рабочая безоружная атака NPC.</p>",
      },
      publication: publicationSource(),
      range: ranged ? { increment: range, max: null } : null,
      rules: [],
      slug: `cyberpunk-forge-strike-${slugify(weapon?.name ?? "unarmed")}`,
      subjectToMAP: true,
      traits: { value: traits, otherTags: [], config: {} },
    },
  };
}

function roleFeatureSource(role) {
  const feature = role.feature ?? {
    name: role.label,
    description: `<p>${escapeHtml(role.description)}</p>`,
  };
  return {
    name: feature.name,
    type: "action",
    img: "systems/sf2e/icons/actions/Passive.webp",
    flags: forgeItemFlags("role-feature", { role: role.id }),
    system: {
      actionType: { value: "passive" },
      actions: { value: null },
      category: "interaction",
      description: { gm: "", value: feature.description },
      publication: publicationSource(),
      rules: feature.rules ?? [],
      slug: `cyberpunk-forge-${slugify(feature.name)}`,
      traits: { value: [], otherTags: [] },
    },
  };
}

function abilityIcon(actionType, actions) {
  if (actionType === "reaction") {
    return "systems/sf2e/icons/actions/Reaction.webp";
  }
  if (actionType === "free") {
    return "systems/sf2e/icons/actions/FreeAction.webp";
  }
  if (actionType === "action") {
    const icon =
      { 1: "OneAction", 2: "TwoActions", 3: "ThreeActions" }[actions] ??
      "OneAction";
    return `systems/sf2e/icons/actions/${icon}.webp`;
  }
  return "systems/sf2e/icons/actions/Passive.webp";
}

function renderAbilityDescription(description, context) {
  return Object.entries(context).reduce(
    (result, [key, value]) =>
      result.replaceAll(`{${key}}`, String(value ?? "")),
    description,
  );
}

function presetAbilitySource(presetId, context) {
  const feature = presetAbility(presetId);
  if (!feature) return null;
  return {
    name: feature.name,
    type: "action",
    img: abilityIcon(feature.actionType, feature.actions),
    flags: forgeItemFlags("preset-feature", { preset: presetId }),
    system: {
      actionType: { value: feature.actionType },
      actions: { value: feature.actions },
      category: feature.category,
      description: {
        gm: "",
        value: renderAbilityDescription(feature.description, context),
      },
      publication: publicationSource(),
      rules: structuredClone(feature.rules ?? []),
      slug: `cyberpunk-forge-preset-${slugify(feature.name)}`,
      traits: { value: [...feature.traits], otherTags: [] },
    },
  };
}

function loadoutSources(loadout, secondaryWeapon) {
  const entries = [
    loadout.weapon,
    secondaryWeapon,
    loadout.armor,
    loadout.ammo,
    ...loadout.gear,
    ...loadout.cyberware,
  ].filter(Boolean);
  const seen = new Set();
  return entries
    .filter((entry) => {
      const key = `${entry.id}:${entry.parentSourceId ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((entry, index) =>
      cloneCatalogEntry(entry, {
        loadoutKey: `loadout-${index + 1}`,
        installed: entry.cyberware,
        parentSourceId: entry.parentSourceId ?? null,
        quantity:
          entry.category === "ammo" ? Math.max(1, loadout.ammoQuantity) : 1,
      }),
    );
}

function pktBaseSources(pkt) {
  if (!pkt) return [];
  return [
    cloneCatalogEntry(pkt.biosystem, {
      loadoutKey: "pkt-biosystem",
      kind: "pkt-biosystem",
      installed: true,
    }),
    cloneCatalogEntry(pkt.body, {
      loadoutKey: "pkt-body",
      kind: "pkt-body",
      installed: true,
    }),
  ];
}

function applyPktFlags(source, pkt, component, bodyId) {
  const entry = component.pktPlanEntry;
  source.flags ??= {};
  source.flags[MODULE_ID] ??= {};
  Object.assign(source.flags[MODULE_ID], {
    pktModelKey: pkt.model.key,
    pktComponentKey: entry.componentKey,
    pktModelSourceId: entry.itemId,
    pktFamily: entry.family ?? source.flags[MODULE_ID]?.pktFamily ?? null,
    pktLocked: entry.locked !== false,
    pktStress: entry.stress ?? "normal",
    pktBodyId: bodyId,
    pktParentFamily: entry.parentFamily ?? null,
    pktQuantityIndex: entry.quantityIndex,
    pktReplaceableBase: entry.replaceableBase === true,
  });
  return source;
}

function buildSpellEntry(name, prepared, dc, kind) {
  return {
    name,
    type: "spellcastingEntry",
    img: "systems/sf2e/icons/default-icons/spellcastingEntry.svg",
    flags: forgeItemFlags(kind),
    system: {
      ability: { value: "int" },
      autoHeightenLevel: { value: 1 },
      description: {
        gm: "",
        value:
          kind === "focus-entry"
            ? "<p>Фокусные программы, предоставленные установленной кибердекой.</p>"
            : "<p>Программы и квикхаки NPC из библиотеки SF2E Cyberpunk Remaster.</p>",
      },
      prepared: { value: prepared, flexible: false },
      proficiency: { value: 0 },
      publication: publicationSource(),
      rules: [],
      showSlotlessLevels: { value: false },
      slug: `cyberpunk-forge-${slugify(name)}`,
      slots: Object.fromEntries(
        Array.from({ length: 12 }, (_, rank) => [
          `slot${rank}`,
          { prepared: [], value: 0, max: 0 },
        ]),
      ),
      spelldc: { value: Math.max(0, dc - 8), dc },
      tradition: { value: "arcane" },
    },
  };
}

function linkedFocusIds(entries) {
  const ids = new Set();
  const pattern =
    /Compendium\.cyberpunk-remaster\.cyberpunk-items\.Item\.([A-Za-z0-9]{16})/gu;
  for (const entry of entries) {
    const html = String(entry.document?.system?.description?.value ?? "");
    for (const match of html.matchAll(pattern)) ids.add(match[1]);
  }
  return [...ids];
}

function spellRank(entry) {
  return entry.traits?.has("cantrip") ? 0 : Math.max(1, entry.level);
}

async function createSpellLoadout(actor, loadout, catalog, dc, level) {
  const linked = linkedFocusIds(loadout.entries)
    .map((id) => catalog.byId.get(id))
    .filter(
      (entry) =>
        entry?.document?.type === "spell" && entry.traits?.has("focus"),
    );
  const groups = [
    {
      entries: loadout.programs,
      name: "Кибердека",
      prepared: "prepared",
      kind: "program-entry",
    },
    {
      entries: linked,
      name: "Фокус кибердеки",
      prepared: "focus",
      kind: "focus-entry",
    },
  ].filter((group) => group.entries.length);
  const created = [];

  for (const group of groups) {
    const [entry] = await actor.createEmbeddedDocuments(
      "Item",
      [buildSpellEntry(group.name, group.prepared, dc, group.kind)],
      { cyberpunkForgeOperation: true },
    );
    if (!entry) throw new Error(`Не создана запись «${group.name}».`);

    const spellSources = group.entries.map((program, index) => {
      const source = cloneCatalogEntry(program, {
        loadoutKey: `${group.kind}-${index + 1}`,
        kind: group.kind === "focus-entry" ? "focus-program" : "program",
      });
      source.system ??= {};
      source.system.location = {
        ...(source.system.location ?? {}),
        value: entry.id,
      };
      return source;
    });
    const spells = await actor.createEmbeddedDocuments("Item", spellSources, {
      cyberpunkForgeOperation: true,
    });
    const slots = {};
    for (let rank = 0; rank <= 11; rank += 1) {
      const ids = spells
        .filter((spell, index) => spellRank(group.entries[index]) === rank)
        .map((spell) => ({ id: spell.id }));
      slots[`slot${rank}`] = {
        prepared: group.prepared === "prepared" ? ids : [],
        value: group.prepared === "prepared" ? 0 : ids.length,
        max: ids.length,
      };
    }
    await entry.update(
      {
        "system.slots": slots,
        "system.autoHeightenLevel.value": Math.max(
          1,
          Math.ceil(Number(level) / 2),
        ),
      },
      { cyberpunkForgeOperation: true },
    );
    created.push(entry, ...spells);
  }
  return created;
}

async function linkRegularModules(actor, created) {
  const basesBySource = new Map();
  for (const item of created) {
    const metadata = forgeFlag(item);
    if (metadata?.sourceId && CyberwareTab.getImplantType(item) === "base") {
      basesBySource.set(metadata.sourceId, item);
    }
  }
  const updates = [];
  for (const item of created) {
    const metadata = forgeFlag(item);
    if (!metadata?.parentSourceId) continue;
    const base = basesBySource.get(metadata.parentSourceId);
    if (!base) continue;
    updates.push({
      _id: item.id,
      [`flags.${MODULE_ID}.parentId`]: base.id,
    });
  }
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      cyberpunkForgeOperation: true,
    });
  }
}

async function createPktComponents(actor, pkt, body) {
  if (!pkt) return [];
  const sources = pkt.components.map((component, index) => {
    const source = cloneCatalogEntry(component, {
      loadoutKey: `pkt-component-${index + 1}`,
      kind: "pkt-component",
      installed: true,
    });
    return applyPktFlags(source, pkt, component, body.id);
  });
  const created = await actor.createEmbeddedDocuments("Item", sources, {
    cyberpunkForgeOperation: true,
    cyberpunkRemasterModelOperation: true,
  });
  const updates = CyberwareTab.pktModuleLinkUpdates(created);
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      cyberpunkForgeOperation: true,
      cyberpunkRemasterModelOperation: true,
    });
  }
  return created;
}

async function getOrCreateFolder(name) {
  const existing = globalThis.game?.folders?.find?.(
    (folder) => folder.type === "Actor" && folder.name === name,
  );
  if (existing) return existing;
  return globalThis.Folder?.create?.({ name, type: "Actor", sorting: "a" });
}

async function createBackup(actor) {
  if (!actor?.toObject) return null;
  const folder = await getOrCreateFolder(FORGE_BACKUP_FOLDER_NAME);
  const source = actor.toObject();
  delete source._id;
  delete source._stats;
  source.name = `${actor.name} — резерв ${new Date().toLocaleString("ru-RU")}`;
  source.folder = folder?.id ?? null;
  source.flags ??= {};
  source.flags[MODULE_ID] ??= {};
  source.flags[MODULE_ID][FORGE_FLAG] = {
    backup: true,
    version: FORGE_VERSION,
    sourceActorId: actor.id,
    sourceActorName: actor.name,
  };
  const created = await globalThis.Actor.create(source);
  return Array.isArray(created) ? created[0] : created;
}

function selectedNpcTarget({ strict = true } = {}) {
  const controlled = globalThis.canvas?.tokens?.controlled ?? [];
  if (controlled.length !== 1 || controlled[0]?.actor?.type !== "npc") {
    if (!strict) return null;
    throw new Error("Выберите ровно один токен NPC на активной сцене.");
  }
  return { actor: controlled[0].actor, token: controlled[0] };
}

export function selectedNpcInfo() {
  const selected = selectedNpcTarget({ strict: false });
  return selected
    ? {
        available: true,
        actorId: selected.actor.id,
        actorName: selected.actor.name,
        linked: selected.token.document.actorLink !== false,
      }
    : { available: false, actorId: null, actorName: null, linked: false };
}

function actorForgeFlags(concept) {
  return {
    [MODULE_ID]: {
      [FORGE_FLAG]: {
        generated: true,
        version: FORGE_VERSION,
        concept,
      },
    },
  };
}

function generatedItemIds(actor) {
  return [...actor.items]
    .filter((item) => forgeFlag(item)?.generated === true)
    .map((item) => item.id);
}

async function createFreshActor(name, system, concept, artwork = {}) {
  const folder = await getOrCreateFolder(FORGE_FOLDER_NAME);
  const created = await globalThis.Actor.create({
    name,
    type: "npc",
    folder: folder?.id ?? null,
    flags: actorForgeFlags(concept),
    system,
    ...artwork,
  });
  return Array.isArray(created) ? created[0] : created;
}

function sourceArtwork(actor, name) {
  if (!actor?.toObject) return {};
  const source = actor.toObject();
  const prototypeToken = source.prototypeToken
    ? structuredClone(source.prototypeToken)
    : null;
  if (prototypeToken) {
    delete prototypeToken._id;
    delete prototypeToken.actorId;
    prototypeToken.actorLink = true;
    prototypeToken.delta = {};
    prototypeToken.name = name;
  }
  return {
    ...(source.img ? { img: source.img } : {}),
    ...(prototypeToken ? { prototypeToken } : {}),
  };
}

async function createActorContent({
  actor,
  form,
  role,
  built,
  loadout,
  secondaryWeapon,
  catalog,
}) {
  const beforeIds = new Set([...actor.items].map((item) => item.id));
  try {
    const strikeWeapons = loadout.weapon
      ? [loadout.weapon, secondaryWeapon].filter(Boolean)
      : [null];
    const baseSources = [
      ...strikeWeapons.map((weapon) =>
        strikeSource({
          form,
          tiers: built.tiers,
          adjustment: built.adjustment,
          weapon,
        }),
      ),
      roleFeatureSource(role),
      presetAbilitySource(form.preset, built.abilityContext),
      ...loadoutSources(loadout, secondaryWeapon),
      ...pktBaseSources(loadout.pkt),
    ].filter(Boolean);
    const created = await actor.createEmbeddedDocuments("Item", baseSources, {
      cyberpunkForgeOperation: true,
    });
    await linkRegularModules(actor, created);

    let pktCreated = [];
    if (loadout.pkt) {
      const body = created.find((item) => forgeFlag(item)?.kind === "pkt-body");
      if (!body) throw new Error("Корпус ПКТ не создан.");
      pktCreated = await createPktComponents(actor, loadout.pkt, body);
    }
    const spellCreated = await createSpellLoadout(
      actor,
      loadout,
      catalog,
      built.abilityContext.dc,
      form.level,
    );
    await CyberwareTab.reconcileGrantedItems(actor);
    return [...created, ...pktCreated, ...spellCreated];
  } catch (error) {
    const rollback = [...actor.items]
      .filter((item) => !beforeIds.has(item.id))
      .map((item) => item.id);
    if (rollback.length) {
      try {
        await actor.deleteEmbeddedDocuments("Item", rollback, {
          cyberpunkForgeOperation: true,
        });
      } catch (rollbackError) {
        throw new Error(
          `${error.message} Откат новых предметов не завершён: ${rollbackError.message}`,
        );
      }
    }
    throw error;
  }
}

function resultConcept({ form, presetId, role, ancestry, seed, tiers }) {
  return {
    preset: presetId,
    role: role.id,
    ancestry: ancestry.id,
    level: form.level,
    quality: form.quality,
    tiers,
    seed,
    chromeIntensity: form.chromeIntensity,
    loadoutIntensity: form.loadoutIntensity,
  };
}

async function prepareGeneration(formValues, { index = 0 } = {}) {
  const form = normalizeForgeForm(formValues);
  const seed = deriveSeed(form.randomSeed || randomSeed(), `npc-${index + 1}`);
  const random = seededRandom(seed);
  const preset = { id: form.preset, ...resolvePreset(form.preset) };
  const role = resolveRole(preset, random);
  const ancestryId = pick(ANCESTRY_POOL, random) ?? "human";
  const ancestry = { id: ancestryId, ...ANCESTRIES[ancestryId] };
  const catalog = await loadCyberpunkCatalog();
  const loadout = await buildLoadout({
    catalog,
    form,
    preset,
    role,
    random,
  });
  const secondaryWeapon = pickSecondaryWeapon(
    catalog,
    loadout,
    preset,
    form,
    random,
  );
  if (secondaryWeapon) {
    loadout.secondaryWeapon = secondaryWeapon;
    loadout.entries.push(secondaryWeapon);
    loadout.interfaceKeys = interfaceKeysForEntries(loadout.entries);
  }
  const generatedName =
    form.name && form.count === 1
      ? form.name
      : randomName(seed, {
          prefix: role.id === "pkt" ? "ПКТ" : "",
          callsignChance: ["corporate-patrol", "corporate-response"].includes(
            form.preset,
          )
            ? 0.15
            : 0.45,
        });
  const name =
    form.name && form.count > 1 ? `${form.name} ${index + 1}` : generatedName;
  const built = buildActorSystem({
    form,
    preset,
    role,
    ancestry,
    loadout,
    random,
  });
  return {
    form,
    seed,
    preset,
    role,
    ancestry,
    catalog,
    loadout,
    secondaryWeapon,
    name,
    built,
    concept: resultConcept({
      form,
      presetId: form.preset,
      role,
      ancestry,
      seed,
      tiers: built.tiers,
    }),
  };
}

export async function previewNpc(formValues) {
  const prepared = await prepareGeneration(formValues);
  return {
    name: prepared.name,
    level: prepared.form.level,
    role: prepared.role.label,
    ancestry: prepared.ancestry.label,
    faction: prepared.preset.faction,
    loadout: loadoutPreview(prepared.loadout),
    interfaces: prepared.loadout.interfaceKeys,
    warnings: prepared.loadout.warnings,
    seed: prepared.seed,
    stats: {
      ac: prepared.built.system.attributes.ac.value,
      hp: prepared.built.system.attributes.hp.max,
      attack:
        valueAt(
          "attack",
          prepared.form.level,
          normalizeTier("attack", prepared.built.tiers.attack),
        ) + prepared.built.adjustment,
      dc: prepared.built.abilityContext.dc,
      damage: strikeDamageValue({
        form: prepared.form,
        tiers: prepared.built.tiers,
        adjustment: prepared.built.adjustment,
        weapon: prepared.loadout.weapon,
      }),
      perception: prepared.built.system.perception.mod,
      speed: prepared.built.speed,
    },
    defenses: prepared.built.defenses,
    languages: prepared.built.languages,
    skillCount: Object.keys(prepared.built.skills).length,
  };
}

export async function generateNpc(formValues, options = {}) {
  if (globalThis.game?.system?.id !== "sf2e") {
    throw new Error("Киберпанк-Кузница работает только в мире Starfinder 2e.");
  }
  if (!globalThis.game?.user?.isGM) {
    throw new Error("Создавать и перестраивать NPC может только ведущий.");
  }
  const prepared = await prepareGeneration(formValues, options);
  const { form } = prepared;
  let actor = null;
  let backup = null;
  let token = null;
  let createdActor = false;
  let oldItemIds = [];
  let originalItemIds = null;
  let original = null;

  if (form.target === "selected") {
    ({ actor, token } = selectedNpcTarget());
    originalItemIds = new Set([...actor.items].map((item) => item.id));
    oldItemIds = form.itemPolicy === "generated" ? generatedItemIds(actor) : [];
    if (form.backupOriginal) backup = await createBackup(actor);
    const source = actor.toObject();
    original = {
      name: actor.name,
      img: source.img,
      prototypeToken: structuredClone(source.prototypeToken),
      system: structuredClone(source.system),
      forge: structuredClone(actor.flags?.[MODULE_ID]?.[FORGE_FLAG] ?? null),
    };
    await actor.update({
      name: prepared.name,
      system: replaceDocumentData(prepared.built.system),
      [`flags.${MODULE_ID}.${FORGE_FLAG}`]: actorForgeFlags(prepared.concept)[
        MODULE_ID
      ][FORGE_FLAG],
    });
  } else if (form.target === "duplicate") {
    const selected = selectedNpcTarget();
    token = selected.token;
    actor = await createFreshActor(
      prepared.name,
      prepared.built.system,
      prepared.concept,
      sourceArtwork(selected.actor, prepared.name),
    );
    createdActor = true;
  } else {
    actor = await createFreshActor(
      prepared.name,
      prepared.built.system,
      prepared.concept,
    );
    createdActor = true;
  }

  if (!actor) throw new Error("Foundry не вернул созданного NPC.");
  let createdItems = [];
  try {
    createdItems = await createActorContent({
      actor,
      form,
      role: prepared.role,
      built: prepared.built,
      loadout: prepared.loadout,
      secondaryWeapon: prepared.secondaryWeapon,
      catalog: prepared.catalog,
    });
    if (oldItemIds.length) {
      await actor.deleteEmbeddedDocuments("Item", oldItemIds, {
        cyberpunkForgeOperation: true,
      });
      try {
        await CyberwareTab.reconcileGrantedItems(actor);
      } catch (reconcileError) {
        prepared.loadout.warnings.push(
          `Старые выданные имплантами предметы не удалось полностью согласовать: ${reconcileError.message}`,
        );
        console.warn(
          `${MODULE_ID} | Forge grant reconciliation failed after rebuild`,
          reconcileError,
        );
      }
    }
  } catch (error) {
    if (createdActor) {
      try {
        await actor.delete();
      } catch (cleanupError) {
        throw new Error(
          `${error.message} Неполный NPC не удалён: ${cleanupError.message}`,
        );
      }
    } else if (original) {
      let itemRollbackError = null;
      try {
        const addedItemIds = [...actor.items]
          .filter((item) => !originalItemIds?.has(item.id))
          .map((item) => item.id);
        if (addedItemIds.length) {
          await actor.deleteEmbeddedDocuments("Item", addedItemIds, {
            cyberpunkForgeOperation: true,
          });
        }
      } catch (cleanupError) {
        itemRollbackError = cleanupError;
      }
      try {
        await actor.update({
          name: original.name,
          img: original.img,
          prototypeToken: original.prototypeToken,
          system: replaceDocumentData(original.system),
          [`flags.${MODULE_ID}.${FORGE_FLAG}`]: original.forge,
        });
      } catch (rollbackError) {
        throw new Error(
          `${error.message} Лист не удалось полностью откатить: ${rollbackError.message}`,
        );
      }
      if (itemRollbackError) {
        throw new Error(
          `${error.message} Новые предметы не удалось полностью удалить при откате: ${itemRollbackError.message}`,
        );
      }
    }
    throw error;
  }

  try {
    await refreshNpcInterfaceSummary(actor);
  } catch (interfaceError) {
    prepared.loadout.warnings.push(
      `Строку интерфейсов не удалось обновить: ${interfaceError.message}`,
    );
    console.warn(
      `${MODULE_ID} | Forge interface summary update failed`,
      interfaceError,
    );
  }

  if (token) {
    try {
      if (form.target === "duplicate") {
        await token.document.update({
          actorId: actor.id,
          actorLink: true,
          delta: replaceDocumentData({}),
          name: prepared.name,
        });
      } else {
        await token.document.update({ name: prepared.name });
      }
    } catch (tokenError) {
      prepared.loadout.warnings.push(
        `NPC создан, но выбранный токен не обновлён: ${tokenError.message}`,
      );
      console.warn(`${MODULE_ID} | Forge token update failed`, tokenError);
    }
  }
  if (form.openSheet) actor.sheet?.render?.(true);

  return {
    actor,
    backup,
    created: createdActor,
    itemCount: createdItems.length,
    loadout: prepared.loadout,
    role: prepared.role,
    seed: prepared.seed,
    warnings: prepared.loadout.warnings,
  };
}

export async function generateNpcBatch(formValues) {
  const form = normalizeForgeForm(formValues);
  if (form.count > 1 && form.target !== "new") {
    throw new Error("Пакетно можно создавать только новых NPC.");
  }
  const baseSeed = form.randomSeed || randomSeed();
  const results = [];
  try {
    for (let index = 0; index < form.count; index += 1) {
      results.push(
        await generateNpc(
          {
            ...form,
            count: form.count,
            randomSeed: baseSeed,
            openSheet: form.count === 1 && form.openSheet,
          },
          { index },
        ),
      );
    }
    return results;
  } catch (error) {
    for (const result of results.reverse()) {
      try {
        await result.actor?.delete?.();
      } catch (cleanupError) {
        console.warn(
          `${MODULE_ID} | Не удалось удалить неполную пакетную сборку`,
          cleanupError,
        );
      }
    }
    throw new Error(
      `Пакетная сборка остановлена, уже созданные NPC удалены. ${error.message}`,
    );
  }
}

export function inferPresetFromPrompt(prompt) {
  const text = String(prompt ?? "").toLocaleLowerCase("ru-RU");
  const rules = [
    ["pkt-operative", /пкт|полная конверси/iu],
    ["cyberpsycho", /киберпсих/iu],
    ["netrunner", /нетран|хакер|взломщик/iu],
    ["medic", /медик|врач|хирург/iu],
    ["technician", /техник|механик|инженер|сапер|сапёр/iu],
    ["corporate-sniper", /снайпер/iu],
    ["corporate-netwatch", /сетев.*безопас|netwatch/iu],
    ["corporate-response", /спецназ|быстр.*реаг|штурмов.*груп/iu],
    ["street-ripperdoc", /риппер/iu],
    ["street-enforcer", /громила|вышибала/iu],
    ["street-ganger", /банд|гангер|уличн/iu],
    ["corporate-patrol", /корпорат|охрана|патруль/iu],
    ["nomad", /кочевн|номад/iu],
    ["fixer", /фиксер|посредник/iu],
    ["investigator", /детектив|следоват/iu],
    ["solo", /соло|наемник|наёмник/iu],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

export function summarizeResult(result) {
  return {
    name: result.actor?.name,
    uuid: result.actor?.uuid,
    role: result.role?.label,
    itemCount: result.itemCount,
    seed: result.seed,
    warnings: result.warnings,
  };
}

export { normalizeForgeForm };
