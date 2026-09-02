import {
  appendUnifiedContactMessage,
  canonicalLocalKey,
  readArchiveAppearance,
  readUnifiedLocalData,
  readUnifiedServerData,
  writeArchiveAppearance,
  writeUnifiedServerData,
} from "./neuro-archive-store.mjs";
import {
  applyArchiveTextScale,
  observeArchiveTextScale,
  placeArchiveContextMenu,
  proxyArchiveContextAction,
  syncArchiveContextTheme,
} from "./archive-ui-utils.mjs";

/*
 * NIGHT CITY // ДИНАМИЧЕСКИЙ ПОЛЕВОЙ HUD — автономный Foundry VTT макрос
 * Версия макроса: 7.3.4
 *
 * Тип макроса: Script. Зависимости: отсутствуют.
 * Целевая среда: Foundry VTT 14.365+, Starfinder 2e 1.4.0.
 *
 * Главные принципы:
 * - при импорте контакта читаются только имя, арт токена/Actor и текущая сцена;
 * - окно плавающее, передвигаемое, изменяемое по размеру и не блокирует карту;
 * - длинные записи остаются читаемыми и редактируются без тесных полей;
 * - отдельная карта Найт-Сити хранится прямо в архиве;
 * - отдельные разделы банд, корпораций, фиксеров и риперов с быстрыми заметками;
 * - 30 тематических киберпанк-пресетов: спокойные, корпорации, банды/кланы, службы и город;
 * - физическая оболочка DATAPAD: массивный металлический корпус, утопленный дисплей, радиаторы, порты и аппаратные клавиши;
 * - активные подписки: цена, срок, остаток дней, ручное списание дня и продление;
 * - точная ручная настройка цветовых ролей поверх любого пресета;
 * - данные каждого персонажа игрока остаются раздельными;
 * - НЕЙРО-СВЯЗЬ хранит приватные player↔GM диалоги через ChatMessage, а GM получает отдельное пространство управления.
 */
export async function createNeoArchiveController(hostRoot, { requestClose = async () => {} } = {}) {

  const VARIANT = "neo-archive-view";
  const MACRO_VERSION = "7.3.4";
  const NEURO_FLAG_SCOPE = "cyberpunkRemaster";
  const NEURO_FLAG_KEY = "fieldArchiveNeuroLink";
  const NEURO_FLAG_PATH = "cyberpunkRemaster.fieldArchiveNeuroLink";
  const NEURO_VERSION = 1;
  const CANONICAL_ARCHIVE_PATH = "flags.cyberpunkRemaster.neuroArchive.data";

  const VERSION = 2;
  const WINDOW_EDGE_GAP = 6;
  const WINDOW_MIN_WIDTH = 360;
  const WINDOW_MIN_HEIGHT = 260;
  const WINDOW_MINIMIZED_WIDTH = 340;
  const WINDOW_MINIMIZED_HEIGHT = 52;
  const SECTIONS = {
    people: { label: "Контакты", one: "контакт", icon: "◉" },
    gangs: { label: "Банды", one: "банду", icon: "✦" },
    corporations: { label: "Корпорации", one: "корпорацию", icon: "▰" },
    fixers: { label: "Фиксеры", one: "фиксера", icon: "◆" },
    rippers: { label: "Риперы", one: "рипера", icon: "✚" },
    lawmen: { label: "Законники", one: "контакт", icon: "⚖" },
    noosphere: { label: "Ноосфера", one: "контакт", icon: "⌁" },
    nomads: { label: "Кочевники", one: "контакт", icon: "⌂" },
    subscriptions: { label: "Подписки", one: "подписку", icon: "▦" },
    locations: { label: "Точки", one: "точку", icon: "⌖" },
    quests: { label: "Заказы", one: "заказ", icon: "▤" },
    clues: { label: "Зацепки", one: "зацепку", icon: "◇" },
    books: { label: "Файлы и шифры", one: "файл", icon: "▣" },
    sessions: { label: "Лог сессий", one: "запись лога", icon: "◷" },
    notes: { label: "Заметки", one: "заметку", icon: "▧" }
  };
  const NEW_ENTRY_TITLES = {
    people: "Новый контакт", gangs: "Новая банда", corporations: "Новая корпорация", fixers: "Новый фиксер", rippers: "Новый рипер",
    subscriptions: "Новая подписка", locations: "Новая точка", quests: "Новый заказ", clues: "Новая зацепка", books: "Новый файл / шифр",
    sessions: "Новая запись сессии", notes: "Новая заметка"
  };

  const DIRECTORY_META = {
    gangs: {
      label: "Банды", icon: "✦", noun: "банда", quickLabel: "Быстрая заметка о банде",
      hint: "Опасность, отношение, агрессивность и главное, что нужно помнить прямо сейчас.",
      emptyTitle: "Банды ещё не записаны", emptyText: "Создайте первое досье и оставьте короткую заметку, видимую прямо в списке."
    },
    corporations: {
      label: "Корпорации", icon: "▰", noun: "корпорация", quickLabel: "Быстрая заметка о корпорации",
      hint: "Угроза, отношение, текущая позиция и публичная маска — без лишней корпоративной энциклопедии.",
      emptyTitle: "Корпорации ещё не записаны", emptyText: "Добавьте корпорацию и зафиксируйте, чего от неё ждать вашей группе."
    },
    fixers: {
      label: "Фиксеры", icon: "◆", noun: "фиксер", quickLabel: "Быстрая заметка о фиксере",
      hint: "Район работы, репутация, отношение и текущие дела доступны одним взглядом.",
      emptyTitle: "Фиксеры ещё не записаны", emptyText: "Добавьте первого фиксера и кратко отметьте, чем он полезен или опасен."
    },
    rippers: {
      label: "Риперы", icon: "✚", noun: "рипер", quickLabel: "Быстрая заметка о рипере",
      hint: "Клиника, специализация, доверие и важные оговорки хранятся рядом.",
      emptyTitle: "Риперы ещё не записаны", emptyText: "Добавьте рипера и сразу отметьте, можно ли ему доверять."
    }
  };
  const DIRECTORY_TYPES = new Set(Object.keys(DIRECTORY_META));
  const VIRTUAL_CONTACT_SECTIONS = new Set(["lawmen", "noosphere", "nomads"]);
  const CONTACT_TYPE_META = {
    gang: { label: "Банда", section: "gangs", icon: "✦", relationField: "gang" },
    corporate: { label: "Корпорат", section: "corporations", icon: "▰", relationField: "corporation" },
    fixer: { label: "Фиксер", section: "fixers", icon: "◆", relationField: "fixer" },
    ripper: { label: "Рипер", section: "rippers", icon: "✚", relationField: "ripper" },
    lawman: { label: "Законник", section: "lawmen", icon: "⚖", relationField: "lawGroup" },
    noosphere: { label: "Ноосфера", section: "noosphere", icon: "⌁", relationField: "noosphereGroup" },
    nomad: { label: "Кочевник", section: "nomads", icon: "⌂", relationField: "nomadGroup" }
  };
  const CONTACT_MODEL_VERSION = 2;
  const CONTACT_SECTIONS = ["people", "gangs", "corporations", "fixers", "rippers", "lawmen", "noosphere", "nomads"];
  const ARCHIVE_SECTIONS = ["locations", "quests", "clues", "books", "sessions", "notes"];
  const SERVICE_SECTIONS = ["subscriptions"];
  const LOCATION_LINK_TYPES = new Set(["people", "quests", "clues", "books", "sessions", "notes"]);
  const PRIMARY_LOCATION_TYPES = new Set(["people", "quests", "clues"]);
  const THEME_GROUPS = {
    network: { label: "СЕТЬ / НЕТРАННЕР", icon: "⌁", hint: "Чистые сетевые HUD-палитры: трассировка, нейролинк, data-ocean и демоны." },
    ice: { label: "ICE / BLACKWALL", icon: "△", hint: "Аварийные и защитные схемы: Black ICE, firewall, trace, containment и kill-протоколы." },
    corp: { label: "КОРПОРАТИВНЫЕ СЕТИ", icon: "▰", hint: "Закрытые интерфейсы мегакорпораций, NetWatch и Trauma Team." },
    street: { label: "УЛИЧНАЯ СЕТЬ / COMBAT HUD", icon: "✦", hint: "Пиратские сети, боевые линкеры, оверклок и уличные mesh-интерфейсы." }
  };

  const THEME_FX = {
    ghost:     { node: "#63e8f2", trace: "#63e8f2", warning: "#ef5668", glow: 0.30, scanAlpha: 0.18, pulse: 1.8, scan: 1.20 },
    deep:      { node: "#7595ff", trace: "#55d6ff", warning: "#bb63ff", glow: 0.28, scanAlpha: 0.15, pulse: 2.3, scan: 1.55 },
    neural:    { node: "#61ffe1", trace: "#63e8f2", warning: "#ff647f", glow: 0.32, scanAlpha: 0.18, pulse: 1.55, scan: 1.05 },
    packet:    { node: "#5affb6", trace: "#5affb6", warning: "#ff6a67", glow: 0.26, scanAlpha: 0.14, pulse: 1.7, scan: 0.95 },
    ocean:     { node: "#55c9ff", trace: "#446fff", warning: "#d660ff", glow: 0.29, scanAlpha: 0.16, pulse: 2.0, scan: 1.35 },
    cold:      { node: "#d8fbff", trace: "#83dfff", warning: "#ff637c", glow: 0.23, scanAlpha: 0.12, pulse: 2.4, scan: 1.65 },
    daemon:    { node: "#c76dff", trace: "#ff5ec9", warning: "#ff4f6d", glow: 0.34, scanAlpha: 0.18, pulse: 1.35, scan: 0.86 },

    blackice:  { node: "#7be7ff", trace: "#2e6cff", warning: "#ff385c", glow: 0.34, scanAlpha: 0.17, pulse: 1.25, scan: 0.82 },
    warning:   { node: "#ff8c72", trace: "#ff5d64", warning: "#ff314f", glow: 0.38, scanAlpha: 0.20, pulse: 0.95, scan: 0.68 },
    firewall:  { node: "#ffbd5f", trace: "#ff7b51", warning: "#ff445e", glow: 0.30, scanAlpha: 0.15, pulse: 1.45, scan: 1.05 },
    trace:     { node: "#ffde6f", trace: "#ff9f4a", warning: "#ff3755", glow: 0.31, scanAlpha: 0.16, pulse: 1.15, scan: 0.74 },
    blackwall: { node: "#7e5cff", trace: "#b250ff", warning: "#ff3d82", glow: 0.39, scanAlpha: 0.22, pulse: 1.05, scan: 0.62 },
    kill:      { node: "#ff5c72", trace: "#ff344f", warning: "#ff203c", glow: 0.42, scanAlpha: 0.24, pulse: 0.82, scan: 0.55 },
    contain:   { node: "#76d8ff", trace: "#58a9ff", warning: "#ff5269", glow: 0.28, scanAlpha: 0.14, pulse: 1.8, scan: 1.25 },

    corpred:   { node: "#78eff7", trace: "#d8f8ff", warning: "#e84f62", glow: 0.25, scanAlpha: 0.12, pulse: 2.1, scan: 1.45 },
    tactical:  { node: "#96e5d8", trace: "#6ec1b5", warning: "#ff6b55", glow: 0.25, scanAlpha: 0.12, pulse: 1.9, scan: 1.30 },
    netwatch:  { node: "#6be5ff", trace: "#7d88ff", warning: "#e2557e", glow: 0.31, scanAlpha: 0.16, pulse: 1.55, scan: 1.05 },
    smartgrid: { node: "#62ffc3", trace: "#54ddb8", warning: "#ff6873", glow: 0.28, scanAlpha: 0.14, pulse: 1.7, scan: 1.10 },
    deepnet:   { node: "#67a8ff", trace: "#916cff", warning: "#ff5d8c", glow: 0.30, scanAlpha: 0.15, pulse: 1.85, scan: 1.20 },
    cleanroom: { node: "#8aeaff", trace: "#d2f8ff", warning: "#ef6680", glow: 0.22, scanAlpha: 0.10, pulse: 2.5, scan: 1.75 },
    bio:       { node: "#7bff9f", trace: "#5de0a5", warning: "#ff6676", glow: 0.27, scanAlpha: 0.13, pulse: 1.95, scan: 1.35 },
    mednet:    { node: "#72ffe8", trace: "#62dfff", warning: "#ff5b68", glow: 0.29, scanAlpha: 0.14, pulse: 1.65, scan: 1.15 },

    overclock: { node: "#ff5f6f", trace: "#ff7350", warning: "#ff2d4c", glow: 0.42, scanAlpha: 0.23, pulse: 0.78, scan: 0.50 },
    voodoo:    { node: "#a67cff", trace: "#6df0e6", warning: "#ff5b8d", glow: 0.36, scanAlpha: 0.18, pulse: 1.25, scan: 0.80 },
    neon:      { node: "#ff6fc5", trace: "#6bffe3", warning: "#ff556f", glow: 0.35, scanAlpha: 0.18, pulse: 1.15, scan: 0.75 },
    combat:    { node: "#74eaff", trace: "#6ca8ff", warning: "#ff5a52", glow: 0.30, scanAlpha: 0.16, pulse: 1.30, scan: 0.92 },
    pirate:    { node: "#ff9c5a", trace: "#69f2d0", warning: "#ff4b65", glow: 0.31, scanAlpha: 0.17, pulse: 1.20, scan: 0.82 },
    runner:    { node: "#74e8ff", trace: "#7bffbf", warning: "#ff6670", glow: 0.28, scanAlpha: 0.14, pulse: 1.55, scan: 1.05 },
    mesh:      { node: "#76ffd4", trace: "#ffc866", warning: "#ff6b62", glow: 0.29, scanAlpha: 0.14, pulse: 1.75, scan: 1.25 },
    scrap:     { node: "#8fdce5", trace: "#d68d5e", warning: "#ff5a55", glow: 0.27, scanAlpha: 0.13, pulse: 1.45, scan: 1.00 }
  };
  const THEME_PRESETS = {
    graphite: { label: "Ghost Grid", group: "network", themeFx: "ghost", background: "#05080e", panel: "#09121b", text: "#d9fbff", muted: "#6f8c95", accent: "#ef5668", secondary: "#63e8f2", opacity: 0.99, density: "comfortable" },
    rain: { label: "Deep Dive", group: "network", themeFx: "deep", background: "#050714", panel: "#0b1023", text: "#dfe8ff", muted: "#7783a4", accent: "#795cff", secondary: "#55d6ff", opacity: 0.99, density: "comfortable" },
    concrete: { label: "Neural Link", group: "network", themeFx: "neural", background: "#040b0e", panel: "#081619", text: "#dcfff9", muted: "#709991", accent: "#ff5b72", secondary: "#61ffe1", opacity: 0.99, density: "comfortable" },
    moss: { label: "Packet Trace", group: "network", themeFx: "packet", background: "#04100c", panel: "#091b14", text: "#e0fff0", muted: "#779b88", accent: "#ff625e", secondary: "#5affb6", opacity: 0.99, density: "comfortable" },
    smoke: { label: "Data Ocean", group: "network", themeFx: "ocean", background: "#050914", panel: "#091528", text: "#dfeeff", muted: "#718aaa", accent: "#a05cff", secondary: "#55c9ff", opacity: 0.99, density: "comfortable" },
    cream: { label: "Cold Wire", group: "network", themeFx: "cold", background: "#071014", panel: "#0c1a20", text: "#effdff", muted: "#819aa3", accent: "#ff637c", secondary: "#9cecff", opacity: 0.99, density: "comfortable" },
    mox: { label: "Daemon Console", group: "network", themeFx: "daemon", background: "#0b0611", panel: "#170b20", text: "#f8e8ff", muted: "#a58db0", accent: "#ff4f6d", secondary: "#c76dff", opacity: 0.99, density: "comfortable" },

    wraiths: { label: "Black ICE", group: "ice", themeFx: "blackice", background: "#03050b", panel: "#080d18", text: "#e4f8ff", muted: "#708493", accent: "#ff385c", secondary: "#7be7ff", opacity: 0.99, density: "comfortable" },
    animals: { label: "Red Warning", group: "ice", themeFx: "warning", background: "#100507", panel: "#1e0b0d", text: "#ffe8e8", muted: "#a68787", accent: "#ff314f", secondary: "#ff8c72", opacity: 0.99, density: "comfortable" },
    sixthstreet: { label: "Firewall", group: "ice", themeFx: "firewall", background: "#0e0804", panel: "#1c1008", text: "#fff1dc", muted: "#a68f74", accent: "#ff445e", secondary: "#ffbd5f", opacity: 0.99, density: "comfortable" },
    sovoil: { label: "Trace Detected", group: "ice", themeFx: "trace", background: "#110704", panel: "#211006", text: "#fff2dd", muted: "#aa9275", accent: "#ff3755", secondary: "#ffde6f", opacity: 0.99, density: "comfortable" },
    petrochem: { label: "Blackwall Breach", group: "ice", themeFx: "blackwall", background: "#08040e", panel: "#120820", text: "#f1e5ff", muted: "#9884aa", accent: "#ff3d82", secondary: "#8b62ff", opacity: 0.99, density: "comfortable" },
    ncpd: { label: "Kill Protocol", group: "ice", themeFx: "kill", background: "#0d0406", panel: "#1c080c", text: "#ffe4e8", muted: "#a77981", accent: "#ff203c", secondary: "#ff5c72", opacity: 0.99, density: "comfortable" },
    maxtac: { label: "Containment", group: "ice", themeFx: "contain", background: "#040912", panel: "#0a1423", text: "#e1f1ff", muted: "#778ba5", accent: "#ff5269", secondary: "#76d8ff", opacity: 0.99, density: "comfortable" },

    arasaka: { label: "Arasaka Secure Node", group: "corp", themeFx: "corpred", background: "#05070a", panel: "#0c1015", text: "#effbff", muted: "#7c8991", accent: "#e84f62", secondary: "#78eff7", opacity: 0.99, density: "comfortable" },
    militech: { label: "Militech Tactical Net", group: "corp", themeFx: "tactical", background: "#070b08", panel: "#0f1712", text: "#e8f7ef", muted: "#7e9185", accent: "#ff6b55", secondary: "#96e5d8", opacity: 0.99, density: "comfortable" },
    netwatch: { label: "NetWatch Control", group: "corp", themeFx: "netwatch", background: "#050717", panel: "#0b1026", text: "#e7ebff", muted: "#7d83a2", accent: "#e2557e", secondary: "#6be5ff", opacity: 0.99, density: "comfortable" },
    kangtao: { label: "Kang Tao Smart Grid", group: "corp", themeFx: "smartgrid", background: "#04100c", panel: "#091a14", text: "#e1fff3", muted: "#739987", accent: "#ff6873", secondary: "#62ffc3", opacity: 0.99, density: "comfortable" },
    nightcorp: { label: "Night Corp Deepnet", group: "corp", themeFx: "deepnet", background: "#050713", panel: "#0b1121", text: "#e5edff", muted: "#7786a0", accent: "#ff5d8c", secondary: "#67a8ff", opacity: 0.99, density: "comfortable" },
    zetatech: { label: "Zetatech Cleanroom", group: "corp", themeFx: "cleanroom", background: "#071014", panel: "#0d1a20", text: "#effcff", muted: "#849aa1", accent: "#ef6680", secondary: "#8aeaff", opacity: 0.99, density: "comfortable" },
    biotechnica: { label: "Biotechnica Neural Lab", group: "corp", themeFx: "bio", background: "#061009", panel: "#0c1b11", text: "#eaffed", muted: "#789582", accent: "#ff6676", secondary: "#7bff9f", opacity: 0.99, density: "comfortable" },
    traumateam: { label: "Trauma Team MedNet", group: "corp", themeFx: "mednet", background: "#04100f", panel: "#091c1a", text: "#e7fffb", muted: "#769792", accent: "#ff5b68", secondary: "#72ffe8", opacity: 0.99, density: "comfortable" },

    maelstrom: { label: "Maelstrom Overclock", group: "street", themeFx: "overclock", background: "#100507", panel: "#200a0e", text: "#ffe7ea", muted: "#aa7a80", accent: "#ff2d4c", secondary: "#ff7350", opacity: 0.99, density: "comfortable" },
    voodooboys: { label: "Voodoo Deep Net", group: "street", themeFx: "voodoo", background: "#090611", panel: "#150c20", text: "#f2e9ff", muted: "#9688aa", accent: "#ff5b8d", secondary: "#a67cff", opacity: 0.99, density: "comfortable" },
    tygerclaws: { label: "Tyger Neon Grid", group: "street", themeFx: "neon", background: "#0e0610", panel: "#1d0d1a", text: "#ffe8f7", muted: "#aa86a0", accent: "#ff556f", secondary: "#ff6fc5", opacity: 0.99, density: "comfortable" },
    valentinos: { label: "Merc Combat Link", group: "street", themeFx: "combat", background: "#050a10", panel: "#0b1620", text: "#e3f7ff", muted: "#758c9b", accent: "#ff5a52", secondary: "#74eaff", opacity: 0.99, density: "comfortable" },
    nightmarket: { label: "Night Market Pirate Net", group: "street", themeFx: "pirate", background: "#0d0805", panel: "#1c100a", text: "#fff0e4", muted: "#a48b79", accent: "#ff4b65", secondary: "#ff9c5a", opacity: 0.99, density: "comfortable" },
    afterlife: { label: "Afterlife Runner", group: "street", themeFx: "runner", background: "#050c0f", panel: "#0b171b", text: "#e5fbff", muted: "#789398", accent: "#ff6670", secondary: "#74e8ff", opacity: 0.99, density: "comfortable" },
    aldecaldos: { label: "Nomad Mesh", group: "street", themeFx: "mesh", background: "#0a0b06", panel: "#17170c", text: "#f5f1dd", muted: "#989478", accent: "#ff6b62", secondary: "#76ffd4", opacity: 0.99, density: "comfortable" },
    scavengers: { label: "Scav Scrapnet", group: "street", themeFx: "scrap", background: "#090807", panel: "#171311", text: "#ede7e2", muted: "#958983", accent: "#ff5a55", secondary: "#8fdce5", opacity: 0.99, density: "comfortable" }
  };
  const DEFAULT_APPEARANCE = { ...THEME_PRESETS.graphite, preset: "graphite", fontSize: 15, shell: "datapad", effects: "soft" };
  const ATTITUDE_GROUPS = [
    { key: "unknown", value: "Неизвестно", label: "Неизвестные", icon: "?", hint: "слышали о них, но ещё не знакомы" },
    { key: "close", value: "Близко", label: "Близкие", icon: "♥", hint: "личное доверие" },
    { key: "friendly", value: "Союзник", label: "Союзники", icon: "◆", hint: "можно рассчитывать на помощь" },
    { key: "neutral", value: "Нейтрально", label: "Нейтральные", icon: "●", hint: "контакт установлен, позиция неясна" },
    { key: "distrust", value: "Недоверие", label: "Под вопросом", icon: "▲", hint: "есть риск, напряжение или сомнения" },
    { key: "hostile", value: "Враждебно", label: "Враги", icon: "✕", hint: "открытая угроза" }
  ];
  const DECODING_PHASES = [
    { min: 0, label: "Не начато", hint: "файл ещё не изучен" },
    { min: 1, label: "Первые знаки", hint: "распознаны отдельные символы и повторения" },
    { min: 25, label: "Структура понятна", hint: "ясны основы языка или принцип шифра" },
    { min: 50, label: "Основной текст", hint: "смысл значительной части уже восстановлен" },
    { min: 75, label: "Почти готово", hint: "остались сложные места и проверка перевода" },
    { min: 100, label: "Расшифровано", hint: "данные полностью доступны" }
  ];

  const clone = value => {
    try { return structuredClone(value); }
    catch (_error) { return JSON.parse(JSON.stringify(value)); }
  };
  const now = () => new Date().toISOString();
  const uid = () => globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 16)
    ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  })[character]);
  const short = (value, size = 120) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return esc(text.length > size ? `${text.slice(0, size)}…` : text);
  };
  const notify = (message, level = "info") => {
    const api = globalThis.ui?.notifications;
    if ( api?.[level] ) api[level](message);
    else console[level === "error" ? "error" : "log"](message);
  };
  const normalizeName = value => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ru");
  const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : fallback;
  const clampPercent = value => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

  function decodingPhase(value) {
    const progress = clampPercent(value);
    return [...DECODING_PHASES].reverse().find(phase => progress >= phase.min) ?? DECODING_PHASES[0];
  }

  function hexRgb(value) {
    const hex = safeColor(value, "#000000").slice(1);
    return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
  }

  function colorWithAlpha(value, alpha) {
    const [r, g, b] = hexRgb(value);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function mixColors(first, second, weight = 0.5) {
    const a = hexRgb(first);
    const b = hexRgb(second);
    const mixed = a.map((channel, index) => Math.round(channel * (1 - weight) + b[index] * weight));
    return `#${mixed.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
  }

  function contrastColor(value) {
    const [r, g, b] = hexRgb(value);
    return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#101718" : "#fffaf0";
  }

  function normalizeAppearance(value) {
    const source = value && typeof value === "object" ? value : {};
    const preset = source.preset === "custom" ? "custom" : (THEME_PRESETS[source.preset] ? source.preset : "graphite");
    const base = preset === "custom" ? THEME_PRESETS.graphite : THEME_PRESETS[preset];
    return {
      preset,
      background: safeColor(source.background, base.background),
      panel: safeColor(source.panel, base.panel),
      text: safeColor(source.text, base.text),
      muted: safeColor(source.muted, base.muted),
      accent: safeColor(source.accent, base.accent),
      secondary: safeColor(source.secondary, base.secondary),
      fontSize: Math.min(20, Math.max(13, Number(source.fontSize) || DEFAULT_APPEARANCE.fontSize)),
      opacity: Math.min(1, Math.max(0.9, Number(source.opacity) || base.opacity || 0.98)),
      density: ["compact", "comfortable", "spacious"].includes(source.density) ? source.density : (base.density || "comfortable"),
      shell: ["datapad", "flat"].includes(source.shell) ? source.shell : "datapad",
      effects: ["off", "soft", "vivid"].includes(source.effects) ? source.effects : "soft",
      themeFx: THEME_FX[source.themeFx] ? source.themeFx : (THEME_FX[base.themeFx] ? base.themeFx : "ghost")
    };
  }

  function actorArray() {
    const source = globalThis.game?.actors;
    const actors = source?.contents ?? (source ? Array.from(source) : []);
    return actors.filter(actor => {
      if ( actor.type !== "character" ) return false;
      if ( actor.isOwner || game.user?.isGM ) return true;
      try { return actor.testUserPermission?.(game.user, "OWNER") ?? false; }
      catch (_error) { return false; }
    }).sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
  }

  const actors = actorArray();
  const worldId = game?.world?.id ?? game?.world?.data?._id ?? "world";
  const userId = game?.user?.id ?? game?.user?._id ?? "user";
  const localKey = canonicalLocalKey({ worldId, ownerId: userId, currentUserId: userId });
  const windowKey = `${localKey}:neo-archive-view-window`;

  function blankStore() {
    return { version: VERSION, updatedAt: now(), activeActorId: null, notebooks: {} };
  }

  function blankNotebook(actor) {
    return {
      actorId: actor.id ?? actor._id,
      actorName: actor.name,
      actorImg: actor.img ?? "icons/svg/mystery-man.svg",
      createdAt: now(),
      updatedAt: now(),
      goal: "",
      cityMap: { title: "Карта Найт-Сити", image: "", notes: "" },
      appearance: normalizeAppearance(),
      contactGroups: { lawman: [], noosphere: [], nomad: [] },
      entries: Object.fromEntries(Object.keys(SECTIONS).map(key => [key, []]))
    };
  }

  function blankEntry(type, seed = "") {
    const firstLine = String(seed).split(/\r?\n/)[0].trim();
    const base = {
      id: uid(), type, title: firstLine.slice(0, 80) || NEW_ENTRY_TITLES[type] || "Новая запись", headline: "",
      summary: "", content: seed, image: "", tags: "", pinned: false,
      createdAt: now(), updatedAt: now(), fragments: [], gallery: [], inbox: false
    };
    const extra = {
      people: { attitude: "Неизвестно", contactType: "", contactTypes: [], contactMemberships: {}, contactModelVersion: CONTACT_MODEL_VERSION, gang: "", corporation: "", fixer: "", ripper: "", lawGroup: "", noosphereGroup: "", nomadGroup: "", relationship: "", firstMet: "", lastSeen: "", locationId: "", locationIds: [], quotes: "", promises: "", secrets: "", encounters: [] },
      gangs: { danger: "Неизвестна", attitude: "Неизвестно", aggression: "Неизвестно", quickNotes: "" },
      corporations: { danger: "Неизвестна", attitude: "Неизвестно", posture: "Неизвестна", publicFace: "", quickNotes: "" },
      fixers: { district: "", reputation: "Неизвестна", attitude: "Неизвестно", currentDeals: "", quickNotes: "" },
      rippers: { clinic: "", specialty: "", trust: "Неизвестно", attitude: "Неизвестно", quickNotes: "" },
      subscriptions: { provider: "", plan: "", price: "", currency: "€$", termDays: 30, remainingDays: 30, status: "Активна", renewalNote: "" },
      locations: { kind: "", region: "", status: "Активна", firstVisited: "", atmosphere: "", dangers: "", services: "", travel: "" },
      quests: { status: "Активно", giverId: "", locationId: "", locationIds: [], objective: "", reward: "", deadline: "", nextStep: "", tasks: [] },
      clues: { status: "Новая", source: "", theory: "", conclusion: "", personId: "", locationId: "", locationIds: [] },
      books: { status: "Не изучен", author: "", language: "", script: "", cipher: "", helperId: "", decodingProgress: 0, decodingKey: "", method: "", discoveries: "", nextStep: "", decodeStages: [], locationIds: [] },
      sessions: { realDate: new Date().toISOString().slice(0, 10), gameDate: "", participants: "", events: "", decisions: "", loot: "", nextTime: "", locationIds: [] },
      notes: { category: "Общее", locationIds: [] }
    };
    return Object.assign(base, extra[type] ?? {});
  }

  function normalize(raw) {
    const data = raw && typeof raw === "object" ? clone(raw) : blankStore();
    data.version = VERSION;
    data.updatedAt ??= now();
    data.notebooks ??= {};
    for ( const notebook of Object.values(data.notebooks) ) {
      notebook.goal ??= "";
      notebook.cityMap = { title: String(notebook.cityMap?.title || "Карта Найт-Сити"), image: String(notebook.cityMap?.image || ""), notes: String(notebook.cityMap?.notes || "") };
      notebook.appearance = normalizeAppearance(notebook.appearance);
      notebook.contactGroups ??= { lawman: [], noosphere: [], nomad: [] };
      for ( const key of ["lawman", "noosphere", "nomad"] ) {
        notebook.contactGroups[key] = Array.isArray(notebook.contactGroups[key])
          ? [...new Set(notebook.contactGroups[key].map(value => String(value || "").trim()).filter(Boolean))]
          : [];
      }
      notebook.entries ??= {};
      for ( const key of Object.keys(SECTIONS) ) notebook.entries[key] ??= [];
      for ( const list of Object.values(notebook.entries) ) for ( const entry of list ) {
        entry.fragments = Array.isArray(entry.fragments) ? entry.fragments.map((fragment, index) => ({
          id: fragment?.id || uid(),
          title: String(fragment?.title ?? `Фрагмент ${index + 1}`),
          image: String(fragment?.image ?? ""),
          content: String(fragment?.content ?? "")
        })) : [];
        entry.gallery = Array.isArray(entry.gallery) ? entry.gallery.map(item => typeof item === "string"
          ? { id: uid(), image: item, caption: "" }
          : { id: item?.id || uid(), image: String(item?.image ?? ""), caption: String(item?.caption ?? "") }).filter(item => item.image) : [];
        entry.title = String(entry.title ?? "").trim();
        entry.headline = String(entry.headline ?? "").trim();
        entry.summary = String(entry.summary ?? "");
        entry.content = String(entry.content ?? "");
        entry.tags = String(entry.tags ?? "");
        entry.inbox = Boolean(entry.inbox);
        if ( LOCATION_LINK_TYPES.has(entry.type) ) {
          entry.locationIds = Array.isArray(entry.locationIds) ? [...new Set(entry.locationIds.filter(Boolean))] : [];
          if ( entry.locationId && !entry.locationIds.includes(entry.locationId) ) entry.locationIds.unshift(entry.locationId);
          if ( PRIMARY_LOCATION_TYPES.has(entry.type) ) entry.locationId = entry.locationIds[0] ?? "";
        }
        if ( entry.type === "people" ) {
          if ( ["Полезен", "Доброжелательно"].includes(entry.attitude) ) entry.attitude = "Союзник";
          if ( !entry.attitude ) entry.attitude = "Неизвестно";
          entry.role ??= "";
          entry.ancestry ??= "";
          entry.status ??= "Неизвестно";
          entry.messages = Array.isArray(entry.messages) ? entry.messages : [];
          entry.gang ??= "";
          entry.corporation ??= "";
          entry.fixer ??= "";
          entry.ripper ??= "";
          entry.lawGroup ??= "";
          entry.noosphereGroup ??= "";
          entry.nomadGroup ??= "";
          const validContactTypes = new Set(Object.keys(CONTACT_TYPE_META));
          const contactTypesInput = Array.isArray(entry.contactTypes) ? [...entry.contactTypes] : [];
          if ( entry.contactType ) contactTypesInput.push(String(entry.contactType));
          let cleanedTypes = [...new Set(contactTypesInput.map(value => String(value || "")).filter(value => validContactTypes.has(value)))];
          entry.contactMemberships = normalizeContactMemberships(entry.contactMemberships);
          if ( Number(entry.contactModelVersion || 0) < CONTACT_MODEL_VERSION ) {
            // Переносим только подтверждённую принадлежность; поля связей больше не создают категории.
            for ( const type of ["lawman", "noosphere", "nomad"] ) {
              const field = CONTACT_TYPE_META[type].relationField;
              const value = String(entry[field] || "").trim();
              if ( cleanedTypes.includes(type) && value ) addContactMembership(entry, type, value, { touch: false });
            }
            for ( const type of ["gang", "corporate"] ) {
              const field = CONTACT_TYPE_META[type].relationField;
              const value = String(entry[field] || "").trim();
              if ( !cleanedTypes.includes(type) || !value ) continue;
              const section = CONTACT_TYPE_META[type].section;
              const known = (notebook.entries?.[section] || []).some(item => normalizeName(item.title) === normalizeName(value));
              if ( known ) addContactMembership(entry, type, value, { touch: false });
              else cleanedTypes = cleanedTypes.filter(item => item !== type);
            }
            for ( const type of ["fixer", "ripper"] ) {
              const field = CONTACT_TYPE_META[type].relationField;
              if ( String(entry[field] || "").trim() && !personMemberships(entry, type).length ) cleanedTypes = cleanedTypes.filter(item => item !== type);
            }
            entry.contactModelVersion = CONTACT_MODEL_VERSION;
          }
          entry.contactTypes = cleanedTypes;
          entry.contactType = entry.contactTypes[0] || "";
          entry.lastSeen ??= "";
          entry.encounters = Array.isArray(entry.encounters) ? entry.encounters.map(encounter => ({
            id: encounter?.id || uid(), at: String(encounter?.at ?? encounter?.date ?? now()),
            sceneId: String(encounter?.sceneId ?? ""), sceneUuid: String(encounter?.sceneUuid ?? ""),
            sceneName: String(encounter?.sceneName ?? ""), locationId: String(encounter?.locationId ?? "")
          })).slice(-60) : [];
        }
        if ( entry.type === "gangs" ) {
          entry.danger ??= "Неизвестна";
          entry.attitude ??= "Неизвестно";
          entry.aggression ??= "Неизвестно";
          entry.quickNotes ??= "";
        }
        if ( entry.type === "corporations" ) {
          entry.danger ??= "Неизвестна";
          entry.attitude ??= "Неизвестно";
          entry.posture ??= "Неизвестна";
          entry.publicFace ??= "";
          entry.quickNotes ??= "";
        }
        if ( entry.type === "fixers" ) {
          entry.district ??= "";
          entry.reputation ??= "Неизвестна";
          entry.attitude ??= "Неизвестно";
          entry.currentDeals ??= "";
          entry.quickNotes ??= "";
        }
        if ( entry.type === "rippers" ) {
          entry.clinic ??= "";
          entry.specialty ??= "";
          entry.trust ??= "Неизвестно";
          entry.attitude ??= "Неизвестно";
          entry.quickNotes ??= "";
        }
        if ( entry.type === "subscriptions" ) {
          entry.provider ??= "";
          entry.plan ??= "";
          entry.price ??= "";
          entry.currency ??= "€$";
          entry.termDays = Math.max(1, Math.round(Number(entry.termDays) || 30));
          entry.remainingDays = Math.max(0, Math.round(Number(entry.remainingDays) || 0));
          entry.status = ["Активна", "Приостановлена", "Истекла"].includes(entry.status) ? entry.status : (entry.remainingDays > 0 ? "Активна" : "Истекла");
          entry.renewalNote ??= "";
          if ( entry.remainingDays <= 0 && entry.status === "Активна" ) entry.status = "Истекла";
        }
        if ( entry.type === "locations" ) {
          const statusMap = { "Не исследована": "Не разведана", "Исследована": "Проверена", "Недоступна": "Закрыта", "Разрушена": "Уничтожена" };
          entry.status = statusMap[entry.status] ?? entry.status;
        }
        if ( entry.type === "quests" ) { if ( entry.status === "Приостановлено" ) entry.status = "На паузе"; entry.tasks ??= []; }
        if ( entry.type === "books" ) {
          entry.status ??= "Не изучен";
          if ( entry.status === "Не начата" ) entry.status = "Не изучен";
          entry.author ??= "";
          entry.language ??= "";
          entry.script ??= "";
          entry.cipher ??= "";
          entry.helperId ??= "";
          entry.decodingProgress = clampPercent(entry.decodingProgress);
          entry.decodingKey ??= "";
          entry.method ??= "";
          entry.discoveries ??= "";
          entry.nextStep ??= "";
          entry.decodeStages = Array.isArray(entry.decodeStages) ? entry.decodeStages.map((stage, index) => ({
            id: stage?.id || uid(),
            text: String(stage?.text ?? `Этап ${index + 1}`),
            done: Boolean(stage?.done)
          })) : [];
        }
      }
    }
    return data;
  }

  function serverData() {
    return readUnifiedServerData(game?.user);
  }

  const legacyFieldLocalKey = `night-city-field-archive:${worldId}:${userId}`;
  function localData() {
    return readUnifiedLocalData(globalThis.localStorage, {
      canonicalKey: localKey,
      legacyKeys: [legacyFieldLocalKey],
    });
  }

  const rawServer = serverData();
  const rawLocal = localData();
  const fromServer = normalize(rawServer);
  const fromLocal = rawLocal ? normalize(rawLocal) : null;
  const store = fromLocal && (!rawServer || String(fromLocal.updatedAt) > String(fromServer.updatedAt)) ? fromLocal : fromServer;
  const actorIds = new Set(actors.map(actor => actor.id ?? actor._id));
  const preferredActorId = game?.user?.character?.id ?? game?.user?.character?._id
    ?? globalThis.canvas?.tokens?.controlled?.[0]?.actor?.id;
  if ( !actorIds.has(store.activeActorId) ) {
    store.activeActorId = actorIds.has(preferredActorId) ? preferredActorId : actors[0]?.id ?? actors[0]?._id ?? null;
  }

  const neuroReadKey = `${localKey}:neuro-read`;
  function loadNeuroRead() {
    try {
      const parsed = JSON.parse(localStorage.getItem(neuroReadKey) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) { return {}; }
  }

  const state = {
    store,
    actors,
    section: "dashboard",
    openId: null,
    viewMode: "list",
    viewId: null,
    returnLocationId: null,
    previousView: null,
    quick: "",
    quickType: "notes",
    globalSearch: "",
    globalSearchOpen: false,
    contactQuery: "",
    contactRoleFilter: "all",
    contactTagFilter: "all",
    contactSort: "attitude",
    quickEditPersonId: null,
    contactContext: null,
    entryContext: null,
    toolsOpen: false,
    chatOpen: false,
    chatText: "",
    chatPersonId: "",
    chatIncludeImage: true,
    chatIncludeSummary: true,
    neuroDrafts: {},
    neuroGmText: "",
    neuroGmPlayerId: "",
    neuroGmActorId: "",
    neuroGmContactId: "",
    neuroGmThreadId: "",
    neuroRead: loadNeuroRead(),
    contactPicker: null,
    quickGroupCreate: null,
    inlineLocks: {},
    mapZoom: 1,
    windowPrefs: null,
    saveTimer: null,
    scanProgress: 12,
    scanTimer: null,
    scanHoldUntil: 0,
    scanRenderedPercent: null,
    saving: false,
    saveAgain: false,
    revision: 0,
    storageMode: "local",
    settingsOpen: false,
    helpOpen: false,
    lightbox: null,
    openFragmentId: null,
    root: null
  };

  function actorById(id) {
    return state.actors.find(actor => (actor.id ?? actor._id) === id) ?? null;
  }

  function ensureNotebook(actor) {
    if ( !actor ) return null;
    const id = actor.id ?? actor._id;
    state.store.notebooks[id] ??= blankNotebook(actor);
    const notebook = state.store.notebooks[id];
    notebook.actorName = actor.name;
    notebook.actorImg = actor.img ?? notebook.actorImg;
    return notebook;
  }

  function notebook() {
    return ensureNotebook(actorById(state.store.activeActorId));
  }

  function bookAppearance(book = notebook()) {
    if ( !book ) return normalizeAppearance();
    const appearance = normalizeAppearance(readArchiveAppearance(book, "neo"));
    writeArchiveAppearance(book, "neo", appearance);
    return appearance;
  }

  function applyAppearance(book = notebook()) {
    if ( !state.root || !book ) return;
    const theme = bookAppearance(book);
    const fx = THEME_FX[theme.themeFx] ?? THEME_FX.ghost;
    const densityGap = theme.density === "compact" ? "8px" : theme.density === "spacious" ? "14px" : "11px";
    const variables = {
      "--bg": theme.background,
      "--bg-alpha": colorWithAlpha(theme.background, theme.opacity),
      "--panel": theme.panel,
      "--panel-alpha": colorWithAlpha(theme.panel, Math.min(1, theme.opacity + 0.015)),
      "--panel2": mixColors(theme.panel, theme.background, 0.32),
      "--ink": theme.text,
      "--heading": mixColors(theme.text, "#ffffff", 0.08),
      "--muted": theme.muted,
      "--gold": theme.accent,
      "--teal": theme.secondary,
      "--line": colorWithAlpha(theme.accent, 0.24),
      "--accent-soft": colorWithAlpha(theme.accent, 0.11),
      "--accent-hover": colorWithAlpha(theme.accent, 0.18),
      "--secondary-soft": colorWithAlpha(theme.secondary, 0.11),
      "--primary-ink": contrastColor(theme.accent),
      "--accent-deep": mixColors(theme.accent, theme.background, 0.24),
      "--chrome": colorWithAlpha(mixColors(theme.background, "#000000", 0.16), Math.min(1, theme.opacity + 0.01)),
      "--sidebar": colorWithAlpha(mixColors(theme.background, "#000000", 0.10), Math.min(1, theme.opacity + 0.005)),
      "--field": colorWithAlpha(theme.background, theme.opacity > 0.96 ? 0.72 : 0.82),
      "--device-edge": mixColors(theme.panel, "#000000", 0.42),
      "--device-rim": colorWithAlpha(mixColors(theme.text, theme.accent, 0.58), 0.16),
      "--device-shell": mixColors(theme.panel, "#07090a", 0.48),
      "--device-shell-hi": mixColors(theme.panel, theme.text, 0.10),
      "--device-shell-lo": mixColors(theme.background, "#000000", 0.34),
      "--device-metal": mixColors(theme.muted, "#5c6466", 0.30),
      "--device-rubber": mixColors(theme.background, "#000000", 0.52),
      "--device-led": theme.accent,
      "--screen-glow": colorWithAlpha(theme.accent, 0.075),
      "--screen-glow-strong": colorWithAlpha(theme.accent, 0.14),
      "--screen-grid": colorWithAlpha(theme.secondary, 0.042),
      "--chrome-top": colorWithAlpha(mixColors(mixColors(theme.background, "#000000", 0.16), theme.accent, 0.08), Math.min(1, theme.opacity + 0.01)),
      "--sidebar-tint": colorWithAlpha(mixColors(theme.background, theme.secondary, 0.08), Math.min(1, theme.opacity + 0.005)),
      "--button-top": colorWithAlpha(mixColors(theme.panel, theme.text, 0.08), Math.min(1, theme.opacity + 0.015)),
      "--scroll-thumb": mixColors(theme.panel, theme.accent, 0.60),
      "--modal-shade": colorWithAlpha(theme.background, 0.62),
      "--theme-node": fx.node,
      "--theme-trace": fx.trace,
      "--theme-warning": fx.warning,
      "--theme-node-glow": colorWithAlpha(fx.node, fx.glow),
      "--theme-trace-glow": colorWithAlpha(fx.trace, Math.max(0.08, fx.glow * 0.70)),
      "--theme-warning-glow": colorWithAlpha(fx.warning, Math.max(0.08, fx.glow * 0.66)),
      "--theme-scan-alpha": colorWithAlpha(fx.trace, fx.scanAlpha),
      "--theme-pulse-speed": `${fx.pulse}s`,
      "--theme-scan-speed": `${fx.scan}s`,
      "--font-size": `${DEFAULT_APPEARANCE.fontSize}px`,
      "--archive-user-font-size": `${theme.fontSize}px`,
      "--density-gap": densityGap
    };
    for ( const [property, value] of Object.entries(variables) ) state.root.style.setProperty(property, value);
    state.root.dataset.density = theme.density;
    state.root.dataset.shell = theme.shell;
    state.root.dataset.effects = theme.effects;
    state.root.dataset.themeFx = theme.themeFx;
    applyArchiveTextScale(state.root, { fontSize: theme.fontSize, baseFontSize: DEFAULT_APPEARANCE.fontSize });
  }

  function scanPercent() {
    return Math.max(1, Math.min(100, Math.round(Number(state.scanProgress) || 1)));
  }

  function syncScanHud(force = false) {
    if ( !state.root ) return;
    const percent = scanPercent();
    if ( !force && state.scanRenderedPercent === percent ) return;
    state.scanRenderedPercent = percent;
    state.root.style.setProperty("--scan-progress", `${percent}%`);
    const scanLabel = state.root.querySelector("[data-scan-percent]");
    const cyberLabel = state.root.querySelector("[data-cyber-load-percent]");
    if ( scanLabel ) scanLabel.textContent = `${percent}%`;
    if ( cyberLabel ) cyberLabel.textContent = `${percent}%`;
  }

  function stopScanHud() {
    if ( state.scanTimer ) clearInterval(state.scanTimer);
    state.scanTimer = null;
  }

  function startScanHud() {
    if ( state.scanTimer ) {
      syncScanHud(true);
      return;
    }
    syncScanHud(true);
    state.scanTimer = setInterval(() => {
      // Foundry's canvas and the HUD share browser resources. Do no HUD work while
      // the tab is hidden or the archive is minimized.
      if ( document.hidden || !state.root?.isConnected || state.windowPrefs?.minimized ) return;
      const current = Number(state.scanProgress) || 1;
      const time = Date.now();

      if ( current >= 100 ) {
        if ( !state.scanHoldUntil ) state.scanHoldUntil = time + 720;
        if ( time >= state.scanHoldUntil ) {
          state.scanProgress = 3;
          state.scanHoldUntil = 0;
        }
        syncScanHud();
        return;
      }

      const theme = bookAppearance();
      const fx = THEME_FX[theme.themeFx] ?? THEME_FX.ghost;
      const modeBoost = theme.effects === "vivid" ? 1.45 : theme.effects === "soft" ? 1 : 0.64;
      const themeBoost = 1 / Math.max(0.52, Number(fx.scan) || 1);
      const pulse = 0.78 + ((Math.sin(time / 520) + 1) * 0.16);
      // 250 ms updates + CSS interpolation keep the loader smooth without forcing
      // layout/paint eleven times per second.
      state.scanProgress = Math.min(100, current + (2.15 * modeBoost * themeBoost * pulse));
      if ( state.scanProgress >= 100 ) state.scanHoldUntil = time + 720;
      syncScanHud();
    }, 250);
  }

  function findEntry(element) {
    const id = element.closest("[data-entry-id]")?.dataset.entryId;
    if ( !id || !notebook() ) return null;
    return Object.values(notebook().entries).flat().find(entry => entry.id === id) ?? null;
  }

  function entryById(id) {
    if ( !id || !notebook() ) return null;
    return Object.values(notebook().entries).flat().find(entry => entry.id === id) ?? null;
  }

  function entryLocationIds(entry) {
    if ( !LOCATION_LINK_TYPES.has(entry?.type) ) return [];
    const ids = Array.isArray(entry.locationIds) ? entry.locationIds.filter(Boolean) : [];
    if ( entry.locationId && !ids.includes(entry.locationId) ) ids.unshift(entry.locationId);
    return [...new Set(ids)];
  }

  function setEntryLocations(entry, ids) {
    if ( !LOCATION_LINK_TYPES.has(entry?.type) ) return;
    entry.locationIds = [...new Set((ids ?? []).filter(Boolean))];
    if ( PRIMARY_LOCATION_TYPES.has(entry.type) ) entry.locationId = entry.locationIds[0] ?? "";
    entry.updatedAt = now();
  }

  const personLocationIds = entryLocationIds;
  const setPersonLocations = setEntryLocations;

  function viewSnapshot() {
    return {
      section: state.section,
      viewMode: state.viewMode,
      viewId: state.viewId,
      returnLocationId: state.returnLocationId,
      openId: state.openId
    };
  }

  function restoreView(view) {
    const target = view ?? { section: state.section, viewMode: "list", viewId: null, returnLocationId: null, openId: null };
    state.section = target.section;
    state.viewMode = target.viewMode;
    state.viewId = target.viewId;
    state.returnLocationId = target.returnLocationId;
    state.openId = target.openId;
    state.previousView = null;
  }

  function resetView(section = state.section) {
    if ( state.quickEditPersonId ) state.inlineLocks[`${state.quickEditPersonId}:tags`] = false;
    state.section = section;
    state.viewMode = "list";
    state.viewId = null;
    state.returnLocationId = null;
    state.previousView = null;
    state.openId = null;
    state.lightbox = null;
    state.openFragmentId = null;
    state.quickEditPersonId = null;
    state.contactContext = null;
    state.entryContext = null;
  }

  function saveLocal() {
    try { localStorage.setItem(localKey, JSON.stringify(state.store)); }
    catch (error) { console.warn("Полевой архив: локальное сохранение не удалось", error); }
  }

  function updateSaveBadge(text, mode = "local") {
    const badge = state.root?.querySelector?.("[data-save-badge]");
    if ( badge ) {
      badge.textContent = text;
      badge.dataset.mode = mode;
    }
  }

  function dirty() {
    state.revision += 1;
    state.store.updatedAt = now();
    if ( notebook() ) notebook().updatedAt = state.store.updatedAt;
    saveLocal();
    updateSaveBadge("Черновик…", "pending");
    clearTimeout(state.saveTimer);
    // Локальный черновик уже записан. Сервер ждёт спокойной паузы,
    // поэтому набор текста не теряет фокус и не прерывается.
    state.saveTimer = setTimeout(() => saveServer(false), 8000);
  }

  async function saveServer(force = false) {
    const active = document.activeElement;
    const isTyping = state.root?.isConnected && state.root.contains(active)
      && ["INPUT", "TEXTAREA"].includes(active?.tagName);
    if ( isTyping && !force ) {
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => saveServer(false), 2500);
      updateSaveBadge("Черновик", "pending");
      return;
    }
    if ( state.saving ) { state.saveAgain = true; return; }
    state.saving = true;
    state.saveAgain = false;
    const revision = state.revision;
    try {
      if ( typeof game?.user?.update !== "function" ) throw new Error("User.update недоступен");
      // Canonical destination: flags.cyberpunkRemaster.neuroArchive.data
      await writeUnifiedServerData(game.user, clone(state.store));
      state.storageMode = "server";
      updateSaveBadge(state.revision === revision ? "Сохранено" : "Черновик…", state.revision === revision ? "server" : "pending");
    } catch (error) {
      state.storageMode = "local";
      updateSaveBadge("Локально", "local");
      console.warn("Полевой архив: серверное сохранение недоступно, используется браузер", error);
    } finally {
      state.saving = false;
      if ( state.saveAgain || state.revision !== revision ) {
        clearTimeout(state.saveTimer);
        state.saveTimer = setTimeout(() => saveServer(false), 80);
      }
    }
  }

  function opt(value, current, label = value) {
    return `<option value="${esc(value)}" ${String(value) === String(current) ? "selected" : ""}>${esc(label)}</option>`;
  }
  function input(label, field, value, placeholder = "", type = "text", wide = false) {
    return `<label class="pcm-field ${wide ? "wide" : ""}"><span>${esc(label)}</span><input type="${type}" data-field="${field}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
  }
  function area(label, field, value, placeholder = "", wide = true) {
    return `<label class="pcm-field area ${wide ? "wide" : ""}"><span>${esc(label)}</span><textarea data-field="${field}" data-autogrow placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
  }
  function select(label, field, values, current, wide = false) {
    return `<label class="pcm-field ${wide ? "wide" : ""}"><span>${esc(label)}</span><select data-field="${field}">${values.map(value => opt(value, current)).join("")}</select></label>`;
  }
  function linkSelect(label, field, entries, current, empty) {
    return `<label class="pcm-field"><span>${esc(label)}</span><select data-field="${field}">${opt("", current, empty)}${entries.map(item => opt(item.id, current, item.title)).join("")}</select></label>`;
  }

  function locationChecks(entry, locations) {
    const selected = new Set(entryLocationIds(entry));
    if ( !locations.length ) return '<div class="pcm-location-checks empty">Сначала создайте хотя бы одну локацию.</div>';
    return `<div class="pcm-location-checks">${locations.map(location => `<label><input type="checkbox" data-location-link value="${esc(location.id)}" ${selected.has(location.id) ? "checked" : ""}><span>${esc(location.title)}</span></label>`).join("")}</div>`;
  }

  function namedEntryField(entry, field, label, entries, placeholder) {
    const listId = `pcm-${field}-${entry.id}`;
    return `<label class="pcm-field"><span>${esc(label)}</span><input type="text" data-field="${field}" list="${esc(listId)}" value="${esc(entry[field] || "")}" placeholder="${esc(placeholder)}"><datalist id="${esc(listId)}">${entries.map(item => `<option value="${esc(item.title)}"></option>`).join("")}</datalist></label>`;
  }

  function contactTypeSelect(entry) {
    const selected = new Set(personContactTypes(entry));
    return `<fieldset class="pcm-field pcm-contact-category-field wide"><legend>Кем является контакт</legend><div class="pcm-category-chip-editor">${Object.entries(CONTACT_TYPE_META).map(([value, meta]) => `<label class="${selected.has(value) ? "active" : ""}"><input type="checkbox" data-contact-type-toggle value="${value}" ${selected.has(value) ? "checked" : ""}><span>${meta.icon} ${esc(meta.label)}</span></label>`).join("")}</div><small>Это именно роли самого персонажа. Связанный фиксер, рипер, банда или корпорация ниже не меняют его категории.</small></fieldset>`;
  }

  function blankContactMemberships() {
    return Object.fromEntries(Object.keys(CONTACT_TYPE_META).map(type => [type, []]));
  }

  function normalizeContactMemberships(raw) {
    const out = blankContactMemberships();
    if ( !raw || typeof raw !== "object" ) return out;
    for ( const type of Object.keys(CONTACT_TYPE_META) ) {
      const values = Array.isArray(raw[type]) ? raw[type] : (raw[type] ? [raw[type]] : []);
      const seen = new Set();
      out[type] = values.map(value => String(value || "").trim()).filter(value => {
        const key = normalizeName(value);
        if ( !key || seen.has(key) ) return false;
        seen.add(key); return true;
      });
    }
    return out;
  }

  function personContactTypes(person) {
    const values = Array.isArray(person?.contactTypes) ? person.contactTypes : (person?.contactType ? [person.contactType] : []);
    return [...new Set(values.map(value => String(value || "")).filter(value => CONTACT_TYPE_META[value]))];
  }

  function syncPrimaryContactType(person) {
    person.contactTypes = personContactTypes(person);
    person.contactType = person.contactTypes[0] || "";
  }

  function personContactType(person) {
    return personContactTypes(person)[0] || "";
  }

  function personMemberships(person, type) {
    if ( !CONTACT_TYPE_META[type] ) return [];
    person.contactMemberships = normalizeContactMemberships(person.contactMemberships);
    return person.contactMemberships[type] || [];
  }

  function personGroup(person, type) {
    return personMemberships(person, type)[0] || "";
  }

  function hasContactMembership(person, type, group) {
    const wanted = normalizeName(group);
    return Boolean(wanted && personMemberships(person, type).some(value => normalizeName(value) === wanted));
  }

  function addContactMembership(person, type, group, { touch = true } = {}) {
    if ( !person || person.type !== "people" || !CONTACT_TYPE_META[type] ) return false;
    const clean = String(group || "").trim().slice(0, 80);
    if ( !clean ) return false;
    person.contactMemberships = normalizeContactMemberships(person.contactMemberships);
    if ( hasContactMembership(person, type, clean) ) return false;
    person.contactMemberships[type].push(clean);
    if ( touch ) { person.updatedAt = now(); dirty(); }
    return true;
  }

  function removeContactMembership(person, type, group) {
    if ( !person || person.type !== "people" || !CONTACT_TYPE_META[type] ) return false;
    const wanted = normalizeName(group);
    person.contactMemberships = normalizeContactMemberships(person.contactMemberships);
    const before = person.contactMemberships[type].length;
    person.contactMemberships[type] = person.contactMemberships[type].filter(value => normalizeName(value) !== wanted);
    if ( person.contactMemberships[type].length === before ) return false;
    person.updatedAt = now(); dirty(); return true;
  }

  function groupNamesForType(book, type) {
    const meta = CONTACT_TYPE_META[type];
    if ( !meta ) return [];
    const preferred = DIRECTORY_TYPES.has(meta.section)
      ? sortedEntries(book.entries[meta.section] || []).map(entry => String(entry.title || "").trim()).filter(Boolean)
      : (book.contactGroups?.[type] || []).map(value => String(value || "").trim()).filter(Boolean);
    const fromContacts = (book.entries.people || []).flatMap(person => personContactTypes(person).includes(type) ? personMemberships(person, type) : []);
    const seen = new Set();
    const merged = [];
    for ( const name of [...preferred, ...fromContacts] ) {
      const key = normalizeName(name);
      if ( !key || seen.has(key) ) continue;
      seen.add(key);
      merged.push(name);
    }
    return merged.sort((a,b)=>a.localeCompare(b,"ru"));
  }

  function ensureContactGroup(book, type, name) {
    const clean = String(name || "").trim().slice(0, 80);
    if ( !clean || !CONTACT_TYPE_META[type] || DIRECTORY_TYPES.has(CONTACT_TYPE_META[type].section) ) return clean;
    book.contactGroups ??= { lawman: [], noosphere: [], nomad: [] };
    book.contactGroups[type] ??= [];
    if ( !book.contactGroups[type].some(value => normalizeName(value) === normalizeName(clean)) ) book.contactGroups[type].push(clean);
    return clean;
  }

  function contactsForSection(book, section) {
    if ( section === "people" ) return sortedEntries(book.entries.people);
    const type = Object.entries(CONTACT_TYPE_META).find(([, meta]) => meta.section === section)?.[0] || "";
    return type ? sortedEntries(book.entries.people.filter(person => personContactTypes(person).includes(type))) : [];
  }

  function contactsForGroup(book, type, group = "") {
    const wanted = normalizeName(group);
    return sortedEntries(book.entries.people.filter(person => {
      if ( !personContactTypes(person).includes(type) ) return false;
      const memberships = personMemberships(person, type);
      if ( !wanted ) return memberships.length === 0;
      return memberships.some(value => normalizeName(value) === wanted);
    }));
  }

  function directoryEntryForGroup(book, section, group) {
    const wanted = normalizeName(group);
    if ( !wanted || !DIRECTORY_TYPES.has(section) ) return null;
    return (book.entries[section] || []).find(entry => normalizeName(entry.title) === wanted) || null;
  }

  function assignContactType(person, type, linkedTitle = "", { replace = false } = {}) {
    if ( !person || person.type !== "people" ) return false;
    if ( !type ) {
      person.contactTypes = [];
      person.contactType = "";
      person.contactMemberships = blankContactMemberships();
      return true;
    }
    if ( !CONTACT_TYPE_META[type] ) return false;
    const types = new Set(replace ? [] : personContactTypes(person));
    types.add(type);
    person.contactTypes = [...types];
    syncPrimaryContactType(person);
    person.contactMemberships = normalizeContactMemberships(person.contactMemberships);
    if ( linkedTitle ) {
      const clean = ensureContactGroup(notebook(), type, linkedTitle);
      addContactMembership(person, type, clean, { touch: false });
    }
    person.contactModelVersion = CONTACT_MODEL_VERSION;
    person.updatedAt = now();
    dirty();
    return true;
  }

  function removeContactType(person, type) {
    if ( !person || person.type !== "people" || !CONTACT_TYPE_META[type] ) return false;
    person.contactTypes = personContactTypes(person).filter(value => value !== type);
    person.contactMemberships = normalizeContactMemberships(person.contactMemberships);
    person.contactMemberships[type] = [];
    syncPrimaryContactType(person);
    person.contactModelVersion = CONTACT_MODEL_VERSION;
    person.updatedAt = now();
    dirty();
    return true;
  }

  function typeFields(entry, book) {
    const people = book.entries.people;
    const gangs = book.entries.gangs;
    const corporations = book.entries.corporations;
    const fixers = book.entries.fixers;
    const rippers = book.entries.rippers;
    const locations = book.entries.locations;
    if ( entry.type === "people" ) return `
      ${select("Отношение", "attitude", ["Неизвестно", "Враждебно", "Недоверие", "Нейтрально", "Союзник", "Близко"], entry.attitude)}
      ${contactTypeSelect(entry)}
      <div class="pcm-field wide pcm-relationship-separator"><span>Связи персонажа — не его категории</span><small>Эти поля описывают знакомых и контакты. Они не добавляют персонажу теги и не помещают его в разделы фракций.</small></div>
      ${namedEntryField(entry, "gang", "Связанная банда / знакомые", gangs, "Например: есть знакомые в Tyger Claws")}
      ${namedEntryField(entry, "corporation", "Связанная корпорация / контакты", corporations, "Например: знакомый в Militech")}
      ${namedEntryField(entry, "fixer", "Его фиксер / посредник", fixers, "Например: Ганс")}
      ${namedEntryField(entry, "ripper", "Его рипер / клиника", rippers, "Например: Эмиль")}
      ${input("Моя связь с контактом", "relationship", entry.relationship, "долг, доверие, конфликт, рычаг…")}
      ${input("Первая встреча", "firstMet", entry.firstMet, "подставляется из текущей сцены")}
      <div class="pcm-field wide"><span>Где встречали</span>${locationChecks(entry, locations)}</div>
      ${area("Что он говорил", "quotes", entry.quotes, "Фразы, обещания, оговорки, факты…")}
      ${area("Долги и договорённости", "promises", entry.promises)}
      ${area("Подозрения и скрытое", "secrets", entry.secrets)}`;
    if ( entry.type === "gangs" ) return `
      ${select("Опасность", "danger", ["Неизвестна", "Низкая", "Средняя", "Высокая", "Критическая"], entry.danger)}
      ${select("Отношение к нам", "attitude", ["Неизвестно", "Дружественное", "Нейтральное", "Напряжённое", "Враждебное"], entry.attitude)}
      ${select("Агрессивность", "aggression", ["Неизвестно", "Неагрессивна", "Ситуативно агрессивна", "Агрессивна"], entry.aggression)}`;
    if ( entry.type === "corporations" ) return `
      ${select("Угроза", "danger", ["Неизвестна", "Низкая", "Средняя", "Высокая", "Критическая"], entry.danger)}
      ${select("Отношение к нам", "attitude", ["Неизвестно", "Дружественное", "Деловое", "Нейтральное", "Напряжённое", "Враждебное"], entry.attitude)}
      ${select("Текущая позиция", "posture", ["Неизвестна", "Наблюдает", "Готова к сделке", "Давит", "Охотится"], entry.posture)}
      ${input("Публичная маска", "publicFace", entry.publicFace, "что корпорация говорит о себе")}`;
    if ( entry.type === "fixers" ) return `
      ${input("Район работы", "district", entry.district, "Уотсон, Хейвуд, весь город…")}
      ${select("Репутация", "reputation", ["Неизвестна", "Сомнительная", "Рабочая", "Надёжная", "Легендарная"], entry.reputation)}
      ${select("Отношение к нам", "attitude", ["Неизвестно", "Дружественное", "Деловое", "Нейтральное", "Напряжённое", "Враждебное"], entry.attitude)}
      ${area("Текущие дела", "currentDeals", entry.currentDeals, "заказы, обещания, долги, открытые вопросы…")}`;
    if ( entry.type === "rippers" ) return `
      ${input("Клиника / район", "clinic", entry.clinic, "название клиники или место")}
      ${input("Специализация", "specialty", entry.specialty, "импланты, травма, нелегальная хирургия…")}
      ${select("Доверие", "trust", ["Неизвестно", "Не доверяем", "Осторожно", "Доверяем", "Полностью доверяем"], entry.trust)}
      ${select("Отношение к нам", "attitude", ["Неизвестно", "Дружественное", "Деловое", "Нейтральное", "Напряжённое", "Враждебное"], entry.attitude)}`;
    if ( entry.type === "subscriptions" ) return `
      ${input("Сервис / компания", "provider", entry.provider, "Trauma Team, NetWatch, охрана…")}
      ${input("Тариф", "plan", entry.plan, "Silver, Executive, личный пакет…")}
      ${input("Цена", "price", entry.price, "например 500")}
      ${input("Валюта", "currency", entry.currency, "€$")}
      ${input("Срок, дней", "termDays", entry.termDays, "30", "number")}
      ${input("Осталось дней", "remainingDays", entry.remainingDays, "30", "number")}
      ${select("Статус", "status", ["Активна", "Приостановлена", "Истекла"], entry.status)}
      ${area("Условия продления", "renewalNote", entry.renewalNote, "автопродление, скидка, контакт поддержки…")}`;
    if ( entry.type === "locations" ) return `
      ${input("Тип точки", "kind", entry.kind, "бар, клиника, офис, убежище…")}${input("Район / зона", "region", entry.region, "Уотсон, Хейвуд, Пасифика…")}
      ${select("Состояние", "status", ["Активна", "Не разведана", "Проверена", "Опасна", "Закрыта", "Уничтожена"], entry.status)}${input("Первый визит", "firstVisited", entry.firstVisited)}
      ${area("Атмосфера и ориентиры", "atmosphere", entry.atmosphere)}${area("Угрозы и охрана", "dangers", entry.dangers)}
      ${area("Услуги и ресурсы", "services", entry.services)}${area("Маршрут и доступ", "travel", entry.travel)}`;
    if ( entry.type === "quests" ) return `
      ${select("Статус", "status", ["Активно", "На паузе", "Выполнено", "Провалено", "Отказались", "Скрытое"], entry.status)}
      ${linkSelect("Заказчик", "giverId", people, entry.giverId, "Не выбран")}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>
      ${input("Дедлайн", "deadline", entry.deadline, "дата или условие")}${area("Что нужно сделать", "objective", entry.objective)}
      ${area("Оплата / выгода", "reward", entry.reward)}${area("Следующий шаг", "nextStep", entry.nextStep)}`;
    if ( entry.type === "clues" ) return `
      ${select("Статус", "status", ["Новая", "Проверяется", "Связана", "Закрыта", "Ложный след"], entry.status)}${input("Источник", "source", entry.source)}
      ${linkSelect("Связанный контакт", "personId", people, entry.personId, "Не выбран")}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>
      ${area("Версия", "theory", entry.theory)}${area("Что подтвердилось", "conclusion", entry.conclusion)}`;
    if ( entry.type === "books" ) return `
      ${select("Состояние", "status", ["Не изучен", "В работе", "На паузе", "Расшифрован", "Недоступен"], entry.status)}
      ${input("Источник файла", "author", entry.author, "чип, терминал, архив, отправитель…")}
      ${input("Язык / формат", "language", entry.language, "текст, аудио, брейнданс…")}${input("Кодировка", "script", entry.script, "протокол, формат данных…")}
      ${input("Защита / шифр", "cipher", entry.cipher, "пароль, ICE, криптография…")}
      ${linkSelect("Кто помогает", "helperId", people, entry.helperId, "Никто")}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>
      ${area("Ключи и доступ", "decodingKey", entry.decodingKey)}${area("Метод взлома", "method", entry.method)}
      ${area("Что уже извлечено", "discoveries", entry.discoveries)}${area("Следующий шаг", "nextStep", entry.nextStep)}`;
    if ( entry.type === "sessions" ) return `
      ${input("Дата игры", "realDate", entry.realDate, "", "date")}${input("Дата в мире", "gameDate", entry.gameDate)}
      ${input("Участники", "participants", entry.participants, "", "text", true)}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>
      ${area("Что произошло", "events", entry.events)}${area("Решения и последствия", "decisions", entry.decisions)}
      ${area("Добыча и расходы", "loot", entry.loot)}${area("К следующей игре", "nextTime", entry.nextTime)}`;
    return `${select("Категория", "category", ["Общее", "Слух", "Адрес", "Долг", "План", "Покупки", "Тактика", "Напоминание"], entry.category)}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>`;
  }

  function tasks(entry) {
    if ( entry.type !== "quests" ) return "";
    return `<section class="pcm-sub"><header><h3>☑ Этапы заказа</h3><button data-action="add-task">+ Этап</button></header>
      <div class="pcm-tasks">${entry.tasks.length ? entry.tasks.map(task => `<div class="pcm-task ${task.done ? "done" : ""}" data-task-id="${task.id}"><input type="checkbox" data-task-done ${task.done ? "checked" : ""}><input data-task-text value="${esc(task.text)}" placeholder="Что нужно сделать"><button data-action="delete-task">×</button></div>`).join("") : '<p class="muted">Разбейте цель на небольшие шаги.</p>'}</div></section>`;
  }

  function refreshDecodePanel(source, entry) {
    const panel = source?.closest?.("[data-decode-panel]");
    if ( !panel ) return;
    const progress = clampPercent(entry.decodingProgress);
    const phase = decodingPhase(progress);
    const output = panel.querySelector("[data-decode-output]");
    const bar = panel.querySelector("[data-decode-bar]");
    const title = panel.querySelector("[data-decode-phase]");
    const hint = panel.querySelector("[data-decode-hint]");
    if ( output ) output.textContent = `${progress}%`;
    if ( bar ) bar.style.width = `${progress}%`;
    if ( title ) title.textContent = phase.label;
    if ( hint ) hint.textContent = phase.hint;
  }

  function decodingEditor(entry) {
    if ( entry.type !== "books" ) return "";
    const progress = clampPercent(entry.decodingProgress);
    const phase = decodingPhase(progress);
    const stages = entry.decodeStages.map(stage => `<div class="pcm-decode-stage ${stage.done ? "done" : ""}" data-decode-stage-id="${stage.id}">
      <input type="checkbox" data-decode-stage-done ${stage.done ? "checked" : ""} title="Этап завершён">
      <input data-decode-stage-text value="${esc(stage.text)}" placeholder="Ключ, глава или шаг расшифровки">
      <button data-action="delete-decode-stage" title="Удалить этап">×</button>
    </div>`).join("");
    return `<section class="pcm-decoding" data-decode-panel>
      <header><div><small>ПРОГРЕСС РАСШИФРОВКИ</small><h3 data-decode-phase>${esc(phase.label)}</h3><p data-decode-hint>${esc(phase.hint)}</p></div><output data-decode-output>${progress}%</output></header>
      <div class="pcm-decode-track" aria-hidden="true"><i data-decode-bar style="width:${progress}%"></i></div>
      <div class="pcm-decode-controls"><label><span>Точный прогресс</span><input type="range" min="0" max="100" step="1" value="${progress}" data-decode-progress></label><div><button data-action="adjust-decode" data-delta="-5">−5</button><button data-action="adjust-decode" data-delta="5">+5</button><button data-action="adjust-decode" data-delta="10">+10</button><button data-action="set-decode" data-value="100">Готово</button></div></div>
      <div class="pcm-decode-stages"><div class="pcm-decode-stages-head"><span><b>Ключи и этапы</b><small>Чек-лист не меняет процент автоматически — вы полностью управляете прогрессом.</small></span><button data-action="add-decode-stage">+ Этап</button></div>${stages || '<p class="muted">Добавьте найденный алфавит, ключ, переведённую главу или необходимый предмет.</p>'}</div>
    </section>`;
  }

  function fragments(entry) {
    if ( !entry.fragments.length ) return "";
    const heading = entry.type === "books" ? "⌑ Расшифрованные отрывки" : "▱ Сворачиваемые фрагменты";
    return `<section class="pcm-sub"><h3>${heading}</h3>${entry.fragments.map((fragment, index) => `<details class="pcm-fragment" data-fragment-id="${fragment.id}" ${state.openFragmentId === fragment.id ? "open" : ""}>
      <summary><span>▸ ${esc(fragment.title || `Фрагмент ${index + 1}`)}</span></summary>
      <div class="pcm-fragment-body">
        <button class="pcm-fragment-delete" data-action="delete-fragment" title="Удалить">×</button>
        <label class="pcm-field"><span>Заголовок</span><input data-fragment-field="title" value="${esc(fragment.title)}"></label>
        <label class="pcm-field"><span>Изображение: путь Foundry или URL</span><div class="pcm-path"><input data-fragment-field="image" value="${esc(fragment.image)}"><button data-action="pick-fragment-image">Выбрать файл</button></div></label>
        <div class="pcm-paste-zone pcm-fragment-paste" data-paste-target="fragment" tabindex="0"><b>Ctrl+V</b><span>Щёлкните сюда и вставьте картинку прямо в этот фрагмент</span></div>
        ${fragment.image ? `<img class="pcm-fragment-img" src="${esc(fragment.image)}" alt="">` : ""}
        <label class="pcm-field area"><span>Содержимое</span><textarea data-fragment-field="content">${esc(fragment.content)}</textarea></label>
      </div></details>`).join("")}</section>`;
  }

  function galleryEditor(entry) {
    if ( entry.type !== "people" ) return "";
    const items = entry.gallery.map((item, index) => `<article class="pcm-gallery-edit" data-gallery-id="${item.id}">
      <button class="pcm-gallery-preview" data-action="view-gallery-image" title="Открыть крупно"><img src="${esc(item.image)}" alt=""></button>
      <label class="pcm-field"><span>Подпись к изображению</span><input data-gallery-caption value="${esc(item.caption)}" placeholder="Портрет, одежда, имплант, предмет…"></label>
      <div><button data-action="set-gallery-cover" title="Сделать основной картинкой">${entry.image === item.image ? "★ Обложка" : "☆ На обложку"}</button><button data-action="pick-gallery-image">Заменить</button><button class="danger" data-action="delete-gallery-image" title="Удалить изображение">×</button></div>
      <small>Изображение ${index + 1}</small>
    </article>`).join("");
    return `<section class="pcm-sub pcm-gallery-editor"><header><div><h3>▧ Галерея контакта</h3><p>Отдельные портреты, костюмы, предметы и сцены. Любую картинку можно сделать обложкой.</p></div><button data-action="add-gallery-image">+ Выбрать файл</button></header>
      <div class="pcm-paste-zone" data-paste-target="gallery" tabindex="0"><b>Ctrl+V</b><span>Щёлкните сюда и вставляйте картинки — каждая добавится отдельно</span></div>
      <div class="pcm-gallery-edit-grid">${items || '<div class="pcm-inline-empty">В галерее пока нет изображений.</div>'}</div>
    </section>`;
  }

  function editorBody(entry, book) {
    const titleLabel = entry.type === "books" ? "Название файла / шифра" : "Название";
    const headlineLabel = entry.type === "books" ? "Заголовок / тема" : "Заголовок";
    return `<div class="pcm-card-body pcm-simple-editor">
      <div class="pcm-card-actions"><button data-action="pin" title="Закрепить">${entry.pinned ? "★" : "☆"}</button><button class="danger" data-action="delete" title="Удалить">×</button></div>
      <div class="pcm-grid pcm-title-fields">${input(titleLabel, "title", entry.title, entry.type === "books" ? "Например: Архив Эмиля / DATA-17" : "Короткое имя записи", "text")}${input(headlineLabel, "headline", entry.headline || "", entry.type === "books" ? "Например: История браузера / зашифрованная переписка" : "Что это за запись — одной строкой", "text")}${area("Краткое описание", "summary", entry.summary, "Короткое превью для списков", true)}</div>
      ${DIRECTORY_TYPES.has(entry.type) ? area(DIRECTORY_META[entry.type].quickLabel, "quickNotes", entry.quickNotes, "Короткая сводка, которая всегда видна в списке") : ""}
      <label class="pcm-field area pcm-main-text wide"><span>Основная запись</span><textarea data-field="content" data-autogrow placeholder="Пишите сколько нужно — поле растёт вместе с текстом…">${esc(entry.content)}</textarea><small>Текст не обрезается: поле увеличивается до удобной высоты, затем прокручивается внутри.</small></label>
      ${decodingEditor(entry)}
      <details class="pcm-extra"><summary>Связи и подробности</summary><div class="pcm-grid">${typeFields(entry, book)}</div>${tasks(entry)}</details>
      <details class="pcm-extra pcm-attachments"><summary>Картинки, теги и отдельные материалы</summary>
        <div class="pcm-image-row"><div class="pcm-cover">${entry.image ? `<img src="${esc(entry.image)}" alt="">` : "▧<small>Обложка</small>"}</div><label class="pcm-field"><span>Картинка: выбрать файл или вставить <b>Ctrl+V</b></span><div class="pcm-path"><input data-field="image" value="${esc(entry.image)}" placeholder="Путь Foundry или URL"><button data-action="pick-image">Выбрать</button></div></label></div>
        ${input("Теги через запятую", "tags", entry.tags, "важное, проверить, вернуться", "text", true)}
        ${galleryEditor(entry)}${fragments(entry)}
        <div class="pcm-add-fragment"><button data-action="add-fragment">+ Отдельный фрагмент</button><span>Для переписки, расшифровки, длинного разговора или отдельной картинки</span></div>
      </details>
    </div>`;
  }

  function directoryFields(entry) {
    if ( entry.type === "gangs" ) return [entry.danger, entry.attitude, entry.aggression, entry.quickNotes];
    if ( entry.type === "corporations" ) return [entry.danger, entry.attitude, entry.posture, entry.publicFace, entry.quickNotes];
    if ( entry.type === "fixers" ) return [entry.district, entry.reputation, entry.attitude, entry.currentDeals, entry.quickNotes];
    if ( entry.type === "rippers" ) return [entry.clinic, entry.specialty, entry.trust, entry.attitude, entry.quickNotes];
    return [];
  }

  function directoryBadges(entry) {
    if ( entry.type === "gangs" ) return [`Опасность: ${entry.danger}`, entry.attitude, entry.aggression];
    if ( entry.type === "corporations" ) return [`Угроза: ${entry.danger}`, entry.attitude, entry.posture];
    if ( entry.type === "fixers" ) return [entry.district || "Район неизвестен", `Репутация: ${entry.reputation}`, entry.attitude];
    if ( entry.type === "rippers" ) return [entry.clinic || "Клиника неизвестна", `Доверие: ${entry.trust}`, entry.attitude];
    return [];
  }

  function personAffiliationData(entry) {
    if ( entry?.type !== "people" ) return [];
    return personContactTypes(entry).flatMap(type => {
      const meta = CONTACT_TYPE_META[type];
      const groups = personMemberships(entry, type);
      if ( !groups.length ) return [{ type, icon: meta?.icon || "◉", category: meta?.label || type, group: "", label: meta?.label || type }];
      return groups.map(group => ({ type, icon: meta?.icon || "◉", category: meta?.label || type, group, label: `${meta?.label || type} · ${group}` }));
    }).filter(item => item.category);
  }

  function personAffiliationLabels(entry) {
    return personAffiliationData(entry).map(item => `${item.icon} ${item.label}`);
  }

  function personAffiliations(entry) {
    const chips = personAffiliationData(entry);
    return chips.length ? `<span class="pcm-contact-links">${chips.map(item => `<i class="${item.group ? "grouped" : ""}" data-contact-kind="${esc(item.type)}">${item.icon} ${esc(item.label)}</i>`).join("")}</span>` : "";
  }

  function personCompactTags(entry, { limit = 5 } = {}) {
    if ( entry?.type !== "people" ) return "";
    const chips = [
      ...personAffiliationData(entry).map(item => ({ cls: item.group ? "grouped" : "", text: `${item.icon} ${item.label}` })),
      ...String(entry.tags || "").split(",").map(tag => tag.trim()).filter(Boolean).map(tag => ({ cls: "manual", text: `#${tag}` }))
    ];
    if ( !chips.length ) return "";
    const shown = chips.slice(0, Math.max(1, Number(limit) || 5));
    const extra = chips.length - shown.length;
    return `<span class="pcm-compact-person-tags">${shown.map(item => `<i class="${item.cls}">${esc(item.text)}</i>`).join("")}${extra > 0 ? `<i class="more" title="Ещё ${extra} тегов">+${extra}</i>` : ""}</span>`;
  }

  function personOriginBadges(entry, { limit = 5 } = {}) {
    if ( entry?.type !== "people" ) return "";
    const affiliations = personAffiliationData(entry);
    const shown = affiliations.slice(0, Math.max(1, Number(limit) || 5));
    const extra = affiliations.length - shown.length;
    return `<span class="pcm-contact-origin"><small>ПРИНАДЛЕЖНОСТЬ</small><span>${shown.length
      ? shown.map(item => `<i data-contact-kind="${esc(item.type)}">${item.icon} ${esc(item.label)}</i>`).join("")
      : '<i class="none">◉ Без принадлежности</i>'}${extra > 0 ? `<i class="more">+${extra}</i>` : ""}</span></span>`;
  }

  function recordTitle(entry) {
    const title = String(entry?.title ?? "").trim();
    return title || "Без названия";
  }

  function recordHeadline(entry) {
    const headline = String(entry?.headline ?? "").trim();
    return headline && normalizeName(headline) !== normalizeName(recordTitle(entry)) ? headline : "";
  }

  function recordPreview(entry) {
    if ( DIRECTORY_TYPES.has(entry.type) ) {
      return String(entry.quickNotes || entry.summary || entry.content || `Нет краткой заметки: ${DIRECTORY_META[entry.type].noun}`).trim();
    }
    return String(entry.summary || entry.content || "Краткое описание пока не добавлено.").trim();
  }

  function card(entry, book) {
    const tags = String(entry.tags).split(",").map(tag => tag.trim()).filter(Boolean);
    const bookSearch = entry.type === "books" ? [entry.author, entry.language, entry.script, entry.cipher, entry.decodingKey, entry.method, entry.discoveries, entry.nextStep, ...entry.decodeStages.map(stage => stage.text)] : [];
    const personSearch = entry.type === "people" ? [...personContactTypes(entry), ...Object.keys(CONTACT_TYPE_META).flatMap(type => personMemberships(entry, type)), entry.gang, entry.corporation, entry.fixer, entry.ripper, entry.relationship] : [];
    const search = [entry.title, entry.headline, entry.summary, entry.content, entry.tags, ...bookSearch, ...directoryFields(entry), ...personSearch, ...entry.fragments.map(f => `${f.title} ${f.content}`)].join(" ").toLowerCase();
    const progress = entry.type === "books" ? clampPercent(entry.decodingProgress) : null;
    const progressLine = progress === null ? "" : `<span class="pcm-card-decode"><i><b style="width:${progress}%"></b></i><em>${progress}% · ${esc(decodingPhase(progress).label)}</em></span>`;
    const badges = DIRECTORY_TYPES.has(entry.type) ? `<span class="pcm-directory-badges">${directoryBadges(entry).map(value => `<i>${esc(value)}</i>`).join("")}</span>` : "";
    const affiliations = personAffiliations(entry);
    const title = recordTitle(entry);
    const headline = recordHeadline(entry);
    const preview = recordPreview(entry);
    const dropAttrs = DIRECTORY_TYPES.has(entry.type) ? ` data-contact-drop="directory" data-directory-type="${entry.type}" data-directory-id="${entry.id}"` : "";
    return `<article class="pcm-card pcm-view-card ${DIRECTORY_TYPES.has(entry.type) ? "pcm-directory-card" : ""} ${entry.pinned ? "pinned" : ""}" data-entry-id="${entry.id}" data-search="${esc(search)}"${dropAttrs}>
      <button class="pcm-record-open" data-action="open-entry" data-entry-id="${entry.id}" data-section="${entry.type}" aria-label="Открыть запись: ${esc(title)}">
        <div class="pcm-thumb">${entry.image ? `<img src="${esc(entry.image)}" alt="">` : SECTIONS[entry.type].icon}</div>
        <div class="pcm-record-copy">
          <small class="pcm-record-kicker">${esc(SECTIONS[entry.type]?.label || "ЗАПИСЬ")}</small>
          <h2>${esc(title)}</h2>
          ${headline ? `<h3 class="pcm-entry-headline">${esc(headline)}</h3>` : ""}
          ${affiliations}
          <p class="${DIRECTORY_TYPES.has(entry.type) ? "pcm-directory-quick-note" : ""}">${short(preview, DIRECTORY_TYPES.has(entry.type) ? 240 : 150)}</p>
          ${badges}${progressLine}
          ${tags.length ? `<small class="pcm-record-tags">${tags.slice(0, 4).map(tag => `<span class="pcm-tag-static">#${esc(tag)}</span>`).join("")}${tags.length > 4 ? `<span class="pcm-tag-static">+${tags.length - 4}</span>` : ""}</small>` : ""}
        </div>
        <b class="pcm-record-arrow" aria-hidden="true">→</b>
      </button>
    </article>`;
  }

  function sectionCount(book, key) {
    if ( key === "people" ) return contactsForSection(book, key).length;
    if ( DIRECTORY_TYPES.has(key) || VIRTUAL_CONTACT_SECTIONS.has(key) ) return contactsForSection(book, key).length;
    return book.entries[key]?.length || 0;
  }

  function dashboard(book) {
    const counts = Object.fromEntries(Object.keys(SECTIONS).map(key => [key, sectionCount(book, key)]));
    const recent = Object.values(book.entries).flat().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 6);
    const scene = globalThis.canvas?.scene ?? null;
    const sceneName = String(scene?.name ?? "Нет активной сцены");
    const sceneLocation = scene ? findSceneLocation(book, scene) : null;
    const tokens = selectedTokens();
    const selectedCount = tokens.length;
    const tokenCards = tokens.slice(0, 6).map(token => {
      const identity = tokenIdentity(token);
      const person = duplicatePerson(book, identity);
      const image = identity.tokenImage || identity.actorImage;
      return `<article class="pcm-scene-token ${person ? "known" : "new"}">${image ? `<img src="${esc(image)}" alt="">` : "◉"}<span><b>${esc(identity.name)}</b><small>${person ? "Уже в архиве" : "Новый контакт"}</small></span></article>`;
    }).join("");
    const inboxCount = Object.values(book.entries).flat().filter(entry => entry.inbox).length;
    const mainSections = ["people", "gangs", "corporations", "fixers", "rippers", "locations"];
    const loadPercent = scanPercent();
    return `<section class="pcm-cyber-alert">
        <div class="pcm-cyber-date"><b>${String(new Date().getDate()).padStart(2, "0")}</b><span><small>ЛОКАЛЬНЫЙ УЗЕЛ</small><strong>${esc(book.actorName)}</strong></span></div>
        <div class="pcm-cyber-attention">
          <small>ВНЕШНИЙ КАНАЛ ПОДКЛЮЧЁН</small>
          <div class="pcm-attention-sign"><b>!</b></div>
          <h1>ВНИМАНИЕ</h1>
          <p>${selectedCount ? `${selectedCount} ${selectedCount === 1 ? "ЦЕЛЬ ЗАФИКСИРОВАНА" : "ЦЕЛИ ЗАФИКСИРОВАНЫ"} // ГОТОВО К СОХРАНЕНИЮ` : `АКТИВНАЯ СЦЕНА // ${esc(sceneName)}`}</p>
          <div class="pcm-cyber-progress"><i data-cyber-load-fill style="width:${loadPercent}%"></i></div>
          <footer><span>СКАН / ШИНА ПАМЯТИ</span><b data-cyber-load-percent>${loadPercent}%</b></footer>
        </div>
        <div class="pcm-cyber-status">
          <small>КОРНЕВОЙ ДОСТУП</small><b>ГОТОВО</b><span>ДОСТУП РАЗРЕШЁН</span>
          <div class="pcm-binary">01010011 01011001 01010011<br>01010100 01000101 01001101</div>
        </div>
      </section>
      <section class="pcm-dashboard-grid">
        <div class="pcm-dashboard-main">
          <section class="pcm-capture pcm-capture-simple"><div><small>АКТИВНАЯ СЦЕНА · ${esc(sceneName)}</small><h2>${selectedCount ? `Запомнить выбранных: ${selectedCount}` : "Запомнить текущую точку"}</h2><p>${selectedCount ? "Сохраняются только имя, арт и место встречи." : "Точка сохранит безопасный снимок текущего зрения выбранного токена."}</p><div class="pcm-scene-status"><span class="${sceneLocation ? "known" : "new"}">${sceneLocation ? `⌖ В АРХИВЕ: ${esc(sceneLocation.title)}` : "⌖ ТОЧКА НЕ ЗАПИСАНА"}</span><span><b>CTRL+SHIFT+M</b></span></div></div><div class="pcm-capture-actions"><button class="primary" data-action="remember-context">${selectedCount ? "◎ СОХРАНИТЬ КОНТАКТЫ" : "⌖ СОХРАНИТЬ ТОЧКУ"}</button><button data-action="open-chat">✉ СООБЩЕНИЕ</button></div></section>
          ${selectedCount ? `<section class="pcm-scene-context"><header><div><small>БУФЕР ЦЕЛЕЙ</small><h2>Выбранные токены</h2><p>До импорта видно, какие контакты уже сохранены.</p></div><small>${selectedCount > 6 ? `Показано 6 из ${selectedCount}` : `${selectedCount} выбрано`}</small></header><div class="pcm-scene-token-grid">${tokenCards}</div></section>` : ""}
          <section class="pcm-quick pcm-quick-simple"><div><small>КАНАЛ ВВОДА</small><h2>Быстрый лог</h2><p><b>Ctrl+Enter</b> — записать пакет данных.</p></div><textarea data-quick data-autogrow placeholder="Фраза, адрес, слух, решение, долг…">${esc(state.quick)}</textarea><div class="pcm-quick-save"><select data-quick-type>${[["notes", "Заметка"], ["clues", "Зацепка"], ["quests", "Заказ"], ["people", "Контакт"], ["gangs", "Банда"], ["corporations", "Корпорация"], ["fixers", "Фиксер"], ["rippers", "Рипер"], ["locations", "Точка"]].map(([key, label]) => opt(key, state.quickType, label)).join("")}</select><button class="primary" data-action="quick-save">ЗАПИСАТЬ</button></div></section>
          <div class="pcm-stat-grid pcm-stat-grid-simple">${mainSections.map((key, index) => `<button data-action="nav" data-section="${key}"><b>${String(index + 1).padStart(2, "0")}</b><span><small>${counts[key]} ФАЙЛОВ</small>${SECTIONS[key].icon} ${SECTIONS[key].label}</span><i>→</i></button>`).join("")}</div>
        </div>
        <div class="pcm-dashboard-side">
          ${inboxCount ? `<section class="pcm-inbox-banner"><div><b>${inboxCount}</b><span><strong>ОЧЕРЕДЬ РАЗБОРА</strong><small>Есть быстрые записи на уточнение.</small></span></div><button data-action="nav" data-section="inbox">ОТКРЫТЬ →</button></section>` : `<section class="pcm-cyber-mini"><small>ОЧЕРЕДЬ</small><b>00</b><span>НЕТ ДАННЫХ НА РАЗБОР</span></section>`}
          ${book.entries.subscriptions.length ? `<section class="pcm-dashboard-subscriptions"><header><div><small>АКТИВНЫЕ СЕРВИСЫ</small><h2>Подписки</h2></div><button data-action="nav" data-section="subscriptions">ОТКРЫТЬ →</button></header><div>${sortedEntries(book.entries.subscriptions).slice(0,3).map(entry => subscriptionCard(entry, true)).join("")}</div></section>` : `<section class="pcm-cyber-mini"><small>СЕРВИСЫ</small><b>--</b><span>НЕТ АКТИВНЫХ ПОДПИСОК</span></section>`}
          <section class="pcm-recent"><header><div><small>ПОСЛЕДНИЕ ДАННЫЕ</small><h2>Последние записи</h2></div><button data-action="global-search">⌕ ПОИСК</button></header>${recent.length ? recent.map(entry => `<button data-action="open-entry" data-section="${entry.type}" data-entry-id="${entry.id}"><b>${SECTIONS[entry.type].icon}</b><span>${esc(recordTitle(entry))}${recordHeadline(entry) ? `<em class="pcm-mini-headline">${esc(recordHeadline(entry))}</em>` : ""}<small>${short((DIRECTORY_TYPES.has(entry.type) ? entry.quickNotes : "") || entry.summary || entry.content, 70)}</small></span><i>→</i></button>`).join("") : '<div class="pcm-cyber-mini"><small>АРХИВ</small><b>ПУСТО</b><span>НЕТ НЕДАВНИХ ЗАПИСЕЙ</span></div>'}</section>
        </div>
      </section>`;
  }

  function sortedEntries(entries) {
    return [...entries].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  function attitudeGroups(people) {
    const knownValues = new Set(ATTITUDE_GROUPS.map(group => group.value));
    return ATTITUDE_GROUPS.map(group => ({
      ...group,
      people: sortedEntries(people.filter(person => group.key === "unknown"
        ? person.attitude === group.value || !knownValues.has(person.attitude)
        : person.attitude === group.value))
    })).filter(group => group.people.length);
  }

  function readText(value, empty = "Пока ничего не записано.") {
    return `<div class="pcm-read-text ${value ? "" : "empty"}">${value ? esc(value) : esc(empty)}</div>`;
  }

  function inlineLockKey(person, field) { return `${person.id}:${field}`; }
  function inlineUnlocked(person, field) { return Boolean(state.inlineLocks?.[inlineLockKey(person, field)]); }
  function inlineLockButton(person, field, label = "Редактирование") {
    const unlocked = inlineUnlocked(person, field);
    return `<button class="pcm-inline-lock ${unlocked ? "is-unlocked" : "is-locked"}" data-action="toggle-inline-lock" data-inline-lock-field="${esc(field)}" title="${unlocked ? "Заблокировать" : "Разблокировать"}" aria-pressed="${unlocked ? "true" : "false"}"><b class="pcm-lock-glyph" aria-hidden="true"></b><span>${esc(label)}</span></button>`;
  }
  function inlinePersonNote(person, field, title, placeholder, icon = "✎") {
    const unlocked = inlineUnlocked(person, field);
    return `<section class="pcm-detail-panel pcm-inline-person-note ${unlocked ? "is-unlocked" : "is-locked"}" data-entry-id="${person.id}">
      <header><h3>${icon} ${esc(title)}</h3>${inlineLockButton(person, field, unlocked ? "Можно писать" : "Защищено")}</header>
      <textarea data-field="${field}" data-inline-person-field="${field}" data-autogrow ${unlocked ? "" : "readonly"} placeholder="${esc(placeholder)}">${esc(person[field] || "")}</textarea>
    </section>`;
  }

  function inlinePersonTags(book, person, { hero = false } = {}) {
    const unlocked = inlineUnlocked(person, "tags");
    const selected = new Set(personContactTypes(person));
    const manualTags = String(person.tags || "").split(",").map(tag => tag.trim()).filter(Boolean);
    const readChips = [
      ...personAffiliationData(person).map(item => `<span class="pcm-tag-static">${item.icon} ${esc(item.label)}</span>`),
      ...manualTags.map(tag => `<span class="pcm-tag-static">#${esc(tag)}</span>`)
    ].join("");
    const groupEditors = personContactTypes(person).map(type => {
      const meta = CONTACT_TYPE_META[type];
      const memberships = personMemberships(person, type);
      const listId = `pcm-inline-group-${type}-${person.id}`;
      const names = groupNamesForType(book, type);
      const chips = memberships.length
        ? memberships.map(group => `<button type="button" class="pcm-membership-chip" data-action="remove-inline-membership" data-contact-type="${esc(type)}" data-contact-group="${esc(group)}" title="Убрать только эту принадлежность">${esc(group)} <b>×</b></button>`).join("")
        : `<small class="muted">Без конкретной группы</small>`;
      return `<div class="pcm-inline-group" data-membership-type="${esc(type)}"><span>${meta.icon} ${esc(meta.label)} · принадлежность</span><div class="pcm-membership-chip-list">${chips}</div><div class="pcm-membership-add-row"><input data-inline-membership-input="${esc(type)}" list="${esc(listId)}" placeholder="Добавить группу / фракцию"><datalist id="${esc(listId)}">${names.map(name => `<option value="${esc(name)}"></option>`).join("")}</datalist><button type="button" data-action="add-inline-membership" data-contact-type="${esc(type)}">+ Группа</button></div></div>`;
    }).join("");
    return `<section class="${hero ? "pcm-hero-tag-panel" : "pcm-detail-panel wide"} pcm-inline-tags ${unlocked ? "is-unlocked" : "is-locked"}" data-entry-id="${person.id}">
      <header><div><small>КАТЕГОРИИ И ПРИНАДЛЕЖНОСТЬ</small><h3>🏷 Кто этот персонаж</h3></div>${inlineLockButton(person, "tags", unlocked ? "Редактирование" : "Защищено")}</header>
      ${unlocked ? `<div class="pcm-category-chip-editor pcm-inline-category-editor">${Object.entries(CONTACT_TYPE_META).map(([value, meta]) => `<button type="button" class="${selected.has(value) ? "active" : ""}" data-action="toggle-inline-category" data-contact-type="${esc(value)}">${selected.has(value) ? "✓ " : "+ "}${meta.icon} ${esc(meta.label)}</button>`).join("")}</div><div class="pcm-inline-group-grid">${groupEditors || '<p class="muted">Выберите категорию — затем при необходимости добавьте конкретную группу.</p>'}</div><label class="pcm-inline-manual-tags"><span># Свои теги</span><div class="pcm-inline-manual-tag-chips">${manualTags.length ? manualTags.map(tag => `<button type="button" data-action="remove-inline-tag" data-tag="${esc(tag)}" title="Удалить тег">#${esc(tag)} <b>×</b></button>`).join("") : `<small class="muted">Ручных тегов пока нет.</small>`}</div><input data-inline-person-tags value="${esc(person.tags || "")}" placeholder="свидетель, должник, опасный…"></label><small class="pcm-inline-hint"><b>Важно:</b> «его фиксер», «его рипер», знакомая банда или корпорация — это связи и сюда автоматически не попадают.</small>` : `<div class="pcm-inline-tag-read">${readChips || '<span class="muted">Категории и теги пока не добавлены.</span>'}</div>`}
    </section>`;
  }

  function personConnectionsPanel(person) {
    const links = [
      person.gang ? ["Связь с бандой", person.gang] : null,
      person.corporation ? ["Связь с корпорацией", person.corporation] : null,
      person.fixer ? ["Его фиксер", person.fixer] : null,
      person.ripper ? ["Его рипер", person.ripper] : null
    ].filter(Boolean);
    if ( !links.length ) return "";
    return `<section class="pcm-detail-panel wide pcm-person-connections"><header><h3>⇄ Связи персонажа</h3><small>Не являются тегами самого персонажа</small></header><div>${links.map(([label,value]) => `<span><b>${esc(label)}</b><i>${esc(value)}</i></span>`).join("")}</div></section>`;
  }

  function readFragments(entry) {
    if ( !entry.fragments.length ) return "";
    return `<section class="pcm-detail-panel wide"><h3>▱ Отдельные фрагменты</h3>${entry.fragments.map((fragment, index) => `<details class="pcm-read-fragment"><summary>${esc(fragment.title || `Фрагмент ${index + 1}`)}</summary><div>${fragment.image ? `<img src="${esc(fragment.image)}" alt="">` : ""}${readText(fragment.content)}</div></details>`).join("")}</section>`;
  }

  function linkedPeople(book, locationId) {
    return linkedEntries(book, "people", locationId);
  }

  function linkedEntries(book, type, locationId) {
    return sortedEntries(book.entries[type].filter(entry => entryLocationIds(entry).includes(locationId)));
  }

  function sectionContactType(section) {
    return Object.entries(CONTACT_TYPE_META).find(([, meta]) => meta.section === section)?.[0] || "";
  }

  function contactPickerButton(person, type, group = "") {
    const already = personContactTypes(person).includes(type) && (!String(group || "").trim() || hasContactMembership(person, type, group));
    return `<button class="${already ? "is-linked" : ""}" data-action="picker-link-person" data-person-id="${person.id}" data-picker-search="${esc(searchableText(person))}" ${already ? "disabled" : ""}><span class="pcm-picker-avatar">${person.image ? `<img src="${esc(person.image)}" alt="">` : "◉"}</span><span><b>${esc(person.title)}</b><small>${esc(person.attitude || "Неизвестно")}</small></span><strong>${already ? "✓ Уже здесь" : "+ Добавить"}</strong></button>`;
  }

  function openContactPicker({ type = "", group = "", directoryType = "", directoryId = "" } = {}) {
    if ( !CONTACT_TYPE_META[type] ) return;
    state.contactPicker = { type, group: String(group || ""), directoryType, directoryId, query: "" };
    render();
  }

  function contactPickerPanel(book) {
    const picker = state.contactPicker;
    if ( !picker ) return "";
    const meta = CONTACT_TYPE_META[picker.type];
    if ( !meta ) return "";
    const query = String(picker.query || "").trim().toLowerCase();
    const people = sortedEntries(book.entries.people).filter(person => !query || searchableText(person).includes(query));
    const groupLabel = picker.group ? ` → ${esc(picker.group)}` : "";
    const selected = selectedTokens();
    return `<div class="pcm-modal-backdrop"><section class="pcm-contact-picker" role="dialog" aria-label="Добавить контакт"><header><div><small>БЫСТРАЯ ПРИВЯЗКА</small><h2>${meta.icon} ${esc(meta.label)}${groupLabel}</h2><p>Выберите человека — тег и группа назначатся автоматически. Никакого отдельного редактора.</p></div><button data-action="close-contact-picker">×</button></header>
      ${selected.length ? `<button class="pcm-picker-token primary" data-action="picker-add-selected-tokens"><b>◎ Добавить выбранные токены (${selected.length})</b><span>Если контакта ещё нет — он будет создан из имени и арта, затем сразу привязан сюда.</span></button>` : ""}
      <label class="pcm-picker-search"><span>⌕</span><input data-contact-picker-search value="${esc(picker.query || "")}" placeholder="Найти контакт по имени, тегам или сводке…"></label>
      <div class="pcm-picker-list">${people.length ? people.map(person => contactPickerButton(person, picker.type, picker.group)).join("") : `<div class="pcm-inline-empty">Контакты не найдены.</div>`}</div>
      <footer><button data-action="close-contact-picker">Готово</button></footer></section></div>`;
  }

  function quickGroupCreatePanel(book) {
    const create = state.quickGroupCreate;
    if ( !create ) return "";
    const meta = CONTACT_TYPE_META[create.type];
    const selectedCount = selectedTokens().length;
    return `<div class="pcm-modal-backdrop"><section class="pcm-quick-group-create" role="dialog" aria-label="Новая группа"><header><div><small>НОВАЯ ГРУППА</small><h2>${meta?.icon || "◉"} ${esc(SECTIONS[create.section]?.label || "Группа")}</h2><p>${selectedCount ? `Введите только название — выбранные токены (${selectedCount}) будут добавлены сюда сразу.` : "Нужно только название. После создания сразу выберете нужных людей."}</p></div><button data-action="close-quick-group">×</button></header><label><span>Название</span><input data-quick-group-name value="${esc(create.name || "")}" placeholder="Например: NCPD"></label><footer><button data-action="close-quick-group">Отмена</button><button class="primary" data-action="create-quick-group">${selectedCount ? `Создать + добавить выбранное (${selectedCount})` : "Создать и добавить людей"}</button></footer></section></div>`;
  }

  function contactBindControls(type, group = "", { directoryType = "", directoryId = "", compact = false } = {}) {
    const count = selectedTokens().length;
    const data = `data-contact-type="${esc(type)}" data-contact-group="${esc(group)}" data-directory-type="${esc(directoryType)}" data-directory-id="${esc(directoryId)}"`;
    if ( count ) return `<span class="pcm-bind-actions"><button class="primary pcm-bind-selected" data-action="bind-selected-tokens" ${data}>◎ Добавить выбранное (${count})</button><button class="pcm-bind-contact ${compact ? "compact" : ""}" data-action="open-contact-picker" ${data}>+ Из контактов</button></span>`;
    return `<button class="primary pcm-bind-contact ${compact ? "compact" : ""}" data-action="open-contact-picker" ${data}>+ Добавить контакт</button>`;
  }

  function groupRosterBlock(book, type, group, { title = "", icon = "", directoryId = "", directoryType = "" } = {}) {
    const people = contactsForGroup(book, type, group);
    const label = title || group || `Без конкретной группы`;
    return `<section class="pcm-faction-group ${group ? "" : "ungrouped"}" data-faction-group="${esc(group)}"><header><div><small>${group ? "ГРУППА / ФРАКЦИЯ" : "БЕЗ ПРИВЯЗКИ"}</small><h2>${icon || CONTACT_TYPE_META[type]?.icon || "◉"} ${esc(label)}</h2></div><div><em>${people.length}</em>${contactBindControls(type, group, { directoryId, directoryType, compact: true })}</div></header><div class="pcm-contact-list">${people.length ? people.map(person => personListCard(person, book)).join("") : `<div class="pcm-inline-empty">Здесь пока никого нет. Выберите токен на сцене или добавьте человека из контактов.</div>`}</div></section>`;
  }

  function categorizedContactRoster(book, section, { compact = false } = {}) {
    const type = sectionContactType(section);
    const meta = CONTACT_TYPE_META[type];
    if ( !meta ) return "";
    const groups = groupNamesForType(book, type);
    const blocks = [];
    const ungrouped = contactsForGroup(book, type, "");
    if ( ungrouped.length || !groups.length ) blocks.push(groupRosterBlock(book, type, ""));
    for ( const group of groups ) blocks.push(groupRosterBlock(book, type, group, { title: group }));
    return `<div class="pcm-faction-groups ${compact ? "compact" : ""}">${blocks.join("")}</div>`;
  }

  function directoryGroupRosterBlock(book, key, type, group, entry = null) {
    const meta = DIRECTORY_META[key];
    const people = contactsForGroup(book, type, group);
    const label = entry?.title || group || "Без конкретной группы";
    const directoryData = entry ? { directoryType: entry.type, directoryId: entry.id } : {};
    const badges = entry ? directoryBadges(entry) : [];
    return `<section class="pcm-faction-group ${entry ? "" : "pcm-orphan-group"}" data-faction-group="${esc(group)}" ${entry ? `data-entry-id="${entry.id}" data-contact-drop="directory" data-directory-type="${entry.type}" data-directory-id="${entry.id}"` : ""}>
      <header>
        <div>
          <small>${entry ? "ГРУППА / ФРАКЦИЯ" : "СВЯЗЬ ИЗ КОНТАКТА · ДОСЬЕ НЕ СОЗДАНО"}</small>
          <h2>${meta.icon} ${esc(label)}</h2>
          ${badges.length ? `<span class="pcm-directory-badges">${badges.map(value => `<i>${esc(value)}</i>`).join("")}</span>` : ""}
        </div>
        <div class="pcm-faction-group-tools">
          <em>${people.length}</em>
          ${entry ? `<button data-action="open-entry" data-entry-id="${entry.id}" data-section="${entry.type}">Открыть досье</button>` : `<button data-action="adopt-contact-group" data-section="${key}" data-contact-group="${esc(group)}">+ Создать досье</button>`}
          ${contactBindControls(type, label, { ...directoryData, compact: true })}
        </div>
      </header>
      <div class="pcm-contact-list">${people.length ? people.map(person => personListCard(person, book)).join("") : `<div class="pcm-inline-empty">Здесь пока никого нет. Добавьте выбранный токен или существующий контакт.</div>`}</div>
    </section>`;
  }

  function directoryListView(book, key) {
    const meta = DIRECTORY_META[key];
    const type = sectionContactType(key);
    const groups = groupNamesForType(book, type);
    const contacts = contactsForSection(book, key);
    const ungrouped = contactsForGroup(book, type, "");
    const blocks = [];
    if ( ungrouped.length ) blocks.push(groupRosterBlock(book, type, ""));
    for ( const group of groups ) {
      const entry = directoryEntryForGroup(book, key, group);
      blocks.push(directoryGroupRosterBlock(book, key, type, group, entry));
    }
    const content = blocks.length
      ? `<div class="pcm-faction-groups">${blocks.join("")}</div>`
      : `<div class="pcm-empty"><b>${meta.icon}</b><h2>${esc(meta.emptyTitle)}</h2><p>Создайте группу или сразу добавьте выбранного персонажа. Если связь с контактом уже существует, она появится здесь автоматически.</p><button class="primary" data-action="quick-create-directory" data-section="${key}">+ Создать</button></div>`;
    return `<div class="pcm-section-head pcm-faction-head"><div><small>${groups.length} ГРУПП · ${contacts.length} КОНТАКТОВ</small><h1>${meta.icon} ${esc(meta.label)}</h1><p>${esc(meta.hint)} Все связи отображаются здесь, даже если отдельное досье группы ещё не создано.</p></div><div>${contactBindControls(type)}<button class="primary" data-action="quick-create-directory" data-section="${key}">+ Новая ${esc(meta.noun)}</button></div></div>${content}`;
  }

  function virtualContactListView(book, key) {
    const section = SECTIONS[key];
    const type = sectionContactType(key);
    const people = contactsForSection(book, key);
    const groups = groupNamesForType(book, type);
    return `<div class="pcm-section-head pcm-faction-head"><div><small>${groups.length} ГРУПП · ${people.length} КОНТАКТОВ</small><h1>${section.icon} ${esc(section.label)}</h1><p>Это категория людей, а NCPD / MaxTac и другие названия — отдельные группы внутри неё. Один контакт может одновременно находиться и в других категориях.</p></div><div>${contactBindControls(type)}<button class="primary" data-action="quick-create-group" data-contact-type="${type}" data-section="${key}">+ Новая группа</button></div></div>
      ${categorizedContactRoster(book, key)}`;
  }

  function locationListView(book) {
    const entries = sortedEntries(book.entries.locations);
    const cards = entries.map(location => {
      const people = linkedPeople(book, location.id), quests = linkedEntries(book, "quests", location.id), clues = linkedEntries(book, "clues", location.id), books = linkedEntries(book, "books", location.id), sessions = linkedEntries(book, "sessions", location.id), notes = linkedEntries(book, "notes", location.id);
      const search = [location.title, location.headline, location.summary, location.content, location.tags, location.kind, location.region, ...[...people, ...quests, ...clues, ...books, ...sessions, ...notes].map(entry => entry.title)].join(" ").toLowerCase();
      return `<article class="pcm-location-card ${location.pinned ? "pinned" : ""}" data-entry-id="${location.id}" data-search="${esc(search)}"><button class="pcm-location-open" data-action="view-location"><div class="pcm-location-image">${location.image ? `<img src="${esc(location.image)}" alt="">` : "⌖"}</div><div class="pcm-location-copy"><small>${esc([location.kind, location.region].filter(Boolean).join(" · ") || "ТОЧКА")}</small><h2>${esc(location.title)}</h2>${location.headline ? `<h3 class="pcm-entry-headline">${esc(location.headline)}</h3>` : ""}<p>${short(location.summary || location.content || "Открыть досье точки", 150)}</p><div class="pcm-location-counts"><span title="Контакты">◉ ${people.length}</span><span title="Заказы">▤ ${quests.length}</span><span title="Зацепки">◇ ${clues.length}</span><span title="Файлы">▣ ${books.length}</span><span title="Логи">◷ ${sessions.length}</span><span title="Заметки">▧ ${notes.length}</span><i>${esc(location.status || "")}</i></div></div><b>→</b></button></article>`;
    }).join("");
    return `<div class="pcm-section-head"><div><small>${entries.length} ТОЧЕК</small><h1>⌖ Точки</h1></div><div><button data-action="from-scene">⌖ Из сцены</button><button class="primary" data-action="add" data-section="locations">+ Добавить</button></div></div><p class="pcm-section-hint">Точка сохраняет название сцены и снимок только той области, которую реально видит выбранный токен. Полный фон сцены в архив не переносится.</p><div class="pcm-location-list">${cards || `<div class="pcm-empty"><b>⌖</b><h2>Точек пока нет</h2><p>Добавьте текущую сцену одним нажатием.</p><div><button data-action="from-scene">Из текущей сцены</button><button class="primary" data-action="add" data-section="locations">Создать вручную</button></div></div>`}</div>`;
  }

  function contactTagValues(person) {
    return String(person?.tags || "").split(",").map(tag => tag.trim()).filter(Boolean);
  }

  function contactFilteredPeople(book) {
    let people = contactsForSection(book, "people");
    const role = state.contactRoleFilter || "all";
    const tag = state.contactTagFilter || "all";
    const query = String(state.contactQuery || "").trim().toLowerCase();
    if ( role !== "all" ) people = people.filter(person => role === "none" ? !personContactTypes(person).length : personContactTypes(person).includes(role));
    if ( tag !== "all" ) people = people.filter(person => contactTagValues(person).some(value => normalizeName(value) === normalizeName(tag)));
    if ( query ) people = people.filter(person => searchableText(person).includes(query));
    return people;
  }

  function contactSortList(people, mode = state.contactSort) {
    const list = [...people];
    if ( mode === "name" ) return list.sort((a,b)=>recordTitle(a).localeCompare(recordTitle(b),"ru"));
    if ( mode === "recent" ) return list.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)) || recordTitle(a).localeCompare(recordTitle(b),"ru"));
    if ( mode === "pinned" ) return list.sort((a,b)=>(Number(b.pinned)-Number(a.pinned)) || recordTitle(a).localeCompare(recordTitle(b),"ru"));
    if ( mode === "role" ) return list.sort((a,b)=>{
      const ar=CONTACT_TYPE_META[personContactTypes(a)[0]]?.label || "Без роли";
      const br=CONTACT_TYPE_META[personContactTypes(b)[0]]?.label || "Без роли";
      return ar.localeCompare(br,"ru") || recordTitle(a).localeCompare(recordTitle(b),"ru");
    });
    if ( mode === "tags" ) return list.sort((a,b)=>{
      const at=contactTagValues(a)[0] || "Яяя Без тегов";
      const bt=contactTagValues(b)[0] || "Яяя Без тегов";
      return at.localeCompare(bt,"ru") || recordTitle(a).localeCompare(recordTitle(b),"ru");
    });
    return sortedEntries(list);
  }

  function contactDisplayGroups(people, mode = state.contactSort) {
    if ( mode === "attitude" ) return attitudeGroups(people);
    if ( mode === "role" ) {
      const order = [...Object.keys(CONTACT_TYPE_META), "none"];
      return order.map(type => {
        const meta = CONTACT_TYPE_META[type];
        const members = people.filter(person => (personContactTypes(person)[0] || "none") === type);
        return { key:`role-${type}`, label:meta?.label || "Без роли", icon:meta?.icon || "◉", hint:type === "none" ? "роль не назначена" : "основная роль контакта", people:contactSortList(members,"name") };
      }).filter(group=>group.people.length);
    }
    if ( mode === "tags" ) {
      const buckets = new Map();
      for ( const person of people ) {
        const key = contactTagValues(person)[0] || "Без тегов";
        if ( !buckets.has(key) ) buckets.set(key, []);
        buckets.get(key).push(person);
      }
      return [...buckets.entries()].sort(([a],[b])=>a.localeCompare(b,"ru")).map(([tag,members],index)=>({key:`tag-${index}`,label:tag,icon:tag === "Без тегов" ? "#" : "#",hint:tag === "Без тегов" ? "ручные теги не указаны" : "первый ручной тег",people:contactSortList(members,"name")}));
    }
    const label = mode === "name" ? "По имени" : mode === "pinned" ? "Закреплённые сверху" : "Недавно изменённые";
    return [{key:`sort-${mode}`,label,icon:mode === "pinned" ? "★" : "◉",hint:"единый список",people:contactSortList(people,mode)}];
  }

  function applyContactSearchDom() {
    if ( state.section !== "people" || state.viewMode !== "list" || !state.root ) return;
    const query = String(state.contactQuery || "").trim().toLowerCase();
    let totalVisible = 0;
    for ( const group of state.root.querySelectorAll("[data-contact-display-group]") ) {
      let groupVisible = 0;
      for ( const card of group.querySelectorAll(".pcm-contact-card[data-search]") ) {
        const visible = !query || String(card.dataset.search || "").includes(query);
        card.hidden = !visible;
        if ( visible ) groupVisible += 1;
      }
      group.hidden = groupVisible === 0;
      const counter = group.querySelector("[data-contact-group-count]");
      if ( counter ) counter.textContent = String(groupVisible);
      totalVisible += groupVisible;
    }
    const empty = state.root.querySelector("[data-contact-search-empty]");
    if ( empty ) empty.hidden = totalVisible > 0;
    const out = state.root.querySelector("[data-contact-visible-count]");
    if ( out ) out.textContent = String(totalVisible);
  }

  function personQuickEditPanel(book, person) {
    const attitudes = ATTITUDE_GROUPS.map(group => opt(group.value, person.attitude || "Неизвестно", group.label)).join("");
    const named = (field, label, entries, placeholder) => {
      const listId = `pcm-quick-${field}-${person.id}`;
      return `<label><span>${esc(label)}</span><input data-quick-person-field="${field}" list="${esc(listId)}" value="${esc(person[field] || "")}" placeholder="${esc(placeholder)}"><datalist id="${esc(listId)}">${entries.map(item => `<option value="${esc(item.title)}"></option>`).join("")}</datalist></label>`;
    };
    return `<div class="pcm-person-quick-edit" data-entry-id="${person.id}">
      <section class="pcm-quick-edit-section identity"><header><small>IDENTITY / CONTACT</small><h3>Основные данные</h3></header><div class="pcm-quick-edit-grid">
        <label><span>Имя / позывной</span><input data-quick-person-field="title" value="${esc(person.title || "")}" placeholder="Имя контакта"></label>
        <label><span>Подзаголовок</span><input data-quick-person-field="headline" value="${esc(person.headline || "")}" placeholder="Короткий идентификатор"></label>
        <label><span>Уровень отношения</span><select data-quick-person-field="attitude">${attitudes}</select></label>
        <label><span>Первая встреча</span><input data-quick-person-field="firstMet" value="${esc(person.firstMet || "")}" placeholder="Где / при каких обстоятельствах"></label>
        <label><span>Последняя встреча</span><input data-quick-person-field="lastSeen" value="${esc(person.lastSeen || "")}" placeholder="Когда / где видели"></label>
        <label><span>Изображение</span><div class="pcm-quick-image-path"><input data-quick-person-field="image" value="${esc(person.image || "")}" placeholder="Путь Foundry или URL"><button type="button" data-action="pick-image">▧ Выбрать</button></div></label>
        <label class="wide"><span>Краткая сводка</span><textarea data-quick-person-field="summary" data-autogrow placeholder="Кто это и почему важен">${esc(person.summary || "")}</textarea></label>
        <label class="wide"><span>Наша связь</span><textarea data-quick-person-field="relationship" data-autogrow placeholder="Долг, доверие, конфликт, рычаг…">${esc(person.relationship || "")}</textarea></label>
      </div></section>

      <section class="pcm-quick-edit-section links"><header><small>LINK / NETWORK</small><h3>Связи персонажа</h3><p>Это знакомые и посредники, а не роли самого персонажа.</p></header><div class="pcm-quick-edit-grid">
        ${named("gang", "Связанная банда / знакомые", book.entries.gangs, "Например: знакомые в Tyger Claws")}
        ${named("corporation", "Связанная корпорация / контакты", book.entries.corporations, "Например: контакт в Militech")}
        ${named("fixer", "Его фиксер / посредник", book.entries.fixers, "Например: Ганс")}
        ${named("ripper", "Его рипер / клиника", book.entries.rippers, "Например: Эмиль")}
      </div></section>

      ${inlinePersonTags(book, person, { hero: true })}

      <section class="pcm-quick-edit-section pcm-quick-location-links"><header><small>GEO / MEMORY</small><h3>Где встречали</h3></header>${locationChecks(person, book.entries.locations)}</section>

      <section class="pcm-quick-edit-section dossier"><header><small>DATA / DOSSIER</small><h3>Полное досье</h3></header><div class="pcm-quick-edit-grid">
        <label class="wide"><span>Мои заметки / основная запись</span><textarea data-quick-person-field="content" data-autogrow placeholder="Что важно помнить об этом человеке?">${esc(person.content || "")}</textarea></label>
        <label class="wide"><span>Что он говорил</span><textarea data-quick-person-field="quotes" data-autogrow placeholder="Фразы, обещания, имена, адреса…">${esc(person.quotes || "")}</textarea></label>
        <label class="wide"><span>Долги и договорённости</span><textarea data-quick-person-field="promises" data-autogrow placeholder="Кто кому должен и что обещано">${esc(person.promises || "")}</textarea></label>
        <label class="wide"><span>Подозрения и скрытое</span><textarea data-quick-person-field="secrets" data-autogrow placeholder="Сомнения, скрытые мотивы, непроверенные версии…">${esc(person.secrets || "")}</textarea></label>
      </div></section>

      <section class="pcm-quick-edit-section media"><header><small>MEDIA / ATTACHMENTS</small><h3>Галерея и фрагменты</h3></header>${galleryEditor(person)}${fragments(person)}<div class="pcm-add-fragment"><button type="button" data-action="add-fragment">+ Отдельный фрагмент</button><span>Переписка, разговор, расшифровка или отдельная картинка</span></div></section>
    </div>`;
  }


  let archiveContextOverlay = null;

  function contextOverlayHost() {
    if ( archiveContextOverlay?.isConnected ) return archiveContextOverlay;
    const host = document.createElement("div");
    host.className = "archive-context-overlay-host";
    host.setAttribute("data-archive-context-overlay", VARIANT);
    host.addEventListener("click", event => {
      const button = event.target.closest?.("[data-action]");
      if ( !button ) return;
      event.preventDefault();
      event.stopPropagation();
      proxyArchiveContextAction(state.root, button);
    });
    host.addEventListener("keydown", event => {
      if ( event.key !== "Enter" ) return;
      const input = event.target.closest?.("[data-context-tag-input], [data-entry-context-tag-input]");
      if ( !input ) return;
      event.preventDefault();
      const action = input.matches("[data-context-tag-input]") ? "context-commit-tag" : "context-entry-commit-tag";
      input.closest(".pcm-context-tag-editor")?.querySelector?.(`[data-action="${action}"]`)?.click?.();
    });
    document.body.append(host);
    archiveContextOverlay = host;
    return host;
  }

  function removeContextOverlay() {
    archiveContextOverlay?.remove?.();
    archiveContextOverlay = null;
  }

  function fitContextMenuToViewport(menu, x, y) {
    return placeArchiveContextMenu(menu, x, y, { margin: 8 });
  }

  function contactContextMenu(book) {
    const ctx = state.contactContext;
    if ( !ctx ) return "";
    const person = book.entries.people.find(item => item.id === ctx.personId);
    if ( !person ) return "";
    const directory = ctx.directoryId ? entryById(ctx.directoryId) : null;
    const types = new Set(personContactTypes(person));
    const x = Math.max(8, Number(ctx.x) || 8);
    const y = Math.max(8, Number(ctx.y) || 8);
    return `<div class="pcm-contact-context-menu pcm-context-menu-surface" data-entry-id="${person.id}" style="left:${x}px;top:${y}px">
      <header><span class="pcm-context-avatar">${person.image ? `<img src="${esc(person.image)}" alt="">` : "◉"}</span><span><small>КОНТЕКСТ // КОНТАКТ</small><b>${esc(person.title)}</b></span><button data-action="context-close" aria-label="Закрыть">×</button></header>
      <div class="pcm-context-actions"><button data-action="context-open-person">◉ Открыть досье</button><button data-action="context-quick-edit">✎ Быстро редактировать</button><button data-action="context-toggle-pin">${person.pinned ? "★ Открепить" : "☆ Закрепить"}</button><button data-action="context-message">✉ Сообщение</button></div>
      <section><small>УРОВЕНЬ ОТНОШЕНИЯ</small><div class="pcm-context-chip-grid">${ATTITUDE_GROUPS.map(group => `<button class="${person.attitude === group.value ? "active" : ""}" data-action="context-set-attitude" data-attitude="${esc(group.value)}">${group.icon} ${esc(group.label)}</button>`).join("")}</div></section>
      <section><small>РОЛЬ / ПРИНАДЛЕЖНОСТЬ</small><div class="pcm-context-chip-grid roles">${Object.entries(CONTACT_TYPE_META).map(([type,meta]) => `<button class="${types.has(type) ? "active" : ""}" data-action="context-add-role" data-contact-type="${esc(type)}" aria-pressed="${types.has(type) ? "true" : "false"}" title="${types.has(type) ? "Повторный клик снимет роль и её принадлежности" : "Добавить роль"}">${types.has(type) ? "✓" : "+"} ${meta.icon} ${esc(meta.label)}</button>`).join("")}</div><small class="pcm-context-role-hint">Выбранная роль подсвечена. Повторный клик снимет роль.</small></section>
      <section><small>РУЧНЫЕ ТЕГИ</small><div class="pcm-context-tag-list">${contactTagValues(person).length ? contactTagValues(person).map(tag => `<button data-action="context-remove-tag" data-tag="${esc(tag)}" title="Удалить тег"># ${esc(tag)} <b>×</b></button>`).join("") : `<span class="muted">Тегов пока нет.</span>`}</div></section>
      <div class="pcm-context-actions minor pcm-context-tag-action">${ctx.tagEditor ? `<div class="pcm-context-tag-editor"><label><span>НОВЫЙ ТЕГ</span><input data-context-tag-input autocomplete="off" placeholder="Например: должник, информатор…"></label><button data-action="context-commit-tag">+ Добавить</button><button data-action="context-cancel-tag" aria-label="Отмена добавления тега">×</button></div>` : `<button data-action="context-add-tag"># Добавить тег</button>`}${directory ? `<button data-action="context-unlink-directory" data-directory-id="${directory.id}" data-directory-type="${directory.type}">× Отвязать от ${esc(directory.title)}</button>` : ""}</div>
      <button class="danger pcm-context-delete" data-action="context-delete-person">✕ Удалить контакт</button>
    </div>`;
  }

  function closeContactContextMenu() {
    state.contactContext = null;
    archiveContextOverlay?.querySelector?.(".pcm-contact-context-menu")?.remove();
  }

  function mountContactContextMenu() {
    const host = contextOverlayHost();
    host.querySelector?.(".pcm-contact-context-menu")?.remove();
    const ctx = state.contactContext;
    const html = contactContextMenu(notebook());
    if ( html && ctx ) {
      syncArchiveContextTheme(state.root, host);
      host.insertAdjacentHTML("beforeend", html);
      const menu = host.querySelector?.(".pcm-contact-context-menu");
      requestAnimationFrame(() => fitContextMenuToViewport(menu, ctx.x, ctx.y));
    }
  }

  function focusContextTagInput(selector) {
    requestAnimationFrame(() => {
      const input = archiveContextOverlay?.querySelector?.(selector);
      input?.focus?.();
      input?.select?.();
    });
  }

  function contactContextPerson() {
    const id = state.contactContext?.personId;
    if ( !id ) return null;
    return notebook()?.entries?.people?.find(person => person.id === id) ?? null;
  }

  function refreshContactContextMenu({ focusTag = false, context = null } = {}) {
    const ctx = context ? { ...context } : (state.contactContext ? { ...state.contactContext } : null);
    if ( !ctx ) return;
    render();
    state.contactContext = ctx;
    mountContactContextMenu();
    if ( focusTag ) focusContextTagInput("[data-context-tag-input]");
  }

  function entryContextStatusValues(entry) {
    if ( entry?.type === "locations" ) return ["Активна", "Не разведана", "Проверена", "Опасна", "Закрыта", "Уничтожена"];
    if ( entry?.type === "quests" ) return ["Активно", "На паузе", "Выполнено", "Провалено", "Отказались", "Скрытое"];
    if ( entry?.type === "clues" ) return ["Новая", "Проверяется", "Связана", "Закрыта", "Ложный след"];
    if ( entry?.type === "books" ) return ["Не изучен", "В работе", "На паузе", "Расшифрован", "Недоступен"];
    if ( entry?.type === "subscriptions" ) return ["Активна", "Приостановлена", "Истекла"];
    return [];
  }

  function entryContextMenu(book) {
    const ctx = state.entryContext;
    if ( !ctx ) return "";
    const entry = entryById(ctx.entryId);
    if ( !entry || entry.type === "people" ) return "";
    const tags = String(entry.tags || "").split(",").map(tag => tag.trim()).filter(Boolean);
    const statuses = entryContextStatusValues(entry);
    const x = Math.max(8, Number(ctx.x) || 8);
    const y = Math.max(8, Number(ctx.y) || 8);
    const special = entry.type === "subscriptions"
      ? `<section><small>СЕРВИС / СРОК</small><div class="pcm-context-chip-grid"><button data-action="context-entry-day-minus" ${subscriptionDays(entry) <= 0 ? "disabled" : ""}>−1 день</button><button data-action="context-entry-renew">+${subscriptionTerm(entry)} дней</button></div></section>`
      : entry.type === "books"
        ? `<section><small>РАСШИФРОВКА</small><div class="pcm-context-chip-grid"><button data-action="context-entry-decode" data-delta="-10">−10%</button><button data-action="context-entry-decode" data-delta="10">+10%</button></div></section>`
        : "";
    const directoryAction = DIRECTORY_TYPES.has(entry.type) ? `<button data-action="context-entry-add-contact">◉ Добавить контакт</button>` : "";
    return `<div class="pcm-entry-context-menu pcm-context-menu-surface" data-entry-id="${entry.id}" style="left:${x}px;top:${y}px">
      <header><span class="pcm-context-avatar">${entry.image ? `<img src="${esc(entry.image)}" alt="">` : (SECTIONS[entry.type]?.icon || "▧")}</span><span><small>КОНТЕКСТ // ${esc(SECTIONS[entry.type]?.label || "ЗАПИСЬ")}</small><b>${esc(recordTitle(entry))}</b></span><button data-action="context-entry-close" aria-label="Закрыть">×</button></header>
      <div class="pcm-context-actions"><button data-action="context-entry-open">◉ Открыть</button><button data-action="context-entry-edit">✎ Редактировать</button><button data-action="context-entry-toggle-pin">${entry.pinned ? "★ Открепить" : "☆ Закрепить"}</button>${directoryAction || (ctx.tagEditor ? "" : `<button data-action="context-entry-add-tag"># Добавить тег</button>`)}</div>
      ${ctx.tagEditor ? `<div class="pcm-context-actions minor pcm-context-tag-action"><div class="pcm-context-tag-editor"><label><span>НОВЫЙ ТЕГ</span><input data-entry-context-tag-input autocomplete="off" placeholder="Например: срочно, опасно…"></label><button data-action="context-entry-commit-tag">+ Добавить</button><button data-action="context-entry-cancel-tag" aria-label="Отмена добавления тега">×</button></div></div>` : (directoryAction ? `<div class="pcm-context-actions minor"><button data-action="context-entry-add-tag"># Добавить тег</button></div>` : "")}
      ${statuses.length ? `<section><small>БЫСТРЫЙ СТАТУС</small><div class="pcm-context-chip-grid">${statuses.map(status => `<button class="${entry.status === status ? "active" : ""}" data-action="context-entry-set-status" data-status="${esc(status)}">${entry.status === status ? "✓ " : ""}${esc(status)}</button>`).join("")}</div></section>` : ""}
      ${special}
      <section><small>ТЕГИ</small><div class="pcm-context-tag-list">${tags.length ? tags.map(tag => `<button data-action="context-entry-remove-tag" data-tag="${esc(tag)}"># ${esc(tag)} <b>×</b></button>`).join("") : `<span class="muted">Тегов пока нет.</span>`}</div></section>
      <button class="danger pcm-context-delete" data-action="context-entry-delete">✕ Удалить запись</button>
    </div>`;
  }

  function closeEntryContextMenu() {
    state.entryContext = null;
    archiveContextOverlay?.querySelector?.(".pcm-entry-context-menu")?.remove();
  }

  function mountEntryContextMenu() {
    const host = contextOverlayHost();
    host.querySelector?.(".pcm-entry-context-menu")?.remove();
    const ctx = state.entryContext;
    const html = entryContextMenu(notebook());
    if ( html && ctx ) {
      syncArchiveContextTheme(state.root, host);
      host.insertAdjacentHTML("beforeend", html);
      const menu = host.querySelector?.(".pcm-entry-context-menu");
      requestAnimationFrame(() => fitContextMenuToViewport(menu, ctx.x, ctx.y));
    }
  }

  function refreshEntryContextMenu({ focusTag = false } = {}) {
    const ctx = state.entryContext ? { ...state.entryContext } : null;
    if ( !ctx ) return;
    render();
    state.entryContext = ctx;
    mountEntryContextMenu();
    if ( focusTag ) focusContextTagInput("[data-entry-context-tag-input]");
  }

  function personListCard(person, book, { unlinkDirectory = null } = {}) {
    const locations = personLocationIds(person).map(id => book.entries.locations.find(location => location.id === id)).filter(Boolean);
    const preview = person.summary || person.content || person.quotes || person.promises || person.secrets || "Открыть досье контакта";
    const origins = personOriginBadges(person, { limit: 6 });
    const search = searchableText(person);
    const unlinkButton = unlinkDirectory ? `<button class="pcm-directory-unlink" data-action="unlink-contact-directory" data-person-id="${person.id}" data-directory-type="${esc(unlinkDirectory.type)}" data-directory-id="${esc(unlinkDirectory.id)}" title="Убрать только связь с ${esc(unlinkDirectory.title)}">× Отвязать от ${esc(unlinkDirectory.title)}</button>` : "";
    return `<article class="pcm-contact-card ${person.pinned ? "pinned" : ""} ${unlinkDirectory ? "has-directory-unlink" : ""}" data-entry-id="${person.id}" data-search="${esc(search)}" data-context-directory-id="${esc(unlinkDirectory?.id || "")}" data-context-directory-type="${esc(unlinkDirectory?.type || "")}" draggable="true" data-contact-drag-id="${person.id}">
      <button class="pcm-contact-open" data-action="view-person" data-person-id="${person.id}" aria-label="Открыть досье: ${esc(person.title)}">
        <span class="pcm-contact-photo">${person.image ? `<img src="${esc(person.image)}" alt="">` : "◉"}</span>
        <span class="pcm-contact-copy"><small>КОНТАКТ · ${esc(person.attitude || "Неизвестно")}</small><strong>${esc(person.title)}</strong>${origins}<em>${short(preview, 150)}</em><span class="pcm-contact-meta">${locations.length ? `⌖ ${locations.length} ${locations.length === 1 ? "место" : "мест"}` : "⌖ Место не отмечено"}${person.encounters?.length ? `<i>◷ ${person.encounters.length}</i>` : ""}</span></span>
        <b aria-hidden="true">→</b>
      </button>
      <button class="pcm-contact-message" data-action="open-chat-contact" data-person-id="${person.id}" title="Сообщение по этому контакту">✉</button>
      ${unlinkButton}
    </article>`;
  }

  function peopleListView(book) {
    const allPeople = contactsForSection(book, "people");
    const people = contactFilteredPeople(book);
    const unassigned = allPeople.filter(person => !personContactTypes(person).length).length;
    const assigned = allPeople.length - unassigned;
    const tags = [...new Set(allPeople.flatMap(contactTagValues))].sort((a,b)=>a.localeCompare(b,"ru"));
    const groups = contactDisplayGroups(people, state.contactSort);
    const content = groups.map(group => `<details class="pcm-attitude-section pcm-contact-display-group tone-${group.key}" data-contact-display-group open><summary><span><i>${group.icon}</i><b>${esc(group.label)}</b><small>${esc(group.hint || "")}</small></span><em data-contact-group-count>${group.people.length}</em></summary><div class="pcm-contact-list">${group.people.map(person => personListCard(person, book)).join("")}</div></details>`).join("");
    return `<div class="pcm-section-head"><div><small>${allPeople.length} ВСЕГО КОНТАКТОВ · ${assigned} С ПРИНАДЛЕЖНОСТЬЮ · ${unassigned} БЕЗ НЕЁ</small><h1>◉ Контакты</h1></div><div><button data-action="from-token">◎ Из выбранных токенов</button><button class="primary" data-action="add" data-section="people">+ Новый контакт</button></div></div>
      <p class="pcm-section-hint">Общая база всех людей. Поиск учитывает имя, текст досье, роль, принадлежность и ручные теги. ПКМ по карточке открывает быстрые действия.</p>
      <div class="pcm-contact-toolbar"><label class="contact-search-filter"><span>ПОИСК</span><div class="pcm-contact-searchbox"><b aria-hidden="true">⌕</b><input data-contact-search value="${esc(state.contactQuery || "")}" placeholder="Имя, роль, корпорация, тег, заметка…"><i>LIVE INDEX</i></div></label><label class="role-filter"><span>РОЛЬ</span><select data-contact-role-filter>${opt("all",state.contactRoleFilter,"Все роли")}${Object.entries(CONTACT_TYPE_META).map(([type,meta])=>opt(type,state.contactRoleFilter,`${meta.icon} ${meta.label}`)).join("")}${opt("none",state.contactRoleFilter,"Без роли")}</select></label><label class="tag-filter"><span>ТЕГ</span><select data-contact-tag-filter>${opt("all",state.contactTagFilter,"Все теги")}${tags.map(tag=>opt(tag,state.contactTagFilter,`# ${tag}`)).join("")}</select></label><label class="sort-filter"><span>СОРТИРОВКА</span><select data-contact-sort>${opt("attitude",state.contactSort,"По отношению")}${opt("name",state.contactSort,"По имени")}${opt("role",state.contactSort,"По роли")}${opt("tags",state.contactSort,"По тегам")}${opt("recent",state.contactSort,"Недавно изменённые")}${opt("pinned",state.contactSort,"Закреплённые")}</select></label><div class="pcm-contact-filter-status"><b data-contact-visible-count>${people.length}</b><span>показано</span></div></div>
      <div class="pcm-contact-index-info"><b>NETWORK INDEX</b><span>Фильтры не меняют сами записи. Сортировка «По роли» группирует по основной роли, «По тегам» — по первому ручному тегу.</span></div>
      <div class="pcm-attitude-list">${content || `<div class="pcm-empty"><b>⌕</b><h2>Ничего не найдено</h2><p>Измените поиск или фильтры.</p></div>`}<div class="pcm-empty pcm-contact-search-empty" data-contact-search-empty hidden><b>⌕</b><h2>Нет совпадений</h2><p>Попробуйте другой запрос.</p></div></div>`;
  }

  function locationOverview(book, location) {
    const people = linkedPeople(book, location.id);
    const unlinked = sortedEntries(book.entries.people.filter(person => !personLocationIds(person).includes(location.id)));
    const quests = linkedEntries(book, "quests", location.id);
    const clues = linkedEntries(book, "clues", location.id);
    const books = linkedEntries(book, "books", location.id);
    const sessions = linkedEntries(book, "sessions", location.id);
    const notes = linkedEntries(book, "notes", location.id);
    const personCard = person => `<div class="pcm-person-tile" data-entry-id="${person.id}">
      <button class="pcm-person-open" data-action="view-person" data-location-id="${location.id}"><span class="pcm-person-image">${person.image ? `<img src="${esc(person.image)}" alt="">` : "♟"}</span><span class="pcm-person-tile-copy"><b>${esc(person.title)}</b><small>${esc(person.attitude || "Неизвестно")}</small>${personCompactTags(person, { limit: 4 })}<em>${short(person.summary || person.quotes || person.content, 82)}</em></span></button>
      <button class="pcm-person-unlink" data-action="unlink-person" data-location-id="${location.id}" title="Убрать связь с этой локацией">×</button>
    </div>`;
    const personGroups = attitudeGroups(people).map(group => `<section class="pcm-location-attitude tone-${group.key}" data-location-attitude="${group.key}">
      <header><span><i>${group.icon}</i><b>${esc(group.label)}</b></span><em>${group.people.length}</em></header>
      <div class="pcm-people-grid">${group.people.map(personCard).join("")}</div>
    </section>`).join("");
    const related = (entries, icon, empty) => entries.length ? entries.map(item => `<button class="pcm-related-row" data-action="open-related" data-entry-id="${item.id}"><b>${icon}</b><span>${esc(item.title)}${item.headline ? `<em class="pcm-mini-headline">${esc(item.headline)}</em>` : ""}<small>${short(item.type === "books" ? `${clampPercent(item.decodingProgress)}% · ${decodingPhase(item.decodingProgress).label} · ${item.discoveries || item.nextStep || item.summary || item.content}` : item.summary || item.objective || item.theory || item.content, 90)}</small></span><i>→</i></button>`).join("") : `<p class="muted">${empty}</p>`;
    return `<div class="pcm-detail" data-entry-id="${location.id}">
      <div class="pcm-detail-nav"><button data-action="back-list" data-section="locations">← Все локации</button><div><button data-action="pin">${location.pinned ? "★ Закреплено" : "☆ Закрепить"}</button><button class="primary" data-action="edit-entry">✎ Изменить локацию</button></div></div>
      <section class="pcm-location-hero"><div class="pcm-location-hero-image">${location.image ? `<img src="${esc(location.image)}" alt="">` : "⌖"}</div><div><small>${esc([location.kind, location.region].filter(Boolean).join(" · ") || "ЛОКАЦИЯ")}</small><h1>${esc(location.title)}</h1>${location.headline ? `<h2 class="pcm-detail-headline">${esc(location.headline)}</h2>` : ""}<div class="pcm-badges"><span>${esc(location.status || "Без статуса")}</span>${location.firstVisited ? `<span>Первый визит: ${esc(location.firstVisited)}</span>` : ""}<span>♟ ${people.length} персонажей</span></div>${readText(location.summary, "Краткая заметка пока не добавлена.")}</div></section>
      <div class="pcm-detail-grid">
        <section class="pcm-detail-panel wide"><header><div><small>КТО ЗДЕСЬ ВСТРЕЧАЛСЯ</small><h2>♟ Контакты в этой точке</h2></div><div><button data-action="from-token-here">♟ Добавить выбранные токены</button><button class="primary" data-action="add-person-here">+ Вручную</button></div></header>
          <div class="pcm-location-attitudes">${personGroups || '<div class="pcm-inline-empty">Здесь пока никто не отмечен. Создайте персонажа или привяжите существующего.</div>'}</div>
          ${unlinked.length ? `<details class="pcm-link-existing"><summary><span class="pcm-link-existing-icon" aria-hidden="true">⛓</span><span><b>Привязать существующий контакт</b><small>Выбрать человека из уже сохранённых контактов</small></span><i aria-hidden="true">⌄</i></summary><div>${unlinked.map(person => `<button data-action="link-person" data-person-id="${person.id}"><span class="pcm-link-person-title">♟ ${esc(person.title)}<small>${esc(person.attitude || "Неизвестно")}</small></span>${personCompactTags(person, { limit: 3 })}</button>`).join("")}</div></details>` : ""}
        </section>
        <section class="pcm-detail-panel"><h3>О точке</h3>${readText(location.content)}${location.atmosphere ? `<h4>Атмосфера и приметы</h4>${readText(location.atmosphere)}` : ""}${location.dangers ? `<h4>Угрозы</h4>${readText(location.dangers)}` : ""}</section>
        <section class="pcm-detail-panel"><h3>Полезное</h3>${location.services ? `<h4>Услуги и ресурсы</h4>${readText(location.services)}` : '<p class="muted">Услуги и ресурсы не отмечены.</p>'}${location.travel ? `<h4>Как добраться</h4>${readText(location.travel)}` : ""}</section>
        <section class="pcm-detail-panel"><header><h3>▤ Заказы здесь</h3><button data-action="add-related-here" data-type="quests">+ Заказ</button></header>${related(quests, "▤", "Связанных заказов нет.")}</section>
        <section class="pcm-detail-panel"><header><h3>◈ Зацепки</h3><button data-action="add-related-here" data-type="clues">+ Зацепка</button></header>${related(clues, "◈", "Связанных зацепок нет.")}</section>
        <section class="pcm-detail-panel"><header><h3>⌑ Файлы и шифры</h3><button data-action="add-related-here" data-type="books">+ Файл</button></header>${related(books, "⌑", "Связанных файлов нет.")}</section>
        <section class="pcm-detail-panel"><header><h3>✒ Лог точки</h3><button data-action="add-related-here" data-type="sessions">+ Лог</button></header>${related(sessions, "✒", "Записей хроники здесь нет.")}</section>
        <section class="pcm-detail-panel"><header><h3>▧ Заметки о месте</h3><button data-action="add-related-here" data-type="notes">+ Заметка</button></header>${related(notes, "▧", "Связанных заметок нет.")}</section>
        ${readFragments(location)}
      </div>
    </div>`;
  }

  function personOverview(book, person) {
    const locations = personLocationIds(person).map(id => book.entries.locations.find(location => location.id === id)).filter(Boolean);
    const back = state.returnLocationId && book.entries.locations.some(location => location.id === state.returnLocationId) ? `<button data-action="back-location" data-location-id="${state.returnLocationId}">← Вернуться к точке</button>` : '<button data-action="back-list" data-section="people">← Все контакты</button>';
    const quickEdit = state.quickEditPersonId === person.id;
    const heroBody = quickEdit ? personQuickEditPanel(book, person) : `<div><small>КОНТАКТ</small><h1>${esc(person.title)}</h1>${person.headline ? `<h2 class="pcm-detail-headline">${esc(person.headline)}</h2>` : ""}<div class="pcm-badges"><span>${esc(person.attitude || "Неизвестно")}</span></div>${inlinePersonTags(book, person, { hero: true })}${readText(person.summary, "Краткая сводка пока не добавлена.")}</div>`;
    return `<div class="pcm-detail ${quickEdit ? "is-quick-edit" : ""}" data-entry-id="${person.id}"><div class="pcm-detail-nav">${back}<div><button data-action="open-chat-contact" data-person-id="${person.id}">✉ Сообщение</button><button data-action="pin">${person.pinned ? "★ Закреплено" : "☆ Закрепить"}</button><button class="primary" data-action="edit-entry">${quickEdit ? "✓ Готово" : "✎ Редактировать"}</button></div></div>
      <section class="pcm-person-hero"><div class="pcm-person-portrait">${person.image ? `<img src="${esc(person.image)}" alt="">` : "◉"}</div>${heroBody}</section>
      ${quickEdit ? "" : neuroContactPanel(person, book)}
      ${quickEdit ? "" : `<div class="pcm-detail-grid">${person.gallery.length ? `<section class="pcm-detail-panel wide"><h3>▧ Галерея</h3><div class="pcm-gallery-view">${person.gallery.map(item => `<button data-action="view-gallery-image" data-gallery-id="${item.id}"><img src="${esc(item.image)}" alt="${esc(item.caption)}"><span>${esc(item.caption || "Открыть изображение")}</span></button>`).join("")}</div></section>` : ""}
        <section class="pcm-detail-panel wide"><h3>⌖ Где встречали</h3><div class="pcm-location-chips">${locations.length ? locations.map(location => `<button data-action="view-location" data-location-id="${location.id}" data-entry-id="${location.id}">⌖ ${esc(location.title)}</button>`).join("") : '<span class="muted">Точки пока не связаны.</span>'}</div>${person.firstMet ? `<h4>Первая встреча</h4>${readText(person.firstMet)}` : ""}${person.lastSeen ? `<h4>Последняя встреча</h4>${readText(person.lastSeen)}` : ""}</section>
        ${personConnectionsPanel(person)}
        ${person.encounters?.length ? `<section class="pcm-detail-panel wide"><h3>◷ История встреч</h3><div class="pcm-encounters">${[...person.encounters].reverse().slice(0, 20).map(encounter => { const place = book.entries.locations.find(location => location.id === encounter.locationId); const date = String(encounter.at || "").slice(0, 10); return `<div><span><b>${esc(encounter.sceneName || place?.title || "Неизвестное место")}</b><small>${esc(date || "Без даты")}</small></span>${place ? `<button data-action="view-location" data-location-id="${place.id}" data-entry-id="${place.id}">Открыть</button>` : ""}</div>`; }).join("")}</div></section>` : ""}
        ${inlinePersonNote(person, "content", "Мои заметки", "Что важно помнить об этом человеке?", "▧")}
        ${inlinePersonNote(person, "quotes", "Что говорил", "Цитаты, обещания, имена, адреса, важные формулировки…", "❞")}
        ${inlinePersonNote(person, "promises", "Долги и договорённости", "Кто кому должен, что обещано и к какому сроку…", "◇")}
        ${inlinePersonNote(person, "secrets", "Подозрения", "Сомнения, несостыковки, скрытые мотивы и непроверенные версии…", "△")}
        ${person.relationship ? `<section class="pcm-detail-panel wide"><h3>Наша связь</h3>${readText(person.relationship)}</section>` : ""}${readFragments(person)}
      </div>`}</div>`;
  }

  function editorView(entry, book) {
    return `<div class="pcm-editor-view" data-entry-id="${entry.id}"><div class="pcm-detail-nav"><button data-action="back-editor">← Назад без закрытия</button><div><small>РЕДАКТИРОВАНИЕ</small><b>${esc(recordTitle(entry))}</b></div></div><section class="pcm-editor-card pcm-card">${editorBody(entry, book)}</section></div>`;
  }

  function openEntryEditor(entry) {
    state.previousView = viewSnapshot();
    state.viewMode = "edit";
    state.viewId = entry.id;
    state.openId = entry.id;
  }

  function inboxEntries(book) {
    return sortedEntries(Object.values(book.entries).flat().filter(entry => entry.inbox));
  }

  function inboxView(book) {
    const entries = inboxEntries(book);
    const rows = entries.map(entry => `<article class="pcm-inbox-row" data-entry-id="${entry.id}"><button data-action="open-inbox-entry"><b>${SECTIONS[entry.type].icon}</b><span><small>${esc(SECTIONS[entry.type].label)}</small><strong>${esc(recordTitle(entry))}</strong>${recordHeadline(entry) ? `<b class="pcm-mini-headline">${esc(entry.headline)}</b>` : ""}<em>${short(entry.summary || entry.content || "Без текста", 110)}</em></span></button><button class="primary" data-action="resolve-inbox" title="Убрать из разбора">✓ Готово</button></article>`).join("");
    return `<div class="pcm-section-head"><div><small>${entries.length} НЕОБРАБОТАННЫХ</small><h1>☑ Разобрать после игры</h1></div><div><button data-action="resolve-all-inbox" ${entries.length ? "" : "disabled"}>Отметить всё готовым</button></div></div>
      <p class="pcm-section-hint">Сюда попадают быстрые записи. Откройте запись, уточните название или связи, затем нажмите «Готово». Данные никуда не перемещаются и не теряются.</p>
      <div class="pcm-inbox-list">${rows || '<div class="pcm-empty"><b>✓</b><h2>Всё разобрано</h2><p>Быстрых необработанных записей нет.</p><button data-action="nav" data-section="dashboard">Вернуться на обзор</button></div>'}</div>`;
  }

  function cityMapView(book) {
    const map = book.cityMap ?? (book.cityMap = { title: "Карта Найт-Сити", image: "", notes: "" });
    const zoom = Math.min(2.5, Math.max(0.35, Number(state.mapZoom) || 1));
    return `<div class="pcm-city-map-view"><div class="pcm-section-head"><div><small>ОРИЕНТАЦИЯ ПО ГОРОДУ</small><h1>⌖ ${esc(map.title || "Карта Найт-Сити")}</h1></div><div><button data-action="map-zoom-out" ${map.image ? "" : "disabled"}>−</button><button data-action="map-zoom-reset" ${map.image ? "" : "disabled"}>${Math.round(zoom * 100)}%</button><button data-action="map-zoom-in" ${map.image ? "" : "disabled"}>+</button><button data-action="pick-city-map">Выбрать карту</button></div></div>
      ${map.image ? `<div class="pcm-city-map-canvas"><img src="${esc(map.image)}" alt="Карта Найт-Сити" style="width:${Math.round(zoom * 100)}%;max-width:none;max-height:none"></div><div class="pcm-map-actions"><button class="danger" data-action="clear-city-map">Убрать изображение</button><span>Карта хранится отдельно для выбранного персонажа.</span></div>` : `<div class="pcm-city-map-empty" data-paste-target="city-map" tabindex="0"><b>⌖</b><h2>Добавьте свою карту Найт-Сити</h2><p>Выберите файл Foundry или щёлкните сюда и вставьте изображение через <b>Ctrl+V</b>.</p><button class="primary" data-action="pick-city-map">Выбрать изображение</button></div>`}
      <label class="pcm-field area pcm-map-notes"><span>Ориентиры и пометки</span><textarea data-city-map-notes data-autogrow placeholder="Районы, безопасные маршруты, места встреч…">${esc(map.notes || "")}</textarea></label></div>`;
  }

  function subscriptionDays(entry) {
    return Math.max(0, Math.round(Number(entry.remainingDays) || 0));
  }

  function subscriptionTerm(entry) {
    return Math.max(1, Math.round(Number(entry.termDays) || 30));
  }

  function subscriptionPrice(entry) {
    const value = String(entry.price ?? "").trim();
    const currency = String(entry.currency ?? "€$").trim();
    return value ? `${value} ${currency}`.trim() : "Цена не указана";
  }

  function subscriptionCard(entry, compact = false) {
    const days = subscriptionDays(entry);
    const term = subscriptionTerm(entry);
    const expired = days <= 0 || entry.status === "Истекла";
    return `<article class="pcm-subscription-card ${expired ? "expired" : ""} ${compact ? "compact" : ""}" data-entry-id="${entry.id}">
      <div class="pcm-subscription-brand"><div class="pcm-subscription-icon">${entry.image ? `<img src="${esc(entry.image)}" alt="">` : "▦"}</div><span><small>${esc(entry.provider || "СЕРВИС")}</small><strong>${esc(recordTitle(entry))}</strong><em>${esc(entry.plan || entry.status || "Активная подписка")}</em></span></div>
      <div class="pcm-subscription-meter"><span><small>ОСТАЛОСЬ</small><b>${days}</b><i>дн.</i></span><span><small>СРОК</small><b>${term}</b><i>дн.</i></span><span><small>ЦЕНА</small><b class="price">${esc(subscriptionPrice(entry))}</b></span></div>
      ${compact ? "" : `<p>${esc(entry.summary || entry.renewalNote || "Без дополнительных условий.")}</p>`}
      <div class="pcm-subscription-actions"><button data-action="subscription-day-minus" ${days <= 0 ? "disabled" : ""}>−1 день</button><button class="primary" data-action="subscription-renew">Продлить +${term}</button><button data-action="open-entry" data-entry-id="${entry.id}" data-section="subscriptions">Открыть</button></div>
    </article>`;
  }

  function subscriptionsView(book) {
    const entries = sortedEntries(book.entries.subscriptions);
    return `<div class="pcm-section-head"><div><small>${entries.length} АКТИВНЫХ СЕРВИСОВ</small><h1>▦ Подписки</h1></div><div><button class="primary" data-action="add" data-section="subscriptions">+ Подписка</button></div></div>
      <p class="pcm-section-hint">Trauma Team, страхование, охрана, NET-сервисы и любые регулярные услуги. День списывается вручную, продление добавляет полный срок к оставшимся дням.</p>
      <div class="pcm-subscription-list">${entries.length ? entries.map(entry => subscriptionCard(entry)).join("") : `<div class="pcm-empty"><b>▦</b><h2>Активных подписок нет</h2><p>Добавьте Trauma Team или другой сервис, чтобы видеть цену и оставшийся срок одним взглядом.</p><button class="primary" data-action="add" data-section="subscriptions">Добавить подписку</button></div>`}</div>`;
  }


  function detailValue(label, value, { wide = false } = {}) {
    if ( value === undefined || value === null || String(value).trim() === "" ) return "";
    return `<section class="pcm-detail-panel ${wide ? "wide" : ""}"><h3>${esc(label)}</h3>${readText(String(value))}</section>`;
  }

  function linkedDirectoryContacts(book, entry) {
    if ( !DIRECTORY_TYPES.has(entry.type) ) return [];
    const type = sectionContactType(entry.type);
    if ( !CONTACT_TYPE_META[type] ) return [];
    return contactsForGroup(book, type, entry.title);
  }

  function recordExtraPanel(title, rows, { code = "DATA / AUX" } = {}) {
    const valid = rows.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
    if ( !valid.length ) return "";
    return `<section class="pcm-record-side-panel pcm-record-extra-panel"><header><small>${esc(code)}</small><h3>${esc(title)}</h3></header>
      <div class="pcm-record-extra-grid">${valid.map(([label, value, tone = "cyan"]) => `<div class="pcm-record-extra-row ${tone}"><small>${esc(label)}</small><b>${esc(String(value))}</b></div>`).join("")}</div>
    </section>`;
  }

  function entryTypeSidePanels(book, entry) {
    if ( entry.type === "notes" ) {
      return recordExtraPanel("КАТЕГОРИЯ", [["ТИП ЗАМЕТКИ", entry.category || "Общее", "red"]], { code: "DATA / CLASS" });
    }
    if ( entry.type === "subscriptions" ) {
      return recordExtraPanel("СЕРВИСНЫЙ ПРОФИЛЬ", [
        ["ЦЕНА", [entry.price, entry.currency].filter(Boolean).join(" ")],
        ["ПОЛНЫЙ СРОК", `${subscriptionTerm(entry)} дн.`],
        ["ОСТАЛОСЬ", `${subscriptionDays(entry)} дн.`, subscriptionDays(entry) <= 5 ? "red" : "cyan"]
      ], { code: "SERVICE / BILLING" });
    }
    if ( entry.type === "quests" ) {
      return recordExtraPanel("КОНТРАКТ", [
        ["ОПЛАТА / ВЫГОДА", entry.reward],
        ["СЛЕДУЮЩИЙ ШАГ", entry.nextStep]
      ], { code: "JOB / ROUTE" });
    }
    if ( entry.type === "books" ) {
      const helper = book.entries.people.find(item => item.id === entry.helperId);
      return recordExtraPanel("ДОСТУП К ФАЙЛУ", [
        ["ИСТОЧНИК", entry.author],
        ["ПОМОГАЕТ", helper?.title || ""],
        ["ПРОГРЕСС", `${clampPercent(entry.decodingProgress)}% · ${decodingPhase(entry.decodingProgress).label}`]
      ], { code: "ICE / ACCESS" });
    }
    if ( entry.type === "sessions" ) {
      return recordExtraPanel("СЕССИЯ", [
        ["ДАТА ИГРЫ", entry.realDate],
        ["ДАТА В МИРЕ", entry.gameDate]
      ], { code: "LOG / SESSION" });
    }
    return "";
  }

  function entryTypeWidePanels(book, entry) {
    const locations = entryLocationIds(entry).map(id => book.entries.locations.find(location => location.id === id)).filter(Boolean);
    const locationPanel = locations.length ? `<section class="pcm-detail-panel wide"><h3>⌖ Связанные точки</h3><div class="pcm-location-chips">${locations.map(location => `<button data-action="view-location" data-location-id="${location.id}">⌖ ${esc(location.title)}</button>`).join("")}</div></section>` : "";

    if ( entry.type === "corporations" ) return `${detailValue("Публичная маска", entry.publicFace, {wide:true})}`;
    if ( entry.type === "fixers" ) return `${detailValue("Текущие дела", entry.currentDeals, {wide:true})}`;
    if ( entry.type === "subscriptions" ) return `${detailValue("Условия продления", entry.renewalNote, {wide:true})}`;
    if ( entry.type === "quests" ) {
      const tasks = entry.tasks?.length ? `<section class="pcm-detail-panel wide"><h3>☑ Этапы</h3><div class="pcm-read-tasks">${entry.tasks.map(task => `<div class="${task.done ? "done" : ""}"><b>${task.done ? "✓" : "○"}</b><span>${esc(task.text || "Без названия")}</span></div>`).join("")}</div></section>` : "";
      return `${detailValue("Что нужно сделать", entry.objective, {wide:true})}${tasks}${locationPanel}`;
    }
    if ( entry.type === "clues" ) {
      return `${detailValue("Версия", entry.theory, {wide:true})}${detailValue("Что подтвердилось", entry.conclusion, {wide:true})}${locationPanel}`;
    }
    if ( entry.type === "books" ) {
      const stages = entry.decodeStages?.length ? `<section class="pcm-detail-panel wide"><h3>⌑ Этапы расшифровки</h3><div class="pcm-read-tasks">${entry.decodeStages.map(stage => `<div class="${stage.done ? "done" : ""}"><b>${stage.done ? "✓" : "○"}</b><span>${esc(stage.text || "Без названия")}</span></div>`).join("")}</div></section>` : "";
      return `${detailValue("Ключи и доступ", entry.decodingKey, {wide:true})}${detailValue("Метод взлома", entry.method, {wide:true})}${detailValue("Что уже извлечено", entry.discoveries, {wide:true})}${detailValue("Следующий шаг", entry.nextStep, {wide:true})}${stages}${locationPanel}`;
    }
    if ( entry.type === "sessions" ) {
      return `${detailValue("Участники", entry.participants, {wide:true})}${detailValue("Что произошло", entry.events, {wide:true})}${detailValue("Решения и последствия", entry.decisions, {wide:true})}${detailValue("Добыча и расходы", entry.loot, {wide:true})}${detailValue("К следующей игре", entry.nextTime, {wide:true})}${locationPanel}`;
    }
    if ( entry.type === "notes" ) return locationPanel;
    return "";
  }

  function directoryContactsPanel(book, entry) {
    if ( !DIRECTORY_TYPES.has(entry.type) ) return "";
    const type = sectionContactType(entry.type);
    const meta = CONTACT_TYPE_META[type];
    if ( !meta ) return "";
    const linked = linkedDirectoryContacts(book, entry);
    const candidates = sortedEntries(book.entries.people.filter(person => person.id && !linked.some(item => item.id === person.id)));
    return `<section class="pcm-detail-panel wide pcm-directory-contacts" data-contact-drop="directory" data-directory-type="${entry.type}" data-directory-id="${entry.id}">
      <header><div><small>ПРИВЯЗАННЫЕ ЛЮДИ</small><h2>${meta.icon} Контакты</h2></div><em>${linked.length}</em></header>
      <div class="pcm-directory-bind-row">${contactBindControls(sectionContactType(entry.type), entry.title, { directoryType: entry.type, directoryId: entry.id })}<small>Добавление только создаёт эту связь. Другие категории и фракции контакта сохраняются.</small></div>
      <div class="pcm-contact-list">${linked.length ? linked.map(person => personListCard(person, book, { unlinkDirectory: entry })).join("") : '<div class="pcm-inline-empty">Привязанных контактов пока нет.</div>'}</div>
      ${candidates.length ? `<details class="pcm-link-existing"><summary><span class="pcm-link-existing-icon" aria-hidden="true">⛓</span><span><b>Привязать существующий контакт</b><small>Добавить человека из общей базы, не меняя остальные связи</small></span><i aria-hidden="true">⌄</i></summary><div>${candidates.slice(0,80).map(person => `<button data-action="link-contact-directory" data-person-id="${person.id}" data-directory-type="${entry.type}" data-directory-id="${entry.id}"><span class="pcm-link-person-title">◉ ${esc(person.title)}<small>${esc(person.attitude || "Неизвестно")}</small></span>${personCompactTags(person, { limit: 3 })}</button>`).join("")}</div></details>` : ""}
    </section>`;
  }

  function entrySystemMeta(book, entry) {
    const section = SECTIONS[entry.type];
    const tags = String(entry.tags || "").split(",").map(tag => tag.trim()).filter(Boolean);
    const locationIds = entryLocationIds(entry);
    const created = String(entry.createdAt || "").slice(0, 16).replace("T", " ");
    const updated = String(entry.updatedAt || "").slice(0, 16).replace("T", " ");
    const meta = [
      ["ТИП ДАННЫХ", section?.label || entry.type || "Запись", "cyan"],
      ["ID ЗАПИСИ", String(entry.id || "—").slice(-12).toUpperCase(), "muted"],
      ["ЗАКРЕПЛЕНО", entry.pinned ? "ДА" : "НЕТ", entry.pinned ? "red" : "muted"],
      ["СОЗДАНО", created || "—", "muted"],
      ["ОБНОВЛЕНО", updated || "—", "cyan"],
      ["СВЯЗАННЫЕ ТОЧКИ", String(locationIds.length), locationIds.length ? "cyan" : "muted"],
      ["ТЕГИ", String(tags.length), tags.length ? "cyan" : "muted"],
      ["ФРАГМЕНТЫ", String(entry.fragments?.length || 0), entry.fragments?.length ? "red" : "muted"]
    ];
    const add = (label, value, tone = "cyan") => {
      if ( value === undefined || value === null || String(value).trim() === "" ) return;
      meta.push([label, String(value), tone]);
    };
    if ( entry.type === "gangs" ) { add("ОПАСНОСТЬ", entry.danger, "red"); add("ОТНОШЕНИЕ", entry.attitude); add("АГРЕССИВНОСТЬ", entry.aggression, "red"); }
    if ( entry.type === "corporations" ) { add("УГРОЗА", entry.danger, "red"); add("ОТНОШЕНИЕ", entry.attitude); add("ПОЗИЦИЯ", entry.posture); }
    if ( entry.type === "fixers" ) { add("РАЙОН", entry.district); add("РЕПУТАЦИЯ", entry.reputation); add("ОТНОШЕНИЕ", entry.attitude); }
    if ( entry.type === "rippers" ) { add("КЛИНИКА", entry.clinic); add("СПЕЦИАЛИЗАЦИЯ", entry.specialty); add("ДОВЕРИЕ", entry.trust); }
    if ( entry.type === "subscriptions" ) { add("СЕРВИС", entry.provider); add("ТАРИФ", entry.plan); add("СТАТУС", entry.status); add("ОСТАЛОСЬ", `${subscriptionDays(entry)} дн.`, subscriptionDays(entry) <= 5 ? "red" : "cyan"); }
    if ( entry.type === "quests" ) {
      const giver = book.entries.people.find(person => person.id === entry.giverId);
      add("СТАТУС", entry.status, "red"); add("ЗАКАЗЧИК", giver?.title || ""); add("ДЕДЛАЙН", entry.deadline, "red");
      add("ЭТАПЫ", `${entry.tasks?.filter(task => task.done).length || 0}/${entry.tasks?.length || 0}`);
    }
    if ( entry.type === "clues" ) {
      const person = book.entries.people.find(item => item.id === entry.personId);
      add("СТАТУС", entry.status, "red"); add("ИСТОЧНИК", entry.source); add("КОНТАКТ", person?.title || "");
    }
    if ( entry.type === "books" ) {
      add("СОСТОЯНИЕ", entry.status, "red"); add("ФОРМАТ", entry.language); add("ЗАЩИТА", entry.cipher, "red");
      add("ВЗЛОМ", `${clampPercent(entry.decodingProgress)}%`, clampPercent(entry.decodingProgress) < 100 ? "cyan" : "red");
    }
    if ( entry.type === "sessions" ) { add("ДАТА", entry.realDate); add("ДАТА В МИРЕ", entry.gameDate); }
    if ( DIRECTORY_TYPES.has(entry.type) ) add("СВЯЗАННЫЕ КОНТАКТЫ", String(linkedDirectoryContacts(book, entry).length));
    return meta;
  }

  function recordMetaCells(book, entry) {
    return entrySystemMeta(book, entry).map(([label, value, tone]) => `<div class="pcm-record-stat ${tone || "cyan"}"><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("");
  }

  function recordNetworkPanel(book, entry) {
    const tags = String(entry.tags || "").split(",").map(tag => tag.trim()).filter(Boolean);
    const locations = entryLocationIds(entry).map(id => book.entries.locations.find(location => location.id === id)).filter(Boolean);
    const fragmentCount = entry.fragments?.length || 0;
    const linkedContacts = DIRECTORY_TYPES.has(entry.type) ? linkedDirectoryContacts(book, entry) : [];
    const taskCount = entry.tasks?.length || 0;
    const stageCount = entry.decodeStages?.length || 0;
    const hasLinks = tags.length || locations.length || fragmentCount || linkedContacts.length || taskCount || stageCount;
    return `<section class="pcm-record-side-panel pcm-record-network"><header><small>LINK / NODE</small><h3>СЕТЕВЫЕ СВЯЗИ</h3></header>
      ${hasLinks ? `<div class="pcm-record-link-counters">
        ${locations.length ? `<span><b>${locations.length}</b><small>ТОЧКИ</small></span>` : ""}
        ${tags.length ? `<span><b>${tags.length}</b><small>ТЕГИ</small></span>` : ""}
        ${fragmentCount ? `<span><b>${fragmentCount}</b><small>ФРАГМЕНТЫ</small></span>` : ""}
        ${linkedContacts.length ? `<span><b>${linkedContacts.length}</b><small>КОНТАКТЫ</small></span>` : ""}
        ${taskCount ? `<span><b>${taskCount}</b><small>ЭТАПЫ</small></span>` : ""}
        ${stageCount ? `<span><b>${stageCount}</b><small>СЛОИ</small></span>` : ""}
      </div>` : `<div class="pcm-record-network-empty">НЕТ АКТИВНЫХ СВЯЗЕЙ</div>`}
      ${locations.length ? `<div class="pcm-record-links">${locations.slice(0, 8).map(location => `<button data-action="view-location" data-location-id="${location.id}">⌖ ${esc(location.title)}</button>`).join("")}</div>` : ""}
      ${tags.length ? `<div class="pcm-record-tags">${tags.slice(0, 12).map(tag => `<span>#${esc(tag)}</span>`).join("")}</div>` : ""}
    </section>`;
  }

  function entryOverview(book, entry) {
    const section = SECTIONS[entry.type];
    const quick = DIRECTORY_TYPES.has(entry.type) ? entry.quickNotes : "";
    const image = entry.image ? `<div class="pcm-record-avatar"><img src="${esc(entry.image)}" alt=""></div>` : `<div class="pcm-record-avatar placeholder">${section?.icon || "▧"}</div>`;
    const shortId = String(entry.id || "DATA").slice(-10).toUpperCase();
    const updated = String(entry.updatedAt || "").slice(0, 16).replace("T", " ") || "—";
    const subscriptionActions = entry.type === "subscriptions" ? `<div class="pcm-subscription-actions pcm-detail-actions"><button data-action="subscription-day-minus" ${subscriptionDays(entry) <= 0 ? "disabled" : ""}>−1 день</button><button class="primary" data-action="subscription-renew">Продлить +${subscriptionTerm(entry)}</button></div>` : "";
    const mainRecord = entry.content ? readText(entry.content) : '<p class="pcm-record-empty-text">Основная запись пока не заполнена.</p>';
    return `<div class="pcm-detail pcm-record-console" data-entry-id="${entry.id}">
      <div class="pcm-detail-nav"><button data-action="back-list" data-section="${entry.type}">← ${esc(section?.label || "Назад")}</button><div><button data-action="pin">${entry.pinned ? "★ Закреплено" : "☆ Закрепить"}</button><button class="primary" data-action="edit-entry">✎ Редактировать</button></div></div>
      <section class="pcm-record-systembar"><div><small>DATA NODE // ${esc(String(entry.type || "record").toUpperCase())}</small><b>${esc(section?.label || "ЗАПИСЬ")}</b></div><span><small>ID</small><b>${esc(shortId)}</b></span><span><small>ОБНОВЛЕНО</small><b>${esc(updated)}</b></span><i>${entry.pinned ? "PIN / ON" : "PIN / OFF"}</i></section>
      <section class="pcm-record-titlebar">${image}<div class="pcm-record-titlecopy"><small>${esc(section?.label || "ЗАПИСЬ")} // ПОЛЕВОЙ АРХИВ</small><h1>${esc(recordTitle(entry))}</h1>${recordHeadline(entry) ? `<h2>${esc(recordHeadline(entry))}</h2>` : ""}${readText(entry.summary, "Краткая сводка пока не добавлена.")}${quick ? `<blockquote class="pcm-quick-read">${esc(quick).replaceAll("\n","<br>")}</blockquote>` : ""}${subscriptionActions}</div></section>
      <div class="pcm-record-matrix">
        <section class="pcm-record-primary pcm-record-primary-full"><header><small>DATA / PRIMARY</small><h3>ОСНОВНАЯ ЗАПИСЬ</h3><i>READ ACCESS</i></header><div class="pcm-record-primary-body">${mainRecord}</div></section>
        <div class="pcm-record-lower-grid">
          <div class="pcm-detail-grid pcm-data-panels pcm-record-wide-data">${entryTypeWidePanels(book, entry)}${directoryContactsPanel(book, entry)}${readFragments(entry)}</div>
          <aside class="pcm-record-side">
            <section class="pcm-record-side-panel"><header><small>SYS / META</small><h3>МЕТАДАННЫЕ</h3></header><div class="pcm-record-stats">${recordMetaCells(book, entry)}</div></section>
            ${recordNetworkPanel(book, entry)}
            ${entryTypeSidePanels(book, entry)}
          </aside>
        </div>
      </div>
    </div>`;
  }

  function sectionView(book, key) {
    if ( key === "inbox" && state.viewMode === "list" ) return inboxView(book);
    if ( state.viewMode === "edit" ) {
      const entry = entryById(state.viewId);
      if ( entry ) return editorView(entry, book);
      resetView(key);
    }
    if ( state.viewMode === "location" ) {
      const location = book.entries.locations.find(entry => entry.id === state.viewId);
      if ( location ) return locationOverview(book, location);
      resetView("locations");
    }
    if ( state.viewMode === "person" ) {
      const person = book.entries.people.find(entry => entry.id === state.viewId);
      if ( person ) return personOverview(book, person);
      resetView(key);
    }
    if ( state.viewMode === "entry" ) {
      const entry = entryById(state.viewId);
      if ( entry ) return entryOverview(book, entry);
      resetView(key);
    }
    if ( key === "gm-neuro" ) {
      if ( game.user?.isGM ) return gmNeuroView();
      resetView("dashboard");
      return dashboard(book);
    }
    if ( key === "citymap" ) return cityMapView(book);
    if ( key === "subscriptions" ) return subscriptionsView(book);
    if ( DIRECTORY_TYPES.has(key) ) return directoryListView(book, key);
    if ( VIRTUAL_CONTACT_SECTIONS.has(key) ) return virtualContactListView(book, key);
    if ( key === "locations" ) return locationListView(book);
    if ( key === "people" ) return peopleListView(book);

    const section = SECTIONS[key];
    const entries = sortedEntries(book.entries[key]);
    return `<div class="pcm-section-head"><div><small>${entries.length} ЗАПИСЕЙ</small><h1>${section.icon} ${section.label}</h1></div><div><button class="primary" data-action="add" data-section="${key}">+ Добавить</button></div></div>
      <div class="pcm-list">${entries.length ? entries.map(entry => card(entry, book)).join("") : `<div class="pcm-empty"><b>${section.icon}</b><h2>Здесь пока тихо</h2><p>Добавьте ${section.one}.</p><button class="primary" data-action="add" data-section="${key}">Создать запись</button></div>`}</div>`;
  }

  function nav(key, label, icon, count = null) {
    const contactType = key === "people" ? "" : sectionContactType(key);
    const drop = key === "people" || contactType ? ` data-contact-drop="category" data-contact-type="${esc(contactType)}"` : "";
    const extraClass = key === "gangs" ? " pcm-nav-gangs" : "";
    return `<button class="${state.section === key ? "active" : ""}${extraClass}" data-action="nav" data-section="${key}" title="${esc(label)}" aria-label="${esc(label)}"${drop}><b>${icon}</b><span>${label}</span>${count !== null ? `<i>${count}</i>` : ""}</button>`;
  }

  function themePanel(book) {
    if ( !state.settingsOpen ) return "";
    const theme = bookAppearance(book);
    const currentGroup = THEME_PRESETS[theme.preset]?.group ?? "network";
    const color = (label, field) => `<label class="pcm-theme-color"><span>${esc(label)}</span><input type="color" data-theme-field="${field}" value="${esc(theme[field])}"></label>`;
    const groups = Object.entries(THEME_GROUPS).map(([groupKey, group]) => {
      const presets = Object.entries(THEME_PRESETS).filter(([, preset]) => preset.group === groupKey);
      return `<details class="pcm-theme-group" ${currentGroup === groupKey ? "open" : ""}><summary><span><b>${group.icon}</b><strong>${esc(group.label)}</strong><small>${esc(group.hint)}</small></span><i>${presets.length}</i></summary><div class="pcm-theme-presets">${presets.map(([key, preset]) => `<button class="${theme.preset === key ? "active" : ""}" data-action="theme-preset" data-preset="${key}" title="${esc(preset.label)}"><i class="pcm-theme-swatch" style="--swatch-bg:${preset.background};--swatch-panel:${preset.panel};--swatch-accent:${preset.accent};--swatch-secondary:${preset.secondary}"></i><span>${esc(preset.label)}</span></button>`).join("")}</div></details>`;
    }).join("");
    return `<div class="pcm-modal-backdrop"><section class="pcm-theme-panel" role="dialog" aria-label="Оформление архива"><header><div><small>NETRUNNER // 30 СЕТЕВЫХ ПРОФИЛЕЙ</small><h2>Внешний вид</h2><p>Темы теперь меняют не только палитру, но и характер HUD: цвет узлов, трассировки, предупреждений, свечение и скорость сетевой активности.</p></div><button data-action="close-appearance">×</button></header>
      <div class="pcm-theme-groups">${groups}</div>
      <div class="pcm-interface-controls"><label><span>Оболочка</span><select data-theme-field="shell">${opt("datapad", theme.shell, "DATAPAD — металлический планшет")}${opt("flat", theme.shell, "Плоский интерфейс")}</select><small>DATAPAD добавляет физический корпус, утопленный экран и аппаратные индикаторы, не меняя структуру данных.</small></label><label><span>Динамика интерфейса</span><select data-theme-field="effects">${opt("off", theme.effects, "Минимум")}${opt("soft", theme.effects, "Живой HUD")}${opt("vivid", theme.effects, "Максимум")}</select><small>Управляет скан-линиями, бегущими индикаторами, пульсацией активных узлов, подсветкой корпуса и HUD-анимациями.</small></label></div>
      <div class="pcm-theme-sliders"><label><span>Размер текста <b data-font-size-output>${theme.fontSize}px</b></span><input type="range" min="13" max="20" step="1" data-theme-field="fontSize" value="${theme.fontSize}"></label><label><span>Плотность</span><select data-theme-field="density">${opt("compact", theme.density, "Компактно")}${opt("comfortable", theme.density, "Удобно")}${opt("spacious", theme.density, "Просторно")}</select></label><label><span>Прозрачность окна <b data-opacity-output>${Math.round(theme.opacity*100)}%</b></span><input type="range" min="90" max="100" step="1" data-theme-field="opacity" value="${Math.round(theme.opacity*100)}"></label></div>
      <details class="pcm-theme-advanced"><summary>Точная настройка цветов</summary><div class="pcm-theme-grid">${color("Фон", "background")}${color("Панели", "panel")}${color("Текст", "text")}${color("Вторичный текст", "muted")}${color("Акцент", "accent")}${color("Дополнительный", "secondary")}</div></details>
      <footer><button data-action="theme-reset">Сбросить</button><button class="primary" data-action="close-appearance">Готово</button></footer></section></div>`;
  }

  function helpPanel() {
    if ( !state.helpOpen ) return "";
    const faq = (title, body, open = false) => `<details class="pcm-help-faq" ${open ? "open" : ""}><summary>${title}</summary><div>${body}</div></details>`;
    return `<div class="pcm-modal-backdrop"><section class="pcm-help-panel" role="dialog" aria-label="FAQ и инструкция"><header><div><small>NC://DATAPAD // FAQ</small><h2>Инструкция по каждому разделу</h2><p>Главное правило архива: существующую запись сначала читаем. Редактор открывается только по явной кнопке «Редактировать».</p></div><button data-action="close-help">×</button></header>
      <div class="pcm-help-start"><h3>Быстрый старт за 20 секунд</h3><ol><li>Выберите NPC на сцене и нажмите <b>Запомнить</b> или <b>Ctrl+Shift+M</b>.</li><li>Архив сохранит только имя, изображение и место встречи.</li><li>Откройте контакт — это сразу его досье, а не форма редактирования.</li><li>Пишите заметки прямо в четырёх полях досье; они сохраняются автоматически.</li><li>Для изменения имени, тегов, связей или изображений нажмите <b>Редактировать</b>.</li></ol></div>
      <div class="pcm-help-columns">
        <section><h3>Люди и силы</h3>
          ${faq("◉ Контакты", `<p><b>Что здесь:</b> только люди без категории. Клик по карточке всегда открывает досье.</p><p><b>Категории:</b> контакт может иметь несколько одновременно: например Банда + Корпорат + Законник. Добавление новой категории сохраняет остальные категории и не создаёт копию человека.</p><p><b>Сообщение:</b> конверт на карточке открывает отправку именно по этому контакту.</p>`, true)}
          ${faq("✦ Банды", `<p><b>Досье банды:</b> опасность, отношение к группе, агрессивность и быстрая заметка.</p><p><b>Самый быстрый путь:</b> выделите токен на сцене и в «Бандах» нажмите «Добавить выбранное». Для конкретной банды откройте её досье и сделайте то же самое — категория и название банды назначатся автоматически.</p><p><b>Важно:</b> привязка к банде добавляется поверх остальных связей. Например Tyger Claws не удалит Militech или NCPD.</p>`)}
          ${faq("▰ Корпорации", `<p><b>Досье:</b> угроза, отношение, текущая позиция, публичная маска.</p><p><b>Привязка:</b> выберите токен и нажмите «Добавить выбранное» либо выберите уже сохранённого человека. Он получит «Корпорат» и конкретную корпорацию, сохранив все остальные категории.</p>`)}
          ${faq("◆ Фиксеры", `<p><b>Досье:</b> район, репутация, отношение и текущие дела.</p><p><b>Перетаскивание:</b> контакт можно бросить на раздел или прямо на конкретного фиксера. Во втором случае заполняется связь с этим фиксером.</p>`)}
          ${faq("✚ Риперы", `<p><b>Досье:</b> клиника, специализация, доверие и отношение.</p><p><b>Привязка:</b> перетаскивание на рипера помечает контакт как связанного с ним.</p>`)}
          ${faq("⚖ Законники", `<p><b>Главная логика:</b> Законники — категория, а NCPD, MaxTac и другие — группы внутри неё.</p><p><b>Добавление:</b> если токен выбран на сцене, кнопка «Добавить выбранное» сразу присвоит категорию. В блоке NCPD / MaxTac та же кнопка сразу добавит и конкретную группу.</p><p>Один контакт может быть одновременно Законником, Корпоратом, Фиксером и т. д. Drag & Drop остаётся только дополнительным способом.</p>`)}
          ${faq("⌁ Ноосфера", `<p>Категория цифровых/NET-контактов. Внутри создавайте группы NetWatch, локальные NET-команды, инфоброкеров и т. п. Добавление в Ноосферу не снимает другие категории; добавление в конкретную группу автоматически сохраняет и категорию, и её название.</p>`)}
          ${faq("⌂ Кочевники", `<p>Категория кочевников. Создайте кланы вроде Aldecaldos или собственные семьи и добавляйте людей прямо внутрь. Связь добавляется поверх уже существующих — один человек хранится один раз и может отображаться сразу в нескольких разделах.</p>`)}
        </section>
        <section><h3>Сервисы, город и дела</h3>
          ${faq("▦ Подписки", `<p>Trauma Team, страховка, охрана и любые регулярные сервисы. На карточке сразу видны цена, полный срок и остаток дней.</p><p><b>−1 день</b> списывает один день. <b>Продлить</b> добавляет полный срок к уже оставшимся дням. Кнопка «Открыть» показывает карточку просмотра; редактирование доступно уже из неё.</p>`)}
          ${faq("⌖ Карта Найт-Сити", `<p>Отдельная постоянная карта города. Загрузите изображение или вставьте через Ctrl+V, затем используйте масштаб и поле ориентиров.</p>`)}
          ${faq("⌖ Точки", `<p>Точки — бары, клиники, офисы, квартиры и любые места. Клик по точке открывает общий лист просмотра: контакты, связанные заказы, зацепки, файлы, лог и заметки. Изменение полей — только через «Редактировать».</p>`)}
          ${faq("▤ Заказы", `<p>Клик открывает лист просмотра со статусом, заказчиком, целью, оплатой, дедлайном, этапами и связанными точками. Для изменения нажмите «Редактировать».</p>`)}
          ${faq("◇ Зацепки", `<p>Сначала открывается карточка чтения: источник, связанный контакт, версия, подтверждения и места. Редактор не разворачивается сам.</p>`)}
          ${faq("▣ Файлы и шифры", `<p>У каждой записи есть отдельные «Название» и «Заголовок / тема». В списке сначала показываются они, а содержимое идёт только как превью. Карточка просмотра показывает источник, формат, защиту, прогресс расшифровки, этапы и найденные данные. Только после «Редактировать» появляются поля ввода.</p>`)}
          ${faq("◷ Лог сессий", `<p>Обычный режим — чтение итогов сессии: даты, события, решения, добыча и подготовка к следующей игре. Правка — отдельной кнопкой.</p>`)}
          ${faq("▧ Заметки", `<p>Клик по заметке сначала показывает готовый лист с текстом, категорией, тегами и связанными точками. Новая заметка сразу открывает редактор, потому что её ещё нужно заполнить.</p>`)}
        </section>
        <section><h3>Общие инструменты</h3>
          ${faq("✓ Разобрать", `<p>Список быстрых записей после игры. Нажатие сначала открывает просмотр записи. Если нужно уточнение — уже из просмотра нажмите «Редактировать». «Готово» только снимает отметку разбора и ничего не удаляет.</p>`)}
          ${faq("✉ Сообщения", `<p>Токен выбирать не нужно. Выберите контакт из списка или нажмите конверт на его карточке.</p><p>Режимы: <b>лично владельцу Actor</b>, <b>только GM</b> или <b>публично</b>. В карточку сообщения автоматически добавляются собственные категории/фракции контакта, отношение, отдельные связи (знакомая банда/корпорация, его фиксер/рипер) и пользовательские теги. Поля связей не превращают персонажа в фикcера, рипера или участника фракции. Галочками можно добавить изображение и быструю сводку.</p>`)}
          ${faq("⌕ Поиск", `<p><b>Ctrl+K</b> ищет сразу по всему архиву. Результат открывается в режиме чтения — так же, как если бы вы нашли его вручную в разделе.</p>`)}
          ${faq("◎ Запомнить", `<p>Использует цели Foundry, а если целей нет — выделенные токены. Из NPC читаются только имя и изображение; текущая сцена становится местом встречи. Уровень, класс, народ, вид, характеристики и биография не читаются.</p>`)}
          ${faq("Окно DATAPAD", `<p>Планшет можно двигать за свободную часть верхней панели, менять размер за все стороны и углы, сворачивать и разворачивать. Карта Foundry вокруг остаётся доступной.</p>`)}
          ${faq("Оформление", `<p>30 тематических палитр + ручная настройка. Рабочий текст остаётся на спокойной поверхности. DATAPAD — декоративная оболочка; данные от неё не зависят.</p>`)}
          ${faq("Сохранение и резервная копия", `<p>Изменения сначала пишутся в локальный черновик, затем синхронизируются во флаг пользователя Foundry. Через «Ещё» можно выгрузить JSON и восстановить архив.</p>`)}
        </section>
      </div>
      <footer><small>Логика интерфейса: <b>найти → открыть → прочитать → при необходимости редактировать</b>. Для фракций: <b>выделить токен → открыть нужный раздел/группу → «Добавить выбранное»</b>. Любая новая привязка добавляется поверх существующих и не переписывает контакт.</small><button class="primary" data-action="close-help">Закрыть</button></footer></section></div>`;
  }

  function searchableText(entry) {
    const extra = entry.type === "books"
      ? [entry.author, entry.language, entry.script, entry.cipher, entry.discoveries, entry.nextStep]
      : entry.type === "people"
        ? [...personContactTypes(entry), ...Object.keys(CONTACT_TYPE_META).flatMap(type => personMemberships(entry, type)), entry.gang, entry.corporation, entry.fixer, entry.ripper, entry.relationship, entry.quotes, entry.promises, entry.secrets]
        : DIRECTORY_TYPES.has(entry.type)
          ? directoryFields(entry)
          : entry.type === "subscriptions"
            ? [entry.provider, entry.plan, entry.price, entry.currency, entry.status, entry.renewalNote]
          : entry.type === "locations"
            ? [entry.kind, entry.region, entry.atmosphere, entry.dangers, entry.services, entry.travel]
            : [entry.objective, entry.nextStep, entry.theory, entry.conclusion, entry.events, entry.decisions];
    return [entry.title, entry.headline, entry.summary, entry.content, entry.tags, ...extra, ...entry.fragments.map(fragment => `${fragment.title} ${fragment.content}`)].filter(Boolean).join(" ").toLowerCase();
  }

  function globalSearchPanel(book) {
    if ( !state.globalSearchOpen ) return "";
    const entries = sortedEntries(Object.values(book.entries).flat()).slice(0, 120);
    return `<div class="pcm-modal-backdrop" data-modal="search"><section class="pcm-search-panel" role="dialog" aria-label="Поиск по кодексу">
      <header><div><small>ПОИСК ПО ВСЕМ РАЗДЕЛАМ</small><h2>Найдите запись, не вспоминая раздел</h2></div><button data-action="close-global-search" title="Закрыть">×</button></header>
      <label class="pcm-global-search">⌕ <input data-global-search value="${esc(state.globalSearch)}" placeholder="Имя, место, фраза, тег, задание…"></label>
      <div class="pcm-search-results">${entries.map(entry => `<button data-action="open-search-result" data-entry-id="${entry.id}" data-global-search-text="${esc(searchableText(entry))}"><b>${SECTIONS[entry.type].icon}</b><span><em>${esc(SECTIONS[entry.type].label)}</em><strong>${esc(recordTitle(entry))}</strong>${recordHeadline(entry) ? `<em class="pcm-mini-headline">${esc(recordHeadline(entry))}</em>` : ""}<small>${short(entry.summary || entry.content || "Без краткой заметки", 90)}</small></span><i>→</i></button>`).join("") || '<p class="muted">Записей пока нет.</p>'}</div>
      <p class="pcm-search-empty" data-global-search-empty hidden>Ничего не найдено.</p>
      <footer><small><b>Ctrl+K</b> открывает поиск из любого места.</small></footer>
    </section></div>`;
  }

  function toolsPanel() {
    if ( !state.toolsOpen ) return "";
    const canJournal = Boolean(SECTIONS[state.section]);
    return `<div class="pcm-modal-backdrop" data-modal="tools"><section class="pcm-tools-panel" role="dialog" aria-label="Инструменты полевого архива">
      <header><div><small>РЕДКИЕ ДЕЙСТВИЯ</small><h2>Инструменты</h2><p>Здесь лежит всё, что не должно мешать во время игры.</p></div><button data-action="close-tools" title="Закрыть">×</button></header>
      <div class="pcm-tools-grid">
        <button data-action="open-chat"><b>✉</b><span>Сообщение<small>Контакту, только GM или публично — без выбора токена</small></span></button>
        <button data-action="appearance"><b>🎨</b><span>Оформление<small>Темы, плотность и прозрачность</small></span></button>
        <button data-action="save"><b>✓</b><span>Сохранить сейчас<small>Обычно это делает автосохранение</small></span></button>
        <button data-action="export"><b>⇩</b><span>Сделать копию<small>JSON-бэкап всех блокнотов</small></span></button>
        <button data-action="import"><b>⇧</b><span>Восстановить копию<small>Импорт ранее сохранённого JSON</small></span></button>
        ${canJournal ? `<button data-action="to-journal"><b>▤</b><span>Раздел в Journal<small>Создать обычный журнал Foundry</small></span></button>` : ""}
        <button data-action="help"><b>?</b><span>FAQ / Гайд<small>Инструкция по каждому разделу и сценарию</small></span></button>
      </div>
    </section></div>`;
  }

  function chatPanel() {
    if ( !state.chatOpen ) return "";
    const people = sortedEntries(notebook().entries.people);
    if ( people.length && !people.some(person => person.id === state.chatPersonId) ) state.chatPersonId = people[0].id;
    const person = people.find(item => item.id === state.chatPersonId) ?? null;
    const owners = person ? ownerUsersForPerson(person) : [];
    const gms = gmUsers();
    const options = people.map(item => opt(item.id, state.chatPersonId, item.title)).join("");
    const tags = person ? String(person.tags || "").split(",").map(tag => tag.trim()).filter(Boolean) : [];
    const affiliationBits = person ? [...personAffiliationLabels(person), person.attitude ? `Отношение: ${person.attitude}` : ""].filter(Boolean) : [];
    return `<div class="pcm-modal-backdrop" data-modal="chat"><section class="pcm-chat-panel" role="dialog" aria-label="Сообщение по контакту">
      <header><div><small>СТАНДАРТНЫЙ ЧАТ FOUNDRY</small><h2>✉ Сообщение по контакту</h2><p>Получатель выбирается из сохранённых контактов — токен на сцене выбирать не нужно.</p></div><button data-action="close-chat" title="Закрыть">×</button></header>
      ${people.length ? `<label class="pcm-chat-target"><span>Контакт</span><select data-chat-target>${options}</select></label>
        <div class="pcm-chat-recipient">${person?.image ? `<img src="${esc(person.image)}" alt="">` : "◉"}<span><b>${esc(person?.title || "Контакт")}</b><small>${owners.length ? `Владельцы Actor: ${esc(owners.map(user => user.name).join(", "))}` : "Нет доступного владельца Actor — можно отправить GM или публично"}</small>${affiliationBits.length ? `<em>${esc(affiliationBits.join(" · "))}</em>` : ""}${tags.length ? `<em>${esc(tags.map(tag => `#${tag}`).join(" "))}</em>` : ""}</span></div>
        <div class="pcm-chat-options"><label><input type="checkbox" data-chat-include-image ${state.chatIncludeImage ? "checked" : ""}><span>Добавить токен / портрет</span></label><label><input type="checkbox" data-chat-include-summary ${state.chatIncludeSummary ? "checked" : ""}><span>Добавить быструю сводку</span></label></div>
        <label class="pcm-chat-text"><span>Сообщение</span><textarea data-chat-text placeholder="Напишите сообщение…">${esc(state.chatText)}</textarea></label>
        <div class="pcm-chat-actions"><button data-action="send-chat-whisper" ${owners.length ? "" : "disabled"}>Лично владельцу</button><button data-action="send-chat-gm" ${gms.length ? "" : "disabled"}>Только GM</button><button class="primary" data-action="send-chat-public">Публично</button></div>
        <p class="pcm-chat-hint">В карточку сообщения автоматически добавляются теги, категория, банда/корпорация/фиксер/рипер и отношение. Изображение (при наличии предпочитается арт токена) и краткая сводка включаются галочками.</p>`
        : `<div class="pcm-inline-empty"><b>Нет сохранённых контактов</b><p>Сначала добавьте хотя бы один контакт в архив.</p></div>`}
    </section></div>`;
  }

  function lightboxView() {
    if ( !state.lightbox ) return "";
    const entry = entryById(state.lightbox.entryId);
    const item = entry?.gallery?.find(image => image.id === state.lightbox.galleryId);
    if ( !entry || !item ) return "";
    return `<div class="pcm-lightbox" data-action="close-lightbox"><button data-action="close-lightbox" title="Закрыть">×</button><figure><img src="${esc(item.image)}" alt="${esc(item.caption)}"><figcaption><b>${esc(recordTitle(entry))}</b>${item.caption ? `<span>${esc(item.caption)}</span>` : ""}</figcaption></figure></div>`;
  }

  function resizeHandles() {
    return ["n", "ne", "e", "se", "s", "sw", "w", "nw"]
      .map(direction => `<div class="pcm-resize-handle" data-resize-handle="${direction}" aria-hidden="true"></div>`)
      .join("");
  }
  function deviceHardware() {
    return `<div class="pcm-device-hardware" aria-hidden="true">
      <i class="pcm-hw-bumper hw-bumper-nw"></i><i class="pcm-hw-bumper hw-bumper-ne"></i><i class="pcm-hw-bumper hw-bumper-sw"></i><i class="pcm-hw-bumper hw-bumper-se"></i>
      <i class="pcm-hw-screw hw-nw"></i><i class="pcm-hw-screw hw-ne"></i><i class="pcm-hw-screw hw-sw"></i><i class="pcm-hw-screw hw-se"></i>
      <i class="pcm-hw-speaker"></i>
      <i class="pcm-hw-radiator hw-rad-left"></i><i class="pcm-hw-radiator hw-rad-right"></i>
      <i class="pcm-hw-grip hw-grip-left"></i><i class="pcm-hw-grip hw-grip-right"></i>
      <i class="pcm-hw-key hw-key-power"><b>ПИТ</b></i><i class="pcm-hw-key hw-key-up"><b>+</b></i><i class="pcm-hw-key hw-key-down"><b>−</b></i>
      <i class="pcm-hw-led hw-led-power"></i><i class="pcm-hw-led hw-led-link"></i>
      <i class="pcm-hw-portbay"><b class="pcm-port-usb"></b><b class="pcm-port-jack"></b><b class="pcm-port-dock"></b></i>
      <i class="pcm-hw-serial">НАЙТ-СИТИ // ПОЛЕВОЙ ТЕРМИНАЛ · NC-DP/71</i>
    </div>`;
  }


  function render() {
    state.contactContext = null;
    const win = state.root.querySelector(".pcm-window");
    if ( !state.actors.length ) { win.innerHTML = `<div class="pcm-no-actors"><h2>Нет доступного персонажа</h2><p>Нужен Actor типа character с правами владельца.</p><button data-action="close">Закрыть</button></div>`; return; }
    const actor = actorById(state.store.activeActorId);
    const book = ensureNotebook(actor);
    const counts = Object.fromEntries(Object.keys(SECTIONS).map(key => [key, sectionCount(book, key)]));
    const inboxCount = inboxEntries(book).length;
    const gmNeuroUnread = game.user?.isGM ? neuroTotalUnread() : 0;
    const minimized = Boolean(state.windowPrefs?.minimized);
    win.innerHTML = `<div class="pcm-device-screen"><header class="pcm-top" data-drag-handle><div class="pcm-brand"><img src="${esc(book.actorImg)}" alt=""><div><small>НС://ДАТАПАД • ПОЛЕВОЙ HUD ${esc(MACRO_VERSION)}</small><select data-actor>${state.actors.map(item => opt(item.id ?? item._id, actor.id ?? actor._id, item.name)).join("")}</select></div></div><span data-save-badge data-mode="${state.storageMode}">${state.storageMode === "server" ? "Сохранено" : "Локально"}</span><div class="pcm-top-actions"><button data-action="remember-context" title="Запомнить выбранное"><b>◎</b><span>Запомнить</span></button><button data-action="open-chat" title="Сообщение по сохранённому контакту"><b>✉</b><span>Сообщение</span></button><button data-action="global-search" title="Поиск (Ctrl+K)"><b>⌕</b><span>Найти</span></button><button data-action="tools" title="Дополнительные действия"><b>⋯</b><span>Ещё</span></button><button class="pcm-window-toggle" data-action="toggle-minimize" title="${minimized ? "Развернуть окно" : "Свернуть окно"}" aria-label="${minimized ? "Развернуть окно" : "Свернуть окно"}"><b data-window-toggle-icon>${minimized ? "▣" : "—"}</b><span data-window-toggle-label>${minimized ? "Развернуть" : "Свернуть"}</span></button><button class="pcm-close" data-action="close" title="Закрыть" aria-label="Закрыть">×</button></div></header>
      <div class="pcm-scan-strip"><span><b>05 КИЛО // МИКРОКИБЕР DATAPAD V71</b><small> // ДОСТУП РАЗРЕШЁН</small></span><div class="pcm-scan-bar"><i data-scan-bar-fill style="width:${scanPercent()}%"></i></div><strong>СКАНИРОВАНИЕ... <b data-scan-percent>${scanPercent()}%</b></strong></div>
      <div class="pcm-layout"><main>${state.section === "dashboard" ? dashboard(book) : sectionView(book, state.section)}</main><aside><div class="pcm-nav-header"><small>БЫСТРЫЙ ДОСТУП</small><b>ВЗЛОМ</b></div><button data-action="toggle-nav" class="pcm-nav-toggle" title="Свернуть навигацию">☰</button>${nav("dashboard", "Обзор", "◉")}${inboxCount ? nav("inbox", "Разобрать", "✓", inboxCount) : ""}${game.user?.isGM ? `<small class="pcm-caption pcm-gm-caption">GM CONTROL</small>${nav("gm-neuro", "GM // НЕЙРО-СЕТЬ", "⌁", gmNeuroUnread || null)}` : ""}<small class="pcm-caption">КОНТАКТЫ И СЕТИ</small>${CONTACT_SECTIONS.map(key => nav(key, SECTIONS[key].label, SECTIONS[key].icon, counts[key])).join("")}<small class="pcm-caption">СЕРВИСЫ И КОНТРАКТЫ</small>${SERVICE_SECTIONS.map(key => nav(key, SECTIONS[key].label, SECTIONS[key].icon, counts[key])).join("")}<small class="pcm-caption">ГОРОД И ДАННЫЕ</small>${nav("citymap", "Карта Найт-Сити", "⌖")}${ARCHIVE_SECTIONS.map(key => nav(key, SECTIONS[key].label, SECTIONS[key].icon, counts[key])).join("")}<label class="pcm-goal"><span>АКТИВНЫЙ ТРЕКЕР</span><textarea data-goal data-autogrow placeholder="Что сейчас важнее всего?">${esc(book.goal)}</textarea></label></aside></div>
      ${toolsPanel()}${themePanel(book)}${helpPanel()}${globalSearchPanel(book)}${chatPanel()}${contactPickerPanel(book)}${quickGroupCreatePanel(book)}${lightboxView()}</div>${deviceHardware()}${resizeHandles()}`;
    applyAppearance(book);
    applyWindowGeometry();
    syncScanHud(true);
    startScanHud();
    queueMicrotask(() => { autoGrowTextareas(); applyContactSearchDom(); for ( const history of root.querySelectorAll("[data-neuro-history]") ) history.scrollTop = history.scrollHeight; });
  }

  function dataUrlFromImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => resolve(reader.result);
        image.onload = () => {
          const max = 1400;
          const scale = Math.min(1, max / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/webp", 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadClipboardImage(file, purpose = "note") {
    const Picker = globalThis.foundry?.applications?.apps?.FilePicker ?? globalThis.FilePicker ?? globalThis.CONFIG?.ux?.FilePicker;
    let path = "";
    if ( Picker?.upload ) {
      const folder = "night-city-field-archive";
      try { await Picker.createDirectory?.("data", folder); }
      catch (_error) { /* Папка уже есть или у игрока нет права создавать папки. */ }
      try {
        const extension = String(file.type || "image/png").split("/")[1]?.replace("jpeg", "jpg") || "png";
        const actorPart = String(state.store.activeActorId || "actor").replace(/[^a-zA-Z0-9_-]/g, "");
        const cleanPurpose = String(purpose).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "image";
        const renamed = new File([file], `${cleanPurpose}-${actorPart}-${Date.now()}-${uid().slice(0, 5)}.${extension}`, { type: file.type || "image/png" });
        const response = await Picker.upload("data", folder, renamed, {}, { notify: false });
        path = response?.path || "";
      } catch (error) {
        console.warn("Полевой архив: серверная загрузка изображения не удалась", error);
      }
    }
    if ( path ) notify("Картинка загружена и вставлена.");
    else {
      path = await dataUrlFromImage(file);
      notify("Картинка вставлена локально. Для серверного файла игроку нужны права загрузки.", "warn");
    }
    return path;
  }

  async function pasteImage(file, entry, target = { type: "cover" }) {
    const path = await uploadClipboardImage(file, target.type);
    if ( target.type === "gallery" && entry.type === "people" ) {
      entry.gallery.push({ id: uid(), image: path, caption: "" });
      if ( !entry.image ) entry.image = path;
    } else if ( target.type === "fragment" && target.fragment ) {
      target.fragment.image = path;
      state.openFragmentId = target.fragment.id;
    } else entry.image = path;
    entry.updatedAt = now();
    state.openId = entry.id;
    dirty();
    render();
  }

  function openExistingEntry(entry, { returnLocationId = null } = {}) {
    if ( !entry ) return false;
    if ( entry.type === "locations" ) {
      resetView("locations");
      state.viewMode = "location";
      state.viewId = entry.id;
    } else if ( entry.type === "people" ) {
      resetView(returnLocationId ? "locations" : "people");
      state.viewMode = "person";
      state.viewId = entry.id;
      state.returnLocationId = returnLocationId;
    } else {
      resetView(entry.type);
      state.viewMode = "entry";
      state.viewId = entry.id;
    }
    return true;
  }

  function addEntry(type, seed = "", options = {}) {
    const previous = options.previousView ?? viewSnapshot();
    const entry = blankEntry(type, seed);
    entry.inbox = Boolean(options.inbox);
    if ( LOCATION_LINK_TYPES.has(type) && options.locationId ) setEntryLocations(entry, [options.locationId]);
    notebook().entries[type].push(entry);
    state.quick = "";
    if ( options.stay ) {
      dirty();
      render();
      return entry;
    }
    state.section = type;
    state.openId = entry.id;
    state.previousView = previous;
    state.viewMode = "edit";
    state.viewId = entry.id;
    if ( LOCATION_LINK_TYPES.has(type) && options.locationId ) {
      state.section = "locations";
      state.returnLocationId = options.locationId;
    }
    dirty();
    render();
    return entry;
  }

  function selectedTokens() {
    const targets = Array.from(game.user?.targets ?? []).filter(Boolean);
    if ( targets.length ) return targets;
    return Array.from(globalThis.canvas?.tokens?.controlled ?? []).filter(Boolean);
  }

  function tokenKey(token) {
    const document = token?.document ?? token;
    return String(document?.id ?? document?._id ?? token?.id ?? "");
  }

  function actorForPerson(person) {
    if ( !person ) return null;
    const actors = game?.actors?.contents ?? (game?.actors ? Array.from(game.actors) : []);
    const actorId = String(person.sourceActorId || person.sourceActorUuid || "").split(".").pop();
    return actors.find(actor => String(actor.id ?? actor._id) === actorId || String(actor.uuid || "") === String(person.sourceActorUuid || "")) ?? null;
  }

  function ownerUsersForPerson(person) {
    const actor = actorForPerson(person);
    const users = game?.users?.contents ?? (game?.users ? Array.from(game.users) : []);
    if ( !actor ) return [];
    return users.filter(user => {
      if ( user?.isGM ) return false;
      try { return actor.testUserPermission?.(user, "OWNER") ?? false; }
      catch (_error) { return false; }
    });
  }

  function gmUsers() {
    const users = game?.users?.contents ?? (game?.users ? Array.from(game.users) : []);
    return users.filter(user => user?.isGM);
  }

  function neuroThreadId(playerUserId, playerActorId, contactId) {
    const clean = value => String(value || "-").replace(/[^a-zA-Z0-9_-]/g, "_");
    return `nc-neuro:${clean(playerUserId)}:${clean(playerActorId)}:${clean(contactId)}`;
  }

  function neuroFlag(message) {
    if ( !message ) return null;
    const direct = message.flags?.[NEURO_FLAG_SCOPE]?.[NEURO_FLAG_KEY] ?? null;
    if ( direct && typeof direct === "object" ) return direct;
    try { return message.getFlag?.(NEURO_FLAG_SCOPE, NEURO_FLAG_KEY) ?? null; }
    catch (_error) { return null; }
  }

  function neuroMessageArray() {
    const source = game?.messages;
    const messages = source?.contents ?? (source ? Array.from(source) : []);
    return messages.filter(message => Boolean(neuroFlag(message)));
  }

  function neuroMessageTime(message) {
    const flag = neuroFlag(message);
    const parsed = Date.parse(String(flag?.sentAt || ""));
    if ( Number.isFinite(parsed) ) return parsed;
    return Number(message?.timestamp ?? message?._source?.timestamp ?? 0) || 0;
  }

  function neuroMessagesForThread(threadId) {
    if ( !threadId ) return [];
    return neuroMessageArray()
      .filter(message => String(neuroFlag(message)?.threadId || "") === String(threadId))
      .sort((a, b) => neuroMessageTime(a) - neuroMessageTime(b));
  }

  function saveNeuroRead() {
    try { localStorage.setItem(neuroReadKey, JSON.stringify(state.neuroRead || {})); }
    catch (_error) { /* local read markers are optional */ }
  }

  function markNeuroRead(threadId) {
    if ( !threadId ) return;
    const messages = neuroMessagesForThread(threadId);
    const latest = messages.length ? neuroMessageTime(messages[messages.length - 1]) : Date.now();
    state.neuroRead[threadId] = Math.max(Number(state.neuroRead[threadId]) || 0, latest || Date.now());
    saveNeuroRead();
  }

  function neuroUnreadForThread(threadId) {
    const readAt = Number(state.neuroRead?.[threadId]) || 0;
    const currentUserId = String(game.user?.id ?? game.user?._id ?? "");
    return neuroMessagesForThread(threadId).filter(message => {
      const flag = neuroFlag(message);
      if ( !flag || neuroMessageTime(message) <= readAt ) return false;
      if ( game.user?.isGM ) return flag.direction === "player-to-gm";
      return flag.direction === "gm-to-player" && String(flag.playerUserId || "") === currentUserId;
    }).length;
  }

  function neuroTotalUnread() {
    const ids = new Set(neuroMessageArray().map(message => String(neuroFlag(message)?.threadId || "")).filter(Boolean));
    let total = 0;
    for ( const id of ids ) total += neuroUnreadForThread(id);
    return total;
  }

  function userArchiveData(user) {
    const raw = readUnifiedServerData(user);
    return raw && typeof raw === "object" ? raw : null;
  }

  function playerArchiveDirectory() {
    const users = game?.users?.contents ?? (game?.users ? Array.from(game.users) : []);
    return users.filter(user => !user?.isGM).map(user => {
      const data = userArchiveData(user);
      const notebooks = Object.values(data?.notebooks || {}).map(book => {
        const actorId = String(book?.actorId || "");
        const actorName = String(book?.actorName || "Персонаж");
        const contacts = Array.isArray(book?.entries?.people) ? book.entries.people.map(person => ({
          id: String(person?.id || ""),
          title: String(person?.title || "Без имени"),
          image: String(person?.image || ""),
          summary: String(person?.summary || ""),
          attitude: String(person?.attitude || "Неизвестно"),
          messages: Array.isArray(person?.messages) ? clone(person.messages) : []
        })).filter(person => person.id) : [];
        return { actorId, actorName, actorImg: String(book?.actorImg || ""), contacts };
      }).filter(book => book.actorId || book.contacts.length);
      return {
        userId: String(user?.id ?? user?._id ?? ""),
        userName: String(user?.name || "Игрок"),
        active: Boolean(user?.active),
        notebooks
      };
    });
  }

  function neuroThreadSummaries() {
    const grouped = new Map();
    for ( const message of neuroMessageArray() ) {
      const flag = neuroFlag(message);
      const id = String(flag?.threadId || "");
      if ( !id ) continue;
      if ( !grouped.has(id) ) grouped.set(id, []);
      grouped.get(id).push(message);
    }
    return [...grouped.entries()].map(([threadId, messages]) => {
      messages.sort((a, b) => neuroMessageTime(a) - neuroMessageTime(b));
      const latestMessage = messages[messages.length - 1];
      const latest = neuroFlag(latestMessage) || {};
      return {
        threadId,
        messages,
        latest,
        latestTime: neuroMessageTime(latestMessage),
        unread: neuroUnreadForThread(threadId)
      };
    }).sort((a, b) => b.latestTime - a.latestTime);
  }

  function neuroTimeLabel(value) {
    const date = new Date(Number(value) || Date.now());
    try { return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch (_error) { return date.toISOString().slice(0, 16).replace("T", " "); }
  }

  function neuroMessageBubble(message) {
    const flag = neuroFlag(message) || {};
    const isMine = game.user?.isGM ? flag.direction === "gm-to-player" : flag.direction === "player-to-gm";
    const sender = flag.direction === "gm-to-player" ? (flag.contactName || "Контакт") : (flag.playerActorName || "Игрок");
    const body = esc(flag.text || "").replaceAll("\n", "<br>");
    return `<article class="pcm-neuro-message ${isMine ? "mine" : "incoming"}"><header><b>${esc(sender)}</b><time>${esc(neuroTimeLabel(neuroMessageTime(message)))}</time></header><p>${body}</p></article>`;
  }

  function storedNeuroMessageBubble(message) {
    const isMine = game.user?.isGM ? message?.direction === "in" : message?.direction === "out";
    const sender = message?.direction === "in" ? (message?.contactName || "Контакт") : (message?.sourceActorName || "Игрок");
    const body = esc(message?.body || "").replaceAll("\n", "<br>");
    const time = Date.parse(String(message?.createdAt || "")) || Date.now();
    return `<article class="pcm-neuro-message ${isMine ? "mine" : "incoming"}"><header><b>${esc(sender)}</b><time>${esc(neuroTimeLabel(time))}</time></header><p>${body}</p></article>`;
  }

  function neuroHistory(threadId, emptyText = "Канал молчит. Здесь появятся сообщения.", storedMessages = []) {
    const rows = [];
    const seen = new Set();
    for ( const message of Array.isArray(storedMessages) ? storedMessages : [] ) {
      const id = String(message?.id || "");
      if ( id ) seen.add(id);
      rows.push({ time: Date.parse(String(message?.createdAt || "")) || 0, html: storedNeuroMessageBubble(message) });
    }
    for ( const message of neuroMessagesForThread(threadId).slice(-80) ) {
      const flag = neuroFlag(message) || {};
      const archiveMessageId = String(flag.archiveMessageId || "");
      if ( archiveMessageId && seen.has(archiveMessageId) ) continue;
      rows.push({ time: neuroMessageTime(message), html: neuroMessageBubble(message) });
    }
    rows.sort((a, b) => a.time - b.time);
    if ( !rows.length ) return `<div class="pcm-neuro-empty">${esc(emptyText)}</div>`;
    return `<div class="pcm-neuro-history" data-neuro-history>${rows.slice(-80).map(row => row.html).join("")}</div>`;
  }

  function neuroChatContent(flag) {
    const from = flag.direction === "gm-to-player" ? flag.contactName : flag.playerActorName;
    const to = flag.direction === "gm-to-player" ? flag.playerActorName : "GM";
    const body = esc(flag.text || "").replaceAll("\n", "<br>");
    return `<div class="night-city-neuro-link-message" style="padding:10px;border:1px solid #00d5d5;background:#0c1115;color:#e8f5f5"><div style="font:700 10px monospace;color:#38e1df;letter-spacing:.08em">НЕЙРО-СВЯЗЬ // ${esc(flag.contactName || "КОНТАКТ")}</div><div style="margin-top:4px;font-size:11px;color:#9db3b5">${esc(from || "Источник")} → ${esc(to || "Получатель")}</div><div style="margin-top:8px;white-space:normal">${body}</div></div>`;
  }

  async function createNeuroMessage(flag, whisperIds, speaker) {
    const Message = globalThis.ChatMessage ?? globalThis.foundry?.documents?.ChatMessage;
    if ( !Message?.create ) throw new Error("ChatMessage API недоступен");
    const recipients = [...new Set((whisperIds || []).map(String).filter(Boolean))];
    return Message.create({
      user: game.user?.id ?? game.user?._id,
      speaker: speaker || { alias: flag.direction === "gm-to-player" ? flag.contactName : flag.playerActorName },
      whisper: recipients,
      content: neuroChatContent(flag),
      flags: { [NEURO_FLAG_SCOPE]: { [NEURO_FLAG_KEY]: flag } }
    });
  }

  async function sendNeuroPlayer(person) {
    if ( game.user?.isGM ) return notify("Для ответов GM используйте пространство «GM // НЕЙРО-СЕТЬ».", "warn");
    const actor = actorById(state.store.activeActorId);
    if ( !actor || !person ) return notify("Не удалось определить персонажа или контакт.", "warn");
    const playerUserId = String(game.user?.id ?? game.user?._id ?? "");
    const playerActorId = String(actor.id ?? actor._id ?? "");
    const threadId = neuroThreadId(playerUserId, playerActorId, person.id);
    const text = String(state.neuroDrafts[threadId] || "").trim();
    if ( !text ) return notify("Сначала напишите сообщение в нейро-связь.", "warn");
    const gms = gmUsers();
    if ( !gms.length ) return notify("Нет доступного GM для нейро-связи.", "warn");
    const sharedMessage = {
      id: uid(),
      direction: "out",
      body: text,
      createdAt: now(),
      senderUserId: playerUserId,
      senderName: String(game.user?.name || "Игрок"),
      sourceActorId: playerActorId,
      sourceActorName: String(actor.name || notebook()?.actorName || "Игрок"),
      archiveUserId: playerUserId,
      archiveActorId: playerActorId,
      contactId: String(person.id || ""),
      contactName: String(person.title || "Контакт")
    };
    appendUnifiedContactMessage(state.store, { actorId: playerActorId, contactId: person.id, message: sharedMessage });
    dirty();
    await saveServer(true);
    const flag = {
      version: NEURO_VERSION,
      threadId,
      direction: "player-to-gm",
      archiveMessageId: sharedMessage.id,
      playerUserId,
      playerActorId,
      playerActorName: String(actor.name || notebook()?.actorName || "Игрок"),
      contactId: String(person.id || ""),
      contactName: String(person.title || "Контакт"),
      contactImage: String(person.image || ""),
      text,
      sentAt: now()
    };
    const recipients = [playerUserId, ...gms.map(user => user.id ?? user._id)];
    try {
      await createNeuroMessage(flag, recipients, currentSpeaker());
      state.neuroDrafts[threadId] = "";
      markNeuroRead(threadId);
      render();
      notify(`Нейро-сообщение для «${person.title}» отправлено GM.`);
    } catch (error) {
      console.warn("Полевой архив: нейро-сообщение игрока не отправлено", error);
      notify("Не удалось отправить нейро-сообщение.", "error");
    }
  }

  function neuroContactPanel(person, book = notebook()) {
    if ( !person ) return "";
    if ( game.user?.isGM ) return `<section class="pcm-neuro-panel pcm-neuro-admin"><header><div><small>NEURAL CHANNEL / GM</small><h3>⌁ НЕЙРО-СВЯЗЬ</h3></div><button data-action="nav" data-section="gm-neuro">Открыть GM пространство</button></header><p>У GM все диалоги игроков собраны в отдельной рабочей зоне, где можно отвечать от имени контактов.</p></section>`;
    const actor = actorById(state.store.activeActorId);
    const playerUserId = String(game.user?.id ?? game.user?._id ?? "");
    const playerActorId = String(actor?.id ?? actor?._id ?? book?.actorId ?? "");
    const threadId = neuroThreadId(playerUserId, playerActorId, person.id);
    markNeuroRead(threadId);
    const draft = state.neuroDrafts[threadId] || "";
    const gms = gmUsers();
    return `<section class="pcm-neuro-panel" data-neuro-thread="${esc(threadId)}"><header><div><small>NEURAL CHANNEL // PRIVATE</small><h3>⌁ НЕЙРО-СВЯЗЬ</h3><p>Сообщения сохраняются в канале контакта и дублируются адресатам через приватный чат Foundry.</p></div><span class="pcm-neuro-status ${gms.length ? "online" : "offline"}">${gms.length ? "GM LINK ONLINE" : "GM OFFLINE"}</span></header>
      ${neuroHistory(threadId, `Канал «${person.title}» ещё не использовался.`, person.messages)}
      <div class="pcm-neuro-compose"><textarea data-neuro-player-text data-thread-id="${esc(threadId)}" data-autogrow placeholder="Написать ${esc(person.title)}…">${esc(draft)}</textarea><button class="primary pcm-neuro-send" data-action="send-neuro-player" data-person-id="${esc(person.id)}" ${gms.length ? "" : "disabled"}>➤ ОТПРАВИТЬ</button></div>
    </section>`;
  }

  function ensureGmNeuroDirectorySelection(directory) {
    const eligible = directory.filter(player => player.notebooks.some(book => book.contacts.length));
    if ( !eligible.length ) return { eligible, player: null, book: null, contact: null };
    let player = eligible.find(item => item.userId === state.neuroGmPlayerId) || eligible[0];
    state.neuroGmPlayerId = player.userId;
    const books = player.notebooks.filter(book => book.contacts.length);
    let book = books.find(item => item.actorId === state.neuroGmActorId) || books[0] || null;
    state.neuroGmActorId = book?.actorId || "";
    let contact = book?.contacts.find(item => item.id === state.neuroGmContactId) || book?.contacts[0] || null;
    state.neuroGmContactId = contact?.id || "";
    return { eligible, player, book, contact };
  }

  function gmNeuroTargetFromThread(threadId) {
    const messages = neuroMessagesForThread(threadId);
    const flag = neuroFlag(messages[messages.length - 1]);
    if ( !flag ) return null;
    const directory = playerArchiveDirectory();
    const player = directory.find(item => String(item.userId) === String(flag.playerUserId || ""));
    const book = player?.notebooks.find(item => String(item.actorId) === String(flag.playerActorId || ""));
    const contact = book?.contacts.find(item => String(item.id) === String(flag.contactId || ""));
    return { ...flag, threadId, messages: Array.isArray(contact?.messages) ? contact.messages : [] };
  }

  function gmNeuroCurrentTarget() {
    if ( state.neuroGmThreadId ) {
      const existing = gmNeuroTargetFromThread(state.neuroGmThreadId);
      if ( existing ) return existing;
    }
    const directory = playerArchiveDirectory();
    const { player, book, contact } = ensureGmNeuroDirectorySelection(directory);
    if ( !player || !book || !contact ) return null;
    return {
      threadId: neuroThreadId(player.userId, book.actorId, contact.id),
      playerUserId: player.userId,
      playerActorId: book.actorId,
      playerActorName: book.actorName,
      contactId: contact.id,
      contactName: contact.title,
      contactImage: contact.image || "",
      messages: Array.isArray(contact.messages) ? contact.messages : []
    };
  }

  function openGmNeuroThread(threadId) {
    if ( !game.user?.isGM || !threadId ) return;
    const target = gmNeuroTargetFromThread(threadId);
    if ( !target ) return;
    state.neuroGmThreadId = threadId;
    state.neuroGmPlayerId = String(target.playerUserId || "");
    state.neuroGmActorId = String(target.playerActorId || "");
    state.neuroGmContactId = String(target.contactId || "");
    state.neuroGmText = "";
    state.section = "gm-neuro";
    state.viewMode = "list";
    markNeuroRead(threadId);
    render();
  }

  async function sendNeuroGm() {
    if ( !game.user?.isGM ) return notify("GM-пространство доступно только мастеру.", "warn");
    const target = gmNeuroCurrentTarget();
    if ( !target ) return notify("Выберите игрока, персонажа и контакт.", "warn");
    const text = String(state.neuroGmText || "").trim();
    if ( !text ) return notify("Сначала напишите ответ.", "warn");
    const targetUser = (game?.users?.contents ?? (game?.users ? Array.from(game.users) : [])).find(user => String(user?.id ?? user?._id ?? "") === String(target.playerUserId || ""));
    if ( !targetUser ) return notify("Игрок для этого канала больше не найден.", "warn");
    const targetStore = readUnifiedServerData(targetUser);
    const sharedMessage = {
      id: uid(),
      direction: "in",
      body: text,
      createdAt: now(),
      senderUserId: String(game.user?.id ?? game.user?._id ?? ""),
      senderName: String(game.user?.name || "GM"),
      sourceActorId: String(target.playerActorId || ""),
      sourceActorName: String(target.contactName || "Контакт"),
      archiveUserId: String(target.playerUserId || ""),
      archiveActorId: String(target.playerActorId || ""),
      contactId: String(target.contactId || ""),
      contactName: String(target.contactName || "Контакт")
    };
    if ( !appendUnifiedContactMessage(targetStore, { actorId: target.playerActorId, contactId: target.contactId, message: sharedMessage }) ) {
      return notify("Контакт больше не найден в общем архиве игрока.", "warn");
    }
    await writeUnifiedServerData(targetUser, targetStore);
    const flag = {
      version: NEURO_VERSION,
      threadId: String(target.threadId || neuroThreadId(target.playerUserId, target.playerActorId, target.contactId)),
      direction: "gm-to-player",
      archiveMessageId: sharedMessage.id,
      playerUserId: String(target.playerUserId || ""),
      playerActorId: String(target.playerActorId || ""),
      playerActorName: String(target.playerActorName || targetUser.name || "Игрок"),
      contactId: String(target.contactId || ""),
      contactName: String(target.contactName || "Контакт"),
      contactImage: String(target.contactImage || ""),
      text,
      sentAt: now()
    };
    const recipients = [targetUser.id ?? targetUser._id, ...gmUsers().map(user => user.id ?? user._id)];
    try {
      await createNeuroMessage(flag, recipients, { alias: flag.contactName });
      state.neuroGmThreadId = flag.threadId;
      state.neuroGmText = "";
      markNeuroRead(flag.threadId);
      render();
      notify(`Ответ от «${flag.contactName}» отправлен игроку ${targetUser.name}.`);
    } catch (error) {
      console.warn("Полевой архив: ответ GM по нейро-связи не отправлен", error);
      notify("Не удалось отправить ответ игроку.", "error");
    }
  }

  function gmNeuroView() {
    if ( !game.user?.isGM ) return `<div class="pcm-empty"><b>×</b><h2>Нет доступа</h2><p>GM-пространство доступно только мастеру.</p></div>`;
    const directory = playerArchiveDirectory();
    const selection = ensureGmNeuroDirectorySelection(directory);
    const target = gmNeuroCurrentTarget();
    const activeThreadId = String(target?.threadId || "");
    if ( activeThreadId ) markNeuroRead(activeThreadId);
    const summaries = neuroThreadSummaries();
    const playerOptions = selection.eligible.map(player => opt(player.userId, state.neuroGmPlayerId, `${player.active ? "●" : "○"} ${player.userName}`)).join("");
    const books = selection.player?.notebooks.filter(book => book.contacts.length) || [];
    const bookOptions = books.map(book => opt(book.actorId, state.neuroGmActorId, book.actorName)).join("");
    const contacts = selection.book?.contacts || [];
    const contactOptions = contacts.map(contact => opt(contact.id, state.neuroGmContactId, contact.title)).join("");
    const recent = summaries.map(summary => {
      const flag = summary.latest || {};
      const preview = short(flag.text || "", 84);
      return `<button class="pcm-neuro-thread-row ${summary.threadId === activeThreadId ? "active" : ""}" data-action="open-neuro-thread" data-thread-id="${esc(summary.threadId)}"><span class="pcm-neuro-thread-avatar">${flag.contactImage ? `<img src="${esc(flag.contactImage)}" alt="">` : "⌁"}</span><span><b>${esc(flag.contactName || "Контакт")}</b><small>${esc(flag.playerActorName || "Игрок")}</small><em>${preview}</em></span>${summary.unread ? `<i>${summary.unread}</i>` : `<time>${esc(neuroTimeLabel(summary.latestTime))}</time>`}</button>`;
    }).join("");
    const noDirectory = !selection.eligible.length;
    return `<div class="pcm-gm-neuro"><div class="pcm-section-head"><div><small>GM CONTROL // PRIVATE NETWORK</small><h1>⌁ GM // НЕЙРО-СЕТЬ</h1></div><div><button data-action="neuro-gm-new">＋ Новый канал</button></div></div>
      <p class="pcm-section-hint">Выберите игрока и любой его синхронизированный контакт. GM может начать разговор первым или открыть уже существующую переписку.</p>
      <div class="pcm-gm-neuro-grid"><aside class="pcm-neuro-threads"><header><b>ВХОДЯЩИЕ / КАНАЛЫ</b><span>${summaries.length}</span></header>${recent || `<div class="pcm-neuro-empty">Активных нейро-каналов пока нет.</div>`}</aside>
        <section class="pcm-neuro-console"><div class="pcm-neuro-routing"><label><span>ИГРОК</span><select data-neuro-gm-player ${noDirectory ? "disabled" : ""}>${playerOptions || `<option>Нет синхронизированных игроков</option>`}</select></label><label><span>ПЕРСОНАЖ</span><select data-neuro-gm-notebook ${books.length ? "" : "disabled"}>${bookOptions || `<option>Нет архива</option>`}</select></label><label><span>КОНТАКТ</span><select data-neuro-gm-contact ${contacts.length ? "" : "disabled"}>${contactOptions || `<option>Нет контактов</option>`}</select></label></div>
          ${target ? `<header class="pcm-neuro-console-head"><span class="pcm-neuro-big-avatar">${target.contactImage ? `<img src="${esc(target.contactImage)}" alt="">` : "⌁"}</span><div><small>ACTIVE NEURAL ROUTE</small><h2>${esc(target.contactName || "Контакт")}</h2><p>Ответ от имени контакта → ${esc(target.playerActorName || "Игрок")}</p></div><i>ENCRYPTED</i></header>${neuroHistory(activeThreadId, "Канал готов. GM может отправить первое сообщение.", target?.messages || [])}<div class="pcm-neuro-compose gm"><textarea data-neuro-gm-text data-autogrow placeholder="Ответить от имени ${esc(target.contactName || "контакта")}…">${esc(state.neuroGmText)}</textarea><button class="primary pcm-neuro-send" data-action="send-neuro-gm">➤ ОТПРАВИТЬ ИГРОКУ</button></div>` : `<div class="pcm-neuro-empty pcm-neuro-no-target"><b>Нет доступного маршрута</b><p>Игрок должен хотя бы раз сохранить архив на сервере Foundry. После этого его контакты появятся здесь автоматически.</p></div>`}
        </section></div></div>`;
  }

  function currentSpeaker() {
    const actor = actorById(state.store.activeActorId);
    const Message = globalThis.ChatMessage ?? globalThis.foundry?.documents?.ChatMessage;
    try { return Message?.getSpeaker?.({ actor }) ?? { alias: actor?.name ?? game.user?.name ?? "Игрок" }; }
    catch (_error) { return { alias: actor?.name ?? game.user?.name ?? "Игрок" }; }
  }

  function contactChatCard(person) {
    const tags = String(person.tags || "").split(",").map(tag => tag.trim()).filter(Boolean);
    const connections = [
      person.gang ? `Связь с бандой: ${person.gang}` : "",
      person.corporation ? `Связь с корпорацией: ${person.corporation}` : "",
      person.fixer ? `Его фиксер: ${person.fixer}` : "",
      person.ripper ? `Его рипер: ${person.ripper}` : ""
    ].filter(Boolean);
    const facts = [...personAffiliationLabels(person), person.attitude ? `Отношение: ${person.attitude}` : "", ...connections].filter(Boolean);
    if ( !facts.length ) facts.push("Контакт");
    const tokenArt = person.gallery?.find(item => /токен/i.test(String(item.caption || "")))?.image || "";
    const chatImage = tokenArt || person.image || "";
    const image = state.chatIncludeImage && chatImage ? `<img src="${esc(chatImage)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px;float:left;margin:0 10px 7px 0">` : "";
    const summary = state.chatIncludeSummary && person.summary ? `<p><b>Сводка:</b> ${esc(person.summary).replaceAll("\n", "<br>")}</p>` : "";
    const tagLine = tags.length ? `<p><b>Теги:</b> ${tags.map(tag => `#${esc(tag)}`).join(" ")}</p>` : "";
    return `<section class="pcm-chat-contact-card">${image}<p><b>${esc(person.title)}</b></p><p>${facts.map(esc).join(" · ")}</p>${tagLine}${summary}<div style="clear:both"></div></section>`;
  }

  async function sendContactMessage(mode = "public") {
    const person = notebook().entries.people.find(item => item.id === state.chatPersonId);
    if ( !person ) return notify("Выберите контакт из списка.", "warn");
    const text = state.chatText.trim();
    if ( !text ) return notify("Сначала напишите сообщение.", "warn");
    const owners = ownerUsersForPerson(person);
    const gms = gmUsers();
    if ( mode === "whisper" && !owners.length ) return notify(`У контакта «${person.title}» нет доступного владельца Actor.`, "warn");
    if ( mode === "gm" && !gms.length ) return notify("В мире не найден GM для личного сообщения.", "warn");
    const Message = globalThis.ChatMessage ?? globalThis.foundry?.documents?.ChatMessage;
    if ( !Message?.create ) return notify("API чата Foundry недоступен в этой версии.", "error");
    const body = esc(text).replaceAll("\n", "<br>");
    const label = mode === "gm" ? "Сообщение только для GM" : mode === "whisper" ? `Личное сообщение для ${person.title}` : `Сообщение по контакту: ${person.title}`;
    const data = {
      user: game.user?.id ?? game.user?._id,
      speaker: currentSpeaker(),
      content: `<div class="night-city-field-archive-message"><p class="pcm-chat-note"><b>${esc(label)}</b></p>${contactChatCard(person)}<p>${body}</p></div>`
    };
    if ( mode === "whisper" ) data.whisper = owners.map(user => user.id ?? user._id).filter(Boolean);
    if ( mode === "gm" ) data.whisper = gms.map(user => user.id ?? user._id).filter(Boolean);
    try {
      await Message.create(data);
      state.chatText = "";
      state.chatOpen = false;
      render();
      notify(mode === "gm" ? `Сообщение по «${person.title}» отправлено только GM.` : mode === "whisper" ? `Сообщение отправлено владельцам «${person.title}».` : `Сообщение по «${person.title}» отправлено публично.`);
    } catch (error) {
      console.warn("Полевой архив: сообщение в чат не отправлено", error);
      notify("Не удалось отправить сообщение через чат Foundry.", "error");
    }
  }

  function tokenIdentity(token) {
    const actor = token?.actor ?? token?.document?.actor ?? null;
    const document = token?.document ?? token;
    const name = String(token?.name || document?.name || actor?.name || "Без имени").trim() || "Без имени";
    const actorImage = String(actor?.img ?? "");
    const tokenImage = String(document?.texture?.src ?? token?.texture?.src ?? "");
    return {
      name,
      normalizedName: normalizeName(name),
      actorUuid: String(actor?.uuid ?? ""),
      actorId: String(actor?.id ?? actor?._id ?? document?.actorId ?? ""),
      tokenUuid: String(document?.uuid ?? ""),
      tokenId: String(document?.id ?? document?._id ?? token?.id ?? ""),
      actorImage,
      tokenImage,
      image: tokenImage || actorImage
    };
  }

  function duplicatePerson(book, identity) {
    const stable = book.entries.people.find(entry =>
      (identity.actorUuid && entry.sourceActorUuid === identity.actorUuid)
      || (identity.actorId && entry.sourceActorId === identity.actorId)
      || (identity.tokenUuid && entry.sourceTokenUuid === identity.tokenUuid)
    );
    if ( stable ) return stable;
    return book.entries.people.find(entry => {
      const hasStoredIdentity = entry.sourceActorUuid || entry.sourceActorId || entry.sourceTokenUuid;
      return !hasStoredIdentity && normalizeName(entry.title) === identity.normalizedName;
    }) ?? null;
  }

  function sceneIdentity(scene = globalThis.canvas?.scene) {
    return {
      scene,
      id: String(scene?.id ?? scene?._id ?? ""),
      uuid: String(scene?.uuid ?? ""),
      name: String(scene?.name ?? "").trim()
    };
  }

  function sceneCaptureToken() {
    const canvas = globalThis.canvas;
    if ( !canvas?.scene ) return null;
    const controlled = Array.from(canvas.tokens?.controlled ?? []).filter(Boolean);
    if ( controlled.length ) return controlled[0];

    const activeActor = actorById(state.store.activeActorId) ?? game?.user?.character ?? null;
    const activeActorId = String(activeActor?.id ?? activeActor?._id ?? "");
    if ( !activeActorId ) return null;
    return Array.from(canvas.tokens?.placeables ?? []).find(token => {
      const tokenActorId = String(token?.actor?.id ?? token?.actor?._id ?? token?.document?.actorId ?? "");
      return tokenActorId === activeActorId;
    }) ?? null;
  }

  function controlledTokenIds() {
    return Array.from(globalThis.canvas?.tokens?.controlled ?? []).map(token => tokenKey(token)).filter(Boolean);
  }

  function restoreControlledTokens(ids = []) {
    const canvas = globalThis.canvas;
    const wanted = new Set(ids.map(String));
    try { canvas?.tokens?.releaseAll?.(); } catch (_error) { /* Ничего не делаем: восстановление управления не должно ломать архив. */ }
    for ( const token of Array.from(canvas?.tokens?.placeables ?? []) ) {
      if ( !wanted.has(tokenKey(token)) ) continue;
      try { token.control?.({ releaseOthers: false }); } catch (_error) { /* Токен мог исчезнуть во время снимка. */ }
    }
  }

  function nextRenderFrame() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function captureVisibleSceneFromToken(token) {
    const canvas = globalThis.canvas;
    if ( !canvas?.scene || !token ) return "";

    const sourceCanvas = canvas.app?.canvas ?? canvas.app?.renderer?.canvas ?? canvas.app?.view ?? canvas.app?.renderer?.view ?? null;
    if ( !sourceCanvas || !Number(sourceCanvas.width) || !Number(sourceCanvas.height) ) return "";

    const previousControlled = controlledTokenIds();
    const stage = canvas.stage;
    const previousView = {
      x: Number(stage?.pivot?.x ?? 0),
      y: Number(stage?.pivot?.y ?? 0),
      scale: Number(stage?.scale?.x ?? 1) || 1
    };
    const center = token.center ?? {
      x: Number(token?.document?.x ?? token?.x ?? 0) + Number(token?.w ?? 0) / 2,
      y: Number(token?.document?.y ?? token?.y ?? 0) + Number(token?.h ?? 0) / 2
    };

    try {
      try { token.control?.({ releaseOthers: true }); } catch (_error) { /* Если токен уже единственный контролируемый, продолжаем. */ }
      try {
        if ( canvas.animatePan ) await canvas.animatePan({ x: center.x, y: center.y, scale: previousView.scale, duration: 0 });
        else canvas.pan?.({ x: center.x, y: center.y, scale: previousView.scale });
      } catch (_error) { /* Если камера заблокирована настройками сцены, используем текущий viewport. */ }

      try { canvas.perception?.update?.({ refreshVision: true, refreshLighting: true }, true); } catch (_error) { /* API отличается между версиями. */ }
      await nextRenderFrame();

      const sourceWidth = Math.max(1, Number(sourceCanvas.width) || 1);
      const sourceHeight = Math.max(1, Number(sourceCanvas.height) || 1);
      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
      const snapshot = document.createElement("canvas");
      snapshot.width = Math.max(1, Math.round(sourceWidth * scale));
      snapshot.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = snapshot.getContext("2d", { alpha: false });
      if ( !context ) return "";
      context.fillStyle = "#000";
      context.fillRect(0, 0, snapshot.width, snapshot.height);
      context.drawImage(sourceCanvas, 0, 0, sourceWidth, sourceHeight, 0, 0, snapshot.width, snapshot.height);

      const blob = await new Promise(resolve => snapshot.toBlob(resolve, "image/webp", 0.82));
      if ( !blob ) return snapshot.toDataURL("image/webp", 0.82);
      const file = new File([blob], `token-vision-${Date.now()}.webp`, { type: "image/webp" });
      return await uploadClipboardImage(file, "token-vision");
    } catch (error) {
      console.warn("Полевой архив: безопасный снимок зрения токена не создан", error);
      return "";
    } finally {
      try {
        if ( canvas.animatePan ) await canvas.animatePan({ x: previousView.x, y: previousView.y, scale: previousView.scale, duration: 0 });
        else canvas.pan?.({ x: previousView.x, y: previousView.y, scale: previousView.scale });
      } catch (_error) { /* Не мешаем основному потоку. */ }
      restoreControlledTokens(previousControlled);
      try { canvas.perception?.update?.({ refreshVision: true, refreshLighting: true }, true); } catch (_error) { /* API отличается между версиями. */ }
    }
  }

  function findSceneLocation(book, scene = globalThis.canvas?.scene) {
    if ( !scene ) return null;
    const identity = sceneIdentity(scene);
    const stable = book.entries.locations.find(entry =>
      (identity.uuid && entry.sourceSceneUuid === identity.uuid)
      || (identity.id && entry.sourceSceneId === identity.id)
    );
    if ( stable ) return stable;
    return book.entries.locations.find(entry => {
      const hasStoredIdentity = entry.sourceSceneUuid || entry.sourceSceneId;
      return !hasStoredIdentity && identity.name && normalizeName(entry.title) === normalizeName(identity.name);
    }) ?? null;
  }

  async function ensureSceneLocation(book, { create = true, refreshCapture = true } = {}) {
    const identity = sceneIdentity();
    if ( !identity.scene ) return { location: null, created: false, changed: false, captured: false };
    let location = findSceneLocation(book, identity.scene);
    let created = false;
    let changed = false;
    if ( !location && create ) {
      location = blankEntry("locations");
      location.title = identity.name || "Текущая точка";
      location.kind = "Точка со сцены";
      location.firstVisited = new Date().toISOString().slice(0, 10);
      location.sourceSceneUuid = identity.uuid;
      location.sourceSceneId = identity.id;
      book.entries.locations.push(location);
      created = true;
      changed = true;
    }
    if ( !location ) return { location: null, created, changed, captured: false };

    if ( identity.uuid && !location.sourceSceneUuid ) { location.sourceSceneUuid = identity.uuid; changed = true; }
    if ( identity.id && !location.sourceSceneId ) { location.sourceSceneId = identity.id; changed = true; }

    const fullSceneBackground = String(identity.scene?.background?.src ?? identity.scene?.img ?? "");
    if ( fullSceneBackground && location.image === fullSceneBackground ) {
      location.image = "";
      location.sceneCaptureMode = "";
      changed = true;
    }

    let captured = false;
    if ( refreshCapture ) {
      const captureToken = sceneCaptureToken();
      if ( !captureToken ) {
        notify("Нет доступного токена для безопасного снимка точки. Точка сохранена без изображения.", "warn");
      } else {
        const safeImage = await captureVisibleSceneFromToken(captureToken);
        if ( safeImage ) {
          location.image = safeImage;
          location.sceneCaptureMode = "token-vision";
          location.sceneCaptureTokenId = tokenKey(captureToken);
          location.sceneCaptureAt = now();
          captured = true;
          changed = true;
        } else {
          notify("Не удалось создать безопасный снимок зрения токена. Полный фон сцены не сохранён.", "warn");
        }
      }
    }

    if ( changed ) location.updatedAt = now();
    return { location, created, changed, captured };
  }

  function linkScenePeople(book, scene, location) {
    if ( !scene || !location ) return 0;
    const identity = sceneIdentity(scene);
    let linked = 0;
    for ( const person of book.entries.people ) {
      const cameFromScene = (identity.uuid && person.sourceSceneUuid === identity.uuid)
        || (identity.id && person.sourceSceneId === identity.id)
        || (identity.name && normalizeName(person.firstMet) === normalizeName(identity.name));
      if ( !cameFromScene || entryLocationIds(person).includes(location.id) ) continue;
      setEntryLocations(person, [...entryLocationIds(person), location.id]);
      linked += 1;
    }
    return linked;
  }

  function registerEncounter(person, scene, location) {
    const identity = sceneIdentity(scene);
    const at = now();
    const day = at.slice(0, 10);
    person.encounters = Array.isArray(person.encounters) ? person.encounters : [];
    const last = person.encounters.at(-1);
    const sameToday = last && String(last.at || "").slice(0, 10) === day
      && ((identity.id && last.sceneId === identity.id) || (location?.id && last.locationId === location.id));
    if ( !sameToday ) {
      person.encounters.push({
        id: uid(), at,
        sceneId: identity.id,
        sceneUuid: identity.uuid,
        sceneName: identity.name || location?.title || "",
        locationId: location?.id || ""
      });
      person.encounters = person.encounters.slice(-60);
    }
    const place = identity.name || location?.title || "";
    if ( place ) person.lastSeen = `${place} · ${day}`;
  }

  function addImageToGallery(person, image, caption) {
    if ( !image ) return false;
    if ( person.image === image || person.gallery.some(item => item.image === image) ) return false;
    person.gallery.push({ id: uid(), image, caption });
    return true;
  }

  async function importFromTokens(options = {}) {
    const tokens = selectedTokens();
    if ( !tokens.length ) return notify("Сначала отметьте токены целями клавишей T или выделите их на сцене.", "warn");
    const book = notebook();
    const scene = globalThis.canvas?.scene ?? null;
    let location = options.locationId ? book.entries.locations.find(item => item.id === options.locationId) ?? null : null;
    let sceneResult = { location: null, created: false, changed: false };
    if ( !location && scene ) {
      sceneResult = await ensureSceneLocation(book, { create: true, refreshCapture: true });
      location = sceneResult.location;
    }
    const seen = new Set();
    const added = [];
    const existing = [];
    let updated = 0;
    for ( const token of tokens ) {
      const identity = tokenIdentity(token);
      const batchKey = identity.actorUuid || identity.actorId || identity.tokenUuid || identity.normalizedName;
      if ( seen.has(batchKey) ) continue;
      seen.add(batchKey);
      let person = duplicatePerson(book, identity);
      let changed = false;
      if ( !person ) {
        person = blankEntry("people");
        person.title = identity.name;
        person.image = identity.tokenImage || identity.actorImage;
        person.firstMet = scene?.name ?? location?.title ?? "";
        person.sourceActorUuid = identity.actorUuid;
        person.sourceActorId = identity.actorId;
        person.sourceTokenUuid = identity.tokenUuid;
        person.sourceTokenId = identity.tokenId;
        person.sourceSceneUuid = String(scene?.uuid ?? "");
        person.sourceSceneId = String(scene?.id ?? scene?._id ?? "");
        if ( identity.actorImage && identity.tokenImage && identity.actorImage !== identity.tokenImage ) {
          person.gallery.push({ id: uid(), image: identity.actorImage, caption: "Изображение Actor" });
          person.gallery.push({ id: uid(), image: identity.tokenImage, caption: "Изображение токена" });
        } else if ( identity.image ) person.gallery.push({ id: uid(), image: identity.image, caption: "Импортировано из Foundry" });
        if ( location ) setEntryLocations(person, [location.id]);
        registerEncounter(person, scene, location);
        if ( options.contactType ) assignContactType(person, options.contactType, options.contactGroup || "");
        book.entries.people.push(person);
        added.push(person);
        continue;
      }
      existing.push(person);
      for ( const [field, value] of [["sourceActorUuid", identity.actorUuid], ["sourceActorId", identity.actorId], ["sourceTokenUuid", identity.tokenUuid], ["sourceTokenId", identity.tokenId]] ) {
        if ( value && !person[field] ) { person[field] = value; changed = true; }
      }
      if ( identity.image && !person.image ) { person.image = identity.tokenImage || identity.actorImage; changed = true; }
      if ( scene?.name && !person.firstMet ) { person.firstMet = scene.name; changed = true; }
      if ( scene?.uuid ) person.sourceSceneUuid ||= String(scene.uuid);
      if ( scene?.id ?? scene?._id ) person.sourceSceneId ||= String(scene.id ?? scene._id);
      if ( location && !entryLocationIds(person).includes(location.id) ) { setEntryLocations(person, [...entryLocationIds(person), location.id]); changed = true; }
      changed = addImageToGallery(person, identity.actorImage, "Изображение Actor") || changed;
      changed = addImageToGallery(person, identity.tokenImage, "Изображение токена") || changed;
      const beforeMeetings = person.encounters?.length ?? 0;
      registerEncounter(person, scene, location);
      if ( (person.encounters?.length ?? 0) !== beforeMeetings ) changed = true;
      if ( options.contactType ) { assignContactType(person, options.contactType, options.contactGroup || ""); changed = true; }
      if ( changed ) { person.updatedAt = now(); updated += 1; }
    }
    if ( added.length || updated || sceneResult.changed ) dirty();
    if ( !options.stay ) {
      resetView("people");
      const focus = added.length === 1 && tokens.length === 1 ? added[0] : (!added.length && existing.length === 1 ? existing[0] : null);
      if ( focus ) { state.viewMode = "person"; state.viewId = focus.id; }
    }
    render();
    const parts = [];
    if ( added.length ) parts.push(`добавлено ${added.length}`);
    if ( existing.length ) parts.push(`уже было ${existing.length}`);
    if ( updated ) parts.push(`обновлено ${updated}`);
    if ( sceneResult.created && location ) parts.push(`создана точка «${location.title}»`);
    notify(`Контакты обработаны: ${parts.join(", ") || "без изменений"}.`);
  }

  async function importFromScene(options = {}) {
    const scene = globalThis.canvas?.scene;
    if ( !scene ) return notify("Нет активной сцены.", "warn");
    const book = notebook();
    const result = await ensureSceneLocation(book, { create: true, refreshCapture: true });
    if ( !result.location ) return notify("Не удалось определить текущую сцену.", "error");
    const linked = linkScenePeople(book, scene, result.location);
    if ( result.changed || linked ) dirty();
    if ( !options.stay ) {
      resetView("locations");
      state.viewMode = "location";
      state.viewId = result.location.id;
    }
    render();
    notify(result.created
      ? `Точка «${result.location.title}» добавлена из текущей сцены${linked ? `; привязано персонажей: ${linked}` : ""}.`
      : `Точка «${result.location.title}» уже была в кодексе${linked ? `; привязано персонажей: ${linked}` : ""}.`);
  }

  async function exportSectionToJournal(key) {
    const book = notebook();
    const section = SECTIONS[key];
    const list = book.entries[key];
    if ( !list?.length ) return notify("В этом разделе пока нечего переносить в журнал.", "warn");
    const pages = list.map(entry => {
      const parts = [];
      if ( entry.image ) parts.push(`<p><img src="${esc(entry.image)}" style="max-width:420px"></p>`);
      if ( entry.summary ) parts.push(`<p><em>${esc(entry.summary)}</em></p>`);
      if ( entry.content ) parts.push(`<p>${esc(entry.content).replaceAll("\n", "<br>")}</p>`);
      if ( entry.tags ) parts.push(`<p><small>Теги: ${esc(entry.tags)}</small></p>`);
      if ( entry.type === "books" ) parts.push(`<p><b>Расшифровка:</b> ${clampPercent(entry.decodingProgress)}% — ${esc(decodingPhase(entry.decodingProgress).label)}</p>`);
      if ( DIRECTORY_TYPES.has(entry.type) ) {
        parts.push(`<p>${directoryBadges(entry).map(value => `<b>${esc(value)}</b>`).join(" · ")}</p>${entry.quickNotes ? `<blockquote>${esc(entry.quickNotes).replaceAll("\n", "<br>")}</blockquote>` : ""}`);
      }
      if ( entry.type === "people" ) {
        const links = [
          entry.gang ? `Связь с бандой: ${entry.gang}` : "",
          entry.corporation ? `Связь с корпорацией: ${entry.corporation}` : "",
          entry.fixer ? `Его фиксер: ${entry.fixer}` : "",
          entry.ripper ? `Его рипер: ${entry.ripper}` : ""
        ].filter(Boolean);
        if ( links.length ) parts.push(`<p>${links.map(value => `<b>${esc(value)}</b>`).join(" · ")}</p>`);
      }
      for ( const fragment of entry.fragments ) {
        parts.push(`<h3>${esc(fragment.title)}</h3>`);
        if ( fragment.image ) parts.push(`<p><img src="${esc(fragment.image)}" style="max-width:420px"></p>`);
        if ( fragment.content ) parts.push(`<p>${esc(fragment.content).replaceAll("\n", "<br>")}</p>`);
      }
      return { name: (entry.title || "Запись").slice(0, 120), type: "text", text: { content: parts.join("") || "<p>—</p>", format: 1 } };
    });
    try {
      if ( !globalThis.JournalEntry?.create ) throw new Error("JournalEntry.create недоступен");
      const journal = await JournalEntry.create({ name: `Полевой архив: ${book.actorName} — ${section.label} (${new Date().toISOString().slice(0, 10)})`, pages });
      journal?.sheet?.render(true);
      notify(`Раздел «${section.label}» перенесён в журнал Foundry: ${pages.length} стр.`);
    } catch (error) {
      console.warn("Полевой архив: экспорт в JournalEntry не удался", error);
      notify("Не удалось создать JournalEntry. Проверьте права на создание журналов.", "error");
    }
  }

  function removeEntry(entry) {
    const book = notebook();
    book.entries[entry.type] = book.entries[entry.type].filter(item => item.id !== entry.id);
    if ( entry.type === "locations" ) {
      for ( const type of LOCATION_LINK_TYPES ) {
        for ( const linkedEntry of book.entries[type] ) {
          const locationIds = entryLocationIds(linkedEntry);
          if ( locationIds.includes(entry.id) ) setEntryLocations(linkedEntry, locationIds.filter(id => id !== entry.id));
        }
      }
    }
    if ( entry.type === "people" ) {
      for ( const quest of book.entries.quests ) if ( quest.giverId === entry.id ) quest.giverId = "";
      for ( const clue of book.entries.clues ) if ( clue.personId === entry.id ) clue.personId = "";
    }
  }

  function exportData() {
    const payload = { app: "night-city-field-archive", version: VERSION, macroVersion: MACRO_VERSION, variant: VARIANT, exportedAt: now(), worldId, userId, data: state.store };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `night-city-field-archive-${worldId}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    notify("Резервная копия блокнота сохранена.");
  }

  async function importData(file) {
    try {
      const payload = JSON.parse(await file.text());
      if ( payload.app !== "night-city-field-archive" || !payload.data?.notebooks ) throw new Error("Неверный формат копии");
      if ( !confirm("Импорт заменит текущие блокноты этого пользователя. Продолжить?") ) return;
      state.store = normalize(payload.data);
      if ( !actorIds.has(state.store.activeActorId) ) state.store.activeActorId = state.actors[0]?.id ?? state.actors[0]?._id;
      resetView("dashboard");
      dirty();
      await saveServer(true);
      render();
      notify("Блокноты восстановлены из копии.");
    } catch (error) { notify(`Импорт не выполнен: ${error.message}`, "error"); }
  }

  const clampNumber = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number.isFinite(Number(value)) ? Number(value) : minimum));

  function windowLimits(viewportWidth = innerWidth, viewportHeight = innerHeight) {
    const width = Math.max(240, Number(viewportWidth) || 240);
    const height = Math.max(180, Number(viewportHeight) || 180);
    const maxWidth = Math.max(220, width - WINDOW_EDGE_GAP * 2);
    const maxHeight = Math.max(150, height - WINDOW_EDGE_GAP * 2);
    return {
      viewportWidth: width,
      viewportHeight: height,
      minWidth: Math.min(WINDOW_MIN_WIDTH, maxWidth),
      minHeight: Math.min(WINDOW_MIN_HEIGHT, maxHeight),
      maxWidth,
      maxHeight
    };
  }

  function loadWindowPrefs() {
    const limits = windowLimits();
    try {
      const raw = JSON.parse(localStorage.getItem(windowKey) || "null") || {};
      const width = clampNumber(Number(raw.width) || 780, limits.minWidth, limits.maxWidth);
      const height = clampNumber(Number(raw.height) || Math.min(780, innerHeight - 90), limits.minHeight, limits.maxHeight);
      const defaultLeft = Math.max(WINDOW_EDGE_GAP, limits.viewportWidth - width - 18);
      const defaultTop = 70;
      return {
        left: Number.isFinite(Number(raw.left)) ? clampNumber(Number(raw.left), WINDOW_EDGE_GAP, Math.max(WINDOW_EDGE_GAP, limits.viewportWidth - width - WINDOW_EDGE_GAP)) : defaultLeft,
        top: Number.isFinite(Number(raw.top)) ? clampNumber(Number(raw.top), WINDOW_EDGE_GAP, Math.max(WINDOW_EDGE_GAP, limits.viewportHeight - height - WINDOW_EDGE_GAP)) : defaultTop,
        width,
        height,
        minimized: Boolean(raw.minimized),
        navCollapsed: Boolean(raw.navCollapsed)
      };
    } catch (_error) {
      const width = clampNumber(780, limits.minWidth, limits.maxWidth);
      const height = clampNumber(Math.min(780, innerHeight - 90), limits.minHeight, limits.maxHeight);
      return { left: Math.max(WINDOW_EDGE_GAP, innerWidth - width - 18), top: 70, width, height, minimized: false, navCollapsed: false };
    }
  }

  function saveWindowPrefs() {
    try { localStorage.setItem(windowKey, JSON.stringify(state.windowPrefs)); } catch (_error) {}
  }

  function resizedWindowGeometry(initial, direction, deltaX, deltaY, viewportWidth = innerWidth, viewportHeight = innerHeight) {
    const limits = windowLimits(viewportWidth, viewportHeight);
    const original = {
      left: clampNumber(initial.left, WINDOW_EDGE_GAP, limits.viewportWidth - WINDOW_EDGE_GAP),
      top: clampNumber(initial.top, WINDOW_EDGE_GAP, limits.viewportHeight - WINDOW_EDGE_GAP),
      width: clampNumber(initial.width, limits.minWidth, limits.maxWidth),
      height: clampNumber(initial.height, limits.minHeight, limits.maxHeight)
    };
    const fixedRight = original.left + original.width;
    const fixedBottom = original.top + original.height;
    let left = original.left;
    let top = original.top;
    let right = fixedRight;
    let bottom = fixedBottom;
    if ( direction.includes("w") ) left = clampNumber(original.left + deltaX, WINDOW_EDGE_GAP, fixedRight - limits.minWidth);
    if ( direction.includes("e") ) right = clampNumber(fixedRight + deltaX, original.left + limits.minWidth, limits.viewportWidth - WINDOW_EDGE_GAP);
    if ( direction.includes("n") ) top = clampNumber(original.top + deltaY, WINDOW_EDGE_GAP, fixedBottom - limits.minHeight);
    if ( direction.includes("s") ) bottom = clampNumber(fixedBottom + deltaY, original.top + limits.minHeight, limits.viewportHeight - WINDOW_EDGE_GAP);
    return { left, top, width: right - left, height: bottom - top };
  }

  function detectFoundryUiScale() {
    const values = [];
    const rootStyle = globalThis.getComputedStyle?.(document.documentElement);
    for ( const name of ["--ui-scale", "--ui-scale-factor", "--foundry-ui-scale", "--interface-scale"] ) {
      const raw = rootStyle?.getPropertyValue?.(name)?.trim?.() || "";
      const value = Number.parseFloat(raw);
      if ( Number.isFinite(value) && value >= 0.6 && value <= 2.2 ) values.push(value);
    }

    // Works with core Foundry and with most UI scaling solutions without depending on them.
    for ( const selector of ["#ui-left", "#ui-right", "#sidebar", "#hotbar", "#players"] ) {
      const element = document.querySelector?.(selector);
      if ( !element ) continue;
      const rect = element.getBoundingClientRect?.();
      const width = Number(element.offsetWidth) || 0;
      const height = Number(element.offsetHeight) || 0;
      if ( rect && width > 20 ) {
        const ratio = rect.width / width;
        if ( Number.isFinite(ratio) && ratio >= 0.6 && ratio <= 2.2 ) values.push(ratio);
      } else if ( rect && height > 20 ) {
        const ratio = rect.height / height;
        if ( Number.isFinite(ratio) && ratio >= 0.6 && ratio <= 2.2 ) values.push(ratio);
      }
    }

    if ( !values.length ) return 1;
    values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    return clampNumber(median, 0.72, 1.6);
  }

  function applyWindowGeometry() {
    const win = state.root?.querySelector?.(".pcm-window");
    if ( !win ) return;
    state.windowPrefs ??= loadWindowPrefs();
    const p = state.windowPrefs;
    const limits = windowLimits();
    p.width = clampNumber(p.width, limits.minWidth, limits.maxWidth);
    p.height = clampNumber(p.height, limits.minHeight, limits.maxHeight);
    const visibleWidth = p.minimized ? Math.min(WINDOW_MINIMIZED_WIDTH, limits.maxWidth) : p.width;
    const visibleHeight = p.minimized ? Math.min(WINDOW_MINIMIZED_HEIGHT, limits.maxHeight) : p.height;

    const foundryScale = detectFoundryUiScale();
    const widthFactor = p.minimized ? 1 : clampNumber(visibleWidth / 1100, 0.84, 1.12);
    const heightFactor = p.minimized ? 1 : clampNumber(visibleHeight / 720, 0.88, 1.08);
    const windowScale = clampNumber((widthFactor * 0.72) + (heightFactor * 0.28), 0.84, 1.12);
    const uiScale = clampNumber(foundryScale * windowScale, 0.82, 1.38);
    const contextScale = clampNumber(foundryScale, 0.90, 1.52);
    state.root.style.setProperty("--pcm-foundry-scale", foundryScale.toFixed(3));
    state.root.style.setProperty("--pcm-window-scale", windowScale.toFixed(3));
    state.root.style.setProperty("--pcm-ui-scale", uiScale.toFixed(3));
    state.root.style.setProperty("--pcm-context-scale", contextScale.toFixed(3));

    p.left = clampNumber(p.left, WINDOW_EDGE_GAP, Math.max(WINDOW_EDGE_GAP, limits.viewportWidth - visibleWidth - WINDOW_EDGE_GAP));
    p.top = clampNumber(p.top, WINDOW_EDGE_GAP, Math.max(WINDOW_EDGE_GAP, limits.viewportHeight - visibleHeight - WINDOW_EDGE_GAP));
    Object.assign(win.style, { left: `${p.left}px`, top: `${p.top}px`, width: `${visibleWidth}px`, height: `${visibleHeight}px` });
    win.classList.toggle("is-minimized", p.minimized);
    win.classList.toggle("nav-collapsed", p.navCollapsed);
    win.classList.toggle("is-compact", !p.minimized && visibleWidth < 760);
    win.classList.toggle("is-narrow", !p.minimized && visibleWidth < 560);
    win.classList.toggle("is-tiny", !p.minimized && visibleWidth < 440);
    win.classList.toggle("is-short", !p.minimized && visibleHeight < 520);
    const toggle = win.querySelector('[data-action="toggle-minimize"]');
    if ( toggle ) {
      const label = p.minimized ? "Развернуть" : "Свернуть";
      const title = p.minimized ? "Развернуть окно" : "Свернуть окно";
      toggle.title = title;
      toggle.setAttribute("aria-label", title);
      const icon = toggle.querySelector("[data-window-toggle-icon]");
      const text = toggle.querySelector("[data-window-toggle-label]");
      if ( icon ) icon.textContent = p.minimized ? "▣" : "—";
      if ( text ) text.textContent = label;
    }
    if ( state.contactContext || state.entryContext ) syncArchiveContextTheme(state.root, contextOverlayHost());
    if ( state.contactContext ) requestAnimationFrame(() => fitContextMenuToViewport(archiveContextOverlay?.querySelector?.(".pcm-contact-context-menu"), state.contactContext.x, state.contactContext.y));
    if ( state.entryContext ) requestAnimationFrame(() => fitContextMenuToViewport(archiveContextOverlay?.querySelector?.(".pcm-entry-context-menu"), state.entryContext.x, state.entryContext.y));
  }

  function autoGrowTextareas() {
    for ( const area of state.root?.querySelectorAll?.("textarea[data-autogrow]") ?? [] ) {
      const containerHeight = area.closest("main")?.clientHeight || state.root?.querySelector?.(".pcm-window")?.clientHeight || innerHeight;
      const maximum = Math.max(120, Math.min(560, containerHeight * 0.62));
      const minimum = Math.max(0, Number.parseFloat(globalThis.getComputedStyle?.(area)?.minHeight) || 0);

      // Важно сначала реально сжать поле. height:auto при flex/grid может сохранить
      // прежнюю растянутую высоту, из-за чего scrollHeight не уменьшается.
      area.style.height = "0px";
      const naturalHeight = area.scrollHeight + 2;
      const nextHeight = Math.max(minimum, Math.min(naturalHeight, maximum));
      area.style.height = `${nextHeight}px`;
      area.style.overflowY = naturalHeight > maximum ? "auto" : "hidden";
    }
  }

  const CSS = `
  #pcm-root{--bg:#0e1619;--panel:#182428;--panel2:#1d2c30;--ink:#ebe6d9;--heading:#f4eee0;--muted:#9ca6a5;--gold:#e2c887;--teal:#78c8c0;--line:#e2c88747;--accent-soft:#e2c8871f;--accent-hover:#e2c88738;--secondary-soft:#78c8c021;--primary-ink:#152125;--accent-deep:#cbae68;--chrome:#080f11;--sidebar:#071013;--field:#020607a8;--font-size:13px;position:fixed;inset:0;z-index:1000000;background:#020708b8;display:grid;place-items:center;font:var(--font-size)/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif;color:var(--ink);backdrop-filter:blur(3px)}
  #pcm-root *,#pcm-root *::before,#pcm-root *::after{box-sizing:border-box;min-width:0}#pcm-root button,#pcm-root input,#pcm-root select,#pcm-root textarea{max-width:100%;font:inherit}#pcm-root button{min-height:32px;padding:0 11px;color:var(--ink);background:#ffffff09;border:1px solid #ffffff18;border-radius:8px;cursor:pointer;white-space:normal;overflow-wrap:anywhere}#pcm-root button:hover{border-color:var(--gold);background:var(--accent-soft)}#pcm-root .primary{color:var(--primary-ink);background:linear-gradient(135deg,var(--gold),var(--accent-deep));border-color:var(--gold);font-weight:800}#pcm-root .danger{color:#ec887c}
  #pcm-root .pcm-window{position:relative;width:min(1220px,calc(100vw - 24px));height:min(840px,calc(100vh - 24px));overflow:hidden;background:radial-gradient(circle at 90% -20%,var(--secondary-soft),transparent 38%),var(--bg);border:1px solid var(--line);border-radius:16px;box-shadow:0 28px 90px #000b}
  #pcm-root .pcm-top{height:72px;padding:9px 14px;display:flex;align-items:center;gap:8px;overflow:hidden;background:var(--chrome);border-bottom:1px solid var(--line)}#pcm-root .pcm-top>button{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}#pcm-root .pcm-brand{min-width:150px;flex:1 1 330px;display:flex;align-items:center;gap:10px;overflow:hidden}#pcm-root .pcm-brand>div{min-width:0;overflow:hidden}#pcm-root .pcm-brand img{width:48px;height:48px;flex:0 0 48px;object-fit:cover;border-radius:13px;border:1px solid var(--line)}#pcm-root .pcm-brand small,#pcm-root .pcm-section-head small,#pcm-root .pcm-welcome span{display:block;overflow:hidden;color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.14em;text-overflow:ellipsis;white-space:nowrap}#pcm-root .pcm-brand select{width:min(250px,100%);height:26px;padding:0;color:var(--ink);background:transparent;border:0;font-size:17px;font-weight:800;text-overflow:ellipsis}#pcm-root [data-save-badge]{flex:0 0 auto;margin-right:2px;color:#a7dcb9;font-size:11px;white-space:nowrap}#pcm-root [data-save-badge][data-mode=local]{color:#e5c87e}#pcm-root [data-save-badge][data-mode=pending]{color:var(--teal)}#pcm-root .pcm-close{width:34px;padding:0;font-size:22px}
  #pcm-root .pcm-layout{height:calc(100% - 72px);display:grid;grid-template-columns:clamp(220px,18%,240px) minmax(0,1fr)}#pcm-root aside{padding:13px 10px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;overflow-x:hidden;background:var(--sidebar);border-right:1px solid var(--line)}#pcm-root aside>button{width:100%;min-height:34px;padding:0 8px;display:grid;grid-template-columns:24px minmax(0,1fr) 24px;gap:6px;align-items:center;text-align:left;border-color:transparent}#pcm-root aside>button>b{width:24px;text-align:center;white-space:nowrap}#pcm-root aside>button>span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.12;font-size:clamp(11px,calc(var(--font-size) - 1px),13px);letter-spacing:0}#pcm-root aside>button.active{color:var(--gold);background:var(--accent-soft);border-color:var(--line)}#pcm-root aside>button i{width:24px;min-width:24px;max-width:24px;padding:2px 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:9px;font-style:normal;background:#ffffff0c;border-radius:9px}#pcm-root .pcm-caption{max-width:100%;margin:14px 9px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.1em}#pcm-root .pcm-goal{margin-top:auto;padding:11px;display:grid;gap:6px;border:1px solid var(--line);border-radius:11px}#pcm-root .pcm-goal span{color:var(--gold);font-size:9px;font-weight:900}#pcm-root .pcm-goal textarea{height:68px;padding:6px;resize:vertical;color:var(--ink);background:var(--field);border:0;border-radius:7px}#pcm-root .pcm-help{color:var(--muted);font-size:10px;text-align:center}
  #pcm-root main{min-width:0;padding:22px;overflow-y:auto;overflow-x:hidden}#pcm-root h1{margin:3px 0;color:var(--heading);font:750 28px/1.12 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif;overflow-wrap:anywhere}#pcm-root h2{margin:0;font-size:15px;overflow-wrap:anywhere}#pcm-root p,#pcm-root span,#pcm-root small,#pcm-root b{overflow-wrap:anywhere}#pcm-root .pcm-welcome{min-height:120px;padding:5px 8px 14px;display:flex;align-items:center;gap:18px}#pcm-root .pcm-welcome p{color:var(--muted)}#pcm-root .pcm-welcome img{width:100px;height:100px;flex:0 0 100px;margin-left:auto;object-fit:cover;border:1px solid var(--line);border-radius:52% 48% 55% 45%}
  #pcm-root .pcm-capture,#pcm-root .pcm-quick,#pcm-root .pcm-recent{padding:16px;background:linear-gradient(145deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:14px}#pcm-root .pcm-capture{margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-color:var(--gold);background:linear-gradient(135deg,var(--accent-soft),var(--panel))}#pcm-root .pcm-capture small{color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.12em}#pcm-root .pcm-capture h2{margin:4px 0;font:750 20px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif}#pcm-root .pcm-capture p{margin:0;color:var(--muted)}#pcm-root .pcm-capture>div:last-child{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}#pcm-root .pcm-quick textarea{width:100%;height:78px;margin:10px 0;padding:10px;resize:vertical;color:var(--ink);background:var(--field);border:1px solid #ffffff12;border-radius:9px}#pcm-root .pcm-quick>div{display:flex;flex-wrap:wrap;gap:6px}#pcm-root .pcm-stat-grid{margin:13px 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}#pcm-root .pcm-stat-grid button{min-height:58px;height:auto;display:grid;grid-template-columns:42px 1fr;align-items:center;text-align:left}#pcm-root .pcm-stat-grid b{font:750 24px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial;color:var(--gold)}#pcm-root .pcm-recent{display:grid;gap:5px}#pcm-root .pcm-recent>button{min-height:48px;display:grid;grid-template-columns:28px 1fr;align-items:center;text-align:left}#pcm-root .pcm-recent span,#pcm-root .pcm-recent small{display:block}#pcm-root .pcm-recent small{margin-top:2px;color:var(--muted);font-size:10px}
  #pcm-root .pcm-section-head{margin-bottom:16px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}#pcm-root .pcm-section-head>div:last-child{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}#pcm-root .pcm-search{min-height:33px;padding:0 9px;display:flex;align-items:center;color:var(--muted);background:var(--field);border:1px solid var(--line);border-radius:8px}#pcm-root .pcm-search input{width:min(200px,35vw);color:var(--ink);background:transparent;border:0;outline:0}#pcm-root .pcm-list{display:grid;gap:9px}
  #pcm-root .pcm-view-card{height:auto;min-height:0;overflow:hidden}#pcm-root .pcm-record-open{width:100%;min-height:104px;height:auto;padding:13px 15px;display:grid;grid-template-columns:58px minmax(0,1fr) 26px;align-items:start;gap:13px;text-align:left;background:transparent;border:0;border-radius:0;white-space:normal;overflow:visible}#pcm-root .pcm-record-open:hover{background:var(--accent-soft)}#pcm-root .pcm-record-open>.pcm-thumb{align-self:start;margin-top:2px}#pcm-root .pcm-record-copy{min-width:0;width:100%;display:flex;flex-direction:column;align-items:stretch;gap:4px;overflow:visible;text-align:left}#pcm-root .pcm-record-kicker{display:block!important;margin:0!important;color:var(--muted)!important;font-size:10px!important;font-weight:850!important;line-height:1.2!important;letter-spacing:.08em!important;text-transform:uppercase;white-space:normal!important;overflow-wrap:anywhere}#pcm-root .pcm-record-copy h2{display:block;width:100%;margin:0;color:var(--heading);font-size:19px;line-height:1.22;font-weight:900;text-align:left;white-space:normal;overflow-wrap:anywhere;word-break:normal}#pcm-root .pcm-entry-headline{display:block;width:100%;margin:0;color:var(--teal);font-size:14px;line-height:1.32;font-weight:800;text-align:left;white-space:normal;overflow-wrap:anywhere}#pcm-root .pcm-record-copy>p{display:block;width:100%;margin:2px 0 0;color:var(--muted);font-size:12px;line-height:1.45;text-align:left;white-space:normal;overflow-wrap:anywhere}#pcm-root .pcm-record-copy>small.pcm-record-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:3px}#pcm-root .pcm-record-arrow{align-self:center;justify-self:end;color:var(--gold);font-size:18px;line-height:1}#pcm-root .pcm-detail-headline{margin:3px 0 8px;color:var(--teal);font-size:16px;line-height:1.3;font-weight:750}#pcm-root .pcm-mini-headline{display:block;margin-top:2px;color:var(--teal);font-size:10px;line-height:1.25;font-style:normal;font-weight:750}#pcm-root .pcm-title-fields>.pcm-field.area{grid-column:1/-1}
  #pcm-root .pcm-card{overflow:hidden;background:linear-gradient(135deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:13px}#pcm-root .pcm-card.pinned{border-color:var(--gold)}#pcm-root .pcm-card>summary{min-height:76px;padding:9px 13px;display:grid;grid-template-columns:58px minmax(0,1fr) 18px;align-items:center;gap:11px;list-style:none;cursor:pointer}#pcm-root .pcm-card>summary::-webkit-details-marker,#pcm-root .pcm-fragment>summary::-webkit-details-marker{display:none}#pcm-root .pcm-card>summary h2{font-size:16px;overflow-wrap:anywhere}#pcm-root .pcm-card>summary p{margin:5px 0;color:var(--muted);font-size:11px;overflow-wrap:anywhere}#pcm-root .pcm-card>summary small{display:flex;flex-wrap:wrap;gap:4px;color:var(--muted);font-size:9px}#pcm-root .pcm-tag{min-height:20px!important;padding:1px 6px!important;color:var(--muted);background:var(--field);border-color:transparent!important;border-radius:10px!important;font-size:9px!important}#pcm-root .pcm-tag:hover{color:var(--gold);border-color:var(--line)!important}#pcm-root .pcm-thumb{width:58px;height:58px;display:grid;place-items:center;overflow:hidden;color:var(--gold);background:var(--accent-soft);border:1px solid var(--line);border-radius:10px;font-size:20px}#pcm-root .pcm-thumb img{width:100%;height:100%;object-fit:cover}#pcm-root .pcm-card-body{position:relative;padding:16px;border-top:1px solid var(--line)}#pcm-root .pcm-card-actions{position:absolute;right:12px;top:10px;display:flex;gap:4px}#pcm-root .pcm-card-actions button{width:29px;padding:0}
  #pcm-root .pcm-image-row{padding-right:105px;display:grid;grid-template-columns:140px minmax(0,1fr);align-items:end;gap:12px;margin-bottom:11px}#pcm-root .pcm-cover{height:125px;display:grid;place-items:center;overflow:hidden;color:var(--muted);background:var(--field);border:1px solid var(--line);border-radius:10px;font-size:25px}#pcm-root .pcm-cover small{display:block;font-size:10px}#pcm-root .pcm-cover img{width:100%;height:100%;object-fit:cover}#pcm-root .pcm-path{display:flex;flex-wrap:wrap;gap:5px}#pcm-root .pcm-path input{flex:1 1 180px}#pcm-root .pcm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}#pcm-root .pcm-field{min-width:0;display:grid;gap:4px}#pcm-root .pcm-field.wide{grid-column:1/-1}#pcm-root .pcm-field>span{color:var(--muted);font-size:10px;font-weight:700}#pcm-root .pcm-field input,#pcm-root .pcm-field select,#pcm-root .pcm-field textarea{width:100%;color:var(--ink);background:var(--field);border:1px solid #ffffff16;border-radius:7px;outline:0}#pcm-root .pcm-field input,#pcm-root .pcm-field select{height:31px;padding:0 7px}#pcm-root .pcm-field textarea{min-height:78px;padding:7px;resize:vertical}#pcm-root .pcm-field.area{margin-top:10px}#pcm-root .pcm-field input:focus,#pcm-root .pcm-field textarea:focus,#pcm-root .pcm-field select:focus{border-color:var(--gold)}
  #pcm-root .pcm-sub{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}#pcm-root .pcm-sub>header{display:flex;align-items:center;justify-content:space-between}#pcm-root .pcm-sub h3{margin:0 0 8px;color:var(--gold);font-size:12px}#pcm-root .pcm-task{margin-top:5px;padding:4px 6px;display:grid;grid-template-columns:20px 1fr 26px;align-items:center;gap:5px;background:#0003;border-radius:7px}#pcm-root .pcm-task input[data-task-text]{height:28px;color:var(--ink);background:transparent;border:0}#pcm-root .pcm-task.done input[data-task-text]{color:#707979;text-decoration:line-through}#pcm-root .pcm-task button{padding:0}#pcm-root .pcm-fragment{margin-top:6px;overflow:hidden;background:#0003;border:1px solid #ffffff10;border-radius:9px}#pcm-root .pcm-fragment>summary{padding:10px;cursor:pointer}#pcm-root .pcm-fragment-body{position:relative;padding:11px;border-top:1px solid #ffffff10}#pcm-root .pcm-fragment-delete{position:absolute;right:9px;top:8px;width:28px;padding:0;color:#ec887c}#pcm-root .pcm-fragment-img{max-width:100%;max-height:360px;margin-top:9px;object-fit:contain;border-radius:8px}#pcm-root .pcm-add-fragment{margin-top:12px;display:flex;align-items:center;gap:8px}#pcm-root .pcm-add-fragment span,#pcm-root .muted{color:var(--muted);font-size:10px}
  #pcm-root .pcm-empty,#pcm-root .pcm-no-actors{min-height:350px;display:grid;place-content:center;justify-items:center;text-align:center}#pcm-root .pcm-empty>b{color:#e2c88788;font-size:45px}#pcm-root .pcm-empty p,#pcm-root .pcm-no-actors p{color:var(--muted)}
  #pcm-root .pcm-quick>p{margin:4px 0;color:var(--muted);font-size:11px}#pcm-root .pcm-extra{margin-top:13px;padding:0 11px 11px;background:#0002;border:1px solid #ffffff10;border-radius:9px}#pcm-root .pcm-extra>summary{padding:10px 0;color:var(--gold);cursor:pointer;font-size:11px;font-weight:800}#pcm-root .pcm-extra>.pcm-grid{padding-top:3px}#pcm-root .pcm-field span b{color:var(--gold)}
  #pcm-root .pcm-section-hint{margin:-9px 0 14px;color:var(--muted);font-size:11px}#pcm-root .pcm-location-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#pcm-root .pcm-location-card{overflow:hidden;background:linear-gradient(145deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:14px}#pcm-root .pcm-location-card.pinned{border-color:var(--gold)}#pcm-root .pcm-location-open{width:100%;min-height:145px;padding:0;display:grid;grid-template-columns:142px minmax(0,1fr) 22px;align-items:stretch;text-align:left;border:0;border-radius:0}#pcm-root .pcm-location-image{display:grid;place-items:center;overflow:hidden;color:var(--gold);background:var(--field);font:700 30px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif}#pcm-root .pcm-location-image img{width:100%;height:100%;object-fit:cover}#pcm-root .pcm-location-copy{min-width:0;padding:15px}#pcm-root .pcm-location-copy>small,#pcm-root .pcm-detail-panel>small{color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.12em}#pcm-root .pcm-location-copy h2{margin:4px 0 8px;font:750 20px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif;overflow-wrap:anywhere}#pcm-root .pcm-location-copy p{min-height:30px;margin:0;color:var(--muted);font-size:11px}#pcm-root .pcm-location-counts{margin-top:12px;display:flex;align-items:center;flex-wrap:wrap;gap:5px;color:var(--ink);font-size:10px}#pcm-root .pcm-location-counts span{padding:3px 6px;background:#ffffff0a;border-radius:7px}#pcm-root .pcm-location-counts i{margin-left:auto;color:var(--teal);font-style:normal;white-space:nowrap}
  #pcm-root .pcm-detail-nav{margin-bottom:13px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}#pcm-root .pcm-detail-nav>div{display:flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;gap:6px}#pcm-root .pcm-detail-nav>div>small{color:var(--gold);font-size:9px;letter-spacing:.12em}#pcm-root .pcm-location-hero,#pcm-root .pcm-person-hero{min-height:205px;display:grid;grid-template-columns:270px minmax(0,1fr);overflow:hidden;background:linear-gradient(145deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:15px}#pcm-root .pcm-location-hero-image,#pcm-root .pcm-person-portrait{display:grid;place-items:center;overflow:hidden;color:var(--gold);background:var(--field);font:700 48px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif}#pcm-root .pcm-location-hero-image img,#pcm-root .pcm-person-portrait img{width:100%;height:100%;object-fit:cover}#pcm-root .pcm-location-hero>div:last-child,#pcm-root .pcm-person-hero>div:last-child{padding:22px}#pcm-root .pcm-location-hero small,#pcm-root .pcm-person-hero small{color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.13em}#pcm-root .pcm-location-hero h1,#pcm-root .pcm-person-hero h1{margin:5px 0 9px}#pcm-root .pcm-badges{margin-bottom:11px;display:flex;flex-wrap:wrap;gap:5px}#pcm-root .pcm-badges span{padding:4px 8px;color:var(--ink);background:#ffffff0b;border:1px solid #ffffff12;border-radius:12px;font-size:9px}#pcm-root .pcm-read-text{white-space:pre-wrap;line-height:1.48;color:var(--ink);overflow-wrap:anywhere}#pcm-root .pcm-read-text.empty{color:var(--muted);font-style:italic}#pcm-root .pcm-detail-grid{margin-top:11px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#pcm-root .pcm-detail-panel{min-width:0;padding:15px;background:linear-gradient(145deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:13px}#pcm-root .pcm-detail-panel.wide{grid-column:1/-1}#pcm-root .pcm-detail-panel>header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}#pcm-root .pcm-detail-panel h2{margin:3px 0}#pcm-root .pcm-detail-panel h3{margin:0 0 10px;color:var(--gold);font-size:13px}#pcm-root .pcm-detail-panel h4{margin:14px 0 5px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}
  #pcm-root .pcm-inline-person-note{display:grid;grid-template-rows:auto auto;align-self:start;min-height:0}#pcm-root .pcm-inline-person-note>header{margin-bottom:8px}#pcm-root .pcm-inline-person-note>header h3{margin:0}#pcm-root .pcm-inline-person-note>header small{color:var(--muted);font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}#pcm-root .pcm-inline-person-note textarea{width:100%;min-height:96px;max-height:560px;flex:none;padding:10px 11px;resize:none;color:var(--ink);background:var(--field);border:1px solid #ffffff14;border-radius:9px;line-height:1.55;overflow-y:hidden;outline:none;transition:border-color .15s,background .15s,box-shadow .15s}#pcm-root .pcm-inline-person-note textarea::placeholder{color:var(--muted);font-style:italic;opacity:.82}#pcm-root .pcm-inline-person-note textarea:hover{border-color:#ffffff25}#pcm-root .pcm-inline-person-note textarea:focus{background:var(--field);border-color:var(--gold);box-shadow:0 0 0 2px var(--accent-soft)}
  #pcm-root .pcm-people-grid{margin-top:11px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}#pcm-root .pcm-person-tile{position:relative;min-width:0;overflow:hidden;background:#0003;border:1px solid #ffffff12;border-radius:10px}#pcm-root .pcm-person-open{width:100%;min-height:75px;padding:8px 32px 8px 8px;display:grid;grid-template-columns:54px 1fr;gap:8px;text-align:left;border:0}#pcm-root .pcm-person-image{width:54px;height:54px;display:grid;place-items:center;overflow:hidden;color:var(--gold);background:#ffffff0a;border-radius:8px;font-size:20px}#pcm-root .pcm-person-image img{width:100%;height:100%;object-fit:cover}#pcm-root .pcm-person-open span:last-child{min-width:0}#pcm-root .pcm-person-open b,#pcm-root .pcm-person-open small,#pcm-root .pcm-person-open em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#pcm-root .pcm-person-open small{margin:3px 0;color:var(--teal);font-size:9px}#pcm-root .pcm-person-open em{color:var(--muted);font-size:9px;font-style:normal}#pcm-root .pcm-person-unlink{position:absolute;right:4px;top:4px;width:25px;min-height:25px;padding:0;color:#ce8178;border-color:transparent}#pcm-root .pcm-inline-empty{grid-column:1/-1;padding:18px;text-align:center;color:var(--muted);border:1px dashed #ffffff18;border-radius:9px}#pcm-root .pcm-link-existing{margin-top:10px;padding-top:8px;border-top:1px solid #ffffff10}#pcm-root .pcm-link-existing>summary{color:var(--teal);cursor:pointer;font-size:10px}#pcm-root .pcm-link-existing>div{margin-top:7px;display:flex;flex-wrap:wrap;gap:5px}#pcm-root .pcm-link-existing button small{margin-left:6px;color:var(--muted)}#pcm-root .pcm-related-row{width:100%;margin-top:5px;padding:7px;display:grid;grid-template-columns:22px 1fr 15px;align-items:center;text-align:left}#pcm-root .pcm-related-row span,#pcm-root .pcm-related-row small{display:block}#pcm-root .pcm-related-row small{margin-top:2px;color:var(--muted);font-size:9px}#pcm-root .pcm-related-row i{font-style:normal}#pcm-root .pcm-location-chips{display:flex;flex-wrap:wrap;gap:6px}#pcm-root .pcm-location-chips button{color:var(--teal)}#pcm-root .pcm-read-fragment{margin-top:6px;background:#0003;border:1px solid #ffffff10;border-radius:9px}#pcm-root .pcm-read-fragment>summary{padding:9px;cursor:pointer;color:#d9d5c9}#pcm-root .pcm-read-fragment>div{padding:10px;border-top:1px solid #ffffff10}#pcm-root .pcm-read-fragment img{max-width:100%;max-height:350px;margin-bottom:8px;object-fit:contain;border-radius:8px}#pcm-root .pcm-editor-card{overflow:visible}#pcm-root .pcm-editor-card .pcm-card-body{border:1px solid var(--line);border-radius:13px}#pcm-root .pcm-location-checks{max-height:150px;padding:7px;display:grid;grid-template-columns:1fr 1fr;gap:5px;overflow-y:auto;background:#02060766;border:1px solid #ffffff16;border-radius:7px}#pcm-root .pcm-location-checks label{display:flex;align-items:center;gap:6px;color:#c9cec9;font-size:10px}#pcm-root .pcm-location-checks input{width:15px;height:15px}#pcm-root .pcm-location-checks.empty{display:block;color:var(--muted)}
  #pcm-root .pcm-location-checks{background:var(--field)}#pcm-root .pcm-location-checks label{color:var(--ink)}
  #pcm-root .tone-close{--relation:#d99bd3}#pcm-root .tone-friendly{--relation:#65b994}#pcm-root .tone-neutral{--relation:#95a1a4}#pcm-root .tone-distrust{--relation:#d3a04f}#pcm-root .tone-hostile{--relation:#df776d}#pcm-root .tone-unknown{--relation:#879196}
  #pcm-root .pcm-contact-list{padding:0 9px 9px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#pcm-root .pcm-contact-card{min-width:0;overflow:hidden;background:var(--field);border:1px solid #ffffff12;border-radius:11px}#pcm-root .pcm-contact-card.pinned{border-color:var(--gold)}#pcm-root .pcm-contact-open{width:100%;min-height:104px;padding:9px;display:grid;grid-template-columns:74px minmax(0,1fr) 20px;align-items:center;gap:10px;text-align:left;border:0;border-radius:0}#pcm-root .pcm-contact-open:hover{background:var(--accent-soft)}#pcm-root .pcm-contact-open:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}#pcm-root .pcm-contact-photo{width:74px;height:74px;display:grid;place-items:center;overflow:hidden;color:var(--gold);background:#0003;border:1px solid #ffffff12;border-radius:10px;font:700 26px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif}#pcm-root .pcm-contact-photo img{width:100%;height:100%;object-fit:cover}#pcm-root .pcm-contact-copy{min-width:0;display:block}#pcm-root .pcm-contact-copy>small{display:block;color:var(--teal);font-size:8px;font-weight:900;letter-spacing:.08em}#pcm-root .pcm-contact-copy>strong{display:block;margin:3px 0 4px;color:var(--heading);font:750 17px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#pcm-root .pcm-contact-copy>em{display:-webkit-box;min-height:30px;margin-top:5px;overflow:hidden;color:var(--muted);font-size:10px;font-style:normal;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2}#pcm-root .pcm-contact-meta{margin-top:6px;display:flex;align-items:center;flex-wrap:wrap;gap:7px;color:var(--muted);font-size:8px}#pcm-root .pcm-contact-meta i{font-style:normal}#pcm-root .pcm-contact-open>b{color:var(--teal);font-size:17px;text-align:center}
  #pcm-root .pcm-attitude-list{display:grid;gap:10px}#pcm-root .pcm-attitude-section{overflow:hidden;background:linear-gradient(145deg,var(--panel),var(--panel2));border:1px solid var(--line);border-left:4px solid var(--relation);border-radius:13px}#pcm-root .pcm-attitude-section>summary{min-height:54px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;list-style:none;cursor:pointer}#pcm-root .pcm-attitude-section>summary::-webkit-details-marker{display:none}#pcm-root .pcm-attitude-section>summary>span{display:grid;grid-template-columns:30px minmax(0,1fr);align-items:center;column-gap:8px}#pcm-root .pcm-attitude-section>summary i{grid-row:1/3;width:30px;height:30px;display:grid;place-items:center;color:var(--relation);border:1px solid var(--relation);border-radius:9px;font-style:normal;font-weight:900}#pcm-root .pcm-attitude-section>summary b{font-size:13px}#pcm-root .pcm-attitude-section>summary small{color:var(--muted);font-size:9px}#pcm-root .pcm-attitude-section>summary em{min-width:28px;padding:4px 7px;color:var(--relation);text-align:center;background:#0002;border:1px solid var(--relation);border-radius:12px;font-style:normal;font-weight:900}#pcm-root .pcm-attitude-section>.pcm-list{padding:0 9px 9px}#pcm-root .pcm-attitude-section>.pcm-list>.pcm-card{background:var(--field)}
  #pcm-root .pcm-location-attitudes{display:grid;gap:9px}#pcm-root .pcm-location-attitude{padding:9px;background:var(--field);border:1px solid #ffffff12;border-left:3px solid var(--relation);border-radius:10px}#pcm-root .pcm-location-attitude>header{display:flex;align-items:center;justify-content:space-between;gap:8px}#pcm-root .pcm-location-attitude>header span{display:flex;align-items:center;gap:7px}#pcm-root .pcm-location-attitude>header i{width:22px;height:22px;display:grid;place-items:center;color:var(--relation);border:1px solid var(--relation);border-radius:7px;font-size:9px;font-style:normal}#pcm-root .pcm-location-attitude>header b{font-size:11px}#pcm-root .pcm-location-attitude>header em{min-width:23px;padding:2px 6px;color:var(--relation);text-align:center;background:#0002;border-radius:10px;font-size:9px;font-style:normal;font-weight:900}#pcm-root .pcm-location-attitude .pcm-people-grid{margin-top:7px}
  #pcm-root .pcm-paste-zone{min-height:58px;margin:9px 0;padding:10px 13px;display:flex;align-items:center;justify-content:center;gap:9px;text-align:center;color:var(--muted);background:var(--field);border:1px dashed var(--line);border-radius:10px;outline:0;cursor:copy}#pcm-root .pcm-paste-zone b{padding:5px 8px;color:var(--gold);background:var(--accent-soft);border-radius:7px}#pcm-root .pcm-paste-zone:focus{color:var(--ink);background:var(--accent-soft);border-color:var(--gold);box-shadow:0 0 0 2px var(--accent-soft)}#pcm-root .pcm-fragment-paste{margin-right:40px}
  #pcm-root .pcm-gallery-editor>header{align-items:flex-start;gap:12px}#pcm-root .pcm-gallery-editor>header p{margin:3px 0;color:var(--muted);font-size:10px}#pcm-root .pcm-gallery-edit-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}#pcm-root .pcm-gallery-edit{position:relative;padding:8px;display:grid;grid-template-columns:92px minmax(0,1fr);grid-template-rows:auto auto 1fr;gap:7px;background:var(--field);border:1px solid #ffffff12;border-radius:11px}#pcm-root .pcm-gallery-preview{grid-row:1/4;width:92px;height:110px;padding:0;overflow:hidden}#pcm-root .pcm-gallery-preview img{width:100%;height:100%;object-fit:cover}#pcm-root .pcm-gallery-edit>div{display:flex;flex-wrap:wrap;gap:4px}#pcm-root .pcm-gallery-edit>div button{min-height:27px;padding:0 7px;font-size:9px}#pcm-root .pcm-gallery-edit>small{position:absolute;left:11px;bottom:10px;padding:2px 5px;color:#fff;background:#0009;border-radius:5px;font-size:8px;pointer-events:none}#pcm-root .pcm-gallery-view{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:8px}#pcm-root .pcm-gallery-view button{height:150px;padding:0;display:grid;grid-template-rows:minmax(0,1fr) auto;overflow:hidden;text-align:left}#pcm-root .pcm-gallery-view img{width:100%;height:100%;object-fit:cover}#pcm-root .pcm-gallery-view span{padding:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}#pcm-root .pcm-encounters{display:grid;gap:6px}#pcm-root .pcm-encounters>div{padding:7px 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--field);border:1px solid #ffffff10;border-radius:9px}#pcm-root .pcm-encounters span,#pcm-root .pcm-encounters small{display:block}#pcm-root .pcm-encounters small{margin-top:2px;color:var(--muted);font-size:9px}#pcm-root .pcm-encounters button{min-height:27px;font-size:9px}
  #pcm-root .pcm-modal-backdrop{position:absolute;inset:0;z-index:30;padding:18px;display:grid;place-items:center;background:#000a;backdrop-filter:blur(4px)}#pcm-root .pcm-theme-panel{width:min(780px,100%);max-height:100%;padding:18px;overflow-y:auto;background:linear-gradient(145deg,var(--panel),var(--bg));border:1px solid var(--line);border-radius:16px;box-shadow:0 22px 70px #000b}#pcm-root .pcm-theme-panel>header{display:flex;justify-content:space-between;gap:12px}#pcm-root .pcm-theme-panel>header>div{min-width:0}#pcm-root .pcm-theme-panel>header small{color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.1em}#pcm-root .pcm-theme-panel>header h2{margin:5px 0;font-size:20px}#pcm-root .pcm-theme-panel>header p{margin:0;color:var(--muted);font-size:10px}#pcm-root .pcm-theme-panel>header>button{width:34px;flex:0 0 34px;padding:0;font-size:20px}#pcm-root .pcm-theme-groups{margin:14px 0;display:grid;gap:8px}#pcm-root .pcm-theme-group{background:var(--field);border:1px solid var(--line);border-radius:11px;overflow:hidden}#pcm-root .pcm-theme-group>summary{min-height:48px;padding:9px 11px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;list-style:none}#pcm-root .pcm-theme-group>summary::-webkit-details-marker{display:none}#pcm-root .pcm-theme-group>summary>span{min-width:0;display:grid;grid-template-columns:20px minmax(0,1fr);align-items:center;column-gap:7px}#pcm-root .pcm-theme-group>summary b{grid-row:1/3;color:var(--gold);font-size:15px;text-align:center}#pcm-root .pcm-theme-group>summary strong{color:var(--heading);font-size:11px}#pcm-root .pcm-theme-group>summary small{overflow:hidden;color:var(--muted);font-size:8px;text-overflow:ellipsis;white-space:nowrap}#pcm-root .pcm-theme-group>summary>i{min-width:24px;padding:3px 6px;color:var(--muted);background:var(--panel2);border-radius:99px;font-size:8px;font-style:normal;text-align:center}#pcm-root .pcm-theme-group[open]>summary{border-bottom:1px solid var(--line)}#pcm-root .pcm-theme-presets{padding:9px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}#pcm-root .pcm-theme-presets button{height:68px;padding:6px;display:grid;grid-template-rows:30px auto;gap:5px}#pcm-root .pcm-theme-presets button.active{color:var(--gold);border-color:var(--gold);box-shadow:0 0 0 2px var(--accent-soft)}#pcm-root .pcm-theme-swatch{display:block;background:linear-gradient(135deg,var(--swatch-bg) 0 34%,var(--swatch-panel) 34% 64%,var(--swatch-accent) 64% 82%,var(--swatch-secondary) 82%);border:1px solid #ffffff24;border-radius:6px}#pcm-root .pcm-theme-presets span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}#pcm-root .pcm-theme-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}#pcm-root .pcm-theme-color{min-height:52px;padding:7px;display:flex;align-items:center;gap:8px;background:var(--field);border:1px solid #ffffff12;border-radius:9px}#pcm-root .pcm-theme-color>span{flex:1;font-size:10px;font-weight:800}#pcm-root .pcm-theme-color small{display:block;margin-top:2px;color:var(--muted);font-size:8px;font-weight:400}#pcm-root .pcm-theme-color input{width:42px;height:34px;flex:0 0 42px;padding:2px;background:transparent;border:0;cursor:pointer}#pcm-root .pcm-font-size{margin-top:10px;padding:10px;display:grid;grid-template-columns:190px 1fr;align-items:center;gap:12px;background:var(--field);border-radius:9px}#pcm-root .pcm-font-size span{font-weight:800}#pcm-root .pcm-font-size small{display:block;margin-top:2px;color:var(--muted);font-size:8px;font-weight:400}#pcm-root .pcm-font-size input{width:100%;accent-color:var(--gold)}#pcm-root .pcm-theme-preview{margin-top:10px;padding:13px;background:linear-gradient(145deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:11px}#pcm-root .pcm-theme-preview small{color:var(--gold);font-size:8px;font-weight:900;letter-spacing:.12em}#pcm-root .pcm-theme-preview h3{margin:5px 0;color:var(--heading)}#pcm-root .pcm-theme-preview p{margin:0 0 9px;color:var(--muted)}#pcm-root .pcm-theme-panel>footer{margin-top:13px;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:7px}#pcm-root .pcm-help-grid{margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#pcm-root .pcm-help-grid section{padding:12px;background:var(--field);border:1px solid #ffffff12;border-radius:10px}#pcm-root .pcm-help-grid h3{margin:0 0 5px;color:var(--heading);font-size:13px}#pcm-root .pcm-help-grid p{margin:0;color:var(--muted);line-height:1.45}
  #pcm-root .pcm-lightbox{position:absolute;inset:0;z-index:40;padding:28px;display:grid;place-items:center;background:#000e;cursor:zoom-out}#pcm-root .pcm-lightbox>button{position:absolute;right:18px;top:18px;width:40px;padding:0;color:#fff;background:#111c;font-size:23px}#pcm-root .pcm-lightbox figure{max-width:100%;max-height:100%;margin:0;display:grid;grid-template-rows:minmax(0,1fr) auto;overflow:hidden}#pcm-root .pcm-lightbox img{max-width:min(1000px,90vw);max-height:calc(100vh - 150px);object-fit:contain;border-radius:11px}#pcm-root .pcm-lightbox figcaption{padding:10px;color:#fff;text-align:center}#pcm-root .pcm-lightbox figcaption span{display:block;margin-top:3px;color:#ccc}
  #pcm-root .pcm-capture-simple{align-items:center}#pcm-root .pcm-capture-button{min-width:190px;min-height:48px}#pcm-root .pcm-quick-simple>div:first-child{display:block}#pcm-root .pcm-quick-save{display:grid!important;grid-template-columns:minmax(150px,220px) auto;justify-content:start;gap:7px!important}#pcm-root .pcm-quick-save select{height:34px;padding:0 8px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px}#pcm-root .pcm-stat-grid-simple{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}#pcm-root .pcm-recent>header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}#pcm-root .pcm-recent>header button{min-height:29px;font-size:10px}#pcm-root .pcm-simple-editor>.pcm-grid{padding-right:72px}#pcm-root .pcm-simple-editor>.pcm-field.area textarea{min-height:170px}#pcm-root .pcm-attachments>.pcm-image-row{padding-right:0;margin-top:12px}#pcm-root .pcm-search-panel,#pcm-root .pcm-tools-panel{width:min(760px,100%);max-height:100%;padding:18px;overflow-y:auto;background:linear-gradient(145deg,var(--panel),var(--bg));border:1px solid var(--line);border-radius:16px;box-shadow:0 22px 70px #000b}#pcm-root .pcm-search-panel>header,#pcm-root .pcm-tools-panel>header{display:flex;justify-content:space-between;gap:12px}#pcm-root .pcm-search-panel>header small,#pcm-root .pcm-tools-panel>header small{color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.12em}#pcm-root .pcm-search-panel>header h2,#pcm-root .pcm-tools-panel>header h2{margin:5px 0;font-size:20px}#pcm-root .pcm-tools-panel>header p{margin:0;color:var(--muted)}#pcm-root .pcm-search-panel>header>button,#pcm-root .pcm-tools-panel>header>button{width:34px;flex:0 0 34px;padding:0;font-size:20px}#pcm-root .pcm-global-search{height:44px;margin:14px 0;padding:0 12px;display:flex;align-items:center;gap:8px;background:var(--field);border:1px solid var(--gold);border-radius:10px}#pcm-root .pcm-global-search input{width:100%;color:var(--ink);background:transparent;border:0;outline:0;font-size:15px}#pcm-root .pcm-search-results{display:grid;gap:6px;max-height:490px;overflow-y:auto}#pcm-root .pcm-search-results>button{min-height:58px;padding:8px;display:grid;grid-template-columns:30px minmax(0,1fr) 18px;align-items:center;text-align:left}#pcm-root .pcm-search-results>button>b{color:var(--gold);font-size:17px}#pcm-root .pcm-search-results span,#pcm-root .pcm-search-results em,#pcm-root .pcm-search-results strong,#pcm-root .pcm-search-results small{display:block}#pcm-root .pcm-search-results em{color:var(--teal);font-size:8px;font-style:normal;text-transform:uppercase;letter-spacing:.08em}#pcm-root .pcm-search-results strong{margin:2px 0}#pcm-root .pcm-search-results small{color:var(--muted);font-size:9px}#pcm-root .pcm-search-results i{font-style:normal}#pcm-root .pcm-search-empty{padding:20px;text-align:center;color:var(--muted)}#pcm-root .pcm-search-panel>footer{margin-top:10px;color:var(--muted);text-align:right}#pcm-root .pcm-tools-grid{margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#pcm-root .pcm-tools-grid>button{min-height:72px;padding:10px;display:grid;grid-template-columns:38px 1fr;align-items:center;text-align:left}#pcm-root .pcm-tools-grid>button>b{color:var(--gold);font-size:20px;text-align:center}#pcm-root .pcm-tools-grid span,#pcm-root .pcm-tools-grid small{display:block}#pcm-root .pcm-tools-grid small{margin-top:3px;color:var(--muted);font-size:9px;font-weight:400}
  #pcm-root button:disabled{opacity:.45;cursor:not-allowed}#pcm-root button:disabled:hover{border-color:#ffffff18;background:#ffffff09}
  #pcm-root .pcm-capture-actions{display:flex;flex:0 0 auto;flex-direction:column;gap:7px;min-width:205px}#pcm-root .pcm-capture-actions button{width:100%}#pcm-root .pcm-scene-status{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}#pcm-root .pcm-scene-status span{padding:4px 7px;color:var(--muted);background:#0002;border:1px solid #ffffff12;border-radius:999px;font-size:9px}#pcm-root .pcm-scene-status span.known{color:#a9ddb8;border-color:#78b68a55}#pcm-root .pcm-scene-status span.new{color:#e9cd86;border-color:var(--line)}
  #pcm-root .pcm-scene-context{margin-bottom:12px;padding:12px;background:var(--panel);border:1px solid var(--line);border-radius:12px}#pcm-root .pcm-scene-context>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:9px}#pcm-root .pcm-scene-context h2{margin:0;color:var(--heading);font-size:15px}#pcm-root .pcm-scene-context p{margin:3px 0 0;color:var(--muted);font-size:10px}#pcm-root .pcm-scene-context>header>small{color:var(--gold);white-space:nowrap}#pcm-root .pcm-scene-token-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}#pcm-root .pcm-scene-token{min-height:54px;padding:6px;display:grid;grid-template-columns:40px minmax(0,1fr);align-items:center;gap:8px;background:var(--field);border:1px solid #ffffff12;border-radius:9px}#pcm-root .pcm-scene-token.new{border-color:var(--line)}#pcm-root .pcm-scene-token.known{border-color:#73b98b55}#pcm-root .pcm-scene-token img{width:40px;height:40px;object-fit:cover;border-radius:7px}#pcm-root .pcm-scene-token span,#pcm-root .pcm-scene-token b,#pcm-root .pcm-scene-token small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#pcm-root .pcm-scene-token b{font-size:10px}#pcm-root .pcm-scene-token small{margin-top:3px;color:var(--muted);font-size:8px}#pcm-root .pcm-scene-token.new small{color:var(--gold)}#pcm-root .pcm-scene-token.known small{color:#9bd0ac}
  #pcm-root .pcm-inbox-banner{margin-bottom:12px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:linear-gradient(135deg,var(--accent-soft),var(--panel));border:1px solid var(--line);border-radius:11px}#pcm-root .pcm-inbox-banner>div{display:flex;align-items:center;gap:10px}#pcm-root .pcm-inbox-banner>div>b{width:38px;height:38px;display:grid;place-items:center;color:var(--primary-ink);background:var(--gold);border-radius:50%;font-size:16px}#pcm-root .pcm-inbox-banner span,#pcm-root .pcm-inbox-banner strong,#pcm-root .pcm-inbox-banner small{display:block}#pcm-root .pcm-inbox-banner small{margin-top:2px;color:var(--muted);font-weight:400}#pcm-root .pcm-inbox-list{display:grid;gap:7px}#pcm-root .pcm-inbox-row{padding:7px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px;background:var(--panel);border:1px solid #ffffff12;border-radius:10px}#pcm-root .pcm-inbox-row>button:first-child{min-height:58px;padding:6px;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;text-align:left;background:transparent;border:0}#pcm-root .pcm-inbox-row>button:first-child>b{color:var(--gold);font-size:19px;text-align:center}#pcm-root .pcm-inbox-row span,#pcm-root .pcm-inbox-row small,#pcm-root .pcm-inbox-row strong,#pcm-root .pcm-inbox-row em{display:block}#pcm-root .pcm-inbox-row small{color:var(--teal);font-size:8px;text-transform:uppercase}#pcm-root .pcm-inbox-row strong{margin:2px 0;color:var(--heading)}#pcm-root .pcm-inbox-row em{color:var(--muted);font-size:9px;font-style:normal}
  #pcm-root .pcm-chat-panel{width:min(650px,100%);max-height:100%;padding:18px;overflow-y:auto;background:linear-gradient(145deg,var(--panel),var(--bg));border:1px solid var(--line);border-radius:16px;box-shadow:0 22px 70px #000b}#pcm-root .pcm-chat-panel>header{display:flex;justify-content:space-between;gap:12px}#pcm-root .pcm-chat-panel>header small{color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.12em}#pcm-root .pcm-chat-panel>header h2{margin:5px 0;font-size:20px}#pcm-root .pcm-chat-panel>header p{margin:0;color:var(--muted);font-size:10px}#pcm-root .pcm-chat-panel>header>button{width:34px;flex:0 0 34px;padding:0;font-size:20px}#pcm-root .pcm-chat-target{margin-top:14px;display:grid;grid-template-columns:80px minmax(0,1fr);align-items:center;gap:8px}#pcm-root .pcm-chat-target span,#pcm-root .pcm-chat-text>span{font-weight:800}#pcm-root .pcm-chat-target select{height:36px;padding:0 9px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px}#pcm-root .pcm-chat-recipient{margin:10px 0;padding:9px;display:grid;grid-template-columns:48px minmax(0,1fr);align-items:center;gap:10px;background:var(--field);border:1px solid #ffffff12;border-radius:10px}#pcm-root .pcm-chat-recipient img{width:48px;height:48px;object-fit:cover;border-radius:9px}#pcm-root .pcm-chat-recipient span,#pcm-root .pcm-chat-recipient b,#pcm-root .pcm-chat-recipient small{display:block}#pcm-root .pcm-chat-recipient small{margin-top:3px;color:var(--muted)}#pcm-root .pcm-chat-text{display:grid;gap:5px}#pcm-root .pcm-chat-text textarea{min-height:150px;padding:10px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:9px;resize:vertical}#pcm-root .pcm-chat-actions{margin-top:10px;display:flex;justify-content:flex-end;gap:7px}#pcm-root .pcm-chat-hint{margin:10px 0 0;color:var(--muted);font-size:9px;line-height:1.45}
  #pcm-root .pcm-help-start{margin-top:14px;padding:13px;background:linear-gradient(135deg,var(--accent-soft),var(--field));border:1px solid var(--line);border-radius:11px}#pcm-root .pcm-help-start h3{margin:0 0 7px;color:var(--heading)}#pcm-root .pcm-help-start ol{margin:0;padding-left:20px;color:var(--muted);line-height:1.55}#pcm-root .pcm-help-details{margin-top:10px;display:grid;gap:6px}#pcm-root .pcm-help-details details{background:var(--field);border:1px solid #ffffff12;border-radius:9px}#pcm-root .pcm-help-details summary{padding:10px;color:var(--heading);font-weight:800;cursor:pointer}#pcm-root .pcm-help-details details>div{padding:0 11px 11px;color:var(--muted);line-height:1.5}#pcm-root .pcm-help-details p{margin:7px 0}#pcm-root .pcm-help-panel{width:min(900px,100%)}

  #pcm-root .pcm-inline-lock{min-height:32px!important;padding:4px 10px!important;display:inline-flex!important;align-items:center;gap:7px;white-space:nowrap!important;font-size:11px!important;font-weight:850!important;border-width:1px!important}#pcm-root .pcm-inline-lock b{font-size:15px;line-height:1}#pcm-root .pcm-inline-lock.is-locked{color:#ffb2ad;background:#5c1f2488;border-color:#c65058!important;box-shadow:inset 0 0 0 1px #ff7a8230}#pcm-root .pcm-inline-lock.is-unlocked{color:#b8f3c9;background:#17482d99;border-color:#45a96b!important;box-shadow:inset 0 0 0 1px #6bdd9130}#pcm-root .pcm-inline-person-note.is-locked textarea{cursor:not-allowed;opacity:.78;background:#080d16aa;border-color:#ffffff0c}#pcm-root .pcm-inline-person-note.is-unlocked textarea{opacity:1}
  #pcm-root .pcm-inline-tags>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}#pcm-root .pcm-inline-tags>header h3{margin:2px 0 0}#pcm-root .pcm-inline-tags>header small{color:var(--gold);font-size:9px;font-weight:900;letter-spacing:.08em}#pcm-root .pcm-inline-tag-read{display:flex;flex-wrap:wrap;gap:8px;align-items:center}#pcm-root .pcm-inline-category-editor{display:flex!important;flex-wrap:wrap;gap:8px;margin-bottom:12px}#pcm-root .pcm-inline-category-editor button{min-height:36px!important;padding:6px 12px!important;border-radius:999px!important;font-size:13px!important;font-weight:850!important}#pcm-root .pcm-inline-category-editor button.active{color:var(--heading);background:var(--accent-soft);border-color:var(--gold)!important;box-shadow:inset 0 0 0 1px var(--gold)}#pcm-root .pcm-inline-group-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}#pcm-root .pcm-inline-group{display:grid;gap:5px}#pcm-root .pcm-inline-group span,#pcm-root .pcm-inline-manual-tags span{font-size:11px;font-weight:850;color:var(--heading)}#pcm-root .pcm-inline-group input,#pcm-root .pcm-inline-manual-tags input{height:38px;padding:0 10px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px}#pcm-root .pcm-inline-manual-tags{display:grid;gap:5px}#pcm-root .pcm-inline-hint{display:block;margin-top:8px;color:var(--muted);font-size:10px}#pcm-root .pcm-inline-tags.is-locked{background:linear-gradient(145deg,var(--panel),#0b1018)}
  @media(max-width:1050px){#pcm-root .pcm-top>button span,#pcm-root [data-save-badge]{display:none}#pcm-root .pcm-top>button:not(.pcm-close){width:36px;padding:0}#pcm-root .pcm-theme-presets{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:850px){#pcm-root .pcm-scene-token-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#pcm-root .pcm-stat-grid-simple{grid-template-columns:repeat(2,minmax(0,1fr))}#pcm-root .pcm-capture{align-items:stretch;flex-direction:column}#pcm-root .pcm-capture>div:last-child{justify-content:flex-start}#pcm-root .pcm-help-grid{grid-template-columns:1fr}#pcm-root .pcm-layout{grid-template-columns:60px minmax(0,1fr)}#pcm-root aside>button{grid-template-columns:1fr;justify-items:center}#pcm-root aside>button span,#pcm-root aside>button i,#pcm-root .pcm-caption,#pcm-root .pcm-goal,#pcm-root .pcm-help{display:none}#pcm-root main{padding:14px}#pcm-root .pcm-stat-grid,#pcm-root .pcm-location-list,#pcm-root .pcm-detail-grid{grid-template-columns:1fr}#pcm-root .pcm-grid{grid-template-columns:1fr}#pcm-root .pcm-field.wide,#pcm-root .pcm-detail-panel.wide{grid-column:auto}#pcm-root .pcm-image-row{padding-right:0;padding-top:35px}#pcm-root .pcm-location-open{grid-template-columns:100px minmax(0,1fr) 18px}#pcm-root .pcm-location-hero,#pcm-root .pcm-person-hero{grid-template-columns:120px minmax(0,1fr)}#pcm-root .pcm-people-grid,#pcm-root .pcm-contact-list{grid-template-columns:repeat(2,minmax(0,1fr))}#pcm-root .pcm-location-checks,#pcm-root .pcm-theme-grid{grid-template-columns:1fr 1fr}#pcm-root .pcm-theme-presets{grid-template-columns:repeat(3,minmax(0,1fr))}}
  #pcm-root .pcm-relationship-separator{padding:10px 12px;border:1px dashed var(--line);border-radius:9px;background:color-mix(in srgb,var(--field) 72%,transparent)}
  #pcm-root .pcm-relationship-separator>span{font-size:12px!important;color:var(--heading)!important;font-weight:900!important}
  #pcm-root .pcm-relationship-separator>small{font-size:11px;line-height:1.4;color:var(--muted)}
  #pcm-root .pcm-membership-chip-list{display:flex;flex-wrap:wrap;gap:6px;min-height:24px;align-items:center}
  #pcm-root .pcm-membership-chip{min-height:30px!important;height:auto!important;padding:4px 9px!important;border-radius:999px!important;font-size:12px!important;font-weight:800!important;background:var(--accent-soft)!important;border-color:var(--gold)!important}
  #pcm-root .pcm-membership-chip b{margin-left:5px;color:#ef8b8b;font-size:14px}
  #pcm-root .pcm-membership-add-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin-top:6px}
  #pcm-root .pcm-membership-add-row button{min-height:38px;padding:6px 11px;font-size:12px;font-weight:850}
  #pcm-root .pcm-person-connections>header{display:flex;align-items:center;justify-content:space-between;gap:10px}
  #pcm-root .pcm-person-connections>header small{color:var(--muted);font-size:10px;font-weight:700}
  #pcm-root .pcm-person-connections>div{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  #pcm-root .pcm-person-connections>div>span{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:var(--field)}
  #pcm-root .pcm-person-connections b{font-size:11px;color:var(--muted)}
  #pcm-root .pcm-person-connections i{font-size:12.5px;color:var(--ink);font-style:normal;font-weight:800}
  @media(max-width:760px){#pcm-root .pcm-record-open{min-height:88px;padding:10px 11px;grid-template-columns:48px minmax(0,1fr) 18px;gap:9px}#pcm-root .pcm-record-open>.pcm-thumb{width:48px;height:48px}#pcm-root .pcm-record-copy h2{font-size:17px}#pcm-root .pcm-entry-headline{font-size:13px}#pcm-root .pcm-record-copy>p{font-size:11px}#pcm-root .pcm-record-kicker{font-size:9px!important}}
  @media(max-width:620px){#pcm-root .pcm-inline-group-grid{grid-template-columns:1fr}#pcm-root .pcm-scene-token-grid{grid-template-columns:1fr}#pcm-root .pcm-chat-actions,#pcm-root .pcm-inbox-banner{align-items:stretch;flex-direction:column}#pcm-root .pcm-inbox-row{grid-template-columns:1fr}#pcm-root .pcm-quick-save,#pcm-root .pcm-tools-grid{grid-template-columns:1fr}#pcm-root .pcm-capture-button{width:100%}#pcm-root .pcm-window{width:100vw;height:100vh;border-radius:0}#pcm-root .pcm-top{padding:8px}#pcm-root .pcm-brand img{display:none}#pcm-root .pcm-brand{flex-basis:120px}#pcm-root .pcm-brand small{display:none}#pcm-root .pcm-top>button:not(.pcm-close){width:33px}#pcm-root main{padding:10px}#pcm-root .pcm-section-head{align-items:stretch;flex-direction:column}#pcm-root .pcm-section-head>div:last-child{justify-content:stretch}#pcm-root .pcm-search{flex:1}#pcm-root .pcm-search input{width:100%}#pcm-root .pcm-image-row{grid-template-columns:1fr}#pcm-root .pcm-cover{height:180px}#pcm-root .pcm-location-hero,#pcm-root .pcm-person-hero{grid-template-columns:1fr}#pcm-root .pcm-location-hero-image,#pcm-root .pcm-person-portrait{height:190px}#pcm-root .pcm-people-grid,#pcm-root .pcm-contact-list,#pcm-root .pcm-location-checks,#pcm-root .pcm-theme-grid,#pcm-root .pcm-gallery-edit-grid{grid-template-columns:1fr}#pcm-root .pcm-theme-presets{grid-template-columns:repeat(2,minmax(0,1fr))}#pcm-root .pcm-font-size{grid-template-columns:1fr}#pcm-root .pcm-modal-backdrop{padding:7px}#pcm-root .pcm-gallery-edit{grid-template-columns:80px minmax(0,1fr)}#pcm-root .pcm-gallery-preview{width:80px}#pcm-root .pcm-paste-zone{align-items:flex-start;flex-direction:column}}

  #pcm-root .pcm-directory-list{display:grid;gap:8px}
  #pcm-root .pcm-directory-card>summary{align-items:start}
  #pcm-root .pcm-directory-quick-note{margin:5px 0 7px!important;padding:7px 9px;color:var(--ink)!important;background:var(--accent-soft);border-left:3px solid var(--gold);border-radius:0 7px 7px 0;white-space:pre-wrap;line-height:1.45}
  #pcm-root .pcm-directory-badges,#pcm-root .pcm-contact-links{display:flex!important;flex-wrap:wrap;gap:5px;margin:2px 0 4px}
  #pcm-root .pcm-directory-badges i,#pcm-root .pcm-contact-links i{display:inline-flex!important;width:max-content;padding:3px 7px;color:var(--muted);background:var(--field);border:1px solid #ffffff14;border-radius:999px;font-size:8px;font-style:normal}
  #pcm-root .pcm-directory-badges i:first-child{color:var(--gold);border-color:var(--line)}
  #pcm-root .pcm-contact-links i{color:var(--teal)}

  /* Night City v6: окно не блокирует холст Foundry */
  #pcm-root{position:fixed;inset:0;z-index:1000000;background:transparent!important;display:block!important;pointer-events:none!important;backdrop-filter:none!important}
  #pcm-root .pcm-window{pointer-events:auto;position:fixed;left:calc(100vw - 800px);top:70px;width:780px;height:min(780px,calc(100vh - 90px));min-width:0;min-height:0;max-width:calc(100vw - 12px);max-height:calc(100vh - 12px);background:var(--bg-alpha);border-radius:13px;box-shadow:0 18px 55px #0008;resize:none}
  #pcm-root .pcm-top{cursor:move;user-select:none;height:62px;padding:8px 10px}#pcm-root .pcm-top button,#pcm-root .pcm-top select{cursor:pointer}#pcm-root .pcm-top-actions{flex:0 0 auto;display:flex;align-items:center;gap:6px;overflow:hidden}#pcm-root .pcm-top-actions>button{flex:0 0 auto;min-height:34px;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}#pcm-root .pcm-layout{height:calc(100% - 62px);grid-template-columns:clamp(220px,18%,240px) minmax(0,1fr)}
  #pcm-root .pcm-window.is-minimized .pcm-layout,#pcm-root .pcm-window.is-minimized .pcm-resize-handle,#pcm-root .pcm-window.is-minimized [data-save-badge],#pcm-root .pcm-window.is-minimized .pcm-top-actions>button:not(.pcm-window-toggle):not(.pcm-close),#pcm-root .pcm-window.is-minimized .pcm-brand img,#pcm-root .pcm-window.is-minimized .pcm-brand small{display:none!important}#pcm-root .pcm-window.is-minimized .pcm-top{height:52px;padding:5px 7px;gap:5px}#pcm-root .pcm-window.is-minimized .pcm-brand{min-width:0;flex:1 1 auto;gap:0}#pcm-root .pcm-window.is-minimized .pcm-brand select{height:34px;width:100%;font-size:14px}#pcm-root .pcm-window.is-minimized .pcm-top-actions{overflow:visible}#pcm-root .pcm-window.is-minimized .pcm-window-toggle{width:auto!important;padding:0 10px!important;color:var(--gold);border-color:var(--line)}
  #pcm-root .pcm-window.nav-collapsed .pcm-layout,#pcm-root .pcm-window.is-compact .pcm-layout{grid-template-columns:58px minmax(0,1fr)}#pcm-root .pcm-window.nav-collapsed aside>button,#pcm-root .pcm-window.is-compact aside>button{grid-template-columns:1fr;justify-items:center}#pcm-root .pcm-window.nav-collapsed aside>button span,#pcm-root .pcm-window.nav-collapsed aside>button i,#pcm-root .pcm-window.nav-collapsed .pcm-caption,#pcm-root .pcm-window.nav-collapsed .pcm-goal,#pcm-root .pcm-window.is-compact aside>button span,#pcm-root .pcm-window.is-compact aside>button i,#pcm-root .pcm-window.is-compact .pcm-caption,#pcm-root .pcm-window.is-compact .pcm-goal{display:none}
  #pcm-root .pcm-resize-handle{position:absolute;z-index:40;touch-action:none}#pcm-root .pcm-resize-handle[data-resize-handle=n]{left:16px;right:16px;top:0;height:10px;cursor:ns-resize}#pcm-root .pcm-resize-handle[data-resize-handle=s]{left:16px;right:16px;bottom:0;height:10px;cursor:ns-resize}#pcm-root .pcm-resize-handle[data-resize-handle=e]{top:16px;right:0;bottom:16px;width:10px;cursor:ew-resize}#pcm-root .pcm-resize-handle[data-resize-handle=w]{top:16px;left:0;bottom:16px;width:10px;cursor:ew-resize}#pcm-root .pcm-resize-handle[data-resize-handle=ne],#pcm-root .pcm-resize-handle[data-resize-handle=se],#pcm-root .pcm-resize-handle[data-resize-handle=sw],#pcm-root .pcm-resize-handle[data-resize-handle=nw]{width:20px;height:20px}#pcm-root .pcm-resize-handle[data-resize-handle=ne]{right:0;top:0;cursor:nesw-resize}#pcm-root .pcm-resize-handle[data-resize-handle=se]{right:0;bottom:0;cursor:nwse-resize}#pcm-root .pcm-resize-handle[data-resize-handle=sw]{left:0;bottom:0;cursor:nesw-resize}#pcm-root .pcm-resize-handle[data-resize-handle=nw]{left:0;top:0;cursor:nwse-resize}#pcm-root .pcm-resize-handle[data-resize-handle=ne]:after,#pcm-root .pcm-resize-handle[data-resize-handle=se]:after,#pcm-root .pcm-resize-handle[data-resize-handle=sw]:after,#pcm-root .pcm-resize-handle[data-resize-handle=nw]:after{content:"";position:absolute;width:8px;height:8px;opacity:.34}#pcm-root .pcm-resize-handle[data-resize-handle=ne]:after{right:5px;top:5px;border-right:2px solid var(--muted);border-top:2px solid var(--muted)}#pcm-root .pcm-resize-handle[data-resize-handle=se]:after{right:5px;bottom:5px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted)}#pcm-root .pcm-resize-handle[data-resize-handle=sw]:after{left:5px;bottom:5px;border-left:2px solid var(--muted);border-bottom:2px solid var(--muted)}#pcm-root .pcm-resize-handle[data-resize-handle=nw]:after{left:5px;top:5px;border-left:2px solid var(--muted);border-top:2px solid var(--muted)}#pcm-root .pcm-resize-handle:hover:after{opacity:.9}
  #pcm-root main{padding:16px;overscroll-behavior:contain}#pcm-root .pcm-card,#pcm-root .pcm-capture,#pcm-root .pcm-quick,#pcm-root .pcm-recent,#pcm-root .pcm-detail-panel{background:var(--panel-alpha)}#pcm-root button{background:var(--panel-alpha);border-color:var(--line)}#pcm-root .primary{background:linear-gradient(135deg,var(--gold),var(--accent-deep))}#pcm-root .pcm-field input,#pcm-root .pcm-field select,#pcm-root .pcm-field textarea,#pcm-root .pcm-search{border-color:var(--line)}
  #pcm-root .pcm-main-text textarea{min-height:240px;max-height:55vh;line-height:1.62;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif;tab-size:2}#pcm-root .pcm-main-text>small{color:var(--muted);font-size:9px}
  #pcm-root .pcm-read-text{white-space:pre-wrap;line-height:1.62;max-width:78ch;overflow-wrap:anywhere}#pcm-root .pcm-detail-panel.wide .pcm-read-text{max-width:92ch}
  #pcm-root .pcm-field textarea{line-height:1.52}#pcm-root[data-density=compact] main{padding:11px}#pcm-root[data-density=compact] .pcm-card-body{padding:11px}#pcm-root[data-density=spacious] main{padding:22px}#pcm-root[data-density=spacious] .pcm-card-body{padding:20px}
  #pcm-root .pcm-nav-toggle{display:flex!important;justify-content:center!important;text-align:center!important}
  #pcm-root .pcm-city-map-canvas{height:calc(100% - 155px);min-height:360px;overflow:auto;display:grid;place-items:center;background:#0003;border:1px solid var(--line);border-radius:12px}#pcm-root .pcm-city-map-canvas img{max-width:100%;max-height:100%;object-fit:contain;transition:width .16s ease}
  #pcm-root .pcm-city-map-empty{min-height:380px;padding:28px;display:grid;place-items:center;align-content:center;text-align:center;background:var(--panel-alpha);border:1px dashed var(--line);border-radius:12px}#pcm-root .pcm-city-map-empty>b{font-size:54px;color:var(--gold)}#pcm-root .pcm-city-map-empty p{max-width:55ch;color:var(--muted)}#pcm-root .pcm-map-actions{margin:8px 0;display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--muted);font-size:10px}#pcm-root .pcm-map-notes textarea{min-height:120px;max-height:32vh}
  #pcm-root .pcm-theme-sliders{margin:14px 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}#pcm-root .pcm-theme-sliders label{display:grid;gap:6px;color:var(--muted)}#pcm-root .pcm-theme-sliders select{height:34px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px}#pcm-root .pcm-theme-advanced{margin-top:10px;padding:10px;background:var(--field);border:1px solid var(--line);border-radius:10px}#pcm-root .pcm-theme-advanced summary{cursor:pointer;font-weight:800}
  #pcm-root .pcm-window.is-compact .pcm-top-actions>button span,#pcm-root .pcm-window.is-compact [data-save-badge]{display:none}#pcm-root .pcm-window.is-compact .pcm-top-actions>button:not(.pcm-window-toggle):not(.pcm-close){width:36px;padding:0}#pcm-root .pcm-window.is-compact main{padding:12px}#pcm-root .pcm-window.is-compact .pcm-stat-grid,#pcm-root .pcm-window.is-compact .pcm-location-list,#pcm-root .pcm-window.is-compact .pcm-contact-list,#pcm-root .pcm-window.is-compact .pcm-detail-grid,#pcm-root .pcm-window.is-compact .pcm-grid{grid-template-columns:1fr}#pcm-root .pcm-window.is-compact .pcm-field.wide,#pcm-root .pcm-window.is-compact .pcm-detail-panel.wide{grid-column:auto}#pcm-root .pcm-window.is-compact .pcm-section-head{align-items:stretch;flex-direction:column}#pcm-root .pcm-window.is-compact .pcm-section-head>div:last-child{justify-content:flex-start}#pcm-root .pcm-window.is-compact .pcm-image-row{padding-right:0;padding-top:35px}
  #pcm-root .pcm-window.is-narrow .pcm-brand img,#pcm-root .pcm-window.is-narrow .pcm-brand small,#pcm-root .pcm-window.is-narrow .pcm-top-actions [data-action=open-chat]{display:none}#pcm-root .pcm-window.is-narrow .pcm-brand{min-width:90px;flex-basis:120px}#pcm-root .pcm-window.is-narrow .pcm-brand select{font-size:14px}#pcm-root .pcm-window.is-narrow .pcm-welcome img{display:none}#pcm-root .pcm-window.is-narrow .pcm-capture{align-items:stretch;flex-direction:column}#pcm-root .pcm-window.is-narrow .pcm-capture>div:last-child{justify-content:flex-start}#pcm-root .pcm-window.is-narrow .pcm-scene-token-grid,#pcm-root .pcm-window.is-narrow .pcm-people-grid,#pcm-root .pcm-window.is-narrow .pcm-contact-list,#pcm-root .pcm-window.is-narrow .pcm-location-checks,#pcm-root .pcm-window.is-narrow .pcm-theme-grid,#pcm-root .pcm-window.is-narrow .pcm-gallery-edit-grid{grid-template-columns:1fr}#pcm-root .pcm-window.is-narrow .pcm-image-row,#pcm-root .pcm-window.is-narrow .pcm-location-hero,#pcm-root .pcm-window.is-narrow .pcm-person-hero{grid-template-columns:1fr}#pcm-root .pcm-window.is-narrow .pcm-cover,#pcm-root .pcm-window.is-narrow .pcm-location-hero-image,#pcm-root .pcm-window.is-narrow .pcm-person-portrait{height:180px}
  #pcm-root .pcm-window.is-short .pcm-goal{display:none}#pcm-root .pcm-window.is-short main{padding-top:10px;padding-bottom:10px}
  #pcm-root .pcm-window:not(.nav-collapsed):not(.is-compact) aside>button>span{hyphens:none;word-break:normal;overflow-wrap:normal}
  #pcm-root .pcm-window:not(.nav-collapsed):not(.is-compact) aside>button:hover>span,#pcm-root .pcm-window:not(.nav-collapsed):not(.is-compact) aside>button:focus-visible>span{color:inherit}
  #pcm-root .pcm-window.is-short:not(.nav-collapsed):not(.is-compact) aside{gap:3px;padding-top:9px;padding-bottom:9px}
  #pcm-root .pcm-window.is-short:not(.nav-collapsed):not(.is-compact) aside>button{min-height:31px}
  #pcm-root .pcm-window.is-short:not(.nav-collapsed):not(.is-compact) .pcm-caption{margin-top:9px}
  /* DATAPAD 6.8 — физический корпус. Никаких бегущих полос или декоративной анимации. */
  #pcm-root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif;font-synthesis:none;text-rendering:optimizeLegibility}
  #pcm-root .pcm-device-screen{position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;background:var(--bg-alpha)}
  #pcm-root .pcm-device-hardware{display:none}

  #pcm-root[data-shell=datapad] .pcm-window{
    overflow:visible;
    border:1px solid var(--device-metal);
    border-radius:22px;
    background:
      linear-gradient(145deg,#ffffff0b,transparent 18% 78%,#00000025),
      repeating-linear-gradient(90deg,#ffffff025 0 1px,transparent 1px 4px),
      linear-gradient(180deg,var(--device-shell-hi),var(--device-shell) 18%,var(--device-shell) 78%,var(--device-shell-lo));
    box-shadow:
      0 24px 70px #000a,
      0 3px 0 #000b,
      inset 0 1px 0 #ffffff1a,
      inset 0 -2px 0 #000b,
      inset 0 0 0 2px #00000055;
  }
  #pcm-root[data-shell=datapad] .pcm-window::before,#pcm-root[data-shell=datapad] .pcm-window::after{content:none!important;display:none!important}
  #pcm-root[data-shell=datapad] .pcm-device-screen{
    position:absolute;
    inset:12px;
    width:auto;
    height:auto;
    border:1px solid #000;
    border-radius:11px;
    background:var(--bg-alpha);
    box-shadow:
      0 0 0 2px #050708,
      0 0 0 3px #ffffff10,
      inset 0 0 0 1px #ffffff08,
      inset 0 0 28px #00000024;
  }
  #pcm-root[data-shell=datapad] .pcm-top{position:relative;background:linear-gradient(180deg,var(--chrome-top),var(--chrome));border-bottom:1px solid var(--line);box-shadow:inset 0 -1px 0 #0008,inset 0 1px 0 #ffffff0b}
  #pcm-root[data-shell=datapad] .pcm-top::before{content:"NC-OS / LOCAL ARCHIVE";position:absolute;left:12px;bottom:2px;color:var(--muted);font:700 7px/1.1 ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,"Courier New",monospace;letter-spacing:.07em;opacity:.55;pointer-events:none}
  #pcm-root[data-shell=datapad] .pcm-brand small,#pcm-root[data-shell=datapad] .pcm-caption,#pcm-root[data-shell=datapad] .pcm-section-head small,#pcm-root[data-shell=datapad] .pcm-welcome span,#pcm-root[data-shell=datapad] .pcm-field>span,#pcm-root[data-shell=datapad] .pcm-detail-panel>h3{font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,"Courier New",monospace;letter-spacing:.055em}
  #pcm-root[data-shell=datapad] .pcm-brand img{border-radius:6px 9px 6px 9px;box-shadow:0 0 0 2px #0008}
  #pcm-root[data-shell=datapad] [data-save-badge]{position:relative;padding:5px 8px 5px 18px;border:1px solid #ffffff10;border-radius:5px;background:#00000020;font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,"Courier New",monospace;font-size:9px;letter-spacing:.025em}
  #pcm-root[data-shell=datapad] [data-save-badge]::before{content:"";position:absolute;left:7px;top:50%;width:6px;height:6px;transform:translateY(-50%);border-radius:50%;background:currentColor;box-shadow:0 0 5px currentColor}
  #pcm-root[data-shell=datapad] .pcm-layout{position:relative;background:linear-gradient(180deg,#ffffff018,transparent 80px)}
  #pcm-root[data-shell=datapad] .pcm-layout::before,#pcm-root[data-shell=datapad] .pcm-layout::after{content:none!important;display:none!important;animation:none!important}
  #pcm-root[data-shell=datapad] aside,#pcm-root[data-shell=datapad] main{position:relative;z-index:1}
  #pcm-root[data-shell=datapad] aside{background:linear-gradient(180deg,var(--sidebar),var(--sidebar-tint));box-shadow:inset -1px 0 0 #0009,inset -4px 0 14px #0003}
  #pcm-root[data-shell=datapad] aside>button{position:relative;border-radius:5px 8px 5px 8px;transition:background .12s ease,border-color .12s ease,transform .08s ease}
  #pcm-root[data-shell=datapad] aside>button::before{content:"";position:absolute;left:-1px;top:8px;bottom:8px;width:2px;background:transparent}
  #pcm-root[data-shell=datapad] aside>button.active::before{background:var(--gold);box-shadow:0 0 5px var(--gold);animation:none!important}
  #pcm-root[data-shell=datapad] aside>button.active{background:linear-gradient(90deg,var(--accent-soft),transparent 110%)}
  #pcm-root[data-shell=datapad] .pcm-caption{padding-left:8px;border-left:2px solid var(--line)}
  #pcm-root[data-shell=datapad] main{background:linear-gradient(180deg,#0000000b,transparent 90px)}
  #pcm-root[data-shell=datapad] .pcm-section-head{position:relative;padding:9px 11px 9px 14px;border-left:2px solid var(--gold);background:linear-gradient(90deg,var(--accent-soft),transparent 72%)}
  #pcm-root[data-shell=datapad] .pcm-section-head::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,var(--gold),var(--line),transparent 80%);opacity:.48}
  #pcm-root[data-shell=datapad] .pcm-card,#pcm-root[data-shell=datapad] .pcm-capture,#pcm-root[data-shell=datapad] .pcm-quick,#pcm-root[data-shell=datapad] .pcm-recent,#pcm-root[data-shell=datapad] .pcm-detail-panel,#pcm-root[data-shell=datapad] .pcm-person-hero,#pcm-root[data-shell=datapad] .pcm-location-hero{border-radius:7px 10px 7px 10px;box-shadow:inset 0 1px 0 #ffffff07,inset 0 0 16px #00000010,0 3px 10px #00000014}

  /* Нажимаемые элементы похожи на реальные клавиши: при нажатии они проседают, а не светятся неоном. */
  #pcm-root[data-shell=datapad] button{position:relative;border-radius:5px 7px 5px 7px;background:linear-gradient(180deg,var(--button-top),var(--panel-alpha));box-shadow:inset 0 1px 0 #ffffff12,inset 0 -1px 0 #0007,0 2px 2px #0007;transition:transform .07s ease,border-color .12s ease,background .12s ease}
  #pcm-root[data-shell=datapad] button:hover{box-shadow:inset 0 1px 0 #ffffff15,inset 0 -1px 0 #0008,0 2px 3px #0007;border-color:var(--gold)}
  #pcm-root[data-shell=datapad] button:active{transform:translateY(1px);box-shadow:inset 0 1px 2px #0008,0 1px 1px #0007}
  #pcm-root[data-shell=datapad] button:focus-visible,#pcm-root[data-shell=datapad] input:focus-visible,#pcm-root[data-shell=datapad] textarea:focus-visible,#pcm-root[data-shell=datapad] select:focus-visible{outline:2px solid var(--gold);outline-offset:2px;box-shadow:0 0 0 3px var(--accent-soft)}
  #pcm-root[data-shell=datapad] input,#pcm-root[data-shell=datapad] select,#pcm-root[data-shell=datapad] textarea{border-radius:5px 7px 5px 7px;background:linear-gradient(180deg,#00000016,var(--field));box-shadow:inset 0 2px 5px #0006,inset 0 0 0 1px #ffffff04}
  #pcm-root[data-shell=datapad] textarea{scrollbar-width:thin;scrollbar-color:var(--gold) transparent}
  #pcm-root[data-shell=datapad] *::-webkit-scrollbar{width:8px;height:8px}#pcm-root[data-shell=datapad] *::-webkit-scrollbar-track{background:#0000001f}#pcm-root[data-shell=datapad] *::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border:2px solid transparent;background-clip:padding-box;border-radius:99px}
  #pcm-root[data-shell=datapad] .pcm-modal-backdrop{background:var(--modal-shade);backdrop-filter:blur(4px)}
  #pcm-root[data-shell=datapad] .pcm-theme-panel,#pcm-root[data-shell=datapad] .pcm-tools-panel,#pcm-root[data-shell=datapad] .pcm-help-panel,#pcm-root[data-shell=datapad] .pcm-search-panel,#pcm-root[data-shell=datapad] .pcm-chat-panel{border-radius:9px 13px 9px 13px;box-shadow:0 22px 80px #000c,0 0 0 1px var(--device-rim),inset 0 0 22px #00000012}
  #pcm-root[data-shell=datapad] .pcm-theme-panel>header,#pcm-root[data-shell=datapad] .pcm-tools-panel>header,#pcm-root[data-shell=datapad] .pcm-help-panel>header,#pcm-root[data-shell=datapad] .pcm-search-panel>header,#pcm-root[data-shell=datapad] .pcm-chat-panel>header{padding-bottom:9px;border-bottom:1px solid var(--line)}
  #pcm-root[data-shell=datapad] .pcm-theme-panel>header small,#pcm-root[data-shell=datapad] .pcm-tools-panel>header small,#pcm-root[data-shell=datapad] .pcm-help-panel>header small,#pcm-root[data-shell=datapad] .pcm-search-panel>header small,#pcm-root[data-shell=datapad] .pcm-chat-panel>header small{font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,"Courier New",monospace;letter-spacing:.06em}
  #pcm-root[data-shell=datapad] .pcm-interface-controls{margin:14px 0 4px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  #pcm-root[data-shell=datapad] .pcm-interface-controls label,#pcm-root .pcm-interface-controls label{padding:10px;display:grid;gap:6px;background:var(--field);border:1px solid var(--line);border-radius:9px}
  #pcm-root .pcm-interface-controls span{font-weight:800}#pcm-root .pcm-interface-controls small{color:var(--muted);font-size:8px;line-height:1.35}#pcm-root .pcm-interface-controls select{height:34px;color:var(--ink);background:var(--field);border:1px solid var(--line)}

  /* Аппаратные детали находятся только на безеле и не перехватывают мышь. */
  #pcm-root[data-shell=datapad] .pcm-device-hardware{position:absolute;inset:0;z-index:58;display:block;pointer-events:none;border-radius:inherit}
  #pcm-root[data-shell=datapad] .pcm-hw-screw{position:absolute;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#c5c9c8,#6b7374 40%,#272c2d 72%);border:1px solid #080a0a;box-shadow:0 1px 1px #0008,inset 0 1px 0 #fff6}
  #pcm-root[data-shell=datapad] .pcm-hw-screw::after{content:"";position:absolute;left:1px;right:1px;top:2px;height:1px;background:#141718;transform:rotate(-22deg);opacity:.9}
  #pcm-root[data-shell=datapad] .pcm-hw-screw.hw-nw{left:4px;top:4px}#pcm-root[data-shell=datapad] .pcm-hw-screw.hw-ne{right:4px;top:4px}#pcm-root[data-shell=datapad] .pcm-hw-screw.hw-sw{left:4px;bottom:4px}#pcm-root[data-shell=datapad] .pcm-hw-screw.hw-se{right:4px;bottom:4px}
  #pcm-root[data-shell=datapad] .pcm-hw-speaker{position:absolute;top:4px;left:50%;width:46px;height:4px;transform:translateX(-50%);border-radius:4px;background:repeating-linear-gradient(90deg,#050707 0 3px,#657071 3px 4px);box-shadow:inset 0 1px 2px #000,0 1px 0 #ffffff0b}
  #pcm-root[data-shell=datapad] .pcm-hw-port{position:absolute;bottom:3px;left:50%;width:34px;height:6px;transform:translateX(-50%);border-radius:2px 2px 5px 5px;background:linear-gradient(180deg,#030405,#252b2c);border:1px solid #000;box-shadow:inset 0 1px 2px #000}
  #pcm-root[data-shell=datapad] .pcm-hw-vent{position:absolute;top:37%;width:4px;height:78px;border-radius:4px;background:repeating-linear-gradient(180deg,#020303 0 5px,#596061 5px 6px,#020303 6px 10px);opacity:.72}
  #pcm-root[data-shell=datapad] .pcm-hw-vent-left{left:4px}#pcm-root[data-shell=datapad] .pcm-hw-vent-right{right:4px}
  #pcm-root[data-shell=datapad] .pcm-hw-sidekey{position:absolute;top:88px;width:7px;height:38px;border:1px solid #050606;background:linear-gradient(90deg,var(--device-shell-lo),var(--device-metal),var(--device-shell-lo));box-shadow:0 2px 3px #0008}
  #pcm-root[data-shell=datapad] .pcm-hw-sidekey.hw-key-left{left:-4px;border-radius:4px 0 0 4px}#pcm-root[data-shell=datapad] .pcm-hw-sidekey.hw-key-right{right:-4px;border-radius:0 4px 4px 0}
  #pcm-root[data-shell=datapad] .pcm-hw-led{position:absolute;top:4px;width:5px;height:5px;border-radius:50%;background:#354042;border:1px solid #020303;box-shadow:inset 0 1px 1px #000}
  #pcm-root[data-shell=datapad] .pcm-hw-led-power{right:30px}#pcm-root[data-shell=datapad] .pcm-hw-led-link{right:21px}
  #pcm-root[data-shell=datapad] .pcm-hw-mark{position:absolute;right:18px;bottom:2px;color:#ffffff45;font:700 5px/1 Consolas,"Courier New",monospace;letter-spacing:.12em;font-style:normal}

  /* Уровни подсветки статичны. vivid ярче, но ничего не движется и не пульсирует. */
  #pcm-root[data-shell=datapad][data-effects=off] .pcm-hw-led{background:#303536;box-shadow:none}#pcm-root[data-shell=datapad][data-effects=off] .pcm-device-screen{box-shadow:0 0 0 2px #050708,0 0 0 3px #ffffff0a,inset 0 0 0 1px #ffffff06,inset 0 0 18px #00000024}
  #pcm-root[data-shell=datapad][data-effects=soft] .pcm-hw-led-power{background:var(--device-led);box-shadow:0 0 5px var(--device-led)}#pcm-root[data-shell=datapad][data-effects=soft] .pcm-hw-led-link{background:var(--teal);box-shadow:0 0 4px var(--teal)}
  #pcm-root[data-shell=datapad][data-effects=vivid] .pcm-hw-led-power{background:var(--device-led);box-shadow:0 0 8px var(--device-led)}#pcm-root[data-shell=datapad][data-effects=vivid] .pcm-hw-led-link{background:var(--teal);box-shadow:0 0 7px var(--teal)}#pcm-root[data-shell=datapad][data-effects=vivid] .pcm-device-screen{box-shadow:0 0 0 2px #050708,0 0 0 3px #ffffff12,inset 0 0 0 1px #ffffff08,inset 0 0 24px var(--screen-glow)}
  #pcm-root[data-shell=datapad] *{animation:none!important}

  /* DATAPAD 6.8 — rugged metal tablet. Device body is visual chrome; app remains readable. */
  #pcm-root[data-shell=datapad] .pcm-window{
    border:1px solid #70787a;
    border-radius:28px 22px 28px 22px;
    background:
      radial-gradient(circle at 18% 10%,#ffffff13,transparent 18%),
      radial-gradient(circle at 84% 88%,#00000048,transparent 24%),
      linear-gradient(100deg,var(--device-shell-lo) 0 5%,var(--device-metal) 5.5% 6%,var(--device-shell) 6.5% 46%,var(--device-metal) 47%,var(--device-shell-lo) 48% 100%);
    box-shadow:0 34px 90px #000c,0 8px 16px #0009,inset 0 2px 0 #ffffff24,inset 0 -3px 0 #000d,inset 0 0 0 4px #0a0d0e,inset 0 0 0 6px #ffffff0a;
  }
  #pcm-root[data-shell=datapad] .pcm-device-screen{
    inset:20px 24px 22px;
    border:2px solid #050708;
    border-radius:13px;
    background:var(--bg-alpha);
    box-shadow:0 0 0 2px #596164,0 0 0 5px #090c0d,0 5px 12px #000b,inset 0 0 0 1px #ffffff0b,inset 0 0 34px #00000026;
  }
  #pcm-root[data-shell=datapad] .pcm-device-screen::after{content:"";position:absolute;inset:0;z-index:55;pointer-events:none;border-radius:inherit;background:linear-gradient(135deg,#ffffff055 0 1%,transparent 9% 82%,#00000018 100%);mix-blend-mode:screen;opacity:.22}
  #pcm-root[data-shell=datapad] .pcm-device-hardware{inset:-1px;z-index:60}
  #pcm-root[data-shell=datapad] .pcm-hw-bumper{position:absolute;width:46px;height:46px;background:linear-gradient(145deg,#33393a,#111516 55%,#060808);box-shadow:inset 0 1px 0 #ffffff18,0 3px 6px #0009}
  #pcm-root[data-shell=datapad] .pcm-hw-bumper::after{content:"";position:absolute;inset:9px;border:1px solid #ffffff10;border-radius:7px}
  #pcm-root[data-shell=datapad] .hw-bumper-nw{left:-5px;top:-5px;border-radius:18px 4px 14px 4px;clip-path:polygon(0 0,100% 0,55% 35%,35% 55%,0 100%)}
  #pcm-root[data-shell=datapad] .hw-bumper-ne{right:-5px;top:-5px;border-radius:4px 18px 4px 14px;clip-path:polygon(0 0,100% 0,100% 100%,65% 55%,45% 35%)}
  #pcm-root[data-shell=datapad] .hw-bumper-sw{left:-5px;bottom:-5px;border-radius:4px 14px 4px 18px;clip-path:polygon(0 0,35% 45%,55% 65%,100% 100%,0 100%)}
  #pcm-root[data-shell=datapad] .hw-bumper-se{right:-5px;bottom:-5px;border-radius:14px 4px 18px 4px;clip-path:polygon(45% 65%,65% 45%,100% 0,100% 100%,0 100%)}
  #pcm-root[data-shell=datapad] .pcm-hw-screw{width:9px;height:9px;z-index:2}
  #pcm-root[data-shell=datapad] .pcm-hw-screw.hw-nw{left:11px;top:11px}#pcm-root[data-shell=datapad] .pcm-hw-screw.hw-ne{right:11px;top:11px}#pcm-root[data-shell=datapad] .pcm-hw-screw.hw-sw{left:11px;bottom:11px}#pcm-root[data-shell=datapad] .pcm-hw-screw.hw-se{right:11px;bottom:11px}
  #pcm-root[data-shell=datapad] .pcm-hw-speaker{top:7px;width:88px;height:7px;background:repeating-linear-gradient(90deg,#030505 0 4px,#767f81 4px 5px,#15191a 5px 8px)}
  #pcm-root[data-shell=datapad] .pcm-hw-radiator{position:absolute;top:29%;width:12px;height:150px;border:1px solid #020303;border-radius:4px;background:repeating-linear-gradient(180deg,#050707 0 7px,#7a8385 7px 8px,#15191a 8px 13px);box-shadow:inset 0 0 5px #000,0 0 0 1px #ffffff0b}
  #pcm-root[data-shell=datapad] .hw-rad-left{left:5px}#pcm-root[data-shell=datapad] .hw-rad-right{right:5px}
  #pcm-root[data-shell=datapad] .pcm-hw-grip{position:absolute;top:50%;width:8px;height:94px;transform:translateY(-50%);border-radius:6px;background:repeating-linear-gradient(180deg,#1d2223 0 6px,#080b0c 6px 10px);box-shadow:inset 0 0 4px #000}
  #pcm-root[data-shell=datapad] .hw-grip-left{left:-3px}#pcm-root[data-shell=datapad] .hw-grip-right{right:-3px}
  #pcm-root[data-shell=datapad] .pcm-hw-key{position:absolute;right:-8px;width:14px;border:1px solid #050606;border-radius:0 5px 5px 0;background:linear-gradient(90deg,#111516,#737c7e 45%,#242a2b);box-shadow:0 3px 5px #0009,inset 0 1px 0 #fff3}
  #pcm-root[data-shell=datapad] .pcm-hw-key b{position:absolute;right:15px;top:50%;transform:translateY(-50%);color:#ffffff57;font:700 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.04em;white-space:nowrap}
  #pcm-root[data-shell=datapad] .hw-key-power{top:72px;height:42px}#pcm-root[data-shell=datapad] .hw-key-up{top:126px;height:28px}#pcm-root[data-shell=datapad] .hw-key-down{top:158px;height:28px}
  #pcm-root[data-shell=datapad] .pcm-hw-portbay{position:absolute;left:50%;bottom:4px;width:118px;height:14px;transform:translateX(-50%);border:1px solid #030404;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#252b2c,#090c0d);box-shadow:inset 0 2px 4px #000c,0 1px 0 #ffffff0b}
  #pcm-root[data-shell=datapad] .pcm-hw-portbay b{position:absolute;top:4px;height:5px;background:#020303;border:1px solid #444b4c;box-shadow:inset 0 1px 2px #000}
  #pcm-root[data-shell=datapad] .pcm-port-usb{left:12px;width:26px;border-radius:2px}.pcm-port-jack{left:52px;width:8px;border-radius:50%}.pcm-port-dock{right:11px;width:38px;border-radius:2px}
  #pcm-root[data-shell=datapad] .pcm-hw-led{top:8px;width:6px;height:6px}.pcm-hw-led-power{right:45px!important}.pcm-hw-led-link{right:33px!important}
  #pcm-root[data-shell=datapad] .pcm-hw-serial{position:absolute;left:33px;bottom:5px;color:#ffffff4a;font:650 6px/1 ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;letter-spacing:.04em;font-style:normal;white-space:nowrap}
  #pcm-root[data-shell=datapad] .pcm-hw-vent,#pcm-root[data-shell=datapad] .pcm-hw-sidekey,#pcm-root[data-shell=datapad] .pcm-hw-port,#pcm-root[data-shell=datapad] .pcm-hw-mark{display:none!important}
  #pcm-root[data-shell=datapad] .pcm-top{border-radius:10px 10px 0 0}
  #pcm-root[data-shell=datapad] .pcm-brand small,#pcm-root[data-shell=datapad] .pcm-caption,#pcm-root[data-shell=datapad] .pcm-section-head small,#pcm-root[data-shell=datapad] .pcm-welcome span,#pcm-root[data-shell=datapad] .pcm-field>span,#pcm-root[data-shell=datapad] .pcm-detail-panel>h3{letter-spacing:.045em}
  #pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-device-screen{inset:9px 18px 10px}
  #pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-hw-radiator,#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-hw-grip,#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-hw-portbay,#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-hw-serial,#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-hw-key{display:none}

  #pcm-root .pcm-subscription-list{display:grid;gap:10px}
  #pcm-root .pcm-subscription-card{display:grid;grid-template-columns:minmax(190px,1.15fr) minmax(260px,1fr) auto;gap:12px;align-items:center;padding:13px;background:linear-gradient(145deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:12px;box-shadow:inset 0 1px 0 #ffffff08}
  #pcm-root .pcm-subscription-card.expired{opacity:.72;border-style:dashed}
  #pcm-root .pcm-subscription-brand{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;align-items:center}.pcm-subscription-icon{width:52px;height:52px;display:grid;place-items:center;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:var(--field);color:var(--gold);font-size:24px}.pcm-subscription-icon img{width:100%;height:100%;object-fit:cover}.pcm-subscription-brand span{display:grid;gap:2px}.pcm-subscription-brand small{color:var(--teal);font-size:8px;font-weight:800;letter-spacing:.04em}.pcm-subscription-brand strong{font-size:15px;line-height:1.2}.pcm-subscription-brand em{color:var(--muted);font-size:10px;font-style:normal}
  #pcm-root .pcm-subscription-meter{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.pcm-subscription-meter>span{min-height:52px;padding:7px;display:flex;align-items:baseline;justify-content:center;gap:4px;flex-wrap:wrap;background:var(--field);border:1px solid #ffffff10;border-radius:8px;text-align:center}.pcm-subscription-meter small{flex-basis:100%;color:var(--muted);font-size:7px;font-weight:800;letter-spacing:.05em}.pcm-subscription-meter b{color:var(--gold);font-size:20px}.pcm-subscription-meter b.price{font-size:12px;overflow-wrap:anywhere}.pcm-subscription-meter i{color:var(--muted);font-size:9px;font-style:normal}
  #pcm-root .pcm-subscription-card>p{grid-column:1/-1;margin:0;color:var(--muted);font-size:10px}.pcm-subscription-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}.pcm-subscription-actions button{min-height:30px}
  #pcm-root .pcm-dashboard-subscriptions{margin:10px 0;padding:12px;background:linear-gradient(145deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:12px}.pcm-dashboard-subscriptions>header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.pcm-dashboard-subscriptions>header small{color:var(--teal);font-size:8px;font-weight:800;letter-spacing:.04em}.pcm-dashboard-subscriptions>div{display:grid;gap:7px}.pcm-subscription-card.compact{grid-template-columns:minmax(180px,1fr) minmax(250px,1fr) auto;padding:9px}.pcm-subscription-card.compact .pcm-subscription-icon{width:38px;height:38px}.pcm-subscription-card.compact .pcm-subscription-brand{grid-template-columns:38px minmax(0,1fr)}
  #pcm-root .pcm-window.is-compact .pcm-subscription-card,#pcm-root .pcm-window.is-narrow .pcm-subscription-card{grid-template-columns:1fr}.pcm-window.is-compact .pcm-subscription-actions,.pcm-window.is-narrow .pcm-subscription-actions{justify-content:flex-start}

  #pcm-root[data-shell=datapad] .pcm-resize-handle{z-index:70}
  #pcm-root[data-shell=datapad] .pcm-resize-handle[data-resize-handle=n]{top:-2px;height:14px}#pcm-root[data-shell=datapad] .pcm-resize-handle[data-resize-handle=s]{bottom:-2px;height:14px}#pcm-root[data-shell=datapad] .pcm-resize-handle[data-resize-handle=e]{right:-2px;width:14px}#pcm-root[data-shell=datapad] .pcm-resize-handle[data-resize-handle=w]{left:-2px;width:14px}
  #pcm-root[data-shell=datapad] .pcm-resize-handle[data-resize-handle=ne],#pcm-root[data-shell=datapad] .pcm-resize-handle[data-resize-handle=se],#pcm-root[data-shell=datapad] .pcm-resize-handle[data-resize-handle=sw],#pcm-root[data-shell=datapad] .pcm-resize-handle[data-resize-handle=nw]{width:24px;height:24px}
  #pcm-root[data-shell=datapad] .pcm-resize-handle::after{opacity:0!important}
  #pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-device-screen{inset:6px;border-radius:8px}#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-top{height:40px;padding:3px 5px}#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-brand select{height:34px}#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-device-hardware .pcm-hw-vent,#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-device-hardware .pcm-hw-port,#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-device-hardware .pcm-hw-sidekey,#pcm-root[data-shell=datapad] .pcm-window.is-minimized .pcm-device-hardware .pcm-hw-mark{display:none}

  #pcm-root[data-shell=flat] .pcm-device-screen{position:relative;inset:auto;width:100%;height:100%;overflow:hidden;border-radius:inherit;background:var(--bg-alpha)}
  #pcm-root[data-shell=flat] .pcm-interface-controls{margin:14px 0 4px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  #pcm-root .pcm-modal-backdrop{pointer-events:auto}
  #pcm-root aside>button>span{font-size:13px;font-weight:760;line-height:1.15}
  #pcm-root aside>button.pcm-nav-gangs>span{font-size:14px;font-weight:850}
  #pcm-root [data-contact-drop]{transition:border-color .12s ease,background .12s ease,box-shadow .12s ease}
  #pcm-root [data-contact-drop].pcm-drag-over{border-color:var(--gold)!important;background:var(--accent-hover)!important;box-shadow:inset 0 0 0 1px var(--gold),0 0 16px var(--accent-soft)}
  #pcm-root .pcm-contact-card.pcm-dragging{opacity:.45;transform:scale(.985)}
  #pcm-root .pcm-contact-message{width:100%;min-height:34px;border-width:1px 0 0 0;border-radius:0;background:transparent;color:var(--teal);font-weight:800}
  #pcm-root .pcm-contact-message:hover{background:var(--secondary-soft)}
  #pcm-root .pcm-help-panel{width:min(1080px,100%)}
  #pcm-root .pcm-help-panel>header p{margin:4px 0 0;color:var(--muted);font-size:10px}
  #pcm-root .pcm-help-columns{margin-top:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}
  #pcm-root .pcm-help-columns>section{min-width:0;padding:10px;background:var(--panel2);border:1px solid var(--line);border-radius:10px}
  #pcm-root .pcm-help-columns>section>h3{margin:0 0 8px;color:var(--gold);font-size:12px}
  #pcm-root .pcm-help-faq{margin:6px 0;background:var(--field);border:1px solid #ffffff12;border-radius:8px;overflow:hidden}
  #pcm-root .pcm-help-faq>summary{padding:9px 10px;color:var(--heading);font-size:10px;font-weight:850;cursor:pointer;list-style:none}
  #pcm-root .pcm-help-faq>summary::-webkit-details-marker{display:none}
  #pcm-root .pcm-help-faq[open]>summary{border-bottom:1px solid var(--line);background:var(--accent-soft)}
  #pcm-root .pcm-help-faq>div{padding:9px 10px;color:var(--muted);font-size:9px;line-height:1.55}
  #pcm-root .pcm-help-faq p{margin:0 0 7px}#pcm-root .pcm-help-faq p:last-child{margin-bottom:0}
  #pcm-root .pcm-help-panel>footer{display:flex;align-items:center;justify-content:space-between;gap:12px}#pcm-root .pcm-help-panel>footer small{color:var(--muted);line-height:1.4}
  #pcm-root .pcm-chat-recipient em{display:block;margin-top:4px;color:var(--teal);font-size:9px;font-style:normal}
  #pcm-root .pcm-chat-options{display:flex;flex-wrap:wrap;gap:8px;margin:9px 0}#pcm-root .pcm-chat-options label{display:flex;align-items:center;gap:6px;padding:7px 9px;background:var(--field);border:1px solid #ffffff12;border-radius:8px}
  @media(max-width:980px){#pcm-root .pcm-help-columns{grid-template-columns:1fr 1fr}}
  @media(max-width:700px){#pcm-root .pcm-help-columns{grid-template-columns:1fr}}
  @media(max-width:760px){#pcm-root .pcm-interface-controls{grid-template-columns:1fr}}
  @media(max-width:700px){#pcm-root .pcm-window{left:6px!important;top:6px!important;width:calc(100vw - 12px)!important;height:calc(100vh - 12px)!important;min-width:0;border-radius:16px}#pcm-root .pcm-theme-sliders{grid-template-columns:1fr}}
  `;

  const root = hostRoot;
  if ( !root ) throw new Error("Нео-Архив: hostRoot недоступен");
  root.id = "pcm-root";
  root.classList.add("field-archive-embedded", "neo-archive-view");
  const EMBEDDED_HOST_CSS = `#pcm-root.field-archive-embedded{position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important;display:block!important;inset:auto!important;pointer-events:auto!important;z-index:auto!important}
#pcm-root.field-archive-embedded .pcm-window{position:absolute!important;inset:0!important;left:0!important;top:0!important;right:0!important;bottom:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;transform:none!important}
#pcm-root.field-archive-embedded .pcm-resize-handle,#pcm-root.field-archive-embedded .pcm-window-toggle,#pcm-root.field-archive-embedded .pcm-close{display:none!important}
#pcm-root.field-archive-embedded .pcm-device-screen{max-width:none!important;max-height:none!important}`;
  root.innerHTML = `<style>${CSS}
${EMBEDDED_HOST_CSS}
  #pcm-root{font-size:clamp(14px,var(--font-size),20px)}
  #pcm-root main{font-size:1em}
  #pcm-root .pcm-section-head h1,#pcm-root .pcm-faction-head h1{font-size:clamp(24px,2.1em,34px);line-height:1.1}
  #pcm-root .pcm-section-head>div>small,#pcm-root .pcm-faction-head>div>small{font-size:11px;letter-spacing:.08em}
  #pcm-root .pcm-section-hint,#pcm-root .pcm-faction-head p{font-size:13px;line-height:1.5}
  #pcm-root .pcm-tag-static,#pcm-root .pcm-read-tags span,#pcm-root .pcm-directory-badges i,#pcm-root .pcm-contact-links i{font-size:12px!important;font-weight:750;padding:5px 9px!important;line-height:1.15;border-width:1px;box-shadow:inset 0 0 0 1px #ffffff08}
  #pcm-root .pcm-tag-static,#pcm-root .pcm-read-tags span{color:var(--ink)!important;background:var(--accent-soft)!important;border:1px solid var(--line)!important;border-radius:999px}
  #pcm-root .pcm-contact-links i{color:var(--ink)!important;background:var(--secondary-soft)!important;border-color:color-mix(in srgb,var(--teal) 45%,transparent)!important}
  #pcm-root .pcm-contact-links i.grouped{font-weight:850;color:var(--heading)!important}
  #pcm-root .pcm-contact-card .pcm-contact-copy>small{font-size:11px;font-weight:750}
  #pcm-root .pcm-contact-card .pcm-contact-copy>strong{font-size:17px;line-height:1.22}
  #pcm-root .pcm-contact-card .pcm-contact-copy>em{font-size:13px;line-height:1.45}
  #pcm-root .pcm-contact-meta{font-size:11px}
  #pcm-root .pcm-bind-contact{min-height:40px!important;padding:8px 14px!important;font-size:13px!important;font-weight:850!important;white-space:normal!important;text-align:center}
  #pcm-root .pcm-faction-head{padding-bottom:12px;border-bottom:1px solid var(--line)}
  #pcm-root .pcm-faction-head>div:last-child{display:flex;flex-wrap:wrap;gap:8px}
  #pcm-root .pcm-faction-groups{display:grid;gap:14px;margin-top:12px}
  #pcm-root .pcm-faction-group{background:var(--panel-alpha);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  #pcm-root .pcm-faction-group>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:linear-gradient(90deg,var(--accent-soft),transparent)}
  #pcm-root .pcm-faction-group>header>div:first-child small{font-size:10px;color:var(--muted);letter-spacing:.08em}
  #pcm-root .pcm-faction-group>header h2{margin:2px 0 0;font-size:19px;line-height:1.2}
  #pcm-root .pcm-faction-group>header>div:last-child{display:flex;align-items:center;gap:8px}
  #pcm-root .pcm-faction-group>header em{min-width:30px;height:30px;display:grid;place-items:center;border-radius:999px;background:var(--field);border:1px solid var(--line);font-style:normal;font-weight:900}
  #pcm-root .pcm-faction-group>.pcm-contact-list{padding:10px}
  #pcm-root .pcm-faction-group.pcm-orphan-group{border-style:dashed;border-color:color-mix(in srgb,var(--gold) 58%,var(--line))}
  #pcm-root .pcm-faction-group.pcm-orphan-group>header{background:linear-gradient(90deg,color-mix(in srgb,var(--gold) 10%,transparent),transparent)}
  #pcm-root .pcm-faction-group-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;min-width:0}
  #pcm-root .pcm-faction-group-tools>button{min-height:38px;padding:7px 12px;font-size:12.5px;font-weight:800}
  #pcm-root .pcm-faction-group-tools>.pcm-bind-actions{display:flex;flex-wrap:wrap;gap:8px}
  #pcm-root .pcm-faction-directory-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px;margin-top:14px}
  #pcm-root .pcm-faction-tile{background:var(--panel-alpha);border:1px solid var(--line);border-radius:12px;overflow:hidden;min-width:0}
  #pcm-root .pcm-faction-open{width:100%;display:grid;grid-template-columns:58px minmax(0,1fr) 20px;gap:10px;align-items:start;padding:12px;text-align:left;background:transparent;border:0;border-radius:0}
  #pcm-root .pcm-faction-symbol{width:54px;height:54px;border-radius:10px;display:grid;place-items:center;background:var(--field);border:1px solid var(--line);font-size:24px;overflow:hidden}
  #pcm-root .pcm-faction-symbol img{width:100%;height:100%;object-fit:cover}
  #pcm-root .pcm-faction-open small{font-size:10px;color:var(--muted);letter-spacing:.08em}
  #pcm-root .pcm-faction-open strong{display:block;font-size:18px;line-height:1.2;margin:2px 0 5px;color:var(--heading)}
  #pcm-root .pcm-faction-open em{display:block;color:var(--muted);font-size:13px;line-height:1.4;font-style:normal}
  #pcm-root .pcm-faction-tile>footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-top:1px solid var(--line);background:var(--field)}
  #pcm-root .pcm-faction-tile>footer>span{font-size:12px;color:var(--muted);font-weight:700}
  #pcm-root .pcm-directory-bind-row{display:grid;gap:6px;padding:12px;border:1px solid var(--line);background:var(--accent-soft);border-radius:10px}
  #pcm-root .pcm-directory-bind-row small{font-size:12px;color:var(--muted);line-height:1.4}
  #pcm-root .pcm-contact-picker,#pcm-root .pcm-quick-group-create{width:min(680px,calc(100vw - 30px));max-height:min(78vh,760px);display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 20px 70px #000b;overflow:hidden}
  #pcm-root .pcm-contact-picker>header,#pcm-root .pcm-quick-group-create>header{display:flex;justify-content:space-between;gap:14px;padding:16px;border-bottom:1px solid var(--line)}
  #pcm-root .pcm-contact-picker h2,#pcm-root .pcm-quick-group-create h2{font-size:23px;margin:2px 0 4px}
  #pcm-root .pcm-contact-picker p,#pcm-root .pcm-quick-group-create p{margin:0;color:var(--muted);font-size:13px;line-height:1.45}
  #pcm-root .pcm-picker-token{margin:12px 14px 0;min-height:48px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;text-align:left}
  #pcm-root .pcm-picker-token span{font-size:11px;opacity:.82}
  #pcm-root .pcm-picker-search{margin:12px 14px 8px;display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;border:1px solid var(--line);background:var(--field);border-radius:10px;overflow:hidden}
  #pcm-root .pcm-picker-search span{text-align:center;font-size:17px;color:var(--gold)}
  #pcm-root .pcm-picker-search input{height:42px;border:0;background:transparent;color:var(--ink);font-size:14px;min-width:0}
  #pcm-root .pcm-picker-list{padding:6px 14px 14px;overflow:auto;display:grid;gap:7px}
  #pcm-root .pcm-picker-list>button{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:54px;padding:7px 10px;text-align:left}
  #pcm-root .pcm-picker-list>button>span:nth-child(2) b{display:block;font-size:14px} #pcm-root .pcm-picker-list>button>span:nth-child(2) small{font-size:11px;color:var(--muted)}
  #pcm-root .pcm-picker-list>button>strong{font-size:12px;color:var(--gold)}
  #pcm-root .pcm-picker-list>button.is-linked{opacity:.6}
  #pcm-root .pcm-picker-avatar{width:40px;height:40px;border-radius:8px;display:grid;place-items:center;overflow:hidden;background:var(--field);border:1px solid var(--line)}
  #pcm-root .pcm-picker-avatar img{width:100%;height:100%;object-fit:cover}
  #pcm-root .pcm-contact-picker>footer,#pcm-root .pcm-quick-group-create>footer{display:flex;justify-content:flex-end;gap:8px;padding:11px 14px;border-top:1px solid var(--line)}
  #pcm-root .pcm-quick-group-create>label{display:grid;gap:7px;padding:18px 16px} #pcm-root .pcm-quick-group-create>label span{font-weight:800} #pcm-root .pcm-quick-group-create>label input{height:46px;padding:0 12px;font-size:16px;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:9px}
  #pcm-root .pcm-contact-category-field{border:1px solid var(--line);border-radius:10px;padding:10px} #pcm-root .pcm-contact-category-field legend{padding:0 6px;font-weight:850} #pcm-root .pcm-category-chip-editor{display:flex;flex-wrap:wrap;gap:7px} #pcm-root .pcm-category-chip-editor label{cursor:pointer} #pcm-root .pcm-category-chip-editor input{position:absolute;opacity:0;pointer-events:none} #pcm-root .pcm-category-chip-editor span{display:inline-flex;padding:7px 10px;border-radius:999px;border:1px solid var(--line);background:var(--field);font-size:12px;font-weight:800} #pcm-root .pcm-category-chip-editor label.active span{background:var(--accent-soft);color:var(--heading);border-color:var(--gold)}
  @media(max-width:720px){#pcm-root .pcm-faction-group>header{align-items:stretch;flex-direction:column}#pcm-root .pcm-faction-group>header>div:last-child,#pcm-root .pcm-faction-group-tools{justify-content:flex-start;width:100%}#pcm-root .pcm-faction-group-tools>button,#pcm-root .pcm-faction-group-tools>.pcm-bind-actions{flex:1 1 auto}#pcm-root .pcm-faction-directory-grid{grid-template-columns:1fr!important}}
  #pcm-root .pcm-section-head h1,#pcm-root .pcm-faction-head h1{font-size:clamp(25px,2.1vw,31px)!important;line-height:1.12}
  #pcm-root .pcm-section-head p,#pcm-root .pcm-section-hint{font-size:14px!important;line-height:1.5}
  #pcm-root .pcm-contact-card .pcm-contact-copy>small{font-size:12px!important}#pcm-root .pcm-contact-card .pcm-contact-copy>strong{font-size:18px!important}#pcm-root .pcm-contact-card .pcm-contact-copy>em{font-size:14px!important}#pcm-root .pcm-contact-meta{font-size:12px!important}
  #pcm-root .pcm-tag-static,#pcm-root .pcm-read-tags span,#pcm-root .pcm-directory-badges i,#pcm-root .pcm-contact-links i,#pcm-root .pcm-person-tags span{display:inline-flex;align-items:center;min-height:30px;padding:6px 11px!important;font-size:13.5px!important;font-weight:850!important;line-height:1.15;border-radius:999px;border:1px solid var(--line);background:var(--accent-soft);color:var(--heading);box-shadow:inset 0 0 0 1px #ffffff08}
  #pcm-root .pcm-contact-links{display:flex;flex-wrap:wrap;gap:7px;margin:5px 0 3px}#pcm-root .pcm-contact-links i.grouped{border-color:var(--gold);background:linear-gradient(135deg,var(--accent-soft),var(--secondary-soft))}
  #pcm-root .pcm-person-affiliations{margin:9px 0 6px}#pcm-root .pcm-person-affiliations .pcm-contact-links i{min-height:34px;padding:8px 13px!important;font-size:14px!important}
  #pcm-root .pcm-person-tags{display:flex;flex-wrap:wrap;gap:7px;margin:7px 0 10px}#pcm-root .pcm-person-tags span{background:var(--secondary-soft);border-color:var(--teal)}
  #pcm-root .pcm-category-chip-editor{gap:9px!important}#pcm-root .pcm-category-chip-editor span{min-height:38px!important;padding:9px 13px!important;font-size:13.5px!important;font-weight:850!important;align-items:center}#pcm-root .pcm-contact-category-field>small{font-size:12.5px;line-height:1.45}
  #pcm-root .pcm-bind-contact,#pcm-root .pcm-bind-selected{min-height:46px!important;padding:10px 16px!important;font-size:14.5px!important;font-weight:900!important;line-height:1.18;white-space:normal!important;text-align:center}#pcm-root .pcm-bind-contact.compact{min-height:42px!important;padding:8px 13px!important;font-size:13.5px!important}
  #pcm-root .pcm-bind-selected{border-color:var(--gold)!important;box-shadow:0 0 0 1px var(--accent-soft),inset 0 -2px 0 #0005}#pcm-root .pcm-bind-actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px}
  #pcm-root .pcm-faction-group>header{align-items:center}#pcm-root .pcm-faction-group>header>div:last-child{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px}#pcm-root .pcm-faction-group>header h2{font-size:21px!important}
  #pcm-root .pcm-directory-bind-row{align-items:center!important;gap:10px!important}#pcm-root .pcm-directory-bind-row>small{font-size:13px!important;line-height:1.45}
  #pcm-root .pcm-picker-list>button>span:nth-child(2) b{font-size:15px!important}#pcm-root .pcm-picker-list>button>span:nth-child(2) small{font-size:12px!important}#pcm-root .pcm-picker-list>button>strong{font-size:13px!important}
  #pcm-root[data-shell=datapad] .pcm-field>span,#pcm-root[data-shell=datapad] .pcm-detail-panel>h3{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Arial,sans-serif!important;letter-spacing:normal!important}
  #pcm-root .pcm-field>span{font-size:12.5px!important;line-height:1.3}#pcm-root .pcm-detail-panel h3{font-size:15px!important;line-height:1.25}#pcm-root .pcm-detail-panel h4{font-size:12px!important;line-height:1.3}
  #pcm-root .pcm-badges span{min-height:29px;display:inline-flex;align-items:center;padding:6px 10px!important;font-size:12.5px!important;font-weight:800}
  #pcm-root .pcm-help-faq>summary{font-size:14px!important;line-height:1.3}#pcm-root .pcm-help-faq>div{font-size:13px!important;line-height:1.6}#pcm-root .pcm-help-panel p,#pcm-root .pcm-help-panel li{font-size:13px;line-height:1.55}
  #pcm-root .pcm-hero-tag-panel{margin:12px 0 10px;padding:12px 13px;background:linear-gradient(145deg,#00000024,var(--accent-soft));border:1px solid var(--line);border-radius:12px}
  #pcm-root .pcm-hero-tag-panel.is-locked{background:linear-gradient(145deg,#00000030,#0b1018)}
  #pcm-root .pcm-inline-tags>header{min-width:0;flex-wrap:wrap}
  #pcm-root .pcm-inline-tags>header>div{min-width:0;flex:1 1 180px}
  #pcm-root .pcm-inline-tags>header h3{font-size:15px!important;line-height:1.25;overflow-wrap:anywhere}
  #pcm-root .pcm-inline-lock{min-height:36px!important;padding:6px 11px!important;font-size:12.5px!important;flex:0 0 auto}
  #pcm-root .pcm-inline-lock b{font-size:17px!important}
  #pcm-root .pcm-lock-glyph{position:relative;width:15px;height:12px;display:inline-block;flex:0 0 15px;border:2px solid currentColor;border-radius:3px;box-shadow:inset 0 0 0 1px #0003}
  #pcm-root .pcm-lock-glyph::before{content:"";position:absolute;left:2px;top:-9px;width:7px;height:8px;border:2px solid currentColor;border-bottom:0;border-radius:7px 7px 0 0}
  #pcm-root .pcm-inline-lock.is-unlocked .pcm-lock-glyph::before{left:7px;top:-8px;transform:rotate(22deg);transform-origin:left bottom}
  #pcm-root .pcm-inline-tag-read{min-height:32px}
  #pcm-root .pcm-inline-tag-read .muted{font-size:12.5px;line-height:1.45}
  #pcm-root .pcm-contact-list{align-items:start}
  #pcm-root .pcm-contact-card{height:auto!important;min-height:0!important;display:grid;grid-template-rows:auto auto;align-self:start;overflow:hidden}
  #pcm-root .pcm-contact-open{height:auto!important;min-height:0!important;padding:12px!important;grid-template-columns:66px minmax(0,1fr) 18px!important;align-items:start!important;gap:11px!important;overflow:visible!important}
  #pcm-root .pcm-contact-photo{width:66px!important;height:66px!important;align-self:start}
  #pcm-root .pcm-contact-copy{min-height:0!important;display:flex!important;flex-direction:column;align-items:stretch;overflow:visible!important}
  #pcm-root .pcm-contact-copy>small{line-height:1.3;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
  #pcm-root .pcm-contact-copy>strong{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere;word-break:normal}
  #pcm-root .pcm-contact-copy>.pcm-contact-links{width:100%;max-height:none!important;overflow:visible!important;margin:7px 0 1px}
  #pcm-root .pcm-contact-copy>.pcm-contact-links i{max-width:100%;white-space:normal!important;overflow-wrap:anywhere;text-align:left}
  #pcm-root .pcm-contact-copy>em{display:block!important;min-height:0!important;max-height:none!important;overflow:visible!important;-webkit-line-clamp:unset!important;margin-top:7px!important}
  #pcm-root .pcm-contact-meta{width:100%;margin-top:8px!important}
  #pcm-root .pcm-contact-open>b{align-self:start;margin-top:4px}
  #pcm-root .pcm-contact-message{position:static!important;display:flex;align-items:center;justify-content:center;width:100%;min-height:40px!important;height:auto!important;padding:7px 10px!important;border-width:1px 0 0 0!important;border-radius:0!important}
  #pcm-root .pcm-faction-group>.pcm-contact-list{align-items:start}
  @media(max-width:1050px){#pcm-root .pcm-contact-open{grid-template-columns:58px minmax(0,1fr) 16px!important}#pcm-root .pcm-contact-photo{width:58px!important;height:58px!important}}
  @media(max-width:720px){#pcm-root .pcm-contact-open{grid-template-columns:52px minmax(0,1fr) 14px!important;padding:10px!important}#pcm-root .pcm-contact-photo{width:52px!important;height:52px!important}#pcm-root .pcm-inline-lock{width:auto!important}}
  #pcm-root .pcm-compact-person-tags{display:flex;flex-wrap:wrap;gap:5px;min-width:0;margin:5px 0 2px;align-items:center}
  #pcm-root .pcm-compact-person-tags i{display:inline-flex;align-items:center;max-width:100%;min-height:25px;padding:4px 8px;border:1px solid color-mix(in srgb,var(--teal) 38%,var(--line));border-radius:999px;background:var(--accent-soft);color:var(--heading);font-size:11.5px;font-weight:800;font-style:normal;line-height:1.12;white-space:normal;overflow-wrap:anywhere;text-align:left}
  #pcm-root .pcm-compact-person-tags i.grouped{border-color:var(--gold);background:linear-gradient(135deg,var(--accent-soft),var(--secondary-soft))}
  #pcm-root .pcm-compact-person-tags i.manual{border-color:color-mix(in srgb,var(--secondary) 55%,var(--line));background:var(--secondary-soft)}
  #pcm-root .pcm-compact-person-tags i.more{min-width:30px;justify-content:center;color:var(--gold)}
  #pcm-root .pcm-person-open{height:auto!important;min-height:86px!important;align-items:start!important;overflow:visible!important}
  #pcm-root .pcm-person-open .pcm-person-tile-copy{min-width:0;display:flex;flex-direction:column;align-items:flex-start;overflow:visible!important}
  #pcm-root .pcm-person-open .pcm-person-tile-copy>b,#pcm-root .pcm-person-open .pcm-person-tile-copy>small,#pcm-root .pcm-person-open .pcm-person-tile-copy>em{max-width:100%}
  #pcm-root .pcm-person-open .pcm-person-tile-copy>b{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere;font-size:16px;line-height:1.2}
  #pcm-root .pcm-person-open .pcm-person-tile-copy>small{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;font-size:11px;margin:3px 0 0}
  #pcm-root .pcm-person-open .pcm-person-tile-copy>em{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;font-size:11px;line-height:1.35;margin-top:4px}
  #pcm-root .pcm-person-tile{height:auto!important;align-self:start;overflow:visible!important}
  #pcm-root .pcm-link-existing{margin-top:14px;padding-top:0;border-top:0}
  #pcm-root .pcm-link-existing>summary{list-style:none;display:grid;grid-template-columns:42px minmax(0,1fr) 24px;align-items:center;gap:10px;min-height:60px;padding:10px 12px;color:var(--heading)!important;background:linear-gradient(135deg,var(--accent-soft),#00000020);border:1px solid color-mix(in srgb,var(--gold) 62%,var(--line));border-radius:11px;box-shadow:inset 0 1px 0 #ffffff0c,0 3px 10px #00000020;cursor:pointer;font-size:15px!important;font-weight:900;line-height:1.2}
  #pcm-root .pcm-link-existing>summary::-webkit-details-marker{display:none}
  #pcm-root .pcm-link-existing>summary .pcm-link-existing-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:9px;background:var(--field);border:1px solid var(--gold);color:var(--gold);font-size:21px;line-height:1}
  #pcm-root .pcm-link-existing>summary>span:nth-child(2){min-width:0;display:flex;flex-direction:column;gap:3px}
  #pcm-root .pcm-link-existing>summary b{font-size:15px;line-height:1.2}
  #pcm-root .pcm-link-existing>summary small{color:var(--muted);font-size:11.5px;font-weight:650;line-height:1.3}
  #pcm-root .pcm-link-existing>summary>i{font-size:18px;font-style:normal;color:var(--teal);transition:transform .12s ease}
  #pcm-root .pcm-link-existing[open]>summary>i{transform:rotate(180deg)}
  #pcm-root .pcm-link-existing>div{margin-top:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
  #pcm-root .pcm-link-existing>div>button{min-width:0;min-height:58px;height:auto!important;padding:8px 10px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;text-align:left;white-space:normal!important;overflow:visible!important}
  #pcm-root .pcm-link-person-title{display:block;min-width:0;font-size:13px;font-weight:850;line-height:1.2}
  #pcm-root .pcm-link-person-title small{display:block!important;margin:3px 0 0!important;color:var(--muted);font-size:10.5px!important;font-weight:650}
  #pcm-root .pcm-link-existing>div>button .pcm-compact-person-tags{margin-top:6px}
  @media(max-width:900px){#pcm-root .pcm-link-existing>div{grid-template-columns:1fr}}
  @media(max-width:620px){#pcm-root .pcm-link-existing>summary{grid-template-columns:36px minmax(0,1fr) 20px;min-height:54px;padding:9px}#pcm-root .pcm-link-existing>summary .pcm-link-existing-icon{width:36px;height:36px;font-size:18px}#pcm-root .pcm-link-existing>summary b{font-size:14px}#pcm-root .pcm-link-existing>summary small{font-size:10.5px}}
  @keyframes pcmHudProgress{from{background-position:0 0}to{background-position:84px 0}}
  @keyframes pcmHudSweep{from{transform:translateX(-150%) skewX(-18deg)}to{transform:translateX(480%) skewX(-18deg)}}
  @keyframes pcmHudGlow{0%,100%{filter:brightness(1);opacity:.78}50%{filter:brightness(1.2);opacity:1}}
  @keyframes pcmHudSignal{0%,100%{box-shadow:0 0 0 rgba(0,0,0,0)}50%{box-shadow:0 0 13px var(--secondary-soft),0 0 20px var(--accent-soft)}}
  @keyframes pcmHudGrid{from{background-position:0 0,0 0}to{background-position:0 18px,72px 0}}
  @keyframes pcmHudSpin{to{transform:rotate(360deg)}}
  @keyframes pcmHudEnter{from{opacity:.55;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}

  #pcm-root .pcm-device-screen{display:grid!important;grid-template-rows:auto auto minmax(0,1fr)!important;min-width:0!important;min-height:0!important}
  #pcm-root .pcm-window.is-minimized .pcm-scan-strip{display:none!important}
  #pcm-root .pcm-window.is-minimized .pcm-device-screen{grid-template-rows:auto!important}

  #pcm-root .pcm-scan-strip{min-width:0;height:31px;padding:4px 11px;display:grid;grid-template-columns:minmax(160px,1fr) minmax(100px,280px) auto;align-items:center;gap:10px;background:linear-gradient(180deg,var(--chrome),var(--bg-alpha));border-bottom:1px solid var(--line);box-shadow:inset 0 -1px 0 var(--secondary-soft)}
  #pcm-root .pcm-scan-strip span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--teal);font:750 8px/1 ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;letter-spacing:.08em}
  #pcm-root .pcm-scan-strip span b{color:var(--heading)}
  #pcm-root .pcm-scan-strip span small{font-size:7px;color:var(--teal)}
  #pcm-root .pcm-scan-strip strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--heading);font:850 10px/1 ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;letter-spacing:.08em}
  #pcm-root .pcm-scan-bar{height:10px;overflow:hidden;border:1px solid var(--secondary-soft);background:repeating-linear-gradient(90deg,var(--field) 0 5px,transparent 5px 8px)}
  #pcm-root .pcm-scan-bar i{display:block;width:64%;height:100%;background:repeating-linear-gradient(90deg,var(--teal) 0 5px,var(--secondary-soft) 5px 8px);background-size:84px 100%}

  #pcm-root .pcm-layout{height:auto!important;min-height:0!important;overflow:hidden!important;display:grid!important;grid-template-columns:minmax(0,1fr) clamp(225px,28%,290px)!important;grid-template-areas:"main aside"!important;background:repeating-linear-gradient(180deg,transparent 0 17px,var(--screen-grid) 17px 18px),linear-gradient(90deg,transparent,var(--secondary-soft),transparent)!important;background-size:100% 18px,72px 100%!important}
  #pcm-root main{grid-area:main!important;min-width:0!important;min-height:0!important;overflow:auto!important;padding:13px!important;background:radial-gradient(circle at 18% 0%,var(--accent-soft),transparent 32%),linear-gradient(180deg,#00000010,transparent 120px)!important}
  #pcm-root aside{grid-area:aside!important;min-width:0!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;padding:10px 9px!important;background:linear-gradient(180deg,var(--sidebar),var(--sidebar-tint))!important;border-left:1px solid var(--line)!important;border-right:0!important;box-shadow:inset 1px 0 0 #ffffff05,inset 8px 0 18px #0003!important}
  #pcm-root .pcm-nav-header{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:4px 3px 8px;margin-bottom:4px;border-bottom:1px solid var(--line)}
  #pcm-root .pcm-nav-header small{color:var(--muted);font:750 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.18em;text-transform:uppercase}
  #pcm-root .pcm-nav-header b{color:var(--gold);font:900 17px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}
  #pcm-root aside>button{min-height:42px!important;padding:0 8px!important;grid-template-columns:24px minmax(0,1fr) 22px!important;gap:7px!important;border-radius:0!important;clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,6px 100%,0 calc(100% - 6px))!important;background:linear-gradient(90deg,var(--panel-alpha),var(--field))!important;border:1px solid var(--secondary-soft)!important;overflow:hidden!important}
  #pcm-root aside>button>span{font:780 12px/1.05 ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace!important;text-transform:uppercase!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  #pcm-root aside>button>b{color:var(--teal)!important;font-size:15px!important}
  #pcm-root aside>button i{width:22px!important;min-width:22px!important;max-width:22px!important;border-radius:0!important;color:var(--teal)!important;background:var(--secondary-soft)!important}
  #pcm-root aside>button.active{color:var(--heading)!important;border-color:var(--gold)!important;background:linear-gradient(90deg,var(--accent-hover),var(--field) 76%)!important;box-shadow:inset 3px 0 0 var(--gold),0 0 10px var(--accent-soft)!important}
  #pcm-root .pcm-caption{margin:9px 6px 3px!important;padding-left:7px!important;border-left:2px solid var(--gold)!important;color:var(--muted)!important;font:800 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.14em!important}
  #pcm-root .pcm-goal{margin-top:8px!important;padding:8px!important;border-radius:0!important;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)!important;background:linear-gradient(180deg,var(--panel-alpha),var(--field))!important}
  #pcm-root .pcm-goal span{font:800 8px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.12em!important}
  #pcm-root .pcm-goal textarea{height:48px!important;min-height:48px!important}

  #pcm-root .pcm-window.nav-collapsed .pcm-layout,#pcm-root .pcm-window.is-compact .pcm-layout{grid-template-columns:minmax(0,1fr) 58px!important;grid-template-areas:"main aside"!important}
  #pcm-root .pcm-window.nav-collapsed .pcm-nav-header,#pcm-root .pcm-window.is-compact .pcm-nav-header{display:none!important}
  #pcm-root .pcm-window.nav-collapsed aside>button,#pcm-root .pcm-window.is-compact aside>button{grid-template-columns:1fr!important;justify-items:center!important;padding:0!important}
  #pcm-root .pcm-window.nav-collapsed aside>button span,#pcm-root .pcm-window.nav-collapsed aside>button i,#pcm-root .pcm-window.nav-collapsed .pcm-caption,#pcm-root .pcm-window.nav-collapsed .pcm-goal,#pcm-root .pcm-window.is-compact aside>button span,#pcm-root .pcm-window.is-compact aside>button i,#pcm-root .pcm-window.is-compact .pcm-caption,#pcm-root .pcm-window.is-compact .pcm-goal{display:none!important}
  #pcm-root .pcm-window.is-narrow .pcm-layout{grid-template-columns:minmax(0,1fr) 52px!important}
  #pcm-root .pcm-window.is-narrow aside{padding:8px 6px!important}

  #pcm-root .pcm-cyber-alert{min-width:0;display:grid;grid-template-columns:120px minmax(0,1fr) 195px;gap:10px;padding:13px;margin-bottom:10px;background:linear-gradient(180deg,var(--accent-soft),var(--panel-alpha) 45%,var(--bg-alpha));border:1px solid var(--line);clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,14px 100%,0 calc(100% - 14px));box-shadow:inset 0 0 0 1px var(--secondary-soft)}
  #pcm-root .pcm-cyber-date{display:flex;align-items:flex-start;gap:9px;padding-top:5px;min-width:0}
  #pcm-root .pcm-cyber-date>b{width:50px;height:50px;flex:0 0 50px;display:grid;place-items:center;background:var(--teal);color:var(--primary-ink);font:900 27px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;clip-path:polygon(0 0,100% 0,100% 76%,76% 100%,0 100%)}
  #pcm-root .pcm-cyber-date span{min-width:0;display:grid;gap:4px;padding-top:4px}
  #pcm-root .pcm-cyber-date small{color:var(--teal);font:800 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.1em}
  #pcm-root .pcm-cyber-date strong{min-width:0;overflow-wrap:anywhere;color:var(--heading);font:850 10px/1.12 ui-monospace,"Cascadia Mono",Consolas,monospace;text-transform:uppercase}
  #pcm-root .pcm-cyber-attention{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:3px 8px}
  #pcm-root .pcm-cyber-attention>small{align-self:flex-start;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 6px;color:var(--teal);border:1px solid var(--line);font:750 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.11em}
  #pcm-root .pcm-attention-sign{width:66px;height:54px;margin:7px 0 2px;display:grid;place-items:center;color:var(--teal);font:900 31px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;border:5px solid var(--teal);clip-path:polygon(50% 0,100% 100%,0 100%)}
  #pcm-root .pcm-cyber-attention h1{margin:0!important;color:var(--teal)!important;font:900 20px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.04em!important}
  #pcm-root .pcm-cyber-attention p{max-width:100%;margin:5px 0 7px;color:var(--muted)!important;font:750 8px/1.25 ui-monospace,"Cascadia Mono",Consolas,monospace;overflow-wrap:anywhere}
  #pcm-root .pcm-cyber-progress{width:100%;height:10px;overflow:hidden;border:1px solid var(--line);background:var(--field)}
  #pcm-root .pcm-cyber-progress i{display:block;height:100%;background:repeating-linear-gradient(90deg,var(--teal) 0 5px,var(--secondary-soft) 5px 8px);background-size:84px 100%}
  #pcm-root .pcm-cyber-attention footer{width:100%;display:flex;justify-content:space-between;gap:8px;margin-top:4px;color:var(--muted);font:750 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.1em}
  #pcm-root .pcm-cyber-attention footer b{color:var(--teal)}
  #pcm-root .pcm-cyber-status{position:relative;min-width:0;align-self:end;min-height:120px;padding:10px 10px 10px 12px;background:var(--field);border:1px solid var(--line);border-left:22px solid var(--gold);clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%);overflow:hidden}
  #pcm-root .pcm-cyber-status small{color:var(--muted);font:750 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.13em}
  #pcm-root .pcm-cyber-status>b{display:block;margin:7px 0 2px;color:var(--teal);font:900 19px/1 ui-monospace,"Cascadia Mono",Consolas,monospace}
  #pcm-root .pcm-cyber-status>span{color:var(--heading);font:750 8px/1 ui-monospace,"Cascadia Mono",Consolas,monospace}
  #pcm-root .pcm-binary{margin-top:12px;color:var(--gold);font:700 7px/1.3 ui-monospace,"Cascadia Mono",Consolas,monospace;opacity:.8;overflow-wrap:anywhere}
  #pcm-root .pcm-cyber-status::after{content:"";position:absolute;right:10px;top:10px;width:10px;height:10px;border:2px solid var(--teal);border-top-color:transparent;border-radius:50%}

  #pcm-root .pcm-dashboard-grid{min-width:0;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(220px,.78fr);gap:10px;align-items:start}
  #pcm-root .pcm-dashboard-main,#pcm-root .pcm-dashboard-side{min-width:0;display:grid;align-content:start;gap:10px}
  #pcm-root .pcm-capture,#pcm-root .pcm-quick,#pcm-root .pcm-recent,#pcm-root .pcm-dashboard-subscriptions,#pcm-root .pcm-cyber-mini,#pcm-root .pcm-scene-context{margin:0!important;padding:11px!important;border-radius:0!important;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,7px 100%,0 calc(100% - 7px))!important;background:linear-gradient(180deg,var(--panel-alpha),var(--field))!important;border:1px solid var(--secondary-soft)!important;box-shadow:inset 0 0 0 1px #ffffff03!important}
  #pcm-root .pcm-capture{border-color:var(--line)!important;background:linear-gradient(180deg,var(--accent-soft),var(--panel-alpha))!important}
  #pcm-root .pcm-capture h2,#pcm-root .pcm-quick h2,#pcm-root .pcm-recent h2,#pcm-root .pcm-dashboard-subscriptions h2,#pcm-root .pcm-scene-context h2{font-size:15px!important;line-height:1.08!important}
  #pcm-root .pcm-capture p,#pcm-root .pcm-quick p,#pcm-root .pcm-recent p,#pcm-root .pcm-dashboard-subscriptions p,#pcm-root .pcm-scene-context p{font-size:10px!important;line-height:1.3!important}
  #pcm-root .pcm-capture small,#pcm-root .pcm-quick small,#pcm-root .pcm-recent small,#pcm-root .pcm-dashboard-subscriptions small,#pcm-root .pcm-scene-context small{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:7px!important;letter-spacing:.08em}
  #pcm-root .pcm-capture-actions{min-width:160px!important;gap:6px!important}
  #pcm-root .pcm-capture-actions button{min-height:31px!important;border-radius:0!important;white-space:nowrap!important}
  #pcm-root .pcm-scene-status span{border-radius:0!important;font-size:8px!important}
  #pcm-root .pcm-scene-token{border-radius:0!important}
  #pcm-root .pcm-quick textarea{height:62px!important;min-height:62px!important;margin:8px 0!important;border-radius:0!important}
  #pcm-root .pcm-quick-save{grid-template-columns:minmax(130px,1fr) auto!important}
  #pcm-root .pcm-quick-save select{border-radius:0!important}
  #pcm-root .pcm-stat-grid{margin:0!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
  #pcm-root .pcm-stat-grid button{min-height:57px!important;padding:8px 9px!important;display:grid!important;grid-template-columns:32px minmax(0,1fr) 15px!important;gap:7px!important;align-items:center!important;text-align:left!important;border-radius:0!important;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,5px 100%,0 calc(100% - 5px))!important;background:linear-gradient(90deg,var(--panel-alpha),var(--field))!important;border:1px solid var(--secondary-soft)!important}
  #pcm-root .pcm-stat-grid button>b{font:900 15px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;color:var(--gold)!important}
  #pcm-root .pcm-stat-grid button span{min-width:0;display:grid!important;gap:3px;color:var(--heading)!important;font:800 11px/1.05 ui-monospace,"Cascadia Mono",Consolas,monospace!important;text-transform:uppercase!important;overflow:hidden!important}
  #pcm-root .pcm-stat-grid button span small{color:var(--teal)!important;font:750 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.1em!important}
  #pcm-root .pcm-stat-grid button i{color:var(--teal)!important;font-style:normal!important;font-size:10px!important}
  #pcm-root .pcm-cyber-mini{min-height:82px;display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;align-items:end}
  #pcm-root .pcm-cyber-mini small{color:var(--muted);font:750 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.14em}
  #pcm-root .pcm-cyber-mini b{grid-row:1/3;grid-column:2;color:var(--teal);font:900 28px/1 ui-monospace,"Cascadia Mono",Consolas,monospace}
  #pcm-root .pcm-cyber-mini span{color:var(--heading);font:750 8px/1.15 ui-monospace,"Cascadia Mono",Consolas,monospace;overflow-wrap:anywhere}
  #pcm-root .pcm-dashboard-side .pcm-subscription-card.compact{grid-template-columns:1fr!important;padding:8px!important;gap:7px!important}
  #pcm-root .pcm-dashboard-side .pcm-subscription-actions{justify-content:flex-start!important}
  #pcm-root .pcm-recent>header{align-items:flex-start!important}
  #pcm-root .pcm-recent>header>div{min-width:0}
  #pcm-root .pcm-recent>button{min-height:39px!important;padding:7px 8px!important;display:grid!important;grid-template-columns:20px minmax(0,1fr) 14px!important;gap:7px!important;border-radius:0!important;text-align:left!important}
  #pcm-root .pcm-recent>button b{color:var(--teal)!important;font-size:12px!important}
  #pcm-root .pcm-recent>button span{min-width:0!important;font-size:11px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  #pcm-root .pcm-recent>button small{font-size:8px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  #pcm-root .pcm-recent>button i{color:var(--teal);font-style:normal;font-size:10px}

  #pcm-root .pcm-top,#pcm-root .pcm-section-head,#pcm-root .pcm-card,#pcm-root .pcm-detail-panel,#pcm-root .pcm-theme-panel,#pcm-root .pcm-tools-panel,#pcm-root .pcm-help-panel,#pcm-root .pcm-search-panel,#pcm-root .pcm-chat-panel{border-radius:0!important}
  #pcm-root .pcm-section-head{border-left:2px solid var(--gold)!important;background:linear-gradient(90deg,var(--accent-soft),transparent 72%)!important}

  #pcm-root .pcm-top-actions>button,#pcm-root aside>button,#pcm-root .pcm-stat-grid button,#pcm-root .pcm-recent>button,#pcm-root .pcm-capture-actions button,#pcm-root .pcm-quick-save button{position:relative!important;overflow:hidden!important}
  #pcm-root .pcm-top-actions>button::after,#pcm-root aside>button::after,#pcm-root .pcm-stat-grid button::after,#pcm-root .pcm-recent>button::after,#pcm-root .pcm-capture-actions button::after,#pcm-root .pcm-quick-save button::after{content:"";position:absolute;top:0;bottom:0;left:-45%;width:24%;background:linear-gradient(90deg,transparent,#ffffff18,transparent);transform:skewX(-18deg);pointer-events:none;opacity:0}

  #pcm-root[data-effects=soft] .pcm-scan-bar i,#pcm-root[data-effects=soft] .pcm-cyber-progress i{animation:pcmHudProgress 1.15s linear infinite!important}
  #pcm-root[data-effects=vivid] .pcm-scan-bar i,#pcm-root[data-effects=vivid] .pcm-cyber-progress i{animation:pcmHudProgress .72s linear infinite!important}
  #pcm-root[data-effects=soft] .pcm-layout{animation:pcmHudGrid 9s linear infinite!important}
  #pcm-root[data-effects=vivid] .pcm-layout{animation:pcmHudGrid 5.5s linear infinite!important}
  #pcm-root[data-effects=soft] .pcm-scan-strip strong,#pcm-root[data-effects=soft] .pcm-nav-header b,#pcm-root[data-effects=soft] .pcm-attention-sign,#pcm-root[data-effects=soft] .pcm-cyber-status,#pcm-root[data-effects=soft] [data-save-badge]{animation:pcmHudGlow 2.1s ease-in-out infinite!important}
  #pcm-root[data-effects=vivid] .pcm-scan-strip strong,#pcm-root[data-effects=vivid] .pcm-nav-header b,#pcm-root[data-effects=vivid] .pcm-attention-sign,#pcm-root[data-effects=vivid] .pcm-cyber-status,#pcm-root[data-effects=vivid] [data-save-badge]{animation:pcmHudGlow 1.25s ease-in-out infinite!important}
  #pcm-root[data-effects=soft] .pcm-cyber-status::after{animation:pcmHudSpin 2.2s linear infinite!important}
  #pcm-root[data-effects=vivid] .pcm-cyber-status::after{animation:pcmHudSpin 1.25s linear infinite!important}
  #pcm-root[data-effects=soft] .pcm-top-actions>button::after,#pcm-root[data-effects=soft] aside>button::after,#pcm-root[data-effects=soft] .pcm-stat-grid button::after,#pcm-root[data-effects=soft] .pcm-recent>button::after,#pcm-root[data-effects=soft] .pcm-capture-actions button::after,#pcm-root[data-effects=soft] .pcm-quick-save button::after{opacity:.7;animation:pcmHudSweep 4.2s linear infinite!important}
  #pcm-root[data-effects=vivid] .pcm-top-actions>button::after,#pcm-root[data-effects=vivid] aside>button::after,#pcm-root[data-effects=vivid] .pcm-stat-grid button::after,#pcm-root[data-effects=vivid] .pcm-recent>button::after,#pcm-root[data-effects=vivid] .pcm-capture-actions button::after,#pcm-root[data-effects=vivid] .pcm-quick-save button::after{opacity:.9;animation:pcmHudSweep 2.7s linear infinite!important}
  #pcm-root[data-effects=soft] .pcm-cyber-alert,#pcm-root[data-effects=soft] .pcm-capture,#pcm-root[data-effects=soft] .pcm-quick,#pcm-root[data-effects=soft] .pcm-recent,#pcm-root[data-effects=soft] .pcm-dashboard-subscriptions,#pcm-root[data-effects=soft] .pcm-cyber-mini{animation:pcmHudEnter .24s ease-out,pcmHudSignal 4.6s ease-in-out infinite!important}
  #pcm-root[data-effects=vivid] .pcm-cyber-alert,#pcm-root[data-effects=vivid] .pcm-capture,#pcm-root[data-effects=vivid] .pcm-quick,#pcm-root[data-effects=vivid] .pcm-recent,#pcm-root[data-effects=vivid] .pcm-dashboard-subscriptions,#pcm-root[data-effects=vivid] .pcm-cyber-mini{animation:pcmHudEnter .2s ease-out,pcmHudSignal 3s ease-in-out infinite!important}
  #pcm-root[data-shell=datapad][data-effects=soft] .pcm-hw-led-power,#pcm-root[data-shell=datapad][data-effects=soft] .pcm-hw-led-link{animation:pcmHudGlow 1.8s ease-in-out infinite!important}
  #pcm-root[data-shell=datapad][data-effects=vivid] .pcm-hw-led-power,#pcm-root[data-shell=datapad][data-effects=vivid] .pcm-hw-led-link{animation:pcmHudGlow 1.05s ease-in-out infinite!important}
  #pcm-root[data-effects=off] .pcm-scan-bar i,#pcm-root[data-effects=off] .pcm-cyber-progress i,#pcm-root[data-effects=off] .pcm-layout,#pcm-root[data-effects=off] .pcm-scan-strip strong,#pcm-root[data-effects=off] .pcm-nav-header b,#pcm-root[data-effects=off] .pcm-attention-sign,#pcm-root[data-effects=off] .pcm-cyber-status,#pcm-root[data-effects=off] [data-save-badge],#pcm-root[data-effects=off] .pcm-cyber-alert,#pcm-root[data-effects=off] .pcm-capture,#pcm-root[data-effects=off] .pcm-quick,#pcm-root[data-effects=off] .pcm-recent,#pcm-root[data-effects=off] .pcm-dashboard-subscriptions,#pcm-root[data-effects=off] .pcm-cyber-mini,#pcm-root[data-effects=off] .pcm-top-actions>button::after,#pcm-root[data-effects=off] aside>button::after,#pcm-root[data-effects=off] .pcm-stat-grid button::after,#pcm-root[data-effects=off] .pcm-recent>button::after,#pcm-root[data-effects=off] .pcm-capture-actions button::after,#pcm-root[data-effects=off] .pcm-quick-save button::after{animation:none!important}

  #pcm-root[data-shell=datapad] .pcm-window{border-color:var(--device-metal)!important;background:linear-gradient(145deg,#ffffff0b,transparent 16% 82%,#0000002c),repeating-linear-gradient(90deg,var(--screen-grid) 0 1px,transparent 1px 5px),linear-gradient(180deg,var(--device-shell-hi),var(--device-shell) 18%,var(--device-shell) 80%,var(--device-shell-lo))!important}
  #pcm-root[data-shell=datapad] .pcm-device-screen{border-color:#000!important;box-shadow:0 0 0 2px #030506,inset 0 0 0 1px var(--device-rim),inset 0 0 22px var(--screen-glow)!important}
  #pcm-root[data-shell=datapad] .pcm-hw-key b{color:var(--teal)!important;opacity:.58}
  #pcm-root[data-shell=datapad] .pcm-hw-serial{color:var(--teal)!important;opacity:.42}

  #pcm-root[data-shell=flat] .pcm-window{overflow:hidden!important;border-radius:0!important;clip-path:polygon(0 18px,18px 0,calc(100% - 22px) 0,100% 22px,100% 100%,14px 100%,0 calc(100% - 14px))!important}
  #pcm-root[data-shell=flat] .pcm-device-screen{border-radius:0!important}

  #pcm-root .pcm-window.is-compact .pcm-cyber-alert{grid-template-columns:92px minmax(0,1fr)!important}
  #pcm-root .pcm-window.is-compact .pcm-cyber-status{grid-column:1/-1!important;min-height:86px!important;border-left-width:1px!important}
  #pcm-root .pcm-window.is-compact .pcm-dashboard-grid{grid-template-columns:1fr!important}
  #pcm-root .pcm-window.is-narrow .pcm-cyber-alert{grid-template-columns:1fr!important}
  #pcm-root .pcm-window.is-narrow .pcm-cyber-date{display:none!important}
  #pcm-root .pcm-window.is-narrow .pcm-cyber-status{grid-column:auto!important}
  #pcm-root .pcm-window.is-narrow .pcm-stat-grid{grid-template-columns:1fr!important}
  #pcm-root .pcm-window.is-short .pcm-cyber-alert{min-height:124px!important;padding:8px!important}
  #pcm-root .pcm-window.is-short .pcm-attention-sign{display:none!important}
  #pcm-root .pcm-window.is-short .pcm-cyber-status{min-height:78px!important}


  /* v7.1.2 — clean background pass, less interference, closer to reference HUD */
  #pcm-root{background:rgba(1,6,10,.58)!important;backdrop-filter:blur(2px)!important}
  #pcm-root .pcm-window{
    background:
      radial-gradient(circle at 68% -12%, rgba(113,244,255,.06), transparent 26%),
      radial-gradient(circle at 16% 0%, rgba(255,84,107,.10), transparent 24%),
      linear-gradient(180deg,#0a0d14 0%,#05070c 100%)!important;
    box-shadow:0 24px 70px rgba(0,0,0,.72), 0 0 0 1px rgba(255,84,107,.14)!important;
  }
  #pcm-root .pcm-device-screen{
    background:
      radial-gradient(circle at 18% 12%, rgba(255,84,107,.06), transparent 22%),
      linear-gradient(180deg,#060b12 0%,#04070c 100%)!important;
  }
  #pcm-root .pcm-layout,
  #pcm-root[data-shell=datapad] .pcm-layout{
    background:linear-gradient(180deg,rgba(255,255,255,.018),transparent 72px)!important;
    background-size:auto!important;
  }
  #pcm-root main,
  #pcm-root[data-shell=datapad] main{
    background:
      radial-gradient(circle at 20% 0%, rgba(255,84,107,.055), transparent 28%),
      linear-gradient(180deg,rgba(255,255,255,.02), transparent 90px),
      linear-gradient(180deg,#050911 0%, #04070c 100%)!important;
  }
  #pcm-root aside,
  #pcm-root[data-shell=datapad] aside{
    background:linear-gradient(180deg, rgba(13,19,30,.98), rgba(5,8,13,.98))!important;
    box-shadow:inset 1px 0 0 rgba(115,244,255,.08), inset 10px 0 16px rgba(0,0,0,.18)!important;
  }
  #pcm-root[data-shell=datapad] .pcm-window{
    background:
      linear-gradient(145deg, rgba(255,255,255,.05), transparent 16% 82%, rgba(0,0,0,.18)),
      linear-gradient(180deg, #1f252d 0%, #171c23 14%, #12161c 78%, #0e1218 100%)!important;
    border:1px solid rgba(95,107,117,.88)!important;
    box-shadow:
      0 26px 78px rgba(0,0,0,.72),
      0 3px 0 rgba(0,0,0,.65),
      inset 0 1px 0 rgba(255,255,255,.12),
      inset 0 -2px 0 rgba(0,0,0,.72),
      inset 0 0 0 2px rgba(0,0,0,.22)!important;
  }
  #pcm-root[data-shell=datapad] .pcm-device-screen{
    background:
      radial-gradient(circle at 50% -40%, rgba(115,244,255,.06), transparent 34%),
      radial-gradient(circle at 16% 0%, rgba(255,84,107,.07), transparent 24%),
      linear-gradient(180deg,#070c13 0%,#04070c 100%)!important;
    box-shadow:
      0 0 0 2px #050708,
      0 0 0 3px rgba(255,255,255,.07),
      inset 0 0 0 1px rgba(255,255,255,.05),
      inset 0 0 24px rgba(0,0,0,.18)!important;
  }
  #pcm-root .pcm-cyber-alert,
  #pcm-root .pcm-card,
  #pcm-root .pcm-capture,
  #pcm-root .pcm-quick,
  #pcm-root .pcm-recent,
  #pcm-root .pcm-detail-panel,
  #pcm-root .pcm-person-hero,
  #pcm-root .pcm-location-hero,
  #pcm-root .pcm-dashboard-subscriptions,
  #pcm-root .pcm-cyber-mini,
  #pcm-root .pcm-scene-context,
  #pcm-root .pcm-theme-panel,
  #pcm-root .pcm-tools-panel,
  #pcm-root .pcm-help-panel,
  #pcm-root .pcm-search-panel,
  #pcm-root .pcm-chat-panel{
    background:linear-gradient(180deg, rgba(12,21,31,.96), rgba(5,10,16,.98))!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04), inset 0 0 18px rgba(0,0,0,.12), 0 4px 12px rgba(0,0,0,.16)!important;
  }
  #pcm-root .pcm-cyber-alert{background:linear-gradient(180deg, rgba(33,9,18,.92), rgba(8,12,18,.98) 78%)!important}
  #pcm-root .pcm-section-head{background:linear-gradient(90deg, rgba(255,84,107,.10), transparent 72%)!important}
  #pcm-root aside>button,
  #pcm-root .pcm-stat-grid button,
  #pcm-root .pcm-recent>button,
  #pcm-root .pcm-search-results>button,
  #pcm-root .pcm-tools-grid>button{background:linear-gradient(90deg, rgba(11,19,30,.96), rgba(5,9,15,.98))!important}
  #pcm-root aside>button.active{background:linear-gradient(90deg, rgba(255,84,107,.18), rgba(9,17,24,.98) 72%)!important}
  #pcm-root[data-effects=soft] .pcm-top-actions>button::after,
  #pcm-root[data-effects=soft] aside>button::after,
  #pcm-root[data-effects=soft] .pcm-stat-grid button::after,
  #pcm-root[data-effects=soft] .pcm-recent>button::after,
  #pcm-root[data-effects=soft] .pcm-capture-actions button::after,
  #pcm-root[data-effects=soft] .pcm-quick-save button::after,
  #pcm-root[data-effects=vivid] .pcm-top-actions>button::after,
  #pcm-root[data-effects=vivid] aside>button::after,
  #pcm-root[data-effects=vivid] .pcm-stat-grid button::after,
  #pcm-root[data-effects=vivid] .pcm-recent>button::after,
  #pcm-root[data-effects=vivid] .pcm-capture-actions button::after,
  #pcm-root[data-effects=vivid] .pcm-quick-save button::after{opacity:.22!important}


  /* v7.1.3 — no blur outside the macro window */
  #pcm-root{background:transparent!important;backdrop-filter:none!important}
  #pcm-root .pcm-window{box-shadow:0 20px 58px rgba(0,0,0,.58),0 0 0 1px rgba(255,84,107,.12)!important}
  #pcm-root .pcm-modal-backdrop,
  #pcm-root[data-shell=datapad] .pcm-modal-backdrop{
    background:rgba(0,0,0,.32)!important;
    backdrop-filter:none!important;
  }


  /* v7.1.4 — more glowing netrunner interactive language */
  #pcm-root{
    --net-cyan: rgba(115,244,255,.92);
    --net-cyan-soft: rgba(115,244,255,.16);
    --net-cyan-glow: rgba(115,244,255,.32);
    --net-red: rgba(255,84,107,.94);
    --net-red-soft: rgba(255,84,107,.16);
    --net-red-glow: rgba(255,84,107,.28);
    --net-gold: rgba(252,212,96,.90);
  }
  @keyframes pcmNetPulse {0%,100%{box-shadow:0 0 0 1px rgba(115,244,255,.10),0 0 0 rgba(115,244,255,0)}50%{box-shadow:0 0 0 1px rgba(115,244,255,.24),0 0 14px rgba(115,244,255,.10)}}
  @keyframes pcmNodeBlink {0%,100%{opacity:.45;transform:scale(1)}50%{opacity:1;transform:scale(1.18)}}
  @keyframes pcmDataTrail {0%{background-position:-140px 0}100%{background-position:220px 0}}
  @keyframes pcmScanFloat {0%{transform:translateY(-24px);opacity:0}35%{opacity:.15}100%{transform:translateY(540px);opacity:0}}
  @keyframes pcmTextPulse {0%,100%{text-shadow:0 0 0 rgba(115,244,255,0)}50%{text-shadow:0 0 10px rgba(115,244,255,.22)}}
  @keyframes pcmBorderRun {0%{background-position:0 0}100%{background-position:120px 0}}

  #pcm-root .pcm-window{
    position:relative;
    box-shadow:0 20px 58px rgba(0,0,0,.58),0 0 0 1px rgba(255,84,107,.12),0 0 28px rgba(115,244,255,.07)!important;
  }
  #pcm-root .pcm-window::before{
    content:"";
    position:absolute;
    inset:1px;
    pointer-events:none;
    background:linear-gradient(180deg, rgba(255,255,255,.018), transparent 34%, transparent 68%, rgba(115,244,255,.015));
    opacity:.7;
  }
  #pcm-root[data-effects=soft] .pcm-device-screen::after,
  #pcm-root[data-effects=vivid] .pcm-device-screen::after{
    content:"";
    position:absolute;
    left:0; right:0; top:-40px;
    height:64px;
    pointer-events:none;
    background:linear-gradient(180deg, transparent, rgba(115,244,255,.08), transparent);
    opacity:.22;
    animation:pcmScanFloat 6.5s linear infinite;
  }
  #pcm-root[data-effects=vivid] .pcm-device-screen::after{opacity:.3;animation-duration:4.2s}

  #pcm-root .pcm-top,
  #pcm-root .pcm-scan-strip,
  #pcm-root .pcm-nav-header,
  #pcm-root .pcm-cyber-alert,
  #pcm-root .pcm-capture,
  #pcm-root .pcm-quick,
  #pcm-root .pcm-recent,
  #pcm-root .pcm-dashboard-subscriptions,
  #pcm-root .pcm-cyber-mini,
  #pcm-root .pcm-goal,
  #pcm-root .pcm-card,
  #pcm-root .pcm-detail-panel,
  #pcm-root .pcm-theme-panel,
  #pcm-root .pcm-tools-panel,
  #pcm-root .pcm-help-panel,
  #pcm-root .pcm-search-panel,
  #pcm-root .pcm-chat-panel{
    position:relative;
    overflow:hidden;
  }
  #pcm-root .pcm-cyber-alert::before,
  #pcm-root .pcm-capture::before,
  #pcm-root .pcm-quick::before,
  #pcm-root .pcm-recent::before,
  #pcm-root .pcm-dashboard-subscriptions::before,
  #pcm-root .pcm-cyber-mini::before,
  #pcm-root .pcm-goal::before,
  #pcm-root .pcm-card::before,
  #pcm-root .pcm-detail-panel::before{
    content:"";
    position:absolute;
    left:10px; right:10px; top:0;
    height:1px;
    pointer-events:none;
    background:linear-gradient(90deg, rgba(255,84,107,.0), rgba(255,84,107,.45), rgba(115,244,255,.55), rgba(115,244,255,0));
    background-size:120px 1px;
    opacity:.55;
  }
  #pcm-root[data-effects=soft] .pcm-cyber-alert::before,
  #pcm-root[data-effects=soft] .pcm-capture::before,
  #pcm-root[data-effects=soft] .pcm-quick::before,
  #pcm-root[data-effects=soft] .pcm-recent::before,
  #pcm-root[data-effects=soft] .pcm-dashboard-subscriptions::before,
  #pcm-root[data-effects=soft] .pcm-cyber-mini::before,
  #pcm-root[data-effects=soft] .pcm-goal::before,
  #pcm-root[data-effects=soft] .pcm-card::before,
  #pcm-root[data-effects=soft] .pcm-detail-panel::before,
  #pcm-root[data-effects=vivid] .pcm-cyber-alert::before,
  #pcm-root[data-effects=vivid] .pcm-capture::before,
  #pcm-root[data-effects=vivid] .pcm-quick::before,
  #pcm-root[data-effects=vivid] .pcm-recent::before,
  #pcm-root[data-effects=vivid] .pcm-dashboard-subscriptions::before,
  #pcm-root[data-effects=vivid] .pcm-cyber-mini::before,
  #pcm-root[data-effects=vivid] .pcm-goal::before,
  #pcm-root[data-effects=vivid] .pcm-card::before,
  #pcm-root[data-effects=vivid] .pcm-detail-panel::before{animation:pcmBorderRun 4.5s linear infinite}
  #pcm-root[data-effects=vivid] .pcm-cyber-alert::before,
  #pcm-root[data-effects=vivid] .pcm-capture::before,
  #pcm-root[data-effects=vivid] .pcm-quick::before,
  #pcm-root[data-effects=vivid] .pcm-recent::before,
  #pcm-root[data-effects=vivid] .pcm-dashboard-subscriptions::before,
  #pcm-root[data-effects=vivid] .pcm-cyber-mini::before,
  #pcm-root[data-effects=vivid] .pcm-goal::before,
  #pcm-root[data-effects=vivid] .pcm-card::before,
  #pcm-root[data-effects=vivid] .pcm-detail-panel::before{animation-duration:2.8s;opacity:.72}

  #pcm-root .pcm-top-actions>button,
  #pcm-root aside>button,
  #pcm-root .pcm-stat-grid button,
  #pcm-root .pcm-recent>button,
  #pcm-root .pcm-search-results>button,
  #pcm-root .pcm-tools-grid>button,
  #pcm-root .pcm-capture-actions button,
  #pcm-root .pcm-quick-save button,
  #pcm-root .pcm-dashboard-subscriptions header button,
  #pcm-root .pcm-recent header button,
  #pcm-root .pcm-search button,
  #pcm-root .pcm-chat-actions button,
  #pcm-root .pcm-detail-actions button,
  #pcm-root .pcm-top select,
  #pcm-root textarea,
  #pcm-root input,
  #pcm-root select{
    transition:border-color .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease, transform .14s ease;
  }
  #pcm-root .pcm-top-actions>button,
  #pcm-root aside>button,
  #pcm-root .pcm-stat-grid button,
  #pcm-root .pcm-recent>button,
  #pcm-root .pcm-search-results>button,
  #pcm-root .pcm-tools-grid>button,
  #pcm-root .pcm-capture-actions button,
  #pcm-root .pcm-quick-save button{
    border-color:rgba(115,244,255,.12)!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.02),0 0 0 rgba(115,244,255,0)!important;
  }
  #pcm-root .pcm-top-actions>button:hover,
  #pcm-root .pcm-top-actions>button:focus-visible,
  #pcm-root aside>button:hover,
  #pcm-root aside>button:focus-visible,
  #pcm-root .pcm-stat-grid button:hover,
  #pcm-root .pcm-stat-grid button:focus-visible,
  #pcm-root .pcm-recent>button:hover,
  #pcm-root .pcm-recent>button:focus-visible,
  #pcm-root .pcm-search-results>button:hover,
  #pcm-root .pcm-search-results>button:focus-visible,
  #pcm-root .pcm-tools-grid>button:hover,
  #pcm-root .pcm-tools-grid>button:focus-visible,
  #pcm-root .pcm-capture-actions button:hover,
  #pcm-root .pcm-capture-actions button:focus-visible,
  #pcm-root .pcm-quick-save button:hover,
  #pcm-root .pcm-quick-save button:focus-visible{
    border-color:rgba(115,244,255,.42)!important;
    box-shadow:0 0 0 1px rgba(115,244,255,.16),0 0 14px rgba(115,244,255,.10)!important;
    transform:translateY(-1px);
  }
  #pcm-root aside>button.active,
  #pcm-root .pcm-top-actions>button.active,
  #pcm-root .pcm-stat-grid button.active{
    box-shadow:inset 2px 0 0 rgba(255,84,107,.78),0 0 0 1px rgba(115,244,255,.18),0 0 18px rgba(255,84,107,.10)!important;
  }
  #pcm-root aside>button>b,
  #pcm-root .pcm-top-actions>button>b,
  #pcm-root .pcm-stat-grid button>b,
  #pcm-root .pcm-recent>button>b{
    text-shadow:0 0 9px rgba(115,244,255,.18);
  }
  #pcm-root aside>button::before,
  #pcm-root .pcm-top-actions>button::before,
  #pcm-root .pcm-stat-grid button::before,
  #pcm-root .pcm-recent>button::before,
  #pcm-root .pcm-search-results>button::before,
  #pcm-root .pcm-tools-grid>button::before{
    content:"";
    position:absolute;
    left:8px;
    top:50%;
    width:5px;
    height:5px;
    margin-top:-2.5px;
    border-radius:50%;
    background:var(--net-cyan);
    box-shadow:0 0 0 1px rgba(115,244,255,.18),0 0 9px rgba(115,244,255,.32);
    opacity:.7;
  }
  #pcm-root .pcm-top-actions>button::before{left:7px}
  #pcm-root[data-effects=soft] aside>button::before,
  #pcm-root[data-effects=soft] .pcm-top-actions>button::before,
  #pcm-root[data-effects=soft] .pcm-stat-grid button::before,
  #pcm-root[data-effects=soft] .pcm-recent>button::before,
  #pcm-root[data-effects=vivid] aside>button::before,
  #pcm-root[data-effects=vivid] .pcm-top-actions>button::before,
  #pcm-root[data-effects=vivid] .pcm-stat-grid button::before,
  #pcm-root[data-effects=vivid] .pcm-recent>button::before{animation:pcmNodeBlink 1.8s ease-in-out infinite}
  #pcm-root[data-effects=vivid] aside>button::before,
  #pcm-root[data-effects=vivid] .pcm-top-actions>button::before,
  #pcm-root[data-effects=vivid] .pcm-stat-grid button::before,
  #pcm-root[data-effects=vivid] .pcm-recent>button::before{animation-duration:1.05s}

  #pcm-root .pcm-top-actions>button{padding-left:16px!important}
  #pcm-root .pcm-top-actions>button span{position:relative;z-index:1}
  #pcm-root aside>button{padding-left:14px!important}
  #pcm-root .pcm-recent>button,
  #pcm-root .pcm-search-results>button,
  #pcm-root .pcm-tools-grid>button{padding-left:16px!important}
  #pcm-root .pcm-stat-grid button{padding-left:14px!important}

  #pcm-root .pcm-nav-header b,
  #pcm-root .pcm-scan-strip strong,
  #pcm-root .pcm-cyber-attention h1,
  #pcm-root .pcm-cyber-status b,
  #pcm-root .pcm-capture h2,
  #pcm-root .pcm-recent h2,
  #pcm-root .pcm-dashboard-subscriptions h2{
    text-shadow:0 0 12px rgba(115,244,255,.14);
  }
  #pcm-root[data-effects=soft] .pcm-nav-header b,
  #pcm-root[data-effects=soft] .pcm-scan-strip strong,
  #pcm-root[data-effects=soft] .pcm-cyber-attention h1,
  #pcm-root[data-effects=soft] .pcm-cyber-status b,
  #pcm-root[data-effects=soft] .pcm-capture h2,
  #pcm-root[data-effects=vivid] .pcm-nav-header b,
  #pcm-root[data-effects=vivid] .pcm-scan-strip strong,
  #pcm-root[data-effects=vivid] .pcm-cyber-attention h1,
  #pcm-root[data-effects=vivid] .pcm-cyber-status b,
  #pcm-root[data-effects=vivid] .pcm-capture h2{animation:pcmTextPulse 2.2s ease-in-out infinite}
  #pcm-root[data-effects=vivid] .pcm-nav-header b,
  #pcm-root[data-effects=vivid] .pcm-scan-strip strong,
  #pcm-root[data-effects=vivid] .pcm-cyber-attention h1,
  #pcm-root[data-effects=vivid] .pcm-cyber-status b,
  #pcm-root[data-effects=vivid] .pcm-capture h2{animation-duration:1.3s}

  #pcm-root .pcm-cyber-status{
    box-shadow:inset 0 0 0 1px rgba(255,84,107,.16),0 0 14px rgba(115,244,255,.05)!important;
  }
  #pcm-root .pcm-cyber-status::before{
    content:"NET";
    position:absolute;
    top:8px; right:26px;
    color:rgba(115,244,255,.58);
    font:700 8px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;
    letter-spacing:.18em;
  }
  #pcm-root .pcm-goal,
  #pcm-root .pcm-quick textarea,
  #pcm-root .pcm-goal textarea,
  #pcm-root input,
  #pcm-root select,
  #pcm-root textarea{
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.02), 0 0 0 rgba(115,244,255,0)!important;
  }
  #pcm-root .pcm-goal:focus-within,
  #pcm-root .pcm-quick textarea:focus,
  #pcm-root .pcm-goal textarea:focus,
  #pcm-root input:focus,
  #pcm-root select:focus,
  #pcm-root textarea:focus{
    border-color:rgba(115,244,255,.34)!important;
    box-shadow:0 0 0 1px rgba(115,244,255,.18),0 0 12px rgba(115,244,255,.08)!important;
    outline:none!important;
  }
  #pcm-root .pcm-scan-strip{
    box-shadow:inset 0 1px 0 rgba(255,255,255,.025), inset 0 -1px 0 rgba(115,244,255,.06);
  }
  #pcm-root .pcm-scan-bar{position:relative;overflow:hidden}
  #pcm-root .pcm-scan-bar::after{
    content:"";
    position:absolute;
    inset:0;
    background:linear-gradient(90deg,transparent,rgba(115,244,255,.18),transparent);
    opacity:.0;
  }
  #pcm-root[data-effects=soft] .pcm-scan-bar::after,
  #pcm-root[data-effects=vivid] .pcm-scan-bar::after{opacity:.42;animation:pcmDataTrail 2.6s linear infinite}
  #pcm-root[data-effects=vivid] .pcm-scan-bar::after{animation-duration:1.45s;opacity:.65}

  #pcm-root .pcm-capture-actions .primary,
  #pcm-root .pcm-quick-save button,
  #pcm-root .pcm-dashboard-subscriptions header button,
  #pcm-root .pcm-recent header button{
    box-shadow:0 0 0 1px rgba(255,84,107,.12), 0 0 14px rgba(255,84,107,.07)!important;
  }
  #pcm-root .pcm-capture-actions .primary:hover,
  #pcm-root .pcm-quick-save button:hover{
    box-shadow:0 0 0 1px rgba(255,84,107,.28), 0 0 16px rgba(255,84,107,.13)!important;
  }

  #pcm-root[data-shell=datapad] .pcm-window{
    box-shadow:
      0 26px 78px rgba(0,0,0,.72),
      0 3px 0 rgba(0,0,0,.65),
      inset 0 1px 0 rgba(255,255,255,.12),
      inset 0 -2px 0 rgba(0,0,0,.72),
      inset 0 0 0 2px rgba(0,0,0,.22),
      0 0 22px rgba(115,244,255,.08)!important;
  }
  #pcm-root[data-shell=datapad] .pcm-device-screen{
    box-shadow:0 0 0 2px #050708,0 0 0 3px rgba(255,255,255,.06),inset 0 0 0 1px rgba(255,255,255,.05),inset 0 0 26px rgba(0,0,0,.20),inset 0 0 24px rgba(115,244,255,.03)!important;
  }
  #pcm-root[data-shell=datapad] .pcm-hw-led-power,
  #pcm-root[data-shell=datapad] .pcm-hw-led-link{
    box-shadow:0 0 8px currentColor, 0 0 18px currentColor!important;
  }
  #pcm-root[data-shell=datapad][data-effects=soft] .pcm-hw-led-power,
  #pcm-root[data-shell=datapad][data-effects=soft] .pcm-hw-led-link,
  #pcm-root[data-shell=datapad][data-effects=vivid] .pcm-hw-led-power,
  #pcm-root[data-shell=datapad][data-effects=vivid] .pcm-hw-led-link{animation:pcmNodeBlink 1.2s ease-in-out infinite}

  #pcm-root[data-effects=off] .pcm-device-screen::after,
  #pcm-root[data-effects=off] .pcm-cyber-alert::before,
  #pcm-root[data-effects=off] .pcm-capture::before,
  #pcm-root[data-effects=off] .pcm-quick::before,
  #pcm-root[data-effects=off] .pcm-recent::before,
  #pcm-root[data-effects=off] .pcm-dashboard-subscriptions::before,
  #pcm-root[data-effects=off] .pcm-cyber-mini::before,
  #pcm-root[data-effects=off] .pcm-goal::before,
  #pcm-root[data-effects=off] .pcm-card::before,
  #pcm-root[data-effects=off] .pcm-detail-panel::before,
  #pcm-root[data-effects=off] aside>button::before,
  #pcm-root[data-effects=off] .pcm-top-actions>button::before,
  #pcm-root[data-effects=off] .pcm-stat-grid button::before,
  #pcm-root[data-effects=off] .pcm-recent>button::before,
  #pcm-root[data-effects=off] .pcm-scan-bar::after{animation:none!important}


  /* v7.1.5 — information-dense record console */
  #pcm-root .pcm-record-console{display:grid;gap:9px;min-width:0}
  #pcm-root .pcm-record-console .pcm-detail-nav{margin-bottom:0!important}
  #pcm-root .pcm-record-systembar{min-width:0;display:grid;grid-template-columns:minmax(180px,1fr) minmax(120px,.45fr) minmax(150px,.55fr) auto;gap:7px;align-items:stretch;padding:7px 9px;background:linear-gradient(90deg,rgba(8,16,25,.98),rgba(11,20,28,.95));border:1px solid rgba(115,244,255,.18);clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)}
  #pcm-root .pcm-record-systembar>div,#pcm-root .pcm-record-systembar>span{min-width:0;display:grid;gap:2px;padding:5px 7px;border-left:1px solid rgba(115,244,255,.14)}
  #pcm-root .pcm-record-systembar>div{border-left:2px solid rgba(255,84,107,.70)}
  #pcm-root .pcm-record-systembar small{color:var(--muted);font:750 6.5px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.13em;text-transform:uppercase}
  #pcm-root .pcm-record-systembar b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--heading);font:850 9px/1.1 ui-monospace,"Cascadia Mono",Consolas,monospace}
  #pcm-root .pcm-record-systembar>i{align-self:center;padding:5px 8px;color:var(--teal);border:1px solid rgba(115,244,255,.18);font:800 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;font-style:normal;letter-spacing:.10em;white-space:nowrap}
  #pcm-root .pcm-record-titlebar{min-width:0;display:grid;grid-template-columns:82px minmax(0,1fr);gap:12px;padding:11px;background:linear-gradient(135deg,rgba(255,84,107,.09),rgba(8,15,23,.96) 32%,rgba(5,9,15,.98));border:1px solid rgba(255,84,107,.32);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,8px 100%,0 calc(100% - 8px))}
  #pcm-root .pcm-record-avatar{width:82px;height:82px;display:grid;place-items:center;overflow:hidden;color:var(--teal);background:rgba(4,10,16,.92);border:1px solid rgba(115,244,255,.24);font:900 28px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;box-shadow:inset 0 0 20px rgba(115,244,255,.03)}
  #pcm-root .pcm-record-avatar img{width:100%;height:100%;object-fit:cover}
  #pcm-root .pcm-record-titlecopy{min-width:0;align-self:center}
  #pcm-root .pcm-record-titlecopy>small{color:var(--teal);font:750 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.14em;text-transform:uppercase}
  #pcm-root .pcm-record-titlecopy h1{margin:4px 0 3px;color:var(--heading);font-size:24px;line-height:1.04;overflow-wrap:anywhere}
  #pcm-root .pcm-record-titlecopy h2{margin:0 0 6px;color:var(--muted);font-size:12px;font-weight:650;font-style:italic}
  #pcm-root .pcm-record-titlecopy .pcm-read-text{max-width:110ch;font-size:11px;line-height:1.35}
  #pcm-root .pcm-record-titlecopy .pcm-quick-read{margin:6px 0 0;padding:6px 8px;border-left:2px solid var(--gold);background:rgba(255,84,107,.045);font-size:10px}
  #pcm-root .pcm-record-matrix{min-width:0;display:grid;grid-template-columns:minmax(0,1.65fr) minmax(250px,.72fr);gap:9px;align-items:start}
  #pcm-root .pcm-record-main,#pcm-root .pcm-record-side{min-width:0}
  #pcm-root .pcm-record-main{display:grid;gap:9px}
  #pcm-root .pcm-record-side{display:grid;gap:9px!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important;min-width:0!important;max-width:none!important}
  #pcm-root .pcm-record-primary,#pcm-root .pcm-record-side-panel{min-width:0;background:linear-gradient(180deg,rgba(9,17,26,.98),rgba(5,10,16,.98));border:1px solid rgba(115,244,255,.18);clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,6px 100%,0 calc(100% - 6px));box-shadow:inset 0 0 0 1px rgba(255,255,255,.015)}
  #pcm-root .pcm-record-primary>header,#pcm-root .pcm-record-side-panel>header{display:flex;align-items:center;gap:8px;min-width:0;padding:7px 9px;border-bottom:1px solid rgba(115,244,255,.12);background:linear-gradient(90deg,rgba(115,244,255,.045),transparent)}
  #pcm-root .pcm-record-primary>header small,#pcm-root .pcm-record-side-panel>header small{color:var(--teal);font:750 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.13em;white-space:nowrap}
  #pcm-root .pcm-record-primary>header h3,#pcm-root .pcm-record-side-panel>header h3{min-width:0;margin:0;color:var(--heading);font:850 11px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.04em}
  #pcm-root .pcm-record-primary>header i{margin-left:auto;color:var(--muted);font:750 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;font-style:normal;letter-spacing:.10em;white-space:nowrap}
  #pcm-root .pcm-record-primary-body{min-height:118px;padding:11px 12px}
  #pcm-root .pcm-record-primary-body .pcm-read-text{max-width:none;font-size:12px;line-height:1.5}
  #pcm-root .pcm-record-empty-text{margin:0;color:var(--muted);font-style:italic}
  #pcm-root .pcm-record-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:rgba(115,244,255,.08)}
  #pcm-root .pcm-record-stat{min-width:0;min-height:48px;padding:7px 8px;display:grid;align-content:center;gap:3px;background:rgba(5,10,16,.98)}
  #pcm-root .pcm-record-stat small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font:720 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.10em}
  #pcm-root .pcm-record-stat b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--heading);font:850 10px/1.1 ui-monospace,"Cascadia Mono",Consolas,monospace}
  #pcm-root .pcm-record-stat.cyan b{color:var(--teal);text-shadow:0 0 8px rgba(115,244,255,.12)}
  #pcm-root .pcm-record-stat.red b{color:var(--gold);text-shadow:0 0 8px rgba(255,84,107,.12)}
  #pcm-root .pcm-record-stat.muted b{color:#a7bac1}
  #pcm-root .pcm-record-link-counters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:rgba(115,244,255,.08)}
  #pcm-root .pcm-record-link-counters span{min-height:45px;padding:6px;display:grid;place-items:center;background:rgba(5,10,16,.98)}
  #pcm-root .pcm-record-link-counters b{color:var(--teal);font:900 16px/1 ui-monospace,"Cascadia Mono",Consolas,monospace}
  #pcm-root .pcm-record-link-counters small{color:var(--muted);font:700 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.08em}
  #pcm-root .pcm-record-network-empty{padding:12px;color:var(--muted);font:750 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.13em;text-align:center}
  #pcm-root .pcm-record-links{padding:7px;display:grid;gap:5px}
  #pcm-root .pcm-record-links button{min-width:0;min-height:29px;padding:5px 7px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}
  #pcm-root .pcm-record-tags{padding:7px;display:flex;flex-wrap:wrap;gap:4px;border-top:1px solid rgba(115,244,255,.08)}
  #pcm-root .pcm-record-tags span{padding:3px 6px;color:var(--teal);background:rgba(115,244,255,.055);border:1px solid rgba(115,244,255,.13);font:750 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace}
  #pcm-root .pcm-data-panels{margin-top:0!important}
  #pcm-root .pcm-data-panels>.pcm-detail-panel{padding:10px!important}
  #pcm-root .pcm-data-panels>.pcm-detail-panel h3{margin-bottom:6px!important;font-size:12px!important;font-family:ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.03em!important}
  #pcm-root .pcm-data-panels>.pcm-detail-panel .pcm-read-text{font-size:11px;line-height:1.42}
  #pcm-root[data-effects=soft] .pcm-record-systembar,#pcm-root[data-effects=soft] .pcm-record-primary,#pcm-root[data-effects=soft] .pcm-record-side-panel{animation:pcmNetPulse 4.6s ease-in-out infinite}
  #pcm-root[data-effects=vivid] .pcm-record-systembar,#pcm-root[data-effects=vivid] .pcm-record-primary,#pcm-root[data-effects=vivid] .pcm-record-side-panel{animation:pcmNetPulse 2.9s ease-in-out infinite}
  @media(max-width:1050px){#pcm-root .pcm-record-matrix{grid-template-columns:1fr}#pcm-root .pcm-record-side{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:760px){#pcm-root .pcm-record-systembar{grid-template-columns:1fr 1fr}#pcm-root .pcm-record-systembar>i{grid-column:1/-1;justify-self:start}#pcm-root .pcm-record-titlebar{grid-template-columns:58px minmax(0,1fr)}#pcm-root .pcm-record-avatar{width:58px;height:58px;font-size:22px}#pcm-root .pcm-record-titlecopy h1{font-size:19px}#pcm-root .pcm-record-side{grid-template-columns:1fr}}


  /* v7.1.6 — theme-driven netrunner profiles */
  #pcm-root{
    --theme-node:#63e8f2;
    --theme-trace:#63e8f2;
    --theme-warning:#ef5668;
    --theme-node-glow:rgba(99,232,242,.30);
    --theme-trace-glow:rgba(99,232,242,.20);
    --theme-warning-glow:rgba(239,86,104,.18);
    --theme-scan-alpha:rgba(99,232,242,.18);
    --theme-pulse-speed:1.8s;
    --theme-scan-speed:1.2s;
  }
  #pcm-root .pcm-nav-header b,
  #pcm-root .pcm-scan-strip strong,
  #pcm-root .pcm-cyber-attention h1,
  #pcm-root .pcm-cyber-status b,
  #pcm-root aside>button>b,
  #pcm-root .pcm-stat-grid button i,
  #pcm-root .pcm-recent>button b{
    color:var(--theme-node)!important;
    text-shadow:0 0 10px var(--theme-node-glow)!important;
  }
  #pcm-root .pcm-cyber-attention>small,
  #pcm-root .pcm-section-head,
  #pcm-root .pcm-capture,
  #pcm-root aside>button.active{
    border-color:color-mix(in srgb,var(--theme-warning) 58%,var(--line))!important;
  }
  #pcm-root .pcm-cyber-status,
  #pcm-root .pcm-capture-actions .primary,
  #pcm-root .pcm-quick-save button{
    box-shadow:0 0 0 1px var(--theme-warning-glow),0 0 14px color-mix(in srgb,var(--theme-warning-glow) 76%,transparent)!important;
  }
  #pcm-root .pcm-scan-bar i,
  #pcm-root .pcm-cyber-progress i,
  #pcm-root .pcm-empty-progress i{
    background:
      repeating-linear-gradient(90deg,var(--theme-trace) 0 5px,color-mix(in srgb,var(--theme-trace) 54%,#000) 5px 8px)!important;
    background-size:84px 100%!important;
  }
  #pcm-root .pcm-scan-bar::after{
    background:linear-gradient(90deg,transparent,var(--theme-scan-alpha),transparent)!important;
  }
  #pcm-root aside>button::before,
  #pcm-root .pcm-top-actions>button::before,
  #pcm-root .pcm-stat-grid button::before,
  #pcm-root .pcm-recent>button::before,
  #pcm-root .pcm-search-results>button::before,
  #pcm-root .pcm-tools-grid>button::before{
    background:var(--theme-node)!important;
    box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-node) 22%,transparent),0 0 10px var(--theme-node-glow)!important;
  }
  #pcm-root .pcm-cyber-alert::before,
  #pcm-root .pcm-capture::before,
  #pcm-root .pcm-quick::before,
  #pcm-root .pcm-recent::before,
  #pcm-root .pcm-dashboard-subscriptions::before,
  #pcm-root .pcm-cyber-mini::before,
  #pcm-root .pcm-goal::before,
  #pcm-root .pcm-card::before,
  #pcm-root .pcm-detail-panel::before{
    background:linear-gradient(90deg,transparent,var(--theme-warning),var(--theme-trace),transparent)!important;
  }
  #pcm-root[data-effects=soft] .pcm-scan-bar i,
  #pcm-root[data-effects=soft] .pcm-cyber-progress i,
  #pcm-root[data-effects=soft] .pcm-empty-progress i{
    animation-duration:var(--theme-scan-speed)!important;
  }
  #pcm-root[data-effects=vivid] .pcm-scan-bar i,
  #pcm-root[data-effects=vivid] .pcm-cyber-progress i,
  #pcm-root[data-effects=vivid] .pcm-empty-progress i{
    animation-duration:calc(var(--theme-scan-speed) * .66)!important;
  }
  #pcm-root[data-effects=soft] aside>button::before,
  #pcm-root[data-effects=soft] .pcm-top-actions>button::before,
  #pcm-root[data-effects=soft] .pcm-stat-grid button::before,
  #pcm-root[data-effects=soft] .pcm-recent>button::before,
  #pcm-root[data-effects=soft] .pcm-nav-header b,
  #pcm-root[data-effects=soft] .pcm-cyber-status{
    animation-duration:var(--theme-pulse-speed)!important;
  }
  #pcm-root[data-effects=vivid] aside>button::before,
  #pcm-root[data-effects=vivid] .pcm-top-actions>button::before,
  #pcm-root[data-effects=vivid] .pcm-stat-grid button::before,
  #pcm-root[data-effects=vivid] .pcm-recent>button::before,
  #pcm-root[data-effects=vivid] .pcm-nav-header b,
  #pcm-root[data-effects=vivid] .pcm-cyber-status{
    animation-duration:calc(var(--theme-pulse-speed) * .72)!important;
  }
  #pcm-root .pcm-theme-group{
    border-radius:0!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--panel) 86%,#000),color-mix(in srgb,var(--background) 80%,#000))!important;
    border-color:color-mix(in srgb,var(--secondary) 25%,var(--line))!important;
  }
  #pcm-root .pcm-theme-group>summary{
    min-height:52px!important;
    border-left:2px solid color-mix(in srgb,var(--accent) 68%,transparent)!important;
    background:linear-gradient(90deg,var(--accent-soft),transparent 72%)!important;
  }
  #pcm-root .pcm-theme-group>summary b{color:var(--secondary)!important;text-shadow:0 0 9px var(--secondary-soft)}
  #pcm-root .pcm-theme-presets{
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    gap:8px!important;
  }
  #pcm-root .pcm-theme-presets button{
    min-height:78px!important;
    height:auto!important;
    grid-template-rows:34px auto!important;
    padding:7px!important;
    border-radius:0!important;
    clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,6px 100%,0 calc(100% - 6px))!important;
  }
  #pcm-root .pcm-theme-presets button.active{
    color:var(--secondary)!important;
    border-color:var(--accent)!important;
    box-shadow:inset 3px 0 0 var(--accent),0 0 12px var(--secondary-soft)!important;
  }
  #pcm-root .pcm-theme-swatch{
    border-radius:0!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),0 0 8px color-mix(in srgb,var(--swatch-secondary) 18%,transparent)!important;
  }
  @media(max-width:900px){
    #pcm-root .pcm-theme-presets{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  }


  /* v7.1.7 — orderly record-console composition */
  #pcm-root .pcm-record-matrix{
    grid-template-columns:minmax(0,1.72fr) minmax(270px,.68fr)!important;
    gap:10px!important;
    align-items:start!important;
  }
  #pcm-root .pcm-record-main{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    align-content:start!important;
    gap:10px!important;
  }
  #pcm-root .pcm-record-side{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    align-content:start!important;
    gap:10px!important;
    position:sticky!important;
    top:0!important;
  }
  #pcm-root .pcm-record-wide-data{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:9px!important;
    margin:0!important;
    align-items:start!important;
  }
  #pcm-root .pcm-record-wide-data:empty{display:none!important}
  #pcm-root .pcm-record-wide-data>.pcm-detail-panel{
    min-width:0!important;
    margin:0!important;
  }
  #pcm-root .pcm-record-wide-data>.pcm-detail-panel.wide,
  #pcm-root .pcm-record-wide-data>.pcm-directory-contacts{
    grid-column:1/-1!important;
  }
  #pcm-root .pcm-record-extra-panel{
    border-color:color-mix(in srgb,var(--theme-warning) 32%,rgba(115,244,255,.18))!important;
  }
  #pcm-root .pcm-record-extra-grid{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:1px!important;
    background:rgba(115,244,255,.07)!important;
  }
  #pcm-root .pcm-record-extra-row{
    min-width:0!important;
    display:grid!important;
    grid-template-columns:minmax(84px,.72fr) minmax(0,1.28fr)!important;
    gap:8px!important;
    align-items:center!important;
    padding:8px 9px!important;
    background:linear-gradient(90deg,rgba(7,14,22,.98),rgba(5,10,16,.98))!important;
  }
  #pcm-root .pcm-record-extra-row small{
    color:var(--muted)!important;
    font:750 6.5px/1.1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;
    letter-spacing:.10em!important;
    text-transform:uppercase!important;
  }
  #pcm-root .pcm-record-extra-row b{
    min-width:0!important;
    color:var(--theme-node)!important;
    font:800 9px/1.2 ui-monospace,"Cascadia Mono",Consolas,monospace!important;
    overflow-wrap:anywhere!important;
    word-break:break-word!important;
  }
  #pcm-root .pcm-record-extra-row.red b{
    color:var(--theme-warning)!important;
    text-shadow:0 0 8px var(--theme-warning-glow)!important;
  }
  #pcm-root .pcm-record-extra-row.cyan b{
    color:var(--theme-node)!important;
    text-shadow:0 0 8px var(--theme-node-glow)!important;
  }
  #pcm-root .pcm-record-primary-body{
    min-height:0!important;
  }
  #pcm-root .pcm-record-primary-body .pcm-read-text{
    max-width:none!important;
  }
  #pcm-root .pcm-data-panels{
    margin-top:0!important;
  }
  #pcm-root .pcm-data-panels>.pcm-detail-panel{
    align-self:start!important;
  }
  #pcm-root .pcm-record-side-panel{
    margin:0!important;
  }
  #pcm-root .pcm-record-network{
    min-height:0!important;
  }
  @media(max-width:1120px){
    #pcm-root .pcm-record-matrix{grid-template-columns:minmax(0,1fr) 250px!important}
    #pcm-root .pcm-record-side{position:static!important}
  }
  @media(max-width:900px){
    #pcm-root .pcm-record-matrix{grid-template-columns:1fr!important}
    #pcm-root .pcm-record-side{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      position:static!important;
    }
    #pcm-root .pcm-record-extra-panel{grid-column:1/-1!important}
  }
  @media(max-width:650px){
    #pcm-root .pcm-record-side,
    #pcm-root .pcm-record-wide-data{grid-template-columns:1fr!important}
    #pcm-root .pcm-record-wide-data>.pcm-detail-panel.wide,
    #pcm-root .pcm-record-wide-data>.pcm-directory-contacts,
    #pcm-root .pcm-record-extra-panel{grid-column:auto!important}
  }


  /* v7.1.8 — distinct theme personalities + true running loader */
  @keyframes pcmTrueLoadFill {
    0%{transform:scaleX(.03);filter:brightness(.86)}
    18%{transform:scaleX(.22)}
    42%{transform:scaleX(.47)}
    68%{transform:scaleX(.72);filter:brightness(1.08)}
    86%,100%{transform:scaleX(1);filter:brightness(1.16)}
  }
  @keyframes pcmLoadPacket {
    0%{left:-16%;opacity:0}
    8%{opacity:1}
    88%{opacity:1}
    100%{left:104%;opacity:0}
  }
  @keyframes pcmLoadShine {
    0%{transform:translateX(-150%);opacity:0}
    18%{opacity:.8}
    100%{transform:translateX(420%);opacity:0}
  }
  @keyframes pcmLoadText {
    0%,100%{opacity:.72}
    45%{opacity:1;text-shadow:0 0 10px var(--theme-node-glow)}
  }

  #pcm-root .pcm-scan-bar{position:relative!important;overflow:hidden!important;isolation:isolate!important}
  #pcm-root .pcm-scan-bar i{
    transform-origin:left center!important;
    position:relative!important;
    z-index:1!important;
  }
  #pcm-root .pcm-scan-bar::before{
    content:"";
    position:absolute;
    z-index:4;
    top:-2px;
    left:-16%;
    width:16%;
    height:calc(100% + 4px);
    pointer-events:none;
    background:linear-gradient(90deg,transparent,var(--theme-node),#fff,var(--theme-node),transparent);
    filter:drop-shadow(0 0 6px var(--theme-node-glow));
    opacity:0;
  }
  #pcm-root .pcm-scan-bar::after{
    content:"";
    position:absolute!important;
    z-index:3!important;
    top:0!important;
    bottom:0!important;
    left:0!important;
    width:26%!important;
    pointer-events:none!important;
    background:linear-gradient(90deg,transparent,var(--theme-scan-alpha),rgba(255,255,255,.42),var(--theme-scan-alpha),transparent)!important;
    opacity:0;
  }
  #pcm-root[data-effects=soft] .pcm-scan-bar i{
    animation:pcmTrueLoadFill 4.8s cubic-bezier(.18,.72,.18,1) infinite!important;
  }
  #pcm-root[data-effects=soft] .pcm-scan-bar::before{
    animation:pcmLoadPacket 2.75s linear infinite!important;
  }
  #pcm-root[data-effects=soft] .pcm-scan-bar::after{
    animation:pcmLoadShine 3.9s ease-in-out infinite!important;
    opacity:.56!important;
  }
  #pcm-root[data-effects=soft] .pcm-scan-strip strong{animation:pcmLoadText 2.5s ease-in-out infinite!important}
  #pcm-root[data-effects=vivid] .pcm-scan-bar i{
    animation:pcmTrueLoadFill 3.25s cubic-bezier(.14,.76,.18,1) infinite!important;
  }
  #pcm-root[data-effects=vivid] .pcm-scan-bar::before{
    animation:pcmLoadPacket 1.55s linear infinite!important;
  }
  #pcm-root[data-effects=vivid] .pcm-scan-bar::after{
    animation:pcmLoadShine 2.25s ease-in-out infinite!important;
    opacity:.78!important;
  }
  #pcm-root[data-effects=vivid] .pcm-scan-strip strong{animation:pcmLoadText 1.35s ease-in-out infinite!important}
  #pcm-root[data-effects=off] .pcm-scan-bar i{transform:scaleX(1)!important}
  #pcm-root[data-effects=off] .pcm-scan-bar::before,
  #pcm-root[data-effects=off] .pcm-scan-bar::after{display:none!important}

  /* NETWORK — each profile has its own terminal character */
  #pcm-root[data-theme-fx="ghost"] .pcm-window{
    background:linear-gradient(180deg,#05090f,#03070b)!important;
  }
  #pcm-root[data-theme-fx="ghost"] .pcm-card,
  #pcm-root[data-theme-fx="ghost"] .pcm-detail-panel,
  #pcm-root[data-theme-fx="ghost"] aside>button{clip-path:none!important;border-width:1px!important}
  #pcm-root[data-theme-fx="ghost"] .pcm-scan-bar{background:repeating-linear-gradient(90deg,#06141b 0 3px,transparent 3px 6px)!important}

  #pcm-root[data-theme-fx="deep"] .pcm-window,
  #pcm-root[data-theme-fx="ocean"] .pcm-window{
    background:radial-gradient(circle at 72% 8%,rgba(76,103,255,.12),transparent 34%),linear-gradient(180deg,#050817,#030611)!important;
  }
  #pcm-root[data-theme-fx="deep"] .pcm-card,
  #pcm-root[data-theme-fx="ocean"] .pcm-card,
  #pcm-root[data-theme-fx="deep"] .pcm-detail-panel,
  #pcm-root[data-theme-fx="ocean"] .pcm-detail-panel{border-radius:8px 2px 8px 2px!important;clip-path:none!important}
  #pcm-root[data-theme-fx="deep"] aside>button,
  #pcm-root[data-theme-fx="ocean"] aside>button{clip-path:polygon(0 0,96% 0,100% 50%,96% 100%,0 100%)!important}

  #pcm-root[data-theme-fx="neural"] .pcm-layout,
  #pcm-root[data-theme-fx="packet"] .pcm-layout{
    background:radial-gradient(circle at 14% 14%,rgba(86,255,190,.08),transparent 30%),linear-gradient(90deg,transparent,rgba(86,255,190,.025),transparent)!important;
  }
  #pcm-root[data-theme-fx="neural"] .pcm-card,
  #pcm-root[data-theme-fx="packet"] .pcm-card{border-left:3px solid var(--theme-node)!important}
  #pcm-root[data-theme-fx="neural"] aside>button::before,
  #pcm-root[data-theme-fx="packet"] aside>button::before{border-radius:0!important;transform:rotate(45deg)!important}

  #pcm-root[data-theme-fx="cold"] .pcm-window{filter:saturate(.72)!important}
  #pcm-root[data-theme-fx="cold"] .pcm-card,
  #pcm-root[data-theme-fx="cold"] .pcm-detail-panel,
  #pcm-root[data-theme-fx="cold"] aside>button{box-shadow:none!important;background:linear-gradient(180deg,rgba(12,24,29,.98),rgba(4,10,14,.99))!important}

  #pcm-root[data-theme-fx="daemon"] .pcm-window,
  #pcm-root[data-theme-fx="voodoo"] .pcm-window{
    background:radial-gradient(circle at 50% 0%,rgba(166,91,255,.13),transparent 34%),linear-gradient(180deg,#0a0612,#04050a)!important;
  }
  #pcm-root[data-theme-fx="daemon"] .pcm-card,
  #pcm-root[data-theme-fx="voodoo"] .pcm-card{border-color:rgba(203,104,255,.35)!important;box-shadow:inset 0 0 14px rgba(178,83,255,.045),0 0 13px rgba(178,83,255,.045)!important}
  #pcm-root[data-theme-fx="daemon"] aside>button,
  #pcm-root[data-theme-fx="voodoo"] aside>button{clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)!important}

  /* ICE / BLACKWALL */
  #pcm-root[data-theme-fx="blackice"] .pcm-card,
  #pcm-root[data-theme-fx="blackice"] .pcm-detail-panel,
  #pcm-root[data-theme-fx="contain"] .pcm-card,
  #pcm-root[data-theme-fx="contain"] .pcm-detail-panel{clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)!important;border-left:2px solid var(--theme-warning)!important}
  #pcm-root[data-theme-fx="blackice"] .pcm-window{background:linear-gradient(135deg,#02050d,#060a18 60%,#09030a)!important}

  #pcm-root[data-theme-fx="warning"] .pcm-window,
  #pcm-root[data-theme-fx="kill"] .pcm-window,
  #pcm-root[data-theme-fx="overclock"] .pcm-window{background:radial-gradient(circle at 18% 0%,rgba(255,42,68,.15),transparent 31%),linear-gradient(180deg,#100507,#040507)!important}
  #pcm-root[data-theme-fx="warning"] aside>button,
  #pcm-root[data-theme-fx="kill"] aside>button,
  #pcm-root[data-theme-fx="overclock"] aside>button{clip-path:polygon(0 0,94% 0,100% 18%,96% 100%,4% 100%,0 82%)!important}
  #pcm-root[data-theme-fx="warning"] .pcm-card,
  #pcm-root[data-theme-fx="kill"] .pcm-card,
  #pcm-root[data-theme-fx="overclock"] .pcm-card{border-color:rgba(255,52,77,.45)!important}

  #pcm-root[data-theme-fx="firewall"] .pcm-window,
  #pcm-root[data-theme-fx="trace"] .pcm-window{background:radial-gradient(circle at 75% 0%,rgba(255,177,70,.11),transparent 28%),linear-gradient(180deg,#100a04,#050604)!important}
  #pcm-root[data-theme-fx="firewall"] .pcm-scan-bar,
  #pcm-root[data-theme-fx="trace"] .pcm-scan-bar{background:repeating-linear-gradient(135deg,#180f05 0 5px,#090705 5px 10px)!important}

  #pcm-root[data-theme-fx="blackwall"] .pcm-window{background:radial-gradient(circle at 52% 0%,rgba(126,72,255,.19),transparent 32%),linear-gradient(180deg,#080410,#020309)!important}
  #pcm-root[data-theme-fx="blackwall"] .pcm-card,
  #pcm-root[data-theme-fx="blackwall"] .pcm-detail-panel{border-style:dashed!important}

  /* CORPORATE — cleaner, calmer geometry */
  #pcm-root[data-theme-fx="corpred"] .pcm-card,
  #pcm-root[data-theme-fx="tactical"] .pcm-card,
  #pcm-root[data-theme-fx="netwatch"] .pcm-card,
  #pcm-root[data-theme-fx="smartgrid"] .pcm-card,
  #pcm-root[data-theme-fx="deepnet"] .pcm-card,
  #pcm-root[data-theme-fx="cleanroom"] .pcm-card,
  #pcm-root[data-theme-fx="bio"] .pcm-card,
  #pcm-root[data-theme-fx="mednet"] .pcm-card{clip-path:none!important;border-radius:2px!important}
  #pcm-root[data-theme-fx="corpred"] aside>button,
  #pcm-root[data-theme-fx="tactical"] aside>button,
  #pcm-root[data-theme-fx="netwatch"] aside>button,
  #pcm-root[data-theme-fx="smartgrid"] aside>button,
  #pcm-root[data-theme-fx="deepnet"] aside>button,
  #pcm-root[data-theme-fx="cleanroom"] aside>button,
  #pcm-root[data-theme-fx="bio"] aside>button,
  #pcm-root[data-theme-fx="mednet"] aside>button{clip-path:none!important;border-radius:2px!important}
  #pcm-root[data-theme-fx="netwatch"] .pcm-window{background:linear-gradient(180deg,#06091a,#03050f)!important}
  #pcm-root[data-theme-fx="cleanroom"] .pcm-window{background:linear-gradient(180deg,#0b1419,#050a0d)!important;filter:saturate(.8) brightness(1.03)!important}
  #pcm-root[data-theme-fx="bio"] .pcm-layout{background:radial-gradient(circle at 12% 0%,rgba(112,255,139,.085),transparent 26%),linear-gradient(180deg,transparent,#020704)!important}
  #pcm-root[data-theme-fx="mednet"] .pcm-card{border-left:3px solid var(--theme-node)!important}

  /* STREET / COMBAT — asymmetry and harder edges */
  #pcm-root[data-theme-fx="neon"] .pcm-window{background:radial-gradient(circle at 12% 0%,rgba(255,91,197,.12),transparent 25%),radial-gradient(circle at 82% 0%,rgba(107,255,227,.09),transparent 30%),linear-gradient(180deg,#0d0710,#040609)!important}
  #pcm-root[data-theme-fx="neon"] aside>button{clip-path:polygon(0 0,calc(100% - 18px) 0,100% 50%,calc(100% - 18px) 100%,0 100%,8px 50%)!important}

  #pcm-root[data-theme-fx="combat"] .pcm-card,
  #pcm-root[data-theme-fx="runner"] .pcm-card{clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,6px 100%,0 calc(100% - 6px))!important}
  #pcm-root[data-theme-fx="combat"] .pcm-layout{background:linear-gradient(180deg,rgba(93,151,255,.035),transparent 80px)!important}

  #pcm-root[data-theme-fx="pirate"] .pcm-window{background:radial-gradient(circle at 18% 0%,rgba(255,151,63,.11),transparent 27%),linear-gradient(180deg,#0e0905,#040706)!important}
  #pcm-root[data-theme-fx="pirate"] .pcm-card{border-style:dotted!important}

  #pcm-root[data-theme-fx="mesh"] .pcm-card{border-left:2px solid #ffc866!important;border-bottom:1px solid rgba(118,255,212,.35)!important}
  #pcm-root[data-theme-fx="mesh"] aside>button::before{background:#ffc866!important}

  #pcm-root[data-theme-fx="scrap"] .pcm-card,
  #pcm-root[data-theme-fx="scrap"] .pcm-detail-panel{clip-path:polygon(0 5px,7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)!important;border-color:rgba(198,126,83,.34)!important}
  #pcm-root[data-theme-fx="scrap"] aside>button{background:linear-gradient(90deg,#111414,#0b0d0d)!important;border-color:rgba(182,128,89,.32)!important}


  /* v7.1.9 — synchronized true loader + organic record fill */
  #pcm-root{--scan-progress:12%}

  /* The JS changes real width and percentage. CSS only animates the data flowing inside it. */
  #pcm-root .pcm-scan-bar i,
  #pcm-root .pcm-cyber-progress i{
    width:var(--scan-progress)!important;
    transform:none!important;
    transform-origin:left center!important;
    transition:width .11s linear!important;
    background:
      repeating-linear-gradient(90deg,
        var(--theme-trace) 0 5px,
        color-mix(in srgb,var(--theme-trace) 48%,#000) 5px 8px)!important;
    background-size:84px 100%!important;
  }
  #pcm-root[data-effects=soft] .pcm-scan-bar i,
  #pcm-root[data-effects=soft] .pcm-cyber-progress i{
    animation:pcmHudProgress var(--theme-scan-speed) linear infinite!important;
  }
  #pcm-root[data-effects=vivid] .pcm-scan-bar i,
  #pcm-root[data-effects=vivid] .pcm-cyber-progress i{
    animation:pcmHudProgress calc(var(--theme-scan-speed) * .66) linear infinite!important;
  }
  #pcm-root[data-effects=off] .pcm-scan-bar i,
  #pcm-root[data-effects=off] .pcm-cyber-progress i{
    animation:pcmHudProgress calc(var(--theme-scan-speed) * 1.75) linear infinite!important;
  }

  #pcm-root .pcm-scan-bar,
  #pcm-root .pcm-cyber-progress{
    position:relative!important;
    overflow:hidden!important;
    isolation:isolate!important;
  }

  /* Bright packet stays at the real loading edge, so it visibly moves as % grows. */
  #pcm-root .pcm-scan-bar::after,
  #pcm-root .pcm-cyber-progress::after{
    content:""!important;
    position:absolute!important;
    z-index:6!important;
    top:-3px!important;
    bottom:-3px!important;
    left:calc(var(--scan-progress) - 22px)!important;
    width:44px!important;
    pointer-events:none!important;
    background:linear-gradient(90deg,transparent,var(--theme-trace),#fff,var(--theme-trace),transparent)!important;
    filter:drop-shadow(0 0 7px var(--theme-node-glow))!important;
    opacity:.78!important;
    transform:none!important;
    transition:left .11s linear!important;
    animation:pcmLoadText 1.15s ease-in-out infinite!important;
  }

  #pcm-root .pcm-scan-bar::before,
  #pcm-root .pcm-cyber-progress::before{
    content:""!important;
    position:absolute!important;
    z-index:5!important;
    top:0!important;
    bottom:0!important;
    left:0!important;
    width:var(--scan-progress)!important;
    pointer-events:none!important;
    background:
      linear-gradient(90deg,
        transparent 0%,
        transparent 62%,
        var(--theme-scan-alpha) 80%,
        rgba(255,255,255,.24) 94%,
        transparent 100%)!important;
    opacity:.72!important;
    transition:width .11s linear!important;
    animation:pcmDataTrail 1.75s linear infinite!important;
  }

  #pcm-root .pcm-scan-strip strong b,
  #pcm-root .pcm-cyber-attention footer b{
    color:var(--theme-node)!important;
    font:inherit!important;
    text-shadow:0 0 9px var(--theme-node-glow)!important;
  }

  /* Record screen: the primary record fills the visual height of the metadata stack. */
  #pcm-root .pcm-record-matrix{
    align-items:stretch!important;
  }
  #pcm-root .pcm-record-main{
    display:grid!important;
    grid-template-rows:minmax(0,1fr) auto!important;
    align-content:stretch!important;
    height:100%!important;
  }
  #pcm-root .pcm-record-primary{
    min-height:100%!important;
    height:100%!important;
    display:flex!important;
    flex-direction:column!important;
  }
  #pcm-root .pcm-record-primary-body{
    position:relative!important;
    flex:1 1 auto!important;
    min-height:260px!important;
    padding-bottom:34px!important;
    background:
      linear-gradient(180deg,rgba(115,244,255,.018),transparent 72px),
      linear-gradient(180deg,rgba(5,10,16,.82),rgba(4,8,13,.96))!important;
  }
  #pcm-root .pcm-record-primary-body::before{
    content:""!important;
    position:absolute!important;
    left:12px!important;
    right:12px!important;
    bottom:26px!important;
    height:1px!important;
    background:linear-gradient(90deg,var(--theme-warning),var(--theme-trace),transparent 78%)!important;
    opacity:.34!important;
    pointer-events:none!important;
  }
  #pcm-root .pcm-record-primary-body::after{
    content:"DATA BUFFER // КОНЕЦ ЗАПИСИ"!important;
    position:absolute!important;
    right:12px!important;
    bottom:10px!important;
    color:color-mix(in srgb,var(--theme-node) 62%,var(--muted))!important;
    font:750 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;
    letter-spacing:.14em!important;
    pointer-events:none!important;
    opacity:.72!important;
  }

  /* If there are real lower data panels, keep them directly attached and let them use the space first. */
  #pcm-root .pcm-record-wide-data:not(:empty){
    margin-top:0!important;
  }

  @media(max-width:900px){
    #pcm-root .pcm-record-main{
      grid-template-rows:auto auto!important;
      height:auto!important;
    }
    #pcm-root .pcm-record-primary{
      min-height:0!important;
      height:auto!important;
    }
    #pcm-root .pcm-record-primary-body{
      min-height:160px!important;
    }
  }


  /* v7.2.0 — primary record stretches horizontally across the console */
  #pcm-root .pcm-record-matrix{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    grid-template-rows:auto auto!important;
    gap:10px!important;
    align-items:start!important;
  }
  #pcm-root .pcm-record-primary-full{
    grid-column:1/-1!important;
    width:100%!important;
    max-width:none!important;
    min-height:0!important;
    height:auto!important;
    display:flex!important;
    flex-direction:column!important;
  }
  #pcm-root .pcm-record-primary-full .pcm-record-primary-body{
    width:100%!important;
    min-height:160px!important;
    height:auto!important;
    flex:0 0 auto!important;
  }

  #pcm-root .pcm-record-lower-grid{
    min-width:0!important;
    display:grid!important;
    grid-template-columns:minmax(0,1.55fr) minmax(270px,.72fr)!important;
    gap:10px!important;
    align-items:start!important;
  }
  #pcm-root .pcm-record-lower-grid>.pcm-record-wide-data{
    min-width:0!important;
    margin:0!important;
  }
  #pcm-root .pcm-record-lower-grid>.pcm-record-side{
    min-width:0!important;
    position:static!important;
    top:auto!important;
    align-self:start!important;
  }

  /* Notes and other records with no real lower-left data use the whole row for information blocks. */
  #pcm-root .pcm-record-lower-grid:has(.pcm-record-wide-data:empty){
    grid-template-columns:minmax(0,1fr)!important;
  }
  #pcm-root .pcm-record-lower-grid:has(.pcm-record-wide-data:empty)>.pcm-record-wide-data{
    display:none!important;
  }
  #pcm-root .pcm-record-lower-grid:has(.pcm-record-wide-data:empty)>.pcm-record-side{
    display:grid!important;
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    gap:10px!important;
  }
  #pcm-root .pcm-record-lower-grid:has(.pcm-record-wide-data:empty) .pcm-record-side-panel{
    height:100%!important;
  }

  /* Remove the old visual filler behaviour now that the primary panel owns the full width. */
  #pcm-root .pcm-record-primary-full .pcm-record-primary-body::before,
  #pcm-root .pcm-record-primary-full .pcm-record-primary-body::after{
    display:none!important;
  }
  #pcm-root .pcm-record-primary-full .pcm-record-primary-body{
    padding-bottom:12px!important;
  }

  @media(max-width:1050px){
    #pcm-root .pcm-record-lower-grid{
      grid-template-columns:minmax(0,1fr) 250px!important;
    }
    #pcm-root .pcm-record-lower-grid:has(.pcm-record-wide-data:empty)>.pcm-record-side{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
    }
  }
  @media(max-width:850px){
    #pcm-root .pcm-record-lower-grid{
      grid-template-columns:1fr!important;
    }
    #pcm-root .pcm-record-lower-grid>.pcm-record-side{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
    }
  }
  @media(max-width:620px){
    #pcm-root .pcm-record-lower-grid>.pcm-record-side,
    #pcm-root .pcm-record-lower-grid:has(.pcm-record-wide-data:empty)>.pcm-record-side{
      grid-template-columns:1fr!important;
    }
  }


  /* v7.2.1 — all-contacts index + explicit affiliations + safe directory unlink */
  #pcm-root .pcm-contact-index-info{
    margin:0 0 10px;
    padding:8px 11px;
    display:flex;
    align-items:center;
    gap:10px;
    border:1px solid color-mix(in srgb,var(--theme-node) 24%,var(--line));
    background:linear-gradient(90deg,var(--secondary-soft),transparent 76%);
    clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%);
  }
  #pcm-root .pcm-contact-index-info b{
    flex:0 0 auto;
    color:var(--theme-node);
    font:800 8px/1 ui-monospace,"Cascadia Mono",Consolas,monospace;
    letter-spacing:.14em;
  }
  #pcm-root .pcm-contact-index-info span{
    min-width:0;
    color:var(--muted);
    font-size:11px;
    line-height:1.3;
  }

  #pcm-root .pcm-contact-origin{
    display:grid!important;
    gap:4px!important;
    margin:5px 0 3px!important;
  }
  #pcm-root .pcm-contact-origin>small{
    color:var(--muted)!important;
    font:800 6.5px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;
    letter-spacing:.14em!important;
  }
  #pcm-root .pcm-contact-origin>span{
    display:flex!important;
    flex-wrap:wrap!important;
    gap:4px!important;
  }
  #pcm-root .pcm-contact-origin i{
    display:inline-flex!important;
    align-items:center!important;
    min-height:22px!important;
    padding:3px 7px!important;
    border:1px solid color-mix(in srgb,var(--theme-node) 24%,var(--line))!important;
    background:color-mix(in srgb,var(--theme-node) 6%,var(--field))!important;
    color:var(--theme-node)!important;
    border-radius:999px!important;
    font-size:9px!important;
    font-style:normal!important;
    font-weight:750!important;
    line-height:1.05!important;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.02),0 0 8px color-mix(in srgb,var(--theme-node-glow) 44%,transparent)!important;
  }
  #pcm-root .pcm-contact-origin i.none{
    color:var(--muted)!important;
    border-color:#ffffff16!important;
    background:rgba(255,255,255,.025)!important;
    box-shadow:none!important;
  }
  #pcm-root .pcm-contact-origin i.more{
    color:var(--theme-warning)!important;
    border-color:color-mix(in srgb,var(--theme-warning) 34%,transparent)!important;
  }

  #pcm-root .pcm-contact-card.has-directory-unlink{
    grid-template-rows:auto auto auto!important;
  }
  #pcm-root .pcm-directory-unlink{
    width:100%!important;
    min-height:30px!important;
    margin:0!important;
    border:0!important;
    border-top:1px solid color-mix(in srgb,var(--theme-warning) 34%,var(--line))!important;
    border-radius:0!important;
    clip-path:none!important;
    background:linear-gradient(90deg,rgba(255,68,88,.11),rgba(255,68,88,.035))!important;
    color:var(--theme-warning)!important;
    font-size:10px!important;
    font-weight:800!important;
    letter-spacing:.04em!important;
    text-align:center!important;
  }
  #pcm-root .pcm-directory-unlink:hover{
    background:linear-gradient(90deg,rgba(255,68,88,.22),rgba(255,68,88,.08))!important;
    box-shadow:inset 0 0 12px var(--theme-warning-glow)!important;
  }


  /* v7.2.2 — contact search/sort, inline edit, right-click context HUD */
  #pcm-root .pcm-contact-toolbar{
    display:grid!important;
    grid-template-columns:minmax(260px,1.7fr) repeat(3,minmax(145px,.72fr)) auto!important;
    gap:8px!important;
    margin:0 0 10px!important;
    padding:10px!important;
    background:linear-gradient(180deg,rgba(8,16,25,.96),rgba(4,9,15,.98))!important;
    border:1px solid color-mix(in srgb,var(--theme-node) 22%,var(--line))!important;
    clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)!important;
  }
  #pcm-root .pcm-contact-toolbar label{min-width:0!important;display:grid!important;gap:4px!important}
  #pcm-root .pcm-contact-toolbar label>span{color:var(--muted)!important;font:800 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.14em!important}
  #pcm-root .pcm-contact-toolbar input,#pcm-root .pcm-contact-toolbar select{width:100%!important;height:34px!important;min-width:0!important}
  #pcm-root .pcm-contact-filter-status{min-width:66px!important;display:grid!important;place-items:center!important;padding:4px 8px!important;border-left:1px solid var(--line)!important}
  #pcm-root .pcm-contact-filter-status b{color:var(--theme-node)!important;font:900 20px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;text-shadow:0 0 10px var(--theme-node-glow)!important}
  #pcm-root .pcm-contact-filter-status span{color:var(--muted)!important;font-size:8px!important}
  #pcm-root .pcm-contact-search-empty{grid-column:1/-1!important}

  #pcm-root .pcm-person-quick-edit{min-width:0!important;padding:14px!important;display:grid!important;gap:10px!important}
  #pcm-root .pcm-quick-edit-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
  #pcm-root .pcm-quick-edit-grid label{min-width:0!important;display:grid!important;gap:4px!important}
  #pcm-root .pcm-quick-edit-grid label.wide{grid-column:1/-1!important}
  #pcm-root .pcm-quick-edit-grid label>span{color:var(--theme-node)!important;font:800 7px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.11em!important}
  #pcm-root .pcm-quick-edit-grid input,#pcm-root .pcm-quick-edit-grid select,#pcm-root .pcm-quick-edit-grid textarea{width:100%!important;min-width:0!important}
  #pcm-root .pcm-quick-edit-grid textarea{min-height:64px!important}
  #pcm-root .pcm-person-hero:has(.pcm-person-quick-edit){align-items:stretch!important}
  #pcm-root .pcm-person-hero:has(.pcm-person-quick-edit) .pcm-person-portrait{min-height:260px!important}
  #pcm-root .pcm-person-quick-edit .pcm-hero-tag-panel{margin:0!important;border-radius:0!important}

  #pcm-root .pcm-contact-context-menu{
    position:fixed!important;
    z-index:1000005!important;
    width:310px!important;
    max-height:min(570px,calc(100vh - 16px))!important;
    overflow:auto!important;
    padding:8px!important;
    background:linear-gradient(180deg,rgba(8,15,24,.99),rgba(3,7,12,.995))!important;
    border:1px solid color-mix(in srgb,var(--theme-warning) 46%,var(--theme-node))!important;
    box-shadow:0 16px 42px rgba(0,0,0,.72),0 0 20px var(--theme-node-glow),inset 0 0 0 1px rgba(255,255,255,.03)!important;
    clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,8px 100%,0 calc(100% - 8px))!important;
  }
  #pcm-root .pcm-contact-context-menu>header{display:grid!important;grid-template-columns:38px minmax(0,1fr) 28px!important;gap:8px!important;align-items:center!important;padding:5px 4px 9px!important;border-bottom:1px solid var(--line)!important}
  #pcm-root .pcm-context-avatar{width:38px!important;height:38px!important;display:grid!important;place-items:center!important;overflow:hidden!important;border:1px solid var(--theme-node)!important;background:var(--field)!important}
  #pcm-root .pcm-context-avatar img{width:100%!important;height:100%!important;object-fit:cover!important}
  #pcm-root .pcm-contact-context-menu header span:nth-child(2){min-width:0!important;display:grid!important;gap:3px!important}
  #pcm-root .pcm-contact-context-menu header small{color:var(--muted)!important;font:800 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.14em!important}
  #pcm-root .pcm-contact-context-menu header b{min-width:0!important;color:var(--heading)!important;font-size:14px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  #pcm-root .pcm-contact-context-menu header button{min-height:28px!important;padding:0!important}
  #pcm-root .pcm-context-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important;margin:7px 0!important}
  #pcm-root .pcm-context-actions.minor{grid-template-columns:1fr!important}
  #pcm-root .pcm-context-actions button{min-height:31px!important;font-size:9.5px!important;text-align:left!important;padding:5px 8px!important}
  #pcm-root .pcm-contact-context-menu>section{padding:7px 0!important;border-top:1px solid #ffffff0c!important}
  #pcm-root .pcm-contact-context-menu>section>small{display:block!important;margin-bottom:6px!important;color:var(--theme-node)!important;font:800 6.5px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.14em!important}
  #pcm-root .pcm-context-chip-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:4px!important}
  #pcm-root .pcm-context-chip-grid button{min-height:29px!important;padding:4px 7px!important;font-size:9px!important;text-align:left!important}
  #pcm-root .pcm-context-chip-grid button.active{color:var(--theme-node)!important;border-color:var(--theme-node)!important;background:var(--secondary-soft)!important;box-shadow:0 0 8px var(--theme-node-glow)!important}
  #pcm-root .pcm-context-chip-grid button:disabled{opacity:.72!important;cursor:default!important}
  #pcm-root .pcm-context-delete{width:100%!important;min-height:32px!important;margin-top:6px!important;color:var(--theme-warning)!important;border-color:color-mix(in srgb,var(--theme-warning) 46%,transparent)!important;background:rgba(255,50,70,.08)!important}

  @media(max-width:1050px){#pcm-root .pcm-contact-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))!important}#pcm-root .pcm-contact-filter-status{border-left:0!important;border-top:1px solid var(--line)!important}}
  @media(max-width:650px){#pcm-root .pcm-contact-toolbar,#pcm-root .pcm-quick-edit-grid{grid-template-columns:1fr!important}#pcm-root .pcm-quick-edit-grid label.wide{grid-column:auto!important}#pcm-root .pcm-contact-context-menu{width:min(310px,calc(100vw - 16px))!important}}



  /* v7.2.4 — unified themed search/edit fields and context menus for every record tab */
  #pcm-root .pcm-contact-toolbar{
    background:
      linear-gradient(90deg,color-mix(in srgb,var(--theme-node) 7%,transparent),transparent 42%),
      linear-gradient(180deg,color-mix(in srgb,var(--panel) 91%,#000),color-mix(in srgb,var(--bg) 96%,#000))!important;
    border-color:color-mix(in srgb,var(--theme-trace) 36%,var(--line))!important;
    box-shadow:inset 0 1px 0 color-mix(in srgb,var(--theme-node) 18%,transparent),0 0 14px color-mix(in srgb,var(--theme-node-glow) 38%,transparent)!important;
  }
  #pcm-root .pcm-contact-toolbar label>span::before{content:"▹ ";color:var(--theme-trace)!important}
  #pcm-root .pcm-contact-toolbar input,
  #pcm-root .pcm-contact-toolbar select,
  #pcm-root .pcm-person-quick-edit input,
  #pcm-root .pcm-person-quick-edit select,
  #pcm-root .pcm-person-quick-edit textarea,
  #pcm-root .pcm-person-quick-edit .pcm-location-checks label,
  #pcm-root .pcm-inline-tags input{
    color:var(--ink)!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--field) 88%,#000),color-mix(in srgb,var(--bg) 91%,#000))!important;
    border:1px solid color-mix(in srgb,var(--theme-node) 26%,var(--line))!important;
    border-radius:2px!important;
    box-shadow:inset 3px 0 0 color-mix(in srgb,var(--theme-trace) 35%,transparent),inset 0 0 10px rgba(0,0,0,.28)!important;
    outline:none!important;
  }
  #pcm-root .pcm-contact-toolbar input::placeholder,
  #pcm-root .pcm-person-quick-edit input::placeholder,
  #pcm-root .pcm-person-quick-edit textarea::placeholder{color:color-mix(in srgb,var(--muted) 74%,transparent)!important}
  #pcm-root .pcm-contact-toolbar input:focus,
  #pcm-root .pcm-contact-toolbar select:focus,
  #pcm-root .pcm-person-quick-edit input:focus,
  #pcm-root .pcm-person-quick-edit select:focus,
  #pcm-root .pcm-person-quick-edit textarea:focus,
  #pcm-root .pcm-inline-tags input:focus{
    border-color:var(--theme-node)!important;
    box-shadow:inset 3px 0 0 var(--theme-trace),0 0 12px var(--theme-node-glow)!important;
  }
  #pcm-root .pcm-contact-toolbar select option,
  #pcm-root .pcm-person-quick-edit select option{background:var(--panel)!important;color:var(--ink)!important}

  #pcm-root .pcm-person-quick-edit{
    padding:10px!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--panel) 84%,#000),color-mix(in srgb,var(--bg) 96%,#000))!important;
    border:1px solid color-mix(in srgb,var(--theme-trace) 30%,var(--line))!important;
    box-shadow:inset 0 0 22px color-mix(in srgb,var(--theme-node-glow) 28%,transparent)!important;
  }
  #pcm-root .pcm-quick-edit-section{
    display:grid!important;
    gap:9px!important;
    padding:10px!important;
    background:linear-gradient(135deg,color-mix(in srgb,var(--theme-node) 4%,var(--panel)),color-mix(in srgb,var(--bg) 96%,#000))!important;
    border:1px solid color-mix(in srgb,var(--theme-node) 18%,var(--line))!important;
    clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)!important;
  }
  #pcm-root .pcm-quick-edit-section>header{display:grid!important;gap:3px!important;border-bottom:1px solid color-mix(in srgb,var(--theme-trace) 22%,transparent)!important;padding-bottom:7px!important}
  #pcm-root .pcm-quick-edit-section>header small{color:var(--theme-trace)!important;font:800 6.5px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.15em!important}
  #pcm-root .pcm-quick-edit-section>header h3{margin:0!important;color:var(--heading)!important;font-size:13px!important}
  #pcm-root .pcm-quick-edit-section>header p{margin:0!important;color:var(--muted)!important;font-size:9px!important}
  #pcm-root .pcm-quick-image-path{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:5px!important}
  #pcm-root .pcm-quick-location-links .pcm-location-checks{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important}
  #pcm-root .pcm-quick-location-links .pcm-location-checks label{min-height:30px!important;padding:5px 7px!important;display:flex!important;align-items:center!important;gap:7px!important}
  #pcm-root .pcm-quick-location-links .pcm-location-checks input{width:auto!important;box-shadow:none!important}
  #pcm-root .pcm-person-quick-edit .pcm-gallery-editor,
  #pcm-root .pcm-person-quick-edit .pcm-sub{margin:0!important;background:color-mix(in srgb,var(--field) 72%,transparent)!important;border-color:color-mix(in srgb,var(--theme-node) 18%,var(--line))!important}

  #pcm-root .pcm-inline-manual-tag-chips,
  #pcm-root .pcm-context-tag-list{display:flex!important;flex-wrap:wrap!important;gap:5px!important}
  #pcm-root .pcm-inline-manual-tag-chips button,
  #pcm-root .pcm-context-tag-list button{
    min-height:25px!important;
    padding:4px 7px!important;
    color:var(--theme-node)!important;
    background:color-mix(in srgb,var(--theme-node) 7%,var(--field))!important;
    border:1px solid color-mix(in srgb,var(--theme-node) 28%,var(--line))!important;
    border-radius:999px!important;
    font-size:8.5px!important;
  }
  #pcm-root .pcm-inline-manual-tag-chips button b,
  #pcm-root .pcm-context-tag-list button b{color:var(--theme-warning)!important;margin-left:4px!important}
  #pcm-root .pcm-inline-manual-tag-chips button:hover,
  #pcm-root .pcm-context-tag-list button:hover{border-color:var(--theme-warning)!important;color:var(--theme-warning)!important;box-shadow:0 0 8px var(--theme-warning-glow)!important}

  #pcm-root .pcm-entry-context-menu{
    position:fixed!important;
    z-index:1000005!important;
    width:310px!important;
    max-height:min(570px,calc(100vh - 16px))!important;
    overflow:auto!important;
    padding:8px!important;
    color:var(--ink)!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--panel) 92%,#000),color-mix(in srgb,var(--bg) 97%,#000))!important;
    border:1px solid color-mix(in srgb,var(--theme-trace) 54%,var(--theme-warning))!important;
    box-shadow:0 16px 42px rgba(0,0,0,.72),0 0 20px var(--theme-node-glow),inset 0 0 0 1px rgba(255,255,255,.03)!important;
    clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,8px 100%,0 calc(100% - 8px))!important;
  }
  #pcm-root .pcm-entry-context-menu>header{display:grid!important;grid-template-columns:38px minmax(0,1fr) 28px!important;gap:8px!important;align-items:center!important;padding:5px 4px 9px!important;border-bottom:1px solid var(--line)!important}
  #pcm-root .pcm-entry-context-menu header span:nth-child(2){min-width:0!important;display:grid!important;gap:3px!important}
  #pcm-root .pcm-entry-context-menu header small{color:var(--theme-trace)!important;font:800 6px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.14em!important}
  #pcm-root .pcm-entry-context-menu header b{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:var(--heading)!important;font-size:14px!important}
  #pcm-root .pcm-entry-context-menu header>button{min-height:28px!important;padding:0!important}
  #pcm-root .pcm-entry-context-menu>section{padding:7px 0!important;border-top:1px solid color-mix(in srgb,var(--theme-node) 10%,transparent)!important}
  #pcm-root .pcm-entry-context-menu>section>small{display:block!important;margin-bottom:6px!important;color:var(--theme-node)!important;font:800 6.5px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;letter-spacing:.14em!important}

  #pcm-root .pcm-contact-context-menu,
  #pcm-root .pcm-entry-context-menu{scrollbar-color:var(--theme-trace) transparent!important}
  #pcm-root .pcm-contact-context-menu .pcm-context-actions button,
  #pcm-root .pcm-contact-context-menu .pcm-context-chip-grid button,
  #pcm-root .pcm-entry-context-menu .pcm-context-actions button,
  #pcm-root .pcm-entry-context-menu .pcm-context-chip-grid button{
    background:linear-gradient(180deg,color-mix(in srgb,var(--theme-node) 4%,var(--panel)),color-mix(in srgb,var(--bg) 95%,#000))!important;
    border-color:color-mix(in srgb,var(--theme-node) 22%,var(--line))!important;
    color:var(--ink)!important;
  }
  #pcm-root .pcm-contact-context-menu .pcm-context-actions button:hover,
  #pcm-root .pcm-contact-context-menu .pcm-context-chip-grid button:hover,
  #pcm-root .pcm-entry-context-menu .pcm-context-actions button:hover,
  #pcm-root .pcm-entry-context-menu .pcm-context-chip-grid button:hover{border-color:var(--theme-node)!important;box-shadow:0 0 9px var(--theme-node-glow)!important}

  @media(max-width:760px){
    #pcm-root .pcm-quick-location-links .pcm-location-checks{grid-template-columns:1fr!important}
    #pcm-root .pcm-entry-context-menu{width:min(310px,calc(100vw - 16px))!important}
  }



  /* v7.2.5 — readable quick edit, reversible roles, compact contact filter console */
  #pcm-root .pcm-contact-toolbar{
    grid-template-columns:minmax(360px,1.65fr) minmax(145px,.72fr) minmax(145px,.72fr) minmax(170px,.82fr) 76px!important;
    grid-template-areas:"search role tag sort status"!important;
    align-items:end!important;
    gap:9px!important;
    padding:10px 11px!important;
  }
  #pcm-root .pcm-contact-toolbar .contact-search-filter{grid-area:search!important;align-self:end!important}
  #pcm-root .pcm-contact-toolbar .role-filter{grid-area:role!important}
  #pcm-root .pcm-contact-toolbar .tag-filter{grid-area:tag!important}
  #pcm-root .pcm-contact-toolbar .sort-filter{grid-area:sort!important}
  #pcm-root .pcm-contact-filter-status{grid-area:status!important;min-height:38px!important;border-left:1px solid color-mix(in srgb,var(--theme-warning) 30%,var(--line))!important}
  #pcm-root .pcm-contact-toolbar label>span{font-size:8px!important;color:color-mix(in srgb,var(--theme-node) 76%,var(--muted))!important}
  #pcm-root .pcm-contact-toolbar label>span::before{content:"▹ ";color:var(--theme-trace)!important}
  #pcm-root .pcm-contact-searchbox{
    position:relative!important;
    display:grid!important;
    grid-template-columns:34px minmax(0,1fr) auto!important;
    align-items:center!important;
    height:38px!important;
    overflow:hidden!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--field) 91%,#000),color-mix(in srgb,var(--bg) 96%,#000))!important;
    border:1px solid color-mix(in srgb,var(--theme-node) 30%,var(--line))!important;
    box-shadow:inset 3px 0 0 color-mix(in srgb,var(--theme-trace) 60%,transparent),inset 0 0 12px rgba(0,0,0,.28)!important;
  }
  #pcm-root .pcm-contact-searchbox:focus-within{border-color:var(--theme-node)!important;box-shadow:inset 3px 0 0 var(--theme-trace),0 0 12px var(--theme-node-glow)!important}
  #pcm-root .pcm-contact-searchbox>b{display:grid!important;place-items:center!important;height:100%!important;color:var(--theme-node)!important;font-size:17px!important;text-shadow:0 0 8px var(--theme-node-glow)!important;border-right:1px solid color-mix(in srgb,var(--theme-node) 18%,transparent)!important}
  #pcm-root .pcm-contact-searchbox>input{height:36px!important;border:0!important;background:transparent!important;box-shadow:none!important;padding:0 9px!important;font-size:12.5px!important}
  #pcm-root .pcm-contact-searchbox>i{padding:0 9px!important;color:var(--muted)!important;font:800 6.5px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;font-style:normal!important;letter-spacing:.12em!important;border-left:1px solid color-mix(in srgb,var(--theme-node) 13%,transparent)!important}
  #pcm-root .pcm-contact-toolbar select{height:38px!important;font-size:12px!important;padding:0 9px!important}
  #pcm-root .pcm-contact-filter-status b{font-size:22px!important}
  #pcm-root .pcm-contact-filter-status span{font-size:9px!important}

  /* Quick edit readability */
  #pcm-root .pcm-person-quick-edit{gap:12px!important}
  #pcm-root .pcm-quick-edit-section{gap:10px!important;padding:12px!important}
  #pcm-root .pcm-quick-edit-section>header small{font-size:8px!important;line-height:1.15!important}
  #pcm-root .pcm-quick-edit-section>header h3{font-size:15px!important;line-height:1.2!important}
  #pcm-root .pcm-quick-edit-section>header p{font-size:11px!important;line-height:1.35!important}
  #pcm-root .pcm-quick-edit-grid{gap:10px!important}
  #pcm-root .pcm-quick-edit-grid label>span{font-size:9px!important;line-height:1.15!important}
  #pcm-root .pcm-person-quick-edit input,
  #pcm-root .pcm-person-quick-edit select,
  #pcm-root .pcm-person-quick-edit textarea{font-size:13px!important;line-height:1.35!important}
  #pcm-root .pcm-person-quick-edit input,
  #pcm-root .pcm-person-quick-edit select{min-height:38px!important}
  #pcm-root .pcm-person-quick-edit textarea{min-height:78px!important;padding:8px 10px!important}
  #pcm-root .pcm-person-quick-edit .pcm-inline-tags>header small{font-size:10px!important}
  #pcm-root .pcm-person-quick-edit .pcm-inline-tags>header h3{font-size:16px!important}
  #pcm-root .pcm-person-quick-edit .pcm-inline-group span,
  #pcm-root .pcm-person-quick-edit .pcm-inline-manual-tags span{font-size:12px!important}
  #pcm-root .pcm-person-quick-edit .pcm-inline-hint{font-size:11px!important;line-height:1.4!important}

  /* Explicit selected/unselected visual language for roles in both places. */
  #pcm-root .pcm-context-chip-grid.roles button{
    opacity:1!important;
    cursor:pointer!important;
    color:color-mix(in srgb,var(--ink) 76%,var(--muted))!important;
    border-color:color-mix(in srgb,var(--theme-node) 18%,var(--line))!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--field) 90%,#000),color-mix(in srgb,var(--bg) 96%,#000))!important;
    box-shadow:inset 2px 0 0 color-mix(in srgb,var(--muted) 22%,transparent)!important;
  }
  #pcm-root .pcm-context-chip-grid.roles button:hover{color:var(--theme-node)!important;border-color:var(--theme-node)!important;box-shadow:inset 2px 0 0 var(--theme-trace),0 0 8px var(--theme-node-glow)!important}
  #pcm-root .pcm-context-chip-grid.roles button.active{
    color:var(--heading)!important;
    border-color:var(--theme-node)!important;
    background:linear-gradient(90deg,color-mix(in srgb,var(--theme-node) 20%,var(--field)),color-mix(in srgb,var(--theme-trace) 8%,var(--panel)))!important;
    box-shadow:inset 3px 0 0 var(--theme-trace),0 0 10px var(--theme-node-glow)!important;
    text-shadow:0 0 6px var(--theme-node-glow)!important;
  }
  #pcm-root .pcm-context-chip-grid.roles button.active:hover{
    color:var(--theme-warning)!important;
    border-color:var(--theme-warning)!important;
    background:linear-gradient(90deg,color-mix(in srgb,var(--theme-warning) 15%,var(--field)),var(--panel))!important;
    box-shadow:inset 3px 0 0 var(--theme-warning),0 0 10px var(--theme-warning-glow)!important;
  }
  #pcm-root .pcm-context-role-hint{display:block!important;margin:6px 1px 0!important;color:var(--muted)!important;font-size:8.5px!important;line-height:1.3!important}

  #pcm-root .pcm-inline-category-editor button:not(.active){
    color:color-mix(in srgb,var(--ink) 76%,var(--muted))!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--field) 90%,#000),color-mix(in srgb,var(--bg) 96%,#000))!important;
    border-color:color-mix(in srgb,var(--theme-node) 18%,var(--line))!important;
    box-shadow:inset 2px 0 0 color-mix(in srgb,var(--muted) 20%,transparent)!important;
  }
  #pcm-root .pcm-inline-category-editor button.active{
    color:var(--heading)!important;
    background:linear-gradient(90deg,color-mix(in srgb,var(--theme-node) 18%,var(--field)),color-mix(in srgb,var(--theme-trace) 7%,var(--panel)))!important;
    border-color:var(--theme-node)!important;
    box-shadow:inset 3px 0 0 var(--theme-trace),0 0 9px var(--theme-node-glow)!important;
  }
  #pcm-root .pcm-inline-category-editor button.active:hover{
    color:var(--theme-warning)!important;
    border-color:var(--theme-warning)!important;
    box-shadow:inset 3px 0 0 var(--theme-warning),0 0 9px var(--theme-warning-glow)!important;
  }

  @media(max-width:1150px){
    #pcm-root .pcm-contact-toolbar{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      grid-template-areas:"search search" "role tag" "sort status"!important;
    }
    #pcm-root .pcm-contact-filter-status{border-left:0!important;border-top:1px solid color-mix(in srgb,var(--theme-warning) 30%,var(--line))!important}
  }
  @media(max-width:700px){
    #pcm-root .pcm-contact-toolbar{
      grid-template-columns:1fr!important;
      grid-template-areas:"search" "role" "tag" "sort" "status"!important;
    }
    #pcm-root .pcm-contact-searchbox{grid-template-columns:32px minmax(0,1fr)!important}
    #pcm-root .pcm-contact-searchbox>i{display:none!important}
  }


  /* v7.2.6 — contact search lives on the same row as role/tag/sort */
  #pcm-root .pcm-contact-toolbar{
    grid-template-columns:minmax(360px,1.65fr) minmax(145px,.72fr) minmax(145px,.72fr) minmax(170px,.82fr) 76px!important;
    grid-template-areas:"search role tag sort status"!important;
    align-items:end!important;
  }
  #pcm-root .pcm-contact-toolbar .contact-search-filter{
    grid-area:search!important;
    align-self:end!important;
    min-width:0!important;
    display:grid!important;
    grid-template-rows:auto 38px!important;
    gap:4px!important;
    margin:0!important;
    padding:0!important;
  }
  #pcm-root .pcm-contact-toolbar .contact-search-filter::before,
  #pcm-root .pcm-contact-toolbar .contact-search-filter::after{
    content:none!important;
    display:none!important;
  }
  #pcm-root .pcm-contact-toolbar .contact-search-filter>span,
  #pcm-root .pcm-contact-toolbar .role-filter>span,
  #pcm-root .pcm-contact-toolbar .tag-filter>span,
  #pcm-root .pcm-contact-toolbar .sort-filter>span{
    min-height:10px!important;
    display:flex!important;
    align-items:center!important;
    margin:0!important;
  }
  #pcm-root .pcm-contact-searchbox{
    height:38px!important;
    margin:0!important;
    align-self:end!important;
  }
  #pcm-root .pcm-contact-searchbox>b{
    color:var(--theme-node)!important;
  }
  @media(max-width:1050px){
    #pcm-root .pcm-contact-toolbar{
      grid-template-columns:minmax(260px,1.35fr) minmax(145px,.72fr) minmax(145px,.72fr)!important;
      grid-template-areas:"search role status" "search tag sort"!important;
      align-items:end!important;
    }
    #pcm-root .pcm-contact-toolbar .contact-search-filter{
      grid-row:1 / span 2!important;
      align-self:stretch!important;
      grid-template-rows:auto 1fr!important;
    }
    #pcm-root .pcm-contact-searchbox{align-self:end!important}
  }
  @media(max-width:760px){
    #pcm-root .pcm-contact-toolbar{
      grid-template-columns:1fr 1fr!important;
      grid-template-areas:"search search" "role tag" "sort status"!important;
    }
    #pcm-root .pcm-contact-toolbar .contact-search-filter{
      grid-row:auto!important;
      grid-template-rows:auto 38px!important;
    }
  }
  @media(max-width:520px){
    #pcm-root .pcm-contact-toolbar{
      grid-template-columns:1fr!important;
      grid-template-areas:"search" "role" "tag" "sort" "status"!important;
    }
  }



  /* v7.2.8 — unified context menu controls + viewport-safe interactive menu portal */
  #pcm-root .pcm-context-menu-surface{
    position:fixed!important;
    z-index:1000015!important;
    pointer-events:auto!important;
    width:min(330px,calc(100vw - 16px))!important;
    max-width:calc(100vw - 16px)!important;
    max-height:calc(100vh - 16px)!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    overscroll-behavior:contain!important;
    scrollbar-gutter:stable!important;
    border-radius:0!important;
  }

  /* Every action/chip uses one visual system. Active state changes color, not geometry. */
  #pcm-root .pcm-context-menu-surface button:not([aria-label="Закрыть"]){
    min-height:32px!important;
    height:32px!important;
    padding:4px 9px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:flex-start!important;
    gap:5px!important;
    border:1px solid color-mix(in srgb,var(--theme-node) 24%,var(--line))!important;
    border-radius:5px 7px 5px 7px!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--theme-node) 4%,var(--panel)),color-mix(in srgb,var(--bg) 95%,#000))!important;
    color:var(--ink)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.045),inset 0 -1px 0 rgba(0,0,0,.55)!important;
    font-size:10px!important;
    font-weight:700!important;
    line-height:1.1!important;
    text-align:left!important;
    white-space:normal!important;
  }
  #pcm-root .pcm-context-menu-surface .pcm-context-actions,
  #pcm-root .pcm-context-menu-surface .pcm-context-chip-grid{
    gap:5px!important;
  }
  #pcm-root .pcm-context-menu-surface .pcm-context-actions button,
  #pcm-root .pcm-context-menu-surface .pcm-context-chip-grid button,
  #pcm-root .pcm-context-menu-surface .pcm-context-tag-list button,
  #pcm-root .pcm-context-menu-surface .pcm-context-delete{
    min-height:32px!important;
    height:32px!important;
    font-size:10px!important;
  }
  #pcm-root .pcm-context-menu-surface button:not([aria-label="Закрыть"]):hover{
    color:var(--theme-node)!important;
    border-color:var(--theme-node)!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--theme-node) 12%,var(--panel)),color-mix(in srgb,var(--theme-node) 4%,var(--bg)))!important;
    box-shadow:inset 2px 0 0 var(--theme-trace),0 0 9px var(--theme-node-glow)!important;
  }
  #pcm-root .pcm-context-menu-surface button.active:not([aria-label="Закрыть"]),
  #pcm-root .pcm-context-menu-surface button[aria-pressed="true"]:not([aria-label="Закрыть"]){
    color:var(--theme-node)!important;
    border-color:color-mix(in srgb,var(--theme-node) 82%,#fff 18%)!important;
    background:linear-gradient(90deg,color-mix(in srgb,var(--theme-node) 16%,var(--panel)),color-mix(in srgb,var(--theme-trace) 7%,var(--bg)))!important;
    box-shadow:inset 3px 0 0 var(--theme-node),0 0 10px var(--theme-node-glow)!important;
  }
  #pcm-root .pcm-context-menu-surface .pcm-context-delete{
    color:var(--theme-warning)!important;
    border-color:color-mix(in srgb,var(--theme-warning) 48%,var(--line))!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--theme-warning) 9%,var(--panel)),color-mix(in srgb,var(--bg) 96%,#000))!important;
  }
  #pcm-root .pcm-context-menu-surface .pcm-context-delete:hover{
    color:#fff!important;
    border-color:var(--theme-warning)!important;
    box-shadow:inset 3px 0 0 var(--theme-warning),0 0 10px var(--theme-warning-glow)!important;
  }
  #pcm-root .pcm-context-menu-surface .pcm-context-tag-list button{
    width:auto!important;
    max-width:100%!important;
  }
  #pcm-root .pcm-context-menu-surface>header>button[aria-label="Закрыть"]{
    width:30px!important;
    min-width:30px!important;
    height:30px!important;
    min-height:30px!important;
    padding:0!important;
    display:grid!important;
    place-items:center!important;
  }

  @media(max-width:420px){
    #pcm-root .pcm-context-menu-surface{
      width:calc(100vw - 12px)!important;
      max-width:calc(100vw - 12px)!important;
      max-height:calc(100vh - 12px)!important;
    }
    #pcm-root .pcm-context-menu-surface .pcm-context-actions,
    #pcm-root .pcm-context-menu-surface .pcm-context-chip-grid{
      grid-template-columns:1fr!important;
    }
  }


  /* v7.2.9 — persistent quick menus + inline HUD tag editor */
  #pcm-root .pcm-context-tag-action{display:block!important}
  #pcm-root .pcm-context-tag-editor{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto 30px!important;
    gap:6px!important;
    align-items:end!important;
    width:100%!important;
  }
  #pcm-root .pcm-context-tag-editor label{
    display:grid!important;
    gap:4px!important;
    min-width:0!important;
  }
  #pcm-root .pcm-context-tag-editor label>span{
    color:var(--theme-node)!important;
    font:800 6.5px/1 ui-monospace,"Cascadia Mono",Consolas,monospace!important;
    letter-spacing:.14em!important;
  }
  #pcm-root .pcm-context-tag-editor input{
    width:100%!important;
    min-width:0!important;
    height:32px!important;
    padding:0 9px!important;
    color:var(--heading)!important;
    background:linear-gradient(90deg,color-mix(in srgb,var(--theme-node) 7%,var(--field)),var(--field))!important;
    border:1px solid color-mix(in srgb,var(--theme-node) 42%,var(--line))!important;
    border-radius:7px!important;
    outline:none!important;
    box-shadow:inset 2px 0 0 var(--theme-trace)!important;
    font-size:10px!important;
  }
  #pcm-root .pcm-context-tag-editor input:focus{
    border-color:var(--theme-node)!important;
    box-shadow:inset 2px 0 0 var(--theme-trace),0 0 10px var(--theme-node-glow)!important;
  }
  #pcm-root .pcm-context-tag-editor>button{
    width:auto!important;
    min-width:82px!important;
    height:32px!important;
  }
  #pcm-root .pcm-context-tag-editor>button[aria-label="Отмена добавления тега"]{
    min-width:30px!important;
    width:30px!important;
    padding:0!important;
    color:var(--theme-warning)!important;
  }
  @media(max-width:430px){
    #pcm-root .pcm-context-tag-editor{grid-template-columns:1fr 1fr 30px!important}
    #pcm-root .pcm-context-tag-editor label{grid-column:1/-1!important}
  }


  /* v7.3.0 — window coordinates are relative to the full-screen root, not the centered flow. */
  #pcm-root .pcm-window{position:absolute!important;right:auto!important;bottom:auto!important;margin:0!important;}



  #pcm-root .pcm-window{filter:none!important}

  /* v7.3.1 — Foundry FPS optimization
     Keep theme identity, but remove continuous paint-heavy effects from large areas.
     The only continuous motion left is a tiny compositor-friendly loader sweep. */
  #pcm-root .pcm-window{
    filter:none!important;
    contain:layout paint style;
  }
  #pcm-root .pcm-layout{animation:none!important;background-position:0 0,0 0!important}
  #pcm-root .pcm-device-screen::after{display:none!important;animation:none!important}

  #pcm-root[data-effects=soft] .pcm-cyber-alert,
  #pcm-root[data-effects=soft] .pcm-capture,
  #pcm-root[data-effects=soft] .pcm-quick,
  #pcm-root[data-effects=soft] .pcm-recent,
  #pcm-root[data-effects=soft] .pcm-dashboard-subscriptions,
  #pcm-root[data-effects=soft] .pcm-cyber-mini,
  #pcm-root[data-effects=vivid] .pcm-cyber-alert,
  #pcm-root[data-effects=vivid] .pcm-capture,
  #pcm-root[data-effects=vivid] .pcm-quick,
  #pcm-root[data-effects=vivid] .pcm-recent,
  #pcm-root[data-effects=vivid] .pcm-dashboard-subscriptions,
  #pcm-root[data-effects=vivid] .pcm-cyber-mini{
    animation:none!important;
  }

  #pcm-root[data-effects=soft] .pcm-cyber-alert::before,
  #pcm-root[data-effects=soft] .pcm-capture::before,
  #pcm-root[data-effects=soft] .pcm-quick::before,
  #pcm-root[data-effects=soft] .pcm-recent::before,
  #pcm-root[data-effects=soft] .pcm-dashboard-subscriptions::before,
  #pcm-root[data-effects=soft] .pcm-cyber-mini::before,
  #pcm-root[data-effects=soft] .pcm-goal::before,
  #pcm-root[data-effects=soft] .pcm-card::before,
  #pcm-root[data-effects=soft] .pcm-detail-panel::before,
  #pcm-root[data-effects=vivid] .pcm-cyber-alert::before,
  #pcm-root[data-effects=vivid] .pcm-capture::before,
  #pcm-root[data-effects=vivid] .pcm-quick::before,
  #pcm-root[data-effects=vivid] .pcm-recent::before,
  #pcm-root[data-effects=vivid] .pcm-dashboard-subscriptions::before,
  #pcm-root[data-effects=vivid] .pcm-cyber-mini::before,
  #pcm-root[data-effects=vivid] .pcm-goal::before,
  #pcm-root[data-effects=vivid] .pcm-card::before,
  #pcm-root[data-effects=vivid] .pcm-detail-panel::before{
    animation:none!important;
    background-position:50% 0!important;
  }

  #pcm-root[data-effects=soft] aside>button::before,
  #pcm-root[data-effects=soft] .pcm-top-actions>button::before,
  #pcm-root[data-effects=soft] .pcm-stat-grid button::before,
  #pcm-root[data-effects=soft] .pcm-recent>button::before,
  #pcm-root[data-effects=vivid] aside>button::before,
  #pcm-root[data-effects=vivid] .pcm-top-actions>button::before,
  #pcm-root[data-effects=vivid] .pcm-stat-grid button::before,
  #pcm-root[data-effects=vivid] .pcm-recent>button::before,
  #pcm-root[data-effects=soft] .pcm-nav-header b,
  #pcm-root[data-effects=soft] .pcm-scan-strip strong,
  #pcm-root[data-effects=soft] .pcm-cyber-attention h1,
  #pcm-root[data-effects=soft] .pcm-cyber-status b,
  #pcm-root[data-effects=soft] .pcm-capture h2,
  #pcm-root[data-effects=vivid] .pcm-nav-header b,
  #pcm-root[data-effects=vivid] .pcm-scan-strip strong,
  #pcm-root[data-effects=vivid] .pcm-cyber-attention h1,
  #pcm-root[data-effects=vivid] .pcm-cyber-status b,
  #pcm-root[data-effects=vivid] .pcm-capture h2,
  #pcm-root[data-effects=soft] .pcm-top-actions>button::after,
  #pcm-root[data-effects=soft] aside>button::after,
  #pcm-root[data-effects=soft] .pcm-stat-grid button::after,
  #pcm-root[data-effects=soft] .pcm-recent>button::after,
  #pcm-root[data-effects=soft] .pcm-capture-actions button::after,
  #pcm-root[data-effects=soft] .pcm-quick-save button::after,
  #pcm-root[data-effects=vivid] .pcm-top-actions>button::after,
  #pcm-root[data-effects=vivid] aside>button::after,
  #pcm-root[data-effects=vivid] .pcm-stat-grid button::after,
  #pcm-root[data-effects=vivid] .pcm-recent>button::after,
  #pcm-root[data-effects=vivid] .pcm-capture-actions button::after,
  #pcm-root[data-effects=vivid] .pcm-quick-save button::after{
    animation:none!important;
  }

  /* Drop repaint-heavy background/filter loader animations. Width still follows live %. */
  #pcm-root .pcm-scan-bar i,
  #pcm-root .pcm-cyber-progress i{
    position:relative!important;
    overflow:hidden!important;
    animation:none!important;
    filter:none!important;
    transition:width .26s linear!important;
  }
  #pcm-root .pcm-scan-bar::before,
  #pcm-root .pcm-scan-bar::after,
  #pcm-root .pcm-cyber-progress::before,
  #pcm-root .pcm-cyber-progress::after{
    display:none!important;
    animation:none!important;
  }
  @keyframes pcmPerfSweep{
    0%{transform:translate3d(-72px,0,0);opacity:0}
    14%{opacity:.75}
    82%{opacity:.75}
    100%{transform:translate3d(520px,0,0);opacity:0}
  }
  #pcm-root .pcm-scan-bar i::after,
  #pcm-root .pcm-cyber-progress i::after{
    content:"";
    position:absolute;
    z-index:2;
    top:0;
    bottom:0;
    left:0;
    width:42px;
    pointer-events:none;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.72),var(--theme-scan-alpha),transparent);
    transform:translate3d(-72px,0,0);
    will-change:transform,opacity;
  }
  #pcm-root[data-effects=soft] .pcm-scan-bar i::after,
  #pcm-root[data-effects=soft] .pcm-cyber-progress i::after{animation:pcmPerfSweep 2.8s linear infinite}
  #pcm-root[data-effects=vivid] .pcm-scan-bar i::after,
  #pcm-root[data-effects=vivid] .pcm-cyber-progress i::after{animation:pcmPerfSweep 1.7s linear infinite}
  #pcm-root[data-effects=off] .pcm-scan-bar i::after,
  #pcm-root[data-effects=off] .pcm-cyber-progress i::after{animation:none!important;display:none!important}

  /* Static glow conveys the selected theme without repainting every frame. */
  #pcm-root .pcm-scan-strip strong,
  #pcm-root .pcm-nav-header b,
  #pcm-root [data-save-badge]{filter:none!important;animation:none!important}
  #pcm-root .pcm-cyber-status::after{animation:none!important}

  @media (prefers-reduced-motion: reduce){
    #pcm-root *,#pcm-root *::before,#pcm-root *::after{
      animation-duration:.001ms!important;
      animation-iteration-count:1!important;
      scroll-behavior:auto!important;
    }
  }


  /* v7.3.2 — context controls remain a real interactive overlay after performance containment. */
  #pcm-root .pcm-context-menu-surface,
  #pcm-root .pcm-context-menu-surface *{pointer-events:auto!important}


  /* v7.3.3 — adaptive interface scale synchronized with Foundry UI and window size */
  #pcm-root{
    --pcm-foundry-scale:1;
    --pcm-window-scale:1;
    --pcm-ui-scale:1;
    --pcm-context-scale:1;
    --pcm-top-control-h:calc(36px * var(--pcm-ui-scale));
    --pcm-top-font:calc(11.5px * var(--pcm-ui-scale));
    --pcm-control-h:calc(34px * var(--pcm-ui-scale));
  }

  #pcm-root .pcm-window{
    font-size:calc(var(--font-size) * var(--pcm-ui-scale))!important;
  }

  /* General controls follow the same scale instead of keeping scattered fixed pixel sizes. */
  #pcm-root .pcm-window button,
  #pcm-root .pcm-window input,
  #pcm-root .pcm-window select,
  #pcm-root .pcm-window textarea{
    font-size:calc(12px * var(--pcm-ui-scale))!important;
  }
  #pcm-root .pcm-window button{
    min-height:var(--pcm-control-h)!important;
  }
  #pcm-root .pcm-window input,
  #pcm-root .pcm-window select{
    min-height:calc(32px * var(--pcm-ui-scale))!important;
  }

  /* Top HUD controls — including the close X — share one geometry. */
  #pcm-root .pcm-top{
    min-height:calc(60px * var(--pcm-ui-scale))!important;
    height:auto!important;
    padding:calc(7px * var(--pcm-ui-scale)) calc(10px * var(--pcm-ui-scale))!important;
    gap:calc(6px * var(--pcm-ui-scale))!important;
  }
  #pcm-root .pcm-top-actions{
    gap:calc(5px * var(--pcm-ui-scale))!important;
  }
  #pcm-root .pcm-top-actions>button{
    height:var(--pcm-top-control-h)!important;
    min-height:var(--pcm-top-control-h)!important;
    padding:0 calc(12px * var(--pcm-ui-scale))!important;
    font-size:var(--pcm-top-font)!important;
    gap:calc(5px * var(--pcm-ui-scale))!important;
  }
  #pcm-root .pcm-top-actions>button>b{
    font-size:calc(14px * var(--pcm-ui-scale))!important;
    line-height:1!important;
  }
  #pcm-root .pcm-top-actions>.pcm-close{
    width:var(--pcm-top-control-h)!important;
    min-width:var(--pcm-top-control-h)!important;
    max-width:var(--pcm-top-control-h)!important;
    height:var(--pcm-top-control-h)!important;
    min-height:var(--pcm-top-control-h)!important;
    padding:0!important;
    display:grid!important;
    place-items:center!important;
    font-size:calc(19px * var(--pcm-ui-scale))!important;
    line-height:1!important;
  }

  #pcm-root .pcm-brand img{
    width:calc(44px * var(--pcm-ui-scale))!important;
    height:calc(44px * var(--pcm-ui-scale))!important;
    flex-basis:calc(44px * var(--pcm-ui-scale))!important;
    border-radius:calc(8px * var(--pcm-ui-scale))!important;
  }
  #pcm-root .pcm-brand small{
    font-size:calc(8.2px * var(--pcm-ui-scale))!important;
  }
  #pcm-root .pcm-brand select{
    height:calc(28px * var(--pcm-ui-scale))!important;
    font-size:calc(16px * var(--pcm-ui-scale))!important;
  }

  #pcm-root main{
    padding:calc(16px * var(--pcm-ui-scale))!important;
  }
  #pcm-root aside{
    padding:calc(10px * var(--pcm-ui-scale)) calc(8px * var(--pcm-ui-scale))!important;
    gap:calc(4px * var(--pcm-ui-scale))!important;
  }
  #pcm-root aside>button{
    min-height:calc(35px * var(--pcm-ui-scale))!important;
    font-size:calc(11px * var(--pcm-ui-scale))!important;
  }
  #pcm-root h1{
    font-size:calc(27px * var(--pcm-ui-scale))!important;
  }
  #pcm-root h2{
    font-size:calc(15px * var(--pcm-ui-scale))!important;
  }

  /* Context menus scale from Foundry's actual UI size instead of a hard-coded 10px UI. */
  #pcm-root .pcm-context-menu-surface{
    width:min(calc(360px * var(--pcm-context-scale)),calc(100vw - 16px))!important;
    max-width:min(calc(390px * var(--pcm-context-scale)),calc(100vw - 16px))!important;
    max-height:calc(100vh - 16px)!important;
    padding:calc(8px * var(--pcm-context-scale))!important;
    font-size:calc(12px * var(--pcm-context-scale))!important;
  }
  #pcm-root .pcm-context-menu-surface>header{
    min-height:calc(50px * var(--pcm-context-scale))!important;
    gap:calc(8px * var(--pcm-context-scale))!important;
    padding-bottom:calc(7px * var(--pcm-context-scale))!important;
  }
  #pcm-root .pcm-context-menu-surface>header b{
    font-size:calc(14px * var(--pcm-context-scale))!important;
    line-height:1.15!important;
  }
  #pcm-root .pcm-context-menu-surface>header small,
  #pcm-root .pcm-context-menu-surface>section>small,
  #pcm-root .pcm-context-role-hint{
    font-size:calc(8.5px * var(--pcm-context-scale))!important;
    line-height:1.2!important;
  }
  #pcm-root .pcm-context-menu-surface .pcm-context-avatar{
    width:calc(42px * var(--pcm-context-scale))!important;
    height:calc(42px * var(--pcm-context-scale))!important;
    min-width:calc(42px * var(--pcm-context-scale))!important;
  }
  #pcm-root .pcm-context-menu-surface .pcm-context-avatar img{
    width:100%!important;
    height:100%!important;
    object-fit:cover!important;
  }

  #pcm-root .pcm-context-menu-surface button:not([aria-label="Закрыть"]),
  #pcm-root .pcm-context-menu-surface .pcm-context-actions button,
  #pcm-root .pcm-context-menu-surface .pcm-context-chip-grid button,
  #pcm-root .pcm-context-menu-surface .pcm-context-tag-list button,
  #pcm-root .pcm-context-menu-surface .pcm-context-delete{
    min-height:calc(38px * var(--pcm-context-scale))!important;
    height:auto!important;
    padding:calc(6px * var(--pcm-context-scale)) calc(10px * var(--pcm-context-scale))!important;
    gap:calc(6px * var(--pcm-context-scale))!important;
    font-size:calc(12px * var(--pcm-context-scale))!important;
    line-height:1.15!important;
  }
  #pcm-root .pcm-context-menu-surface .pcm-context-actions,
  #pcm-root .pcm-context-menu-surface .pcm-context-chip-grid{
    gap:calc(6px * var(--pcm-context-scale))!important;
  }
  #pcm-root .pcm-context-menu-surface section{
    margin-top:calc(8px * var(--pcm-context-scale))!important;
    padding-top:calc(7px * var(--pcm-context-scale))!important;
  }
  #pcm-root .pcm-context-menu-surface>header>button[aria-label="Закрыть"]{
    width:calc(34px * var(--pcm-context-scale))!important;
    min-width:calc(34px * var(--pcm-context-scale))!important;
    height:calc(34px * var(--pcm-context-scale))!important;
    min-height:calc(34px * var(--pcm-context-scale))!important;
    padding:0!important;
    font-size:calc(17px * var(--pcm-context-scale))!important;
  }
  #pcm-root .pcm-context-tag-editor{
    grid-template-columns:minmax(0,1fr) auto calc(34px * var(--pcm-context-scale))!important;
    gap:calc(6px * var(--pcm-context-scale))!important;
  }
  #pcm-root .pcm-context-tag-editor input{
    min-height:calc(36px * var(--pcm-context-scale))!important;
    font-size:calc(12px * var(--pcm-context-scale))!important;
  }

  /* Window-based responsive behavior. This reacts to the macro window, not just monitor width. */
  #pcm-root .pcm-window.is-compact .pcm-top-actions>button span{
    display:none!important;
  }
  #pcm-root .pcm-window.is-compact .pcm-top-actions>button{
    width:var(--pcm-top-control-h)!important;
    min-width:var(--pcm-top-control-h)!important;
    max-width:var(--pcm-top-control-h)!important;
    padding:0!important;
  }
  #pcm-root .pcm-window.is-compact .pcm-brand{
    flex:1 1 250px!important;
    min-width:145px!important;
  }
  #pcm-root .pcm-window.is-compact main{
    padding:calc(11px * var(--pcm-ui-scale))!important;
  }

  #pcm-root .pcm-window.is-narrow .pcm-brand{
    min-width:110px!important;
    flex:1 1 160px!important;
  }
  #pcm-root .pcm-window.is-narrow .pcm-brand img,
  #pcm-root .pcm-window.is-narrow .pcm-brand small{
    display:none!important;
  }
  #pcm-root .pcm-window.is-narrow [data-save-badge]{
    display:none!important;
  }
  #pcm-root .pcm-window.is-narrow .pcm-top-actions{
    gap:calc(3px * var(--pcm-ui-scale))!important;
  }
  #pcm-root .pcm-window.is-narrow .pcm-section-head,
  #pcm-root .pcm-window.is-narrow .pcm-capture{
    align-items:stretch!important;
    flex-direction:column!important;
  }

  #pcm-root .pcm-window.is-tiny .pcm-top{
    flex-wrap:wrap!important;
    align-content:center!important;
  }
  #pcm-root .pcm-window.is-tiny .pcm-brand{
    flex:1 1 calc(100% - (var(--pcm-top-control-h) * 2.4))!important;
    min-width:0!important;
  }
  #pcm-root .pcm-window.is-tiny .pcm-top-actions{
    flex:1 1 100%!important;
    width:100%!important;
    justify-content:flex-end!important;
    overflow:visible!important;
  }
  #pcm-root .pcm-window.is-tiny .pcm-layout{
    height:calc(100% - (104px * var(--pcm-ui-scale)))!important;
  }

  #pcm-root .pcm-window.is-short main{
    padding-top:calc(9px * var(--pcm-ui-scale))!important;
    padding-bottom:calc(9px * var(--pcm-ui-scale))!important;
  }

  @media(max-width:720px){
    #pcm-root .pcm-context-menu-surface{
      width:min(calc(350px * var(--pcm-context-scale)),calc(100vw - 12px))!important;
      max-height:calc(100vh - 12px)!important;
    }
  }


  /* v7.3.4 — НЕЙРО-СВЯЗЬ + GM workspace */
  #pcm-root .pcm-gm-caption{color:#55e6e2!important;text-shadow:0 0 10px #55e6e255}
  #pcm-root .pcm-neuro-panel{margin:12px 0 14px;padding:14px;background:linear-gradient(155deg,color-mix(in srgb,var(--bg) 92%,#001c22),color-mix(in srgb,var(--panel) 92%,#00191f));border:1px solid color-mix(in srgb,var(--teal) 70%,var(--line));border-radius:10px;box-shadow:inset 0 0 0 1px #0007,0 0 18px #00d4d415}
  #pcm-root .pcm-neuro-panel>header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;padding-bottom:9px;border-bottom:1px solid color-mix(in srgb,var(--teal) 38%,var(--line))}
  #pcm-root .pcm-neuro-panel>header small,#pcm-root .pcm-neuro-console-head small{display:block;color:var(--teal);font:900 9px/1.2 ui-monospace,"Cascadia Mono",Consolas,monospace;letter-spacing:.1em}
  #pcm-root .pcm-neuro-panel>header h3{margin:3px 0;color:var(--heading);font-size:16px;letter-spacing:.03em}
  #pcm-root .pcm-neuro-panel>header p{margin:0;color:var(--muted);font-size:10px;line-height:1.4}
  #pcm-root .pcm-neuro-status{flex:0 0 auto;padding:5px 8px;border:1px solid currentColor;border-radius:999px;font:800 8px/1 ui-monospace,monospace;letter-spacing:.08em}
  #pcm-root .pcm-neuro-status.online{color:#5ce1bf;background:#0a2d254f}#pcm-root .pcm-neuro-status.offline{color:#e77b75;background:#3d11114f}
  #pcm-root .pcm-neuro-history{max-height:300px;padding:8px;display:flex;flex-direction:column;gap:7px;overflow:auto;background:#02060999;border:1px solid #ffffff10;border-radius:7px;scrollbar-width:thin}
  #pcm-root .pcm-neuro-message{width:min(86%,760px);padding:8px 10px;border:1px solid #ffffff14;border-radius:8px;background:#111820e8;box-shadow:0 3px 9px #0005}
  #pcm-root .pcm-neuro-message.mine{align-self:flex-end;border-color:color-mix(in srgb,var(--teal) 62%,#ffffff10);background:linear-gradient(145deg,#0b2428db,#111a21e8)}
  #pcm-root .pcm-neuro-message.incoming{align-self:flex-start;border-color:color-mix(in srgb,var(--gold) 45%,#ffffff10)}
  #pcm-root .pcm-neuro-message>header{display:flex;justify-content:space-between;gap:10px;margin:0 0 4px!important;padding:0!important;border:0!important}
  #pcm-root .pcm-neuro-message>header b{color:var(--heading);font-size:11px}#pcm-root .pcm-neuro-message>header time{color:var(--muted);font:700 8px/1.2 ui-monospace,monospace}
  #pcm-root .pcm-neuro-message p{margin:0;color:var(--ink);font-size:12px;line-height:1.45;overflow-wrap:anywhere}
  #pcm-root .pcm-neuro-empty{padding:18px;display:grid;place-items:center;min-height:72px;color:var(--muted);text-align:center;background:#02060978;border:1px dashed color-mix(in srgb,var(--teal) 32%,var(--line));border-radius:7px}
  #pcm-root .pcm-neuro-compose{margin-top:9px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}
  #pcm-root .pcm-neuro-compose textarea{min-height:72px;padding:9px;color:var(--ink);background:#04080ca8;border:1px solid color-mix(in srgb,var(--teal) 45%,var(--line));border-radius:7px;resize:vertical;outline:0}
  #pcm-root .pcm-neuro-compose textarea:focus{border-color:var(--teal);box-shadow:0 0 0 1px var(--teal),0 0 16px #00d4d41e}
  #pcm-root .pcm-neuro-send{min-width:138px!important;padding:8px 13px!important;color:#fff!important;background:linear-gradient(145deg,#d72e3f,#aa1d2b)!important;border-color:#f04a58!important;font-weight:900!important;letter-spacing:.02em}
  #pcm-root .pcm-neuro-send:hover{filter:brightness(1.12)}
  #pcm-root .pcm-neuro-admin{min-height:0}#pcm-root .pcm-neuro-admin>p{margin:0;color:var(--muted)}

  #pcm-root .pcm-gm-neuro{min-width:0}
  #pcm-root .pcm-gm-neuro-grid{display:grid;grid-template-columns:minmax(230px,30%) minmax(0,1fr);gap:10px;min-height:540px}
  #pcm-root .pcm-gm-neuro .pcm-neuro-threads{position:static!important;width:auto!important;height:auto!important;min-width:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:6px!important;overflow:auto!important;background:linear-gradient(180deg,#071217db,#091116cc)!important;border:1px solid color-mix(in srgb,var(--teal) 42%,var(--line))!important;border-radius:9px!important;box-shadow:none!important}
  #pcm-root .pcm-gm-neuro .pcm-neuro-threads>header{position:sticky;top:0;z-index:2;padding:9px 10px;display:flex;justify-content:space-between;align-items:center;background:#071217f2;border-bottom:1px solid color-mix(in srgb,var(--teal) 35%,var(--line))}
  #pcm-root .pcm-gm-neuro .pcm-neuro-threads>header b{color:var(--teal);font:900 9px ui-monospace,monospace;letter-spacing:.09em}#pcm-root .pcm-gm-neuro .pcm-neuro-threads>header span{color:var(--heading);font-weight:900}
  #pcm-root .pcm-neuro-thread-row{width:calc(100% - 10px)!important;margin:0 5px!important;min-height:72px!important;padding:7px!important;display:grid!important;grid-template-columns:48px minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;text-align:left!important;background:#0c151a!important;border:1px solid #ffffff10!important;border-radius:7px!important}
  #pcm-root .pcm-neuro-thread-row:hover,#pcm-root .pcm-neuro-thread-row.active{border-color:var(--teal)!important;background:linear-gradient(145deg,#0e2528,#10171c)!important}
  #pcm-root .pcm-neuro-thread-avatar{width:48px;height:48px;display:grid;place-items:center;overflow:hidden;border:1px solid color-mix(in srgb,var(--teal) 45%,var(--line));border-radius:7px;color:var(--teal);font-size:20px}.pcm-neuro-thread-avatar img{width:100%;height:100%;object-fit:cover}
  #pcm-root .pcm-neuro-thread-row>span:nth-child(2){min-width:0;display:flex;flex-direction:column;gap:2px}#pcm-root .pcm-neuro-thread-row b{overflow:hidden;text-overflow:ellipsis;color:var(--heading);white-space:nowrap}#pcm-root .pcm-neuro-thread-row small{overflow:hidden;text-overflow:ellipsis;color:var(--teal);white-space:nowrap}#pcm-root .pcm-neuro-thread-row em{overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-size:9px;font-style:normal;white-space:nowrap}
  #pcm-root .pcm-neuro-thread-row>i{min-width:24px;height:24px;display:grid;place-items:center;color:#fff;background:#c72b3c;border-radius:999px;font-size:10px;font-style:normal;font-weight:900}#pcm-root .pcm-neuro-thread-row>time{color:var(--muted);font-size:7px;white-space:nowrap}
  #pcm-root .pcm-neuro-console{min-width:0;padding:11px;display:flex;flex-direction:column;background:linear-gradient(155deg,#081116d9,#0b1419e6);border:1px solid color-mix(in srgb,var(--teal) 46%,var(--line));border-radius:9px}
  #pcm-root .pcm-neuro-routing{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:9px}
  #pcm-root .pcm-neuro-routing label{display:grid;gap:4px;min-width:0}#pcm-root .pcm-neuro-routing label>span{color:var(--muted);font:900 8px ui-monospace,monospace;letter-spacing:.08em}
  #pcm-root .pcm-neuro-routing select{width:100%;height:34px;padding:0 7px;color:var(--ink);background:#03070ba8;border:1px solid color-mix(in srgb,var(--teal) 36%,var(--line));border-radius:6px}
  #pcm-root .pcm-neuro-console-head{margin-bottom:9px;padding:9px;display:grid;grid-template-columns:60px minmax(0,1fr) auto;gap:10px;align-items:center;background:#040a0da8;border:1px solid #ffffff10;border-radius:7px}
  #pcm-root .pcm-neuro-big-avatar{width:60px;height:60px;display:grid;place-items:center;overflow:hidden;color:var(--teal);border:1px solid var(--teal);border-radius:7px;font-size:24px}.pcm-neuro-big-avatar img{width:100%;height:100%;object-fit:cover}
  #pcm-root .pcm-neuro-console-head h2{margin:2px 0;color:var(--heading);font-size:19px}#pcm-root .pcm-neuro-console-head p{margin:0;color:var(--muted);font-size:10px}#pcm-root .pcm-neuro-console-head>i{padding:4px 6px;color:#6fe2c1;border:1px solid #6fe2c1;border-radius:999px;font:800 8px ui-monospace,monospace;font-style:normal}
  #pcm-root .pcm-neuro-console>.pcm-neuro-history{flex:1;max-height:none;min-height:260px}
  #pcm-root .pcm-neuro-compose.gm{margin-top:9px}.pcm-neuro-no-target{flex:1}.pcm-neuro-no-target b{color:var(--heading);font-size:15px}.pcm-neuro-no-target p{max-width:520px;margin:6px auto 0}
  @media(max-width:950px){#pcm-root .pcm-gm-neuro-grid{grid-template-columns:1fr}#pcm-root .pcm-gm-neuro .pcm-neuro-threads{max-height:240px!important}#pcm-root .pcm-neuro-routing{grid-template-columns:1fr 1fr}}
  @media(max-width:650px){#pcm-root .pcm-neuro-compose{grid-template-columns:1fr}#pcm-root .pcm-neuro-send{width:100%!important}#pcm-root .pcm-neuro-routing{grid-template-columns:1fr}#pcm-root .pcm-neuro-console-head{grid-template-columns:48px minmax(0,1fr)}#pcm-root .pcm-neuro-console-head>i{grid-column:1/-1;justify-self:start}#pcm-root .pcm-neuro-big-avatar{width:48px;height:48px}}

${EMBEDDED_HOST_CSS}
</style><div class="pcm-window" role="dialog" aria-label="Night City: полевой архив"></div>`;
  state.root = root;
  const stopArchiveTextObserver = observeArchiveTextScale(root, () => ({
    fontSize: bookAppearance().fontSize,
    baseFontSize: DEFAULT_APPEARANCE.fontSize,
  }));
  state.windowPrefs = loadWindowPrefs();
  state.windowPrefs.minimized = false;

  root.addEventListener("input", event => {
    const target = event.target;
    if ( target.matches("[data-theme-field]") ) {
      const theme = bookAppearance();
      const field = target.dataset.themeField;
      if ( field === "fontSize" ) theme.fontSize = Math.min(20, Math.max(13, Number(target.value) || 15));
      else if ( field === "opacity" ) theme.opacity = Math.min(1, Math.max(0.9, Number(target.value) / 100));
      else if ( field === "density" ) theme.density = target.value;
      else if ( field === "shell" ) theme.shell = ["datapad", "flat"].includes(target.value) ? target.value : "datapad";
      else if ( field === "effects" ) theme.effects = ["off", "soft", "vivid"].includes(target.value) ? target.value : "soft";
      else if ( ["background", "panel", "text", "muted", "accent", "secondary"].includes(field) ) { theme[field] = safeColor(target.value, theme[field]); theme.preset = "custom"; }
      const fontOutput = root.querySelector("[data-font-size-output]"); if ( fontOutput ) fontOutput.textContent = `${theme.fontSize}px`;
      const opacityOutput = root.querySelector("[data-opacity-output]"); if ( opacityOutput ) opacityOutput.textContent = `${Math.round(theme.opacity * 100)}%`;
      writeArchiveAppearance(notebook(), "neo", theme);
      applyAppearance(); dirty(); return;
    }
    if ( target.matches("[data-global-search]") ) {
      state.globalSearch = target.value.toLowerCase().trim();
      let visible = 0;
      for ( const row of root.querySelectorAll("[data-global-search-text]") ) {
        row.hidden = Boolean(state.globalSearch) && !row.dataset.globalSearchText.includes(state.globalSearch);
        if ( !row.hidden ) visible += 1;
      }
      const empty = root.querySelector("[data-global-search-empty]");
      if ( empty ) empty.hidden = visible > 0;
      return;
    }
    if ( target.matches("[data-quick]") ) { state.quick = target.value; autoGrowTextareas(); return; }
    if ( target.matches("[data-city-map-notes]") ) { notebook().cityMap.notes = target.value; dirty(); autoGrowTextareas(); return; }
    if ( target.matches("[data-neuro-player-text]") ) { state.neuroDrafts[target.dataset.threadId || ""] = target.value; autoGrowTextareas(); return; }
    if ( target.matches("[data-neuro-gm-text]") ) { state.neuroGmText = target.value; autoGrowTextareas(); return; }
    if ( target.matches("[data-chat-text]") ) { state.chatText = target.value; return; }
    if ( target.matches("[data-goal]") ) { notebook().goal = target.value; dirty(); return; }
    if ( target.matches("[data-contact-picker-search]") && state.contactPicker ) { state.contactPicker.query = target.value; const query = target.value.trim().toLowerCase(); for ( const row of root.querySelectorAll("[data-picker-search]") ) row.hidden = Boolean(query && !String(row.dataset.pickerSearch || "").includes(query)); return; }
    if ( target.matches("[data-contact-search]") ) { state.contactQuery = target.value; applyContactSearchDom(); return; }
    if ( target.matches("[data-quick-group-name]") && state.quickGroupCreate ) { state.quickGroupCreate.name = target.value; return; }
    const entry = findEntry(target);
    if ( !entry ) return;
    if ( target.matches("[data-decode-progress]") && entry.type === "books" ) {
      entry.decodingProgress = clampPercent(target.value);
      entry.updatedAt = now();
      refreshDecodePanel(target, entry);
      dirty();
      return;
    }
    const decodeStageBox = target.closest("[data-decode-stage-id]");
    if ( decodeStageBox && target.matches("[data-decode-stage-text]") && entry.type === "books" ) {
      const stage = entry.decodeStages.find(item => item.id === decodeStageBox.dataset.decodeStageId);
      if ( stage ) { stage.text = target.value; entry.updatedAt = now(); dirty(); }
      return;
    }
    if ( target.matches("[data-inline-person-tags]") && entry.type === "people" ) {
      entry.tags = target.value; entry.updatedAt = now(); dirty(); return;
    }
    if ( target.matches("[data-quick-person-field]") && entry.type === "people" ) {
      entry[target.dataset.quickPersonField] = target.value;
      entry.updatedAt = now(); dirty();
      if ( target.matches("textarea[data-autogrow]") ) autoGrowTextareas();
      return;
    }
    if ( target.matches("[data-field]") ) {
      const field = target.dataset.field;
      entry[field] = target.value;
      entry.updatedAt = now();
      dirty();
      if ( target.matches("textarea[data-autogrow]") ) autoGrowTextareas();
      return;
    }
    const galleryBox = target.closest("[data-gallery-id]");
    if ( galleryBox && target.matches("[data-gallery-caption]") ) {
      const item = entry.gallery.find(image => image.id === galleryBox.dataset.galleryId);
      if ( item ) { item.caption = target.value; entry.updatedAt = now(); dirty(); }
      return;
    }
    const fragmentBox = target.closest("[data-fragment-id]");
    if ( fragmentBox && target.matches("[data-fragment-field]") ) {
      const fragment = entry.fragments.find(item => item.id === fragmentBox.dataset.fragmentId);
      if ( fragment ) { fragment[target.dataset.fragmentField] = target.value; state.openFragmentId = fragment.id; entry.updatedAt = now(); dirty(); }
      return;
    }
    const taskBox = target.closest("[data-task-id]");
    if ( taskBox && target.matches("[data-task-text]") ) {
      const task = entry.tasks.find(item => item.id === taskBox.dataset.taskId);
      if ( task ) { task.text = target.value; entry.updatedAt = now(); dirty(); }
    }
  });

  root.addEventListener("focusout", event => {
    const target = event.target;
    if ( target.matches?.("[data-inline-person-field]") ) {
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => saveServer(false), 250);
      return;
    }
    if ( target.matches?.("[data-field=termDays], [data-field=remainingDays]") ) {
      const entry = findEntry(target);
      if ( entry?.type === "subscriptions" ) {
        if ( target.dataset.field === "termDays" ) entry.termDays = subscriptionTerm(entry);
        else entry.remainingDays = subscriptionDays(entry);
        if ( entry.remainingDays <= 0 && entry.status === "Активна" ) entry.status = "Истекла";
        entry.updatedAt = now(); dirty(); render();
      }
    }
  });

  root.addEventListener("change", async event => {
    const target = event.target;
    if ( target.matches("[data-contact-role-filter]") ) { state.contactRoleFilter = target.value || "all"; render(); return; }
    if ( target.matches("[data-contact-tag-filter]") ) { state.contactTagFilter = target.value || "all"; render(); return; }
    if ( target.matches("[data-contact-sort]") ) { state.contactSort = target.value || "attitude"; render(); return; }
    if ( target.matches("[data-quick-person-field]") ) {
      const entry = findEntry(target);
      if ( entry?.type === "people" ) { entry[target.dataset.quickPersonField] = target.value; entry.updatedAt = now(); dirty(); }
      return;
    }
    if ( target.matches("[data-contact-type-toggle]") ) {
      const entry = findEntry(target);
      const type = target.value;
      if ( entry?.type === "people" && CONTACT_TYPE_META[type] ) {
        if ( target.checked ) assignContactType(entry, type);
        else removeContactType(entry, type);
        target.closest("label")?.classList.toggle("active", target.checked);
      }
      return;
    }
    if ( target.matches("[data-actor]") ) {
      await saveServer(true);
      state.store.activeActorId = target.value;
      ensureNotebook(actorById(target.value));
      resetView("dashboard");
      dirty();
      render();
      return;
    }
    if ( target.matches("[data-theme-field=\"density\"], [data-theme-field=\"shell\"], [data-theme-field=\"effects\"]") ) { const theme = bookAppearance(); const field = target.dataset.themeField; if ( field === "density" ) theme.density = target.value; if ( field === "shell" ) theme.shell = ["datapad", "flat"].includes(target.value) ? target.value : "datapad"; if ( field === "effects" ) theme.effects = ["off", "soft", "vivid"].includes(target.value) ? target.value : "soft"; writeArchiveAppearance(notebook(), "neo", theme); applyAppearance(); dirty(); return; }
    if ( target.matches("[data-quick-type]") ) { state.quickType = target.value; return; }
    if ( target.matches("[data-neuro-gm-player]") ) { state.neuroGmPlayerId = target.value; state.neuroGmActorId = ""; state.neuroGmContactId = ""; state.neuroGmThreadId = ""; state.neuroGmText = ""; render(); return; }
    if ( target.matches("[data-neuro-gm-notebook]") ) { state.neuroGmActorId = target.value; state.neuroGmContactId = ""; state.neuroGmThreadId = ""; state.neuroGmText = ""; render(); return; }
    if ( target.matches("[data-neuro-gm-contact]") ) { state.neuroGmContactId = target.value; state.neuroGmThreadId = ""; state.neuroGmText = ""; render(); return; }
    if ( target.matches("[data-chat-target]") ) { state.chatPersonId = target.value; render(); return; }
    if ( target.matches("[data-chat-include-image]") ) { state.chatIncludeImage = Boolean(target.checked); render(); return; }
    if ( target.matches("[data-chat-include-summary]") ) { state.chatIncludeSummary = Boolean(target.checked); render(); return; }
    if ( target.matches("[data-import]") && target.files?.[0] ) return importData(target.files[0]);
    if ( target.matches("[data-location-link]") ) {
      const entry = findEntry(target);
      if ( !LOCATION_LINK_TYPES.has(entry?.type) ) return;
      const ids = new Set(entryLocationIds(entry));
      if ( target.checked ) ids.add(target.value);
      else ids.delete(target.value);
      setEntryLocations(entry, [...ids]);
      dirty();
      return;
    }
    const decodeStageBox = target.closest("[data-decode-stage-id]");
    if ( decodeStageBox && target.matches("[data-decode-stage-done]") ) {
      const entry = findEntry(target);
      const stage = entry?.decodeStages?.find(item => item.id === decodeStageBox.dataset.decodeStageId);
      if ( stage ) { stage.done = target.checked; decodeStageBox.classList.toggle("done", stage.done); entry.updatedAt = now(); dirty(); }
      return;
    }
    const taskBox = target.closest("[data-task-id]");
    if ( taskBox && target.matches("[data-task-done]") ) {
      const entry = findEntry(target);
      const task = entry?.tasks.find(item => item.id === taskBox.dataset.taskId);
      if ( task ) { task.done = target.checked; taskBox.classList.toggle("done", task.done); entry.updatedAt = now(); dirty(); }
    }
  });

  root.addEventListener("keydown", event => {
    if ( (event.ctrlKey || event.metaKey) && event.key === "Enter" && event.target.matches?.("[data-neuro-player-text], [data-neuro-gm-text]") ) {
      event.preventDefault();
      if ( event.target.matches("[data-neuro-gm-text]") ) sendNeuroGm();
      else { const person = findEntry(event.target); if ( person?.type === "people" ) sendNeuroPlayer(person); }
      return;
    }
    const contextTagInput = event.target.closest?.("[data-context-tag-input], [data-entry-context-tag-input]");
    if ( contextTagInput && event.key === "Enter" ) {
      event.preventDefault();
      const action = contextTagInput.matches("[data-context-tag-input]") ? "context-commit-tag" : "context-entry-commit-tag";
      contextTagInput.closest(".pcm-context-tag-editor")?.querySelector(`[data-action="${action}"]`)?.click();
      return;
    }
    const input = event.target.closest?.("[data-inline-membership-input]");
    if ( !input || event.key !== "Enter" ) return;
    event.preventDefault();
    const entry = findEntry(input);
    const type = input.dataset.inlineMembershipInput || "";
    const group = String(input.value || "").trim();
    if ( entry?.type !== "people" || !CONTACT_TYPE_META[type] || !group ) return;
    assignContactType(entry, type, group);
    render();
  });

  root.addEventListener("click", async event => {
    if ( state.contactContext && !event.target.closest?.(".pcm-contact-context-menu") ) closeContactContextMenu();
    if ( state.entryContext && !event.target.closest?.(".pcm-entry-context-menu") ) closeEntryContextMenu();
    if ( event.target.matches?.(".pcm-modal-backdrop") ) { state.settingsOpen = false; state.helpOpen = false; state.toolsOpen = false; state.chatOpen = false; state.globalSearchOpen = false; render(); return; }
    const button = event.target.closest("[data-action]");
    if ( !button ) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    const entry = findEntry(button);
    const contextPerson = contactContextPerson();
    if ( action === "context-close" ) { closeContactContextMenu(); return; }
    if ( action === "context-entry-close" ) { closeEntryContextMenu(); return; }

    if ( action === "context-entry-open" && entry && entry.type !== "people" ) { openExistingEntry(entry); refreshEntryContextMenu(); return; }
    if ( action === "context-entry-edit" && entry && entry.type !== "people" ) { openEntryEditor(entry); refreshEntryContextMenu(); return; }
    if ( action === "context-entry-toggle-pin" && entry && entry.type !== "people" ) { entry.pinned = !entry.pinned; entry.updatedAt = now(); dirty(); refreshEntryContextMenu(); return; }
    if ( action === "context-entry-add-tag" && entry && entry.type !== "people" ) { state.entryContext.tagEditor = true; mountEntryContextMenu(); focusContextTagInput("[data-entry-context-tag-input]"); return; }
    if ( action === "context-entry-cancel-tag" ) { if ( state.entryContext ) state.entryContext.tagEditor = false; mountEntryContextMenu(); return; }
    if ( action === "context-entry-commit-tag" && entry && entry.type !== "people" ) {
      const input = button.closest(".pcm-context-tag-editor")?.querySelector("[data-entry-context-tag-input]");
      const value = String(input?.value || "").trim();
      if ( !value ) { input?.focus?.(); return; }
      const tags = String(entry.tags || "").split(",").map(tag => tag.trim()).filter(Boolean);
      if ( !tags.some(tag => normalizeName(tag) === normalizeName(value)) ) tags.push(value);
      entry.tags = tags.join(", "); entry.updatedAt = now(); dirty();
      if ( state.entryContext ) state.entryContext.tagEditor = true;
      refreshEntryContextMenu({ focusTag: true });
      return;
    }
    if ( action === "context-entry-remove-tag" && entry && entry.type !== "people" ) { const value=button.dataset.tag || ""; entry.tags=String(entry.tags||"").split(",").map(tag=>tag.trim()).filter(Boolean).filter(tag=>normalizeName(tag)!==normalizeName(value)).join(", "); entry.updatedAt=now(); dirty(); refreshEntryContextMenu(); return; }
    if ( action === "context-entry-set-status" && entry && entry.type !== "people" ) { entry.status=button.dataset.status || entry.status; entry.updatedAt=now(); dirty(); refreshEntryContextMenu(); return; }
    if ( action === "context-entry-day-minus" && entry?.type === "subscriptions" ) { entry.remainingDays=Math.max(0,subscriptionDays(entry)-1); if ( entry.remainingDays<=0 ) entry.status="Истекла"; entry.updatedAt=now(); dirty(); refreshEntryContextMenu(); return; }
    if ( action === "context-entry-renew" && entry?.type === "subscriptions" ) { entry.remainingDays=subscriptionDays(entry)+subscriptionTerm(entry); entry.status="Активна"; entry.updatedAt=now(); dirty(); refreshEntryContextMenu(); return; }
    if ( action === "context-entry-decode" && entry?.type === "books" ) { entry.decodingProgress=clampPercent(clampPercent(entry.decodingProgress)+Number(button.dataset.delta||0)); entry.updatedAt=now(); dirty(); refreshEntryContextMenu(); return; }
    if ( action === "context-entry-add-contact" && entry && DIRECTORY_TYPES.has(entry.type) ) { const type=sectionContactType(entry.type); if ( type ) { const ctx={...state.entryContext}; openContactPicker({ type, group:entry.title, directoryType:entry.type, directoryId:entry.id }); state.entryContext=ctx; mountEntryContextMenu(); } return; }
    if ( action === "context-entry-delete" && entry && entry.type !== "people" ) { if ( confirm(`Удалить «${recordTitle(entry)}»?`) ) { removeEntry(entry); if ( state.viewId===entry.id || state.openId===entry.id ) resetView(entry.type); dirty(); closeEntryContextMenu(); render(); } return; }

    if ( action === "context-open-person" && contextPerson ) {
      const context = state.contactContext ? { ...state.contactContext } : null;
      openExistingEntry(contextPerson);
      refreshContactContextMenu({ context });
      return;
    }
    if ( action === "context-quick-edit" && contextPerson ) {
      const context = state.contactContext ? { ...state.contactContext } : null;
      openExistingEntry(contextPerson);
      state.quickEditPersonId = contextPerson.id;
      state.inlineLocks[inlineLockKey(contextPerson,"tags")] = true;
      refreshContactContextMenu({ context });
      return;
    }
    if ( action === "context-set-attitude" && contextPerson ) { contextPerson.attitude = button.dataset.attitude || "Неизвестно"; contextPerson.updatedAt = now(); dirty(); refreshContactContextMenu(); return; }
    if ( action === "context-add-role" && contextPerson ) { const type = button.dataset.contactType || ""; if ( CONTACT_TYPE_META[type] ) { if ( personContactTypes(contextPerson).includes(type) ) removeContactType(contextPerson, type); else assignContactType(contextPerson, type); } refreshContactContextMenu(); return; }
    if ( action === "context-add-tag" && contextPerson ) { state.contactContext.tagEditor = true; mountContactContextMenu(); focusContextTagInput("[data-context-tag-input]"); return; }
    if ( action === "context-cancel-tag" ) { if ( state.contactContext ) state.contactContext.tagEditor = false; mountContactContextMenu(); return; }
    if ( action === "context-commit-tag" && contextPerson ) {
      const input = button.closest(".pcm-context-tag-editor")?.querySelector("[data-context-tag-input]");
      const value = String(input?.value || "").trim();
      if ( !value ) { input?.focus?.(); return; }
      const tags = contactTagValues(contextPerson);
      if ( !tags.some(tag => normalizeName(tag) === normalizeName(value)) ) tags.push(value);
      contextPerson.tags = tags.join(", "); contextPerson.updatedAt = now(); dirty();
      if ( state.contactContext ) state.contactContext.tagEditor = true;
      refreshContactContextMenu({ focusTag: true });
      return;
    }
    if ( action === "context-remove-tag" && contextPerson ) { const value=button.dataset.tag || ""; contextPerson.tags=contactTagValues(contextPerson).filter(tag=>normalizeName(tag)!==normalizeName(value)).join(", "); contextPerson.updatedAt=now(); dirty(); refreshContactContextMenu(); return; }
    if ( action === "context-toggle-pin" && contextPerson ) { contextPerson.pinned=!contextPerson.pinned; contextPerson.updatedAt=now(); dirty(); refreshContactContextMenu(); return; }
    if ( action === "context-message" && contextPerson ) { state.chatPersonId=contextPerson.id; state.chatOpen=true; refreshContactContextMenu(); return; }
    if ( action === "context-unlink-directory" && contextPerson ) { const directory=entryById(button.dataset.directoryId); const type=sectionContactType(button.dataset.directoryType || directory?.type || ""); if ( directory && type && hasContactMembership(contextPerson,type,directory.title) && confirm(`Отвязать «${contextPerson.title}» от «${directory.title}»?`) ) { removeContactMembership(contextPerson,type,directory.title); refreshContactContextMenu(); } return; }
    if ( action === "context-delete-person" && contextPerson ) { if ( confirm(`Удалить контакт «${contextPerson.title}» целиком?`) ) { removeEntry(contextPerson); if ( state.viewId===contextPerson.id ) resetView("people"); dirty(); closeContactContextMenu(); render(); } return; }
    if ( action === "close" ) { await saveServer(true); await requestClose(); return; }
    if ( action === "toggle-minimize" ) { state.windowPrefs.minimized = !state.windowPrefs.minimized; saveWindowPrefs(); applyWindowGeometry(); return; }
    if ( action === "toggle-nav" ) { state.windowPrefs.navCollapsed = !state.windowPrefs.navCollapsed; saveWindowPrefs(); applyWindowGeometry(); return; }
    if ( action === "pick-city-map" ) { chooseImage(notebook().cityMap.image, path => { notebook().cityMap.image = path; state.mapZoom = 1; dirty(); render(); }); return; }
    if ( action === "clear-city-map" ) { if ( confirm("Убрать изображение карты Найт-Сити?") ) { notebook().cityMap.image = ""; state.mapZoom = 1; dirty(); render(); } return; }
    if ( action === "map-zoom-in" ) { state.mapZoom = Math.min(2.5, (Number(state.mapZoom) || 1) + 0.15); render(); return; }
    if ( action === "map-zoom-out" ) { state.mapZoom = Math.max(0.35, (Number(state.mapZoom) || 1) - 0.15); render(); return; }
    if ( action === "map-zoom-reset" ) { state.mapZoom = 1; render(); return; }
    if ( action === "tools" ) { state.toolsOpen = true; render(); return; }
    if ( action === "close-tools" ) { state.toolsOpen = false; render(); return; }
    if ( action === "open-chat" ) {
      state.chatOpen = true;
      state.toolsOpen = false;
      if ( state.viewMode === "person" && notebook().entries.people.some(person => person.id === state.viewId) ) state.chatPersonId = state.viewId;
      render(); return;
    }
    if ( action === "open-chat-contact" ) { state.chatPersonId = button.dataset.personId || ""; state.chatOpen = true; state.toolsOpen = false; render(); return; }
    if ( action === "close-chat" ) { state.chatOpen = false; render(); return; }
    if ( action === "send-chat-whisper" ) { await sendContactMessage("whisper"); return; }
    if ( action === "send-chat-gm" ) { await sendContactMessage("gm"); return; }
    if ( action === "send-chat-public" ) { await sendContactMessage("public"); return; }
    if ( action === "send-neuro-player" ) { const person = notebook().entries.people.find(item => item.id === (button.dataset.personId || entry?.id)); if ( person ) await sendNeuroPlayer(person); return; }
    if ( action === "send-neuro-gm" ) { await sendNeuroGm(); return; }
    if ( action === "open-neuro-thread" ) { openGmNeuroThread(button.dataset.threadId || ""); return; }
    if ( action === "neuro-gm-new" ) { state.neuroGmThreadId = ""; state.neuroGmText = ""; render(); return; }
    if ( action === "global-search" ) { state.globalSearchOpen = true; state.toolsOpen = false; render(); return; }
    if ( action === "close-global-search" ) { state.globalSearchOpen = false; render(); return; }
    if ( action === "help" ) { state.toolsOpen = false; state.helpOpen = true; render(); return; }
    if ( action === "close-help" ) { state.helpOpen = false; render(); return; }
    if ( action === "appearance" ) { state.toolsOpen = false; state.settingsOpen = true; render(); return; }
    if ( action === "close-appearance" ) { state.settingsOpen = false; render(); return; }
    if ( action === "theme-preset" && THEME_PRESETS[button.dataset.preset] ) {
      const current = bookAppearance();
      writeArchiveAppearance(notebook(), "neo", normalizeAppearance({ ...THEME_PRESETS[button.dataset.preset], preset: button.dataset.preset, fontSize: current.fontSize, opacity: THEME_PRESETS[button.dataset.preset].opacity, density: current.density, shell: current.shell, effects: current.effects }));
      dirty(); render(); return;
    }
    if ( action === "theme-reset" ) { writeArchiveAppearance(notebook(), "neo", normalizeAppearance()); dirty(); render(); return; }
    if ( action === "close-lightbox" ) { state.lightbox = null; render(); return; }
    if ( action === "nav" ) { const targetSection = button.dataset.section; if ( targetSection === "gm-neuro" && !game.user?.isGM ) return; resetView(targetSection); render(); return; }
    if ( action === "resolve-inbox" && entry ) { entry.inbox = false; entry.updatedAt = now(); dirty(); render(); return; }
    if ( action === "resolve-all-inbox" ) { for ( const item of inboxEntries(notebook()) ) { item.inbox = false; item.updatedAt = now(); } dirty(); render(); return; }
    if ( action === "open-inbox-entry" && entry ) { openExistingEntry(entry); render(); return; }
    if ( action === "remember-context" ) { selectedTokens().length ? await importFromTokens() : await importFromScene(); return; }
    if ( action === "from-token" ) { await importFromTokens(); return; }
    if ( action === "from-token-here" && entry?.type === "locations" ) { await importFromTokens({ locationId: entry.id }); return; }
    if ( action === "from-scene" ) { await importFromScene(); return; }
    if ( action === "to-journal" ) { state.toolsOpen = false; await exportSectionToJournal(state.section); render(); return; }
    if ( action === "filter-tag" ) {
      state.globalSearch = String(button.dataset.tag || "").toLowerCase();
      state.globalSearchOpen = true;
      render();
      return;
    }
    if ( action === "toggle-inline-lock" && entry?.type === "people" ) {
      const field = button.dataset.inlineLockField || "";
      const key = inlineLockKey(entry, field);
      state.inlineLocks[key] = !state.inlineLocks[key];
      render();
      if ( state.inlineLocks[key] ) requestAnimationFrame(() => {
        const selector = field === "tags" ? `[data-entry-id="${entry.id}"] [data-inline-person-tags]` : `[data-entry-id="${entry.id}"] [data-inline-person-field="${field}"]`;
        state.root?.querySelector(selector)?.focus?.();
      });
      return;
    }
    if ( action === "toggle-inline-category" && entry?.type === "people" ) {
      const type = button.dataset.contactType || "";
      if ( !CONTACT_TYPE_META[type] ) return;
      if ( personContactTypes(entry).includes(type) ) removeContactType(entry, type);
      else assignContactType(entry, type);
      render(); return;
    }
    if ( action === "add-inline-membership" && entry?.type === "people" ) {
      const type = button.dataset.contactType || "";
      if ( !CONTACT_TYPE_META[type] ) return;
      const box = button.closest("[data-membership-type]");
      const input = box?.querySelector(`[data-inline-membership-input="${type}"]`);
      const group = String(input?.value || "").trim();
      if ( !group ) return notify("Введите название группы / фракции.", "warn");
      assignContactType(entry, type, group);
      render(); return;
    }
    if ( action === "remove-inline-membership" && entry?.type === "people" ) {
      const type = button.dataset.contactType || "";
      const group = button.dataset.contactGroup || "";
      if ( !CONTACT_TYPE_META[type] || !group ) return;
      removeContactMembership(entry, type, group);
      render(); return;
    }
    if ( action === "remove-inline-tag" && entry?.type === "people" ) {
      const tag = button.dataset.tag || "";
      entry.tags = contactTagValues(entry).filter(value => normalizeName(value) !== normalizeName(tag)).join(", ");
      entry.updatedAt = now(); dirty(); render(); return;
    }
    if ( action === "bind-selected-tokens" ) {
      const type = button.dataset.contactType || sectionContactType(state.section);
      const group = button.dataset.contactGroup || "";
      if ( !CONTACT_TYPE_META[type] ) return notify("Не удалось определить категорию контакта.", "warn");
      await importFromTokens({ stay: true, contactType: type, contactGroup: group });
      return;
    }
    if ( action === "open-contact-picker" ) {
      openContactPicker({ type: button.dataset.contactType || sectionContactType(state.section), group: button.dataset.contactGroup || "", directoryType: button.dataset.directoryType || "", directoryId: button.dataset.directoryId || "" });
      return;
    }
    if ( action === "close-contact-picker" ) { state.contactPicker = null; render(); return; }
    if ( action === "picker-link-person" && state.contactPicker ) {
      const person = notebook().entries.people.find(item => item.id === button.dataset.personId);
      if ( !person ) return;
      const picker = state.contactPicker;
      if ( picker.group ) ensureContactGroup(notebook(), picker.type, picker.group);
      assignContactType(person, picker.type, picker.group || "");
      notify(`«${person.title}» добавлен: ${CONTACT_TYPE_META[picker.type]?.label}${picker.group ? ` → ${picker.group}` : ""}.`);
      render(); return;
    }
    if ( action === "picker-add-selected-tokens" && state.contactPicker ) {
      const picker = { ...state.contactPicker };
      await importFromTokens({ stay: true, contactType: picker.type, contactGroup: picker.group || "" });
      state.contactPicker = picker;
      render(); return;
    }
    if ( action === "quick-create-group" ) {
      const type = button.dataset.contactType || sectionContactType(button.dataset.section || state.section);
      state.quickGroupCreate = { type, section: button.dataset.section || CONTACT_TYPE_META[type]?.section || state.section, name: "" };
      render(); return;
    }
    if ( action === "adopt-contact-group" ) {
      const section = button.dataset.section || state.section;
      const group = String(button.dataset.contactGroup || "").trim();
      if ( !DIRECTORY_TYPES.has(section) || !group ) return;
      const existingGroup = directoryEntryForGroup(notebook(), section, group);
      if ( existingGroup ) { state.section = section; state.viewId = existingGroup.id; render(); return; }
      const entry = blankEntry(section);
      entry.title = group;
      entry.updatedAt = now();
      notebook().entries[section].push(entry);
      dirty();
      notify(`Создано досье «${group}». Все уже связанные контакты сохранены.`);
      render();
      return;
    }
    if ( action === "quick-create-directory" ) {
      const section = button.dataset.section || state.section;
      const type = sectionContactType(section);
      state.quickGroupCreate = { type, section, directory: true, name: "" };
      render(); return;
    }
    if ( action === "close-quick-group" ) { state.quickGroupCreate = null; render(); return; }
    if ( action === "create-quick-group" && state.quickGroupCreate ) {
      const create = { ...state.quickGroupCreate };
      const name = String(create.name || "").trim();
      if ( !name ) return notify("Введите название группы.", "warn");
      if ( create.directory ) {
        const existing = notebook().entries[create.section]?.find(item => normalizeName(item.title) === normalizeName(name));
        let directory = existing;
        if ( !directory ) {
          directory = blankEntry(create.section);
          directory.title = name;
          directory.summary = "";
          directory.content = "";
          notebook().entries[create.section].push(directory);
          dirty();
        }
        state.quickGroupCreate = null;
        if ( selectedTokens().length ) {
          await importFromTokens({ stay: true, contactType: create.type, contactGroup: directory.title });
          state.section = create.section; state.viewMode = "entry"; state.viewId = directory.id; render();
        } else openContactPicker({ type: create.type, group: directory.title, directoryType: create.section, directoryId: directory.id });
        return;
      }
      const group = ensureContactGroup(notebook(), create.type, name);
      dirty();
      state.quickGroupCreate = null;
      if ( selectedTokens().length ) { await importFromTokens({ stay: true, contactType: create.type, contactGroup: group }); state.section = create.section; render(); }
      else openContactPicker({ type: create.type, group });
      return;
    }
    if ( action === "add" ) { addEntry(button.dataset.section); return; }
    if ( action === "quick-save" || action === "quick" ) { const quickText = state.quick.trim(); if ( !quickText ) return notify("Сначала напишите быструю заметку.", "warn"); const quickType = action === "quick" ? button.dataset.target : state.quickType; state.quick = ""; addEntry(quickType, quickText, { inbox: true, stay: true }); notify("Быстрая запись сохранена и добавлена в «Разобрать»."); return; }
    if ( action === "open-search-result" ) {
      const targetEntry = entryById(button.dataset.entryId);
      if ( !targetEntry ) return;
      state.globalSearchOpen = false;
      openExistingEntry(targetEntry);
      render(); return;
    }
    if ( action === "open-entry" ) {
      const targetEntry = entryById(button.dataset.entryId);
      if ( !targetEntry ) return;
      openExistingEntry(targetEntry);
      render(); return;
    }
    if ( action === "export" ) { state.toolsOpen = false; exportData(); render(); return; }
    if ( action === "import" ) { state.toolsOpen = false; root.querySelector("[data-import]").click(); render(); return; }
    if ( action === "save" ) { state.toolsOpen = false; await saveServer(true); updateSaveBadge(state.storageMode === "server" ? "Сохранено" : "Локально", state.storageMode); render(); return; }
    if ( action === "back-list" ) { resetView(button.dataset.section || state.section); render(); return; }
    if ( action === "back-location" ) {
      resetView("locations"); state.viewMode = "location"; state.viewId = button.dataset.locationId; render(); return;
    }
    if ( action === "back-editor" ) { restoreView(state.previousView); render(); return; }
    if ( action === "view-location" ) {
      const id = button.dataset.locationId || (entry?.type === "locations" ? entry.id : null);
      if ( !id ) return;
      resetView("locations"); state.viewMode = "location"; state.viewId = id; render(); return;
    }
    if ( action === "view-person" ) {
      const id = button.dataset.personId || (entry?.type === "people" ? entry.id : null);
      if ( !id ) return;
      const locationId = button.dataset.locationId || (state.viewMode === "location" ? state.viewId : null);
      resetView(locationId ? "locations" : "people");
      state.viewMode = "person";
      state.viewId = id;
      state.returnLocationId = locationId;
      render(); return;
    }
    if ( action === "open-related" && entry ) { openExistingEntry(entry, { returnLocationId: state.viewMode === "location" ? state.viewId : null }); render(); return; }
    if ( action === "edit-entry" && entry?.type === "people" ) {
      const enabling = state.quickEditPersonId !== entry.id;
      state.quickEditPersonId = enabling ? entry.id : null;
      state.inlineLocks[inlineLockKey(entry, "tags")] = enabling;
      render(); return;
    }
    if ( action === "edit-entry" && entry && entry.type !== "people" ) {
      openEntryEditor(entry);
      render(); return;
    }
    if ( action === "add-person-here" && entry?.type === "locations" ) {
      addEntry("people", "", { edit: true, locationId: entry.id, previousView: viewSnapshot() });
      return;
    }
    if ( action === "add-related-here" && entry?.type === "locations" && LOCATION_LINK_TYPES.has(button.dataset.type) ) {
      addEntry(button.dataset.type, "", { edit: true, locationId: entry.id, previousView: viewSnapshot() });
      return;
    }
    if ( action === "link-person" && entry?.type === "locations" ) {
      const person = notebook().entries.people.find(item => item.id === button.dataset.personId);
      if ( !person ) return;
      setPersonLocations(person, [...personLocationIds(person), entry.id]);
      dirty(); render(); return;
    }
    if ( action === "link-contact-directory" ) {
      const person = notebook().entries.people.find(item => item.id === button.dataset.personId);
      const directory = entryById(button.dataset.directoryId);
      const type = sectionContactType(button.dataset.directoryType || directory?.type || "");
      if ( !person || !type ) return;
      assignContactType(person, type, directory?.title || "");
      render(); return;
    }
    if ( action === "unlink-contact-directory" ) {
      const person = notebook().entries.people.find(item => item.id === button.dataset.personId);
      const directory = entryById(button.dataset.directoryId);
      const type = sectionContactType(button.dataset.directoryType || directory?.type || "");
      if ( !person || !directory || !type ) return;
      if ( !hasContactMembership(person, type, directory.title) ) return notify("Эта связь уже отсутствует.", "warn");
      if ( !confirm(`Отвязать «${person.title}» от «${directory.title}»? Сам контакт и остальные принадлежности сохранятся.`) ) return;
      removeContactMembership(person, type, directory.title);
      notify(`«${person.title}» больше не привязан к «${directory.title}».`);
      render(); return;
    }
    if ( action === "subscription-day-minus" && entry?.type === "subscriptions" ) {
      entry.remainingDays = Math.max(0, subscriptionDays(entry) - 1);
      if ( entry.remainingDays <= 0 ) entry.status = "Истекла";
      entry.updatedAt = now(); dirty(); render(); return;
    }
    if ( action === "subscription-renew" && entry?.type === "subscriptions" ) {
      entry.remainingDays = subscriptionDays(entry) + subscriptionTerm(entry);
      entry.status = "Активна";
      entry.updatedAt = now(); dirty(); render(); return;
    }
    if ( action === "adjust-decode" && entry?.type === "books" ) {
      entry.decodingProgress = clampPercent(entry.decodingProgress + Number(button.dataset.delta || 0));
      entry.updatedAt = now();
      state.openId = entry.id;
      dirty(); render(); return;
    }
    if ( action === "set-decode" && entry?.type === "books" ) {
      entry.decodingProgress = clampPercent(button.dataset.value);
      entry.updatedAt = now();
      state.openId = entry.id;
      dirty(); render(); return;
    }
    if ( action === "add-decode-stage" && entry?.type === "books" ) {
      entry.decodeStages.push({ id: uid(), text: "", done: false });
      entry.updatedAt = now();
      state.openId = entry.id;
      dirty(); render(); return;
    }
    if ( action === "delete-decode-stage" && entry?.type === "books" ) {
      const stageId = button.closest("[data-decode-stage-id]")?.dataset.decodeStageId;
      entry.decodeStages = entry.decodeStages.filter(stage => stage.id !== stageId);
      entry.updatedAt = now();
      state.openId = entry.id;
      dirty(); render(); return;
    }
    if ( action === "unlink-person" && entry?.type === "people" ) {
      setPersonLocations(entry, personLocationIds(entry).filter(id => id !== button.dataset.locationId));
      dirty(); render(); return;
    }
    if ( !entry ) return;
    const galleryBox = button.closest("[data-gallery-id]");
    const galleryItem = entry.gallery.find(item => item.id === galleryBox?.dataset.galleryId);
    if ( action === "view-gallery-image" && galleryItem ) { state.lightbox = { entryId: entry.id, galleryId: galleryItem.id }; render(); return; }
    if ( action === "add-gallery-image" && entry.type === "people" ) {
      chooseImage("", path => {
        entry.gallery.push({ id: uid(), image: path, caption: "" });
        if ( !entry.image ) entry.image = path;
        entry.updatedAt = now(); dirty(); render();
      });
      return;
    }
    if ( action === "pick-gallery-image" && galleryItem ) {
      chooseImage(galleryItem.image, path => {
        const wasCover = entry.image === galleryItem.image;
        galleryItem.image = path;
        if ( wasCover ) entry.image = path;
        entry.updatedAt = now(); dirty(); render();
      });
      return;
    }
    if ( action === "set-gallery-cover" && galleryItem ) { entry.image = galleryItem.image; entry.updatedAt = now(); dirty(); render(); return; }
    if ( action === "delete-gallery-image" && galleryItem ) {
      if ( confirm("Удалить это изображение из галереи?") ) {
        const wasCover = entry.image === galleryItem.image;
        entry.gallery = entry.gallery.filter(item => item.id !== galleryItem.id);
        if ( wasCover ) entry.image = entry.gallery[0]?.image ?? "";
        entry.updatedAt = now(); dirty(); render();
      }
      return;
    }
    if ( action === "pin" ) { entry.pinned = !entry.pinned; entry.updatedAt = now(); state.openId = entry.id; dirty(); render(); return; }
    if ( action === "delete" ) {
      if ( confirm(`Удалить «${entry.title}»?`) ) {
        removeEntry(entry);
        if ( state.viewMode === "edit" ) restoreView(state.previousView);
        else resetView(state.section);
        dirty(); render();
      }
      return;
    }
    if ( action === "pick-image" ) { chooseImage(entry.image, path => { entry.image = path; entry.updatedAt = now(); state.openId = entry.id; dirty(); render(); }); return; }
    if ( action === "add-fragment" ) { const fragment = { id: uid(), title: `Новый фрагмент ${entry.fragments.length + 1}`, image: "", content: "" }; entry.fragments.push(fragment); state.openFragmentId = fragment.id; entry.updatedAt = now(); state.openId = entry.id; dirty(); render(); return; }
    const fragmentBox = button.closest("[data-fragment-id]");
    const fragment = entry.fragments.find(item => item.id === fragmentBox?.dataset.fragmentId);
    if ( action === "delete-fragment" && fragment ) { if ( confirm(`Удалить фрагмент «${fragment.title}»?`) ) { entry.fragments = entry.fragments.filter(item => item.id !== fragment.id); if ( state.openFragmentId === fragment.id ) state.openFragmentId = null; state.openId = entry.id; dirty(); render(); } return; }
    if ( action === "pick-fragment-image" && fragment ) { chooseImage(fragment.image, path => { fragment.image = path; state.openFragmentId = fragment.id; entry.updatedAt = now(); state.openId = entry.id; dirty(); render(); }); return; }
    if ( action === "add-task" ) { entry.tasks.push({ id: uid(), text: "", done: false }); entry.updatedAt = now(); state.openId = entry.id; dirty(); render(); return; }
    if ( action === "delete-task" ) { const id = button.closest("[data-task-id]")?.dataset.taskId; entry.tasks = entry.tasks.filter(item => item.id !== id); entry.updatedAt = now(); state.openId = entry.id; dirty(); render(); }
  });

  root.addEventListener("contextmenu", event => {
    const contactCard = event.target.closest?.(".pcm-contact-card, .pcm-person-tile");
    if ( contactCard ) {
      const person = notebook().entries.people.find(item => item.id === contactCard.dataset.entryId);
      if ( !person ) return;
      event.preventDefault();
      event.stopPropagation();
      closeEntryContextMenu();
      state.contactContext = {
        personId: person.id,
        directoryId: contactCard.dataset.contextDirectoryId || "",
        directoryType: contactCard.dataset.contextDirectoryType || "",
        x: event.clientX,
        y: event.clientY
      };
      mountContactContextMenu();
      return;
    }

    const card = event.target.closest?.(".pcm-view-card, .pcm-location-card, .pcm-subscription-card, .pcm-inbox-row, .pcm-faction-group[data-entry-id]");
    if ( !card ) return;
    const entry = findEntry(card);
    if ( !entry || entry.type === "people" ) return;
    event.preventDefault();
    event.stopPropagation();
    closeContactContextMenu();
    state.entryContext = { entryId: entry.id, x: event.clientX, y: event.clientY };
    mountEntryContextMenu();
  });

  let draggedContactId = "";
  const clearContactDropState = () => {
    for ( const node of root.querySelectorAll(".pcm-drag-over") ) node.classList.remove("pcm-drag-over");
  };
  const clearContactDragState = () => {
    clearContactDropState();
    for ( const node of root.querySelectorAll(".pcm-dragging") ) node.classList.remove("pcm-dragging");
  };
  root.addEventListener("dragstart", event => {
    const card = event.target.closest?.("[data-contact-drag-id]");
    if ( !card ) return;
    draggedContactId = card.dataset.contactDragId || "";
    card.classList.add("pcm-dragging");
    try { event.dataTransfer.setData("text/plain", draggedContactId); event.dataTransfer.effectAllowed = "move"; } catch (_error) {}
  });
  root.addEventListener("dragend", () => { draggedContactId = ""; clearContactDragState(); });
  root.addEventListener("dragover", event => {
    const zone = event.target.closest?.("[data-contact-drop]");
    if ( !zone || !draggedContactId ) return;
    event.preventDefault();
    clearContactDropState();
    zone.classList.add("pcm-drag-over");
    try { event.dataTransfer.dropEffect = "move"; } catch (_error) {}
  });
  root.addEventListener("dragleave", event => {
    const zone = event.target.closest?.("[data-contact-drop]");
    if ( zone && !zone.contains(event.relatedTarget) ) zone.classList.remove("pcm-drag-over");
  });
  root.addEventListener("drop", event => {
    const zone = event.target.closest?.("[data-contact-drop]");
    if ( !zone ) return;
    event.preventDefault();
    const id = draggedContactId || (() => { try { return event.dataTransfer.getData("text/plain"); } catch (_error) { return ""; } })();
    const person = notebook().entries.people.find(item => item.id === id);
    if ( !person ) { draggedContactId = ""; clearContactDragState(); return; }
    if ( zone.dataset.contactDrop === "uncategorized" || (zone.dataset.contactDrop === "category" && !zone.dataset.contactType) ) {
      notify("Категории не снимаются перетаскиванием, чтобы случайно не потерять связи. Уберите нужные категории в досье контакта → Редактировать.", "warn");
    } else if ( zone.dataset.contactDrop === "category" ) {
      const type = zone.dataset.contactType || "";
      assignContactType(person, type);
      notify(`«${person.title}» → ${CONTACT_TYPE_META[type]?.label || "Контакты"}.`);
    } else if ( zone.dataset.contactDrop === "directory" ) {
      const directory = entryById(zone.dataset.directoryId);
      const type = sectionContactType(zone.dataset.directoryType || directory?.type || "");
      if ( directory && type ) {
        assignContactType(person, type, directory.title);
        notify(`«${person.title}» привязан к «${directory.title}».`);
      }
    }
    draggedContactId = "";
    clearContactDragState();
    render();
  });

  root.addEventListener("pointerdown", event => {
    const win = root.querySelector(".pcm-window");
    if ( !win ) return;
    const resize = event.target.closest("[data-resize-handle]");
    const drag = event.target.closest("[data-drag-handle]") && !event.target.closest("button,select,input,textarea,label");
    if ( state.windowPrefs?.minimized && resize ) return;
    if ( !resize && !drag ) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { ...state.windowPrefs };
    const direction = resize?.dataset.resizeHandle || "";
    const move = moveEvent => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if ( resize ) {
        Object.assign(state.windowPrefs, resizedWindowGeometry(initial, direction, deltaX, deltaY));
      } else {
        const visibleWidth = state.windowPrefs.minimized ? Math.min(WINDOW_MINIMIZED_WIDTH, innerWidth - WINDOW_EDGE_GAP * 2) : initial.width;
        const visibleHeight = state.windowPrefs.minimized ? WINDOW_MINIMIZED_HEIGHT : initial.height;
        state.windowPrefs.left = clampNumber(initial.left + deltaX, WINDOW_EDGE_GAP, Math.max(WINDOW_EDGE_GAP, innerWidth - visibleWidth - WINDOW_EDGE_GAP));
        state.windowPrefs.top = clampNumber(initial.top + deltaY, WINDOW_EDGE_GAP, Math.max(WINDOW_EDGE_GAP, innerHeight - visibleHeight - WINDOW_EDGE_GAP));
      }
      applyWindowGeometry();
      autoGrowTextareas();
    };
    const finish = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      saveWindowPrefs();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish, { once: true });
    document.addEventListener("pointercancel", finish, { once: true });
  });

  root.addEventListener("dblclick", event => {
    if ( !event.target.closest("[data-drag-handle]") || event.target.closest("button,select,input,textarea,label") ) return;
    state.windowPrefs.minimized = !state.windowPrefs.minimized;
    saveWindowPrefs();
    applyWindowGeometry();
  });

  window.addEventListener("resize", applyWindowGeometry);

  root.addEventListener("toggle", event => {
    const details = event.target;
    if ( details.matches?.("details.pcm-fragment") ) state.openFragmentId = details.open ? details.dataset.fragmentId : (state.openFragmentId === details.dataset.fragmentId ? null : state.openFragmentId);
    if ( details.matches?.("details.pcm-card[data-entry-id]") ) state.openId = details.open ? details.dataset.entryId : (state.openId === details.dataset.entryId ? null : state.openId);
  }, true);

  root.addEventListener("paste", async event => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const imageItem = items.find(item => item.kind === "file" && String(item.type).startsWith("image/"));
    const file = imageItem?.getAsFile?.();
    if ( !file ) return;
    event.preventDefault();
    const pasteZone = event.target.closest?.("[data-paste-target]");
    if ( pasteZone?.dataset.pasteTarget === "city-map" ) {
      const path = await uploadClipboardImage(file, "night-city-map");
      notebook().cityMap.image = path; state.mapZoom = 1; dirty(); render(); return;
    }
    const activeId = ["location", "person", "edit"].includes(state.viewMode) ? state.viewId : state.openId;
    let entry = findEntry(event.target) ?? Object.values(notebook().entries).flat().find(item => item.id === activeId) ?? null;
    if ( !entry ) {
      const type = state.section === "dashboard" ? "notes" : state.section;
      entry = blankEntry(type);
      entry.title = "Вставленное изображение";
      notebook().entries[type].push(entry);
      state.section = type;
      state.openId = entry.id;
      if ( type === "locations" ) {
        state.previousView = viewSnapshot();
        state.viewMode = "edit";
        state.viewId = entry.id;
      }
    }
    let target = { type: "cover" };
    if ( pasteZone?.dataset.pasteTarget === "gallery" && entry.type === "people" ) target = { type: "gallery" };
    if ( pasteZone?.dataset.pasteTarget === "fragment" ) {
      const fragmentId = pasteZone.closest("[data-fragment-id]")?.dataset.fragmentId;
      const fragment = entry.fragments.find(item => item.id === fragmentId);
      if ( fragment ) target = { type: "fragment", fragment };
    }
    await pasteImage(file, entry, target);
  });

  const keyboardHandler = event => {
    const typing = event.target?.matches?.("input,textarea,select,[contenteditable='true']");
    if ( event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "m" && !typing ) {
      event.preventDefault();
      selectedTokens().length ? importFromTokens({ stay: true }) : importFromScene({ stay: true });
      return;
    }
    if ( (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && state.root.isConnected ) {
      event.preventDefault();
      state.globalSearchOpen = true;
      state.toolsOpen = false;
      render();
      return;
    }
    if ( (event.ctrlKey || event.metaKey) && event.key === "Enter" && state.root.isConnected && document.activeElement?.matches?.("[data-quick]") ) {
      event.preventDefault();
      const quick = state.quick.trim();
      if ( quick ) { const quickType = state.quickType; state.quick = ""; addEntry(quickType, quick, { inbox: true, stay: true }); notify("Быстрая запись сохранена и добавлена в «Разобрать»."); }
      else notify("Сначала напишите быструю заметку.", "warn");
      return;
    }
    if ( (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && state.root.isConnected ) {
      event.preventDefault();
      saveServer(true);
      return;
    }
    if ( event.key !== "Escape" || !state.root.isConnected ) return;
    if ( state.contactContext ) { closeContactContextMenu(); return; }
    if ( state.entryContext ) { closeEntryContextMenu(); return; }
    if ( state.lightbox ) { state.lightbox = null; render(); return; }
    if ( state.globalSearchOpen ) { state.globalSearchOpen = false; render(); return; }
    if ( state.chatOpen ) { state.chatOpen = false; render(); return; }
    if ( state.toolsOpen ) { state.toolsOpen = false; render(); return; }
    if ( state.helpOpen ) { state.helpOpen = false; render(); return; }
    if ( state.settingsOpen ) { state.settingsOpen = false; render(); return; }
    if ( state.viewMode === "edit" && state.previousView ) { restoreView(state.previousView); render(); return; }
    void saveServer(true).finally(() => requestClose());
  };
  document.addEventListener("keydown", keyboardHandler);

  const contextOutsidePointerHandler = event => {
    if ( !state.root?.isConnected ) return;
    if ( state.contactContext && !event.target.closest?.(".pcm-contact-context-menu") ) closeContactContextMenu();
    if ( state.entryContext && !event.target.closest?.(".pcm-entry-context-menu") ) closeEntryContextMenu();
  };
  document.addEventListener("pointerdown", contextOutsidePointerHandler, true);

  const Hooks = globalThis.Hooks;
  const neuroHookIds = [];
  const onNeuroMessageChanged = message => {
    if ( !neuroFlag(message) || !state.root?.isConnected ) return;
    render();
  };
  if ( Hooks?.on ) {
    neuroHookIds.push(["createChatMessage", Hooks.on("createChatMessage", onNeuroMessageChanged)]);
    neuroHookIds.push(["updateChatMessage", Hooks.on("updateChatMessage", onNeuroMessageChanged)]);
    neuroHookIds.push(["deleteChatMessage", Hooks.on("deleteChatMessage", onNeuroMessageChanged)]);
  }

  const api = {
    version: VERSION,
    macroVersion: MACRO_VERSION,
    variant: VARIANT,
    state,
    open() { render(); startScanHud(); },
    async flush() { await saveServer(true); },
    async close() { await saveServer(true); await requestClose(); },
    destroy() {
      stopScanHud(); clearInterval(state.scanTimer);
      closeContactContextMenu();
      closeEntryContextMenu();
      clearTimeout(state.saveTimer);
      document.removeEventListener("keydown", keyboardHandler);
      document.removeEventListener("pointerdown", contextOutsidePointerHandler, true);
      window.removeEventListener("resize", applyWindowGeometry);
      stopArchiveTextObserver?.();
      if ( Hooks?.off ) for ( const [eventName, hookId] of neuroHookIds ) Hooks.off(eventName, hookId);
      removeContextOverlay();
      root.classList.remove("field-archive-embedded", "neo-archive-view");
      root.innerHTML = "";
    }
  };
  ensureNotebook(actorById(state.store.activeActorId));
  render();
  if ( fromLocal && (!rawServer || String(fromLocal.updatedAt) > String(fromServer.updatedAt)) ) notify("Полевой архив: восстановлен свежий локальный черновик.");
  return api;
}
