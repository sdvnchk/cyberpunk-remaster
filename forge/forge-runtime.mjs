// The ApplicationV2 window and deployment workflow are adapted from
// PF2E NPC Forge 0.13.0 under the MIT License.
// See licenses/PF2E_NPC_FORGE_LICENSE.txt.

import {
  catalogResolveEntry,
  clearCyberpunkCatalog,
  loadCyberpunkCatalog,
} from "./catalog.mjs";
import { CyberwareTab } from "../sheets/CyberwareTab.js";
import { PKT_BODY_QUALITIES } from "../runtime/cyberware-schema.mjs";
import { createEncounterBriefing } from "./briefing.mjs";
import {
  DEFAULT_FORM,
  FORGE_FLAG,
  ITEM_PACK_ID,
  ITEM_PACK_IDS,
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
  ATTRIBUTE_OPTIONS,
  ATTRIBUTE_OVERRIDE_TIERS,
  SAVE_OPTIONS,
  SAVE_OVERRIDE_TIERS,
  SKILL_OVERRIDE_TIERS,
  abilityTemplate,
  abilityTemplateOptions,
  forgeSkillOptions,
} from "./customization.mjs";
import {
  CYBERPUNK_PRESETS,
  presetsByGroup,
  resolvePreset,
  roleOptions,
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
let activeWorkTab = "builder";
const pendingInterfaceRefreshes = new WeakMap();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function signedStat(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? "—");
  return numeric >= 0 ? `+${numeric}` : String(numeric);
}

function normalizeCatalogName(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[«»„“”"']/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function catalogHasModelItem(catalog, itemId, hintName = "") {
  return Boolean(catalogResolveEntry(catalog, itemId, hintName));
}

function pktBodyView(entry) {
  if (!entry) return null;
  const itemId = entry.id ?? entry.itemId ?? entry._id ?? "";
  const document = entry.document ?? entry;
  const name = entry.name ?? document?.name ?? `ПКТ ${itemId}`;
  let quality = Number(PKT_BODY_QUALITIES.get(itemId));
  if (!Number.isFinite(quality)) {
    try {
      quality = Number(CyberwareTab.getPktBodyQuality(document));
    } catch {
      quality = Number.NaN;
    }
  }
  let slots = Number(entry.slots);
  if (!Number.isFinite(slots)) {
    try {
      slots = Number(CyberwareTab.getSlots(document));
    } catch {
      slots = Number.NaN;
    }
  }
  return {
    itemId,
    name,
    nameKey: normalizeCatalogName(name),
    quality,
    slots,
    available: true,
    label: `${name}${Number.isFinite(slots) ? ` · ${slots} сл.` : ""}`,
  };
}

function pktBodiesFromCatalog(catalog) {
  const byId = new Map();
  for (const entry of catalog?.entries ?? []) {
    const knownId = PKT_BODY_QUALITIES.has(entry.id);
    const knownName = /^Полная\s+Конверсия\s+Тела(?:\s|\[|$)/iu.test(String(entry.name ?? ""));
    if (!entry.pktBody && !knownId && !knownName) continue;
    const view = pktBodyView(entry);
    if (view?.itemId && !byId.has(view.itemId)) byId.set(view.itemId, view);
  }
  return [...byId.values()].sort((left, right) =>
    (Number.isFinite(left.quality) ? left.quality : 999) -
      (Number.isFinite(right.quality) ? right.quality : 999) ||
    left.name.localeCompare(right.name, "ru"),
  );
}

function mergePktBodies(...groups) {
  const merged = new Map();
  for (const group of groups) {
    for (const body of group ?? []) {
      // Name is the stable merge key across compendium ID migrations. The
      // catalog-derived entry is inserted first and therefore keeps the active
      // world itemId even if an older structured journal still references a
      // legacy body ID.
      const key = normalizeCatalogName(body?.name) || body?.itemId;
      if (!key) continue;
      const existing = merged.get(key);
      merged.set(
        key,
        existing
          ? { ...body, ...existing, available: existing.available === true || body.available === true }
          : body,
      );
    }
  }
  return [...merged.values()].sort((left, right) =>
    (Number.isFinite(left.quality) ? left.quality : 999) -
      (Number.isFinite(right.quality) ? right.quality : 999) ||
    String(left.name ?? "").localeCompare(String(right.name ?? ""), "ru"),
  );
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
    "sourceCpel",
    "sourceRemaster",
    "includeConsumables",
    "backupOriginal",
    "addToCombat",
    "createBriefing",
    "sendChatSummary",
    "openSheet",
    "ability1_enabled",
    "ability2_enabled",
    "ability3_enabled",
    "ability4_enabled",
    "ability5_enabled",
    "ability6_enabled",
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
  syncPktSelectors(app);
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

function refreshCustomStatFields(app) {
  const form = formElement(app);
  const root = app.element;
  if (!form || !root) return;
  root.querySelectorAll("[data-forge-stat-mode]").forEach((select) => {
    const targetName = select.dataset.forgeCustomTarget;
    const input = targetName ? form.elements.namedItem(targetName) : null;
    if (!input) return;
    const custom = select.value === "custom";
    input.disabled = !custom;
    input.classList.toggle("is-hidden", !custom);
  });
}

function refreshConditionalFields(app) {
  const form = formElement(app);
  if (!form) return;
  refreshCustomStatFields(app);
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

function syncPktSelectors(app) {
  const form = formElement(app);
  if (!form) return;
  const bodyField = form.elements.namedItem("pktBodyId");
  const modelField = form.elements.namedItem("pktModelKey");
  if (!bodyField || !modelField) return;

  const bodyValue = String(bodyField.value ?? "");
  const selectedBodyOption = bodyField.selectedOptions?.[0] ?? null;
  const selectedBodyKey = selectedBodyOption?.dataset?.pktBodyKey ?? "";
  const bodyChosen = Boolean(bodyValue);
  const bodyIsRandom = bodyValue === "random";

  for (const option of modelField.options ?? []) {
    const value = String(option.value ?? "");
    if (!value || value === "random") {
      option.hidden = false;
      continue;
    }
    const optionBodyId = option.dataset?.pktBodyId ?? "";
    const optionBodyKey = option.dataset?.pktBodyKey ?? "";
    const compatible =
      bodyIsRandom ||
      optionBodyId === bodyValue ||
      (selectedBodyKey && optionBodyKey && optionBodyKey === selectedBodyKey);
    option.hidden = !bodyChosen || !compatible;
  }

  modelField.disabled = !bodyChosen;
  if (!bodyChosen) {
    modelField.value = "";
    return;
  }
  const selectedModel = modelField.selectedOptions?.[0];
  if (selectedModel?.hidden || selectedModel?.disabled) {
    modelField.value = "random";
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
    <p class="cyberpunk-forge-preview-meta"><strong>Мод. атрибутов:</strong> Сил ${signedStat(preview.abilities?.str)} · Лвк ${signedStat(preview.abilities?.dex)} · Тел ${signedStat(preview.abilities?.con)} · Инт ${signedStat(preview.abilities?.int)} · Мдр ${signedStat(preview.abilities?.wis)} · Хар ${signedStat(preview.abilities?.cha)}<br><strong>Спасброски:</strong> Стойкость ${signedStat(preview.saves?.fortitude)} · Рефлекс ${signedStat(preview.saves?.reflex)} · Воля ${signedStat(preview.saves?.will)}<br><strong>Навыки:</strong> ${
      preview.skillCount
    } · <strong>Свои способности:</strong> ${preview.customAbilityCount ?? 0} · <strong>Защита:</strong> ${escapeHtml(
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
  const content = `<h3>Киберпанк-Кузница NPC</h3><ul>${rows}</ul><p>Жетонов размещено: ${deployment.tokens.length}.</p>${journal}`;
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
      `Киберпанк-Кузница NPC: ${error.message}`,
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

function setWorkTab(root, tabId) {
  activeWorkTab = tabId || "builder";
  root.querySelectorAll("[data-forge-worktab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.forgeWorktab === activeWorkTab);
  });
  root.querySelectorAll("[data-forge-worktab-panel]").forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.forgeWorktabPanel !== activeWorkTab);
  });
}

function refreshAbilityRow(row) {
  if (!row) return;
  const enabled = row.querySelector('[data-forge-ability-enabled]')?.checked === true;
  row.classList.toggle("is-enabled", enabled);
  const type = row.querySelector('[data-forge-ability-action-type]')?.value ?? "passive";
  const actions = row.querySelector('[data-forge-ability-actions]');
  if (actions) {
    actions.disabled = type !== "action";
    actions.closest("label")?.classList.toggle("is-disabled", type !== "action");
  }
}

function applyAbilityTemplate(form, row, index, templateId) {
  const template = abilityTemplate(templateId);
  if (!template || !row) return false;
  const set = (suffix, value) => {
    const field = form.elements.namedItem(`ability${index}_${suffix}`);
    if (field) field.value = value ?? "";
  };
  const enabled = form.elements.namedItem(`ability${index}_enabled`);
  if (enabled) enabled.checked = true;
  set("name", template.label);
  set("actionType", template.actionType);
  set("actions", template.actions ?? 1);
  set("category", template.category);
  set("frequencyPer", template.frequencyPer ?? "");
  set("frequencyMax", template.frequencyMax ?? 1);
  set("traits", template.traits ?? "");
  set("description", template.description ?? "");
  set("rules", template.rules ?? "[]");
  refreshAbilityRow(row);
  return true;
}

function attachListeners(app) {
  const root = app.element;
  const form = formElement(app);
  if (!root || !form) return;

  setWorkTab(root, activeWorkTab);
  root.querySelectorAll("[data-forge-worktab]").forEach((button) => {
    button.addEventListener("click", () => setWorkTab(root, button.dataset.forgeWorktab));
  });

  root.querySelectorAll("[data-forge-ability-row]").forEach((row) => {
    const index = Number(row.dataset.forgeAbilityRow);
    refreshAbilityRow(row);
    row.querySelector(".neon-forge-ability-enabled")?.addEventListener("click", (event) => event.stopPropagation());
    row.querySelector("[data-forge-ability-enabled]")?.addEventListener("change", () => refreshAbilityRow(row));
    row.querySelector("[data-forge-ability-action-type]")?.addEventListener("change", () => refreshAbilityRow(row));
    row.querySelector("[data-forge-ability-template]")?.addEventListener("change", async (event) => {
      if (!event.currentTarget.value) return;
      if (applyAbilityTemplate(form, row, index, event.currentTarget.value)) {
        await refreshPreview(app);
      }
    });
  });

  root.querySelectorAll("[data-forge-group-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.forgeGroupTab;
      root.querySelectorAll("[data-forge-group-tab]").forEach((tab) =>
        tab.classList.toggle("is-active", tab.dataset.forgeGroupTab === group),
      );
      root.querySelectorAll("[data-forge-group-panel]").forEach((panel) =>
        panel.classList.toggle("is-hidden", panel.dataset.forgeGroupPanel !== group),
      );
    });
  });

  root.querySelectorAll("[data-forge-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.forgePreset;
      const preset = CYBERPUNK_PRESETS[id];
      if (!preset) return;
      form.elements.namedItem("preset").value = id;
      form.elements.namedItem("level").value = preset.level;
      form.elements.namedItem("includePrograms").checked =
        preset.includePrograms;
      const chromeField = form.elements.namedItem("chromeIntensity");
      const pktBodyField = form.elements.namedItem("pktBodyId");
      const pktField = form.elements.namedItem("pktModelKey");
      if (chromeField) chromeField.value = preset.forbidChrome ? "none" : "standard";
      if (pktBodyField) pktBodyField.value = preset.pkt && !preset.forbidChrome ? "random" : "";
      if (pktField) pktField.value = preset.pkt && !preset.forbidChrome ? "random" : "";
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
      const values = readForm(app);
      const catalog = await loadCyberpunkCatalog({
        refresh: true,
        sources: { cpel: values.sourceCpel, remaster: values.sourceRemaster },
      });
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
        "Макрос запуска Киберпанк-Кузницы NPC создан.",
      );
    });

  root.querySelectorAll("[data-forge-source]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const cpel = form.elements.namedItem("sourceCpel");
      const remaster = form.elements.namedItem("sourceRemaster");
      if (!cpel?.checked && !remaster?.checked) {
        checkbox.checked = true;
        globalThis.ui?.notifications?.warn?.("Оставьте включённым хотя бы один источник предметов.");
        return;
      }
      clearCyberpunkCatalog();
      app.pendingValues = readForm(app);
      await app.render({ force: true });
    });
  });

  form.addEventListener("change", (event) => {
    refreshConditionalFields(app);
    refreshPresetSelection(app);
    if (["pktBodyId", "pktModelKey"].includes(event.target?.name)) {
      syncPktSelectors(app);
    }
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
      id: "sf2e-neon-forge",
      tag: "form",
      classes: ["cpel-neon-forge-application"],
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
        gear: 0,
        cyberware: 0,
        programs: 0,
        cpel: 0,
        remaster: 0,
      };
      let catalogError = "";
      let catalog = null;
      let pktModels = [];
      let pktBodies = [];
      let pktCatalogError = "";
      const catalogForm = normalizeForgeForm(this.pendingValues ?? this.initialValues ?? {});
      try {
        catalog = await loadCyberpunkCatalog({
          sources: { cpel: catalogForm.sourceCpel, remaster: catalogForm.sourceRemaster },
        });
        catalogStats = {
          items: catalog.entries.length,
          weapons: catalog.weapons.length,
          armor: catalog.armor.length,
          cyberware: catalog.cyberware.length,
          gear: catalog.gear.length,
          programs: catalog.programs.length + catalog.quickhacks.length,
          cpel: catalog.sourceStats?.cpel ?? 0,
          remaster: catalog.sourceStats?.remaster ?? 0,
        };
        // PKT bodies must remain selectable even when Remaster's model journals
        // are missing, renamed, or temporarily fail to load. The item catalog
        // itself is enough to populate the conversion/body selector.
        pktBodies = pktBodiesFromCatalog(catalog);
      } catch (error) {
        catalogError = error.message;
      }
      const pktErrors = [];
      try {
        pktModels = (await CyberwareTab.loadPktModels())
          .map((model) => {
            const missing = [];
            if (!catalogHasModelItem(catalog, model.requiredBodyId, model.requiredBodyName ?? model.bodyName ?? "")) {
              missing.push(model.requiredBodyName ?? model.bodyName ?? model.requiredBodyId ?? "корпус");
            }
            const fixed = [...(model.unique ?? []), ...(model.components ?? [])];
            for (const entry of fixed) {
              if (entry.itemId && !catalogHasModelItem(catalog, entry.itemId, entry.name ?? entry.label ?? "")) {
                missing.push(entry.name ?? entry.label ?? entry.itemId);
              }
            }
            for (const choice of model.choices ?? []) {
              const need = Math.max(1, Number(choice.choose) || 1);
              const options = choice.options ?? [];
              const available = (choice.itemIds ?? []).filter((id, index) =>
                catalogHasModelItem(catalog, id, options[index]?.name ?? options.find((entry) => entry.itemId === id)?.name ?? "")
              );
              if (available.length < need) missing.push(choice.label ?? choice.name ?? choice.key ?? "вариант модели");
            }
            const available = Boolean(catalog) && missing.length === 0;
            const requiredBodyName = model.requiredBodyName ?? model.bodyName ?? "корпус ПКТ";
            return {
              key: model.key,
              name: model.name,
              label: `${model.name}${available ? "" : " [неполная библиотека]"}`,
              description: model.description ?? "",
              requiredBodyId: model.requiredBodyId ?? "",
              requiredBodyName,
              requiredBodyKey: normalizeCatalogName(requiredBodyName),
              available,
              missing: [...new Set(missing)],
            };
          })
          .sort((left, right) => left.name.localeCompare(right.name, "ru"));
      } catch (error) {
        pktErrors.push(`модели: ${error.message}`);
      }

      // Load structured bodies independently from models. Previously both lived
      // in one try/catch, so one broken journal hid every concrete conversion
      // and left only “Без ПКТ / Случайная доступная конверсия”.
      try {
        const pktContent = await CyberwareTab.loadPktContent();
        const structuredBodies = (pktContent.bodies ?? [])
          .map((body) => {
            const available = Boolean(catalog) && catalogHasModelItem(catalog, body.itemId, body.name);
            return {
              itemId: body.itemId,
              name: body.name,
              nameKey: normalizeCatalogName(body.name),
              quality: body.quality,
              slots: body.slots,
              available,
              label: `${body.name}${Number.isFinite(body.slots) ? ` · ${body.slots} сл.` : ""}${available ? "" : " [нет в активных источниках]"}`,
            };
          });
        pktBodies = mergePktBodies(pktBodies, structuredBodies);
      } catch (error) {
        pktErrors.push(`корпуса: ${error.message}`);
      }

      // Last-resort scan: if the structured loader yielded nothing but the main
      // catalog is present, expose all known/flagged PKT body items directly.
      if (!pktBodies.length && catalog) pktBodies = pktBodiesFromCatalog(catalog);
      pktCatalogError = pktErrors.join("; ");
      return {
        ...context,
        presetGroups: presetsByGroup(),
        roles: roleOptions(),
        tiers: Object.entries(TIER_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
        attributeOptions: ATTRIBUTE_OPTIONS,
        attributeTiers: ATTRIBUTE_OVERRIDE_TIERS,
        saveOptions: SAVE_OPTIONS,
        saveTiers: SAVE_OVERRIDE_TIERS,
        skillOptions: forgeSkillOptions(),
        skillTiers: SKILL_OVERRIDE_TIERS,
        abilityTemplates: abilityTemplateOptions(),
        abilitySlots: Array.from({ length: 6 }, (_, index) => ({ index: index + 1 })),
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
        catalogSourceWarnings: catalog?.sourceWarnings ?? [],
        remasterActive: globalThis.game?.modules?.get?.("cyberpunk-remaster")?.active === true,
        pktModels,
        pktBodies,
        pktCatalogError,
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
      const remasterSource = this.element?.querySelector?.('[name="sourceRemaster"]');
      if (remasterSource?.disabled) remasterSource.checked = false;
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
      "Киберпанк-Кузница NPC работает только в Starfinder 2e.",
    );
    return null;
  }
  if (!globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.error?.(
      "Киберпанк-Кузницу NPC может открыть только ведущий.",
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
  button.innerHTML = '<i class="fa-solid fa-microchip"></i> Киберпанк-Кузница NPC';
  button.addEventListener("click", () => void openForge());
  group.append(button);
}

function clearCatalogForDocument(document) {
  const pack = String(document?.pack ?? "");
  if (pack.startsWith(`${MODULE_ID}.`) || pack.startsWith("cyberpunk-remaster.")) clearCyberpunkCatalog();
}

function scheduleNpcInterfaceRefresh(item, options = {}) {
  const actor = item?.actor;
  if (
    actor?.type !== "npc" ||
    actor.flags?.[MODULE_ID]?.[FORGE_FLAG]?.generated !== true ||
    options.cyberpunkForgeOperation ||
    options.cyberpunkRemasterManaged ||
    options.cyberpunkRemasterModelOperation ||
    options.cpelNeonForgeManaged ||
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

function actorSheetRoot(app, html) {
  if (html instanceof globalThis.HTMLElement) return html;
  if (html?.[0] instanceof globalThis.HTMLElement) return html[0];
  if (app?.element instanceof globalThis.HTMLElement) return app.element;
  return null;
}

function injectNpcCyberwareTab(app, html) {
  if (!globalThis.game?.user?.isGM || app?.actor?.type !== "npc") return;
  const root = actorSheetRoot(app, html);
  if (!root) return;
  try {
    CyberwareTab.inject(app, root);
  } catch (error) {
    console.warn(`${MODULE_ID} | NPC cyberware tab injection failed`, error);
  }
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
Hooks.on("renderActorSheet", injectNpcCyberwareTab);
Hooks.on("renderActorSheetV2", injectNpcCyberwareTab);
Hooks.on("renderApplicationV2", (app, html) => {
  if (app?.actor?.type === "npc") injectNpcCyberwareTab(app, html);
});
Hooks.on("closeActorSheet", (app) => CyberwareTab.clearSheetState(app));
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
