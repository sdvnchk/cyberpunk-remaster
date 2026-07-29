import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleId = JSON.parse(
  await fs.readFile(path.join(root, "module.json"), "utf8"),
).id;
const modulePrefix = `modules/${moduleId}/assets/icons/`;
const iconRoot = path.join(root, "assets", "icons");
const defaultInstallation = path.resolve(
  "D:/Workspaces/FoundryVTT_StarFinder_v14.361/Data/modules",
  moduleId,
);
const sourceModuleRoot = path.resolve(
  process.env.FOUNDRY_MODULE_PATH ||
    process.env.SOURCE_MODULE_ROOT ||
    defaultInstallation,
);
const dataRoot = path.resolve(
  process.env.FOUNDRY_DATA_PATH ||
    path.resolve(sourceModuleRoot, "..", ".."),
);
const appRoot = path.resolve(
  process.env.FOUNDRY_APP_PATH ||
    path.resolve(dataRoot, "..", "App"),
);
const generatedName = /--[A-Za-z0-9]{16}\.[^.]+$/;
const manualNames = new Map([
  ["UMAXLDpI6YLSfYX1", "smash.svg"],
  ["PUndFr3bl7IaQgVa", "piranha-smash.svg"],
]);

function collectDocuments(items, macros) {
  const result = [];
  const add = (document) => {
    result.push(document);
    for (const subitem of document.system?.subitems ?? []) add(subitem);
  };
  for (const item of items) add(item);
  for (const macro of macros) add(macro);
  return result;
}

async function walk(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const result = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}

async function digest(file) {
  return crypto
    .createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
}

function relativeIcon(icon) {
  const normalized = String(icon ?? "").replaceAll("\\", "/");
  return normalized.startsWith(modulePrefix)
    ? normalized.slice(modulePrefix.length)
    : null;
}

const itemsPath = path.join(root, "items-export.json");
const macrosPath = path.join(root, "macros-export.json");
const [items, macros] = await Promise.all([
  fs.readFile(itemsPath, "utf8").then(JSON.parse),
  fs.readFile(macrosPath, "utf8").then(JSON.parse),
]);
const documents = collectDocuments(items, macros);
const documentsByRelative = new Map();
for (const document of documents) {
  const relative = relativeIcon(document.img);
  if (!relative) continue;
  const values = documentsByRelative.get(relative) ?? [];
  values.push(document);
  documentsByRelative.set(relative, values);
}

const referenced = [];
const wantedDigests = new Set();
for (const [relative, values] of documentsByRelative) {
  const source = path.join(iconRoot, ...relative.split("/"));
  const hash = await digest(source);
  referenced.push({ relative, values, source, hash });
  wantedDigests.add(hash);
}

const candidateRoots = [
  iconRoot,
  path.join(dataRoot, "assets", "icons"),
  path.join(appRoot, "resources", "app", "public", "icons"),
  path.join(dataRoot, "systems"),
  path.join(dataRoot, "worlds"),
];
const namesByDigest = new Map(
  [...wantedDigests].map((hash) => [hash, new Set()]),
);
for (const candidateRoot of candidateRoots) {
  for (const file of await walk(candidateRoot)) {
    const filename = path.basename(file);
    if (generatedName.test(filename)) continue;
    const hash = await digest(file);
    if (namesByDigest.has(hash)) namesByDigest.get(hash).add(filename);
  }
}

const operations = [];
for (const entry of referenced) {
  const explicitNames = [
    ...new Set(
      entry.values
        .map((document) => manualNames.get(document._id))
        .filter(Boolean),
    ),
  ];
  const candidates = [...(namesByDigest.get(entry.hash) ?? [])];
  let filename;
  if (explicitNames.length === 1) {
    filename = explicitNames[0];
  } else if (explicitNames.length > 1) {
    throw new Error(
      `Conflicting explicit filenames for ${entry.relative}: ` +
        explicitNames.join(", "),
    );
  } else if (candidates.length === 1) {
    filename = candidates[0];
  } else if (candidates.length === 0) {
    // A newly authored icon may have no older copy. Its current name is
    // already the original name and must remain unchanged.
    filename = path.posix.basename(entry.relative);
  } else {
    throw new Error(
      `Several original filenames match ${entry.relative}: ` +
        candidates.join(", "),
    );
  }
  const currentCategory = entry.relative.split("/")[0];
  const category = currentCategory === "pkt" ? "implants" : currentCategory;
  operations.push({
    ...entry,
    targetRelative: `${category}/${filename}`,
  });
}

const pktDirectory = path.join(iconRoot, "pkt");
for (const source of await walk(pktDirectory)) {
  const relative = path.relative(iconRoot, source).replaceAll("\\", "/");
  if (operations.some((operation) => operation.relative === relative)) {
    continue;
  }
  operations.push({
    relative,
    values: [],
    source,
    hash: await digest(source),
    targetRelative: `implants/${path.basename(source)}`,
  });
}

const targetGroups = new Map();
for (const operation of operations) {
  const values = targetGroups.get(operation.targetRelative) ?? [];
  values.push(operation);
  targetGroups.set(operation.targetRelative, values);
}
for (const [targetRelative, values] of targetGroups) {
  const hashes = new Set(values.map((operation) => operation.hash));
  if (hashes.size > 1) {
    throw new Error(
      `Different icons would overwrite ${targetRelative}: ` +
        values.map((operation) => operation.relative).join(", "),
    );
  }
}

let copied = 0;
for (const [targetRelative, values] of targetGroups) {
  const source = values[0].source;
  const target = path.join(iconRoot, ...targetRelative.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  let targetHash = null;
  try {
    targetHash = await digest(target);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (targetHash && targetHash !== values[0].hash) {
    throw new Error(
      `Target ${targetRelative} already exists with different contents.`,
    );
  }
  if (!targetHash) {
    await fs.copyFile(source, target);
    copied++;
  }
}

for (const operation of operations) {
  for (const document of operation.values) {
    document.img = `${modulePrefix}${operation.targetRelative}`;
  }
}
const itemById = new Map(items.map((item) => [item._id, item]));
for (const classItem of items.filter((item) => item.type === "class")) {
  for (const grant of Object.values(classItem.system?.items ?? {})) {
    const targetId = String(grant.uuid ?? "").split(".").at(-1);
    const target = itemById.get(targetId);
    if (!target) continue;
    grant.name = target.name;
    grant.img = target.img;
  }
}
await Promise.all([
  fs.writeFile(itemsPath, `${JSON.stringify(items, null, 2)}\n`, "utf8"),
  fs.writeFile(macrosPath, `${JSON.stringify(macros, null, 2)}\n`, "utf8"),
]);

const targets = new Set(
  operations.map((operation) => operation.targetRelative),
);
let removed = 0;
for (const operation of operations) {
  if (
    operation.relative === operation.targetRelative ||
    targets.has(operation.relative)
  ) {
    continue;
  }
  try {
    await fs.rm(operation.source);
    removed++;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
try {
  await fs.rmdir(pktDirectory);
} catch (error) {
  if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
}

console.log(
  `Restored ${referenced.length} document icon names; ` +
    `${copied} files copied, ${removed} renamed sources removed.`,
);
