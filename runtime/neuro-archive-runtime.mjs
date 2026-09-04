import { NEURO_ARCHIVE_VERSION } from "./neuro-archive-constants.mjs";
import { registerWorldCityMapSetting } from "./world-city-map.mjs";
import { migrateLegacyArchivesOnReady } from "./neuro-archive-store.mjs";
import {
  archiveShareHookName,
  countArchiveShareInbox,
  initializeArchiveSharing,
  openArchiveShareInbox,
  openArchiveShareScopePicker,
} from "./archive-share-service.mjs";
import {
  directoryRoot,
  ensureDirectoryLauncherGroup,
} from "./directory-launchers.mjs";

const MODULE_ID = "cyberpunk-remaster";
const TEMPLATE = `modules/${MODULE_ID}/templates/neuro-archive.hbs`;
const WINDOW_SIZE_KEY = `${MODULE_ID}.neuro-archive-window-size.v1`;
const ARCHIVE_MODE_KEY = `${MODULE_ID}.neuro-archive-mode.v1`;
const HUB_COLLAPSED_KEY = `${MODULE_ID}.neuro-archive-hub-collapsed.v1`;

const ARCHIVE_MODES = Object.freeze({
  neuro: {
    id: "neuro",
    label: "Нейро-Архив",
    rootClass: "archive-mode-neuro neuro-archive-root",
    load: () => import("./neuro-archive-controller.mjs"),
    factory: "createNeuroArchiveController",
  },
  cyber: {
    id: "cyber",
    label: "Кибер-Архив",
    rootClass: "archive-mode-cyber",
    load: () => import("./cyber-archive-controller.mjs"),
    factory: "createCyberArchiveController",
  },
  neo: {
    id: "neo",
    label: "Нео-Архив",
    rootClass: "archive-mode-neo",
    load: () => import("./neo-archive-controller.mjs"),
    factory: "createNeoArchiveController",
  },
});

let NeuroArchiveApplicationClass = null;
let neuroArchiveInstance = null;

function normalizeArchiveMode(value) {
  return Object.hasOwn(ARCHIVE_MODES, value) ? value : "neuro";
}

function storedArchiveMode() {
  try {
    return normalizeArchiveMode(globalThis.localStorage?.getItem?.(ARCHIVE_MODE_KEY));
  } catch {
    return "neuro";
  }
}

function saveArchiveMode(mode) {
  try {
    globalThis.localStorage?.setItem?.(ARCHIVE_MODE_KEY, normalizeArchiveMode(mode));
  } catch {
    // Выбранный интерфейс — локальное удобство; данные от этого не зависят.
  }
}

function storedHubCollapsed() {
  try {
    return globalThis.localStorage?.getItem?.(HUB_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveHubCollapsed(collapsed) {
  try {
    globalThis.localStorage?.setItem?.(HUB_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Состояние панели — только локальная настройка интерфейса.
  }
}

function storedWindowSize() {
  try {
    const parsed = JSON.parse(
      globalThis.localStorage?.getItem?.(WINDOW_SIZE_KEY) ?? "{}",
    );
    return {
      width: Number(parsed.width) || undefined,
      height: Number(parsed.height) || undefined,
    };
  } catch {
    return {};
  }
}

function saveWindowSize(position = {}) {
  const width = Math.round(Number(position.width) || 0);
  const height = Math.round(Number(position.height) || 0);
  if (!width || !height) return;
  try {
    globalThis.localStorage?.setItem?.(
      WINDOW_SIZE_KEY,
      JSON.stringify({ width, height }),
    );
  } catch {
    // Размер окна — только локальное удобство и не влияет на архив.
  }
}

function viewportPosition(position = {}) {
  const stored = storedWindowSize();
  const viewportWidth = Math.max(420, Number(globalThis.innerWidth) || 1440);
  const viewportHeight = Math.max(520, Number(globalThis.innerHeight) || 960);
  const requestedWidth = Number(position.width ?? stored.width) || 0;
  const requestedHeight = Number(position.height ?? stored.height) || 0;
  const responsiveWidth = Math.round(viewportWidth * 0.92);
  const responsiveHeight = Math.round(viewportHeight * 0.9);
  return {
    ...position,
    width: Math.min(
      viewportWidth - 24,
      requestedWidth || Math.max(720, responsiveWidth),
    ),
    height: Math.min(
      viewportHeight - 24,
      requestedHeight || Math.max(620, responsiveHeight),
    ),
  };
}

function getNeuroArchiveApplicationClass() {
  if (NeuroArchiveApplicationClass) return NeuroArchiveApplicationClass;
  const ApplicationV2 = globalThis.foundry?.applications?.api?.ApplicationV2;
  const HandlebarsApplicationMixin =
    globalThis.foundry?.applications?.api?.HandlebarsApplicationMixin;
  if (!ApplicationV2 || typeof HandlebarsApplicationMixin !== "function") {
    throw new Error("Для Архивов Найт-Сити требуется Foundry VTT 14 ApplicationV2.");
  }

  NeuroArchiveApplicationClass = class NeuroArchiveApplication extends (
    HandlebarsApplicationMixin(ApplicationV2)
  ) {
    static DEFAULT_OPTIONS = {
      id: "sf2e-neuro-archive",
      tag: "section",
      classes: ["neuro-archive-application"],
      position: { width: 1220, height: 840 },
      window: {
        title: "Нейро-Архив",
        icon: "fa-solid fa-brain",
        resizable: true,
        minimizable: true,
        contentClasses: ["neuro-archive-content"],
      },
    };

    static PARTS = {
      main: {
        template: TEMPLATE,
      },
    };

    constructor(options = {}) {
      super({ ...options, position: viewportPosition(options.position) });
      this.archiveController = null;
      this.archiveMode = normalizeArchiveMode(options.archiveMode ?? storedArchiveMode());
      this.archiveModeSwitching = false;
      this.hubCollapsed = storedHubCollapsed();
      this.archiveShareHookId = null;
    }

    _modeHost() {
      return this.element?.querySelector?.("[data-archive-mode-host]") ?? null;
    }

    _updateModeButtons() {
      for (const button of this.element?.querySelectorAll?.("[data-archive-mode]") ?? []) {
        const active = button.dataset.archiveMode === this.archiveMode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
        button.disabled = Boolean(this.archiveModeSwitching);
      }
      const shell = this.element?.querySelector?.("[data-archive-shell]");
      if (shell) shell.dataset.archiveMode = this.archiveMode;
    }

    _updateHubState() {
      const shell = this.element?.querySelector?.("[data-archive-shell]");
      if (shell) shell.dataset.hubCollapsed = this.hubCollapsed ? "true" : "false";
      for (const button of this.element?.querySelectorAll?.("[data-archive-hub-toggle]") ?? []) {
        button.setAttribute("aria-expanded", this.hubCollapsed ? "false" : "true");
      }
      const toolbarButton = this.element?.querySelector?.("[data-archive-hub-toolbar]");
      if (toolbarButton) toolbarButton.hidden = !this.hubCollapsed;
    }

    _modeToolbar() {
      const root = this._modeHost()?.querySelector?.("[data-archive-mode-root]");
      const top = root?.querySelector?.("header.pcm-top") ?? null;
      if (!top) return null;
      return top.querySelector?.(".pcm-top-actions") ?? top;
    }

    _modeToolbarButton({ className = "", data = {}, title = "", symbol = "", label = "", badge = false } = {}) {
      const button = globalThis.document.createElement("button");
      button.type = "button";
      button.className = `archive-mode-toolbar-button ${className}`.trim();
      if (title) button.title = title;
      for (const [key, value] of Object.entries(data)) button.dataset[key] = value;
      button.innerHTML = `<b aria-hidden="true">${symbol}</b><span>${label}</span>${badge ? '<small class="archive-share-inbox-count" data-archive-share-inbox-count hidden>0</small>' : ""}`;
      return button;
    }

    _installModeToolbarControls() {
      const toolbar = this._modeToolbar();
      if (!toolbar || toolbar.querySelector?.("[data-archive-mode-toolbar-control]")) return;

      const share = this._modeToolbarButton({
        className: "archive-share-mode-button",
        data: { archiveModeToolbarControl: "share", archiveShareOpen: "true" },
        title: "Поделиться текущим разделом или всем архивом выбранного персонажа",
        symbol: "⇄",
        label: "Поделиться",
      });
      const inbox = this._modeToolbarButton({
        className: "archive-share-mode-button archive-share-inbox-button",
        data: { archiveModeToolbarControl: "inbox", archiveShareInbox: "true" },
        title: "Входящие пакеты выбранного Actor",
        symbol: "⇩",
        label: "Входящие",
        badge: true,
      });
      const archives = this._modeToolbarButton({
        className: "archive-hub-toolbar",
        data: { archiveModeToolbarControl: "hub", archiveHubToolbar: "true", archiveHubToggle: "true" },
        title: "Показать панель архивов",
        symbol: "≡",
        label: "Архивы",
      });
      archives.hidden = !this.hubCollapsed;

      const anchor = this.archiveMode === "neuro"
        ? toolbar.querySelector?.("[data-import]")
        : toolbar.querySelector?.(".pcm-window-toggle, .pcm-close");
      const fragment = globalThis.document.createDocumentFragment();
      fragment.append(share, inbox, archives);
      toolbar.insertBefore(fragment, anchor ?? null);
      this._updateHubState();
      this._updateShareInboxBadge();
    }

    _shareSnapshot() {
      return this.archiveController?.getShareSnapshot?.() ?? null;
    }

    _shareActor(snapshot = this._shareSnapshot()) {
      const id = String(snapshot?.sourceActor?.id ?? "");
      const actors = globalThis.game?.actors?.contents ?? (globalThis.game?.actors ? Array.from(globalThis.game.actors) : []);
      return actors.find((actor) => String(actor?.id ?? actor?._id ?? "") === id) ?? snapshot?.sourceActor ?? null;
    }

    _updateShareInboxBadge() {
      const snapshot = this._shareSnapshot();
      const ownArchive = String(snapshot?.sourceOwnerUserId ?? "") === String(globalThis.game?.user?.id ?? globalThis.game?.user?._id ?? "");
      const actorId = ownArchive ? String(snapshot?.sourceActor?.id ?? "") : "";
      const count = actorId ? countArchiveShareInbox(globalThis.game?.user, actorId) : 0;
      const button = this.element?.querySelector?.("[data-archive-share-inbox]");
      if (button) {
        button.disabled = !actorId;
        button.title = actorId ? `Входящие для ${snapshot?.sourceActor?.name ?? "Actor"}: ${count}` : "Входящие доступны в собственном архиве персонажа";
      }
      const badge = this.element?.querySelector?.("[data-archive-share-inbox-count]");
      if (badge) {
        badge.textContent = String(count);
        badge.hidden = count < 1;
      }
    }

    _observeModeToolbar(root) {
      this.archiveToolbarObserver?.disconnect?.();
      this.archiveToolbarObserver = null;
      const Observer = globalThis.MutationObserver;
      if (typeof Observer !== "function" || !root) return;
      this.archiveToolbarObserver = new Observer(() => {
        this._installModeToolbarControls();
      });
      this.archiveToolbarObserver.observe(root, { childList: true, subtree: true });
    }

    async _handleArchiveShellClick(event) {
      const target = event.target?.closest?.("[data-archive-hub-toggle], [data-archive-share-open], [data-archive-share-inbox]");
      if (!target || !this.element?.contains?.(target)) return;

      if (target.matches?.("[data-archive-hub-toggle]")) {
        event.preventDefault();
        event.stopPropagation();
        this.hubCollapsed = !this.hubCollapsed;
        saveHubCollapsed(this.hubCollapsed);
        this._updateHubState();
        return;
      }

      if (target.matches?.("[data-archive-share-open]")) {
        event.preventDefault();
        event.stopPropagation();
        await this.archiveController?.flush?.();
        const snapshot = this._shareSnapshot();
        if (!snapshot?.sourceActor?.id) {
          globalThis.ui?.notifications?.warn?.("Не выбран Actor для передачи Архива.");
          return;
        }
        openArchiveShareScopePicker(snapshot, {
          themeSource: this._modeHost()?.querySelector?.("[data-archive-mode-root]"),
          archiveMode: this.archiveMode,
        });
        return;
      }

      if (target.matches?.("[data-archive-share-inbox]")) {
        event.preventDefault();
        event.stopPropagation();
        const snapshot = this._shareSnapshot();
        const ownArchive = String(snapshot?.sourceOwnerUserId ?? "") === String(globalThis.game?.user?.id ?? globalThis.game?.user?._id ?? "");
        if (!ownArchive || !snapshot?.sourceActor?.id) {
          globalThis.ui?.notifications?.warn?.("Входящие открываются для собственного Actor.");
          return;
        }
        await openArchiveShareInbox({
          user: globalThis.game?.user,
          actorId: snapshot.sourceActor.id,
          actor: this._shareActor(snapshot),
          themeSource: this._modeHost()?.querySelector?.("[data-archive-mode-root]"),
          archiveMode: this.archiveMode,
          beforeApply: async () => { await this.archiveController?.flush?.(); },
          afterApply: async ({ type }) => {
            if (type === "accepted") await this._mountArchiveMode(this.archiveMode, { flushCurrent: false });
            this._updateShareInboxBadge();
          },
        });
      }
    }

    _bindArchiveShellActions() {
      const shell = this.element?.querySelector?.("[data-archive-shell]");
      if (!shell || shell === this.archiveShellActionRoot) return;
      if (this.archiveShellActionRoot && this.archiveShellActionHandler) {
        this.archiveShellActionRoot.removeEventListener?.("click", this.archiveShellActionHandler);
      }
      this.archiveShellActionRoot = shell;
      this.archiveShellActionHandler = (event) => { void this._handleArchiveShellClick(event); };
      shell.addEventListener("click", this.archiveShellActionHandler);
    }

    _bindShareHook() {
      if (this.archiveShareHookId != null || !globalThis.Hooks?.on) return;
      this.archiveShareHookId = globalThis.Hooks.on(archiveShareHookName, () => this._updateShareInboxBadge());
    }

    _bindModeButtons() {
      for (const button of this.element?.querySelectorAll?.("[data-archive-mode]") ?? []) {
        button.addEventListener("click", () => {
          const mode = normalizeArchiveMode(button.dataset.archiveMode);
          if (mode === this.archiveMode || this.archiveModeSwitching) return;
          void this.switchArchiveMode(mode);
        });
      }
    }

    async _createModeRoot(mode) {
      const host = this._modeHost();
      if (!host) throw new Error("Не найден host для режима архива.");
      host.replaceChildren();
      const root = globalThis.document.createElement("section");
      root.id = "pcm-root";
      root.className = `archive-mode-root ${ARCHIVE_MODES[mode].rootClass}`;
      root.dataset.archiveModeRoot = mode;
      host.append(root);
      return root;
    }

    async _mountArchiveMode(mode, { flushCurrent = true } = {}) {
      const nextMode = normalizeArchiveMode(mode);
      if (flushCurrent) await this.archiveController?.flush?.();
      this.archiveController?.destroy?.();
      this.archiveController = null;

      this.archiveMode = nextMode;
      saveArchiveMode(nextMode);
      this._updateModeButtons();

      const root = await this._createModeRoot(nextMode);
      const descriptor = ARCHIVE_MODES[nextMode];
      const module = await descriptor.load();
      const factory = module?.[descriptor.factory];
      if (typeof factory !== "function") {
        throw new Error(`${descriptor.label}: контроллер не найден.`);
      }
      this.archiveController = await factory(root, {
        requestClose: () => this.close(),
      });
      this._observeModeToolbar(root);
      this._installModeToolbarControls();
      this._updateModeButtons();
      this._updateHubState();
      this._updateShareInboxBadge();
      return this.archiveController;
    }

    async switchArchiveMode(mode) {
      const nextMode = normalizeArchiveMode(mode);
      if (nextMode === this.archiveMode || this.archiveModeSwitching) return;
      this.archiveModeSwitching = true;
      this._updateModeButtons();
      try {
        await this._mountArchiveMode(nextMode, { flushCurrent: true });
      } catch (error) {
        console.error("Cyberpunk Remaster | Не удалось переключить режим архива", error);
        globalThis.ui?.notifications?.error?.(
          `Не удалось открыть ${ARCHIVE_MODES[nextMode].label}.`,
        );
      } finally {
        this.archiveModeSwitching = false;
        this._updateModeButtons();
      }
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      this.archiveController?.destroy?.();
      this.archiveController = null;
      this._bindModeButtons();
      this._bindArchiveShellActions();
      this._bindShareHook();
      this._updateModeButtons();
      this._updateHubState();
      await this._mountArchiveMode(this.archiveMode, { flushCurrent: false });
    }

    async _preClose(options) {
      await this.archiveController?.flush?.();
      return super._preClose(options);
    }

    _onClose(options) {
      saveWindowSize(this.position);
      this.archiveController?.destroy?.();
      this.archiveController = null;
      this.archiveToolbarObserver?.disconnect?.();
      this.archiveToolbarObserver = null;
      if (this.archiveShellActionRoot && this.archiveShellActionHandler) {
        this.archiveShellActionRoot.removeEventListener?.("click", this.archiveShellActionHandler);
      }
      this.archiveShellActionRoot = null;
      this.archiveShellActionHandler = null;
      if (this.archiveShareHookId != null) globalThis.Hooks?.off?.(archiveShareHookName, this.archiveShareHookId);
      this.archiveShareHookId = null;
      neuroArchiveInstance = null;
      return super._onClose(options);
    }
  };

  return NeuroArchiveApplicationClass;
}

export async function openNeuroArchive(options = {}) {
  if (globalThis.game?.system?.id !== "sf2e") {
    globalThis.ui?.notifications?.error?.(
      "Архивы Найт-Сити работают только в Starfinder 2e.",
    );
    return null;
  }
  const requestedMode = options?.mode ? normalizeArchiveMode(options.mode) : null;
  if (neuroArchiveInstance?.rendered) {
    neuroArchiveInstance.bringToFront();
    if (requestedMode && requestedMode !== neuroArchiveInstance.archiveMode) {
      await neuroArchiveInstance.switchArchiveMode(requestedMode);
    }
    return neuroArchiveInstance;
  }

  const NeuroArchiveApplication = getNeuroArchiveApplicationClass();
  neuroArchiveInstance = new NeuroArchiveApplication({
    position: viewportPosition(),
    archiveMode: requestedMode ?? storedArchiveMode(),
  });
  await neuroArchiveInstance.render(true);
  return neuroArchiveInstance;
}

function addDirectoryButton(app, html) {
  const root = directoryRoot(app, html);
  if (!root || root.querySelector("[data-cyberpunk-neuro-archive-launcher]")) {
    return;
  }
  const group = ensureDirectoryLauncherGroup(app, html);
  if (!group) return;

  const button = globalThis.document.createElement("button");
  button.type = "button";
  button.dataset.cyberpunkNeuroArchiveLauncher = "true";
  button.title = "Открыть общую картотеку персонажа";
  button.innerHTML = '<i class="fa-solid fa-brain"></i> Нейро-Архив';
  button.addEventListener("click", () => void openNeuroArchive());

  group.append(button);
}

Hooks.once("init", () => {
  registerWorldCityMapSetting();
  const module = game.modules.get(MODULE_ID);
  if (!module) return;
  module.api = {
    ...(module.api ?? {}),
    neuroArchive: {
      open: openNeuroArchive,
      version: NEURO_ARCHIVE_VERSION,
      shareInboxCount: (actorId) => countArchiveShareInbox(game.user, actorId),
      modes: Object.fromEntries(
        Object.entries(ARCHIVE_MODES).map(([id, mode]) => [id, mode.label]),
      ),
    },
  };
  globalThis.CyberpunkRemaster = {
    ...(globalThis.CyberpunkRemaster ?? {}),
    forge: (options = {}) =>
      game.modules.get(MODULE_ID)?.api?.forge?.open?.(options) ?? null,
    archive: (mode = null) => openNeuroArchive(mode ? { mode } : {}),
  };
});

Hooks.on("renderActorDirectory", addDirectoryButton);


Hooks.once("ready", () => {
  initializeArchiveSharing();
  void migrateLegacyArchivesOnReady()
    .then((result) => {
      if (result?.errors?.length) {
        console.warn("Cyberpunk Remaster | Field Archive auto-migration warnings", result.errors);
        globalThis.ui?.notifications?.warn?.(
          `Cyberpunk Remaster: не удалось перенести ${result.errors.length} архив(а/ов); подробности в консоли.`,
        );
      }
      if (!result?.migratedUsers) return;
      const local = result.localMerged ? `, локальных черновиков: ${result.localMerged}` : "";
      globalThis.ui?.notifications?.info?.(
        `Cyberpunk Remaster: старые Field Archive перенесены автоматически (${result.migratedUsers}${local}).`,
      );
    })
    .catch((error) => {
      console.error("Cyberpunk Remaster | Field Archive auto-migration failed", error);
      globalThis.ui?.notifications?.error?.(
        `Cyberpunk Remaster: не удалось автоматически перенести Field Archive — ${error.message}`,
      );
    });
});
