import { DEFAULT_FORM } from "./constants.mjs";
import { NONMAGICAL_SKILL_SLUGS } from "./customization.mjs";
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
      crafting: "high",
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
  merchant: role({
    label: "Торговец",
    description: "Продавец, владелец лавки или посредник, привыкший торговаться и читать клиента.",
    abilities: { cha: "high", int: "high", wis: "moderate", str: "low" },
    tiers: { ac: "low", hp: "low", attack: "low", damage: "low", perception: "moderate", will: "moderate" },
    skills: { diplomacy: "high", society: "high", deception: "moderate" },
    feature: {
      name: "Знает рынок",
      description: "<p>Торговец получает обстоятельственный бонус +1 к Дипломатии и Обществу при оценке сделки, цены или доступности товара.</p>",
    },
  }),
  driver: role({
    label: "Водитель",
    description: "Курьер, таксист или профессиональный водитель, который знает дороги и умеет уходить от неприятностей.",
    abilities: { dex: "high", wis: "high", int: "moderate", str: "low" },
    tiers: { ac: "moderate", hp: "low", attack: "low", damage: "low", perception: "high", reflex: "high" },
    skills: { piloting: "high", survival: "moderate", society: "moderate" },
    initiative: "perception",
    feature: {
      name: "Городские маршруты",
      description: "<p>Водитель получает обстоятельственный бонус +1 к Пилотированию при движении по знакомой городской инфраструктуре.</p>",
    },
  }),
  laborer: role({
    label: "Рабочий",
    description: "Физический работник производства, стройки, склада или коммунальной службы.",
    abilities: { str: "high", con: "high", dex: "moderate", int: "low" },
    tiers: { ac: "low", hp: "moderate", attack: "low", damage: "low", fortitude: "high", reflex: "low" },
    skills: { athletics: "high", crafting: "moderate" },
    feature: {
      name: "Рабочая сноровка",
      description: "<p>Рабочий получает обстоятельственный бонус +1 к Атлетике или Ремеслу при выполнении рутинной физической профессиональной работы.</p>",
    },
  }),
  service: role({
    label: "Сфера услуг",
    description: "Бармен, официант, администратор, работник клуба или гостиницы.",
    abilities: { cha: "high", wis: "high", dex: "moderate", str: "low" },
    tiers: { ac: "low", hp: "low", attack: "low", damage: "low", perception: "moderate", will: "moderate" },
    skills: { diplomacy: "high", society: "high", deception: "moderate" },
    feature: {
      name: "Работа с людьми",
      description: "<p>Получает обстоятельственный бонус +1 к Дипломатии при обслуживании, успокоении или перенаправлении клиента.</p>",
    },
  }),
  clerk: role({
    label: "Офисный специалист",
    description: "Клерк, диспетчер, бухгалтер или оператор корпоративной инфраструктуры.",
    abilities: { int: "high", cha: "moderate", wis: "moderate", str: "low" },
    tiers: { ac: "low", hp: "low", attack: "terrible", damage: "terrible", perception: "moderate", will: "moderate", dc: "moderate" },
    skills: { society: "high", computers: "high", diplomacy: "moderate" },
    feature: {
      name: "Бюрократическая память",
      description: "<p>Получает обстоятельственный бонус +1 к Обществу или Компьютерам при поиске служебной записи, заявки, счёта или внутреннего документа.</p>",
    },
  }),
  forensic: role({
    label: "Криминалист",
    description: "Аналитик следов, повреждений, тел и цифровых улик.",
    abilities: { int: "extreme", wis: "high", dex: "moderate", str: "low" },
    tiers: { ac: "low", hp: "low", attack: "low", damage: "low", perception: "high", will: "high", dc: "high" },
    skills: { medicine: "high", crafting: "high", computers: "high", society: "moderate" },
    feature: {
      name: "Реконструкция события",
      description: "<p>Получает обстоятельственный бонус +1 к профильной проверке при исследовании места преступления или технических следов.</p>",
    },
  }),
  demolitions: role({
    label: "Подрывник",
    description: "Специалист по взрывчатке, ловушкам, разминированию и инженерному проникновению.",
    abilities: { int: "high", dex: "high", wis: "moderate", str: "moderate" },
    tiers: { ac: "moderate", hp: "moderate", attack: "moderate", damage: "high", perception: "high", reflex: "high", dc: "high" },
    skills: { crafting: "extreme", thievery: "high", computers: "moderate" },
    feature: {
      name: "Контролируемый подрыв",
      description: "<p>Получает обстоятельственный бонус +1 к Ремеслу при изготовлении, установке, обезвреживании или оценке взрывного устройства.</p>",
    },
  }),
  droneOperator: role({
    label: "Оператор дронов",
    description: "Удалённо ведёт разведку, наблюдение и техническое сопровождение через беспилотные платформы.",
    abilities: { int: "extreme", dex: "high", wis: "high", str: "low" },
    tiers: { ac: "moderate", hp: "low", attack: "moderate", damage: "low", perception: "high", reflex: "high", dc: "high" },
    skills: { computers: "extreme", piloting: "high", crafting: "high" },
    feature: {
      name: "Удалённый контур",
      description: "<p>Получает обстоятельственный бонус +1 к Компьютерам или Пилотированию при управлении дроном, камерой или удалённой платформой.</p>",
    },
  }),
  pointman: role({
    label: "Авангард",
    description: "Первым входит в опасную зону, вскрывает огневые точки и держит темп группы.",
    abilities: { str: "high", dex: "high", con: "high", wis: "moderate" },
    tiers: { ac: "high", hp: "high", attack: "high", damage: "moderate", perception: "high", fortitude: "high" },
    skills: { athletics: "high", perception: "high", intimidation: "moderate" },
    feature: { name: "Первый номер", description: "<p>В первый раунд столкновения Авангард получает обстоятельственный бонус +1 к инициативе и первой атаке по существу, которое ещё не действовало.</p>" },
  }),
  gunfighter: role({
    label: "Стрелок",
    description: "Мобильный специалист по пистолетам, ПП и коротким дистанциям.",
    abilities: { dex: "extreme", wis: "high", str: "low" },
    tiers: { ac: "high", hp: "moderate", attack: "extreme", damage: "moderate", perception: "high", reflex: "high" },
    skills: { acrobatics: "high", intimidation: "moderate", stealth: "moderate" },
    feature: { name: "Быстрая смена цели", description: "<p>После критического попадания дальнобойным оружием Стрелок может Шагнуть свободным действием.</p>" },
  }),
  breacher: role({
    label: "Бричер",
    description: "Штурмует двери, тесные помещения и укреплённые позиции.",
    abilities: { str: "high", con: "high", dex: "high", int: "moderate" },
    tiers: { ac: "high", hp: "high", attack: "high", damage: "high", fortitude: "high", dc: "high" },
    skills: { athletics: "high", crafting: "high", intimidation: "high" },
    feature: { name: "Вход с давлением", description: "<p>После разрушения, открытия или преодоления двери Бричер получает обстоятельственный бонус +1 к следующей атаке до конца своего хода.</p>" },
  }),
  bodyguard: role({
    label: "Телохранитель",
    description: "Принимает угрозу на себя и удерживает противника подальше от охраняемой цели.",
    abilities: { str: "high", con: "extreme", wis: "high", dex: "moderate" },
    tiers: { ac: "extreme", hp: "high", attack: "moderate", damage: "moderate", perception: "high", fortitude: "high", will: "high" },
    skills: { athletics: "high", perception: "high", intimidation: "moderate" },
    feature: { name: "Закрыть клиента", description: "<p>Реакция: когда соседний союзник становится целью атаки, Телохранитель может Шагнуть к нему; если после этого он находится между источником атаки и союзником, союзник получает обстоятельственный бонус +1 к КБ против этой атаки.</p>" },
  }),
  scout: role({
    label: "Разведчик",
    description: "Ищет угрозы, отмечает маршруты и передаёт группе безопасные окна движения.",
    abilities: { dex: "high", wis: "extreme", int: "moderate", str: "low" },
    tiers: { ac: "moderate", hp: "low", attack: "high", damage: "moderate", perception: "extreme", reflex: "high" },
    skills: { stealth: "high", survival: "extreme", acrobatics: "moderate" },
    initiative: "stealth",
    feature: { name: "Передовой обзор", description: "<p>Разведчик получает обстоятельственный бонус +1 к Восприятию при Поиске засад, скрытых наблюдателей и технических датчиков.</p>" },
  }),
  controller: role({
    label: "Контролёр",
    description: "Лишает противника пространства: дым, несмертельные средства, подавление и контроль проходов.",
    abilities: { wis: "high", dex: "high", con: "high", int: "moderate" },
    tiers: { ac: "high", hp: "moderate", attack: "high", damage: "low", perception: "high", will: "high", dc: "extreme" },
    skills: { athletics: "moderate", intimidation: "high", society: "moderate" },
    feature: { name: "Контроль сектора", description: "<p>Существа, впервые за раунд входящие в отмеченный Контролёром проход или зону подавления, получают штраф обстоятельства −1 к первой атаке до начала своего следующего хода.</p>" },
  }),
  suppressor: role({
    label: "Подавитель",
    description: "Ведёт плотный огонь и не даёт противнику свободно менять позицию.",
    abilities: { str: "high", dex: "high", con: "high" },
    tiers: { ac: "moderate", hp: "high", attack: "high", damage: "high", fortitude: "high", dc: "high" },
    skills: { athletics: "high", intimidation: "high" },
    feature: { name: "Прижать к укрытию", description: "<p>После применения способности с признаком attack по области выбранная цель, провалившая защитную проверку, не может использовать реакции до начала своего следующего хода.</p>" },
  }),
  saboteur: role({
    label: "Саботажник",
    description: "Ломает инфраструктуру, отключает сигнализацию и оставляет после себя технические ловушки.",
    abilities: { int: "extreme", dex: "high", wis: "high", str: "low" },
    tiers: { ac: "moderate", hp: "low", attack: "moderate", damage: "high", perception: "high", reflex: "high", dc: "extreme" },
    skills: { crafting: "extreme", thievery: "extreme", computers: "high", stealth: "high" },
    initiative: "stealth",
    feature: { name: "Подготовленная диверсия", description: "<p>Саботажник получает обстоятельственный бонус +1 к Ремеслу, Воровству и Компьютерам при отключении, подмене или минировании устройства.</p>" },
  }),
  hunter: role({
    label: "Охотник",
    description: "Выслеживает конкретную цель, читает маршруты отхода и не теряет контакт после первой стычки.",
    abilities: { wis: "extreme", dex: "high", con: "moderate", int: "moderate" },
    tiers: { ac: "moderate", hp: "moderate", attack: "high", damage: "high", perception: "extreme", will: "high" },
    skills: { survival: "extreme", stealth: "high", society: "moderate" },
    feature: { name: "Метка добычи", description: "<p>После успешного Поиска или Вспомнить информацию о цели Охотник получает обстоятельственный бонус +1 к следующей проверке Выживания для её выслеживания.</p>" },
  }),
  interrogator: role({
    label: "Дознаватель",
    description: "Давит психологически, замечает противоречия и управляет разговором.",
    abilities: { cha: "extreme", wis: "high", int: "high", str: "low" },
    tiers: { ac: "low", hp: "moderate", attack: "low", damage: "low", perception: "high", will: "extreme", dc: "extreme" },
    skills: { intimidation: "extreme", deception: "high", diplomacy: "high", society: "high" },
    feature: { name: "Линия давления", description: "<p>Дознаватель получает обстоятельственный бонус +1 к Запугиванию при Деморализации или принуждении существа, с которым говорил не менее минуты.</p>" },
  }),
  commando: role({
    label: "Коммандос",
    description: "Универсальный элитный боец для штурма, разведки и быстрого изменения задачи.",
    abilities: { str: "high", dex: "high", con: "high", wis: "high" },
    tiers: { ac: "high", hp: "high", attack: "extreme", damage: "high", perception: "high", fortitude: "high", reflex: "high", will: "high" },
    skills: { athletics: "high", stealth: "high", survival: "high", intimidation: "moderate" },
    feature: { name: "Боевой протокол", description: "<p>В начале своего хода Коммандос выбирает режим: Штурм (+1 обстоятельства к первой атаке) или Оборона (+1 обстоятельства к КБ до начала следующего хода). Режим действует один раунд.</p>" },
  }),
  support: role({
    label: "Тактическая поддержка",
    description: "Связывает сенсоры, боеприпасы, медицину и связь группы в один рабочий контур.",
    abilities: { int: "high", wis: "high", dex: "moderate", cha: "moderate" },
    tiers: { ac: "moderate", hp: "moderate", attack: "moderate", damage: "low", perception: "high", will: "high", dc: "high" },
    skills: { computers: "high", medicine: "high", crafting: "high", society: "moderate" },
    feature: { name: "Поддерживающий канал", description: "<p>Один раз за раунд после успешной проверки Компьютеров, Медицины или Ремесла Тактическая поддержка может передать союзнику обстоятельственный бонус +1 к следующей связанной проверке до начала своего следующего хода.</p>" },
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
  street: { label: "Банды", icon: "fa-solid fa-people-robbery" },
  law: { label: "Законники", icon: "fa-solid fa-shield-halved" },
  civilian: { label: "Гражданские", icon: "fa-solid fa-city" },
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
    forbidChrome: false,
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
  "specialist-ripperdoc": preset({
    label: "Риппердок", group: "specialist", icon: "fa-solid fa-user-doctor",
    description: "Хирург по имплантам: медицина, диагностика, ремонт хрома и хороший запас расходников.", level: 6,
    roles: ["medic", "technician"], weaponProfiles: ["pistol", "nonlethal", "concealable"], armorProfiles: ["none", "light"], chromeRange: [2, 5], moduleChance: 0.65, consumableRange: [4, 8], implantFamilies: ["internal", "audio", "optics", "neural", "arm"], allowUnique: true, faction: "независимый риппердок",
  }),
  "specialist-bd-tech": preset({
    label: "Техник брейнданса", group: "specialist", icon: "fa-solid fa-compact-disc",
    description: "Редактор и инженер BD: сенсорные записи, нейроинтерфейсы, анализ потоков и восстановление повреждённых дорожек.", level: 5,
    roles: ["technician", "netrunner"], weaponProfiles: ["none", "pistol", "concealable"], armorProfiles: ["none", "light"], chromeRange: [2, 5], moduleChance: 0.7, consumableRange: [1, 3], implantFamilies: ["neural", "audio", "optics"], includePrograms: true, faction: "специалист по брейндансу",
  }),
  "specialist-drone-operator": preset({
    label: "Оператор дронов", group: "specialist", icon: "fa-solid fa-helicopter",
    description: "Разведка, наблюдение и техническая поддержка через беспилотные платформы и удалённые сенсоры.", level: 6,
    roles: ["droneOperator", "technician"], weaponProfiles: ["pistol", "smg", "concealable"], armorProfiles: ["light"], chromeRange: [2, 5], moduleChance: 0.65, consumableRange: [1, 3], implantFamilies: ["neural", "audio", "optics"], includePrograms: true, faction: "оператор беспилотных систем",
  }),
  "specialist-demolitions": preset({
    label: "Сапёр / подрывник", group: "specialist", icon: "fa-solid fa-bomb",
    description: "Инженер по взрывчатке, ловушкам, разминированию и вскрытию укреплённых объектов.", level: 6,
    roles: ["demolitions", "technician"], weaponProfiles: ["pistol", "smg", "shotgun"], armorProfiles: ["light", "medium"], chromeRange: [1, 4], moduleChance: 0.55, consumableRange: [3, 7], implantFamilies: ["optics", "audio", "arm", "neural"], faction: "инженер-подрывник",
  }),
  "specialist-forensics": preset({
    label: "Криминалист", group: "specialist", icon: "fa-solid fa-fingerprint",
    description: "Исследует места преступлений, цифровые следы, повреждения и биологические улики.", level: 5,
    roles: ["forensic"], weaponProfiles: ["none", "pistol", "concealable"], armorProfiles: ["none", "light"], chromeRange: [1, 4], moduleChance: 0.55, consumableRange: [2, 5], implantFamilies: ["optics", "audio", "internal", "neural"], faction: "криминалист",
  }),
  "specialist-bodyguard": preset({
    label: "Профессиональный телохранитель", group: "specialist", icon: "fa-solid fa-user-shield",
    description: "Персональная защита VIP: наблюдение, прикрытие, эвакуация и контроль ближайших угроз.", level: 7,
    roles: ["defender", "leader", "infiltrator"], weaponProfiles: ["pistol", "smg", "concealable", "nonlethal"], armorProfiles: ["light", "medium"], chromeRange: [2, 5], moduleChance: 0.6, consumableRange: [1, 3], implantFamilies: ["optics", "audio", "neural", "arm", "internal"], faction: "частная охрана",
  }),
  "specialist-solo-merc": preset({
    label: "Соло-наёмник", group: "specialist", icon: "fa-solid fa-gun",
    description: "Опытный контрактник без жёсткой привязки к корпорации или банде.", level: 7,
    roles: ["assault", "skirmisher", "sniper", "leader"], weaponProfiles: ["rifle", "pistol", "smg", "shotgun", "sniper"], armorProfiles: ["light", "medium"], chromeRange: [2, 6], moduleChance: 0.65, consumableRange: [1, 4], implantFamilies: ["neural", "optics", "audio", "arm", "leg", "internal"], allowUnique: true, faction: "независимый соло",
  }),
  "specialist-fixer": preset({
    label: "Фиксер-посредник", group: "specialist", icon: "fa-solid fa-handshake",
    description: "Контакты, сделки, поиск дефицитного товара и организация людей, которым не стоит задавать лишних вопросов.", level: 5,
    roles: ["merchant", "leader", "civilian"], weaponProfiles: ["pistol", "concealable"], armorProfiles: ["none", "light"], chromeRange: [1, 4], moduleChance: 0.5, consumableRange: [0, 3], implantFamilies: ["audio", "neural", "optics", "fashion"], faction: "независимый фиксер",
  }),
  "specialist-nomad-driver": preset({
    label: "Номад-водитель", group: "specialist", icon: "fa-solid fa-truck-pickup",
    description: "Профессиональный водитель и полевой механик для дальних маршрутов, конвоев и опасной периферии.", level: 5,
    roles: ["driver", "technician", "skirmisher"], weaponProfiles: ["rifle", "pistol", "shotgun"], armorProfiles: ["light", "medium"], chromeRange: [1, 4], moduleChance: 0.5, consumableRange: [2, 5], implantFamilies: ["neural", "audio", "optics", "arm", "leg"], faction: "номад-специалист",
  }),
  "specialist-weaponsmith": preset({
    label: "Оружейник", group: "specialist", icon: "fa-solid fa-screwdriver-wrench",
    description: "Техник по оружию, боеприпасам и полевой модификации стрелковых систем.", level: 5,
    roles: ["technician", "demolitions"], weaponProfiles: ["pistol", "rifle", "shotgun"], armorProfiles: ["light"], chromeRange: [1, 4], moduleChance: 0.55, consumableRange: [2, 5], implantFamilies: ["optics", "audio", "arm", "neural"], faction: "оружейник",
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
  "arasaka-counterintel": preset({
    label: "Arasaka — контрразведка", group: "corporate", icon: "fa-solid fa-user-shield",
    description: "Скрытная корпоративная группа наблюдения, захвата и контрразведки.", level: 8,
    roles: ["infiltrator", "netrunner", "leader"], weaponProfiles: ["pistol", "smg", "concealable"],
    armorProfiles: ["light", "medium"], chromeRange: [3, 6], moduleChance: 0.7, consumableRange: [1, 3],
    implantFamilies: ["neural", "optics", "audio", "internal"], includePrograms: true, allowUnique: true,
    faction: "Arasaka — скрытая оперативная группа",
  }),
  "militech-strike": preset({
    label: "Militech — ударная группа", group: "corporate", icon: "fa-solid fa-person-rifle",
    description: "Военизированная корпоративная команда для силового решения задачи.", level: 9,
    roles: ["assault", "heavy", "defender", "leader"], weaponProfiles: ["rifle", "heavy", "shotgun", "pistol"],
    armorProfiles: ["medium", "heavy"], chromeRange: [3, 6], moduleChance: 0.65, consumableRange: [2, 4],
    implantFamilies: ["neural", "optics", "arm", "leg", "internal"], allowUnique: true,
    faction: "Militech — тактическое подразделение",
  }),
  "trauma-team-extraction": preset({
    label: "Trauma Team — эвакуационная группа", group: "corporate", icon: "fa-solid fa-truck-medical",
    description: "Вооружённые медики, прикрывающие экстренную эвакуацию клиента.", level: 7,
    roles: ["medic", "assault", "defender"], weaponProfiles: ["smg", "shotgun", "pistol", "nonlethal"],
    armorProfiles: ["medium", "heavy"], chromeRange: [2, 5], moduleChance: 0.55, consumableRange: [3, 6],
    implantFamilies: ["audio", "optics", "internal", "neural"], faction: "Trauma Team International",
  }),
  "biotechnica-field": preset({
    label: "Biotechnica — полевая команда", group: "corporate", icon: "fa-solid fa-dna",
    description: "Исследовательская охрана, медтехи и специалисты по опасным образцам.", level: 6,
    roles: ["technician", "medic", "assault"], weaponProfiles: ["pistol", "smg", "nonlethal"],
    armorProfiles: ["light", "medium"], chromeRange: [1, 4], moduleChance: 0.5, consumableRange: [2, 5],
    implantFamilies: ["internal", "optics", "audio", "neural"], faction: "Biotechnica — полевая служба",
  }),
  "danger-gal-team": preset({
    label: "Danger Gal — оперативники", group: "corporate", icon: "fa-solid fa-cat",
    description: "Частные следователи и охрана, работающие аккуратно и профессионально.", level: 7,
    roles: ["infiltrator", "leader", "assault", "netrunner"], weaponProfiles: ["pistol", "smg", "concealable", "nonlethal"],
    armorProfiles: ["light", "medium"], chromeRange: [2, 5], moduleChance: 0.6, consumableRange: [1, 3],
    implantFamilies: ["optics", "audio", "neural", "fashion"], includePrograms: true, faction: "Danger Gal",
  }),
  "ziggurat-security": preset({
    label: "Ziggurat — сетевая охрана", group: "corporate", icon: "fa-solid fa-server",
    description: "Охрана инфраструктуры, сетевые техники и корпоративные нетраннеры.", level: 6,
    roles: ["netrunner", "technician", "defender"], weaponProfiles: ["pistol", "smg", "nonlethal"],
    armorProfiles: ["light"], chromeRange: [2, 5], moduleChance: 0.7, consumableRange: [1, 3],
    implantFamilies: ["neural", "audio", "optics"], includePrograms: true, faction: "Ziggurat — служба инфраструктуры",
  }),
  "continental-brands-security": preset({
    label: "Continental Brands — охрана снабжения", group: "corporate", icon: "fa-solid fa-boxes-stacked",
    description: "Вооружённая охрана продовольственных складов, распределительных узлов и конвоев снабжения.", level: 5,
    roles: ["defender", "assault", "leader"], weaponProfiles: ["rifle", "shotgun", "pistol", "nonlethal"],
    armorProfiles: ["light", "medium"], chromeRange: [1, 4], moduleChance: 0.45, consumableRange: [1, 4],
    implantFamilies: ["audio", "optics", "neural", "arm"], faction: "Continental Brands — служба безопасности",
  }),
  "network54-field-team": preset({
    label: "Network 54 — новостная группа", group: "corporate", icon: "fa-solid fa-satellite-dish",
    description: "Корпоративная съёмочная группа с охраной, связистом и полевым репортёром.", level: 5,
    roles: ["leader", "infiltrator", "netrunner", "defender"], weaponProfiles: ["pistol", "concealable", "smg", "nonlethal"],
    armorProfiles: ["none", "light"], chromeRange: [1, 4], moduleChance: 0.55, consumableRange: [1, 3],
    implantFamilies: ["audio", "optics", "neural", "fashion"], includePrograms: true, faction: "Network 54",
  }),
  "petrochem-security": preset({
    label: "Petrochem — промышленная охрана", group: "corporate", icon: "fa-solid fa-oil-well",
    description: "Охрана нефтехимических объектов, трубопроводов и опасных производственных зон.", level: 7,
    roles: ["assault", "defender", "heavy", "technician"], weaponProfiles: ["rifle", "shotgun", "heavy", "pistol"],
    armorProfiles: ["medium", "heavy"], chromeRange: [2, 5], moduleChance: 0.55, consumableRange: [2, 4],
    implantFamilies: ["audio", "optics", "arm", "internal"], faction: "Petrochem — промышленная безопасность",
  }),
  "rocklin-lab-security": preset({
    label: "Rocklin Augmentics — охрана лаборатории", group: "corporate", icon: "fa-solid fa-microscope",
    description: "Служба безопасности исследовательского комплекса киберимплантов и прототипов.", level: 8,
    roles: ["assault", "defender", "technician", "netrunner"], weaponProfiles: ["smg", "rifle", "pistol", "nonlethal"],
    armorProfiles: ["light", "medium"], chromeRange: [4, 7], moduleChance: 0.75, consumableRange: [1, 3],
    implantFamilies: ["neural", "optics", "audio", "arm", "leg", "internal"], includePrograms: true, allowUnique: true,
    faction: "Rocklin Augmentics — R&D security",
  }),
  "sovoil-security": preset({
    label: "SovOil — силовая охрана", group: "corporate", icon: "fa-solid fa-industry",
    description: "Жёсткая охрана энергетических активов, складов и корпоративной инфраструктуры.", level: 8,
    roles: ["assault", "heavy", "defender", "leader"], weaponProfiles: ["rifle", "heavy", "shotgun", "pistol"],
    armorProfiles: ["medium", "heavy"], chromeRange: [2, 6], moduleChance: 0.6, consumableRange: [1, 4],
    implantFamilies: ["neural", "optics", "audio", "arm", "internal"], faction: "SovOil — силовая служба",
  }),
  "zhirafa-logistics": preset({
    label: "Zhirafa — охрана логистики", group: "corporate", icon: "fa-solid fa-truck-fast",
    description: "Техники и охрана роботизированных грузовых узлов, конвоев и складской автоматики.", level: 6,
    roles: ["technician", "defender", "assault", "netrunner"], weaponProfiles: ["pistol", "smg", "rifle", "nonlethal"],
    armorProfiles: ["light", "medium"], chromeRange: [2, 5], moduleChance: 0.6, consumableRange: [1, 3],
    implantFamilies: ["neural", "audio", "optics", "arm"], includePrograms: true, faction: "Zhirafa — логистическая безопасность",
  }),
  "arasaka-exec-guard": preset({
    label: "Arasaka — охрана руководителя", group: "corporate", icon: "fa-solid fa-user-tie",
    description: "Телохранители и контрнаблюдение для высокопоставленного корпоративного клиента.", level: 9,
    roles: ["defender", "infiltrator", "leader", "sniper"], weaponProfiles: ["pistol", "smg", "concealable", "rifle"],
    armorProfiles: ["light", "medium"], chromeRange: [3, 6], moduleChance: 0.7, consumableRange: [1, 3],
    implantFamilies: ["neural", "optics", "audio", "internal"], allowUnique: true, faction: "Arasaka — executive protection",
  }),
  "militech-recon": preset({
    label: "Militech — разведгруппа", group: "corporate", icon: "fa-solid fa-binoculars",
    description: "Мобильная разведка, целеуказание и передовая рекогносцировка перед силовой операцией.", level: 8,
    roles: ["sniper", "infiltrator", "assault", "netrunner"], weaponProfiles: ["rifle", "sniper", "smg", "pistol"],
    armorProfiles: ["light", "medium"], chromeRange: [2, 6], moduleChance: 0.65, consumableRange: [1, 3],
    implantFamilies: ["optics", "audio", "neural", "leg"], includePrograms: true, faction: "Militech — разведывательное подразделение",
  }),
  "trauma-team-critical": preset({
    label: "Trauma Team — критическая бригада", group: "corporate", icon: "fa-solid fa-heart-pulse",
    description: "Усиленная медицинская группа для извлечения клиента из зоны активного боя.", level: 9,
    roles: ["medic", "assault", "defender", "leader"], weaponProfiles: ["smg", "shotgun", "pistol", "nonlethal"],
    armorProfiles: ["medium", "heavy"], chromeRange: [2, 6], moduleChance: 0.65, consumableRange: [4, 7],
    implantFamilies: ["audio", "optics", "internal", "neural", "arm"], faction: "Trauma Team — критическое реагирование",
  }),
  "biotechnica-retrieval": preset({
    label: "Biotechnica — группа изъятия", group: "corporate", icon: "fa-solid fa-flask-vial",
    description: "Специалисты по возврату ценных биообразцов, оборудования и корпоративной интеллектуальной собственности.", level: 8,
    roles: ["infiltrator", "technician", "medic", "assault"], weaponProfiles: ["pistol", "smg", "rifle", "nonlethal"],
    armorProfiles: ["light", "medium"], chromeRange: [2, 5], moduleChance: 0.6, consumableRange: [2, 5],
    implantFamilies: ["internal", "optics", "audio", "neural"], faction: "Biotechnica — recovery team",
  }),
  "maelstrom-raider": preset({
    label: "Maelstrom — хромированный рейдер", group: "street", icon: "fa-solid fa-skull",
    description: "Тяжело хромированный боевик банды, предпочитающий агрессию и грубую силу.", level: 6,
    roles: ["assault", "heavy", "cyberpsycho"], weaponProfiles: ["smg", "shotgun", "melee", "heavy"],
    armorProfiles: ["light", "medium"], chromeRange: [4, 7], moduleChance: 0.75, consumableRange: [0, 2],
    implantFamilies: ["arm", "leg", "internal", "optics", "neural"], allowUnique: true, faction: "Maelstrom",
  }),
  "tyger-claws-crew": preset({
    label: "Tyger Claws — боевая ячейка", group: "street", icon: "fa-solid fa-dragon",
    description: "Организованная банда с быстрыми бойцами, оружием ближнего боя и стильным хромом.", level: 5,
    roles: ["skirmisher", "assault", "infiltrator"], weaponProfiles: ["melee", "pistol", "smg"],
    armorProfiles: ["light", "medium"], chromeRange: [2, 5], moduleChance: 0.55, consumableRange: [0, 2],
    implantFamilies: ["fashion", "optics", "arm", "leg", "neural"], faction: "Tyger Claws",
  }),
  "sixth-street-patrol": preset({
    label: "6th Street — вооружённый патруль", group: "street", icon: "fa-solid fa-flag-usa",
    description: "Вооружённая уличная милиция ветеранов с хорошей огневой подготовкой.", level: 5,
    roles: ["assault", "defender", "leader"], weaponProfiles: ["rifle", "shotgun", "pistol"],
    armorProfiles: ["light", "medium"], chromeRange: [1, 4], moduleChance: 0.45, consumableRange: [1, 3],
    implantFamilies: ["optics", "audio", "arm", "neural"], faction: "6th Street",
  }),
  "bozos-terror": preset({
    label: "Bozos — психошоу", group: "street", icon: "fa-solid fa-face-laugh-squint",
    description: "Опасная пранк-банда с неожиданным оружием, веществами и хаотичной тактикой.", level: 4,
    roles: ["skirmisher", "assault", "cyberpsycho"], weaponProfiles: ["any", "melee", "shotgun"],
    armorProfiles: ["none", "light"], chromeRange: [1, 5], moduleChance: 0.45, consumableRange: [1, 4],
    implantFamilies: ["fashion", "external", "internal"], faction: "Bozos",
  }),
  "inquisitor-hunter": preset({
    label: "Inquisitors — охотник на хром", group: "street", icon: "fa-solid fa-ban",
    description: "Фанатичный противник киберимплантов с упором на засады и грубое оружие.", level: 5,
    roles: ["assault", "infiltrator", "leader"], weaponProfiles: ["rifle", "shotgun", "melee"],
    armorProfiles: ["light", "medium"], chromeRange: [0, 0], moduleChance: 0, consumableRange: [1, 3],
    implantFamilies: [], faction: "Inquisitors", forbidChrome: true,
  }),
  "iron-sights-killer": preset({
    label: "Iron Sights — боевик", group: "street", icon: "fa-solid fa-crosshairs",
    description: "Небольшая, жёсткая и опасно хромированная банда боевиков.", level: 7,
    roles: ["assault", "sniper", "cyberpsycho"], weaponProfiles: ["rifle", "smg", "heavy"],
    armorProfiles: ["medium"], chromeRange: [4, 7], moduleChance: 0.7, consumableRange: [0, 2],
    implantFamilies: ["optics", "neural", "arm", "internal"], allowUnique: true, faction: "Iron Sights",
  }),
  "albino-alligators": preset({
    label: "Albino Alligators — стая", group: "street", icon: "fa-solid fa-teeth-open",
    description: "Уличная группа с узнаваемой одинаковой символикой и упором на массовое давление.", level: 3,
    roles: ["assault", "skirmisher", "defender"], weaponProfiles: ["pistol", "smg", "melee", "shotgun"],
    armorProfiles: ["none", "light"], chromeRange: [0, 3], moduleChance: 0.3, consumableRange: [0, 2],
    implantFamilies: ["fashion", "external", "arm"], faction: "Albino Alligators",
  }),
  "philharmonic-vampyres": preset({
    label: "Philharmonic Vampyres — ночная стая", group: "street", icon: "fa-solid fa-masks-theater",
    description: "Театральные пранкеры в смокингах и с клыками, предпочитающие эффектные засады и странные розыгрыши.", level: 4,
    roles: ["infiltrator", "skirmisher", "leader"], weaponProfiles: ["concealable", "pistol", "melee", "nonlethal"],
    armorProfiles: ["none", "light"], chromeRange: [0, 3], moduleChance: 0.35, consumableRange: [1, 3],
    implantFamilies: ["fashion", "external", "optics", "audio"], faction: "Philharmonic Vampyres",
  }),
  "piranhas-party": preset({
    label: "Piranhas — тусовочная банда", group: "street", icon: "fa-solid fa-champagne-glasses",
    description: "Шумная тусовочная банда, где праздник легко превращается в драку или вооружённую разборку.", level: 4,
    roles: ["skirmisher", "assault", "leader"], weaponProfiles: ["pistol", "smg", "melee", "shotgun"],
    armorProfiles: ["none", "light"], chromeRange: [0, 4], moduleChance: 0.4, consumableRange: [2, 5],
    implantFamilies: ["fashion", "audio", "external", "neural"], faction: "Piranhas",
  }),
  "prime-time-players": preset({
    label: "Prime-Time Players — позер-банда", group: "street", icon: "fa-solid fa-tv",
    description: "Позеры, биоскульптированные под знаменитостей и персонажей старого медиа, действующие тематическими ячейками.", level: 4,
    roles: ["infiltrator", "skirmisher", "leader", "civilian"], weaponProfiles: ["pistol", "concealable", "melee", "smg"],
    armorProfiles: ["none", "light"], chromeRange: [0, 3], moduleChance: 0.35, consumableRange: [0, 3],
    implantFamilies: ["fashion", "external", "optics", "audio"], faction: "Prime-Time Players",
  }),
  "reckoners-cult": preset({
    label: "Reckoners — апокалиптический культ", group: "street", icon: "fa-solid fa-fire-flame-curved",
    description: "Вооружённые фанатики, проповедующие грядущий конец и добывающие ресурсы насилием.", level: 5,
    roles: ["assault", "leader", "infiltrator"], weaponProfiles: ["rifle", "shotgun", "melee", "pistol"],
    armorProfiles: ["light", "medium"], chromeRange: [0, 2], moduleChance: 0.25, consumableRange: [1, 4],
    implantFamilies: ["internal", "audio"], faction: "Reckoners",
  }),
  "red-chrome-legion": preset({
    label: "Red Chrome Legion — ударная ячейка", group: "street", icon: "fa-solid fa-skull-crossbones",
    description: "Военизированная неофашистская банда, используемая как враждебная уличная силовая группа.", level: 6,
    roles: ["assault", "heavy", "defender", "leader"], weaponProfiles: ["rifle", "shotgun", "heavy", "melee"],
    armorProfiles: ["light", "medium"], chromeRange: [1, 4], moduleChance: 0.45, consumableRange: [1, 3],
    implantFamilies: ["arm", "internal", "optics", "neural"], faction: "Red Chrome Legion",
  }),
  "scavvers-crew": preset({
    label: "Scavvers — поисковая бригада", group: "street", icon: "fa-solid fa-dumpster",
    description: "Искатели уцелевшей техники, оружия и материалов в руинах и опасных районах.", level: 3,
    roles: ["technician", "skirmisher", "assault"], weaponProfiles: ["any", "melee", "pistol"],
    armorProfiles: ["none", "light"], chromeRange: [1, 4], moduleChance: 0.35, consumableRange: [1, 4],
    implantFamilies: ["external", "arm", "leg", "neural"], faction: "Scavvers",
  }),
  "voodoo-boys-2045": preset({
    label: "Voodoo Boys — наркобанда", group: "street", icon: "fa-solid fa-pills",
    description: "Уличная преступная группа, связанная с торговлей наркотиками и насилием вокруг территории и рынка.", level: 5,
    roles: ["infiltrator", "assault", "leader"], weaponProfiles: ["pistol", "smg", "shotgun", "concealable"],
    armorProfiles: ["none", "light"], chromeRange: [0, 3], moduleChance: 0.35, consumableRange: [2, 5],
    implantFamilies: ["fashion", "audio", "neural", "internal"], faction: "Voodoo Boys",
  }),
  "generation-red": preset({
    label: "Generation Red — YoGang", group: "street", icon: "fa-solid fa-children",
    description: "Молодая уличная группа, собравшаяся ради взаимной защиты и выживания в опасных районах.", level: 3,
    roles: ["skirmisher", "infiltrator", "civilian", "technician"], weaponProfiles: ["pistol", "melee", "smg", "concealable"],
    armorProfiles: ["none", "light"], chromeRange: [0, 2], moduleChance: 0.25, consumableRange: [0, 2],
    implantFamilies: ["fashion", "audio", "optics"], faction: "Generation Red",
  }),
  "ncpd-patrol": preset({
    label: "NCPD — патруль", group: "law", icon: "fa-solid fa-shield",
    description: "Обычный городской патруль: контроль улиц, задержание и первый ответ.", level: 3,
    roles: ["assault", "defender", "leader"], weaponProfiles: ["pistol", "shotgun", "nonlethal"],
    armorProfiles: ["light", "medium"], chromeRange: [0, 2], moduleChance: 0.35, consumableRange: [1, 3],
    implantFamilies: ["audio", "optics", "neural"], faction: "NCPD",
  }),
  "ncpd-detective": preset({
    label: "NCPD — детектив", group: "law", icon: "fa-solid fa-magnifying-glass",
    description: "Следователь с упором на наблюдение, допросы и скрытое оружие.", level: 5,
    roles: ["infiltrator", "leader", "civilian"], weaponProfiles: ["pistol", "concealable", "nonlethal"],
    armorProfiles: ["none", "light"], chromeRange: [1, 3], moduleChance: 0.5, consumableRange: [0, 2],
    implantFamilies: ["optics", "audio", "neural"], faction: "NCPD — следственный отдел",
  }),
  "ncpd-swat": preset({
    label: "NCPD — тактическая группа", group: "law", icon: "fa-solid fa-people-group",
    description: "Штурмовая полицейская команда для заложников, баррикад и тяжёлых угроз.", level: 7,
    roles: ["assault", "defender", "heavy", "medic", "leader"], weaponProfiles: ["rifle", "smg", "shotgun", "nonlethal"],
    armorProfiles: ["medium", "heavy"], chromeRange: [1, 4], moduleChance: 0.5, consumableRange: [2, 4],
    implantFamilies: ["audio", "optics", "arm", "neural"], faction: "NCPD — тактическое подразделение",
  }),
  "maxtac-response": preset({
    label: "MAX-TAC — подавление киберпсиха", group: "law", icon: "fa-solid fa-bolt",
    description: "Элитная группа против тяжело аугментированных и киберпсихотических целей.", level: 11,
    roles: ["assault", "heavy", "sniper", "netrunner", "leader"], weaponProfiles: ["rifle", "heavy", "shotgun", "sniper"],
    armorProfiles: ["heavy"], chromeRange: [4, 8], moduleChance: 0.75, consumableRange: [2, 5],
    implantFamilies: ["neural", "optics", "audio", "arm", "leg", "internal"], includePrograms: true, allowUnique: true,
    faction: "MAX-TAC",
  }),
  "lawman-bounty": preset({
    label: "Законник — охотник за головами", group: "law", icon: "fa-solid fa-scale-balanced",
    description: "Лицензированный или полуофициальный охотник, работающий по ордерам и контрактам.", level: 6,
    roles: ["assault", "sniper", "infiltrator"], weaponProfiles: ["rifle", "pistol", "shotgun", "concealable"],
    armorProfiles: ["light", "medium"], chromeRange: [1, 4], moduleChance: 0.5, consumableRange: [1, 3],
    implantFamilies: ["optics", "audio", "neural", "arm"], faction: "лицензированный законник",
  }),
  "mox-protection": preset({
    label: "Шельмы — группа защиты", group: "street", icon: "fa-solid fa-venus-double",
    description: "Яркая уличная группа самообороны: охрана клуба, вышибалы, сопровождающие и быстрый ответ на угрозу.", level: 5,
    roles: ["defender", "skirmisher", "leader", "medic"], weaponProfiles: ["pistol", "smg", "melee", "nonlethal"],
    armorProfiles: ["none", "light"], chromeRange: [1, 5], moduleChance: 0.55, consumableRange: [1, 3],
    implantFamilies: ["fashion", "external", "audio", "optics", "arm"], faction: "The Mox / Шельмы",
  }),
  "animals-enforcer": preset({
    label: "Animals — силовики", group: "street", icon: "fa-solid fa-dumbbell",
    description: "Гипертрофированные бойцы и вышибалы с упором на физическую мощь, ближний бой и тяжёлый хром.", level: 7,
    roles: ["heavy", "defender", "assault"], weaponProfiles: ["melee", "shotgun", "heavy", "pistol"],
    armorProfiles: ["light", "medium"], chromeRange: [3, 7], moduleChance: 0.65, consumableRange: [1, 4],
    implantFamilies: ["arm", "leg", "internal", "external"], allowUnique: true, faction: "Animals",
  }),
  "valentinos-crew": preset({
    label: "Valentinos — уличная команда", group: "street", icon: "fa-solid fa-heart",
    description: "Стильная и сплочённая уличная команда с пистолетами, автоматами, ближним боем и заметным хромом.", level: 5,
    roles: ["assault", "skirmisher", "leader"], weaponProfiles: ["pistol", "smg", "melee", "shotgun"],
    armorProfiles: ["none", "light", "medium"], chromeRange: [1, 5], moduleChance: 0.5, consumableRange: [1, 3],
    implantFamilies: ["fashion", "audio", "optics", "arm", "neural"], faction: "Valentinos",
  }),
  "scavengers-harvest": preset({
    label: "Scavengers — бригада сборщиков", group: "street", icon: "fa-solid fa-user-injured",
    description: "Жестокая группа похитителей и сборщиков чужого хрома с дешёвым оружием, медицинским инструментом и случайными имплантами.", level: 6,
    roles: ["assault", "technician", "medic", "infiltrator"], weaponProfiles: ["pistol", "smg", "shotgun", "melee"],
    armorProfiles: ["none", "light", "medium"], chromeRange: [2, 6], moduleChance: 0.6, consumableRange: [1, 4],
    implantFamilies: ["internal", "external", "arm", "optics", "neural"], faction: "Scavengers / Scavs",
  }),
  "wraiths-raiders": preset({
    label: "Wraiths — рейдеры", group: "street", icon: "fa-solid fa-road",
    description: "Рейдерская стая с дальнобойным оружием, грубой бронёй, транспортной подготовкой и трофейным хромом.", level: 6,
    roles: ["assault", "sniper", "driver", "heavy"], weaponProfiles: ["rifle", "shotgun", "sniper", "heavy"],
    armorProfiles: ["light", "medium"], chromeRange: [1, 5], moduleChance: 0.5, consumableRange: [1, 4],
    implantFamilies: ["optics", "audio", "arm", "leg", "internal"], faction: "Wraiths / Raffen Shiv",
  }),
  "voodoo-boys-netcell": preset({
    label: "Voodoo Boys — сетевая ячейка", group: "street", icon: "fa-solid fa-wifi",
    description: "Высокотехнологичная уличная ячейка нетраннеров и прикрытия, ориентированная на сеть, наблюдение и электронные атаки.", level: 8,
    roles: ["netrunner", "infiltrator", "technician", "assault"], weaponProfiles: ["pistol", "smg", "concealable"],
    armorProfiles: ["none", "light"], chromeRange: [3, 7], moduleChance: 0.75, consumableRange: [1, 3],
    implantFamilies: ["neural", "audio", "optics", "internal"], includePrograms: true, allowUnique: true, faction: "Voodoo Boys — net cell",
  }),

  "civilian-bartender": preset({
    label: "Бармен", group: "civilian", icon: "fa-solid fa-martini-glass",
    description: "Обычный бармен, знающий постоянных клиентов, слухи района и способы погасить конфликт до драки.", level: 1,
    roles: ["service"], weaponProfiles: ["none", "concealable"], armorProfiles: ["none"], chromeRange: [0, 2], moduleChance: 0.25, consumableRange: [0, 2], implantFamilies: ["fashion", "audio"], faction: "гражданские — сфера услуг",
  }),
  "civilian-shopkeeper": preset({
    label: "Владелец лавки", group: "civilian", icon: "fa-solid fa-store",
    description: "Мелкий предприниматель или продавец, который умеет торговаться, оценивать товар и держать кассу под контролем.", level: 2,
    roles: ["merchant"], weaponProfiles: ["none", "pistol", "concealable"], armorProfiles: ["none", "light"], chromeRange: [0, 2], moduleChance: 0.25, consumableRange: [0, 2], implantFamilies: ["audio", "optics", "fashion"], faction: "гражданские — торговля",
  }),
  "civilian-street-vendor": preset({
    label: "Уличный торговец", group: "civilian", icon: "fa-solid fa-cart-shopping",
    description: "Лоточник, продавец еды, деталей или дешёвой электроники, хорошо знающий улицу и своих покупателей.", level: 1,
    roles: ["merchant", "civilian"], weaponProfiles: ["none", "concealable"], armorProfiles: ["none"], chromeRange: [0, 1], moduleChance: 0.2, consumableRange: [0, 3], implantFamilies: ["fashion", "audio"], faction: "гражданские — уличная торговля",
  }),
  "civilian-courier": preset({
    label: "Курьер", group: "civilian", icon: "fa-solid fa-box",
    description: "Городской курьер, доставщик или посыльный, привыкший быстро находить маршрут и уходить от уличных проблем.", level: 2,
    roles: ["driver", "skirmisher"], weaponProfiles: ["none", "pistol", "concealable"], armorProfiles: ["none", "light"], chromeRange: [0, 2], moduleChance: 0.3, consumableRange: [0, 2], implantFamilies: ["leg", "audio", "optics"], faction: "гражданские — доставка",
  }),
  "civilian-taxi-driver": preset({
    label: "Таксист / водитель", group: "civilian", icon: "fa-solid fa-taxi",
    description: "Профессиональный водитель, хорошо знающий транспортные узлы, объезды и опасные кварталы.", level: 2,
    roles: ["driver"], weaponProfiles: ["none", "pistol"], armorProfiles: ["none", "light"], chromeRange: [0, 2], moduleChance: 0.3, consumableRange: [0, 2], implantFamilies: ["neural", "audio", "optics"], faction: "гражданские — транспорт",
  }),
  "civilian-mechanic": preset({
    label: "Механик", group: "civilian", icon: "fa-solid fa-wrench",
    description: "Работник мастерской, гаража или ремонтного бокса с инструментами и практическим техническим хромом.", level: 3,
    roles: ["technician", "laborer"], weaponProfiles: ["none", "pistol", "melee"], armorProfiles: ["none", "light"], chromeRange: [0, 3], moduleChance: 0.4, consumableRange: [1, 4], implantFamilies: ["arm", "audio", "optics", "internal"], faction: "гражданские — ремонт",
  }),
  "civilian-clinic-worker": preset({
    label: "Работник клиники", group: "civilian", icon: "fa-solid fa-user-nurse",
    description: "Фельдшер, медбрат, санитар или сотрудник небольшой клиники без боевой специализации.", level: 3,
    roles: ["medic", "civilian"], weaponProfiles: ["none", "nonlethal", "pistol"], armorProfiles: ["none", "light"], chromeRange: [0, 3], moduleChance: 0.4, consumableRange: [3, 6], implantFamilies: ["internal", "audio", "optics"], faction: "гражданские — медицина",
  }),
  "civilian-office-clerk": preset({
    label: "Офисный служащий", group: "civilian", icon: "fa-solid fa-clipboard",
    description: "Клерк, оператор базы данных, диспетчер или младший корпоративный сотрудник.", level: 2,
    roles: ["clerk"], weaponProfiles: ["none", "concealable"], armorProfiles: ["none"], chromeRange: [0, 2], moduleChance: 0.3, consumableRange: [0, 2], implantFamilies: ["neural", "audio", "optics"], faction: "гражданские — офис",
  }),
  "civilian-factory-worker": preset({
    label: "Рабочий завода", group: "civilian", icon: "fa-solid fa-industry",
    description: "Сменный рабочий производства, склада или переработки с защитным снаряжением и простыми рабочими имплантами.", level: 2,
    roles: ["laborer"], weaponProfiles: ["none", "melee"], armorProfiles: ["none", "light"], chromeRange: [0, 2], moduleChance: 0.3, consumableRange: [0, 2], implantFamilies: ["arm", "internal", "audio"], faction: "гражданские — производство",
  }),
  "civilian-construction-worker": preset({
    label: "Строитель", group: "civilian", icon: "fa-solid fa-helmet-safety",
    description: "Монтажник, сварщик или рабочий строительной бригады с инструментами и усилением для тяжёлой работы.", level: 3,
    roles: ["laborer", "technician"], weaponProfiles: ["none", "melee"], armorProfiles: ["light"], chromeRange: [0, 3], moduleChance: 0.4, consumableRange: [1, 3], implantFamilies: ["arm", "leg", "internal", "optics"], faction: "гражданские — строительство",
  }),
  "civilian-club-staff": preset({
    label: "Персонал клуба", group: "civilian", icon: "fa-solid fa-music",
    description: "Бармен, администратор, техник сцены или сотрудник ночного клуба.", level: 2,
    roles: ["service", "technician", "civilian"], weaponProfiles: ["none", "concealable", "nonlethal"], armorProfiles: ["none"], chromeRange: [0, 3], moduleChance: 0.35, consumableRange: [0, 3], implantFamilies: ["fashion", "audio", "optics", "neural"], faction: "гражданские — ночная жизнь",
  }),
  "civilian-teacher": preset({
    label: "Преподаватель", group: "civilian", icon: "fa-solid fa-chalkboard-user",
    description: "Учитель, инструктор или наставник с хорошими социальными и информационными навыками.", level: 2,
    roles: ["clerk", "civilian"], weaponProfiles: ["none"], armorProfiles: ["none"], chromeRange: [0, 2], moduleChance: 0.25, consumableRange: [0, 1], implantFamilies: ["neural", "audio", "optics"], faction: "гражданские — образование",
  }),

  "rockerboy-crew": preset({
    label: "Рокербой и охрана", group: "independent", icon: "fa-solid fa-microphone-lines",
    description: "Артист, агитатор или фронтмен с небольшой командой поддержки.", level: 5,
    roles: ["leader", "civilian", "skirmisher"], weaponProfiles: ["pistol", "concealable", "melee"],
    armorProfiles: ["none", "light"], chromeRange: [1, 4], moduleChance: 0.5, consumableRange: [0, 3],
    implantFamilies: ["fashion", "audio", "neural", "optics"], faction: "рокербой и его команда",
  }),
  "media-investigator": preset({
    label: "Медиа — полевая группа", group: "independent", icon: "fa-solid fa-video",
    description: "Репортёр и сопровождающие, добывающие доказательства в опасных районах.", level: 4,
    roles: ["civilian", "infiltrator", "leader"], weaponProfiles: ["pistol", "concealable", "nonlethal"],
    armorProfiles: ["none", "light"], chromeRange: [0, 3], moduleChance: 0.4, consumableRange: [1, 3],
    implantFamilies: ["audio", "optics", "neural", "fashion"], faction: "независимое медиа",
  }),
  "exec-team": preset({
    label: "Корпоративный руководитель и свита", group: "independent", icon: "fa-solid fa-user-tie",
    description: "Исполнительный менеджер с охраной, связистом и технической поддержкой.", level: 6,
    roles: ["leader", "defender", "netrunner", "technician"], weaponProfiles: ["pistol", "smg", "concealable"],
    armorProfiles: ["none", "light", "medium"], chromeRange: [1, 4], moduleChance: 0.5, consumableRange: [1, 3],
    implantFamilies: ["audio", "neural", "optics", "fashion"], includePrograms: true, faction: "корпоративная управленческая группа",
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

const AUTO_ROLE_EXPANSIONS = Object.freeze({
  assault: ["assault", "pointman", "gunfighter", "breacher", "commando"],
  defender: ["defender", "bodyguard", "controller"],
  heavy: ["heavy", "suppressor"],
  sniper: ["sniper", "hunter"],
  skirmisher: ["skirmisher", "gunfighter", "scout"],
  infiltrator: ["infiltrator", "saboteur", "scout"],
  leader: ["leader", "interrogator", "support"],
  technician: ["technician", "saboteur", "support"],
});

export function roleOptions() {
  return [
    { id: "auto", label: "Авто по пресету" },
    ...Object.entries(ROLE_PROFILES).map(([id, entry]) => ({ id, label: entry.label })),
  ];
}

export function resolveRole(preset, random = Math.random, preferredId = "auto") {
  if (preferredId && preferredId !== "auto" && ROLE_PROFILES[preferredId]) {
    return { id: preferredId, ...ROLE_PROFILES[preferredId] };
  }
  const baseId = pick(preset.roles, random) ?? "assault";
  const expanded = AUTO_ROLE_EXPANSIONS[baseId] ?? [baseId];
  const id = pick(expanded, random) ?? baseId;
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
  const statMode = (value) =>
    ["auto", "terrible", "low", "moderate", "high", "extreme", "custom"].includes(value)
      ? value
      : "auto";
  const exactNumber = (value, min, max) => {
    if (value === "" || value === null || value === undefined) return "";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "";
    return Math.max(min, Math.min(max, Math.trunc(numeric)));
  };
  const normalized = {
    ...DEFAULT_FORM,
    ...values,
    preset: presetId,
    roleId: Object.hasOwn(ROLE_PROFILES, values.roleId) ? values.roleId : "auto",
    level: Math.max(
      -1,
      Math.min(20, Math.trunc(Number(values.level ?? selected.level) || 0)),
    ),
    count: Math.max(1, Math.min(20, Math.trunc(Number(values.count) || 1))),
    quality: values.quality === "elite" ? "elite" : "standard",
    proficiencyMode: values.proficiencyMode === "standard" ? "standard" : "pwl",
    tier_ac: tier(values.tier_ac),
    tier_hp: tier(values.tier_hp),
    tier_attack: tier(values.tier_attack),
    tier_damage: tier(values.tier_damage),
    tier_perception: tier(values.tier_perception),
    tier_fortitude: statMode(values.tier_fortitude),
    tier_reflex: statMode(values.tier_reflex),
    tier_will: statMode(values.tier_will),
    tier_dc: tier(values.tier_dc),
    ability_str: statMode(values.ability_str),
    ability_str_value: exactNumber(values.ability_str_value, -20, 30),
    ability_dex: statMode(values.ability_dex),
    ability_dex_value: exactNumber(values.ability_dex_value, -20, 30),
    ability_con: statMode(values.ability_con),
    ability_con_value: exactNumber(values.ability_con_value, -20, 30),
    ability_int: statMode(values.ability_int),
    ability_int_value: exactNumber(values.ability_int_value, -20, 30),
    ability_wis: statMode(values.ability_wis),
    ability_wis_value: exactNumber(values.ability_wis_value, -20, 30),
    ability_cha: statMode(values.ability_cha),
    ability_cha_value: exactNumber(values.ability_cha_value, -20, 30),
    save_fortitude_value: exactNumber(values.save_fortitude_value, -30, 80),
    save_reflex_value: exactNumber(values.save_reflex_value, -30, 80),
    save_will_value: exactNumber(values.save_will_value, -30, 80),
    skillSelectionMode: values.skillSelectionMode === "manual" ? "manual" : "auto",
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
    sourceCpel: values.sourceCpel !== false,
    sourceRemaster: values.sourceRemaster !== false,
    pktBodyId: String(
      values.pktBodyId ?? ((values.pktModelKey || selected.pkt) ? "random" : ""),
    ).trim(),
    pktModelKey: String(values.pktModelKey ?? (selected.pkt ? "random" : "")).trim(),
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
  const validSkillOverride = (value) =>
    ["auto", "none", "terrible", "low", "moderate", "high", "extreme"].includes(value)
      ? value
      : "auto";
  const allowedSkillKeys = new Set(NONMAGICAL_SKILL_SLUGS.map((slug) => `skill_${slug}`));
  for (const key of Object.keys(normalized)) {
    if (key.startsWith("skill_") && !allowedSkillKeys.has(key)) delete normalized[key];
  }
  for (const slug of NONMAGICAL_SKILL_SLUGS) {
    const key = `skill_${slug}`;
    if (Object.hasOwn(values, key)) normalized[key] = validSkillOverride(String(values[key] ?? "auto"));
  }

  const validFrequencyPer = new Set(["", "turn", "round", "PT1M", "PT10M", "PT1H", "PT24H", "day", "P1W"]);
  for (let index = 1; index <= 6; index += 1) {
    const prefix = `ability${index}_`;
    normalized[`${prefix}enabled`] = values[`${prefix}enabled`] === true;
    normalized[`${prefix}template`] = String(values[`${prefix}template`] ?? "").trim();
    normalized[`${prefix}name`] = String(values[`${prefix}name`] ?? "").trim().slice(0, 180);
    normalized[`${prefix}actionType`] = ["action", "reaction", "free", "passive"].includes(values[`${prefix}actionType`])
      ? values[`${prefix}actionType`]
      : "passive";
    normalized[`${prefix}actions`] = Math.max(1, Math.min(3, Math.trunc(Number(values[`${prefix}actions`]) || 1)));
    normalized[`${prefix}category`] = ["offensive", "defensive", "interaction"].includes(values[`${prefix}category`])
      ? values[`${prefix}category`]
      : "interaction";
    const frequencyPer = String(values[`${prefix}frequencyPer`] ?? "").trim();
    normalized[`${prefix}frequencyPer`] = validFrequencyPer.has(frequencyPer) ? frequencyPer : "";
    normalized[`${prefix}frequencyMax`] = Math.max(1, Math.min(99, Math.trunc(Number(values[`${prefix}frequencyMax`]) || 1)));
    normalized[`${prefix}traits`] = String(values[`${prefix}traits`] ?? "").trim().slice(0, 800);
    normalized[`${prefix}description`] = String(values[`${prefix}description`] ?? "").trim().slice(0, 16000);
    normalized[`${prefix}rules`] = String(values[`${prefix}rules`] ?? "[]").trim().slice(0, 32000) || "[]";
  }

  if (!normalized.sourceCpel && !normalized.sourceRemaster) {
    normalized.sourceCpel = true;
  }
  delete normalized.prompt;
  return normalized;
}
