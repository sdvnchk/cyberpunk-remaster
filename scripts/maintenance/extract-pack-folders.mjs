import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadClassicLevel } from "../lib/classic-level.mjs";
import { requireMaintenanceWrite } from "../lib/maintenance-write.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
requireMaintenanceWrite("Извлечение папок из стороннего компендия");
const source =
  process.env.SOURCE_ITEM_PACK ||
  (process.env.FOUNDRY_DATA_PATH
    ? path.join(
        process.env.FOUNDRY_DATA_PATH,
        "worlds",
        "money-power-fame",
        "packs",
        "sf2e-cyberpunk-items",
      )
    : null);

if (!source) {
  throw new Error(
    "Set SOURCE_ITEM_PACK or FOUNDRY_DATA_PATH before extracting folders.",
  );
}

const ClassicLevel = loadClassicLevel();
const database = new ClassicLevel(source, {
  readOnly: true,
  valueEncoding: "json",
});
const foldersLevel = database.sublevel("folders", {
  valueEncoding: "json",
});

const folders = [];
for await (const [, folder] of foldersLevel.iterator()) {
  folders.push(folder);
}
await database.close();

folders.sort((left, right) =>
  String(left.name).localeCompare(String(right.name), "ru"),
);
const target = path.join(root, "data", "item-folders.json");
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, `${JSON.stringify(folders, null, 2)}\n`, "utf8");
console.log(`Extracted ${folders.length} folders to ${target}`);
