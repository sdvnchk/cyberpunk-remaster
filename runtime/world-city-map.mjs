const MODULE_ID = "cyberpunk-remaster";
const SETTING_KEY = "worldCityMap";
export const WORLD_CITY_MAP_VERSION = 3;
export const WORLD_CITY_MAP_HOOK = "cyberpunkRemasterWorldCityMapChanged";

export const REMOVED_WORLD_MAP_CATEGORY_IDS = new Set([
  "contact",
  "gig",
  "clue",
  "cyberpsycho",
  "melee",
  "netrunner",
  "fast-travel",
  "drop-point",
  "npc",
]);

export const WORLD_MAP_ICON_PRESETS = Object.freeze([
  { id: "district", label: "Район", icon: "fa:fa-map-location-dot" },
  { id: "contact", label: "Контакт", icon: "fa:fa-address-card" },
  { id: "fixer", label: "Фиксер", icon: "fa:fa-user-tie" },
  { id: "gig", label: "Заказ", icon: "fa:fa-briefcase" },
  { id: "clue", label: "Зацепка", icon: "fa:fa-magnifying-glass" },
  { id: "ncpd", label: "NCPD", icon: "fa:fa-shield-halved" },
  { id: "cyberpsycho", label: "Киберпсих", icon: "fa:fa-skull" },
  { id: "clothing", label: "Одежда", icon: "fa:fa-shirt" },
  { id: "food", label: "Еда", icon: "fa:fa-utensils" },
  { id: "medpoint", label: "Медпункт", icon: "fa:fa-kit-medical" },
  { id: "weapon", label: "Оружие", icon: "fa:fa-gun" },
  { id: "melee", label: "Ближний бой", icon: "fa:fa-hand-fist" },
  { id: "junkshop", label: "Скупщик", icon: "fa:fa-recycle" },
  { id: "netrunner", label: "Нетраннер", icon: "fa:fa-laptop-code" },
  { id: "ripperdoc", label: "Риппер", icon: "fa:fa-user-doctor" },
  { id: "fast-travel", label: "Быстрое перемещение", icon: "fa:fa-train-subway" },
  { id: "bar", label: "Бар", icon: "fa:fa-martini-glass" },
  { id: "tarot", label: "Таро", icon: "fa:fa-eye" },
  { id: "drop-point", label: "Drop Point", icon: "fa:fa-box-open" },
  { id: "landmark", label: "Достопримечательность", icon: "fa:fa-camera" },
  { id: "corporation", label: "Корпорация", icon: "fa:fa-building" },
  { id: "megabuilding", label: "Мегабашня", icon: "fa:fa-city" },
  { id: "organization", label: "Организация", icon: "fa:fa-people-group" },
  { id: "apartment", label: "Квартира", icon: "fa:fa-house" },
  { id: "vehicle", label: "Транспорт", icon: "fa:fa-car" },
  { id: "npc", label: "NPC", icon: "fa:fa-user" },
  { id: "faction", label: "Фракция", icon: "fa:fa-users" },
  { id: "gang", label: "Банда", icon: "fa:fa-skull-crossbones" },
  { id: "poi", label: "Интерес", icon: "fa:fa-location-dot" },
  { id: "star", label: "Особая точка", icon: "fa:fa-star" },
  { id: "danger", label: "Опасность", icon: "fa:fa-triangle-exclamation" },
  { id: "tech", label: "Технологии", icon: "fa:fa-microchip" },
  { id: "data", label: "Данные", icon: "fa:fa-database" },
  { id: "bolt", label: "Событие", icon: "fa:fa-bolt" },
]);

export const DEFAULT_WORLD_MAP_CATEGORIES = Object.freeze([
  { id: "district", label: "Районы", icon: "fa:fa-map-location-dot", color: "#f6c85f" },
  { id: "fixer", label: "Фиксеры", icon: "fa:fa-user-tie", color: "#f4a261" },
  { id: "ncpd", label: "NCPD", icon: "fa:fa-shield-halved", color: "#4d96ff" },
  { id: "clothing", label: "Одежда", icon: "fa:fa-shirt", color: "#d17bff" },
  { id: "food", label: "Еда", icon: "fa:fa-utensils", color: "#ffb347" },
  { id: "medpoint", label: "Медпункты", icon: "fa:fa-kit-medical", color: "#3ddc97" },
  { id: "weapon", label: "Оружие", icon: "fa:fa-gun", color: "#ff6b6b" },
  { id: "junkshop", label: "Скупщики", icon: "fa:fa-recycle", color: "#a3b18a" },
  { id: "ripperdoc", label: "Рипперы", icon: "fa:fa-user-doctor", color: "#2ec4b6" },
  { id: "bar", label: "Бары", icon: "fa:fa-martini-glass", color: "#ff4ecd" },
  { id: "tarot", label: "Таро", icon: "fa:fa-eye", color: "#9b5de5" },
  { id: "landmark", label: "Достопримечательности", icon: "fa:fa-camera", color: "#06d6a0" },
  { id: "corporation", label: "Корпорации", icon: "fa:fa-building", color: "#7bdff2" },
  { id: "megabuilding", label: "Мегабашни", icon: "fa:fa-city", color: "#b2f7ef" },
  { id: "organization", label: "Организации", icon: "fa:fa-people-group", color: "#f7aef8" },
  { id: "apartment", label: "Квартиры", icon: "fa:fa-house", color: "#cdb4db" },
  { id: "vehicle", label: "Транспорт", icon: "fa:fa-car", color: "#90be6d" },
  { id: "faction", label: "Фракции", icon: "fa:fa-users", color: "#f72585" },
  { id: "gang", label: "Банды", icon: "fa:fa-skull-crossbones", color: "#ef233c" },
  { id: "poi", label: "Интерес", icon: "fa:fa-location-dot", color: "#f8f9fa" },
]);

const ARCHIVE_SECTIONS = new Set([
  "people",
  "gangs",
  "corporations",
  "fixers",
  "rippers",
  "lawmen",
  "noosphere",
  "nomads",
  "subscriptions",
  "locations",
  "quests",
  "clues",
  "books",
  "sessions",
  "notes",
]);

const clone = (value) => {
  if (value === undefined) return undefined;
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)); }
};

const text = (value, fallback = "") => String(value ?? fallback).trim();
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const now = () => new Date().toISOString();
const uid = (prefix = "map") => {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
};

function normalizeLink(raw) {
  const actorId = text(raw?.actorId);
  const section = text(raw?.section);
  const entryId = text(raw?.entryId);
  if (!actorId || !entryId || !ARCHIVE_SECTIONS.has(section)) return null;
  return { actorId, section, entryId };
}

function sameLink(a, b) {
  return String(a?.actorId || "") === String(b?.actorId || "")
    && String(a?.section || "") === String(b?.section || "")
    && String(a?.entryId || "") === String(b?.entryId || "");
}

const DEFAULT_CATEGORY_COLOR = "#f6c85f";

function normalizeHexColor(value, fallback = "") {
  const raw = text(value).toLowerCase();
  if (/^#[0-9a-f]{6}$/u.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/u.test(raw)) return `#${raw.slice(1).split("").map((part) => part + part).join("")}`;
  return fallback;
}

function normalizeCategory(raw, fallbackId = "", fallback = null) {
  const id = text(raw?.id, fallbackId).replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/gu, "").toLowerCase();
  if (!id) return null;
  return {
    id,
    label: text(raw?.label, fallback?.label || id),
    icon: text(raw?.icon, fallback?.icon || "fa:fa-location-dot").slice(0, 64) || "fa:fa-location-dot",
    color: normalizeHexColor(raw?.color, fallback?.color || DEFAULT_CATEGORY_COLOR),
  };
}

function normalizedCategories(raw, { sourceVersion = WORLD_CITY_MAP_VERSION } = {}) {
  const categories = new Map();
  for (const source of DEFAULT_WORLD_MAP_CATEGORIES) {
    const category = normalizeCategory(source);
    if (category) categories.set(category.id, category);
  }
  for (const source of Array.isArray(raw) ? raw : []) {
    const probe = normalizeCategory(source);
    if (!probe || REMOVED_WORLD_MAP_CATEGORY_IDS.has(probe.id)) continue;
    const base = categories.get(probe.id);
    if (sourceVersion < 2 && base && DEFAULT_WORLD_MAP_CATEGORIES.some((category) => category.id === probe.id)) {
      categories.set(probe.id, base);
      continue;
    }
    const category = normalizeCategory(source, probe.id, base);
    categories.set(category.id, category);
  }
  return [...categories.values()];
}

const LEGACY_DEFAULT_MARKER_ICONS = new Set(["⌖", "◉", "▤", "◇", "◆"]);

function normalizeMarker(raw, categories, fallbackId = "", { sourceVersion = WORLD_CITY_MAP_VERSION } = {}) {
  const categoryIds = new Set(categories.map((category) => category.id));
  const links = [];
  for (const candidate of Array.isArray(raw?.links) ? raw.links : []) {
    const link = normalizeLink(candidate);
    if (link && !links.some((existing) => sameLink(existing, link))) links.push(link);
  }
  const categoryId = categoryIds.has(text(raw?.categoryId)) ? text(raw.categoryId) : "poi";
  return {
    id: text(raw?.id, fallbackId) || uid("poi"),
    x: clamp01(raw?.x),
    y: clamp01(raw?.y),
    title: text(raw?.title, "Новая точка"),
    description: text(raw?.description),
    categoryId,
    icon: sourceVersion < 2 && LEGACY_DEFAULT_MARKER_ICONS.has(text(raw?.icon))
      ? ""
      : text(raw?.icon).slice(0, 64),
    color: normalizeHexColor(raw?.color, ""),
    links,
    createdAt: text(raw?.createdAt, now()),
    updatedAt: text(raw?.updatedAt, now()),
  };
}

export function normalizeWorldCityMap(raw = {}) {
  const sourceVersion = Number(raw?.version) || 1;
  const categories = normalizedCategories(raw?.categories, { sourceVersion });
  const markers = [];
  const ids = new Set();
  for (const source of Array.isArray(raw?.markers) ? raw.markers : []) {
    const marker = normalizeMarker(source, categories, "", { sourceVersion });
    if (ids.has(marker.id)) marker.id = uid("poi");
    ids.add(marker.id);
    markers.push(marker);
  }
  return {
    version: WORLD_CITY_MAP_VERSION,
    title: text(raw?.title, "Карта Найт-Сити") || "Карта Найт-Сити",
    tileset: text(raw?.tileset, "night-city-2045") || "night-city-2045",
    // v2 stored only an image path. v3 keeps that path for rollback/custom use,
    // but migrates existing worlds to the embedded tiled atlas by default.
    backgroundMode: sourceVersion >= 3 && raw?.backgroundMode === "image" && String(raw?.image ?? "").trim() ? "image" : "tiles",
    image: String(raw?.image ?? "").trim(),
    notes: String(raw?.notes ?? "").trim(),
    categories,
    markers,
    updatedAt: text(raw?.updatedAt),
  };
}

export function defaultWorldCityMap() {
  return normalizeWorldCityMap({});
}

export function worldMapMarkerDisplayLabel(state, marker) {
  const categoryId = text(marker?.categoryId, "poi") || "poi";
  const presetLabel = WORLD_MAP_ICON_PRESETS.find((preset) => preset.id === categoryId)?.label;
  const categoryLabel = text(presetLabel)
    || text(state?.categories?.find?.((category) => category.id === categoryId)?.label, "Точка")
    || "Точка";
  const title = text(marker?.title, "Без названия") || "Без названия";
  return `${categoryLabel} — ${title}`;
}

function parseStored(value) {
  if (value && typeof value === "object") return normalizeWorldCityMap(value);
  try { return normalizeWorldCityMap(JSON.parse(String(value || "{}"))); }
  catch { return defaultWorldCityMap(); }
}

let settingRegistered = false;
let writeQueue = Promise.resolve();

export function registerWorldCityMapSetting() {
  if (settingRegistered) return;
  const settings = globalThis.game?.settings;
  if (!settings?.register) return;
  try {
    settings.register(MODULE_ID, SETTING_KEY, {
      name: "Night City World Map",
      hint: "Shared interactive map data for the Cyberpunk Remaster archives.",
      scope: "world",
      config: false,
      type: String,
      default: JSON.stringify(defaultWorldCityMap()),
      onChange: (value) => {
        globalThis.Hooks?.callAll?.(WORLD_CITY_MAP_HOOK, parseStored(value));
      },
    });
    settingRegistered = true;
  } catch (error) {
    // Foundry throws if a development hot-reload registers the same key twice.
    if (!/already|registered/i.test(String(error?.message || error))) throw error;
    settingRegistered = true;
  }
}

export function getWorldCityMap() {
  registerWorldCityMapSetting();
  return parseStored(globalThis.game?.settings?.get?.(MODULE_ID, SETTING_KEY));
}

function assertGM() {
  if (!globalThis.game?.user?.isGM) throw new Error("Только GM может изменять общую карту Найт-Сити.");
}

export function updateWorldCityMap(mutator) {
  assertGM();
  const task = async () => {
    const current = getWorldCityMap();
    const draft = clone(current);
    const result = typeof mutator === "function" ? await mutator(draft) : mutator;
    const next = normalizeWorldCityMap(result && typeof result === "object" ? result : draft);
    next.updatedAt = now();
    await globalThis.game?.settings?.set?.(MODULE_ID, SETTING_KEY, JSON.stringify(next));
    return next;
  };
  const queued = writeQueue.then(task, task);
  writeQueue = queued.catch(() => undefined);
  return queued;
}

export async function setWorldMapImage(image, { title = null } = {}) {
  return updateWorldCityMap((state) => {
    state.image = String(image ?? "").trim();
    state.backgroundMode = state.image ? "image" : "tiles";
    if (title !== null) state.title = text(title, state.title);
  });
}

export async function useBuiltInWorldMapTiles() {
  return updateWorldCityMap((state) => {
    state.backgroundMode = "tiles";
    state.tileset = "night-city-2045";
  });
}

export async function createWorldMapMarker(input = {}) {
  let created = null;
  await updateWorldCityMap((state) => {
    created = normalizeMarker({
      ...input,
      id: input.id || uid("poi"),
      createdAt: now(),
      updatedAt: now(),
    }, state.categories);
    state.markers.push(created);
  });
  return clone(created);
}

export async function updateWorldMapMarker(id, patch = {}) {
  let updated = null;
  await updateWorldCityMap((state) => {
    const index = state.markers.findIndex((marker) => marker.id === String(id));
    if (index < 0) return;
    updated = normalizeMarker({ ...state.markers[index], ...clone(patch), id: state.markers[index].id, createdAt: state.markers[index].createdAt, updatedAt: now() }, state.categories);
    state.markers[index] = updated;
  });
  return clone(updated);
}

export async function deleteWorldMapMarker(id) {
  let removed = false;
  await updateWorldCityMap((state) => {
    const before = state.markers.length;
    state.markers = state.markers.filter((marker) => marker.id !== String(id));
    removed = state.markers.length !== before;
  });
  return removed;
}

export async function upsertWorldMapCategory(input = {}) {
  let category = null;
  await updateWorldCityMap((state) => {
    category = normalizeCategory(input, uid("cat"));
    if (!category) return;
    const index = state.categories.findIndex((item) => item.id === category.id);
    if (index >= 0) state.categories[index] = category;
    else state.categories.push(category);
  });
  return clone(category);
}

export async function deleteWorldMapCategory(id) {
  const key = text(id);
  if (DEFAULT_WORLD_MAP_CATEGORIES.some((category) => category.id === key)) return false;
  let removed = false;
  await updateWorldCityMap((state) => {
    const before = state.categories.length;
    state.categories = state.categories.filter((category) => category.id !== key);
    removed = before !== state.categories.length;
    if (removed) for (const marker of state.markers) if (marker.categoryId === key) marker.categoryId = "poi";
  });
  return removed;
}

export function markersForArchiveEntry(link, state = getWorldCityMap()) {
  const normalized = normalizeLink(link);
  if (!normalized) return [];
  return state.markers.filter((marker) => marker.links.some((candidate) => sameLink(candidate, normalized))).map(clone);
}

export async function linkMarkerToArchiveEntry(markerId, link) {
  const normalized = normalizeLink(link);
  if (!normalized) throw new Error("Некорректная ссылка на запись архива.");
  return updateWorldMapMarker(markerId, {
    links: (() => {
      const marker = getWorldCityMap().markers.find((item) => item.id === String(markerId));
      if (!marker) return [];
      const links = [...marker.links];
      if (!links.some((candidate) => sameLink(candidate, normalized))) links.push(normalized);
      return links;
    })(),
  });
}

export async function unlinkMarkerFromArchiveEntry(markerId, link) {
  const normalized = normalizeLink(link);
  if (!normalized) return null;
  const marker = getWorldCityMap().markers.find((item) => item.id === String(markerId));
  if (!marker) return null;
  return updateWorldMapMarker(markerId, {
    links: marker.links.filter((candidate) => !sameLink(candidate, normalized)),
  });
}

export function archiveLinkKey(link) {
  const normalized = normalizeLink(link);
  return normalized ? `${normalized.actorId}:${normalized.section}:${normalized.entryId}` : "";
}

export function isArchiveLink(value) {
  return Boolean(normalizeLink(value));
}
