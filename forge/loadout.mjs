import { CyberwareTab } from "../sheets/CyberwareTab.js";
import {
  catalogResolveEntry,
  compatibleAmmo,
  interfaceKeysForEntries,
  itemSeries,
  pickByLevel,
  selectArmor,
  selectCyberwareLoadout,
  pickNarrativeCyberwareByLevel,
  cyberwareNarrativeScore,
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
  pointman: ["тактичес", "фонарик", "аптечка", "пояс с подсумками", "скан"],
  gunfighter: ["пояс с подсумками", "агент", "коммуникатор", "фонарик"],
  breacher: ["набор для ремонта", "взрыв", "трос", "фонарик", "аптечка"],
  bodyguard: ["аптечка", "коммуникатор", "агент", "скан", "защит"],
  scout: ["маячок", "трос", "фонарик", "скан", "набор верхолаза"],
  controller: ["наруч", "аптечка", "фонарик", "коммуникатор", "шок"],
  suppressor: ["пояс с подсумками", "тяжёлые ботинки", "огнетушитель", "аптечка"],
  saboteur: ["отмычки", "набор для ремонта", "техсканер", "трос", "детектор"],
  hunter: ["маячок", "скан", "фонарик", "трос", "сыворотка снайпера"],
  interrogator: ["агент", "коммуникатор", "скан", "идентиф"],
  commando: ["пояс с подсумками", "аптечка", "трос", "фонарик", "коммуникатор"],
  support: ["аптечка", "техсканер", "коммуникатор", "набор для ремонта", "агент"],
  merchant: ["агент", "коммуникатор", "контракт", "идентификатор", "сканер", "деловой"],
  driver: ["навига", "ремонт", "коммуникатор", "маячок", "фонарик", "трос"],
  laborer: ["набор для ремонта", "инструмент", "фонарик", "аптечка", "защит"],
  service: ["агент", "коммуникатор", "микрофон", "гигиен", "идентификатор"],
  clerk: ["агент", "коммуникатор", "идентификатор", "документ", "сканер"],
  forensic: ["криминал", "анализатор", "сканер", "камера", "аптечка", "идентификатор"],
  demolitions: ["взрыв", "детон", "набор для ремонта", "техсканер", "детектор", "аптечка"],
  droneOperator: ["дрон", "коммуникатор", "техсканер", "набор для ремонта", "маячок"],
  cyberpsycho: ["берсеркер", "чёрное кружево", "адреналин"],
  pkt: ["набор для ремонта", "техсканер", "пояс с подсумками"],
});

function chromeCount(preset, intensity, random, level = 0) {
  if (intensity === "none") return 0;
  const [baseMin, baseMax] = preset.chromeRange;
  const levelBonus = Math.max(0, Math.min(4, Math.floor(Math.max(0, level) / 5)));
  const civilian = preset.group === "civilian";
  let minimum;
  let maximum;
  let cap;

  // v1.4.24: all three chrome-density modes now create visibly different,
  // substantially fuller bodies.  The preset range still matters, but it no
  // longer keeps high-level NPCs at only a handful of implants.  Category
  // limits (7/7/7 without PKT) are enforced separately by the selector.
  if (intensity === "light") {
    // «Мало» должно оставаться лёгким режимом, но не выглядеть пустым на
    // высокоуровневом NPC. Каждые ~10 уровней добавляют ещё один гарантированный
    // элемент хрома, при этом режим всё равно заметно беднее standard/heavy.
    const lightLevelFloor = Math.floor(levelBonus / 2);
    minimum = Math.max(
      (civilian ? 2 : 3) + lightLevelFloor,
      baseMin + 1 + lightLevelFloor,
    );
    maximum = Math.max(minimum + 2, baseMax + 4 + lightLevelFloor);
    cap = (civilian ? 4 : 5) + levelBonus;
  } else if (intensity === "heavy") {
    minimum = Math.max(civilian ? 6 : 9, baseMin + 6 + levelBonus);
    maximum = Math.max(minimum + 4, baseMax + 11 + levelBonus * 2);
    cap = (civilian ? 9 : 12) + (civilian ? 2 : 3) * levelBonus;
  } else {
    minimum = Math.max(civilian ? 4 : 5, baseMin + 3 + levelBonus);
    maximum = Math.max(minimum + 3, baseMax + 7 + levelBonus);
    cap = (civilian ? 6 : 8) + 2 * levelBonus;
  }

  maximum = Math.max(minimum, Math.min(maximum, cap));
  minimum = Math.min(minimum, maximum);
  return randomInt(minimum, maximum, random);
}

function gearCount(preset, form, random) {
  if (!form.includeConsumables) return 0;
  let [minimum, maximum] = preset.consumableRange;
  if (form.loadoutIntensity === "minimal") {
    maximum = Math.max(0, maximum - 1);
    minimum = Math.min(minimum, maximum);
  } else if (form.loadoutIntensity === "rich") {
    // Rich inventory should be visibly different from standard: more tools,
    // mission gear and personal equipment rather than a +1 cosmetic bump.
    minimum += 3;
    maximum += 6;
  }
  return randomInt(minimum, maximum, random);
}


function itemLevelAllowance(level, intensity, random, { chrome = false } = {}) {
  const capped = Math.max(0, Math.min(4, 20 - Math.max(0, Number(level) || 0)));
  if (capped <= 0) return 0;
  const mode = chrome ? intensity : intensity;
  const roll = random();
  const thresholds =
    mode === "rich" || mode === "heavy"
      ? [0.16, 0.38, 0.62, 0.82]
      : mode === "minimal" || mode === "light"
        ? [0.55, 0.78, 0.91, 0.98]
        : [0.32, 0.58, 0.78, 0.92];
  let allowance =
    roll < thresholds[0]
      ? 0
      : roll < thresholds[1]
        ? 1
        : roll < thresholds[2]
          ? 2
          : roll < thresholds[3]
            ? 3
            : 4;
  return Math.min(capped, allowance);
}

function normalizeCatalogName(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[«»„“”"']/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function catalogEntryFor(catalog, itemId, name = "") {
  return catalogResolveEntry(catalog, itemId, name);
}

function resolvePktModelForCatalog(model, catalog) {
  const body = catalogEntryFor(catalog, model.requiredBodyId, model.requiredBodyName ?? model.bodyName ?? "");
  if (!body) return null;
  const resolved = structuredClone(model);
  resolved.requiredBodyId = body.id;
  resolved.requiredBodyName = body.name;
  for (const listName of ["unique", "components"]) {
    for (const entry of resolved[listName] ?? []) {
      const source = catalogEntryFor(catalog, entry.itemId, entry.name ?? entry.label ?? "");
      if (!source) return null;
      entry.itemId = source.id;
      entry.name = source.name;
    }
  }
  for (const choice of resolved.choices ?? []) {
    const resolvedIds = [];
    const resolvedOptions = [];
    const sourceOptions = choice.options ?? [];
    for (const [index, itemId] of (choice.itemIds ?? []).entries()) {
      const hint = sourceOptions[index]?.name ?? sourceOptions.find((entry) => entry.itemId === itemId)?.name ?? "";
      const source = catalogEntryFor(catalog, itemId, hint);
      if (!source || resolvedIds.includes(source.id)) continue;
      resolvedIds.push(source.id);
      resolvedOptions.push({ itemId: source.id, name: source.name, img: source.img });
    }
    if (resolvedIds.length < Math.max(1, Number(choice.choose) || 1)) return null;
    choice.itemIds = resolvedIds;
    choice.options = resolvedOptions;
  }
  return resolved;
}

function modelLevel(model, catalog) {
  const entries = [
    catalogEntryFor(catalog, model.requiredBodyId, model.requiredBodyName ?? ""),
    ...(model.unique ?? []).map((entry) => catalogEntryFor(catalog, entry.itemId, entry.name ?? entry.label ?? "")),
    ...(model.components ?? []).map((entry) => catalogEntryFor(catalog, entry.itemId, entry.name ?? entry.label ?? "")),
  ].filter(Boolean);
  return entries.reduce((maximum, entry) => Math.max(maximum, entry.level ?? 0), 0);
}

function pktModelAvailable(model, catalog) {
  return Boolean(resolvePktModelForCatalog(model, catalog));
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

function validatePktPlanCapacity(plan, catalog, {
  internalLimit = 14,
  externalLimit = 14,
  fashionLimit = 7,
} = {}) {
  const limits = { internal: internalLimit, external: externalLimit, fashion: fashionLimit };
  const counts = { internal: 0, external: 0, fashion: 0 };
  const basesByFamily = new Map();

  for (const entry of plan ?? []) {
    const source = catalogEntryFor(catalog, entry.itemId, entry.name ?? entry.label ?? "");
    if (!source) return { valid: false, reason: `Не найден компонент «${entry.name ?? entry.itemId}».` };
    if (Object.hasOwn(limits, source.implantType)) {
      counts[source.implantType] += 1;
      if (counts[source.implantType] > limits[source.implantType]) {
        return {
          valid: false,
          reason: `Превышен лимит ${source.implantType}: ${counts[source.implantType]}/${limits[source.implantType]}.`,
        };
      }
    }
    if (source.implantType !== "base") continue;
    const family = entry.family ?? CyberwareTab.getFlag(source.document, "pktFamily");
    if (!family) continue;
    const bases = basesByFamily.get(family) ?? [];
    bases.push({ capacity: Math.max(0, Number(source.slots ?? 0)), used: 0 });
    basesByFamily.set(family, bases);
  }

  const nextBaseByFamily = new Map();
  for (const entry of plan ?? []) {
    if (!entry.parentFamily) continue;
    const source = catalogEntryFor(catalog, entry.itemId, entry.name ?? entry.label ?? "");
    if (!source || source.implantType !== "module") continue;
    const bases = basesByFamily.get(entry.parentFamily) ?? [];
    if (!bases.length) {
      return { valid: false, reason: `Нет базы семейства ${entry.parentFamily} для «${source.name}».` };
    }
    const slots = Math.max(0, Number(source.slotsUsed ?? 0));
    const startIndex = nextBaseByFamily.get(entry.parentFamily) ?? 0;
    let chosen = null;
    for (let offset = 0; offset < bases.length; offset += 1) {
      const index = (startIndex + offset) % bases.length;
      const base = bases[index];
      if (base.used + slots <= base.capacity) {
        chosen = { base, index };
        break;
      }
    }
    if (!chosen) {
      return {
        valid: false,
        reason: `В базах семейства ${entry.parentFamily} не хватает слотов для «${source.name}».`,
      };
    }
    chosen.base.used += slots;
    nextBaseByFamily.set(entry.parentFamily, (chosen.index + 1) % bases.length);
  }
  return { valid: true, counts, basesByFamily };
}

function sampledPktPlan(candidate, catalog, random, attempts = 12) {
  let lastReason = "";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const selections = randomPktSelections(candidate.model, random);
    const plan = CyberwareTab.pktInstallationPlan(candidate.model, selections);
    const validation = validatePktPlanCapacity(plan, catalog);
    if (validation.valid) return { ...candidate, selections, plan };
    lastReason = validation.reason;
  }
  return { ...candidate, invalidReason: lastReason || "Комплектация не помещается в базы ПКТ." };
}

async function selectPktLoadout(
  catalog,
  level,
  random,
  preferredKey = "random",
  preferredBodyId = "random",
  levelAllowance = 2,
) {
  let models = [];
  try {
    models = await CyberwareTab.loadPktModels();
  } catch (error) {
    console.warn("Киберпанк-Кузница NPC | Structured PKT models unavailable; using body catalog fallback", error);
  }
  let detailed = models
    .map((model) => resolvePktModelForCatalog(model, catalog))
    .filter(Boolean)
    .map((model) => ({ model, level: modelLevel(model, catalog) }))
    .sort((left, right) => left.level - right.level);

  let explicitBody =
    preferredBodyId && preferredBodyId !== "random"
      ? catalog.byId.get(preferredBodyId) ?? null
      : null;
  if (preferredBodyId && preferredBodyId !== "random" && !explicitBody) {
    try {
      const pktContent = await CyberwareTab.loadPktContent();
      const selectedBody = (pktContent.bodies ?? []).find(
        (body) => body.itemId === preferredBodyId,
      );
      if (selectedBody) {
        explicitBody = catalogEntryFor(catalog, preferredBodyId, selectedBody.name);
      }
    } catch {
      // The structured catalog is optional here; the main catalog may still resolve the body.
    }
  }
  if (preferredBodyId && preferredBodyId !== "random" && !explicitBody) {
    throw new Error(`Не найдена выбранная ПКТ-конверсия «${preferredBodyId}».`);
  }
  if (explicitBody) {
    detailed = detailed.filter(({ model }) => model.requiredBodyId === explicitBody.id);
  }

  if (!detailed.length) {
    throw new Error("В выбранных источниках не найдено ни одной полной модели ПКТ. Включите Cyberpunk Equipment Library и/или Cyberpunk Remaster.");
  }

  let selected = null;
  if (preferredKey && preferredKey !== "random") {
    const candidate = detailed.find(({ model }) => model.key === preferredKey) ?? null;
    if (!candidate) {
      if (explicitBody) {
        throw new Error(
          `Модель ПКТ «${preferredKey}» несовместима с выбранной конверсией «${explicitBody.name}» или отсутствует в активных источниках.`,
        );
      }
      throw new Error(`Не найдена выбранная модель ПКТ «${preferredKey}».`);
    }
    if (candidate.level > level + levelAllowance) {
      throw new Error(
        `Модель ПКТ «${candidate.model.name}» рассчитана примерно на ${candidate.level}-й уровень. Для этого NPC допустимо не выше ${level + levelAllowance}.`,
      );
    }
    const sampled = sampledPktPlan(candidate, catalog, random, 24);
    if (!sampled.plan) {
      throw new Error(`Модель ПКТ «${candidate.model.name}» не проходит проверку Capacity: ${sampled.invalidReason}`);
    }
    selected = sampled;
  } else {
    const viable = detailed
      .filter((candidate) => candidate.level <= level + levelAllowance)
      .map((candidate) => sampledPktPlan(candidate, catalog, random, 12))
      .filter((candidate) => candidate.plan);
    selected = pickByLevel(viable, level, random, {
      allowUnique: true,
      allowance: levelAllowance,
    });
  }
  if (!selected) {
    throw new Error(`Для ${level}-го уровня нет модели ПКТ допустимого уровня и Capacity.`);
  }

  const { selections, plan } = selected;
  const biosystem = catalog.cyberware.find((entry) => entry.pktBiosystem);
  const body = catalogEntryFor(catalog, selected.model.requiredBodyId, selected.model.requiredBodyName ?? "");
  if (!biosystem || !body) {
    throw new Error(`Для модели «${selected.model.name}» не найдены Биосистема или её корпус.`);
  }
  const components = plan.map((entry) => {
    const source = catalogEntryFor(catalog, entry.itemId, entry.name ?? entry.label ?? "");
    if (!source) throw new Error(`В активном каталоге отсутствует компонент ПКТ «${entry.name ?? entry.itemId}».`);
    return { ...source, pktPlanEntry: { ...entry, itemId: source.id } };
  });
  return { model: selected.model, level: selected.level, selections, plan, biosystem, body, components };
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

function reservePktModuleSlot(state, parentFamily, slots, { commit = true } = {}) {
  const bases = state.basesByFamily.get(parentFamily) ?? [];
  if (!bases.length) return null;
  const start = state.nextBaseByFamily.get(parentFamily) ?? 0;
  for (let offset = 0; offset < bases.length; offset += 1) {
    const index = (start + offset) % bases.length;
    const candidate = bases[index];
    if (candidate.used + slots > candidate.capacity) continue;
    if (commit) {
      candidate.used += slots;
      state.nextBaseByFamily.set(parentFamily, (index + 1) % bases.length);
    }
    return { candidate, index };
  }
  return null;
}

function pktCapacityState(pkt) {
  const state = { basesByFamily: new Map(), nextBaseByFamily: new Map() };
  for (const component of pkt.components) {
    const plan = component.pktPlanEntry ?? {};
    if (component.implantType !== "base" || !plan.family) continue;
    const bases = state.basesByFamily.get(plan.family) ?? [];
    bases.push({ capacity: Math.max(0, Number(component.slots ?? 0)), used: 0 });
    state.basesByFamily.set(plan.family, bases);
  }
  for (const component of pkt.components) {
    const plan = component.pktPlanEntry ?? {};
    if (component.implantType !== "module" || !plan.parentFamily) continue;
    reservePktModuleSlot(
      state,
      plan.parentFamily,
      Math.max(0, Number(component.slotsUsed ?? 0)),
      { commit: true },
    );
  }
  return state;
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

function selectPktExtras(
  catalog,
  pkt,
  level,
  random,
  count,
  narrativeContext = {},
  levelAllowance = 2,
) {
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
  const categoryLimits = { internal: 14, external: 14, fashion: 7 };
  const categoryCounts = { internal: 0, external: 0, fashion: 0 };
  for (const entry of pkt.components) {
    if (Object.hasOwn(categoryCounts, entry.implantType)) {
      categoryCounts[entry.implantType] += 1;
    }
  }
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
      !usedIds.has(entry.id) &&
      cyberwareNarrativeScore(entry, narrativeContext) > -70,
  );
  const extras = [];

  while (extras.length < count) {
    const available = candidates
      .filter(
        (entry) =>
          !usedIds.has(entry.id) &&
          !usedSeries.has(itemSeries(entry)) &&
          entry.level <= level + levelAllowance &&
          (!Object.hasOwn(categoryLimits, entry.implantType) ||
            categoryCounts[entry.implantType] < categoryLimits[entry.implantType]),
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
        if (!parentFamily || !slots.basesByFamily.has(parentFamily)) return false;
        return (
          ignoreSlots ||
          Boolean(
            reservePktModuleSlot(
              slots,
              parentFamily,
              Math.max(0, Number(entry.slotsUsed ?? 0)),
              { commit: false },
            ),
          )
        );
      });
    const selected = pickNarrativeCyberwareByLevel(
      available.map(({ entry }) => entry),
      level,
      random,
      narrativeContext,
      { allowance: levelAllowance },
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
    if (Object.hasOwn(categoryCounts, selected.implantType)) {
      categoryCounts[selected.implantType] += 1;
    }
    if (parentFamily && !ignoreSlots) {
      reservePktModuleSlot(
        slots,
        parentFamily,
        Math.max(0, Number(selected.slotsUsed ?? 0)),
        { commit: true },
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

const ROLE_WEAPON_PROFILES = Object.freeze({
  assault: ["rifle", "smg"], defender: ["shotgun", "pistol", "nonlethal"], heavy: ["heavy", "rifle"],
  sniper: ["sniper", "rifle"], skirmisher: ["smg", "pistol", "melee"], infiltrator: ["concealable", "pistol", "melee"],
  netrunner: ["pistol", "smg", "tech"], technician: ["pistol", "shotgun", "tech"], medic: ["pistol", "nonlethal"],
  leader: ["pistol", "rifle"], merchant: ["pistol", "concealable", "nonlethal"], driver: ["pistol", "smg", "concealable"],
  laborer: ["melee", "shotgun", "pistol"], service: ["pistol", "concealable", "nonlethal"], clerk: ["pistol", "concealable", "nonlethal"],
  forensic: ["pistol", "nonlethal", "concealable"], demolitions: ["shotgun", "pistol", "tech", "heavy"], droneOperator: ["pistol", "rifle", "tech"],
  pointman: ["rifle", "shotgun"], gunfighter: ["pistol", "smg"], breacher: ["shotgun", "smg", "melee"],
  bodyguard: ["pistol", "shotgun", "nonlethal"], scout: ["rifle", "pistol", "concealable"], controller: ["nonlethal", "shotgun", "pistol"],
  suppressor: ["heavy", "rifle"], saboteur: ["pistol", "concealable", "tech"], hunter: ["sniper", "rifle"],
  interrogator: ["pistol", "nonlethal", "concealable"], commando: ["rifle", "smg", "shotgun"], support: ["pistol", "rifle", "nonlethal"],
  cyberpsycho: ["heavy", "shotgun", "rifle", "melee"], pkt: ["heavy", "rifle", "tech"], civilian: ["pistol", "nonlethal", "concealable"],
});

const ROLE_ARMOR_PROFILES = Object.freeze({
  assault: ["medium", "light"], heavy: ["heavy"], defender: ["medium", "heavy"], bodyguard: ["medium", "heavy"], suppressor: ["medium", "heavy"],
  sniper: ["light"], infiltrator: ["light"], scout: ["light"], saboteur: ["light"], gunfighter: ["light"], netrunner: ["light"],
  technician: ["light", "medium"], medic: ["light"], leader: ["light", "medium"], merchant: ["none", "light"], driver: ["light"], laborer: ["light", "medium"],
  service: ["none", "light"], clerk: ["none", "light"], forensic: ["light"], demolitions: ["medium", "heavy"], droneOperator: ["light", "medium"],
  commando: ["medium", "light"], breacher: ["medium"], controller: ["medium", "light"], pointman: ["medium", "light"], hunter: ["light"], interrogator: ["light"],
  support: ["light", "medium"], cyberpsycho: ["heavy", "medium"], pkt: ["heavy", "medium"], civilian: ["none", "light"],
});

const ROLE_IMPLANT_FAMILIES = Object.freeze({
  assault: ["arm", "neural", "optics", "internal", "leg", "audio", "external"],
  defender: ["internal", "arm", "external", "neural", "optics", "audio"],
  heavy: ["arm", "internal", "external", "leg", "neural"],
  sniper: ["optics", "neural", "audio", "internal", "arm"],
  skirmisher: ["leg", "neural", "internal", "optics", "arm"],
  infiltrator: ["optics", "audio", "neural", "internal", "fashion", "leg"],
  netrunner: ["neural", "optics", "audio", "internal", "arm"],
  technician: ["arm", "neural", "optics", "audio", "internal"],
  medic: ["internal", "optics", "neural", "audio", "arm"],
  leader: ["audio", "neural", "optics", "internal", "fashion"],
  merchant: ["audio", "neural", "optics", "fashion", "internal"],
  driver: ["leg", "neural", "optics", "audio", "internal"],
  laborer: ["arm", "leg", "internal", "external", "neural"],
  service: ["fashion", "audio", "optics", "neural", "internal"],
  clerk: ["neural", "optics", "audio", "internal", "fashion"],
  forensic: ["optics", "audio", "internal", "neural"],
  demolitions: ["arm", "optics", "audio", "neural", "internal"],
  droneOperator: ["neural", "optics", "audio", "arm", "internal"],
  pointman: ["optics", "arm", "neural", "internal", "audio"],
  gunfighter: ["arm", "optics", "neural", "leg", "internal"],
  breacher: ["arm", "internal", "optics", "leg", "neural"],
  bodyguard: ["internal", "optics", "audio", "arm", "neural"],
  scout: ["optics", "audio", "leg", "neural", "internal"],
  controller: ["audio", "optics", "neural", "internal", "arm"],
  suppressor: ["arm", "internal", "external", "neural", "optics"],
  saboteur: ["arm", "neural", "optics", "audio", "internal"],
  hunter: ["optics", "audio", "neural", "internal", "leg"],
  interrogator: ["audio", "optics", "neural", "internal", "fashion"],
  commando: ["arm", "leg", "neural", "optics", "internal", "external"],
  support: ["neural", "audio", "optics", "internal", "arm"],
  cyberpsycho: ["arm", "leg", "internal", "external", "neural"],
  pkt: ["arm", "leg", "neural", "optics", "audio", "internal", "external"],
  civilian: ["fashion", "audio", "optics", "internal", "neural"],
});

function professionImplantFamilies(preset, roleId) {
  const allowed = [...new Set(preset.implantFamilies ?? [])];
  const preferred = ROLE_IMPLANT_FAMILIES[roleId] ?? [];
  if (!allowed.length) return [...preferred];
  const first = preferred.filter((family) => allowed.includes(family));
  return [...new Set([...first, ...allowed])];
}

export async function buildLoadout({ catalog, form, preset, role, random }) {
  const warnings = [];
  const implantFamilies = professionImplantFamilies(preset, role.id);
  const narrativeContext = {
    roleId: role.id,
    group: preset.group,
    faction: preset.faction,
    presetId: preset.id ?? form.preset,
    presetLabel: preset.label,
    allowUnique: preset.allowUnique,
    preferredFamilies: implantFamilies,
    roleGearKeywords: GEAR_KEYWORDS[role.id] ?? [],
  };
  const weaponAllowance = itemLevelAllowance(form.level, form.loadoutIntensity, random);
  const armorAllowance = itemLevelAllowance(form.level, form.loadoutIntensity, random);
  const gearAllowance = itemLevelAllowance(form.level, form.loadoutIntensity, random);
  const chromeAllowance = itemLevelAllowance(form.level, form.chromeIntensity, random, { chrome: true });
  const selectionOptions = {
    allowUnique: preset.allowUnique,
    allowance: weaponAllowance,
    narrativeContext,
  };
  const weaponProfiles = [...new Set([...(ROLE_WEAPON_PROFILES[role.id] ?? []), ...(preset.weaponProfiles ?? [])])];
  const armorProfiles = [...new Set([...(ROLE_ARMOR_PROFILES[role.id] ?? []), ...(preset.armorProfiles ?? [])])];
  const weapon = selectWeapon(
    catalog,
    weaponProfiles,
    form.level,
    random,
    selectionOptions,
  );
  const armor = selectArmor(
    catalog,
    armorProfiles,
    form.level,
    random,
    { ...selectionOptions, allowance: armorAllowance },
  );
  const ammo = compatibleAmmo(catalog, weapon, form.level, random, {
    allowance: Math.max(2, weaponAllowance),
    allowUnique: preset.allowUnique,
    narrativeContext,
  });
  const ammoQuantity = ammunitionQuantity(ammo, form.loadoutIntensity, random);
  const gear = selectGear(catalog, form.level, random, {
    count: gearCount(preset, form, random),
    keywords: GEAR_KEYWORDS[role.id] ?? [],
    allowUnique: preset.allowUnique,
    narrativeContext,
    fillFromNarrative: form.loadoutIntensity === "rich",
    allowance: gearAllowance,
  });
  const chromeForbidden = preset.forbidChrome === true || /inquisitors/iu.test(String(preset.faction ?? ""));
  const desiredChrome = chromeForbidden
    ? 0
    : chromeCount(preset, form.chromeIntensity, random, form.level);
  const wantsPkt = !chromeForbidden && (preset.pkt || Boolean(form.pktBodyId) || Boolean(form.pktModelKey));
  const cyberware = wantsPkt || chromeForbidden
    ? []
    : selectCyberwareLoadout(catalog, {
        level: form.level,
        random,
        count: desiredChrome,
        families: implantFamilies,
        moduleChance: preset.moduleChance,
        allowUnique: preset.allowUnique,
        narrativeContext,
        levelAllowance: chromeAllowance,
        standaloneLimits: { internal: 7, external: 7, fashion: 7 },
      });
  const programs =
    form.includePrograms && role.id === "netrunner"
      ? selectPrograms(catalog, form.level, random, {
          count: roleProgramCount(form.level),
        })
      : [];
  const pkt = wantsPkt
    ? await selectPktLoadout(
        catalog,
        form.level,
        random,
        form.pktModelKey || "random",
        form.pktBodyId || "random",
        chromeAllowance,
      )
    : null;
  if (pkt) {
    pkt.extras = selectPktExtras(
      catalog,
      pkt,
      form.level,
      random,
      desiredChrome,
      narrativeContext,
      chromeAllowance,
    );
    pkt.components.push(...pkt.extras);
    pkt.plan.push(...pkt.extras.map((entry) => entry.pktPlanEntry));
  }

  if (!weapon) warnings.push("В библиотеке не найдено подходящее оружие.");
  if (
    !armor &&
    !armorProfiles.includes("none") &&
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
    ...gear,
    ...cyberware,
    ...(pkt ? [pkt.biosystem, pkt.body, ...pkt.components] : []),
  ].filter(Boolean);
  const interfaceKeys = interfaceKeysForEntries(entries);

  return {
    weapon,
    armor,
    ammo,
    ammoQuantity,
    gear,
    cyberware,
    programs,
    pkt,
    entries,
    interfaceKeys,
    warnings,
    levelAllowances: {
      weapon: weaponAllowance,
      armor: armorAllowance,
      gear: gearAllowance,
      chrome: chromeAllowance,
    },
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
      loadout.secondaryAmmo
        ? `${loadout.secondaryAmmo.name} × ${loadout.secondaryAmmoQuantity}`
        : null,
    ]),
    row(
      "Расходники / инструменты",
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

export function pickSecondaryWeapon(catalog, loadout, preset, form, random, role = null) {
  if (form.loadoutIntensity !== "rich" || random() >= 0.85 || !loadout.weapon) {
    return null;
  }
  const candidates = catalog.weapons.filter(
    (entry) =>
      entry.id !== loadout.weapon.id &&
      itemSeries(entry) !== itemSeries(loadout.weapon) &&
      entry.level <= form.level + Math.max(1, loadout.levelAllowances?.weapon ?? 1) &&
      (entry.weaponProfiles.includes("pistol") ||
        entry.weaponProfiles.includes("melee") ||
        entry.weaponProfiles.includes("concealable")),
  );
  const narrativeContext = {
    roleId: role?.id ?? "",
    group: preset.group,
    faction: preset.faction,
    presetId: preset.id ?? form.preset,
    presetLabel: preset.label,
    allowUnique: preset.allowUnique,
    roleGearKeywords: GEAR_KEYWORDS[role?.id] ?? [],
  };
  return selectWeapon({ ...catalog, weapons: candidates }, ["pistol", "melee", "concealable"], form.level, random, {
    allowUnique: preset.allowUnique,
    allowance: Math.max(1, loadout.levelAllowances?.weapon ?? 1),
    narrativeContext,
  }) ?? pickByLevel(candidates, form.level, random, {
    allowUnique: preset.allowUnique,
  });
}
