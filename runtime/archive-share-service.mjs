import {
  UNIFIED_ARCHIVE_SECTIONS,
  readUnifiedServerData,
  writeUnifiedServerData,
} from "./neuro-archive-store.mjs";

const MODULE_ID = "cyberpunk-remaster";
const SOCKET_NAME = `module.${MODULE_ID}`;
const SHARE_INBOX_PATH = "flags.cyberpunkRemaster.neuroArchive.shareInbox";
const SHARE_INBOX_VERSION = 1;
const SHARE_HOOK = "cyberpunkRemasterArchiveSharesChanged";
const SHARE_THEME_PROPERTIES = Object.freeze([
  "--bg", "--bg-alpha", "--panel", "--panel-alpha", "--panel2",
  "--ink", "--heading", "--muted", "--gold", "--teal", "--line",
  "--accent-soft", "--accent-hover", "--accent-faint", "--accent-glow", "--accent-strong",
  "--secondary-soft", "--secondary-glow", "--secondary-line", "--primary-ink", "--accent-deep",
  "--chrome", "--sidebar", "--field", "--theme-node", "--theme-trace", "--theme-warning",
  "--theme-node-glow", "--theme-trace-glow", "--theme-warning-glow",
  "--archive-user-font-size", "--font-size",
]);
const LOCAL_ONLY_FIELDS = Object.freeze(["pinned", "inbox", "createdAt"]);
const pendingAcks = new Map();
let socketInitialized = false;
let shareOverlay = null;

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const clone = (value) => {
  if (value === undefined) return undefined;
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)); }
};
const now = () => new Date().toISOString();
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const normalizeTitle = (value) => String(value ?? "").trim().toLocaleLowerCase("ru-RU").replace(/\s+/gu, " ");

function uid(prefix = "share") {
  const random = globalThis.foundry?.utils?.randomID?.(16)
    ?? globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 16)
    ?? Math.random().toString(36).slice(2, 18);
  return `${prefix}-${random}`;
}

function userId(user) {
  return String(user?.id ?? user?._id ?? "");
}

function actorId(actor) {
  return String(actor?.id ?? actor?._id ?? "");
}

function userArray(game = globalThis.game) {
  return game?.users?.contents ?? (game?.users ? Array.from(game.users) : []);
}

function actorArray(game = globalThis.game) {
  return game?.actors?.contents ?? (game?.actors ? Array.from(game.actors) : []);
}

function findUser(game, id) {
  return userArray(game).find((user) => userId(user) === String(id || "")) ?? null;
}

function findActor(game, id) {
  return actorArray(game).find((actor) => actorId(actor) === String(id || "")) ?? null;
}

export function userOwnsActor(user, actor) {
  if (!user || !actor || actor.type !== "character") return false;
  try {
    if (actor.testUserPermission?.(user, "OWNER") === true) return true;
  } catch {
    // Fall through to ownership data.
  }
  const level = Number(actor.ownership?.[userId(user)] ?? actor.permission?.[userId(user)] ?? 0);
  return level >= 3;
}

export function buildShareTargetDirectory({
  users = userArray(),
  actors = actorArray(),
  currentUserId = userId(globalThis.game?.user),
  hasActiveGM = Boolean(globalThis.game?.users?.activeGM),
  currentUserIsGM = Boolean(globalThis.game?.user?.isGM),
} = {}) {
  const characterActors = Array.from(actors ?? []).filter((actor) => actor?.type === "character");
  return Array.from(users ?? [])
    .filter(Boolean)
    .map((user) => {
      const id = userId(user);
      const primaryId = actorId(user?.character);
      const owned = characterActors
        .filter((actor) => userOwnsActor(user, actor))
        .map((actor) => ({
          id: actorId(actor),
          name: String(actor.name ?? "Персонаж"),
          img: String(actor.img ?? actor.prototypeToken?.texture?.src ?? ""),
          primary: actorId(actor) === primaryId,
        }))
        .sort((left, right) => Number(right.primary) - Number(left.primary));
      const active = user.active !== false;
      return {
        id,
        name: String(user.name ?? "Игрок"),
        active,
        isGM: Boolean(user.isGM),
        current: id === String(currentUserId || ""),
        deliveryAvailable: active || currentUserIsGM || hasActiveGM,
        actors: owned,
      };
    })
    .filter((group) => group.id && group.actors.length)
    .sort((left, right) => Number(right.current) - Number(left.current) || left.name.localeCompare(right.name, "ru"));
}

function normalizeInbox(raw) {
  const inbox = isObject(raw) ? clone(raw) : {};
  inbox.version = SHARE_INBOX_VERSION;
  inbox.actors = isObject(inbox.actors) ? inbox.actors : {};
  for (const [id, packets] of Object.entries(inbox.actors)) {
    inbox.actors[id] = Array.isArray(packets) ? packets.filter(isObject).map(clone) : [];
  }
  return inbox;
}

export function readArchiveShareInboxState(user = globalThis.game?.user) {
  const flags = user?.flags ?? user?.data?.flags ?? {};
  return normalizeInbox(flags.cyberpunkRemaster?.neuroArchive?.shareInbox);
}

export function readArchiveShareInbox(user = globalThis.game?.user, targetActorId = "") {
  const inbox = readArchiveShareInboxState(user);
  return clone(inbox.actors[String(targetActorId || "")] ?? []);
}

export function countArchiveShareInbox(user = globalThis.game?.user, targetActorId = "") {
  return readArchiveShareInbox(user, targetActorId).length;
}

async function writeArchiveShareInbox(user, inbox) {
  if (typeof user?.update !== "function") throw new Error("User.update недоступен");
  const payload = normalizeInbox(inbox);
  await user.update({ [SHARE_INBOX_PATH]: clone(payload) });
  return payload;
}

function packetRecordOrigin(record, senderUserId, sourceActorId) {
  return {
    sourceUserId: String(record?.origin?.sourceUserId ?? senderUserId ?? ""),
    sourceActorId: String(record?.origin?.sourceActorId ?? sourceActorId ?? ""),
    section: String(record?.section ?? record?.origin?.section ?? ""),
    entryId: String(record?.origin?.entryId ?? record?.entry?.id ?? ""),
  };
}

export function createArchiveSharePacket({
  senderUser = globalThis.game?.user,
  sourceOwnerUserId = userId(senderUser),
  sourceActor = null,
  targetUserId = "",
  targetActorId = "",
  scope = "entry",
  label = "",
  records = [],
} = {}) {
  const senderId = userId(senderUser);
  const sourceId = actorId(sourceActor);
  const normalizedRecords = Array.from(records ?? [])
    .filter((record) => UNIFIED_ARCHIVE_SECTIONS.includes(String(record?.section ?? "")) && isObject(record?.entry))
    .map((record) => ({
      section: String(record.section),
      entry: clone(record.entry),
      origin: packetRecordOrigin(record, String(sourceOwnerUserId || senderId), sourceId),
    }));
  if (!targetUserId) throw new Error("Не выбран игрок-получатель.");
  if (!targetActorId) throw new Error("Не выбран конкретный Actor получателя.");
  if (!normalizedRecords.length) throw new Error("В пакете нет записей для передачи.");
  return {
    id: uid("archive-share"),
    version: SHARE_INBOX_VERSION,
    createdAt: now(),
    senderUserId: senderId,
    senderUserName: String(senderUser?.name ?? "Игрок"),
    sourceOwnerUserId: String(sourceOwnerUserId || senderId),
    sourceActorId: sourceId,
    sourceActorName: String(sourceActor?.name ?? "Персонаж"),
    sourceActorImg: String(sourceActor?.img ?? sourceActor?.actorImg ?? ""),
    targetUserId: String(targetUserId),
    targetActorId: String(targetActorId),
    scope: ["entry", "section", "archive"].includes(scope) ? scope : "entry",
    label: String(label || normalizedRecords[0]?.entry?.title || "Пакет данных"),
    records: normalizedRecords,
  };
}

export async function enqueueArchiveSharePacket(user, packet) {
  if (!isObject(packet)) throw new Error("Некорректный пакет передачи.");
  const targetActorId = String(packet.targetActorId || "");
  if (!targetActorId) throw new Error("Пакет не привязан к Actor.");
  const inbox = readArchiveShareInboxState(user);
  const packets = inbox.actors[targetActorId] ?? [];
  if (!packets.some((item) => String(item?.id ?? "") === String(packet.id ?? ""))) {
    packets.push(clone(packet));
  }
  inbox.actors[targetActorId] = packets;
  await writeArchiveShareInbox(user, inbox);
  globalThis.Hooks?.callAll?.(SHARE_HOOK, { type: "received", actorId: targetActorId, packet: clone(packet) });
  return packet;
}

export async function declineArchiveSharePacket(user, targetActorId, packetId) {
  const inbox = readArchiveShareInboxState(user);
  const actorKey = String(targetActorId || "");
  const before = inbox.actors[actorKey] ?? [];
  const after = before.filter((packet) => String(packet?.id ?? "") !== String(packetId || ""));
  if (after.length === before.length) return false;
  inbox.actors[actorKey] = after;
  await writeArchiveShareInbox(user, inbox);
  globalThis.Hooks?.callAll?.(SHARE_HOOK, { type: "declined", actorId: actorKey, packetId: String(packetId || "") });
  return true;
}

function sameOrigin(left, right) {
  if (!isObject(left) || !isObject(right)) return false;
  return ["sourceUserId", "sourceActorId", "section", "entryId"].every(
    (key) => String(left[key] ?? "") === String(right[key] ?? ""),
  );
}

function findConflict(entries, record) {
  const origin = record.origin;
  const incomingId = String(record.entry?.id ?? "");
  const title = normalizeTitle(record.entry?.title);
  return entries.find((entry) => sameOrigin(entry?._shareOrigin, origin))
    ?? entries.find((entry) => incomingId && String(entry?.id ?? "") === incomingId)
    ?? entries.find((entry) => title && normalizeTitle(entry?.title) === title)
    ?? null;
}

export function inspectArchiveShareConflicts(store, targetActorId, packet) {
  const notebook = store?.notebooks?.[String(targetActorId || "")];
  if (!notebook) return [];
  const conflicts = [];
  for (const record of packet?.records ?? []) {
    const section = String(record?.section ?? "");
    if (!UNIFIED_ARCHIVE_SECTIONS.includes(section)) continue;
    const entries = Array.isArray(notebook.entries?.[section]) ? notebook.entries[section] : [];
    const existing = findConflict(entries, record);
    if (existing) conflicts.push({ record: clone(record), existing: clone(existing) });
  }
  return conflicts;
}

function freshEntryId(section = "entry") {
  return uid(section.replace(/[^a-z0-9-]/giu, "") || "entry");
}

function sharedCopy(record, { freshId = true } = {}) {
  const entry = clone(record.entry);
  entry.id = freshId ? freshEntryId(record.section) : String(entry.id || freshEntryId(record.section));
  entry.type ??= record.section;
  entry._shareOrigin = clone(record.origin);
  entry.updatedAt = now();
  return entry;
}

function updateExistingFromShare(existing, record) {
  const incoming = clone(record.entry);
  const localId = String(existing.id ?? freshEntryId(record.section));
  const preserved = {};
  for (const field of LOCAL_ONLY_FIELDS) {
    if (existing[field] !== undefined) preserved[field] = clone(existing[field]);
  }
  if (record.section === "people" && Array.isArray(existing.messages)) {
    preserved.messages = clone(existing.messages);
  }
  const updated = {
    ...clone(existing),
    ...incoming,
    ...preserved,
    id: localId,
    type: existing.type ?? incoming.type ?? record.section,
    _shareOrigin: clone(record.origin),
    updatedAt: now(),
  };
  return updated;
}

function ensureTargetNotebook(store, targetActorId, actor = null) {
  const id = String(targetActorId || "");
  store.notebooks ??= {};
  store.notebooks[id] ??= {
    actorId: id,
    actorName: String(actor?.name ?? "Персонаж"),
    actorImg: String(actor?.img ?? ""),
    entries: {},
  };
  const notebook = store.notebooks[id];
  notebook.entries ??= {};
  for (const section of UNIFIED_ARCHIVE_SECTIONS) {
    if (!Array.isArray(notebook.entries[section])) notebook.entries[section] = [];
  }
  return notebook;
}

export async function acceptArchiveSharePacket(user, targetActorId, packetId, resolution = "update", {
  actor = null,
} = {}) {
  if (!['update', 'copy'].includes(resolution)) return { accepted: false, cancelled: true, conflicts: [] };
  const actorKey = String(targetActorId || "");
  const inbox = readArchiveShareInboxState(user);
  const packets = inbox.actors[actorKey] ?? [];
  const packet = packets.find((item) => String(item?.id ?? "") === String(packetId || ""));
  if (!packet) throw new Error("Входящий пакет больше не найден.");

  const store = readUnifiedServerData(user);
  const notebook = ensureTargetNotebook(store, actorKey, actor);
  const conflicts = inspectArchiveShareConflicts(store, actorKey, packet);
  let inserted = 0;
  let updated = 0;

  for (const record of packet.records ?? []) {
    const section = String(record?.section ?? "");
    if (!UNIFIED_ARCHIVE_SECTIONS.includes(section)) continue;
    const entries = notebook.entries[section];
    const existing = findConflict(entries, record);
    if (existing && resolution === "update") {
      const index = entries.indexOf(existing);
      entries[index] = updateExistingFromShare(existing, record);
      updated += 1;
    } else {
      entries.push(sharedCopy(record, { freshId: true }));
      inserted += 1;
    }
  }

  const changedAt = now();
  notebook.updatedAt = changedAt;
  store.updatedAt = changedAt;
  await writeUnifiedServerData(user, store);
  inbox.actors[actorKey] = packets.filter((item) => String(item?.id ?? "") !== String(packetId || ""));
  await writeArchiveShareInbox(user, inbox);
  globalThis.Hooks?.callAll?.(SHARE_HOOK, { type: "accepted", actorId: actorKey, packet: clone(packet), resolution });
  return { accepted: true, inserted, updated, conflicts };
}

export async function persistIncomingArchiveShare({
  game = globalThis.game,
  targetUser = null,
  packet = null,
} = {}) {
  if (!targetUser || !packet) throw new Error("Не указан получатель пакета.");
  if (userId(targetUser) !== String(packet.targetUserId || "")) throw new Error("Пакет адресован другому пользователю.");
  const actor = findActor(game, packet.targetActorId);
  if (!actor || !userOwnsActor(targetUser, actor)) {
    throw new Error("Выбранный Actor не принадлежит пользователю-получателю.");
  }
  await enqueueArchiveSharePacket(targetUser, packet);
  return { user: targetUser, actor, packet };
}

function activeGM(game) {
  return game?.users?.activeGM
    ?? userArray(game).find((user) => user?.isGM && user.active !== false)
    ?? null;
}

function isActiveGMClient(game) {
  const current = game?.user;
  if (!current?.isGM) return false;
  const gm = activeGM(game);
  return !gm || userId(gm) === userId(current);
}

function emitSocket(game, payload) {
  if (typeof game?.socket?.emit !== "function") throw new Error("Модульный socket Foundry недоступен.");
  game.socket.emit(SOCKET_NAME, payload);
}

function ackRequest(game, request, { ok = true, error = "" } = {}) {
  emitSocket(game, {
    type: "archive-share-ack",
    requestId: String(request.requestId || ""),
    senderUserId: String(request.senderUserId || ""),
    targetUserId: String(request.packet?.targetUserId || ""),
    ok,
    error: String(error || ""),
  });
}

async function handleShareDelivery(request, game) {
  const packet = request?.packet;
  if (!packet) return;
  const targetUser = findUser(game, packet.targetUserId);
  if (!targetUser) return;
  const currentId = userId(game?.user);
  const targetId = userId(targetUser);
  const targetIsCurrent = targetId && targetId === currentId;
  const gmRelay = !targetUser.active && isActiveGMClient(game);
  if (!targetIsCurrent && !gmRelay) return;
  try {
    await persistIncomingArchiveShare({ game, targetUser, packet });
    ackRequest(game, request, { ok: true });
    if (targetIsCurrent) {
      globalThis.ui?.notifications?.info?.(`Новый пакет Архива для ${findActor(game, packet.targetActorId)?.name ?? "персонажа"}.`);
    }
  } catch (error) {
    ackRequest(game, request, { ok: false, error: error?.message ?? String(error) });
  }
}

function handleShareAck(message, game) {
  if (String(message?.senderUserId || "") !== userId(game?.user)) return;
  const pending = pendingAcks.get(String(message.requestId || ""));
  if (!pending) return;
  pendingAcks.delete(String(message.requestId || ""));
  clearTimeout(pending.timer);
  if (message.ok) pending.resolve(message);
  else pending.reject(new Error(message.error || "Получатель не принял пакет передачи."));
}

export function initializeArchiveSharing({ game = globalThis.game } = {}) {
  if (socketInitialized || typeof game?.socket?.on !== "function") return false;
  socketInitialized = true;
  game.socket.on(SOCKET_NAME, (message) => {
    if (message?.type === "archive-share-deliver") void handleShareDelivery(message, game);
    else if (message?.type === "archive-share-ack") handleShareAck(message, game);
  });
  return true;
}

export async function sendArchiveSharePacket(packet, {
  game = globalThis.game,
  timeoutMs = 5000,
} = {}) {
  const targetUser = findUser(game, packet?.targetUserId);
  if (!targetUser) throw new Error("Игрок-получатель больше не найден.");
  const targetActor = findActor(game, packet?.targetActorId);
  if (!targetActor || !userOwnsActor(targetUser, targetActor)) {
    throw new Error("Выбранный Actor больше не принадлежит этому игроку.");
  }

  const currentId = userId(game?.user);
  if (userId(targetUser) === currentId || game?.user?.isGM) {
    await persistIncomingArchiveShare({ game, targetUser, packet });
    return { ok: true, direct: true };
  }

  if (!targetUser.active && !activeGM(game)) {
    throw new Error("Игрок офлайн и нет активного GM для доставки пакета.");
  }
  if (typeof game?.socket?.emit !== "function") throw new Error("Модульный socket Foundry недоступен.");
  initializeArchiveSharing({ game });

  const requestId = uid("share-request");
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingAcks.delete(requestId);
      reject(new Error("Получатель не подтвердил доставку пакета вовремя."));
    }, Math.max(1, Number(timeoutMs) || 5000));
    pendingAcks.set(requestId, { resolve, reject, timer });
  });
  emitSocket(game, {
    type: "archive-share-deliver",
    requestId,
    senderUserId: currentId,
    packet: clone(packet),
  });
  return result;
}

export function recordsFromSnapshot(snapshot, scope = "archive") {
  const notebook = snapshot?.notebook;
  if (!notebook?.entries) return [];
  if (scope === "section") {
    const section = String(snapshot?.section || "");
    if (!UNIFIED_ARCHIVE_SECTIONS.includes(section)) return [];
    return (notebook.entries[section] ?? []).map((entry) => ({ section, entry: clone(entry) }));
  }
  const records = [];
  for (const section of UNIFIED_ARCHIVE_SECTIONS) {
    for (const entry of notebook.entries?.[section] ?? []) records.push({ section, entry: clone(entry) });
  }
  return records;
}

function closeShareOverlay() {
  shareOverlay?.remove?.();
  shareOverlay = null;
}

function normalizeArchiveShareMode(value) {
  return ["neuro", "cyber", "neo"].includes(String(value || "")) ? String(value) : "neuro";
}

export function captureArchiveShareTheme(themeSource = null, archiveMode = "neuro") {
  const mode = normalizeArchiveShareMode(archiveMode);
  let computed = null;
  try { computed = themeSource && globalThis.getComputedStyle ? globalThis.getComputedStyle(themeSource) : null; }
  catch { computed = null; }
  const variables = {};
  for (const property of SHARE_THEME_PROPERTIES) {
    const inline = String(themeSource?.style?.getPropertyValue?.(property) ?? "").trim();
    const inherited = String(computed?.getPropertyValue?.(property) ?? "").trim();
    const value = inline || inherited;
    if (value) variables[property] = value;
  }
  return { mode, variables };
}

function applyArchiveShareTheme(overlay, { themeSource = null, archiveMode = "neuro" } = {}) {
  if (!overlay) return overlay;
  const theme = captureArchiveShareTheme(themeSource, archiveMode);
  overlay.dataset.archiveShareMode = theme.mode;
  for (const [property, value] of Object.entries(theme.variables)) overlay.style.setProperty(property, value);
  return overlay;
}

function createShareOverlay({ className = "", label = "Архив: обмен данными", themeSource = null, archiveMode = "neuro" } = {}) {
  closeShareOverlay();
  const overlay = globalThis.document?.createElement?.("div");
  if (!overlay) throw new Error("DOM недоступен для окна передачи.");
  overlay.className = `archive-share-overlay ${className}`.trim();
  overlay.dataset.archiveShareOverlay = "true";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", label);
  applyArchiveShareTheme(overlay, { themeSource, archiveMode });
  overlay.addEventListener("pointerdown", (event) => {
    if (event.target === overlay) closeShareOverlay();
  });
  globalThis.document.body.append(overlay);
  shareOverlay = overlay;
  return overlay;
}

function shareSectionLabel(section) {
  return ({
    people: "Контакты", gangs: "Банды", corporations: "Корпорации", fixers: "Фиксеры", rippers: "Риперы",
    lawmen: "Законники", noosphere: "Ноосфера", nomads: "Кочевники", subscriptions: "Подписки",
    locations: "Точки", quests: "Заказы", clues: "Зацепки", books: "Файлы и шифры", sessions: "Лог сессий", notes: "Заметки",
  })[section] ?? section;
}

function targetSelectorHtml({ directory, title, description }) {
  return `<section class="archive-share-window archive-share-target-window">
    <header class="archive-share-head"><span><i class="fa-solid fa-share-nodes"></i></span><div><small>ARCHIVE LINK // TARGET ACTOR</small><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button type="button" data-archive-share-close aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button></header>
    <div class="archive-share-users">${directory.map((group) => `<section class="archive-share-user" data-archive-share-user="${esc(group.id)}">
      <button type="button" class="archive-share-user-row" data-archive-share-user-toggle aria-expanded="false">
        <span class="archive-share-user-icon"><i class="fa-solid fa-user"></i></span>
        <span class="archive-share-user-copy"><b>${esc(group.name)}</b><small>${group.active ? "В СЕТИ" : group.deliveryAvailable ? "ОФЛАЙН // ДОСТАВКА ЧЕРЕЗ GM" : "ОФЛАЙН // НЕТ МАРШРУТА"} · ${group.actors.length} персонаж(а/ей)</small></span>
        <i class="fa-solid fa-chevron-down archive-share-chevron"></i>
      </button>
      <div class="archive-share-actors" data-archive-share-actors hidden>${group.actors.map((actor) => `<button type="button" class="archive-share-actor" data-archive-share-actor data-user-id="${esc(group.id)}" data-actor-id="${esc(actor.id)}" ${group.deliveryAvailable ? "" : "disabled"}>
        <span class="archive-share-actor-avatar">${actor.img ? `<img src="${esc(actor.img)}" alt="">` : '<i class="fa-solid fa-user-gear"></i>'}</span>
        <span class="archive-share-actor-copy"><b>${esc(actor.name)}</b><small>${actor.primary ? "ОСНОВНОЙ ПЕРСОНАЖ" : "ACTOR"}</small></span>
        <i class="fa-solid fa-circle-check archive-share-selected-mark"></i>
      </button>`).join("")}</div>
    </section>`).join("") || '<div class="archive-share-empty">Нет доступных персонажей для передачи.</div>'}</div>
    <footer class="archive-share-footer"><span data-archive-share-target-label>Сначала раскройте игрока и выберите конкретного Actor.</span><button type="button" class="primary" data-archive-share-send disabled><i class="fa-solid fa-paper-plane"></i> ОТПРАВИТЬ</button></footer>
  </section>`;
}

export async function openArchiveShareDialog({
  senderUser = globalThis.game?.user,
  sourceOwnerUserId = userId(senderUser),
  sourceActor = null,
  scope = "entry",
  label = "Пакет данных",
  records = [],
  game = globalThis.game,
  onSent = null,
  themeSource = null,
  archiveMode = "neuro",
} = {}) {
  if (!sourceActor) throw new Error("Не найден Actor-источник передачи.");
  if (!records.length) {
    globalThis.ui?.notifications?.warn?.("В выбранном наборе нет записей для передачи.");
    return null;
  }
  const directory = buildShareTargetDirectory({
    users: userArray(game), actors: actorArray(game), currentUserId: userId(game?.user),
    hasActiveGM: Boolean(activeGM(game)), currentUserIsGM: Boolean(game?.user?.isGM),
  });
  const overlay = createShareOverlay({ label: `Поделиться: ${label}`, themeSource, archiveMode });
  overlay.innerHTML = targetSelectorHtml({
    directory,
    title: label,
    description: `${scope === "entry" ? "Запись" : scope === "section" ? "Раздел" : "Архив"}: ${records.length} объект(а/ов). Передача идёт только выбранному Actor.`,
  });
  let targetUserId = "";
  let targetActorId = "";

  overlay.addEventListener("click", async (event) => {
    const close = event.target.closest?.("[data-archive-share-close]");
    if (close) return closeShareOverlay();
    const toggle = event.target.closest?.("[data-archive-share-user-toggle]");
    if (toggle) {
      const group = toggle.closest("[data-archive-share-user]");
      const actors = group?.querySelector?.("[data-archive-share-actors]");
      const expanded = toggle.getAttribute("aria-expanded") === "true";

      // Keep the selector compact: only one player group may be expanded at a time.
      for (const otherGroup of overlay.querySelectorAll?.("[data-archive-share-user]") ?? []) {
        if (otherGroup === group) continue;
        const otherToggle = otherGroup.querySelector?.("[data-archive-share-user-toggle]");
        const otherActors = otherGroup.querySelector?.("[data-archive-share-actors]");
        otherToggle?.setAttribute?.("aria-expanded", "false");
        if (otherActors) otherActors.hidden = true;
      }

      toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      if (actors) actors.hidden = expanded;
      if (!expanded) group?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      return;
    }
    const actorButton = event.target.closest?.("[data-archive-share-actor]");
    if (actorButton && !actorButton.disabled) {
      targetUserId = String(actorButton.dataset.userId || "");
      targetActorId = String(actorButton.dataset.actorId || "");
      for (const button of overlay.querySelectorAll?.("[data-archive-share-actor]") ?? []) button.classList.toggle("selected", button === actorButton);
      const targetLabel = overlay.querySelector?.("[data-archive-share-target-label]");
      if (targetLabel) targetLabel.textContent = `Получатель: ${actorButton.querySelector("b")?.textContent || "Actor"}`;
      const send = overlay.querySelector?.("[data-archive-share-send]");
      if (send) send.disabled = !(targetUserId && targetActorId);
      actorButton.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      return;
    }
    const send = event.target.closest?.("[data-archive-share-send]");
    if (!send || send.disabled) return;
    send.disabled = true;
    try {
      const packet = createArchiveSharePacket({ senderUser, sourceOwnerUserId, sourceActor, targetUserId, targetActorId, scope, label, records });
      await sendArchiveSharePacket(packet, { game });
      globalThis.ui?.notifications?.info?.(`«${label}» отправлено выбранному персонажу.`);
      closeShareOverlay();
      await onSent?.(packet);
    } catch (error) {
      send.disabled = false;
      globalThis.ui?.notifications?.error?.(`Передача не выполнена: ${error.message}`);
    }
  });
  return overlay;
}

export function openArchiveShareScopePicker(snapshot, { game = globalThis.game, themeSource = null, archiveMode = "neuro" } = {}) {
  const section = String(snapshot?.section || "");
  const sectionRecords = recordsFromSnapshot(snapshot, "section");
  const archiveRecords = recordsFromSnapshot(snapshot, "archive");
  const overlay = createShareOverlay({ label: "Поделиться архивом", themeSource, archiveMode });
  overlay.innerHTML = `<section class="archive-share-window archive-share-scope-window">
    <header class="archive-share-head"><span><i class="fa-solid fa-share-nodes"></i></span><div><small>ARCHIVE LINK // SHARE SCOPE</small><h2>Что передать?</h2><p>Настройки интерфейса и темы не передаются.</p></div><button type="button" data-archive-share-close aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button></header>
    <div class="archive-share-scope-options">
      ${UNIFIED_ARCHIVE_SECTIONS.includes(section) ? `<button type="button" data-archive-share-scope="section"><i class="fa-solid fa-layer-group"></i><span><b>Текущий раздел: ${esc(shareSectionLabel(section))}</b><small>${sectionRecords.length} записей</small></span></button>` : ""}
      <button type="button" data-archive-share-scope="archive"><i class="fa-solid fa-box-archive"></i><span><b>Весь архив персонажа</b><small>${archiveRecords.length} записей из всех разделов</small></span></button>
    </div>
  </section>`;
  overlay.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-archive-share-close]")) return closeShareOverlay();
    const button = event.target.closest?.("[data-archive-share-scope]");
    if (!button) return;
    const scope = button.dataset.archiveShareScope;
    const records = scope === "section" ? sectionRecords : archiveRecords;
    const label = scope === "section" ? `Раздел «${shareSectionLabel(section)}»` : `Архив ${snapshot?.sourceActor?.name ?? "персонажа"}`;
    void openArchiveShareDialog({
      senderUser: game?.user,
      sourceOwnerUserId: snapshot?.sourceOwnerUserId ?? userId(game?.user),
      sourceActor: snapshot?.sourceActor,
      scope,
      label,
      records,
      game,
      themeSource,
      archiveMode,
    });
  });
  return overlay;
}

function packetSummary(packet) {
  const count = Array.isArray(packet?.records) ? packet.records.length : 0;
  return `${count} запис${count === 1 ? "ь" : count < 5 ? "и" : "ей"}`;
}

function inboxHtml({ actor, packets }) {
  return `<section class="archive-share-window archive-share-inbox-window">
    <header class="archive-share-head"><span><i class="fa-solid fa-inbox"></i></span><div><small>ARCHIVE LINK // INBOX</small><h2>Входящие // ${esc(actor?.name ?? "Персонаж")}</h2><p>Пакеты не попадают в архив, пока вы их не примете.</p></div><button type="button" data-archive-share-close aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button></header>
    <div class="archive-share-inbox-list">${packets.length ? packets.map((packet) => `<article class="archive-share-packet" data-archive-share-packet="${esc(packet.id)}">
      <div class="archive-share-packet-icon"><i class="fa-solid fa-file-import"></i></div><div class="archive-share-packet-copy"><small>${esc(packet.senderUserName || "Игрок")} // ${esc(packet.sourceActorName || "Actor")}</small><b>${esc(packet.label || "Пакет данных")}</b><p>${esc(packetSummary(packet))} · ${esc(new Date(packet.createdAt || Date.now()).toLocaleString("ru-RU"))}</p></div>
      <div class="archive-share-packet-actions"><button type="button" data-archive-share-accept><i class="fa-solid fa-check"></i> Принять</button><button type="button" class="danger" data-archive-share-decline><i class="fa-solid fa-xmark"></i> Отклонить</button></div>
    </article>`).join("") : '<div class="archive-share-empty"><i class="fa-solid fa-inbox"></i><b>Входящих пакетов нет</b><span>Для этого Actor очередь пуста.</span></div>'}</div>
  </section>`;
}

function conflictHtml(packet, conflicts) {
  return `<section class="archive-share-window archive-share-conflict-window">
    <header class="archive-share-head"><span><i class="fa-solid fa-code-merge"></i></span><div><small>ARCHIVE LINK // CONFLICT</small><h2>Найдены совпадения</h2><p>${conflicts.length} из ${packet.records?.length ?? 0} записей уже существуют у персонажа.</p></div><button type="button" data-archive-share-conflict="cancel" aria-label="Закрыть"><i class="fa-solid fa-xmark"></i></button></header>
    <div class="archive-share-conflict-actions"><button type="button" class="primary" data-archive-share-conflict="update"><i class="fa-solid fa-arrows-rotate"></i><span><b>Обновить существующее</b><small>Сохраняются локальные ID, закрепление и история сообщений контактов.</small></span></button><button type="button" data-archive-share-conflict="copy"><i class="fa-solid fa-copy"></i><span><b>Создать копию</b><small>Все записи пакета создаются как независимые новые записи.</small></span></button><button type="button" data-archive-share-conflict="cancel"><i class="fa-solid fa-ban"></i><span><b>Отмена</b><small>Пакет останется во входящих.</small></span></button></div>
  </section>`;
}

export async function openArchiveShareInbox({
  user = globalThis.game?.user,
  actorId: targetActorId = "",
  actor = null,
  beforeApply = null,
  afterApply = null,
  themeSource = null,
  archiveMode = "neuro",
} = {}) {
  const actorKey = String(targetActorId || actorId(actor) || "");
  if (!actorKey) throw new Error("Не выбран Actor для входящих.");
  const renderInbox = () => {
    const packets = readArchiveShareInbox(user, actorKey);
    const overlay = shareOverlay ?? createShareOverlay({ label: "Входящие Архива", themeSource, archiveMode });
    overlay.innerHTML = inboxHtml({ actor, packets });
    return overlay;
  };
  const overlay = createShareOverlay({ label: "Входящие Архива", themeSource, archiveMode });
  renderInbox();
  overlay.addEventListener("click", async (event) => {
    if (event.target.closest?.("[data-archive-share-close]")) return closeShareOverlay();
    const packetNode = event.target.closest?.("[data-archive-share-packet]");
    const packetId = String(packetNode?.dataset.archiveSharePacket || "");
    if (!packetId) return;
    if (event.target.closest?.("[data-archive-share-decline]")) {
      await declineArchiveSharePacket(user, actorKey, packetId);
      renderInbox();
      await afterApply?.({ type: "declined", actorId: actorKey });
      return;
    }
    if (!event.target.closest?.("[data-archive-share-accept]")) return;
    await beforeApply?.({ type: "accept", actorId: actorKey });
    const packet = readArchiveShareInbox(user, actorKey).find((item) => String(item.id || "") === packetId);
    if (!packet) return renderInbox();
    const store = readUnifiedServerData(user);
    const conflicts = inspectArchiveShareConflicts(store, actorKey, packet);
    if (!conflicts.length) {
      await acceptArchiveSharePacket(user, actorKey, packetId, "update", { actor });
      renderInbox();
      await afterApply?.({ type: "accepted", actorId: actorKey });
      return;
    }
    overlay.innerHTML = conflictHtml(packet, conflicts);
    const conflictHandler = async (conflictEvent) => {
      const choice = conflictEvent.target.closest?.("[data-archive-share-conflict]")?.dataset.archiveShareConflict;
      if (!choice) return;
      overlay.removeEventListener("click", conflictHandler);
      if (choice === "cancel") return renderInbox();
      await acceptArchiveSharePacket(user, actorKey, packetId, choice, { actor });
      renderInbox();
      await afterApply?.({ type: "accepted", actorId: actorKey, resolution: choice });
    };
    overlay.addEventListener("click", conflictHandler);
  });
  return overlay;
}

export const archiveShareHookName = SHARE_HOOK;
