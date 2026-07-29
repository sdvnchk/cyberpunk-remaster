import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { organizeIconLibrary } from "./lib/icon-library.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleId = JSON.parse(
  await fs.readFile(path.join(root, "module.json"), "utf8"),
).id;
const defaultInstallation = path.resolve(
  "D:/Workspaces/FoundryVTT_StarFinder_v14.361/Data/modules",
  moduleId,
);
const sourceModuleRoot = path.resolve(
  process.env.FOUNDRY_MODULE_PATH ||
    process.env.SOURCE_MODULE_ROOT ||
    defaultInstallation,
);
const result = await organizeIconLibrary({
  root,
  sourceModuleRoot,
  foundryDataRoot: process.env.FOUNDRY_DATA_PATH,
  foundryAppRoot: process.env.FOUNDRY_APP_PATH,
});
console.log(
  `Organized ${result.documents} document icons: ` +
    `${result.copied} copied, ${result.unchanged} already organized, ` +
    `${result.removed} superseded files removed.`,
);
console.table(result.counts);
