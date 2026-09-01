export const MODULE_ID = "cyberpunk-remaster";
export const ITEM_PACK_ID = `${MODULE_ID}.cyberpunk-items`;
export const FORGE_FLAG = "forge";
export const FORGE_VERSION = 1;
export const FORGE_FOLDER_NAME = "Cyberpunk — Кузница NPC";
export const FORGE_BACKUP_FOLDER_NAME = "Cyberpunk — Резервные копии Кузницы";

export const DEVICE_TRAITS = Object.freeze({
  generic: {
    slug: "ustroystvo",
    label: "Устройство",
  },
  neural: {
    slug: "ustroystvo-neyro",
    label: "Устройство:Нейро",
  },
  optics: {
    slug: "ustroystvo-optika",
    label: "Устройство:Оптика",
  },
  audio: {
    slug: "ustroystvo-audio",
    label: "Устройство:Аудио",
  },
  arm: {
    slug: "ustroystvo-kiberruka",
    label: "Устройство:Киберрука",
  },
  leg: {
    slug: "ustroystvo-kibernoga",
    label: "Устройство:Кибернога",
  },
  weapon: {
    slug: "ustroystvo-oruzhie",
    label: "Устройство:Оружие",
  },
  armor: {
    slug: "ustroystvo-bronya",
    label: "Устройство:Броня",
  },
});

export const DEVICE_TRAIT_ORDER = Object.freeze([
  "generic",
  "neural",
  "optics",
  "audio",
  "arm",
  "leg",
  "weapon",
  "armor",
]);

export const FORGE_ITEM_TYPES = new Set([
  "action",
  "ammo",
  "armor",
  "backpack",
  "consumable",
  "effect",
  "equipment",
  "melee",
  "shield",
  "spell",
  "spellcastingEntry",
  "treasure",
  "weapon",
]);

export const DEFAULT_FORM = Object.freeze({
  preset: "corporate-patrol",
  name: "",
  level: 3,
  count: 1,
  quality: "standard",
  tier_ac: "auto",
  tier_hp: "auto",
  tier_attack: "auto",
  tier_damage: "auto",
  tier_perception: "auto",
  tier_fortitude: "auto",
  tier_reflex: "auto",
  tier_will: "auto",
  tier_dc: "auto",
  chromeIntensity: "standard",
  loadoutIntensity: "standard",
  includePrograms: false,
  includeConsumables: true,
  target: "new",
  itemPolicy: "generated",
  backupOriginal: true,
  deploymentMode: "none",
  addToCombat: false,
  createBriefing: false,
  sendChatSummary: false,
  openSheet: true,
  randomSeed: "",
});
