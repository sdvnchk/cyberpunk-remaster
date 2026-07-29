import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupRoot = path.resolve(root, ".build", "deploy-backups");
const retention = Math.max(
  0,
  Number.parseInt(process.env.BUILD_BACKUP_RETENTION ?? "3", 10) || 0,
);

const exists = await fs
  .access(backupRoot)
  .then(() => true)
  .catch(() => false);
if (!exists) {
  console.log("Deploy backup directory does not exist; nothing to prune.");
  process.exit(0);
}

const entries = (await fs.readdir(backupRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.resolve(backupRoot, entry.name));
const inspected = await Promise.all(
  entries.map(async (directory) => ({
    directory,
    modified: (await fs.stat(directory)).mtimeMs,
  })),
);
inspected.sort((left, right) => right.modified - left.modified);
const removals = inspected.slice(retention);

for (const { directory } of removals) {
  if (path.dirname(directory) !== backupRoot) {
    throw new Error(`Unsafe build-backup path: ${directory}`);
  }
  await fs.rm(directory, { recursive: true, force: true });
}
console.log(
  `Retained ${Math.min(retention, inspected.length)} deploy backup(s); ` +
    `removed ${removals.length}.`,
);
