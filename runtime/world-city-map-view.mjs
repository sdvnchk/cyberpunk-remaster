import { chooseArchiveImage } from "./archive-file-picker.mjs";
import { createWorldCityLeafletMap } from "./world-city-map-leaflet.mjs";
import { personalLinksForMarker } from "./world-city-map-user-links.mjs";
import {
  WORLD_CITY_MAP_HOOK,
  DEFAULT_WORLD_MAP_CATEGORIES,
  WORLD_MAP_ICON_PRESETS,
  createWorldMapMarker,
  deleteWorldMapCategory,
  deleteWorldMapMarker,
  getWorldCityMap,
  linkMarkerToArchiveEntry,
  setWorldMapImage,
  useBuiltInWorldMapTiles,
  unlinkMarkerFromArchiveEntry,
  updateWorldMapMarker,
  upsertWorldMapCategory,
} from "./world-city-map.mjs";

const MODULE_ID = "cyberpunk-remaster";
const HIDDEN_KEY = `${MODULE_ID}.world-city-map-hidden-categories.v1`;
const HIDDEN_MARKERS_KEY = `${MODULE_ID}.world-city-map-hidden-markers.v1`;
const GM_PANEL_COLLAPSED_KEY = `${MODULE_ID}.world-city-map-gm-panel-collapsed.v1`;
const SIDEBAR_COLLAPSED_KEY = `${MODULE_ID}.world-city-map-sidebar-collapsed.v1`;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 6;
export const WORLD_MAP_ARCHIVE_FOCUS_ZOOM = 5;

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const clone = (value) => {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)); }
};

const clean = (value) => String(value ?? "").trim();
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const DEFAULT_CATEGORY_IDS = new Set(DEFAULT_WORLD_MAP_CATEGORIES.map((category) => category.id));

export function worldMapIconHtml(icon, { className = "" } = {}) {
  const value = clean(icon);
  if (value.startsWith("fa:")) {
    const faClass = value.slice(3).replace(/[^a-z0-9_-]/giu, "");
    return `<i class="fa-solid ${esc(faClass)} ${esc(className)}" aria-hidden="true"></i>`;
  }
  return `<span class="${esc(className)}" aria-hidden="true">${esc(value || "◆")}</span>`;
}

function iconPresetLabel(icon) {
  const value = clean(icon);
  return WORLD_MAP_ICON_PRESETS.find((preset) => preset.icon === value)?.label || (value ? "Пользовательская иконка" : "Иконка категории");
}

function iconPickerHtml({ target, value = "", inherit = false, effectiveIcon = "" } = {}) {
  const selected = clean(value);
  const inheritedIcon = clean(effectiveIcon) || "fa:fa-location-dot";
  const shownIcon = selected || inheritedIcon;
  const inputAttr = target === "marker" ? 'data-world-map-field="icon"' : 'data-world-map-new-category-icon';
  const triggerAttr = target === "marker" ? 'data-world-map-icon-trigger="marker"' : 'data-world-map-icon-trigger="category"';
  const gridAttr = target === "marker" ? 'data-world-map-icon-grid="marker"' : 'data-world-map-icon-grid="category"';
  const inheritChoice = inherit
    ? `<button type="button" class="world-city-map-icon-choice inherit ${selected ? "" : "selected"}" data-world-map-icon-choice="" title="Иконка категории">${worldMapIconHtml(inheritedIcon, { className: "world-city-map-icon-choice-glyph" })}</button>`
    : "";
  const choices = WORLD_MAP_ICON_PRESETS.map((preset) => `<button type="button" class="world-city-map-icon-choice ${preset.icon === selected ? "selected" : ""}" data-world-map-icon-choice="${esc(preset.icon)}" title="${esc(preset.label)}">${worldMapIconHtml(preset.icon, { className: "world-city-map-icon-choice-glyph" })}</button>`).join("");
  const customChoice = selected && !WORLD_MAP_ICON_PRESETS.some((preset) => preset.icon === selected)
    ? `<button type="button" class="world-city-map-icon-choice selected" data-world-map-icon-choice="${esc(selected)}" title="Текущая пользовательская иконка">${worldMapIconHtml(selected, { className: "world-city-map-icon-choice-glyph" })}</button>`
    : "";
  const title = selected ? iconPresetLabel(selected) : "Иконка категории";
  return `<div class="world-city-map-icon-picker" data-world-map-icon-picker="${esc(target)}" data-world-map-effective-icon="${esc(inheritedIcon)}"><input type="hidden" ${inputAttr} value="${esc(selected)}"><button type="button" class="world-city-map-icon-trigger" ${triggerAttr} title="${esc(title)}">${worldMapIconHtml(shownIcon, { className: "world-city-map-icon-trigger-glyph" })}<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><div class="world-city-map-icon-grid" ${gridAttr} hidden>${inheritChoice}${choices}${customChoice}</div></div>`;
}

function setIconPickerValue(picker, value, { effectiveIcon = null } = {}) {
  if (!picker) return;
  if (effectiveIcon !== null) picker.dataset.worldMapEffectiveIcon = clean(effectiveIcon) || "fa:fa-location-dot";
  const input = picker.querySelector?.('[data-world-map-field="icon"], [data-world-map-new-category-icon]');
  if (input) input.value = clean(value);
  const inheritedIcon = clean(picker.dataset.worldMapEffectiveIcon) || "fa:fa-location-dot";
  const shownIcon = clean(value) || inheritedIcon;
  const trigger = picker.querySelector?.("[data-world-map-icon-trigger]");
  if (trigger) {
    trigger.innerHTML = `${worldMapIconHtml(shownIcon, { className: "world-city-map-icon-trigger-glyph" })}<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>`;
    trigger.title = clean(value) ? iconPresetLabel(value) : "Иконка категории";
  }
  for (const button of picker.querySelectorAll?.("[data-world-map-icon-choice]") ?? []) {
    button.classList.toggle("selected", clean(button.dataset.worldMapIconChoice) === clean(value));
  }
}


export function clampWorldMapZoom(value) {
  const numeric = Number(value);
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number.isFinite(numeric) ? numeric : 1));
}

export function viewportPointToNormalized({
  clientX = 0,
  clientY = 0,
  rectLeft = 0,
  rectTop = 0,
  panX = 0,
  panY = 0,
  zoom = 1,
  width = 1,
  height = 1,
} = {}) {
  const safeZoom = Math.max(0.0001, Number(zoom) || 1);
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const sceneX = (Number(clientX) - Number(rectLeft) - Number(panX)) / safeZoom;
  const sceneY = (Number(clientY) - Number(rectTop) - Number(panY)) / safeZoom;
  return {
    x: clamp01(sceneX / safeWidth),
    y: clamp01(sceneY / safeHeight),
  };
}

function categoryLabel(state, categoryId) {
  return state.categories?.find((category) => category.id === categoryId)?.label ?? categoryId ?? "";
}

export function filterWorldMapMarkers(state, {
  hiddenCategories = new Set(),
  hiddenMarkers = new Set(),
  query = "",
  recordTitleByLink = null,
} = {}) {
  const hidden = hiddenCategories instanceof Set ? hiddenCategories : new Set(hiddenCategories ?? []);
  const hiddenPoints = hiddenMarkers instanceof Set ? hiddenMarkers : new Set(hiddenMarkers ?? []);
  const needle = clean(query).toLocaleLowerCase("ru");
  return (state?.markers ?? []).filter((marker) => {
    if (hidden.has(marker.categoryId)) return false;
    if (hiddenMarkers instanceof Set && hiddenMarkers.has(marker.id)) return false;
    if (hiddenPoints.has(marker.id)) return false;
    if (!needle) return true;
    const linked = typeof recordTitleByLink === "function"
      ? (marker.links ?? []).map((link) => recordTitleByLink(link)).join(" ")
      : "";
    const haystack = [
      marker.title,
      marker.description,
      marker.icon,
      categoryLabel(state, marker.categoryId),
      linked,
    ].join(" ").toLocaleLowerCase("ru");
    return haystack.includes(needle);
  });
}

function readClientSet(key) {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem?.(key) ?? "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveClientSet(key, values) {
  try {
    globalThis.localStorage?.setItem?.(key, JSON.stringify([...values]));
  } catch {
    // Client-only convenience. The shared map itself does not depend on this.
  }
}

function readHiddenCategories() { return readClientSet(HIDDEN_KEY); }
function saveHiddenCategories(hidden) { saveClientSet(HIDDEN_KEY, hidden); }
function readHiddenMarkers() { return readClientSet(HIDDEN_MARKERS_KEY); }
function saveHiddenMarkers(hidden) { saveClientSet(HIDDEN_MARKERS_KEY, hidden); }

function readClientFlag(key, fallback = false) {
  try {
    const value = globalThis.localStorage?.getItem?.(key);
    if (value === null || value === undefined || value === "") return Boolean(fallback);
    return value === "1" || value === "true";
  } catch {
    return Boolean(fallback);
  }
}

function saveClientFlag(key, value) {
  try {
    globalThis.localStorage?.setItem?.(key, value ? "1" : "0");
  } catch {
    // Client-only convenience.
  }
}

function linkKey(link) {
  return `${String(link?.actorId ?? "")}|${String(link?.section ?? "")}|${String(link?.entryId ?? "")}`;
}

function parseLinkKey(value) {
  const [actorId = "", section = "", entryId = ""] = String(value || "").split("|");
  return actorId && section && entryId ? { actorId, section, entryId } : null;
}

function markerCategory(state, marker) {
  return state.categories.find((category) => category.id === marker?.categoryId)
    ?? state.categories.find((category) => category.id === "poi")
    ?? { id: "poi", label: "Интерес", icon: "fa:fa-location-dot", color: "#f8f9fa" };
}

function iconForMarker(state, marker) {
  return clean(marker?.icon) || markerCategory(state, marker).icon || "fa:fa-location-dot";
}

function colorForMarker(state, marker) {
  return clean(marker?.color) || markerCategory(state, marker).color || "#f6c85f";
}

const RECORD_TYPE_LABELS = Object.freeze({
  people: "КОНТАКТ",
  gangs: "БАНДА",
  corporations: "КОРПОРАЦИЯ",
  fixers: "ФИКСЕР",
  rippers: "РИППЕР",
  lawmen: "ЗАКОННИК",
  noosphere: "НООСФЕРА",
  nomads: "КОЧЕВНИК",
  subscriptions: "ПОДПИСКА",
  locations: "МЕСТО",
  quests: "ЗАКАЗ",
  clues: "ЗАЦЕПКА",
  books: "ФАЙЛ",
  sessions: "СЕССИЯ",
  notes: "ЗАМЕТКА",
});

function recordTypeLabel(recordOrLink) {
  const section = clean(recordOrLink?.section);
  return RECORD_TYPE_LABELS[section]
    || clean(recordOrLink?.sectionLabel).toLocaleUpperCase("ru")
    || section.toLocaleUpperCase("ru")
    || "ЗАПИСЬ";
}

function recordLinkLabel(record, fallbackLink = null) {
  const source = record || fallbackLink || {};
  const type = recordTypeLabel(source);
  const title = clean(record?.title) || clean(fallbackLink?.entryId) || "Без названия";
  return `${type} — ${title}`;
}

function recordLabel(record) {
  const actor = clean(record?.actorName);
  return [actor, recordLinkLabel(record)].filter(Boolean).join(" · ");
}

function markerLinkSummary(marker, recordsByKey) {
  const links = Array.isArray(marker?.links) ? marker.links : [];
  if (!links.length) return "";
  const first = links[0];
  const record = recordsByKey.get(linkKey(first));
  const label = recordLinkLabel(record, first);
  return `${label}${links.length > 1 ? ` +${links.length - 1}` : ""}`;
}

function markerButtonHtml(state, marker, selected) {
  const color = colorForMarker(state, marker);
  const tooltip = clean(marker.title) || categoryLabel(state, marker.categoryId) || "Точка интереса";
  return `<button type="button" class="world-city-map-marker ${selected ? "selected" : ""}" data-world-map-marker="${esc(marker.id)}" data-category="${esc(marker.categoryId)}" data-world-map-tooltip="${esc(tooltip)}" aria-label="${esc(tooltip)}" style="--world-map-marker-color:${esc(color)}" title="${esc(tooltip)}">${worldMapIconHtml(iconForMarker(state, marker), { className: "world-city-map-marker-icon" })}</button>`;
}

function emptyHtml() {
  return `<div class="world-city-map-empty world-city-map-loading"><b>⌖</b><h2>Загрузка карты Найт-Сити</h2><p>Инициализация локального Leaflet и слоёв карты…</p></div>`;
}

function shellHtml(isGM) {
  return `<section class="world-city-map-shell" data-world-map-shell>
    <aside class="world-city-map-sidebar">
      <header><span class="world-city-map-sidebar-title"><small>WORLD // NIGHT CITY</small><h2 data-world-map-title>Карта Найт-Сити</h2></span><button type="button" class="world-city-map-sidebar-toggle" data-world-map-action="toggle-sidebar" title="Свернуть или развернуть панель карты"><i class="fa-solid fa-panel-left" aria-hidden="true"></i></button></header>
      <label class="world-city-map-search"><span>⌕</span><input type="search" data-world-map-search placeholder="Поиск по точкам и связям"></label>
      <div class="world-city-map-filter-tools"><button type="button" data-world-map-action="show-all-categories" title="Показать все отключённые точки на карте"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>Показать все</span></button></div>
      <div class="world-city-map-categories" data-world-map-categories></div>
      ${isGM ? `<section class="world-city-map-gm" data-world-map-gm><header><span><b>GM CONTROL</b><small>Общие данные мира</small></span><button type="button" class="world-city-map-gm-toggle" data-world-map-action="toggle-gm" title="Свернуть или развернуть блок GM"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button></header><div class="world-city-map-gm-body" data-world-map-gm-body><div class="world-city-map-gm-actions"><button type="button" data-world-map-action="add-marker">+ Точка</button><button type="button" data-world-map-action="pick-image">Карта</button><button type="button" data-world-map-action="clear-image">Очистить</button></div><small data-world-map-category-editing>Новая категория</small><div class="world-city-map-category-create"><input data-world-map-new-category-label placeholder="Название категории">${iconPickerHtml({ target: "category", value: "fa:fa-location-dot" })}<input type="color" data-world-map-new-category-color value="#f6c85f" title="Цвет иконки"><button type="button" data-world-map-action="add-category" title="Сохранить категорию">✓</button><button type="button" data-world-map-action="cancel-category-edit" title="Сбросить">×</button></div></div></section>` : ""}
    </aside>
    <div class="world-city-map-main">
      <div class="world-city-map-toolbar"><button type="button" data-world-map-action="zoom-out">−</button><button type="button" data-world-map-action="reset-view">Вписать</button><button type="button" data-world-map-action="zoom-in">+</button><span data-world-map-mode></span></div>
      <div class="world-city-map-viewport" data-world-map-viewport tabindex="0">
        <div class="world-city-map-leaflet" data-world-map-leaflet></div>
        <div data-world-map-empty></div>
      </div>
      <div class="world-city-map-inspector" data-world-map-inspector></div>
    </div>
  </section>`;
}

export function renderWorldCityMap(host, context = {}) {
  if (!host) return { destroy() {}, refresh() {}, focusMarker() {} };
  const isGM = Boolean(globalThis.game?.user?.isGM);
  const activeActorId = clean(context.activeActorId);
  const hiddenCategories = readHiddenCategories();
  const hiddenMarkers = readHiddenMarkers();
  const expandedCategories = new Set();
  let gmPanelCollapsed = readClientFlag(GM_PANEL_COLLAPSED_KEY, false);
  let sidebarCollapsed = readClientFlag(SIDEBAR_COLLAPSED_KEY, false);
  let state = getWorldCityMap();
  let query = "";
  let selectedMarkerId = clean(context.focusMarkerId);
  let editorMarkerId = "";
  let categoryEditId = "";
  let selectedCategoryId = "poi";
  let placementMode = false;
  let destroyed = false;
  let mapController = null;
  let mapSourceKey = "";
  let mapInitSerial = 0;
  let hookId = null;
  const catalog = () => Array.isArray(context.listArchiveRecords?.()) ? context.listArchiveRecords() : [];
  const recordMap = () => new Map(catalog().map((record) => [linkKey(record), record]));
  const pickImage = typeof context.pickImage === "function" ? context.pickImage : chooseArchiveImage;

  host.innerHTML = shellHtml(isGM);
  const shell = host.querySelector("[data-world-map-shell]");
  const titleEl = host.querySelector("[data-world-map-title]");
  const categoriesEl = host.querySelector("[data-world-map-categories]");
  const resultsEl = host.querySelector("[data-world-map-results]");
  const gmSection = host.querySelector("[data-world-map-gm]");
  const gmToggle = host.querySelector('[data-world-map-action="toggle-gm"]');
  const sidebarToggle = host.querySelector('[data-world-map-action="toggle-sidebar"]');
  const viewport = host.querySelector("[data-world-map-viewport]");
  const mapHost = host.querySelector("[data-world-map-leaflet]");
  const empty = host.querySelector("[data-world-map-empty]");
  const inspector = host.querySelector("[data-world-map-inspector]");
  const modeEl = host.querySelector("[data-world-map-mode]");
  const resetButton = host.querySelector('[data-world-map-action="reset-view"]');

  function recordTitleByLink(link) {
    return recordLabel(recordMap().get(linkKey(link)));
  }

  function visibleMarkers() {
    return filterWorldMapMarkers(state, { hiddenCategories, hiddenMarkers, query, recordTitleByLink });
  }

  function fitMap() {
    mapController?.fit?.();
  }

  function centerMarker(markerId) {
    return mapController?.focusMarker?.(markerId) ?? false;
  }


  function renderCategories() {
    if (!categoriesEl) return;
    const recordsByKey = recordMap();
    categoriesEl.innerHTML = state.categories.map((category) => {
      const hidden = hiddenCategories.has(category.id);
      const categoryMarkers = state.markers.filter((marker) => marker.categoryId === category.id);
      const visibleCount = categoryMarkers.filter((marker) => !hidden && !hiddenMarkers.has(marker.id)).length;
      const hasHiddenPoints = categoryMarkers.some((marker) => hiddenMarkers.has(marker.id));
      const countLabel = hidden || hasHiddenPoints ? `${visibleCount}/${categoryMarkers.length}` : String(categoryMarkers.length);
      const deletable = isGM && !DEFAULT_CATEGORY_IDS.has(category.id);
      const controls = isGM
        ? `<span class="world-city-map-category-controls"><button type="button" data-world-map-edit-category="${esc(category.id)}" title="Изменить категорию"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>${deletable ? `<button type="button" data-world-map-delete-category="${esc(category.id)}" title="Удалить категорию"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>` : ""}</span>`
        : "";
      const selected = category.id === selectedCategoryId;
      const expanded = expandedCategories.has(category.id);
      const visibilityTitle = hidden ? "Показать точки этой категории на карте" : "Отключить точки этой категории на карте";
      const visibilityIcon = hidden ? "fa-square" : "fa-square-check";
      const pointRows = expanded
        ? `<div class="world-city-map-category-points" data-world-map-category-points="${esc(category.id)}">${categoryMarkers.length ? categoryMarkers.map((marker) => {
            const pointHidden = hiddenMarkers.has(marker.id);
            const effectiveHidden = hidden || pointHidden;
            const linkSummary = markerLinkSummary(marker, recordsByKey);
            return `<div class="world-city-map-category-point ${effectiveHidden ? "map-off" : ""}" data-world-map-category-marker="${esc(marker.id)}" style="--world-map-marker-color:${esc(colorForMarker(state, marker))}"><button type="button" class="world-city-map-category-point-main" data-world-map-focus-marker="${esc(marker.id)}" title="Показать «${esc(marker.title)}» на карте">${worldMapIconHtml(iconForMarker(state, marker), { className: "world-city-map-category-point-icon" })}<span><b>${esc(marker.title || "Без названия")}</b>${linkSummary ? `<small>${esc(linkSummary)}</small>` : ""}</span></button><button type="button" class="world-city-map-category-point-visibility" data-world-map-toggle-marker="${esc(marker.id)}" title="${pointHidden ? "Показать эту точку на карте" : "Отключить эту точку на карте"}"><i class="fa-solid ${pointHidden ? "fa-square" : "fa-square-check"}" aria-hidden="true"></i></button></div>`;
          }).join("") : '<p class="world-city-map-category-empty">В этой категории пока нет точек.</p>'}</div>`
        : "";
      return `<div class="world-city-map-category ${hidden ? "map-off" : ""} ${selected ? "selected" : ""} ${expanded ? "expanded" : ""}" style="--world-map-category-color:${esc(category.color || "#f6c85f")}"><div class="world-city-map-category-main"><button type="button" class="world-city-map-category-expand" data-world-map-expand-category="${esc(category.id)}" title="${expanded ? "Свернуть список точек" : "Развернуть список точек"}"><i class="fa-solid ${expanded ? "fa-chevron-down" : "fa-chevron-right"}" aria-hidden="true"></i></button><button type="button" class="world-city-map-category-select" data-world-map-select-category="${esc(category.id)}" title="Выбрать категорию для новой точки"><span class="world-city-map-category-name">${worldMapIconHtml(category.icon, { className: "world-city-map-category-icon" })}<b class="world-city-map-category-label">${esc(category.label)}</b></span><i>${esc(countLabel)}</i></button><button type="button" class="world-city-map-category-visibility" data-world-map-toggle-category="${esc(category.id)}" title="${visibilityTitle}"><i class="fa-solid ${visibilityIcon}" aria-hidden="true"></i></button>${controls}</div>${pointRows}</div>`;
    }).join("");
  }

  function renderMarkers() {
    if (!mapController) return;
    const markers = visibleMarkers().map((marker) => ({
      ...marker,
      html: markerButtonHtml(state, marker, marker.id === selectedMarkerId),
    }));
    mapController.setMarkers(markers);
  }


  function renderResults() {
    if (!resultsEl) return;
    const markers = visibleMarkers();
    resultsEl.innerHTML = markers.length
      ? markers.map((marker) => {
          const category = markerCategory(state, marker);
          const linkSummary = markerLinkSummary(marker, recordMap());
          return `<button type="button" class="world-city-map-result ${marker.id === selectedMarkerId ? "selected" : ""}" data-world-map-result="${esc(marker.id)}" style="--world-map-marker-color:${esc(colorForMarker(state, marker))}"><b>${worldMapIconHtml(iconForMarker(state, marker), { className: "world-city-map-result-icon" })}</b><span><strong>${esc(marker.title)}</strong><small>${esc(category.label)}${linkSummary ? ` · ${esc(linkSummary)}` : ""}</small></span></button>`;
        }).join("")
      : `<p class="world-city-map-no-results">Нет точек по текущему фильтру.</p>`;
  }

  function editorHtml(marker) {
    const records = catalog();
    const linked = new Set((marker.links ?? []).map(linkKey));
    const availableOptions = records.filter((record) => !linked.has(linkKey(record))).map((record) => `<option value="${esc(linkKey(record))}">${esc(recordLabel(record))}</option>`).join("");
    const linkedRows = (marker.links ?? []).map((link) => {
      const record = recordMap().get(linkKey(link));
      return `<div class="world-city-map-link-row"><span><b>${esc(recordTypeLabel(record || link))}</b><i>${esc(recordLinkLabel(record, link).replace(/^.*? — /u, ""))}</i></span><button type="button" data-world-map-unlink="${esc(linkKey(link))}" title="Удалить связь">×</button></div>`;
    }).join("") || '<p class="muted">Связей пока нет.</p>';
    const category = markerCategory(state, marker);
    return `<div class="world-city-map-editor" data-world-map-editor="${esc(marker.id)}"><header><div><small>GM // ТОЧКА ИНТЕРЕСА</small><h3>${esc(marker.title)}</h3></div><button type="button" data-world-map-action="close-editor">×</button></header><label><span>Название</span><input data-world-map-field="title" value="${esc(marker.title)}"></label><label><span>Категория</span><select data-world-map-field="categoryId">${state.categories.map((categoryItem) => `<option value="${esc(categoryItem.id)}" ${categoryItem.id === marker.categoryId ? "selected" : ""}>${esc(categoryItem.label)}</option>`).join("")}</select></label><label><span>Иконка</span>${iconPickerHtml({ target: "marker", value: marker.icon, inherit: true, effectiveIcon: category.icon })}</label><label><span>Цвет</span><span class="world-city-map-color-field"><input type="color" data-world-map-field="color" value="${esc(marker.color || category.color || "#f6c85f")}"><label><input type="checkbox" data-world-map-color-inherit ${marker.color ? "" : "checked"}> Цвет категории</label></span></label><label class="wide"><span>Описание</span><textarea data-world-map-field="description" rows="4">${esc(marker.description)}</textarea></label><section class="world-city-map-editor-links"><h4>Связанные записи</h4>${linkedRows}<div class="world-city-map-link-add"><select data-world-map-link-select><option value="">Выберите запись архива…</option>${availableOptions}</select><button type="button" data-world-map-action="add-link" ${availableOptions ? "" : "disabled"}>+ Связь</button></div></section><footer><button type="button" class="danger" data-world-map-action="delete-marker">Удалить</button><button type="button" class="primary" data-world-map-action="save-marker">Сохранить</button></footer></div>`;
  }

  function detailLinksForMarker(marker) {
    const merged = new Map();
    for (const link of Array.isArray(marker?.links) ? marker.links : []) merged.set(linkKey(link), link);
    if (activeActorId && marker?.id) {
      for (const personal of personalLinksForMarker({ actorId: activeActorId, markerId: marker.id })) {
        const link = { actorId: activeActorId, section: personal.section, entryId: personal.entryId };
        if (!merged.has(linkKey(link))) merged.set(linkKey(link), link);
      }
    }
    return [...merged.values()];
  }

  function detailHtml(marker) {
    if (!marker) return "";
    const category = markerCategory(state, marker);
    const links = detailLinksForMarker(marker).map((link) => {
      const record = recordMap().get(linkKey(link));
      const label = recordLinkLabel(record, link);
      return `<button type="button" data-world-map-open-link="${esc(linkKey(link))}" title="Открыть связанную запись"><span><b>${esc(recordTypeLabel(record || link))}</b><i>${esc(label.replace(/^.*? — /u, ""))}</i></span><strong>→</strong></button>`;
    }).join("");
    return `<article class="world-city-map-detail" style="--world-map-marker-color:${esc(colorForMarker(state, marker))}"><header><b>${worldMapIconHtml(iconForMarker(state, marker), { className: "world-city-map-detail-icon" })}</b><div><small>${esc(category.label)}</small><h3>${esc(marker.title)}</h3></div>${isGM ? '<button type="button" data-world-map-action="edit-marker">✎</button>' : ""}</header>${marker.description ? `<p>${esc(marker.description).replaceAll("\n", "<br>")}</p>` : '<p class="muted">Описание не добавлено.</p>'}${links ? `<div class="world-city-map-detail-links">${links}</div>` : ""}</article>`;
  }

  function renderInspector() {
    if (!inspector) return;
    const marker = state.markers.find((item) => item.id === (editorMarkerId || selectedMarkerId));
    if (!marker) { inspector.innerHTML = ""; return; }
    inspector.innerHTML = editorMarkerId && isGM ? editorHtml(marker) : detailHtml(marker);
  }

  async function syncLeafletMap() {
    if (destroyed || !mapHost) return;
    const useCustomImage = state.backgroundMode === "image" && Boolean(state.image);
    const sourceKey = useCustomImage ? `image:${state.image}` : `tileset:${state.tileset || "night-city-2045"}`;

    if (mapController && mapSourceKey === sourceKey) {
      mapController.setPlacementMode(placementMode);
      renderMarkers();
      return;
    }

    const serial = ++mapInitSerial;
    mapController?.destroy?.();
    mapController = null;
    mapSourceKey = sourceKey;
    if (empty) empty.innerHTML = emptyHtml();

    try {
      const controller = await createWorldCityLeafletMap(mapHost, {
        image: useCustomImage ? state.image : "",
        isGM,
        onMarkerClick(markerId) {
          if (destroyed) return;
          selectedMarkerId = clean(markerId);
          editorMarkerId = "";
          renderResults();
          renderMarkers();
          renderInspector();
        },
        onMarkerDragEnd(markerId, point) {
          if (!isGM || destroyed) return;
          void updateWorldMapMarker(markerId, point).then(() => {
            if (destroyed) return;
            selectedMarkerId = clean(markerId);
            editorMarkerId = "";
            refresh();
          }).catch((error) => {
            console.error("Cyberpunk Remaster | world map marker drag failed", error);
            globalThis.ui?.notifications?.error?.(`Не удалось переместить точку: ${error?.message || error}`);
          });
        },
        onMapClick(point) {
          if (!placementMode || !isGM || destroyed) return;
          void createMarkerAt(point);
        },
        onImageError() {
          if (!useCustomImage || !empty) return;
          empty.innerHTML = `<div class="world-city-map-empty"><b>!</b><h2>Не удалось открыть пользовательскую карту</h2><p>${esc(state.image)}</p>${isGM ? '<button type="button" data-world-map-action="clear-image">Вернуть встроенный тайловый атлас</button>' : ""}</div>`;
        },
      });

      if (destroyed || serial !== mapInitSerial) {
        controller.destroy();
        return;
      }

      mapController = controller;
      if (empty) empty.innerHTML = "";
      mapController.setPlacementMode(placementMode);
      renderMarkers();
      if (selectedMarkerId) mapController.focusMarker(selectedMarkerId, { zoom: context.focusZoom });
    } catch (error) {
      if (destroyed || serial !== mapInitSerial) return;
      console.error("Cyberpunk Remaster | Leaflet world map initialization failed", error);
      if (empty) {
        empty.innerHTML = `<div class="world-city-map-empty"><b>!</b><h2>Не удалось запустить карту Найт-Сити</h2><p>${esc(error?.message || error)}</p>${isGM && state.image ? '<button type="button" data-world-map-action="clear-image">Вернуть встроенную карту</button>' : ""}</div>`;
      }
    }
  }

  function refresh(nextState = null) {
    if (destroyed) return;
    state = nextState ? clone(nextState) : getWorldCityMap();
    titleEl && (titleEl.textContent = state.title || "Карта Найт-Сити");
    modeEl && (modeEl.textContent = placementMode ? `КЛИКНИТЕ ПО КАРТЕ — ${categoryLabel(state, selectedCategoryId) || "НОВАЯ ТОЧКА"}` : isGM ? "GM // EDIT" : "VIEW");
    viewport?.classList?.toggle?.("placing", placementMode);
    const addMarkerButton = host.querySelector?.('[data-world-map-action="add-marker"]');
    if (addMarkerButton) {
      addMarkerButton.classList.toggle("active", placementMode);
      addMarkerButton.textContent = placementMode ? "× Отмена" : "+ Точка";
      addMarkerButton.title = placementMode ? "Отменить постановку точки" : `Поставить точку категории «${categoryLabel(state, selectedCategoryId) || "Интерес"}»`;
    }
    shell?.classList?.toggle?.("sidebar-collapsed", sidebarCollapsed);
    if (sidebarToggle) {
      sidebarToggle.title = sidebarCollapsed ? "Развернуть панель карты" : "Свернуть панель карты";
      sidebarToggle.innerHTML = `<i class="fa-solid ${sidebarCollapsed ? "fa-angles-right" : "fa-angles-left"}" aria-hidden="true"></i>`;
    }
    gmSection?.classList?.toggle?.("collapsed", gmPanelCollapsed);
    gmToggle?.setAttribute?.("title", gmPanelCollapsed ? "Развернуть блок GM" : "Свернуть блок GM");
    if (gmToggle) gmToggle.innerHTML = `<i class="fa-solid ${gmPanelCollapsed ? "fa-chevron-down" : "fa-chevron-up"}" aria-hidden="true"></i>`;
    renderCategories();
    renderResults();
    renderMarkers();
    renderInspector();
    mapController?.setPlacementMode?.(placementMode);
    void syncLeafletMap();
  }

  async function createMarkerAt(point) {
    if (!isGM || !placementMode) return null;
    const categoryId = state.categories.some((category) => category.id === selectedCategoryId) ? selectedCategoryId : "poi";
    try {
      const marker = await createWorldMapMarker({ x: point?.x, y: point?.y, title: "Новая точка", categoryId });
      if (!marker?.id) throw new Error("Маркер не был создан");
      placementMode = false;
      selectedMarkerId = marker.id;
      editorMarkerId = marker.id;
      refresh();
      return marker;
    } catch (error) {
      console.error("Cyberpunk Remaster | world map marker creation failed", error);
      globalThis.ui?.notifications?.error?.(`Не удалось создать точку на карте: ${error?.message || error}`);
      refresh();
      return null;
    }
  }


  function focusMarkerFromFilter(markerId) {
    return mapController?.focusMarker?.(markerId, { zoom: WORLD_MAP_ARCHIVE_FOCUS_ZOOM }) ?? false;
  }


  host.addEventListener("input", (event) => {
    if (event.target.matches?.("[data-world-map-search]")) {
      query = event.target.value;
      renderResults();
      renderMarkers();
      return;
    }
    if (event.target.matches?.('[data-world-map-field="color"]')) {
      const editor = event.target.closest?.("[data-world-map-editor]");
      const inherit = editor?.querySelector?.("[data-world-map-color-inherit]");
      if (inherit) inherit.checked = false;
    }
  });

  host.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches?.('[data-world-map-field="categoryId"]')) {
      const category = state.categories.find((item) => item.id === target.value);
      const picker = inspector?.querySelector?.('[data-world-map-icon-picker="marker"]');
      const iconInput = picker?.querySelector?.('[data-world-map-field="icon"]');
      const editor = inspector?.querySelector?.("[data-world-map-editor]");
      const inheritColor = editor?.querySelector?.("[data-world-map-color-inherit]");
      const colorInput = editor?.querySelector?.('[data-world-map-field="color"]');
      if (picker && category) {
        picker.dataset.worldMapEffectiveIcon = category.icon || "fa:fa-location-dot";
        if (!clean(iconInput?.value)) setIconPickerValue(picker, "", { effectiveIcon: category.icon });
      }
      if (category && inheritColor?.checked && colorInput) colorInput.value = category.color || "#f6c85f";
      return;
    }
    if (target.matches?.("[data-world-map-color-inherit]")) {
      const editor = target.closest?.("[data-world-map-editor]");
      const categoryId = editor?.querySelector?.('[data-world-map-field="categoryId"]')?.value;
      const category = state.categories.find((item) => item.id === categoryId);
      const colorInput = editor?.querySelector?.('[data-world-map-field="color"]');
      if (target.checked && colorInput) colorInput.value = category?.color || "#f6c85f";
    }
  });

  host.addEventListener("click", async (event) => {
    const iconTrigger = event.target.closest?.("[data-world-map-icon-trigger]");
    if (iconTrigger) {
      const picker = iconTrigger.closest?.("[data-world-map-icon-picker]");
      const grid = picker?.querySelector?.("[data-world-map-icon-grid]");
      for (const other of host.querySelectorAll?.("[data-world-map-icon-grid]") ?? []) {
        if (other !== grid) other.hidden = true;
      }
      if (grid) grid.hidden = !grid.hidden;
      return;
    }
    const iconChoice = event.target.closest?.("[data-world-map-icon-choice]");
    if (iconChoice) {
      const picker = iconChoice.closest?.("[data-world-map-icon-picker]");
      setIconPickerValue(picker, iconChoice.dataset.worldMapIconChoice ?? "");
      const grid = picker?.querySelector?.("[data-world-map-icon-grid]");
      if (grid) grid.hidden = true;
      return;
    }
    const expandCategory = event.target.closest?.("[data-world-map-expand-category]");
    if (expandCategory) {
      const id = clean(expandCategory.dataset.worldMapExpandCategory);
      if (expandedCategories.has(id)) expandedCategories.delete(id); else expandedCategories.add(id);
      renderCategories();
      return;
    }
    const markerVisibility = event.target.closest?.("[data-world-map-toggle-marker]");
    if (markerVisibility) {
      const id = clean(markerVisibility.dataset.worldMapToggleMarker);
      if (hiddenMarkers.has(id)) hiddenMarkers.delete(id); else hiddenMarkers.add(id);
      saveHiddenMarkers(hiddenMarkers);
      renderCategories();
      renderResults();
      renderMarkers();
      if (selectedMarkerId === id) renderInspector();
      return;
    }
    const markerFocus = event.target.closest?.("[data-world-map-focus-marker]");
    if (markerFocus) {
      const id = clean(markerFocus.dataset.worldMapFocusMarker);
      const marker = state.markers.find((item) => item.id === id);
      if (marker) {
        hiddenCategories.delete(marker.categoryId);
        hiddenMarkers.delete(id);
        saveHiddenCategories(hiddenCategories);
        saveHiddenMarkers(hiddenMarkers);
        selectedMarkerId = id;
        editorMarkerId = "";
        renderCategories(); renderResults(); renderMarkers(); renderInspector(); focusMarkerFromFilter(id);
      }
      return;
    }
    const categorySelect = event.target.closest?.("[data-world-map-select-category]");
    if (categorySelect) {
      const id = clean(categorySelect.dataset.worldMapSelectCategory);
      if (state.categories.some((category) => category.id === id)) {
        selectedCategoryId = id;
        hiddenCategories.delete(id);
        saveHiddenCategories(hiddenCategories);
        renderCategories();
        renderResults();
        renderMarkers();
      }
      return;
    }
    const categoryToggle = event.target.closest?.("[data-world-map-toggle-category]");
    if (categoryToggle) {
      const id = clean(categoryToggle.dataset.worldMapToggleCategory);
      if (hiddenCategories.has(id)) hiddenCategories.delete(id); else hiddenCategories.add(id);
      saveHiddenCategories(hiddenCategories);
      renderCategories();
      renderResults();
      renderMarkers();
      return;
    }
    const resultButton = event.target.closest?.("[data-world-map-result]");
    if (resultButton) {
      selectedMarkerId = resultButton.dataset.worldMapResult;
      editorMarkerId = "";
      renderResults(); renderMarkers(); renderInspector(); centerMarker(selectedMarkerId);
      return;
    }
    const openLink = event.target.closest?.("[data-world-map-open-link]");
    if (openLink) {
      const link = parseLinkKey(openLink.dataset.worldMapOpenLink);
      if (link) await context.openArchiveLink?.(link);
      return;
    }
    const unlink = event.target.closest?.("[data-world-map-unlink]");
    if (unlink && isGM && editorMarkerId) {
      const link = parseLinkKey(unlink.dataset.worldMapUnlink);
      if (link) await unlinkMarkerFromArchiveEntry(editorMarkerId, link);
      refresh();
      return;
    }
    const editCategory = event.target.closest?.("[data-world-map-edit-category]");
    if (editCategory && isGM) {
      const category = state.categories.find((item) => item.id === editCategory.dataset.worldMapEditCategory);
      if (category) {
        categoryEditId = category.id;
        const labelInput = host.querySelector?.("[data-world-map-new-category-label]");
        const iconInput = host.querySelector?.("[data-world-map-new-category-icon]");
        const colorInput = host.querySelector?.("[data-world-map-new-category-color]");
        const editingLabel = host.querySelector?.("[data-world-map-category-editing]");
        if (labelInput) labelInput.value = category.label;
        if (iconInput) iconInput.value = category.icon;
        setIconPickerValue(host.querySelector?.('[data-world-map-icon-picker="category"]'), category.icon);
        if (colorInput) colorInput.value = category.color || "#f6c85f";
        if (editingLabel) editingLabel.textContent = `Редактирование: ${category.label}`;
      }
      return;
    }
    const deleteCategory = event.target.closest?.("[data-world-map-delete-category]");
    if (deleteCategory && isGM) {
      const id = deleteCategory.dataset.worldMapDeleteCategory;
      if (globalThis.confirm?.(`Удалить категорию «${categoryLabel(state, id)}»?`)) await deleteWorldMapCategory(id);
      refresh();
      return;
    }
    const button = event.target.closest?.("[data-world-map-action]");
    if (!button) return;
    const action = button.dataset.worldMapAction;
    if (action === "toggle-sidebar") {
      sidebarCollapsed = !sidebarCollapsed;
      saveClientFlag(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed);
      refresh();
      setTimeout(() => mapController?.invalidateSize?.(), 0);
      return;
    }
    if (action === "toggle-gm" && isGM) {
      gmSection?.classList?.toggle?.("collapsed");
      gmPanelCollapsed = Boolean(gmSection?.classList?.contains?.("collapsed"));
      saveClientFlag(GM_PANEL_COLLAPSED_KEY, gmPanelCollapsed);
      if (gmToggle) {
        gmToggle.title = gmPanelCollapsed ? "Развернуть блок GM" : "Свернуть блок GM";
        gmToggle.innerHTML = `<i class="fa-solid ${gmPanelCollapsed ? "fa-chevron-down" : "fa-chevron-up"}" aria-hidden="true"></i>`;
      }
      return;
    }
    if (action === "zoom-in") { mapController?.zoomIn?.(); return; }
    if (action === "zoom-out") { mapController?.zoomOut?.(); return; }
    if (action === "reset-view") { fitMap(); return; }
    if (action === "show-all-categories") {
      hiddenCategories.clear();
      hiddenMarkers.clear();
      saveHiddenCategories(hiddenCategories);
      saveHiddenMarkers(hiddenMarkers);
      renderCategories();
      renderResults();
      renderMarkers();
      return;
    }
    if (action === "add-marker" && isGM) {
      placementMode = !placementMode;
      if (placementMode) {
        hiddenCategories.delete(selectedCategoryId);
        saveHiddenCategories(hiddenCategories);
      }
      refresh();
      return;
    }
    if (action === "pick-image" && isGM) {
      await pickImage(state.image, async (path) => { if (path) { await setWorldMapImage(path); refresh(); } });
      return;
    }
    if (action === "clear-image" && isGM) {
      if (globalThis.confirm?.("Вернуться к встроенному тайловому атласу Найт-Сити? Точки интереса сохранятся.")) { await useBuiltInWorldMapTiles(); refresh(); }
      return;
    }
    if (action === "edit-marker" && isGM && selectedMarkerId) { editorMarkerId = selectedMarkerId; renderInspector(); return; }
    if (action === "close-editor") { editorMarkerId = ""; renderInspector(); return; }
    if (action === "save-marker" && isGM && editorMarkerId) {
      const editor = inspector.querySelector?.("[data-world-map-editor]");
      const patch = {};
      for (const field of editor?.querySelectorAll?.("[data-world-map-field]") ?? []) patch[field.dataset.worldMapField] = field.value;
      if (editor?.querySelector?.("[data-world-map-color-inherit]")?.checked) patch.color = "";
      await updateWorldMapMarker(editorMarkerId, patch);
      editorMarkerId = ""; refresh(); return;
    }
    if (action === "delete-marker" && isGM && editorMarkerId) {
      const marker = state.markers.find((item) => item.id === editorMarkerId);
      if (globalThis.confirm?.(`Удалить точку «${marker?.title || "Без названия"}»?`)) {
        await deleteWorldMapMarker(editorMarkerId);
        selectedMarkerId = ""; editorMarkerId = ""; refresh();
      }
      return;
    }
    if (action === "add-link" && isGM && editorMarkerId) {
      const select = inspector.querySelector?.("[data-world-map-link-select]");
      const link = parseLinkKey(select?.value);
      if (link) await linkMarkerToArchiveEntry(editorMarkerId, link);
      refresh(); return;
    }
    if (action === "add-category" && isGM) {
      const labelInput = host.querySelector?.("[data-world-map-new-category-label]");
      const iconInput = host.querySelector?.("[data-world-map-new-category-icon]");
      const colorInput = host.querySelector?.("[data-world-map-new-category-color]");
      const editingLabel = host.querySelector?.("[data-world-map-category-editing]");
      const label = clean(labelInput?.value);
      if (!label) return;
      const id = categoryEditId || label.toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/gu, "") || `cat-${Date.now().toString(36)}`;
      await upsertWorldMapCategory({ id, label, icon: clean(iconInput?.value) || "fa:fa-location-dot", color: clean(colorInput?.value) || "#f6c85f" });
      categoryEditId = "";
      if (labelInput) labelInput.value = "";
      if (iconInput) iconInput.value = "fa:fa-location-dot";
      setIconPickerValue(host.querySelector?.('[data-world-map-icon-picker="category"]'), "fa:fa-location-dot");
      if (colorInput) colorInput.value = "#f6c85f";
      if (editingLabel) editingLabel.textContent = "Новая категория";
      refresh();
      return;
    }
    if (action === "cancel-category-edit" && isGM) {
      categoryEditId = "";
      const labelInput = host.querySelector?.("[data-world-map-new-category-label]");
      const iconInput = host.querySelector?.("[data-world-map-new-category-icon]");
      const colorInput = host.querySelector?.("[data-world-map-new-category-color]");
      const editingLabel = host.querySelector?.("[data-world-map-category-editing]");
      if (labelInput) labelInput.value = "";
      if (iconInput) iconInput.value = "fa:fa-location-dot";
      setIconPickerValue(host.querySelector?.('[data-world-map-icon-picker="category"]'), "fa:fa-location-dot");
      if (colorInput) colorInput.value = "#f6c85f";
      if (editingLabel) editingLabel.textContent = "Новая категория";
      return;
    }
  });



  const onMapChanged = (next) => refresh(next);
  if (globalThis.Hooks?.on) hookId = globalThis.Hooks.on(WORLD_CITY_MAP_HOOK, onMapChanged);

  refresh();
  if (selectedMarkerId) centerMarker(selectedMarkerId);

  return {
    refresh,
    focusMarker(markerId) {
      selectedMarkerId = clean(markerId);
      editorMarkerId = "";
      refresh();
      centerMarker(selectedMarkerId);
    },
    destroy() {
      destroyed = true;
      mapInitSerial += 1;
      mapController?.destroy?.();
      mapController = null;
      if (hookId !== null && globalThis.Hooks?.off) globalThis.Hooks.off(WORLD_CITY_MAP_HOOK, hookId);
      host.innerHTML = "";
    },
  };
}
