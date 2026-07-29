import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadClassicLevel } from "./lib/classic-level.mjs";
import {
  collectCustomIconPaths,
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

const iconPaths = new Set([
  ...collectCustomIconPaths(items),
  ...collectCustomIconPaths(journals),
  ...collectCustomIconPaths(macros),
]);

function iconSourceRoot() {
  if (process.env.FOUNDRY_ICON_SOURCE) {
    return path.resolve(process.env.FOUNDRY_ICON_SOURCE);
  }
  if (process.env.FOUNDRY_DATA_PATH) {
    return path.resolve(process.env.FOUNDRY_DATA_PATH, "assets", "icons");
  }
  return null;
}

function safeIconRelative(relative) {
  const normalized = relative.replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(normalized) ||
    normalized.split("/").includes("..") ||
    /[?#]/.test(normalized)
  ) {
    throw new Error(`Unsafe icon path: ${relative}`);
  }
  return normalized;
}

async function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
}

async function copyIcons() {
  const sourceRoot = iconSourceRoot();
  const targetRoot = path.resolve(root, "assets", "icons");
  let copied = 0;
  let verified = 0;

  for (const value of [...iconPaths].sort()) {
    const relative = safeIconRelative(value);
    const target = path.resolve(targetRoot, ...relative.split("/"));
    if (!target.startsWith(`${targetRoot}${path.sep}`)) {
      throw new Error(`Icon target escapes the module: ${relative}`);
    }

    const targetExists = await fs
      .access(target)
      .then(() => true)
      .catch(() => false);
    if (!sourceRoot) {
      if (!targetExists) {
        throw new Error(
          `Missing ${relative}; set FOUNDRY_ICON_SOURCE or FOUNDRY_DATA_PATH.`,
        );
      }
      verified++;
      continue;
    }

    const source = path.resolve(sourceRoot, ...relative.split("/"));
    if (!source.startsWith(`${sourceRoot}${path.sep}`)) {
      throw new Error(`Icon source escapes the source root: ${relative}`);
    }
    await fs.access(source);
    await fs.mkdir(path.dirname(target), { recursive: true });

    if (targetExists) {
      const [sourceHash, targetHash] = await Promise.all([
        sha256(source),
        sha256(target),
      ]);
      if (sourceHash !== targetHash) {
        throw new Error(`Refusing to overwrite changed icon: ${target}`);
      }
      verified++;
    } else {
      await fs.copyFile(source, target);
      copied++;
    }
  }
  return { copied, verified };
}

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

const iconResult = await copyIcons();
console.log(
  [
    `Built packs: ${items.length} Items, ${folders.length} folders,`,
    `${journals.length} journals / ${journals.reduce((n, j) => n + j.pages.length, 0)} pages,`,
    `${macros.length} macros.`,
  ].join(" "),
);
console.log(
  `Icons: ${iconPaths.size} referenced, ${iconResult.copied} copied, ` +
    `${iconResult.verified} already verified.`,
);
console.log("Rewrite counters:", counters);
