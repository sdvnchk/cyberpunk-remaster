import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadClassicLevel } from "./lib/classic-level.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "module.json"), "utf8"),
);
const defaultInstallation = path.resolve(
  "D:/Workspaces/FoundryVTT_StarFinder_v14.361/Data/modules",
  manifest.id,
);
const targetRoot = path.resolve(
  process.env.FOUNDRY_MODULE_PATH ||
    process.env.TARGET_MODULE_ROOT ||
    defaultInstallation,
);
if (targetRoot === root) {
  throw new Error("The Foundry target module must differ from the workspace.");
}
const targetManifestPath = path.join(targetRoot, "module.json");
const targetManifest = JSON.parse(
  await fs.readFile(targetManifestPath, "utf8"),
);
if (targetManifest.id !== manifest.id) {
  throw new Error(
    `Refusing to replace module ${targetManifest.id}; expected ${manifest.id}.`,
  );
}

const ClassicLevel = loadClassicLevel();
for (const pack of manifest.packs ?? []) {
  const packPath = path.join(targetRoot, pack.path);
  const database = new ClassicLevel(packPath, {
    createIfMissing: false,
    valueEncoding: "json",
  });
  try {
    await database.open();
  } catch (error) {
    const code = error?.cause?.code ?? error?.code;
    if (code === "LEVEL_LOCKED" || code === "LEVEL_DATABASE_NOT_OPEN") {
      throw new Error(
        `Compendium ${pack.name} is locked. Close the active Foundry world ` +
          "before deploying; no target files were changed.",
      );
    }
    throw error;
  } finally {
    if (database.status === "open") await database.close();
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  root,
  ".build",
  "deploy-backups",
  `${manifest.id}-${stamp}`,
);
await fs.mkdir(path.dirname(backupRoot), { recursive: true });
await fs.cp(targetRoot, backupRoot, { recursive: true });

const directories = [
  "assets",
  "data",
  "docs",
  "packs",
  "rule-elements",
  "scripts",
  "sheets",
  "styles",
  "templates",
  "tests",
];
const rootFiles = [
  ".gitignore",
  "CHANGELOG.md",
  "items-export.json",
  "journals-export.json",
  "macros-export.json",
  "main.mjs",
  "module.js",
  "module.json",
  "package.json",
  "README.md",
];

for (const name of directories) {
  const source = path.join(root, name);
  const target = path.join(targetRoot, name);
  if (path.dirname(target) !== targetRoot) {
    throw new Error(`Unsafe deployment target: ${target}`);
  }
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(source, target, { recursive: true });
}
for (const name of rootFiles) {
  await fs.copyFile(path.join(root, name), path.join(targetRoot, name));
}
await fs.rm(path.join(targetRoot, "ICON_DESIGN_RULES.md"), { force: true });

console.log(`Deployed ${manifest.title} to ${targetRoot}`);
console.log(`Backup: ${backupRoot}`);
