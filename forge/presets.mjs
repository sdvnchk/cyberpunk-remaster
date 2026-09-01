import { DEFAULT_FORM } from "./constants.mjs";
import { pick } from "./random.mjs";

const BASE_ABILITIES = Object.freeze({
  str: "moderate",
  dex: "moderate",
  con: "moderate",
  int: "moderate",
  wis: "moderate",
  cha: "moderate",
});

const BASE_TIERS = Object.freeze({
  ac: "moderate",
  hp: "moderate",
  attack: "moderate",
  damage: "moderate",
  perception: "moderate",
  fortitude: "moderate",
  reflex: "moderate",
  will: "moderate",
  dc: "moderate",
});

function role({
  label,
  description,
  abilities = {},
  tiers = {},
  skills = {},
  initiative = "perception",
  feature,
}) {
  return Object.freeze({
    label,
    description,
    abilities: { ...BASE_ABILITIES, ...abilities },
    tiers: { ...BASE_TIERS, ...tiers },
    skills,
    initiative,
    feature,
  });
}

export const ROLE_PROFILES = Object.freeze({
  assault: role({
    label: "Штурмовик",
    description: "Давит огнём, меняет позиции и добивает ослабленные цели.",
    abilities: { str: "high", dex: "high", con: "high", int: "low" },
    tiers: {
      ac: "high",
      hp: "high",
      attack: "high",
      damage: "high",
      fortitude: "high",
      reflex: "moderate",
    },
    skills: { athletics: "high", intimidation: "moderate" },
    feature: {
      name: "Боевой темп",
      description:
        "<p>Если штурмовик в этом ходу переместился как минимум на 10 футов, он получает обстоятельственный бонус +1 к первой атаке дальнобойным оружием.</p>",
    },
  }),
  defender: role({
    label: "Защитник",
    description:
      "Держит проход, прикрывает союзников и переживает ответный огонь.",
    abilities: { str: "high", con: "extreme", dex: "low" },
    tiers: {
      ac: "high",
      hp: "high",
      attack: "moderate",
      damage: "moderate",
      fortitude: "high",
      reflex: "low",
      will: "high",
    },
    skills: { athletics: "high", intimidation: "moderate" },
    feature: {
      name: "Закрыть сектор",
      description:
        "<p>Клетки рядом с защитником являются сложной местностью для врагов, пока он способен действовать.</p>",
    },
  }),
  heavy: role({
    label: "Тяжёлый стрелок",
    description: "Занимает позицию и перекрывает сектор тяжёлым оружием.",
    abilities: { str: "extreme", con: "high", dex: "moderate" },
    tiers: {
      ac: "moderate",
      hp: "high",
      attack: "high",
      damage: "extreme",
      fortitude: "high",
      reflex: "low",
    },
    skills: { athletics: "high", intimidation: "high" },
    feature: {
      name: "Подготовленная позиция",
      description:
        "<p>Если стрелок не двигался с начала прошлого хода, его первая дальнобойная атака получает обстоятельственный бонус +1.</p>",
    },
  }),
  sniper: role({
    label: "Снайпер",
    description:
      "Работает с дальней дистанции и меняет позицию после выстрела.",
    abilities: { dex: "extreme", wis: "high", str: "low" },
    tiers: {
      ac: "moderate",
      hp: "low",
      attack: "extreme",
      damage: "high",
      perception: "high",
      reflex: "high",
      fortitude: "low",
    },
    skills: { stealth: "extreme", survival: "high" },
    initiative: "stealth",
    feature: {
      name: "Холодный выстрел",
      description:
        "<p>Первая дальнобойная атака снайпера по цели, которая ещё не действовала в столкновении, наносит дополнительно 1d6 точного урона.</p>",
    },
  }),
  skirmisher: role({
    label: "Застрельщик",
    description: "Постоянно двигается, заходит во фланг и не держит линию.",
    abilities: { dex: "high", con: "moderate", str: "moderate" },
    tiers: {
      ac: "high",
      hp: "moderate",
      attack: "high",
      damage: "moderate",
      reflex: "high",
      fortitude: "low",
    },
    skills: { acrobatics: "high", stealth: "high" },
    initiative: "stealth",
    feature: {
      name: "Лёгкий шаг",
      description:
        "<p>Первый раз за раунд после перемещения как минимум на 10 футов застрельщик может Шагнуть свободным действием.</p>",
    },
  }),
  infiltrator: role({
    label: "Лазутчик",
    description: "Проникает в охраняемые зоны и устраняет цели без тревоги.",
    abilities: { dex: "extreme", int: "high", cha: "moderate", str: "low" },
    tiers: {
      ac: "high",
      hp: "low",
      attack: "high",
      damage: "high",
      perception: "high",
      reflex: "high",
      fortitude: "low",
    },
    skills: {
      stealth: "extreme",
      thievery: "high",
      deception: "high",
      computers: "moderate",
    },
    initiative: "stealth",
    feature: {
      name: "Беззвучное проникновение",
      description:
        "<p>Лазутчик получает обстоятельственный бонус +1 к Скрытности и Воровству при проникновении в охраняемую область.</p>",
      rules: [
        {
          key: "FlatModifier",
          selector: ["stealth", "thievery"],
          type: "circumstance",
          value: 1,
        },
      ],
    },
  }),
  netrunner: role({
    label: "Нетраннер",
    description: "Вскрывает интерфейсы, ставит помехи и запускает программы.",
    abilities: { int: "extreme", dex: "high", wis: "high", str: "low" },
    tiers: {
      ac: "moderate",
      hp: "low",
      attack: "moderate",
      damage: "low",
      perception: "high",
      reflex: "high",
      will: "high",
      dc: "extreme",
    },
    skills: {
      computers: "extreme",
      arcana: "high",
      stealth: "moderate",
      society: "high",
    },
    feature: {
      name: "Боевой аплинк",
      description:
        "<p>Нетраннер использует Компьютеры для своих программ. КС взлома и КС программ указаны в записи «Кибердека».</p>",
    },
  }),
  technician: role({
    label: "Техник",
    description:
      "Ремонтирует устройства, обходит защиту и поддерживает группу.",
    abilities: { int: "extreme", dex: "moderate", wis: "high", str: "low" },
    tiers: {
      ac: "moderate",
      hp: "moderate",
      attack: "moderate",
      damage: "low",
      perception: "high",
      will: "high",
      dc: "high",
    },
    skills: {
      crafting: "extreme",
      computers: "high",
      thievery: "high",
    },
    feature: {
      name: "Полевой ремонт",
      description:
        "<p>Техник получает обстоятельственный бонус +1 к Ремеслу и Компьютерам при ремонте и диагностике устройств.</p>",
      rules: [
        {
          key: "FlatModifier",
          selector: ["crafting", "computers"],
          type: "circumstance",
          value: 1,
        },
      ],
    },
  }),
  medic: role({
    label: "Медик",
    description: "Стабилизирует раненых и поддерживает бойцов расходниками.",
    abilities: { wis: "extreme", int: "high", dex: "moderate", str: "low" },
    tiers: {
      ac: "moderate",
      hp: "moderate",
      attack: "low",
      damage: "low",
      perception: "high",
      will: "high",
      dc: "high",
    },
    skills: {
      medicine: "extreme",
      crafting: "high",
      diplomacy: "moderate",
    },
    feature: {
      name: "Уверенная рука",
      description:
        "<p>Медик получает обстоятельственный бонус +1 ко всем проверкам Медицины.</p>",
      rules: [
        {
          key: "FlatModifier",
          selector: "medicine",
          type: "circumstance",
          value: 1,
        },
      ],
    },
  }),
  leader: role({
    label: "Командир",
    description: "Распределяет цели, держит строй и организует отход.",
    abilities: { cha: "extreme", wis: "high", int: "high" },
    tiers: {
      ac: "high",
      hp: "moderate",
      attack: "moderate",
      damage: "moderate",
      perception: "high",
      will: "extreme",
      dc: "high",
    },
    skills: {
      diplomacy: "extreme",
      intimidation: "high",
      society: "high",
    },
    feature: {
      name: "Командная сеть",
      description:
        "<p>Союзники в пределах 15 футов получают обстоятельственный бонус +1 к спасброскам против страха.</p>",
    },
  }),
  civilian: role({
    label: "Гражданский",
    description:
      "Профессионал, свидетель или сотрудник без боевой специализации.",
    abilities: { int: "high", cha: "high", str: "low", con: "low" },
    tiers: {
      ac: "low",
      hp: "low",
      attack: "low",
      damage: "low",
      perception: "moderate",
      fortitude: "low",
      reflex: "low",
    },
    skills: { society: "high", diplomacy: "high" },
    feature: {
      name: "Городской специалист",
      description:
        "<p>Выберите одну профессиональную область. Гражданский получает обстоятельственный бонус +1 к связанной проверке знания или ремесла.</p>",
    },
  }),
  cyberpsycho: role({
    label: "Киберпсих",
    description: "Перегруженный боевым хромом убийца, потерявший контроль.",
    abilities: { str: "extreme", dex: "high", con: "extreme", cha: "terrible" },
    tiers: {
      ac: "high",
      hp: "extreme",
      attack: "extreme",
      damage: "extreme",
      perception: "high",
      fortitude: "extreme",
      reflex: "high",
      will: "low",
    },
    skills: { athletics: "extreme", intimidation: "extreme" },
    feature: {
      name: "Срыв ограничителей",
      description:
        "<p>Пока у киберпсиха не больше половины ОЗ, его Удары наносят дополнительно 2 урона, но он получает штраф −1 к КБ.</p>",
    },
  }),
  pkt: role({
    label: "Оперативник ПКТ",
    description:
      "Полная конверсия тела, собранная под конкретную боевую задачу.",
    abilities: { str: "extreme", dex: "high", con: "extreme", int: "high" },
    tiers: {
      ac: "extreme",
      hp: "extreme",
      attack: "high",
      damage: "high",
      perception: "high",
      fortitude: "extreme",
      reflex: "high",
      will: "high",
      dc: "high",
    },
    skills: { athletics: "high", computers: "high", intimidation: "high" },
    feature: {
      name: "Полная конверсия",
      description:
        "<p>Существо использует правила Полной Конверсии Тела. Все компоненты установленной модели перечислены в его инвентаре.</p>",
    },
  }),
});

export const PRESET_GROUPS = Object.freeze({
  corporate: { label: "Корпорации", icon: "fa-solid fa-building-shield" },
  street: { label: "Улица", icon: "fa-solid fa-city" },
  independent: { label: "Независимые", icon: "fa-solid fa-user-secret" },
  specialist: { label: "Специалисты", icon: "fa-solid fa-microchip" },
  extreme: { label: "Особые угрозы", icon: "fa-solid fa-skull" },
});

function preset(values) {
  return Object.freeze({
    count: 1,
    quality: "standard",
    weaponProfiles: ["any"],
    armorProfiles: ["light"],
    chromeRange: [0, 1],
    moduleChance: 0.35,
    consumableRange: [0, 1],
    implantFamilies: [],
    allowUnique: false,
    includePrograms: false,
    pkt: false,
    ...values,
  });
}

export const CYBERPUNK_PRESETS = Object.freeze({
  "corporate-patrol": preset({
    label: "Корпоративный патруль",
    group: "corporate",
    icon: "fa-solid fa-shield",
    description: "Охрана, патруль и мобильная группа контроля.",
    level: 3,
    roles: ["assault", "defender", "skirmisher"],
    weaponProfiles: ["pistol", "smg", "rifle", "nonlethal"],
    armorProfiles: ["light", "medium"],
    chromeRange: [1, 3],
    moduleChance: 0.45,
    consumableRange: [1, 2],
    implantFamilies: ["neural", "optics", "audio"],
    faction: "корпоративная служба безопасности",
  }),
  "corporate-response": preset({
    label: "Группа быстрого реагирования",
    group: "corporate",
    icon: "fa-solid fa-people-group",
    description: "Тяжёлая корпоративная команда для горячих зон.",
    level: 7,
    roles: ["assault", "defender", "heavy", "medic", "leader"],
    weaponProfiles: ["rifle", "shotgun", "heavy", "pistol"],
    armorProfiles: ["medium", "heavy"],
    chromeRange: [2, 5],
    moduleChance: 0.6,
    consumableRange: [1, 3],
    implantFamilies: ["neural", "optics", "audio", "arm"],
    faction: "корпоративная группа быстрого реагирования",
  }),
  "corporate-sniper": preset({
    label: "Корпоративный снайпер",
    group: "corporate",
    icon: "fa-solid fa-crosshairs",
    description: "Дальний огонь, наблюдение и точечное устранение.",
    level: 6,
    roles: ["sniper", "infiltrator"],
    weaponProfiles: ["sniper", "rifle"],
    armorProfiles: ["light", "medium"],
    chromeRange: [2, 4],
    moduleChance: 0.65,
    consumableRange: [1, 2],
    implantFamilies: ["optics", "neural", "audio"],
    faction: "корпоративная служба специальных операций",
  }),
  "corporate-netwatch": preset({
    label: "Сетевая безопасность",
    group: "corporate",
    icon: "fa-solid fa-network-wired",
    description: "Нетраннер или техник, прикрывающий корпоративную сеть.",
    level: 6,
    roles: ["netrunner", "technician"],
    weaponProfiles: ["pistol", "smg"],
    armorProfiles: ["light"],
    chromeRange: [2, 5],
    moduleChance: 0.7,
    consumableRange: [1, 2],
    implantFamilies: ["neural", "optics", "audio"],
    includePrograms: true,
    faction: "корпоративная сетевая безопасность",
  }),
  "street-ganger": preset({
    label: "Уличный бандит",
    group: "street",
    icon: "fa-solid fa-user-ninja",
    description: "Дешёвое оружие, разный хром и никакой строевой подготовки.",
    level: 2,
    roles: ["skirmisher", "assault", "civilian"],
    weaponProfiles: ["pistol", "smg", "melee", "shotgun"],
    armorProfiles: ["none", "light"],
    chromeRange: [0, 2],
    moduleChance: 0.25,
    consumableRange: [0, 2],
    implantFamilies: ["fashion", "arm", "neural"],
    faction: "уличная банда",
  }),
  "street-enforcer": preset({
    label: "Бандит-громила",
    group: "street",
    icon: "fa-solid fa-hand-fist",
    description: "Силовик банды с тяжёлым оружием или боевым хромом.",
    level: 5,
    roles: ["assault", "defender", "heavy"],
    weaponProfiles: ["shotgun", "heavy", "melee", "smg"],
    armorProfiles: ["light", "medium"],
    chromeRange: [2, 5],
    moduleChance: 0.5,
    consumableRange: [0, 2],
    implantFamilies: ["arm", "leg", "internal"],
    faction: "уличная банда",
  }),
  scavenger: preset({
    label: "Мусорщик",
    group: "street",
    icon: "fa-solid fa-recycle",
    description: "Собирает рабочее железо из несовместимых и дешёвых деталей.",
    level: 3,
    roles: ["technician", "skirmisher", "assault"],
    weaponProfiles: ["any", "melee"],
    armorProfiles: ["none", "light"],
    chromeRange: [1, 4],
    moduleChance: 0.35,
    consumableRange: [1, 3],
    implantFamilies: ["external", "arm", "leg", "neural"],
    faction: "бригада мусорщиков",
  }),
  "street-ripperdoc": preset({
    label: "Подпольный риппер",
    group: "street",
    icon: "fa-solid fa-syringe",
    description: "Уличный хирург с медицинским и техническим снаряжением.",
    level: 4,
    roles: ["medic", "technician"],
    weaponProfiles: ["pistol", "melee"],
    armorProfiles: ["none", "light"],
    chromeRange: [1, 3],
    moduleChance: 0.4,
    consumableRange: [2, 4],
    implantFamilies: ["neural", "optics", "internal"],
    faction: "подпольная клиника",
  }),
  solo: preset({
    label: "Соло",
    group: "independent",
    icon: "fa-solid fa-gun",
    description: "Профессиональный наёмник со своим стилем и набором хрома.",
    level: 6,
    roles: ["assault", "sniper", "skirmisher", "defender"],
    weaponProfiles: ["rifle", "shotgun", "smg", "pistol", "melee"],
    armorProfiles: ["light", "medium"],
    chromeRange: [2, 5],
    moduleChance: 0.55,
    consumableRange: [1, 3],
    implantFamilies: ["neural", "optics", "arm", "leg", "internal"],
    faction: "независимый наёмник",
  }),
  fixer: preset({
    label: "Фиксер",
    group: "independent",
    icon: "fa-solid fa-handshake",
    description: "Посредник, переговорщик и хозяин полезных связей.",
    level: 5,
    roles: ["leader", "civilian", "infiltrator"],
    weaponProfiles: ["pistol", "concealable"],
    armorProfiles: ["none", "light"],
    chromeRange: [1, 3],
    moduleChance: 0.4,
    consumableRange: [1, 3],
    implantFamilies: ["neural", "audio", "optics", "fashion"],
    faction: "независимая сеть контактов",
  }),
  nomad: preset({
    label: "Кочевник",
    group: "independent",
    icon: "fa-solid fa-truck-monster",
    description: "Разведчик дорог, механик или стрелок кочевого клана.",
    level: 4,
    roles: ["skirmisher", "technician", "assault"],
    weaponProfiles: ["rifle", "shotgun", "pistol"],
    armorProfiles: ["light", "medium"],
    chromeRange: [0, 3],
    moduleChance: 0.35,
    consumableRange: [1, 3],
    implantFamilies: ["optics", "audio", "arm"],
    faction: "кочевой клан",
  }),
  investigator: preset({
    label: "Частный детектив",
    group: "independent",
    icon: "fa-solid fa-magnifying-glass",
    description: "Наблюдение, разговоры и скрытое ношение оружия.",
    level: 4,
    roles: ["infiltrator", "leader", "civilian"],
    weaponProfiles: ["pistol", "concealable", "nonlethal"],
    armorProfiles: ["none", "light"],
    chromeRange: [1, 3],
    moduleChance: 0.45,
    consumableRange: [0, 2],
    implantFamilies: ["optics", "audio", "neural"],
    faction: "частное расследование",
  }),
  netrunner: preset({
    label: "Нетраннер",
    group: "specialist",
    icon: "fa-solid fa-code",
    description: "Боевой взломщик с программами из вашего компендиума.",
    level: 5,
    roles: ["netrunner"],
    weaponProfiles: ["pistol", "smg"],
    armorProfiles: ["none", "light"],
    chromeRange: [2, 5],
    moduleChance: 0.7,
    consumableRange: [0, 2],
    implantFamilies: ["neural", "optics", "audio"],
    includePrograms: true,
    faction: "независимый нетраннер",
  }),
  technician: preset({
    label: "Полевой техник",
    group: "specialist",
    icon: "fa-solid fa-screwdriver-wrench",
    description: "Ремонт, сапёрная работа и управление устройствами.",
    level: 4,
    roles: ["technician"],
    weaponProfiles: ["pistol", "smg", "nonlethal"],
    armorProfiles: ["light"],
    chromeRange: [1, 4],
    moduleChance: 0.5,
    consumableRange: [1, 3],
    implantFamilies: ["neural", "optics", "arm"],
    faction: "техническая команда",
  }),
  medic: preset({
    label: "Боевой медик",
    group: "specialist",
    icon: "fa-solid fa-kit-medical",
    description: "Полевой врач с медицинскими расходниками.",
    level: 4,
    roles: ["medic"],
    weaponProfiles: ["pistol", "smg", "nonlethal"],
    armorProfiles: ["light", "medium"],
    chromeRange: [1, 3],
    moduleChance: 0.4,
    consumableRange: [2, 5],
    implantFamilies: ["neural", "optics", "internal"],
    faction: "медицинская служба",
  }),
  cyberpsycho: preset({
    label: "Киберпсих",
    group: "extreme",
    icon: "fa-solid fa-brain",
    description: "Случайный набор тяжёлого хрома и очень опасный статблок.",
    level: 10,
    roles: ["cyberpsycho"],
    weaponProfiles: ["heavy", "melee", "shotgun", "rifle"],
    armorProfiles: ["medium", "heavy"],
    chromeRange: [5, 9],
    moduleChance: 0.75,
    consumableRange: [0, 2],
    implantFamilies: ["arm", "leg", "internal", "neural", "optics"],
    allowUnique: true,
    faction: "неконтролируемая угроза",
  }),
  "pkt-operative": preset({
    label: "Оперативник ПКТ",
    group: "extreme",
    icon: "fa-solid fa-robot",
    description: "Случайная полноценная модель ПКТ из библиотеки.",
    level: 12,
    roles: ["pkt"],
    weaponProfiles: ["rifle", "heavy", "melee", "shotgun"],
    armorProfiles: ["none"],
    chromeRange: [0, 2],
    moduleChance: 0.45,
    consumableRange: [0, 2],
    implantFamilies: ["pkt"],
    allowUnique: true,
    pkt: true,
    faction: "оперативная группа полной конверсии",
  }),
});

export function presetOptions() {
  return Object.entries(CYBERPUNK_PRESETS).map(([id, entry]) => ({
    id,
    ...entry,
    groupLabel: PRESET_GROUPS[entry.group]?.label ?? entry.group,
  }));
}

export function presetsByGroup() {
  return Object.entries(PRESET_GROUPS).map(([id, group]) => ({
    id,
    ...group,
    presets: presetOptions().filter((entry) => entry.group === id),
  }));
}

export function resolvePreset(id) {
  return CYBERPUNK_PRESETS[id] ?? CYBERPUNK_PRESETS[DEFAULT_FORM.preset];
}

export function resolveRole(preset, random = Math.random) {
  const id = pick(preset.roles, random) ?? "assault";
  return { id, ...(ROLE_PROFILES[id] ?? ROLE_PROFILES.assault) };
}

export function normalizeForgeForm(values = {}) {
  const presetId = Object.hasOwn(CYBERPUNK_PRESETS, values.preset)
    ? values.preset
    : DEFAULT_FORM.preset;
  const selected = resolvePreset(presetId);
  const tier = (value) =>
    ["auto", "terrible", "low", "moderate", "high", "extreme"].includes(value)
      ? value
      : "auto";
  const normalized = {
    ...DEFAULT_FORM,
    ...values,
    preset: presetId,
    level: Math.max(
      -1,
      Math.min(20, Math.trunc(Number(values.level ?? selected.level) || 0)),
    ),
    count: Math.max(1, Math.min(20, Math.trunc(Number(values.count) || 1))),
    quality: values.quality === "elite" ? "elite" : "standard",
    tier_ac: tier(values.tier_ac),
    tier_hp: tier(values.tier_hp),
    tier_attack: tier(values.tier_attack),
    tier_damage: tier(values.tier_damage),
    tier_perception: tier(values.tier_perception),
    tier_fortitude: tier(values.tier_fortitude),
    tier_reflex: tier(values.tier_reflex),
    tier_will: tier(values.tier_will),
    tier_dc: tier(values.tier_dc),
    chromeIntensity: ["none", "light", "standard", "heavy"].includes(
      values.chromeIntensity,
    )
      ? values.chromeIntensity
      : "standard",
    loadoutIntensity: ["minimal", "standard", "rich"].includes(
      values.loadoutIntensity,
    )
      ? values.loadoutIntensity
      : "standard",
    includePrograms:
      values.includePrograms === undefined
        ? selected.includePrograms === true
        : values.includePrograms === true,
    includeConsumables: values.includeConsumables !== false,
    target: ["new", "selected", "duplicate"].includes(values.target)
      ? values.target
      : "new",
    itemPolicy: ["generated", "keep"].includes(values.itemPolicy)
      ? values.itemPolicy
      : "generated",
    backupOriginal: values.backupOriginal !== false,
    deploymentMode: ["none", "cluster", "line", "wedge", "ring"].includes(
      values.deploymentMode,
    )
      ? values.deploymentMode
      : "none",
    addToCombat: values.addToCombat === true,
    createBriefing: values.createBriefing === true,
    sendChatSummary: values.sendChatSummary === true,
    openSheet: values.openSheet !== false,
    name: String(values.name ?? "").trim(),
    randomSeed: String(values.randomSeed ?? "")
      .trim()
      .slice(0, 120),
  };
  delete normalized.prompt;
  return normalized;
}
