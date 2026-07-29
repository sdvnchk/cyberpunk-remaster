import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadClassicLevel } from "./lib/classic-level.mjs";
import {
  allStrings,
  plainText,
  validateTransformedContent,
} from "./lib/content.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packsRoot = path.join(root, "packs");
const ClassicLevel = loadClassicLevel();

const packSpecs = [
  {
    name: "cyberpunk-items",
    label: "SF2E Cyberpunk Items",
    type: "Item",
  },
  {
    name: "cyberpunk-journals",
    label: "SF2E Cyberpunk Journals",
    type: "JournalEntry",
  },
  {
    name: "cyberpunk-macros",
    label: "SF2E Cyberpunk Macros",
    type: "Macro",
  },
];

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix
      ? `${prefix}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      files.push(
        ...(await listFiles(path.join(directory, entry.name), relative)),
      );
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

async function assertPackDirectory(spec) {
  const directory = path.join(packsRoot, spec.name);
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) {
    throw new Error(`${spec.name} is not a LevelDB directory.`);
  }

  const current = (await fs.readFile(path.join(directory, "CURRENT"), "utf8"))
    .trim();
  if (!/^MANIFEST-\d+$/.test(current)) {
    throw new Error(`${spec.name} has an invalid CURRENT pointer: ${current}`);
  }
  await fs.access(path.join(directory, current));

  const files = await fs.readdir(directory);
  if (!files.some((file) => /\.(?:ldb|log)$/.test(file))) {
    throw new Error(`${spec.name} contains no LevelDB data files.`);
  }
  return directory;
}

async function copyPacksForValidation() {
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "cyberpunk-remaster-validate-"),
  );
  try {
    for (const spec of packSpecs) {
      const source = await assertPackDirectory(spec);
      await fs.cp(source, path.join(temporaryRoot, spec.name), {
        recursive: true,
      });
    }
    return temporaryRoot;
  } catch (error) {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

async function readLevels(packRoot, packName, sublevelNames) {
  const database = new ClassicLevel(path.join(packRoot, packName), {
    createIfMissing: false,
    valueEncoding: "json",
  });
  try {
    const result = {};
    for (const sublevelName of sublevelNames) {
      const level = database.sublevel(sublevelName, {
        valueEncoding: "json",
      });
      const entries = [];
      for await (const [key, value] of level.iterator()) {
        entries.push({ key, value });
      }
      result[sublevelName] = entries;
    }
    return result;
  } finally {
    await database.close();
  }
}

const temporaryPacksRoot = await copyPacksForValidation();
try {
  const [itemPack, journalPack, macroPack] = await Promise.all([
    readLevels(temporaryPacksRoot, "cyberpunk-items", ["items", "folders"]),
    readLevels(temporaryPacksRoot, "cyberpunk-journals", [
      "journal",
      "journal.pages",
    ]),
    readLevels(temporaryPacksRoot, "cyberpunk-macros", ["macros"]),
  ]);

  const items = itemPack.items.map(({ value }) => value);
  const folders = itemPack.folders.map(({ value }) => value);
  const journalRoots = journalPack.journal.map(({ value }) => value);
  const pageEntries = journalPack["journal.pages"];
  const pages = pageEntries.map(({ value }) => value);
  const macros = macroPack.macros.map(({ value }) => value);

  for (const entries of [
    itemPack.items,
    itemPack.folders,
    journalPack.journal,
    macroPack.macros,
  ]) {
    for (const { key, value } of entries) {
      if (key !== value._id) {
        throw new Error(
          `LevelDB key ${key} does not match Document ID ${value._id}.`,
        );
      }
    }
  }

  const [
    sourceItems,
    sourceFolders,
    sourceJournals,
    sourceMacros,
    sourcePktModels,
    pktComponents,
  ] = await Promise.all([
    "items-export.json",
    "data/item-folders.json",
    "journals-export.json",
    "macros-export.json",
    "data/pkt-models.json",
    "data/pkt-components.json",
  ].map(async (relative) =>
    JSON.parse(await fs.readFile(path.join(root, relative), "utf8"))
  ));
  const expected = {
    items: sourceItems.length,
    folders: sourceFolders.length,
    journals: sourceJournals.length,
    pages: sourceJournals.reduce(
      (total, journal) => total + (journal.pages?.length ?? 0),
      0,
    ),
    macros: sourceMacros.length,
  };
  const actual = {
    items: items.length,
    folders: folders.length,
    journals: journalRoots.length,
    pages: pages.length,
    macros: macros.length,
  };
  for (const [key, count] of Object.entries(expected)) {
    if (actual[key] !== count) {
      throw new Error(`Expected ${count} ${key}, found ${actual[key]}.`);
    }
  }

  const pageByKey = new Map(
    pageEntries.map(({ key, value }) => [key, value]),
  );
  const referencedPageKeys = new Set();
  const journals = journalRoots.map((journal) => ({
    ...journal,
    pages: journal.pages.map((pageId) => {
      const key = `${journal._id}.${pageId}`;
      const page = pageByKey.get(key);
      if (!page) {
        throw new Error(`Journal ${journal._id} is missing page ${pageId}.`);
      }
      referencedPageKeys.add(key);
      return page;
    }),
  }));
  const orphanedPageKeys = [...pageByKey.keys()].filter(
    (key) => !referencedPageKeys.has(key),
  );
  if (orphanedPageKeys.length) {
    throw new Error(
      `Orphaned JournalEntryPage records: ${orphanedPageKeys.join(", ")}`,
    );
  }

  const pktModels = pages
    .map((page) => page.flags?.["cyberpunk-remaster"]?.pktModel)
    .filter(Boolean);
  validateTransformedContent({
    items,
    folders,
    journals,
    macros,
    pktComponents,
    pktModels,
  });

  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "module.json"), "utf8"),
  );
  if (manifest.title !== "SF2E Cyberpunk Remaster") {
    throw new Error("Incorrect module title.");
  }
  if (manifest.authors?.[0]?.name !== "Ogorodnik") {
    throw new Error("Incorrect module author.");
  }

  const expectedPackNames = packSpecs.map((pack) => pack.name);
  const declaredPacks = manifest.packs ?? [];
  if (
    JSON.stringify(declaredPacks.map((pack) => pack.name)) !==
      JSON.stringify(expectedPackNames)
  ) {
    throw new Error("Manifest pack declarations are incorrect.");
  }
  for (const spec of packSpecs) {
    const pack = declaredPacks.find((candidate) => candidate.name === spec.name);
    if (
      pack?.label !== spec.label ||
      pack?.type !== spec.type ||
      pack?.path !== `packs/${spec.name}` ||
      pack?.system !== "sf2e"
    ) {
      throw new Error(`Manifest declaration for ${spec.name} is incorrect.`);
    }
  }
  const packFolder = manifest.packFolders?.[0];
  if (
    packFolder?.name !== "SF2E Cyberpunk" ||
    JSON.stringify(packFolder.packs) !== JSON.stringify(expectedPackNames)
  ) {
    throw new Error("Manifest pack folder does not contain all three packs.");
  }

  const canonicalExports = await Promise.all(
    [
      "items-export.json",
      "journals-export.json",
      "macros-export.json",
      "data/item-folders.json",
    ].map(async (file) =>
      JSON.parse(await fs.readFile(path.join(root, file), "utf8"))
    ),
  );
  for (const string of allStrings(canonicalExports)) {
    if (
      /Compendium\.world\.sf2e-cyberpunk-|Compendium\.pf2e\.|@UUID\[(?:Item|JournalEntry)\.|(?<!modules\/cyberpunk-remaster\/)assets\/icons\/|modules\/cyberpunk-remaster\/modules\/cyberpunk-remaster\//.test(
        string,
      )
    ) {
      throw new Error(
        `Canonical export contains a legacy reference: ${string}`,
      );
    }
  }

  const iconPaths = new Set();
  for (const string of allStrings([items, folders, journals, macros])) {
    for (const match of string.matchAll(
      /modules\/cyberpunk-remaster\/assets\/icons\/([^"'()<>\s]+)/g,
    )) {
      const relative = match[1];
      if (
        path.posix.isAbsolute(relative) ||
        relative.split("/").includes("..") ||
        relative.includes("\\")
      ) {
        throw new Error(`Unsafe module icon path: ${relative}`);
      }
      iconPaths.add(relative);
    }
  }
  const iconDirectory = path.join(root, "assets", "icons");
  const iconFiles = new Set(
    (await listFiles(iconDirectory)).filter((file) =>
      /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(file)
    ),
  );
  const missingIcons = [...iconPaths].filter((file) => !iconFiles.has(file));
  const unreferencedIcons = [...iconFiles].filter(
    (file) => !iconPaths.has(file),
  );
  if (missingIcons.length) {
    throw new Error(`Missing icons: ${missingIcons.join(", ")}`);
  }
  if (unreferencedIcons.length) {
    console.warn(
      `${unreferencedIcons.length} unreferenced icon files retained ` +
        "for future Foundry authoring.",
    );
  }

  if (pktModels.length !== sourcePktModels.length) {
    throw new Error(
      `Expected ${sourcePktModels.length} structured PKT models, ` +
        `found ${pktModels.length}.`,
    );
  }

  const modelJournal = journals.find(
    (journal) => journal._id === "LRV1KlxZGvXDm9ny",
  );
  const overviewPage = modelJournal?.pages.find(
    (page) => page._id === "ylsMSP9weB5au75z",
  );
  if (!plainText(overviewPage?.text?.content)) {
    throw new Error("The PKT model overview page is empty.");
  }
  for (const model of sourcePktModels) {
    if (
      model.journalId === modelJournal?._id &&
      !overviewPage.text.content.includes(model.pageId)
    ) {
      throw new Error(
        `The PKT overview does not link model page ${model.pageId}.`,
      );
    }
  }
  const hammerPage = modelJournal?.pages.find(
    (page) => page._id === "HnzffVt4NYaOy28t",
  );
  if (/Тут описание!/i.test(plainText(hammerPage?.text?.content))) {
    throw new Error("The PKT Hammer page still contains placeholder text.");
  }

  const traceMacro = macros.find(
    (macro) => macro.name === "Счётчик следа",
  );
  if (
    !traceMacro?.command.includes(
      "flags.cyberpunk-remaster.netrunnerTrace",
    )
  ) {
    throw new Error("The trace macro still uses a world-scoped flag.");
  }

  const designRules = await fs.stat(
    path.join(root, "assets", "icons", "ICON_DESIGN_RULES.md"),
  );
  if (!designRules.isFile() || designRules.size === 0) {
    throw new Error("ICON_DESIGN_RULES.md must contain the design guide.");
  }

  console.log(
    `Validated ${items.length} Items, ${folders.length} folders, ` +
      `${journals.length} journals / ${pages.length} pages, ` +
      `${macros.length} macros, ${pktComponents.length} PKT components and ` +
      `${iconPaths.size} icons.`,
  );
} finally {
  await fs.rm(temporaryPacksRoot, { recursive: true, force: true });
}
