import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadClassicLevel } from "./lib/classic-level.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePack = process.env.SOURCE_ITEM_PACK;
const itemIds = [...new Set(
  String(process.env.ITEM_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
)];

if (!sourcePack) {
  throw new Error("Set SOURCE_ITEM_PACK to the source LevelDB Item pack.");
}
if (!itemIds.length || itemIds.some((id) => !/^[A-Za-z0-9]{16}$/.test(id))) {
  throw new Error("Set ITEM_IDS to comma-separated 16-character Item IDs.");
}

const temporaryRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cyberpunk-remaster-import-"),
);
const snapshot = path.join(temporaryRoot, "cyberpunk-items");

try {
  // A running Foundry process keeps LevelDB locked. A filesystem snapshot is
  // sufficient for explicitly selected documents and does not mutate the pack.
  await fs.cp(path.resolve(sourcePack), snapshot, { recursive: true });
  const ClassicLevel = loadClassicLevel();
  const database = new ClassicLevel(snapshot, {
    createIfMissing: false,
    valueEncoding: "json",
  });
  const imported = [];
  try {
    const itemLevel = database.sublevel("items", {
      valueEncoding: "json",
    });
    for (const itemId of itemIds) {
      const item = await itemLevel.get(itemId);
      if (!item) throw new Error(`Item ${itemId} was not found.`);
      imported.push(item);
    }
  } finally {
    await database.close();
  }

  const target = path.join(root, "items-export.json");
  const current = JSON.parse(await fs.readFile(target, "utf8"));
  const importedById = new Map(imported.map((item) => [item._id, item]));
  const merged = current.map((item) =>
    importedById.get(item._id) ?? item
  );
  const existingIds = new Set(current.map((item) => item._id));
  merged.push(
    ...imported
      .filter((item) => !existingIds.has(item._id))
      .sort((left, right) =>
        String(left.name).localeCompare(String(right.name), "ru")
      ),
  );
  await fs.writeFile(
    target,
    `${JSON.stringify(merged, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Imported ${imported.length} selected Items; export now contains ` +
      `${merged.length} Items.`,
  );
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
