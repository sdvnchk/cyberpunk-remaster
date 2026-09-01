export const NONMAGICAL_SKILL_SLUGS = Object.freeze([
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

const SKILL_LABELS_RU = Object.freeze({
  acrobatics: "Акробатика",
  athletics: "Атлетика",
  computers: "Компьютеры",
  crafting: "Ремесло",
  deception: "Обман",
  diplomacy: "Дипломатия",
  intimidation: "Запугивание",
  medicine: "Медицина",
  performance: "Выступление",
  piloting: "Пилотирование",
  society: "Общество",
  stealth: "Скрытность",
  survival: "Выживание",
  thievery: "Воровство",
});

export const ATTRIBUTE_OPTIONS = Object.freeze([
  { slug: "str", label: "Сила", short: "Сил" },
  { slug: "dex", label: "Ловкость", short: "Лвк" },
  { slug: "con", label: "Телосложение", short: "Тел" },
  { slug: "int", label: "Интеллект", short: "Инт" },
  { slug: "wis", label: "Мудрость", short: "Мдр" },
  { slug: "cha", label: "Харизма", short: "Хар" },
]);

export const ATTRIBUTE_OVERRIDE_TIERS = Object.freeze([
  { value: "auto", label: "Авто — Кто это + роль" },
  { value: "terrible", label: "Очень низкий" },
  { value: "low", label: "Низкий" },
  { value: "moderate", label: "Средний" },
  { value: "high", label: "Высокий" },
  { value: "extreme", label: "Экстремальный" },
  { value: "custom", label: "Свое значение" },
]);

export const SAVE_OPTIONS = Object.freeze([
  { slug: "fortitude", label: "Стойкость", short: "Стойк", ability: "con", abilityLabel: "Тел" },
  { slug: "reflex", label: "Рефлекс", short: "Реф", ability: "dex", abilityLabel: "Лвк" },
  { slug: "will", label: "Воля", short: "Воля", ability: "wis", abilityLabel: "Мдр" },
]);

export const SAVE_OVERRIDE_TIERS = Object.freeze([
  { value: "auto", label: "Авто — от атрибута + профиля" },
  { value: "terrible", label: "Очень низкий" },
  { value: "low", label: "Низкий" },
  { value: "moderate", label: "Средний" },
  { value: "high", label: "Высокий" },
  { value: "extreme", label: "Экстремальный" },
  { value: "custom", label: "Свое значение" },
]);

export const SKILL_ABILITY_MAP = Object.freeze({
  acrobatics: "dex",
  athletics: "str",
  computers: "int",
  crafting: "int",
  deception: "cha",
  diplomacy: "cha",
  intimidation: "cha",
  medicine: "wis",
  performance: "cha",
  piloting: "dex",
  society: "int",
  stealth: "dex",
  survival: "wis",
  thievery: "dex",
});

export const SKILL_OVERRIDE_TIERS = Object.freeze([
  { value: "auto", label: "Авто" },
  { value: "none", label: "Не добавлять" },
  { value: "terrible", label: "Очень низкий" },
  { value: "low", label: "Низкий" },
  { value: "moderate", label: "Средний" },
  { value: "high", label: "Высокий" },
  { value: "extreme", label: "Экстремальный" },
]);

function configuredSkillLabel(slug) {
  const configured = globalThis.CONFIG?.PF2E?.skills?.[slug];
  const key = typeof configured === "string" ? configured : configured?.label;
  if (key) {
    const localized = globalThis.game?.i18n?.localize?.(key);
    if (localized && localized !== key) return localized;
  }
  return SKILL_LABELS_RU[slug] ?? slug;
}

export function forgeSkillOptions() {
  const available = globalThis.CONFIG?.PF2E?.skills;
  const allowed = available && typeof available === "object"
    ? NONMAGICAL_SKILL_SLUGS.filter((slug) => Object.hasOwn(available, slug))
    : [...NONMAGICAL_SKILL_SLUGS];
  return allowed.map((slug) => ({ slug, label: configuredSkillLabel(slug) }));
}

export const NONMAGICAL_ABILITY_TEMPLATES = Object.freeze([
  {
    id: "reactive-strike",
    label: "Реагирующий удар",
    actionType: "reaction",
    actions: null,
    category: "offensive",
    traits: "",
    description:
      "<p><strong>Триггер:</strong> Существо в досягаемости использует действие с признаком @Trait[move]{движение} или @Trait[manipulate]{воздействие}, совершает дистанционную атаку либо покидает квадрат во время своего действия движения.</p><p><strong>Эффект:</strong> NPC совершает ближний Удар по спровоцировавшему существу. Если атака является критическим попаданием и действие имело признак @Trait[manipulate]{воздействие}, действие прерывается.</p>",
    rules: "[]",
  },
  {
    id: "suppressive-burst",
    label: "Подавляющий огонь",
    actionType: "action",
    actions: 2,
    category: "offensive",
    traits: "attack,tech",
    description:
      "<p>NPC ведёт контролируемый огонь по выбранной зоне. Существа в зоне проходят @Check[reflex|dc:{dc}|basic]. При провале они получают @Damage[{damage}[piercing]] урона; при критическом провале дополнительно становятся застигнуты врасплох до начала следующего хода NPC.</p>",
    rules: "[]",
  },
  {
    id: "combat-slide",
    label: "Боевой рывок",
    actionType: "action",
    actions: 1,
    category: "offensive",
    traits: "move",
    description:
      "<p>NPC Перемещается вплоть до половины своей Скорости. Это перемещение не провоцирует реакции, вызванные только перемещением, если NPC заканчивает его в укрытии или рядом с союзником.</p>",
    rules: "[]",
  },
  {
    id: "thermal-camouflage",
    label: "Термальный камуфляж",
    actionType: "action",
    actions: 1,
    category: "defensive",
    traits: "concentrate,tech",
    frequencyPer: "PT1H",
    frequencyMax: 1,
    description:
      "<p>До начала следующего хода NPC получает обстоятельственный бонус +2 к Скрытности против визуальных и тепловых сенсоров. Эффект заканчивается, если NPC совершает враждебное действие.</p>",
    rules: "[]",
  },
  {
    id: "pulse-radar",
    label: "Импульсная радиолокация",
    actionType: "passive",
    actions: null,
    category: "interaction",
    traits: "tech",
    description:
      "<p>При активном радиолокационном модуле NPC может использовать Восприятие для обнаружения движущихся объектов, даже если обычное зрение затруднено дымом или слабым освещением. Твёрдые преграды по-прежнему блокируют обнаружение.</p>",
    rules: "[]",
  },
  {
    id: "tactical-link",
    label: "Тактический канал",
    actionType: "passive",
    actions: null,
    category: "interaction",
    traits: "auditory,tech",
    description:
      "<p>Пока NPC поддерживает связь с союзниками, он может передавать им наблюдаемую информацию без необходимости кричать. Это не даёт числового бонуса само по себе, но позволяет использовать способности, требующие связи, через защищённый канал.</p>",
    rules: "[]",
  },
  {
    id: "field-triage",
    label: "Полевая сортировка",
    actionType: "action",
    actions: 2,
    category: "interaction",
    traits: "healing,manipulate,tech",
    description:
      "<p>NPC оказывает экстренную помощь себе или соседнему живому существу. Цель восстанавливает @Damage[{healing}[vitality,healing]] ОЗ и становится временно невосприимчива к этой способности на 10 минут.</p>",
    rules: "[]",
  },
  {
    id: "hardwired-discipline",
    label: "Жёсткая дисциплина",
    actionType: "passive",
    actions: null,
    category: "defensive",
    traits: "mental,tech",
    description:
      "<p>NPC получает обстоятельственный бонус +1 к спасброскам Воли против эффектов страха и принуждения.</p>",
    rules: '[{"key":"FlatModifier","selector":"will","type":"circumstance","value":1,"predicate":["item:trait:fear"]}]',
  },
  {
    id: "threat-scan",
    label: "Скан угроз",
    actionType: "action", actions: 1, category: "interaction", traits: "concentrate,tech",
    description: "<p>NPC сканирует сектор. Совершите @Check[perception|dc:{dc}]. При успехе ведущий сообщает наиболее заметную вооружённую, скрытую или техническую угрозу в зоне видимости; до начала следующего хода NPC получает +1 обстоятельства к первой атаке по выявленной цели.</p>", rules: "[]",
  },
  {
    id: "target-lock",
    label: "Захват цели",
    actionType: "action", actions: 1, category: "offensive", traits: "concentrate,tech",
    description: "<p>Выберите видимую цель. До конца хода NPC игнорирует 1 пункт обстоятельственного штрафа к дальнобойным атакам по этой цели от дистанции, дыма или частичного укрытия.</p>", rules: "[]",
  },
  {
    id: "gyro-stabilizer",
    label: "Гиростабилизатор",
    actionType: "passive", actions: null, category: "offensive", traits: "tech",
    description: "<p>Если NPC не Перемещался с начала своего хода, первая атака дальнобойным оружием получает обстоятельственный бонус +1.</p>", rules: "[]",
  },
  {
    id: "pain-editor",
    label: "Подавление боли",
    actionType: "reaction", actions: null, category: "defensive", traits: "concentrate,tech",
    frequencyPer: "round", frequencyMax: 1,
    description: "<p><strong>Триггер:</strong> NPC получает урон. <strong>Эффект:</strong> до начала следующего хода он получает обстоятельственный бонус +1 к спасброскам против эффектов, вызванных болью, страхом или шоком.</p>", rules: "[]",
  },
  {
    id: "emergency-reboot",
    label: "Аварийная перезагрузка",
    actionType: "action", actions: 2, category: "defensive", traits: "concentrate,tech",
    frequencyPer: "PT10M", frequencyMax: 1,
    description: "<p>NPC перезапускает локальные системы. Он получает новую попытку проверки против одного технического эффекта, помехи или состояния, которое допускает повторную проверку; используйте @Check[flat|dc:10].</p>", rules: "[]",
  },
  {
    id: "smoke-break",
    label: "Дымовой разрыв",
    actionType: "action", actions: 2, category: "defensive", traits: "manipulate,tech",
    description: "<p>NPC разворачивает дымовую завесу в небольшой зоне. До начала его следующего хода существа за завесой имеют сокрытие для визуальных атак, если атакующий не обладает подходящим сенсором.</p>", rules: "[]",
  },
  {
    id: "shock-grapple",
    label: "Шоковый захват",
    actionType: "action", actions: 2, category: "offensive", traits: "attack,manipulate,tech",
    description: "<p>NPC совершает проверку @Check[athletics] против КС Стойкости соседней цели. При успехе цель схвачена до конца следующего хода NPC; при критическом успехе дополнительно получает @Damage[1d6[electricity]] урона.</p>", rules: "[]",
  },
  {
    id: "counter-sniper",
    label: "Контрснайперский анализ",
    actionType: "reaction", actions: null, category: "defensive", traits: "concentrate,tech",
    description: "<p><strong>Триггер:</strong> NPC становится целью дальней атаки. <strong>Эффект:</strong> NPC получает обстоятельственный бонус +1 к КБ против этой атаки и сразу узнаёт направление, из которого она была совершена, если сенсоры способны его определить.</p>", rules: "[]",
  },
  {
    id: "combat-stim",
    label: "Боевой стим",
    actionType: "free", actions: null, category: "offensive", traits: "tech",
    frequencyPer: "PT1H", frequencyMax: 1,
    description: "<p>До конца текущего хода Скорость NPC увеличивается на 5 футов, а первая проверка Атлетики получает обстоятельственный бонус +1.</p>", rules: "[]",
  },
  {
    id: "breach-charge",
    label: "Брич-заряд",
    actionType: "action", actions: 2, category: "offensive", traits: "manipulate,tech",
    description: "<p>NPC устанавливает или активирует направленный заряд на двери, укрытии или неподвижном объекте. Совершите @Check[crafting|dc:{dc}]. При успехе объект получает @Damage[{damage}[fire]] урона, игнорируя 5 Твёрдости.</p>", rules: "[]",
  },
  {
    id: "combat-mark",
    label: "Тактическая метка",
    actionType: "action", actions: 1, category: "interaction", traits: "concentrate,tech",
    description: "<p>NPC передаёт союзникам координаты видимой цели. До начала следующего хода первый союзник, попавший по этой цели, получает обстоятельственный бонус +1 к броску атаки.</p>", rules: "[]",
  },
  {
    id: "jammer-burst",
    label: "Импульс помех",
    actionType: "action", actions: 2, category: "defensive", traits: "concentrate,tech",
    frequencyPer: "PT10M", frequencyMax: 1,
    description: "<p>В радиусе 20 футов связь и незащищённая телеметрия перегружаются до начала следующего хода NPC. Для точного дистанционного управления устройством требуется @Check[computers|dc:{dc}].</p>", rules: "[]",
  },
  {
    id: "false-telemetry",
    label: "Ложная телеметрия",
    actionType: "action", actions: 1, category: "interaction", traits: "concentrate,tech",
    description: "<p>NPC создаёт правдоподобный ложный пакет данных. Совершите @Check[computers|dc:{dc}]. При успехе один автоматический сенсор или оператор получает ошибочную метку положения до проверки данных другим способом.</p>", rules: "[]",
  },
  {
    id: "rapid-triage",
    label: "Экстренная реанимация",
    actionType: "action", actions: 2, category: "interaction", traits: "healing,manipulate,tech",
    frequencyPer: "PT10M", frequencyMax: 1,
    description: "<p>Соседняя живая цель восстанавливает @Damage[{healing}[vitality,healing]] ОЗ. Если цель без сознания из-за текущих ОЗ, она также получает обстоятельственный бонус +1 к следующей проверке восстановления.</p>", rules: "[]",
  },
  {
    id: "armor-lock",
    label: "Блокировка сервоприводов",
    actionType: "reaction", actions: null, category: "defensive", traits: "tech",
    frequencyPer: "round", frequencyMax: 1,
    description: "<p><strong>Триггер:</strong> NPC должен быть принудительно перемещён. <strong>Эффект:</strong> уменьшите принудительное перемещение на 5 футов (минимум 0).</p>", rules: "[]",
  },
  {
    id: "threat-display",
    label: "Демонстрация угрозы",
    actionType: "action", actions: 1, category: "interaction", traits: "auditory,mental",
    description: "<p>NPC демонстрирует оружие, хром или тактическое превосходство и совершает @Check[intimidation] для Деморализации. При успехе он может выбрать не повышать степень страха, а заставить цель отступить на 5 футов, если она способна двигаться.</p>", rules: "[]",
  },
  {
    id: "crossfire-step",
    label: "Перестроение под перекрёстный огонь",
    actionType: "reaction", actions: null, category: "defensive", traits: "move",
    description: "<p><strong>Триггер:</strong> союзник попадает дальнобойной атакой по существу в 30 футах. <strong>Эффект:</strong> NPC Шагает до 5 футов, если заканчивает перемещение в укрытии или на позиции, с которой видит ту же цель.</p>", rules: "[]",
  },
  {
    id: "drone-designator",
    label: "Дроновый целеуказатель",
    actionType: "action", actions: 1, category: "interaction", traits: "concentrate,tech",
    description: "<p>При наличии управляемого дрона или камеры NPC отмечает цель. До начала следующего хода он получает обстоятельственный бонус +1 к Восприятию для Поиска этой цели и не теряет метку только из-за слабого освещения.</p>", rules: "[]",
  },
  {
    id: "hard-cover",
    label: "Жёсткое укрытие",
    actionType: "reaction", actions: null, category: "defensive", traits: "move",
    description: "<p><strong>Триггер:</strong> NPC становится целью дальнобойной атаки и находится рядом с укрытием. <strong>Эффект:</strong> NPC немедленно использует укрытие и получает его обычный бонус к КБ против спровоцировавшей атаки.</p>", rules: "[]",
  },
  {
    id: "pursuit-protocol",
    label: "Протокол преследования",
    actionType: "passive", actions: null, category: "interaction", traits: "tech",
    description: "<p>NPC получает обстоятельственный бонус +1 к Выживанию и Пилотированию при преследовании уже идентифицированной цели через городскую инфраструктуру.</p>", rules: '[{"key":"FlatModifier","selector":["survival","piloting"],"type":"circumstance","value":1}]',
  },
]);

export function abilityTemplateOptions() {
  return NONMAGICAL_ABILITY_TEMPLATES.map((entry) => ({
    id: entry.id,
    label: entry.label,
  }));
}

export function abilityTemplate(id) {
  return NONMAGICAL_ABILITY_TEMPLATES.find((entry) => entry.id === id) ?? null;
}
