import { CyberwareTab } from "../sheets/CyberwareTab.js";
import {
  compatibleAmmo,
  interfaceKeysForEntries,
  itemSeries,
  pickByLevel,
  selectArmor,
  selectCyberwareLoadout,
  selectGear,
  selectPrograms,
  selectWeapon,
} from "./catalog.mjs";
import { randomInt } from "./random.mjs";
import { ammunitionQuantity } from "./statblock-random.mjs";

const GEAR_KEYWORDS = Object.freeze({
  assault: [
    "сыворотка командос",
    "пояс с подсумками",
    "фонарик",
    "агент",
    "трос",
    "буст",
    "адреналин",
  ],
  defender: [
    "аптечка",
    "плацебо",
    "огнетушитель",
    "пояс с подсумками",
    "тяжёлые ботинки",
  ],
  heavy: [
    "пояс с подсумками",
    "тяжёлые ботинки",
    "сыворотка командос",
    "огнетушитель",
  ],
  sniper: ["сыворотка снайпера", "маячок", "солнцезащитные очки", "фонарик"],
  skirmisher: ["набор верхолаза", "трос", "сыворотка лазутчика", "буст"],
  infiltrator: ["набор лазутчика", "отмычки", "сыворотка лазутчика", "маячок"],
  netrunner: ["хакерский набор", "агент", "коммуникатор", "киберсканер"],
  technician: [
    "набор для ремонта",
    "техсканер",
    "химический анализатор",
    "детектор радиации",
  ],
  medic: ["аптечка", "медсканер", "гипоспрей", "дерма-септ", "плацебо"],
  leader: ["агент", "коммуникатор", "микрофон", "портативный усилитель"],
  civilian: [
    "агент",
    "коммуникатор",
    "гигиенический набор",
    "походный набор",
    "фляга",
  ],
  cyberpsycho: ["берсеркер", "чёрное кружево", "адреналин"],
  pkt: ["набор для ремонта", "техсканер", "пояс с подсумками"],
});

function chromeCount(preset, intensity, random) {
  if (intensity === "none") return 0;
  let [minimum, maximum] = preset.chromeRange;
  if (intensity === "light") {
    minimum = Math.max(0, minimum - 1);
    maximum = Math.max(minimum, Math.ceil(maximum / 2));
  } else if (intensity === "heavy") {
    minimum += 1;
    maximum += 2;
  }
  return randomInt(minimum, maximum, random);
}

function gearCount(preset, form, random) {
  if (!form.includeConsumables) return 0;
  let [minimum, maximum] = preset.consumableRange;
  if (form.loadoutIntensity === "minimal") {
    maximum = Math.max(0, maximum - 1);
    minimum = Math.min(minimum, maximum);
  } else if (form.loadoutIntensity === "rich") {
    minimum += 1;
    maximum += 2;
  }
  return randomInt(minimum, maximum, random);
}

function modelLevel(model, catalog) {
  const ids = [
    model.requiredBodyId,
    ...(model.unique ?? []).map((entry) => entry.itemId),
    ...(model.components ?? []).map((entry) => entry.itemId),
  ].filter(Boolean);
  return ids.reduce(
    (maximum, id) => Math.max(maximum, catalog.byId.get(id)?.level ?? 0),
    0,
  );
}

function randomPktSelections(model, random) {
  const selections = {};
  for (const choice of model.choices ?? []) {
    const options = [...(choice.itemIds ?? [])];
    const count = Math.max(1, Number(choice.choose) || 1);
    selections[choice.key] = [];
    while (selections[choice.key].length < count && options.length) {
      const index = Math.floor(random() * options.length);
      selections[choice.key].push(options.splice(index, 1)[0]);
    }
  }
  return selections;
}

async function selectPktLoadout(catalog, level, random) {
  const models = await CyberwareTab.loadPktModels();
  const detailed = models
    .map((model) => ({ model, level: modelLevel(model, catalog) }))
    .sort((left, right) => left.level - right.level);
  const selected = pickByLevel(detailed, level, random, {
    allowUnique: true,
    allowance: 2,
  });
  if (!detailed.length) {
    throw new Error("В журнале не найдено ни одной модели ПКТ.");
  }
  if (!selected) {
    throw new Error(
      `Для ${level}-го уровня нет модели ПКТ допустимого уровня. Повысьте уровень NPC.`,
    );
  }

  const selections = randomPktSelections(selected.model, random);
  const plan = CyberwareTab.pktInstallationPlan(selected.model, selections);
  const biosystem = catalog.cyberware.find((entry) => entry.pktBiosystem);
  const body = catalog.byId.get(selected.model.requiredBodyId);
  if (!biosystem || !body) {
    throw new Error(
      `Для модели «${selected.model.name}» не найдены Биосистема или требуемый корпус.`,
    );
  }
  const components = plan.map((entry) => {
    const source = catalog.byId.get(entry.itemId);
    if (!source) {
      throw new Error(
        `В собственном компендиуме отсутствует компонент ПКТ ${entry.itemId}.`,
      );
    }
    return { ...source, pktPlanEntry: entry };
  });
  return {
    model: selected.model,
    level: selected.level,
    selections,
    plan,
    biosystem,
    body,
    components,
  };
}

function pktModuleParentFamily(entry) {
  const explicit = CyberwareTab.getFlag(entry.document, "pktParentFamily");
  if (typeof explicit === "string" && explicit) return explicit;
  const family = CyberwareTab.getFlag(entry.document, "pktFamily");
  if (typeof family === "string" && family.endsWith("-module")) {
    return family.slice(0, -"-module".length);
  }
  const text = `${entry.name} ${entry.text}`.toLocaleLowerCase("ru-RU");
  if (/нейролинк|нейроинтерфейс|кибердек|разъ[её]м для щепок/iu.test(text)) {
    return "neural-link";
  }
  if (/изображен|оптик|прицел|кибер.?глаз/iu.test(text)) return "cyber-eye";
  if (/аудио|радар|сонар|раци|слух/iu.test(text)) return "cyber-audio";
  if (/рук|мультитул|рукохват|пускатель/iu.test(text)) return "cyber-arm";
  if (/ног|стоп|подошв|гравитац/iu.test(text)) return "cyber-leg";
  return null;
}

function pktCapacityState(pkt) {
  const capacity = new Map();
  const used = new Map();
  for (const component of pkt.components) {
    const plan = component.pktPlanEntry ?? {};
    if (component.implantType === "base" && plan.family) {
      capacity.set(
        plan.family,
        (capacity.get(plan.family) ?? 0) + component.slots,
      );
    } else if (component.implantType === "module" && plan.parentFamily) {
      used.set(
        plan.parentFamily,
        (used.get(plan.parentFamily) ?? 0) + component.slotsUsed,
      );
    }
  }
  return { capacity, used };
}

function typedBonusSignatures(entry) {
  const signatures = new Set();
  for (const rule of entry.document?.system?.rules ?? []) {
    const type = String(rule?.type ?? "untyped");
    if (rule?.key !== "FlatModifier" || type === "untyped") continue;
    const selectors = Array.isArray(rule.selector)
      ? rule.selector
      : [rule.selector];
    for (const selector of selectors.filter(Boolean)) {
      signatures.add(`${type}:${selector}`);
    }
  }
  return signatures;
}

function selectPktExtras(catalog, pkt, level, random, count) {
  if (count <= 0) return [];
  const usedIds = new Set(pkt.components.map((entry) => entry.id));
  const usedSeries = new Set(pkt.components.map(itemSeries));
  const usedExclusiveFamilies = new Set(
    pkt.components
      .map((entry) => CyberwareTab.getExclusiveFamily(entry.document))
      .filter(Boolean),
  );
  let hasNeuralAccelerator = pkt.components.some((entry) =>
    entry.traits.has("neironn-uskoritell"),
  );
  const usedBonuses = new Set(
    pkt.components.flatMap((entry) => [...typedBonusSignatures(entry)]),
  );
  const slots = pktCapacityState(pkt);
  const ignoreSlots = CyberwareTab.getRuleSetting("ignoreSlotLimits") === true;
  const candidates = catalog.cyberware.filter(
    (entry) =>
      entry.pktOnly &&
      !entry.pktBody &&
      !entry.pktBiosystem &&
      !entry.unique &&
      ["module", "internal", "external", "fashion"].includes(
        entry.implantType,
      ) &&
      entry.path.split(" / ").includes("ПКТ Импланты") &&
      !usedIds.has(entry.id),
  );
  const extras = [];

  while (extras.length < count) {
    const available = candidates
      .filter(
        (entry) =>
          !usedIds.has(entry.id) &&
          !usedSeries.has(itemSeries(entry)) &&
          entry.level <= level + 2,
      )
      .map((entry) => ({
        entry,
        parentFamily:
          entry.implantType === "module" ? pktModuleParentFamily(entry) : null,
      }))
      .filter(({ entry, parentFamily }) => {
        const exclusiveFamily = CyberwareTab.getExclusiveFamily(entry.document);
        const allowsMultipleDecks =
          exclusiveFamily === "cyberdeck" &&
          CyberwareTab.getRuleSetting("allowMultipleCyberdecks") === true;
        if (
          exclusiveFamily &&
          !allowsMultipleDecks &&
          usedExclusiveFamilies.has(exclusiveFamily)
        ) {
          return false;
        }
        if (
          entry.traits.has("neironn-uskoritell") &&
          hasNeuralAccelerator &&
          CyberwareTab.getRuleSetting("allowMultipleNeuralAccelerators") !==
            true
        ) {
          return false;
        }
        if (
          [...typedBonusSignatures(entry)].some((bonus) =>
            usedBonuses.has(bonus),
          )
        ) {
          return false;
        }
        if (entry.implantType !== "module") return true;
        if (!parentFamily || !slots.capacity.has(parentFamily)) return false;
        return (
          ignoreSlots ||
          (slots.used.get(parentFamily) ?? 0) + entry.slotsUsed <=
            (slots.capacity.get(parentFamily) ?? 0)
        );
      });
    const selected = pickByLevel(
      available.map(({ entry }) => entry),
      level,
      random,
      { allowance: 2 },
    );
    if (!selected) break;
    const parentFamily =
      available.find(({ entry }) => entry.id === selected.id)?.parentFamily ??
      null;
    const pktPlanEntry = {
      componentKey: `forge-extra-${selected.id}-${extras.length + 1}`,
      itemId: selected.id,
      name: selected.name,
      family:
        CyberwareTab.getFlag(selected.document, "pktFamily") ??
        (parentFamily ? `${parentFamily}-module` : selected.family),
      parentFamily,
      locked: false,
      quantity: 1,
      quantityIndex: 0,
      replaceableBase: false,
      stress: "normal",
    };
    const extra = { ...selected, pktPlanEntry };
    extras.push(extra);
    usedIds.add(selected.id);
    usedSeries.add(itemSeries(selected));
    const exclusiveFamily = CyberwareTab.getExclusiveFamily(selected.document);
    if (exclusiveFamily) usedExclusiveFamilies.add(exclusiveFamily);
    if (selected.traits.has("neironn-uskoritell")) {
      hasNeuralAccelerator = true;
    }
    for (const bonus of typedBonusSignatures(selected)) {
      usedBonuses.add(bonus);
    }
    if (parentFamily) {
      slots.used.set(
        parentFamily,
        (slots.used.get(parentFamily) ?? 0) + selected.slotsUsed,
      );
    }
  }
  return extras;
}

function roleProgramCount(level) {
  if (level < 3) return 3;
  if (level < 7) return 5;
  if (level < 13) return 7;
  return 9;
}

export async function buildLoadout({ catalog, form, preset, role, random }) {
  const warnings = [];
  const selectionOptions = {
    allowUnique: preset.allowUnique,
    allowance: 1,
  };
  const weapon = selectWeapon(
    catalog,
    preset.weaponProfiles,
    form.level,
    random,
    selectionOptions,
  );
  const armor = selectArmor(
    catalog,
    preset.armorProfiles,
    form.level,
    random,
    selectionOptions,
  );
  const ammo = compatibleAmmo(catalog, weapon, form.level, random);
  const ammoQuantity = ammunitionQuantity(ammo, form.loadoutIntensity, random);
  const gear = selectGear(catalog, form.level, random, {
    count: gearCount(preset, form, random),
    keywords: GEAR_KEYWORDS[role.id] ?? [],
    allowUnique: preset.allowUnique,
  });
  const desiredChrome = chromeCount(preset, form.chromeIntensity, random);
  const cyberware = preset.pkt
    ? []
    : selectCyberwareLoadout(catalog, {
        level: form.level,
        random,
        count: desiredChrome,
        families: preset.implantFamilies,
        moduleChance: preset.moduleChance,
        allowUnique: preset.allowUnique,
      });
  const programs =
    form.includePrograms && role.id === "netrunner"
      ? selectPrograms(catalog, form.level, random, {
          count: roleProgramCount(form.level),
        })
      : [];
  const pkt = preset.pkt
    ? await selectPktLoadout(catalog, form.level, random)
    : null;
  if (pkt) {
    pkt.extras = selectPktExtras(
      catalog,
      pkt,
      form.level,
      random,
      desiredChrome,
    );
    pkt.components.push(...pkt.extras);
    pkt.plan.push(...pkt.extras.map((entry) => entry.pktPlanEntry));
  }

  if (!weapon) warnings.push("В библиотеке не найдено подходящее оружие.");
  if (
    !armor &&
    !preset.armorProfiles.includes("none") &&
    form.loadoutIntensity !== "minimal"
  ) {
    warnings.push("В библиотеке не найдена подходящая броня.");
  }
  if (role.id === "netrunner" && !programs.length) {
    warnings.push("В библиотеке не найдены программы допустимого ранга.");
  }

  const entries = [
    weapon,
    armor,
    ammo,
    ammoQuantity,
    ...gear,
    ...cyberware,
    ...(pkt ? [pkt.biosystem, pkt.body, ...pkt.components] : []),
  ].filter(Boolean);
  const interfaceKeys = interfaceKeysForEntries(entries);

  return {
    weapon,
    armor,
    ammo,
    gear,
    cyberware,
    programs,
    pkt,
    entries,
    interfaceKeys,
    warnings,
  };
}

export function loadoutPreview(loadout) {
  const row = (label, values) => ({
    label,
    value: values.filter(Boolean).join(", ") || "—",
  });
  return [
    row("Оружие", [
      loadout.weapon?.name,
      loadout.secondaryWeapon?.name
        ? `запасное: ${loadout.secondaryWeapon.name}`
        : null,
    ]),
    row("Броня", [loadout.armor?.name]),
    row("Боеприпасы", [
      loadout.ammo ? `${loadout.ammo.name} × ${loadout.ammoQuantity}` : null,
    ]),
    row(
      "Предметы",
      loadout.gear.map((entry) => entry.name),
    ),
    row(
      "Хром",
      loadout.cyberware.map((entry) => entry.name),
    ),
    row(
      "ПКТ",
      loadout.pkt
        ? [
            loadout.pkt.model.name,
            `${
              loadout.pkt.components.length - (loadout.pkt.extras?.length ?? 0)
            } компонентов модели`,
            loadout.pkt.extras?.length
              ? `дополнительно: ${loadout.pkt.extras
                  .map((entry) => entry.name)
                  .join(", ")}`
              : null,
          ]
        : [],
    ),
    row(
      "Программы",
      loadout.programs.map((entry) => entry.name),
    ),
  ];
}

export function pickSecondaryWeapon(catalog, loadout, preset, form, random) {
  if (form.loadoutIntensity !== "rich" || random() >= 0.45 || !loadout.weapon) {
    return null;
  }
  const candidates = catalog.weapons.filter(
    (entry) =>
      entry.id !== loadout.weapon.id &&
      itemSeries(entry) !== itemSeries(loadout.weapon) &&
      entry.level <= form.level + 1 &&
      (entry.weaponProfiles.includes("pistol") ||
        entry.weaponProfiles.includes("melee") ||
        entry.weaponProfiles.includes("concealable")),
  );
  return pickByLevel(candidates, form.level, random, {
    allowUnique: preset.allowUnique,
  });
}
