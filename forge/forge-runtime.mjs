// The ApplicationV2 window and deployment workflow are adapted from
// PF2E NPC Forge 0.13.0 under the MIT License.
// See licenses/PF2E_NPC_FORGE_LICENSE.txt.

import { clearCyberpunkCatalog, loadCyberpunkCatalog } from "./catalog.mjs";
import { createEncounterBriefing } from "./briefing.mjs";
import {
  DEFAULT_FORM,
  FORGE_FLAG,
  ITEM_PACK_ID,
  MODULE_ID,
} from "./constants.mjs";
import { DEPLOYMENT_MODES, deployActorsToScene } from "./deployment.mjs";
import {
  generateNpc,
  generateNpcBatch,
  inferPresetFromPrompt,
  normalizeForgeForm,
  previewNpc,
  refreshNpcInterfaceSummary,
  selectedNpcInfo,
  summarizeResult,
} from "./generator.mjs";
import { TIER_LABELS } from "./creature-tables.mjs";
import {
  CYBERPUNK_PRESETS,
  presetsByGroup,
  resolvePreset,
} from "./presets.mjs";
import { randomSeed } from "./random.mjs";
import {
  addRecentHistory,
  deleteCustomPreset,
  exportCustomPresets,
  getCustomPresets,
  getLastForm,
  getRecentHistory,
  importCustomPresets,
  registerForgeSettings,
  saveCustomPreset,
  setLastForm,
} from "./storage.mjs";
import {
  directoryRoot,
  ensureDirectoryLauncherGroup,
} from "../runtime/directory-launchers.mjs";

const TEMPLATE = `modules/${MODULE_ID}/templates/cyberpunk-forge.hbs`;
const WINDOW_SIZE_KEY = `${MODULE_ID}.forge-window-size.v1`;
let ForgeApplicationClass = null;
let forgeInstance = null;
const pendingInterfaceRefreshes = new WeakMap();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    // Размер окна является только локальным удобством.
  }
}

function viewportPosition(position = {}) {
  const stored = storedWindowSize();
  const viewportWidth = Math.max(360, Number(globalThis.innerWidth) || 1280);
  const viewportHeight = Math.max(480, Number(globalThis.innerHeight) || 900);
  return {
    ...position,
    width: Math.min(
      viewportWidth - 24,
      Number(position.width ?? stored.width) || 940,
    ),
    height: Math.min(
      viewportHeight - 24,
      Number(position.height ?? stored.height) || 800,
    ),
  };
}

function formElement(app) {
  if (app.form) return app.form;
  const element = app.element;
  if (element?.matches?.("form")) return element;
  return element?.querySelector?.("form") ?? null;
}

function readForm(app) {
  const form = formElement(app);
  if (!form) return normalizeForgeForm(DEFAULT_FORM);
  const data = Object.fromEntries(new globalThis.FormData(form).entries());
  for (const name of [
    "includePrograms",
    "includeConsumables",
    "backupOriginal",
    "addToCombat",
    "createBriefing",
    "sendChatSummary",
    "openSheet",
  ]) {
    data[name] = form.elements.namedItem(name)?.checked === true;
  }
  return normalizeForgeForm(data);
}

function applyFormValues(app, values) {
  const form = formElement(app);
  if (!form) return;
  const normalized = normalizeForgeForm(values);
  for (const [name, value] of Object.entries(normalized)) {
    const field = form.elements.namedItem(name);
    if (!field) continue;
    if (field.type === "checkbox") field.checked = value === true;
    else field.value = value ?? "";
  }
  refreshPresetSelection(app);
  refreshConditionalFields(app);
}

function refreshPresetSelection(app) {
  const form = formElement(app);
  const presetId = form?.elements.namedItem("preset")?.value;
  app.element
    ?.querySelectorAll?.("[data-forge-preset]")
    .forEach((button) =>
      button.classList.toggle(
        "is-selected",
        button.dataset.forgePreset === presetId,
      ),
    );
}

function refreshConditionalFields(app) {
  const form = formElement(app);
  if (!form) return;
  const count = Math.max(
    1,
    Number(form.elements.namedItem("count")?.value) || 1,
  );
  const target = form.elements.namedItem("target")?.value;
  app.element
    ?.querySelector?.("[data-forge-batch-note]")
    ?.classList.toggle("is-hidden", count <= 1);
  const rebuild = app.element?.querySelector?.("[data-forge-rebuild-options]");
  rebuild?.classList.toggle("is-hidden", target !== "selected");
  const combat = form.elements.namedItem("addToCombat");
  if (combat) {
    combat.disabled =
      form.elements.namedItem("deploymentMode")?.value === "none";
    if (combat.disabled) combat.checked = false;
  }
}

function previewHtml(preview) {
  const loadout = preview.loadout
    .map(
      (entry) =>
        `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(
          entry.value,
        )}</li>`,
    )
    .join("");
  const warnings = preview.warnings.length
    ? `<ul class="cyberpunk-forge-warnings">${preview.warnings
        .map((warning) => `<li>${escapeHtml(warning)}</li>`)
        .join("")}</ul>`
    : "";
  const languageLabels = preview.languages
    .map((slug) => {
      const configured = globalThis.CONFIG?.PF2E?.languages?.[slug];
      const key =
        typeof configured === "string"
          ? configured
          : (configured?.label ?? slug);
      return globalThis.game?.i18n?.localize?.(key) ?? key;
    })
    .join(", ");
  return `
    <div class="cyberpunk-forge-preview-title">
      <strong>${escapeHtml(preview.name)}</strong>
      <span>ур. ${preview.level}</span>
    </div>
    <p>${escapeHtml(preview.ancestry)}, ${escapeHtml(preview.role)} — ${escapeHtml(
      preview.faction,
    )}</p>
    <div class="cyberpunk-forge-statline">
      <span>КБ ${preview.stats.ac}</span>
      <span>ОЗ ${preview.stats.hp}</span>
      <span>Атака +${preview.stats.attack}</span>
      <span>Урон ${escapeHtml(preview.stats.damage)}</span>
      <span>КС ${preview.stats.dc}</span>
      <span>Скорость ${preview.stats.speed}</span>
    </div>
    <p class="cyberpunk-forge-preview-meta"><strong>Навыки:</strong> ${
      preview.skillCount
    } · <strong>Защита:</strong> ${escapeHtml(
      preview.defenses.label,
    )}<br><strong>Языки:</strong> ${escapeHtml(languageLabels)}</p>
    <ul class="cyberpunk-forge-preview-loadout">${loadout}</ul>
    ${warnings}
    <small>Seed варианта: ${escapeHtml(preview.seed)}</small>
  `;
}

async function refreshPreview(app) {
  const target = app.element?.querySelector?.("[data-forge-preview]");
  if (!target) return null;
  const form = formElement(app);
  const seedField = form?.elements?.namedItem?.("randomSeed");
  if (seedField && !String(seedField.value ?? "").trim()) {
    seedField.value = randomSeed();
  }
  target.innerHTML =
    '<p class="cyberpunk-forge-muted"><i class="fa-solid fa-spinner fa-spin"></i> Подбираю предметы из библиотеки…</p>';
  try {
    const preview = await previewNpc(readForm(app));
    target.innerHTML = previewHtml(preview);
    return preview;
  } catch (error) {
    target.innerHTML = `<p class="cyberpunk-forge-error">${escapeHtml(
      error.message,
    )}</p>`;
    return null;
  }
}

async function confirmGeneration(form) {
  if (
    form.target === "new" &&
    form.count < 10 &&
    form.deploymentMode === "none"
  ) {
    return true;
  }
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  const content = [
    `<p><strong>Пресет:</strong> ${escapeHtml(
      resolvePreset(form.preset).label,
    )}</p>`,
    `<p><strong>NPC:</strong> ${form.count}; <strong>уровень:</strong> ${form.level}.</p>`,
    form.target === "selected"
      ? "<p>Выбранный NPC будет перестроен. Перед изменением сохраняется резервная копия.</p>"
      : "",
    form.deploymentMode !== "none"
      ? "<p>Жетоны будут размещены на активной сцене.</p>"
      : "",
  ].join("");
  if (DialogV2?.confirm) {
    return DialogV2.confirm({
      window: { title: "Подтвердить работу Кузницы" },
      content,
      yes: { default: true },
    });
  }
  return globalThis.Dialog?.confirm?.({
    title: "Подтвердить работу Кузницы",
    content,
  });
}

async function sendChatSummary(results, deployment, briefing, form) {
  if (!form.sendChatSummary || !globalThis.ChatMessage?.create) return null;
  const rows = results
    .map(
      (result) =>
        `<li>@UUID[${result.actor.uuid}]{${escapeHtml(
          result.actor.name,
        )}} — ${escapeHtml(result.role.label)}, предметов: ${
          result.itemCount
        }</li>`,
    )
    .join("");
  const journal = briefing.journal
    ? `<p>@UUID[${briefing.journal.uuid}]{Открыть мастерскую сводку}</p>`
    : "";
  const content = `<h3>Киберпанк-Кузница</h3><ul>${rows}</ul><p>Жетонов размещено: ${deployment.tokens.length}.</p>${journal}`;
  const recipients =
    globalThis.ChatMessage.getWhisperRecipients?.("GM")?.map(
      (user) => user.id,
    ) ?? [];
  return globalThis.ChatMessage.create({
    content,
    whisper: recipients,
  });
}

async function executeGeneration(app) {
  const form = readForm(app);
  if (!(await confirmGeneration(form))) return null;
  app.setBusy(true);
  try {
    await setLastForm(form);
    const results =
      form.count > 1 ? await generateNpcBatch(form) : [await generateNpc(form)];
    const deployment = await deployActorsToScene(results, form);
    const briefing = await createEncounterBriefing(results, form);
    const workflowWarnings = [];
    try {
      await sendChatSummary(results, deployment, briefing, form);
    } catch (error) {
      workflowWarnings.push(`Отчёт в чат не отправлен: ${error.message}`);
    }
    try {
      await addRecentHistory(form, results);
    } catch (error) {
      workflowWarnings.push(`История Кузницы не обновлена: ${error.message}`);
    }

    const warnings = [
      ...results.flatMap((result) => result.warnings ?? []),
      ...deployment.warnings,
      ...briefing.warnings,
      ...workflowWarnings,
    ];
    const message = `Создано NPC: ${results.length}; предметов: ${results.reduce(
      (total, result) => total + result.itemCount,
      0,
    )}.`;
    if (warnings.length) {
      globalThis.ui?.notifications?.warn?.(
        `${message} Предупреждения: ${warnings.join(" ")}`,
        { permanent: true },
      );
    } else {
      globalThis.ui?.notifications?.info?.(message);
    }
    await app.close();
    return { results, deployment, briefing };
  } catch (error) {
    console.error(`${MODULE_ID} | Forge generation failed`, error);
    globalThis.ui?.notifications?.error?.(
      `Киберпанк-Кузница: ${error.message}`,
      { permanent: true },
    );
    return null;
  } finally {
    if (app.rendered) app.setBusy(false);
  }
}

function downloadJson(filename, value) {
  const blob = new globalThis.Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = globalThis.URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  globalThis.URL.revokeObjectURL(url);
}

function attachListeners(app) {
  const root = app.element;
  const form = formElement(app);
  if (!root || !form) return;

  root.querySelectorAll("[data-forge-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.forgePreset;
      const preset = CYBERPUNK_PRESETS[id];
      if (!preset) return;
      form.elements.namedItem("preset").value = id;
      form.elements.namedItem("level").value = preset.level;
      form.elements.namedItem("includePrograms").checked =
        preset.includePrograms;
      form.elements.namedItem("randomSeed").value = randomSeed();
      refreshPresetSelection(app);
      await refreshPreview(app);
    });
  });

  root
    .querySelector("[data-forge-preview-button]")
    ?.addEventListener("click", () => refreshPreview(app));
  root
    .querySelector("[data-forge-roll-seed]")
    ?.addEventListener("click", async () => {
      form.elements.namedItem("randomSeed").value = randomSeed();
      await refreshPreview(app);
    });
  root
    .querySelector("[data-forge-refresh-catalog]")
    ?.addEventListener("click", async () => {
      clearCyberpunkCatalog();
      const catalog = await loadCyberpunkCatalog({ refresh: true });
      globalThis.ui?.notifications?.info?.(
        `Каталог обновлён: ${catalog.entries.length} предметов; ${catalog.cyberware.length} имплантов.`,
      );
      await refreshPreview(app);
    });
  root
    .querySelector("[data-forge-submit]")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      void executeGeneration(app);
    });
  root
    .querySelector("[data-forge-save-preset]")
    ?.addEventListener("click", async () => {
      const name = globalThis.prompt?.("Название нового пресета:");
      if (!name) return;
      await saveCustomPreset(name, readForm(app));
      globalThis.ui?.notifications?.info?.(`Пресет «${name}» сохранён.`);
      await app.render({ force: true });
    });
  root
    .querySelector("[data-forge-load-custom]")
    ?.addEventListener("change", async (event) => {
      const id = event.currentTarget.value;
      const preset = getCustomPresets()[id];
      if (preset) {
        applyFormValues(app, preset.values);
        await refreshPreview(app);
      }
    });
  root
    .querySelector("[data-forge-delete-custom]")
    ?.addEventListener("click", async () => {
      const id = root.querySelector("[data-forge-load-custom]")?.value;
      if (!id) return;
      await deleteCustomPreset(id);
      await app.render({ force: true });
    });
  root.querySelector("[data-forge-export]")?.addEventListener("click", () => {
    downloadJson("sf2e-cyberpunk-forge-presets.json", exportCustomPresets());
  });
  root.querySelector("[data-forge-import]")?.addEventListener("click", () => {
    root.querySelector("[data-forge-import-file]")?.click();
  });
  root
    .querySelector("[data-forge-import-file]")
    ?.addEventListener("change", async (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      const count = await importCustomPresets(await file.text());
      globalThis.ui?.notifications?.info?.(`Импортировано пресетов: ${count}.`);
      await app.render({ force: true });
    });
  root
    .querySelector("[data-forge-create-macro]")
    ?.addEventListener("click", async () => {
      await createLauncherMacro();
      globalThis.ui?.notifications?.info?.(
        "Макрос запуска Киберпанк-Кузницы создан.",
      );
    });

  form.addEventListener("change", () => {
    refreshConditionalFields(app);
    refreshPresetSelection(app);
  });
}

function getForgeApplicationClass() {
  if (ForgeApplicationClass) return ForgeApplicationClass;
  const ApplicationV2 = globalThis.foundry?.applications?.api?.ApplicationV2;
  const HandlebarsApplicationMixin =
    globalThis.foundry?.applications?.api?.HandlebarsApplicationMixin;
  if (!ApplicationV2 || typeof HandlebarsApplicationMixin !== "function") {
    throw new Error("Для Кузницы требуется Foundry VTT 14 ApplicationV2.");
  }

  ForgeApplicationClass = class CyberpunkForgeApplication extends (
    HandlebarsApplicationMixin(ApplicationV2)
  ) {
    static DEFAULT_OPTIONS = {
      id: "sf2e-cyberpunk-forge",
      tag: "form",
      classes: ["cyberpunk-forge-application"],
      position: { width: 940, height: 800 },
      window: {
        title: "Киберпанк-Кузница NPC",
        icon: "fa-solid fa-microchip",
        resizable: true,
        minimizable: true,
        contentClasses: ["cyberpunk-forge-content"],
      },
      form: {
        closeOnSubmit: false,
        submitOnChange: false,
        handler: async function () {
          return executeGeneration(this);
        },
      },
    };

    static PARTS = {
      main: {
        template: TEMPLATE,
        scrollable: [".cyberpunk-forge-body"],
      },
    };

    constructor(options = {}, forgeOptions = {}) {
      super({ ...options, position: viewportPosition(options.position) });
      this.initialValues = normalizeForgeForm({
        ...getLastForm(),
        ...(forgeOptions.values ?? forgeOptions),
      });
      this.pendingValues = this.initialValues;
      this.busy = false;
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      let catalogStats = {
        items: 0,
        weapons: 0,
        armor: 0,
        cyberware: 0,
        programs: 0,
      };
      let catalogError = "";
      try {
        const catalog = await loadCyberpunkCatalog();
        catalogStats = {
          items: catalog.entries.length,
          weapons: catalog.weapons.length,
          armor: catalog.armor.length,
          cyberware: catalog.cyberware.length,
          programs: catalog.programs.length + catalog.quickhacks.length,
        };
      } catch (error) {
        catalogError = error.message;
      }
      return {
        ...context,
        presetGroups: presetsByGroup(),
        tiers: Object.entries(TIER_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
        deploymentModes: Object.entries(DEPLOYMENT_MODES).map(
          ([value, entry]) => ({ value, label: entry.label }),
        ),
        customPresets: Object.entries(getCustomPresets()).map(
          ([id, entry]) => ({ id, ...entry }),
        ),
        recentHistory: getRecentHistory(),
        selectedNpc: selectedNpcInfo(),
        catalogStats,
        catalogError,
      };
    }

    async _preRender(context, options) {
      if (this.rendered) {
        try {
          this.pendingValues = readForm(this);
        } catch {
          this.pendingValues ??= this.initialValues;
        }
      }
      return super._preRender(context, options);
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      applyFormValues(this, this.pendingValues ?? this.initialValues);
      this.pendingValues = null;
      attachListeners(this);
      await refreshPreview(this);
    }

    _onClose(options) {
      saveWindowSize(this.position);
      forgeInstance = null;
      return super._onClose(options);
    }

    setBusy(value) {
      this.busy = Boolean(value);
      const submit = this.element?.querySelector?.("[data-forge-submit]");
      if (submit) {
        submit.disabled = this.busy;
        submit.innerHTML = this.busy
          ? '<i class="fa-solid fa-spinner fa-spin"></i> Собираю NPC…'
          : '<i class="fa-solid fa-microchip"></i> Создать NPC';
      }
      this.element?.setAttribute?.("aria-busy", String(this.busy));
    }
  };
  return ForgeApplicationClass;
}

export async function openForge(options = {}) {
  if (globalThis.game?.system?.id !== "sf2e") {
    globalThis.ui?.notifications?.error?.(
      "Киберпанк-Кузница работает только в Starfinder 2e.",
    );
    return null;
  }
  if (!globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.error?.(
      "Киберпанк-Кузницу может открыть только ведущий.",
    );
    return null;
  }
  if (forgeInstance?.rendered) {
    forgeInstance.bringToFront();
    return forgeInstance;
  }
  const ForgeApplication = getForgeApplicationClass();
  forgeInstance = new ForgeApplication(
    { position: viewportPosition() },
    options,
  );
  await forgeInstance.render(true);
  return forgeInstance;
}

export async function createLauncherMacro() {
  if (!globalThis.game?.user?.isGM) return null;
  let macro = globalThis.game?.macros?.find?.(
    (candidate) => candidate.getFlag(MODULE_ID, "forgeLauncher") === true,
  );
  const data = {
    name: "Открыть Киберпанк-Кузницу NPC",
    type: "script",
    scope: "global",
    img: "icons/tools/smithing/hammer-sledge-steel-grey.webp",
    command: `game.modules.get("${MODULE_ID}")?.api?.forge?.open();`,
    flags: { [MODULE_ID]: { forgeLauncher: true } },
  };
  if (macro) await macro.update(data);
  else {
    const created = await globalThis.Macro.create(data);
    macro = Array.isArray(created) ? created[0] : created;
  }
  return macro;
}

function addDirectoryButton(app, html) {
  if (!globalThis.game?.user?.isGM) return;
  const root = directoryRoot(app, html);
  if (!root || root.querySelector("[data-cyberpunk-forge-launcher]")) return;
  const group = ensureDirectoryLauncherGroup(app, html);
  if (!group) return;
  const button = globalThis.document.createElement("button");
  button.type = "button";
  button.dataset.cyberpunkForgeLauncher = "true";
  button.innerHTML = '<i class="fa-solid fa-microchip"></i> Киберпанк-Кузница';
  button.addEventListener("click", () => void openForge());
  group.append(button);
}

function clearCatalogForDocument(document) {
  if (document?.pack === ITEM_PACK_ID) clearCyberpunkCatalog();
}

function scheduleNpcInterfaceRefresh(item, options = {}) {
  const actor = item?.actor;
  if (
    actor?.type !== "npc" ||
    actor.flags?.[MODULE_ID]?.[FORGE_FLAG]?.generated !== true ||
    options.cyberpunkForgeOperation ||
    options.cyberpunkRemasterManaged ||
    options.cyberpunkRemasterModelOperation ||
    options.cyberpunkForgeInterfaceUpdate
  ) {
    return;
  }
  const previous = pendingInterfaceRefreshes.get(actor);
  if (previous) globalThis.clearTimeout(previous);
  const timeout = globalThis.setTimeout(async () => {
    pendingInterfaceRefreshes.delete(actor);
    try {
      await refreshNpcInterfaceSummary(actor);
    } catch (error) {
      console.warn(`${MODULE_ID} | NPC interface refresh failed`, error);
    }
  }, 50);
  pendingInterfaceRefreshes.set(actor, timeout);
}

Hooks.once("init", () => {
  registerForgeSettings();
  const module = game.modules.get(MODULE_ID);
  if (!module) return;
  module.api = {
    ...(module.api ?? {}),
    forge: {
      open: openForge,
      preview: previewNpc,
      generate: generateNpc,
      generateBatch: generateNpcBatch,
      refreshInterfaces: refreshNpcInterfaceSummary,
      inferPresetFromPrompt,
      refreshCatalog: async () => {
        clearCyberpunkCatalog();
        return loadCyberpunkCatalog({ refresh: true });
      },
      selectedNpcInfo,
      summarizeResult,
      createLauncherMacro,
    },
  };
});

Hooks.on("renderActorDirectory", addDirectoryButton);
Hooks.on("createItem", clearCatalogForDocument);
Hooks.on("updateItem", clearCatalogForDocument);
Hooks.on("deleteItem", clearCatalogForDocument);
Hooks.on("createItem", (item, options) =>
  scheduleNpcInterfaceRefresh(item, options),
);
Hooks.on("updateItem", (item, _changes, options) =>
  scheduleNpcInterfaceRefresh(item, options),
);
Hooks.on("deleteItem", (item, options) =>
  scheduleNpcInterfaceRefresh(item, options),
);
