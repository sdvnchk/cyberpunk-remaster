import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuthorPath, resolveAuthorPaths } from "./lib/author-paths.mjs";

const currentRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const currentManifest = JSON.parse(
  await fs.readFile(path.join(currentRoot, "module.json"), "utf8"),
);
const configured = await resolveAuthorPaths(currentRoot, currentManifest.id);
const workspaceRoot =
  configured.foundryModuleRoot === currentRoot
    ? requireAuthorPath(configured.workspaceRoot, "Рабочая папка")
    : currentRoot;
const foundryModuleRoot =
  configured.foundryModuleRoot === currentRoot
    ? currentRoot
    : requireAuthorPath(
        configured.foundryModuleRoot,
        "Папка установленного модуля Foundry",
      );

if (workspaceRoot === foundryModuleRoot) {
  throw new Error(
    "Рабочая копия и установленный модуль совпадают. Укажите отдельную " +
      "рабочую папку через CYBERPUNK_WORKSPACE_PATH.",
  );
}

const workspaceManifest = JSON.parse(
  await fs.readFile(path.join(workspaceRoot, "module.json"), "utf8"),
);
if (workspaceManifest.id !== currentManifest.id) {
  throw new Error(
    `В рабочей папке найден модуль ${workspaceManifest.id}; ` +
      `ожидался ${currentManifest.id}.`,
  );
}

console.log(`Рабочая копия: ${workspaceRoot}`);
console.log(`Установленный модуль: ${foundryModuleRoot}`);

const isWindows = process.platform === "win32";
const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const args = isWindows
  ? ["/d", "/s", "/c", "npm run author:update:workspace"]
  : ["run", "author:update:workspace"];
const child = spawn(command, args, {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    FOUNDRY_MODULE_PATH: foundryModuleRoot,
  },
  stdio: "inherit",
});

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal) {
      reject(new Error(`author:update завершён сигналом ${signal}.`));
    } else {
      resolve(code ?? 1);
    }
  });
});
process.exitCode = exitCode;
