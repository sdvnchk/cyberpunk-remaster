import { getWorldCityMap } from "./world-city-map.mjs";

const MODULE_ID = "cyberpunk-remaster";
const FLAG_KEY = "worldCityMapPersonalLinksV1";
const PERSONAL_LINKS_VERSION = 1;
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

const clean = (value) => String(value ?? "").trim();
const clone = (value) => {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)); }
};

function normalizeLink(raw) {
  const markerId = clean(raw?.markerId);
  const section = clean(raw?.section);
  const entryId = clean(raw?.entryId);
  if (!markerId || !entryId || !ARCHIVE_SECTIONS.has(section)) return null;
  return { markerId, section, entryId };
}

function sameLink(a, b) {
  return clean(a?.markerId) === clean(b?.markerId)
    && clean(a?.section) === clean(b?.section)
    && clean(a?.entryId) === clean(b?.entryId);
}

function normalizePayload(raw) {
  const actors = {};
  const sourceActors = raw?.actors && typeof raw.actors === "object" ? raw.actors : {};
  for (const [actorIdRaw, linksRaw] of Object.entries(sourceActors)) {
    const actorId = clean(actorIdRaw);
    if (!actorId) continue;
    const links = [];
    for (const rawLink of Array.isArray(linksRaw) ? linksRaw : []) {
      const link = normalizeLink(rawLink);
      if (link && !links.some((existing) => sameLink(existing, link))) links.push(link);
    }
    if (links.length) actors[actorId] = links;
  }
  return { version: PERSONAL_LINKS_VERSION, actors };
}

function currentUser() {
  const user = globalThis.game?.user;
  if (!user) throw new Error("Не найден текущий пользователь Foundry.");
  return user;
}

function markerIdSet() {
  return new Set((getWorldCityMap()?.markers ?? []).map((marker) => clean(marker?.id)).filter(Boolean));
}

function readPayload() {
  const user = currentUser();
  return normalizePayload(user.getFlag?.(MODULE_ID, FLAG_KEY));
}

function visibleLinksForActor(payload, actorId) {
  const markerIds = markerIdSet();
  return (payload.actors[clean(actorId)] ?? []).filter((link) => markerIds.has(link.markerId));
}

function actorOwnedByCurrentUser(actorId) {
  const user = currentUser();
  if (user.isGM) return true;
  const actor = globalThis.game?.actors?.get?.(clean(actorId));
  if (!actor) return false;
  if (typeof actor.testUserPermission === "function") return Boolean(actor.testUserPermission(user, "OWNER"));
  if (typeof actor.isOwner === "boolean") return actor.isOwner;
  const level = Number(actor.ownership?.[user.id] ?? actor.ownership?.default ?? 0);
  return level >= 3;
}

function validateWriteInput({ actorId, section, entryId, markerId }) {
  const normalized = {
    actorId: clean(actorId),
    section: clean(section),
    entryId: clean(entryId),
    markerId: clean(markerId),
  };
  if (!normalized.actorId || !normalized.entryId || !normalized.markerId) {
    throw new Error("Для личной связи нужны персонаж, запись архива и точка карты.");
  }
  if (!ARCHIVE_SECTIONS.has(normalized.section)) throw new Error("Недопустимый раздел архива для личной связи.");
  if (!actorOwnedByCurrentUser(normalized.actorId)) throw new Error("Нельзя изменять личные связи персонажа, которым вы не владеете.");
  if (!markerIdSet().has(normalized.markerId)) throw new Error("Выбранная точка карты больше не существует.");
  return normalized;
}

async function writePayload(payload) {
  const user = currentUser();
  if (typeof user.setFlag !== "function") throw new Error("Foundry не поддерживает сохранение личных связей пользователя.");
  const normalized = normalizePayload(payload);
  await user.setFlag(MODULE_ID, FLAG_KEY, clone(normalized));
  return normalized;
}

export function getPersonalWorldMapLinks(actorId) {
  const payload = readPayload();
  return clone(visibleLinksForActor(payload, actorId));
}

export function personalLinksForArchiveEntry({ actorId, section, entryId } = {}) {
  const wantedSection = clean(section);
  const wantedEntry = clean(entryId);
  return getPersonalWorldMapLinks(actorId).filter((link) => link.section === wantedSection && link.entryId === wantedEntry);
}

export function personalLinksForMarker({ actorId, markerId } = {}) {
  const wantedMarker = clean(markerId);
  return getPersonalWorldMapLinks(actorId).filter((link) => link.markerId === wantedMarker);
}

export async function addPersonalWorldMapLink(input = {}) {
  const { actorId, section, entryId, markerId } = validateWriteInput(input);
  const payload = readPayload();
  const links = visibleLinksForActor(payload, actorId);
  const next = { markerId, section, entryId };
  if (!links.some((existing) => sameLink(existing, next))) links.push(next);
  if (links.length) payload.actors[actorId] = links;
  else delete payload.actors[actorId];
  await writePayload(payload);
  return clone(next);
}

export async function removePersonalWorldMapLink(input = {}) {
  const { actorId, section, entryId, markerId } = validateWriteInput(input);
  const payload = readPayload();
  const before = visibleLinksForActor(payload, actorId);
  const after = before.filter((link) => !sameLink(link, { markerId, section, entryId }));
  const removed = after.length !== before.length;
  if (after.length) payload.actors[actorId] = after;
  else delete payload.actors[actorId];
  await writePayload(payload);
  return removed;
}
