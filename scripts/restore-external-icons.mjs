import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePrefix = "modules/cyberpunk-remaster/assets/icons/";
const foundryRoot = path.resolve(
  process.env.FOUNDRY_INSTALLATION_ROOT ??
    "D:/Workspaces/FoundryVTT_StarFinder_v14.361",
);

const mappings = new Map([
  ["abilities/FreeAction.webp", "systems/sf2e/icons/actions/FreeAction.webp"],
  ["abilities/item-bag.svg", "icons/svg/item-bag.svg"],
  ["abilities/OneAction.webp", "systems/sf2e/icons/actions/OneAction.webp"],
  ["abilities/Passive.webp", "systems/sf2e/icons/actions/Passive.webp"],
  ["abilities/Reaction.webp", "systems/sf2e/icons/actions/Reaction.webp"],
  [
    "ammo/blue-battery.webp",
    "systems/sf2e/icons/equipment/other/blue-battery.webp",
  ],
  [
    "ammo/blue-containment-vessel.webp",
    "systems/sf2e/icons/equipment/other/blue-containment-vessel.webp",
  ],
  [
    "ammo/green-battery.webp",
    "systems/sf2e/icons/equipment/other/green-battery.webp",
  ],
  [
    "ammo/yellow-battery.webp",
    "systems/sf2e/icons/equipment/other/yellow-battery.webp",
  ],
  [
    "ammo/yellow-containment-vessel.webp",
    "systems/sf2e/icons/equipment/other/yellow-containment-vessel.webp",
  ],
  [
    "consumables/syringe.webp",
    "systems/sf2e/icons/equipment/other/syringe.webp",
  ],
  [
    "programs/air-burst-spiral-large-pink.webp",
    "icons/magic/air/air-burst-spiral-large-pink.webp",
  ],
  [
    "programs/blue-circuit-board.webp",
    "systems/sf2e/icons/abilities/blue-circuit-board.webp",
  ],
  [
    "programs/blue-comet.webp",
    "systems/sf2e/icons/abilities/blue-comet.webp",
  ],
  ["programs/blur.webp", "systems/sf2e/icons/spells/blur.webp"],
  [
    "programs/comprehend-language.webp",
    "systems/sf2e/icons/spells/comprehend-language.webp",
  ],
  [
    "programs/construct-stone-earth-gray.webp",
    "icons/creatures/magical/construct-stone-earth-gray.webp",
  ],
  ["programs/darkness.webp", "systems/sf2e/icons/spells/darkness.webp"],
  [
    "programs/dispel-magic.webp",
    "systems/sf2e/icons/spells/dispel-magic.webp",
  ],
  [
    "programs/endure-elements.webp",
    "systems/sf2e/icons/spells/endure-elements.webp",
  ],
  [
    "programs/etheral-jaunt.webp",
    "systems/sf2e/icons/spells/etheral-jaunt.webp",
  ],
  [
    "programs/feeblemind.webp",
    "systems/sf2e/icons/spells/feeblemind.webp",
  ],
  [
    "programs/magic-mouth.webp",
    "systems/sf2e/icons/spells/magic-mouth.webp",
  ],
  [
    "programs/orb-eye-scrying.webp",
    "icons/magic/perception/orb-eye-scrying.webp",
  ],
  ["programs/orb-vortex.webp", "icons/magic/fire/orb-vortex.webp"],
  [
    "programs/purple-tentacle.webp",
    "systems/sf2e/icons/abilities/purple-tentacle.webp",
  ],
  [
    "programs/see-invisibility.webp",
    "systems/sf2e/icons/spells/see-invisibility.webp",
  ],
  [
    "programs/shield-damaged-broken-gold.webp",
    "icons/skills/melee/shield-damaged-broken-gold.webp",
  ],
  ["programs/silence.webp", "systems/sf2e/icons/spells/silence.webp"],
  [
    "programs/unarmed-punch-fist-blue.webp",
    "icons/skills/melee/unarmed-punch-fist-blue.webp",
  ],
  [
    "programs/wolf-heads-swirl-purple.webp",
    "icons/creatures/abilities/wolf-heads-swirl-purple.webp",
  ],
  [
    "programs/yellow-person-silhouette.webp",
    "systems/sf2e/icons/abilities/yellow-person-silhouette.webp",
  ],
  [
    "programs/yellow-warning-sign.webp",
    "systems/sf2e/icons/abilities/yellow-warning-sign.webp",
  ],
  ["special/dice-target.svg", "icons/svg/dice-target.svg"],
  [
    "weapons/grenade-canister.webp",
    "systems/sf2e/icons/equipment/weapons/grenade-canister.webp",
  ],
  [
    "weapons/grenade-chemical.webp",
    "systems/sf2e/icons/equipment/weapons/grenade-chemical.webp",
  ],
  [
    "weapons/grenade-hand.webp",
    "systems/sf2e/icons/equipment/weapons/grenade-hand.webp",
  ],
  [
    "weapons/grenade-launcher.webp",
    "systems/sf2e/icons/equipment/weapons/grenade-launcher.webp",
  ],
  [
    "weapons/grenade-stick.webp",
    "systems/sf2e/icons/equipment/weapons/grenade-stick.webp",
  ],
  [
    "weapons/grenade.webp",
    "systems/sf2e/icons/equipment/weapons/grenade.webp",
  ],
]);

const jsonPaths = [
  "items-export.json",
  "journals-export.json",
  "macros-export.json",
  "data/pkt-models.json",
  "data/pkt-components.json",
];

function externalFile(uri) {
  const parts = uri.split("/");
  if (uri.startsWith("icons/")) {
    return path.join(
      foundryRoot,
      "App",
      "resources",
      "app",
      "public",
      ...parts,
    );
  }
  return path.join(foundryRoot, "Data", ...parts);
}

const sha256 = async (file) =>
  crypto
    .createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");

const exists = (file) =>
  fs.access(file).then(() => true).catch(() => false);

const verified = new Map();
for (const [relative, externalUri] of mappings) {
  const moduleFile = path.join(root, "assets", "icons", ...relative.split("/"));
  const sourceFile = externalFile(externalUri);
  await fs.access(sourceFile);
  if (await exists(moduleFile)) {
    const [moduleHash, sourceHash] = await Promise.all([
      sha256(moduleFile),
      sha256(sourceFile),
    ]);
    if (moduleHash !== sourceHash) {
      throw new Error(
        `Refusing to replace customized icon ${relative}: contents differ ` +
          `from ${externalUri}.`,
      );
    }
  }
  verified.set(`${modulePrefix}${relative}`, externalUri);
}

function restoreStrings(value, counters) {
  if (typeof value === "string") {
    let result = value;
    for (const [moduleUri, externalUri] of verified) {
      if (!result.includes(moduleUri)) continue;
      const matches = result.split(moduleUri).length - 1;
      counters.references += matches;
      result = result.replaceAll(moduleUri, externalUri);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => restoreStrings(entry, counters));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        restoreStrings(entry, counters),
      ]),
    );
  }
  return value;
}

const counters = { references: 0, files: 0 };
for (const relativePath of jsonPaths) {
  const target = path.join(root, relativePath);
  const current = JSON.parse(await fs.readFile(target, "utf8"));
  const restored = restoreStrings(current, counters);
  await fs.writeFile(
    target,
    `${JSON.stringify(restored, null, 2)}\n`,
    "utf8",
  );
}

const serialized = (
  await Promise.all(
    jsonPaths.map((relativePath) =>
      fs.readFile(path.join(root, relativePath), "utf8")
    ),
  )
).join("\n");
for (const [relative] of mappings) {
  const moduleUri = `${modulePrefix}${relative}`;
  if (serialized.includes(moduleUri)) {
    throw new Error(`Icon is still referenced after restoration: ${moduleUri}`);
  }
  const target = path.join(root, "assets", "icons", ...relative.split("/"));
  if (await exists(target)) {
    await fs.rm(target);
    counters.files++;
  }
}

console.log(
  `Restored ${counters.references} external icon references and removed ` +
    `${counters.files} byte-identical module copies.`,
);
