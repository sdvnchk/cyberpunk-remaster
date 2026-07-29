import fs from "node:fs/promises";
import path from "node:path";

const MODULE_ID = "cyberpunk-remaster";
const MODULE_ICON_PREFIX = `modules/${MODULE_ID}/assets/icons/`;
const FINAL_CATEGORIES = new Set([
  "abilities",
  "ammo",
  "armor",
  "consumables",
  "implants",
  "items",
  "programs",
  "special",
  "upgrades",
  "weapons",
]);

function folderPath(folderId, folderById) {
  const result = [];
  const visited = new Set();
  let current = folderById.get(folderId);
  while (current && !visited.has(current._id)) {
    visited.add(current._id);
    result.unshift(String(current.name ?? ""));
    current = folderById.get(current.folder);
  }
  return result;
}

function itemCategory(item, folderById) {
  const names = folderPath(item.folder, folderById);
  const root = names[0] ?? "";
  const joined = names.join("/");

  if (root === "Броня") {
    return joined.includes("Улучшения") ? "upgrades" : "armor";
  }
  if (root === "Вещества") return "consumables";
  if (root === "Импланты") return "implants";
  if (root === "Квикхаки и Программы") return "programs";
  if (root === "Оружие") {
    if (joined.includes("Амуниция")) return "ammo";
    if (joined.includes("Улучшения")) return "upgrades";
    return "weapons";
  }
  if (root === "ПКТ") return "implants";
  if (root === "Предметы") return "items";
  if (
    root === "Действия" ||
    root === "Классы" ||
    root === "Способности" ||
    root === "Эффекты"
  ) {
    return "abilities";
  }

  return (
    {
      action: "abilities",
      ammo: "ammo",
      armor: "armor",
      class: "abilities",
      consumable: "consumables",
      effect: "abilities",
      feat: "abilities",
      spell: "programs",
      weapon: "weapons",
    }[item.type] ?? "items"
  );
}

function subitemCategory(subitem, parentCategory) {
  const current = String(subitem.img ?? "").replaceAll("\\", "/");
  if (/\/upgrades?\//i.test(current)) return "upgrades";
  if (/\/ammo|ammunition\//i.test(current) || subitem.type === "ammo") {
    return "ammo";
  }
  return (
    {
      action: "abilities",
      ammo: "ammo",
      armor: "armor",
      consumable: "consumables",
      effect: "abilities",
      feat: "abilities",
      spell: "programs",
      weapon: "weapons",
    }[subitem.type] ?? parentCategory
  );
}

function documentTarget(category, document) {
  const current = decodeURIComponent(String(document.img ?? ""))
    .replaceAll("\\", "/")
    .split(/[?#]/)[0];
  const filename = path.posix.basename(current);
  if (!filename || filename === "." || filename === "/") {
    throw new Error(`Icon filename is missing for ${document.name}.`);
  }
  return `${category}/${filename}`;
}

function sourcePathForIcon(icon, roots) {
  const normalized = decodeURIComponent(String(icon ?? ""))
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
  if (normalized.startsWith(MODULE_ICON_PREFIX)) {
    return path.resolve(
      roots.iconRoot,
      ...normalized.slice(MODULE_ICON_PREFIX.length).split("/"),
    );
  }
  if (normalized.startsWith("systems/") || normalized.startsWith("worlds/")) {
    return path.resolve(roots.dataRoot, ...normalized.split("/"));
  }
  if (normalized.startsWith("assets/")) {
    return path.resolve(roots.dataRoot, ...normalized.split("/"));
  }
  if (normalized.startsWith("icons/")) {
    return path.resolve(
      roots.appRoot,
      "resources",
      "app",
      "public",
      ...normalized.split("/"),
    );
  }
  return null;
}

function moduleRelative(icon) {
  const normalized = String(icon ?? "").replaceAll("\\", "/");
  return normalized.startsWith(MODULE_ICON_PREFIX)
    ? normalized.slice(MODULE_ICON_PREFIX.length)
    : null;
}

function isOrganizableIcon(icon) {
  const normalized = decodeURIComponent(String(icon ?? ""))
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
  return (
    normalized.startsWith(MODULE_ICON_PREFIX) ||
    normalized.startsWith("assets/icons/")
  );
}

async function exists(file) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false);
}

async function sameFileContent(first, second) {
  const [left, right] = await Promise.all([
    fs.readFile(first),
    fs.readFile(second),
  ]);
  return left.equals(right);
}

async function removeEmptyDirectories(directory, keepRoot = true) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await removeEmptyDirectories(path.join(directory, entry.name), false);
  }
  if (!keepRoot && (await fs.readdir(directory)).length === 0) {
    await fs.rmdir(directory);
  }
}

function collectDocuments(items, macros, folderById) {
  const documents = [];
  const addSubitems = (subitems, parentCategory) => {
    for (const subitem of subitems ?? []) {
      const category = subitemCategory(subitem, parentCategory);
      documents.push({ document: subitem, category });
      addSubitems(subitem.system?.subitems, category);
    }
  };
  for (const item of items) {
    const category = itemCategory(item, folderById);
    documents.push({ document: item, category });
    addSubitems(item.system?.subitems, category);
  }
  for (const macro of macros) {
    documents.push({ document: macro, category: "special" });
  }
  return documents;
}

function synchronizeClassItemIcons(items) {
  const byId = new Map(items.map((item) => [item._id, item]));
  for (const classItem of items.filter((item) => item.type === "class")) {
    for (const grant of Object.values(classItem.system?.items ?? {})) {
      const targetId = String(grant.uuid ?? "")
        .split(".")
        .at(-1);
      const target = byId.get(targetId);
      if (!target) continue;
      grant.name = target.name;
      grant.img = target.img;
    }
  }
}

export async function organizeIconLibrary({
  root,
  sourceModuleRoot,
  foundryDataRoot,
  foundryAppRoot,
}) {
  const itemsPath = path.join(root, "content", "exports", "items.json");
  const foldersPath = path.join(root, "data", "item-folders.json");
  const macrosPath = path.join(root, "content", "exports", "macros.json");
  const iconRoot = path.join(root, "assets", "icons");
  const [items, folders, macros] = await Promise.all([
    fs.readFile(itemsPath, "utf8").then(JSON.parse),
    fs.readFile(foldersPath, "utf8").then(JSON.parse),
    fs.readFile(macrosPath, "utf8").then(JSON.parse),
  ]);
  const folderById = new Map(folders.map((folder) => [folder._id, folder]));
  const dataRoot =
    foundryDataRoot ?? path.resolve(sourceModuleRoot, "..", "..");
  const appRoot =
    foundryAppRoot ??
    process.env.FOUNDRY_APP_PATH ??
    path.resolve(dataRoot, "..", "App");
  const roots = { iconRoot, dataRoot, appRoot };
  const documents = collectDocuments(items, macros, folderById);
  const operations = [];
  const oldModuleSources = new Set();
  const missing = [];

  for (const { document, category } of documents) {
    if (!document?._id || !document?.img) continue;
    const currentIcon = String(document.img).replaceAll("\\", "/");
    // Core, system, world, and other-module assets are dependencies, not
    // authored module files. Preserve their canonical paths. Only reorganize
    // icons that are already inside this module or were explicitly selected
    // from the user's Data/assets/icons staging directory.
    if (!isOrganizableIcon(currentIcon)) continue;
    if (path.posix.basename(currentIcon.split(/[?#]/)[0]) === "item-bag.svg") {
      // Keep Foundry's generic placeholder at its canonical core path. It is
      // not an authored module icon and several draft items may share it.
      document.img = "icons/svg/item-bag.svg";
      continue;
    }
    if (!FINAL_CATEGORIES.has(category)) {
      throw new Error(`Unsupported icon category ${category}.`);
    }
    const relativeTarget = documentTarget(category, document);
    const absoluteTarget = path.resolve(iconRoot, ...relativeTarget.split("/"));
    if (!absoluteTarget.startsWith(`${iconRoot}${path.sep}`)) {
      throw new Error(`Unsafe icon destination: ${relativeTarget}`);
    }
    const absoluteSource = sourcePathForIcon(document.img, roots);
    if (!absoluteSource || !(await exists(absoluteSource))) {
      missing.push(`${document.name} (${document._id}): ${document.img}`);
      continue;
    }
    const oldRelative = moduleRelative(document.img);
    if (oldRelative && oldRelative !== relativeTarget) {
      oldModuleSources.add(oldRelative);
    }
    operations.push({
      document,
      absoluteSource,
      absoluteTarget,
      relativeTarget,
    });
  }
  if (missing.length) {
    throw new Error(`Missing icon sources:\n${missing.join("\n")}`);
  }

  const targetSources = new Map();
  for (const operation of operations) {
    const previous = targetSources.get(operation.relativeTarget);
    if (
      previous &&
      path.resolve(previous) !== path.resolve(operation.absoluteSource) &&
      !(await sameFileContent(previous, operation.absoluteSource))
    ) {
      throw new Error(
        `Different icons would overwrite ${operation.relativeTarget}. ` +
          "Rename one source file explicitly before organizing.",
      );
    }
    targetSources.set(operation.relativeTarget, operation.absoluteSource);
  }

  let copied = 0;
  let unchanged = 0;
  for (const operation of operations) {
    await fs.mkdir(path.dirname(operation.absoluteTarget), { recursive: true });
    if (path.resolve(operation.absoluteSource) !== operation.absoluteTarget) {
      if (
        (await exists(operation.absoluteTarget)) &&
        !(await sameFileContent(
          operation.absoluteSource,
          operation.absoluteTarget,
        ))
      ) {
        throw new Error(
          `Icon target already exists with different contents: ` +
            operation.relativeTarget,
        );
      }
      await fs.copyFile(operation.absoluteSource, operation.absoluteTarget);
      copied++;
    } else {
      unchanged++;
    }
    operation.document.img = `${MODULE_ICON_PREFIX}${operation.relativeTarget}`;
  }

  const referenced = new Set(
    operations.map((operation) => operation.relativeTarget),
  );
  let removed = 0;
  for (const relative of oldModuleSources) {
    if (referenced.has(relative)) continue;
    const target = path.resolve(iconRoot, ...relative.split("/"));
    if (target.startsWith(`${iconRoot}${path.sep}`) && (await exists(target))) {
      await fs.rm(target);
      removed++;
    }
  }
  await removeEmptyDirectories(iconRoot);

  synchronizeClassItemIcons(items);
  await Promise.all([
    fs.writeFile(itemsPath, `${JSON.stringify(items, null, 2)}\n`, "utf8"),
    fs.writeFile(macrosPath, `${JSON.stringify(macros, null, 2)}\n`, "utf8"),
  ]);

  const counts = Object.fromEntries(
    [...FINAL_CATEGORIES].map((category) => [
      category,
      operations.filter((operation) =>
        operation.relativeTarget.startsWith(`${category}/`),
      ).length,
    ]),
  );
  return {
    documents: operations.length,
    copied,
    unchanged,
    removed,
    counts,
  };
}
