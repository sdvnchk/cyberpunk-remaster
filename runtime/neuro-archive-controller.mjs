/*
 * Нейро-Архив — модульная версия одноимённого макроса 4.1.0.
 *
 * Формат флага personalChronicleMacro.data и ключи localStorage намеренно
 * сохранены: существующие записи и JSON-бэкапы продолжают работать.
 */

import {
  NEURO_ARCHIVE_VARIANT,
  NEURO_ARCHIVE_VERSION,
} from "./neuro-archive-constants.mjs";

export function createNeuroArchiveController(
  root,
  { requestClose = async () => {} } = {},
) {
  const VERSION = 1;
  const SECTIONS = {
    people: { label: "Контакты", one: "контакт", icon: "fa-user-group" },
    locations: { label: "Точки", one: "точку", icon: "fa-location-dot" },
    quests: { label: "Гиги", one: "гиг", icon: "fa-briefcase" },
    clues: { label: "Зацепки", one: "зацепку", icon: "fa-magnifying-glass" },
    sessions: {
      label: "Лог сессий",
      one: "запись лога",
      icon: "fa-clock-rotate-left",
    },
    notes: { label: "Дампы", one: "дамп", icon: "fa-note-sticky" },
  };
  const LOCATION_LINK_TYPES = new Set([
    "people",
    "quests",
    "clues",
    "sessions",
    "notes",
  ]);
  const LEGACY_LOCATION_TYPES = new Set(["people", "quests", "clues"]);
  const TEMPLATES = {
    rumor: {
      title: "Слух",
      content: "Кто сказал: \nЧто говорят: \nНасколько верю: \nПроверить: ",
    },
    address: {
      title: "Номер / адрес",
      content: "Что это: \nАдрес или номер: \nОт кого: \nЗачем нужно: ",
    },
    debt: {
      title: "Долг",
      content: "Кто кому: \nСколько / что: \nЗа что: \nСрок: ",
    },
  };
  const THEME_PRESETS = {
    red: {
      label: "RED",
      background: "#09070b",
      panel: "#18131b",
      text: "#f0e9df",
      muted: "#b8aeb6",
      accent: "#df2532",
      secondary: "#46d9dc",
    },
    cyber2077: {
      label: "2077",
      background: "#05090d",
      panel: "#0a151a",
      text: "#eaffff",
      muted: "#6f969c",
      accent: "#fcee0a",
      secondary: "#00f0ff",
    },
    dark: {
      label: "Тёмная",
      background: "#020204",
      panel: "#08090c",
      text: "#d7d9de",
      muted: "#666974",
      accent: "#727681",
      secondary: "#a3a7b2",
    },
  };
  const DEFAULT_APPEARANCE = {
    ...THEME_PRESETS.red,
    preset: "red",
    fontSize: 13,
  };

  const clone = (value) => {
    try {
      return structuredClone(value);
    } catch (_error) {
      return JSON.parse(JSON.stringify(value));
    }
  };
  const now = () => new Date().toISOString();
  const uid = () =>
    globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 16) ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );
  const short = (value, size = 120) => {
    const text = String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
    return esc(text.length > size ? `${text.slice(0, size)}…` : text);
  };
  const notify = (message, level = "info") => {
    const api = globalThis.ui?.notifications;
    if (api?.[level]) api[level](message);
    else console[level === "error" ? "error" : "log"](message);
  };
  const fa = (name, extra = "") =>
    `<i class="fa-solid ${esc(name)} ${esc(extra)}" aria-hidden="true"></i>`;
  const sectionIcon = (key) => fa(SECTIONS[key]?.icon ?? "fa-file-lines");
  const normalizeName = (value) =>
    String(value ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("ru");
  const safeColor = (value, fallback) =>
    /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : fallback;

  function hexRgb(value) {
    const hex = safeColor(value, "#000000").slice(1);
    return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  }

  function colorWithAlpha(value, alpha) {
    const [r, g, b] = hexRgb(value);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function mixColors(first, second, weight = 0.5) {
    const a = hexRgb(first);
    const b = hexRgb(second);
    const mixed = a.map((channel, index) =>
      Math.round(channel * (1 - weight) + b[index] * weight),
    );
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }

  function contrastColor(value) {
    const [r, g, b] = hexRgb(value);
    return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#101718" : "#fffaf0";
  }

  function normalizeAppearance(value) {
    const source = value && typeof value === "object" ? value : {};
    const preset = THEME_PRESETS[source.preset] ? source.preset : "red";
    const palette = THEME_PRESETS[preset];
    return {
      preset,
      background: palette.background,
      panel: palette.panel,
      text: palette.text,
      muted: palette.muted,
      accent: palette.accent,
      secondary: palette.secondary,
      fontSize: Math.min(
        17,
        Math.max(11, Number(source.fontSize) || DEFAULT_APPEARANCE.fontSize),
      ),
    };
  }

  function actorArray(archiveUser, store = null) {
    const source = globalThis.game?.actors;
    const actors = source?.contents ?? (source ? Array.from(source) : []);
    const notebookIds = new Set(Object.keys(store?.notebooks ?? {}));
    const assignedActorId =
      archiveUser?.character?.id ?? archiveUser?.character?._id ?? null;
    const visible = actors.filter((actor) => {
      if (actor.type !== "character") return false;
      if (notebookIds.has(actor.id ?? actor._id)) return true;
      if (assignedActorId && (actor.id ?? actor._id) === assignedActorId)
        return true;
      if (archiveUser?.isGM && game.user?.isGM) return true;
      try {
        return actor.testUserPermission?.(archiveUser, "OWNER") ?? false;
      } catch (_error) {
        return false;
      }
    });
    const found = new Set(visible.map((actor) => actor.id ?? actor._id));
    for (const [id, book] of Object.entries(store?.notebooks ?? {})) {
      if (found.has(id)) continue;
      visible.push({
        id,
        _id: id,
        name: book.actorName || "Удалённый оперативник",
        img: book.actorImg || "icons/svg/mystery-man.svg",
        type: "character",
        archivePlaceholder: true,
      });
    }
    return visible.sort((a, b) =>
      String(a.name).localeCompare(String(b.name), "ru"),
    );
  }

  const worldId = game?.world?.id ?? game?.world?.data?._id ?? "world";
  const userId = game?.user?.id ?? game?.user?._id ?? "user";
  const allUsers =
    game?.users?.contents ??
    (game?.users ? Array.from(game.users) : [game.user]);
  const archiveUsers = (game.user?.isGM ? allUsers : [game.user])
    .filter(Boolean)
    .sort((a, b) => {
      if ((a.id ?? a._id) === userId) return -1;
      if ((b.id ?? b._id) === userId) return 1;
      return String(a.name).localeCompare(String(b.name), "ru");
    });
  const localKeyFor = (ownerId) =>
    ownerId === userId
      ? `personal-chronicle-macro:${worldId}:${userId}`
      : `personal-chronicle-macro:${worldId}:gm-${userId}:owner-${ownerId}`;

  function blankStore() {
    return {
      version: VERSION,
      updatedAt: now(),
      activeActorId: null,
      notebooks: {},
    };
  }

  function blankNotebook(actor) {
    return {
      actorId: actor.id ?? actor._id,
      actorName: actor.name,
      actorImg: actor.img ?? "icons/svg/mystery-man.svg",
      createdAt: now(),
      updatedAt: now(),
      goal: "",
      appearance: normalizeAppearance(),
      entries: Object.fromEntries(
        Object.keys(SECTIONS).map((key) => [key, []]),
      ),
    };
  }

  function blankEntry(type, seed = "") {
    const firstLine = String(seed).split(/\r?\n/)[0].trim();
    const base = {
      id: uid(),
      type,
      title: firstLine.slice(0, 80) || "Новая запись",
      summary: "",
      content: seed,
      image: "",
      tags: "",
      pinned: false,
      createdAt: now(),
      updatedAt: now(),
      fragments: [],
      gallery: [],
    };
    const extra = {
      people: {
        role: "",
        ancestry: "",
        status: "Неизвестно",
        attitude: "Нейтрально",
        relationship: "",
        firstMet: "",
        locationId: "",
        locationIds: [],
        quotes: "",
        promises: "",
        secrets: "",
      },
      locations: {
        kind: "",
        region: "",
        status: "Активна",
        firstVisited: "",
        atmosphere: "",
        dangers: "",
        services: "",
        travel: "",
      },
      quests: {
        status: "Активно",
        giverId: "",
        locationId: "",
        locationIds: [],
        objective: "",
        reward: "",
        deadline: "",
        nextStep: "",
        tasks: [],
      },
      clues: {
        status: "Новая",
        source: "",
        theory: "",
        conclusion: "",
        personId: "",
        locationId: "",
        locationIds: [],
      },
      sessions: {
        realDate: new Date().toISOString().slice(0, 10),
        gameDate: "",
        participants: "",
        events: "",
        decisions: "",
        loot: "",
        nextTime: "",
        locationIds: [],
      },
      notes: { category: "Общее", locationIds: [] },
    };
    return Object.assign(base, extra[type] ?? {});
  }

  function normalize(raw) {
    const data = raw && typeof raw === "object" ? clone(raw) : blankStore();
    data.version = VERSION;
    data.updatedAt ??= now();
    data.notebooks ??= {};
    for (const notebook of Object.values(data.notebooks)) {
      notebook.goal ??= "";
      notebook.appearance = normalizeAppearance(notebook.appearance);
      notebook.entries ??= {};
      for (const key of Object.keys(SECTIONS)) notebook.entries[key] ??= [];
      for (const list of Object.values(notebook.entries))
        for (const entry of list) {
          entry.fragments = Array.isArray(entry.fragments)
            ? entry.fragments.map((fragment, index) => ({
                id: fragment?.id || uid(),
                title: String(fragment?.title ?? `Фрагмент ${index + 1}`),
                image: String(fragment?.image ?? ""),
                content: String(fragment?.content ?? ""),
              }))
            : [];
          entry.gallery = Array.isArray(entry.gallery)
            ? entry.gallery
                .map((item) =>
                  typeof item === "string"
                    ? { id: uid(), image: item, caption: "" }
                    : {
                        id: item?.id || uid(),
                        image: String(item?.image ?? ""),
                        caption: String(item?.caption ?? ""),
                      },
                )
                .filter((item) => item.image)
            : [];
          entry.tags ??= "";
          entry.summary ??= "";
          entry.content ??= "";
          if (LOCATION_LINK_TYPES.has(entry.type)) {
            entry.locationIds = Array.isArray(entry.locationIds)
              ? [...new Set(entry.locationIds.filter(Boolean))]
              : [];
            if (
              entry.locationId &&
              !entry.locationIds.includes(entry.locationId)
            )
              entry.locationIds.unshift(entry.locationId);
            if (LEGACY_LOCATION_TYPES.has(entry.type))
              entry.locationId = entry.locationIds[0] ?? "";
          }
          if (entry.type === "quests") entry.tasks ??= [];
        }
    }
    return data;
  }

  function serverData(user = game.user) {
    const flags = user?.flags ?? user?.data?.flags ?? {};
    return flags.personalChronicleMacro?.data ?? null;
  }

  function localData(ownerId) {
    try {
      return JSON.parse(localStorage.getItem(localKeyFor(ownerId)) || "null");
    } catch (_error) {
      return null;
    }
  }

  function archiveUserById(id) {
    return (
      archiveUsers.find((user) => (user.id ?? user._id) === id) ?? game.user
    );
  }

  function prepareArchive(user) {
    const ownerId = user?.id ?? user?._id ?? userId;
    const rawServer = serverData(user);
    const rawLocal = localData(ownerId);
    const fromServer = normalize(rawServer);
    const fromLocal = rawLocal ? normalize(rawLocal) : null;
    const restoredLocal = Boolean(
      fromLocal &&
      (!rawServer ||
        String(fromLocal.updatedAt) > String(fromServer.updatedAt)),
    );
    const store = restoredLocal ? fromLocal : fromServer;
    const actors = actorArray(user, store);
    const actorIds = new Set(actors.map((actor) => actor.id ?? actor._id));
    const preferredActorId =
      user?.character?.id ??
      user?.character?._id ??
      (ownerId === userId
        ? globalThis.canvas?.tokens?.controlled?.[0]?.actor?.id
        : null);
    if (!actorIds.has(store.activeActorId)) {
      store.activeActorId = actorIds.has(preferredActorId)
        ? preferredActorId
        : (actors[0]?.id ?? actors[0]?._id ?? null);
    }
    return { store, actors, restoredLocal, hasServerData: Boolean(rawServer) };
  }

  const initialOwner = game.user;
  const initialArchive = prepareArchive(initialOwner);

  const state = {
    store: initialArchive.store,
    actors: initialArchive.actors,
    archiveUsers,
    archiveUserId: initialOwner.id ?? initialOwner._id,
    restoredLocal: initialArchive.restoredLocal,
    section: "dashboard",
    openId: null,
    viewMode: "list",
    viewId: null,
    returnLocationId: null,
    previousView: null,
    quick: "",
    search: "",
    saveTimer: null,
    saving: false,
    saveAgain: false,
    revision: 0,
    pendingServer: false,
    storageMode:
      initialArchive.hasServerData && !initialArchive.restoredLocal
        ? "server"
        : "local",
    settingsOpen: false,
    helpOpen: false,
    lightbox: null,
    openFragmentId: null,
    root: null,
  };

  function actorById(id) {
    return state.actors.find((actor) => (actor.id ?? actor._id) === id) ?? null;
  }

  function ensureNotebook(actor) {
    if (!actor) return null;
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
    if (!book) return normalizeAppearance();
    book.appearance = normalizeAppearance(book.appearance);
    return book.appearance;
  }

  function applyAppearance(book = notebook()) {
    if (!state.root || !book) return;
    const theme = bookAppearance(book);
    const variables = {
      "--bg": theme.background,
      "--panel": theme.panel,
      "--panel2": mixColors(theme.panel, theme.background, 0.38),
      "--ink": theme.text,
      "--heading": mixColors(theme.text, "#ffffff", 0.12),
      "--muted": theme.muted,
      "--gold": theme.accent,
      "--teal": theme.secondary,
      "--line": colorWithAlpha(theme.accent, 0.28),
      "--accent-soft": colorWithAlpha(theme.accent, 0.12),
      "--accent-hover": colorWithAlpha(theme.accent, 0.22),
      "--accent-faint": colorWithAlpha(theme.accent, 0.05),
      "--accent-glow": colorWithAlpha(theme.accent, 0.35),
      "--accent-strong": colorWithAlpha(theme.accent, 0.58),
      "--secondary-soft": colorWithAlpha(theme.secondary, 0.13),
      "--secondary-glow": colorWithAlpha(theme.secondary, 0.38),
      "--secondary-line": colorWithAlpha(theme.secondary, 0.3),
      "--primary-ink": contrastColor(theme.accent),
      "--accent-deep": mixColors(theme.accent, theme.background, 0.28),
      "--chrome": mixColors(theme.background, "#000000", 0.28),
      "--sidebar": mixColors(theme.background, "#000000", 0.18),
      "--field": colorWithAlpha(theme.background, 0.66),
      "--font-size": `${theme.fontSize}px`,
    };
    for (const [property, value] of Object.entries(variables))
      state.root.style.setProperty(property, value);

    const application = state.root.closest?.(".neuro-archive-application");
    const applicationVariables = {
      "--cyber-accent": theme.accent,
      "--cyber-secondary": theme.secondary,
      "--cyber-background": theme.background,
      "--cyber-text": theme.text,
      "--cyber-accent-soft": colorWithAlpha(theme.accent, 0.2),
      "--cyber-accent-strong": colorWithAlpha(theme.accent, 0.7),
      "--cyber-secondary-soft": colorWithAlpha(theme.secondary, 0.15),
    };
    for (const [property, value] of Object.entries(applicationVariables))
      application?.style?.setProperty?.(property, value);
  }

  function findEntry(element) {
    const id = element.closest("[data-entry-id]")?.dataset.entryId;
    if (!id || !notebook()) return null;
    return (
      Object.values(notebook().entries)
        .flat()
        .find((entry) => entry.id === id) ?? null
    );
  }

  function entryById(id) {
    if (!id || !notebook()) return null;
    return (
      Object.values(notebook().entries)
        .flat()
        .find((entry) => entry.id === id) ?? null
    );
  }

  function entryLocationIds(entry) {
    if (!LOCATION_LINK_TYPES.has(entry?.type)) return [];
    const ids = Array.isArray(entry.locationIds)
      ? entry.locationIds.filter(Boolean)
      : [];
    if (entry.locationId && !ids.includes(entry.locationId))
      ids.unshift(entry.locationId);
    return [...new Set(ids)];
  }

  function setEntryLocations(entry, ids) {
    if (!LOCATION_LINK_TYPES.has(entry?.type)) return;
    entry.locationIds = [...new Set((ids ?? []).filter(Boolean))];
    if (LEGACY_LOCATION_TYPES.has(entry.type))
      entry.locationId = entry.locationIds[0] ?? "";
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
      openId: state.openId,
    };
  }

  function restoreView(view) {
    const target = view ?? {
      section: state.section,
      viewMode: "list",
      viewId: null,
      returnLocationId: null,
      openId: null,
    };
    state.section = target.section;
    state.viewMode = target.viewMode;
    state.viewId = target.viewId;
    state.returnLocationId = target.returnLocationId;
    state.openId = target.openId;
    state.previousView = null;
  }

  function resetView(section = state.section) {
    state.section = section;
    state.viewMode = "list";
    state.viewId = null;
    state.returnLocationId = null;
    state.previousView = null;
    state.openId = null;
    state.lightbox = null;
    state.openFragmentId = null;
  }

  function saveLocal() {
    try {
      localStorage.setItem(
        localKeyFor(state.archiveUserId),
        JSON.stringify(state.store),
      );
    } catch (error) {
      console.warn("Нейро-архив RED: локальное сохранение не удалось", error);
    }
  }

  function updateSaveBadge(text, mode = "local") {
    const badge = state.root?.querySelector?.("[data-save-badge]");
    if (badge) {
      badge.textContent = text;
      badge.dataset.mode = mode;
    }
  }

  function dirty() {
    state.revision += 1;
    state.pendingServer = true;
    state.store.updatedAt = now();
    if (notebook()) notebook().updatedAt = state.store.updatedAt;
    saveLocal();
    updateSaveBadge("Черновик…", "pending");
    clearTimeout(state.saveTimer);
    // Локальный черновик уже записан. Сервер ждёт спокойной паузы,
    // поэтому набор текста не теряет фокус и не прерывается.
    const remoteArchive = state.archiveUserId !== userId;
    state.saveTimer = setTimeout(
      () => saveServer(false),
      remoteArchive ? 1200 : 8000,
    );
  }

  async function saveServer(force = false) {
    const active = document.activeElement;
    const isTyping =
      state.root?.isConnected &&
      state.root.contains(active) &&
      ["INPUT", "TEXTAREA"].includes(active?.tagName);
    if (isTyping && !force) {
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => saveServer(false), 2500);
      updateSaveBadge("Черновик", "pending");
      return;
    }
    if (state.saving) {
      state.saveAgain = true;
      return;
    }
    state.saving = true;
    state.saveAgain = false;
    const revision = state.revision;
    const ownerId = state.archiveUserId;
    const owner = archiveUserById(ownerId);
    const payload = clone(state.store);
    try {
      if (ownerId !== userId && !game.user?.isGM)
        throw new Error("Недостаточно прав для чужого архива");
      if (typeof owner?.update !== "function")
        throw new Error("User.update недоступен");
      await owner.update({ "flags.personalChronicleMacro.data": payload });
      state.storageMode = "server";
      if (state.archiveUserId === ownerId && state.revision === revision)
        state.pendingServer = false;
      updateSaveBadge(
        state.revision === revision ? "SYNC ✓" : "DRAFT…",
        state.revision === revision ? "server" : "pending",
      );
    } catch (error) {
      state.storageMode = "local";
      updateSaveBadge("LOCAL", "local");
      console.warn(
        "Нейро-архив RED: серверное сохранение недоступно, используется браузер",
        error,
      );
    } finally {
      state.saving = false;
      if (state.saveAgain || state.revision !== revision) {
        clearTimeout(state.saveTimer);
        state.saveTimer = setTimeout(() => saveServer(false), 80);
      }
    }
  }

  async function flushPendingSave() {
    const deadline = Date.now() + 10000;
    while (state.saving && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 40));
    if (state.saving) {
      notify(
        "Синхронизация ещё выполняется. Повтори переключение через несколько секунд.",
        "warn",
      );
      return false;
    }
    if (state.pendingServer) await saveServer(true);
    return !state.saving;
  }

  async function switchArchiveUser(ownerId) {
    if (ownerId === state.archiveUserId) return;
    if (ownerId !== userId && !game.user?.isGM)
      return notify("Чужие архивы доступны только ГМу.", "error");
    clearTimeout(state.saveTimer);
    if (!(await flushPendingSave())) return;
    clearTimeout(state.saveTimer);
    state.saveAgain = false;
    const owner = archiveUserById(ownerId);
    const prepared = prepareArchive(owner);
    state.archiveUserId = owner.id ?? owner._id;
    state.store = prepared.store;
    state.actors = prepared.actors;
    state.restoredLocal = prepared.restoredLocal;
    state.storageMode =
      prepared.hasServerData && !prepared.restoredLocal ? "server" : "local";
    state.revision = 0;
    state.pendingServer = false;
    state.quick = "";
    state.search = "";
    state.settingsOpen = false;
    state.helpOpen = false;
    resetView("dashboard");
    render();
    if (prepared.restoredLocal)
      notify(
        `Восстановлен свежий локальный черновик архива «${owner.name}».`,
        "warn",
      );
  }

  function opt(value, current, label = value) {
    return `<option value="${esc(value)}" ${String(value) === String(current) ? "selected" : ""}>${esc(label)}</option>`;
  }
  function input(
    label,
    field,
    value,
    placeholder = "",
    type = "text",
    wide = false,
  ) {
    return `<label class="pcm-field ${wide ? "wide" : ""}"><span>${esc(label)}</span><input type="${type}" data-field="${field}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
  }
  function area(label, field, value, placeholder = "", wide = true) {
    return `<label class="pcm-field area ${wide ? "wide" : ""}"><span>${esc(label)}</span><textarea data-field="${field}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
  }
  function select(label, field, values, current, wide = false) {
    return `<label class="pcm-field ${wide ? "wide" : ""}"><span>${esc(label)}</span><select data-field="${field}">${values.map((value) => opt(value, current)).join("")}</select></label>`;
  }
  function linkSelect(label, field, entries, current, empty) {
    return `<label class="pcm-field"><span>${esc(label)}</span><select data-field="${field}">${opt("", current, empty)}${entries.map((item) => opt(item.id, current, item.title)).join("")}</select></label>`;
  }

  function locationChecks(entry, locations) {
    const selected = new Set(entryLocationIds(entry));
    if (!locations.length)
      return '<div class="pcm-location-checks empty">Сначала создайте хотя бы одну точку.</div>';
    return `<div class="pcm-location-checks">${locations.map((location) => `<label><input type="checkbox" data-location-link value="${esc(location.id)}" ${selected.has(location.id) ? "checked" : ""}><span>${esc(location.title)}</span></label>`).join("")}</div>`;
  }

  function typeFields(entry, book) {
    const people = book.entries.people;
    const locations = book.entries.locations;
    if (entry.type === "people")
      return `
      ${input("Роль / занятие", "role", entry.role, "фиксер, соло, корпорат, риппер…")}${input("Фракция / тип", "ancestry", entry.ancestry, "корпорация, банда, клан…")}
      ${select("Статус", "status", ["Неизвестно", "Активен", "Мёртв", "Пропал", "В плену", "Недоступен"], entry.status)}
      ${select("Отношение", "attitude", ["Враждебно", "Недоверие", "Нейтрально", "Полезен", "Союзник", "Близко"], entry.attitude)}
      ${input("Наши отношения", "relationship", entry.relationship, "долг, союз, конфликт, рычаг…")}${input("Где / когда пересеклись", "firstMet", entry.firstMet)}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>
      ${area("Цитаты и факты", "quotes", entry.quotes, "Фразы, обещания, оговорки…")}
      ${area("Обещания и долги", "promises", entry.promises)}${area("Подозрения / секреты", "secrets", entry.secrets)}`;
    if (entry.type === "locations")
      return `
      ${input("Тип точки", "kind", entry.kind, "бар, клиника, офис, убежище…")}${input("Район / зона", "region", entry.region)}
      ${select("Статус", "status", ["Активна", "Не разведана", "Проверена", "Опасна", "Закрыта", "Уничтожена"], entry.status)}${input("Первый визит", "firstVisited", entry.firstVisited)}
      ${area("Атмосфера и приметы", "atmosphere", entry.atmosphere)}${area("Угрозы и охрана", "dangers", entry.dangers)}
      ${area("Услуги и ресурсы", "services", entry.services)}${area("Маршрут / доступ", "travel", entry.travel)}`;
    if (entry.type === "quests")
      return `
      ${select("Состояние", "status", ["Активно", "Приостановлено", "Выполнено", "Провалено", "Отказались", "Скрытое"], entry.status)}
      ${linkSelect("Заказчик", "giverId", people, entry.giverId, "Не выбран")}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>
      ${input("Срок", "deadline", entry.deadline, "дата или условие")}${area("Цель", "objective", entry.objective)}
      ${area("Награда", "reward", entry.reward)}${area("Следующий шаг", "nextStep", entry.nextStep)}`;
    if (entry.type === "clues")
      return `
      ${select("Состояние", "status", ["Новая", "Проверяется", "Связана", "Разгадана", "Ложный след"], entry.status)}${input("Источник", "source", entry.source)}
      ${linkSelect("Связанный контакт", "personId", people, entry.personId, "Не выбран")}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>
      ${area("Теория", "theory", entry.theory)}${area("Вывод / разгадка", "conclusion", entry.conclusion)}`;
    if (entry.type === "sessions")
      return `
      ${input("Дата игры", "realDate", entry.realDate, "", "date")}${input("Дата в мире", "gameDate", entry.gameDate)}
      ${input("Участники", "participants", entry.participants, "", "text", true)}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>
      ${area("Главные события", "events", entry.events)}
      ${area("Решения и последствия", "decisions", entry.decisions)}${area("Добыча и расходы", "loot", entry.loot)}${area("К следующей игре", "nextTime", entry.nextTime)}`;
    return `${select("Категория", "category", ["Общее", "Слух", "Адрес", "Долг", "План", "Покупки", "Тактика", "Напоминание"], entry.category)}
      <div class="pcm-field wide"><span>Связанные точки</span>${locationChecks(entry, locations)}</div>`;
  }

  function tasks(entry) {
    if (entry.type !== "quests") return "";
    return `<section class="pcm-sub"><header><h3>${fa("fa-list-check")} Этапы гига</h3><button data-action="add-task">${fa("fa-plus")} Этап</button></header>
      <div class="pcm-tasks">${entry.tasks.length ? entry.tasks.map((task) => `<div class="pcm-task ${task.done ? "done" : ""}" data-task-id="${task.id}"><input type="checkbox" data-task-done ${task.done ? "checked" : ""}><input data-task-text value="${esc(task.text)}" placeholder="Что нужно сделать"><button data-action="delete-task" title="Удалить этап">${fa("fa-xmark")}</button></div>`).join("") : '<p class="muted">Разбей гиг на шаги — прогресс станет виден сразу.</p>'}</div></section>`;
  }

  function fragments(entry) {
    if (!entry.fragments.length) return "";
    return `<section class="pcm-sub"><h3>${fa("fa-layer-group")} Сворачиваемые фрагменты</h3>${entry.fragments
      .map(
        (
          fragment,
          index,
        ) => `<details class="pcm-fragment" data-fragment-id="${fragment.id}" ${state.openFragmentId === fragment.id ? "open" : ""}>
      <summary><span>▸ ${esc(fragment.title || `Фрагмент ${index + 1}`)}</span></summary>
      <div class="pcm-fragment-body">
        <button class="pcm-fragment-delete" data-action="delete-fragment" title="Удалить">${fa("fa-trash")}</button>
        <label class="pcm-field"><span>Заголовок</span><input data-fragment-field="title" value="${esc(fragment.title)}"></label>
        <label class="pcm-field"><span>Изображение: путь Foundry или URL</span><div class="pcm-path"><input data-fragment-field="image" value="${esc(fragment.image)}"><button data-action="pick-fragment-image">Выбрать файл</button></div></label>
        <div class="pcm-paste-zone pcm-fragment-paste" data-paste-target="fragment" tabindex="0"><b>Ctrl+V</b><span>Щёлкните сюда и вставьте картинку прямо в этот фрагмент</span></div>
        ${fragment.image ? `<img class="pcm-fragment-img" src="${esc(fragment.image)}" alt="">` : ""}
        <label class="pcm-field area"><span>Содержимое</span><textarea data-fragment-field="content">${esc(fragment.content)}</textarea></label>
      </div></details>`,
      )
      .join("")}</section>`;
  }

  function galleryEditor(entry) {
    if (entry.type !== "people") return "";
    const items = entry.gallery
      .map(
        (
          item,
          index,
        ) => `<article class="pcm-gallery-edit" data-gallery-id="${item.id}">
      <button class="pcm-gallery-preview" data-action="view-gallery-image" title="Открыть крупно"><img src="${esc(item.image)}" alt=""></button>
      <label class="pcm-field"><span>Подпись к изображению</span><input data-gallery-caption value="${esc(item.caption)}" placeholder="Портрет, одежда, имплант, предмет при контакте…"></label>
      <div><button data-action="set-gallery-cover" title="Сделать основной картинкой">${fa(entry.image === item.image ? "fa-star" : "fa-image")} ${entry.image === item.image ? "Обложка" : "На обложку"}</button><button data-action="pick-gallery-image">${fa("fa-rotate")} Заменить</button><button class="danger" data-action="delete-gallery-image" title="Удалить изображение">${fa("fa-trash")}</button></div>
      <small>Изображение ${index + 1}</small>
    </article>`,
      )
      .join("");
    return `<section class="pcm-sub pcm-gallery-editor"><header><div><h3>${fa("fa-images")} Галерея контакта</h3><p>Портреты, одежда, импланты, предметы и сцены. Любую картинку можно сделать обложкой.</p></div><button data-action="add-gallery-image">${fa("fa-plus")} Выбрать файл</button></header>
      <div class="pcm-paste-zone" data-paste-target="gallery" tabindex="0"><b>Ctrl+V</b><span>Щёлкните сюда и вставляйте картинки — каждая добавится отдельно</span></div>
      <div class="pcm-gallery-edit-grid">${items || '<div class="pcm-inline-empty">В галерее пока нет изображений.</div>'}</div>
    </section>`;
  }

  function links(entry, book) {
    const rows = [];
    const link = (item) =>
      `<button class="pcm-link" data-action="open-entry" data-section="${item.type}" data-entry-id="${item.id}">${sectionIcon(item.type)} ${esc(item.title)}</button>`;
    const locations = entryLocationIds(entry)
      .map((id) => book.entries.locations.find((item) => item.id === id))
      .filter(Boolean);
    if (entry.type === "people") {
      const gigs = book.entries.quests.filter(
        (quest) => quest.giverId === entry.id,
      );
      const clues = book.entries.clues.filter(
        (clue) => clue.personId === entry.id,
      );
      if (gigs.length)
        rows.push(
          `<div><span>Гиги от контакта:</span>${gigs.map(link).join("")}</div>`,
        );
      if (clues.length)
        rows.push(
          `<div><span>Зацепки:</span>${clues.map(link).join("")}</div>`,
        );
    }
    if (entry.type === "locations") {
      const here = [...LOCATION_LINK_TYPES].flatMap((type) =>
        book.entries[type].filter((item) =>
          entryLocationIds(item).includes(entry.id),
        ),
      );
      if (here.length)
        rows.push(
          `<div><span>Связано с точкой:</span>${here.map(link).join("")}</div>`,
        );
    }
    if (entry.type === "quests" && entry.giverId) {
      const giver = book.entries.people.find(
        (item) => item.id === entry.giverId,
      );
      if (giver) rows.push(`<div><span>Заказчик:</span>${link(giver)}</div>`);
    }
    if (entry.type === "clues" && entry.personId) {
      const person = book.entries.people.find(
        (item) => item.id === entry.personId,
      );
      if (person) rows.push(`<div><span>Контакт:</span>${link(person)}</div>`);
    }
    if (locations.length)
      rows.push(
        `<div><span>Точки:</span>${locations.map(link).join("")}</div>`,
      );
    return rows.length
      ? `<section class="pcm-sub pcm-links"><h3>${fa("fa-link")} Связи</h3>${rows.join("")}</section>`
      : "";
  }

  function editorBody(entry, book) {
    return `<div class="pcm-card-body">
      <div class="pcm-card-actions"><button data-action="to-chat" title="В чат: шёпотом себе, Shift+клик — всем">${fa("fa-paper-plane")}</button><button data-action="pin" title="Закрепить">${fa(entry.pinned ? "fa-star" : "fa-thumbtack")}</button><button data-action="duplicate" title="Создать осознанную копию">${fa("fa-copy")}</button><button class="danger" data-action="delete" title="Удалить">${fa("fa-trash")}</button></div>
      <div class="pcm-image-row"><div class="pcm-cover">${entry.image ? `<img src="${esc(entry.image)}" alt="">` : `${fa("fa-image")}<small>Обложка</small>`}</div><label class="pcm-field"><span>Картинка: нажмите «Выбрать» или вставьте <b>Ctrl+V</b></span><div class="pcm-path"><input data-field="image" value="${esc(entry.image)}" placeholder="Путь Foundry или URL"><button data-action="pick-image">${fa("fa-folder-open")} Выбрать</button></div></label></div>
      <div class="pcm-grid">${input("Название", "title", entry.title, "", "text", true)}${area("Быстрая заметка", "summary", entry.summary, "Главное — коротко, прямо во время игры")}${input("Теги через запятую", "tags", entry.tags, "важное, союзник, вернуться", "text", true)}</div>
      ${area("Текст", "content", entry.content, "Продолжайте писать — автосохранение не прервёт ввод…")}
      <details class="pcm-extra"><summary>${fa("fa-sliders")} Дополнительно: связи, статусы и подробности</summary><div class="pcm-grid">${typeFields(entry, book)}</div>${tasks(entry)}</details>${links(entry, book)}${galleryEditor(entry)}${fragments(entry)}
      <div class="pcm-add-fragment"><button data-action="add-fragment">${fa("fa-plus")} Сворачиваемый фрагмент</button><span>Переписка, разговор, этаж, слух, тайник или отдельная картинка</span></div>
    </div>`;
  }

  function card(entry, book) {
    const tags = String(entry.tags)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const search = [
      entry.title,
      entry.summary,
      entry.content,
      entry.tags,
      ...entry.fragments.map((f) => `${f.title} ${f.content}`),
    ]
      .join(" ")
      .toLowerCase();
    return `<details class="pcm-card ${entry.pinned ? "pinned" : ""}" data-entry-id="${entry.id}" data-search="${esc(search)}" ${state.openId === entry.id ? "open" : ""}>
      <summary><div class="pcm-thumb">${entry.image ? `<img src="${esc(entry.image)}" alt="">` : sectionIcon(entry.type)}</div><div><h2>${esc(entry.title)}</h2><p>${short(entry.summary || entry.content || "Нажмите, чтобы открыть запись")}</p><small>${tags
        .slice(0, 4)
        .map(
          (tag) => `<i class="pcm-tag" data-tag="${esc(tag)}">#${esc(tag)}</i>`,
        )
        .join(" ")}</small></div><b>${fa("fa-chevron-down")}</b></summary>
      ${editorBody(entry, book)}</details>`;
  }

  function dashboard(book) {
    const themeLabel =
      THEME_PRESETS[bookAppearance(book).preset]?.label ??
      THEME_PRESETS.red.label;
    const counts = Object.fromEntries(
      Object.keys(SECTIONS).map((key) => [key, book.entries[key].length]),
    );
    const recent = Object.values(book.entries)
      .flat()
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 8);
    const owner = archiveUserById(state.archiveUserId);
    const gmLine =
      state.archiveUserId !== userId
        ? `<div class="pcm-gm-line">${fa("fa-user-shield")} РЕЖИМ ГМа · вы редактируете архив пользователя <b>${esc(owner.name)}</b></div>`
        : "";
    return `${gmLine}<div class="pcm-welcome"><div><span>// НЕЙРО-АРХИВ ${esc(themeLabel)}</span><h1>${esc(book.actorName)}</h1><p>Контакты, точки, гиги, зацепки и решения — отдельный архив памяти этого оперативника.</p></div><img src="${esc(book.actorImg)}" alt=""></div>
      <section class="pcm-quick"><h2>${fa("fa-bolt")} Быстрый дамп</h2><p>Скинь мысль как есть. Оформишь потом. <b>Ctrl+Enter</b> — сохранить.</p><textarea data-quick placeholder="Имя, адрес, слух, номер, план…">${esc(state.quick)}</textarea><div><button class="primary" data-action="quick" data-target="notes">${fa("fa-floppy-disk")} Сохранить дамп</button><button data-action="quick" data-target="people">${sectionIcon("people")} Контакт</button><button data-action="quick" data-target="locations">${sectionIcon("locations")} Точка</button><button data-action="quick" data-target="clues">${sectionIcon("clues")} Зацепка</button></div>
      <div class="pcm-quick-extra"><span>Со стола:</span><button data-action="from-token">${fa("fa-crosshairs")} Контакты из целей</button><button data-action="from-scene">${fa("fa-map")} Точка из сцены</button><span>Шаблоны:</span><button data-action="template" data-template="rumor">Слух</button><button data-action="template" data-template="address">Адрес</button><button data-action="template" data-template="debt">Долг</button></div></section>
      <div class="pcm-stat-grid">${Object.entries(SECTIONS)
        .map(
          ([key, section]) =>
            `<button data-action="nav" data-section="${key}"><b>${counts[key]}</b><span>${sectionIcon(key)} ${section.label}</span></button>`,
        )
        .join("")}</div>
      ${recent.length ? `<section class="pcm-recent"><h2>${fa("fa-clock")} Недавнее</h2>${recent.map((entry) => `<button data-action="open-entry" data-section="${entry.type}" data-entry-id="${entry.id}"><b>${sectionIcon(entry.type)}</b><span>${esc(entry.title)}<small>${short(entry.summary || entry.content, 70)}</small></span></button>`).join("")}</section>` : `<section class="pcm-onboarding"><h2>${fa("fa-circle-info")} Архив пока пуст</h2><ol><li>Сделай быстрый дамп выше — это самый быстрый старт.</li><li>Выбери NPC целями клавишей <b>T</b> и нажми «Контакты из целей».</li><li>Открой любой раздел слева: там будет короткая инструкция именно для него.</li><li>Полное описание функций находится в пункте «Как пользоваться» слева.</li></ol></section>`}`;
  }

  function sortedEntries(entries) {
    return [...entries].sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        String(b.updatedAt).localeCompare(String(a.updatedAt)),
    );
  }

  function readText(value, empty = "Пока ничего не записано.") {
    return `<div class="pcm-read-text ${value ? "" : "empty"}">${value ? esc(value) : esc(empty)}</div>`;
  }

  function readFragments(entry) {
    if (!entry.fragments.length) return "";
    return `<section class="pcm-detail-panel wide"><h3>${fa("fa-layer-group")} Отдельные фрагменты</h3>${entry.fragments.map((fragment, index) => `<details class="pcm-read-fragment"><summary>${esc(fragment.title || `Фрагмент ${index + 1}`)}</summary><div>${fragment.image ? `<img src="${esc(fragment.image)}" alt="">` : ""}${readText(fragment.content)}</div></details>`).join("")}</section>`;
  }

  function linkedPeople(book, locationId) {
    return linkedEntries(book, "people", locationId);
  }

  function linkedEntries(book, type, locationId) {
    return sortedEntries(
      book.entries[type].filter((entry) =>
        entryLocationIds(entry).includes(locationId),
      ),
    );
  }

  function emptyState(key) {
    const guides = {
      people: {
        title: "Контактов пока нет",
        steps: [
          "Выбери одного или нескольких NPC целями клавишей T.",
          "Нажми «Из целей»: все выбранные токены добавятся одним разом.",
          "Повторный импорт не создаст дубль, а откроет уже существующий контакт.",
        ],
        extra: `<button data-action="from-token">${fa("fa-crosshairs")} Из выбранных целей</button>`,
      },
      locations: {
        title: "Точек пока нет",
        steps: [
          "Открой нужную сцену Foundry.",
          "Нажми «Из сцены» — название и фон подставятся автоматически.",
          "Привязывай к точке контакты, гиги, зацепки и записи сессий.",
        ],
        extra: `<button data-action="from-scene">${fa("fa-map")} Из текущей сцены</button>`,
      },
      quests: {
        title: "Гигов пока нет",
        steps: [
          "Создай гиг и укажи заказчика.",
          "Свяжи его с одной или несколькими точками.",
          "Разбей работу на этапы и отмечай выполненное.",
        ],
        extra: "",
      },
      clues: {
        title: "Зацепок пока нет",
        steps: [
          "Запиши источник и факты отдельно от своей теории.",
          "Привяжи контакт и точки, к которым относится след.",
          "Меняй статус, когда след проверен или оказался ложным.",
        ],
        extra: "",
      },
      sessions: {
        title: "Лог сессий пуст",
        steps: [
          "После игры создай запись с реальной и игровой датой.",
          "Отметь ключевые решения, добычу и последствия.",
          "Свяжи посещённые точки — их история соберётся автоматически.",
        ],
        extra: "",
      },
      notes: {
        title: "Дампов пока нет",
        steps: [
          "Пиши мысль в быстром дампе на главной и жми Ctrl+Enter.",
          "Или вставь текст Ctrl+V вне полей ввода.",
          "Используй шаблоны «Слух», «Адрес» и «Долг» для типовых записей.",
        ],
        extra: "",
      },
    };
    const guide = guides[key];
    return `<div class="pcm-empty"><b>${sectionIcon(key)}</b><h2>${guide.title}</h2><ol>${guide.steps.map((step) => `<li>${step}</li>`).join("")}</ol><div>${guide.extra}<button class="primary" data-action="add" data-section="${key}">${fa("fa-plus")} Создать ${SECTIONS[key].one}</button></div></div>`;
  }

  function locationListView(book) {
    const entries = sortedEntries(book.entries.locations);
    const cards = entries
      .map((location) => {
        const people = linkedPeople(book, location.id);
        const quests = linkedEntries(book, "quests", location.id);
        const clues = linkedEntries(book, "clues", location.id);
        const sessions = linkedEntries(book, "sessions", location.id);
        const notes = linkedEntries(book, "notes", location.id);
        const relatedTitles = [
          ...people,
          ...quests,
          ...clues,
          ...sessions,
          ...notes,
        ].map((entry) => entry.title);
        const search = [
          location.title,
          location.summary,
          location.content,
          location.tags,
          location.kind,
          location.region,
          ...relatedTitles,
        ]
          .join(" ")
          .toLowerCase();
        return `<article class="pcm-location-card ${location.pinned ? "pinned" : ""}" data-entry-id="${location.id}" data-search="${esc(search)}">
        <button class="pcm-location-open" data-action="view-location">
          <div class="pcm-location-image">${location.image ? `<img src="${esc(location.image)}" alt="">` : sectionIcon("locations")}</div>
          <div class="pcm-location-copy"><small>${esc([location.kind, location.region].filter(Boolean).join(" · ") || "ТОЧКА")}</small><h2>${esc(location.title)}</h2><p>${short(location.summary || location.content || "Открыть досье точки", 150)}</p><div class="pcm-location-counts"><span title="Контакты">${sectionIcon("people")} ${people.length}</span><span title="Гиги">${sectionIcon("quests")} ${quests.length}</span><span title="Зацепки">${sectionIcon("clues")} ${clues.length}</span><span title="Логи">${sectionIcon("sessions")} ${sessions.length}</span><span title="Дампы">${sectionIcon("notes")} ${notes.length}</span><i>${esc(location.status || "")}</i></div></div>
          <b>${fa("fa-arrow-right")}</b>
        </button>
      </article>`;
      })
      .join("");
    return `<div class="pcm-section-head"><div><small>${entries.length} ТОЧЕК</small><h1>${sectionIcon("locations")} Точки</h1></div><div><label class="pcm-search">${fa("fa-magnifying-glass")} <input data-search-box value="${esc(state.search)}" placeholder="Точка или контакт…"></label><button data-action="from-scene" title="Создать точку из текущей сцены">${fa("fa-map")} Из сцены</button><button data-action="to-journal" title="Экспортировать раздел в JournalEntry">${fa("fa-book")} В журнал</button><button class="primary" data-action="add" data-section="locations">${fa("fa-plus")} Добавить</button></div></div>
      <p class="pcm-section-hint">Клик по карточке открывает досье точки и все её связи. Для изменения нажми «Редактировать» внутри.</p>
      <div class="pcm-location-list">${cards || emptyState("locations")}</div>`;
  }

  function locationOverview(book, location) {
    const people = linkedPeople(book, location.id);
    const unlinked = sortedEntries(
      book.entries.people.filter(
        (person) => !personLocationIds(person).includes(location.id),
      ),
    );
    const quests = linkedEntries(book, "quests", location.id);
    const clues = linkedEntries(book, "clues", location.id);
    const sessions = linkedEntries(book, "sessions", location.id);
    const notes = linkedEntries(book, "notes", location.id);
    const personCards = people
      .map(
        (person) => `<div class="pcm-person-tile" data-entry-id="${person.id}">
      <button class="pcm-person-open" data-action="view-person" data-location-id="${location.id}"><span class="pcm-person-image">${person.image ? `<img src="${esc(person.image)}" alt="">` : sectionIcon("people")}</span><span><b>${esc(person.title)}</b><small>${esc([person.role, person.attitude].filter(Boolean).join(" · ") || "Открыть досье")}</small><em>${short(person.summary || person.quotes || person.content, 82)}</em></span></button>
      <button class="pcm-person-unlink" data-action="unlink-person" data-location-id="${location.id}" title="Убрать связь с этой точкой">${fa("fa-link-slash")}</button>
    </div>`,
      )
      .join("");
    const related = (entries, type, empty) =>
      entries.length
        ? entries
            .map(
              (item) =>
                `<button class="pcm-related-row" data-action="open-related" data-entry-id="${item.id}"><b>${sectionIcon(type)}</b><span>${esc(item.title)}<small>${short(item.summary || item.objective || item.theory || item.content, 90)}</small></span><i>${fa("fa-arrow-right")}</i></button>`,
            )
            .join("")
        : `<p class="muted">${empty}</p>`;
    return `<div class="pcm-detail" data-entry-id="${location.id}">
      <div class="pcm-detail-nav"><button data-action="back-list" data-section="locations">${fa("fa-arrow-left")} Все точки</button><div><button data-action="pin">${fa(location.pinned ? "fa-star" : "fa-thumbtack")} ${location.pinned ? "Закреплено" : "Закрепить"}</button><button class="primary" data-action="edit-entry">${fa("fa-pen")} Редактировать точку</button></div></div>
      <section class="pcm-location-hero"><div class="pcm-location-hero-image">${location.image ? `<img src="${esc(location.image)}" alt="">` : sectionIcon("locations")}</div><div><small>${esc([location.kind, location.region].filter(Boolean).join(" · ") || "ТОЧКА")}</small><h1>${esc(location.title)}</h1><div class="pcm-badges"><span>${esc(location.status || "Без статуса")}</span>${location.firstVisited ? `<span>Первый визит: ${esc(location.firstVisited)}</span>` : ""}<span>${sectionIcon("people")} ${people.length} контактов</span></div>${readText(location.summary, "Краткая сводка пока не добавлена.")}</div></section>
      <div class="pcm-detail-grid">
        <section class="pcm-detail-panel wide"><header><div><small>КТО ЗДЕСЬ БЫЛ</small><h2>${sectionIcon("people")} Контакты в этой точке</h2></div><button class="primary" data-action="add-person-here">${fa("fa-plus")} Новый контакт</button></header>
          <div class="pcm-people-grid">${personCards || '<div class="pcm-inline-empty">Здесь пока никто не отмечен. Создай контакт или привяжи существующий.</div>'}</div>
          ${unlinked.length ? `<details class="pcm-link-existing"><summary>${fa("fa-link")} Привязать существующий контакт</summary><div>${unlinked.map((person) => `<button data-action="link-person" data-person-id="${person.id}">${sectionIcon("people")} ${esc(person.title)}<small>${esc(person.role || person.attitude || "")}</small></button>`).join("")}</div></details>` : ""}
        </section>
        <section class="pcm-detail-panel"><h3>${fa("fa-circle-info")} О точке</h3>${readText(location.content)}${location.atmosphere ? `<h4>Атмосфера и приметы</h4>${readText(location.atmosphere)}` : ""}${location.dangers ? `<h4>Угрозы и охрана</h4>${readText(location.dangers)}` : ""}</section>
        <section class="pcm-detail-panel"><h3>${fa("fa-toolbox")} Полезное</h3>${location.services ? `<h4>Услуги и ресурсы</h4>${readText(location.services)}` : '<p class="muted">Услуги и ресурсы не отмечены.</p>'}${location.travel ? `<h4>Маршрут / доступ</h4>${readText(location.travel)}` : ""}</section>
        <section class="pcm-detail-panel"><header><h3>${sectionIcon("quests")} Гиги здесь</h3><button data-action="add-related-here" data-type="quests">${fa("fa-plus")} Гиг</button></header>${related(quests, "quests", "Связанных гигов нет.")}</section>
        <section class="pcm-detail-panel"><header><h3>${sectionIcon("clues")} Зацепки</h3><button data-action="add-related-here" data-type="clues">${fa("fa-plus")} Зацепка</button></header>${related(clues, "clues", "Связанных зацепок нет.")}</section>
        <section class="pcm-detail-panel"><header><h3>${sectionIcon("sessions")} История точки</h3><button data-action="add-related-here" data-type="sessions">${fa("fa-plus")} Лог</button></header>${related(sessions, "sessions", "Записей лога здесь нет.")}</section>
        <section class="pcm-detail-panel"><header><h3>${sectionIcon("notes")} Дампы</h3><button data-action="add-related-here" data-type="notes">${fa("fa-plus")} Дамп</button></header>${related(notes, "notes", "Связанных дампов нет.")}</section>
        ${readFragments(location)}
      </div>
    </div>`;
  }

  function personOverview(book, person) {
    const locations = personLocationIds(person)
      .map((id) =>
        book.entries.locations.find((location) => location.id === id),
      )
      .filter(Boolean);
    const gigs = sortedEntries(
      book.entries.quests.filter((quest) => quest.giverId === person.id),
    );
    const clues = sortedEntries(
      book.entries.clues.filter((clue) => clue.personId === person.id),
    );
    const related = (items, type, empty) =>
      items.length
        ? items
            .map(
              (item) =>
                `<button class="pcm-related-row" data-action="open-related" data-entry-id="${item.id}"><b>${sectionIcon(type)}</b><span>${esc(item.title)}<small>${short(item.summary || item.objective || item.theory || item.content, 90)}</small></span><i>${fa("fa-arrow-right")}</i></button>`,
            )
            .join("")
        : `<p class="muted">${empty}</p>`;
    const back =
      state.returnLocationId &&
      book.entries.locations.some(
        (location) => location.id === state.returnLocationId,
      )
        ? `<button data-action="back-location" data-location-id="${state.returnLocationId}">${fa("fa-arrow-left")} Вернуться к точке</button>`
        : `<button data-action="back-list" data-section="people">${fa("fa-arrow-left")} Все контакты</button>`;
    return `<div class="pcm-detail" data-entry-id="${person.id}">
      <div class="pcm-detail-nav">${back}<div><button data-action="to-chat" title="Шёпотом себе, Shift+клик — всем">${fa("fa-paper-plane")} В чат</button><button data-action="pin">${fa(person.pinned ? "fa-star" : "fa-thumbtack")} ${person.pinned ? "Закреплено" : "Закрепить"}</button><button class="primary" data-action="edit-entry">${fa("fa-pen")} Редактировать контакт</button></div></div>
      <section class="pcm-person-hero"><div class="pcm-person-portrait">${person.image ? `<img src="${esc(person.image)}" alt="">` : sectionIcon("people")}</div><div><small>${esc([person.role, person.ancestry].filter(Boolean).join(" · ") || "КОНТАКТ")}</small><h1>${esc(person.title)}</h1><div class="pcm-badges"><span>${esc(person.status || "Неизвестно")}</span><span>${esc(person.attitude || "Нейтрально")}</span></div>${readText(person.summary, "Краткая сводка пока не добавлена.")}</div></section>
      <div class="pcm-detail-grid">
        ${person.gallery.length ? `<section class="pcm-detail-panel wide"><h3>${fa("fa-images")} Галерея контакта</h3><div class="pcm-gallery-view">${person.gallery.map((item) => `<button data-action="view-gallery-image" data-gallery-id="${item.id}"><img src="${esc(item.image)}" alt="${esc(item.caption)}"><span>${esc(item.caption || "Открыть изображение")}</span></button>`).join("")}</div></section>` : ""}
        <section class="pcm-detail-panel wide"><h3>${sectionIcon("locations")} Где пересекались</h3><div class="pcm-location-chips">${locations.length ? locations.map((location) => `<button data-action="view-location" data-location-id="${location.id}" data-entry-id="${location.id}">${sectionIcon("locations")} ${esc(location.title)}</button>`).join("") : '<span class="muted">Точки пока не связаны.</span>'}</div>${person.firstMet ? `<h4>Первая встреча</h4>${readText(person.firstMet)}` : ""}</section>
        <section class="pcm-detail-panel"><header><h3>${sectionIcon("quests")} Гиги от контакта</h3></header>${related(gigs, "quests", "Связанных гигов нет.")}</section>
        <section class="pcm-detail-panel"><header><h3>${sectionIcon("clues")} Зацепки</h3></header>${related(clues, "clues", "Связанных зацепок нет.")}</section>
        <section class="pcm-detail-panel"><h3>Мои заметки</h3>${readText(person.content)}${person.relationship ? `<h4>Наши отношения</h4>${readText(person.relationship)}` : ""}</section>
        <section class="pcm-detail-panel"><h3>Что говорил</h3>${readText(person.quotes, "Цитат и важных фактов пока нет.")}</section>
        <section class="pcm-detail-panel"><h3>Обещания и долги</h3>${readText(person.promises, "Ничего не отмечено.")}</section>
        <section class="pcm-detail-panel"><h3>Подозрения и секреты</h3>${readText(person.secrets, "Ничего не отмечено.")}</section>
        ${readFragments(person)}
      </div>
    </div>`;
  }

  function editorView(entry, book) {
    return `<div class="pcm-editor-view" data-entry-id="${entry.id}"><div class="pcm-detail-nav"><button data-action="back-editor">${fa("fa-arrow-left")} Назад</button><div><small>РЕДАКТИРОВАНИЕ</small><b>${esc(entry.title)}</b></div></div><section class="pcm-editor-card pcm-card">${editorBody(entry, book)}</section></div>`;
  }

  function sectionView(book, key) {
    if (state.viewMode === "edit") {
      const entry = entryById(state.viewId);
      if (entry) return editorView(entry, book);
      resetView(key);
    }
    if (state.viewMode === "location") {
      const location = book.entries.locations.find(
        (entry) => entry.id === state.viewId,
      );
      if (location) return locationOverview(book, location);
      resetView("locations");
    }
    if (state.viewMode === "person") {
      const person = book.entries.people.find(
        (entry) => entry.id === state.viewId,
      );
      if (person) return personOverview(book, person);
      resetView(key);
    }
    if (key === "locations") return locationListView(book);

    const section = SECTIONS[key];
    const entries = sortedEntries(book.entries[key]);
    const importButton =
      key === "people"
        ? `<button data-action="from-token" title="Добавить все выбранные цели без дублей">${fa("fa-crosshairs")} Из целей</button>`
        : "";
    return `<div class="pcm-section-head"><div><small>${entries.length} ЗАПИСЕЙ // СЕКТОР</small><h1>${sectionIcon(key)} ${section.label}</h1></div><div><label class="pcm-search">${fa("fa-magnifying-glass")} <input data-search-box value="${esc(state.search)}" placeholder="Поиск…"></label>${importButton}<button data-action="to-journal" title="Экспортировать раздел в JournalEntry">${fa("fa-book")} В журнал</button><button class="primary" data-action="add" data-section="${key}">${fa("fa-plus")} Добавить</button></div></div>
      <div class="pcm-list">${entries.length ? entries.map((entry) => card(entry, book)).join("") : emptyState(key)}</div>`;
  }

  function nav(key, label, icon, count = null) {
    return `<button class="${state.section === key ? "active" : ""}" data-action="nav" data-section="${key}"><b>${fa(icon)}</b><span>${label}</span>${count !== null ? `<i>${count}</i>` : ""}</button>`;
  }

  function themePanel(book) {
    if (!state.settingsOpen) return "";
    const theme = bookAppearance(book);
    const presetLabel =
      THEME_PRESETS[theme.preset]?.label ?? THEME_PRESETS.red.label;
    return `<div class="pcm-modal-backdrop" data-modal="appearance"><section class="pcm-theme-panel" role="dialog" aria-label="Оформление архива">
      <header><div><small>ОПЕРАТИВНИК: ${esc(book.actorName)}</small><h2>${fa("fa-palette")} Протокол отображения</h2><p>Три самостоятельные киберпанк-палитры. Настройка хранится отдельно для каждого оперативника.</p></div><button data-action="close-appearance" title="Закрыть">${fa("fa-xmark")}</button></header>
      <div class="pcm-theme-presets">${Object.entries(THEME_PRESETS)
        .map(
          ([key, preset]) =>
            `<button class="${theme.preset === key ? "active" : ""}" data-action="theme-preset" data-preset="${key}">
              <span class="pcm-theme-palette" style="--swatch-bg:${preset.background};--swatch-panel:${preset.panel};--swatch-accent:${preset.accent};--swatch-secondary:${preset.secondary}" aria-hidden="true">
                <i></i><i></i><i></i><i></i>
              </span>
              <strong>${esc(preset.label)}</strong>
            </button>`,
        )
        .join("")}</div>
      <label class="pcm-font-size"><span>Размер текста <b data-font-size-output>${theme.fontSize}px</b><small>Меняет интерфейс и поля ввода, не затрагивая данные.</small></span><input type="range" min="11" max="17" step="1" data-theme-field="fontSize" value="${theme.fontSize}"></label>
      <div class="pcm-theme-preview"><small>ПРЕДПРОСМОТР · ${esc(presetLabel)}</small><h3>// NIGHT CITY DATABASE</h3><p>Выбранная палитра применяется ко всему интерфейсу этого архива.</p><button class="primary" type="button">EXECUTE</button></div>
      <footer><button data-action="theme-reset">${fa("fa-rotate-left")} Стандарт RED</button><button class="primary" data-action="close-appearance">${fa("fa-check")} Готово</button></footer>
    </section></div>`;
  }

  function helpPanel() {
    if (!state.helpOpen) return "";
    const gmHelp = game.user?.isGM
      ? `<section><h3>${fa("fa-user-shield")} Режим ГМа</h3><p>В поле <b>«Архив пользователя»</b> выбери игрока, а рядом — его оперативника. После этого ГМ может просматривать и полностью редактировать его архив. Сохранение уходит именно выбранному игроку. Если у игрока отображается <b>LOCAL</b> или <b>DRAFT</b>, сначала попроси его нажать <b>Ctrl+S</b>: несинхронизированный черновик с другого компьютера ГМ увидеть не может. Одновременное редактирование лучше не вести — победит последнее сохранение.</p></section>`
      : "";
    return `<div class="pcm-modal-backdrop" data-modal="help"><section class="pcm-help-panel" role="dialog" aria-label="Справка Нейро-архива">
      <header><div><small>// HELP DATABASE</small><h2>${fa("fa-circle-question")} Как пользоваться Нейро-архивом</h2></div><button data-action="close-help" title="Закрыть">${fa("fa-xmark")}</button></header>
      <div class="pcm-help-grid">
        <section><h3>${fa("fa-table-columns")} Архивы оперативников</h3><p>У каждого Actor типа <b>character</b> свой независимый архив. Переключатель оперативника находится сверху. Контакты, точки, гиги, зацепки, логи и дампы одного персонажа не смешиваются с записями другого.</p></section>
        <section><h3>${fa("fa-bolt")} Быстрые записи</h3><p>На главной введи текст и выбери нужный тип. <b>Ctrl+Enter</b> сохраняет его как дамп. Если вставить обычный текст через <b>Ctrl+V</b> вне поля ввода, из него тоже автоматически создастся дамп. Кнопки «Слух», «Адрес» и «Долг» создают записи с готовой структурой.</p></section>
        <section><h3>${fa("fa-crosshairs")} Контакты с карты</h3><p>Отметь одного или нескольких NPC целями клавишей <b>T</b> и нажми <b>«Из целей»</b> — добавятся все выбранные. Если целей нет, Архив возьмёт все выделенные токены. Для портрета используется изображение прикреплённого <b>Actor</b>, а не внешний вид токена.</p></section>
        <section><h3>${fa("fa-shield-halved")} Защита от дублей</h3><p>Контакты сравниваются по UUID/ID Actor, источнику токена и имени. При повторном импорте одного уже существующего NPC новая запись <b>не создаётся</b> — Архив сразу откроет ранее добавленный контакт. При массовом импорте существующие контакты будут пропущены, а новые добавятся. Точка из уже импортированной сцены ведёт себя так же: открывается существующее досье.</p></section>
        <section><h3>${fa("fa-map")} Точки из сцен</h3><p>Кнопка <b>«Из сцены»</b> берёт название и фон активной сцены. Контакты, ранее импортированные на этой сцене, автоматически привяжутся к созданной точке. Одну запись можно связать сразу с несколькими точками через чекбоксы «Связанные точки».</p></section>
        <section><h3>${fa("fa-link")} Связи и удаление</h3><p>Досье точки автоматически собирает находящихся там контактов, гиги, зацепки, логи и дампы. У контакта отображаются его гиги и зацепки. При удалении точки ссылки на неё очищаются из остальных записей; при удалении контакта он убирается из полей заказчика и источника.</p></section>
        <section><h3>${fa("fa-eye")} Просмотр и редактирование</h3><p>Контакты и точки сначала открываются в удобном режиме чтения. Чтобы увидеть все поля, нажми <b>«Редактировать»</b>. Булавка закрепляет важную запись наверху. Кнопка копирования создаёт намеренную копию, но очищает её привязку к исходному Actor или сцене.</p></section>
        <section><h3>${fa("fa-tags")} Поиск и теги</h3><p>Поиск проверяет заголовок, основной текст, краткую заметку, теги и содержимое фрагментов. Нажатие на тег под карточкой мгновенно фильтрует текущий раздел по нему.</p></section>
        <section><h3>${fa("fa-image")} Изображения и галерея</h3><p>Картинку можно выбрать через проводник Foundry или вставить через <b>Ctrl+V</b>. У контактов есть отдельная галерея: храни несколько портретов, костюмов и предметов, добавляй подписи и назначай любое изображение обложкой.</p></section>
        <section><h3>${fa("fa-paper-plane")} Чат и журнал</h3><p>Кнопка с самолётиком отправляет запись шёпотом только тебе. <b>Shift+клик</b> публикует её всем игрокам. Кнопка <b>«В журнал»</b> превращает весь открытый раздел в JournalEntry, по одной странице на запись.</p></section>
        <section><h3>${fa("fa-floppy-disk")} Сохранение и статусы</h3><p><b>DRAFT</b> — есть свежий черновик, <b>LOCAL</b> — данные пока только в этом браузере, <b>SYNC ✓</b> — сервер получил актуальную версию. Локальная копия обновляется сразу, серверная — после короткой паузы. <b>Ctrl+S</b> синхронизирует немедленно.</p></section>
        <section><h3>${fa("fa-file-export")} Бэкап и импорт</h3><p>«Бэкап» скачивает весь архив выбранного пользователя в JSON. Импорт <b>полностью заменяет</b> текущий архив выбранного пользователя, поэтому перед ним стоит сделать свежую копию. Старые данные «Нейро-архива» и «Личной летописи» поддерживаются.</p></section>
        ${gmHelp}
      </div>
      <footer><button class="primary" data-action="close-help">${fa("fa-check")} Понятно</button></footer>
    </section></div>`;
  }

  function lightboxView() {
    if (!state.lightbox) return "";
    const entry = entryById(state.lightbox.entryId);
    const item = entry?.gallery?.find(
      (image) => image.id === state.lightbox.galleryId,
    );
    if (!entry || !item) return "";
    return `<div class="pcm-lightbox" data-action="close-lightbox"><button data-action="close-lightbox" title="Закрыть">${fa("fa-xmark")}</button><figure><img src="${esc(item.image)}" alt="${esc(item.caption)}"><figcaption><b>${esc(entry.title)}</b>${item.caption ? `<span>${esc(item.caption)}</span>` : ""}</figcaption></figure></div>`;
  }

  function render() {
    const win = state.root.querySelector(".pcm-window");
    const owner = archiveUserById(state.archiveUserId);
    const ownerSelector = game.user?.isGM
      ? `<label class="pcm-owner" title="Открыть архив другого пользователя"><span>${fa("fa-user-shield")} Архив пользователя</span><select data-archive-user>${state.archiveUsers.map((user) => opt(user.id ?? user._id, state.archiveUserId, `${user.name}${user.isGM ? " [GM]" : ""}`)).join("")}</select></label>`
      : "";
    if (!state.actors.length) {
      win.innerHTML = `<header class="pcm-top">${ownerSelector}<span class="pcm-spacer"></span></header><div class="pcm-no-actors"><h2>${fa("fa-triangle-exclamation")} Нет доступного оперативника</h2><p>Для пользователя «${esc(owner.name)}» не найден Actor типа character с правами владельца и нет сохранённых блокнотов.</p><button data-action="help">${fa("fa-circle-question")} Как пользоваться</button></div>${helpPanel()}`;
      return;
    }
    const actor = actorById(state.store.activeActorId);
    const book = ensureNotebook(actor);
    const themeLabel =
      THEME_PRESETS[bookAppearance(book).preset]?.label ??
      THEME_PRESETS.red.label;
    const counts = Object.fromEntries(
      Object.keys(SECTIONS).map((key) => [key, book.entries[key].length]),
    );
    win.innerHTML = `<header class="pcm-top">${ownerSelector}<div class="pcm-brand"><img src="${esc(book.actorImg)}" alt=""><div><small>// НЕЙРО-АРХИВ ${esc(themeLabel)} 4.1</small><select data-actor>${state.actors.map((item) => opt(item.id ?? item._id, actor.id ?? actor._id, item.name)).join("")}</select></div></div><span data-save-badge data-mode="${state.storageMode}">${state.storageMode === "server" ? "SYNC ✓" : "LOCAL"}</span><button data-action="appearance" title="Вид и размер текста"><b>${fa("fa-palette")}</b><span>Вид</span></button><button class="pcm-save-now" data-action="save" title="Синхронизировать (Ctrl+S)"><b>${fa("fa-arrows-rotate")}</b><span>SYNC</span></button><button data-action="export" title="Экспорт JSON"><b>${fa("fa-file-export")}</b><span>Бэкап</span></button><button data-action="import" title="Импорт JSON"><b>${fa("fa-file-import")}</b><span>Импорт</span></button><input type="file" accept=".json,application/json" data-import hidden></header>
      <div class="pcm-layout"><aside>${nav("dashboard", "Обзор", "fa-table-columns")}
        <small class="pcm-caption">КАРТОТЕКА</small>${Object.entries(SECTIONS)
          .map(([key, item]) => nav(key, item.label, item.icon, counts[key]))
          .join("")}
        <label class="pcm-goal"><span>ПРИОРИТЕТ</span><textarea data-goal placeholder="Что сейчас важнее всего?">${esc(book.goal)}</textarea></label>
        <button class="pcm-help-button" data-action="help">${fa("fa-circle-question")} <span>Как пользоваться</span></button><p class="pcm-help">Повторное нажатие кнопки вернёт окно на передний план.</p></aside>
        <main>${state.section === "dashboard" ? dashboard(book) : sectionView(book, state.section)}</main></div>${themePanel(book)}${helpPanel()}${lightboxView()}`;
    applyAppearance(book);
  }

  async function chooseImage(current, callback) {
    const Picker =
      globalThis.foundry?.applications?.apps?.FilePicker ??
      globalThis.FilePicker ??
      globalThis.CONFIG?.ux?.FilePicker;
    if (!Picker) {
      notify(
        "File Picker этой версии не найден. Вставьте путь к картинке или URL вручную.",
        "warn",
      );
      return;
    }
    try {
      const accept = (selection) => {
        const path =
          typeof selection === "string"
            ? selection
            : (selection?.path ?? selection?.target ?? "");
        if (path) callback(path);
        else notify("File Picker не вернул путь к изображению.", "warn");
      };
      const picker = new Picker({
        type: "image",
        current: current ?? "",
        callback: accept,
      });
      await Promise.resolve(picker.render(true));
    } catch (error) {
      console.warn(error);
      notify(
        "Не удалось открыть File Picker. Путь к изображению можно вставить вручную.",
        "warn",
      );
    }
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
          const scale = Math.min(
            1,
            max / Math.max(image.naturalWidth || 1, image.naturalHeight || 1),
          );
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas
            .getContext("2d")
            .drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/webp", 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadClipboardImage(file, purpose = "note") {
    const Picker =
      globalThis.foundry?.applications?.apps?.FilePicker ??
      globalThis.FilePicker ??
      globalThis.CONFIG?.ux?.FilePicker;
    let path = "";
    if (Picker?.upload) {
      const folder = "personal-chronicle-macro";
      try {
        await Picker.createDirectory?.("data", folder);
      } catch (_error) {
        /* Папка уже есть или у игрока нет права создавать папки. */
      }
      try {
        const extension =
          String(file.type || "image/png")
            .split("/")[1]
            ?.replace("jpeg", "jpg") || "png";
        const actorPart = String(state.store.activeActorId || "actor").replace(
          /[^a-zA-Z0-9_-]/g,
          "",
        );
        const cleanPurpose =
          String(purpose)
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .slice(0, 24) || "image";
        const renamed = new File(
          [file],
          `${cleanPurpose}-${actorPart}-${Date.now()}-${uid().slice(0, 5)}.${extension}`,
          { type: file.type || "image/png" },
        );
        const response = await Picker.upload(
          "data",
          folder,
          renamed,
          {},
          { notify: false },
        );
        path = response?.path || "";
      } catch (error) {
        console.warn(
          "Нейро-архив RED: серверная загрузка изображения не удалась",
          error,
        );
      }
    }
    if (path) notify("Картинка загружена и вставлена.");
    else {
      path = await dataUrlFromImage(file);
      notify(
        "Картинка вставлена локально. Для серверного файла игроку нужны права загрузки.",
        "warn",
      );
    }
    return path;
  }

  async function pasteImage(file, entry, target = { type: "cover" }) {
    const path = await uploadClipboardImage(file, target.type);
    if (target.type === "gallery" && entry.type === "people") {
      entry.gallery.push({ id: uid(), image: path, caption: "" });
      if (!entry.image) entry.image = path;
    } else if (target.type === "fragment" && target.fragment) {
      target.fragment.image = path;
      state.openFragmentId = target.fragment.id;
    } else entry.image = path;
    entry.updatedAt = now();
    state.openId = entry.id;
    dirty();
    render();
  }

  function addEntry(type, seed = "", options = {}) {
    const previous = options.previousView ?? viewSnapshot();
    const entry = blankEntry(type, seed);
    if (LOCATION_LINK_TYPES.has(type) && options.locationId)
      setEntryLocations(entry, [options.locationId]);
    notebook().entries[type].push(entry);
    state.section = type;
    state.openId = entry.id;
    state.quick = "";
    if (type === "locations" || options.edit) {
      state.previousView = previous;
      state.viewMode = "edit";
      state.viewId = entry.id;
      if (LOCATION_LINK_TYPES.has(type) && options.locationId) {
        state.section = "locations";
        state.returnLocationId = options.locationId;
      }
    } else {
      state.viewMode = "list";
      state.viewId = null;
      state.returnLocationId = null;
      state.previousView = null;
    }
    dirty();
    render();
    return entry;
  }

  function selectedTokens() {
    const targets = Array.from(game.user?.targets ?? []).filter(Boolean);
    if (targets.length) return targets;
    return Array.from(globalThis.canvas?.tokens?.controlled ?? []).filter(
      Boolean,
    );
  }

  function tokenIdentity(token) {
    const actor = token?.actor ?? token?.document?.actor ?? null;
    const document = token?.document ?? token;
    const name =
      String(
        token?.name || document?.name || actor?.name || "Без имени",
      ).trim() || "Без имени";
    return {
      name,
      normalizedName: normalizeName(name),
      actorUuid: String(actor?.uuid ?? ""),
      actorId: String(actor?.id ?? actor?._id ?? document?.actorId ?? ""),
      tokenUuid: String(document?.uuid ?? ""),
      tokenId: String(document?.id ?? document?._id ?? token?.id ?? ""),
      image: actor?.img || document?.texture?.src || "",
    };
  }

  function duplicateContact(book, identity) {
    return (
      book.entries.people.find(
        (entry) =>
          (identity.actorUuid &&
            entry.sourceActorUuid === identity.actorUuid) ||
          (identity.actorId && entry.sourceActorId === identity.actorId) ||
          (identity.tokenUuid &&
            entry.sourceTokenUuid === identity.tokenUuid) ||
          normalizeName(entry.title) === identity.normalizedName,
      ) ?? null
    );
  }

  function currentSceneLocation(book) {
    const scene = globalThis.canvas?.scene;
    if (!scene) return null;
    const sceneId = String(scene.id ?? scene._id ?? "");
    const sceneUuid = String(scene.uuid ?? "");
    return (
      book.entries.locations.find(
        (entry) =>
          (sceneUuid && entry.sourceSceneUuid === sceneUuid) ||
          (sceneId && entry.sourceSceneId === sceneId) ||
          normalizeName(entry.title) === normalizeName(scene.name),
      ) ?? null
    );
  }

  function linkSceneContacts(book, scene, location) {
    if (!scene || !location) return 0;
    const sceneId = String(scene.id ?? scene._id ?? "");
    const sceneUuid = String(scene.uuid ?? "");
    const sceneName = normalizeName(scene.name);
    let linked = 0;
    for (const contact of book.entries.people) {
      const cameFromScene =
        (sceneUuid && contact.sourceSceneUuid === sceneUuid) ||
        (sceneId && contact.sourceSceneId === sceneId) ||
        (sceneName && normalizeName(contact.firstMet) === sceneName);
      if (!cameFromScene || entryLocationIds(contact).includes(location.id))
        continue;
      setEntryLocations(contact, [...entryLocationIds(contact), location.id]);
      linked += 1;
    }
    return linked;
  }

  function importFromTokens() {
    const tokens = selectedTokens();
    if (!tokens.length)
      return notify(
        "Сначала отметь токены целями (T) или выдели их на сцене.",
        "warn",
      );
    const book = notebook();
    const scene = globalThis.canvas?.scene;
    const sceneLocation = currentSceneLocation(book);
    const seen = new Set();
    const added = [];
    const duplicates = [];
    let enriched = 0;
    for (const token of tokens) {
      const identity = tokenIdentity(token);
      const batchKey =
        identity.actorUuid ||
        identity.actorId ||
        identity.tokenUuid ||
        identity.normalizedName;
      if (seen.has(batchKey)) continue;
      seen.add(batchKey);
      const duplicate = duplicateContact(book, identity);
      if (duplicate) {
        duplicates.push(duplicate);
        let changed = false;
        for (const [field, value] of [
          ["sourceActorUuid", identity.actorUuid],
          ["sourceActorId", identity.actorId],
          ["sourceTokenUuid", identity.tokenUuid],
          ["sourceTokenId", identity.tokenId],
        ]) {
          if (value && !duplicate[field]) {
            duplicate[field] = value;
            changed = true;
          }
        }
        if (identity.image && !duplicate.image) {
          duplicate.image = identity.image;
          changed = true;
        }
        if (scene?.name && !duplicate.firstMet) {
          duplicate.firstMet = scene.name;
          changed = true;
        }
        if (
          sceneLocation &&
          !entryLocationIds(duplicate).includes(sceneLocation.id)
        ) {
          setEntryLocations(duplicate, [
            ...entryLocationIds(duplicate),
            sceneLocation.id,
          ]);
          changed = true;
        }
        if (changed) {
          duplicate.updatedAt = now();
          enriched += 1;
        }
        continue;
      }
      const entry = blankEntry("people");
      entry.title = identity.name;
      entry.image = identity.image;
      entry.firstMet = scene?.name ?? "";
      entry.sourceActorUuid = identity.actorUuid;
      entry.sourceActorId = identity.actorId;
      entry.sourceTokenUuid = identity.tokenUuid;
      entry.sourceTokenId = identity.tokenId;
      entry.sourceSceneUuid = String(scene?.uuid ?? "");
      entry.sourceSceneId = String(scene?.id ?? scene?._id ?? "");
      if (sceneLocation) setEntryLocations(entry, [sceneLocation.id]);
      book.entries.people.push(entry);
      added.push(entry);
    }
    if (added.length || enriched) dirty();
    resetView("people");
    if (added.length === 1 && tokens.length === 1) {
      state.viewMode = "person";
      state.viewId = added[0].id;
    } else if (!added.length && duplicates.length === 1) {
      state.viewMode = "person";
      state.viewId = duplicates[0].id;
    }
    render();
    const parts = [];
    if (added.length) parts.push(`добавлено: ${added.length}`);
    if (duplicates.length)
      parts.push(`уже были в архиве: ${duplicates.length}`);
    if (enriched) parts.push(`обновлены источники: ${enriched}`);
    notify(
      `Импорт целей завершён — ${parts.join(", ") || "нет новых токенов"}.`,
    );
  }

  function importFromScene() {
    const scene = globalThis.canvas?.scene;
    if (!scene) return notify("Нет активной сцены.", "warn");
    const book = notebook();
    const sceneId = String(scene.id ?? scene._id ?? "");
    const sceneUuid = String(scene.uuid ?? "");
    const name = String(scene.name || "Сцена").trim();
    const duplicate = book.entries.locations.find(
      (entry) =>
        (sceneUuid && entry.sourceSceneUuid === sceneUuid) ||
        (sceneId && entry.sourceSceneId === sceneId) ||
        normalizeName(entry.title) === normalizeName(name),
    );
    if (duplicate) {
      let changed = false;
      if (sceneUuid && !duplicate.sourceSceneUuid) {
        duplicate.sourceSceneUuid = sceneUuid;
        changed = true;
      }
      if (sceneId && !duplicate.sourceSceneId) {
        duplicate.sourceSceneId = sceneId;
        changed = true;
      }
      const image = scene.background?.src || scene.img || "";
      if (image && !duplicate.image) {
        duplicate.image = image;
        changed = true;
      }
      const linked = linkSceneContacts(book, scene, duplicate);
      if (changed || linked) {
        duplicate.updatedAt = now();
        dirty();
      }
      resetView("locations");
      state.viewMode = "location";
      state.viewId = duplicate.id;
      render();
      notify(
        `Точка «${name}» уже существует — открыто её досье${linked ? ` и привязано контактов: ${linked}` : ""}.`,
      );
      return;
    }
    const entry = blankEntry("locations");
    entry.title = name;
    entry.image = scene.background?.src || scene.img || "";
    entry.firstVisited = new Date().toISOString().slice(0, 10);
    entry.sourceSceneUuid = sceneUuid;
    entry.sourceSceneId = sceneId;
    book.entries.locations.push(entry);
    const linked = linkSceneContacts(book, scene, entry);
    dirty();
    resetView("locations");
    state.viewMode = "location";
    state.viewId = entry.id;
    render();
    notify(
      `Точка «${name}» добавлена из сцены${linked ? `; привязано контактов: ${linked}` : ""}.`,
    );
  }

  async function sendToChat(entry, isPublic) {
    const parts = [`<strong>${esc(entry.title)}</strong>`];
    if (entry.image)
      parts.push(
        `<img src="${esc(entry.image)}" style="max-width:260px;display:block">`,
      );
    if (entry.summary) parts.push(`<em>${esc(entry.summary)}</em>`);
    if (entry.content) parts.push(esc(entry.content).replaceAll("\n", "<br>"));
    const data = {
      content: `<div class="pcm-chat">${parts.join("<br>")}</div>`,
    };
    if (!isPublic) data.whisper = [game.user.id ?? game.user._id];
    try {
      await ChatMessage.create(data);
      notify(
        isPublic
          ? "Запись отправлена в общий чат."
          : "Запись отправлена себе шёпотом. Shift+клик — всем.",
      );
    } catch (error) {
      console.warn("Нейро-архив RED: отправка в чат не удалась", error);
      notify("Не удалось отправить запись в чат.", "error");
    }
  }

  async function exportSectionToJournal(key) {
    const book = notebook();
    const section = SECTIONS[key];
    const list = book.entries[key];
    if (!list?.length)
      return notify("В этом секторе пусто — экспортировать нечего.", "warn");
    const pages = list.map((entry) => {
      const parts = [];
      if (entry.image)
        parts.push(
          `<p><img src="${esc(entry.image)}" style="max-width:420px"></p>`,
        );
      if (entry.summary) parts.push(`<p><em>${esc(entry.summary)}</em></p>`);
      if (entry.content)
        parts.push(`<p>${esc(entry.content).replaceAll("\n", "<br>")}</p>`);
      if (entry.tags)
        parts.push(`<p><small>Теги: ${esc(entry.tags)}</small></p>`);
      for (const fragment of entry.fragments) {
        parts.push(`<h3>${esc(fragment.title)}</h3>`);
        if (fragment.image)
          parts.push(
            `<p><img src="${esc(fragment.image)}" style="max-width:420px"></p>`,
          );
        if (fragment.content)
          parts.push(
            `<p>${esc(fragment.content).replaceAll("\n", "<br>")}</p>`,
          );
      }
      return {
        name: (entry.title || "Запись").slice(0, 120),
        type: "text",
        text: { content: parts.join("") || "<p>—</p>", format: 1 },
      };
    });
    try {
      const owner = archiveUserById(state.archiveUserId);
      const journal = await JournalEntry.create({
        name: `Нейро-архив: ${book.actorName} — ${section.label} [${owner.name}] (${new Date().toISOString().slice(0, 10)})`,
        pages,
      });
      journal?.sheet?.render(true);
      notify(
        `Сектор «${section.label}» экспортирован в журнал: ${pages.length} стр.`,
      );
    } catch (error) {
      console.warn("Нейро-архив RED: экспорт в журнал не удался", error);
      notify(
        "Не удалось создать JournalEntry. Проверь права на создание журналов.",
        "error",
      );
    }
  }

  function removeEntry(entry) {
    const book = notebook();
    book.entries[entry.type] = book.entries[entry.type].filter(
      (item) => item.id !== entry.id,
    );
    if (entry.type === "locations") {
      for (const type of LOCATION_LINK_TYPES) {
        for (const linkedEntry of book.entries[type]) {
          const locationIds = entryLocationIds(linkedEntry);
          if (locationIds.includes(entry.id))
            setEntryLocations(
              linkedEntry,
              locationIds.filter((id) => id !== entry.id),
            );
        }
      }
    }
    if (entry.type === "people") {
      for (const quest of book.entries.quests)
        if (quest.giverId === entry.id) quest.giverId = "";
      for (const clue of book.entries.clues)
        if (clue.personId === entry.id) clue.personId = "";
    }
  }

  function exportData() {
    const owner = archiveUserById(state.archiveUserId);
    const payload = {
      app: "neuro-archive",
      version: VERSION,
      macroVersion: NEURO_ARCHIVE_VERSION,
      exportedAt: now(),
      worldId,
      userId: state.archiveUserId,
      userName: owner.name,
      data: state.store,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `neuro-archive-${normalizeName(owner.name).replace(/[^a-zа-яё0-9]+/gi, "-") || "user"}-${worldId}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    notify(`Бэкап архива пользователя «${owner.name}» сохранён.`);
  }

  async function importData(file) {
    try {
      const payload = JSON.parse(await file.text());
      if (
        !["personal-chronicle-macro", "neuro-archive"].includes(payload.app) ||
        !payload.data?.notebooks
      )
        throw new Error("Неверный формат копии");
      const owner = archiveUserById(state.archiveUserId);
      if (
        !confirm(
          `Импорт полностью заменит архив пользователя «${owner.name}». Продолжить?`,
        )
      )
        return;
      state.store = normalize(payload.data);
      state.actors = actorArray(owner, state.store);
      const actorIds = new Set(
        state.actors.map((actor) => actor.id ?? actor._id),
      );
      if (!actorIds.has(state.store.activeActorId))
        state.store.activeActorId =
          state.actors[0]?.id ?? state.actors[0]?._id ?? null;
      resetView("dashboard");
      dirty();
      await saveServer(true);
      render();
      notify(`Архив пользователя «${owner.name}» восстановлен из копии.`);
    } catch (error) {
      notify(`Импорт не выполнен: ${error.message}`, "error");
    }
  }

  if (!root) throw new Error("Не найден контейнер Нейро-Архива.");
  root.innerHTML =
    '<div class="pcm-window" role="dialog" aria-label="Нейро-Архив"></div>';
  state.root = root;

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-theme-field]")) {
      const theme = bookAppearance();
      const field = target.dataset.themeField;
      theme[field] =
        field === "fontSize"
          ? Math.min(17, Math.max(11, Number(target.value) || 13))
          : safeColor(target.value, theme[field]);
      const output = root.querySelector("[data-font-size-output]");
      if (output) output.textContent = `${theme.fontSize}px`;
      applyAppearance();
      dirty();
      return;
    }
    if (target.matches("[data-search-box]")) {
      state.search = target.value.toLowerCase().trim();
      for (const card of root.querySelectorAll("[data-search]"))
        card.hidden = !card.dataset.search.includes(state.search);
      return;
    }
    if (target.matches("[data-quick]")) {
      state.quick = target.value;
      return;
    }
    if (target.matches("[data-goal]")) {
      notebook().goal = target.value;
      dirty();
      return;
    }
    const entry = findEntry(target);
    if (!entry) return;
    if (target.matches("[data-field]")) {
      entry[target.dataset.field] = target.value;
      entry.updatedAt = now();
      dirty();
      return;
    }
    const galleryBox = target.closest("[data-gallery-id]");
    if (galleryBox && target.matches("[data-gallery-caption]")) {
      const item = entry.gallery.find(
        (image) => image.id === galleryBox.dataset.galleryId,
      );
      if (item) {
        item.caption = target.value;
        entry.updatedAt = now();
        dirty();
      }
      return;
    }
    const fragmentBox = target.closest("[data-fragment-id]");
    if (fragmentBox && target.matches("[data-fragment-field]")) {
      const fragment = entry.fragments.find(
        (item) => item.id === fragmentBox.dataset.fragmentId,
      );
      if (fragment) {
        fragment[target.dataset.fragmentField] = target.value;
        state.openFragmentId = fragment.id;
        entry.updatedAt = now();
        dirty();
      }
      return;
    }
    const taskBox = target.closest("[data-task-id]");
    if (taskBox && target.matches("[data-task-text]")) {
      const task = entry.tasks.find(
        (item) => item.id === taskBox.dataset.taskId,
      );
      if (task) {
        task.text = target.value;
        entry.updatedAt = now();
        dirty();
      }
    }
  });

  root.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.matches("[data-archive-user]")) {
      await switchArchiveUser(target.value);
      return;
    }
    if (target.matches("[data-actor]")) {
      if (!(await flushPendingSave())) return;
      state.store.activeActorId = target.value;
      ensureNotebook(actorById(target.value));
      resetView("dashboard");
      state.search = "";
      dirty();
      render();
      return;
    }
    if (target.matches("[data-import]") && target.files?.[0])
      return importData(target.files[0]);
    if (target.matches("[data-location-link]")) {
      const entry = findEntry(target);
      if (!LOCATION_LINK_TYPES.has(entry?.type)) return;
      const ids = new Set(entryLocationIds(entry));
      if (target.checked) ids.add(target.value);
      else ids.delete(target.value);
      setEntryLocations(entry, [...ids]);
      dirty();
      return;
    }
    const taskBox = target.closest("[data-task-id]");
    if (taskBox && target.matches("[data-task-done]")) {
      const entry = findEntry(target);
      const task = entry?.tasks.find(
        (item) => item.id === taskBox.dataset.taskId,
      );
      if (task) {
        task.done = target.checked;
        taskBox.classList.toggle("done", task.done);
        entry.updatedAt = now();
        dirty();
      }
    }
  });

  root.addEventListener("click", async (event) => {
    if (event.target.matches?.(".pcm-modal-backdrop")) {
      if (event.target.dataset.modal === "help") state.helpOpen = false;
      else state.settingsOpen = false;
      render();
      return;
    }
    const tag = event.target.closest?.(".pcm-tag");
    if (tag) {
      event.preventDefault();
      event.stopPropagation();
      state.search = String(tag.dataset.tag || "").toLowerCase();
      const box = root.querySelector("[data-search-box]");
      if (box) box.value = state.search;
      for (const card of root.querySelectorAll("[data-search]"))
        card.hidden = !card.dataset.search.includes(state.search);
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    const entry = findEntry(button);
    if (action === "help") {
      state.helpOpen = true;
      state.settingsOpen = false;
      render();
      return;
    }
    if (action === "close-help") {
      state.helpOpen = false;
      render();
      return;
    }
    if (action === "appearance") {
      state.settingsOpen = true;
      state.helpOpen = false;
      render();
      return;
    }
    if (action === "close-appearance") {
      state.settingsOpen = false;
      render();
      return;
    }
    if (action === "theme-preset" && THEME_PRESETS[button.dataset.preset]) {
      const fontSize = bookAppearance().fontSize;
      notebook().appearance = normalizeAppearance({
        ...THEME_PRESETS[button.dataset.preset],
        preset: button.dataset.preset,
        fontSize,
      });
      dirty();
      render();
      return;
    }
    if (action === "theme-reset") {
      notebook().appearance = normalizeAppearance();
      dirty();
      render();
      return;
    }
    if (action === "close-lightbox") {
      state.lightbox = null;
      render();
      return;
    }
    if (action === "nav") {
      resetView(button.dataset.section);
      state.search = "";
      render();
      return;
    }
    if (action === "add") {
      addEntry(button.dataset.section);
      return;
    }
    if (action === "quick") {
      const text = state.quick.trim();
      if (!text) return notify("Сначала напиши быстрый дамп.", "warn");
      addEntry(button.dataset.target, text);
      return;
    }
    if (action === "from-token") {
      importFromTokens();
      return;
    }
    if (action === "from-scene") {
      importFromScene();
      return;
    }
    if (action === "template") {
      const template = TEMPLATES[button.dataset.template];
      if (!template) return;
      const seed = state.quick.trim();
      const created = addEntry(
        "notes",
        `${seed ? `${seed}\n\n` : ""}${template.content}`,
      );
      created.title = seed
        ? `${template.title}: ${seed.split(/\r?\n/)[0].slice(0, 60)}`
        : template.title;
      created.category =
        template.title === "Номер / адрес" ? "Адрес" : template.title;
      dirty();
      render();
      return;
    }
    if (action === "to-journal") {
      await exportSectionToJournal(state.section);
      return;
    }
    if (action === "open-entry") {
      const targetEntry = entryById(button.dataset.entryId);
      if (targetEntry?.type === "locations") {
        resetView("locations");
        state.viewMode = "location";
        state.viewId = targetEntry.id;
      } else if (targetEntry?.type === "people") {
        resetView("people");
        state.viewMode = "person";
        state.viewId = targetEntry.id;
      } else {
        resetView(button.dataset.section);
        state.openId = button.dataset.entryId;
      }
      render();
      return;
    }
    if (action === "export") {
      exportData();
      return;
    }
    if (action === "import") {
      root.querySelector("[data-import]").click();
      return;
    }
    if (action === "save") {
      await saveServer(true);
      updateSaveBadge(
        state.storageMode === "server" ? "SYNC ✓" : "LOCAL",
        state.storageMode,
      );
      return;
    }
    if (action === "back-list") {
      resetView(button.dataset.section || state.section);
      render();
      return;
    }
    if (action === "back-location") {
      resetView("locations");
      state.viewMode = "location";
      state.viewId = button.dataset.locationId;
      render();
      return;
    }
    if (action === "back-editor") {
      restoreView(state.previousView);
      render();
      return;
    }
    if (action === "view-location") {
      const id =
        button.dataset.locationId ||
        (entry?.type === "locations" ? entry.id : null);
      if (!id) return;
      resetView("locations");
      state.viewMode = "location";
      state.viewId = id;
      render();
      return;
    }
    if (action === "view-person") {
      const id =
        button.dataset.personId || (entry?.type === "people" ? entry.id : null);
      if (!id) return;
      const locationId =
        button.dataset.locationId ||
        (state.viewMode === "location" ? state.viewId : null);
      resetView(locationId ? "locations" : "people");
      state.viewMode = "person";
      state.viewId = id;
      state.returnLocationId = locationId;
      render();
      return;
    }
    if (action === "open-related" && entry) {
      state.previousView = viewSnapshot();
      state.viewMode = "edit";
      state.viewId = entry.id;
      state.openId = entry.id;
      render();
      return;
    }
    if (action === "edit-entry" && entry) {
      state.previousView = viewSnapshot();
      state.viewMode = "edit";
      state.viewId = entry.id;
      state.openId = entry.id;
      render();
      return;
    }
    if (action === "add-person-here" && entry?.type === "locations") {
      addEntry("people", "", {
        edit: true,
        locationId: entry.id,
        previousView: viewSnapshot(),
      });
      return;
    }
    if (
      action === "add-related-here" &&
      entry?.type === "locations" &&
      LOCATION_LINK_TYPES.has(button.dataset.type)
    ) {
      addEntry(button.dataset.type, "", {
        edit: true,
        locationId: entry.id,
        previousView: viewSnapshot(),
      });
      return;
    }
    if (action === "link-person" && entry?.type === "locations") {
      const person = notebook().entries.people.find(
        (item) => item.id === button.dataset.personId,
      );
      if (!person) return;
      setPersonLocations(person, [...personLocationIds(person), entry.id]);
      dirty();
      render();
      return;
    }
    if (action === "unlink-person" && entry?.type === "people") {
      setPersonLocations(
        entry,
        personLocationIds(entry).filter(
          (id) => id !== button.dataset.locationId,
        ),
      );
      dirty();
      render();
      return;
    }
    if (!entry) return;
    if (action === "to-chat") {
      await sendToChat(entry, event.shiftKey);
      return;
    }
    const galleryBox = button.closest("[data-gallery-id]");
    const galleryItem = entry.gallery.find(
      (item) => item.id === galleryBox?.dataset.galleryId,
    );
    if (action === "view-gallery-image" && galleryItem) {
      state.lightbox = { entryId: entry.id, galleryId: galleryItem.id };
      render();
      return;
    }
    if (action === "add-gallery-image" && entry.type === "people") {
      chooseImage("", (path) => {
        entry.gallery.push({ id: uid(), image: path, caption: "" });
        if (!entry.image) entry.image = path;
        entry.updatedAt = now();
        dirty();
        render();
      });
      return;
    }
    if (action === "pick-gallery-image" && galleryItem) {
      chooseImage(galleryItem.image, (path) => {
        const wasCover = entry.image === galleryItem.image;
        galleryItem.image = path;
        if (wasCover) entry.image = path;
        entry.updatedAt = now();
        dirty();
        render();
      });
      return;
    }
    if (action === "set-gallery-cover" && galleryItem) {
      entry.image = galleryItem.image;
      entry.updatedAt = now();
      dirty();
      render();
      return;
    }
    if (action === "delete-gallery-image" && galleryItem) {
      if (confirm("Удалить это изображение из галереи?")) {
        const wasCover = entry.image === galleryItem.image;
        entry.gallery = entry.gallery.filter(
          (item) => item.id !== galleryItem.id,
        );
        if (wasCover) entry.image = entry.gallery[0]?.image ?? "";
        entry.updatedAt = now();
        dirty();
        render();
      }
      return;
    }
    if (action === "pin") {
      entry.pinned = !entry.pinned;
      entry.updatedAt = now();
      state.openId = entry.id;
      dirty();
      render();
      return;
    }
    if (action === "duplicate") {
      const copy = clone(entry);
      copy.id = uid();
      copy.title += " — копия";
      copy.createdAt = copy.updatedAt = now();
      for (const field of [
        "sourceActorUuid",
        "sourceActorId",
        "sourceTokenUuid",
        "sourceTokenId",
        "sourceSceneUuid",
        "sourceSceneId",
      ])
        delete copy[field];
      notebook().entries[entry.type].push(copy);
      state.openId = copy.id;
      if (state.viewMode === "edit") state.viewId = copy.id;
      dirty();
      render();
      return;
    }
    if (action === "delete") {
      if (confirm(`Удалить «${entry.title}»?`)) {
        removeEntry(entry);
        if (state.viewMode === "edit") restoreView(state.previousView);
        else resetView(state.section);
        dirty();
        render();
      }
      return;
    }
    if (action === "pick-image") {
      chooseImage(entry.image, (path) => {
        entry.image = path;
        entry.updatedAt = now();
        state.openId = entry.id;
        dirty();
        render();
      });
      return;
    }
    if (action === "add-fragment") {
      const fragment = {
        id: uid(),
        title: `Новый фрагмент ${entry.fragments.length + 1}`,
        image: "",
        content: "",
      };
      entry.fragments.push(fragment);
      state.openFragmentId = fragment.id;
      entry.updatedAt = now();
      state.openId = entry.id;
      dirty();
      render();
      return;
    }
    const fragmentBox = button.closest("[data-fragment-id]");
    const fragment = entry.fragments.find(
      (item) => item.id === fragmentBox?.dataset.fragmentId,
    );
    if (action === "delete-fragment" && fragment) {
      if (confirm(`Удалить фрагмент «${fragment.title}»?`)) {
        entry.fragments = entry.fragments.filter(
          (item) => item.id !== fragment.id,
        );
        if (state.openFragmentId === fragment.id) state.openFragmentId = null;
        state.openId = entry.id;
        dirty();
        render();
      }
      return;
    }
    if (action === "pick-fragment-image" && fragment) {
      chooseImage(fragment.image, (path) => {
        fragment.image = path;
        state.openFragmentId = fragment.id;
        entry.updatedAt = now();
        state.openId = entry.id;
        dirty();
        render();
      });
      return;
    }
    if (action === "add-task") {
      const task = { id: uid(), text: "", done: false };
      entry.tasks.push(task);
      entry.updatedAt = now();
      state.openId = entry.id;
      dirty();
      render();
      root
        .querySelector(`[data-task-id="${task.id}"] [data-task-text]`)
        ?.focus();
      return;
    }
    if (action === "delete-task") {
      const id = button.closest("[data-task-id]")?.dataset.taskId;
      entry.tasks = entry.tasks.filter((item) => item.id !== id);
      entry.updatedAt = now();
      state.openId = entry.id;
      dirty();
      render();
    }
  });

  root.addEventListener(
    "toggle",
    (event) => {
      const details = event.target;
      if (details.matches?.("details.pcm-fragment"))
        state.openFragmentId = details.open
          ? details.dataset.fragmentId
          : state.openFragmentId === details.dataset.fragmentId
            ? null
            : state.openFragmentId;
      if (details.matches?.("details.pcm-card[data-entry-id]"))
        state.openId = details.open
          ? details.dataset.entryId
          : state.openId === details.dataset.entryId
            ? null
            : state.openId;
    },
    true,
  );

  root.addEventListener("paste", async (event) => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const imageItem = items.find(
      (item) => item.kind === "file" && String(item.type).startsWith("image/"),
    );
    const file = imageItem?.getAsFile?.();
    if (!file) {
      const text = event.clipboardData?.getData("text/plain")?.trim();
      const target = event.target;
      const isEditable =
        target &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          target.isContentEditable);
      if (!text || isEditable) return;
      event.preventDefault();
      addEntry("notes", text);
      notify("Дамп создан из вставленного текста.");
      return;
    }
    event.preventDefault();
    const pasteZone = event.target.closest?.("[data-paste-target]");
    const activeId = ["location", "person", "edit"].includes(state.viewMode)
      ? state.viewId
      : state.openId;
    let entry =
      findEntry(event.target) ??
      Object.values(notebook().entries)
        .flat()
        .find((item) => item.id === activeId) ??
      null;
    if (!entry) {
      const type = state.section === "dashboard" ? "notes" : state.section;
      entry = blankEntry(type);
      entry.title = "Вставленное изображение";
      notebook().entries[type].push(entry);
      state.section = type;
      state.openId = entry.id;
      if (type === "locations") {
        state.previousView = viewSnapshot();
        state.viewMode = "edit";
        state.viewId = entry.id;
      }
    }
    let target = { type: "cover" };
    if (pasteZone?.dataset.pasteTarget === "gallery" && entry.type === "people")
      target = { type: "gallery" };
    if (pasteZone?.dataset.pasteTarget === "fragment") {
      const fragmentId =
        pasteZone.closest("[data-fragment-id]")?.dataset.fragmentId;
      const fragment = entry.fragments.find((item) => item.id === fragmentId);
      if (fragment) target = { type: "fragment", fragment };
    }
    await pasteImage(file, entry, target);
  });

  const keyboardHandler = (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "s" &&
      state.root.isConnected
    ) {
      event.preventDefault();
      saveServer(true);
      return;
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter" &&
      event.target?.matches?.("[data-quick]")
    ) {
      event.preventDefault();
      const text = state.quick.trim();
      if (text) addEntry("notes", text);
      else notify("Сначала напиши быстрый дамп.", "warn");
      return;
    }
    if (event.key !== "Escape" || !state.root.isConnected) return;
    if (state.lightbox) {
      state.lightbox = null;
      render();
      return;
    }
    if (state.helpOpen) {
      state.helpOpen = false;
      render();
      return;
    }
    if (state.settingsOpen) {
      state.settingsOpen = false;
      render();
      return;
    }
    if (state.viewMode === "edit" && state.previousView) {
      restoreView(state.previousView);
      render();
      return;
    }
    void closeArchive();
  };
  document.addEventListener("keydown", keyboardHandler);

  const unloadHandler = (event) => {
    if (!state.pendingServer) return;
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", unloadHandler);

  async function closeArchive() {
    clearTimeout(state.saveTimer);
    if (state.pendingServer) await saveServer(true);
    await requestClose();
  }

  const api = {
    version: VERSION,
    moduleVersion: NEURO_ARCHIVE_VERSION,
    variant: NEURO_ARCHIVE_VARIANT,
    state,
    open() {
      render();
    },
    async flush() {
      clearTimeout(state.saveTimer);
      return flushPendingSave();
    },
    async close() {
      return closeArchive();
    },
    destroy() {
      clearTimeout(state.saveTimer);
      document.removeEventListener("keydown", keyboardHandler);
      window.removeEventListener("beforeunload", unloadHandler);
      state.root = null;
    },
  };
  ensureNotebook(actorById(state.store.activeActorId));
  render();
  if (state.restoredLocal)
    notify("Нейро-архив RED: восстановлен свежий локальный черновик.");
  return api;
}
