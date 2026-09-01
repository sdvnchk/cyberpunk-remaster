export const MODULE_ID = "cyberpunk-remaster";
export const CYBERWARE_FLAG_ID = MODULE_ID;
export const REMASTER_MODULE_ID = MODULE_ID;
export const ITEM_PACK_IDS = Object.freeze([`${MODULE_ID}.cyberpunk-items`]);
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
  roleId: "auto",
  name: "",
  level: 3,
  count: 1,
  quality: "standard",
  proficiencyMode: "pwl",
  tier_ac: "auto",
  tier_hp: "auto",
  tier_attack: "auto",
  tier_damage: "auto",
  tier_perception: "auto",
  tier_fortitude: "auto",
  tier_reflex: "auto",
  tier_will: "auto",
  tier_dc: "auto",
  ability_str: "auto",
  ability_str_value: "",
  ability_dex: "auto",
  ability_dex_value: "",
  ability_con: "auto",
  ability_con_value: "",
  ability_int: "auto",
  ability_int_value: "",
  ability_wis: "auto",
  ability_wis_value: "",
  ability_cha: "auto",
  ability_cha_value: "",
  save_fortitude_value: "",
  save_reflex_value: "",
  save_will_value: "",
  skillSelectionMode: "auto",
  chromeIntensity: "standard",
  loadoutIntensity: "standard",
  includePrograms: false,
  sourceCpel: false,
  sourceRemaster: true,
  pktBodyId: "",
  pktModelKey: "",
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
