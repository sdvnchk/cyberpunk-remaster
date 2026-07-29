import fs from "node:fs/promises";
import path from "node:path";

async function readLocalConfig(root) {
  try {
    return JSON.parse(
      await fs.readFile(path.join(root, ".author-paths.local.json"), "utf8"),
    );
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error(
      `Не удалось прочитать .author-paths.local.json: ${error.message}`,
    );
  }
}

function optionalPath(value) {
  return typeof value === "string" && value.trim() ? path.resolve(value) : null;
}

export async function resolveAuthorPaths(root, moduleId) {
  const config = await readLocalConfig(root);
  const foundryDataRoot = optionalPath(
    process.env.FOUNDRY_DATA_PATH ?? config.foundryDataRoot,
  );
  const foundryAppRoot = optionalPath(
    process.env.FOUNDRY_APP_PATH ?? config.foundryAppRoot,
  );
  const foundryModuleRoot = optionalPath(
    process.env.FOUNDRY_MODULE_PATH ??
      process.env.SOURCE_MODULE_ROOT ??
      process.env.TARGET_MODULE_ROOT ??
      config.foundryModuleRoot ??
      (foundryDataRoot
        ? path.join(foundryDataRoot, "modules", moduleId)
        : null),
  );
  const workspaceRoot = optionalPath(
    process.env.CYBERPUNK_WORKSPACE_PATH ??
      process.env.MODULE_WORKSPACE_PATH ??
      config.workspaceRoot ??
      root,
  );

  return {
    config,
    foundryAppRoot,
    foundryDataRoot:
      foundryDataRoot ??
      (foundryModuleRoot ? path.resolve(foundryModuleRoot, "..", "..") : null),
    foundryModuleRoot,
    workspaceRoot,
  };
}

export function requireAuthorPath(value, description) {
  if (value) return value;
  throw new Error(
    `${description} не настроен. Создайте .author-paths.local.json по ` +
      "образцу .author-paths.local.json.example или задайте переменную окружения.",
  );
}
