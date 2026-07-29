import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportsToProtect = [
  "content/exports/items.json",
  "content/exports/journals.json",
  "content/exports/macros.json",
  "data/item-folders.json",
];

async function digest(relative) {
  return crypto
    .createHash("sha256")
    .update(await fs.readFile(path.join(root, relative)))
    .digest("hex");
}

test("pack build is a pure consumer of canonical exports", async () => {
  const before = new Map(
    await Promise.all(
      exportsToProtect.map(async (relative) => [
        relative,
        await digest(relative),
      ]),
    ),
  );
  await promisify(execFile)(
    process.execPath,
    [path.join(root, "scripts", "build-packs.mjs")],
    { cwd: root, timeout: 30_000 },
  );
  for (const relative of exportsToProtect) {
    assert.equal(
      await digest(relative),
      before.get(relative),
      `${relative} was modified by the build`,
    );
  }
});
