import { NEURO_ARCHIVE_VERSION } from "./neuro-archive-constants.mjs";
import {
  directoryRoot,
  ensureDirectoryLauncherGroup,
} from "./directory-launchers.mjs";

const MODULE_ID = "cyberpunk-remaster";
const TEMPLATE = `modules/${MODULE_ID}/templates/neuro-archive.hbs`;
const WINDOW_SIZE_KEY = `${MODULE_ID}.neuro-archive-window-size.v1`;

let NeuroArchiveApplicationClass = null;
let neuroArchiveInstance = null;
let controllerModulePromise = null;

function loadControllerModule() {
  controllerModulePromise ??= import("./neuro-archive-controller.mjs");
  return controllerModulePromise;
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
  return {
    ...position,
    width: Math.min(
      viewportWidth - 24,
      Number(position.width ?? stored.width) || 1220,
    ),
    height: Math.min(
      viewportHeight - 24,
      Number(position.height ?? stored.height) || 840,
    ),
  };
}

function getNeuroArchiveApplicationClass() {
  if (NeuroArchiveApplicationClass) return NeuroArchiveApplicationClass;
  const ApplicationV2 = globalThis.foundry?.applications?.api?.ApplicationV2;
  const HandlebarsApplicationMixin =
    globalThis.foundry?.applications?.api?.HandlebarsApplicationMixin;
  if (!ApplicationV2 || typeof HandlebarsApplicationMixin !== "function") {
    throw new Error("Для Нейро-Архива требуется Foundry VTT 14 ApplicationV2.");
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
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      this.archiveController?.destroy?.();
      const root = this.element?.querySelector?.("#pcm-root");
      const { createNeuroArchiveController } = await loadControllerModule();
      this.archiveController = createNeuroArchiveController(root, {
        requestClose: () => this.close(),
      });
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

export async function openNeuroArchive() {
  if (globalThis.game?.system?.id !== "sf2e") {
    globalThis.ui?.notifications?.error?.(
      "Нейро-Архив работает только в Starfinder 2e.",
    );
    return null;
  }
  if (neuroArchiveInstance?.rendered) {
    neuroArchiveInstance.bringToFront();
    return neuroArchiveInstance;
  }

  const NeuroArchiveApplication = getNeuroArchiveApplicationClass();
  neuroArchiveInstance = new NeuroArchiveApplication({
    position: viewportPosition(),
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
  button.title = "Открыть личную картотеку персонажа";
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
    },
  };
  globalThis.CyberpunkRemaster = {
    ...(globalThis.CyberpunkRemaster ?? {}),
    forge: (options = {}) =>
      game.modules.get(MODULE_ID)?.api?.forge?.open?.(options) ?? null,
    archive: () => openNeuroArchive(),
  };
});

Hooks.on("renderActorDirectory", addDirectoryButton);
