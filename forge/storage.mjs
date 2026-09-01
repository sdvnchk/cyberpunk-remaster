import { MODULE_ID } from "./constants.mjs";
import { normalizeForgeForm, resolvePreset } from "./presets.mjs";

const SETTINGS = Object.freeze({
  customPresets: "forgeCustomPresets",
  lastForm: "forgeLastForm",
  recentHistory: "forgeRecentHistory",
});

function plain(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export function registerForgeSettings() {
  game.settings.register(MODULE_ID, SETTINGS.customPresets, {
    name: "Киберпанк-Кузница NPC: пользовательские пресеты",
    hint: "Скрытое хранилище пресетов ведущего.",
    scope: "world",
    config: false,
    type: Object,
    default: { entries: {} },
  });
  game.settings.register(MODULE_ID, SETTINGS.lastForm, {
    name: "Киберпанк-Кузница NPC: последняя форма",
    hint: "Последние безопасные параметры текущего пользователя.",
    scope: "user",
    config: false,
    type: Object,
    default: {},
  });
  game.settings.register(MODULE_ID, SETTINGS.recentHistory, {
    name: "Киберпанк-Кузница NPC: история",
    hint: "Последние созданные Кузницей NPC.",
    scope: "user",
    config: false,
    type: Object,
    default: { entries: [] },
  });
}

export function getLastForm() {
  const stored = plain(game.settings.get(MODULE_ID, SETTINGS.lastForm));
  return normalizeForgeForm({
    ...stored,
    target: "new",
    itemPolicy: "generated",
    backupOriginal: true,
    deploymentMode: "none",
    addToCombat: false,
    createBriefing: false,
    sendChatSummary: false,
    randomSeed: "",
  });
}

export async function setLastForm(values) {
  const safe = normalizeForgeForm({
    ...values,
    target: "new",
    itemPolicy: "generated",
    backupOriginal: true,
    deploymentMode: "none",
    addToCombat: false,
    createBriefing: false,
    sendChatSummary: false,
    randomSeed: "",
  });
  return game.settings.set(MODULE_ID, SETTINGS.lastForm, safe);
}

export function getCustomPresets() {
  const stored = plain(game.settings.get(MODULE_ID, SETTINGS.customPresets));
  return stored.entries && typeof stored.entries === "object"
    ? stored.entries
    : {};
}

export async function saveCustomPreset(name, values) {
  const cleanName = String(name ?? "")
    .trim()
    .slice(0, 60);
  if (!cleanName) throw new Error("Укажите название пресета.");
  const entries = getCustomPresets();
  const id =
    Object.entries(entries).find(
      ([, entry]) => entry.name === cleanName,
    )?.[0] ?? `preset-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
  entries[id] = {
    name: cleanName,
    values: {
      ...normalizeForgeForm(values),
      randomSeed: "",
    },
    updatedAt: new Date().toISOString(),
  };
  const ordered = Object.entries(entries)
    .sort(([, left], [, right]) =>
      String(right.updatedAt).localeCompare(String(left.updatedAt)),
    )
    .slice(0, 40);
  await game.settings.set(MODULE_ID, SETTINGS.customPresets, {
    entries: Object.fromEntries(ordered),
  });
  return id;
}

export async function deleteCustomPreset(id) {
  const entries = getCustomPresets();
  if (!entries[id]) return false;
  delete entries[id];
  await game.settings.set(MODULE_ID, SETTINGS.customPresets, { entries });
  return true;
}

export function exportCustomPresets() {
  return {
    format: "sf2e-cyberpunk-forge-presets",
    version: 1,
    entries: getCustomPresets(),
  };
}

export async function importCustomPresets(payload) {
  const parsed =
    typeof payload === "string" ? JSON.parse(payload) : plain(payload);
  const incoming = parsed.entries ?? parsed;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    throw new Error("В файле нет подходящих пресетов.");
  }
  const entries = getCustomPresets();
  let imported = 0;
  for (const preset of Object.values(incoming)) {
    if (!preset || typeof preset !== "object") continue;
    const name = String(preset.name ?? "")
      .trim()
      .slice(0, 60);
    if (!name) continue;
    const id = `imported-${globalThis.crypto?.randomUUID?.() ?? Date.now()}-${imported}`;
    entries[id] = {
      name,
      values: {
        ...normalizeForgeForm(preset.values ?? preset),
        randomSeed: "",
      },
      updatedAt: new Date().toISOString(),
    };
    imported += 1;
  }
  if (!imported) throw new Error("Корректные пресеты не найдены.");
  await game.settings.set(MODULE_ID, SETTINGS.customPresets, { entries });
  return imported;
}

export function getRecentHistory() {
  const stored = plain(game.settings.get(MODULE_ID, SETTINGS.recentHistory));
  return Array.isArray(stored.entries) ? stored.entries : [];
}

export async function addRecentHistory(form, results) {
  const actors = results.map((result) => result.actor).filter(Boolean);
  const backups = results.map((result) => result.backup).filter(Boolean);
  const preset = resolvePreset(form.preset);
  const entry = {
    id: `history-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    createdAt: new Date().toISOString(),
    name: preset.label,
    level: form.level,
    actorUuids: actors.map((actor) => actor.uuid),
    backupUuids: backups.map((actor) => actor.uuid),
    warnings: results.flatMap((result) => result.warnings ?? []).slice(0, 30),
  };
  const entries = [entry, ...getRecentHistory()].slice(0, 12);
  await game.settings.set(MODULE_ID, SETTINGS.recentHistory, { entries });
  return entry;
}
