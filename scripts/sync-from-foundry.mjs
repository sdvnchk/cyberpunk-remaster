import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadClassicLevel } from "./lib/classic-level.mjs";
import {
  transformFolders,
  transformItems,
  transformJournals,
  transformMacros,
} from "./lib/content.mjs";
import { organizeIconLibrary } from "./lib/icon-library.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relative) =>
  JSON.parse(await fs.readFile(path.join(root, relative), "utf8"));
const writeJson = async (relative, value) =>
  fs.writeFile(
    path.join(root, relative),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
const manifest = await readJson("module.json");
const defaultInstallation = path.resolve(
  "D:/Workspaces/FoundryVTT_StarFinder_v14.361/Data/modules",
  manifest.id,
);
const sourceModuleRoot = path.resolve(
  process.env.FOUNDRY_MODULE_PATH ||
    process.env.SOURCE_MODULE_ROOT ||
    (process.env.FOUNDRY_DATA_PATH
      ? path.join(process.env.FOUNDRY_DATA_PATH, "modules", manifest.id)
      : defaultInstallation),
);
if (sourceModuleRoot === root) {
  throw new Error("The Foundry source module must differ from the workspace.");
}
await fs.access(path.join(sourceModuleRoot, "module.json"));

const temporaryRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cyberpunk-remaster-sync-"),
);
const snapshotPacks = path.join(temporaryRoot, "packs");
const ClassicLevel = loadClassicLevel();

async function snapshotPack(name) {
  const source = path.join(sourceModuleRoot, "packs", name);
  const target = path.join(snapshotPacks, name);
  await fs.cp(source, target, { recursive: true });
  return target;
}

async function readLevels(packPath, levelNames) {
  const database = new ClassicLevel(packPath, {
    createIfMissing: false,
    valueEncoding: "json",
  });
  try {
    const result = {};
    for (const name of levelNames) {
      const level = database.sublevel(name, { valueEncoding: "json" });
      result[name] = [];
      for await (const [key, value] of level.iterator()) {
        result[name].push({ key, value });
      }
    }
    return result;
  } finally {
    await database.close();
  }
}

function mergeDocuments(
  existing,
  imported,
  allowDeletions,
  keyOf = (value) => value._id,
) {
  const importedById = new Map(imported.map((value) => [keyOf(value), value]));
  const merged = existing
    .filter((value) => !allowDeletions || importedById.has(keyOf(value)))
    .map((value) => importedById.get(keyOf(value)) ?? value);
  const existingIds = new Set(existing.map(keyOf));
  merged.push(
    ...imported
      .filter((value) => !existingIds.has(keyOf(value)))
      .sort((left, right) =>
        String(left.name ?? keyOf(left)).localeCompare(
          String(right.name ?? keyOf(right)),
          "ru",
        )
      ),
  );
  return merged;
}

function cleanPktModel(model) {
  const cleanEntry = ({ uuid, ...entry }) => entry;
  const cleanChoice = ({ itemUuids, ...choice }) => choice;
  const { requiredBodyUuid, ...cleaned } = structuredClone(model);
  cleaned.unique = (cleaned.unique ?? []).map(cleanEntry);
  cleaned.components = (cleaned.components ?? []).map(cleanEntry);
  cleaned.choices = (cleaned.choices ?? []).map(cleanChoice);
  return cleaned;
}

function summarize(existing, imported, keyOf = (value) => value._id) {
  const existingById = new Map(existing.map((value) => [keyOf(value), value]));
  const importedById = new Map(imported.map((value) => [keyOf(value), value]));
  return {
    existing: existing.length,
    imported: imported.length,
    added: imported.filter((value) => !existingById.has(keyOf(value))).length,
    changed: imported.filter((value) =>
      existingById.has(keyOf(value)) &&
      JSON.stringify(existingById.get(keyOf(value))) !== JSON.stringify(value)
    ).length,
    absent: existing.filter((value) => !importedById.has(keyOf(value))).length,
  };
}

try {
  await fs.mkdir(snapshotPacks, { recursive: true });
  const [itemPath, journalPath, macroPath] = await Promise.all([
    snapshotPack("cyberpunk-items"),
    snapshotPack("cyberpunk-journals"),
    snapshotPack("cyberpunk-macros"),
  ]);
  const [itemPack, journalPack, macroPack] = await Promise.all([
    readLevels(itemPath, ["items", "folders"]),
    readLevels(journalPath, ["journal", "journal.pages"]),
    readLevels(macroPath, ["macros"]),
  ]);
  const importedItems = itemPack.items.map(({ value }) => value);
  const importedFolders = itemPack.folders.map(({ value }) => value);
  const importedMacros = macroPack.macros.map(({ value }) => value);
  const pageByKey = new Map(
    journalPack["journal.pages"].map(({ key, value }) => [key, value]),
  );
  const importedJournals = journalPack.journal.map(({ value: journal }) => ({
    ...journal,
    pages: (journal.pages ?? []).map((pageId) => {
      const page = pageByKey.get(`${journal._id}.${pageId}`);
      if (!page) {
        throw new Error(`Journal ${journal._id} is missing page ${pageId}.`);
      }
      return page;
    }),
  }));

  const [
    currentItems,
    currentFolders,
    currentJournals,
    currentMacros,
    currentModels,
    pktComponents,
  ] = await Promise.all([
    readJson("items-export.json"),
    readJson("data/item-folders.json"),
    readJson("journals-export.json"),
    readJson("macros-export.json"),
    readJson("data/pkt-models.json"),
    readJson("data/pkt-components.json"),
  ]);
  const allowDeletions = process.env.SYNC_ALLOW_DELETIONS === "1";
  const activeModels = importedJournals
    .flatMap((journal) =>
      (journal.pages ?? []).map((page) =>
        page.flags?.[manifest.id]?.pktModel
      )
    )
    .filter(Boolean)
    .map(cleanPktModel);
  const models = mergeDocuments(
    currentModels,
    activeModels,
    allowDeletions,
    (model) => model.key,
  );
  const items = transformItems(
    mergeDocuments(currentItems, importedItems, allowDeletions),
    models,
    pktComponents,
    {},
  );
  const folders = transformFolders(
    mergeDocuments(currentFolders, importedFolders, allowDeletions),
    {},
  );
  const journals = transformJournals(
    mergeDocuments(currentJournals, importedJournals, allowDeletions),
    models,
    {},
  );
  const macros = transformMacros(
    mergeDocuments(currentMacros, importedMacros, allowDeletions),
    {},
  );

  await Promise.all([
    writeJson("items-export.json", items),
    writeJson("data/item-folders.json", folders),
    writeJson("journals-export.json", journals),
    writeJson("macros-export.json", macros),
    writeJson("data/pkt-models.json", models),
    fs.cp(
      path.join(sourceModuleRoot, "assets", "icons"),
      path.join(root, "assets", "icons"),
      { recursive: true, force: true },
    ),
  ]);

  const iconResult = process.env.SYNC_ORGANIZE_ICONS === "0"
    ? null
    : await organizeIconLibrary({
      root,
      sourceModuleRoot,
      foundryDataRoot: process.env.FOUNDRY_DATA_PATH,
      foundryAppRoot: process.env.FOUNDRY_APP_PATH,
    });
  console.table({
    items: summarize(currentItems, items),
    folders: summarize(currentFolders, folders),
    journals: summarize(currentJournals, journals),
    macros: summarize(currentMacros, macros),
    pktModels: summarize(currentModels, models, (model) => model.key),
  });
  if (iconResult) {
    console.log(
      `Organized ${iconResult.documents} icons; ` +
        `${iconResult.copied} copied, ${iconResult.removed} superseded removed.`,
    );
    console.table(iconResult.counts);
  }
  if (!allowDeletions) {
    console.log(
      "Documents absent from Foundry were retained. " +
        "Set SYNC_ALLOW_DELETIONS=1 to mirror intentional deletions.",
    );
  }
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
