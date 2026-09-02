const CANONICAL_SCOPE = "cyberpunkRemaster";
const CANONICAL_PATH = "neuroArchive.data";

export const UNIFIED_ARCHIVE_VERSION = 3;
export const LEGACY_MIGRATION_VERSION = 1;
export const AUTO_MIGRATION_VERSION = 1;
export const UNIFIED_ARCHIVE_SECTIONS = Object.freeze([
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

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const clone = (value) => {
  if (value === undefined) return undefined;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
};


const ARCHIVE_APPEARANCE_MODES = Object.freeze(["neuro", "cyber", "neo"]);

function normalizeArchiveAppearanceMode(mode) {
  const value = String(mode || "").trim().toLowerCase();
  return ARCHIVE_APPEARANCE_MODES.includes(value) ? value : "neuro";
}

function ensureArchiveAppearanceMap(notebook) {
  if (!isObject(notebook)) return {};
  const current = isObject(notebook.archiveAppearances) ? notebook.archiveAppearances : {};
  const legacy = isObject(notebook.appearance) ? notebook.appearance : {};
  notebook.archiveAppearances = current;
  for (const mode of ARCHIVE_APPEARANCE_MODES) {
    if (!isObject(current[mode])) current[mode] = clone(legacy);
  }
  return current;
}

export function readArchiveAppearance(notebook, mode = "neuro") {
  if (!isObject(notebook)) return {};
  const key = normalizeArchiveAppearanceMode(mode);
  return ensureArchiveAppearanceMap(notebook)[key] ?? {};
}

export function writeArchiveAppearance(notebook, mode = "neuro", appearance = {}) {
  if (!isObject(notebook)) return {};
  const key = normalizeArchiveAppearanceMode(mode);
  const map = ensureArchiveAppearanceMap(notebook);
  map[key] = clone(isObject(appearance) ? appearance : {});
  // Keep the old field as a compatibility mirror for older Neuro Archive exports.
  if (key === "neuro") notebook.appearance = clone(map[key]);
  return map[key];
}

function timestamp(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function newerFirst(left, right) {
  return timestamp(right?.updatedAt) > timestamp(left?.updatedAt)
    ? [left, right]
    : [right, left];
}

function mergeArrays(left = [], right = []) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  const allObjectsWithIds = [...a, ...b].every(
    (item) => !isObject(item) || String(item?.id ?? "").trim(),
  );

  if (allObjectsWithIds && [...a, ...b].some(isObject)) {
    const order = [];
    const byId = new Map();
    for (const item of [...a, ...b]) {
      if (!isObject(item)) continue;
      const id = String(item.id ?? "").trim();
      if (!id) continue;
      if (!byId.has(id)) order.push(id);
      const previous = byId.get(id);
      byId.set(id, previous ? mergeRecords(previous, item) : clone(item));
    }
    return order.map((id) => byId.get(id));
  }

  if ([...a, ...b].every((item) => !isObject(item))) {
    const seen = new Set();
    const out = [];
    for (const item of [...a, ...b]) {
      const key = `${typeof item}:${String(item)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(clone(item));
    }
    return out;
  }

  return clone(b.length ? b : a);
}

function mergeValues(base, incoming, incomingWins) {
  if (base === undefined) return clone(incoming);
  if (incoming === undefined) return clone(base);
  if (Array.isArray(base) || Array.isArray(incoming)) {
    return mergeArrays(base, incoming);
  }
  if (isObject(base) && isObject(incoming)) {
    return mergePlainObjects(base, incoming, incomingWins);
  }
  return clone(incomingWins ? incoming : base);
}

function mergePlainObjects(base = {}, incoming = {}, incomingWins = false) {
  const result = {};
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(incoming ?? {})]);
  for (const key of keys) {
    result[key] = mergeValues(base?.[key], incoming?.[key], incomingWins);
  }
  return result;
}

function mergeRecords(left = {}, right = {}) {
  if (!isObject(left)) return clone(right);
  if (!isObject(right)) return clone(left);
  const incomingWins = timestamp(right.updatedAt) > timestamp(left.updatedAt);
  return mergePlainObjects(left, right, incomingWins);
}

function mergeEntrySections(left = {}, right = {}) {
  const result = {};
  const sections = new Set([
    ...UNIFIED_ARCHIVE_SECTIONS,
    ...Object.keys(left ?? {}),
    ...Object.keys(right ?? {}),
  ]);
  for (const section of sections) {
    result[section] = mergeArrays(left?.[section], right?.[section]);
  }
  return result;
}

function mergeNotebook(left = {}, right = {}) {
  const [older, newer] = newerFirst(left, right);
  const merged = mergePlainObjects(older, newer, true);
  merged.entries = mergeEntrySections(left?.entries, right?.entries);
  merged.contactGroups = mergePlainObjects(
    left?.contactGroups ?? {},
    right?.contactGroups ?? {},
    timestamp(right?.updatedAt) > timestamp(left?.updatedAt),
  );
  return merged;
}

function normalizeStoreShape(raw) {
  const store = isObject(raw) ? clone(raw) : {};
  store.version = Math.max(Number(store.version) || 0, UNIFIED_ARCHIVE_VERSION);
  store.updatedAt = String(store.updatedAt ?? "");
  store.activeActorId = store.activeActorId ?? null;
  store.notebooks = isObject(store.notebooks) ? store.notebooks : {};
  for (const [actorId, notebookRaw] of Object.entries(store.notebooks)) {
    const notebook = isObject(notebookRaw) ? notebookRaw : {};
    notebook.actorId ??= actorId;
    notebook.entries = mergeEntrySections(notebook.entries, {});
    store.notebooks[actorId] = notebook;
  }
  return store;
}

function finalizeStoreShape(raw) {
  const store = normalizeStoreShape(raw);
  for (const [actorId, notebook] of Object.entries(store.notebooks ?? {})) {
    notebook.actorId ??= actorId;
    notebook.contactGroups = isObject(notebook.contactGroups)
      ? notebook.contactGroups
      : { lawman: [], noosphere: [], nomad: [] };
    notebook.cityMap = isObject(notebook.cityMap)
      ? notebook.cityMap
      : { title: "Карта Найт-Сити", image: "", notes: "" };
    notebook.entries = mergeEntrySections(notebook.entries, {});
  }
  return store;
}

export function mergeArchiveStores(...sources) {
  const usable = sources.filter(isObject).map(normalizeStoreShape);
  if (!usable.length) return finalizeStoreShape({});

  let result = normalizeStoreShape(usable[0]);
  for (const incoming of usable.slice(1)) {
    const incomingIsNewer = timestamp(incoming.updatedAt) > timestamp(result.updatedAt);
    const top = mergePlainObjects(result, incoming, incomingIsNewer);
    top.notebooks = { ...(result.notebooks ?? {}) };
    for (const [actorId, notebook] of Object.entries(incoming.notebooks ?? {})) {
      top.notebooks[actorId] = top.notebooks[actorId]
        ? mergeNotebook(top.notebooks[actorId], notebook)
        : clone(notebook);
    }
    top.version = Math.max(
      UNIFIED_ARCHIVE_VERSION,
      Number(result.version) || 0,
      Number(incoming.version) || 0,
    );
    if (!top.activeActorId) top.activeActorId = result.activeActorId ?? incoming.activeActorId ?? null;
    top.updatedAt =
      timestamp(incoming.updatedAt) > timestamp(result.updatedAt)
        ? incoming.updatedAt
        : result.updatedAt;
    result = normalizeStoreShape(top);
  }
  return finalizeStoreShape(result);
}

export function readUnifiedServerData(user = globalThis.game?.user) {
  const flags = user?.flags ?? user?.data?.flags ?? {};
  const canonical = flags.cyberpunkRemaster?.neuroArchive?.data ?? null;
  const migrated = Number(canonical?._unifiedArchive?.legacyMergedVersion || 0) >= LEGACY_MIGRATION_VERSION;
  if (migrated) return finalizeStoreShape(canonical);

  const fieldArchive = flags.nightCityFieldArchive?.data ?? null;
  const personalChronicle = flags.personalChronicleMacro?.data ?? null;
  const merged = mergeArchiveStores(canonical, fieldArchive, personalChronicle);
  merged._unifiedArchive = {
    ...(isObject(merged._unifiedArchive) ? merged._unifiedArchive : {}),
    legacyMergedVersion: LEGACY_MIGRATION_VERSION,
  };
  return finalizeStoreShape(merged);
}

export function appendUnifiedContactMessage(store, {
  actorId = "",
  contactId = "",
  message = null,
} = {}) {
  if (!isObject(store) || !isObject(message)) return false;
  const actorKey = String(actorId || "");
  const contactKey = String(contactId || "");
  if (!actorKey || !contactKey) return false;
  const notebook = store.notebooks?.[actorKey];
  const people = notebook?.entries?.people;
  if (!notebook || !Array.isArray(people)) return false;
  const person = people.find((entry) => String(entry?.id || "") === contactKey);
  if (!person) return false;

  person.messages = Array.isArray(person.messages) ? person.messages : [];
  const id = String(message.id || "").trim();
  if (id && person.messages.some((entry) => String(entry?.id || "") === id)) return false;
  person.messages.push(clone(message));
  const changedAt = String(message.createdAt || new Date().toISOString());
  person.updatedAt = changedAt;
  notebook.updatedAt = changedAt;
  store.updatedAt = changedAt;
  return true;
}


export function readUnifiedLocalData(storage = globalThis.localStorage, {
  canonicalKey = "",
  legacyKeys = [],
} = {}) {
  const readKey = (key) => {
    if (!key || !storage?.getItem) return null;
    try {
      const parsed = JSON.parse(storage.getItem(key) || "null");
      return isObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const canonical = readKey(canonicalKey);
  const migrated = Number(canonical?._unifiedArchive?.legacyMergedVersion || 0) >= LEGACY_MIGRATION_VERSION;
  if (migrated) return finalizeStoreShape(canonical);

  const legacy = Array.from(legacyKeys ?? []).map(readKey).filter(isObject);
  if (!canonical && !legacy.length) return null;
  const merged = mergeArchiveStores(canonical, ...legacy);
  merged._unifiedArchive = {
    ...(isObject(merged._unifiedArchive) ? merged._unifiedArchive : {}),
    legacyMergedVersion: LEGACY_MIGRATION_VERSION,
  };
  return finalizeStoreShape(merged);
}



function rawArchiveFlags(user = globalThis.game?.user) {
  return user?.flags ?? user?.data?.flags ?? {};
}

function readStorageObject(storage, key) {
  if (!key || typeof storage?.getItem !== "function") return null;
  try {
    const parsed = JSON.parse(storage.getItem(key) || "null");
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function legacyFieldArchiveLocalKey({
  worldId = globalThis.game?.world?.id ?? globalThis.game?.world?.data?._id ?? "world",
  userId = globalThis.game?.user?.id ?? globalThis.game?.user?._id ?? "user",
} = {}) {
  return `night-city-field-archive:${worldId}:${userId}`;
}

function legacyFieldArchiveLocalMarkerKey({ worldId, userId } = {}) {
  return `cyberpunk-remaster:field-archive-migration:${worldId}:${userId}:v${AUTO_MIGRATION_VERSION}`;
}

function archiveMigrationMeta(data) {
  return isObject(data?._unifiedArchive) ? data._unifiedArchive : {};
}

/**
 * Proactively imports the old Field Archive 7.1/7.3 storage for one Foundry User.
 * This is intentionally independent from opening any archive window.
 */
export async function migrateLegacyFieldArchiveUser(
  user = globalThis.game?.user,
  {
    worldId = globalThis.game?.world?.id ?? globalThis.game?.world?.data?._id ?? "world",
    includeLocal = false,
    storage = globalThis.localStorage,
  } = {},
) {
  if (!user) return { changed: false, serverMerged: false, localMerged: false, data: null };

  const userId = user.id ?? user._id ?? "user";
  const flags = rawArchiveFlags(user);
  const canonicalRaw = flags.cyberpunkRemaster?.neuroArchive?.data ?? null;
  const fieldArchive = flags.nightCityFieldArchive?.data ?? null;
  const personalChronicle = flags.personalChronicleMacro?.data ?? null;
  const canonicalMeta = archiveMigrationMeta(canonicalRaw);
  const serverAlreadyMerged =
    Number(canonicalMeta.legacyMergedVersion || 0) >= LEGACY_MIGRATION_VERSION;

  let data = canonicalRaw ? finalizeStoreShape(canonicalRaw) : null;
  let serverMerged = false;
  let localMerged = false;
  let changed = false;

  if (!serverAlreadyMerged && (isObject(fieldArchive) || isObject(personalChronicle))) {
    data = mergeArchiveStores(canonicalRaw, fieldArchive, personalChronicle);
    serverMerged = true;
    changed = true;
  } else if (!data && (isObject(fieldArchive) || isObject(personalChronicle))) {
    data = mergeArchiveStores(fieldArchive, personalChronicle);
  }

  if (data && !serverAlreadyMerged) {
    data._unifiedArchive = {
      ...archiveMigrationMeta(data),
      legacyMergedVersion: LEGACY_MIGRATION_VERSION,
    };
    changed = true;
  }

  const localKey = legacyFieldArchiveLocalKey({ worldId, userId });
  const localMarkerKey = legacyFieldArchiveLocalMarkerKey({ worldId, userId });
  const localMarker = includeLocal ? storage?.getItem?.(localMarkerKey) : null;
  const legacyLocal = includeLocal && !localMarker
    ? readStorageObject(storage, localKey)
    : null;

  if (legacyLocal) {
    const canonicalTime = timestamp(data?.updatedAt);
    const localTime = timestamp(legacyLocal.updatedAt);
    const firstUnifiedMigration = !serverAlreadyMerged;
    if (!data || firstUnifiedMigration || localTime > canonicalTime) {
      data = mergeArchiveStores(data, legacyLocal);
      data._unifiedArchive = {
        ...archiveMigrationMeta(data),
        legacyMergedVersion: LEGACY_MIGRATION_VERSION,
      };
      localMerged = true;
      changed = true;
    }
  }

  if (!data) {
    if (includeLocal && !localMarker && typeof storage?.setItem === "function") {
      storage.setItem(localMarkerKey, new Date().toISOString());
    }
    return { changed: false, serverMerged: false, localMerged: false, data: null };
  }

  const meta = archiveMigrationMeta(data);
  if (Number(meta.autoMigrationVersion || 0) < AUTO_MIGRATION_VERSION) {
    data._unifiedArchive = {
      ...meta,
      legacyMergedVersion: Math.max(
        LEGACY_MIGRATION_VERSION,
        Number(meta.legacyMergedVersion || 0),
      ),
      autoMigrationVersion: AUTO_MIGRATION_VERSION,
    };
    changed = true;
  }

  if (changed) {
    await writeUnifiedServerData(user, data);
  }

  if (includeLocal && !localMarker && typeof storage?.setItem === "function") {
    storage.setItem(localMarkerKey, new Date().toISOString());
  }

  return {
    changed,
    serverMerged,
    localMerged,
    data: finalizeStoreShape(data),
  };
}

/**
 * Runs once on Foundry ready. Every client migrates its own browser-local draft.
 * The active GM additionally migrates old server-side flags for offline users,
 * so players do not need to launch the old macros or even be online.
 */
export async function migrateLegacyArchivesOnReady({
  game = globalThis.game,
  storage = globalThis.localStorage,
} = {}) {
  const currentUser = game?.user;
  if (!currentUser) return { migratedUsers: 0, serverMerged: 0, localMerged: 0, errors: [] };

  const worldId = game?.world?.id ?? game?.world?.data?._id ?? "world";
  const currentUserId = currentUser.id ?? currentUser._id ?? "user";
  const result = { migratedUsers: 0, serverMerged: 0, localMerged: 0, errors: [] };

  const run = async (user, includeLocal) => {
    try {
      const migrated = await migrateLegacyFieldArchiveUser(user, {
        worldId,
        includeLocal,
        storage,
      });
      if (migrated.serverMerged || migrated.localMerged) result.migratedUsers += 1;
      if (migrated.serverMerged) result.serverMerged += 1;
      if (migrated.localMerged) result.localMerged += 1;
      return migrated;
    } catch (error) {
      result.errors.push({ userId: user?.id ?? user?._id ?? "", error });
      return null;
    }
  };

  await run(currentUser, true);

  const activeGM = game?.users?.activeGM;
  const isActiveGM = Boolean(
    currentUser.isGM && (!activeGM || (activeGM.id ?? activeGM._id) === currentUserId),
  );
  if (isActiveGM) {
    const users = game?.users?.contents ?? (game?.users ? Array.from(game.users) : []);
    for (const user of users) {
      const id = user?.id ?? user?._id;
      if (!id || id === currentUserId) continue;
      // Active players migrate themselves, including their browser-local draft.
      // The GM handles offline users whose legacy User flags would otherwise wait forever.
      if (user.active) continue;
      await run(user, false);
    }
  }

  return result;
}

export function hasCanonicalArchiveData(user = globalThis.game?.user) {
  const flags = user?.flags ?? user?.data?.flags ?? {};
  return Boolean(flags.cyberpunkRemaster?.neuroArchive?.data);
}

export function canonicalLocalKey({
  worldId = globalThis.game?.world?.id ?? globalThis.game?.world?.data?._id ?? "world",
  ownerId = globalThis.game?.user?.id ?? globalThis.game?.user?._id ?? "user",
  currentUserId = globalThis.game?.user?.id ?? globalThis.game?.user?._id ?? "user",
} = {}) {
  return ownerId === currentUserId
    ? `cyberpunk-remaster:neuro-archive:${worldId}:${currentUserId}`
    : `cyberpunk-remaster:neuro-archive:${worldId}:gm-${currentUserId}:owner-${ownerId}`;
}

export async function writeUnifiedServerData(
  user = globalThis.game?.user,
  data,
) {
  if (typeof user?.update !== "function") throw new Error("User.update недоступен");
  const payload = finalizeStoreShape(data);
  await user.update({ "flags.cyberpunkRemaster.neuroArchive.data": clone(payload) });
  return payload;
}

export function unifiedArchiveFlagPath() {
  return `flags.${CANONICAL_SCOPE}.${CANONICAL_PATH}`;
}
