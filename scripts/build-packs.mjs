import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadClassicLevel } from "./lib/classic-level.mjs";
import {
  transformFolders,
  transformItems,
  transformJournals,
  transformMacros,
  validateTransformedContent,
} from "./lib/content.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) =>
  JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));

const [rawItems, rawJournals, rawMacros, rawFolders, pktModels, pktComponents] =
  await Promise.all([
    readJson("content/exports/items.json"),
    readJson("content/exports/journals.json"),
    readJson("content/exports/macros.json"),
    readJson("data/item-folders.json"),
    readJson("data/pkt-models.json"),
    readJson("data/pkt-components.json"),
  ]);

const counters = {};
const items = transformItems(rawItems, pktModels, pktComponents, counters);
const journals = transformJournals(rawJournals, pktModels, counters);
const macros = transformMacros(rawMacros, counters);
const folders = transformFolders(rawFolders, counters);
validateTransformedContent({
  items,
  folders,
  journals,
  macros,
  pktComponents,
  pktModels,
});

const packsRoot = path.resolve(root, "packs");
await fs.mkdir(packsRoot, { recursive: true });
const ClassicLevel = loadClassicLevel();

async function recreatePack(name, writer) {
  const target = path.resolve(packsRoot, name);
  if (!target.startsWith(`${packsRoot}${path.sep}`)) {
    throw new Error(`Unsafe pack target: ${target}`);
  }
  await fs.rm(target, { recursive: true, force: true });
  const database = new ClassicLevel(target, { valueEncoding: "json" });
  try {
    await writer(database);
  } finally {
    await database.close();
  }
}

await recreatePack("cyberpunk-items", async (database) => {
  const itemLevel = database.sublevel("items", { valueEncoding: "json" });
  const folderLevel = database.sublevel("folders", { valueEncoding: "json" });
  await itemLevel.batch(
    items.map((item) => ({ type: "put", key: item._id, value: item })),
  );
  await folderLevel.batch(
    folders.map((folder) => ({
      type: "put",
      key: folder._id,
      value: folder,
    })),
  );
});

await recreatePack("cyberpunk-journals", async (database) => {
  const journalLevel = database.sublevel("journal", {
    valueEncoding: "json",
  });
  const pageLevel = database.sublevel("journal.pages", {
    valueEncoding: "json",
  });
  const roots = journals.map((journal) => ({
    ...journal,
    pages: journal.pages.map((page) => page._id),
  }));
  const pages = journals.flatMap((journal) =>
    journal.pages.map((page) => ({
      key: `${journal._id}.${page._id}`,
      value: page,
    })),
  );
  await journalLevel.batch(
    roots.map((journal) => ({
      type: "put",
      key: journal._id,
      value: journal,
    })),
  );
  await pageLevel.batch(pages.map((page) => ({ type: "put", ...page })));
});

await recreatePack("cyberpunk-macros", async (database) => {
  const macroLevel = database.sublevel("macros", { valueEncoding: "json" });
  await macroLevel.batch(
    macros.map((macro) => ({ type: "put", key: macro._id, value: macro })),
  );
});

console.log(
  [
    `Built packs: ${items.length} Items, ${folders.length} folders,`,
    `${journals.length} journals / ${journals.reduce((n, j) => n + j.pages.length, 0)} pages,`,
    `${macros.length} macros.`,
  ].join(" "),
);
console.log("Rewrite counters:", counters);
