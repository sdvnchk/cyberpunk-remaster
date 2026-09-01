const PACKAGE_ID = "cyberpunk-remaster";
const MODULE_ID = "cyberpunk-implant-creator";
const MODULE_VERSION = "1.13.29";
const REMASTER_IDS = [PACKAGE_ID, "sf2e-cyberware-pkt"];

const IMPLANT_LABELS = {
  base: "База",
  internal: "Внутренний",
  external: "Внешний",
  fashion: "Стилевой",
  module: "Модуль",
};

const PKT_QUALITY_LABELS = [
  "Серийная", "Тактическая", "Продвинутая", "Превосходная", "Элитная", "Абсолютная",
];

const GLOBAL_IMPLANT_LIMITS = Object.freeze({
  standard: Object.freeze({ internal: 7, external: 7, fashion: 7 }),
  pkt: Object.freeze({ internal: 14, external: 14, fashion: 7 }),
});
const cicCapacityPendingBatches = new WeakMap();

const PKT_BASE_FAMILY_CATALOG = [
  ["cyber-arm", "Кибер-рука"],
  ["cyber-leg", "Кибер-нога"],
  ["cyber-eye", "Кибер-глаз"],
  ["cyber-audio", "Кибер-аудио"],
  ["neural-link", "Нейролинк"],
  ["pkt-body", "Корпус ПКТ"],
  ["endoskeleton", "Эндоскелет"],
  ["pkt-structure", "Структура ПКТ"],
];

const PKT_COMPONENT_FAMILY_CATALOG = [
  ...PKT_BASE_FAMILY_CATALOG,
  ["cyber-arm-module", "Модуль кибер-руки"],
  ["cyber-leg-module", "Модуль кибер-ноги"],
  ["cyber-eye-module", "Модуль кибер-глаза"],
  ["cyber-audio-module", "Модуль кибер-аудио"],
  ["neural-link-module", "Модуль нейролинка"],
  ["pkt-defense", "Защита ПКТ"],
  ["pkt-utility", "Утилита ПКТ"],
  ["pkt-internal", "Внутренний компонент ПКТ"],
  ["pkt-weapon", "Оружейный компонент ПКТ"],
  ["pkt-unique", "Уникальный компонент ПКТ"],
  ["skin-armor", "Подкожная броня"],
];

const PRESETS = {
  internal: { implantType: "internal" },
  external: { implantType: "external" },
  fashion: { implantType: "fashion" },
  unique: { implantType: "internal" },
  manufacturer: { implantType: "internal" },
  base: { implantType: "base", pktReplaceableBase: true },
  module: { implantType: "module" },
  cyberArmBase: { implantType: "base", pktFamily: "cyber-arm", pktReplaceableBase: true },
  cyberArmModule: { implantType: "module", pktParentFamily: "cyber-arm" },
  cyberLegBase: { implantType: "base", pktFamily: "cyber-leg", pktReplaceableBase: true },
  cyberLegModule: { implantType: "module", pktParentFamily: "cyber-leg" },
  cyberEyeBase: { implantType: "base", pktFamily: "cyber-eye", pktReplaceableBase: true },
  cyberEyeModule: { implantType: "module", pktParentFamily: "cyber-eye" },
  cyberAudioBase: { implantType: "base", pktFamily: "cyber-audio", pktReplaceableBase: true },
  cyberAudioModule: { implantType: "module", pktParentFamily: "cyber-audio" },
  neuralLinkBase: { implantType: "base", pktFamily: "neural-link", pktReplaceableBase: true },
  neuralLinkModule: { implantType: "module", pktParentFamily: "neural-link" },
  neural: { implantType: "internal", traits: ["neironn-uskoritell"], exclusiveFamily: "neural-accelerator" },
  cyberdeck: { implantType: "internal", exclusiveFamily: "cyberdeck" },
  pktBiosystem: { implantType: "internal", pktBiosystem: true },
  pktBody: { implantType: "base", pktBody: true, pktFamily: "pkt-body" },
  pktImplant: { implantType: "internal", pktOnly: true, traits: ["pkt"] },
  pktBase: { implantType: "base", pktOnly: true, traits: ["pkt"], pktReplaceableBase: true },
  pktModule: { implantType: "module", pktOnly: true, traits: ["pkt"] },
  pktUnique: { implantType: "internal", pktOnly: true, traits: ["pkt"], pktFamily: "pkt-unique" },
  custom: {},
};

const RULE_PRESETS = {
  flatModifier: {
    label: "FlatModifier — бонус/штраф к проверке",
    help: "Базовый модификатор из Remaster. selector можно заменить на perception, medicine, stealth, ac, strike-attack-roll и т.д.",
    rule: { key: "FlatModifier", selector: "perception", type: "item", value: 1 },
  },
  flatModifierPredicate: {
    label: "FlatModifier — с predicate",
    help: "Бонус работает только при выполнении условия predicate.",
    rule: { key: "FlatModifier", selector: ["perception"], type: "item", value: 2, predicate: ["action:sense-motive"] },
  },
  activeEffectAdd: {
    label: "ActiveEffectLike — изменить значение",
    help: "Изменяет путь в данных актёра. mode: add/subtract/override/upgrade/downgrade.",
    rule: { key: "ActiveEffectLike", mode: "add", path: "inventory.bulk.maxAddend", value: 1 },
  },
  staminaMax: {
    label: "Выносливость / Stamina — изменить максимум SP",
    help: "Изменяет максимальную Выносливость персонажа. По умолчанию +1 SP. Путь: system.attributes.hp.sp.max; phase: afterDerived. Можно выбрать add/subtract/override и задать своё Value.",
    rule: { key: "ActiveEffectLike", mode: "add", path: "system.attributes.hp.sp.max", value: 1, phase: "afterDerived" },
  },
  resistance: {
    label: "Resistance — сопротивление урону",
    help: "Пример из имплантов Remaster. type: electricity, fire, cold, acid, sonic, bludgeoning и др.",
    rule: { key: "Resistance", type: "electricity", value: 5 },
  },
  immunity: {
    label: "Immunity — иммунитет",
    help: "Можно указать строку или массив типов, например disease/poison/radiation/deafened.",
    rule: { key: "Immunity", type: "deafened" },
  },
  sense: {
    label: "Sense — чувство/зрение",
    help: "В Remaster используется для darkvision и low-light-vision. При необходимости добавьте predicate.",
    rule: { key: "Sense", selector: "darkvision" },
  },
  baseSpeed: {
    label: "BaseSpeed — новая скорость",
    help: "selector: swim/climb/fly; value — число или формула/путь данных.",
    rule: { key: "BaseSpeed", selector: "swim", value: 20 },
  },
  rollOption: {
    label: "RollOption — переключаемый режим",
    help: "Создаёт переключатель, который можно использовать в predicate других Rule Elements.",
    rule: { key: "RollOption", domain: "all", option: "cyberware-mode", label: "Режим импланта", toggleable: true },
  },
  grantItem: {
    label: "GrantItem — выдать предмет",
    help: "Замените UUID на нужный Item. Это штатный SF2e Rule Element; отдельное поле grantItemUuids Remaster тоже остаётся доступно.",
    rule: { key: "GrantItem", uuid: "REPLACE_WITH_ITEM_UUID", allowDuplicate: false },
  },
  choiceSet: {
    label: "ChoiceSet — выбор при установке",
    help: "Создаёт выбор и сохраняет результат во flag. choices можно расширять вручную.",
    rule: { key: "ChoiceSet", prompt: "Выберите вариант", flag: "cyberwareChoice", choices: [{ label: "Вариант A", value: "option-a" }, { label: "Вариант B", value: "option-b" }] },
  },
  itemAlteration: {
    label: "ItemAlteration — изменить оружие/броню",
    help: "Пример логики оптических прицелов Remaster. property/value/predicate следует настроить под цель.",
    rule: { key: "ItemAlteration", itemType: "weapon", mode: "add", property: "range-increment", value: 10, predicate: ["item:id:{item|parentItem.id}"] },
  },
  damageDice: {
    label: "DamageDice — дополнительные кубы урона",
    help: "Добавляет кубы урона по selector. Можно задать predicate и category.",
    rule: { key: "DamageDice", selector: "strike-damage", diceNumber: 1, dieSize: "d6", category: "precision", label: "Киберимплант" },
  },
  adjustDegree: {
    label: "AdjustDegreeOfSuccess — изменить степень успеха",
    help: "Пример из Remaster: success -> critical success для выбранной защиты/проверки.",
    rule: { key: "AdjustDegreeOfSuccess", selector: "will", adjustment: { success: "to-critical-success" } },
  },
  note: {
    label: "Note — подсказка к броску",
    help: "Показывает текстовую заметку при подходящем броске; поддерживает predicate.",
    rule: { key: "Note", selector: ["strike-damage"], title: "Эффект импланта", text: "Описание дополнительного эффекта." },
  },
  specialResource: {
    label: "SpecialResource — ресурс импланта",
    help: "Создаёт отдельный ресурс, как в контуре «Красная зона» из Remaster.",
    rule: { key: "SpecialResource", slug: "cyberware-resource", label: "Заряды", max: 3, value: 3, renew: false },
  },
  tokenLight: {
    label: "TokenLight — свет от токена",
    help: "Свет можно связать с RollOption через predicate.",
    rule: { key: "TokenLight", predicate: ["cyberware-light"], value: { alpha: 0.1, animation: {}, bright: 30, dim: 60, luminosity: 0.3 } },
  },
  tokenEffectIcon: {
    label: "TokenEffectIcon — иконка эффекта на токене",
    help: "Показывает иконку при выполнении predicate.",
    rule: { key: "TokenEffectIcon", predicate: ["cyberware-mode"], value: "icons/svg/aura.svg" },
  },
  itemCast: {
    label: "ItemCast — встроенная способность",
    help: "Используется в Remaster для встроенного гранатомёта. Замените UUID; dc поддерживает формулы.",
    rule: { key: "ItemCast", uuid: "REPLACE_WITH_SPELL_UUID", dc: "10 + @item.level + @actor.system.abilities.str.mod", tradition: "primal" },
  },
  comboToggleBonus: {
    label: "КОМБО — переключатель + бонус",
    help: "Готовая связка RollOption + FlatModifier. Включение режима активирует бонус через predicate.",
    rules: [
      { key: "RollOption", domain: "all", option: "cyberware-boost", label: "Усиление импланта", toggleable: true },
      { key: "FlatModifier", selector: "perception", type: "item", value: 2, predicate: ["cyberware-boost"] },
    ],
  },
  comboFlashlight: {
    label: "КОМБО — переключаемый фонарик",
    help: "Связка из Remaster: RollOption включает TokenLight.",
    rules: [
      { key: "RollOption", label: "Фонарик", option: "flashlight-lit", toggleable: true },
      { key: "TokenLight", predicate: ["flashlight-lit"], value: { alpha: 0.1, animation: {}, bright: 30, color: "#dfeaf1", dim: 60, luminosity: 0.3 } },
    ],
  },
  comboVisionMode: {
    label: "КОМБО — ИК/УФ зрение (как Remaster)",
    help: "Точная схема Модуля ИК/УФ: suboptions выбирают low-light или darkvision, а Sense включается по predicate.",
    rules: [
      { key: "RollOption", domain: "all", option: "vision-mode", suboptions: [{ label: "Слабый режим", value: "low-light-mode" }, { label: "Полный режим", value: "darkvision-mode" }], label: "Режим зрения", toggleable: true, value: true, alwaysActive: true, selection: "low-light-mode" },
      { key: "Sense", selector: "low-light-vision", predicate: ["vision-mode:low-light-mode"] },
      { key: "Sense", selector: "darkvision", predicate: ["vision-mode:darkvision-mode"] },
    ],
  },
  comboEnergyResistance: {
    label: "КОМБО — выбор энергетического сопротивления",
    help: "Схема из «Энергетической защиты» Remaster: ChoiceSet выбирает тип, Resistance читает выбранное значение.",
    rules: [
      { key: "ChoiceSet", choices: [{ label: "PF2E.TraitAcid", value: "acid" }, { label: "PF2E.TraitCold", value: "cold" }, { label: "PF2E.TraitElectricity", value: "electricity" }, { label: "PF2E.TraitFire", value: "fire" }], flag: "resistance", prompt: "PF2E.SpecificRule.Prompt.Resistance" },
      { key: "Resistance", type: "{item|flags.system.rulesSelections.resistance}", value: 5 },
    ],
  },
  humanity: {
    label: "CyberpunkHumanity — предел человечности",
    help: "Кастомный Rule Element вашего Remaster. mode: add или override.",
    rule: { key: "CyberpunkHumanity", mode: "add", value: 5, label: "Киберимплант" },
  },
};


// Полная библиотека ключей из официального PF2e Quickstart Guide (редакция wiki 2026-06-08).
// Каждый пресет остаётся редактируемым как JSON. Универсальный конфигуратор ниже позволяет
// подменять selector/selectors, predicate, value, mode, type, slug, label, uuid и path.
const FULL_RULE_PRESETS = {
  actorTraits: { label: "ActorTraits — добавить/убрать traits актёра", help: "Добавляет или удаляет traits актёра.", rule: { key: "ActorTraits", add: ["humanoid"] } },
  adjustModifier: { label: "AdjustModifier — изменить существующий модификатор", help: "Находит модификатор по selector и slug; mode: add/multiply/override или suppress.", rule: { key: "AdjustModifier", selector: "strike-damage", slug: "some-modifier", mode: "multiply", value: 2 } },
  adjustStrike: { label: "AdjustStrike — изменить Strike", help: "Изменяет свойства ударов. Точные property/mode зависят от версии системы; JSON можно править вручную.", rule: { key: "AdjustStrike", mode: "add", property: "traits", value: "agile", predicate: ["item:melee"] } },
  aura: { label: "Aura — аура", help: "Создаёт ауру вокруг токена. effects принимает UUID эффектов; radius может быть числом/формулой.", rule: { key: "Aura", radius: 10, traits: [], effects: [] } },
  battleForm: { label: "BattleForm — боевая форма", help: "Самый сложный штатный Rule Element. Это стартовый каркас; заполняйте overrides/armor/attacks по нужной форме.", rule: { key: "BattleForm", overrides: {} } },
  craftingAbility: { label: "CraftingAbility — ремесленная способность", help: "Каркас для добавления ремесленной способности/формул. Обычно требует system-specific поля.", rule: { key: "CraftingAbility", slug: "cyberware-crafting" } },
  creatureSize: { label: "CreatureSize — размер существа", help: "value может быть размером или сдвигом категории (например 1/-1).", rule: { key: "CreatureSize", value: 1 } },
  criticalSpecialization: { label: "CriticalSpecialization — крит. специализация", help: "Включает/переопределяет критическую специализацию оружия по predicate.", rule: { key: "CriticalSpecialization", predicate: ["item:melee"] } },
  damageAlteration: { label: "DamageAlteration — изменить компонент урона", help: "Изменяет существующие модификаторы/кубы урона; property/mode/value настраиваются под задачу.", rule: { key: "DamageAlteration", selector: "strike-damage", mode: "override", property: "damage-type", value: "electricity" } },
  dexterityModifierCap: { label: "DexterityModifierCap — лимит Ловкости", help: "Задаёт cap для модификатора Ловкости.", rule: { key: "DexterityModifierCap", value: 3 } },
  ephemeralEffect: { label: "EphemeralEffect — временный эффект на броске", help: "Применяет эффект к origin/target при выбранных selectors.", rule: { key: "EphemeralEffect", affects: "target", selectors: ["strike-attack-roll"], uuid: "REPLACE_WITH_EFFECT_UUID" } },
  fastHealing: { label: "FastHealing — быстрое лечение/регенерация", help: "value может быть числом или формулой. Для регенерации добавьте type=regeneration и deactivatedBy.", rule: { key: "FastHealing", value: 2 } },
  loseHitPoints: { label: "LoseHitPoints — потеря HP", help: "Снимает HP при событии/применении эффекта; значение можно задавать формулой.", rule: { key: "LoseHitPoints", value: 1 } },
  weakness: { label: "Weakness — слабость к урону", help: "Добавляет слабость указанного типа.", rule: { key: "Weakness", type: "electricity", value: 5 } },
  martialProficiency: { label: "MartialProficiency — владение оружием/бронёй", help: "Добавляет отдельную martial proficiency. definition/label/rank настраиваются под цель.", rule: { key: "MartialProficiency", slug: "cyberware-weapons", label: "Кибероружие", rank: 1, definition: ["item:category:martial"] } },
  multipleAttackPenalty: { label: "MultipleAttackPenalty — изменить MAP", help: "Меняет прогрессию Multiple Attack Penalty для selector.", rule: { key: "MultipleAttackPenalty", selector: "attack", value: -2 } },
  rollTwice: { label: "RollTwice — fortune/misfortune", help: "Бросает дважды и оставляет higher/lower для выбранной проверки.", rule: { key: "RollTwice", selector: "attack-roll", keep: "higher" } },
  specialStatistic: { label: "SpecialStatistic — отдельная statistic", help: "Создаёт новую statistic. Каркас можно расширять domains/check/dc.", rule: { key: "SpecialStatistic", slug: "cyberware-statistic", label: "Киберсистема", type: "check" } },
  strike: { label: "Strike — встроенная атака", help: "Создаёт Strike. Можно выбрать damageType, куб, traits, range, ability и т.д.", rule: { key: "Strike", category: "unarmed", label: "Киберудар", group: "brawling", traits: ["unarmed"], damage: { base: { damageType: "bludgeoning", dice: 1, die: "d6" } } } },
  substituteRoll: { label: "SubstituteRoll — заменить результат броска", help: "Подменяет d20/результат для selector; подходит для Assurance-подобных эффектов.", rule: { key: "SubstituteRoll", selector: "skill-check", slug: "cyberware-substitution", value: 10 } },
  tempHp: { label: "TempHP — временные HP", help: "Добавляет временные HP; value может быть формулой, events — onCreate/onTurnStart.", rule: { key: "TempHP", value: 5 } },
  tokenImage: { label: "TokenImage — изменить изображение токена", help: "Меняет token image; поддерживает scale/tint/alpha/animation и predicate.", rule: { key: "TokenImage", value: "icons/svg/circuitry.svg", scale: 1 } },
  tokenMark: { label: "TokenMark — отметить цель", help: "Создаёт target:mark:<slug> для использования в predicate других правил.", rule: { key: "TokenMark", slug: "cyberware-mark" } },
  tokenName: { label: "TokenName — изменить имя токена", help: "Переопределяет имя токена.", rule: { key: "TokenName", value: "Киберформа" } },
};
Object.assign(RULE_PRESETS, FULL_RULE_PRESETS);

const SELECTOR_PRESETS = [
  ["", "— как в пресете —"],
  ["@ability:str", "Характеристика: Сила / STR"], ["@ability:dex", "Характеристика: Ловкость / DEX"],
  ["@ability:con", "Характеристика: Телосложение / CON"], ["@ability:int", "Характеристика: Интеллект / INT"],
  ["@ability:wis", "Характеристика: Мудрость / WIS"], ["@ability:cha", "Характеристика: Харизма / CHA"],
  ["perception", "Восприятие / Perception"], ["initiative", "Инициатива"],
  ["saving-throw", "Все спасброски"], ["fortitude", "Стойкость / Fortitude"], ["reflex", "Рефлекс / Reflex"], ["will", "Воля / Will"],
  ["skill-check", "Все проверки навыков"], ["acrobatics", "Акробатика"], ["athletics", "Атлетика"], ["stealth", "Скрытность"], ["thievery", "Воровство"], ["medicine", "Медицина"], ["crafting", "Ремесло"], ["computers", "Компьютеры"], ["piloting", "Пилотирование"], ["society", "Общество"], ["arcana", "Аркана"], ["nature", "Природа"], ["occultism", "Оккультизм"], ["religion", "Религия"], ["diplomacy", "Дипломатия"], ["deception", "Обман"], ["intimidation", "Запугивание"], ["survival", "Выживание"],
  ["attack", "Все атаки"], ["attack-roll", "Все attack rolls"], ["strike-attack-roll", "Strike: атака"], ["damage", "Весь урон"], ["strike-damage", "Strike: урон"],
  ["ac", "КД / AC"], ["class", "КС класса"], ["fortitude-dc", "КС Стойкости"], ["reflex-dc", "КС Рефлекса"], ["will-dc", "КС Воли"], ["perception-dc", "КС Восприятия"], ["inline-dc", "Inline DC"],
  ["hp", "Максимум HP"], ["hp-per-level", "HP за уровень"], ["damage-received", "Получаемый урон"], ["healing-received", "Получаемое лечение"],
  ["all-speeds", "Все скорости"], ["land-speed", "Наземная скорость"], ["fly-speed", "Полёт"], ["swim-speed", "Плавание"], ["climb-speed", "Карабканье"], ["burrow-speed", "Рытьё"],
];

const CHECK_PRESETS = [
  [3, "Очень лёгкая"], [5, "Лёгкая"], [8, "Средняя"], [11, "Сложная"], [14, "Тяжёлая"], [20, "Критическая"],
];

// Базовый резервный набор traits активации. В живой SF2e/PF2e список дополняется
// из CONFIG системы, поэтому новые/системные traits автоматически появляются в конструкторе.
const FALLBACK_ACTIVATION_TRAITS = {
  concentrate: "Concentrate / Концентрация", manipulate: "Manipulate / Манипуляция",
  auditory: "Auditory / Слуховой", visual: "Visual / Визуальный", linguistic: "Linguistic / Языковой",
  mental: "Mental / Ментальный", emotion: "Emotion / Эмоция", fear: "Fear / Страх",
  move: "Move / Движение", attack: "Attack / Атака", secret: "Secret / Секретный",
  fortune: "Fortune / Удача", misfortune: "Misfortune / Неудача", flourish: "Flourish",
  press: "Press", stance: "Stance / Стойка", exploration: "Exploration / Исследование",
  downtime: "Downtime / Свободное время", incapacitation: "Incapacitation",
  teleportation: "Teleportation / Телепортация", polymorph: "Polymorph / Полиморф",
};

function localizedTraitLabel(value, slug) {
  if (typeof value === "string") {
    try {
      const localized = game?.i18n?.localize?.(value);
      if (localized && localized !== value) return localized;
    } catch {}
    return value;
  }
  if (value && typeof value === "object") {
    const candidate = value.label ?? value.name ?? value.value;
    if (typeof candidate === "string") return localizedTraitLabel(candidate, slug);
  }
  return FALLBACK_ACTIVATION_TRAITS[slug] ?? slug;
}

function activationTraitCatalog() {
  const catalog = new Map(Object.entries(FALLBACK_ACTIVATION_TRAITS));
  const config = globalThis.CONFIG ?? {};
  const sources = [
    config.PF2E?.actionTraits, config.SF2E?.actionTraits,
    config.PF2E?.actionTrait, config.SF2E?.actionTrait,
  ];
  // Некоторые версии системы не публикуют отдельный actionTraits. В этом случае
  // используем общий словарь traits: поиск в интерфейсе не даст списку мешать работе.
  if (!sources.some((source) => source && (source instanceof Map || typeof source === "object"))) {
    sources.push(config.PF2E?.traits, config.SF2E?.traits);
  }
  for (const source of sources) {
    if (!source) continue;
    const entries = source instanceof Map ? [...source.entries()] : Object.entries(source);
    for (const [slug, value] of entries) {
      if (!slug || typeof slug !== "string") continue;
      catalog.set(slug, localizedTraitLabel(value, slug));
    }
  }
  return [...catalog.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "ru"));
}

function activationTraitOptions(filter = "") {
  const query = String(filter ?? "").trim().toLocaleLowerCase("ru");
  const entries = activationTraitCatalog().filter(([slug, label]) => !query || slug.toLocaleLowerCase("ru").includes(query) || String(label).toLocaleLowerCase("ru").includes(query));
  if (!entries.length) return '<option value="">— ничего не найдено —</option>';
  return '<option value="">— выберите trait —</option>' + entries.map(([slug, label]) => `<option value="${esc(slug)}">${esc(label)} — ${esc(slug)}</option>`).join("");
}

function activeRemasterId() {
  for (const id of REMASTER_IDS) if (game.modules.get(id)?.active) return id;
  return REMASTER_IDS[0];
}

function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function parseList(value) {
  return [...new Set(String(value ?? "").split(/[\n,;]/g).map((part) => part.trim()).filter(Boolean))];
}

function intValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

function signedIntValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function nullableNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

const PHYSICAL_ITEM_TYPES = new Set(["equipment", "weapon", "armor"]);

const ITEM_TYPE_LABELS = {
  equipment: "Снаряжение / обычный имплант",
  weapon: "Оружие / кибероружие",
  armor: "Броня / киберброня",
};

function scalarValue(value, fallback = 0) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}


const SF2E_COMBAT_FALLBACKS = {
  weaponCategories: [
    ["unarmed", "Безоружное"], ["simple", "Простое"], ["martial", "Тактическое / Martial"], ["advanced", "Продвинутое / Advanced"],
  ],
  weaponGroups: ["axe","brawling","club","dart","flail","flame","grenade","hammer","knife","projectile","shock","sniper","sword"],
  armorCategories: [["unarmored","Без брони"],["light","Лёгкая"],["medium","Средняя"],["heavy","Тяжёлая"]],
  armorGroups: ["ceramic","chain","cloth","composite","leather","plate","polymer"],
  damageTypes: ["acid","bludgeoning","cold","electricity","fire","force","mental","piercing","poison","slashing","sonic","untyped","vitality","void"],
  grades: [["commercial","Серийное / Commercial"],["tactical","Тактическое / Tactical"],["advanced","Продвинутое / Advanced"],["superior","Превосходное / Superior"]],
  weaponBaseItems: [
    ["baton","Дубинка"],["battle-ribbon","Моно-Струна"],["battleglove","Боевая перчатка"],["club","Дубинка"],["dagger","Выдвижные клинки"],["drobovik-drob","Дробовик (Дробь)"],["drobovik-zhakan","Дробовик (Жакан)"],["dueling-sword","Дуэльный меч"],["fangblade","Пиломеч"],["fist","Кулак / армированные костяшки"],["grenade","Граната"],["grenade-launcher","Гранатомёт"],["grindblade","Абразивный меч"],["knife","Нож"],["machine-gun","Пулемёт"],["massivnyy-pistolet","Массивный пистолет"],["phase-cutlass","Моно-Катана"],["pistolet","Пистолет"],["pistolet-pulyomyot","Пистолет-пулемёт"],["polyglove","Мультиперчатка"],["pulsecaster-pistol","Электропистолет"],["puzzleblade","Разборный меч"],["reaktivnyy-granatomyot","Реактивный гранатомёт"],["shock-pad","Разрядник"],["shock-truncheon","Шоковая дубинка"],["shooting-starknife","Моно-Сюрикен"],["shturmovaya-vintovka","Штурмовая винтовка"],["snaypers-kaya-vintovka","Снайперская винтовка"],["svetovie-povyazki","Световые повязки"],["sword-cane","Моно-Три"],["tyazhelyy-pistolet","Тяжёлый пистолет"],["tyazhelyy-pistolet-pulyomyot","Тяжёлый пистолет-пулемёт"],["vertebralis-thorn","Хребетный шип"],["warhammer","Боевой молот"]
  ],
  armorBaseItems: [
    ["aegis-series","Бронекостюм Эгида"],["armored-coat","Бронированный плащ"],["bronekostyum-metallgir","Бронекостюм МеталлГир"],["bronekostyum-talos","Бронекостюм TALOS"],["bronezhilet","Бронежилет"],["bronya-bravada","Броня Бравада"],["bronya-flibuster","Броня Флибустер"],["bronya-mtv","Броня MTV"],["bronya-shkura-drakona","Броня Шкура дракона"],["defiance-series","Бронекостюм Вызов"],["delovoy-kostyum","Деловой костюм"],["estex-suit","Эстексный комбинезон"],["hardlight-series","Световая броня"],["hidden-soldier-armor","Бронекостюм Безликий солдат"],["kevlarovyy-zhilet","Кевларовый жилет"],["kyokor-plating","Бронекостюм Кьёкор"],["microcord-armor","Микрокордовый костюм"],["podkozhnaya-bronya","Подкожная броня"],["second-skin","Вторая кожа"],["tempweave","Термокостюм"],["thinplate","Тонкий панцирь"],["tkanekozha","Тканекожа"],["tyazhelaya-podkozhnaya-bronya","Тяжёлая подкожная броня"]
  ],
  weaponTraits: ["acid","agile","analog","arc","area-cone","attack","automatic","backstabber","backswing","boost-1d12","breakdown","brutal","concealable","concussive","consumable","critical-brawling","critical-knife","deadly-d8","disarm","double-barrel","electricity","fatal-d12","fatal-d8","finesse","fire","forceful","free-hand","grenade","injection","kickback","light","magical","modular","nonlethal","parry","pkt","poison","powered","professional-computers","razing","reach","recovery","scatter-10","shove","tech","thrown-10","thrown-20","twin","two-hand-d10","unwieldy","versatile-p","versatile-s","visual","volley-30"],
  armorTraits: ["bulwark","comfort","exposed","flexible","noisy","tech"],
  materials: [["silver","Серебро / Silver"]],
  materialGrades: [["low","Низкое / Low"],["standard","Стандартное / Standard"],["high","Высокое / High"]],
};

function configEntries(source) {
  if (!source) return [];
  if (source instanceof Map) return [...source.entries()];
  if (Array.isArray(source)) return source.map((value) => [String(value), String(value)]);
  if (typeof source === "object") return Object.entries(source);
  return [];
}

function sf2eLabel(value, slug) {
  if (typeof value === "string") {
    try {
      const localized = game?.i18n?.localize?.(value);
      return localized && localized !== value ? localized : value;
    } catch { return value; }
  }
  if (value && typeof value === "object") return sf2eLabel(value.label ?? value.name ?? value.value ?? slug, slug);
  return slug;
}

function mergeCatalogPairs(fallback, ...sources) {
  const map = new Map();
  for (const entry of fallback ?? []) {
    if (Array.isArray(entry)) map.set(String(entry[0]), String(entry[1] ?? entry[0]));
    else map.set(String(entry), String(entry));
  }
  for (const source of sources) for (const [slug, value] of configEntries(source)) {
    if (!slug || typeof slug !== "string") continue;
    map.set(slug, sf2eLabel(value, slug));
  }
  return [...map.entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),"ru"));
}

function mergeCatalogSlugs(fallback, ...sources) {
  return mergeCatalogPairs((fallback ?? []).map((x)=>[x,x]), ...sources);
}

function sf2eCombatCatalogs() {
  const cfg = globalThis.CONFIG?.SF2E ?? globalThis.CONFIG?.PF2E ?? {};
  return {
    weaponCategories: mergeCatalogPairs(SF2E_COMBAT_FALLBACKS.weaponCategories, cfg.weaponCategories, cfg.weaponCategory),
    weaponGroups: mergeCatalogSlugs(SF2E_COMBAT_FALLBACKS.weaponGroups, cfg.weaponGroups, cfg.weaponGroup),
    armorCategories: mergeCatalogPairs(SF2E_COMBAT_FALLBACKS.armorCategories, cfg.armorCategories, cfg.armorCategory),
    armorGroups: mergeCatalogSlugs(SF2E_COMBAT_FALLBACKS.armorGroups, cfg.armorGroups, cfg.armorGroup),
    damageTypes: mergeCatalogSlugs(SF2E_COMBAT_FALLBACKS.damageTypes, cfg.damageTypes, cfg.damageTypesPhysical, cfg.damageTypesEnergy),
    grades: mergeCatalogPairs(SF2E_COMBAT_FALLBACKS.grades, cfg.itemGrades, cfg.equipmentGrades, cfg.grades),
    weaponBaseItems: mergeCatalogPairs(SF2E_COMBAT_FALLBACKS.weaponBaseItems, cfg.baseWeaponTypes, cfg.baseWeapons),
    armorBaseItems: mergeCatalogPairs(SF2E_COMBAT_FALLBACKS.armorBaseItems, cfg.baseArmorTypes, cfg.baseArmors),
    weaponTraits: mergeCatalogSlugs(SF2E_COMBAT_FALLBACKS.weaponTraits, cfg.weaponTraits),
    armorTraits: mergeCatalogSlugs(SF2E_COMBAT_FALLBACKS.armorTraits, cfg.armorTraits),
    materials: mergeCatalogPairs(SF2E_COMBAT_FALLBACKS.materials, cfg.materials, cfg.materialTypes, cfg.preciousMaterials),
    materialGrades: mergeCatalogPairs(SF2E_COMBAT_FALLBACKS.materialGrades, cfg.materialGrades, cfg.preciousMaterialGrades),
  };
}

function catalogSelectOptions(entries, selected = "") {
  const current = String(selected ?? "");
  const options = entries.map(([value,label])=>`<option value="${esc(value)}"${value===current?' selected':''}>${esc(label)} — ${esc(value)}</option>`);
  if (current && !entries.some(([value])=>value===current)) options.unshift(`<option value="${esc(current)}" selected>${esc(current)} — из шаблона</option>`);
  return options.join("");
}

function catalogDatalist(id, entries) {
  return `<datalist id="${esc(id)}">${entries.map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join("")}</datalist>`;
}

function catalogPickerHtml({ field, label, entries, value = "", multi = false, help = "", allowEmpty = true, wide = false }) {
  const current = multi ? parseList(value) : [String(value ?? "").trim()].filter(Boolean);
  const selectedText = current.join(", ");
  return `<div class="cic-catalog-field${wide ? " wide" : ""}" data-catalog-picker data-catalog-field="${esc(field)}" data-catalog-mode="${multi ? "multi" : "single"}">
    <div class="cic-catalog-label">${esc(label)}</div>
    <input type="hidden" name="${esc(field)}" value="${esc(selectedText)}">
    <div class="cic-inline cic-catalog-picker-row">
      <input type="search" data-catalog-search placeholder="Поиск по названию или slug…">
      <select data-catalog-select>${allowEmpty ? '<option value="">— не выбрано —</option>' : ''}${entries.map(([v,l])=>`<option value="${esc(v)}">${esc(l)} — ${esc(v)}</option>`).join("")}</select>
      <button type="button" data-catalog-add><i class="fa-solid fa-plus"></i> ${multi ? "Добавить" : "Выбрать"}</button>
    </div>
    <div class="cic-trait-selected" data-catalog-selected></div>
    ${help ? `<small>${help}</small>` : ""}
  </div>`;
}

function selectedMultiValues(select) {
  return select ? [...select.selectedOptions].map((option)=>option.value).filter(Boolean) : [];
}

function setMultiSelectValues(select, values) {
  if (!select) return;
  const wanted = new Set(Array.isArray(values) ? values : parseList(values));
  for (const value of wanted) if (![...select.options].some((option)=>option.value===value)) select.add(new Option(value, value));
  for (const option of select.options) option.selected = wanted.has(option.value);
}

function objectPatch(text, label) {
  const raw = String(text ?? "").trim();
  if (!raw) return {};
  let value;
  try { value = JSON.parse(raw); } catch (error) { throw new Error(`${label}: неверный JSON (${error.message}).`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} должен быть JSON-объектом.`);
  return value;
}

function deepMergeObject(target, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return target;
  for (const [key,value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) deepMergeObject(target[key], value);
    else target[key] = foundry.utils.deepClone(value);
  }
  return target;
}

function normalizeStress(value) {
  const raw = String(value ?? "0").trim();
  if (!raw || raw === "0") return { formula: "0", display: "0" };
  // Разрешаем как чистую формулу (2d6 + 1d4), так и точную inline-запись Remaster:
  // [[/r 2d6 + 1d4 #Потеря Человечности]]
  const match = raw.match(/(?:\[\[\/r\s*)?((?:\d*d(?:4|6))(?:\s*\+\s*\d*d(?:4|6))*)/i);
  if (!match) throw new Error("Stress Cost должен содержать кубы d4/d6: например 1d6, 2d6 + 1d4 или [[/r 2d6 #Потеря Человечности]].");
  const formula = match[1].toLowerCase().replace(/(^|\+)d(?=4|6)/g, (_m, prefix) => `${prefix}1d`).replace(/\s*\+\s*/g, " + ");
  return { formula, display: raw };
}

function normalizeRules(text) {
  const value = String(text ?? "").trim();
  if (!value) return [];
  let rules;
  try { rules = JSON.parse(value); }
  catch (error) { throw new Error(`Rule Elements: неверный JSON (${error.message}).`); }
  if (!Array.isArray(rules)) throw new Error("Rule Elements должны быть JSON-массивом: [ {...}, {...} ].");
  return rules;
}

function validateRules(rules) {
  const raw = JSON.stringify(rules);
  if (raw.includes("REPLACE_WITH_")) throw new Error("В Rule Elements остался REPLACE_WITH_… Замените UUID в добавленном пресете.");
  for (const [index, rule] of rules.entries()) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new Error(`Rule Element #${index + 1} должен быть объектом.`);
    if (!String(rule.key ?? "").trim()) throw new Error(`Rule Element #${index + 1}: отсутствует key.`);
  }
}

const ACTIVATION_ACTIONS = {
  action1: { label: "1 действие", glyph: "@Glyph[Action 1]" },
  action2: { label: "2 действия", glyph: "@Glyph[Action 2]" },
  action3: { label: "3 действия", glyph: "@Glyph[Action 3]" },
  free: { label: "Свободное действие", glyph: "@Glyph[Free]" },
  reaction: { label: "Реакция", glyph: "@Glyph[Reaction]" },
};

const ACTIVATION_FREQUENCIES = {
  unlimited: "Без ограничения",
  round: "Раз в раунд",
  encounter: "Раз за столкновение",
  minute: "Раз в минуту",
  hour: "Раз в час",
  day: "Раз в день",
};

const EFFECT_DURATION_UNITS = new Set(["rounds", "minutes", "hours", "days", "encounter", "unlimited"]);

function activationDescription(data) {
  if (!data.activationEnabled) return "";
  const action = ACTIVATION_ACTIONS[data.activationActionType] ?? ACTIVATION_ACTIONS.action1;
  const traits = parseList(data.activationTraits).map((trait) => `@Trait[${esc(trait)}]`).join(" ");
  const itemName = String(data.name ?? "Имплант").trim() || "Имплант";
  const rawActivationName = String(data.activationName ?? "").trim();
  const activationName = !rawActivationName || /^активировать$/iu.test(rawActivationName)
    ? `Активировать ${itemName}`
    : rawActivationName.toLocaleLowerCase("ru").includes(itemName.toLocaleLowerCase("ru"))
      ? rawActivationName
      : `${rawActivationName} — ${itemName}`;
  const lines = [
    `<section data-cic-activation="true">`,
    `<hr>`,
    `<p><strong>Активация — ${esc(activationName)}:</strong> ${action.glyph}${traits ? ` (${traits})` : ""}</p>`,
  ];
  const frequency = ACTIVATION_FREQUENCIES[data.activationFrequency] ?? ACTIVATION_FREQUENCIES.unlimited;
  if (data.activationFrequency !== "unlimited") lines.push(`<p><strong>Частота:</strong> ${esc(data.activationFrequencyMax > 1 ? `${data.activationFrequencyMax} × — ${frequency}` : frequency)}</p>`);
  if (String(data.activationRequirements ?? "").trim()) lines.push(`<p><strong>Требования:</strong> ${String(data.activationRequirements).trim()}</p>`);
  if (String(data.activationTrigger ?? "").trim()) lines.push(`<p><strong>Триггер:</strong> ${String(data.activationTrigger).trim()}</p>`);
  if (data.activationDurationUnit && data.activationDurationUnit !== "unlimited") {
    const durationText = data.activationDurationUnit === "encounter" ? "До конца столкновения" : `${data.activationDurationValue} ${data.activationDurationUnit}`;
    lines.push(`<p><strong>Длительность:</strong> ${esc(durationText)}</p>`);
  }
  if (String(data.activationEffectDescription ?? "").trim()) lines.push(`<p><strong>Эффект:</strong> ${String(data.activationEffectDescription).trim()}</p>`);
  lines.push(`</section>`);
  return lines.join("\n");
}

function activationFlagFromData(data) {
  if (!data.activationEnabled) return null;
  return {
    enabled: true,
    name: String(data.activationName || "Активировать").trim(),
    actionType: ACTIVATION_ACTIONS[data.activationActionType] ? data.activationActionType : "action1",
    traits: parseList(data.activationTraits),
    requirements: String(data.activationRequirements ?? "").trim(),
    trigger: String(data.activationTrigger ?? "").trim(),
    frequency: ACTIVATION_FREQUENCIES[data.activationFrequency] ? data.activationFrequency : "unlimited",
    frequencyMax: Math.max(1, intValue(data.activationFrequencyMax, 1)),
    duration: {
      value: data.activationDurationUnit === "encounter" || data.activationDurationUnit === "unlimited" ? -1 : Math.max(1, intValue(data.activationDurationValue, 1)),
      unit: EFFECT_DURATION_UNITS.has(data.activationDurationUnit) ? data.activationDurationUnit : "rounds",
      expiry: ["turn-start", "turn-end"].includes(data.activationExpiry) ? data.activationExpiry : null,
      sustained: false,
    },
    effectName: String(data.activationEffectName ?? "").trim(),
    effectImg: String(data.activationEffectImg ?? "").trim(),
    effectDescription: String(data.activationEffectDescription ?? "").trim(),
    effectRules: Array.isArray(data.activationEffectRules) ? data.activationEffectRules : [],
    grantItemUuids: Array.isArray(data.activationGrantItemUuids) ? data.activationGrantItemUuids : [],
    tokenIcon: data.activationEffectTokenIcon === true,
    chatMessage: data.activationChatMessage === true,
    showOnActionsSheet: data.activationShowOnSheet !== false,
  };
}

function descriptionLines(html) {
  const box = document.createElement("div"); box.innerHTML = String(html ?? "");
  return [...box.querySelectorAll("p, div, li")].map((n) => n.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function stripCanonicalMetadata(html) {
  const raw = String(html ?? "");
  if (!raw || !globalThis.document?.createElement) return raw;
  const box = document.createElement("div"); box.innerHTML = raw;
  for (const generated of [...box.querySelectorAll('[data-cic-activation="true"]')]) generated.remove();
  const removable = /^(?:Тип\s*импланта|Hard\s*Cost|Stress\s*Cost|Проверка|Слот[А-Яа-яЁё]*|Внутренн(?:ие|их)\s+(?:слоты|места)|Внешн(?:ие|их)\s+(?:слоты|места)|Цена|Активация|Частота|Триггер|Требования|Длительность|Эффект)\s*[:—]/iu;
  for (const node of [...box.querySelectorAll("p, div, li")]) {
    const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (removable.test(text)) node.remove();
  }
  for (const hr of [...box.querySelectorAll("hr")]) if (!hr.nextElementSibling || hr.nextElementSibling.matches("hr")) hr.remove();
  return box.innerHTML.trim();
}

function parseTemplateMetadata(source, namespace) {
  const html = source?.system?.description?.value ?? "";
  const box = document.createElement("div"); box.innerHTML = html;
  const text = box.textContent?.replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ") ?? "";
  const flags = source?.flags?.[namespace] ?? source?.flags?.["cyberpunk-remaster"] ?? source?.flags?.["sf2e-cyberware-pkt"] ?? {};
  const typeText = text.match(/Тип\s*импланта\s*:?\s*(База|Внутренний|Внешний|Стилевой|Модуль)/iu)?.[1]?.toLowerCase();
  const typeMap = { "база":"base", "внутренний":"internal", "внешний":"external", "стилевой":"fashion", "модуль":"module" };
  const hard = text.match(/Hard\s*Cost\s*:?\s*(\d+)/iu)?.[1];
  const stress = text.match(/Stress\s*Cost\s*:?\s*(?:\[\[\/r\s*)?((?:\d*d(?:4|6))(?:\s*\+\s*\d*d(?:4|6))*|0)/iu)?.[1];
  const stressLine = [...descriptionLines(html)].reverse().find((line) => /^Stress\s*Cost\s*:/iu.test(line));
  const stressDisplay = stressLine ? stressLine.replace(/^Stress\s*Cost\s*:?\s*/iu, "").trim() : (stress ?? flags.stressFormula ?? "0");
  const checkSyntax = text.match(/Проверка\s*:?\s*(@Check\[[^\]]+\](?:\{[^}]*\})?)/iu)?.[1] ?? "";
  const slots = text.match(/Слот[А-Яа-яЁё]*\s*:?\s*(\d+)/iu)?.[1];
  const internalSlots = text.match(/Внутренн(?:ие|их)\s+(?:слоты|места)\s*:?\s*(\d+)/iu)?.[1];
  const externalSlots = text.match(/Внешн(?:ие|их)\s+(?:слоты|места)\s*:?\s*(\d+)/iu)?.[1];
  return {
    implantType: typeMap[typeText] ?? flags.implantType ?? "internal",
    hardCost: hard ?? flags.hardCost ?? 0,
    stressFormula: stressDisplay ?? stress ?? flags.stressFormula ?? "0",
    stressInlineRoll: /Stress\s*Cost[\s\S]*?\[\[\/r\s*/iu.test(html),
    checkSyntax,
    rarity: source?.system?.traits?.rarity ?? "common",
    itemLevel: Number(source?.system?.level?.value ?? 0) || 0,
    slots: slots ?? (flags.implantType === "base" ? flags.slots : flags.slotsUsed) ?? 0,
    internalSlots: internalSlots ?? flags.pktInternalSlots ?? 0,
    externalSlots: externalSlots ?? flags.pktExternalSlots ?? 0,
    pktComponentQuality: flags.pktComponentQuality ?? flags.pktQuality ?? 0,
    priceEddies: Number(source?.system?.price?.value?.sp ?? flags.priceEddies ?? 0) || 0,
    itemSize: String(source?.system?.size ?? "med"),
    bulkValue: Number(source?.system?.bulk?.value ?? 0),
    pktOnly: flags.pktOnly === true || source?.system?.traits?.value?.includes?.("pkt") === true,
    pktBody: flags.pktBody === true,
    pktBiosystem: flags.pktBiosystem === true,
    pktQuality: flags.pktQuality ?? 0,
    pktFamily: flags.pktFamily ?? "",
    pktParentFamily: flags.pktParentFamily ?? "",
    pktReplaceable: flags.pktReplaceable === true,
    pktReplaceableBase: flags.pktReplaceableBase === true,
    exclusiveFamily: flags.exclusiveFamily ?? "",
    grantItemUuids: Array.isArray(flags.grantItemUuids) ? flags.grantItemUuids : [],
    traits: Array.isArray(source?.system?.traits?.value) ? source.system.traits.value : [],
    rules: Array.isArray(source?.system?.rules) ? source.system.rules : [],
    activation: source?.flags?.[MODULE_ID]?.activation ?? null,
    itemDocumentType: PHYSICAL_ITEM_TYPES.has(source?.type) ? source.type : "equipment",
    weapon: source?.type === "weapon" ? {
      category: source?.system?.category ?? "martial",
      group: source?.system?.group ?? "brawling",
      baseItem: source?.system?.baseItem ?? "fist",
      grade: source?.system?.grade ?? "commercial",
      bonus: Number(source?.system?.bonus?.value ?? 0) || 0,
      damageDice: Number(source?.system?.damage?.dice ?? 1) || 1,
      damageDie: source?.system?.damage?.die ?? "d6",
      damageType: source?.system?.damage?.damageType ?? "bludgeoning",
      bonusDamage: Number(source?.system?.bonusDamage?.value ?? 0) || 0,
      splashDamage: Number(source?.system?.splashDamage?.value ?? 0) || 0,
      range: source?.system?.range ?? null,
      reload: source?.system?.reload?.value ?? "",
      usage: source?.system?.usage?.value ?? "held-in-one-hand",
      expend: source?.system?.expend ?? null,
      ammoBaseType: source?.system?.ammo?.baseType ?? "",
      ammoBuiltIn: source?.system?.ammo?.builtIn === true,
      ammoCapacity: Number(source?.system?.ammo?.capacity ?? 0) || 0,
      hardness: Number(source?.system?.hardness ?? 0) || 0,
      hpMax: Number(source?.system?.hp?.max ?? 0) || 0,
      materialType: source?.system?.material?.type ?? "",
      materialGrade: source?.system?.material?.grade ?? "",
      traits: Array.isArray(source?.system?.traits?.value) ? source.system.traits.value : [],
    } : null,
    armor: source?.type === "armor" ? {
      category: source?.system?.category ?? "light",
      group: source?.system?.group ?? "cloth",
      baseItem: source?.system?.baseItem ?? "",
      grade: source?.system?.grade ?? "commercial",
      acBonus: Number(source?.system?.acBonus ?? 1) || 0,
      dexCap: Number(source?.system?.dexCap ?? 0) || 0,
      checkPenalty: Number(source?.system?.checkPenalty ?? 0) || 0,
      speedPenalty: Number(source?.system?.speedPenalty ?? 0) || 0,
      strength: Number(source?.system?.strength ?? 0) || 0,
      hardness: Number(source?.system?.hardness ?? 0) || 0,
      hpMax: Number(source?.system?.hp?.max ?? 0) || 0,
      materialType: source?.system?.material?.type ?? "",
      materialGrade: source?.system?.material?.grade ?? "",
      traits: Array.isArray(source?.system?.traits?.value) ? source.system.traits.value : [],
    } : null,
  };
}

function canonicalDescription(data) {
  const { implantType, hardCost, stressFormula, stressDisplay, stressInlineRoll, checkSyntax, slots, internalSlots, externalSlots, bodyHtml } = data;
  const label = IMPLANT_LABELS[implantType] ?? "Внутренний";
  const rawStress = String(stressDisplay ?? stressFormula ?? "0").trim() || "0";
  const stress = rawStress.includes("[[/r") ? esc(rawStress) : (stressInlineRoll && stressFormula !== "0" ? `[[/r ${esc(stressFormula)} #Потеря Человечности]]` : esc(rawStress));
  const meta = [
    `<hr>`,
    `<p><strong>Тип импланта:</strong> ${esc(label)}</p>`,
    `<p><strong>Слоты:</strong> ${intValue(slots)}</p>`,
    `<p><strong>Stress Cost:</strong> ${stress}</p>`,
    `<p><strong>Hard Cost:</strong> ${intValue(hardCost)}</p>`,
    ...(String(checkSyntax ?? "").trim() ? [`<p><strong>Проверка:</strong> ${esc(String(checkSyntax).trim())}</p>`] : []),
  ];
  const activation = activationDescription(data);
  return `${String(bodyHtml ?? "").trim()}${meta.join("\n")}${activation ? `\n${activation}` : ""}`;
}

function readForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  data.hardCost = intValue(data.hardCost);
  data.slots = intValue(data.slots);
  data.internalSlots = Math.max(0, intValue(data.internalSlots, 0));
  data.externalSlots = Math.max(0, intValue(data.externalSlots, 0));
  data.priceEddies = intValue(data.priceEddies);
  data.itemLevel = Math.max(0, Math.min(30, intValue(data.itemLevel)));
  data.itemSize = ["tiny", "sm", "med", "lg", "huge", "grg"].includes(data.itemSize) ? data.itemSize : "med";
  const bulkPreset = String(data.bulkValue ?? "0");
  data.bulkValue = bulkPreset === "custom" ? Math.max(0, Number(data.bulkCustom ?? 0) || 0) : Math.max(0, Number(bulkPreset) || 0);
  data.pktQuality = intValue(data.pktQuality);
  data.pktComponentQuality = Math.max(0, Math.min(PKT_QUALITY_LABELS.length - 1, intValue(data.pktComponentQuality)));
  data.pktRegisterModel = form.elements.pktRegisterModel?.checked === true;
  data.pktModelIncludeCreated = form.elements.pktModelIncludeCreated?.checked !== false;
  data.pktModelManufacturer = String(data.pktModelManufacturer ?? "").trim();
  data.pktModelName = String(data.pktModelName ?? "").trim();
  data.pktModelMinimumQuality = Math.max(0, Math.min(PKT_QUALITY_LABELS.length - 1, intValue(data.pktModelMinimumQuality)));
  data.pktModelPrice = Math.max(0, intValue(data.pktModelPrice));
  data.pktModelAutoPrice = form.elements.pktModelAutoPrice?.checked === true;
  data.pktModelComponents = parseList(data.pktModelComponents);
  try {
    const parsedBases = JSON.parse(String(data.pktModelBaseComponentsJson ?? "[]") || "[]");
    data.pktModelBaseComponents = normalizePktBaseComponents(parsedBases);
  } catch (error) {
    throw new Error(`Базы модели: ${error.message}`);
  }
  try {
    const parsedExtras = JSON.parse(String(data.pktModelExtraComponentsJson ?? "[]") || "[]");
    data.pktModelExtraComponents = normalizePktExtraComponents(parsedExtras);
  } catch (error) {
    throw new Error(`Дополнительные компоненты модели: ${error.message}`);
  }
  if (data.pktModelAutoPrice) {
    const basePrice = data.pktModelBaseComponents.reduce((sum, entry) => sum + Math.max(0, Number(entry.priceEddies) || 0) * Math.max(1, intValue(entry.quantity, 1)), 0);
    const extraPrice = data.pktModelExtraComponents.reduce((sum, entry) => sum + Math.max(0, Number(entry.priceEddies) || 0) * Math.max(1, intValue(entry.quantity, 1)), 0);
    data.pktModelPrice = Math.max(0, Math.trunc(basePrice + extraPrice));
  }
  data.pktModelChoiceLabel = String(data.pktModelChoiceLabel ?? "").trim();
  data.pktModelChoiceUuids = parseList(data.pktModelChoiceUuids);
  const stress = normalizeStress(data.stressFormula);
  data.stressDisplay = stress.display;
  data.stressFormula = stress.formula;
  data.stressInlineRoll = form.elements.stressInlineRoll?.checked === true;
  data.checkSyntax = String(data.checkSyntax ?? "").trim();
  data.rarity = ["common", "uncommon", "rare", "unique"].includes(data.rarity) ? data.rarity : "common";
  data.itemDocumentType = PHYSICAL_ITEM_TYPES.has(data.itemDocumentType) ? data.itemDocumentType : "equipment";
  data.weaponCategory = String(data.weaponCategory ?? "martial").trim() || "martial";
  data.weaponGroup = String(data.weaponGroup ?? "brawling").trim() || "brawling";
  data.weaponBaseItem = String(data.weaponBaseItem ?? "").trim();
  data.weaponGrade = String(data.weaponGrade ?? "commercial").trim() || "commercial";
  data.weaponBonus = signedIntValue(data.weaponBonus, 0);
  data.weaponDamageDice = Math.max(0, intValue(data.weaponDamageDice, 1));
  data.weaponDamageDie = ["", "d4","d6","d8","d10","d12"].includes(data.weaponDamageDie) ? (data.weaponDamageDie || null) : "d6";
  data.weaponDamageType = String(data.weaponDamageType ?? "bludgeoning").trim() || "bludgeoning";
  data.weaponBonusDamage = signedIntValue(data.weaponBonusDamage, 0);
  data.weaponSplashDamage = Math.max(0, intValue(data.weaponSplashDamage, 0));
  data.weaponRange = nullableNumber(data.weaponRange);
  data.weaponReload = String(data.weaponReload ?? "").trim();
  data.weaponUsage = String(data.weaponUsage ?? "held-in-one-hand").trim() || "held-in-one-hand";
  data.weaponExpend = nullableNumber(data.weaponExpend);
  data.weaponAmmoBaseType = String(data.weaponAmmoBaseType ?? "").trim();
  data.weaponAmmoBuiltIn = form.elements.weaponAmmoBuiltIn?.checked === true;
  data.weaponAmmoCapacity = Math.max(0, intValue(data.weaponAmmoCapacity, 0));
  data.weaponHardness = Math.max(0, intValue(data.weaponHardness, 0));
  data.weaponHpMax = Math.max(0, intValue(data.weaponHpMax, 0));
  data.weaponMaterialType = String(data.weaponMaterialType ?? "").trim();
  data.weaponMaterialGrade = String(data.weaponMaterialGrade ?? "").trim();
  data.weaponTraits = mergeUnique(parseList(form.elements.weaponTraitsPicker?.value), parseList(data.weaponTraitsCustom));
  data.weaponSystemPatch = objectPatch(data.weaponSystemPatchJson, "Дополнительные данные оружия");
  data.armorCategory = String(data.armorCategory ?? "light").trim() || "light";
  data.armorGroup = String(data.armorGroup ?? "cloth").trim() || "cloth";
  data.armorBaseItem = String(data.armorBaseItem ?? "").trim();
  data.armorGrade = String(data.armorGrade ?? "commercial").trim() || "commercial";
  data.armorAcBonus = signedIntValue(data.armorAcBonus, 1);
  data.armorDexCap = signedIntValue(data.armorDexCap, 0);
  data.armorCheckPenalty = signedIntValue(data.armorCheckPenalty, 0);
  data.armorSpeedPenalty = signedIntValue(data.armorSpeedPenalty, 0);
  data.armorStrength = Math.max(0, intValue(data.armorStrength));
  data.armorHardness = Math.max(0, intValue(data.armorHardness, 0));
  data.armorHpMax = Math.max(0, intValue(data.armorHpMax, 0));
  data.armorMaterialType = String(data.armorMaterialType ?? "").trim();
  data.armorMaterialGrade = String(data.armorMaterialGrade ?? "").trim();
  data.armorTraits = mergeUnique(parseList(form.elements.armorTraitsPicker?.value), parseList(data.armorTraitsCustom));
  data.armorSystemPatch = objectPatch(data.armorSystemPatchJson, "Дополнительные данные брони");
  data.traits = parseList(data.traits);
  data.grantItemUuids = parseList(data.grantItemUuids);
  data.rules = normalizeRules(data.rulesJson);
  validateRules(data.rules);
  data.activationEffectRules = normalizeRules(data.activationEffectRulesJson);
  validateRules(data.activationEffectRules);
  data.activationGrantItemUuids = parseList(data.activationGrantItemUuids);
  data.activationDurationValue = Math.max(1, intValue(data.activationDurationValue, 1));
  data.activationFrequencyMax = Math.max(1, intValue(data.activationFrequencyMax, 1));
  for (const key of ["installed","pktOnly","pktBody","pktBiosystem","pktReplaceable","pktReplaceableBase","humanityEnabled","openSheet","activationEnabled","activationEffectTokenIcon","activationChatMessage","activationShowOnSheet"]) {
    data[key] = form.elements[key]?.checked === true;
  }
  data.replaceTemplateRules = form.elements.replaceTemplateRules?.checked === true;
  return data;
}

function mergeUnique(array, additions) { return [...new Set([...(Array.isArray(array) ? array : []), ...additions].filter(Boolean))]; }

function targetFlags(namespace, data) {
  const flag = { cyberware: true, installed: data.installed, implantType: data.implantType, hardCost: data.hardCost, stressFormula: data.stressFormula };
  if (data.implantType === "base") {
    flag.slots = data.slots;
    flag.pktInternalSlots = Math.max(0,intValue(data.internalSlots,0));
    flag.pktExternalSlots = Math.max(0,intValue(data.externalSlots,0));
    flag.pktComponentQuality = Math.max(0,intValue(data.pktComponentQuality,0));
  }
  if (data.implantType === "module") flag.slotsUsed = data.slots;
  if (!["base", "module"].includes(data.implantType) && data.slots > 0) flag.slotsUsed = data.slots;
  if (data.exclusiveFamily) flag.exclusiveFamily = data.exclusiveFamily;
  if (data.grantItemUuids.length) flag.grantItemUuids = data.grantItemUuids;
  if (data.pktOnly) flag.pktOnly = true;
  if (data.pktBody) { flag.pktBody = true; flag.pktQuality = data.pktQuality; }
  if (data.pktBiosystem) flag.pktBiosystem = true;
  if (data.pktFamily) flag.pktFamily = data.pktFamily;
  if (data.pktParentFamily) flag.pktParentFamily = data.pktParentFamily;
  if (data.implantType === "base") {
    flag.pktReplaceableBase = data.pktReplaceableBase === true;
    if (data.pktReplaceableBase === true || data.pktReplaceable === true) flag.pktReplaceable = true;
    else flag.pktReplaceable = false;
  } else if (data.pktReplaceable) flag.pktReplaceable = true;
  if (data.priceEddies > 0) flag.priceEddies = data.priceEddies;
  if (Array.isArray(data.pktPrerequisites) && data.pktPrerequisites.length) flag.pktPrerequisites = foundry.utils.deepClone(data.pktPrerequisites);
  if (Array.isArray(data.pktPrerequisiteChoices) && data.pktPrerequisiteChoices.length) flag.pktPrerequisiteChoices = foundry.utils.deepClone(data.pktPrerequisiteChoices);
  const creatorFlag = { createdWith: MODULE_VERSION };
  if (Array.isArray(data.pktPrerequisites) && data.pktPrerequisites.length) creatorFlag.pktPrerequisites = foundry.utils.deepClone(data.pktPrerequisites);
  if (Array.isArray(data.pktPrerequisiteChoices) && data.pktPrerequisiteChoices.length) creatorFlag.pktPrerequisiteChoices = foundry.utils.deepClone(data.pktPrerequisiteChoices);
  const activation = activationFlagFromData(data);
  if (activation) creatorFlag.activation = activation;
  return { [namespace]: flag, [MODULE_ID]: creatorFlag };
}

function commonSystemForTypeChange(source) {
  const system = source?.system ?? {};
  return {
    description: foundry.utils.deepClone(system.description ?? { value: "", gm: "" }),
    rules: foundry.utils.deepClone(Array.isArray(system.rules) ? system.rules : []),
    traits: foundry.utils.deepClone(system.traits ?? { value: [], otherTags: [], rarity: "common" }),
    level: foundry.utils.deepClone(system.level ?? { value: 0 }),
    quantity: Number(system.quantity ?? 1) || 1,
    bulk: foundry.utils.deepClone(system.bulk ?? { value: 0 }),
    price: foundry.utils.deepClone(system.price ?? { value: { sp: 0 } }),
    equipped: foundry.utils.deepClone(system.equipped ?? { carryType: "worn", invested: null, handsHeld: 0 }),
    size: system.size ?? "med",
  };
}

function prepareSourceItemType(source, data) {
  const targetType = PHYSICAL_ITEM_TYPES.has(data.itemDocumentType) ? data.itemDocumentType : "equipment";
  if (source.type !== targetType) {
    source.system = commonSystemForTypeChange(source);
    source.type = targetType;
  }
  return source;
}

function applyWeaponData(source, data) {
  source.system.category = data.weaponCategory;
  source.system.group = data.weaponGroup || null;
  source.system.baseItem = data.weaponBaseItem || null;
  source.system.grade = data.weaponGrade || "commercial";
  source.system.bonus = { ...(source.system.bonus ?? {}), value: data.weaponBonus };
  source.system.damage = { ...(source.system.damage ?? {}), dice: data.weaponDamageDice, die: data.weaponDamageDie, damageType: data.weaponDamageType, persistent: source.system.damage?.persistent ?? null };
  source.system.bonusDamage = { ...(source.system.bonusDamage ?? {}), value: data.weaponBonusDamage };
  source.system.splashDamage = { ...(source.system.splashDamage ?? {}), value: data.weaponSplashDamage };
  source.system.range = data.weaponRange;
  source.system.reload = { ...(source.system.reload ?? {}), value: data.weaponReload || null };
  source.system.usage = { ...(source.system.usage ?? {}), value: data.weaponUsage, canBeAmmo: source.system.usage?.canBeAmmo ?? false };
  source.system.expend = data.weaponExpend;
  source.system.ammo = (data.weaponAmmoBaseType || data.weaponAmmoBuiltIn || data.weaponAmmoCapacity > 0) ? { baseType: data.weaponAmmoBaseType || null, builtIn: data.weaponAmmoBuiltIn, ...(data.weaponAmmoCapacity > 0 ? { capacity: data.weaponAmmoCapacity } : {}) } : null;
  source.system.hardness = data.weaponHardness;
  source.system.hp = { ...(source.system.hp ?? {}), value: data.weaponHpMax, max: data.weaponHpMax };
  source.system.material = { ...(source.system.material ?? {}), type: data.weaponMaterialType || null, grade: data.weaponMaterialGrade || null };
  source.system.equipped = { ...(source.system.equipped ?? {}), carryType: "worn", invested: source.system.equipped?.invested ?? null, handsHeld: 0 };
  source.system.runes = { potency: 0, striking: 0, property: [] };
  source.system.traits ??= { value: [], otherTags: [], rarity: "common" };
  source.system.traits.value = mergeUnique(source.system.traits.value, data.weaponTraits);
  deepMergeObject(source.system, data.weaponSystemPatch);
}

function applyArmorData(source, data) {
  source.system.category = data.armorCategory;
  source.system.group = data.armorGroup || null;
  source.system.baseItem = data.armorBaseItem || null;
  source.system.grade = data.armorGrade || "commercial";
  source.system.acBonus = data.armorAcBonus;
  source.system.dexCap = data.armorDexCap;
  source.system.checkPenalty = data.armorCheckPenalty;
  source.system.speedPenalty = data.armorSpeedPenalty;
  source.system.strength = data.armorStrength;
  source.system.hardness = data.armorHardness;
  source.system.hp = { ...(source.system.hp ?? {}), value: data.armorHpMax, max: data.armorHpMax };
  source.system.material = { ...(source.system.material ?? {}), type: data.armorMaterialType || null, grade: data.armorMaterialGrade || null };
  source.system.equipped = { ...(source.system.equipped ?? {}), carryType: "worn", invested: source.system.equipped?.invested ?? null };
  source.system.runes = { potency: 0, resilient: 0, property: [] };
  source.system.traits ??= { value: [], otherTags: [], rarity: "common" };
  source.system.traits.value = mergeUnique(source.system.traits.value, data.armorTraits);
  deepMergeObject(source.system, data.armorSystemPatch);
}

function applyCyberwareData(source, data, namespace) {
  prepareSourceItemType(source, data);
  source.name = data.name || source.name || "Новый имплант";
  if (data.img) source.img = data.img;
  source.system ??= {};
  source.system.description ??= {};
  source.system.description.value = canonicalDescription(data);
  const existingRules = Array.isArray(source.system.rules) ? source.system.rules : [];
  source.system.rules = data.replaceTemplateRules ? [...data.rules] : [...existingRules, ...data.rules];

  if (data.humanityEnabled) source.system.rules.push({
    key: "CyberpunkHumanity", mode: data.humanityMode === "override" ? "override" : "add",
    value: Number(data.humanityValue || 0), label: data.humanityLabel || source.name,
  });

  // Нативные поля Physical Item SF2e: уровень, цена, масса (Bulk) и размер.
  // Cyberpunk Remaster использует sp как числовой носитель эдди, поэтому 1 эдди = 1 sp в данных Item.
  source.system.level = { ...(source.system.level ?? {}), value: Number(data.itemLevel ?? 0) };
  source.system.price = { ...(source.system.price ?? {}), value: { sp: data.priceEddies } };
  source.system.bulk = { ...(source.system.bulk ?? {}), value: Number(data.bulkValue ?? 0) };
  source.system.size = data.itemSize ?? "med";

  source.system.traits ??= {};
  source.system.traits.rarity = data.rarity ?? source.system.traits.rarity ?? "common";
  source.system.traits.value = mergeUnique(source.system.traits.value, data.traits);
  if (data.pktOnly) source.system.traits.value = mergeUnique(source.system.traits.value, ["pkt"]);

  if (source.type === "weapon") applyWeaponData(source, data);
  if (source.type === "armor") applyArmorData(source, data);

  if (source.type === "equipment") {
    source.system.usage = { ...(source.system.usage ?? {}), type: "implanted", value: "implanted" };
    source.system.equipped ??= {};
    source.system.equipped.carryType = data.installed ? "implanted" : (source.system.equipped.carryType === "implanted" ? "worn" : (source.system.equipped.carryType ?? "worn"));
    source.system.equipped.handsHeld = 0;
  }

  source.flags ??= {};
  Object.assign(source.flags, targetFlags(namespace, data));
  source._stats ??= {};
  delete source._stats.compendiumSource; delete source._id; delete source.folder; delete source.ownership;
  return source;
}

async function getTemplateSource(key) {
  if (!key || key === "blank") return { name: "Новый имплант", type: "equipment", system: {}, flags: {} };
  if (key.startsWith("pack:")) {
    const [, packId, itemId] = key.split(":");
    const doc = await game.packs.get(packId)?.getDocument(itemId);
    if (!doc) throw new Error("Не найден шаблон в compendium.");
    return doc.toObject();
  }
  if (key.startsWith("world:")) {
    const doc = game.items.get(key.slice(6)); if (!doc) throw new Error("Не найден мировой Item-шаблон."); return doc.toObject();
  }
  if (key.startsWith("uuid:")) {
    const doc = await fromUuid(key.slice(5)); if (!doc?.toObject) throw new Error("UUID не указывает на Item."); return doc.toObject();
  }
  throw new Error("Неизвестный источник шаблона.");
}

async function buildTemplateOptions() {
  const options = [{ value: "blank", label: "Пустой SF2e Equipment" }];
  for (const id of REMASTER_IDS) {
    for (const pack of game.packs.filter((p) => p.metadata?.packageName === id && p.documentName === "Item")) {
      try {
        const index = await pack.getIndex({ fields: ["type"] });
        for (const entry of [...index].sort((a, b) => a.name.localeCompare(b.name, "ru"))) {
          options.push({ value: `pack:${pack.collection}:${entry._id}`, label: `[${id}/${pack.metadata.label}] ${entry.name} — ${entry.type ?? "Item"}` });
        }
      } catch (error) { console.warn(`${MODULE_ID} | Failed to index ${pack.collection}`, error); }
    }
  }
  for (const item of [...game.items].filter((item) => item.type).sort((a, b) => a.name.localeCompare(b.name, "ru"))) {
    options.push({ value: `world:${item.id}`, label: `[Мир] ${item.name} — ${item.type}` });
  }
  return options;
}

function optionHtml(options) { return options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join(""); }
function selectedActorOptions() {
  const actors = [...game.actors].filter((a) => a.type === "character").sort((a,b)=>a.name.localeCompare(b.name,"ru"));
  return [`<option value="">В Items мира</option>`, ...actors.map((a)=>`<option value="${a.id}">На персонажа: ${esc(a.name)}</option>`)].join("");
}
function rulePresetOptions() { return Object.entries(RULE_PRESETS).map(([k,p])=>`<option value="${k}">${esc(p.label)}</option>`).join(""); }

function modalHtml(templateOptions, combatCatalogs = sf2eCombatCatalogs()) {
  return `
  <div class="cic-backdrop" data-cic-close></div>
  <section class="cic-window" role="dialog" aria-modal="true" aria-label="Конструктор имплантов">
    <header class="cic-header">
      <div><h2><i class="fa-solid fa-microchip"></i> Конструктор имплантов <small>v${MODULE_VERSION}</small></h2><p>Cyberpunk Remaster / SF2e — расширенный режим</p></div>
      <div class="cic-header-actions">
        <button type="button" class="cic-manual-button" data-cic-manual title="Открыть полный мануал в Журналах Foundry"><i class="fa-solid fa-book-open"></i> Мануал</button>
        <span class="cic-window-controls" aria-label="Размер окна">
          <button type="button" class="cic-icon cic-window-control" data-cic-minimize title="Свернуть конструктор" aria-label="Свернуть"><i class="fa-solid fa-window-minimize"></i></button>
          <button type="button" class="cic-icon cic-window-control" data-cic-normal title="Обычный размер" aria-label="Обычный размер"><i class="fa-regular fa-window-restore"></i></button>
          <button type="button" class="cic-icon cic-window-control" data-cic-maximize title="Развернуть на весь экран" aria-label="На весь экран"><i class="fa-solid fa-expand"></i></button>
        </span>
        <button type="button" class="cic-icon" data-cic-close title="Закрыть"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </header>
    <form class="cic-form">
      <nav class="cic-tabs">
        <button type="button" class="active" data-tab="main">Основное</button>
        <button type="button" data-tab="combat">Оружие / броня</button>
        <button type="button" data-tab="compat">Механика</button>
        <button type="button" data-tab="description">Описание / проверки</button>
        <button type="button" data-tab="activation">Активация / эффект</button>
        <button type="button" data-tab="effects">Rule Elements</button>
        <button type="button" data-tab="presets">Пресеты</button>
        <button type="button" data-tab="preview">Предпросмотр</button>
      </nav>

      <div class="cic-tab active" data-pane="main"><div class="cic-grid two">
        <label class="wide">Шаблон из Remaster / мира
          <select name="templateKey">${optionHtml(templateOptions)}</select>
          <small>Для кибероружия, брони и сложных предметов выбирайте настоящий Item-шаблон — его SF2e-схема будет сохранена.</small>
        </label>
        <label>Профиль
          <select name="preset">
            <option value="internal">Внутренний имплант</option><option value="external">Внешний имплант</option><option value="fashion">Стилевой имплант</option>
            <option value="unique">Уникальный имплант</option><option value="manufacturer">Имплант производителя</option><option value="base">База — произвольная</option><option value="module">Модуль — произвольный</option>
            <optgroup label="Базы Remaster"><option value="cyberArmBase">Киберрука — база</option><option value="cyberLegBase">Кибернога — база</option><option value="cyberEyeBase">Киберглаз — база</option><option value="cyberAudioBase">Кибераудио — база</option><option value="neuralLinkBase">Нейролинк — база</option></optgroup>
            <optgroup label="Модули Remaster"><option value="cyberArmModule">Киберрука — модуль</option><option value="cyberLegModule">Кибернога — модуль</option><option value="cyberEyeModule">Киберглаз — модуль</option><option value="cyberAudioModule">Кибераудио — модуль</option><option value="neuralLinkModule">Нейролинк — модуль</option></optgroup>
            <option value="neural">Нейронный ускоритель</option><option value="cyberdeck">Кибердека</option>
            <optgroup label="ПКТ"><option value="pktBiosystem">ПКТ — Биосистема</option><option value="pktBody">ПКТ — Корпус</option><option value="pktImplant">ПКТ — Имплант</option><option value="pktBase">ПКТ — База</option><option value="pktModule">ПКТ — Модуль</option><option value="pktUnique">ПКТ — Уникальный имплант</option></optgroup>
            <option value="custom">Пользовательский</option>
          </select>
        </label>
        <label>Куда создать <select name="actorId">${selectedActorOptions()}</select></label>
        <label class="wide">Название <input name="name" required placeholder="Например: Киберрука «Арес»"></label>
        <label class="wide">Картинка / иконка
          <span class="cic-inline"><input name="img" placeholder="modules/.../implant.webp"><button type="button" data-pick-image><i class="fa-solid fa-image"></i> Выбрать</button></span>
          <span class="cic-image-preview"><img data-image-preview src="icons/svg/circuitry.svg" alt="Предпросмотр"></span>
        </label>
        <label>Тип импланта <select name="implantType"><option value="internal">Внутренний</option><option value="external">Внешний</option><option value="fashion">Стилевой</option><option value="base">База</option><option value="module">Модуль</option></select></label>
        <label>Тип Item SF2e <select name="itemDocumentType"><option value="equipment">Снаряжение / обычный имплант</option><option value="weapon">Оружие / кибероружие</option><option value="armor">Броня / киберброня</option></select><small>Оружие и броня остаются имплантами Remaster, но используют нативный лист и боевую механику SF2e.</small></label>
        <label>Уровень предмета <input name="itemLevel" type="number" min="0" max="30" step="1" value="0"><small>Записывается в штатное поле уровня Item SF2e.</small></label>
        <label>Цена, эдди <input name="priceEddies" type="number" min="0" value="0"><small>Записывается в штатное поле «Цена» SF2e, а не в описание.</small></label>
        <label>Размер <select name="itemSize"><option value="tiny">Крошечный</option><option value="sm">Маленький</option><option value="med" selected>Средний</option><option value="lg">Большой</option><option value="huge">Огромный</option><option value="grg">Исполинский</option></select></label>
        <label>Масса / Bulk <select name="bulkValue"><option value="0">Незначительная — 0</option><option value="0.1">Лёгкая — L</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="8">8</option><option value="10">10</option><option value="16">16</option><option value="custom">Своя…</option></select><small>Это штатное поле «Масса»/Bulk предмета.</small></label>
        <label>Своя масса / Bulk <input name="bulkCustom" type="number" min="0" step="0.1" value="0"><small>Используется, если выше выбрано «Своя…».</small></label>
        <label>Редкость предмета <select name="rarity"><option value="common">Common / Обычная</option><option value="uncommon">Uncommon / Необычная</option><option value="rare">Rare / Редкая</option><option value="unique">Unique / Уникальная</option></select></label>
        <label>Hard Cost <input name="hardCost" type="number" min="0" value="0"></label>
        <label>Stress Cost — вручную
          <input name="stressFormula" value="0" placeholder="2d6 + 1d4 или [[/r 2d6 + 1d4 #Потеря Человечности]]">
          <small>Можно вписать формулу самому или полную inline-запись Foundry. Для механики Remaster внутри должны быть только d4/d6.</small>
        </label>
        <label class="wide">Быстрые Stress Cost
          <span class="cic-chip-row">${["0","1d4","1d6","2d4","2d6","3d6","4d6","1d4 + 1d6","2d4 + 1d6"].map(x=>`<button type="button" class="cic-chip" data-stress="${x}">${x}</button>`).join("")}</span>
        </label>
        <label class="check"><input name="stressInlineRoll" type="checkbox" checked> Если введены только кубы — автоматически оформить как ` + "`[[/r ... #Потеря Человечности]]`" + `</label>
        <label class="wide">Проверка установки — как в Remaster
          <input name="checkSyntax" value="@Check[flat|dc:5|showDC:all]" placeholder="@Check[flat|dc:5|showDC:all]">
          <small>Записывается отдельной канонической строкой <b>Проверка:</b> сразу под Stress Cost/Hard Cost.</small>
          <span class="cic-chip-row">${[3,5,8,11,14,20].map(dc=>`<button type="button" class="cic-chip" data-main-check-dc="${dc}">Flat КС ${dc}</button>`).join("")}</span>
        </label>
        <label>Слоты <input name="slots" type="number" min="0" value="0"><small>Для базы — вместимость; для модуля — сколько занимает.</small></label>
        <label class="check"><input name="installed" type="checkbox"> Создать установленным</label>
      </div></div>

      <div class="cic-tab" data-pane="combat">
        <section class="cic-toolbox"><h3>Боевой тип импланта — нативные поля SF2e</h3><p class="cic-help">Выберите «Оружие» или «Броня» в поле <b>Тип Item SF2e</b>. Категории, группы, базовые предметы, типы урона и traits берутся из активного <code>CONFIG.SF2E</code>, а поля с подсказками позволяют вписать собственный slug.</p><p class="cic-help"><b>Руны не используются как основа прогрессии.</b> Potency/Striking/Resilient создаются нулевыми. Вместо этого используется штатное поле <b>Grade / качество SF2e</b>: Серийное, Тактическое, Продвинутое, Превосходное и дополнительные значения, которые публикует активная система.</p></section>
        <section class="cic-toolbox cic-combat-section" data-combat-type="weapon"><h3>Кибероружие — Item типа Weapon</h3>
          <div class="cic-grid three">
            <label>Категория владения <select name="weaponCategory">${catalogSelectOptions(combatCatalogs.weaponCategories, "martial")}</select></label>
            <label>Качество / Grade SF2e <select name="weaponGrade">${catalogSelectOptions(combatCatalogs.grades, "commercial")}</select><small>Нативное <code>system.grade</code>, не руна.</small></label>
            ${catalogPickerHtml({field:"weaponGroup",label:"Группа оружия",entries:combatCatalogs.weaponGroups,value:"brawling",help:"Прокручиваемая база SF2e/Remaster; значение выбирается только из списка."})}
            ${catalogPickerHtml({field:"weaponBaseItem",label:"Базовое оружие",entries:combatCatalogs.weaponBaseItems,value:"fist",help:"Нативный baseItem. Значение выбирается только из базы SF2e/Remaster."})}
            ${catalogPickerHtml({field:"weaponDamageType",label:"Тип урона",entries:combatCatalogs.damageTypes,value:"bludgeoning",allowEmpty:false,help:"Тип урона берётся из CONFIG.SF2E и резервной базы Remaster."})}
            <label>Кубов урона <input name="weaponDamageDice" type="number" min="0" max="30" value="1"><small>0 допустимо для пускателей/оружия, где урон идёт от боеприпаса.</small></label>
            <label>Куб урона <select name="weaponDamageDie"><option value="">— нет —</option><option>d4</option><option selected>d6</option><option>d8</option><option>d10</option><option>d12</option></select></label>
            <label>Постоянный бонус урона <input name="weaponBonusDamage" type="number" step="1" value="0"></label>
            <label>Урон по области / Splash <input name="weaponSplashDamage" type="number" min="0" step="1" value="0"></label>
            <label>Бонус атаки предмета <input name="weaponBonus" type="number" step="1" value="0"></label>
            <label>Дальность / шаг дистанции <input name="weaponRange" type="number" min="0" step="5" placeholder="пусто = ближний бой"></label>
            <label>Перезарядка <input name="weaponReload" placeholder="1, 2, -"><small>Нативное <code>reload.value</code>.</small></label>
            <label>Расход за выстрел / Expend <input name="weaponExpend" type="number" min="0" step="1" placeholder="пусто"><small>Например 1 для оружия с боезапасом.</small></label>
            <label>Использование <select name="weaponUsage"><option value="held-in-one-hand">Одна рука</option><option value="held-in-two-hands">Две руки</option><option value="worn">Носимое</option><option value="installed">Установленное</option></select></label>
            <label>Тип боеприпаса / Ammo baseType <input name="weaponAmmoBaseType" placeholder="slug типа боеприпаса"></label>
            <label class="check"><input name="weaponAmmoBuiltIn" type="checkbox"> Встроенный магазин / боезапас</label>
            <label>Ёмкость магазина <input name="weaponAmmoCapacity" type="number" min="0" step="1" value="0"></label>
            <label>Твёрдость <input name="weaponHardness" type="number" min="0" step="1" value="0"></label>
            <label>HP предмета <input name="weaponHpMax" type="number" min="0" step="1" value="0"></label>
            ${catalogPickerHtml({field:"weaponMaterialType",label:"Материал",entries:combatCatalogs.materials,value:"",help:"Материалы берутся из CONFIG.SF2E; резервная база дополняется материалами из Remaster. Ручной slug отключён."})}
            ${catalogPickerHtml({field:"weaponMaterialGrade",label:"Качество материала",entries:combatCatalogs.materialGrades,value:"",help:"Нативное system.material.grade: например low / standard / high."})}
            ${catalogPickerHtml({field:"weaponTraitsPicker",label:"Traits оружия",entries:combatCatalogs.weaponTraits,value:"",multi:true,wide:true,help:"Добавляйте traits по одному через поиск и прокручиваемый список. Выбранные traits показаны тегами и удаляются крестиком."})}
            <label class="wide">Дополнительные traits оружия <input name="weaponTraitsCustom" placeholder="свои slug через запятую"></label>
            <label class="wide">Расширенные поля Weapon — JSON patch<textarea name="weaponSystemPatchJson" rows="6" spellcheck="false" placeholder='{"ammo":{"builtIn":true,"capacity":6},"specific":null}'></textarea><small>Низкоуровневый доступ к любому полю <code>system</code> оружия SF2e. Применяется последним.</small></label>
          </div>
          <p class="cic-help">Кибероружие создаётся настоящим <code>weapon</code>: оно использует нативные категории, группу, baseItem, damage, range, reload, ammo, grade и traits SF2e и может отображаться среди атак персонажа.</p>
        </section>
        <section class="cic-toolbox cic-combat-section" data-combat-type="armor"><h3>Киберброня — Item типа Armor</h3>
          <div class="cic-grid three">
            <label>Категория <select name="armorCategory">${catalogSelectOptions(combatCatalogs.armorCategories, "light")}</select></label>
            <label>Качество / Grade SF2e <select name="armorGrade">${catalogSelectOptions(combatCatalogs.grades, "commercial")}</select><small>Нативное <code>system.grade</code>, без рунной прогрессии.</small></label>
            ${catalogPickerHtml({field:"armorGroup",label:"Группа брони",entries:combatCatalogs.armorGroups,value:"cloth",help:"Прокручиваемая база групп SF2e/Remaster с поиском."})}
            ${catalogPickerHtml({field:"armorBaseItem",label:"Базовая броня",entries:combatCatalogs.armorBaseItems,value:"",help:"Нативный baseItem брони; можно оставить пустым или выбрать значение из базы."})}
            <label>Бонус КБ <input name="armorAcBonus" type="number" step="1" value="1"></label>
            <label>Лимит Ловкости <input name="armorDexCap" type="number" step="1" value="3"></label>
            <label>Штраф проверок <input name="armorCheckPenalty" type="number" step="1" value="0"></label>
            <label>Штраф скорости <input name="armorSpeedPenalty" type="number" step="5" value="0"></label>
            <label>Требование Силы <input name="armorStrength" type="number" min="0" step="1" value="0"></label>
            <label>Твёрдость <input name="armorHardness" type="number" min="0" step="1" value="0"></label>
            <label>HP предмета <input name="armorHpMax" type="number" min="0" step="1" value="0"></label>
            ${catalogPickerHtml({field:"armorMaterialType",label:"Материал",entries:combatCatalogs.materials,value:"",help:"Выбор материала из SF2e/Remaster только из списка."})}
            ${catalogPickerHtml({field:"armorMaterialGrade",label:"Качество материала",entries:combatCatalogs.materialGrades,value:"",help:"Качество материала хранится отдельно от Grade самой брони."})}
            ${catalogPickerHtml({field:"armorTraitsPicker",label:"Traits брони",entries:combatCatalogs.armorTraits,value:"",multi:true,wide:true,help:"Добавляйте traits брони через поиск/список; выбранные значения отображаются тегами."})}
            <label class="wide">Дополнительные traits брони <input name="armorTraitsCustom" placeholder="свои slug через запятую"></label>
            <label class="wide">Расширенные поля Armor — JSON patch<textarea name="armorSystemPatchJson" rows="6" spellcheck="false" placeholder='{"specific":null,"subitems":[]}'></textarea><small>Низкоуровневый доступ к любому полю <code>system</code> брони SF2e. Применяется последним.</small></label>
          </div>
          <p class="cic-help">Киберброня создаётся настоящим <code>armor</code> и использует нативные поля SF2e: category, group, baseItem, grade, AC, Dex Cap, Strength, штрафы, material, hardness, HP и traits.</p>
        </section>
      </div>

      <div class="cic-tab" data-pane="compat"><div class="cic-grid two">
        <label class="check"><input name="pktOnly" type="checkbox"> Только для ПКТ</label><label class="check"><input name="pktBiosystem" type="checkbox"> Это Биосистема ПКТ</label>
        <label class="check"><input name="pktBody" type="checkbox"> Это корпус Полной Конверсии Тела</label>
        <label>Качество корпуса ПКТ <select name="pktQuality">${PKT_QUALITY_LABELS.map((x,i)=>`<option value="${i}">${i} — ${x}</option>`).join("")}</select></label>
        <label>Качество базы для замены ПКТ <select name="pktComponentQuality">${PKT_QUALITY_LABELS.map((x,i)=>`<option value="${i}">${i} — ${x}</option>`).join("")}</select><small>Используется, если этот Item — заменяемая база ПКТ.</small></label>
        <label>Внутренние слоты базы <input name="internalSlots" type="number" min="0" value="0"><small>Сколько внутренних компонентов допускает эта база.</small></label>
        <label>Внешние слоты базы <input name="externalSlots" type="number" min="0" value="0"><small>Сколько внешних компонентов допускает эта база.</small></label>
        <label>Эксклюзивная серия <input name="exclusiveFamily" placeholder="cyberdeck"></label><label>Семейство ПКТ <input name="pktFamily" list="cic-pkt-family-list" placeholder="выберите или введите slug"></label>
        <label>Родительское семейство ПКТ <input name="pktParentFamily" list="cic-pkt-base-family-list" placeholder="выберите базу или введите slug"></label>
        <datalist id="cic-pkt-family-list">${PKT_COMPONENT_FAMILY_CATALOG.map(([slug,label])=>`<option value="${slug}">${label}</option>`).join("")}</datalist><datalist id="cic-pkt-base-family-list">${PKT_BASE_FAMILY_CATALOG.map(([slug,label])=>`<option value="${slug}">${label}</option>`).join("")}</datalist>
        <label class="check"><input name="pktReplaceable" type="checkbox"> Компонент заменяем в модели ПКТ</label><label class="check"><input name="pktReplaceableBase" type="checkbox" checked> Использовать эту базу как вариант замены ПКТ</label>
        <label class="wide">Черты SF2e <input name="traits" placeholder="pkt, neironn-uskoritell"><small>Через запятую. Можно вписывать любые существующие traits системы.</small></label>
        <label class="wide">Выдаваемые предметы Remaster (UUID)<textarea name="grantItemUuids" rows="5" placeholder="Compendium.cyberpunk-remaster.cyberpunk-items.Item.xxxxxxxxxxxxxxxx"></textarea><small>По одному UUID на строку. Это механизм флага Remaster; Rule Element GrantItem доступен отдельно.</small></label>
      </div>
      <section class="cic-toolbox cic-pkt-model-builder"><h3>Пользовательская готовая модель ПКТ</h3>
        <p class="cic-help">Этот блок добавляет созданный комплект в раздел <b>«Готовые модели ПКТ»</b> Cyberpunk Remaster. Модель хранится в мире Foundry и показывается рядом со штатными Raven / Dynalar / Militech. Цена, как и у штатного каталога, автоматически не списывается.</p>
        <div class="cic-grid two">
          <label class="check wide"><input name="pktRegisterModel" type="checkbox"> После создания зарегистрировать как готовую модель ПКТ</label>
          <label>Производитель <input name="pktModelManufacturer" placeholder="Raven Microcybernetics"></label>
          <label>Название модели <input name="pktModelName" placeholder="Близнецы"><small>Если пусто — используется название создаваемого Item.</small></label>
          <label>Минимальный корпус ПКТ <select name="pktModelMinimumQuality">${PKT_QUALITY_LABELS.map((x,i)=>`<option value="${i}">${i} — ${x}</option>`).join("")}</select></label>
          <label>Цена комплекта, эдди <input name="pktModelPrice" type="number" min="0" value="0"><small>Цена готовой модели без стоимости корпуса. В ручном режиме её можно задать самостоятельно.</small></label>
          <label class="check"><input name="pktModelAutoPrice" type="checkbox" checked> Авто из состава баз и доп. компонентов<small>Если включено, цена модели автоматически равна сумме всех Баз × количество + всех Доп. компонентов × количество.</small></label>
          <label class="check wide"><input name="pktModelIncludeCreated" type="checkbox" checked> Включить создаваемый сейчас имплант в состав модели</label>
          <div class="wide cic-pkt-composition-editor">
            <div class="cic-pkt-builder-tabs"><button type="button" class="active" data-pkt-builder-tab="bases"><i class="fa-solid fa-layer-group"></i> Базы модели</button><button type="button" data-pkt-builder-tab="extras"><i class="fa-solid fa-puzzle-piece"></i> Доп. компоненты / модули</button></div>
            <section class="cic-pkt-extra-builder cic-pkt-base-builder cic-pkt-builder-pane active" data-pkt-builder-pane="bases">
              <div class="cic-pkt-extra-title"><strong>Базы модели</strong><button type="button" data-add-pkt-base><i class="fa-solid fa-plus"></i> Добавить базу</button></div>
              <p class="cic-help">UUID и название заполняются перетаскиванием. Если UUID вставить вручную и перейти из поля, конструктор сам найдёт Item, подставит название, семейство и Hard Cost. Для обычной базы замена разрешена. Если включить <b>«Уникальная база — замена запрещена»</b>, Remaster заблокирует замену этой базы до демонтажа всей модели.</p>
              <div data-pkt-base-list class="cic-pkt-extra-list cic-pkt-scroll-list"></div>
              <input type="hidden" name="pktModelBaseComponentsJson" value="[]">
            </section>
            <section class="cic-pkt-extra-builder cic-pkt-builder-pane" data-pkt-builder-pane="extras">
              <div class="cic-pkt-extra-title"><strong>Доп. компоненты / модули</strong><button type="button" data-add-pkt-extra><i class="fa-solid fa-plus"></i> Добавить модуль</button></div>
              <p class="cic-help">Семейство и родительская база выбираются из списков. Опция «можно снять отдельно» позволяет демонтировать отдельный модуль готовой пользовательской ПКТ без демонтажа всего комплекта. Hard и Stress можно учитывать независимо.</p>
              <div data-pkt-extra-list class="cic-pkt-extra-list cic-pkt-scroll-list"></div>
              <input type="hidden" name="pktModelExtraComponentsJson" value="[]">
              <textarea name="pktModelComponents" hidden></textarea>
            </section>
          </div>
          <label>Подпись выбора <input name="pktModelChoiceLabel" placeholder="Например: Вариант кисти"></label>
          <label class="wide">Варианты выбора — один Item из списка<textarea name="pktModelChoiceUuids" rows="5" data-cic-uuid-drop placeholder="Перетащите несколько Item/UUID. При установке игрок выберет один вариант."></textarea><small>Необязательно. Используется для моделей вроде тех, где в штатном каталоге есть строка «Выбор».</small></label>
        </div>
      </section>
      <section class="cic-toolbox cic-pkt-model-manager"><h3>Зарегистрированные пользовательские модели ПКТ</h3>
        <p class="cic-help">Здесь можно удалить модель, созданную через конструктор, из штатного каталога ПКТ. Уже установленные модели сначала нужно демонтировать на персонаже.</p>
        <div data-pkt-model-manager class="cic-pkt-model-manager-list"></div>
      </section>
      </div>

      <div class="cic-tab" data-pane="description">
        <div class="cic-grid two">
          <label class="wide">Описание импланта
            <textarea name="bodyHtml" rows="12" data-cic-uuid-drop placeholder="Описание эффекта импланта. Можно HTML, @Check, @UUID и inline rolls. Сюда можно перетащить предмет/способность/заклинание из Foundry — вставится кликабельная @UUID-ссылка."></textarea>
          </label>
        </div>
        <section class="cic-toolbox"><h3>Чистая проверка / @Check</h3>
          <div class="cic-grid three">
            <label>Тип проверки <select name="checkType"><option value="flat">Чистая (flat)</option><option value="fortitude">Стойкость</option><option value="reflex">Рефлекс</option><option value="will">Воля</option><option value="perception">Восприятие</option><option value="medicine">Медицина</option><option value="computers">Компьютеры</option><option value="custom">Другой slug…</option></select></label>
            <label>КС <input name="checkDc" type="number" min="0" value="11"></label><label>Другой slug проверки <input name="checkCustomType" placeholder="piloting"></label>
            <label>Или против КС <select name="checkAgainst"><option value="">Не использовать</option><option value="class">КС класса</option></select></label>
            <label>Показывать КС <select name="checkShowDc"><option value="all">Всем</option><option value="owner">Владельцу</option><option value="none">Не задавать</option></select></label>
            <label class="check"><input name="checkBasic" type="checkbox"> Basic save</label>
            <label>Трейты проверки <input name="checkTraits" placeholder="virulent, poison"></label>
            <label>Имя проверки <input name="checkName" placeholder="Название проверки"></label>
            <label>Подпись ссылки <input name="checkLabel" placeholder="Чистая проверка"></label>
          </div>
          <div class="cic-chip-row">${CHECK_PRESETS.map(([dc,label])=>`<button type="button" class="cic-chip" data-flat-dc="${dc}" title="${esc(label)}">Flat КС ${dc}</button>`).join("")}</div>
          <div class="cic-actions"><button type="button" data-apply-check-main><i class="fa-solid fa-arrow-up"></i> Записать в поле «Проверка»</button><button type="button" data-insert-check><i class="fa-solid fa-dice-d20"></i> Вставить @Check в описание</button><code data-check-preview></code></div>
        </section>
        <section class="cic-toolbox"><h3>Inline Roll / UUID</h3><div class="cic-grid two">
          <label>Формула броска <input name="inlineFormula" placeholder="1d6 + 2"></label><label>UUID <input name="inlineUuid" placeholder="Compendium.sf2e...Item..."></label>
          <label>Подпись UUID <input name="inlineUuidLabel" placeholder="Название эффекта"></label>
        </div><div class="cic-actions"><button type="button" data-insert-roll>Вставить [[/r формула]]</button><button type="button" data-insert-uuid>Вставить @UUID</button></div></section>
      </div>


      <div class="cic-tab" data-pane="activation">
        <section class="cic-toolbox"><h3>Активация импланта</h3>
          <div class="cic-grid two">
            <label class="check wide"><input name="activationEnabled" type="checkbox"> Имплант имеет активируемый эффект <small>Rule Elements из этого блока НЕ работают пассивно. Они создаются отдельным SF2e Effect только после активации.</small></label>
            <label class="check wide"><input name="activationShowOnSheet" type="checkbox" checked> Создать нативное действие SF2e на листе персонажа <small>Когда имплант установлен, отдельный Item типа Action появляется в «Действия», «Реакции» или «Свободные действия». Кнопка-молния рядом с ним включает/выключает временный эффект.</small></label>
            <label>Название активации <input name="activationName" value="Активировать" placeholder="Разгон"></label>
            <label>Стоимость действия <select name="activationActionType"><option value="action1">1 действие</option><option value="action2">2 действия</option><option value="action3">3 действия</option><option value="free">Свободное действие</option><option value="reaction">Реакция</option></select></label>
            <label class="wide">Traits активации
              <div class="cic-trait-picker" data-activation-trait-picker>
                <span class="cic-inline cic-trait-picker-row">
                  <input name="activationTraitSearch" type="search" placeholder="Поиск trait: concentrate, manipulate, auditory…" autocomplete="off">
                  <select name="activationTraitSelect">${activationTraitOptions()}</select>
                  <button type="button" data-add-activation-trait><i class="fa-solid fa-plus"></i> Добавить</button>
                </span>
                <div class="cic-trait-selected" data-activation-trait-selected></div>
                <span class="cic-inline cic-trait-custom-row">
                  <input name="activationTraitCustom" placeholder="Свой trait slug, если его нет в списке">
                  <button type="button" data-add-custom-activation-trait>Добавить свой</button>
                </span>
                <input name="activationTraits" type="hidden" value="">
                <small>Можно выбрать несколько traits. Список берётся из активной SF2e/PF2e системы, а собственный slug можно добавить вручную. Выбранные traits выводятся рядом с иконкой действия и сохраняются в активации.</small>
              </div>
            </label>
            <label>Частота <select name="activationFrequency"><option value="unlimited">Без ограничения</option><option value="round">Раз в раунд</option><option value="encounter">Раз за столкновение</option><option value="minute">Раз в минуту</option><option value="hour">Раз в час</option><option value="day">Раз в день</option></select></label>
            <label>Использований за период <input name="activationFrequencyMax" type="number" min="1" value="1"></label>
            <label class="wide">Требования <input name="activationRequirements" placeholder="Имплант установлен; вы в сознании"></label>
            <label class="wide">Триггер <input name="activationTrigger" placeholder="Ваша очередь хода"></label>
          </div>
        </section>
        <section class="cic-toolbox"><h3>Временный SF2e Effect</h3>
          <div class="cic-grid two">
            <label>Название эффекта <input name="activationEffectName" placeholder="оставьте пустым: Имплант — Разгон"></label>
            <label>Иконка эффекта <span class="cic-inline"><input name="activationEffectImg" placeholder="пусто = иконка импланта"><button type="button" data-pick-effect-image><i class="fa-solid fa-image"></i></button></span></label>
            <label>Длительность <input name="activationDurationValue" type="number" min="1" value="1"></label>
            <label>Единица длительности <select name="activationDurationUnit"><option value="rounds">Раунды</option><option value="minutes">Минуты</option><option value="hours">Часы</option><option value="days">Дни</option><option value="encounter">До конца столкновения</option><option value="unlimited">Пока не отключат вручную</option></select></label>
            <label>Истечение <select name="activationExpiry"><option value="">По правилам SF2e</option><option value="turn-start">В начале хода</option><option value="turn-end">В конце хода</option></select></label>
            <label class="check"><input name="activationEffectTokenIcon" type="checkbox" checked> Показывать иконку эффекта на токене</label>
            <label class="check"><input name="activationChatMessage" type="checkbox" checked> Писать активацию в чат</label>
            <label class="wide">Описание эффекта<textarea name="activationEffectDescription" rows="7" data-cic-uuid-drop placeholder="Например: Вы ускорены. Получаете +10 футов скорости и ... Перетащите сюда Item/способность/заклинание — конструктор вставит @UUID-ссылку."></textarea><small>Это описание будет и в блоке «Эффект» импланта, и на временном Effect. Предметы и способности можно перетаскивать прямо в поле.</small></label>
            <label class="wide">Выдать состояния / эффекты / предметы по UUID при активации<textarea name="activationGrantItemUuids" rows="4" placeholder="Compendium.sf2e.conditions.Item...\nCompendium.sf2e.effects.Item..."></textarea><small>Каждый UUID превращается в GrantItem внутри временного эффекта. При удалении родительского эффекта SF2e сможет убрать связанные выдаваемые элементы по стандартной связи GrantItem.</small></label>
            <label class="wide">Rule Elements активируемого эффекта<textarea name="activationEffectRulesJson" rows="14" spellcheck="false" placeholder='[{"key":"FlatModifier","selector":"reflex","type":"circumstance","value":2}]'></textarea><small>Эти правила отсутствуют на самом импланте и начинают действовать только после активации.</small></label>
          </div>
          <div class="cic-actions"><button type="button" data-format-activation-rules>Форматировать JSON</button><button type="button" data-clear-activation-rules>Очистить эффект</button></div>
        </section>
      </div>

      <div class="cic-tab" data-pane="effects">
        <section class="cic-toolbox"><h3>Готовые пресеты Rule Elements из Remaster</h3>
          <div class="cic-grid two"><label>Пресет <select name="rulePreset">${rulePresetOptions()}</select></label><label>Добавлять в <select name="ruleTarget"><option value="passive">Пассивные Rule Elements импланта</option><option value="activation">Эффект активации</option></select><small>Для Сандевистана и других режимов выбирайте «Эффект активации».</small></label></div>
          <p class="cic-help" data-rule-help></p>
          <details class="cic-rule-config" open><summary>Настроить пресет перед добавлением</summary>
            <div class="cic-grid three">
              <label>На какую проверку / selector / характеристику
                <select name="ruleSelectorPreset">${SELECTOR_PRESETS.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>
                <small>Для STR/DEX/CON/INT/WIS/CHA конструктор автоматически использует нативный путь характеристики; для Strike — поле ability.</small>
              </label>
              <label>Свой selector / несколько
                <input name="ruleSelectorCustom" placeholder="perception или perception, medicine">
                <small>Если заполнено — имеет приоритет. Несколько значений создают массив.</small>
              </label>
              <label>Predicate / roll options
                <textarea name="rulePredicate" rows="2" placeholder="item:trait:fear, cyberware-boost"></textarea>
              </label>
              <label>Value <input name="ruleValue" placeholder="2 или @actor.level"></label>
              <label>Тип бонуса <select name="ruleModifierType"><option value="">— как в пресете —</option><option value="item">item</option><option value="status">status</option><option value="circumstance">circumstance</option><option value="untyped">untyped</option><option value="potency">potency</option></select></label>
              <label>Mode <select name="ruleMode"><option value="">— как в пресете —</option><option value="add">add</option><option value="override">override</option><option value="multiply">multiply</option><option value="upgrade">upgrade</option><option value="downgrade">downgrade</option><option value="subtract">subtract</option></select></label>
              <label>Slug <input name="ruleSlug" placeholder="cyberware-bonus"></label>
              <label>Label <input name="ruleLabel" placeholder="Название эффекта"></label>
              <label>UUID <input name="ruleUuid" placeholder="Compendium...Item..."></label>
              <label>Path <input name="rulePath" placeholder="system.attributes..."></label>
              <label>Тип урона <input name="ruleDamageType" placeholder="electricity"></label>
              <label>Кубы <span class="cic-inline"><input name="ruleDiceNumber" type="number" min="0" value="1"><select name="ruleDieSize"><option>d4</option><option selected>d6</option><option>d8</option><option>d10</option><option>d12</option></select></span></label>
              <label class="wide">Дополнительный JSON patch для каждого добавляемого Rule Element
                <textarea name="rulePatchJson" rows="4" spellcheck="false" placeholder='{"priority":10,"phase":"afterDerived"}'></textarea>
                <small>Это даёт доступ к любым параметрам, которых нет в форме. Поля patch объединяются с пресетом последними.</small>
              </label>
            </div>
          </details>
          <div class="cic-actions"><button type="button" data-add-rule><i class="fa-solid fa-plus"></i> Добавить настроенный пресет</button><button type="button" data-format-rules>Форматировать JSON</button><button type="button" data-clear-rules>Очистить</button></div>
        </section>
        <div class="cic-grid two">
          <label class="check wide"><input name="humanityEnabled" type="checkbox"> Быстро добавить Rule Element «Предел Человечности»</label>
          <label>Режим человечности <select name="humanityMode"><option value="add">Добавить</option><option value="override">Задать</option></select></label><label>Значение <input name="humanityValue" type="number" value="0"></label>
          <label class="wide">Метка <input name="humanityLabel" placeholder="Источник изменения человечности"></label>
          <label class="check wide"><input name="replaceTemplateRules" type="checkbox" checked> Заменить Rule Elements шаблона этим JSON <small>Снимите галочку, если хотите ДОБАВИТЬ новые правила к правилам исходного Item.</small></label>
          <label class="wide">Rule Elements (JSON-массив)<textarea name="rulesJson" rows="18" spellcheck="false" placeholder='[{"key":"FlatModifier","selector":"perception","value":1,"type":"item"}]'></textarea><small>Значения могут содержать формулы и пути SF2e, например @item.level или @actor.system.abilities.str.mod.</small></label>
        </div>
      </div>

      <div class="cic-tab" data-pane="presets">
        <section class="cic-toolbox"><h3>Свои пресеты конструктора</h3>
          <div class="cic-grid two"><label>Название пресета <input name="customPresetName" placeholder="Например: Тактическая оптика"></label><label>Сохранённые пресеты <select name="customPresetSelect"><option value="">— нет —</option></select></label></div>
          <div class="cic-actions"><button type="button" data-save-preset>Сохранить текущий</button><button type="button" data-load-preset>Применить</button><button type="button" data-delete-preset>Удалить</button></div>
          <small>Сохраняется весь конструктор: цены, Stress/Hard Cost, слоты, ПКТ, описание, проверки и Rule Elements. Персонаж назначения и выбор исходного Item не сохраняются.</small>
        </section>
        <section class="cic-toolbox"><h3>Импорт / экспорт профиля JSON</h3>
          <textarea name="profileJson" rows="14" spellcheck="false" placeholder="Здесь появится JSON текущего профиля"></textarea>
          <div class="cic-actions"><button type="button" data-snapshot-profile>Снять снимок</button><button type="button" data-apply-profile>Применить JSON</button><button type="button" data-copy-profile>Копировать JSON</button></div>
        </section>
      </div>

      <div class="cic-tab" data-pane="preview"><div class="cic-preview">
        <div class="cic-preview-title"><img data-preview-img src="icons/svg/circuitry.svg"><h3 data-preview-name>Новый имплант</h3></div><div data-preview-flags></div>
        <div class="cic-preview-subtabs"><button type="button" class="active" data-preview-subtab="item">Предмет</button><button type="button" data-preview-subtab="bases">Базы <span data-preview-base-count>0</span></button><button type="button" data-preview-subtab="extras">Доп. компоненты <span data-preview-extra-count>0</span></button><button type="button" data-preview-subtab="hardcost">Hard Cost <span data-preview-hard-total>0</span></button><button type="button" data-preview-subtab="stresscost">Stress Cost <span data-preview-stress-total>0</span></button><button type="button" data-preview-subtab="price">Стоимость <span data-preview-price-total>0</span></button></div>
        <div class="cic-preview-subpane active" data-preview-subpane="item"><div class="cic-preview-description" data-preview-description></div><details><summary>Пассивные Rule Elements</summary><pre data-preview-rules>[]</pre></details><details><summary>Rule Elements эффекта активации</summary><pre data-preview-activation-rules>[]</pre></details></div>
        <div class="cic-preview-subpane" data-preview-subpane="bases"><div class="cic-preview-extra-empty" data-preview-base-empty>Базы не выбраны.</div><div class="cic-preview-extra-list" data-preview-base-list></div></div>
        <div class="cic-preview-subpane" data-preview-subpane="extras"><div class="cic-preview-extra-empty" data-preview-extra-empty>Дополнительные компоненты не выбраны.</div><div class="cic-preview-extra-list" data-preview-extra-list></div></div>
        <div class="cic-preview-subpane" data-preview-subpane="hardcost"><div class="cic-hard-summary" data-preview-hard-summary></div><div class="cic-hard-breakdown"><section><h4>Базы модели</h4><div data-preview-hard-bases></div></section><section><h4>Доп. компоненты</h4><div data-preview-hard-extras></div></section></div></div>
        <div class="cic-preview-subpane" data-preview-subpane="stresscost"><div class="cic-hard-summary" data-preview-stress-summary></div><div class="cic-preview-actions"><button type="button" data-roll-total-stress><i class="fa-solid fa-dice"></i> Прокинуть общий Stress Cost</button></div><div class="cic-hard-breakdown"><section><h4>Базы модели</h4><div data-preview-stress-bases></div></section><section><h4>Доп. компоненты</h4><div data-preview-stress-extras></div></section></div></div>
        <div class="cic-preview-subpane" data-preview-subpane="price"><div class="cic-hard-summary cic-price-summary" data-preview-price-summary></div><div class="cic-preview-actions"><button type="button" data-apply-total-model-price><i class="fa-solid fa-coins"></i> Подставить цену комплекта (без корпуса)</button></div><div class="cic-hard-breakdown"><section><h4>Базы модели</h4><div data-preview-price-bases></div></section><section><h4>Доп. компоненты</h4><div data-preview-price-extras></div></section></div></div>
      </div></div>

      <footer class="cic-footer"><label class="check"><input name="openSheet" type="checkbox" checked> Открыть лист после создания</label><span class="cic-spacer"></span><button type="button" data-cic-close><i class="fa-solid fa-ban"></i> Отмена</button><button type="submit" class="cic-primary"><i class="fa-solid fa-floppy-disk"></i> Создать имплант</button></footer>
    </form>
  </section>`;
}

function selectedActivationTraits(form) {
  return parseList(form.elements.activationTraits?.value ?? "");
}

function setActivationTraits(form, traits, { notify = false } = {}) {
  const hidden = form.elements.activationTraits;
  if (!hidden) return;
  hidden.value = mergeUnique([], Array.isArray(traits) ? traits : parseList(traits)).join(", ");
  renderActivationTraitPicker(form);
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
  if (notify) ui.notifications.info("Traits активации обновлены.");
}

function activationTraitLabel(slug) {
  const found = activationTraitCatalog().find(([key]) => key === slug);
  return found?.[1] ?? slug;
}

function renderActivationTraitPicker(form) {
  const win = form.closest(".cic-window");
  if (!win) return;
  const search = form.elements.activationTraitSearch;
  const select = form.elements.activationTraitSelect;
  if (select) {
    const previous = select.value;
    select.innerHTML = activationTraitOptions(search?.value ?? "");
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  const container = win.querySelector("[data-activation-trait-selected]");
  if (!container) return;
  const traits = selectedActivationTraits(form);
  if (!traits.length) {
    container.innerHTML = '<span class="cic-trait-empty">Traits не выбраны</span>';
    return;
  }
  container.innerHTML = traits.map((slug) => `<button type="button" class="cic-trait-tag" data-remove-activation-trait="${esc(slug)}" title="Удалить ${esc(slug)}"><span>${esc(activationTraitLabel(slug))}</span><code>${esc(slug)}</code><i class="fa-solid fa-xmark"></i></button>`).join("");
  container.querySelectorAll("[data-remove-activation-trait]").forEach((button) => button.addEventListener("click", () => {
    const remove = button.dataset.removeActivationTrait;
    setActivationTraits(form, selectedActivationTraits(form).filter((trait) => trait !== remove));
  }));
}

function addActivationTrait(form, slug) {
  const trait = String(slug ?? "").trim();
  if (!trait) return;
  setActivationTraits(form, [...selectedActivationTraits(form), trait]);
}

function catalogPickerValues(picker) {
  const form = picker.closest("form");
  const field = picker.dataset.catalogField;
  const hidden = form?.elements?.[field];
  const values = parseList(hidden?.value ?? "");
  return picker.dataset.catalogMode === "multi" ? values : values.slice(0, 1);
}

function catalogPickerLabel(picker, slug) {
  const select = picker.querySelector("[data-catalog-select]");
  const entries = select?.__cicEntries ?? [];
  return entries.find(([value]) => value === slug)?.[1] ?? slug;
}

function setCatalogPickerValues(picker, values, { dispatch = true } = {}) {
  const form = picker.closest("form");
  const field = picker.dataset.catalogField;
  const hidden = form?.elements?.[field];
  if (!hidden) return;
  const normalized = mergeUnique([], Array.isArray(values) ? values : parseList(values));
  hidden.value = (picker.dataset.catalogMode === "multi" ? normalized : normalized.slice(0, 1)).join(", ");
  renderCatalogPicker(picker);
  if (dispatch) hidden.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderCatalogPicker(picker) {
  const search = picker.querySelector("[data-catalog-search]");
  const select = picker.querySelector("[data-catalog-select]");
  const selected = picker.querySelector("[data-catalog-selected]");
  if (!select || !selected) return;
  select.__cicEntries ??= [...select.options].filter((option)=>option.value).map((option)=>[option.value, option.textContent?.replace(/\s+—\s+[^—]+$/, "") || option.value]);
  const query = String(search?.value ?? "").trim().toLocaleLowerCase("ru");
  const previous = select.value;
  const allowEmpty = [...select.options].some((option)=>!option.value);
  const entries = select.__cicEntries.filter(([slug,label]) => !query || slug.toLocaleLowerCase("ru").includes(query) || String(label).toLocaleLowerCase("ru").includes(query));
  select.innerHTML = `${allowEmpty ? '<option value="">— не выбрано —</option>' : ''}${entries.map(([slug,label])=>`<option value="${esc(slug)}">${esc(label)} — ${esc(slug)}</option>`).join("")}`;
  if ([...select.options].some((option)=>option.value===previous)) select.value=previous;
  const values = catalogPickerValues(picker);
  if (!values.length) { selected.innerHTML='<span class="cic-trait-empty">Не выбрано</span>'; return; }
  selected.innerHTML = values.map((slug)=>`<button type="button" class="cic-trait-tag" data-catalog-remove="${esc(slug)}" title="Удалить ${esc(slug)}"><span>${esc(catalogPickerLabel(picker,slug))}</span><code>${esc(slug)}</code><i class="fa-solid fa-xmark"></i></button>`).join("");
  selected.querySelectorAll("[data-catalog-remove]").forEach((button)=>button.addEventListener("click",()=>{
    const remove=button.dataset.catalogRemove;
    const current=catalogPickerValues(picker);
    setCatalogPickerValues(picker, picker.dataset.catalogMode === "multi" ? current.filter((value)=>value!==remove) : []);
  }));
}

function initCatalogPickers(form) {
  const win = form.closest(".cic-window");
  for (const picker of win?.querySelectorAll("[data-catalog-picker]") ?? []) {
    const select=picker.querySelector("[data-catalog-select]");
    if (select) select.__cicEntries=[...select.options].filter((option)=>option.value).map((option)=>{
      const text=String(option.textContent ?? option.value);
      const suffix=` — ${option.value}`;
      return [option.value, text.endsWith(suffix) ? text.slice(0,-suffix.length) : text];
    });
    const add=()=>{ const slug=String(select?.value ?? "").trim(); if(!slug) return ui.notifications.warn("Выберите значение из списка."); const current=catalogPickerValues(picker); setCatalogPickerValues(picker, picker.dataset.catalogMode === "multi" ? [...current,slug] : [slug]); };
    picker.querySelector("[data-catalog-search]")?.addEventListener("input",()=>renderCatalogPicker(picker));
    select?.addEventListener("change",()=>{ if(select.value) add(); });
    picker.querySelector("[data-catalog-add]")?.addEventListener("click",add);
    const custom=picker.querySelector("[data-catalog-custom]");
    const addCustom=()=>{ const slug=String(custom?.value ?? "").trim(); if(!slug) return ui.notifications.warn("Введите собственный slug."); const current=catalogPickerValues(picker); setCatalogPickerValues(picker, picker.dataset.catalogMode === "multi" ? [...current,slug] : [slug]); custom.value=""; };
    picker.querySelector("[data-catalog-custom-add]")?.addEventListener("click",addCustom);
    custom?.addEventListener("keydown",(event)=>{ if(event.key!=="Enter") return; event.preventDefault(); addCustom(); });
    renderCatalogPicker(picker);
  }
}

function refreshCatalogPickers(form) {
  const win=form.closest(".cic-window");
  for (const picker of win?.querySelectorAll("[data-catalog-picker]") ?? []) renderCatalogPicker(picker);
}

async function loadTemplateIntoForm(form) {
  const key = form.elements.templateKey.value; if (!key || key === "blank") return;
  try {
    const source = await getTemplateSource(key); const meta = parseTemplateMetadata(source, activeRemasterId());
    const bulkPreset = [0, 0.1, 1, 2, 3, 4, 5, 6, 8, 10, 16].includes(Number(meta.bulkValue)) ? String(meta.bulkValue) : "custom";
    const combatValues = meta.weapon ? { weaponCategory:meta.weapon.category, weaponGrade:meta.weapon.grade, weaponGroup:meta.weapon.group, weaponBaseItem:meta.weapon.baseItem ?? "", weaponBonus:meta.weapon.bonus, weaponDamageDice:meta.weapon.damageDice, weaponDamageDie:meta.weapon.damageDie ?? "", weaponDamageType:meta.weapon.damageType, weaponBonusDamage:meta.weapon.bonusDamage, weaponSplashDamage:meta.weapon.splashDamage, weaponRange:meta.weapon.range ?? "", weaponReload:meta.weapon.reload ?? "", weaponUsage:meta.weapon.usage, weaponExpend:meta.weapon.expend ?? "", weaponAmmoBaseType:meta.weapon.ammoBaseType ?? "", weaponAmmoCapacity:meta.weapon.ammoCapacity ?? 0, weaponHardness:meta.weapon.hardness ?? 0, weaponHpMax:meta.weapon.hpMax ?? 0, weaponMaterialType:meta.weapon.materialType ?? "", weaponMaterialGrade:meta.weapon.materialGrade ?? "", weaponSystemPatchJson:"{}" } : meta.armor ? { armorCategory:meta.armor.category, armorGrade:meta.armor.grade, armorGroup:meta.armor.group, armorBaseItem:meta.armor.baseItem ?? "", armorAcBonus:meta.armor.acBonus, armorDexCap:meta.armor.dexCap, armorCheckPenalty:meta.armor.checkPenalty, armorSpeedPenalty:meta.armor.speedPenalty, armorStrength:meta.armor.strength, armorHardness:meta.armor.hardness ?? 0, armorHpMax:meta.armor.hpMax ?? 0, armorMaterialType:meta.armor.materialType ?? "", armorMaterialGrade:meta.armor.materialGrade ?? "", armorSystemPatchJson:"{}" } : {};
    for (const [name,value] of Object.entries({ name:source.name ?? "", img:source.img ?? "", bodyHtml:stripCanonicalMetadata(source.system?.description?.value ?? ""), implantType:meta.implantType, itemDocumentType:meta.itemDocumentType, hardCost:meta.hardCost, stressFormula:meta.stressFormula, slots:meta.slots, internalSlots:meta.internalSlots, externalSlots:meta.externalSlots, pktComponentQuality:String(meta.pktComponentQuality), priceEddies:meta.priceEddies, itemLevel:meta.itemLevel, itemSize:meta.itemSize, bulkValue:bulkPreset, bulkCustom:meta.bulkValue, rarity:meta.rarity, checkSyntax:meta.checkSyntax, pktQuality:String(meta.pktQuality), pktFamily:meta.pktFamily, pktParentFamily:meta.pktParentFamily, exclusiveFamily:meta.exclusiveFamily, grantItemUuids:meta.grantItemUuids.join("\n"), traits:meta.traits.join(", "), rulesJson:JSON.stringify(meta.rules,null,2), ...combatValues })) {
      if (form.elements[name]) form.elements[name].value = value;
    }
    for (const [name,value] of Object.entries({ pktOnly:meta.pktOnly, pktBody:meta.pktBody, pktBiosystem:meta.pktBiosystem, pktReplaceable:meta.pktReplaceable, pktReplaceableBase:meta.pktReplaceableBase, stressInlineRoll:meta.stressInlineRoll || true, replaceTemplateRules:true })) if (form.elements[name]) form.elements[name].checked = value;
    if (meta.weapon) { if (form.elements.weaponTraitsPicker) form.elements.weaponTraitsPicker.value = (meta.weapon.traits ?? []).join(", "); if (form.elements.weaponAmmoBuiltIn) form.elements.weaponAmmoBuiltIn.checked = meta.weapon.ammoBuiltIn === true; }
    if (meta.armor && form.elements.armorTraitsPicker) form.elements.armorTraitsPicker.value = (meta.armor.traits ?? []).join(", ");
    if (meta.activation?.enabled) {
      const activation = meta.activation;
      for (const [name, value] of Object.entries({
        activationName: activation.name ?? "Активировать", activationActionType: activation.actionType ?? "action1", activationTraits: (activation.traits ?? []).join(", "),
        activationRequirements: activation.requirements ?? "", activationTrigger: activation.trigger ?? "", activationFrequency: activation.frequency ?? "unlimited", activationFrequencyMax: activation.frequencyMax ?? 1,
        activationDurationValue: activation.duration?.value > 0 ? activation.duration.value : 1, activationDurationUnit: activation.duration?.unit ?? "rounds", activationExpiry: activation.duration?.expiry ?? "",
        activationEffectName: activation.effectName ?? "", activationEffectImg: activation.effectImg ?? "", activationEffectDescription: activation.effectDescription ?? "",
        activationGrantItemUuids: (activation.grantItemUuids ?? []).join("\n"), activationEffectRulesJson: JSON.stringify(activation.effectRules ?? [], null, 2),
      })) if (form.elements[name]) form.elements[name].value = value;
      form.elements.activationEnabled.checked = true;
      form.elements.activationEffectTokenIcon.checked = activation.tokenIcon !== false;
      form.elements.activationChatMessage.checked = activation.chatMessage !== false;
      form.elements.activationShowOnSheet.checked = activation.showOnActionsSheet !== false;
    }
    updateCombatSections(form); refreshCatalogPickers(form); renderActivationTraitPicker(form); updateRuleHelp(form); updateCheckPreview(form); updatePreview(form);
    ui.notifications.info(`Шаблон «${source.name}» загружен вместе с его Rule Elements.`);
  } catch (error) { console.error(`${MODULE_ID} | Failed to load template`, error); ui.notifications.error(error.message ?? String(error)); }
}

function applyPreset(form) {
  const preset = PRESETS[form.elements.preset.value] ?? {};
  if (preset.implantType) form.elements.implantType.value = preset.implantType;
  form.elements.pktOnly.checked = preset.pktOnly === true; form.elements.pktBody.checked = preset.pktBody === true; form.elements.pktBiosystem.checked = preset.pktBiosystem === true;
  if (form.elements.pktReplaceableBase) form.elements.pktReplaceableBase.checked = preset.pktReplaceableBase === true || preset.implantType === "base";
  form.elements.exclusiveFamily.value = preset.exclusiveFamily ?? ""; form.elements.pktFamily.value = preset.pktFamily ?? ""; form.elements.pktParentFamily.value = preset.pktParentFamily ?? "";
  const preserved = parseList(form.elements.traits.value).filter((t) => !["pkt", "neironn-uskoritell"].includes(t));
  form.elements.traits.value = mergeUnique(preserved, preset.traits ?? []).join(", ");
}

function setStress(form, value) { form.elements.stressFormula.value = value; updatePreview(form); }

function buildCheckSyntax(form) {
  const selectedType = form.elements.checkType.value || "flat"; const type = selectedType === "custom" ? String(form.elements.checkCustomType.value || "").trim() || "flat" : selectedType; const parts = [type];
  const against = form.elements.checkAgainst.value; const dc = intValue(form.elements.checkDc.value, 0);
  if (against) parts.push(`against:${against}`); else if (dc > 0) parts.push(`dc:${dc}`);
  if (form.elements.checkBasic.checked) parts.push("basic");
  const traits = parseList(form.elements.checkTraits.value); if (traits.length) parts.push(`traits:${traits.join(",")}`);
  const name = String(form.elements.checkName.value ?? "").trim(); if (name) parts.push(`name:${name}`);
  const show = form.elements.checkShowDc.value; if (show && show !== "none") parts.push(`showDC:${show}`);
  const label = String(form.elements.checkLabel.value ?? "").trim();
  return `@Check[${parts.join("|")}]${label ? `{${label}}` : ""}`;
}

function updateCheckPreview(form) { const el = form.closest(".cic-window").querySelector("[data-check-preview]"); if (el) el.textContent = buildCheckSyntax(form); }
function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length, end = textarea.selectionEnd ?? start;
  const before = textarea.value.slice(0,start), after = textarea.value.slice(end);
  textarea.value = `${before}${text}${after}`; textarea.selectionStart = textarea.selectionEnd = start + text.length; textarea.focus(); textarea.dispatchEvent(new Event("input", { bubbles:true }));
}


async function draggedUuidLink(event) {
  const plain = String(event.dataTransfer?.getData("text/plain") ?? "").trim();
  if (plain.startsWith("@UUID[")) return plain;

  let data = null;
  try {
    data = globalThis.TextEditor?.getDragEventData?.(event) ?? null;
  } catch (_) { /* Foundry can throw for unsupported drag payloads */ }
  if (!data && plain) {
    try { data = JSON.parse(plain); } catch (_) { /* not JSON */ }
  }
  if (!data || typeof data !== "object") return null;

  let uuid = String(data.uuid ?? data.documentUuid ?? "").trim();
  let document = null;
  if (uuid && typeof globalThis.fromUuid === "function") {
    try { document = await fromUuid(uuid); } catch (_) { /* keep raw uuid */ }
  }

  if (!document) {
    const id = data.id ?? data._id;
    const type = String(data.type ?? data.documentName ?? "");
    if (id && /Item/i.test(type)) document = game.items?.get?.(id) ?? null;
    if (id && /Actor/i.test(type)) document = game.actors?.get?.(id) ?? null;
    if (id && /Journal/i.test(type)) document = game.journal?.get?.(id) ?? null;
    uuid ||= document?.uuid ?? "";
  }
  if (!uuid) uuid = document?.uuid ?? "";
  if (!uuid) return null;
  const label = String(document?.name ?? data.name ?? data.label ?? "").trim();
  return `@UUID[${uuid}]${label ? `{${label}}` : ""}`;
}


function normalizePktComponentUuid(rawValue) {
  let uuid = String(rawValue ?? "").trim();
  const linkMatch = uuid.match(/^@UUID\[([^\]]+)\]/);
  if (linkMatch) uuid = linkMatch[1];
  return uuid;
}

function pktHardCostFromSource(source) {
  if (!source || typeof source !== "object") return 0;
  const flag = source?.flags?.[activeRemasterId()] ?? source?.flags?.["cyberpunk-remaster"] ?? source?.flags?.["sf2e-cyberware-pkt"] ?? {};
  const direct = Number(flag?.hardCost);
  if (Number.isFinite(direct)) return Math.max(0, Math.trunc(direct));
  const html = String(source?.system?.description?.value ?? "");
  let plain = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
  try { if (globalThis.document?.createElement) { const box=document.createElement("div"); box.innerHTML=html; plain=box.textContent?.replace(/\s+/g," ") ?? plain; } } catch {}
  const match = plain.match(/Hard\s*Cost\s*:?\s*(\d+)/iu);
  return match ? Math.max(0, intValue(match[1], 0)) : 0;
}

function pktHardCostFromDocument(document) {
  if (!document) return 0;
  let source = document;
  try { source = document.toObject?.() ?? document._source ?? document; } catch {}
  return pktHardCostFromSource(source);
}

async function resolvePktHardCost(uuid) {
  const value = normalizePktComponentUuid(uuid);
  if (!value) return 0;
  try {
    const document = await fromUuid(value);
    return pktHardCostFromDocument(document);
  } catch { return 0; }
}

function pktSourceMetadata(document) {
  if (!document) return { stressFormula:"0", priceEddies:0 };
  try {
    const source = document.toObject?.() ?? document._source ?? document;
    const meta = parseTemplateMetadata(source, activeRemasterId());
    let stressFormula = "0";
    try { stressFormula = normalizeStress(meta.stressFormula ?? "0").formula; } catch { stressFormula = "0"; }
    return {
      stressFormula,
      priceEddies: Math.max(0, Number(source?.system?.price?.value?.sp ?? meta.priceEddies ?? 0) || 0),
    };
  } catch { return { stressFormula:"0", priceEddies:0 }; }
}

function stressDiceVector(value, quantity = 1) {
  const q = Math.max(1, intValue(quantity, 1));
  let formula = "0";
  try { formula = normalizeStress(value ?? "0").formula; } catch { return { d6:0, d4:0 }; }
  const out = { d6:0, d4:0 };
  for (const match of formula.matchAll(/(\d+)d(4|6)/gi)) {
    const count = Math.max(0, intValue(match[1],0)) * q;
    if (match[2] === "6") out.d6 += count; else out.d4 += count;
  }
  return out;
}

function stressVectorAdd(a, b) { return { d6:(a?.d6||0)+(b?.d6||0), d4:(a?.d4||0)+(b?.d4||0) }; }
function stressVectorFormula(vector) {
  const parts=[];
  if (vector?.d6) parts.push(`${vector.d6}d6`);
  if (vector?.d4) parts.push(`${vector.d4}d4`);
  return parts.join(" + ") || "0";
}

function pktPriceFromDocument(document) { return pktSourceMetadata(document).priceEddies; }
function pktStressFromDocument(document) { return pktSourceMetadata(document).stressFormula; }

function normalizePktBaseComponents(value = []) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  for (const raw of rows) {
    const uuid = normalizePktComponentUuid(raw?.uuid ?? raw?.sourceUuid);
    if (!uuid) continue;
    out.push({
      uuid,
      name: String(raw?.name ?? "").trim(),
      quantity: Math.max(1, Math.min(20, intValue(raw?.quantity, 1))),
      hardCost: Math.max(0, intValue(raw?.hardCost, 0)),
      stressFormula: String(raw?.stressFormula ?? raw?.stressCost ?? "0").trim() || "0",
      priceEddies: Math.max(0, Number(raw?.priceEddies ?? raw?.price ?? 0) || 0),
      internalSlots: Math.max(0, intValue(raw?.internalSlots ?? raw?.pktInternalSlots, 0)),
      externalSlots: Math.max(0, intValue(raw?.externalSlots ?? raw?.pktExternalSlots, 0)),
      hard: raw?.hard === "waived" ? "waived" : "normal",
      stress: raw?.stress === "normal" ? "normal" : "waived",
      family: String(raw?.family ?? "").trim() || null,
      uniqueBase: raw?.uniqueBase === true || raw?.replaceableBase === false,
      replaceableBase: !(raw?.uniqueBase === true || raw?.replaceableBase === false),
    });
  }
  return out;
}

function normalizePktExtraComponents(value = []) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  for (const raw of rows) {
    const uuid = normalizePktComponentUuid(raw?.uuid ?? raw?.sourceUuid);
    if (!uuid) continue;
    out.push({
      uuid,
      name: String(raw?.name ?? "").trim(),
      quantity: Math.max(1, Math.min(20, intValue(raw?.quantity, 1))),
      hardCost: Math.max(0, intValue(raw?.hardCost, 0)),
      stressFormula: String(raw?.stressFormula ?? raw?.stressCost ?? "0").trim() || "0",
      priceEddies: Math.max(0, Number(raw?.priceEddies ?? raw?.price ?? 0) || 0),
      hard: raw?.hard === "waived" ? "waived" : "normal",
      stress: raw?.stress === "waived" ? "waived" : "normal",
      family: String(raw?.family ?? "").trim() || null,
      parentFamily: String(raw?.parentFamily ?? raw?.baseFamily ?? "").trim() || null,
      detachable: raw?.detachable !== false,
    });
  }
  return out;
}

function pktBaseComponentsFromForm(form) {
  const list = form.closest(".cic-window")?.querySelector("[data-pkt-base-list]");
  if (!list) return [];
  const rows = [];
  for (const row of list.querySelectorAll("[data-pkt-base-row]")) {
    const uuid = String(row.querySelector("[data-pkt-base-uuid]")?.value ?? "").trim();
    if (!uuid) continue;
    rows.push({
      uuid,
      name: String(row.querySelector("[data-pkt-base-name]")?.value ?? "").trim(),
      quantity: Math.max(1, Math.min(20, intValue(row.querySelector("[data-pkt-base-qty]")?.value, 1))),
      hardCost: Math.max(0, intValue(row.querySelector("[data-pkt-base-hard]")?.value, 0)),
      stressFormula: String(row.querySelector("[data-pkt-base-stress-formula]")?.value ?? "0").trim() || "0",
      priceEddies: Math.max(0, Number(row.querySelector("[data-pkt-base-price]")?.value ?? 0) || 0),
      internalSlots: Math.max(0, intValue(row.querySelector("[data-pkt-base-internal]")?.value, 0)),
      externalSlots: Math.max(0, intValue(row.querySelector("[data-pkt-base-external]")?.value, 0)),
      hard: row.querySelector("[data-pkt-base-hard-mode]")?.value === "waived" ? "waived" : "normal",
      stress: row.querySelector("[data-pkt-base-stress]")?.value === "normal" ? "normal" : "waived",
      family: String(row.querySelector("[data-pkt-base-family]")?.value ?? "").trim() || null,
      uniqueBase: row.querySelector("[data-pkt-base-unique]")?.checked === true,
      replaceableBase: row.querySelector("[data-pkt-base-unique]")?.checked !== true,
    });
  }
  return rows;
}

function pktExtraComponentsFromForm(form) {
  const list = form.closest(".cic-window")?.querySelector("[data-pkt-extra-list]");
  if (!list) return [];
  const rows = [];
  for (const row of list.querySelectorAll("[data-pkt-extra-row]")) {
    const uuid = String(row.querySelector("[data-pkt-extra-uuid]")?.value ?? "").trim();
    if (!uuid) continue;
    rows.push({
      uuid,
      name: String(row.querySelector("[data-pkt-extra-name]")?.value ?? "").trim(),
      quantity: Math.max(1, Math.min(20, intValue(row.querySelector("[data-pkt-extra-qty]")?.value, 1))),
      hardCost: Math.max(0, intValue(row.querySelector("[data-pkt-extra-hard]")?.value, 0)),
      stressFormula: String(row.querySelector("[data-pkt-extra-stress-formula]")?.value ?? "0").trim() || "0",
      priceEddies: Math.max(0, Number(row.querySelector("[data-pkt-extra-price]")?.value ?? 0) || 0),
      hard: row.querySelector("[data-pkt-extra-hard-mode]")?.value === "waived" ? "waived" : "normal",
      stress: row.querySelector("[data-pkt-extra-stress]")?.value === "waived" ? "waived" : "normal",
      family: String(row.querySelector("[data-pkt-extra-family]")?.value ?? "").trim() || null,
      parentFamily: String(row.querySelector("[data-pkt-extra-parent]")?.value ?? "").trim() || null,
      detachable: row.querySelector("[data-pkt-extra-detachable]")?.checked !== false,
    });
  }
  return rows;
}

function pktFamilyLabel(family) {
  const found = PKT_COMPONENT_FAMILY_CATALOG.find(([slug]) => slug === family);
  return found?.[1] ?? family ?? "Без семейства";
}

function pktFamilySelectOptions(selected = "", { kind = "component", blankLabel = "— выберите —" } = {}) {
  const catalog = kind === "base" ? PKT_BASE_FAMILY_CATALOG : PKT_COMPONENT_FAMILY_CATALOG;
  const values = [...catalog];
  if (selected && !values.some(([slug]) => slug === selected)) values.push([selected, selected]);
  return `<option value="">${esc(blankLabel)}</option>` + values.map(([slug,label])=>`<option value="${esc(slug)}" ${slug===selected?"selected":""}>${esc(label)} · ${esc(slug)}</option>`).join("");
}

function pktBaseFamilyOptions(form, selected = "") {
  const families = [];
  for (const entry of pktBaseComponentsFromForm(form)) {
    if (entry.family && !families.includes(entry.family)) families.push(entry.family);
  }
  if (selected && !families.includes(selected)) families.push(selected);
  return `<option value="">— авто / без базы —</option>` + families.map((family)=>`<option value="${esc(family)}" ${family===selected?"selected":""}>${esc(pktFamilyLabel(family))} · ${esc(family)}</option>`).join("");
}

function ensureSelectOption(select, value, label = null) {
  if (!select || !value) return;
  if (![...select.options].some((option)=>option.value === value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${label ?? pktFamilyLabel(value)} · ${value}`;
    select.appendChild(option);
  }
  select.value = value;
}

async function resolvePktComponentInfo(rawValue) {
  const raw = String(rawValue ?? "").trim();
  const link = raw.match(/^@UUID\[([^\]]+)\](?:\{([^}]*)\})?/);
  const uuid = normalizePktComponentUuid(raw);
  if (!uuid) return null;
  let document = null;
  try { document = await fromUuid(uuid); } catch {}
  const meta = document ? pktSnapshotMeta(document) : {};
  const sourceMeta = document ? pktSourceMetadata(document) : { stressFormula:"0", priceEddies:0 };
  return {
    uuid,
    name: document?.name ?? link?.[2] ?? "",
    family: meta.family ?? null,
    parentFamily: meta.parentFamily ?? null,
    hardCost: document ? pktHardCostFromDocument(document) : 0,
    stressFormula: sourceMeta.stressFormula,
    priceEddies: sourceMeta.priceEddies,
    internalSlots: meta.internalSlots ?? 0,
    externalSlots: meta.externalSlots ?? 0,
    componentQuality: meta.componentQuality ?? 0,
    replaceableBase: meta.replaceableBase !== false,
  };
}

function refreshPktRowPriceHint(row, kind) {
  if (!row) return;
  const hard = Math.max(0, intValue(row.querySelector(kind === "base" ? "[data-pkt-base-hard]" : "[data-pkt-extra-hard]")?.value, 0));
  const stress = String(row.querySelector(kind === "base" ? "[data-pkt-base-stress-formula]" : "[data-pkt-extra-stress-formula]")?.value ?? "0").trim() || "0";
  const price = Math.max(0, Number(row.querySelector(kind === "base" ? "[data-pkt-base-price]" : "[data-pkt-extra-price]")?.value ?? 0) || 0);
  const hint = row.querySelector(".cic-pkt-hard-hint");
  if (hint) hint.textContent = `Hard: ${hard} · Stress: ${stress} · Цена модели: ${price.toLocaleString("ru-RU")} эдди`;
}

function syncPktBaseComponents(form, { refreshExtras = false } = {}) {
  const bases = pktBaseComponentsFromForm(form);
  if (form.elements.pktModelBaseComponentsJson) form.elements.pktModelBaseComponentsJson.value = JSON.stringify(bases);
  if (refreshExtras) {
    const extras = pktExtraComponentsFromForm(form);
    renderPktExtraComponents(form, extras, { skipSync:true });
  }
  updatePktModelPriceMode(form);
  updatePreview(form);
  return bases;
}

function syncPktExtraComponents(form) {
  const rows = pktExtraComponentsFromForm(form);
  if (form.elements.pktModelExtraComponentsJson) form.elements.pktModelExtraComponentsJson.value = JSON.stringify(rows);
  updatePktModelPriceMode(form);
  updatePreview(form);
  return rows;
}

function pktBaseRowHtml(entry = {}) {
  const uuid = esc(String(entry.uuid ?? ""));
  const name = esc(String(entry.name ?? ""));
  const quantity = Math.max(1, Math.min(20, intValue(entry.quantity, 1)));
  const stress = entry.stress === "normal" ? "normal" : "waived";
  const hardMode = entry.hard === "waived" ? "waived" : "normal";
  const hardCost = Math.max(0, intValue(entry.hardCost, 0));
  const stressFormula = String(entry.stressFormula ?? "0").trim() || "0";
  const priceEddies = Math.max(0, Number(entry.priceEddies ?? 0) || 0);
  const internalSlots = Math.max(0, intValue(entry.internalSlots ?? entry.pktInternalSlots, 0));
  const externalSlots = Math.max(0, intValue(entry.externalSlots ?? entry.pktExternalSlots, 0));
  const family = String(entry.family ?? "");
  const uniqueBase = entry.uniqueBase === true || entry.replaceableBase === false;
  return `<div class="cic-pkt-base-row" data-pkt-base-row>
    <div class="cic-pkt-component-main">
      <input data-pkt-base-uuid value="${uuid}" placeholder="Перетащите базу Item или вставьте UUID / @UUID[...]">
      <input data-pkt-base-name value="${name}" placeholder="Название подставится автоматически">
      <small class="cic-pkt-hard-hint">Hard: ${hardCost} · Stress: ${esc(stressFormula)} · Цена модели: ${priceEddies.toLocaleString("ru-RU")} эдди</small>
    </div>
    <div class="cic-pkt-component-controls">
      <label>Кол-во<input data-pkt-base-qty type="number" min="1" max="20" value="${quantity}"></label>
      <label>Семейство<select data-pkt-base-family>${pktFamilySelectOptions(family,{kind:"base"})}</select></label>
      <label>Внутр.<input data-pkt-base-internal type="number" min="0" max="99" value="${internalSlots}" title="Допустимо внутренних компонентов"></label>
      <label>Внешн.<input data-pkt-base-external type="number" min="0" max="99" value="${externalSlots}" title="Допустимо внешних компонентов"></label>
      <label>Hard Cost<input data-pkt-base-hard type="number" min="0" step="1" value="${hardCost}" title="Hard Cost этой базы именно в составе данной модели ПКТ"></label>
      <label>Stress Cost<input data-pkt-base-stress-formula value="${esc(stressFormula)}" placeholder="2d6 + 1d4 или 0" title="Stress Cost этой базы именно в составе данной модели ПКТ"></label>
      <label>Цена, эдди<input data-pkt-base-price type="number" min="0" step="1" value="${priceEddies}" title="Цена этой базы именно в составе данной модели ПКТ"></label>
      <label>Stress<select data-pkt-base-stress><option value="waived" ${stress==="waived"?"selected":""}>Не считать</option><option value="normal" ${stress==="normal"?"selected":""}>Считать</option></select></label>
      <label>Hard<select data-pkt-base-hard-mode><option value="normal" ${hardMode==="normal"?"selected":""}>Считать</option><option value="waived" ${hardMode==="waived"?"selected":""}>Не считать</option></select></label>
      <label class="cic-mini-check cic-pkt-unique-base"><input data-pkt-base-unique type="checkbox" ${uniqueBase?"checked":""}> <i class="fa-solid fa-lock"></i> Уникальная база — замена запрещена</label>
      <button type="button" class="cic-pkt-extra-remove" data-remove-pkt-base title="Убрать из модели"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

function pktExtraRowHtml(entry = {}, form = null) {
  const uuid = esc(String(entry.uuid ?? ""));
  const name = esc(String(entry.name ?? ""));
  const quantity = Math.max(1, Math.min(20, intValue(entry.quantity, 1)));
  const stress = entry.stress === "waived" ? "waived" : "normal";
  const hardMode = entry.hard === "waived" ? "waived" : "normal";
  const hardCost = Math.max(0, intValue(entry.hardCost, 0));
  const stressFormula = String(entry.stressFormula ?? "0").trim() || "0";
  const priceEddies = Math.max(0, Number(entry.priceEddies ?? 0) || 0);
  const family = String(entry.family ?? "");
  const parentFamily = String(entry.parentFamily ?? "");
  const detachable = entry.detachable !== false;
  return `<div class="cic-pkt-extra-row" data-pkt-extra-row>
    <div class="cic-pkt-component-main">
      <input data-pkt-extra-uuid value="${uuid}" placeholder="Перетащите модуль Item или вставьте UUID / @UUID[...]">
      <input data-pkt-extra-name value="${name}" placeholder="Название подставится автоматически">
      <small class="cic-pkt-hard-hint">Hard: ${hardCost} · Stress: ${esc(stressFormula)} · Цена модели: ${priceEddies.toLocaleString("ru-RU")} эдди</small>
    </div>
    <div class="cic-pkt-component-controls">
      <label>Кол-во<input data-pkt-extra-qty type="number" min="1" max="20" value="${quantity}"></label>
      <label>Семейство<select data-pkt-extra-family>${pktFamilySelectOptions(family,{kind:"component"})}</select></label>
      <label>База<select data-pkt-extra-parent>${form ? pktBaseFamilyOptions(form,parentFamily) : `<option value="${esc(parentFamily)}" selected>${esc(parentFamily||"— авто —")}</option>`}</select></label>
      <label>Hard Cost<input data-pkt-extra-hard type="number" min="0" step="1" value="${hardCost}" title="Hard Cost этого компонента именно в составе данной модели ПКТ"></label>
      <label>Stress Cost<input data-pkt-extra-stress-formula value="${esc(stressFormula)}" placeholder="2d6 + 1d4 или 0" title="Stress Cost этого компонента именно в составе данной модели ПКТ"></label>
      <label>Цена, эдди<input data-pkt-extra-price type="number" min="0" step="1" value="${priceEddies}" title="Цена этого компонента именно в составе данной модели ПКТ"></label>
      <label>Stress<select data-pkt-extra-stress><option value="normal" ${stress==="normal"?"selected":""}>Считать</option><option value="waived" ${stress==="waived"?"selected":""}>Не считать</option></select></label>
      <label>Hard<select data-pkt-extra-hard-mode><option value="normal" ${hardMode==="normal"?"selected":""}>Считать</option><option value="waived" ${hardMode==="waived"?"selected":""}>Не считать</option></select></label>
      <label class="cic-mini-check"><input data-pkt-extra-detachable type="checkbox" ${detachable?"checked":""}> можно снять отдельно</label>
      <button type="button" class="cic-pkt-extra-remove" data-remove-pkt-extra title="Убрать из модели"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

function renderPktBaseComponents(form, entries = null, { skipSync = false } = {}) {
  const list = form.closest(".cic-window")?.querySelector("[data-pkt-base-list]");
  if (!list) return;
  let rows = entries;
  if (!rows) {
    try { rows = normalizePktBaseComponents(JSON.parse(String(form.elements.pktModelBaseComponentsJson?.value ?? "[]"))); }
    catch { rows = []; }
  }
  list.innerHTML = rows.map(pktBaseRowHtml).join("");
  if (!rows.length) list.innerHTML = '<div class="cic-pkt-extra-empty">Базы не выбраны. Нажмите «Добавить базу».</div>';
  if (!skipSync) syncPktBaseComponents(form);
}


function renderPktExtraComponents(form, entries = null, { skipSync = false } = {}) {
  const list = form.closest(".cic-window")?.querySelector("[data-pkt-extra-list]");
  if (!list) return;
  let rows = entries;
  if (!rows) {
    try { rows = normalizePktExtraComponents(JSON.parse(String(form.elements.pktModelExtraComponentsJson?.value ?? "[]"))); }
    catch { rows = []; }
  }
  list.innerHTML = rows.map((entry)=>pktExtraRowHtml(entry,form)).join("");
  if (!rows.length) list.innerHTML = '<div class="cic-pkt-extra-empty">Дополнительные модули не выбраны. Нажмите «Добавить модуль».</div>';
  if (!skipSync) syncPktExtraComponents(form);
}

async function pktBuilderDropData(event) {
  const link = await draggedUuidLink(event);
  if (!link) return null;
  return resolvePktComponentInfo(link);
}

function enablePktCompositionBuilder(form) {
  const root = form.closest(".cic-window");
  const baseList = root?.querySelector("[data-pkt-base-list]");
  const extraList = root?.querySelector("[data-pkt-extra-list]");
  if (!root || !baseList || !extraList) return;
  renderPktBaseComponents(form);
  renderPktExtraComponents(form);
  setTimeout(()=>void hydratePktCompositionMetadata(form),0);

  const activateBuilderPane = (name) => {
    root.querySelectorAll("[data-pkt-builder-tab]").forEach((button)=>button.classList.toggle("active",button.dataset.pktBuilderTab===name));
    root.querySelectorAll("[data-pkt-builder-pane]").forEach((pane)=>pane.classList.toggle("active",pane.dataset.pktBuilderPane===name));
  };
  root.querySelectorAll("[data-pkt-builder-tab]").forEach((button)=>button.addEventListener("click",()=>activateBuilderPane(button.dataset.pktBuilderTab)));

  root.querySelector("[data-add-pkt-base]")?.addEventListener("click", () => {
    const current = pktBaseComponentsFromForm(form);
    current.push({ uuid:"", name:"", quantity:1, hardCost:0, stressFormula:"0", priceEddies:0, internalSlots:0, externalSlots:0, hard:"normal", stress:"waived", family:"", uniqueBase:false, replaceableBase:true });
    renderPktBaseComponents(form,current);
    syncPktBaseComponents(form,{refreshExtras:true});
  });
  root.querySelector("[data-add-pkt-extra]")?.addEventListener("click", () => {
    const current = pktExtraComponentsFromForm(form);
    current.push({ uuid:"", name:"", quantity:1, hardCost:0, stressFormula:"0", priceEddies:0, hard:"normal", stress:"normal", family:"", parentFamily:"", detachable:true });
    renderPktExtraComponents(form,current);
  });

  baseList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-pkt-base]");
    if (!button) return;
    button.closest("[data-pkt-base-row]")?.remove();
    if (!baseList.querySelector("[data-pkt-base-row]")) baseList.innerHTML = '<div class="cic-pkt-extra-empty">Базы не выбраны. Нажмите «Добавить базу».</div>';
    syncPktBaseComponents(form,{refreshExtras:true});
  });
  extraList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-pkt-extra]");
    if (!button) return;
    button.closest("[data-pkt-extra-row]")?.remove();
    if (!extraList.querySelector("[data-pkt-extra-row]")) extraList.innerHTML = '<div class="cic-pkt-extra-empty">Дополнительные модули не выбраны. Нажмите «Добавить модуль».</div>';
    syncPktExtraComponents(form);
  });

  const hydrateRowFromUuid = async (event, kind) => {
    const selector = kind === "base" ? "[data-pkt-base-uuid]" : "[data-pkt-extra-uuid]";
    if (!event.target.matches(selector)) return false;
    const row = event.target.closest(kind === "base" ? "[data-pkt-base-row]" : "[data-pkt-extra-row]");
    const payload = await resolvePktComponentInfo(event.target.value);
    if (!payload) return false;
    event.target.value = payload.uuid;
    const nameInput = row?.querySelector(kind === "base" ? "[data-pkt-base-name]" : "[data-pkt-extra-name]");
    if (nameInput && payload.name) nameInput.value = payload.name;
    const hardInput = row?.querySelector(kind === "base" ? "[data-pkt-base-hard]" : "[data-pkt-extra-hard]");
    if (hardInput) hardInput.value = String(Math.max(0,intValue(payload.hardCost,0)));
    const stressInput = row?.querySelector(kind === "base" ? "[data-pkt-base-stress-formula]" : "[data-pkt-extra-stress-formula]");
    if (stressInput) stressInput.value = String(payload.stressFormula ?? "0");
    const priceInput = row?.querySelector(kind === "base" ? "[data-pkt-base-price]" : "[data-pkt-extra-price]");
    if (priceInput) priceInput.value = String(Math.max(0,Number(payload.priceEddies)||0));
    const hardHint = row?.querySelector(".cic-pkt-hard-hint");
    if (hardHint) hardHint.textContent = `Hard: ${Math.max(0,intValue(payload.hardCost,0))} · Stress: ${String(payload.stressFormula ?? "0")} · Цена модели: ${Math.max(0,Number(payload.priceEddies)||0).toLocaleString("ru-RU")} эдди`;
    if (kind === "base") {
      const family = row?.querySelector("[data-pkt-base-family]");
      if (family && payload.family) ensureSelectOption(family,payload.family);
      const internal = row?.querySelector("[data-pkt-base-internal]"); if (internal) internal.value = String(Math.max(0,intValue(payload.internalSlots,0)));
      const external = row?.querySelector("[data-pkt-base-external]"); if (external) external.value = String(Math.max(0,intValue(payload.externalSlots,0)));
      const uniqueBase = row?.querySelector("[data-pkt-base-unique]");
      if (uniqueBase && typeof payload.replaceableBase === "boolean") uniqueBase.checked = payload.replaceableBase === false;
    } else {
      const family = row?.querySelector("[data-pkt-extra-family]");
      if (family && payload.family) ensureSelectOption(family,payload.family);
      const parent = row?.querySelector("[data-pkt-extra-parent]");
      if (parent && payload.parentFamily) ensureSelectOption(parent,payload.parentFamily);
    }
    return true;
  };

  baseList.addEventListener("input", (event) => {
    if (event.target.matches("[data-pkt-base-uuid]")) return;
    refreshPktRowPriceHint(event.target.closest("[data-pkt-base-row]"), "base");
    syncPktBaseComponents(form,{refreshExtras:event.target.matches("[data-pkt-base-family]")});
  });
  baseList.addEventListener("change", async (event) => {
    await hydrateRowFromUuid(event,"base");
    syncPktBaseComponents(form,{refreshExtras:event.target.matches("[data-pkt-base-family],[data-pkt-base-uuid]")});
  });
  extraList.addEventListener("input", (event) => {
    if (event.target.matches("[data-pkt-extra-uuid]")) return;
    refreshPktRowPriceHint(event.target.closest("[data-pkt-extra-row]"), "extra");
    syncPktExtraComponents(form);
  });
  extraList.addEventListener("change", async (event) => {
    await hydrateRowFromUuid(event,"extra");
    syncPktExtraComponents(form);
  });

  for (const [list, selector, rowSelector, kind] of [
    [baseList,"[data-pkt-base-uuid]","[data-pkt-base-row]","base"],
    [extraList,"[data-pkt-extra-uuid]","[data-pkt-extra-row]","extra"],
  ]) {
    list.addEventListener("dragover", (event) => {
      const input = event.target.closest(selector); if (!input) return;
      event.preventDefault(); input.classList.add("cic-uuid-drop-active"); if (event.dataTransfer) event.dataTransfer.dropEffect="copy";
    });
    list.addEventListener("dragleave", (event) => event.target.closest(selector)?.classList.remove("cic-uuid-drop-active"));
    list.addEventListener("drop", async (event) => {
      const input = event.target.closest(selector); if (!input) return;
      event.preventDefault(); input.classList.remove("cic-uuid-drop-active");
      const payload = await pktBuilderDropData(event);
      if (!payload) return ui.notifications.warn("Не удалось получить UUID компонента.");
      const row = input.closest(rowSelector); input.value = payload.uuid;
      const nameInput = row?.querySelector(kind==="base"?"[data-pkt-base-name]":"[data-pkt-extra-name]"); if (nameInput) nameInput.value = payload.name;
      const hardInput = row?.querySelector(kind==="base"?"[data-pkt-base-hard]":"[data-pkt-extra-hard]"); if (hardInput) hardInput.value = String(Math.max(0,intValue(payload.hardCost,0)));
      const stressInput = row?.querySelector(kind==="base"?"[data-pkt-base-stress-formula]":"[data-pkt-extra-stress-formula]"); if (stressInput) stressInput.value = String(payload.stressFormula ?? "0");
      const priceInput = row?.querySelector(kind==="base"?"[data-pkt-base-price]":"[data-pkt-extra-price]"); if (priceInput) priceInput.value = String(Math.max(0,Number(payload.priceEddies)||0));
      const hardHint = row?.querySelector(".cic-pkt-hard-hint"); if (hardHint) hardHint.textContent = `Hard: ${Math.max(0,intValue(payload.hardCost,0))} · Stress: ${String(payload.stressFormula ?? "0")} · Цена модели: ${Math.max(0,Number(payload.priceEddies)||0).toLocaleString("ru-RU")} эдди`;
      if (kind === "base") {
        const family = row?.querySelector("[data-pkt-base-family]"); if (family && payload.family) ensureSelectOption(family,payload.family);
        const internal = row?.querySelector("[data-pkt-base-internal]"); if (internal) internal.value = String(Math.max(0,intValue(payload.internalSlots,0)));
        const external = row?.querySelector("[data-pkt-base-external]"); if (external) external.value = String(Math.max(0,intValue(payload.externalSlots,0)));
        const uniqueBase = row?.querySelector("[data-pkt-base-unique]"); if (uniqueBase && typeof payload.replaceableBase === "boolean") uniqueBase.checked = payload.replaceableBase === false;
        syncPktBaseComponents(form,{refreshExtras:true});
      } else {
        const family = row?.querySelector("[data-pkt-extra-family]"); if (family && payload.family) ensureSelectOption(family,payload.family);
        const parent = row?.querySelector("[data-pkt-extra-parent]"); if (parent && payload.parentFamily) ensureSelectOption(parent,payload.parentFamily);
        syncPktExtraComponents(form);
      }
    });
  }
}

async function hydratePktCompositionMetadata(form) {
  const root = form.closest(".cic-window");
  if (!root) return;
  const jobs=[];
  for (const [kind,rowSelector,uuidSelector] of [["base","[data-pkt-base-row]","[data-pkt-base-uuid]"],["extra","[data-pkt-extra-row]","[data-pkt-extra-uuid]"]]) {
    for (const row of root.querySelectorAll(rowSelector)) {
      const uuidInput=row.querySelector(uuidSelector);
      const uuid=String(uuidInput?.value??"").trim();
      if (!uuid) continue;
      jobs.push((async()=>{
        const payload=await resolvePktComponentInfo(uuid);
        if (!payload) return;
        const nameInput=row.querySelector(kind==="base"?"[data-pkt-base-name]":"[data-pkt-extra-name]"); if(nameInput && !String(nameInput.value??"").trim() && payload.name) nameInput.value=payload.name;
        // Не перезаписываем сохранённые Hard/Stress/price данными исходного Item.
        // Эти поля могли быть намеренно изменены или обнулены в конкретной модели ПКТ.
        refreshPktRowPriceHint(row,kind);
      })());
    }
  }
  await Promise.allSettled(jobs);
  syncPktBaseComponents(form); syncPktExtraComponents(form); updatePreview(form);
}

function enableDescriptionUuidDrops(form) {
  const targets = [form.elements.bodyHtml, form.elements.activationEffectDescription].filter(Boolean);
  for (const textarea of targets) {
    textarea.dataset.cicUuidDrop = "true";
    textarea.addEventListener("dragenter", (event) => { event.preventDefault(); textarea.classList.add("cic-uuid-drop-active"); });
    textarea.addEventListener("dragover", (event) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"; textarea.classList.add("cic-uuid-drop-active"); });
    textarea.addEventListener("dragleave", (event) => { if (!textarea.contains(event.relatedTarget)) textarea.classList.remove("cic-uuid-drop-active"); });
    textarea.addEventListener("drop", async (event) => {
      event.preventDefault();
      textarea.classList.remove("cic-uuid-drop-active");
      const link = await draggedUuidLink(event);
      if (!link) return ui.notifications.warn("Не удалось получить UUID. Перетащите Item, способность, заклинание, эффект или другой документ Foundry.");
      insertTextAtCursor(textarea, link);
      ui.notifications.info("Ссылка Foundry вставлена в описание.");
    });
  }
}

function manualJournalPages() {
  const page = (name, content, sort) => ({ name, type: "text", sort, text: { format: 1, content } });
  return [
    page("00 — С чего начать", `
<h1>Cyberpunk Remaster — Конструктор имплантов</h1>
<p><strong>Версия ${MODULE_VERSION}.</strong> Это руководство написано так, чтобы модулем можно было пользоваться вообще без знания Rule Elements, JSON и внутреннего устройства Foundry.</p>
<h2>Что это за модуль</h2>
<p>Встроенный Конструктор имплантов Cyberpunk Remaster создаёт предметы для SF2e. Он не заменяет систему: он создаёт обычные Item Foundry и заполняет их системные поля, флаги Remaster, Rule Elements и данные активации.</p>
<h2>Что можно создать</h2>
<ul><li>обычный имплант как Equipment;</li><li>имплант-оружие как настоящий Weapon;</li><li>имплант-броню как настоящий Armor;</li><li>базу и модуль ПКТ;</li><li>пассивный бонус;</li><li>активируемый временный эффект;</li><li>действие на листе персонажа;</li><li>предмет со ссылками, проверками и бросками в описании.</li></ul>
<h2>Первый запуск</h2>
<ol><li>Активируйте Cyberpunk Remaster.</li><li>Откройте вкладку <strong>Предметы / Items</strong>.</li><li>Нажмите <strong>Конструктор имплантов</strong>.</li><li>Заполните вкладку <strong>Основное</strong>.</li><li>Для первого теста не добавляйте сложные Rule Elements.</li><li>Создайте Item в Items мира.</li><li>Перетащите Item на тестового персонажа и проверьте его.</li></ol>
<p><strong>Главное правило:</strong> сначала создавайте простой рабочий предмет, затем по одному добавляйте механику. Так проще понять, какое конкретно правило вызвало ошибку.</p>`,0),

    page("01 — Интерфейс конструктора", `
<h1>Интерфейс</h1>
<p>Окно можно перетаскивать за верхний заголовок и растягивать за правый нижний угол. Системные окна Foundry, FilePicker и диалоги проверок должны открываться поверх конструктора.</p>
<h2>Вкладки</h2>
<ol><li><strong>Основное</strong> — имя, картинка, тип Item, уровень, цена, Stress/Hard Cost, слоты.</li><li><strong>Оружие / броня</strong> — нативные боевые поля Weapon/Armor.</li><li><strong>Механика</strong> — флаги Remaster/ПКТ, traits, семейства и человечность.</li><li><strong>Описание / проверки</strong> — текст Item, @Check, броски и @UUID-ссылки.</li><li><strong>Активация / эффект</strong> — временный Effect и Action на листе.</li><li><strong>Rule Elements</strong> — автоматизация SF2e.</li><li><strong>Пресеты</strong> — сохранение настроек конструктора.</li><li><strong>Предпросмотр</strong> — проверка результата перед созданием.</li></ol>
<h2>Кнопка «Мануал»</h2><p>Кнопка в верхней части конструктора открывает этот Journal. Этот же Journal находится в разделе <strong>Журналы</strong>.</p>`,10),

    page("02 — Основное: каждое поле", `
<h1>Вкладка «Основное»</h1>
<h2>Шаблон</h2><p>Шаблон — существующий Item, от которого наследуется системная структура. Для простого импланта можно использовать пустой шаблон. Для сложного оружия/брони лучше брать Item нужного типа.</p>
<h2>Профиль</h2><p>Профиль заполняет типичные флаги: внутренний, внешний, база, модуль, киберрука, киберглаз, ПКТ и т. д. Это стартовая заготовка, а не запрет на дальнейшее редактирование.</p>
<h2>Куда создать</h2><p><strong>В Items мира</strong> — предмет появится в библиотеке мира. <strong>На персонажа</strong> — Item сразу создаётся на Actor. Для разработки рекомендуется сначала создавать в Items мира.</p>
<h2>Название и картинка</h2><p>Название — обычное имя Item. Кнопка изображения открывает FilePicker.</p>
<h2>Тип импланта</h2><ul><li><strong>База</strong> — основа, которая может принимать модули.</li><li><strong>Модуль</strong> — ставится в совместимую базу.</li><li><strong>Внутренний/Внешний/Стилевой</strong> — категории Remaster.</li></ul>
<h2>Тип Item SF2e</h2><ul><li><code>equipment</code> — обычный имплант;</li><li><code>weapon</code> — настоящее оружие;</li><li><code>armor</code> — настоящая броня.</li></ul>
<h2>Уровень / редкость / цена / размер / масса</h2><p>Эти данные записываются в нативные поля Item SF2e. Цена не добавляется отдельной строкой в описание.</p>
<h2>Hard Cost</h2><p>Числовое значение по правилам вашего Remaster. Конструктор сохраняет его как метаданные импланта.</p>
<h2>Stress Cost</h2><p>Можно написать <code>2d6</code>, <code>1d4 + 1d6</code> или полную Foundry-формулу <code>[[/r 2d6 #Потеря Человечности]]</code>.</p>
<h2>Проверка установки</h2><p>Пример: <code>@Check[flat|dc:5|showDC:all]</code>. В итоговом описании она выводится отдельной строкой «Проверка».</p>
<h2>Слоты</h2><p>Для базы — вместимость; для модуля — сколько слотов занимает модуль. Точное значение зависит от правил вашего Remaster/ПКТ.</p>`,20),

    page("03 — Имплант-оружие", `
<h1>Как сделать имплант настоящим оружием</h1>
<ol><li>Во вкладке <strong>Основное</strong> выберите <strong>Оружие / кибероружие</strong>.</li><li>Перейдите в <strong>Оружие / броня</strong>.</li><li>Заполните оружейный блок.</li><li>Создайте Item и откройте его стандартный лист SF2e.</li><li>Проверьте, что он участвует в атаках как Weapon.</li></ol>
<h2>Поля оружия</h2><ul><li><strong>Категория</strong> — уровень владения оружием системы.</li><li><strong>Grade/качество</strong> — качество SF2e/Remaster; это не руна.</li><li><strong>Группа</strong> — группа оружия.</li><li><strong>Base Item</strong> — базовый тип оружия для системной логики.</li><li><strong>Кубы и die size</strong> — основной урон.</li><li><strong>Тип урона</strong> — slashing, piercing, bludgeoning и др.</li><li><strong>Range</strong> — шаг дистанции.</li><li><strong>Reload</strong> — перезарядка.</li><li><strong>Usage</strong> — одна рука, две руки, носимое/установленное.</li><li><strong>Ammo / Capacity / Expend</strong> — боеприпас и расход.</li><li><strong>Traits</strong> — agile, finesse, reach и системные/Remaster traits.</li><li><strong>Material</strong> и <strong>material grade</strong> — материал и его качество.</li></ul>
<h2>JSON patch</h2><p>Низкоуровневый инструмент. Используйте только если нужного системного поля нет в интерфейсе. Ошибочный JSON может создать некорректный Item.</p>`,30),

    page("04 — Имплант-броня", `
<h1>Как сделать имплант настоящей бронёй</h1>
<ol><li>В <strong>Основное</strong> выберите тип Item <strong>Броня</strong>.</li><li>Откройте <strong>Оружие / броня</strong>.</li><li>Заполните броневой блок.</li></ol>
<h2>Основные поля</h2><ul><li>категория и группа брони;</li><li>base item;</li><li>AC Bonus;</li><li>Dex Cap;</li><li>штраф проверок;</li><li>штраф скорости;</li><li>требование Силы;</li><li>твёрдость и HP предмета;</li><li>traits;</li><li>материал и качество материала;</li><li>JSON patch для редких системных полей.</li></ul>
<p>Если броня должна давать дополнительную особую механику, добавляйте её через Rule Elements, а не пытайтесь записывать её только текстом.</p>`,40),

    page("05 — Remaster, ПКТ и семейства", `
<h1>Вкладка «Механика»</h1>
<p>Здесь находятся данные, которые нужны именно Cyberpunk Remaster/ПКТ.</p>
<h2>Установлен</h2><p>Создаёт Item в состоянии установленного импланта, если система поддерживает соответствующий carry type.</p>
<h2>Traits</h2><p>Системные метки Item. Trait — не просто текст: система и Rule Elements могут проверять его через predicate.</p>
<h2>ПКТ</h2><p>ПКТ-флаги определяют, относится ли Item к ПКТ, является ли он корпусом, биосистемой, базой или модулем.</p>
<h2>Лимит внутренних и внешних имплантов</h2><p><strong>Без установленного корпуса ПКТ:</strong> максимум 7 внутренних и 7 внешних имплантов. <strong>С установленным корпусом ПКТ:</strong> максимум 14 внутренних и 14 внешних. На вкладке Хром рядом с заголовками «Внутренние» и «Внешние» модуль показывает текущее количество в формате <code>использовано/лимит</code>. При попытке установить имплант сверх лимита операция блокируется.</p>
<h2>Family / Parent Family</h2><p>Для базы задаётся её семейство. Для модуля задаётся семейство базы, в которую он может устанавливаться. Если они не совпадают, модуль может не считаться совместимым.</p>
<h2>Exclusive Family</h2><p>Используется для взаимоисключающих имплантов, например когда персонаж не должен иметь две версии одного уникального устройства.</p>
<h2>Grant UUID Remaster</h2><p>Список UUID по одному на строку. Не путайте его с Rule Element <strong>GrantItem</strong>: это два разных механизма.</p>
<h2>Человечность</h2><p>Отдельный флаг Remaster. Если включаете, выберите режим и значение. Сначала тестируйте на копии Actor.</p>
<h2>Как добавить свою модель в «Готовые модели ПКТ»</h2><ol><li>Создайте обязательные компоненты будущего комплекта как обычные ПКТ-импланты.</li><li>Откройте вкладку <strong>Механика</strong>.</li><li>В блоке <strong>Пользовательская готовая модель ПКТ</strong> включите регистрацию.</li><li>Введите производителя и название модели.</li><li>Выберите минимальное качество корпуса Полной Конверсии Тела.</li><li>Введите <strong>цену комплекта</strong>. Именно она будет показана в штатной строке <em>«Минимум: … · X эдди»</em>. Если оставить поле пустым или равным 0, конструктор возьмёт обычную цену создаваемого Item. Цена отображается, но автоматически не списывается.</li><li>В блоке <strong>Дополнительные компоненты модели</strong> нажмите «Добавить компонент», перетащите нужный Item и укажите количество от 1 до 20.</li><li>Для каждого дополнительного компонента выберите, учитывать ли его собственный Stress Cost. Hard Cost каждого компонента можно учитывать или отключать отдельно, так же как Stress Cost.</li><li>Откройте <strong>Предпросмотр → Доп. компоненты</strong> и проверьте список и количество.</li><li>Если в модели должен быть выбор одного из нескольких компонентов, добавьте варианты в отдельное поле выбора.</li><li>Нажмите «Создать имплант». После создания модель сохраняется в мире.</li></ol><p>После этого модель появляется в штатном интерфейсе Cyberpunk Remaster <strong>«Готовые модели ПКТ»</strong>.</p><h2>Как удалить пользовательскую модель</h2><p>Во вкладке <strong>Механика</strong> есть блок <strong>«Зарегистрированные пользовательские модели ПКТ»</strong>. Нажмите <strong>«Удалить»</strong>, чтобы убрать регистрацию модели из каталога. Сам корпус/Item мира не удаляется. Если модель уже установлена на персонаже, сначала нажмите штатную кнопку <strong>«Демонтировать»</strong> на его вкладке Хром; удаление регистрации установленной модели блокируется специально.</p><p>Мастер также видит кнопку <strong>«Удалить модель»</strong> прямо на нативной карточке пользовательской модели Remaster.</p><p><strong>Важно:</strong> конструктор сохраняет снимки компонентов модели. Поэтому пользовательская модель не зависит от того, останется ли исходный Item в той же папке мира.</p>`,50),

    page("05.1 — Базы и дополнительные компоненты ПКТ", `
<h1>Состав готовой модели ПКТ</h1>
<p>Начиная с v1.13.8 состав модели собирается в двух отдельных колонках: <strong>Базы модели</strong> и <strong>Доп. компоненты / модули</strong>.</p>
<h2>Базы модели</h2><p>Добавляйте сюда кибер-глаза, кибер-руки, кибер-ноги, комплект кибер-аудио, нейролинк и другие базовые Items. Можно перетащить Item из Foundry. Конструктор подхватит UUID, название и <code>pktFamily</code>. Для каждой базы задаются количество, семейство, Stress/Hard и режим замены. Включите <strong>«Уникальная база — замена запрещена»</strong>, если эта база является неотделимой частью конкретной модели. После установки Remaster покажет штатное сообщение с замком и не позволит заменить такую базу отдельно. Снять её можно только демонтажом всей модели ПКТ.</p>
<h2>Дополнительные модули</h2><p>Во второй колонке добавляются модули. Помимо количества и Stress у каждого модуля есть поле <strong>База</strong>. Это <code>pktParentFamily</code>. Если перетащить штатный Item Remaster, подходящая база выбирается автоматически; её можно изменить вручную.</p>
<ul><li>глазной модуль → <code>cyber-eye</code>;</li><li>аудиомодуль → <code>cyber-audio</code>;</li><li>модуль киберруки → <code>cyber-arm</code>;</li><li>модуль киберноги → <code>cyber-leg</code>;</li><li>модуль нейролинка → <code>neural-link</code>.</li></ul>
<h2>Предпросмотр</h2><p>Во вкладке <strong>Предпросмотр</strong> есть отдельные под-вкладки <strong>Базы</strong>, <strong>Доп. компоненты</strong> и <strong>Hard Cost</strong>. В «Доп. компонентах» видно, к какой базе будет прикреплён каждый модуль. В «Hard Cost» показано отдельно: Hard Cost корпуса ПКТ, сумма Hard Cost баз, сумма Hard Cost дополнительных компонентов и общий итог; ниже выводится расчёт каждого Item с учётом количества.</p>
<h2>Что произойдёт при установке</h2><p>Базы и модули передаются в штатный installation plan Cyberpunk Remaster. После создания компонентов Remaster запускает штатную привязку модулей к базам, поэтому <code>pktParentFamily</code> связывает модуль с созданной базой нужного семейства. Базы модели можно заменять штатным механизмом Remaster. Дополнительные компоненты с включённым «можно снять отдельно» разрешено демонтировать по одному; кнопка «Демонтировать» всё равно удаляет оставшийся комплект целиком.</p>
<h2>Удаление модели</h2><p>Кнопка удаления пользовательской модели доступна только Мастеру. Игроки не могут удалять регистрации готовых моделей.</p>`,55),

    page("06 — Описание, проверки и ссылки", `
<h1>Описание и кликабельные ссылки</h1>
<h2>Основное описание</h2><p>Поле поддерживает обычный текст, HTML и синтаксис Foundry.</p>
<h2>Перетаскивание предметов и способностей</h2><p><strong>Теперь можно просто перетащить Item, способность, черту, заклинание или эффект из Foundry прямо в поле описания.</strong> Конструктор вставит ссылку вида <code>@UUID[...]{Название}</code>. После создания предмета Foundry превратит её в кликабельную ссылку.</p>
<p>То же работает в поле <strong>Описание эффекта</strong> на вкладке активации.</p>
<h2>Ручная UUID-ссылка</h2><p><code>@UUID[Compendium.package.pack.Item.xxxxx]{Название}</code></p>
<h2>Проверка</h2><p><code>@Check[flat|dc:11|showDC:all]</code>. Конструктор проверки позволяет выбрать тип, КС, traits и параметры показа КС.</p>
<h2>Inline roll</h2><p><code>[[/r 2d6]]</code> — кликабельный бросок.</p>
<h2>Что такое UUID</h2><p>UUID — уникальный адрес документа Foundry. Ссылка по UUID лучше обычного текста, потому что по ней можно открыть исходный Item/Spell/Effect.</p>`,60),

    page("07 — Активация и временный Effect", `
<h1>Активация</h1>
<p>Используйте эту вкладку, если бонус не должен работать постоянно.</p>
<h2>Пример</h2><p>Имплант установлен постоянно, но «режим ускорения» включается на 1 минуту. Сам Item не получает бонус скорости. Бонус записывается в отдельный временный Effect.</p>
<h2>Настройки</h2><ul><li>название активации;</li><li>стоимость: 1/2/3 действия, свободное действие или реакция;</li><li>traits;</li><li>requirements;</li><li>trigger;</li><li>частота и количество использований;</li><li>длительность;</li><li>expiry;</li><li>имя и картинка временного эффекта;</li><li>описание эффекта;</li><li>GrantItem UUID;</li><li>Rule Elements временного эффекта.</li></ul>
<h2>Action на персонаже</h2><p>Если включён показ на листе, модуль создаёт связанный Action. Кнопка рядом с Action включает/выключает временный Effect.</p>
<h2>Пассивно или по активации?</h2><p>Если эффект действует всегда — правило идёт в пассивные Rule Elements. Если только после кнопки — в Rule Elements эффекта активации.</p>`,70),

    page("08 — Rule Elements с нуля", `
<h1>Rule Elements: объяснение для новичка</h1>
<p>Rule Element — маленькое правило JSON, которое система читает при расчёте Actor. Оно может добавить бонус, изменить параметр, дать сопротивление, добавить чувство, выдать Item и многое другое.</p>
<h2>Самый простой пример</h2><pre>{"key":"FlatModifier","selector":"fortitude","type":"item","value":1}</pre><p>Это означает: «к Стойкости добавь item-бонус +1».</p>
<h2>Главные понятия</h2><ul><li><strong>key</strong> — тип правила.</li><li><strong>selector</strong> — к чему применять.</li><li><strong>value</strong> — величина.</li><li><strong>type</strong> — тип бонуса/урона/сопротивления в зависимости от key.</li><li><strong>predicate</strong> — условие.</li><li><strong>path</strong> — путь данных Actor для ActiveEffectLike.</li><li><strong>mode</strong> — add/subtract/override/upgrade/downgrade.</li></ul>
<h2>Безопасный порядок работы</h2><ol><li>Выберите готовый пресет.</li><li>Выберите, куда добавить: пассивно или в эффект активации.</li><li>Меняйте только Value/Selector.</li><li>Добавьте пресет.</li><li>Посмотрите JSON.</li><li>Создайте тестовый Item.</li><li>Проверьте Actor.</li><li>Только после этого добавляйте predicate или JSON patch.</li></ol>
<h2>FlatModifier</h2><p>Используйте для бонусов к броскам, КБ, навыкам, saves и т.п.</p>
<h2>ActiveEffectLike</h2><p>Используйте, когда надо изменить данные Actor по конкретному path. Это более низкоуровневый инструмент.</p>
<h2>RollOption + predicate</h2><p>RollOption создаёт состояние/переключатель, а predicate говорит другому правилу работать только при наличии этого состояния.</p>`,80),

    page("08B — Все поля Rule Elements", `
<h1>Все поля редактора Rule Elements</h1>
<p>Эта страница объясняет каждое поле редактора. Если вы новичок, меняйте только те поля, которые понимаете, а остальные оставляйте пустыми — тогда сохранятся значения выбранного пресета.</p>
<h2>Пресет</h2><p>Готовая заготовка Rule Element. Выбор пресета сам по себе ещё ничего не добавляет — правило появится только после кнопки <strong>«Добавить настроенный пресет»</strong>.</p>
<h2>Добавлять в</h2><ul><li><strong>Пассивные Rule Elements импланта</strong> — правило находится на самом Item.</li><li><strong>Эффект активации</strong> — правило попадёт во временный Effect и будет работать только после активации.</li></ul>
<h2>На какую проверку / selector / характеристику</h2><p>Готовый selector. Например Fortitude, Reflex, Will, Perception, Strike, Damage. Для характеристик STR/DEX/CON/INT/WIS/CHA конструктор может преобразовать выбор в подходящий путь/ability в зависимости от типа правила.</p>
<h2>Свой selector / несколько</h2><p>Имеет приоритет над готовым selector. Один selector: <code>perception</code>. Несколько: <code>perception, medicine</code>. Несколько значений превращаются в JSON-массив.</p>
<h2>Predicate / roll options</h2><p>Условие работы правила. Например <code>cyberware-boost</code>. Если predicate не выполняется, правило существует, но не применяется к броску.</p>
<h2>Value</h2><p>Число или поддерживаемая системой формула. Обычно это величина бонуса, сопротивления, изменения параметра и т. д.</p>
<h2>Тип бонуса</h2><p>Для FlatModifier: item/status/circumstance/untyped/potency. Бонусы одинакового типа могут не складываться по правилам системы.</p>
<h2>Mode</h2><ul><li><strong>add</strong> — прибавить;</li><li><strong>subtract</strong> — вычесть;</li><li><strong>override</strong> — полностью заменить;</li><li><strong>multiply</strong> — умножить, если key поддерживает;</li><li><strong>upgrade/downgrade</strong> — повысить/понизить ступень, если Rule Element это поддерживает.</li></ul>
<h2>Slug</h2><p>Машинное имя правила/модификатора. Обычно латиницей без пробелов. Нужно не каждому Rule Element.</p>
<h2>Label</h2><p>Человекочитаемое название источника бонуса или эффекта.</p>
<h2>UUID</h2><p>Используется GrantItem и другими правилами, которые ссылаются на конкретный документ Foundry.</p>
<h2>Path</h2><p>Путь к данным Actor/Item для ActiveEffectLike. Неверный path — одна из самых частых причин неработающего правила.</p>
<h2>Тип урона</h2><p>Используется Resistance, DamageDice и другими правилами, где нужен damage type.</p>
<h2>Кубы</h2><p>Число кубов и размер d4/d6/d8/d10/d12. Используется у правил дополнительного урона.</p>
<h2>Дополнительный JSON patch</h2><p>Поля patch применяются к создаваемому Rule Element последними. Это способ добавить <code>priority</code>, <code>phase</code> и другие параметры, которых нет отдельным полем. Ошибка JSON остановит добавление/создание.</p>
<h2>Предел Человечности</h2><p>Быстрая специальная автоматизация Remaster. Включайте только если понимаете, какой параметр меняется вашей версией Remaster.</p>
<h2>Заменить Rule Elements шаблона</h2><p>Включено — правила выбранного исходного Item заменяются вашим JSON. Выключено — новые правила добавляются к существующим.</p>
<h2>Rule Elements JSON-массив</h2><p>Финальный список пассивных правил. Это главный источник истины перед созданием Item. Кнопка «Форматировать JSON» помогает увидеть структуру, но не исправляет логические ошибки.</p>
`,85),

    page("09 — Выносливость / Stamina", `
<h1>Правило Выносливости</h1>
<p>В пресетах есть <strong>«Выносливость / Stamina — изменить максимум SP»</strong>.</p>
<pre>{
  "key": "ActiveEffectLike",
  "mode": "add",
  "path": "system.attributes.hp.sp.max",
  "value": 1,
  "phase": "afterDerived"
}</pre>
<h2>+5 к максимальной Выносливости</h2><ol><li>Выберите этот пресет.</li><li>Value = 5.</li><li>Mode = add.</li><li>Выберите пассивный Item или эффект активации.</li><li>Добавьте правило.</li></ol>
<h2>-5 к максимуму</h2><p>Mode = subtract и Value = 5, либо add с Value = -5.</p>
<h2>Override</h2><p>Полностью заменяет рассчитанный максимум. Использовать осторожно.</p>
<h2>Текущее SP и максимум SP</h2><p>Это правило меняет <strong>максимум</strong>. Оно не должно постоянно насильно устанавливать текущее значение, потому что текущее SP — расходуемый ресурс.</p>`,90),

    page("10 — Частые Rule Elements", `
<h1>Часто используемые пресеты</h1>
<ul><li><strong>FlatModifier</strong> — бонус/штраф к проверке.</li><li><strong>Resistance</strong> — сопротивление типу урона.</li><li><strong>Immunity</strong> — иммунитет.</li><li><strong>Sense</strong> — чувство/зрение.</li><li><strong>BaseSpeed</strong> — новая базовая скорость.</li><li><strong>RollOption</strong> — переключаемый режим.</li><li><strong>GrantItem</strong> — выдать Item по UUID.</li><li><strong>ChoiceSet</strong> — выбор при добавлении предмета.</li><li><strong>DamageDice</strong> — дополнительные кубы урона.</li><li><strong>ItemAlteration</strong> — изменение другого Item.</li><li><strong>Note</strong> — заметка к броску.</li></ul>
<p>Если не знаете, какой selector нужен, начните с готового пресета и проверьте системные данные/Inspect Roll. Не добавляйте десять правил одновременно.</p>`,100),

    page("11 — Пресеты и JSON-профили", `
<h1>Пользовательские пресеты</h1>
<p>Пресет конструктора сохраняет заполненную форму. Это удобно для линейки имплантов одного производителя.</p>
<h2>Сохранить</h2><ol><li>Заполните форму.</li><li>Откройте «Пресеты».</li><li>Введите имя.</li><li>Нажмите сохранить.</li></ol>
<h2>JSON-профиль</h2><p>JSON-профиль — переносимая копия почти всех настроек конструктора. Его можно хранить вне Foundry, пересылать и импортировать.</p>
<h2>Когда использовать что</h2><ul><li><strong>Пользовательский пресет</strong> — быстро использовать внутри текущего браузера/мира.</li><li><strong>JSON-профиль</strong> — резервная копия и перенос.</li></ul>`,110),

    page("12 — Пошаговые примеры", `
<h1>Примеры от начала до конца</h1>
<h2>Пример A: простой пассивный имплант</h2><ol><li>Equipment.</li><li>Название и картинка.</li><li>Stress 1d6, Hard 2.</li><li>Rule Elements → FlatModifier → Fortitude → +1.</li><li>Создать в Items мира.</li><li>Перетащить на Actor и проверить Стойкость.</li></ol>
<h2>Пример B: +5 максимальной Выносливости</h2><ol><li>Создайте обычный Equipment.</li><li>Rule Elements → пресет Stamina.</li><li>Value 5, mode add.</li><li>Добавьте как пассивное правило.</li><li>Создайте Item и добавьте Actor.</li><li>Сравните максимум SP до/после.</li></ol>
<h2>Пример C: активируемый режим</h2><ol><li>Включите активацию.</li><li>Назовите её «Разгон».</li><li>Задайте длительность.</li><li>В Rule Elements выберите «Эффект активации».</li><li>Добавьте нужные бонусы.</li><li>Создайте Item на Actor.</li><li>Используйте Action и проверьте появление Effect.</li></ol>
<h2>Пример D: описание со ссылкой</h2><ol><li>Откройте вкладку описания.</li><li>Перетащите из Compendium нужную способность прямо в textarea.</li><li>Появится @UUID-ссылка.</li><li>Добавьте обычный текст вокруг ссылки.</li><li>После создания Item ссылка станет кликабельной.</li></ol>`,120),

    page("13 — Ошибки и диагностика", `
<h1>Если что-то не работает</h1>
<h2>Item не создаётся</h2><ol><li>Откройте консоль F12.</li><li>Проверьте ошибку JSON.</li><li>Уберите последний Rule Element/JSON patch.</li><li>Попробуйте создать простой Item.</li></ol>
<h2>Rule Element не работает</h2><ol><li>Убедитесь, что Item находится на Actor.</li><li>Убедитесь, что он экипирован/установлен, если это требуется системе.</li><li>Проверьте key.</li><li>Проверьте selector/path.</li><li>Проверьте predicate.</li><li>Для ActiveEffectLike проверьте phase.</li></ol>
<h2>Ссылка не вставляется перетаскиванием</h2><p>Перетаскивайте именно документ Foundry: Item, Spell, Feat, Effect и т.п. Если источник не передаёт UUID, используйте ручное поле UUID.</p>
<h2>Активация не появляется</h2><p>Проверьте, включена ли активация, включён ли показ Action на листе и находится ли исходный имплант на Actor.</p>
<h2>После изменения модуля странное поведение</h2><p>Удалите старую папку модуля, установите новую сборку и перезапустите Foundry. Не смешивайте файлы двух версий.</p>`,130),

    page("14 — Словарь", `
<h1>Словарь терминов</h1>
<dl><dt><strong>Actor</strong></dt><dd>Персонаж/NPC в Foundry.</dd><dt><strong>Item</strong></dt><dd>Предмет, способность, черта, оружие, броня, эффект и многие другие сущности системы.</dd><dt><strong>UUID</strong></dt><dd>Уникальный адрес документа Foundry.</dd><dt><strong>Rule Element</strong></dt><dd>JSON-правило автоматизации SF2e.</dd><dt><strong>Selector</strong></dt><dd>Ключ, указывающий, какой бросок/статистику изменять.</dd><dt><strong>Predicate</strong></dt><dd>Условие, при котором правило работает.</dd><dt><strong>Path</strong></dt><dd>Адрес поля внутри данных Actor/Item.</dd><dt><strong>Effect</strong></dt><dd>Временный Item, содержащий правила, которые действуют пока эффект существует.</dd><dt><strong>Action</strong></dt><dd>Действие на листе персонажа.</dd><dt><strong>ПКТ</strong></dt><dd>Дополнительная механика/флаги Cyberpunk Remaster, используемые модулем.</dd><dt><strong>Stress Cost / Hard Cost</strong></dt><dd>Метаданные импланта по правилам Remaster.</dd><dt><strong>JSON patch</strong></dt><dd>Ручное низкоуровневое изменение системных данных Item.</dd></dl>`,140),
  ];
}

async function ensureManualJournal({ open = false } = {}) {
  let journal = game.journal?.find?.((entry) => entry.flags?.[MODULE_ID]?.manual === true) ?? game.journal?.getName?.("Cyberpunk Implant Creator — Полный мануал") ?? null;
  if (!game.user?.isGM) {
    if (open && journal) journal.sheet?.render?.(true);
    return journal;
  }

  const pages = manualJournalPages();
  if (!journal) {
    journal = await JournalEntry.create({
      name: "Cyberpunk Implant Creator — Полный мануал",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
      flags: { [MODULE_ID]: { manual: true, version: MODULE_VERSION } },
    }, { renderSheet: false });
    await journal.createEmbeddedDocuments("JournalEntryPage", pages);
  } else if (journal.flags?.[MODULE_ID]?.version !== MODULE_VERSION) {
    const ids = journal.pages?.map?.((page) => page.id).filter(Boolean) ?? [];
    if (ids.length) await journal.deleteEmbeddedDocuments("JournalEntryPage", ids);
    await journal.createEmbeddedDocuments("JournalEntryPage", pages);
    await journal.update({ [`flags.${MODULE_ID}.manual`]: true, [`flags.${MODULE_ID}.version`]: MODULE_VERSION, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
  }
  if (open) journal.sheet?.render?.(true);
  return journal;
}

async function openManualJournal() {
  const journal = await ensureManualJournal({ open: true });
  if (!journal) ui.notifications.warn("Мануал пока не создан. Попросите Мастера открыть мир один раз с активным модулем.");
}

function rulesFieldForTarget(form, target = form.elements.ruleTarget?.value ?? "passive") {
  return target === "activation" ? form.elements.activationEffectRulesJson : form.elements.rulesJson;
}
function currentRules(form, target = form.elements.ruleTarget?.value ?? "passive") { return normalizeRules(rulesFieldForTarget(form, target)?.value); }
function parsePredicateInput(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (text.startsWith("[") || text.startsWith("{")) {
    try { const value = JSON.parse(text); return Array.isArray(value) ? value : [value]; }
    catch (error) { throw new Error(`Predicate JSON: ${error.message}`); }
  }
  return parseList(text);
}
function scalarFromInput(raw) {
  const text=String(raw ?? "").trim(); if(!text) return undefined;
  if(text === "true") return true; if(text === "false") return false;
  const n=Number(text); return Number.isFinite(n) ? n : text;
}
function configureRule(rule, form) {
  let out=foundry.utils.deepClone(rule);
  const custom=parseList(form.elements.ruleSelectorCustom?.value); const presetSelector=String(form.elements.ruleSelectorPreset?.value ?? "").trim();
  const abilityMatch = custom.length === 0 ? presetSelector.match(/^@ability:(str|dex|con|int|wis|cha)$/) : null;
  const ability = abilityMatch?.[1] ?? null;
  const selectors=custom.length ? custom : (presetSelector && !ability ? [presetSelector] : []);

  // Характеристики — это не обычные roll selectors. Для них конструктор
  // применяет нативный путь данных SF2e/PF2e или специальное поле конкретного RE.
  if (ability) {
    if (out.key === "Strike") {
      out.ability = ability;
    } else if (out.key === "SpecialStatistic") {
      out.attribute = ability;
    } else if (["FlatModifier", "ActiveEffectLike"].includes(out.key)) {
      // FlatModifier здесь превращается в ActiveEffectLike, потому что пользователь
      // просит изменить сам модификатор характеристики, а не отдельную проверку.
      const originalValue = out.value ?? 1;
      out = {
        key: "ActiveEffectLike",
        mode: "add",
        path: `system.abilities.${ability}.mod`,
        value: originalValue,
        ...(out.label ? { label: out.label } : {}),
        ...(out.predicate ? { predicate: foundry.utils.deepClone(out.predicate) } : {}),
      };
    } else {
      throw new Error(`Характеристика ${ability.toUpperCase()} не является обычным selector для ${out.key}. Используйте ActiveEffectLike/FlatModifier, Strike или SpecialStatistic.`);
    }
  }

  if(selectors.length) {
    if("selectors" in out || ["EphemeralEffect"].includes(out.key)) out.selectors=selectors;
    else if("selector" in out || ["FlatModifier","AdjustDegreeOfSuccess","AdjustModifier","DamageAlteration","DamageDice","MultipleAttackPenalty","Note","RollTwice","SubstituteRoll"].includes(out.key)) out.selector=selectors.length===1?selectors[0]:selectors;
  }
  const predicate=parsePredicateInput(form.elements.rulePredicate?.value); if(predicate?.length) out.predicate=predicate;
  const value=scalarFromInput(form.elements.ruleValue?.value); if(value !== undefined && ("value" in out || ["ActiveEffectLike","BaseSpeed","CreatureSize","DexterityModifierCap","FastHealing","FlatModifier","LoseHitPoints","MultipleAttackPenalty","Resistance","Weakness","SubstituteRoll","TempHP","TokenImage","TokenName"].includes(out.key))) out.value=value;
  const type=String(form.elements.ruleModifierType?.value ?? "").trim(); if(type && ["FlatModifier"].includes(out.key)) out.type=type;
  const mode=String(form.elements.ruleMode?.value ?? "").trim(); if(mode && ("mode" in out || ["ActiveEffectLike","AdjustModifier","AdjustStrike","DamageAlteration","ItemAlteration","CyberpunkHumanity"].includes(out.key))) out.mode=mode;
  const slug=String(form.elements.ruleSlug?.value ?? "").trim(); if(slug && ("slug" in out || ["FlatModifier","SpecialResource","SpecialStatistic","SubstituteRoll","TokenMark","MartialProficiency"].includes(out.key))) out.slug=slug;
  const label=String(form.elements.ruleLabel?.value ?? "").trim(); if(label) out.label=label;
  const uuid=String(form.elements.ruleUuid?.value ?? "").trim(); if(uuid && ("uuid" in out || ["GrantItem","EphemeralEffect","ItemCast"].includes(out.key))) out.uuid=uuid;
  const path=String(form.elements.rulePath?.value ?? "").trim(); if(path && out.key === "ActiveEffectLike") out.path=path;
  const damageType=String(form.elements.ruleDamageType?.value ?? "").trim(); const diceNumber=intValue(form.elements.ruleDiceNumber?.value,1); const die=String(form.elements.ruleDieSize?.value ?? "d6");
  if(out.key === "DamageDice") { out.diceNumber=diceNumber; out.dieSize=die; if(damageType) out.damageType=damageType; }
  if(out.key === "Strike") { out.damage ??={}; out.damage.base ??={}; out.damage.base.dice=diceNumber; out.damage.base.die=die; if(damageType) out.damage.base.damageType=damageType; }
  const patchText=String(form.elements.rulePatchJson?.value ?? "").trim(); if(patchText) { let patch; try{patch=JSON.parse(patchText);}catch(e){throw new Error(`Rule patch JSON: ${e.message}`);} if(!patch||Array.isArray(patch)||typeof patch!=="object") throw new Error("Rule patch должен быть JSON-объектом."); foundry.utils.mergeObject(out,patch,{inplace:true,insertKeys:true,overwrite:true}); }
  return out;
}
function addRulePreset(form) {
  const preset = RULE_PRESETS[form.elements.rulePreset.value]; if (!preset) return;
  const target = form.elements.ruleTarget?.value ?? "passive";
  let rules = []; try { rules = currentRules(form, target); } catch (error) { ui.notifications.error(error.message); return; }
  try { const additions = preset.rules ?? [preset.rule]; for (const rule of additions) rules.push(configureRule(rule, form)); }
  catch(error){ ui.notifications.error(error.message); return; }
  rulesFieldForTarget(form, target).value = JSON.stringify(rules,null,2); updatePreview(form);
}
function updateRuleHelp(form) { const p = RULE_PRESETS[form.elements.rulePreset.value]; const el=form.closest(".cic-window").querySelector("[data-rule-help]"); if(el) el.textContent=p?.help ?? ""; }

function profileFieldNames() {
  return ["preset","name","img","implantType","itemDocumentType","itemLevel","priceEddies","itemSize","bulkValue","bulkCustom","rarity","weaponCategory","weaponGrade","weaponGroup","weaponBaseItem","weaponBonus","weaponDamageDice","weaponDamageDie","weaponDamageType","weaponBonusDamage","weaponSplashDamage","weaponRange","weaponReload","weaponUsage","weaponExpend","weaponAmmoBaseType","weaponAmmoBuiltIn","weaponAmmoCapacity","weaponHardness","weaponHpMax","weaponMaterialType","weaponMaterialGrade","weaponTraitsCustom","weaponSystemPatchJson","armorCategory","armorGrade","armorGroup","armorBaseItem","armorAcBonus","armorDexCap","armorCheckPenalty","armorSpeedPenalty","armorStrength","armorHardness","armorHpMax","armorMaterialType","armorMaterialGrade","armorTraitsCustom","armorSystemPatchJson","hardCost","stressFormula","stressInlineRoll","checkSyntax","slots","internalSlots","externalSlots","installed","bodyHtml","pktOnly","pktBiosystem","pktBody","pktQuality","pktComponentQuality","exclusiveFamily","pktFamily","pktParentFamily","pktReplaceable","pktReplaceableBase","pktRegisterModel","pktModelIncludeCreated","pktModelManufacturer","pktModelName","pktModelMinimumQuality","pktModelPrice","pktModelAutoPrice","pktModelComponents","pktModelBaseComponentsJson","pktModelExtraComponentsJson","pktModelChoiceLabel","pktModelChoiceUuids","traits","grantItemUuids","humanityEnabled","humanityMode","humanityValue","humanityLabel","replaceTemplateRules","rulesJson","activationEnabled","activationName","activationActionType","activationTraits","activationRequirements","activationTrigger","activationFrequency","activationFrequencyMax","activationDurationValue","activationDurationUnit","activationExpiry","activationEffectName","activationEffectImg","activationEffectDescription","activationGrantItemUuids","activationEffectRulesJson","activationEffectTokenIcon","activationChatMessage","activationShowOnSheet","checkType","checkCustomType","checkDc","checkAgainst","checkShowDc","checkBasic","checkTraits","checkName","checkLabel","inlineFormula","inlineUuid","inlineUuidLabel","ruleTarget","ruleSelectorPreset","ruleSelectorCustom","rulePredicate","ruleValue","ruleModifierType","ruleMode","ruleSlug","ruleLabel","ruleUuid","rulePath","ruleDamageType","ruleDiceNumber","ruleDieSize","rulePatchJson"];
}
function serializeProfile(form) {
  const out = { version: MODULE_VERSION };
  for (const name of profileFieldNames()) { const el=form.elements[name]; if(!el) continue; out[name]=el.type === "checkbox" ? el.checked : el.value; }
  out.weaponTraits = parseList(form.elements.weaponTraitsPicker?.value);
  out.armorTraits = parseList(form.elements.armorTraitsPicker?.value);
  out.pktModelBaseComponents = pktBaseComponentsFromForm(form);
  out.pktModelExtraComponents = pktExtraComponentsFromForm(form);
  return out;
}
function applyProfile(form, profile) {
  for (const name of profileFieldNames()) { const el=form.elements[name]; if(!el || !(name in profile)) continue; if(el.type==="checkbox") el.checked=Boolean(profile[name]); else el.value=String(profile[name] ?? ""); }
  if ("weaponTraits" in profile && form.elements.weaponTraitsPicker) form.elements.weaponTraitsPicker.value = parseList(profile.weaponTraits).join(", ");
  if ("armorTraits" in profile && form.elements.armorTraitsPicker) form.elements.armorTraitsPicker.value = parseList(profile.armorTraits).join(", ");
  const profileBases = normalizePktBaseComponents(profile.pktModelBaseComponents ?? (()=>{ try { return JSON.parse(String(profile.pktModelBaseComponentsJson ?? "[]")); } catch { return []; } })());
  const profileExtras = normalizePktExtraComponents(profile.pktModelExtraComponents ?? (()=>{ try { return JSON.parse(String(profile.pktModelExtraComponentsJson ?? "[]")); } catch { return []; } })());
  if (form.elements.pktModelBaseComponentsJson) form.elements.pktModelBaseComponentsJson.value = JSON.stringify(profileBases);
  if (form.elements.pktModelExtraComponentsJson) form.elements.pktModelExtraComponentsJson.value = JSON.stringify(profileExtras);
  renderPktBaseComponents(form, profileBases, {skipSync:true});
  renderPktExtraComponents(form, profileExtras, {skipSync:true});
  syncPktBaseComponents(form); syncPktExtraComponents(form);
  void hydratePktCompositionMetadata(form);
  updateCombatSections(form); refreshCatalogPickers(form); renderActivationTraitPicker(form); updateRuleHelp(form); updateCheckPreview(form); updatePreview(form);
}
function getCustomPresets() { try { return JSON.parse(game.settings.get(PACKAGE_ID,"implantCreatorCustomPresets") || "{}"); } catch { return {}; } }
async function setCustomPresets(value) { await game.settings.set(PACKAGE_ID,"implantCreatorCustomPresets",JSON.stringify(value)); }
function refreshCustomPresetSelect(form) {
  const select=form.elements.customPresetSelect, current=select.value, presets=getCustomPresets();
  select.innerHTML='<option value="">— нет —</option>'+Object.keys(presets).sort((a,b)=>a.localeCompare(b,"ru")).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join(""); if(presets[current]) select.value=current;
}

function updateCombatSections(form) {
  const type = form.elements.itemDocumentType?.value ?? "equipment";
  const win = form.closest(".cic-window");
  if (!win) return;
  for (const section of win.querySelectorAll("[data-combat-type]")) section.hidden = section.dataset.combatType !== type;
}

function updateImagePreview(form) {
  const src=String(form.elements.img.value || "icons/svg/circuitry.svg").trim();
  for(const img of form.closest(".cic-window").querySelectorAll("[data-image-preview],[data-preview-img]")) img.src=src;
}

async function pickImage(form) {
  const current=String(form.elements.img.value || "").trim();
  const Picker = globalThis.FilePicker ?? globalThis.foundry?.applications?.apps?.FilePicker?.implementation;
  if (!Picker) { ui.notifications.warn("FilePicker Foundry недоступен. Вставьте путь к картинке вручную."); return; }
  try {
    const picker = new Picker({ type:"image", current, callback:(path)=>{ form.elements.img.value=path; updateImagePreview(form); updatePreview(form); } });
    if (typeof picker.render === "function") picker.render(true); else if (typeof picker.browse === "function") picker.browse(current);
    requestAnimationFrame(() => raiseNewestExternalWindows(form.closest(".cic-root")));
    setTimeout(() => raiseNewestExternalWindows(form.closest(".cic-root")), 50);
  } catch (error) { console.error(`${MODULE_ID} | FilePicker failed`,error); ui.notifications.warn("Не удалось открыть выбор файла. Вставьте путь вручную."); }
}

async function pickEffectImage(form) {
  const current=String(form.elements.activationEffectImg?.value || form.elements.img.value || "").trim();
  const Picker = globalThis.FilePicker ?? globalThis.foundry?.applications?.apps?.FilePicker?.implementation;
  if (!Picker) { ui.notifications.warn("FilePicker Foundry недоступен. Вставьте путь к картинке вручную."); return; }
  try {
    const picker = new Picker({ type:"image", current, callback:(path)=>{ form.elements.activationEffectImg.value=path; updatePreview(form); } });
    if (typeof picker.render === "function") picker.render(true); else if (typeof picker.browse === "function") picker.browse(current);
    requestAnimationFrame(() => raiseNewestExternalWindows(form.closest(".cic-root")));
    setTimeout(() => raiseNewestExternalWindows(form.closest(".cic-root")), 50);
  } catch (error) { console.error(`${MODULE_ID} | Effect FilePicker failed`,error); ui.notifications.warn("Не удалось открыть выбор файла. Вставьте путь вручную."); }
}

function pktPreviewTotals(form) {
  const bases=pktBaseComponentsFromForm(form), extras=pktExtraComponentsFromForm(form);
  const bodyStress=stressDiceVector(form.elements.stressFormula?.value ?? "0",1);
  const baseStress=bases.reduce((sum,e)=>e.stress==="waived"?sum:stressVectorAdd(sum,stressDiceVector(e.stressFormula,e.quantity)),{d6:0,d4:0});
  const extraStress=extras.reduce((sum,e)=>e.stress==="waived"?sum:stressVectorAdd(sum,stressDiceVector(e.stressFormula,e.quantity)),{d6:0,d4:0});
  const totalStress=stressVectorAdd(bodyStress,stressVectorAdd(baseStress,extraStress));
  const bodyPrice=Math.max(0,Number(form.elements.priceEddies?.value)||0);
  const basePrice=bases.reduce((s,e)=>s+Math.max(0,Number(e.priceEddies)||0)*Math.max(1,intValue(e.quantity,1)),0);
  const extraPrice=extras.reduce((s,e)=>s+Math.max(0,Number(e.priceEddies)||0)*Math.max(1,intValue(e.quantity,1)),0);
  return {bases,extras,bodyStress,baseStress,extraStress,totalStress,bodyPrice,basePrice,extraPrice,kitPrice:basePrice+extraPrice,totalPrice:bodyPrice+basePrice+extraPrice};
}

function updatePktModelPriceMode(form) {
  const auto = form.elements.pktModelAutoPrice?.checked === true;
  const priceInput = form.elements.pktModelPrice;
  if (!priceInput) return;
  priceInput.readOnly = auto;
  priceInput.classList.toggle("cic-auto-price", auto);
  if (auto) {
    const totals = pktPreviewTotals(form);
    priceInput.value = String(Math.max(0, Math.trunc(totals.kitPrice)));
  }
}

async function rollPktTotalStress(form) {
  const totals=pktPreviewTotals(form);
  const formula=stressVectorFormula(totals.totalStress);
  if (formula === "0") return ui.notifications.info("Общий Stress Cost равен 0 — бросок не требуется.");
  try {
    const roll=new Roll(formula);
    await roll.evaluate();
    await roll.toMessage({ speaker:ChatMessage.getSpeaker(), flavor:`Общий Stress Cost ПКТ: ${formula}` });
  } catch (error) { console.error(`${MODULE_ID} | total PKT stress roll failed`,error); ui.notifications.error(`Не удалось прокинуть общий Stress Cost: ${error.message}`); }
}

function updatePreview(form) {
  const name=form.elements.name.value || "Новый имплант", implantType=form.elements.implantType.value, stress=form.elements.stressFormula.value || "0", slots=intValue(form.elements.slots.value), internalSlots=Math.max(0,intValue(form.elements.internalSlots?.value,0)), externalSlots=Math.max(0,intValue(form.elements.externalSlots?.value,0)), hard=intValue(form.elements.hardCost.value);
  const win=form.closest(".cic-window"); win.querySelector("[data-preview-name]").textContent=name;
  const bulkPreset=String(form.elements.bulkValue.value); const bulk=bulkPreset === "custom" ? String(form.elements.bulkCustom.value || "0") : bulkPreset;
  const flags=[`Тип: ${IMPLANT_LABELS[implantType]}`,`Item: ${ITEM_TYPE_LABELS[form.elements.itemDocumentType?.value] ?? form.elements.itemDocumentType?.value ?? "equipment"}`,`Уровень: ${intValue(form.elements.itemLevel.value)}`,`Редкость: ${form.elements.rarity.value}`,`Цена: ${intValue(form.elements.priceEddies.value)} эдди`,`Размер: ${form.elements.itemSize.value}`,`Масса/Bulk: ${bulk}`,`Hard Cost: ${hard}`,`Stress Cost: ${stress}`,`Слоты: ${slots}`];
  if(form.elements.pktOnly.checked) flags.push("ПКТ"); if(form.elements.pktBody.checked) flags.push(`Корпус ПКТ ${form.elements.pktQuality.value}`); if(form.elements.pktBiosystem.checked) flags.push("Биосистема ПКТ");
  if(form.elements.pktRegisterModel?.checked) flags.push(`Готовая модель ПКТ: ${form.elements.pktModelManufacturer?.value || ""} ${form.elements.pktModelName?.value || name}`.trim());
  if(form.elements.activationEnabled?.checked) flags.push(`Активация: ${form.elements.activationName.value || "Активировать"} / ${ACTIVATION_ACTIONS[form.elements.activationActionType.value]?.label ?? "1 действие"}`);
  win.querySelector("[data-preview-flags]").innerHTML=flags.map(x=>`<span>${esc(x)}</span>`).join("");
  const previewData = {
    implantType, hardCost:hard, stressFormula:(()=>{try{return normalizeStress(stress).formula}catch{return stress}})(), stressDisplay:stress,
    stressInlineRoll:form.elements.stressInlineRoll.checked, checkSyntax:form.elements.checkSyntax.value, slots, internalSlots, externalSlots, bodyHtml:form.elements.bodyHtml.value,
    activationEnabled: form.elements.activationEnabled?.checked === true,
    activationName: form.elements.activationName?.value,
    activationActionType: form.elements.activationActionType?.value,
    activationTraits: form.elements.activationTraits?.value,
    activationRequirements: form.elements.activationRequirements?.value,
    activationTrigger: form.elements.activationTrigger?.value,
    activationFrequency: form.elements.activationFrequency?.value,
    activationFrequencyMax: intValue(form.elements.activationFrequencyMax?.value,1),
    activationDurationValue: intValue(form.elements.activationDurationValue?.value,1),
    activationDurationUnit: form.elements.activationDurationUnit?.value,
    activationEffectDescription: form.elements.activationEffectDescription?.value,
  };
  win.querySelector("[data-preview-description]").innerHTML=canonicalDescription(previewData);
  try { win.querySelector("[data-preview-rules]").textContent=JSON.stringify(normalizeRules(form.elements.rulesJson.value),null,2); } catch { win.querySelector("[data-preview-rules]").textContent="JSON содержит ошибку"; }
  try { win.querySelector("[data-preview-activation-rules]").textContent=JSON.stringify(normalizeRules(form.elements.activationEffectRulesJson?.value),null,2); } catch { win.querySelector("[data-preview-activation-rules]").textContent="JSON содержит ошибку"; }
  const bases = pktBaseComponentsFromForm(form);
  const extras = pktExtraComponentsFromForm(form);
  const baseList = win.querySelector("[data-preview-base-list]");
  const baseEmpty = win.querySelector("[data-preview-base-empty]");
  const baseCount = win.querySelector("[data-preview-base-count]");
  if (baseCount) baseCount.textContent = String(bases.reduce((sum,entry)=>sum+Math.max(1,intValue(entry.quantity,1)),0));
  if (baseEmpty) baseEmpty.hidden = bases.length > 0;
  if (baseList) baseList.innerHTML = bases.map((entry,index)=>`<div class="cic-preview-extra-card"><strong>${esc(entry.name || `База ${index+1}`)}</strong><span>× ${Math.max(1,intValue(entry.quantity,1))}</span><small>${esc(entry.uuid)}</small><em>${esc(pktFamilyLabel(entry.family))}${entry.family?` · ${esc(entry.family)}`:""} · ${entry.uniqueBase === true || entry.replaceableBase === false ? "🔒 Уникальная база · замена запрещена" : "Базу можно заменять"} · ${entry.stress === "waived" ? "Stress: не считать" : "Stress: считать"} · ${entry.hard === "waived" ? "Hard: не считать" : `Hard: ${Math.max(0,intValue(entry.hardCost,0))}`}</em></div>`).join("");
  const extraList = win.querySelector("[data-preview-extra-list]");
  const extraEmpty = win.querySelector("[data-preview-extra-empty]");
  const extraCount = win.querySelector("[data-preview-extra-count]");
  if (extraCount) extraCount.textContent = String(extras.reduce((sum,entry)=>sum+Math.max(1,intValue(entry.quantity,1)),0));
  if (extraEmpty) extraEmpty.hidden = extras.length > 0;
  if (extraList) extraList.innerHTML = extras.map((entry,index)=>`<div class="cic-preview-extra-card"><strong>${esc(entry.name || `Компонент ${index+1}`)}</strong><span>× ${Math.max(1,intValue(entry.quantity,1))}</span><small>${esc(entry.uuid)}</small><em>${entry.parentFamily ? `База: ${esc(pktFamilyLabel(entry.parentFamily))} · ${esc(entry.parentFamily)} · ` : "База: авто · "}${entry.stress === "waived" ? "Stress: не считать" : "Stress: считать"} · ${entry.hard === "waived" ? "Hard: не считать" : `Hard: ${Math.max(0,intValue(entry.hardCost,0))}`} · ${entry.detachable !== false ? "можно снять отдельно" : "в составе модели"}</em></div>`).join("");
  const bodyHard = Math.max(0, hard);
  const baseHard = bases.reduce((sum,entry)=>sum + (entry.hard === "waived" ? 0 : Math.max(0,intValue(entry.hardCost,0)) * Math.max(1,intValue(entry.quantity,1))),0);
  const extraHard = extras.reduce((sum,entry)=>sum + (entry.hard === "waived" ? 0 : Math.max(0,intValue(entry.hardCost,0)) * Math.max(1,intValue(entry.quantity,1))),0);
  const totalHard = bodyHard + baseHard + extraHard;
  const hardTotal = win.querySelector("[data-preview-hard-total]"); if (hardTotal) hardTotal.textContent=String(totalHard);
  const hardSummary = win.querySelector("[data-preview-hard-summary]");
  if (hardSummary) hardSummary.innerHTML = `<div><span>Базовый корпус ПКТ</span><strong>${bodyHard}</strong></div><div><span>Базы модели</span><strong>${baseHard}</strong></div><div><span>Доп. компоненты</span><strong>${extraHard}</strong></div><div class="cic-hard-total"><span>Итого Hard Cost модели</span><strong>${totalHard}</strong></div>`;
  const hardBases = win.querySelector("[data-preview-hard-bases]");
  if (hardBases) hardBases.innerHTML = bases.length ? bases.map((entry,index)=>{ const q=Math.max(1,intValue(entry.quantity,1)); const each=Math.max(0,intValue(entry.hardCost,0)); const counted=entry.hard === "waived" ? 0 : each*q; return `<div class="cic-hard-line"><span>${esc(entry.name||`База ${index+1}`)} × ${q}</span><strong>${entry.hard === "waived" ? `${each} × ${q} → 0 (не считать)` : `${each} × ${q} = ${counted}`}</strong></div>`; }).join("") : `<div class="cic-preview-extra-empty">Базы не выбраны.</div>`;
  const hardExtras = win.querySelector("[data-preview-hard-extras]");
  if (hardExtras) hardExtras.innerHTML = extras.length ? extras.map((entry,index)=>{ const q=Math.max(1,intValue(entry.quantity,1)); const each=Math.max(0,intValue(entry.hardCost,0)); const counted=entry.hard === "waived" ? 0 : each*q; return `<div class="cic-hard-line"><span>${esc(entry.name||`Компонент ${index+1}`)} × ${q}</span><strong>${entry.hard === "waived" ? `${each} × ${q} → 0 (не считать)` : `${each} × ${q} = ${counted}`}</strong></div>`; }).join("") : `<div class="cic-preview-extra-empty">Дополнительные компоненты не выбраны.</div>`;
  const totals = pktPreviewTotals(form);
  const totalStressFormula = stressVectorFormula(totals.totalStress);
  const stressTotal = win.querySelector("[data-preview-stress-total]"); if (stressTotal) stressTotal.textContent=totalStressFormula;
  const stressSummary = win.querySelector("[data-preview-stress-summary]");
  if (stressSummary) stressSummary.innerHTML = `<div><span>Базовый ПКТ</span><strong>${stressVectorFormula(totals.bodyStress)}</strong></div><div><span>Базы модели</span><strong>${stressVectorFormula(totals.baseStress)}</strong></div><div><span>Доп. компоненты</span><strong>${stressVectorFormula(totals.extraStress)}</strong></div><div class="cic-hard-total"><span>Общий Stress Cost</span><strong>${totalStressFormula}</strong></div>`;
  const stressBases = win.querySelector("[data-preview-stress-bases]");
  if (stressBases) stressBases.innerHTML = bases.length ? bases.map((entry,index)=>{ const q=Math.max(1,intValue(entry.quantity,1)); const formula=String(entry.stressFormula||"0"); const counted=entry.stress === "waived" ? "0 (не считать)" : stressVectorFormula(stressDiceVector(formula,q)); return `<div class="cic-hard-line"><span>${esc(entry.name||`База ${index+1}`)} × ${q}</span><strong>${esc(formula)} → ${esc(counted)}</strong></div>`; }).join("") : `<div class="cic-preview-extra-empty">Базы не выбраны.</div>`;
  const stressExtras = win.querySelector("[data-preview-stress-extras]");
  if (stressExtras) stressExtras.innerHTML = extras.length ? extras.map((entry,index)=>{ const q=Math.max(1,intValue(entry.quantity,1)); const formula=String(entry.stressFormula||"0"); const counted=entry.stress === "waived" ? "0 (не считать)" : stressVectorFormula(stressDiceVector(formula,q)); return `<div class="cic-hard-line"><span>${esc(entry.name||`Компонент ${index+1}`)} × ${q}</span><strong>${esc(formula)} → ${esc(counted)}</strong></div>`; }).join("") : `<div class="cic-preview-extra-empty">Дополнительные компоненты не выбраны.</div>`;

  const priceTotal = win.querySelector("[data-preview-price-total]"); if (priceTotal) priceTotal.textContent=totals.totalPrice.toLocaleString("ru-RU");
  const priceSummary = win.querySelector("[data-preview-price-summary]");
  if (priceSummary) priceSummary.innerHTML = `<div><span>Корпус / создаваемый ПКТ</span><strong>${totals.bodyPrice.toLocaleString("ru-RU")} эдди</strong></div><div><span>Базы модели</span><strong>${totals.basePrice.toLocaleString("ru-RU")} эдди</strong></div><div><span>Доп. компоненты</span><strong>${totals.extraPrice.toLocaleString("ru-RU")} эдди</strong></div><div><span>Комплект без корпуса</span><strong>${totals.kitPrice.toLocaleString("ru-RU")} эдди</strong></div><div class="cic-hard-total"><span>Полная стоимость ПКТ</span><strong>${totals.totalPrice.toLocaleString("ru-RU")} эдди</strong></div>`;
  const priceBases = win.querySelector("[data-preview-price-bases]");
  if (priceBases) priceBases.innerHTML = bases.length ? bases.map((entry,index)=>{ const q=Math.max(1,intValue(entry.quantity,1)); const each=Math.max(0,Number(entry.priceEddies)||0); return `<div class="cic-hard-line"><span>${esc(entry.name||`База ${index+1}`)} × ${q}</span><strong>${each.toLocaleString("ru-RU")} × ${q} = ${(each*q).toLocaleString("ru-RU")} эдди</strong></div>`; }).join("") : `<div class="cic-preview-extra-empty">Базы не выбраны.</div>`;
  const priceExtras = win.querySelector("[data-preview-price-extras]");
  if (priceExtras) priceExtras.innerHTML = extras.length ? extras.map((entry,index)=>{ const q=Math.max(1,intValue(entry.quantity,1)); const each=Math.max(0,Number(entry.priceEddies)||0); return `<div class="cic-hard-line"><span>${esc(entry.name||`Компонент ${index+1}`)} × ${q}</span><strong>${each.toLocaleString("ru-RU")} × ${q} = ${(each*q).toLocaleString("ru-RU")} эдди</strong></div>`; }).join("") : `<div class="cic-preview-extra-empty">Дополнительные компоненты не выбраны.</div>`;
  updateImagePreview(form);
}


function customPktModels() {
  try {
    const value = game.settings.get(PACKAGE_ID, "implantCreatorCustomPktModels");
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`${MODULE_ID} | custom PKT models parse failed`, error);
    return [];
  }
}

async function setCustomPktModels(models) {
  if (!game.user?.isGM) throw new Error("Только Мастер может изменять каталог пользовательских моделей ПКТ.");
  await game.settings.set(PACKAGE_ID, "implantCreatorCustomPktModels", JSON.stringify(models));
  Hooks.callAll(`${MODULE_ID}:pktModelsChanged`, models);
  refreshNativePktCatalogs();
}


function pktItemIdFromUuid(uuid) {
  const match = String(uuid ?? "").match(/\.Item\.([^\.]+)$/);
  return match?.[1] ?? "";
}

function pktQualityName(value) {
  return PKT_QUALITY_LABELS[Number(value ?? 0)] ?? String(value ?? 0);
}

function customPktModelKey(model) {
  return `cic-${String(model?.id ?? "model").replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

function normalizePktPrerequisiteEntry(entry, index = 0) {
  if (!entry || typeof entry !== "object") return null;
  const uuid = String(entry.uuid ?? entry.sourceUuid ?? "").trim();
  const itemId = String(entry.itemId ?? pktItemIdFromUuid(uuid)).trim();
  if (!itemId || entry.stress === "integrated") return null;
  return {
    key: String(entry.key ?? `component-${index + 1}`),
    componentKey: String(entry.componentKey ?? entry.key ?? `component-${index + 1}`),
    itemId,
    sourceUuid: uuid || null,
    name: String(entry.name ?? `Компонент ${itemId}`),
    img: entry.img ?? "icons/svg/item-bag.svg",
    quantity: Math.max(1, Number(entry.quantity ?? 1) || 1),
    stress: entry.stress === "waived" ? "waived" : "normal",
    hard: entry.hard === "waived" ? "waived" : "normal",
    hardCost: Number.isFinite(Number(entry.hardCost)) ? Math.max(0, intValue(entry.hardCost, 0)) : undefined,
    priceEddies: Number.isFinite(Number(entry.priceEddies ?? entry.price)) ? Math.max(0, Number(entry.priceEddies ?? entry.price) || 0) : undefined,
    family: entry.family ?? null,
    parentFamily: entry.parentFamily ?? null,
    internalSlots: Math.max(0,intValue(entry.internalSlots ?? entry.pktInternalSlots,0)),
    externalSlots: Math.max(0,intValue(entry.externalSlots ?? entry.pktExternalSlots,0)),
    componentQuality: Math.max(0,intValue(entry.componentQuality ?? entry.pktComponentQuality,0)),
    uniqueBase: entry.uniqueBase === true || entry.replaceableBase === false,
    replaceableBase: !(entry.uniqueBase === true || entry.replaceableBase === false) && (entry.replaceableBase === true || (["cyber-arm","cyber-leg","cyber-eye","cyber-audio","neural-link"].includes(entry.family) && !entry.parentFamily && entry.stress === "waived")),
    locked: typeof entry.locked === "boolean" ? entry.locked : entry.additional !== true,
    stressFormula: typeof entry.stressFormula === "string" ? entry.stressFormula : undefined,
    source: entry.source ? foundry.utils.deepClone(entry.source) : undefined,
    additional: entry.additional === true,
  };
}

function normalizePktChoiceDefinitions(choices = []) {
  const result = [];
  for (const [choiceIndex, raw] of (Array.isArray(choices) ? choices : []).entries()) {
    const itemIds = (raw.itemIds ?? []).map(String).filter(Boolean);
    const uuids = Array.isArray(raw.uuids) ? raw.uuids : [];
    const count = Math.max(1, Number(raw.choose ?? 1) || 1);
    // Remaster renders one select per choice. For choose > 1 create repeated selects.
    for (let slot = 0; slot < count; slot++) {
      const key = `${raw.key ?? `choice-${choiceIndex + 1}`}-${slot + 1}`;
      result.push({
        key,
        label: count > 1 ? `${raw.label ?? "Выбор"} ${slot + 1}` : (raw.label ?? "Выбор"),
        choose: 1,
        itemIds,
        sourceUuids: Object.fromEntries(itemIds.map((id, i) => [id, uuids[i] ?? null])),
        stress: raw.stress === "waived" ? "waived" : "normal",
        family: raw.family ?? null,
        parentFamily: raw.parentFamily ?? null,
        locked: raw.locked !== false,
        replaceableBase: raw.replaceableBase === true,
      });
    }
  }
  return result;
}

function pktCompositionPriceFromData(data) {
  const bases = normalizePktBaseComponents(data?.pktModelBaseComponents ?? (() => { try { return JSON.parse(String(data?.pktModelBaseComponentsJson ?? "[]")); } catch { return []; } })());
  const extras = normalizePktExtraComponents(data?.pktModelExtraComponents ?? (() => { try { return JSON.parse(String(data?.pktModelExtraComponentsJson ?? "[]")); } catch { return []; } })());
  const basePrice = bases.reduce((sum, entry) => sum + Math.max(0, Number(entry.priceEddies) || 0) * Math.max(1, intValue(entry.quantity, 1)), 0);
  const extraPrice = extras.reduce((sum, entry) => sum + Math.max(0, Number(entry.priceEddies) || 0) * Math.max(1, intValue(entry.quantity, 1)), 0);
  return Math.max(0, Math.trunc(basePrice + extraPrice));
}

function pktModelConfiguredPrice(data) {
  if (data?.pktModelAutoPrice === true) return pktCompositionPriceFromData(data);
  if (data && Object.prototype.hasOwnProperty.call(data, "pktModelPrice")) return Math.max(0, Number(data.pktModelPrice) || 0);
  return Math.max(0, Number(data?.priceEddies ?? 0) || 0);
}

function pktModelFromPrerequisites(data, created = null) {
  const prerequisites = Array.isArray(data?.pktPrerequisites) ? data.pktPrerequisites : [];
  const components = prerequisites.map(normalizePktPrerequisiteEntry).filter(Boolean);
  const rawChoices = Array.isArray(data?.pktPrerequisiteChoices) ? foundry.utils.deepClone(data.pktPrerequisiteChoices) : [];
  if (!components.length && !rawChoices.length) return null;
  return {
    id: pktModelId(),
    manufacturer: data.pktModelManufacturer || "CIC / пользовательская ПКТ",
    name: data.pktModelName || String(data.name ?? created?.name ?? "ПКТ").replace(/^ПКТ\s*[«\"]?|[»\"]$/g, "").trim(),
    minimumQuality: Number(data.pktModelMinimumQuality ?? data.pktQuality ?? 0) || 0,
    priceEddies: pktModelConfiguredPrice(data),
    components,
    prerequisiteChoices: rawChoices,
    createdAt: Date.now(),
    createdBy: game.user?.id ?? null,
    sourceItemUuid: created?.uuid ?? null,
    sourceBodyName: created?.name ?? data.name ?? null,
    creatorVersion: MODULE_VERSION,
    nativePktModel: true,
  };
}

async function resolvePktSourceDocument(entry) {
  const candidates = [entry?.sourceUuid, entry?.uuid].filter(Boolean);
  for (const uuid of candidates) {
    try {
      const doc = await fromUuid(uuid);
      if (doc?.documentName === "Item" || doc?.toObject) return doc;
    } catch {}
  }
  const itemId = String(entry?.itemId ?? "");
  if (itemId) {
    for (const packId of ["sf2e-cyberware-pkt.cyberpunk-items", "cyberpunk-remaster.cyberpunk-items"]) {
      try {
        const doc = await game.packs.get(packId)?.getDocument(itemId);
        if (doc) return doc;
      } catch {}
    }
    for (const pack of game.packs.filter((candidate) => candidate.documentName === "Item" && candidate.metadata?.name === "cyberpunk-items")) {
      try {
        const doc = await pack.getDocument(itemId);
        if (doc) return doc;
      } catch {}
    }
  }
  if (entry?.source) {
    const snapshot = foundry.utils.deepClone(entry.source);
    return {
      name: snapshot.name ?? entry.name,
      img: snapshot.img ?? entry.img,
      flags: snapshot.flags ?? {},
      system: snapshot.system ?? {},
      toObject: () => foundry.utils.deepClone(snapshot),
    };
  }
  return null;
}

async function nativePktModelFromStored(model, CyberwareTab = null) {
  const quality = Number(model.minimumQuality ?? model.bodyQuality ?? 0) || 0;
  const rawComponents = [
    ...(Array.isArray(model.components) ? model.components : []),
    ...(Array.isArray(model.additionalComponents) ? model.additionalComponents.map((entry)=>({ ...entry, additional:true })) : []),
  ];
  const components = [];
  for (const [index, raw] of rawComponents.entries()) {
    const entry = normalizePktPrerequisiteEntry(raw, index) ?? (() => {
      const uuid = raw?.uuid ?? raw?.sourceUuid ?? "";
      const itemId = (raw?.itemId ?? pktItemIdFromUuid(uuid)) || `cic-${model.id}-${index + 1}`;
      return {
        key: `component-${index + 1}`, componentKey: `component-${index + 1}`, itemId,
        sourceUuid: uuid || null, name: raw?.name ?? `Компонент ${index + 1}`, img: raw?.img,
        quantity: Math.max(1, Number(raw?.quantity ?? 1) || 1), stress: raw?.stress === "waived" ? "waived" : "normal", hard: raw?.hard === "waived" ? "waived" : "normal",
        hardCost: Number.isFinite(Number(raw?.hardCost)) ? Math.max(0, intValue(raw.hardCost, 0)) : undefined,
        stressFormula: typeof raw?.stressFormula === "string" ? raw.stressFormula : undefined,
        priceEddies: Number.isFinite(Number(raw?.priceEddies ?? raw?.price)) ? Math.max(0, Number(raw?.priceEddies ?? raw?.price) || 0) : undefined,
        family: raw?.family ?? null, parentFamily: raw?.parentFamily ?? null,
        internalSlots: Math.max(0,intValue(raw?.internalSlots ?? raw?.pktInternalSlots,0)), externalSlots: Math.max(0,intValue(raw?.externalSlots ?? raw?.pktExternalSlots,0)), componentQuality: Math.max(0,intValue(raw?.componentQuality ?? raw?.pktComponentQuality,0)),
        uniqueBase: raw?.uniqueBase === true || raw?.replaceableBase === false,
        replaceableBase: !(raw?.uniqueBase === true || raw?.replaceableBase === false) && raw?.replaceableBase === true, locked: typeof raw?.locked === "boolean" ? raw.locked : raw?.additional !== true,
        source: raw?.source ? foundry.utils.deepClone(raw.source) : undefined,
      };
    })();
    const doc = await resolvePktSourceDocument(entry);
    if (doc) {
      entry.name = entry.name || doc.name || `Компонент ${index + 1}`;
      entry.img = entry.img || doc.img;
      if (!Number.isFinite(Number(entry.hardCost))) entry.hardCost = pktHardCostFromDocument(doc);
      if (!Number.isFinite(Number(entry.priceEddies))) entry.priceEddies = pktPriceFromDocument(doc);
      if (!String(entry.stressFormula ?? "").trim()) {
        try {
          const formula = CyberwareTab?.getStressFormula?.(doc) ?? pktStressFromDocument(doc);
          if (formula) entry.stressFormula = formula;
        } catch { entry.stressFormula = pktStressFromDocument(doc); }
      }
    }
    if (!String(entry.stressFormula ?? "").trim()) entry.stressFormula = "0";
    components.push(entry);
  }

  const storedChoices = model.prerequisiteChoices ?? (model.choice?.options?.length ? [{
    label: model.choice.label ?? "Выбор", choose: 1,
    itemIds: model.choice.options.map((option) => option.itemId ?? pktItemIdFromUuid(option.uuid)),
    uuids: model.choice.options.map((option) => option.uuid ?? option.sourceUuid ?? null),
  }] : []);
  const choices = normalizePktChoiceDefinitions(storedChoices);
  for (const choice of choices) {
    choice.options = [];
    for (const itemId of choice.itemIds) {
      const sourceUuid = choice.sourceUuids?.[itemId] ?? null;
      const doc = await resolvePktSourceDocument({ itemId, sourceUuid });
      const option = { itemId, name: doc?.name ?? `Предмет ${itemId}`, img: doc?.img ?? "icons/svg/item-bag.svg", sourceUuid };
      try {
        const formula = CyberwareTab?.getStressFormula?.(doc);
        if (formula) option.stressFormula = formula;
      } catch {}
      choice.options.push(option);
    }
  }

  return {
    ...model,
    __cicCustom: true,
    key: customPktModelKey(model),
    name: pktModelDisplayName(model),
    requiredBodyId: model.requiredBodyId || `cic-quality-${quality}`,
    requiredBodyName: `Полная Конверсия Тела [${pktQualityName(quality)}]`,
    bodyQuality: quality,
    priceEddies: Math.max(0, Number(model.priceEddies ?? model.pktModelPrice ?? model.price ?? 0) || 0),
    unique: [],
    components,
    choices,
  };
}

function setPktSourceHardCost(source, value) {
  source.flags ??= {};
  const existingId = REMASTER_IDS.find((id)=>source.flags?.[id]) ?? activeRemasterId();
  source.flags[existingId] ??= {};
  source.flags[existingId].hardCost = Math.max(0,intValue(value,0));
  const html = String(source.system?.description?.value ?? "");
  if (html) {
    source.system ??= {}; source.system.description ??= {};
    source.system.description.value = html
      .replace(/(<strong>\s*Hard\s*Cost\s*:\s*<\/strong>\s*)\d+/iu, (_m,prefix)=>`${prefix}${Math.max(0,intValue(value,0))}`)
      .replace(/(Hard\s*Cost\s*:?\s*)\d+/iu, (_m,prefix)=>`${prefix}${Math.max(0,intValue(value,0))}`);
  }
}


function setPktSourceStressFormula(source, value) {
  let formula = "0";
  try { formula = normalizeStress(String(value ?? "0")).formula; }
  catch { formula = String(value ?? "0").trim() || "0"; }
  source.flags ??= {};
  const existingId = REMASTER_IDS.find((id)=>source.flags?.[id]) ?? activeRemasterId();
  source.flags[existingId] ??= {};
  source.flags[existingId].stressFormula = formula;
  source.system ??= {};
  source.system.description ??= { value:"" };
  const html = String(source.system.description.value ?? "");
  const rendered = formula === "0" ? "0" : `[[/r ${formula} #Потеря Человечности]]`;
  if (html) {
    let changed = false;
    const next = html
      .replace(/(<strong>\s*Stress\s*Cost\s*:\s*<\/strong>\s*)(?:\[\[\/r\s*)?(?:(?:\d*d(?:4|6))(?:\s*\+\s*\d*d(?:4|6))*|0)(?:[^\]]*\]\])?/iu, (_m,prefix)=>{ changed=true; return `${prefix}${rendered}`; })
      .replace(/(Stress\s*Cost\s*:?\s*)(?:\[\[\/r\s*)?(?:(?:\d*d(?:4|6))(?:\s*\+\s*\d*d(?:4|6))*|0)(?:[^\]]*\]\])?/iu, (_m,prefix)=>{ changed=true; return `${prefix}${rendered}`; });
    source.system.description.value = changed ? next : `${html}\n<p><strong>Stress Cost:</strong> ${rendered}</p>`;
  }
  return formula;
}

function setPktSourcePriceEddies(source, value) {
  const price = Math.max(0, Math.trunc(Number(value) || 0));
  source.system ??= {};
  source.system.price ??= {};
  const oldValue = source.system.price.value;
  source.system.price.value = (oldValue && typeof oldValue === "object" && !Array.isArray(oldValue))
    ? { ...oldValue, sp: price }
    : { sp: price };
  source.flags ??= {};
  const existingId = REMASTER_IDS.find((id)=>source.flags?.[id]) ?? activeRemasterId();
  source.flags[existingId] ??= {};
  source.flags[existingId].priceEddies = price;
  return price;
}

function mergeCustomPktPlanPolicy(plan, model) {
  const definitions = [
    ...(Array.isArray(model?.components) ? model.components : []),
    ...(Array.isArray(model?.additionalComponents) ? model.additionalComponents : []),
  ];
  const byComponentKey = new Map();
  const byKey = new Map();
  const byItemId = new Map();
  for (const entry of definitions) {
    if (entry?.componentKey) byComponentKey.set(String(entry.componentKey), entry);
    if (entry?.key) byKey.set(String(entry.key), entry);
    if (entry?.itemId && !byItemId.has(String(entry.itemId))) byItemId.set(String(entry.itemId), entry);
  }
  return (Array.isArray(plan) ? plan : []).map((entry) => {
    const configured = byComponentKey.get(String(entry?.componentKey ?? ""))
      ?? byKey.get(String(entry?.key ?? ""))
      ?? byItemId.get(String(entry?.itemId ?? ""));
    if (!configured) return entry;
    return {
      ...entry,
      hard: configured.hard === "waived" ? "waived" : "normal",
      hardCost: Number.isFinite(Number(configured.hardCost)) ? Math.max(0, intValue(configured.hardCost, 0)) : entry.hardCost,
      stress: configured.stress === "waived" ? "waived" : "normal",
      stressFormula: String(configured.stressFormula ?? entry.stressFormula ?? "0").trim() || "0",
      priceEddies: Number.isFinite(Number(configured.priceEddies)) ? Math.max(0, Number(configured.priceEddies) || 0) : entry.priceEddies,
      family: configured.family ?? entry.family,
      parentFamily: configured.parentFamily ?? entry.parentFamily,
      internalSlots: configured.internalSlots ?? entry.internalSlots,
      externalSlots: configured.externalSlots ?? entry.externalSlots,
      componentQuality: configured.componentQuality ?? entry.componentQuality,
      uniqueBase: configured.uniqueBase ?? entry.uniqueBase,
      replaceableBase: configured.replaceableBase ?? entry.replaceableBase,
      locked: typeof configured.locked === "boolean" ? configured.locked : entry.locked,
      detachable: typeof configured.detachable === "boolean" ? configured.detachable : entry.detachable,
    };
  });
}

function applyCustomPktComponentPolicy(source, entry) {
  source.flags ??= {};
  const existingId = REMASTER_IDS.find((id)=>source.flags?.[id]) ?? activeRemasterId();
  source.flags[existingId] ??= {};
  const flags = source.flags[existingId];

  flags.pktHardMode = entry?.hard === "waived" ? "waived" : "normal";
  flags.pktStressMode = entry?.stress === "waived" ? "waived" : "normal";
  flags.pktLocked = entry?.locked !== false;
  if (entry?.family) flags.pktFamily = entry.family;
  if (entry?.parentFamily) flags.pktParentFamily = entry.parentFamily;
  if (!entry?.parentFamily) {
    flags.pktInternalSlots = Math.max(0,intValue(entry?.internalSlots,0));
    flags.pktExternalSlots = Math.max(0,intValue(entry?.externalSlots,0));
    if (entry?.componentQuality !== undefined) flags.pktComponentQuality = Math.max(0,intValue(entry.componentQuality,0));
    const uniqueBase = entry?.uniqueBase === true || entry?.replaceableBase === false;
    flags.pktUniqueBase = uniqueBase;
    flags.pktReplaceableBase = uniqueBase ? false : entry?.replaceableBase === true;
    if (uniqueBase) flags.pktReplaceable = false;
  }

  // v1.13.24: значения модели являются источником истины при установке.
  // Не позволяем исходному Item из Compendium повторно вернуть свой Hard/Stress/price.
  const sourceHard = pktHardCostFromSource(source);
  const configuredHard = entry?.hard === "waived"
    ? 0
    : (Number.isFinite(Number(entry?.hardCost)) ? Math.max(0,intValue(entry.hardCost,0)) : sourceHard);
  flags.pktOriginalHardCost = sourceHard;
  flags.pktConfiguredHardCost = configuredHard;
  setPktSourceHardCost(source, configuredHard);

  let sourceStress = "0";
  try { sourceStress = normalizeStress(parseTemplateMetadata(source, existingId).stressFormula ?? "0").formula; } catch {}
  const configuredStress = entry?.stress === "waived"
    ? "0"
    : (String(entry?.stressFormula ?? sourceStress ?? "0").trim() || "0");
  flags.pktOriginalStressFormula = sourceStress;
  flags.pktConfiguredStressFormula = configuredStress;
  setPktSourceStressFormula(source, configuredStress);

  const sourcePrice = Math.max(0, Number(source?.system?.price?.value?.sp ?? flags.priceEddies ?? 0) || 0);
  const configuredPrice = Number.isFinite(Number(entry?.priceEddies))
    ? Math.max(0, Number(entry.priceEddies) || 0)
    : sourcePrice;
  flags.pktOriginalPriceEddies = sourcePrice;
  flags.pktConfiguredPriceEddies = configuredPrice;
  setPktSourcePriceEddies(source, configuredPrice);

  return source;
}


function customPktPolicyDocumentView(document, entry) {
  const base = document?.toObject?.() ?? document?._source ?? document ?? {};
  const source = applyCustomPktComponentPolicy(foundry.utils.deepClone(base), entry);
  return {
    documentName: "Item",
    id: document?.id ?? source?._id ?? null,
    name: source?.name ?? document?.name ?? entry?.name ?? "Компонент ПКТ",
    img: source?.img ?? document?.img ?? "icons/svg/item-bag.svg",
    type: source?.type ?? document?.type ?? "equipment",
    flags: source?.flags ?? {},
    system: source?.system ?? {},
    _source: source,
    toObject: () => foundry.utils.deepClone(source),
    getFlag: (scope, key) => source?.flags?.[scope]?.[key],
  };
}

function customPktModelBody(actor, model) {
  const minimumQuality = Math.max(0, Number(model?.bodyQuality ?? model?.minimumQuality ?? 0) || 0);
  return actorPktBodyState(actor, minimumQuality).body ?? null;
}

function customPktModelValidation(actor, model) {
  if (!actor) return "Персонаж не найден.";
  const minimumQuality = Math.max(0, Number(model?.bodyQuality ?? model?.minimumQuality ?? 0) || 0);
  const state = actorPktBodyState(actor, minimumQuality);
  if (!state.ok) return state.reason || "Не найден подходящий корпус Полной Конверсии Тела.";
  const key = String(model?.key ?? customPktModelKey(model));
  const installed = [...(actor.items ?? [])].filter((item) => {
    const C = getNativePktCyberwareTab();
    const itemKey = String(C?.getFlag?.(item, "pktModelKey") ?? pktFlagsOf(item)?.pktModelKey ?? "");
    return itemKey === key;
  });
  // Уже установленная модель не является ошибкой для рендера каталога: Remaster сам покажет демонтаж.
  if (installed.length) return "";
  const componentCount = (Array.isArray(model?.components) ? model.components.reduce((sum, entry) => sum + Math.max(1, Number(entry?.quantity ?? 1) || 1), 0) : 0);
  const choiceCount = Array.isArray(model?.choices) ? model.choices.length : 0;
  if (componentCount + choiceCount <= 0) return "Комплектация модели ПКТ пуста.";
  return "";
}

function sanitizeCustomPktEmbeddedSource(source) {
  const cleaned = foundry.utils.deepClone(source ?? {});
  // Embedded Item creation must not inherit document identity / compendium metadata
  // from a world Item, compendium Item or a serialized snapshot. PF2e validates
  // _stats.compendiumSource strictly and rejects stale/partial IDs.
  delete cleaned._id;
  delete cleaned.folder;
  delete cleaned.ownership;
  delete cleaned.sort;
  delete cleaned._stats;
  return cleaned;
}

async function installCustomPktViaNative(CyberwareTab, actor, model, selections = {}) {
  const validation = customPktModelValidation(actor, model);
  if (validation) throw new Error(validation);
  const body = customPktModelBody(actor, model);
  if (!body) throw new Error("Не найден подходящий установленный корпус ПКТ.");
  const nativePlan = CyberwareTab.pktInstallationPlan(model, selections);
  const plan = mergeCustomPktPlanPolicy(nativePlan, model);
  if (!plan.length) throw new Error("Комплектация модели ПКТ пуста.");

  const sourcePairs = await Promise.all(plan.map(async (entry) => [entry.itemId, await resolvePktSourceDocument(entry)]));
  const sources = new Map(sourcePairs);
  const missing = sourcePairs.find(([, doc]) => !doc);
  if (missing) throw new Error(`Не найден компонент ПКТ ${missing[0]}. Проверьте, что Cyberpunk Remaster / SF2E — Импланты и ПКТ активен.`);
  let humanityLossSummary;
  try {
    const configuredSources = new Map(sourcePairs.map(([itemId, doc]) => {
      const entry = plan.find((row)=>String(row?.itemId ?? "") === String(itemId ?? ""));
      return [itemId, entry ? customPktPolicyDocumentView(doc, entry) : doc];
    }));
    humanityLossSummary = CyberwareTab.pktHumanityLossSummary(plan, configuredSources);
  } catch (error) {
    console.warn(`${MODULE_ID} | не удалось посчитать Stress по переопределённым значениям; используется нативный fallback`, error);
    humanityLossSummary = CyberwareTab.pktHumanityLossSummary(plan, sources);
  }
  const beforeIds = new Set([...actor.items].map((item) => item.id));
  let created = [];
  try {
    const createData = plan.map((entry) => {
      const doc = sources.get(entry.itemId);
      const prepared = applyCustomPktComponentPolicy(CyberwareTab.pktItemSource(doc, model, entry, body), entry);
      return sanitizeCustomPktEmbeddedSource(prepared);
    });
    const capacityError = validateProjectedImplantCapacity(actor, createData);
    if (capacityError) throw new Error(capacityError);
    created = await actor.createEmbeddedDocuments("Item", createData, { cyberpunkRemasterModelOperation: true });
    if (created.length !== createData.length || created.some((item) => !CyberwareTab.isInstalled(item))) {
      throw new Error("Foundry создал не все компоненты модели в установленном состоянии.");
    }
    const linkUpdates = CyberwareTab.pktModuleLinkUpdates(created);
    if (linkUpdates.length) await actor.updateEmbeddedDocuments("Item", linkUpdates, { cyberpunkRemasterModelOperation: true });
    await CyberwareTab.reconcileHumanity(actor);
    await CyberwareTab.reconcileGrantedItems(actor);
  } catch (error) {
    const rollbackIds = new Set(created.map((item) => item.id));
    for (const item of actor.items) {
      if (!beforeIds.has(item.id) && CyberwareTab.getFlag(item, "pktModelKey") === model.key) rollbackIds.add(item.id);
    }
    if (rollbackIds.size) {
      try { await actor.deleteEmbeddedDocuments("Item", [...rollbackIds], { cyberpunkRemasterModelOperation: true }); } catch {}
    }
    throw error;
  }
  return { created, humanityLoss: humanityLossSummary };
}

const CIC_REPLACEMENT_PREFIX = "cic-world-base:";
const CIC_MODEL_REPLACEMENT_PREFIX = "cic-model-base:";

function pktReplacementSnapshotFlag(entry, key) {
  const source = entry?.source ?? null;
  const flags = source?.flags ?? {};
  for (const id of REMASTER_IDS) {
    if (flags?.[id] && Object.prototype.hasOwnProperty.call(flags[id],key)) return flags[id][key];
  }
  return undefined;
}

function pktReplacementEntrySlots(entry, CyberwareTab = getNativePktCyberwareTab()) {
  if (Number.isFinite(Number(entry?.slots))) return Math.max(0,intValue(entry.slots,0));
  const flagged = pktReplacementSnapshotFlag(entry,"slots");
  if (flagged !== undefined) return Math.max(0,intValue(flagged,0));
  try {
    const value = CyberwareTab?.getSlots?.(entry?.source);
    if (Number.isFinite(Number(value))) return Math.max(0,intValue(value,0));
  } catch {}
  try { return Math.max(0,intValue(parseTemplateMetadata(entry?.source ?? {},activeRemasterId()).slots,0)); } catch {}
  return 0;
}

function customPktReplacementBaseDocuments(CyberwareTab = getNativePktCyberwareTab()) {
  if (!CyberwareTab) return [];
  return [...(game.items ?? [])].filter((item) => {
    const createdByCreator = !!item?.flags?.[MODULE_ID]?.createdWith;
    if (!createdByCreator) return false;
    if (CyberwareTab.getImplantType?.(item) !== "base") return false;
    if (CyberwareTab.getFlag?.(item,"pktUniqueBase") === true) return false;
    if (CyberwareTab.getFlag?.(item,"pktReplaceableBase") === false) return false;
    const family = CyberwareTab.getFlag?.(item,"pktFamily");
    return !!family;
  });
}

function customPktStoredReplacementEntries(CyberwareTab = getNativePktCyberwareTab()) {
  const rows = [];
  for (const model of customPktModels()) {
    const bases = Array.isArray(model?.baseComponents) && model.baseComponents.length
      ? model.baseComponents
      : (Array.isArray(model?.components) ? model.components.filter((entry)=>!entry?.parentFamily && (entry?.replaceableBase === true || entry?.uniqueBase !== true)) : []);
    bases.forEach((entry,index) => {
      const family = String(entry?.family ?? pktReplacementSnapshotFlag(entry,"pktFamily") ?? "").trim();
      const uniqueBase = entry?.uniqueBase === true || entry?.replaceableBase === false || pktReplacementSnapshotFlag(entry,"pktUniqueBase") === true;
      if (!family || uniqueBase) return;
      const quality = Math.max(0,intValue(entry?.componentQuality ?? pktReplacementSnapshotFlag(entry,"pktComponentQuality") ?? pktReplacementSnapshotFlag(entry,"pktQuality"),0));
      const internalSlots = Math.max(0,intValue(entry?.internalSlots ?? pktReplacementSnapshotFlag(entry,"pktInternalSlots"),0));
      const externalSlots = Math.max(0,intValue(entry?.externalSlots ?? pktReplacementSnapshotFlag(entry,"pktExternalSlots"),0));
      const sourceUuid = String(entry?.uuid ?? entry?.sourceUuid ?? "").trim();
      rows.push({
        itemId:`${CIC_MODEL_REPLACEMENT_PREFIX}${encodeURIComponent(String(model.id ?? customPktModelKey(model)))}:${index}`,
        sourceUuid:sourceUuid || null,
        name:String(entry?.name ?? `База ${index+1}`),
        img:entry?.img ?? "icons/svg/item-bag.svg",
        family, quality, replaceable:true,
        slots:pktReplacementEntrySlots(entry,CyberwareTab),
        internalSlots, externalSlots,
        implantType:"base",
        modelId:String(model.id ?? ""), componentIndex:index,
        __cicCustomReplacement:true, __cicStoredModelBase:true,
      });
    });
  }
  return rows;
}

function customPktReplacementCatalogEntries(CyberwareTab = getNativePktCyberwareTab()) {
  if (!CyberwareTab) return [];
  const world = customPktReplacementBaseDocuments(CyberwareTab).map((item) => ({
    itemId: `${CIC_REPLACEMENT_PREFIX}${item.uuid}`,
    sourceUuid: item.uuid,
    name: item.name,
    img: item.img,
    family: CyberwareTab.getFlag?.(item,"pktFamily") ?? null,
    quality: Number(CyberwareTab.getFlag?.(item,"pktComponentQuality") ?? CyberwareTab.getFlag?.(item,"pktQuality") ?? 0),
    replaceable: true,
    slots: CyberwareTab.getSlots?.(item) ?? 0,
    internalSlots: Math.max(0,intValue(CyberwareTab.getFlag?.(item,"pktInternalSlots"),0)),
    externalSlots: Math.max(0,intValue(CyberwareTab.getFlag?.(item,"pktExternalSlots"),0)),
    implantType: "base",
    __cicCustomReplacement: true,
    __cicWorldBase:true,
  }));
  const combined = [...world, ...customPktStoredReplacementEntries(CyberwareTab)];
  const result = [];
  const seen = new Set();
  for (const entry of combined) {
    const key = `${entry.family}|${entry.sourceUuid || entry.name}|${entry.quality}|${entry.slots}|${entry.internalSlots}|${entry.externalSlots}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function customPktReplacementDocument(sourceDocument, entry, idHint = "") {
  const source = foundry.utils.deepClone(sourceDocument?.toObject?.() ?? entry?.source ?? {});
  const rawId = String(sourceDocument?.id ?? sourceDocument?._id ?? entry?.itemId ?? idHint ?? "");
  const validId = /^[A-Za-z0-9]{16}$/.test(rawId) ? rawId : (globalThis.foundry?.utils?.randomID?.(16) ?? "CICBase0000000001");
  source._id = validId;
  source.flags ??= {};
  const namespace = REMASTER_IDS.find((id)=>source.flags?.[id]) ?? activeRemasterId();
  source.flags[namespace] ??= {};
  const flags = source.flags[namespace];
  flags.cyberware = true;
  flags.implantType = "base";
  flags.pktFamily = entry?.family ?? flags.pktFamily ?? null;
  flags.pktReplaceable = true;
  flags.pktReplaceableBase = true;
  flags.pktUniqueBase = false;
  flags.pktComponentQuality = Math.max(0,intValue(entry?.quality ?? entry?.componentQuality ?? flags.pktComponentQuality ?? flags.pktQuality,0));
  flags.slots = Math.max(0,intValue(entry?.slots ?? flags.slots,0));
  flags.pktInternalSlots = Math.max(0,intValue(entry?.internalSlots ?? flags.pktInternalSlots,0));
  flags.pktExternalSlots = Math.max(0,intValue(entry?.externalSlots ?? flags.pktExternalSlots,0));
  const traits = Array.isArray(source?.system?.traits?.value) ? source.system.traits.value : [];
  return {
    id:validId, _id:validId, documentName:"Item",
    name:sourceDocument?.name ?? entry?.name ?? source?.name ?? "Пользовательская база",
    img:sourceDocument?.img ?? entry?.img ?? source?.img ?? "icons/svg/item-bag.svg",
    flags:source.flags,
    system:source.system ?? {},
    traits:{ has:(slug)=>traits.includes(slug) },
    toObject:()=>foundry.utils.deepClone(source),
  };
}

async function resolveCustomPktReplacement(value) {
  const raw = String(value ?? "");
  if (raw.startsWith(CIC_REPLACEMENT_PREFIX)) {
    const uuid = raw.slice(CIC_REPLACEMENT_PREFIX.length);
    if (!uuid) return null;
    try {
      const doc = await fromUuid(uuid);
      if (!doc) return null;
      const C = getNativePktCyberwareTab();
      const entry = customPktReplacementCatalogEntries(C).find((candidate)=>candidate.itemId===raw) ?? {
        family:C?.getFlag?.(doc,"pktFamily"), quality:C?.getFlag?.(doc,"pktComponentQuality") ?? 0, slots:C?.getSlots?.(doc) ?? 0,
        internalSlots:C?.getFlag?.(doc,"pktInternalSlots") ?? 0, externalSlots:C?.getFlag?.(doc,"pktExternalSlots") ?? 0,
      };
      return customPktReplacementDocument(doc,entry,doc.id);
    } catch { return null; }
  }
  if (raw.startsWith(CIC_MODEL_REPLACEMENT_PREFIX)) {
    const payload = raw.slice(CIC_MODEL_REPLACEMENT_PREFIX.length);
    const split = payload.lastIndexOf(":");
    if (split < 0) return null;
    const modelId = decodeURIComponent(payload.slice(0,split));
    const index = Math.max(0,intValue(payload.slice(split+1),0));
    const model = customPktModels().find((entry)=>String(entry?.id ?? customPktModelKey(entry))===modelId);
    if (!model) return null;
    const bases = Array.isArray(model.baseComponents) && model.baseComponents.length ? model.baseComponents : (Array.isArray(model.components) ? model.components.filter((entry)=>!entry?.parentFamily) : []);
    const base = bases[index];
    if (!base) return null;
    const catalogEntry = customPktReplacementCatalogEntries(getNativePktCyberwareTab()).find((entry)=>entry.itemId===raw) ?? base;
    const doc = await resolvePktSourceDocument(base);
    return customPktReplacementDocument(doc, { ...base, ...catalogEntry }, base.itemId);
  }
  return null;
}

function enhanceNativeCustomPktReplacementSelects(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  const C = getNativePktCyberwareTab();
  if (!C) return;
  const actor = app?.actor ?? app?.document ?? app?.object ?? null;
  if (!actor?.items) return;
  for (const select of root.querySelectorAll(".cw-pkt-base-replace")) {
    for (const option of select.options ?? []) {
      const value = String(option.value ?? "");
      if (!(value.startsWith(CIC_REPLACEMENT_PREFIX) || value.startsWith(CIC_MODEL_REPLACEMENT_PREFIX)) || option.dataset.cicCapacityLabel === "true") continue;
      const catalog = customPktReplacementCatalogEntries(C);
      const info = catalog.find((entry)=>entry.itemId===value);
      if (info) { option.textContent = `${info.name} · ${info.slots} сл`; option.dataset.cicCapacityLabel = "true"; }
    }
    if (select.dataset.cicReplacementHandler === "true") continue;
    select.dataset.cicReplacementHandler = "true";
    select.addEventListener("change", (event) => {
      const value = String(event.currentTarget.value ?? "");
      if (!(value.startsWith(CIC_REPLACEMENT_PREFIX) || value.startsWith(CIC_MODEL_REPLACEMENT_PREFIX))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.currentTarget.value = "";
      void (async () => {
        const replacement = await resolveCustomPktReplacement(value);
        if (!replacement) throw new Error("Пользовательская база для замены не найдена в Items мира.");
        const base = actor.items.get?.(select.dataset.itemId) ?? [...actor.items].find((item)=>item.id===select.dataset.itemId);
        if (!base) throw new Error("Заменяемая база ПКТ не найдена.");
        const validation = C.pktBaseReplacementValidation?.(actor,base,replacement);
        if (validation) throw new Error(validation);
        const confirmed = await C.confirmDialog?.({
          title:"Заменить базу ПКТ",
          content:C.pktBaseReplacementConfirmationContent?.(base,replacement,actor) ?? `<p>Заменить <strong>${esc(base.name)}</strong> на <strong>${esc(replacement.name)}</strong>?</p>`,
        });
        if (confirmed === false) return;
        const result = await C.replacePktBase(actor,base,replacement.id,{sourceDocument:replacement});
        ui.notifications.info(`«${base.name}» заменена на «${result.replacement.name}». Перенесено модулей: ${result.transferredModules}.`);
        try { app?.render?.(false); } catch {}
      })().catch((error)=>ui.notifications.error(error.message ?? String(error)));
    }, true);
  }
}

function directRemasterFlag(source, key) {
  const flags = source?.flags ?? source?._source?.flags ?? {};
  for (const id of REMASTER_IDS) {
    if (flags?.[id] && Object.prototype.hasOwnProperty.call(flags[id], key)) return flags[id][key];
  }
  return undefined;
}

function implantTypeFromLike(source, CyberwareTab = getNativePktCyberwareTab()) {
  try {
    const type = CyberwareTab?.getImplantType?.(source);
    if (type) return String(type);
  } catch {}
  const flagged = directRemasterFlag(source, "implantType");
  return flagged ? String(flagged) : "";
}

function installedStateFromLike(source, CyberwareTab = getNativePktCyberwareTab()) {
  try {
    if (source?.documentName === "Item" && typeof CyberwareTab?.isInstalled === "function") return CyberwareTab.isInstalled(source) === true;
  } catch {}
  const installed = directRemasterFlag(source, "installed");
  if (typeof installed === "boolean") return installed;
  return String(source?.system?.equipped?.carryType ?? source?._source?.system?.equipped?.carryType ?? "") === "implanted";
}

function actorHasInstalledPktBody(actor, CyberwareTab = getNativePktCyberwareTab()) {
  if (!actor?.items) return false;
  return [...actor.items].some((item) => directRemasterFlag(item, "pktBody") === true && installedStateFromLike(item, CyberwareTab));
}

function actorGlobalImplantLimit(actor, type) {
  if (!['internal','external','fashion'].includes(type)) return Infinity;
  const CyberwareTab = getNativePktCyberwareTab();
  try {
    const native = CyberwareTab?.implantCapacity?.(actor, type);
    if (Number.isFinite(native?.limit)) return native.limit;
  } catch {}
  const limits = actorHasInstalledPktBody(actor, CyberwareTab)
    ? GLOBAL_IMPLANT_LIMITS.pkt
    : GLOBAL_IMPLANT_LIMITS.standard;
  return limits[type];
}

function installedImplantCount(actor, type, { excludeItemId = null } = {}) {
  if (!actor?.items || !['internal','external','fashion'].includes(type)) return 0;
  const CyberwareTab = getNativePktCyberwareTab();
  try {
    const native = CyberwareTab?.implantCapacity?.(actor, type, { excludeItemId });
    if (Number.isFinite(native?.used)) return native.used;
  } catch {}
  let count = 0;
  for (const item of actor.items) {
    if (excludeItemId && item.id === excludeItemId) continue;
    if (implantTypeFromLike(item, CyberwareTab) !== type || !installedStateFromLike(item, CyberwareTab)) continue;
    const quantity = Math.max(1, Number(item?.system?.quantity ?? 1) || 1);
    count += quantity;
  }
  return count;
}

function proposedFlagChange(changes, key) {
  for (const id of REMASTER_IDS) {
    const flags = changes?.flags?.[id];
    if (flags && Object.prototype.hasOwnProperty.call(flags, key)) return { found:true, value:flags[key] };
  }
  return { found:false, value:undefined };
}

function proposedInstalledState(item, changes) {
  const flag = proposedFlagChange(changes, 'installed');
  if (flag.found) return flag.value === true;
  const carry = changes?.system?.equipped?.carryType;
  if (typeof carry === 'string') return carry === 'implanted';
  return installedStateFromLike(item);
}

function proposedImplantType(item, changes) {
  const flag = proposedFlagChange(changes, 'implantType');
  if (flag.found) return String(flag.value ?? '');
  return implantTypeFromLike(item);
}

function implantCapacityMessage(actor, type, requested = 1, current = null) {
  const limit = actorGlobalImplantLimit(actor, type);
  const used = current ?? installedImplantCount(actor, type);
  const label = type === 'internal' ? 'внутренних' : type === 'external' ? 'внешних' : 'стилевых';
  const mode = type === 'fashion' ? 'независимо от ПКТ' : (actorHasInstalledPktBody(actor) ? 'с установленным ПКТ' : 'без ПКТ');
  return `Лимит ${label} имплантов ${mode}: ${limit}. Сейчас установлено ${used}; требуется ещё ${requested}.`;
}

function validateProjectedImplantCapacity(actor, sources = []) {
  if (!actor?.items) return '';
  const used = {
    internal: installedImplantCount(actor, 'internal'),
    external: installedImplantCount(actor, 'external'),
    fashion: installedImplantCount(actor, 'fashion'),
  };
  for (const source of sources) {
    const type = implantTypeFromLike(source);
    if (!['internal','external','fashion'].includes(type) || !installedStateFromLike(source)) continue;
    const quantity = Math.max(1, Number(source?.system?.quantity ?? 1) || 1);
    used[type] += quantity;
  }
  for (const type of ['internal','external','fashion']) {
    const limit = actorGlobalImplantLimit(actor, type);
    if (used[type] > limit) return implantCapacityMessage(actor, type, Math.max(1, used[type] - installedImplantCount(actor,type)), installedImplantCount(actor,type));
  }
  return '';
}

function checkPreCreateImplantCapacity(item, data, options = {}) {
  const actor = item?.parent;
  if (!actor?.items) return true;
  const type = implantTypeFromLike(item) || implantTypeFromLike(data);
  if (!['internal','external','fashion'].includes(type)) return true;
  if (!installedStateFromLike(item) && !installedStateFromLike(data)) return true;
  const limit = actorGlobalImplantLimit(actor, type);
  const current = installedImplantCount(actor, type);
  const quantity = Math.max(1, Number(item?.system?.quantity ?? data?.system?.quantity ?? 1) || 1);
  let pending = null;
  if (options && typeof options === 'object') {
    pending = cicCapacityPendingBatches.get(options);
    if (!pending) { pending = { internal:0, external:0, fashion:0 }; cicCapacityPendingBatches.set(options,pending); }
  }
  const alreadyPending = pending?.[type] ?? 0;
  if (current + alreadyPending + quantity > limit) {
    ui.notifications.error(implantCapacityMessage(actor,type,quantity,current + alreadyPending));
    return false;
  }
  if (pending) pending[type] += quantity;
  return true;
}

function checkPreUpdateImplantCapacity(item, changes) {
  const actor = item?.parent;
  if (!actor?.items) return true;
  const oldType = implantTypeFromLike(item);
  const newType = proposedImplantType(item, changes);
  const oldInstalled = installedStateFromLike(item);
  const newInstalled = proposedInstalledState(item, changes);
  if (!newInstalled || !['internal','external','fashion'].includes(newType)) return true;
  const needsCheck = !oldInstalled || oldType !== newType;
  if (!needsCheck) return true;
  const current = installedImplantCount(actor,newType,{excludeItemId:item.id});
  const quantity = Math.max(1, Number(changes?.system?.quantity ?? item?.system?.quantity ?? 1) || 1);
  const limit = actorGlobalImplantLimit(actor,newType);
  if (current + quantity > limit) {
    ui.notifications.error(implantCapacityMessage(actor,newType,quantity,current));
    return false;
  }
  return true;
}

function enhanceGlobalImplantCapacityLabels(app, html) {
  // v1.13.18: показываем только компактный счётчик в заголовках разделов
  // «ВНУТРЕННИЕ X/7» / «ВНЕШНИЕ X/7», при ПКТ — X/14; «СТИЛЕВЫЕ X/7» всегда остаётся X/7.
  // Отдельную строку-сводку «Внутренние: ... Внешние: ...» не создаём.
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  const actor = app?.actor ?? app?.document ?? app?.object;
  if (!actor?.items) return;

  // Удаляем только наши старые бейджи перед пересчётом.
  for (const badge of root.querySelectorAll('[data-cic-global-capacity], .cic-global-implant-capacity')) badge.remove();

  // v2.8.8: нативная вкладка Remaster уже рисует единый счётчик загрузки.
  // Не добавляем второй бейдж поверх него ни у персонажа, ни у NPC.
  if (root.querySelector(".cw-capacity-indicator")) return;

  // На всякий случай удаляем старую отдельную строку-сводку прошлых версий.
  const summaryRe = /^\s*внутренн(?:ие|их)\s*:?\s*\d+(?:\s*\/\s*\d+)?\s+внешн(?:ие|их)\s*:?\s*\d+(?:\s*\/\s*\d+)?\s*$/iu;
  const reverseRe = /^\s*внешн(?:ие|их)\s*:?\s*\d+(?:\s*\/\s*\d+)?\s+внутренн(?:ие|их)\s*:?\s*\d+(?:\s*\/\s*\d+)?\s*$/iu;
  for (const el of root.querySelectorAll('div, p, span, small, header')) {
    const text = String(el.textContent ?? '').replace(/\s+/g,' ').trim();
    if (!(summaryRe.test(text) || reverseRe.test(text))) continue;
    if (el.children.length > 6) continue;
    el.remove();
  }

  const hasPkt = actorHasInstalledPktBody(actor);
  const values = {
    internal: {
      label: 'внутренние',
      used: installedImplantCount(actor, 'internal'),
      limit: actorGlobalImplantLimit(actor, 'internal'),
    },
    external: {
      label: 'внешние',
      used: installedImplantCount(actor, 'external'),
      limit: actorGlobalImplantLimit(actor, 'external'),
    },
    fashion: {
      label: 'стилевые',
      used: installedImplantCount(actor, 'fashion'),
      limit: 7,
    },
  };

  const normalizeHeading = (value) => String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+\d+\s*\/\s*\d+\s*$/u, '')
    .toLocaleLowerCase('ru');

  // Ищем именно заголовки разделов, не строки отдельных имплантов.
  const candidates = [...root.querySelectorAll([
    'h1','h2','h3','h4','h5','h6','legend',
    '.section-title','.section-header','.item-list-header','.list-header',
    'header','strong','b','span','div'
  ].join(','))];

  const matched = new Set();
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    const normalized = normalizeHeading(el.textContent);
    let type = null;
    if (normalized === 'внутренние') type = 'internal';
    else if (normalized === 'внешние') type = 'external';
    else if (normalized === 'стилевые') type = 'fashion';
    if (!type || matched.has(type)) continue;

    // Не навешиваем счётчик на большой контейнер, если внутри найден более точный заголовок.
    const childExact = [...el.children].some((child) => {
      const t = normalizeHeading(child.textContent);
      return t === normalized;
    });
    if (childExact && !['H1','H2','H3','H4','H5','H6','LEGEND','STRONG','B','SPAN'].includes(el.tagName)) continue;

    const data = values[type];
    const badge = document.createElement('span');
    badge.className = 'cic-global-implant-capacity';
    if (data.used > data.limit) badge.classList.add('over');
    badge.dataset.cicGlobalCapacity = type;
    badge.textContent = `${data.used}/${data.limit}`;
    const titleLabel = type === 'internal' ? 'Внутренние' : type === 'external' ? 'Внешние' : 'Стилевые';
    const limitNote = type === 'fashion' ? 'Лимит всегда 7, ПКТ его не изменяет.' : (hasPkt ? 'ПКТ установлен — лимит 14.' : 'Без ПКТ — лимит 7.');
    badge.title = `${titleLabel} импланты: ${data.used} из ${data.limit}. ${limitNote}`;
    el.append(badge);
    matched.add(type);
  }
}


function enhanceInstalledCustomBaseCapacities(app, html) {
  // v1.13.15: вместимость internal/external остаётся только механическим флагом.
  // На листах имплантов и в списке замены эти цифры больше не выводятся.
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  for (const badge of root.querySelectorAll("[data-cic-base-capacity], .cic-native-base-capacity")) badge.remove();
}


let nativePktBridgeInstalled = false;
function getNativePktCyberwareTab() {
  for (const id of ["sf2e-cyberware-pkt", "cyberpunk-remaster"]) {
    const C = game.modules.get(id)?.api?.CyberwareTab;
    if (C) return C;
  }
  return null;
}

function installNativePktBridge() {
  if (nativePktBridgeInstalled) return true;
  const C = getNativePktCyberwareTab();
  if (!C) return false;
  if (C.__cicPktBridgeInstalled) { nativePktBridgeInstalled = true; return true; }

  const originalLoadPktContent = C.loadPktContent;
  const originalInstallPktModel = C.installPktModel;
  const originalPktModelBody = C.pktModelBody;
  const originalPktModelValidation = C.pktModelValidation;
  const originalPktBaseReplacementSource = C.pktBaseReplacementSource;
  C.loadPktContent = async function(options = {}) {
    const content = await originalLoadPktContent.call(this, options);
    const custom = [];
    for (const model of customPktModels()) {
      try { custom.push(await nativePktModelFromStored(model, this)); }
      catch (error) { console.error(`${MODULE_ID} | custom native PKT model failed`, model, error); }
    }
    const stockKeys = new Set((content.models ?? []).map((model) => model.key));
    const stockReplacementIds = new Set((content.replacements ?? []).map((entry)=>entry.itemId));
    const customReplacements = customPktReplacementCatalogEntries(this).filter((entry)=>!stockReplacementIds.has(entry.itemId));
    return { ...content, models: [...(content.models ?? []), ...custom.filter((model) => !stockKeys.has(model.key))], replacements:[...(content.replacements ?? []), ...customReplacements] };
  };
  C.installPktModel = async function(actor, model, selections = {}) {
    if (!model?.__cicCustom) return originalInstallPktModel.call(this, actor, model, selections);
    return installCustomPktViaNative(this, actor, model, selections);
  };
  if (typeof originalPktModelBody === "function") {
    C.pktModelBody = function(actor, model) {
      if (!model?.__cicCustom) return originalPktModelBody.call(this, actor, model);
      return customPktModelBody(actor, model);
    };
  }
  if (typeof originalPktModelValidation === "function") {
    C.pktModelValidation = function(actor, model) {
      if (!model?.__cicCustom) return originalPktModelValidation.call(this, actor, model);
      return customPktModelValidation(actor, model);
    };
  }
  if (typeof originalPktBaseReplacementSource === "function") {
    C.pktBaseReplacementSource = function(sourceDocument, base, body) {
      const source = originalPktBaseReplacementSource.call(this, sourceDocument, base, body);
      const modelKey = String(this.getFlag?.(base,"pktModelKey") ?? "");
      if (!modelKey.startsWith("cic-")) return source;
      const hardMode = this.getFlag?.(base,"pktHardMode") === "waived" ? "waived" : "normal";
      const uniqueBase = this.getFlag?.(base,"pktUniqueBase") === true || this.getFlag?.(base,"pktReplaceableBase") === false;
      const sourceFlags = source.flags ??= {};
      const namespace = REMASTER_IDS.find((id)=>sourceFlags?.[id]) ?? activeRemasterId();
      sourceFlags[namespace] ??= {};
      sourceFlags[namespace].pktUniqueBase = uniqueBase;
      sourceFlags[namespace].pktReplaceableBase = !uniqueBase;
      sourceFlags[namespace].pktInternalSlots = Math.max(0,intValue(sourceFlags[namespace].pktInternalSlots,0));
      sourceFlags[namespace].pktExternalSlots = Math.max(0,intValue(sourceFlags[namespace].pktExternalSlots,0));
      if (uniqueBase) sourceFlags[namespace].pktReplaceable = false;
      return applyCustomPktComponentPolicy(source,{ hard:hardMode, locked:true, uniqueBase, replaceableBase:!uniqueBase });
    };
  }
  C.__cicPktBridgeInstalled = true;
  nativePktBridgeInstalled = true;
  return true;
}

function refreshNativePktCatalogs() {
  const C = getNativePktCyberwareTab();
  try { C?.clearPktContentCache?.(); } catch {}
  for (const actor of game.actors ?? []) {
    try { if (actor.sheet?.rendered) actor.sheet.render(false); } catch {}
  }
}

async function registerPktModelDefinition(data, created = null) {
  if (!game.user?.isGM) throw new Error("Для регистрации модели ПКТ нужны права Мастера.");
  let model = pktModelFromPrerequisites(data, created);
  if (!model) {
    const components = [];
    if (data.pktModelIncludeCreated !== false && created) components.push(pktSnapshotFromItem(created));
    for (const uuid of data.pktModelComponents ?? []) components.push(await pktComponentSnapshotFromUuid(uuid));
    const choices = [];
    for (const uuid of data.pktModelChoiceUuids ?? []) choices.push(await pktComponentSnapshotFromUuid(uuid));
    // v1.13.23: do not reject here. New-format models may keep their entire
    // composition in pktModelBaseComponents / pktModelExtraComponents, which
    // are resolved below. Final emptiness validation happens after those lists
    // are merged into the model.
    model = {
      id: pktModelId(), manufacturer: data.pktModelManufacturer || "Пользовательская модель",
      name: data.pktModelName || created?.name || data.name || "ПКТ",
      minimumQuality: Number(data.pktModelMinimumQuality ?? data.pktQuality ?? 0) || 0,
      priceEddies: pktModelConfiguredPrice(data), components,
      choice: choices.length ? { label: data.pktModelChoiceLabel || "Выбор", options: choices } : null,
      createdAt: Date.now(), createdBy: game.user?.id ?? null, sourceItemUuid: created?.uuid ?? null,
      creatorVersion: MODULE_VERSION, nativePktModel: true,
    };
  }
  const baseDefinitions = normalizePktBaseComponents(data.pktModelBaseComponents ?? (()=>{ try { return JSON.parse(String(data.pktModelBaseComponentsJson ?? "[]")); } catch { return []; } })());
  const extraDefinitions = normalizePktExtraComponents(data.pktModelExtraComponents ?? (()=>{ try { return JSON.parse(String(data.pktModelExtraComponentsJson ?? "[]")); } catch { return []; } })());
  const baseComponents = [];
  for (const base of baseDefinitions) {
    const snapshot = await pktComponentSnapshotFromUuid(base.uuid, { name:base.name, quantity:base.quantity, hardCost:base.hardCost, stressFormula:base.stressFormula, priceEddies:base.priceEddies, internalSlots:base.internalSlots, externalSlots:base.externalSlots, hard:base.hard, stress:base.stress, family:base.family, uniqueBase:base.uniqueBase, replaceableBase:base.replaceableBase, locked:true, additional:false });
    if (snapshot) baseComponents.push(snapshot);
  }
  const additionalComponents = [];
  for (const extra of extraDefinitions) {
    const snapshot = await pktComponentSnapshotFromUuid(extra.uuid, { name:extra.name, quantity:extra.quantity, hardCost:extra.hardCost, stressFormula:extra.stressFormula, priceEddies:extra.priceEddies, hard:extra.hard, stress:extra.stress, family:extra.family, parentFamily:extra.parentFamily, locked:extra.detachable === false, detachable:extra.detachable, additional:true });
    if (snapshot) additionalComponents.push(snapshot);
  }
  const explicitKeys = new Set([...baseComponents, ...additionalComponents].map((entry)=>entry.uuid||entry.sourceUuid||entry.itemId).filter(Boolean));
  const legacyComponents = (Array.isArray(model.components) ? model.components : []).filter((entry)=>!explicitKeys.has(entry.uuid||entry.sourceUuid||entry.itemId));
  const seenComponentKey = new Set();
  model.components = [...legacyComponents, ...baseComponents].filter((entry)=>{ const key=entry.uuid||entry.sourceUuid||entry.itemId||entry.name; if(seenComponentKey.has(key)) return false; seenComponentKey.add(key); return true; });
  model.baseComponents = baseComponents;
  model.baseComponentDefinitions = foundry.utils.deepClone(baseDefinitions);
  model.additionalComponents = additionalComponents;
  model.extraComponentDefinitions = foundry.utils.deepClone(extraDefinitions);
  const hasChoices = Boolean(
    (Array.isArray(model.prerequisiteChoices) && model.prerequisiteChoices.length) ||
    (Array.isArray(model.choice?.options) && model.choice.options.length)
  );
  if (!model.components.length && !model.additionalComponents.length && !hasChoices) {
    throw new Error("В готовой модели ПКТ нет компонентов. Добавьте хотя бы одну Базу, Доп. компонент или вариант выбора.");
  }
  const models = customPktModels();
  const same = models.findIndex((entry) =>
    String(entry.manufacturer ?? "") === String(model.manufacturer ?? "") &&
    String(entry.name ?? "") === String(model.name ?? ""));
  if (same >= 0) model.id = models[same].id ?? model.id;
  if (same >= 0) models.splice(same, 1, model); else models.push(model);
  await setCustomPktModels(models);
  return model;
}

function cleanPktItemSource(document) {
  const source = foundry.utils.deepClone(document?.toObject?.() ?? document?._source ?? document);
  if (!source || typeof source !== "object") throw new Error("Не удалось получить данные компонента ПКТ.");
  delete source._id; delete source.folder; delete source.ownership;
  source.flags ??= {};
  const namespace = activeRemasterId();
  source.flags[namespace] ??= {};
  if (source.flags[namespace].cyberware === true || source.flags[namespace].pktOnly === true || source.flags[namespace].pktBody === true) {
    source.flags[namespace].installed = false;
  }
  source.flags[MODULE_ID] ??= {};
  source.flags[MODULE_ID].pktCatalogSnapshot = true;
  if (source.system?.equipped?.carryType === "implanted") source.system.equipped.carryType = "worn";
  return source;
}

function pktSnapshotMeta(document) {
  const namespace = activeRemasterId();
  const flag = document?.flags?.[namespace] ?? document?.flags?.["sf2e-cyberware-pkt"] ?? document?.flags?.["cyberpunk-remaster"] ?? {};
  return {
    itemId: pktItemIdFromUuid(document?.uuid) || String(document?._stats?.compendiumSource ?? "").match(/\.Item\.([^\.]+)$/)?.[1] || "",
    hardCost: pktHardCostFromDocument(document),
    stressFormula: pktStressFromDocument(document),
    priceEddies: pktPriceFromDocument(document),
    internalSlots: Math.max(0,intValue(flag.pktInternalSlots,0)),
    externalSlots: Math.max(0,intValue(flag.pktExternalSlots,0)),
    componentQuality: Math.max(0,intValue(flag.pktComponentQuality ?? flag.pktQuality,0)),
    family: flag.pktFamily ?? null,
    parentFamily: flag.pktParentFamily ?? null,
    replaceableBase: typeof flag.pktReplaceableBase === "boolean" ? flag.pktReplaceableBase : (["cyber-arm","cyber-leg","cyber-eye","cyber-audio","neural-link"].includes(flag.pktFamily) && flag.pktReplaceable !== false),
  };
}

async function pktComponentSnapshotFromUuid(uuid, options = {}) {
  let value = String(uuid ?? "").trim();
  const linkMatch = value.match(/^@UUID\[([^\]]+)\]/);
  if (linkMatch) value = linkMatch[1];
  if (!value) return null;
  const document = await fromUuid(value).catch(() => null);
  if (!document || document.documentName !== "Item") throw new Error(`Компонент ПКТ не найден или не является Item: ${value}`);
  const meta = pktSnapshotMeta(document);
  const configuredSource = applyCustomPktComponentPolicy(cleanPktItemSource(document), {
    ...options, hardCost: options.hardCost ?? meta.hardCost, stressFormula: options.stressFormula ?? meta.stressFormula, priceEddies: options.priceEddies ?? meta.priceEddies,
    hard: options.hard ?? "normal", stress: options.stress ?? "normal", family: options.family ?? meta.family, parentFamily: options.parentFamily ?? meta.parentFamily,
  });
  return {
    uuid: document.uuid, name: options.name || document.name, img: document.img ?? "icons/svg/item-bag.svg",
    source: configuredSource, ...meta,
    hardCost: Math.max(0, intValue(options.hardCost ?? meta.hardCost, 0)),
    stressFormula: String(options.stressFormula ?? meta.stressFormula ?? "0").trim() || "0",
    priceEddies: Math.max(0,Number(options.priceEddies ?? meta.priceEddies ?? 0)||0),
    internalSlots: Math.max(0,intValue(options.internalSlots ?? meta.internalSlots,0)),
    externalSlots: Math.max(0,intValue(options.externalSlots ?? meta.externalSlots,0)),
    componentQuality: Math.max(0,intValue(options.componentQuality ?? meta.componentQuality,0)),
    family: options.family ?? meta.family ?? null,
    parentFamily: options.parentFamily ?? meta.parentFamily ?? null,
    uniqueBase: options.uniqueBase === true || options.replaceableBase === false,
    replaceableBase: !(options.uniqueBase === true || options.replaceableBase === false) && (options.replaceableBase ?? meta.replaceableBase ?? false),
    quantity: Math.max(1, Number(options.quantity ?? 1) || 1),
    stress: options.stress === "waived" ? "waived" : "normal",
    hard: options.hard === "waived" ? "waived" : "normal",
    locked: typeof options.locked === "boolean" ? options.locked : options.additional !== true,
    detachable: options.detachable !== false,
    additional: options.additional === true,
  };
}

function pktSnapshotFromItem(item, options = {}) {
  const meta = pktSnapshotMeta(item);
  const configuredSource = applyCustomPktComponentPolicy(cleanPktItemSource(item), {
    ...options, hardCost: options.hardCost ?? meta.hardCost, stressFormula: options.stressFormula ?? meta.stressFormula, priceEddies: options.priceEddies ?? meta.priceEddies,
    hard: options.hard ?? "normal", stress: options.stress ?? "normal", family: options.family ?? meta.family, parentFamily: options.parentFamily ?? meta.parentFamily,
  });
  return {
    uuid: item.uuid ?? "", name: options.name || item.name, img: item.img ?? "icons/svg/item-bag.svg",
    source: configuredSource, ...meta,
    hardCost: Math.max(0, intValue(options.hardCost ?? meta.hardCost, 0)),
    stressFormula: String(options.stressFormula ?? meta.stressFormula ?? "0").trim() || "0",
    priceEddies: Math.max(0,Number(options.priceEddies ?? meta.priceEddies ?? 0)||0),
    internalSlots: Math.max(0,intValue(options.internalSlots ?? meta.internalSlots,0)),
    externalSlots: Math.max(0,intValue(options.externalSlots ?? meta.externalSlots,0)),
    componentQuality: Math.max(0,intValue(options.componentQuality ?? meta.componentQuality,0)),
    family: options.family ?? meta.family ?? null,
    parentFamily: options.parentFamily ?? meta.parentFamily ?? null,
    uniqueBase: options.uniqueBase === true || options.replaceableBase === false,
    replaceableBase: !(options.uniqueBase === true || options.replaceableBase === false) && (options.replaceableBase ?? meta.replaceableBase ?? false),
    quantity: Math.max(1, Number(options.quantity ?? 1) || 1),
    stress: options.stress === "waived" ? "waived" : "normal",
    hard: options.hard === "waived" ? "waived" : "normal",
    locked: typeof options.locked === "boolean" ? options.locked : options.additional !== true,
    detachable: options.detachable !== false,
    additional: options.additional === true,
  };
}

function pktModelDisplayName(model) {
  const manufacturer = String(model?.manufacturer ?? "").trim();
  const name = String(model?.name ?? "").trim();
  return manufacturer && name ? `${manufacturer} «${name}»` : (name || manufacturer || "Пользовательская модель ПКТ");
}

function pktModelId() {
  return globalThis.foundry?.utils?.randomID?.(16) ?? globalThis.crypto?.randomUUID?.() ?? `pkt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

async function registerPktModelFromCreation(data, created) {
  if (!data.pktRegisterModel) return null;
  const model = await registerPktModelDefinition(data, created);
  ui.notifications.info(`Готовая модель ПКТ «${pktModelDisplayName(model)}» добавлена в штатный каталог ПКТ.`);
  return model;
}


function pktFlagsOf(item) {
  for (const namespace of REMASTER_IDS) {
    const flags = item?.flags?.[namespace];
    if (flags?.pktBody === true || flags?.cyberware === true || flags?.pktOnly === true) return flags;
  }
  return item?.flags?.[activeRemasterId()] ?? {};
}

function actorPktBodyState(actor, minimumQuality = 0) {
  if (!actor?.items) return { ok: false, quality: -1, body: null, reason: "Персонаж не найден." };
  const bodies = actor.items.filter((item) => pktFlagsOf(item)?.pktBody === true);
  if (!bodies.length) return { ok: false, quality: -1, body: null, reason: "СНАЧАЛА УСТАНОВИТЕ КОРПУС ПОЛНОЙ КОНВЕРСИИ ТЕЛА." };
  const body = bodies.sort((a,b)=>(Number(pktFlagsOf(b)?.pktQuality ?? 0)-Number(pktFlagsOf(a)?.pktQuality ?? 0)))[0];
  const quality = Number(pktFlagsOf(body)?.pktQuality ?? 0) || 0;
  if (quality < minimumQuality) return { ok: false, quality, body, reason: `НУЖЕН КОРПУС КАЧЕСТВА «${PKT_QUALITY_LABELS[minimumQuality] ?? minimumQuality}» ИЛИ ВЫШЕ.` };
  return { ok: true, quality, body, reason: "" };
}

function resolvePktCatalogActor(app) {
  for (const candidate of [app?.actor, app?.document, app?.object, app?.options?.actor]) {
    if (candidate?.documentName === "Actor" || candidate?.items?.contents) return candidate;
  }
  const controlled = globalThis.canvas?.tokens?.controlled?.[0]?.actor;
  if (controlled) return controlled;
  return game.user?.character ?? null;
}

function preparePktInstallSource(component, model) {
  const source = foundry.utils.deepClone(component?.source ?? {});
  if (!source?.name) throw new Error("Компонент пользовательской модели ПКТ повреждён.");
  delete source._id; delete source.folder; delete source.ownership;
  const namespace = activeRemasterId();
  source.flags ??= {};
  source.flags[namespace] ??= {};
  source.flags[namespace].installed = true;
  source.flags[MODULE_ID] ??= {};
  source.flags[MODULE_ID].installedFromPktModel = model.id;
  if (source.system?.equipped) {
    source.system.equipped.carryType = "implanted";
    source.system.equipped.handsHeld = 0;
  }
  return source;
}

async function installCustomPktModel(modelId, actor, choiceIndex = 0) {
  const stored = customPktModels().find((entry) => entry.id === modelId);
  if (!stored) throw new Error("Пользовательская модель ПКТ не найдена.");
  const C = getNativePktCyberwareTab();
  if (C && installNativePktBridge()) {
    const model = await nativePktModelFromStored(stored, C);
    const selections = {};
    for (const choice of model.choices ?? []) selections[choice.key] = choice.options?.[Math.max(0, Number(choiceIndex) || 0)]?.itemId ?? choice.itemIds?.[0];
    return C.installPktModel(actor, model, selections);
  }
  throw new Error("Штатная система ПКТ Remaster недоступна. Активируйте SF2E — Импланты и ПКТ / Cyberpunk Remaster.");
}


async function deleteCustomPktModel(modelId) {
  const models = customPktModels();
  const index = models.findIndex((model) => model.id === modelId);
  if (index < 0) return;
  const model = models[index];
  const installed = customPktInstalledActors(model);
  if (installed.length) throw new Error(`Сначала демонтируйте модель ПКТ у: ${installed.map((actor)=>actor.name).join(", ")}.`);
  const [removed] = models.splice(index, 1);
  await setCustomPktModels(models);
  ui.notifications.info(`Модель ПКТ «${pktModelDisplayName(removed)}» удалена из пользовательского каталога.`);
}

function customPktInstalledActors(model) {
  const key = customPktModelKey(model);
  const result = [];
  for (const actor of game.actors ?? []) {
    const installed = [...(actor.items ?? [])].some((item) => REMASTER_IDS.some((id) => item?.flags?.[id]?.pktModelKey === key));
    if (installed) result.push(actor);
  }
  return result;
}

function customPktStoredPrice(model) {
  return Math.max(0, Number(model?.priceEddies ?? model?.pktModelPrice ?? model?.price ?? 0) || 0);
}

async function migrateCustomPktModelPrices() {
  if (!game.user?.isGM) return false;
  const models = customPktModels();
  let changed = false;
  for (const model of models) {
    if (customPktStoredPrice(model) > 0) continue;
    let item = null;
    if (model.sourceItemUuid) {
      try { item = await fromUuid(model.sourceItemUuid); } catch {}
    }
    if (!item && model.sourceBodyName) {
      item = game.items?.find((candidate) => candidate.name === model.sourceBodyName) ?? null;
      if (!item) {
        for (const actor of game.actors ?? []) {
          item = actor.items?.find((candidate) => candidate.name === model.sourceBodyName) ?? null;
          if (item) break;
        }
      }
    }
    const price = Math.max(0, Number(item?.system?.price?.value?.sp ?? item?.flags?.[MODULE_ID]?.priceEddies ?? 0) || 0);
    if (price > 0) {
      model.priceEddies = price;
      changed = true;
    }
  }
  if (changed) await setCustomPktModels(models);
  return changed;
}

async function confirmCustomPktDeletion(model) {
  const installed = customPktInstalledActors(model);
  if (installed.length) {
    ui.notifications.warn(`Модель ПКТ «${pktModelDisplayName(model)}» установлена у: ${installed.map((actor)=>actor.name).join(", ")}. Сначала демонтируйте её.`);
    return false;
  }
  const title = `Удалить модель ПКТ «${pktModelDisplayName(model)}»?`;
  const content = `<p>Удалить пользовательскую модель ПКТ <strong>«${esc(pktModelDisplayName(model))}»</strong> из каталога?</p><p class="cic-help">Корпус и Items мира не удаляются. Удаляется только регистрация готовой модели.</p>`;
  try {
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (DialogV2?.confirm) {
      return await DialogV2.confirm({ window:{ title }, content, yes:{ label:"Удалить", icon:"<i class='fa-solid fa-trash'></i>" }, no:{ label:"Отмена" } });
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | DialogV2 delete confirmation failed`, error);
  }
  return globalThis.confirm ? globalThis.confirm(`${title}\n\nКорпус/Items мира не удаляются.`) : true;
}

let globalPktDeleteHandlerInstalled = false;
function installGlobalPktDeleteHandler() {
  if (globalPktDeleteHandlerInstalled) return;
  globalPktDeleteHandlerInstalled = true;
  document.addEventListener("click", async (event) => {
    const button = event.target?.closest?.("[data-delete-managed-pkt], [data-cic-native-delete-pkt], [data-cic-delete-pkt]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (!game.user?.isGM) return ui.notifications.warn("Удалять пользовательские модели ПКТ может только Мастер.");
    if (button.disabled) return;
    const modelId = String(
      button.dataset.cicNativeDeletePkt
      ?? button.closest("[data-model-id]")?.dataset?.modelId
      ?? button.closest("[data-pkt-model-id]")?.dataset?.pktModelId
      ?? ""
    ).trim();
    const model = customPktModels().find((entry) => String(entry.id) === modelId);
    if (!model) return ui.notifications.warn("Пользовательская модель ПКТ уже удалена или не найдена.");
    if (!(await confirmCustomPktDeletion(model))) return;
    button.disabled = true;
    try {
      await deleteCustomPktModel(model.id);
      refreshNativePktCatalogs();
      const creatorForm = document.querySelector(".cic-root form");
      if (creatorForm) renderPktModelManager(creatorForm);
      button.closest("[data-model-id], [data-pkt-model-id]")?.remove?.();
    } catch (error) {
      console.error(`${MODULE_ID} | PKT delete failed`, error);
      ui.notifications.error(error.message ?? String(error));
      button.disabled = false;
    }
  }, true);
}


async function migrateInstalledCustomPktComponentPolicies() {
  if (!game.user?.isGM) return;
  const C = getNativePktCyberwareTab();
  if (!C) return;
  const namespace = activeRemasterId();
  for (const actor of game.actors ?? []) {
    const updates = [];
    for (const item of actor.items ?? []) {
      const modelKey = String(C.getFlag?.(item,"pktModelKey") ?? "");
      if (!modelKey.startsWith("cic-")) continue;
      const type = C.getImplantType?.(item);
      const family = C.getFlag?.(item,"pktFamily");
      const update = { _id:item.id };
      let changed = false;
      if (type !== "base" && C.getFlag?.(item,"pktLocked") === true) {
        update[`flags.${namespace}.pktLocked`] = false;
        changed = true;
      }
      const uniqueBase = C.getFlag?.(item,"pktUniqueBase") === true || C.getFlag?.(item,"pktReplaceableBase") === false;
      if (type === "base" && !uniqueBase && ["cyber-arm","cyber-leg","cyber-eye","cyber-audio","neural-link"].includes(family) && C.getFlag?.(item,"pktReplaceableBase") !== true) {
        update[`flags.${namespace}.pktReplaceableBase`] = true;
        changed = true;
      }
      if (changed) updates.push(update);
    }
    if (updates.length) {
      try { await actor.updateEmbeddedDocuments("Item",updates,{ cyberpunkRemasterModelOperation:true }); }
      catch (error) { console.warn(`${MODULE_ID} | custom PKT component policy migration failed for ${actor.name}`,error); }
    }
  }
}

async function migrateCreatorWorldReplacementBases() {
  if (!game.user?.isGM) return;
  const C = getNativePktCyberwareTab();
  if (!C) return;
  const namespace = activeRemasterId();
  for (const item of game.items ?? []) {
    if (!item?.flags?.[MODULE_ID]?.createdWith) continue;
    if (C.getImplantType?.(item) !== "base") continue;
    const family = String(C.getFlag?.(item,"pktFamily") ?? "").trim();
    if (!family) continue;
    if (C.getFlag?.(item,"pktUniqueBase") === true || C.getFlag?.(item,"pktReplaceableBase") === false) continue;
    if (C.getFlag?.(item,"pktReplaceable") === true && C.getFlag?.(item,"pktReplaceableBase") === true) continue;
    try {
      await item.update({
        [`flags.${namespace}.pktReplaceable`]:true,
        [`flags.${namespace}.pktReplaceableBase`]:true,
      });
    } catch (error) {
      console.warn(`${MODULE_ID} | failed to migrate creator replacement base ${item.name}`,error);
    }
  }
  refreshNativePktCatalogs();
}

function renderPktModelManager(form) {
  const root = form?.closest?.(".cic-window") ?? document;
  const host = root.querySelector?.("[data-pkt-model-manager]");
  if (!host) return;
  const models = customPktModels();
  if (!models.length) {
    host.innerHTML = `<p class="cic-help">Пользовательских моделей ПКТ пока нет.</p>`;
    return;
  }
  host.innerHTML = models.map((model) => {
    const installed = customPktInstalledActors(model);
    const price = customPktStoredPrice(model);
    const deleteButton = game.user?.isGM ? `<button type="button" class="cic-danger" data-delete-managed-pkt ${installed.length ? 'disabled title="Сначала демонтируйте модель у персонажа"' : 'title="Удалить модель из каталога"'}><i class="fa-solid fa-trash"></i> Удалить</button>` : "";
    return `<div class="cic-pkt-manager-row" data-model-id="${esc(model.id)}"><div><strong>${esc(pktModelDisplayName(model))}</strong><small>${esc(pktQualityName(model.minimumQuality))} · ${price.toLocaleString("ru-RU")} эдди${installed.length ? ` · установлена: ${esc(installed.map((a)=>a.name).join(", "))}` : ""}</small></div>${deleteButton}</div>`;
  }).join("");
  // Удаление обрабатывает единый document-level handler.
}

function enhanceNativeCustomPktCards(app, html) {
  if (!game.user?.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  for (const model of customPktModels()) {
    const key = customPktModelKey(model);
    const action = root.querySelector(`[data-model-key="${CSS.escape(key)}"]`);
    if (!action) continue;
    const card = action.closest(".cw-pkt-model-card, article");
    const footer = action.closest(".cw-pkt-model-footer, footer") ?? card;
    if (!footer || footer.querySelector(`[data-cic-native-delete-pkt="${CSS.escape(model.id)}"]`)) continue;
    const installed = !!card?.querySelector(".cw-pkt-model-remove");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cw-pkt-action cic-native-pkt-delete";
    button.dataset.cicNativeDeletePkt = model.id;
    button.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i> Удалить модель';
    if (installed) {
      button.disabled = true;
      button.title = "Сначала демонтируйте модель ПКТ у персонажа";
    } else {
      button.title = "Удалить пользовательскую модель из каталога";
    }
    footer.appendChild(button);
  }
}

function ownNodeText(element) {
  return String([...(element?.childNodes ?? [])].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? "").join(" ")).replace(/\s+/g," ").trim();
}

function findPktCatalogHeading(root) {
  const candidates = [...root.querySelectorAll("h1,h2,h3,h4,h5,legend,strong,div,span")];
  return candidates.find((el) => {
    const own = ownNodeText(el);
    const full = String(el.textContent ?? "").replace(/\s+/g," ").trim();
    return /готовые\s+модели\s+пкт/i.test(own) || (/готовые\s+модели\s+пкт/i.test(full) && full.length < 160);
  }) ?? null;
}

function renderCustomPktCatalog(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector("[data-cic-pkt-catalog]")) return;
  const heading = findPktCatalogHeading(root);
  if (!heading) return;
  const models = customPktModels();
  if (!models.length) return;

  const actor = resolvePktCatalogActor(app);
  const wrapper = document.createElement("section");
  wrapper.className = "cic-pkt-catalog-extension";
  wrapper.dataset.cicPktCatalog = "true";
  wrapper.innerHTML = `<div class="cic-pkt-catalog-title"><strong>Пользовательские модели ПКТ</strong><small>Созданы через Cyberpunk Implant Creator</small></div>`;

  for (const model of models) {
    const requirement = actorPktBodyState(actor, Number(model.minimumQuality ?? 0));
    const count = (model.components?.length ?? 0) + (model.choice?.options?.length ? 1 : 0);
    const card = document.createElement("article");
    card.className = "cic-pkt-model-card";
    card.dataset.pktModelId = model.id;
    const choice = model.choice?.options?.length ? `<label class="cic-pkt-choice"><span>${esc(model.choice.label || "Выбор")}</span><select data-cic-pkt-choice>${model.choice.options.map((option,index)=>`<option value="${index}">${esc(option.name)}</option>`).join("")}</select></label>` : "";
    const componentNames = [...(model.components ?? []).map((component)=>component.name), ...(model.choice?.options?.length ? [`${model.choice.label || "Выбор"}: ${model.choice.options.map((option)=>option.name).join(" / ")}`] : [])];
    card.innerHTML = `
      <div class="cic-pkt-model-head"><div><strong>${esc(pktModelDisplayName(model))}</strong><small>Минимум: Полная Конверсия Тела [${esc(PKT_QUALITY_LABELS[Number(model.minimumQuality ?? 0)] ?? String(model.minimumQuality ?? 0))}] · ${Number(model.priceEddies ?? 0).toLocaleString("ru-RU")} эдди</small></div><span class="cic-pkt-count">${count} комп.</span></div>
      <details><summary>Состав комплекта</summary><ul>${componentNames.map((name)=>`<li>${esc(name)}</li>`).join("")}</ul></details>
      ${choice}
      <div class="cic-pkt-model-actions"><strong class="cic-pkt-requirement ${requirement.ok ? "is-ok" : ""}">${esc(requirement.ok ? "КОРПУС СООТВЕТСТВУЕТ ТРЕБОВАНИЮ." : requirement.reason)}</strong><span></span><button type="button" data-cic-install-pkt ${requirement.ok ? "" : "disabled"}><i class="fa-solid fa-gears"></i> Установить модель</button>${game.user?.isGM ? `<button type="button" class="cic-pkt-delete" data-cic-delete-pkt title="Удалить пользовательскую модель"><i class="fa-solid fa-trash"></i></button>` : ""}</div>`;
    card.querySelector("[data-cic-install-pkt]")?.addEventListener("click", async () => {
      const button = card.querySelector("[data-cic-install-pkt]");
      button.disabled = true;
      try {
        const currentActor = resolvePktCatalogActor(app);
        const choiceIndex = Number(card.querySelector("[data-cic-pkt-choice]")?.value ?? 0);
        await installCustomPktModel(model.id, currentActor, choiceIndex);
        app?.render?.(false);
      } catch (error) {
        console.error(`${MODULE_ID} | PKT install failed`, error);
        ui.notifications.error(error.message ?? String(error));
        button.disabled = false;
      }
    });
    // Удаление карточки обслуживает единый document-level handler.
    wrapper.appendChild(card);
  }

  // Remaster builds the stock cards dynamically. Insert our section into the same
  // catalog area, immediately before the first stock "Установить модель" card when possible.
  const stockInstallButton = [...root.querySelectorAll("button")].find((button) => /установить\s+модель/i.test(String(button.textContent ?? "")));
  const stockCard = stockInstallButton?.closest("article,section,.pkt-model,.model-card,.card") ?? stockInstallButton?.parentElement?.parentElement ?? null;
  if (stockCard?.parentElement) {
    stockCard.parentElement.insertBefore(wrapper, stockCard);
  } else {
    const parent = heading.parentElement ?? root;
    if (heading.nextSibling) parent.insertBefore(wrapper, heading.nextSibling); else parent.appendChild(wrapper);
  }
}

function applicationElement(app) {
  const element = app?.element;
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return null;
}

function appForPktCatalogElement(element) {
  const windows = globalThis.ui?.windows;
  const apps = [];
  if (windows instanceof Map) apps.push(...windows.values());
  else if (windows && typeof windows === "object") apps.push(...Object.values(windows));
  const instances = globalThis.foundry?.applications?.instances;
  if (instances instanceof Map) apps.push(...instances.values());
  for (const app of apps) {
    const appEl = applicationElement(app);
    if (appEl && (appEl === element || appEl.contains(element) || element.contains(appEl))) return app;
  }
  return null;
}

let pktCatalogObserver = null;
let pktCatalogScanQueued = false;

function scanDynamicPktCatalogs() {
  pktCatalogScanQueued = false;
  const body = document.body;
  if (!body) return;
  for (const select of body.querySelectorAll(".cw-pkt-base-replace")) {
    const root = select.closest(".window-content,.application,.window-app,.app,[data-appid]") ?? body;
    const app = appForPktCatalogElement(root);
    enhanceNativeCustomPktReplacementSelects(app,root);
    enhanceInstalledCustomBaseCapacities(app,root);
  }
  const headings = [...body.querySelectorAll("h1,h2,h3,h4,h5,legend,strong,div,span")].filter((el) => {
    if (el.closest("[data-cic-pkt-catalog]")) return false;
    const text = String(el.textContent ?? "").replace(/\s+/g," ").trim();
    return text.length < 160 && /готовые\s+модели\s+пкт/i.test(text);
  });
  for (const heading of headings) {
    const root = heading.closest(".window-content,.application,.window-app,.app,[data-appid]") ?? heading.parentElement?.parentElement ?? heading.parentElement;
    if (!root || root.querySelector("[data-cic-pkt-catalog]")) continue;
    renderCustomPktCatalog(appForPktCatalogElement(root), root);
  }
}

function queuePktCatalogScan() {
  if (pktCatalogScanQueued) return;
  pktCatalogScanQueued = true;
  requestAnimationFrame(() => scanDynamicPktCatalogs());
}

function startPktCatalogObserver() {
  if (pktCatalogObserver || !document.body) return;
  pktCatalogObserver = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => mutation.addedNodes?.length || mutation.type === "childList")) return;
    queuePktCatalogScan();
  });
  pktCatalogObserver.observe(document.body, { childList: true, subtree: true });
  queuePktCatalogScan();
}

function refreshDynamicPktCatalogs() {
  for (const node of document.querySelectorAll("[data-cic-pkt-catalog]")) node.remove();
  queuePktCatalogScan();
}

async function createImplant(form) {
  const data=readForm(form); if(!data.name?.trim()) throw new Error("Укажите название импланта.");
  const namespace=activeRemasterId(), source=await getTemplateSource(data.templateKey); applyCyberwareData(source,data,namespace);
  let created;
  if(data.actorId){ const actor=game.actors.get(data.actorId); if(!actor) throw new Error("Выбранный персонаж не найден."); [created]=await actor.createEmbeddedDocuments("Item",[source]); }
  else created=await Item.create(source,{renderSheet:false});
  if(!created) throw new Error("Foundry не вернул созданный Item.");
  if (created.parent) await syncActivationActionForImplant(created);
  if (data.pktRegisterModel) await registerPktModelFromCreation(data, created);
  ui.notifications.info(`Имплант «${created.name}» создан.`); if(data.openSheet) created.sheet?.render(true); return created;
}


function getActivationConfig(item) {
  const config = item?.flags?.[MODULE_ID]?.activation;
  return config?.enabled ? config : null;
}

function activationEffectsForItem(item) {
  const actor = item?.parent;
  if (!actor?.items || !item) return [];
  const sourceId = item.id ?? null;
  const sourceUuid = item.uuid ?? null;
  return actor.items.filter((candidate) => {
    if (candidate.type !== "effect" || candidate.flags?.[MODULE_ID]?.activationEffect !== true) return false;
    const flags = candidate.flags?.[MODULE_ID] ?? {};
    return (sourceId && flags.activationSourceItemId === sourceId) || (sourceUuid && flags.activationSourceUuid === sourceUuid);
  });
}

function activeActivationEffect(item) {
  return activationEffectsForItem(item)[0] ?? null;
}

function activationPeriodKey(config) {
  const frequency = config.frequency ?? "unlimited";
  if (frequency === "unlimited") return null;
  const combat = game.combat;
  const worldTime = Number(game.time?.worldTime ?? 0);
  if (frequency === "round") return combat ? `round:${combat.id}:${combat.round ?? 0}` : `round:world:${Math.floor(worldTime / 6)}`;
  if (frequency === "encounter") return combat ? `encounter:${combat.id}` : `encounter:world:${Math.floor(worldTime / 600)}`;
  const seconds = frequency === "minute" ? 60 : frequency === "hour" ? 3600 : 86400;
  return `${frequency}:${Math.floor(worldTime / seconds)}`;
}

function nativeActivationFrequencyState(action, config = null) {
  const frequency = action?.system?.frequency ?? action?.frequency ?? null;
  if (!frequency) return null;
  const fallbackMax = Math.max(1, Number(config?.frequencyMax ?? 1) || 1);
  const max = Math.max(1, Number(frequency.max ?? fallbackMax) || fallbackMax);
  const rawValue = frequency.value;
  const value = Number.isFinite(Number(rawValue)) ? Math.max(0, Number(rawValue)) : max;
  return { value, max, per: frequency.per ?? null };
}

function activationChargeState(item, config = getActivationConfig(item), preferredAction = null) {
  if (!config || (config.frequency ?? "unlimited") === "unlimited") {
    return { limited: false, value: Infinity, max: Infinity, available: true, action: linkedActivationAction(item, preferredAction) };
  }
  const action = linkedActivationAction(item, preferredAction);
  const frequency = nativeActivationFrequencyState(action, config);
  const max = Math.max(1, Number(config.frequencyMax ?? 1) || 1);
  const value = frequency?.value ?? max;
  return { limited: true, value, max: frequency?.max ?? max, available: value > 0, action };
}

async function consumeActivationUse(item, config, preferredAction = null) {
  if ((config.frequency ?? "unlimited") === "unlimited") return true;

  // Нативное Action SF2e является единственным источником истины для зарядов.
  // Поэтому отдых, ручное восстановление или любая системная механика, изменившая
  // system.frequency.value, немедленно возвращает возможность активации.
  let action = linkedActivationAction(item, preferredAction);
  if (!action && config.showOnActionsSheet !== false) {
    await syncActivationActionForImplant(item);
    action = linkedActivationAction(item);
  }
  const frequency = nativeActivationFrequencyState(action, config);
  if (action && frequency) {
    if (frequency.value <= 0) {
      ui.notifications.warn(`У активации «${config.name ?? item.name}» нет зарядов (${frequency.value}/${frequency.max}).`);
      return false;
    }
    await action.update({ "system.frequency.value": Math.max(0, frequency.value - 1) });
    return true;
  }

  // Legacy fallback для активаций, у которых пользователь отключил создание
  // нативного Action. Новые активации с Action сюда не попадают.
  const key = activationPeriodKey(config);
  if (!key) return true;
  const max = Math.max(1, Number(config.frequencyMax ?? 1) || 1);
  const state = item.flags?.[MODULE_ID]?.activationState ?? {};
  const count = state.key === key ? Number(state.count ?? 0) : 0;
  if (count >= max) {
    ui.notifications.warn(`Активация «${config.name ?? item.name}» уже использована максимально допустимое число раз за этот период.`);
    return false;
  }
  await item.update({ [`flags.${MODULE_ID}.activationState`]: { key, count: count + 1 } });
  return true;
}

function buildActivatedEffectSource(item, config) {
  const durationUnit = EFFECT_DURATION_UNITS.has(config.duration?.unit) ? config.duration.unit : "rounds";
  const durationValue = durationUnit === "encounter" || durationUnit === "unlimited" ? -1 : Math.max(1, Number(config.duration?.value ?? 1) || 1);
  const rules = foundry.utils.deepClone(Array.isArray(config.effectRules) ? config.effectRules : []);
  for (const uuid of Array.isArray(config.grantItemUuids) ? config.grantItemUuids : []) {
    if (!String(uuid).trim()) continue;
    rules.push({ key: "GrantItem", uuid: String(uuid).trim(), allowDuplicate: false });
  }
  return {
    name: config.effectName || `${item.name} — ${config.name || "Активировано"}`,
    type: "effect",
    img: config.effectImg || item.img || "icons/svg/aura.svg",
    system: {
      description: { value: config.effectDescription || `<p>Активируемый эффект импланта <strong>${esc(item.name)}</strong>.</p>`, gm: "" },
      rules,
      slug: null,
      traits: { value: [], otherTags: [] },
      level: { value: Number(item.system?.level?.value ?? 1) || 1 },
      duration: { value: durationValue, unit: durationUnit, expiry: config.duration?.expiry ?? null, sustained: false },
      tokenIcon: { show: config.tokenIcon !== false },
      unidentified: false,
      start: { value: Number(game.time?.worldTime ?? 0), initiative: item.parent?.combatant?.initiative ?? null },
      badge: null,
      fromSpell: false,
      context: null,
    },
    flags: {
      [MODULE_ID]: {
        activationEffect: true,
        activationSourceItemId: item.id,
        activationSourceUuid: item.uuid,
        activationName: config.name || "Активировать",
      },
    },
  };
}

async function postActivationChat(item, config, effect) {
  if (config.chatMessage === false || !globalThis.ChatMessage) return;
  const actor = item.parent;
  const action = ACTIVATION_ACTIONS[config.actionType] ?? ACTIVATION_ACTIONS.action1;
  const duration = config.duration?.unit === "encounter" ? "до конца столкновения" : config.duration?.unit === "unlimited" ? "пока не отключён" : `${config.duration?.value ?? 1} ${config.duration?.unit ?? "rounds"}`;
  const content = `<div class="cic-chat-activation"><h3>${esc(item.name)} — ${esc(config.name || "Активация")}</h3><p>${action.glyph}</p>${config.effectDescription ? `<p>${config.effectDescription}</p>` : ""}<p><strong>Длительность:</strong> ${esc(duration)}</p></div>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }) ?? {}, content, flags: { [MODULE_ID]: { activationMessage: true, effectId: effect?.id ?? null } } });
}

async function activateImplant(item, preferredAction = null) {
  const config = getActivationConfig(item);
  if (!config) return ui.notifications.warn("У этого импланта нет настроенной активации.");
  const actor = item.parent;
  if (!actor?.createEmbeddedDocuments) return ui.notifications.warn("Активация работает на экземпляре импланта у персонажа. Сначала добавьте предмет на Actor.");
  const existing = activeActivationEffect(item);
  if (existing) return ui.notifications.warn(`Эффект «${existing.name}» уже активен. Сначала отключите его или дождитесь окончания длительности.`);
  if (!(await consumeActivationUse(item, config, preferredAction))) return null;
  const source = buildActivatedEffectSource(item, config);
  const [effect] = await actor.createEmbeddedDocuments("Item", [source]);
  if (!effect) throw new Error("Не удалось создать SF2e Effect активации.");
  await postActivationChat(item, config, effect);
  ui.notifications.info(`${item.name}: «${config.name || "Активация"}» активирована.`);
  return effect;
}

async function deactivateImplant(item, explicitEffect = null) {
  const actor = item?.parent;
  if (!actor?.items) return ui.notifications.warn("Деактивация работает только у импланта, установленного на персонажа.");

  const effects = [];
  if (explicitEffect?.parent === actor && explicitEffect.type === "effect") effects.push(explicitEffect);
  for (const effect of activationEffectsForItem(item)) {
    if (!effects.some((candidate) => candidate.id === effect.id)) effects.push(effect);
  }

  if (!effects.length) return ui.notifications.warn("Активный эффект этого импланта не найден.");

  const ids = effects.map((effect) => effect.id).filter(Boolean);
  if (ids.length && typeof actor.deleteEmbeddedDocuments === "function") {
    await actor.deleteEmbeddedDocuments("Item", ids);
  } else {
    for (const effect of effects) await effect.delete();
  }

  ui.notifications.info(`${item.name}: активируемый эффект отключён.`);
  return true;
}

const ACTION_SYNC_LOCK = new Set();

function cyberwareInstalled(item) {
  for (const id of REMASTER_IDS) {
    const value = item?.flags?.[id]?.installed;
    if (typeof value === "boolean") return value;
  }
  if (item?.type === "equipment") return item?.system?.equipped?.carryType === "implanted";
  return false;
}

function activationActionTypeData(config) {
  const type = config?.actionType ?? "action1";
  if (type === "free") return { value: "free", actions: null, img: "systems/sf2e/icons/actions/FreeAction.webp" };
  if (type === "reaction") return { value: "reaction", actions: null, img: "systems/sf2e/icons/actions/Reaction.webp" };
  const count = type === "action3" ? 3 : type === "action2" ? 2 : 1;
  const file = count === 3 ? "ThreeActions.webp" : count === 2 ? "TwoActions.webp" : "OneAction.webp";
  return { value: "action", actions: count, img: `systems/sf2e/icons/actions/${file}` };
}

function activationNativeFrequency(config) {
  const max = Math.max(1, Number(config?.frequencyMax ?? 1) || 1);
  switch (config?.frequency) {
    case "round": return { value: max, max, per: "round" };
    case "encounter": return { value: max, max, per: "encounter" };
    case "minute": return { value: max, max, per: "PT1M" };
    case "hour": return { value: max, max, per: "PT1H" };
    case "day": return { value: max, max, per: "day" };
    default: return null;
  }
}

function simpleSignature(value) {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return String(hash >>> 0);
}

function activationActionDisplayName(item, config) {
  const itemName = String(item?.name ?? "Имплант").trim() || "Имплант";
  const configured = String(config?.name ?? "").trim();
  if (!configured || /^активировать$/iu.test(configured)) return `Активировать ${itemName}`;
  if (configured.toLocaleLowerCase("ru").includes(itemName.toLocaleLowerCase("ru"))) return configured;
  return `${configured} — ${itemName}`;
}

function buildActivationActionSource(item, config) {
  const action = activationActionTypeData(config);
  const description = [
    `<p><strong>Имплант:</strong> @UUID[${item.uuid}]{${esc(item.name)}}</p>`,
    config.requirements ? `<p><strong>Требования:</strong> ${config.requirements}</p>` : "",
    config.trigger ? `<p><strong>Триггер:</strong> ${config.trigger}</p>` : "",
    config.effectDescription ? `<hr><p>${config.effectDescription}</p>` : "",
    `<p><strong>Активация:</strong> ${esc(activationActionDisplayName(item, config))}</p>`,
    `<p><em>Используйте кнопку активации справа от действия, чтобы включить или выключить эффект импланта.</em></p>`,
  ].filter(Boolean).join("\n");
  const displayName = activationActionDisplayName(item, config);
  const syncData = { name: displayName, actionType: config.actionType, traits: config.traits, frequency: config.frequency, frequencyMax: config.frequencyMax, requirements: config.requirements, trigger: config.trigger, effectDescription: config.effectDescription, img: action.img };
  return {
    name: displayName,
    type: "action",
    img: action.img,
    system: {
      description: { value: description, gm: "" },
      rules: [],
      slug: null,
      traits: { otherTags: [], value: Array.isArray(config.traits) ? config.traits : [] },
      actionType: { value: action.value },
      actions: { value: action.actions },
      category: null,
      deathNote: false,
      frequency: activationNativeFrequency(config),
    },
    flags: {
      [MODULE_ID]: {
        activationAction: true,
        activationSourceItemId: item.id,
        activationSourceUuid: item.uuid,
        syncSignature: simpleSignature(syncData),
      },
    },
  };
}

function linkedActivationActions(item) {
  const actor = item?.parent;
  if (!actor?.items) return [];
  return actor.items.filter((candidate) => candidate.type === "action" && candidate.flags?.[MODULE_ID]?.activationAction === true && candidate.flags?.[MODULE_ID]?.activationSourceItemId === item.id);
}

function linkedActivationAction(item, preferredAction = null) {
  const actor = item?.parent;
  if (!actor?.items) return null;
  if (preferredAction?.parent === actor && preferredAction.type === "action" && preferredAction.flags?.[MODULE_ID]?.activationSourceItemId === item.id) return preferredAction;
  const actions = linkedActivationActions(item);
  if (!actions.length) return null;
  // Если после старых версий остались дубликаты Action, выбираем тот, у которого
  // сейчас больше зарядов. Это не даёт скрытому 0/1 блокировать видимый 1/1.
  return actions.sort((a, b) => {
    const av = nativeActivationFrequencyState(a, getActivationConfig(item))?.value ?? 0;
    const bv = nativeActivationFrequencyState(b, getActivationConfig(item))?.value ?? 0;
    return bv - av;
  })[0] ?? null;
}

async function syncActivationActionForImplant(item) {
  const actor = item?.parent;
  if (!actor?.createEmbeddedDocuments || !item?.id || item.type === "action" || item.type === "effect") return false;
  const lockKey = `${actor.id}:${item.id}`;
  if (ACTION_SYNC_LOCK.has(lockKey)) return false;
  ACTION_SYNC_LOCK.add(lockKey);
  try {
    const config = getActivationConfig(item);
    const existing = linkedActivationAction(item);
    const shouldExist = Boolean(config && config.showOnActionsSheet !== false && cyberwareInstalled(item));
    if (!shouldExist) {
      if (existing) await existing.delete();
      return Boolean(existing);
    }
    const source = buildActivationActionSource(item, config);
    if (!existing) {
      await actor.createEmbeddedDocuments("Item", [source]);
      return true;
    }
    const signature = existing.flags?.[MODULE_ID]?.syncSignature;
    if (signature === source.flags?.[MODULE_ID]?.syncSignature) return false;
    const existingFrequency = nativeActivationFrequencyState(existing, config);
    const targetFrequency = source.system.frequency
      ? {
          ...source.system.frequency,
          // Синхронизация названия/описания не должна бесплатно возвращать заряды.
          value: Math.min(source.system.frequency.max, Math.max(0, existingFrequency?.value ?? source.system.frequency.max)),
        }
      : null;
    await existing.update({
      name: source.name,
      img: source.img,
      "system.description": source.system.description,
      "system.traits": source.system.traits,
      "system.actionType": source.system.actionType,
      "system.actions": source.system.actions,
      "system.frequency": targetFrequency,
      [`flags.${MODULE_ID}`]: source.flags[MODULE_ID],
    });
    return true;
  } finally {
    ACTION_SYNC_LOCK.delete(lockKey);
  }
}

async function ensureActorActivationActions(actor) {
  if (!actor?.items || !(actor.isOwner ?? game.user?.isGM)) return false;
  let changed = false;
  for (const item of actor.items) {
    if (getActivationConfig(item)) changed = (await syncActivationActionForImplant(item)) || changed;
  }
  const seenActions = new Map();
  for (const action of actor.items.filter((candidate) => candidate.type === "action" && candidate.flags?.[MODULE_ID]?.activationAction === true)) {
    const sourceId = action.flags?.[MODULE_ID]?.activationSourceItemId;
    if (!sourceId || !actor.items.get(sourceId)) { await action.delete(); changed = true; continue; }
    const previous = seenActions.get(sourceId);
    if (!previous) { seenActions.set(sourceId, action); continue; }
    const config = getActivationConfig(actor.items.get(sourceId));
    const prevValue = nativeActivationFrequencyState(previous, config)?.value ?? 0;
    const nextValue = nativeActivationFrequencyState(action, config)?.value ?? 0;
    const keep = nextValue > prevValue ? action : previous;
    const remove = keep === action ? previous : action;
    seenActions.set(sourceId, keep);
    await remove.delete();
    changed = true;
  }
  return changed;
}

function updateActorActivationControl(control, source, action) {
  const active = activeActivationEffect(source);
  const config = getActivationConfig(source);
  const currentAction = linkedActivationAction(source, action) ?? action;
  const charges = activationChargeState(source, config, currentAction);
  const empty = !active && charges.limited && !charges.available;
  control.dataset.cicActorId = source.parent?.id ?? "";
  control.dataset.cicSourceItemId = source.id ?? "";
  control.dataset.cicActionItemId = currentAction?.id ?? action?.id ?? "";
  control.dataset.cicEffectItemId = active?.id ?? "";
  control.classList.toggle("is-active", Boolean(active));
  control.classList.toggle("is-empty", Boolean(empty));
  control.setAttribute("aria-disabled", empty ? "true" : "false");
  if (active) {
    control.title = `Отключить: ${currentAction?.name ?? action?.name ?? source.name}`;
    control.innerHTML = `<i class="fa-solid fa-power-off"></i>`;
  } else if (charges.limited) {
    control.title = charges.available
      ? `${currentAction?.name ?? action?.name ?? source.name} — заряды ${charges.value}/${charges.max}`
      : `${currentAction?.name ?? action?.name ?? source.name} — нет зарядов (0/${charges.max})`;
    control.innerHTML = `<i class="fa-solid fa-bolt"></i>`;
  } else {
    control.title = currentAction?.name ?? action?.name ?? source.name;
    control.innerHTML = `<i class="fa-solid fa-bolt"></i>`;
  }
}

function injectActorActivationControls(app, html) {
  const actor = app?.actor ?? app?.document ?? app?.object;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!actor?.items || !root) return;
  for (const action of actor.items.filter((candidate) => candidate.type === "action" && candidate.flags?.[MODULE_ID]?.activationAction === true)) {
    const source = actor.items.get(action.flags?.[MODULE_ID]?.activationSourceItemId);
    if (!source) continue;
    const row = root.querySelector(`[data-item-id="${action.id}"]`);
    if (!row) continue;
    let control = row.querySelector("[data-cic-actor-activate]");
    if (!control) {
      control = document.createElement("a");
      control.href = "#";
      control.dataset.cicActorActivate = "true";
      control.className = "item-control cic-actor-activate";
      control.addEventListener("click", async (event) => {
        event.preventDefault(); event.stopPropagation();
        const currentSource = actor.items.get(control.dataset.cicSourceItemId);
        if (!currentSource) return;
        try {
          const currentAction = actor.items.get(control.dataset.cicActionItemId) ?? linkedActivationAction(currentSource, action) ?? action;
          // Состояние эффекта всегда читаем заново с Actor. Старый CSS-класс кнопки
          // больше не может заставить нас выполнять неправильную ветку.
          const explicitEffectId = control.dataset.cicEffectItemId;
          const explicitEffect = explicitEffectId ? actor.items.get(explicitEffectId) : null;
          const activeEffect = explicitEffect ?? activeActivationEffect(currentSource);
          if (activeEffect) {
            await deactivateImplant(currentSource, activeEffect);
          } else {
            const state = activationChargeState(currentSource, getActivationConfig(currentSource), currentAction);
            if (state.limited && !state.available) {
              ui.notifications.warn(`У активации «${getActivationConfig(currentSource)?.name ?? currentSource.name}» нет зарядов (0/${state.max}).`);
              updateActorActivationControl(control, currentSource, currentAction);
              return;
            }
            await activateImplant(currentSource, currentAction);
          }
          // Не ждём полного rerender листа: сразу пересчитываем кнопку по реальным
          // данным Actor, затем повторяем после завершения embedded-document hooks.
          updateActorActivationControl(control, currentSource, currentAction);
          requestAnimationFrame(() => {
            const liveSource = actor.items.get(currentSource.id);
            const liveAction = actor.items.get(currentAction?.id) ?? linkedActivationAction(liveSource);
            if (liveSource && liveAction && control.isConnected) updateActorActivationControl(control, liveSource, liveAction);
          });
          setTimeout(() => {
            const liveSource = actor.items.get(currentSource.id);
            const liveAction = actor.items.get(currentAction?.id) ?? linkedActivationAction(liveSource);
            if (liveSource && liveAction && control.isConnected) updateActorActivationControl(control, liveSource, liveAction);
          }, 80);
        } catch (error) {
          console.error(`${MODULE_ID} | actor action activation failed`, error);
          ui.notifications.error(error.message ?? String(error));
        }
      }, { capture: true });
      const controls = row.querySelector(".item-controls, .action-controls, [data-action-controls]") ?? row;
      controls.appendChild(control);
    }
    updateActorActivationControl(control, source, action);
  }
}

const ACTIVATION_CONTROL_OBSERVERS = new WeakMap();
function observeActorActivationControls(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || ACTIVATION_CONTROL_OBSERVERS.has(root) || typeof MutationObserver === "undefined") return;
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (!root.isConnected) {
      observer.disconnect();
      ACTIVATION_CONTROL_OBSERVERS.delete(root);
      return;
    }
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      injectActorActivationControls(app, root);
    });
  });
  observer.observe(root, { childList: true, subtree: true });
  ACTIVATION_CONTROL_OBSERVERS.set(root, observer);
}


function injectActivationControls(app, html) {
  const item = app?.document ?? app?.item ?? app?.object;
  const config = getActivationConfig(item);
  if (!config) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector("[data-cic-activation-controls]")) return;
  const target = root.querySelector(".sheet-header") ?? root.querySelector("header") ?? root.querySelector(".window-content") ?? root;
  const controls = document.createElement("div");
  controls.className = "cic-activation-controls";
  controls.dataset.cicActivationControls = "true";
  const active = activeActivationEffect(item);
  const charges = activationChargeState(item, config);
  const noCharges = !active && charges.limited && !charges.available;
  const activateButton = document.createElement("button");
  activateButton.type = "button";
  activateButton.className = "cic-activate-button";
  activateButton.disabled = Boolean(active || noCharges);
  activateButton.innerHTML = `<i class="fa-solid fa-bolt"></i> ${active ? "Эффект активен" : noCharges ? `Нет зарядов (0/${charges.max})` : esc(activationActionDisplayName(item, config))}`;
  activateButton.addEventListener("click", async () => { try { await activateImplant(item); app?.render?.(false); } catch (error) { console.error(`${MODULE_ID} | activation failed`, error); ui.notifications.error(error.message ?? String(error)); } });
  controls.appendChild(activateButton);
  if (active) {
    const off = document.createElement("button");
    off.type = "button";
    off.className = "cic-deactivate-button";
    off.innerHTML = '<i class="fa-solid fa-power-off"></i> Отключить эффект';
    off.addEventListener("click", async () => { try { await deactivateImplant(item); app?.render?.(false); } catch (error) { console.error(`${MODULE_ID} | deactivation failed`, error); ui.notifications.error(error.message ?? String(error)); } });
    controls.appendChild(off);
  }
  target.appendChild(controls);
}

function captureCreatorWindowGeometry(win) {
  const rect = win.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function clampCreatorWindowGeometry(geometry) {
  const minVisible = 160;
  const viewportWidth = Math.max(344, Number(window.innerWidth) || 1280);
  const viewportHeight = Math.max(384, Number(window.innerHeight) || 900);
  const maxWidth = Math.max(320, viewportWidth - 24);
  const maxHeight = Math.max(360, viewportHeight - 24);
  const minWidth = Math.min(820, maxWidth);
  const minHeight = Math.min(560, maxHeight);
  const preferredWidth = Number(geometry?.width) || Math.min(1180, maxWidth);
  const preferredHeight = Number(geometry?.height) || Math.min(780, maxHeight);
  const width = Math.min(Math.max(preferredWidth, minWidth), maxWidth);
  const height = Math.min(Math.max(preferredHeight, minHeight), maxHeight);
  const minLeft = Math.min(0, minVisible - width);
  const maxLeft = Math.max(0, viewportWidth - minVisible);
  const maxTop = Math.max(0, viewportHeight - 44);
  return {
    left: Math.min(maxLeft, Math.max(minLeft, Number(geometry?.left) || 12)),
    top: Math.min(maxTop, Math.max(0, Number(geometry?.top) || 12)),
    width,
    height,
  };
}

function syncCreatorWindowControls(root) {
  const state = root?._cicWindowState ?? { mode: "normal" };
  const mode = state.mode ?? "normal";
  const normal = root?.querySelector?.("[data-cic-normal]");
  const maximize = root?.querySelector?.("[data-cic-maximize]");
  const minimize = root?.querySelector?.("[data-cic-minimize]");
  if (normal) {
    normal.disabled = mode === "normal";
    normal.classList.toggle("active", mode === "normal");
  }
  if (maximize) {
    maximize.disabled = mode === "maximized";
    maximize.classList.toggle("active", mode === "maximized");
  }
  if (minimize) {
    minimize.disabled = mode === "minimized";
    minimize.classList.toggle("active", mode === "minimized");
  }
}

function setCreatorWindowMode(root, mode = "normal") {
  const win = root?.querySelector?.(".cic-window");
  if (!win) return;
  const state = root._cicWindowState ??= { mode: "normal", normalGeometry: null };
  const current = state.mode ?? "normal";
  if (!["normal", "maximized", "minimized"].includes(mode)) mode = "normal";
  if (current === mode) return syncCreatorWindowControls(root);

  if (current === "normal" && mode !== "normal") {
    state.normalGeometry = captureCreatorWindowGeometry(win);
  }

  win.classList.remove("cic-maximized", "cic-minimized");
  win.style.transform = "none";

  if (mode === "normal") {
    const geometry = clampCreatorWindowGeometry(state.normalGeometry ?? captureCreatorWindowGeometry(win));
    win.style.left = `${geometry.left}px`;
    win.style.top = `${geometry.top}px`;
    win.style.width = `${geometry.width}px`;
    win.style.height = `${geometry.height}px`;
  } else if (mode === "maximized") {
    win.classList.add("cic-maximized");
  } else {
    const geometry = clampCreatorWindowGeometry(state.normalGeometry ?? captureCreatorWindowGeometry(win));
    win.style.left = `${geometry.left}px`;
    win.style.top = `${geometry.top}px`;
    win.classList.add("cic-minimized");
  }

  state.mode = mode;
  syncCreatorWindowControls(root);
}

function enableCreatorWindowControls(root) {
  if (!root || root._cicWindowState) return;
  root._cicWindowState = { mode: "normal", normalGeometry: null };
  root.querySelector("[data-cic-minimize]")?.addEventListener("click", () => setCreatorWindowMode(root, "minimized"));
  root.querySelector("[data-cic-normal]")?.addEventListener("click", () => setCreatorWindowMode(root, "normal"));
  root.querySelector("[data-cic-maximize]")?.addEventListener("click", () => setCreatorWindowMode(root, "maximized"));
  const header = root.querySelector(".cic-header");
  header?.addEventListener("dblclick", (event) => {
    if (event.target.closest("button, input, select, textarea, a")) return;
    const mode = root._cicWindowState?.mode === "maximized" ? "normal" : "maximized";
    setCreatorWindowMode(root, mode);
  });
  syncCreatorWindowControls(root);
}

function enableWindowDragging(root) {
  const win = root?.querySelector(".cic-window");
  const header = root?.querySelector(".cic-header");
  if (!win || !header) return;

  const beginDrag = (event) => {
    if (win.classList.contains("cic-maximized")) return;
    if (event.button !== 0 || event.target.closest("button, input, select, textarea, a")) return;
    const rect = win.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    win.style.transform = "none";
    win.style.left = `${rect.left}px`;
    win.style.top = `${rect.top}px`;
    header.classList.add("dragging");
    event.preventDefault();

    const move = (moveEvent) => {
      const current = win.getBoundingClientRect();
      const minVisible = 120;
      const maxLeft = Math.max(0, window.innerWidth - minVisible);
      const maxTop = Math.max(0, window.innerHeight - 44);
      const minLeft = Math.min(0, minVisible - current.width);
      const left = Math.min(maxLeft, Math.max(minLeft, moveEvent.clientX - offsetX));
      const top = Math.min(maxTop, Math.max(0, moveEvent.clientY - offsetY));
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
    };
    const end = () => {
      header.classList.remove("dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
  };
  header.addEventListener("pointerdown", beginDrag);
}

const CIC_EXTERNAL_WINDOW_SELECTORS = [
  ".application",
  ".window-app",
  ".dialog",
  ".filepicker",
  ".file-picker",
  ".ui-dialog",
  "dialog",
  "[role=\"dialog\"]"
].join(",");

function enableExternalWindowPriority(root) {
  if (!root || root._cicExternalWindowCleanup) return;
  const touched = new Map();
  let sequence = 0;

  const rememberAndRaise = (candidate) => {
    if (!(candidate instanceof HTMLElement)) return;
    if (candidate.closest(".cic-root")) return;

    let app = candidate.matches?.(CIC_EXTERNAL_WINDOW_SELECTORS) ? candidate : candidate.closest?.(CIC_EXTERNAL_WINDOW_SELECTORS);
    if (!app) app = candidate.querySelector?.(CIC_EXTERNAL_WINDOW_SELECTORS) ?? null;
    if (!(app instanceof HTMLElement) || app.closest(".cic-root")) return;

    // Поднимаем именно верхнее окно Application/Dialog, а не случайный вложенный узел.
    const parentApp = app.parentElement?.closest?.(CIC_EXTERNAL_WINDOW_SELECTORS);
    if (parentApp instanceof HTMLElement && !parentApp.closest(".cic-root")) app = parentApp;

    if (!touched.has(app)) {
      touched.set(app, {
        value: app.style.getPropertyValue("z-index"),
        priority: app.style.getPropertyPriority("z-index")
      });
    }
    sequence += 1;
    app.dataset.cicAboveCreator = "true";
    app.style.setProperty("z-index", String(100100 + sequence), "important");
  };

  const raiseFromNode = (node) => {
    if (!(node instanceof HTMLElement)) return;
    rememberAndRaise(node);
    node.querySelectorAll?.(CIC_EXTERNAL_WINDOW_SELECTORS).forEach(rememberAndRaise);
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => raiseFromNode(node));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const focusHandler = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest(".cic-root")) return;
    // Foundry иногда сам меняет z-index на focus. Повторяем после его обработчиков.
    queueMicrotask(() => rememberAndRaise(target));
    requestAnimationFrame(() => rememberAndRaise(target));
  };
  document.addEventListener("pointerdown", focusHandler, true);
  document.addEventListener("focusin", focusHandler, true);

  root._cicRaiseExternalWindow = rememberAndRaise;
  root._cicExternalWindowCleanup = () => {
    observer.disconnect();
    document.removeEventListener("pointerdown", focusHandler, true);
    document.removeEventListener("focusin", focusHandler, true);
    for (const [app, previous] of touched) {
      if (!(app instanceof HTMLElement)) continue;
      delete app.dataset.cicAboveCreator;
      if (previous.value) app.style.setProperty("z-index", previous.value, previous.priority || "");
      else app.style.removeProperty("z-index");
    }
    touched.clear();
    delete root._cicRaiseExternalWindow;
    delete root._cicExternalWindowCleanup;
  };
}

function raiseNewestExternalWindows(root) {
  if (!root?._cicRaiseExternalWindow) return;
  for (const el of document.querySelectorAll(CIC_EXTERNAL_WINDOW_SELECTORS)) {
    if (!(el instanceof HTMLElement) || el.closest(".cic-root")) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    root._cicRaiseExternalWindow(el);
  }
}

function closeModal(root){
  root?._cicExternalWindowCleanup?.();
  root?.remove();
}

async function openCreator(){
  if(document.querySelector(".cic-root")) return;
  const templateOptions=await buildTemplateOptions(), combatCatalogs=sf2eCombatCatalogs(), root=document.createElement("div"); root.className="cic-root"; root.innerHTML=modalHtml(templateOptions, combatCatalogs); document.body.appendChild(root);
  enableExternalWindowPriority(root);
  const form=root.querySelector("form"); enableCreatorWindowControls(root); enableWindowDragging(root); applyPreset(form); refreshCustomPresetSelect(form); updateCombatSections(form); renderActivationTraitPicker(form); updateRuleHelp(form); updateCheckPreview(form); enablePktCompositionBuilder(form); updatePktModelPriceMode(form); renderPktModelManager(form); updatePreview(form);
  root.querySelectorAll("[data-cic-close]").forEach(n=>n.addEventListener("click",()=>closeModal(root)));
  root.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>{ root.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b===button)); root.querySelectorAll("[data-pane]").forEach(p=>p.classList.toggle("active",p.dataset.pane===button.dataset.tab)); if(button.dataset.tab==="preview") updatePreview(form); }));
  root.querySelectorAll("[data-preview-subtab]").forEach(button=>button.addEventListener("click",()=>{ const key=button.dataset.previewSubtab; root.querySelectorAll("[data-preview-subtab]").forEach(b=>b.classList.toggle("active",b===button)); root.querySelectorAll("[data-preview-subpane]").forEach(p=>p.classList.toggle("active",p.dataset.previewSubpane===key)); updatePreview(form); }));
  root.querySelector("[data-roll-total-stress]")?.addEventListener("click",()=>void rollPktTotalStress(form));
  root.querySelector("[data-apply-total-model-price]")?.addEventListener("click",()=>{ const totals=pktPreviewTotals(form); if(form.elements.pktModelPrice){ if(form.elements.pktModelAutoPrice) form.elements.pktModelAutoPrice.checked=false; form.elements.pktModelPrice.value=String(totals.kitPrice); updatePktModelPriceMode(form); updatePreview(form); ui.notifications.info(`Цена комплекта зафиксирована вручную: ${totals.kitPrice.toLocaleString("ru-RU")} эдди.`); } });
  form.elements.pktModelAutoPrice?.addEventListener("change",()=>{ updatePktModelPriceMode(form); updatePreview(form); });
  form.elements.pktModelPrice?.addEventListener("input",()=>{ if(form.elements.pktModelAutoPrice?.checked) updatePktModelPriceMode(form); });
  form.elements.preset.addEventListener("change",()=>{applyPreset(form);updatePreview(form);}); form.elements.templateKey.addEventListener("change",()=>void loadTemplateIntoForm(form)); form.elements.itemDocumentType?.addEventListener("change",()=>{updateCombatSections(form);updatePreview(form);}); form.elements.rulePreset.addEventListener("change",()=>updateRuleHelp(form));
  initCatalogPickers(form);
  form.elements.priceEddies?.addEventListener("input",()=>{ const modelPrice=form.elements.pktModelPrice; if(!form.elements.pktModelAutoPrice?.checked && modelPrice && Math.max(0,Number(modelPrice.value)||0)===0) modelPrice.value=String(Math.max(0,Number(form.elements.priceEddies.value)||0) || ""); });
    root.querySelectorAll("[data-stress]").forEach(b=>b.addEventListener("click",()=>setStress(form,b.dataset.stress)));
  root.querySelectorAll("[data-flat-dc]").forEach(b=>b.addEventListener("click",()=>{ form.elements.checkType.value="flat"; form.elements.checkDc.value=b.dataset.flatDc; form.elements.checkAgainst.value=""; if(!form.elements.checkLabel.value) form.elements.checkLabel.value=""; updateCheckPreview(form); }));
  root.querySelectorAll("[data-main-check-dc]").forEach(b=>b.addEventListener("click",()=>{ form.elements.checkSyntax.value=`@Check[flat|dc:${b.dataset.mainCheckDc}|showDC:all]`; updatePreview(form); }));
  root.querySelector("[data-apply-check-main]")?.addEventListener("click",()=>{form.elements.checkSyntax.value=buildCheckSyntax(form);updatePreview(form);});
  root.querySelector("[data-pick-image]")?.addEventListener("click",()=>void pickImage(form));
  root.querySelector("[data-pick-effect-image]")?.addEventListener("click",()=>void pickEffectImage(form));
  form.elements.activationTraitSearch?.addEventListener("input",()=>renderActivationTraitPicker(form));
  form.elements.activationTraitSelect?.addEventListener("change",()=>{ const trait=form.elements.activationTraitSelect.value; if(trait) addActivationTrait(form,trait); });
  root.querySelector("[data-add-activation-trait]")?.addEventListener("click",()=>{ const trait=form.elements.activationTraitSelect?.value; if(!trait) return ui.notifications.warn("Выберите trait из списка."); addActivationTrait(form,trait); });
  root.querySelector("[data-add-custom-activation-trait]")?.addEventListener("click",()=>{ const trait=String(form.elements.activationTraitCustom?.value||"").trim(); if(!trait) return ui.notifications.warn("Введите slug собственного trait."); addActivationTrait(form,trait); form.elements.activationTraitCustom.value=""; });
  form.elements.activationTraitCustom?.addEventListener("keydown",(event)=>{ if(event.key!=="Enter") return; event.preventDefault(); const trait=String(form.elements.activationTraitCustom.value||"").trim(); if(trait){ addActivationTrait(form,trait); form.elements.activationTraitCustom.value=""; } });
  enableDescriptionUuidDrops(form);
  root.querySelector("[data-cic-manual]")?.addEventListener("click",()=>void openManualJournal());
  root.querySelector("[data-insert-check]")?.addEventListener("click",()=>insertTextAtCursor(form.elements.bodyHtml,buildCheckSyntax(form)));
  root.querySelector("[data-insert-roll]")?.addEventListener("click",()=>{ const f=String(form.elements.inlineFormula.value||"").trim(); if(!f) return ui.notifications.warn("Введите формулу броска."); insertTextAtCursor(form.elements.bodyHtml,`[[/r ${f}]]`); });
  root.querySelector("[data-insert-uuid]")?.addEventListener("click",()=>{ const u=String(form.elements.inlineUuid.value||"").trim(); if(!u) return ui.notifications.warn("Введите UUID."); const l=String(form.elements.inlineUuidLabel.value||"").trim(); insertTextAtCursor(form.elements.bodyHtml,`@UUID[${u}]${l?`{${l}}`:""}`); });
  root.querySelector("[data-add-rule]")?.addEventListener("click",()=>addRulePreset(form));
  root.querySelector("[data-format-rules]")?.addEventListener("click",()=>{ try{const target=form.elements.ruleTarget?.value ?? "passive";rulesFieldForTarget(form,target).value=JSON.stringify(currentRules(form,target),null,2);updatePreview(form);}catch(e){ui.notifications.error(e.message);} });
  root.querySelector("[data-clear-rules]")?.addEventListener("click",()=>{const target=form.elements.ruleTarget?.value ?? "passive";rulesFieldForTarget(form,target).value="[]";updatePreview(form);});
  root.querySelector("[data-format-activation-rules]")?.addEventListener("click",()=>{ try{form.elements.activationEffectRulesJson.value=JSON.stringify(normalizeRules(form.elements.activationEffectRulesJson.value),null,2);updatePreview(form);}catch(e){ui.notifications.error(e.message);} });
  root.querySelector("[data-clear-activation-rules]")?.addEventListener("click",()=>{form.elements.activationEffectRulesJson.value="[]";updatePreview(form);});
  root.querySelector("[data-save-preset]")?.addEventListener("click",async()=>{ const name=String(form.elements.customPresetName.value||"").trim(); if(!name) return ui.notifications.warn("Введите название пресета."); const presets=getCustomPresets(); presets[name]=serializeProfile(form); await setCustomPresets(presets); refreshCustomPresetSelect(form); form.elements.customPresetSelect.value=name; ui.notifications.info(`Пресет «${name}» сохранён.`); });
  root.querySelector("[data-load-preset]")?.addEventListener("click",()=>{ const p=getCustomPresets()[form.elements.customPresetSelect.value]; if(!p) return ui.notifications.warn("Выберите сохранённый пресет."); applyProfile(form,p); });
  root.querySelector("[data-delete-preset]")?.addEventListener("click",async()=>{ const name=form.elements.customPresetSelect.value,presets=getCustomPresets(); if(!name||!presets[name]) return; delete presets[name]; await setCustomPresets(presets); refreshCustomPresetSelect(form); ui.notifications.info(`Пресет «${name}» удалён.`); });
  root.querySelector("[data-snapshot-profile]")?.addEventListener("click",()=>{form.elements.profileJson.value=JSON.stringify(serializeProfile(form),null,2);});
  root.querySelector("[data-apply-profile]")?.addEventListener("click",()=>{try{applyProfile(form,JSON.parse(form.elements.profileJson.value));}catch(e){ui.notifications.error(`Профиль JSON: ${e.message}`);}});
  root.querySelector("[data-copy-profile]")?.addEventListener("click",async()=>{ if(!form.elements.profileJson.value.trim()) form.elements.profileJson.value=JSON.stringify(serializeProfile(form),null,2); try{await navigator.clipboard.writeText(form.elements.profileJson.value);ui.notifications.info("JSON профиля скопирован.");}catch{ui.notifications.warn("Не удалось скопировать автоматически.");} });
  form.addEventListener("input",()=>{updateCheckPreview(form);updatePreview(form);}); form.addEventListener("change",()=>{updateCheckPreview(form);updatePreview(form);});
  form.addEventListener("submit",async event=>{event.preventDefault();const submit=form.querySelector('[type="submit"]');submit.disabled=true;try{await createImplant(form);closeModal(root);}catch(error){console.error(`${MODULE_ID} | Creation failed`,error);ui.notifications.error(error.message??String(error));submit.disabled=false;}});
}

function injectItemDirectoryButton(app,html){ const root=html instanceof HTMLElement?html:html?.[0]; if(!root||root.querySelector("[data-cic-launch]"))return; const header=root.querySelector(".directory-header .header-actions, .directory-header, header"); if(!header)return; const button=document.createElement("button");button.type="button";button.dataset.cicLaunch="true";button.className="cic-launch";button.innerHTML='<i class="fa-solid fa-microchip"></i> Конструктор имплантов';button.addEventListener("click",()=>void openCreator());header.appendChild(button); }

async function migrateHiddenCapacityLabels() {
  if (!game.user?.isGM) return;
  const candidates = [
    ...(game.items ?? []),
    ...[...(game.actors ?? [])].flatMap((actor) => [...(actor.items ?? [])]),
  ];
  for (const item of candidates) {
    const html = String(item?.system?.description?.value ?? "");
    if (!html || !/(Внутренн(?:ие|их)\s+(?:слоты|места)|Внешн(?:ие|их)\s+(?:слоты|места))/iu.test(html)) continue;
    const cleaned = html
      .replace(/<p[^>]*>\s*<strong>\s*Внутренн(?:ие|их)\s+(?:слоты|места)\s*:\s*<\/strong>[^<]*<\/p>/giu, "")
      .replace(/<p[^>]*>\s*<strong>\s*Внешн(?:ие|их)\s+(?:слоты|места)\s*:\s*<\/strong>[^<]*<\/p>/giu, "");
    if (cleaned === html) continue;
    try { await item.update({ "system.description.value": cleaned }); }
    catch (error) { console.warn(`${MODULE_ID} | capacity label cleanup failed for ${item.name}`, error); }
  }
}

Hooks.once("init",()=>{
  game.settings.register(PACKAGE_ID,"implantCreatorShowDirectoryButton",{name:"Показывать кнопку конструктора в Items",hint:"Добавляет кнопку «Конструктор имплантов» в каталог предметов.",scope:"client",config:true,type:Boolean,default:true});
  game.settings.register(PACKAGE_ID,"implantCreatorCustomPresets",{name:"Пользовательские пресеты конструктора",scope:"client",config:false,type:String,default:"{}"});
  game.settings.register(PACKAGE_ID,"implantCreatorCustomPktModels",{name:"Пользовательские готовые модели ПКТ",scope:"world",config:false,type:String,default:"[]"});
  const module=game.modules.get(PACKAGE_ID);
  if(module){
    const implantCreator={
      open:openCreator,
      manual:openManualJournal,
      rulePresets:RULE_PRESETS,
      pktModels:customPktModels,
      registerPktModelFromData:registerPktModelDefinition,
      installPktModel:installCustomPktModel,
      deletePktModel:deleteCustomPktModel,
      activate:activateImplant,
      deactivate:deactivateImplant,
      createFromData:async(data)=>{
    const namespace=activeRemasterId(), source=await getTemplateSource(data.templateKey??"blank");
    const merged={name:"Новый имплант",img:"",implantType:"internal",hardCost:0,stressFormula:"0",stressDisplay:"0",stressInlineRoll:true,checkSyntax:"",slots:0,internalSlots:0,externalSlots:0,itemDocumentType:"equipment",itemLevel:0,priceEddies:0,itemSize:"med",bulkValue:0,rarity:"common",weaponCategory:"martial",weaponGrade:"commercial",weaponGroup:"brawling",weaponBaseItem:"fist",weaponBonus:0,weaponDamageDice:1,weaponDamageDie:"d6",weaponDamageType:"bludgeoning",weaponBonusDamage:0,weaponSplashDamage:0,weaponRange:null,weaponReload:"",weaponUsage:"held-in-one-hand",weaponExpend:null,weaponAmmoBaseType:"",weaponAmmoBuiltIn:false,weaponAmmoCapacity:0,weaponHardness:0,weaponHpMax:0,weaponMaterialType:"",weaponMaterialGrade:"",weaponTraits:[],weaponSystemPatch:{},armorCategory:"light",armorGrade:"commercial",armorGroup:"cloth",armorBaseItem:"",armorAcBonus:1,armorDexCap:3,armorCheckPenalty:0,armorSpeedPenalty:0,armorStrength:0,armorHardness:0,armorHpMax:0,armorMaterialType:"",armorMaterialGrade:"",armorTraits:[],armorSystemPatch:{},bodyHtml:"",traits:[],grantItemUuids:[],rules:[],replaceTemplateRules:true,installed:false,pktOnly:false,pktBody:false,pktBiosystem:false,pktReplaceable:false,pktReplaceableBase:true,pktQuality:0,pktComponentQuality:0,exclusiveFamily:"",pktFamily:"",pktParentFamily:"",humanityEnabled:false,humanityMode:"add",humanityValue:0,humanityLabel:"",activationEnabled:false,activationName:"Активировать",activationActionType:"action1",activationTraits:"",activationRequirements:"",activationTrigger:"",activationFrequency:"unlimited",activationFrequencyMax:1,activationDurationValue:1,activationDurationUnit:"rounds",activationExpiry:"",activationEffectName:"",activationEffectImg:"",activationEffectDescription:"",activationGrantItemUuids:[],activationEffectRules:[],activationEffectTokenIcon:true,activationChatMessage:true,activationShowOnSheet:true,...data};
    applyCyberwareData(source,merged,namespace);
    let created;
    if(merged.actorId){ const actor=game.actors.get(merged.actorId); if(!actor) throw new Error("Выбранный персонаж не найден."); [created]=await actor.createEmbeddedDocuments("Item",[source]); }
    else created=await Item.create(source,{renderSheet:false});
    if(!created) throw new Error("Foundry не вернул созданный Item.");
    if(created.parent) await syncActivationActionForImplant(created);
    if(merged.pktRegisterModel) await registerPktModelDefinition(merged,created);
    return created;
      }
    };
    module.api={...(module.api ?? {}), implantCreator};
  }
  globalThis.CyberpunkRemaster={
    ...(globalThis.CyberpunkRemaster ?? {}),
    implantCreator:()=>openCreator(),
  };
});
Hooks.once("ready",()=>{
  installGlobalPktDeleteHandler();
  const active=REMASTER_IDS.find(id=>game.modules.get(id)?.active);
  if(!active) ui.notifications.warn("Конструктор имплантов: Cyberpunk Remaster не активен. Предметы будут создаваться с legacy-флагами cyberpunk-remaster.");
  void ensureManualJournal().catch((error)=>console.error(`${MODULE_ID} | manual journal creation failed`,error));
  void migrateCustomPktModelPrices().catch((error)=>console.error(`${MODULE_ID} | PKT price migration failed`,error));
  if (!installNativePktBridge()) console.warn(`${MODULE_ID} | native PKT bridge is waiting for Remaster API`);
  void migrateInstalledCustomPktComponentPolicies().catch((error)=>console.error(`${MODULE_ID} | custom PKT component policy migration failed`,error));
  void migrateCreatorWorldReplacementBases().catch((error)=>console.error(`${MODULE_ID} | creator replacement base migration failed`,error));
  void migrateHiddenCapacityLabels().catch((error)=>console.error(`${MODULE_ID} | hidden capacity label migration failed`,error));
});
Hooks.on(`${MODULE_ID}:pktModelsChanged`,()=>{ refreshNativePktCatalogs(); const form=document.querySelector(".cic-root form"); if(form) renderPktModelManager(form); });
Hooks.on("renderItemDirectory",(app,html)=>{if(game.settings.get(PACKAGE_ID,"implantCreatorShowDirectoryButton"))injectItemDirectoryButton(app,html);});
Hooks.on("renderItemDirectoryV2",(app,html)=>{if(game.settings.get(PACKAGE_ID,"implantCreatorShowDirectoryButton"))injectItemDirectoryButton(app,html);});
Hooks.on("renderItemSheet",(app,html)=>injectActivationControls(app,html));
Hooks.on("renderItemSheetV2",(app,html)=>injectActivationControls(app,html));
Hooks.on("renderActorSheet",(app,html)=>{
  enhanceNativeCustomPktCards(app,html);
  enhanceNativeCustomPktReplacementSelects(app,html);
  enhanceInstalledCustomBaseCapacities(app,html);
  enhanceGlobalImplantCapacityLabels(app,html);
  requestAnimationFrame(()=>{ enhanceNativeCustomPktCards(app,html); enhanceNativeCustomPktReplacementSelects(app,html); enhanceInstalledCustomBaseCapacities(app,html); enhanceGlobalImplantCapacityLabels(app,html); });
  setTimeout(()=>enhanceGlobalImplantCapacityLabels(app,html),100);
  const actor=app?.actor ?? app?.document ?? app?.object;
  observeActorActivationControls(app,html);
  if(actor?.items) void ensureActorActivationActions(actor).then((changed)=>{
    if(changed) app?.render?.(false);
    requestAnimationFrame(()=>injectActorActivationControls(app,html));
    setTimeout(()=>injectActorActivationControls(app,html),120);
  }).catch((error)=>console.error(`${MODULE_ID} | action sync failed`,error));
});
Hooks.on("renderActorSheetV2",(app,html)=>{
  enhanceNativeCustomPktCards(app,html);
  enhanceNativeCustomPktReplacementSelects(app,html);
  enhanceInstalledCustomBaseCapacities(app,html);
  enhanceGlobalImplantCapacityLabels(app,html);
  requestAnimationFrame(()=>{ enhanceNativeCustomPktCards(app,html); enhanceNativeCustomPktReplacementSelects(app,html); enhanceInstalledCustomBaseCapacities(app,html); enhanceGlobalImplantCapacityLabels(app,html); });
  setTimeout(()=>enhanceGlobalImplantCapacityLabels(app,html),100);
  const actor=app?.actor ?? app?.document ?? app?.object;
  observeActorActivationControls(app,html);
  if(actor?.items) void ensureActorActivationActions(actor).then((changed)=>{
    if(changed) app?.render?.(false);
    requestAnimationFrame(()=>injectActorActivationControls(app,html));
    setTimeout(()=>injectActorActivationControls(app,html),120);
  }).catch((error)=>console.error(`${MODULE_ID} | action sync failed`,error));
});
Hooks.on("preCreateItem",(item,data,options)=>checkPreCreateImplantCapacity(item,data,options));
Hooks.on("preUpdateItem",(item,changes)=>checkPreUpdateImplantCapacity(item,changes));
Hooks.on("createItem",(item)=>{
  if(!item?.parent) return;
  if(item.type === "effect" && item.flags?.[MODULE_ID]?.activationEffect === true) {
    requestAnimationFrame(()=>{
      for (const control of document.querySelectorAll(`[data-cic-actor-activate][data-cic-actor-id="${item.parent.id}"]`)) {
        const source=item.parent.items.get(control.dataset.cicSourceItemId);
        const action=item.parent.items.get(control.dataset.cicActionItemId);
        if(source && action) updateActorActivationControl(control,source,action);
      }
    });
    return;
  }
  void syncActivationActionForImplant(item).catch((error)=>console.error(`${MODULE_ID} | create action sync failed`,error));
});
Hooks.on("updateItem",(item)=>{
  if(!item?.parent) return;
  if(item.type === "action" && item.flags?.[MODULE_ID]?.activationAction === true) {
    // Частота Action могла измениться от отдыха, ручного восстановления или иной системной механики.
    // Не синхронизируем её обратно с импланта: текущее system.frequency.value — источник истины.
    requestAnimationFrame(()=>{
      for (const control of document.querySelectorAll(`[data-cic-actor-activate][data-cic-actor-id="${item.parent.id}"]`)) {
        const source=item.parent.items.get(control.dataset.cicSourceItemId);
        const action=item.parent.items.get(control.dataset.cicActionItemId);
        if(source && action) updateActorActivationControl(control,source,action);
      }
    });
    return;
  }
  void syncActivationActionForImplant(item).catch((error)=>console.error(`${MODULE_ID} | update action sync failed`,error));
});
Hooks.on("deleteItem",(item)=>{
  const actor=item?.parent;
  if(!actor?.items) return;
  if(item.type === "effect" && item.flags?.[MODULE_ID]?.activationEffect === true) {
    requestAnimationFrame(()=>{
      for (const control of document.querySelectorAll(`[data-cic-actor-activate][data-cic-actor-id="${actor.id}"]`)) {
        const source=actor.items.get(control.dataset.cicSourceItemId);
        const action=actor.items.get(control.dataset.cicActionItemId);
        if(source && action) updateActorActivationControl(control,source,action);
      }
    });
    return;
  }
  if(item.type==="action") return;
  const action=actor.items.find((candidate)=>candidate.type==="action" && candidate.flags?.[MODULE_ID]?.activationSourceItemId===item.id);
  if(action) void action.delete().catch((error)=>console.error(`${MODULE_ID} | delete linked action failed`,error));
});

export { openCreator, createImplant, applyCyberwareData, activateImplant, deactivateImplant, syncActivationActionForImplant, installCustomPktModel, registerPktModelDefinition, customPktModels, RULE_PRESETS };
