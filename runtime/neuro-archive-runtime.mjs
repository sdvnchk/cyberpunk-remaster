import { NEURO_ARCHIVE_VERSION } from "./neuro-archive-constants.mjs";
import { migrateLegacyArchivesOnReady } from "./neuro-archive-store.mjs";
import {
  directoryRoot,
  ensureDirectoryLauncherGroup,
} from "./directory-launchers.mjs";

const MODULE_ID = "cyberpunk-remaster";
const TEMPLATE = `modules/${MODULE_ID}/templates/neuro-archive.hbs`;
const WINDOW_SIZE_KEY = `${MODULE_ID}.neuro-archive-window-size.v1`;
const ARCHIVE_MODE_KEY = `${MODULE_ID}.neuro-archive-mode.v1`;
const HUB_COLLAPSED_KEY = `${MODULE_ID}.neuro-archive-hub-collapsed.v1`;
const WINDOW_COLLAPSED_KEY = `${MODULE_ID}.neuro-archive-window-collapsed.v1`;

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

function storedWindowCollapsed() {
  try {
    return globalThis.localStorage?.getItem?.(WINDOW_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveWindowCollapsed(collapsed) {
  try {
    globalThis.localStorage?.setItem?.(WINDOW_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Полное сворачивание окна — локальная настройка интерфейса.
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
      this.windowCollapsed = storedWindowCollapsed();
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
    }

    _bindHubButtons() {
      for (const button of this.element?.querySelectorAll?.("[data-archive-hub-toggle]") ?? []) {
        button.addEventListener("click", () => {
          this.hubCollapsed = !this.hubCollapsed;
          saveHubCollapsed(this.hubCollapsed);
          this._updateHubState();
        });
      }
    }

    _ensureWindowCollapseControl() {
      const header = this.element?.querySelector?.(".window-header");
      if (!header) return null;
      let button = header.querySelector?.("[data-archive-window-toggle]");
      if (!button) {
        button = globalThis.document.createElement("button");
        button.type = "button";
        button.className = "header-control archive-window-toggle";
        button.dataset.archiveWindowToggle = "true";
        const close = header.querySelector?.('[data-action="close"], .close');
        header.insertBefore(button, close ?? null);
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.windowCollapsed = !this.windowCollapsed;
          if (this.windowCollapsed) saveWindowSize(this.position);
          saveWindowCollapsed(this.windowCollapsed);
          this._updateWindowCollapsedState();
        });
      }
      return button;
    }

    _updateWindowCollapsedState() {
      this.element?.classList?.toggle("archive-window-collapsed", this.windowCollapsed);
      const button = this._ensureWindowCollapseControl();
      if (!button) return;
      const title = this.windowCollapsed ? "Развернуть Архив" : "Свернуть Архив полностью";
      button.title = title;
      button.setAttribute("aria-label", title);
      button.setAttribute("aria-expanded", this.windowCollapsed ? "false" : "true");
      button.innerHTML = this.windowCollapsed
        ? '<i class="fa-solid fa-window-maximize" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-window-minimize" aria-hidden="true"></i>';
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
      this._updateModeButtons();
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
      this._bindHubButtons();
      this._updateModeButtons();
      this._updateHubState();
      this._ensureWindowCollapseControl();
      this._updateWindowCollapsedState();
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
  const module = game.modules.get(MODULE_ID);
  if (!module) return;
  module.api = {
    ...(module.api ?? {}),
    neuroArchive: {
      open: openNeuroArchive,
      version: NEURO_ARCHIVE_VERSION,
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
