import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const currentManifest = JSON.parse(
  await fs.readFile(path.join(currentRoot, "module.json"), "utf8"),
);
const defaultInstallation = path.resolve(
  "D:/Workspaces/FoundryVTT_StarFinder_v14.361/Data/modules",
  currentManifest.id,
);
const configuredWorkspace =
  process.env.CYBERPUNK_WORKSPACE_PATH ??
  process.env.MODULE_WORKSPACE_PATH ??
  "E:/User/Documents/cyberpunk-remaster";
const workspaceRoot = currentRoot === defaultInstallation
  ? path.resolve(configuredWorkspace)
  : currentRoot;
const foundryModuleRoot = currentRoot === defaultInstallation
  ? currentRoot
  : path.resolve(
      process.env.FOUNDRY_MODULE_PATH ??
        process.env.SOURCE_MODULE_ROOT ??
        process.env.TARGET_MODULE_ROOT ??
        defaultInstallation,
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
