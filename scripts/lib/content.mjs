import {
  MODULE_ID,
  PKT_BIOSYSTEM_ID,
  PKT_BODY_QUALITIES,
  descriptionText,
  parseCyberwareDescription,
} from "../../runtime/cyberware-schema.mjs";

export { MODULE_ID };
export const ITEM_PACK = "cyberpunk-items";
export const JOURNAL_PACK = "cyberpunk-journals";
export const MACRO_PACK = "cyberpunk-macros";

export const MODULE_ITEM_PREFIX = `Compendium.${MODULE_ID}.${ITEM_PACK}`;
export const MODULE_JOURNAL_PREFIX = `Compendium.${MODULE_ID}.${JOURNAL_PACK}`;
export const MODULE_MACRO_PREFIX = `Compendium.${MODULE_ID}.${MACRO_PACK}`;

const DERIVED_ITEM_FLAGS = new Set([
  "schema",
  "cyberware",
  "implantType",
  "hardCost",
  "stressFormula",
  "slots",
  "slotsUsed",
  "pktBody",
  "pktQuality",
  "pktComponentQuality",
  "pktReplaceable",
  "pktBiosystem",
  "pktOnly",
  "pktUnique",
  "pktFamily",
]);

const PKT_OVERVIEW_PAGE_ID = "ylsMSP9weB5au75z";
const PKT_HAMMER_PAGE_ID = "HnzffVt4NYaOy28t";
const PKT_HAMMER_INTRO =
  "<p><em>Techtronika представляет «МОЛОТ-0» — корпус, который превращает давление боя в преимущество. Тактические приводы, тяжёлая броня и контур «Красная зона» делают боль топливом, а каждую попытку остановить владельца — дорогостоящей ошибкой. «МОЛОТ-0»: войдите первым, выйдите последним.</em></p>";

function pktOverviewContent(models) {
  const orderedModels = [...models].sort(
    (left, right) =>
      Number(left.bodyQuality) - Number(right.bodyQuality) ||
      String(left.name).localeCompare(String(right.name), "ru"),
  );
  const rows = orderedModels
    .map(
      (model) =>
        `<li><p>@UUID[${MODULE_JOURNAL_PREFIX}.JournalEntry.${model.journalId}.JournalEntryPage.${model.pageId}]` +
        `{${model.name}}</p></li>`,
    )
    .join("");
  return [
    "<p>Готовая модель определяет обязательный корпус, уникальные системы, базовую комплектацию и компоненты с обычным либо отменённым Stress Cost. Корпус ПКТ приобретается отдельно; точный состав и цена без корпуса указаны на странице модели.</p>",
    `<ul>${rows}</ul>`,
  ].join("");
}

const SLUG_FIXES = new Map([
  ["8dBJVlOQGh1m4smH", "рейвен-микрокибернетикс-анубис"],
  ["UMAXLDpI6YLSfYX1", "смеш"],
  ["CoX5i569TRVUXf47", "zetatech-commander"],
  ["FT26PbTcQwvFPvMQ", "агент-zetatech-grade-a"],
  ["G8T2GwiiYyd6JoJW", "агент-zetatech-grade-a-plus"],
  ["HxaKRfVbL1ZyGcu1", "агент-segotari-double-agent"],
  ["zTPHGfnAOdIG8S3n", "агент-wyzard-technologies-merlyn"],
  ["IudHfIWVt46oohCG", "нейролинк-эскуро"],
  ["ME2RA177y8BxfNTW", "армированные-костяшки"],
  ["rFdfLIpNaQCREXwh", "смартлинк-продвинутый"],
  ["ftp2sSBzT7xj8wyU", "пистолетные-патроны-бум"],
  ["mzEeLKqa48LUgC7V", "радиосканер-проигрыватель"],
]);

const EXTERNAL_PACK_REWRITES = new Map([
  ["Compendium.pf2e.conditionitems", "Compendium.sf2e.conditions"],
  ["Compendium.pf2e.actionspf2e", "Compendium.sf2e.actions"],
  [
    "Compendium.pf2e.equipment-effects",
    "Compendium.pf2e-anachronism.equipment-effects",
  ],
  [
    "Compendium.pf2e.classfeatures",
    "Compendium.pf2e-anachronism.class-features",
  ],
  ["Compendium.pf2e.spells-srd", "Compendium.sf2e.spells"],
]);

export function plainText(html) {
  return descriptionText(html);
}

function itemPriceEddies(item) {
  const value = item?.system?.price?.value;
  const price = Number(value?.sp);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`Item ${item?._id ?? "unknown"} has no valid sp price.`);
  }
  return price;
}

function combinationSums(values, count, start = 0) {
  if (count === 0) return [0];
  const sums = [];
  for (let index = start; index <= values.length - count; index++) {
    for (const remainder of combinationSums(values, count - 1, index + 1)) {
      sums.push(values[index] + remainder);
    }
  }
  return sums;
}

export function calculatePktModelPrices(items, model) {
  const itemById =
    items instanceof Map
      ? items
      : new Map(items.map((item) => [item._id, item]));
  const priceOf = (itemId) => {
    const item = itemById.get(itemId);
    if (!item) throw new Error(`PKT component ${itemId} is missing.`);
    return itemPriceEddies(item);
  };
  const fixedEntries = [...(model.unique ?? []), ...(model.components ?? [])];
  const fixed = fixedEntries.reduce(
    (sum, entry) =>
      sum + priceOf(entry.itemId) * Math.max(1, Number(entry.quantity) || 1),
    0,
  );

  let totals = [fixed];
  for (const choice of model.choices ?? []) {
    const choose = Math.max(1, Number(choice.choose) || 1);
    const prices = (choice.itemIds ?? []).map(priceOf);
    const choiceSums = combinationSums(prices, choose);
    if (!choiceSums.length) {
      throw new Error(
        `PKT choice ${choice.key} cannot select ${choose} items.`,
      );
    }
    totals = totals.flatMap((total) =>
      choiceSums.map((choiceTotal) => total + choiceTotal),
    );
  }
  return [...new Set(totals)].sort((left, right) => left - right);
}

export function parseCyberware(item) {
  const described = parseCyberwareDescription(item);
  let implantType = described.implantType;
  if (item._id === PKT_BIOSYSTEM_ID) implantType = "internal";

  const { hardCost, stressFormula, slots } = described;
  const usage = item.system?.usage;
  const pktBody = PKT_BODY_QUALITIES.has(item._id);
  const pktBiosystem = item._id === PKT_BIOSYSTEM_ID;
  const pktOnly = item.system?.traits?.value?.includes?.("pkt") === true;
  const cyberware =
    pktBody ||
    pktBiosystem ||
    implantType !== null ||
    usage?.value === "implanted" ||
    usage?.type === "implanted" ||
    hardCost !== null;

  return {
    cyberware,
    implantType,
    hardCost,
    stressFormula,
    slots,
    pktBody,
    pktQuality: PKT_BODY_QUALITIES.get(item._id) ?? null,
    pktBiosystem,
    pktOnly,
  };
}

export function rewriteString(value, counters = null) {
  let result = value;
  const replace = (pattern, replacement, counter) => {
    const before = result;
    result = result.replace(pattern, replacement);
    if (counters && before !== result) {
      counters[counter] = (counters[counter] ?? 0) + 1;
    }
  };

  replace(
    /Compendium\.world\.sf2e-cyberpunk-items/g,
    MODULE_ITEM_PREFIX,
    "worldItemReferences",
  );
  replace(
    /Compendium\.world\.sf2e-cyberpunk-journals/g,
    MODULE_JOURNAL_PREFIX,
    "worldJournalReferences",
  );
  replace(
    /Compendium\.world\.sf2e-cyberpunk-macros/g,
    MODULE_MACRO_PREFIX,
    "worldMacroReferences",
  );

  for (const [oldPrefix, newPrefix] of EXTERNAL_PACK_REWRITES) {
    replace(
      new RegExp(oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      newPrefix,
      "externalReferences",
    );
  }

  replace(
    /@UUID\[Item\.([A-Za-z0-9]{16})(?=\.|\])/g,
    `@UUID[${MODULE_ITEM_PREFIX}.Item.$1`,
    "relativeItemReferences",
  );
  replace(
    /@UUID\[JournalEntry\.([A-Za-z0-9]{16})(?=\.|\])/g,
    `@UUID[${MODULE_JOURNAL_PREFIX}.JournalEntry.$1`,
    "relativeJournalReferences",
  );
  replace(
    /Compendium\.cyberpunk-remaster\.cyberpunk-items\.(?!Item\.|Folder\.)([A-Za-z0-9]{16})/g,
    `${MODULE_ITEM_PREFIX}.Item.$1`,
    "moduleShorthandReferences",
  );
  replace(
    /Compendium\.cyberpunk-remaster\.cyberpunk-journals\.(?!JournalEntry\.|Folder\.)([A-Za-z0-9]{16})/g,
    `${MODULE_JOURNAL_PREFIX}.JournalEntry.$1`,
    "moduleShorthandReferences",
  );
  replace(
    /Compendium\.cyberpunk-remaster\.cyberpunk-macros\.(?!Macro\.|Folder\.)([A-Za-z0-9]{16})/g,
    `${MODULE_MACRO_PREFIX}.Macro.$1`,
    "moduleShorthandReferences",
  );

  replace(
    /(?<!modules\/cyberpunk-remaster\/)assets\/icons\//g,
    `modules/${MODULE_ID}/assets/icons/`,
    "iconReferences",
  );
  replace(
    /systems\/pf2e\/icons\/actions\/FreeAction\.webp/g,
    "systems/sf2e/icons/actions/FreeAction.webp",
    "systemIconReferences",
  );
  replace(
    /systems\/pf2e\/icons\/actions\/Reaction\.webp/g,
    "systems/sf2e/icons/actions/Reaction.webp",
    "systemIconReferences",
  );
  replace(
    /flags\.world\.netrunnerTrace/g,
    `flags.${MODULE_ID}.netrunnerTrace`,
    "macroFlags",
  );
  return result;
}

export function rewriteDeep(value, counters = null) {
  if (typeof value === "string") return rewriteString(value, counters);
  if (Array.isArray(value)) {
    return value.map((entry) => rewriteDeep(entry, counters));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        rewriteDeep(entry, counters),
      ]),
    );
  }
  return value;
}

function cleanFlags(document) {
  document.flags ??= {};
  delete document.flags.babele;
}

function clearDerivedItemFlags(item) {
  const flags = item.flags?.[MODULE_ID];
  if (flags) {
    for (const key of DERIVED_ITEM_FLAGS) delete flags[key];
    if (Object.keys(flags).length === 0) delete item.flags[MODULE_ID];
  }
  for (const subitem of item.system?.subitems ?? []) {
    clearDerivedItemFlags(subitem);
  }
}

function clearDerivedPageFlags(page) {
  const flags = page.flags?.[MODULE_ID];
  if (!flags) return;
  delete flags.pktModel;
  if (Object.keys(flags).length === 0) delete page.flags[MODULE_ID];
}

function cleanStats(document, compendiumSource) {
  document._stats ??= {};
  delete document._stats.lastModifiedBy;
  delete document._stats.duplicateSource;
  delete document._stats.exportSource;
  document._stats.compendiumSource = compendiumSource;
}

function cleanOwnership(document, inherited = false) {
  document.ownership = { default: inherited ? -1 : 0 };
}

function itemUuid(id) {
  return `${MODULE_ITEM_PREFIX}.Item.${id}`;
}

function journalUuid(id) {
  return `${MODULE_JOURNAL_PREFIX}.JournalEntry.${id}`;
}

function macroUuid(id) {
  return `${MODULE_MACRO_PREFIX}.Macro.${id}`;
}

function normalizeSubitems(item) {
  for (const subitem of item.system?.subitems ?? []) {
    cleanFlags(subitem);
    cleanOwnership(subitem);
    cleanStats(subitem, null);
    subitem.folder = null;
    subitem.system.publication ??= {};
    subitem.system.publication.title = "SF2E Cyberpunk Remaster";
    subitem.system.publication.authors = "Ogorodnik";
    normalizeSubitems(subitem);
  }
}

export function transformItems(
  source,
  pktModels,
  pktComponents = [],
  counters = {},
) {
  const familyByItem = new Map();
  const uniqueIds = new Set();
  const componentByItem = new Map(
    pktComponents.map((component) => [component.itemId, component]),
  );
  for (const model of pktModels) {
    for (const entry of model.unique ?? []) {
      uniqueIds.add(entry.itemId);
    }
    for (const component of model.components ?? []) {
      if (!familyByItem.has(component.itemId)) {
        familyByItem.set(component.itemId, component.family);
      }
    }
  }

  const items = source.map((raw) => {
    const item = rewriteDeep(structuredClone(raw), counters);
    cleanFlags(item);
    clearDerivedItemFlags(item);
    cleanOwnership(item);
    cleanStats(item, itemUuid(item._id));

    item.system.publication ??= {};
    item.system.publication.title = "SF2E Cyberpunk Remaster";
    item.system.publication.authors = "Ogorodnik";
    normalizeSubitems(item);

    const cyberware = parseCyberware(item);
    if (cyberware.cyberware) {
      const structuralFlags = {};
      if (cyberware.pktBody) {
        structuralFlags.pktBody = true;
        structuralFlags.pktQuality = cyberware.pktQuality;
      }
      if (cyberware.pktBiosystem) structuralFlags.pktBiosystem = true;
      if (cyberware.pktOnly) structuralFlags.pktOnly = true;
      if (uniqueIds.has(item._id)) structuralFlags.pktUnique = true;
      const component = componentByItem.get(item._id);
      const family = component?.family ?? familyByItem.get(item._id);
      if (family) {
        structuralFlags.pktFamily = family;
      }
      if (component) {
        structuralFlags.pktComponentQuality = component.quality;
        structuralFlags.pktReplaceable = component.replaceable !== false;
      }
      if (Object.keys(structuralFlags).length > 0) {
        Object.assign((item.flags[MODULE_ID] ??= {}), structuralFlags);
      }
    }

    const fixedSlug = SLUG_FIXES.get(item._id);
    if (fixedSlug && item.system?.slug !== undefined) {
      item.system.slug = fixedSlug;
    }
    return item;
  });

  const byId = new Map(items.map((item) => [item._id, item]));
  const hardenedChrome = byId.get("YtysHqoszmqq7L2K");
  if (hardenedChrome) {
    hardenedChrome.system.traits.value ??= [];
    if (!hardenedChrome.system.traits.value.includes("netrunner")) {
      hardenedChrome.system.traits.value.push("netrunner");
    }
  }

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
  return items;
}

function hydratedPktModel(model) {
  const hydrate = (entry) => ({
    ...entry,
    uuid: itemUuid(entry.itemId),
  });
  return {
    ...model,
    requiredBodyUuid: itemUuid(model.requiredBodyId),
    unique: (model.unique ?? []).map(hydrate),
    components: (model.components ?? []).map(hydrate),
    choices: (model.choices ?? []).map((choice) => ({
      ...choice,
      itemUuids: choice.itemIds.map(itemUuid),
    })),
  };
}

export function transformJournals(source, pktModels, counters = {}) {
  const modelsByPage = new Map(
    pktModels.map((model) => [
      `${model.journalId}.${model.pageId}`,
      hydratedPktModel(model),
    ]),
  );

  return source.map((raw) => {
    const journal = rewriteDeep(structuredClone(raw), counters);
    cleanFlags(journal);
    cleanOwnership(journal);
    cleanStats(journal, journalUuid(journal._id));

    journal.pages = (journal.pages ?? []).map((page) => {
      cleanFlags(page);
      clearDerivedPageFlags(page);
      cleanOwnership(page, true);
      cleanStats(
        page,
        `${journalUuid(journal._id)}.JournalEntryPage.${page._id}`,
      );
      const model = modelsByPage.get(`${journal._id}.${page._id}`);
      if (model) {
        page.flags[MODULE_ID] ??= {};
        page.flags[MODULE_ID].pktModel = model;
        if (page.text?.content) {
          page.text.content = page.text.content.replace(
            /(<strong>Цена\s*<\/strong>[\s\S]*?<strong>:\s*<\/strong>\s*)[\d\s\u00a0\u202f]+(?=\s*эдди)/iu,
            `$1${model.priceEddies} `,
          );
        }
      }
      if (page._id === PKT_OVERVIEW_PAGE_ID) {
        page.text ??= {};
        page.text.content = pktOverviewContent(pktModels);
      }
      if (page._id === PKT_HAMMER_PAGE_ID && page.text?.content) {
        page.text.content = page.text.content.replace(
          /<p><em>\s*Тут описание!\s*<\/em><\/p>/i,
          PKT_HAMMER_INTRO,
        );
      }
      if (page._id === "jojgQKTE1zUmQ1Mw" && page.text?.content) {
        page.text.content = page.text.content.replace(
          "которая навсегда вычитается из максимума вашей Человечности",
          "которая вычитается из максимума Человечности, пока имплант установлен",
        );
      }
      return page;
    });
    return journal;
  });
}

export function transformMacros(source, counters = {}) {
  return source.map((raw) => {
    const macro = rewriteDeep(structuredClone(raw), counters);
    cleanFlags(macro);
    cleanOwnership(macro);
    cleanStats(macro, macroUuid(macro._id));
    macro.author = null;
    return macro;
  });
}

export function transformFolders(source, counters = {}) {
  return source.map((raw) => {
    const folder = rewriteDeep(structuredClone(raw), counters);
    cleanFlags(folder);
    cleanStats(folder, `${MODULE_ITEM_PREFIX}.Folder.${folder._id}`);
    delete folder.ownership;
    return folder;
  });
}

export function allStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) {
    for (const entry of value) allStrings(entry, output);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) allStrings(entry, output);
  }
  return output;
}

export function collectCustomIconPaths(value) {
  const paths = new Set();
  for (const string of allStrings(value)) {
    for (const match of string.matchAll(
      /(?:^|["'(=\s])(?:assets\/icons|modules\/cyberpunk-remaster\/assets\/icons)\/([^"'()<>\s]+)/g,
    )) {
      paths.add(match[1]);
    }
  }
  return paths;
}

export function validateTransformedContent({
  items,
  folders,
  journals,
  macros,
  pktComponents = [],
  pktModels = [],
}) {
  const failures = [];
  const itemIds = new Set(items.map((item) => item._id));
  const itemById = new Map(items.map((item) => [item._id, item]));
  const folderIds = new Set(folders.map((folder) => folder._id));
  const journalIds = new Set(journals.map((journal) => journal._id));
  const pageIds = new Set(
    journals.flatMap((journal) =>
      journal.pages.map((page) => `${journal._id}.${page._id}`),
    ),
  );

  const itemSources = [];
  const addItemSource = (item, embedded = false) => {
    itemSources.push({ item, embedded });
    for (const subitem of item.system?.subitems ?? []) {
      addItemSource(subitem, true);
    }
  };
  for (const item of items) addItemSource(item);

  for (const { item, embedded } of itemSources) {
    if (item.folder && !folderIds.has(item.folder)) {
      failures.push(
        `Item ${item._id} references missing folder ${item.folder}`,
      );
    }
    if (
      item.system?.publication?.title !== "SF2E Cyberpunk Remaster" ||
      item.system?.publication?.authors !== "Ogorodnik"
    ) {
      failures.push(`Item ${item._id} has incorrect publication metadata`);
    }
    if (Object.keys(item.ownership ?? {}).some((key) => key !== "default")) {
      failures.push(`Item ${item._id} retains user-specific ownership`);
    }
    if (
      item._stats?.lastModifiedBy ||
      item._stats?.duplicateSource ||
      item._stats?.exportSource
    ) {
      failures.push(`Item ${item._id} retains world-specific _stats`);
    }
    if (embedded && item.folder) {
      failures.push(`Subitem ${item._id} retains a pack folder`);
    }
    const cyberware = parseCyberware(item);
    if (cyberware.cyberware && !cyberware.pktBody && !cyberware.pktBiosystem) {
      const described = parseCyberwareDescription(item);
      if (described.fallbackFields.length) {
        failures.push(
          `Cyberware ${item._id} has non-canonical description fields: ` +
            described.fallbackFields.join(", "),
        );
      }
      if (
        !described.implantType ||
        described.hardCost === null ||
        described.stressFormula === null
      ) {
        failures.push(
          `Cyberware ${item._id} is missing type, Hard Cost, or Stress Cost`,
        );
      }
      if (
        ["base", "module"].includes(described.implantType) &&
        described.slots === null
      ) {
        failures.push(`Cyberware ${item._id} is missing its slot line`);
      }
    }
  }

  const pktComponentIds = new Set();
  for (const component of pktComponents) {
    if (!/^[A-Za-z0-9]{16}$/.test(component.itemId ?? "")) {
      failures.push(`Invalid PKT component Item ID ${component.itemId}`);
      continue;
    }
    if (pktComponentIds.has(component.itemId)) {
      failures.push(`Duplicate PKT component ${component.itemId}`);
      continue;
    }
    pktComponentIds.add(component.itemId);
    if (!/^[a-z][a-z0-9-]*$/.test(component.family ?? "")) {
      failures.push(
        `PKT component ${component.itemId} has invalid family ${component.family}`,
      );
    }
    if (
      !Number.isInteger(component.quality) ||
      component.quality < 0 ||
      component.quality > 3
    ) {
      failures.push(
        `PKT component ${component.itemId} has invalid quality ${component.quality}`,
      );
    }
    if (
      component.replaceable !== undefined &&
      typeof component.replaceable !== "boolean"
    ) {
      failures.push(
        `PKT component ${component.itemId} has invalid replaceable value`,
      );
    }
    if (
      component.special !== undefined &&
      typeof component.special !== "boolean"
    ) {
      failures.push(
        `PKT component ${component.itemId} has invalid special value`,
      );
    }
    if (component.special === true && component.replaceable !== false) {
      failures.push(
        `Special PKT component ${component.itemId} must not be replaceable`,
      );
    }
    const item = itemById.get(component.itemId);
    if (!item) {
      failures.push(`PKT component Item ${component.itemId} is missing`);
      continue;
    }
    const flags = item.flags?.[MODULE_ID] ?? {};
    if (
      flags.pktFamily !== component.family ||
      flags.pktComponentQuality !== component.quality ||
      flags.pktReplaceable !== (component.replaceable !== false)
    ) {
      failures.push(
        `PKT component ${component.itemId} has incorrect derived flags`,
      );
    }
  }
  const biosystem = itemById.get(PKT_BIOSYSTEM_ID);
  if (biosystem?.flags?.[MODULE_ID]?.pktBiosystem !== true) {
    failures.push(`PKT Biosystem ${PKT_BIOSYSTEM_ID} is not marked`);
  }
  for (const [bodyId, quality] of PKT_BODY_QUALITIES) {
    const bodyFlags = itemById.get(bodyId)?.flags?.[MODULE_ID] ?? {};
    if (bodyFlags.pktBody !== true || bodyFlags.pktQuality !== quality) {
      failures.push(`PKT body ${bodyId} does not have quality ${quality}`);
    }
  }
  for (const model of pktModels) {
    const body = itemById.get(model.requiredBodyId);
    const bodyLevel = Number(body?.system?.level?.value);
    const bodyQuality = body?.flags?.[MODULE_ID]?.pktQuality;
    if (!body || !Number.isFinite(bodyLevel)) {
      failures.push(
        `PKT model ${model.key} references an invalid body ${model.requiredBodyId}`,
      );
    } else {
      if (bodyQuality !== Number(model.bodyQuality)) {
        failures.push(
          `PKT model ${model.key} body quality ${model.bodyQuality} ` +
            `does not match body ${model.requiredBodyId} quality ${bodyQuality}`,
        );
      }
      for (const entry of [
        ...(model.unique ?? []),
        ...(model.components ?? []),
      ]) {
        const component = itemById.get(entry.itemId);
        const componentLevel = Number(component?.system?.level?.value);
        if (
          component &&
          Number.isFinite(componentLevel) &&
          componentLevel > bodyLevel + 2
        ) {
          failures.push(
            `PKT model ${model.key} uses level ${componentLevel} component ` +
              `${entry.itemId} above body level ${bodyLevel} + 2`,
          );
        }
      }
    }
    try {
      const totals = calculatePktModelPrices(itemById, model);
      if (totals.length !== 1 || totals[0] !== Number(model.priceEddies)) {
        failures.push(
          `PKT model ${model.key} price ${model.priceEddies} ` +
            `does not match component total(s): ${totals.join(", ")}`,
        );
      }
    } catch (error) {
      failures.push(
        `PKT model ${model.key} price check failed: ${error.message}`,
      );
    }
  }

  for (const folder of folders) {
    if (folder.folder && !folderIds.has(folder.folder)) {
      failures.push(
        `Folder ${folder._id} references missing parent ${folder.folder}`,
      );
    }
  }

  const documents = [...items, ...folders, ...journals, ...macros];
  for (const string of allStrings(documents)) {
    if (/Compendium\.world\.sf2e-cyberpunk-|Compendium\.pf2e\./.test(string)) {
      failures.push(
        `Legacy Compendium reference remains: ${string.slice(0, 180)}`,
      );
    }
    if (/@UUID\[(?:Item|JournalEntry)\./.test(string)) {
      failures.push(`Relative UUID remains: ${string.slice(0, 180)}`);
    }
    if (
      /Compendium\.cyberpunk-remaster\.(?:cyberpunk-items|cyberpunk-journals|cyberpunk-macros)\.(?!Item\.|Folder\.|JournalEntry\.|Macro\.)[A-Za-z0-9]{16}/.test(
        string,
      )
    ) {
      failures.push(`Module shorthand UUID remains: ${string.slice(0, 180)}`);
    }
    if (/(?:^|["'(=\s])assets\/icons\//.test(string)) {
      failures.push(`Legacy icon path remains: ${string.slice(0, 180)}`);
    }

    for (const match of string.matchAll(
      /Compendium\.cyberpunk-remaster\.cyberpunk-items\.Item\.([A-Za-z0-9]{16})/g,
    )) {
      if (!itemIds.has(match[1])) {
        failures.push(`Missing module Item target ${match[1]}`);
      }
    }
    for (const match of string.matchAll(
      /Compendium\.cyberpunk-remaster\.cyberpunk-items\.Folder\.([A-Za-z0-9]{16})/g,
    )) {
      if (!folderIds.has(match[1])) {
        failures.push(`Missing module Folder target ${match[1]}`);
      }
    }
    for (const match of string.matchAll(
      /Compendium\.cyberpunk-remaster\.cyberpunk-journals\.JournalEntry\.([A-Za-z0-9]{16})(?:\.JournalEntryPage\.([A-Za-z0-9]{16}))?/g,
    )) {
      if (!journalIds.has(match[1])) {
        failures.push(`Missing module Journal target ${match[1]}`);
      }
      if (match[2] && !pageIds.has(`${match[1]}.${match[2]}`)) {
        failures.push(`Missing module Journal page ${match[1]}.${match[2]}`);
      }
    }
  }

  const slugs = new Map();
  for (const item of items) {
    if (!item.system?.slug) continue;
    const key = `${item.type}:${item.system.slug}`;
    const existing = slugs.get(key);
    if (existing) {
      failures.push(`Duplicate slug ${key}: ${existing._id} and ${item._id}`);
    } else {
      slugs.set(key, item);
    }
  }

  if (failures.length) {
    throw new Error(
      `Content validation failed (${failures.length}):\n${failures.join("\n")}`,
    );
  }
}
