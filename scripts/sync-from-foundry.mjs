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
import { requireAuthorPath, resolveAuthorPaths } from "./lib/author-paths.mjs";

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
const authorPaths = await resolveAuthorPaths(root, manifest.id);
const sourceModuleRoot = requireAuthorPath(
  authorPaths.foundryModuleRoot,
  "Папка установленного модуля Foundry",
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
        ),
      ),
  );
  return merged;
}

function cleanPktModel(model) {
  const cleanEntry = (source) => {
    const entry = structuredClone(source);
    delete entry.uuid;
    return entry;
  };
  const cleanChoice = (source) => {
    const choice = structuredClone(source);
    delete choice.itemUuids;
    return choice;
  };
  const cleaned = structuredClone(model);
  delete cleaned.requiredBodyUuid;
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
    changed: imported.filter(
      (value) =>
        existingById.has(keyOf(value)) &&
        JSON.stringify(existingById.get(keyOf(value))) !==
          JSON.stringify(value),
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
    readJson("content/exports/items.json"),
    readJson("data/item-folders.json"),
    readJson("content/exports/journals.json"),
    readJson("content/exports/macros.json"),
    readJson("data/pkt-models.json"),
    readJson("data/pkt-components.json"),
  ]);
  const allowDeletions = process.env.SYNC_ALLOW_DELETIONS === "1";
  const activeModels = importedJournals
    .flatMap((journal) =>
      (journal.pages ?? []).map((page) => page.flags?.[manifest.id]?.pktModel),
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
    writeJson("content/exports/items.json", items),
    writeJson("data/item-folders.json", folders),
    writeJson("content/exports/journals.json", journals),
    writeJson("content/exports/macros.json", macros),
    writeJson("data/pkt-models.json", models),
  ]);

  console.table({
    items: summarize(currentItems, items),
    folders: summarize(currentFolders, folders),
    journals: summarize(currentJournals, journals),
    macros: summarize(currentMacros, macros),
    pktModels: summarize(currentModels, models, (model) => model.key),
  });
  if (!allowDeletions) {
    console.log(
      "Documents absent from Foundry were retained. " +
        "Set SYNC_ALLOW_DELETIONS=1 to mirror intentional deletions.",
    );
  }
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
