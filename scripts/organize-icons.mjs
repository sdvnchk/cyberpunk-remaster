import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { organizeIconLibrary } from "./lib/icon-library.mjs";
import { requireAuthorPath, resolveAuthorPaths } from "./lib/author-paths.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleId = JSON.parse(
  await fs.readFile(path.join(root, "module.json"), "utf8"),
).id;
const authorPaths = await resolveAuthorPaths(root, moduleId);
const sourceModuleRoot = requireAuthorPath(
  authorPaths.foundryModuleRoot,
  "Папка установленного модуля Foundry",
);
const result = await organizeIconLibrary({
  root,
  sourceModuleRoot,
  foundryDataRoot: authorPaths.foundryDataRoot,
  foundryAppRoot: authorPaths.foundryAppRoot,
});
console.log(
  `Organized ${result.documents} document icons: ` +
    `${result.copied} copied, ${result.unchanged} already organized, ` +
    `${result.removed} superseded files removed.`,
);
console.table(result.counts);
