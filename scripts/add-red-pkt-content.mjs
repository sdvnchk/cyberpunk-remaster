import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePktModelPrices } from "./lib/content.mjs";
import { CyberwareTab } from "../sheets/CyberwareTab.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relative) =>
  JSON.parse(await fs.readFile(path.join(root, relative), "utf8"));
const writeJson = async (relative, value) =>
  fs.writeFile(
    path.join(root, relative),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );

const [items, folders, journals, existingModels, pktComponents] =
  await Promise.all([
    readJson("items-export.json"),
    readJson("data/item-folders.json"),
    readJson("journals-export.json"),
    readJson("data/pkt-models.json"),
    readJson("data/pkt-components.json"),
  ]);

const IDS = {
  folder: "hAjxPF8rxyrHozYl",
  emiShield: "XY3CmEvz1v21noJy",
  grip: "FU2q8REKaGwCIwhy",
  hydraulics: "x9k8yGcrJmuIteIG",
  transformerFoot: "5AdoGIaG78q9wqRP",
  radarSonar: "nMrGBRnCHh0ovGw0",
  radio: "UkLphu1jZYQFW1Tm",
  zeroGravity: "DdX973Uzp9NYo9Uj",
  radarDetector: "TPRcl7PfEbxy2TCm",
  gripSole: "FkkVbWD9GLb3ri16",
  subdermalPocket: "KVWvdMwTW9qcDPRs",
  armMultitool: "umS0qPQn3PYD0pLA",
  tactileBoost: "lxfraANQJZV1Beg1",
  teleoptics: "AgzCndJRd4GzoDuF",
  imageEnhancer: "MCmnHgBnMIJBnHkj",
  chemicalAnalyzer: "aEC26xOyJETn5P8H",
  radiationDetector: "AExMnmNOoRXp0KgL",
  techscanner: "rX7QvOjb8LN6FVnT",
  chipSocket: "fNR8H0UFTJOXOFWB",
  tacticalSight: "HgdFUO8yWnmYp22b",
  cyberdeckChronos: "G2Pjb3guhEbiUTa0",
  cyberdeckAkasha: "4m5cZrKQCWN3qzUC",
  cyberdeckOracle: "Q7vK2mR9xT4nP6dL",
  chronosFocus: "Hrn0sDeckF0cus01",
  akashaFocus: "AkshaDeckF0cus01",
  oracleFocus: "OraclDeckF0cus01",
  aerohypo: "FcuhCSaJoJH2JSaD",
  fireSuppressor: "93iPHmIvUxBRSTwV",
  monoVision: "yNN1l6d0WprQumHm",
  copernicusCore: "bVOs64i0xa8OI4Mx",
  aquariusDrive: "AMaFNjS5iVw0JlYm",
  dragoonArmor: "9iSyrB5qXoUUaRqc",
  dragoonNode: "bPKRQDJZHKTiDlQX",
  dragoon2Armor: "8dG2pQ4sV7xK1mNz",
  dragoon2Node: "D2rA9gN6uE3kT8wP",
  dragoon2Reactor: "R2cT7vM4xB9nK5qL",
  eclipseCore: "TlYh6BTJyzwdgn0b",
  monoThree: "NKpwUryTOib4WVKQ",
  lawmanLauncher: "V08iCfNY9JLL8yRA",
  lawmanBaton: "3bNQqSFHsFXCB2pd",
  spiderShoulder: "ctU9NriKI6zCjkE7",
  pitSurvival: "xYg1Xeysx27fPlQT",
  samsonCore: "lTDgKC3KtCY4OoZD",
  sageDecoyBrain: "cD0zlyvVhTfUXml3",
  kildareCore: "esjGcRYS539r3CGt",
  kildareProtocol: "K1lD4rE9hE4lD10x",
  sulfurController: "UXG0ucDX3ylMs1lU",
  copernicusPage: "RDlD9z1ODepxz8ct",
  aquariusPage: "g3hnc9T8FyCW7lQx",
  sulfurPage: "rsRQsNJn43AcmP2v",
  dragoonPage: "Gm0ZPBH1e9ziojoj",
  dragoon2Page: "J7mD2rG9vK4pT8xN",
  eclipsePage: "B8L1jtdBIii6NFqL",
  lawmanPage: "p98SUu5G8zw5xFXc",
  spiderPage: "AzP72iIxC5bT6PCF",
  pitPage: "RiGkkqXTcbbS9ydm",
  samsonPage: "LMVDGCuMN5Cbhrna",
  sagePage: "CzvhbYuTVtoLl39o",
  kildarePage: "VnizzFtbIK6wHThP",
};

for (const [key, id] of Object.entries(IDS)) {
  if (!/^[A-Za-z0-9]{16}$/.test(id)) {
    throw new Error(`${key} has invalid Foundry ID ${id}`);
  }
}

const MODULE_ID = "cyberpunk-remaster";
const ITEM_PREFIX =
  "Compendium.cyberpunk-remaster.cyberpunk-items.Item";
const JOURNAL_ID = "LRV1KlxZGvXDm9ny";
const GENERIC_FOLDER = IDS.folder;
const UNIQUE_FOLDER = "ahY6bGvcjTypaV6b";
const DEFAULT_IMG = "icons/svg/item-bag.svg";
const REMOVED_ITEM_IDS = new Set([
  "YmbmMTYCsyfRtelb",
  "33ZfU2K28lA3jQ3P",
  "7lzXsQazcTqEFVff",
  "nQ8izZQNxBCWlk9p",
  "ieCN5JHG1uxFhGq1",
  "MqBONoXoNkAQD5V0",
  "rudUgXccdk2k1pvP",
]);

for (let index = items.length - 1; index >= 0; index -= 1) {
  if (REMOVED_ITEM_IDS.has(items[index]._id)) items.splice(index, 1);
}

const itemById = new Map(items.map((item) => [item._id, item]));
const equipmentTemplate = structuredClone(
  itemById.get("6Lnce5KtpF8VqE6O"),
);
const meleeTemplate = structuredClone(
  itemById.get("krNr5PTr5HmccpGz"),
);
const rangedTemplate = structuredClone(
  itemById.get("rgprAOXrCIFtwfpr"),
);
const featTemplate = structuredClone(
  items.find((item) => item.type === "feat"),
);
const focusSpellTemplate = structuredClone(
  itemById.get("GcTrbujlSfgyzpmF") ??
    items.find((item) => item.type === "spell"),
);
const grenadeLauncherCastRules = structuredClone(
  itemById.get("SGy1aJYOIKeg1k4T")?.system?.rules ?? [],
);

function slugify(value) {
  return String(value)
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/giu, "-")
    .replace(/^-|-$/g, "");
}

function rarityFor(level, unique = false) {
  if (unique) return "unique";
  if (level >= 13) return "rare";
  if (level >= 5) return "uncommon";
  return "common";
}

function humanityBlock(type, slots, hardCost) {
  const stress = {
    0: "0",
    1: "[[/r 1d4 #Потеря Человечности]]",
    2: "[[/r 1d6 #Потеря Человечности]]",
    3: "[[/r 2d6 #Потеря Человечности]]",
    4: "[[/r 4d6 #Потеря Человечности]]",
  }[hardCost];
  const dc = { 1: 3, 2: 5, 3: 8, 4: 11 }[hardCost];
  return (
    `<hr><p><strong>Тип импланта:</strong> ${type}</p>` +
    `<p><strong>Слоты:</strong> ${slots}</p>` +
    `<p><strong>Stress Cost:</strong> ${stress}</p>` +
    `<p><strong>Hard Cost:</strong> ${hardCost}</p>` +
    (dc
      ? `<p><strong>Проверка:</strong> @Check[flat|dc:${dc}|showDC:all]</p>`
      : "")
  );
}

function makeEquipment({
  id,
  name,
  folder = GENERIC_FOLDER,
  img = DEFAULT_IMG,
  level,
  price,
  hardCost,
  implantType,
  slots = 1,
  effect,
  rules = [],
  unique = false,
  rarity = rarityFor(level, unique),
  moduleFlags = {},
}) {
  const item = structuredClone(equipmentTemplate);
  item._id = id;
  item.name = name;
  item.folder = folder;
  item.img = img;
  item.sort = 0;
  item.effects = [];
  item.flags = Object.keys(moduleFlags).length
    ? { [MODULE_ID]: structuredClone(moduleFlags) }
    : {};
  item.ownership = { default: 0 };
  item.system.description = {
    gm: "",
    value:
      (/<(?:p|hr|ul|ol|table)\b/i.test(effect)
        ? effect
        : `<p>${effect}</p>`) +
      humanityBlock(implantType, slots, hardCost),
  };
  item.system.rules = structuredClone(rules);
  item.system.slug = slugify(name);
  item.system.traits = {
    otherTags: [],
    value: ["pkt", "tech"],
    rarity,
  };
  item.system.publication = {
    title: "SF2E Cyberpunk Remaster",
    authors: "Ogorodnik",
    license: "ORC",
    remaster: true,
  };
  item.system.level = { value: level };
  item.system.quantity = 1;
  item.system.baseItem = null;
  item.system.bulk = { value: 0 };
  item.system.price = { value: { sp: price } };
  item.system.equipped = { carryType: "worn", invested: null };
  item.system.containerId = null;
  item.system.usage = { value: "implanted" };
  item.system.subitems = [];
  item._stats = {
    coreVersion: "14.361",
    systemId: "sf2e",
    systemVersion: "1.2.0",
    compendiumSource: `${ITEM_PREFIX}.${id}`,
  };
  return item;
}

function makeFeat({
  id,
  name,
  folder = "IcFJnP6YQqtuZL0l",
  img = DEFAULT_IMG,
  level,
  description,
  slug = slugify(name),
  traits = ["general"],
  rarity = "unique",
  rules = [],
}) {
  const item = structuredClone(featTemplate);
  item._id = id;
  item.name = name;
  item.folder = folder;
  item.img = img;
  item.sort = 0;
  item.effects = [];
  item.flags = { [MODULE_ID]: { grantedSupport: true } };
  item.ownership = { default: 0 };
  item.system.description = { gm: "", value: `<p>${description}</p>` };
  item.system.rules = structuredClone(rules);
  item.system.slug = slug;
  item.system.traits = {
    otherTags: [],
    value: traits,
    rarity,
  };
  item.system.publication = {
    title: "SF2E Cyberpunk Remaster",
    authors: "Ogorodnik",
    license: "ORC",
    remaster: true,
  };
  item.system.level = { value: level };
  item.system.category = "general";
  item.system.onlyLevel1 = false;
  item.system.maxTakable = 1;
  item.system.actionType = { value: "passive" };
  item.system.actions = { value: null };
  item.system.prerequisites = { value: [] };
  item.system.subfeatures = {
    proficiencies: {},
    senses: {},
    suppressedFeatures: [],
  };
  item.system.location = null;
  item._stats = {
    coreVersion: "14.361",
    systemId: "sf2e",
    systemVersion: "1.2.0",
    compendiumSource: `${ITEM_PREFIX}.${id}`,
  };
  return item;
}

function makeFocusSpell({
  id,
  name,
  description,
  time,
  range = "",
  target = "",
  requirements = "",
  duration = "",
  traits = [],
}) {
  const item = structuredClone(focusSpellTemplate);
  item._id = id;
  item.name = name;
  item.folder = "b808j8P1ThJ8Ia56";
  item.img = DEFAULT_IMG;
  item.sort = 0;
  item.effects = [];
  item.flags = { [MODULE_ID]: { grantedSupport: true } };
  item.ownership = { default: 0 };
  item.system.description = { gm: "", value: description };
  item.system.rules = [];
  item.system.slug = slugify(name);
  item.system.traits = {
    otherTags: [],
    value: [...new Set(["focus", "concentrate", "tech", ...traits])],
    rarity: "uncommon",
    traditions: [],
  };
  item.system.publication = {
    title: "SF2E Cyberpunk Remaster",
    authors: "Ogorodnik",
    license: "ORC",
    remaster: true,
  };
  item.system.level = { value: 1 };
  item.system.requirements = requirements;
  item.system.target = { value: target };
  item.system.range = { value: range };
  item.system.area = null;
  item.system.time = { value: time };
  item.system.duration = { value: duration, sustained: false };
  item.system.damage = {};
  item.system.defense = null;
  item.system.cost = { value: "" };
  item.system.location = { value: null };
  item.system.counteraction = false;
  item._stats = {
    coreVersion: "14.361",
    systemId: "sf2e",
    systemVersion: "1.2.0",
    compendiumSource: `${ITEM_PREFIX}.${id}`,
  };
  return item;
}

function makeWeapon({
  id,
  name,
  img = DEFAULT_IMG,
  level,
  price,
  hardCost,
  effect,
  melee = true,
  damage = {},
  traits = [],
  grade = "advanced",
  rules = [],
}) {
  const item = structuredClone(melee ? meleeTemplate : rangedTemplate);
  item._id = id;
  item.name = name;
  item.folder = UNIQUE_FOLDER;
  item.img = img;
  item.sort = 0;
  item.effects = [];
  item.flags = {};
  item.ownership = { default: 0 };
  item.system.description = {
    gm: "",
    value:
      `<p><strong>Улучшения:</strong> 1</p><hr><p>${effect}</p>` +
      humanityBlock("Модуль", damage.slots ?? 1, hardCost),
  };
  item.system.rules = structuredClone(rules);
  item.system.slug = slugify(name);
  item.system.traits = {
    otherTags: [],
    value: [...new Set([...traits, "tech", "pkt"])],
    rarity: "unique",
  };
  item.system.publication = {
    title: "SF2E Cyberpunk Remaster",
    authors: "Ogorodnik",
    license: "ORC",
    remaster: true,
  };
  item.system.level = { value: level };
  item.system.price = { value: { sp: price } };
  item.system.grade = grade;
  item.system.quantity = 1;
  item.system.bulk = { value: 0 };
  item.system.containerId = null;
  item.system.equipped = {
    carryType: "worn",
    invested: null,
    handsHeld: 0,
  };
  item.system.usage = {
    value: melee ? "held-in-one-hand" : "held-in-two-hands",
  };
  if (melee) {
    item.system.category = "martial";
    item.system.group = damage.group ?? "brawling";
    item.system.baseItem = damage.baseItem ?? "dagger";
    item.system.damage = {
      dice: damage.dice ?? 1,
      die: damage.die ?? "d8",
      damageType: damage.damageType ?? "slashing",
      persistent: null,
    };
    item.system.range = null;
    item.system.ammo = null;
    item.system.reload = { value: null };
    item.system.expend = null;
  } else {
    item.system.category = "martial";
    item.system.group = "grenade";
    item.system.baseItem = "grenade-launcher";
    item.system.damage = {
      dice: 0,
      die: null,
      damageType: "untyped",
      persistent: null,
    };
    item.system.range = damage.range ?? 60;
    item.system.ammo = {
      builtIn: true,
      baseType: null,
      capacity: damage.capacity ?? 2,
    };
    item.system.reload = { value: damage.reload ?? "2" };
    item.system.expend = 1;
  }
  item._stats = {
    coreVersion: "14.361",
    systemId: "sf2e",
    systemVersion: "1.2.0",
    compendiumSource: `${ITEM_PREFIX}.${id}`,
  };
  return item;
}

const universalItems = [
  makeEquipment({
    id: IDS.emiShield,
    name: "ПКТ ЭМИ-защита",
    level: 5,
    price: 1800,
    hardCost: 2,
    implantType: "Внешний",
    effect:
      "Экранированный узел изолирует силовые и нервные магистрали корпуса. Вы получаете сопротивление электричеству 5 и бонус предмета +2 к защите от помех и ЭМИ, не наносящих урон.",
    rules: [{ key: "Resistance", type: "electricity", value: 5 }],
  }),
  makeEquipment({
    id: IDS.grip,
    name: "Рукохват ПКТ",
    level: 2,
    price: 200,
    hardCost: 1,
    implantType: "Модуль",
    effect:
      "Ладонь и пальцы фиксируются на поверхности микрошипами и магнитными вставками. Вы получаете бонус обстоятельства +1 к Атлетике для Карабканья и Захвата.",
    rules: [{
      key: "FlatModifier",
      selector: "athletics",
      type: "circumstance",
      value: 1,
      predicate: [{ or: ["action:climb", "action:grapple"] }],
    }],
  }),
  makeEquipment({
    id: IDS.hydraulics,
    name: "Модернизация внутренней гидравлики ПКТ",
    level: 8,
    price: 4500,
    hardCost: 3,
    implantType: "Внутренний",
    effect:
      "Усиленные насосы и приводные магистрали повышают пиковое усилие корпуса. Вы получаете бонус предмета +2 к проверкам Атлетики.",
    rules: [{
      key: "FlatModifier",
      selector: "athletics",
      type: "item",
      value: 2,
    }],
  }),
  makeEquipment({
    id: IDS.transformerFoot,
    name: "Стопа-трансформер ПКТ",
    level: 5,
    price: 1200,
    hardCost: 2,
    implantType: "Модуль",
    effect:
      "<p>Сегментированная стопа меняет профиль между обычной подошвой, кошками и роликовым блоком.</p><hr><p><strong>Активация — Сменить профиль:</strong> @Glyph[Action 1] (@Trait[Manipulate]{воздействие})</p><p><strong>Эффект:</strong> выберите профиль стопы; ситуативные преимущества определяет ведущий.</p>",
  }),
  makeEquipment({
    id: IDS.radarSonar,
    name: "Радар/сонар ПКТ",
    level: 6,
    price: 2200,
    hardCost: 2,
    implantType: "Модуль",
    effect:
      "Комбинированный активный локатор строит карту пространства по радио-акустическому отражению. Вы получаете бонус предмета +2 к Восприятию при Поиске скрытых объектов в пределах 60 футов.",
    rules: [{
      key: "FlatModifier",
      selector: "perception",
      type: "item",
      value: 2,
      predicate: ["action:seek"],
    }],
  }),
  makeEquipment({
    id: IDS.radio,
    name: "Встроенная рация ПКТ",
    level: 1,
    price: 100,
    hardCost: 1,
    implantType: "Модуль",
    effect:
      "Шифруемая многодиапазонная рация передаёт голос напрямую через нейроинтерфейс. Нормальная дальность связи — 5 километров, если местность и помехи не мешают.",
  }),
  makeEquipment({
    id: IDS.zeroGravity,
    name: "Устройство нулевой гравитации ПКТ",
    level: 6,
    price: 1800,
    hardCost: 2,
    implantType: "Модуль",
    effect:
      "<p>Микродюзы и инерциальный блок стабилизируют корпус без опоры.</p><hr><p><strong>Активация — Переключить стабилизацию:</strong> @Glyph[Action 1] (@Trait[Manipulate]{воздействие})</p><p><strong>Эффект:</strong> в невесомости включённый режим даёт бонус предмета +2 к Акробатике. Используйте переключатель Rule Element предмета, чтобы отметить активный режим.</p>",
    rules: [
      {
        key: "RollOption",
        domain: "all",
        option: "pkt-zero-gravity",
        label: "ПКТ: режим невесомости",
        toggleable: true,
      },
      {
        key: "FlatModifier",
        selector: "acrobatics",
        type: "item",
        value: 2,
        predicate: ["pkt-zero-gravity"],
      },
    ],
  }),
  makeEquipment({
    id: IDS.radarDetector,
    name: "Радар-детектор ПКТ",
    level: 3,
    price: 500,
    hardCost: 1,
    implantType: "Модуль",
    effect:
      "Пассивный приёмник отмечает направленное сканирование, лидары и активные радары. Вы получаете бонус предмета +1 к Восприятию при поиске работающих технических датчиков.",
  }),
  makeEquipment({
    id: IDS.gripSole,
    name: "Цепкая подошва ПКТ",
    level: 4,
    price: 800,
    hardCost: 1,
    implantType: "Модуль",
    effect:
      "Электроадгезивная подошва удерживает корпус на металле, стекле и камне. Вы получаете бонус предмета +1 к Акробатике для Балансирования.",
    rules: [{
      key: "FlatModifier",
      selector: "acrobatics",
      type: "item",
      value: 1,
      predicate: ["action:balance"],
    }],
  }),
  makeEquipment({
    id: IDS.subdermalPocket,
    name: "Подкожный карман ПКТ",
    level: 3,
    price: 500,
    hardCost: 1,
    implantType: "Внешний",
    effect:
      "Скрытая полость в обшивке вмещает один предмет лёгкой Массы. Обнаружение требует целенаправленного досмотра.",
  }),
  makeEquipment({
    id: IDS.armMultitool,
    name: "Рука-мультитул ПКТ",
    level: 3,
    price: 650,
    hardCost: 2,
    implantType: "Модуль",
    effect:
      "В пальцах размещён набор резцов, щупов и микросварка. Рука считается набором для ремонта и даёт бонус предмета +1 к Ремеслу при ремонте техники.",
    rules: [{
      key: "FlatModifier",
      selector: "crafting",
      type: "item",
      value: 1,
    }],
  }),
  makeEquipment({
    id: IDS.tactileBoost,
    name: "Тактильное усиление ПКТ",
    level: 5,
    price: 1400,
    hardCost: 2,
    implantType: "Модуль",
    effect:
      "Матрица давления считывает рельеф и вибрацию через пальцы. Вы получаете бонус предмета +1 к Воровству и проверкам Восприятия, основанным на осязании.",
    rules: [{
      key: "FlatModifier",
      selector: "thievery",
      type: "item",
      value: 1,
    }],
  }),
  makeEquipment({
    id: IDS.teleoptics,
    name: "Телеоптика ПКТ",
    level: 6,
    price: 2000,
    hardCost: 2,
    implantType: "Модуль",
    effect:
      "Стабилизированная оптика обеспечивает многократное увеличение. При наблюдении удалённой неподвижной цели вы получаете бонус предмета +2 к Восприятию.",
  }),
  makeEquipment({
    id: IDS.imageEnhancer,
    name: "Усилитель изображения ПКТ",
    level: 4,
    price: 800,
    hardCost: 1,
    implantType: "Модуль",
    effect:
      "Процессор очищает шум, компенсирует дрожание и выделяет контуры. Вы получаете бонус предмета +1 к визуальным проверкам Восприятия.",
    rules: [{
      key: "FlatModifier",
      selector: "perception",
      type: "item",
      value: 1,
      predicate: ["item:trait:visual"],
    }],
  }),
  makeEquipment({
    id: IDS.chemicalAnalyzer,
    name: "Химический анализатор ПКТ",
    level: 4,
    price: 900,
    hardCost: 2,
    implantType: "Внутренний",
    effect:
      "Встроенная лаборатория анализирует воздух, воду и контактные пробы. Вы получаете бонус предмета +2 к проверкам определения химикатов, токсинов и наркотиков.",
  }),
  makeEquipment({
    id: IDS.radiationDetector,
    name: "Детектор радиации ПКТ",
    level: 3,
    price: 600,
    hardCost: 1,
    implantType: "Внутренний",
    effect:
      "Дозиметр непрерывно измеряет ионизирующее излучение и предупреждает о накопленной дозе. Он определяет опасный фон без отдельной проверки.",
  }),
  makeEquipment({
    id: IDS.techscanner,
    name: "Техсканер ПКТ",
    level: 6,
    price: 2200,
    hardCost: 2,
    implantType: "Модуль",
    effect:
      "Диагностический щуп считывает питание, шины данных и повреждения механизма. Вы получаете бонус предмета +2 к Ремеслу при ремонте техники.",
    rules: [{
      key: "FlatModifier",
      selector: "crafting",
      type: "item",
      value: 2,
      predicate: ["action:repair"],
    }],
  }),
  makeEquipment({
    id: IDS.chipSocket,
    name: "Разъём для щепок ПКТ",
    level: 2,
    price: 250,
    hardCost: 2,
    implantType: "Модуль",
    effect:
      "Изолированный разъём загружает данные и программы с совместимых щепок непосредственно в нейролинк.",
  }),
  makeEquipment({
    id: IDS.tacticalSight,
    name: "Тактический прицел ПКТ",
    level: 7,
    price: 3500,
    hardCost: 2,
    implantType: "Модуль",
    effect:
      "Баллистический вычислитель отмечает дальность, ветер и движение цели. Вы получаете бонус предмета +2 к Восприятию при наблюдении за целью, которую собираетесь атаковать.",
  }),
  makeEquipment({
    id: IDS.cyberdeckChronos,
    name: "Кибердека ПКТ «Хронос»",
    level: 8,
    price: 6000,
    hardCost: 3,
    implantType: "Модуль",
    effect:
      `Боевой сопроцессор моделирует траектории движения на несколько секунд вперёд. Модуль устанавливается в Нейролинк. Пока дека установлена, она добавляет @UUID[${ITEM_PREFIX}.${IDS.chronosFocus}]{Оверклок «Хронос»} в ваши фокусные программы и увеличивает максимум Очков Фокуса на 1. Одновременно можно установить только одну кибердеку.`,
    moduleFlags: {
      exclusiveFamily: "cyberdeck",
      grantItemUuids: [
        `${ITEM_PREFIX}.${IDS.chronosFocus}`,
      ],
    },
  }),
  makeEquipment({
    id: IDS.cyberdeckAkasha,
    name: "Кибердека ПКТ «Акаша»",
    level: 8,
    price: 6000,
    hardCost: 3,
    implantType: "Модуль",
    effect:
      `Архивный сопроцессор содержит лицензированные экспертные модели, технические справочники и слепки навыков специалистов. Модуль устанавливается в Нейролинк. Пока дека установлена, она добавляет @UUID[${ITEM_PREFIX}.${IDS.akashaFocus}]{Экспертный пакет «Акаша»} в ваши фокусные программы и увеличивает максимум Очков Фокуса на 1. Одновременно можно установить только одну кибердеку.`,
    moduleFlags: {
      exclusiveFamily: "cyberdeck",
      grantItemUuids: [
        `${ITEM_PREFIX}.${IDS.akashaFocus}`,
      ],
    },
  }),
  makeEquipment({
    id: IDS.cyberdeckOracle,
    name: "Кибердека ПКТ «Оракул машин»",
    level: 8,
    price: 6000,
    hardCost: 3,
    implantType: "Модуль",
    effect:
      `Предиктивная дека сопоставляет телеметрию противника с библиотекой атак, вредоносных программ и отказов техники. Модуль устанавливается в Нейролинк. Пока дека установлена, она добавляет @UUID[${ITEM_PREFIX}.${IDS.oracleFocus}]{Контрпрогноз «Оракул машин»} в ваши фокусные программы и увеличивает максимум Очков Фокуса на 1. Одновременно можно установить только одну кибердеку.`,
    moduleFlags: {
      exclusiveFamily: "cyberdeck",
      grantItemUuids: [
        `${ITEM_PREFIX}.${IDS.oracleFocus}`,
      ],
    },
  }),
  makeEquipment({
    id: IDS.aerohypo,
    name: "Аэрогиппо-мультитул ПКТ",
    level: 8,
    price: 4500,
    hardCost: 3,
    implantType: "Модуль",
    effect:
      "Медицинская рука сочетает инъектор, микроманипуляторы и стерильные инструменты. Вы получаете бонус предмета +2 к Медицине; встроенный Аэрогиппо может вводить препарат в Биосистему.",
    rules: [{
      key: "FlatModifier",
      selector: "medicine",
      type: "item",
      value: 2,
    }],
  }),
  makeEquipment({
    id: IDS.fireSuppressor,
    name: "Магнитный пускатель огнетушащих капсул ПКТ",
    level: 9,
    price: 9000,
    hardCost: 3,
    implantType: "Модуль",
    slots: 2,
    effect:
      "<p>Пускатель выбрасывает капсулу с углекислотной пеной.</p><hr><p><strong>Активация — Огнетушащая капсула:</strong> @Glyph[Action 1] (@Trait[Manipulate]{воздействие})</p><p><strong>Дальность:</strong> 60 футов</p><p><strong>Эффект:</strong> капсула тушит обычный огонь в квадрате 10 футов; против особого пожара может потребоваться проверка.</p>",
  }),
];

const uniqueItems = [
  makeEquipment({
    id: IDS.monoVision,
    name: "Кироши «МоноВизор»",
    folder: UNIQUE_FOLDER,
    level: 11,
    price: 16000,
    hardCost: 3,
    implantType: "База",
    slots: 6,
    unique: true,
    effect:
      "Единая панорамная оптическая база заменяет пару киберглаз. Вы получаете ночное зрение и бонус предмета +2 к визуальным проверкам Восприятия. МоноВизор является уникальной базой и не заменяется стандартной оптикой.",
    rules: [
      { key: "Sense", selector: "darkvision" },
      {
        key: "FlatModifier",
        selector: "perception",
        type: "item",
        value: 2,
        predicate: ["item:trait:visual"],
      },
    ],
  }),
  makeEquipment({
    id: IDS.copernicusCore,
    name: "Контур космической адаптации «Коперник»",
    folder: UNIQUE_FOLDER,
    level: 11,
    price: 9000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "Дублированная автоматика герметизации, теплообмена и ориентации рассчитана на строительные работы в вакууме. Вы получаете сопротивление холоду 10; правила дыхания и давления определяются сценой.",
    rules: [{ key: "Resistance", type: "cold", value: 10 }],
  }),
  makeEquipment({
    id: IDS.aquariusDrive,
    name: "Гидродвижитель «Водолей»",
    folder: UNIQUE_FOLDER,
    level: 8,
    price: 7000,
    hardCost: 3,
    implantType: "База",
    slots: 4,
    unique: true,
    effect:
      "Единый хвостовой движитель заменяет пару киберног и рассчитан на глубоководное маневрирование. Вы получаете Скорость плавания 25 футов. Эта уникальная база не заменяется стандартными киберногами.",
    rules: [{ key: "BaseSpeed", selector: "swim", value: 25 }],
  }),
  makeEquipment({
    id: IDS.dragoonArmor,
    name: "Защитное покрытие «Драгун»",
    folder: UNIQUE_FOLDER,
    level: 18,
    price: 180000,
    hardCost: 0,
    implantType: "Внешний",
    unique: true,
    effect:
      "Многослойная военная оболочка Милитех непрерывно меняет геометрию пластин и уводит попадания от уязвимых узлов. Вы получаете бонус обстоятельства +1 к КБ. Foundry применяет его автоматически и сам учитывает, что бонусы обстоятельства не складываются.",
    rules: [{
      key: "FlatModifier",
      selector: "ac",
      type: "circumstance",
      value: 1,
    }],
  }),
  makeEquipment({
    id: IDS.dragoonNode,
    name: "Тактический узел «Драгун»",
    folder: UNIQUE_FOLDER,
    level: 18,
    price: 95000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "Боевой вычислитель объединяет сенсоры корпуса и прогнозирует угрозы. Вы получаете бонус предмета +2 к Восприятию.",
    rules: [{
      key: "FlatModifier",
      selector: "perception",
      type: "item",
      value: 2,
    }],
  }),
  makeEquipment({
    id: IDS.dragoon2Armor,
    name: "Адаптивное защитное покрытие «Драгун 2.0»",
    folder: UNIQUE_FOLDER,
    level: 20,
    price: 400000,
    hardCost: 0,
    implantType: "Внешний",
    unique: true,
    effect:
      "Активная многослойная броня предсказывает точку попадания и перестраивает пластины за долю секунды до контакта. Вы получаете бонус обстоятельства +2 к КБ. Foundry применяет его автоматически и сам учитывает, что бонусы обстоятельства не складываются.",
    rules: [{
      key: "FlatModifier",
      selector: "ac",
      type: "circumstance",
      value: 2,
    }],
  }),
  makeEquipment({
    id: IDS.dragoon2Node,
    name: "Тактический узел «Драгун 2.0»",
    folder: UNIQUE_FOLDER,
    level: 20,
    price: 250000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "Предиктивный боевой вычислитель объединяет сенсоры корпуса и непрерывно моделирует действия противника. Вы получаете бонус предмета +3 к Восприятию.",
    rules: [{
      key: "FlatModifier",
      selector: "perception",
      type: "item",
      value: 3,
    }],
  }),
  makeEquipment({
    id: IDS.dragoon2Reactor,
    name: "Штурмовой реактор «Драгун 2.0»",
    folder: UNIQUE_FOLDER,
    level: 20,
    price: 350000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "<p><strong>Активация — Таранный проход:</strong> @Glyph[Action 2] (@Trait[Move]{движение}, @Trait[Manipulate]{воздействие})</p><p><strong>Частота:</strong> не чаще одного раза в раунд</p><p><strong>Эффект:</strong> вы двигаетесь по прямой на расстояние вплоть до удвоенной Скорости и можете проходить через пространства противников не более чем на один размер крупнее вас. Для каждого такого противника совершите проверку Атлетики против его КС Стойкости. При критическом успехе вы проходите дальше, отталкиваете цель на 10 футов в ближайшее свободное пространство вне вашего пути, наносите ей дробящий урон, равный удвоенному модификатору Силы, и она застигнута врасплох до начала своего следующего хода. При успехе вы проходите дальше, отталкиваете цель на 5 футов и наносите дробящий урон, равный модификатору Силы. При провале движение заканчивается перед целью. Это не действие @UUID[Compendium.sf2e.actions.Item.7blmbDrQFNfdT731]{Толкнуть / Shove}.</p>",
  }),
  makeEquipment({
    id: IDS.eclipseCore,
    name: "Контур бесшумного движения «Затмение»",
    folder: UNIQUE_FOLDER,
    level: 14,
    price: 35000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "Приводы заранее гасят шум, вибрацию и колебания обшивки, а предиктивная стабилизация удерживает корпус на сложной опоре. Вы получаете бонус предмета +3 к Скрытности и Акробатике.",
    rules: [
      {
        key: "FlatModifier",
        selector: "stealth",
        type: "item",
        value: 3,
      },
      {
        key: "FlatModifier",
        selector: "acrobatics",
        type: "item",
        value: 3,
      },
    ],
  }),
  makeWeapon({
    id: IDS.monoThree,
    name: "Kendachi «Моно-Три»",
    level: 14,
    price: 45000,
    hardCost: 4,
    effect:
      "Три складных монолезвия выходят из предплечья и складываются заподлицо с обшивкой.",
    melee: true,
    damage: {
      slots: 2,
      dice: 1,
      die: "d8",
      damageType: "slashing",
      group: "knife",
      baseItem: "sword-cane",
    },
    traits: ["agile", "concealable", "deadly-d8", "finesse"],
    grade: "superior",
  }),
  makeWeapon({
    id: IDS.lawmanLauncher,
    name: "Выкидной гранатомёт «Страж порядка»",
    level: 11,
    price: 12000,
    hardCost: 4,
    effect:
      "Двухзарядный гранатомёт скрыт в киберруке и разворачивается по нейрокоманде.",
    melee: false,
    damage: { slots: 2, range: 60, capacity: 2, reload: "2" },
    traits: ["concealable"],
    grade: "advanced",
    rules: grenadeLauncherCastRules,
  }),
  makeWeapon({
    id: IDS.lawmanBaton,
    name: "Выкидная дубинка-шокер «Страж порядка»",
    level: 9,
    price: 7000,
    hardCost: 3,
    effect:
      "Телескопическая электродубинка спрятана в предплечье и рассчитана на силовое задержание.",
    melee: true,
    damage: {
      slots: 1,
      dice: 1,
      die: "d6",
      damageType: "electricity",
      group: "club",
      baseItem: "club",
    },
    traits: ["agile", "concealable", "nonlethal"],
    grade: "advanced",
  }),
  makeEquipment({
    id: IDS.spiderShoulder,
    name: "Искусственный плечевой узел «Паук 2.0»",
    folder: UNIQUE_FOLDER,
    level: 20,
    price: 250000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "<p>Узел синхронизирует четыре киберруки без штрафов за конфликт моторики. Дополнительные руки не дают дополнительных действий. Вы получаете Скорость карабканья, равную вашей наземной Скорости.</p><hr><p><strong>Активация — Синхронный перехват:</strong> @Glyph[Free] (@Trait[Manipulate]{воздействие})</p><p><strong>Частота:</strong> один раз в раунд</p><p><strong>Требование:</strong> хотя бы одна киберрука свободна.</p><p><strong>Эффект:</strong> достаньте, уберите или переложите удерживаемый предмет.</p>",
    rules: [{
      key: "BaseSpeed",
      selector: "climb",
      value: "@actor.system.movement.speeds.land.value",
    }],
  }),
  makeEquipment({
    id: IDS.pitSurvival,
    name: "Контур выживания «Яма»",
    folder: UNIQUE_FOLDER,
    level: 11,
    price: 15000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "Промышленная система изолирует жизненно важные узлы в аварийной среде. Вы получаете сопротивление кислоте 5 и электричеству 5.",
    rules: [
      { key: "Resistance", type: "acid", value: 5 },
      { key: "Resistance", type: "electricity", value: 5 },
    ],
  }),
  makeEquipment({
    id: IDS.samsonCore,
    name: "Промышленный силовой блок «Самсон»",
    folder: UNIQUE_FOLDER,
    level: 15,
    price: 70000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "Силовой блок NovelTech рассчитан на непрерывную тяжёлую работу. Порог Массы, при котором вы становитесь перегружены, и ваша максимальная переносимая Масса увеличиваются на 2. При определении того, можете ли вы поднять, удержать или сдвинуть объект, считайте себя на один размер крупнее.",
    rules: [
      {
        key: "ActiveEffectLike",
        mode: "add",
        path: "inventory.bulk.encumberedAfterAddend",
        value: 2,
      },
      {
        key: "ActiveEffectLike",
        mode: "add",
        path: "inventory.bulk.maxAddend",
        value: 2,
      },
    ],
  }),
  makeEquipment({
    id: IDS.sageDecoyBrain,
    name: "Ложный мозг «Мудрец»",
    folder: UNIQUE_FOLDER,
    img: DEFAULT_IMG,
    level: 8,
    price: 45000,
    hardCost: 0,
    implantType: "Модуль",
    slots: 2,
    unique: true,
    effect:
      "<p>Ложный мозг устанавливается в Нейролинк, занимает 2 его слота и служит одноразовым аппаратным буфером для враждебных программ.</p><hr><p><strong>Активация — Аварийная переадресация:</strong> @Glyph[Reaction] (@Trait[Concentrate]{концентрация})</p><p><strong>Триггер:</strong> вы совершили бросок против программы или узнали нанесённый ею урон и эффекты, но они ещё не применены.</p><p><strong>Эффект:</strong> перенаправьте на ложный мозг весь урон и все эффекты этой программы, которые должны были примениться к вам. Вы не получаете ничего из перенаправленного. Ложный мозг мгновенно уничтожается: удалите этот предмет с персонажа. Он не ремонтируется и заменяется новым модулем за полную цену.</p>",
    moduleFlags: {
      exclusiveFamily: "sage-decoy-brain",
    },
  }),
  makeEquipment({
    id: IDS.kildareCore,
    name: "Медицинский контур «Киль-Дара»",
    folder: UNIQUE_FOLDER,
    level: 12,
    price: 18000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "Контур Trauma Team калибрует инструменты под ткани пациента и загружает @UUID[Compendium.cyberpunk-remaster.cyberpunk-items.Item.K1lD4rE9hE4lD10x]{протокол лечения «Киль-Дара»}. При успешном Лечении ран и Боевой медицине бросайте d10 вместо d8; кроме того, восстановите дополнительные ОЗ, равные вашему уровню, как у черты жреца «Магические руки».",
    moduleFlags: {
      grantItemUuids: [
        `${ITEM_PREFIX}.${IDS.kildareProtocol}`,
      ],
    },
  }),
  makeEquipment({
    id: IDS.sulfurController,
    name: "Контур пожаротушения «Сера»",
    folder: UNIQUE_FOLDER,
    level: 11,
    price: 12000,
    hardCost: 0,
    implantType: "Внутренний",
    unique: true,
    effect:
      "Центральный контроллер анализирует очаги возгорания и координирует магнитные пускатели огнетушащих капсул. Вы получаете бонус предмета +2 к проверкам против дыма и удушья.",
  }),
];

const supportItems = [
  makeFocusSpell({
    id: IDS.chronosFocus,
    name: "Оверклок «Хронос»",
    time: "1",
    traits: ["move"],
    description:
      "<p>Дека прогоняет ближайшие варианты движения и подаёт команды приводам раньше, чем вы успеваете осознать опасность. Совершите @UUID[Compendium.sf2e.actions.Item.UHpkTuCtyaPqiCAB]{Шаг}, затем @UUID[Compendium.sf2e.actions.Item.Bcxarzksqt9ezrs6]{Перемещение}, либо выполните их в обратном порядке. До завершения этих перемещений вы получаете бонус обстоятельства +1 к КБ против реакций, спровоцированных вашим движением.</p>",
  }),
  makeFocusSpell({
    id: IDS.akashaFocus,
    name: "Экспертный пакет «Акаша»",
    time: "reaction",
    traits: ["fortune"],
    requirements: "Вы обучены Компьютерам",
    description:
      "<p><strong>Триггер:</strong> вы собираетесь выполнить проверку, чтобы @UUID[Compendium.sf2e.actions.Item.1OagaWtBpVXExToo]{Вспомнить информацию} о технологии, распознать или взломать техническое устройство либо отремонтировать его, но ещё не бросили кость.</p><hr><p>Дека загружает подходящую экспертную модель. Для спровоцировавшей проверки вы можете использовать свой модификатор Компьютеров вместо обычного навыка. Если проверка уже использует Компьютеры, бросьте дважды и используйте лучший результат.</p>",
  }),
  makeFocusSpell({
    id: IDS.oracleFocus,
    name: "Контрпрогноз «Оракул машин»",
    time: "reaction",
    traits: ["fortune"],
    description:
      "<p><strong>Триггер:</strong> вы стали целью атаки технического устройства или программы либо должны совершить спасбросок против их эффекта; бросок ещё не сделан.</p><hr><p>Дека строит контрмодель атаки. Если эффект требует спасброска, бросьте его дважды и используйте лучший результат. Если эффект атакует ваш КБ, вы получаете бонус обстоятельства +2 к КБ против спровоцировавшей атаки.</p>",
  }),
  makeFeat({
    id: IDS.kildareProtocol,
    name: "Протокол лечения «Киль-Дара»",
    level: 12,
    slug: "magic-hands",
    description:
      "Контур «Киль-Дара» заменяет стандартные медицинские алгоритмы протоколом жреца «Магические руки». При успешном Лечении ран и Боевой медицине бросайте d10 вместо d8 и восстановите дополнительные ОЗ, равные вашему уровню. Эта служебная черта автоматически добавляется установленным контуром и удаляется вместе с ним.",
  }),
];

function upsertItem(item) {
  const index = items.findIndex((candidate) => candidate._id === item._id);
  if (index >= 0) {
    const existing = items[index];
    if (
      item.img === DEFAULT_IMG &&
      existing.img &&
      existing.img !== DEFAULT_IMG
    ) {
      // Icons are authored in Foundry. Regenerating PKT mechanics must not
      // replace a user's chosen stable filename with the default placeholder.
      item.img = existing.img;
    }
    items[index] = item;
  } else {
    items.push(item);
  }
}

for (const item of [...universalItems, ...uniqueItems, ...supportItems]) {
  upsertItem(item);
}

const skull = itemById.get("6Lnce5KtpF8VqE6O");
if (skull) skull.folder = GENERIC_FOLDER;
const chameleonCoating = itemById.get("XrMKojmO5brKtWGR");
if (chameleonCoating) chameleonCoating.folder = UNIQUE_FOLDER;
const enhancedHearing = items.find((item) => item._id === "ZxPOaEPP0tLRu1lE");
const enhancedHearingRule = enhancedHearing?.system?.rules?.find(
  (rule) =>
    rule.key === "FlatModifier" &&
    (rule.selector === "perception" ||
      rule.selector?.includes?.("perception")),
);
if (enhancedHearingRule) {
  enhancedHearingRule.predicate = [
    "action:seek",
    "item:trait:auditory",
  ];
}
for (const microWaldoId of [
  "iLDc2UKdHD3zKOt2",
  "XIaKqTB6DNfy70nx",
  "4gZ8c238WvFylavz",
]) {
  const microWaldo = items.find((item) => item._id === microWaldoId);
  const microWaldoRule = microWaldo?.system?.rules?.find(
    (rule) =>
      rule.key === "FlatModifier" &&
      rule.selector === "medicine",
  );
  if (microWaldoRule) microWaldoRule.type = "circumstance";
  if (microWaldo?.system?.description?.value) {
    microWaldo.system.description.value =
      microWaldo.system.description.value.replace(
        /Активация\s*—\s*Оперировать\s*<\/strong>\s*:/u,
        "Активация — Оперировать:</strong>",
      );
  }
}
function normalizeActivationMarkup(document) {
  if (document.system?.description?.value) {
    document.system.description.value = document.system.description.value
      .replace(
        /<strong>Активация\s*—\s*([^<:]+):<\/strong>/gu,
        "<strong>Активация — $1:</strong>",
      )
      .replace(
        /<strong>Активация\s*—\s*([^<:]+)<\/strong>\s*:?/gu,
        "<strong>Активация — $1:</strong>",
      )
      .replace(
        /<span class="action-glyph">([A123rf])<\/span>/giu,
        (_match, glyph) => {
          const replacement = {
            "1": "Action 1",
            "2": "Action 2",
            "3": "Action 3",
            a: "Action 1",
            f: "Free",
            r: "Reaction",
          }[glyph.toLocaleLowerCase("en")];
          return replacement ? `@Glyph[${replacement}]` : _match;
        },
      );
  }
  for (const subitem of document.system?.subitems ?? []) {
    normalizeActivationMarkup(subitem);
  }
}
for (const item of items) normalizeActivationMarkup(item);

const folder = {
  _id: GENERIC_FOLDER,
  name: "ПКТ Импланты",
  type: "Item",
  folder: "YIrrBYxWOSnGHL7N",
  sorting: "a",
  sort: 100000,
  color: "#002c42",
  flags: {},
  ownership: { default: 0 },
  _stats: {
    coreVersion: "14.361",
    systemId: "sf2e",
    systemVersion: "1.2.0",
  },
};
const folderIndex = folders.findIndex((entry) => entry._id === folder._id);
if (folderIndex >= 0) folders[folderIndex] = folder;
else folders.push(folder);

function upsertPktComponent(component) {
  const index = pktComponents.findIndex(
    (entry) => entry.itemId === component.itemId,
  );
  if (index >= 0) pktComponents[index] = component;
  else pktComponents.push(component);
}

upsertPktComponent({
  itemId: IDS.monoVision,
  family: "cyber-eye",
  quality: 2,
  special: true,
  replaceable: false,
});
upsertPktComponent({
  itemId: IDS.aquariusDrive,
  family: "cyber-leg",
  quality: 1,
  special: true,
  replaceable: false,
});

const BODIES = {
  serial: ["uvmhsMeuPT9EsaH8", 0],
  tactical: ["tg2eHjiZMoKUxtTR", 1],
  advanced: ["tkeQt2AZwYxlo0G4", 2],
  superior: ["Y6CGkTe62Gray49S", 3],
  elite: ["Ozh4qKfrpO3vIyXD", 4],
  absolute: ["tVLVycxfLpejAKaO", 5],
};
const BASES = {
  0: {
    arm: "WZzwXU0ef7Yx8itS",
    audio: "flVKT2G69kaubzSz",
    eye: "uKhSDhKc84Gk8mXU",
    leg: "SHvNjIPjtGTvdt5K",
    neural: "3TQ2WCBNaFwEUDHo",
  },
  1: {
    arm: "0SWZlFXOhLgKJdD4",
    audio: "wrBmpNUgCDClReJk",
    eye: "7IRYHaVmugCdEFsr",
    leg: "TArau54uxPp00TPr",
    neural: "PrU4x8lXoSclhUEF",
  },
  2: {
    arm: "cvuIqkqCdTswg3uF",
    audio: "Is8gWdAjU55hVtYb",
    eye: "NstC7slTFoxrUhbu",
    leg: "voKIFcyxPmzJSfki",
    neural: "bMgxTWp5PGp30uQ8",
  },
  3: {
    arm: "mnHATtZUwDIcl7K8",
    audio: "yGnMhyXCX5CAs63S",
    eye: "1aFhSbLd1NXpzNPI",
    leg: "voKIFcyxPmzJSfki",
    neural: "bMgxTWp5PGp30uQ8",
  },
};

const entry = (
  key,
  itemId,
  family,
  {
    quantity = 1,
    stress = "normal",
    parentFamily = null,
    replaceableBase = false,
    locked = true,
  } = {},
) => ({
  key,
  itemId,
  family,
  quantity,
  stress,
  locked,
  replaceableBase,
  ...(parentFamily ? { parentFamily } : {}),
});
const unique = (
  key,
  itemId,
  {
    quantity = 1,
    stress = "waived",
    family = "pkt-unique",
    parentFamily = null,
    replaceableBase = false,
    locked = true,
  } = {},
) =>
  entry(key, itemId, family, {
    quantity,
    stress,
    parentFamily,
    replaceableBase,
    locked,
  });
const moduleEntry = (key, itemId, parentFamily, options = {}) =>
  entry(key, itemId, `${parentFamily}-module`, {
    ...options,
    parentFamily,
  });

function structure(
  quality,
  {
    arms = 2,
    audio = true,
    eyes = 2,
    legs = 2,
    neural = true,
    skull = true,
    endoskeleton = "lvhux6M22BuSYNlj",
  } = {},
) {
  const base = BASES[quality];
  return [
    ...(arms
      ? [entry("cyber-arms", base.arm, "cyber-arm", {
          quantity: arms,
          stress: "waived",
          replaceableBase: true,
        })]
      : []),
    ...(audio
      ? [entry("cyber-audio", base.audio, "cyber-audio", {
          stress: "waived",
          replaceableBase: true,
        })]
      : []),
    ...(eyes
      ? [entry("cyber-eyes", base.eye, "cyber-eye", {
          quantity: eyes,
          stress: "waived",
          replaceableBase: true,
        })]
      : []),
    ...(legs
      ? [entry("cyber-legs", base.leg, "cyber-leg", {
          quantity: legs,
          stress: "waived",
          replaceableBase: true,
        })]
      : []),
    ...(neural
      ? [entry("neural-link", base.neural, "neural-link", {
          stress: "waived",
          replaceableBase: true,
        })]
      : []),
    ...(skull
      ? [entry("cyber-skull", "6Lnce5KtpF8VqE6O", "pkt-structure", {
          stress: "waived",
        })]
      : []),
    ...(endoskeleton
      ? [entry("endoskeleton", endoskeleton, "endoskeleton", {
          stress: "waived",
        })]
      : []),
  ];
}

function model({
  key,
  name,
  pageId,
  body,
  unique: uniqueEntries = [],
  components,
  choices = [],
}) {
  return {
    schema: 1,
    key,
    name,
    journalId: JOURNAL_ID,
    pageId,
    requiredBodyId: body[0],
    bodyQuality: body[1],
    priceEddies: 0,
    unique: uniqueEntries,
    components,
    choices,
  };
}

const newModels = [
  model({
    key: "cybermatrix-copernicus",
    name: "Cybermatrix Inc. «Коперник»",
    pageId: IDS.copernicusPage,
    body: BODIES.advanced,
    unique: [
      unique("copernicus-core", IDS.copernicusCore),
      unique("mono-vision", IDS.monoVision, {
        family: "cyber-eye",
        replaceableBase: false,
      }),
    ],
    components: [
      ...structure(2, { eyes: 0, endoskeleton: "ZjLOJXI4FD2i1512" }),
      entry("emi-shield", IDS.emiShield, "pkt-defense", { quantity: 2 }),
      moduleEntry("grips", IDS.grip, "cyber-arm", { quantity: 2 }),
      entry("hydraulics", IDS.hydraulics, "pkt-internal"),
      moduleEntry("transformer-feet", IDS.transformerFoot, "cyber-leg", {
        quantity: 2,
      }),
      moduleEntry("radar-sonar", IDS.radarSonar, "cyber-audio"),
      moduleEntry("radio", IDS.radio, "cyber-audio"),
      moduleEntry("arm-multitools", IDS.armMultitool, "cyber-arm", {
        quantity: 2,
      }),
      moduleEntry("zero-gravity", IDS.zeroGravity, "cyber-leg", {
        quantity: 2,
      }),
      moduleEntry("anti-dazzle", "ZyWwRVfa97xTAo4d", "cyber-eye"),
    ],
  }),
  model({
    key: "dynalar-aquarius",
    name: "Dynalar «Водолей»",
    pageId: IDS.aquariusPage,
    body: BODIES.tactical,
    unique: [
      unique("aquarius-drive", IDS.aquariusDrive, {
        family: "cyber-leg",
        replaceableBase: false,
      }),
    ],
    components: [
      ...structure(1, {
        audio: false,
        legs: 0,
        endoskeleton: "lvhux6M22BuSYNlj",
      }),
      entry("advanced-audio", BASES[2].audio, "cyber-audio", {
        stress: "waived",
        replaceableBase: true,
      }),
      moduleEntry("ir-uv", "QqRn625xdHY8xLaP", "cyber-eye", {
        quantity: 2,
      }),
      moduleEntry("radar-detector", IDS.radarDetector, "cyber-audio"),
      moduleEntry("radio", IDS.radio, "cyber-audio"),
      moduleEntry("radar-sonar", IDS.radarSonar, "cyber-audio"),
      entry("subdermal-armor", "IKHNA2PcSB3zIMlp", "skin-armor"),
    ],
  }),
  model({
    key: "dynalar-sulfur",
    name: "Dynalar «Сера»",
    pageId: IDS.sulfurPage,
    body: BODIES.advanced,
    unique: [
      unique("sulfur-coating", "jhK1TZLzHOJeflTC", { stress: "normal" }),
      unique("sulfur-controller", IDS.sulfurController),
    ],
    components: [
      ...structure(2, { endoskeleton: "lvhux6M22BuSYNlj" }),
      moduleEntry("enhanced-hearing", "ZxPOaEPP0tLRu1lE", "cyber-audio"),
      entry("heavy-subdermal", "xQYaULcqM8yE194M", "skin-armor"),
      moduleEntry("ir-uv", "QqRn625xdHY8xLaP", "cyber-eye"),
      moduleEntry("radar-sonar", IDS.radarSonar, "cyber-audio"),
      moduleEntry("radio", IDS.radio, "cyber-audio"),
      moduleEntry("fire-suppressors", IDS.fireSuppressor, "cyber-arm", {
        quantity: 2,
      }),
    ],
  }),
  model({
    key: "militech-dragoon",
    name: "Militech «Драгун»",
    pageId: IDS.dragoonPage,
    body: BODIES.elite,
    unique: [
      unique("dragoon-armor", IDS.dragoonArmor),
      unique("dragoon-node", IDS.dragoonNode),
    ],
    components: [
      ...structure(3, { endoskeleton: "8S1Ma3b6ReGxwpvA" }),
      entry("emi-shield", IDS.emiShield, "pkt-defense", { quantity: 2 }),
      moduleEntry("anti-dazzle", "ZyWwRVfa97xTAo4d", "cyber-eye", {
        quantity: 2,
      }),
      moduleEntry("chiron", "GBtIO5fqFGD9Dzk1", "cyber-audio"),
      moduleEntry("internal-agent", "M8uvPCSLMkBqSrzA", "neural-link"),
      moduleEntry("ir-uv", "QqRn625xdHY8xLaP", "cyber-eye", {
        quantity: 2,
      }),
      entry("hydraulics", IDS.hydraulics, "pkt-internal"),
    ],
  }),
  model({
    key: "militech-dragoon-2",
    name: "Militech «Драгун 2.0»",
    pageId: IDS.dragoon2Page,
    body: BODIES.absolute,
    unique: [
      unique("dragoon-2-armor", IDS.dragoon2Armor),
      unique("dragoon-2-node", IDS.dragoon2Node),
      unique("dragoon-2-reactor", IDS.dragoon2Reactor),
    ],
    components: [
      ...structure(3, { endoskeleton: "8S1Ma3b6ReGxwpvA" }),
      entry("emi-shield", IDS.emiShield, "pkt-defense", { quantity: 2 }),
      moduleEntry("anti-dazzle", "ZyWwRVfa97xTAo4d", "cyber-eye", {
        quantity: 2,
      }),
      moduleEntry("chiron", "GBtIO5fqFGD9Dzk1", "cyber-audio"),
      moduleEntry("internal-agent", "M8uvPCSLMkBqSrzA", "neural-link"),
      moduleEntry("ir-uv", "QqRn625xdHY8xLaP", "cyber-eye", {
        quantity: 2,
      }),
      entry("hydraulics", IDS.hydraulics, "pkt-internal"),
    ],
  }),
  model({
    key: "militech-eclipse",
    name: "Militech «Затмение»",
    pageId: IDS.eclipsePage,
    body: BODIES.superior,
    unique: [
      unique("eclipse-core", IDS.eclipseCore),
      unique("mono-vision", IDS.monoVision, {
        family: "cyber-eye",
        replaceableBase: false,
      }),
      unique("mono-three", IDS.monoThree, {
        stress: "normal",
        family: "cyber-arm-module",
        parentFamily: "cyber-arm",
      }),
      unique("chameleon-coating", "XrMKojmO5brKtWGR", {
        quantity: 1,
        family: "pkt-coating",
      }),
    ],
    components: [
      ...structure(3, { eyes: 0, endoskeleton: "ZjLOJXI4FD2i1512" }),
      moduleEntry("enhanced-hearing", "ZxPOaEPP0tLRu1lE", "cyber-audio"),
      moduleEntry("ir-uv", "QqRn625xdHY8xLaP", "cyber-eye"),
      moduleEntry("radio", IDS.radio, "cyber-audio"),
      moduleEntry("encryption", "3ZY93agCTvzr588o", "cyber-audio"),
      entry("subdermal-armor", "IKHNA2PcSB3zIMlp", "skin-armor"),
      entry("subdermal-pockets", IDS.subdermalPocket, "pkt-storage", {
        quantity: 2,
      }),
      entry("hydraulics", IDS.hydraulics, "pkt-internal"),
    ],
  }),
  model({
    key: "militech-lawman",
    name: "Militech «Страж порядка»",
    pageId: IDS.lawmanPage,
    body: BODIES.advanced,
    unique: [
      unique("mono-vision", IDS.monoVision, {
        family: "cyber-eye",
        replaceableBase: false,
      }),
      unique("popup-launcher", IDS.lawmanLauncher, {
        stress: "normal",
        family: "cyber-arm-module",
        parentFamily: "cyber-arm",
      }),
      unique("shock-baton", IDS.lawmanBaton, {
        stress: "normal",
        family: "cyber-arm-module",
        parentFamily: "cyber-arm",
      }),
    ],
    components: [
      ...structure(2, { eyes: 0, endoskeleton: "lvhux6M22BuSYNlj" }),
      moduleEntry("anti-dazzle", "ZyWwRVfa97xTAo4d", "cyber-eye"),
      moduleEntry("audio-recorder", "uMJzcFLUXea4H5kr", "cyber-audio"),
      entry("heavy-subdermal", "xQYaULcqM8yE194M", "skin-armor"),
      moduleEntry("hidden-holster", "ib7UwlCqzgOlC4wK", "cyber-arm"),
      moduleEntry("ir-uv", "QqRn625xdHY8xLaP", "cyber-eye"),
      moduleEntry("radio", IDS.radio, "cyber-audio"),
      moduleEntry("tactical-sight", IDS.tacticalSight, "cyber-eye"),
      moduleEntry("voice-stress", "LTKAV0EyBY3wpLaz", "cyber-audio"),
    ],
  }),
  model({
    key: "militech-spider-2",
    name: "Militech «Паук 2.0»",
    pageId: IDS.spiderPage,
    body: BODIES.absolute,
    unique: [
      unique("spider-shoulder", IDS.spiderShoulder),
      unique("mono-vision", IDS.monoVision, {
        family: "cyber-eye",
        replaceableBase: false,
      }),
    ],
    components: [
      ...structure(3, {
        arms: 4,
        eyes: 0,
        endoskeleton: "ZjLOJXI4FD2i1512",
      }),
      moduleEntry("enhanced-hearing", "ZxPOaEPP0tLRu1lE", "cyber-audio"),
      moduleEntry("chip-socket", IDS.chipSocket, "neural-link"),
      entry("chameleon-coating", "XrMKojmO5brKtWGR", "pkt-coating"),
      moduleEntry("grips", IDS.grip, "cyber-arm", { quantity: 4 }),
      moduleEntry("grip-soles", IDS.gripSole, "cyber-leg", { quantity: 2 }),
      moduleEntry("internal-agent", "M8uvPCSLMkBqSrzA", "neural-link"),
      moduleEntry("ir-uv", "QqRn625xdHY8xLaP", "cyber-eye"),
      moduleEntry("micro-video", "PJaarOSEHTLje8sT", "cyber-eye"),
      moduleEntry("tactile-boost", IDS.tactileBoost, "cyber-arm"),
      moduleEntry("teleoptics", IDS.teleoptics, "cyber-eye"),
      entry("hydraulics", IDS.hydraulics, "pkt-internal"),
    ],
  }),
  model({
    key: "moore-technologies-pit",
    name: "Moore Technologies «Яма»",
    pageId: IDS.pitPage,
    body: BODIES.advanced,
    unique: [unique("pit-survival", IDS.pitSurvival)],
    components: [
      ...structure(2, { endoskeleton: "ZjLOJXI4FD2i1512" }),
      entry("chemical-analyzer", IDS.chemicalAnalyzer, "pkt-sensor"),
      moduleEntry("chip-socket", IDS.chipSocket, "neural-link"),
      moduleEntry("chiron", "GBtIO5fqFGD9Dzk1", "cyber-audio"),
      entry("heavy-subdermal", "xQYaULcqM8yE194M", "skin-armor"),
      moduleEntry("internal-agent", "M8uvPCSLMkBqSrzA", "neural-link"),
      entry("radiation-detector", IDS.radiationDetector, "pkt-sensor"),
    ],
  }),
  model({
    key: "noveltech-samson",
    name: "NovelTech «Самсон»",
    pageId: IDS.samsonPage,
    body: BODIES.superior,
    unique: [unique("samson-core", IDS.samsonCore)],
    components: [
      ...structure(3, { endoskeleton: "8S1Ma3b6ReGxwpvA" }),
      moduleEntry("anti-dazzle", "ZyWwRVfa97xTAo4d", "cyber-eye", {
        quantity: 2,
      }),
      moduleEntry("chiron", "GBtIO5fqFGD9Dzk1", "cyber-audio"),
      moduleEntry("internal-agent", "M8uvPCSLMkBqSrzA", "neural-link"),
      entry("radiation-detector", IDS.radiationDetector, "pkt-sensor"),
      entry("subdermal-armor", "IKHNA2PcSB3zIMlp", "skin-armor"),
      moduleEntry("techscanner", IDS.techscanner, "cyber-arm"),
      moduleEntry("arm-multitools", IDS.armMultitool, "cyber-arm", {
        quantity: 2,
      }),
    ],
  }),
  model({
    key: "raven-sage",
    name: "Raven Microcybernetics «Мудрец»",
    pageId: IDS.sagePage,
    body: BODIES.tactical,
    unique: [
      unique("sage-decoy-brain", IDS.sageDecoyBrain, {
        family: "neural-link-module",
        parentFamily: "neural-link",
        locked: false,
      }),
    ],
    components: [
      ...structure(1, {
        neural: false,
        endoskeleton: "lvhux6M22BuSYNlj",
      }),
      entry("neural-link", BASES[2].neural, "neural-link", {
        stress: "waived",
        replaceableBase: true,
      }),
      moduleEntry("chiron", "GBtIO5fqFGD9Dzk1", "cyber-audio"),
    ],
    choices: [{
      key: "cyberdeck",
      choose: 1,
      itemIds: [
        IDS.cyberdeckChronos,
        IDS.cyberdeckAkasha,
        IDS.cyberdeckOracle,
      ],
      family: "neural-link-module",
      parentFamily: "neural-link",
      stress: "normal",
      locked: true,
    }],
  }),
  model({
    key: "trauma-team-kildare",
    name: "Trauma Team «Киль-Дара»",
    pageId: IDS.kildarePage,
    body: BODIES.advanced,
    unique: [
      unique("kildare-core", IDS.kildareCore),
      unique("mono-vision", IDS.monoVision, {
        family: "cyber-eye",
        replaceableBase: false,
      }),
    ],
    components: [
      ...structure(2, { eyes: 0, endoskeleton: "lvhux6M22BuSYNlj" }),
      moduleEntry("enhanced-hearing", "ZxPOaEPP0tLRu1lE", "cyber-audio"),
      moduleEntry("chiron", "GBtIO5fqFGD9Dzk1", "cyber-audio"),
      moduleEntry("ir-uv", "QqRn625xdHY8xLaP", "cyber-eye"),
      moduleEntry("micro-optics", "z9gyRvEFA2CGgfMK", "cyber-eye"),
      moduleEntry("radio", IDS.radio, "cyber-audio"),
      moduleEntry("micro-waldo", "XIaKqTB6DNfy70nx", "cyber-arm"),
      moduleEntry("aerohypo", IDS.aerohypo, "cyber-arm"),
      moduleEntry("arm-multitool", IDS.armMultitool, "cyber-arm"),
      moduleEntry("techscanner", IDS.techscanner, "cyber-arm"),
    ],
  }),
];

const modelByKey = new Map(
  existingModels.map((existing) => [existing.key, existing]),
);
const twins = modelByKey.get("raven-twins");
if (twins) {
  twins.choices = [{
    key: "appearance",
    choose: 1,
    itemIds: [
      "Ndx3eGnbRw5bYDLj",
      "mqkOCr9ufgYYDUto",
    ],
    stress: "normal",
    locked: true,
  }];
}
const alpha = modelByKey.get("rocklin-alpha");
if (alpha) {
  alpha.unique = (alpha.unique ?? []).filter(
    (component) => component.itemId !== "6Lnce5KtpF8VqE6O",
  );
  if (
    !(alpha.components ?? []).some(
      (component) => component.itemId === "6Lnce5KtpF8VqE6O",
    )
  ) {
    alpha.components.push(
      entry("cyber-skull", "6Lnce5KtpF8VqE6O", "pkt-structure", {
        stress: "waived",
      }),
    );
  }
}
for (const newModel of newModels) modelByKey.set(newModel.key, newModel);

const modelOrder = [
  "cybermatrix-copernicus",
  "dynalar-aquarius",
  "dynalar-sulfur",
  "militech-dragoon",
  "militech-dragoon-2",
  "militech-eclipse",
  "militech-lawman",
  "militech-spider-2",
  "moore-technologies-pit",
  "noveltech-samson",
  "raven-twins",
  "raven-sage",
  "rocklin-alpha",
  "techtronika-hammer-0",
  "trauma-team-kildare",
];
const models = modelOrder.map((key) => {
  const value = modelByKey.get(key);
  if (!value) throw new Error(`Missing PKT model ${key}`);
  return value;
});

const refreshedItemById = new Map(items.map((item) => [item._id, item]));
for (const current of models) {
  const totals = calculatePktModelPrices(refreshedItemById, current);
  if (totals.length !== 1) {
    throw new Error(
      `Model ${current.key} has non-deterministic prices: ${totals.join(", ")}`,
    );
  }
  current.priceEddies = totals[0];
}

const intros = {
  "cybermatrix-copernicus":
    "Cybermatrix Inc. выводит тяжёлую работу за пределы атмосферы. «Коперник» герметичен, устойчив к холоду и одинаково уверенно держится за обшивку станции и за каркас нового орбитального города.",
  "dynalar-aquarius":
    "Dynalar «Водолей» превращает океан из препятствия в рабочую среду. Тихий гидродвижитель, панорамные сенсоры и глубоководная автоматика созданы для исследователей, спасателей и тех, кто предпочитает подходить снизу.",
  "dynalar-sulfur":
    "Огонь — величайший инструмент человечества. «Сера» создана, чтобы напомнить ему, кто здесь хозяин: жаростойкая оболочка, тяжёлая защита и два пускателя капсул подавляют очаг до того, как он станет катастрофой.",
  "militech-dragoon":
    "Обновлённый «Драгун» — военная платформа для следующей корпоративной войны. Милитех снизил смертность пилота, усилил броню и оставил вооружение сменным: миссия меняется, превосходство остаётся.",
  "militech-dragoon-2":
    "«Драгун 2.0» — абсолютная штурмовая платформа Милитех для конфликтов, где обычный Драгун уже считается лёгкой техникой. Адаптивная броня, предиктивный узел и реактор боевого цикла превращают корпус в самостоятельный ударный комплекс.",
  "militech-eclipse":
    "Официально подразделений невидимых киборгов не существует. Неофициально «Затмение» уже покинуло комнату: бесшумные приводы, активная маскировка и Kendachi «Моно-Три» не оставляют повода задавать второй вопрос.",
  "militech-lawman":
    "Защищать и служить проще, когда служебный корпус переживает перестрелку лучше патрульной машины. «Страж порядка» сочетает наблюдение, тяжёлую защиту и скрытое оружие для самых горячих смен.",
  "militech-spider-2":
    "«Паук 2.0» собирает разведданные быстрее, чем конкуренты успевают удалить архив. Четыре руки, панорамная оптика и распределённые датчики делают его мобильной платформой технической разведки.",
  "moore-technologies-pit":
    "Moore Technologies отправляет «Яму» туда, куда рациональный подрядчик не отправит людей. Химия, радиация, аварийное питание — корпус продолжает работу, пока риск уже заложен в смету.",
  "noveltech-samson":
    "Один «Самсон» заменяет бригаду, не просит сверхурочных и не берёт больничный. NovelTech объединила промышленный силовой блок, ремонтные инструменты и тяжёлый каркас для круглосуточной стройки.",
  "raven-sage":
    "«Мудрец» переносит рабочее место нетраннера в доступный тактический корпус. Выберите одну из трёх специализированных дек, подключите прямой нейроинтерфейс, а ложный мозг примет на себя ту программу, которую вы не можете пережить.",
  "trauma-team-kildare":
    "Когда счёт идёт на секунды, руки Trauma Team должны быть точнее любой машины. «Киль-Дара» объединяет диагностику, микроинструменты и Аэрогиппо в хирургическую платформу, которая сама приходит к пациенту.",
  "raven-twins":
    "Все преимущества боргирования, но ни одного косого взгляда! «Близнецы» скрывают полный корпус под безупречной человеческой внешностью — повседневная жизнь ещё никогда не была такой долговечной.",
  "rocklin-alpha":
    "«Класс Альфа» — золотой стандарт доступной полной конверсии: проверенная конструкция, понятное обслуживание и всё необходимое, чтобы впервые оставить органические ограничения позади.",
  "techtronika-hammer-0":
    "Techtronika представляет «МОЛОТ-0» — корпус, который превращает давление боя в преимущество. Тактические приводы, тяжёлая броня и контур «Красная зона» делают боль топливом, а каждую попытку остановить владельца — дорогостоящей ошибкой. «МОЛОТ-0»: войдите первым, выйдите последним.",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function itemLink(itemId) {
  const item = refreshedItemById.get(itemId);
  return `@UUID[${ITEM_PREFIX}.${itemId}]{${item?.name ?? itemId}}`;
}
function formatEntries(entries) {
  if (!entries.length) return "—";
  return entries
    .map(
      (component) =>
        `${itemLink(component.itemId)}` +
        (Number(component.quantity) > 1 ? ` ×${component.quantity}` : ""),
    )
    .join(", ");
}
function combinations(values, count, start = 0) {
  if (count === 0) return [[]];
  const result = [];
  for (let index = start; index <= values.length - count; index++) {
    for (const remainder of combinations(values, count - 1, index + 1)) {
      result.push([values[index], ...remainder]);
    }
  }
  return result;
}
function modelHumanityLoss(current) {
  let selectionSets = [{}];
  for (const choice of current.choices ?? []) {
    const choose = Math.max(1, Number(choice.choose) || 1);
    const variants = combinations(choice.itemIds ?? [], choose);
    selectionSets = selectionSets.flatMap((selections) =>
      variants.map((variant) => ({
        ...selections,
        [choice.key]: choose === 1 ? variant[0] : variant,
      }))
    );
  }
  const summaries = selectionSets.map((selections) => {
    const plan = CyberwareTab.pktInstallationPlan(current, selections);
    return CyberwareTab.pktHumanityLossSummary(plan, refreshedItemById);
  });
  const formulas = [...new Set(summaries.map((summary) => summary.formula))];
  if (formulas.length !== 1) {
    throw new Error(
      `Choices of ${current.key} produce different Humanity formulas: ` +
        formulas.join(", "),
    );
  }
  return summaries[0];
}
function pageContent(current) {
  const body = refreshedItemById.get(current.requiredBodyId);
  const uniqueEntries = current.unique ?? [];
  const choices = current.choices ?? [];
  const components = current.components ?? [];
  const uniqueRows = uniqueEntries.length
    ? `<p><strong>Уникальные импланты:</strong> ` +
      uniqueEntries
        .map(
          (component) =>
            `${itemLink(component.itemId)} ` +
            (Number(component.quantity) > 1
              ? `×${component.quantity} `
              : ""),
        )
        .join(", ") +
      "</p>"
    : "";
  const choiceRows = choices
    .map((choice) => {
      const options = choice.itemIds.map(itemLink).join(" или ");
      return (
        `<p><strong>Выберите ${choice.choose}:</strong> ${options}</p>`
      );
    })
    .join("");
  const humanity = modelHumanityLoss(current);
  const humanityRoll = humanity.formula === "0"
    ? "не требуется"
    : `[[/r ${humanity.formula} #Потеря Человечности: ${current.name}]]`;
  return (
    `<p><em>${escapeHtml(intros[current.key] ?? current.name)}</em></p>` +
    `<p><strong>Необходимый корпус ПКТ:</strong> ${itemLink(current.requiredBodyId)}</p>` +
    `<p><strong>Рекомендуемый уровень:</strong> ${body.system.level.value}</p>` +
    uniqueRows +
    choiceRows +
    `<p><strong>Комплектация:</strong><br>${formatEntries(components)}</p>` +
    `<p><strong>Потеря Человечности:</strong> ${humanityRoll}. ` +
    "Игрок выполняет этот бросок один раз и вручную уменьшает Текущую " +
    "Человечность на результат. Hard Cost каждого импланта сохраняется и " +
    "отдельно уменьшает максимум Человечности.</p>" +
    `<p><strong>Цена </strong><em>(корпус ПКТ в стоимость не входит)</em>` +
    `<strong>:</strong> ${current.priceEddies} эдди</p>`
  );
}

const INLINE_TRAITS = new Map([
  ["арканный", "Arcane"],
  ["атака", "Attack"],
  ["визуальный", "Visual"],
  ["воздействие", "Manipulate"],
  ["движение", "Move"],
  ["исследование", "Exploration"],
  ["концентрация", "Concentrate"],
  ["ментальный", "Mental"],
  ["слуховой", "Auditory"],
  ["страх", "Fear"],
  ["удача", "Fortune"],
  ["фокус", "Focus"],
  ["электричество", "Electricity"],
  ["эмоция", "Emotion"],
]);

function normalizeJournalTraitSections(content) {
  const innermost =
    /<section class="traits">((?:(?!<section class="traits">)[\s\S])*?)<\/section>/giu;
  let normalized = String(content ?? "");
  while (innermost.test(normalized)) {
    innermost.lastIndex = 0;
    normalized = normalized.replace(innermost, (_match, body) => {
      const traits = [...body.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/giu)]
        .map((entry) => entry[1].replace(/<[^>]+>/g, "").trim())
        .filter(Boolean)
        .map((label) => {
          if (label.includes("@Trait[")) return label;
          const slug = INLINE_TRAITS.get(label.toLocaleLowerCase("ru"));
          return slug ? `@Trait[${slug}]{${label}}` : label;
        });
      return traits.length
        ? `<p class="traits">${traits.join(" ")}</p>`
        : "";
    });
    innermost.lastIndex = 0;
  }
  return normalized;
}

const modelJournal = journals.find((journal) => journal._id === JOURNAL_ID);
if (!modelJournal) throw new Error("PKT model journal is missing");
const pageById = new Map(
  (modelJournal.pages ?? []).map((page) => [page._id, page]),
);
const overview = pageById.get("ylsMSP9weB5au75z");
if (!overview) throw new Error("PKT overview page is missing");
overview.sort = 100000;

const orderedModels = [...models].sort(
  (left, right) =>
    Number(left.bodyQuality) - Number(right.bodyQuality) ||
    String(left.name).localeCompare(String(right.name), "ru"),
);
for (const [index, current] of orderedModels.entries()) {
  const existing = pageById.get(current.pageId);
  const page = existing ?? {
    _id: current.pageId,
    name: current.name,
    type: "text",
    system: {},
    title: { show: true, level: 2 },
    image: {},
    text: { format: 1, content: "" },
    video: { controls: true, volume: 0.5 },
    src: null,
    category: null,
    flags: {},
    ownership: { default: -1 },
    _stats: {
      coreVersion: "14.361",
      systemId: "sf2e",
      systemVersion: "1.2.0",
      compendiumSource:
        `Compendium.cyberpunk-remaster.cyberpunk-journals.` +
        `JournalEntry.${JOURNAL_ID}.JournalEntryPage.${current.pageId}`,
    },
  };
  page.name = current.name;
  page.sort = (index + 2) * 100000;
  page.text ??= { format: 1, content: "" };
  page.text.format = 1;
  page.text.content = pageContent(current);
  page.flags ??= {};
  pageById.set(current.pageId, page);
}
modelJournal.pages = [
  overview,
  ...orderedModels.map((current) => pageById.get(current.pageId)),
].sort((left, right) => left.sort - right.sort);

for (const journal of journals) {
  for (const page of journal.pages ?? []) {
    if (page.text?.content) {
      page.text.content = normalizeJournalTraitSections(page.text.content);
    }
  }
}

items.sort((left, right) =>
  String(left.name).localeCompare(String(right.name), "ru")
);
folders.sort((left, right) =>
  String(left.name).localeCompare(String(right.name), "ru")
);
pktComponents.sort((left, right) =>
  String(left.family).localeCompare(String(right.family), "en") ||
  left.quality - right.quality ||
  String(left.itemId).localeCompare(String(right.itemId), "en")
);

await Promise.all([
  writeJson("items-export.json", items),
  writeJson("data/item-folders.json", folders),
  writeJson("data/pkt-models.json", models),
  writeJson("data/pkt-components.json", pktComponents),
  writeJson("journals-export.json", journals),
]);

const rows = models.map((current) => {
  const all = [...(current.unique ?? []), ...(current.components ?? [])];
  const hardCostOf = (itemId) => {
    const item = refreshedItemById.get(itemId);
    const match = String(item?.system?.description?.value ?? "").match(
      /\bHard\s*Cost:\s*<\/strong>\s*(\d+)/i,
    );
    return Number(match?.[1] ?? 0);
  };
  const fixedHardCost = all.reduce((total, component) => {
    return total +
      hardCostOf(component.itemId) *
        Math.max(1, Number(component.quantity) || 1);
  }, 0);
  let minimumHardCost = fixedHardCost;
  let maximumHardCost = fixedHardCost;
  for (const choice of current.choices ?? []) {
    const choose = Math.max(1, Number(choice.choose) || 1);
    const values = choice.itemIds.map(hardCostOf).sort((left, right) =>
      left - right
    );
    minimumHardCost += values
      .slice(0, choose)
      .reduce((sum, value) => sum + value, 0);
    maximumHardCost += values
      .slice(-choose)
      .reduce((sum, value) => sum + value, 0);
  }
  return {
    key: current.key,
    bodyQuality: current.bodyQuality,
    priceEddies: current.priceEddies,
    hardCost: minimumHardCost === maximumHardCost
      ? minimumHardCost
      : `${minimumHardCost}–${maximumHardCost}`,
    components: all.reduce(
      (sum, component) =>
        sum + Math.max(1, Number(component.quantity) || 1),
      0,
    ) + (current.choices ?? []).reduce(
      (sum, choice) => sum + Math.max(1, Number(choice.choose) || 1),
      0,
    ),
  };
});
console.table(rows);
console.log(
  `Added/updated ${universalItems.length} universal and ` +
    `${uniqueItems.length} unique PKT implants; ${models.length} models total.`,
);
