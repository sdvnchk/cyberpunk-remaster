import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const itemsPath = path.join(root, "items-export.json");
const journalsPath = path.join(root, "journals-export.json");

const MODULE_ID = "cyberpunk-remaster";
const ACTION_ID = "ChromeProbeAct01";
const ACTION_UUID =
  `Compendium.${MODULE_ID}.cyberpunk-items.Item.${ACTION_ID}`;
const ACTION_FOLDER_ID = "OeTN8Uj5vIrnXYng";
const BREACH_FEATURE_ID = "CixCQ5xm2SLO0uoa";
const NETRUNNER_JOURNAL_ID = "Pjlng2vgrxMg4jJW";
const NETRUNNER_PAGE_ID = "wDukeO3euLEGn6FA";
const PUBLICATION = {
  title: "SF2E Cyberpunk Remaster",
  authors: "Ogorodnik",
  license: "OGL",
  remaster: false,
};

const readJson = async (target) =>
  JSON.parse(await fs.readFile(target, "utf8"));
const writeJson = async (target, value) =>
  fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const interfaceTraits = [
  "@Trait[ustroystvo]{Устройство}",
  "@Trait[ustroystvo-neyro]{Устройство:Нейро}",
  "@Trait[ustroystvo-optika]{Устройство:Оптика}",
  "@Trait[ustroystvo-audio]{Устройство:Аудио}",
  "@Trait[ustroystvo-kiberruka]{Устройство:Киберрука}",
  "@Trait[ustroystvo-kibernoga]{Устройство:Кибернога}",
  "@Trait[ustroystvo-oruzhie]{Устройство:Оружие}",
  "@Trait[ustroystvo-bronya]{Устройство:Броня}",
];

const actionRules = [
  "<p><strong>Требования:</strong> вы участвуете в столкновении, ваша дека " +
    "при вас, а выбранная цель участвует в том же столкновении.</p>",
  "<p><strong>Дальность:</strong> 30 футов</p>",
  "<p><strong>Цель:</strong> одно воспринимаемое существо или устройство</p>",
  "<hr>",
  "<p>Совершите проверку Компьютеров против КС взлома цели. Эта проверка " +
    "анализирует только совместимость цели с вашими программами.</p>",
  `<p><strong>Критический успех</strong> Как успех.</p>`,
  "<p><strong>Успех</strong> ГМ называет только те признаки интерфейсов, " +
    `которые сейчас есть у цели: ${interfaceTraits.join(", ")}. ` +
    "Вы помните этот список до конца столкновения.</p>",
  "<p><strong>Провал</strong> Вы не получаете данных.</p>",
  "<p><strong>Критический провал</strong> Вы не получаете данных, а цель " +
    "может попытаться трассировать вас.</p>",
  "<hr>",
  "<p><strong>Ограничение информации:</strong> ГМ не называет импланты, " +
    "модели, количество, качество, уровень, состояние, описания или источник " +
    "признака. Сканирование не даёт @Trait[dostup]{Доступ} и не заменяет " +
    "киберсканер: оно отвечает только на вопрос, какие программы допустимо " +
    "запустить по цели.</p>",
  "<p><em>Вне столкновения действие использовать нельзя: фоновый пинг не " +
    "даёт достаточно чистой телеметрии для такого анализа.</em></p>",
].join("");

const actionItem = {
  folder: ACTION_FOLDER_ID,
  name: "Сканирование интерфейсов",
  type: "action",
  effects: [],
  system: {
    _migration: {
      version: 0.959,
      previous: null,
    },
    description: {
      value: actionRules,
      gm: "",
    },
    publication: PUBLICATION,
    rules: [],
    slug: "сканирование-интерфейсов",
    traits: {
      otherTags: [],
      value: [
        "arcane",
        "concentrate",
        "netrunner",
      ],
    },
    actionType: {
      value: "free",
    },
    actions: {
      value: null,
    },
    category: null,
    deathNote: false,
  },
  _id: ACTION_ID,
  img: "systems/sf2e/icons/actions/FreeAction.webp",
  sort: 150000,
  ownership: {
    default: 0,
  },
  flags: {},
  _stats: {
    coreVersion: "14.361",
    systemId: "sf2e",
    systemVersion: "1.2.0",
    createdTime: 1785196800000,
    modifiedTime: 1785196800000,
    compendiumSource: ACTION_UUID,
  },
};

const [items, journals] = await Promise.all([
  readJson(itemsPath),
  readJson(journalsPath),
]);

const existingActionIndex = items.findIndex((item) => item._id === ACTION_ID);
if (existingActionIndex >= 0) {
  const existing = items[existingActionIndex];
  actionItem.img = existing.img ?? actionItem.img;
  actionItem.system.actionType =
    existing.system?.actionType ?? actionItem.system.actionType;
  actionItem.system.actions =
    existing.system?.actions ?? actionItem.system.actions;
  actionItem._stats.createdTime =
    existing._stats?.createdTime ?? actionItem._stats.createdTime;
  actionItem._stats.modifiedTime =
    existing._stats?.modifiedTime ?? actionItem._stats.modifiedTime;
  items[existingActionIndex] = actionItem;
} else {
  items.push(actionItem);
}

const breach = items.find((item) => item._id === BREACH_FEATURE_ID);
if (!breach) throw new Error("Не найдена классовая черта «Взлом».");

breach.system.rules = (breach.system.rules ?? []).filter(
  (rule) => rule.uuid !== ACTION_UUID,
);

const actionLink = `@UUID[${ACTION_UUID}]{Сканирование интерфейсов}`;
const breachLead =
  "<p>Сигнатурное действие нетраннера и «ключ» к чужим системам: ваши " +
  "программы с признаком [доступ] работают только по целям, к которым вы " +
  "получили доступ.</p>";
breach.system.description.value =
  `${breachLead}<p>@UUID[Compendium.${MODULE_ID}.cyberpunk-items.Item.` +
  "GcTrbujlSfgyzpmF]{Эксплойт}</p>" +
  `<p>${actionLink}</p>`;

const netrunnerJournal = journals.find(
  (journal) => journal._id === NETRUNNER_JOURNAL_ID,
);
const netrunnerPage = netrunnerJournal?.pages?.find(
  (page) => page._id === NETRUNNER_PAGE_ID,
);
if (!netrunnerPage) throw new Error("Не найдена страница журнала «Нетраннер».");

const journalAction = [
  "<h3>Сканирование интерфейсов</h3>",
  `<p>${actionLink} @Glyph[Free]</p>`,
  '<p class="traits">@Trait[Concentrate]{Концентрация} ',
  "@Trait[Arcane]{Арканный} нетраннер</p>",
  actionRules,
].join("");

let journalHtml = netrunnerPage.text.content;
journalHtml = journalHtml.replace(
  /<h3>Сканирование интерфейсов<\/h3>[\s\S]*?(?=<h2>Теги целей<\/h2>)/u,
  "",
);
if (!journalHtml.includes("<h2>Теги целей</h2>")) {
  throw new Error("Не найден раздел «Теги целей» в журнале Нетраннера.");
}
journalHtml = journalHtml.replace(
  "<h2>Теги целей</h2>",
  `${journalAction}<h2>Теги целей</h2>`,
);
journalHtml = journalHtml.replace(
  "<strong>нетраннинг</strong>, <strong>Взлом</strong>, " +
    "<strong>теги целей</strong>",
  "<strong>нетраннинг</strong>, <strong>Взлом</strong>, " +
    "<strong>сканирование интерфейсов</strong>, " +
    "<strong>теги целей</strong>",
);

const traitRewrites = new Map([
  ["<strong>[устройство]</strong>", "@Trait[ustroystvo]{Устройство}"],
  [
    "<strong>[устройство:нейро]</strong>",
    "@Trait[ustroystvo-neyro]{Устройство:Нейро}",
  ],
  [
    "<strong>[устройство:X]</strong>",
    "<strong>Конкретный интерфейс</strong>",
  ],
  ["<strong>[сеть]</strong>", "@Trait[set]{Сеть}"],
]);
for (const [source, replacement] of traitRewrites) {
  journalHtml = journalHtml.replaceAll(source, replacement);
}
journalHtml = journalHtml.replace(
  "[устройство:оптика], [устройство:аудио], [устройство:киберрука], " +
    "[устройство:кибернога], [устройство:оружие], [устройство:броня]",
  interfaceTraits.slice(2).join(", "),
);

netrunnerPage.text.content = journalHtml;
netrunnerPage._stats ??= {};
netrunnerPage._stats.modifiedTime = 1785196800000;

items.sort((left, right) =>
  String(left.name).localeCompare(String(right.name), "ru"));

await Promise.all([
  writeJson(itemsPath, items),
  writeJson(journalsPath, journals),
]);

console.log(
  `Обновлено действие «${actionItem.name}» и раздел журнала без выдачи на лист.`,
);
