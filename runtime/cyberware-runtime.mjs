import {
  CyberwareTab,
  LEGACY_MODULE_ID,
  MODULE_ID,
  RULE_SETTING_DEFAULTS,
} from "../sheets/CyberwareTab.js";
import { enqueueActorOperation } from "./actor-operation-queue.mjs";

const MIGRATION_VERSION = 7;
const NETRUNNER_SCAN_ID = "ChromeProbeAct01";
const NETRUNNER_SCAN_SLUG = "сканирование-интерфейсов";
const NETRUNNER_SCAN_UUID = `Compendium.${MODULE_ID}.cyberpunk-items.Item.${NETRUNNER_SCAN_ID}`;
const PENDING_CREATE_ITEMS = Symbol("cyberpunkRemasterPendingCreateItems");
const PLANNED_INSTALLATION_STATES = Symbol(
  "cyberpunkRemasterPlannedInstallationStates",
);

const loadTemplates =
  globalThis.foundry?.applications?.handlebars?.loadTemplates ??
  globalThis.loadTemplates;

function isActingUser(userId) {
  return !userId || globalThis.game?.user?.id === userId;
}

function clearPktCacheForCompendiumDocument(document) {
  if (
    document?.pack === `${MODULE_ID}.cyberpunk-items` ||
    document?.pack === `${MODULE_ID}.cyberpunk-journals`
  ) {
    CyberwareTab.clearPktContentCache();
  }
}

function enqueueActor(actor, operation) {
  return enqueueActorOperation(actor, operation).catch((error) => {
    console.error(`${MODULE_ID} | Actor operation failed`, error);
    globalThis.ui?.notifications?.error?.(
      `SF2E Cyberpunk Remaster: ${error.message}`,
    );
  });
}

function hasChange(changes, path) {
  return (
    Object.prototype.hasOwnProperty.call(changes ?? {}, path) ||
    globalThis.foundry?.utils?.hasProperty?.(changes, path) === true
  );
}

function getChange(changes, path) {
  if (Object.prototype.hasOwnProperty.call(changes ?? {}, path)) {
    return changes[path];
  }
  return globalThis.foundry?.utils?.getProperty?.(changes, path);
}

function localOperationState(options, key, create) {
  if (!options[key]) {
    Object.defineProperty(options, key, {
      configurable: true,
      value: create(),
      writable: true,
    });
  }
  return options[key];
}

function actorWithPlannedInstallations(actor, planned) {
  return {
    items: [...actor.items].map((item) =>
      Object.prototype.hasOwnProperty.call(planned, item.id)
        ? CyberwareTab.validationSnapshot(item, planned[item.id])
        : item,
    ),
  };
}

function onRenderSheet(app, html) {
  const actor = app.actor;
  if (actor?.type !== "character") return;
  if (actor.limited && !globalThis.game?.user?.isGM) return;

  const ElementClass = globalThis.HTMLElement;
  const element =
    ElementClass && html instanceof ElementClass ? html : html?.[0];
  if (element) CyberwareTab.inject(app, element);
}

function refreshCyberwareRuleSettings({ reconcileHumanity = false } = {}) {
  const actors =
    globalThis.game?.actors?.filter?.((actor) => actor.type === "character") ??
    [];
  for (const actor of actors) {
    for (const app of Object.values(actor.apps ?? {})) {
      app?.render?.(false);
    }
    if (reconcileHumanity && globalThis.game?.user?.isGM) {
      void enqueueActor(actor, () => CyberwareTab.reconcileHumanity(actor));
    }
  }
}

function registerRuleSettings() {
  const booleanSettings = [
    {
      key: "allowMultipleCyberdecks",
      name: "Правила хрома: разрешить несколько кибердек",
      hint:
        "Снимает ограничение одной установленной кибердеки. Каждая дека " +
        "по-прежнему занимает свои слоты и применяет Hard Cost.",
    },
    {
      key: "allowMultipleNeuralAccelerators",
      name: "Правила хрома: разрешить несколько нейронных ускорителей",
      hint:
        "Снимает ограничение одного установленного импланта с признаком " +
        "«Нейронный ускоритель».",
    },
    {
      key: "allowMultiplePktBodies",
      name: "Правила ПКТ: разрешить несколько корпусов",
      hint:
        "Позволяет одному персонажу одновременно установить несколько " +
        "корпусов Полной Конверсии Тела.",
    },
    {
      key: "allowPktWithoutBody",
      name: "Правила ПКТ: разрешить ПКТ-импланты без корпуса",
      hint:
        "Позволяет устанавливать импланты с признаком ПКТ без корпуса и не " +
        "извлекает их автоматически при снятии корпуса.",
    },
    {
      key: "allowPktBodyWithoutBiosystem",
      name: "Правила ПКТ: разрешить корпус без Биосистемы",
      hint:
        "Снимает требование установленной Биосистемы для корпусов и готовых " +
        "моделей ПКТ.",
    },
    {
      key: "ignoreSlotLimits",
      name: "Правила имплантов: игнорировать вместимость баз",
      hint:
        "Разрешает помещать модули в базу даже при нехватке слотов. Интерфейс " +
        "продолжит показывать фактическую загрузку.",
    },
    {
      key: "ignorePktQualityLimits",
      name: "Правила ПКТ: игнорировать ограничения качества",
      hint:
        "Позволяет ставить любую готовую модель в любой корпус и заменять " +
        "базы без ограничения качества корпуса.",
    },
  ];

  for (const setting of booleanSettings) {
    game.settings.register(MODULE_ID, setting.key, {
      name: setting.name,
      hint: setting.hint,
      scope: "world",
      config: true,
      type: Boolean,
      default: RULE_SETTING_DEFAULTS[setting.key],
      onChange: () => refreshCyberwareRuleSettings(),
    });
  }

  game.settings.register(MODULE_ID, "hardCostMultiplier", {
    name: "Человечность: множитель Hard Cost",
    hint:
      "Изменяет влияние Hard Cost всех установленных имплантов на максимум " +
      "Человечности. Округление выполняется вверх после умножения.",
    scope: "world",
    config: true,
    type: Number,
    choices: {
      0: "×0 — Hard Cost не уменьшает максимум",
      0.5: "×0,5 — облегчённые правила",
      1: "×1 — стандартные правила",
      1.5: "×1,5 — тяжёлые правила",
      2: "×2 — очень тяжёлые правила",
    },
    default: RULE_SETTING_DEFAULTS.hardCostMultiplier,
    onChange: () => refreshCyberwareRuleSettings({ reconcileHumanity: true }),
  });
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "migrationVersion", {
    name: "Cyberpunk Remaster migration version",
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });
  registerRuleSettings();

  if (typeof loadTemplates === "function") {
    void loadTemplates([`modules/${MODULE_ID}/templates/cyberware-tab.hbs`]);
  }

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = { CyberwareTab };
});

Hooks.on("renderActorSheet", onRenderSheet);
Hooks.on("renderActorSheetV2", onRenderSheet);
Hooks.on("closeActorSheet", (app) => {
  CyberwareTab.clearSheetState(app);
});
Hooks.on("closeActorSheetV2", (app) => {
  CyberwareTab.clearSheetState(app);
});

// A dropped cyberware item enters the actor in a coherent state. Doing this in
// preCreate avoids a second update and prevents Rule Elements from preparing
// once in an incorrect "worn but installed" state.
Hooks.on("preCreateItem", (item, _data, options, userId) => {
  if (!isActingUser(userId)) return;
  const actor = item.actor;
  if (!actor || actor.type !== "character" || !CyberwareTab.isCyberware(item)) {
    return;
  }

  options ??= {};
  const pending = localOperationState(options, PENDING_CREATE_ITEMS, () => []);
  const validation = CyberwareTab.installationValidation(
    { items: [...actor.items, ...pending] },
    item,
  );
  if (validation) {
    const update = CyberwareTab.installationUpdate(item, false);
    delete update._id;
    item.updateSource(update);
    ui.notifications.warn(`${item.name}: ${validation}`);
    return;
  }

  item.updateSource(CyberwareTab.preCreateInstallationSource(item));
  pending.push(CyberwareTab.validationSnapshot(item, true));
});

// Keep manual inventory changes and the module flag synchronized for implanted
// equipment. Weapons and armor intentionally retain the system's own equip
// semantics and are represented by the module flag.
Hooks.on("preUpdateItem", (item, changes, options) => {
  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  if (CyberwareTab.isExternalBioware(item)) return;
  options ??= {};
  options.cyberpunkRemasterWasInstalledById ??= {};
  options.cyberpunkRemasterWasInstalledById[item.id] =
    CyberwareTab.isInstalled(item);
  options.cyberpunkRemasterHadHumanityRuleById ??= {};
  options.cyberpunkRemasterHadHumanityRuleById[item.id] =
    CyberwareTab.hasHumanityRule(item);
  if (
    options.cyberpunkRemasterMigration ||
    options.cyberpunkRemasterManaged ||
    options.cyberpunkRemasterModelOperation
  ) {
    return;
  }

  const installedPath = `flags.${MODULE_ID}.installed`;
  const wasInstalled = options.cyberpunkRemasterWasInstalledById[item.id];
  const hasInstalledChange = hasChange(changes, installedPath);
  const hasCarryChange = hasChange(changes, "system.equipped.carryType");
  const requestedInstalled = hasInstalledChange
    ? getChange(changes, installedPath) === true
    : hasCarryChange && item.type === "equipment"
      ? getChange(changes, "system.equipped.carryType") === "implanted"
      : wasInstalled;
  const planned = localOperationState(
    options,
    PLANNED_INSTALLATION_STATES,
    () => ({}),
  );
  const validationActor = actorWithPlannedInstallations(actor, planned);
  if (requestedInstalled && !wasInstalled) {
    const validation = CyberwareTab.installationValidation(
      validationActor,
      item,
    );
    if (validation) {
      ui.notifications.warn(`${item.name}: ${validation}`);
      return false;
    }
  }
  if (!requestedInstalled && wasInstalled) {
    const validation = CyberwareTab.removalValidation(validationActor, item);
    if (validation) {
      ui.notifications.warn(`${item.name}: ${validation}`);
      return false;
    }
  }
  if (requestedInstalled !== wasInstalled) {
    planned[item.id] = requestedInstalled;
  }

  if (hasInstalledChange) {
    const installed = getChange(changes, installedPath) === true;
    const preserveUninstalledInventoryState =
      !installed &&
      item.type === "equipment" &&
      item.system?.equipped?.carryType !== "implanted";
    const update = preserveUninstalledInventoryState
      ? CyberwareTab.deleteFlagUpdate(
          CyberwareTab.deleteFlagUpdate(
            {
              _id: item.id,
              [`flags.${MODULE_ID}.installed`]: false,
            },
            MODULE_ID,
            "parentId",
          ),
          MODULE_ID,
          "previousCarryState",
        )
      : CyberwareTab.installationUpdate(item, installed);
    delete update._id;
    Object.assign(changes, update);
  }
  CyberwareTab.synchronizeCarryChange(item, changes);
});

Hooks.on("createItem", (item, options, userId) => {
  clearPktCacheForCompendiumDocument(item);
  if (!isActingUser(userId)) return;
  if (
    options?.cyberpunkRemasterMigration ||
    options?.cyberpunkRemasterModelOperation
  ) {
    return;
  }
  const actor = item.actor;
  if (
    !actor ||
    actor.type !== "character" ||
    (!CyberwareTab.isCyberware(item) && !CyberwareTab.hasHumanityRule(item))
  ) {
    return;
  }
  void enqueueActor(actor, async () => {
    await CyberwareTab.reconcileHumanity(actor);
    await CyberwareTab.reconcileGrantedItems(actor);
  });
});

Hooks.on("updateItem", (item, changes, options, userId) => {
  clearPktCacheForCompendiumDocument(item);
  if (!isActingUser(userId)) return;
  if (
    options?.cyberpunkRemasterMigration ||
    options?.cyberpunkRemasterManaged ||
    options?.cyberpunkRemasterModelOperation
  ) {
    return;
  }
  const actor = item.actor;
  const affectsHumanity =
    CyberwareTab.hasHumanityRule(item) ||
    options?.cyberpunkRemasterHadHumanityRuleById?.[item.id] === true;
  if (
    !actor ||
    actor.type !== "character" ||
    (!CyberwareTab.isCyberware(item) && !affectsHumanity)
  ) {
    return;
  }

  void enqueueActor(actor, async () => {
    const becameUninstalled =
      options?.cyberpunkRemasterWasInstalledById?.[item.id] === true &&
      !CyberwareTab.isInstalled(item);

    if (becameUninstalled && CyberwareTab.getImplantType(item) === "base") {
      await CyberwareTab.detachModules(actor, item.id);
    }
    if (becameUninstalled && CyberwareTab.isPktBody(item)) {
      await CyberwareTab.ejectPktComponents(actor, item.id);
    }
    await CyberwareTab.reconcileHumanity(actor);
    await CyberwareTab.reconcileGrantedItems(actor);
  });
});

Hooks.on("deleteItem", (item, options, userId) => {
  clearPktCacheForCompendiumDocument(item);
  if (!isActingUser(userId)) return;
  if (
    options?.cyberpunkRemasterModelOperation ||
    options?.cyberpunkRemasterManaged
  ) {
    return;
  }
  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  const isManagedGrant =
    typeof CyberwareTab.getFlag(item, "grantedByImplantId") === "string";
  if (
    !CyberwareTab.isCyberware(item) &&
    !CyberwareTab.hasHumanityRule(item) &&
    !isManagedGrant
  ) {
    return;
  }
  void enqueueActor(actor, async () => {
    if (CyberwareTab.isPktBody(item) && CyberwareTab.isInstalled(item)) {
      await CyberwareTab.ejectPktComponents(actor, item.id);
    }
    await CyberwareTab.detachModules(actor, item.id);
    await CyberwareTab.reconcileHumanity(actor);
    await CyberwareTab.reconcileGrantedItems(actor);
  });
});

for (const documentName of ["JournalEntry", "JournalEntryPage"]) {
  for (const operation of ["create", "update", "delete"]) {
    Hooks.on(`${operation}${documentName}`, (document) => {
      clearPktCacheForCompendiumDocument(document);
    });
  }
}

Hooks.on("preDeleteItem", (item, options, userId) => {
  if (!isActingUser(userId)) return;
  if (
    options?.cyberpunkRemasterMigration ||
    options?.cyberpunkRemasterManaged ||
    options?.cyberpunkRemasterModelOperation
  ) {
    return;
  }
  const actor = item.actor;
  if (!actor || actor.type !== "character") return;
  const validation = CyberwareTab.removalValidation(actor, item);
  if (validation) {
    ui.notifications.warn(`${item.name}: ${validation}`);
    return false;
  }
});

// Wisdom and other actor changes may alter the Humanity ceiling. The queue
// serializes the clamp with item hooks and prevents hidden current-value healing.
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (!isActingUser(userId) || actor.type !== "character") return;
  if (options?.cyberpunkRemasterMigration) return;
  if (hasChange(changes, `flags.${MODULE_ID}.humanity`)) return;
  void enqueueActor(actor, () => CyberwareTab.reconcileHumanity(actor));
});

async function removeEmbeddedNetrunnerInterfaceScan(actor) {
  const embeddedActions = [...actor.items].filter(
    (item) =>
      item.id === NETRUNNER_SCAN_ID ||
      item.sourceId === NETRUNNER_SCAN_UUID ||
      item.system?.slug === NETRUNNER_SCAN_SLUG,
  );
  if (!embeddedActions.length) return 0;
  await actor.deleteEmbeddedDocuments(
    "Item",
    embeddedActions.map((item) => item.id),
    {
      render: false,
      cyberpunkRemasterMigration: true,
    },
  );
  return embeddedActions.length;
}

async function normalizeCyberwareActor(actor) {
  const normalized = {
    bodies: 0,
    neuralAccelerators: 0,
    exclusiveImplants: 0,
    pktComponents: 0,
    netrunnerActionsRemoved: 0,
    descriptionMetadata: 0,
  };
  const itemState = actor.items
    .filter((item) => !CyberwareTab.isExternalBioware(item))
    .map((item) => {
    const current = item.flags?.[MODULE_ID] ?? {};
    const legacy = item.flags?.[LEGACY_MODULE_ID] ?? {};
    const value = (key) => current[key] ?? legacy[key];
    const installed =
      typeof value("installed") === "boolean"
        ? value("installed")
        : item.system?.equipped?.carryType === "implanted";
    return {
      item,
      current,
      legacy,
      value,
      installed,
      type: CyberwareTab.getImplantType(item),
      descriptionMetadata: CyberwareTab.readCyberwareDescription(item),
      parentId: value("parentId") ?? null,
      normalized: false,
    };
  });

  const hasInstalledBiosystem = itemState.some(
    (state) => state.installed && CyberwareTab.isPktBiosystem(state.item),
  );
  const installedBodies = itemState.filter(
    (state) => state.installed && CyberwareTab.isPktBody(state.item),
  );
  const bodyAllowed =
    hasInstalledBiosystem ||
    CyberwareTab.getRuleSetting("allowPktBodyWithoutBiosystem") === true;
  const retainedBodies = bodyAllowed
    ? CyberwareTab.getRuleSetting("allowMultiplePktBodies") === true
      ? installedBodies
      : installedBodies.slice(0, 1)
    : [];
  for (const state of installedBodies) {
    if (retainedBodies.includes(state)) continue;
    state.installed = false;
    state.normalized = true;
    normalized.bodies++;
  }

  const installedAccelerators = itemState.filter(
    (state) =>
      state.installed &&
      (state.item.traits?.has?.("neironn-uskoritell") ||
        state.item.system?.traits?.value?.includes?.("neironn-uskoritell")),
  );
  if (CyberwareTab.getRuleSetting("allowMultipleNeuralAccelerators") !== true) {
    for (const state of installedAccelerators.slice(1)) {
      state.installed = false;
      state.normalized = true;
      normalized.neuralAccelerators++;
    }
  }

  const exclusiveFamilies = new Map();
  for (const state of itemState) {
    if (!state.installed) continue;
    const family = CyberwareTab.getExclusiveFamily(state.item);
    if (!family) continue;
    if (
      family === "cyberdeck" &&
      CyberwareTab.getRuleSetting("allowMultipleCyberdecks") === true
    ) {
      continue;
    }
    if (exclusiveFamilies.has(family)) {
      state.installed = false;
      state.normalized = true;
      normalized.exclusiveImplants++;
    } else {
      exclusiveFamilies.set(family, state);
    }
  }

  if (
    !retainedBodies.length &&
    CyberwareTab.getRuleSetting("allowPktWithoutBody") !== true
  ) {
    for (const state of itemState) {
      if (
        state.installed &&
        !CyberwareTab.isPktBody(state.item) &&
        CyberwareTab.isPktOnly(state.item)
      ) {
        state.installed = false;
        state.normalized = true;
        normalized.pktComponents++;
      }
    }
  }

  const installedBaseIds = new Set(
    itemState
      .filter((state) => state.installed && state.type === "base")
      .map((state) => state.item.id),
  );

  const updates = [];
  for (const state of itemState) {
    const {
      item,
      current,
      legacy,
      installed,
      type,
      descriptionMetadata,
      parentId,
    } = state;
    if (
      !CyberwareTab.isCyberware(item) &&
      !CyberwareTab.isPktOnly(item) &&
      !CyberwareTab.isPktBiosystem(item) &&
      !state.normalized &&
      !Object.keys(state.legacy).length &&
      !Object.keys(current).length
    ) {
      continue;
    }

    const preserveUninstalledInventoryState =
      !installed &&
      item.type === "equipment" &&
      item.system?.equipped?.carryType !== "implanted";
    const update = preserveUninstalledInventoryState
      ? CyberwareTab.deleteFlagUpdate(
          CyberwareTab.deleteFlagUpdate(
            {
              _id: item.id,
              [`flags.${MODULE_ID}.installed`]: false,
            },
            MODULE_ID,
            "parentId",
          ),
          MODULE_ID,
          "previousCarryState",
        )
      : CyberwareTab.installationUpdate(item, installed);

    const describedFlagKeys = new Set();
    if (descriptionMetadata.implantType) describedFlagKeys.add("implantType");
    if (descriptionMetadata.hardCost !== null)
      describedFlagKeys.add("hardCost");
    if (descriptionMetadata.stressFormula !== null) {
      describedFlagKeys.add("stressFormula");
    }
    if (descriptionMetadata.slots !== null) {
      describedFlagKeys.add("slots");
      describedFlagKeys.add("slotsUsed");
    }
    if (
      descriptionMetadata.implantType ||
      descriptionMetadata.hardCost !== null ||
      descriptionMetadata.stressFormula !== null
    ) {
      describedFlagKeys.add("schema");
      describedFlagKeys.add("cyberware");
    }
    let removedDescriptionMetadata = false;
    for (const [scope, values] of [
      [MODULE_ID, current],
      [LEGACY_MODULE_ID, legacy],
    ]) {
      for (const key of describedFlagKeys) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          CyberwareTab.deleteFlagUpdate(update, scope, key);
          removedDescriptionMetadata = true;
        }
      }
    }
    if (removedDescriptionMetadata) normalized.descriptionMetadata++;

    const validParent =
      installed &&
      type === "module" &&
      parentId &&
      installedBaseIds.has(parentId);
    if (validParent) {
      update[`flags.${MODULE_ID}.parentId`] = parentId;
    } else if (parentId) {
      CyberwareTab.deleteFlagUpdate(update, MODULE_ID, "parentId");
    }
    updates.push(update);
  }

  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      render: false,
      cyberpunkRemasterMigration: true,
    });
  }

  const currentHumanity =
    actor.flags?.[MODULE_ID]?.humanity ??
    actor.flags?.[LEGACY_MODULE_ID]?.humanity;
  if (currentHumanity && !actor.flags?.[MODULE_ID]?.humanity) {
    await actor.setFlag(MODULE_ID, "humanity", currentHumanity);
  }
  await CyberwareTab.reconcileHumanity(actor);
  await CyberwareTab.reconcileGrantedItems(actor);
  if (Object.values(normalized).some((count) => count > 0)) {
    console.warn(
      `${MODULE_ID} | Normalized conflicting implants on ${actor.name}`,
      normalized,
    );
  }
  return normalized;
}

function emptyMigrationResult() {
  return {
    bodies: 0,
    neuralAccelerators: 0,
    exclusiveImplants: 0,
    pktComponents: 0,
    netrunnerActionsRemoved: 0,
    descriptionMetadata: 0,
  };
}

function addMigrationResult(target, result) {
  for (const key of Object.keys(target)) {
    target[key] += Number(result?.[key] ?? 0);
  }
}

const ACTOR_MIGRATIONS = [
  {
    version: 6,
    run: normalizeCyberwareActor,
  },
  {
    version: 7,
    run: async (actor) => ({
      ...emptyMigrationResult(),
      netrunnerActionsRemoved:
        await removeEmbeddedNetrunnerInterfaceScan(actor),
    }),
  },
];

export async function migrateActor(
  actor,
  { fromVersion = 0, toVersion = MIGRATION_VERSION } = {},
) {
  const result = emptyMigrationResult();
  for (const migration of ACTOR_MIGRATIONS) {
    if (migration.version <= fromVersion || migration.version > toVersion) {
      continue;
    }
    addMigrationResult(result, await migration.run(actor));
  }
  return result;
}

async function migrateWorld() {
  const current = game.settings.get(MODULE_ID, "migrationVersion");
  if (current >= MIGRATION_VERSION) return;

  console.info(
    `${MODULE_ID} | Migrating world data to schema ${MIGRATION_VERSION}`,
  );
  const normalized = {
    actors: 0,
    bodies: 0,
    neuralAccelerators: 0,
    exclusiveImplants: 0,
    pktComponents: 0,
    netrunnerActionsRemoved: 0,
    descriptionMetadata: 0,
  };
  for (const actor of game.actors.filter(
    (candidate) => candidate.type === "character",
  )) {
    const result = await migrateActor(actor, { fromVersion: current });
    const changed = Object.values(result).some((count) => count > 0);
    if (changed) normalized.actors++;
    normalized.bodies += result.bodies;
    normalized.neuralAccelerators += result.neuralAccelerators;
    normalized.exclusiveImplants += result.exclusiveImplants;
    normalized.pktComponents += result.pktComponents;
    normalized.netrunnerActionsRemoved += result.netrunnerActionsRemoved;
    normalized.descriptionMetadata += result.descriptionMetadata;
  }
  await game.settings.set(MODULE_ID, "migrationVersion", MIGRATION_VERSION);
  const implantChanges =
    normalized.bodies +
    normalized.neuralAccelerators +
    normalized.exclusiveImplants +
    normalized.pktComponents;
  const implantDetails = implantChanges
    ? ` Нормализованы конфликты имплантов у ${normalized.actors} ` +
      "персонаж(ей): " +
      `${normalized.bodies} корпус(ов) ПКТ, ` +
      `${normalized.neuralAccelerators} нейронных ускорител(ей), ` +
      `${normalized.exclusiveImplants} конфликтующих кибердек/модулей, ` +
      `${normalized.pktComponents} компонент(ов) ПКТ.`
    : "";
  const netrunnerDetails = normalized.netrunnerActionsRemoved
    ? ` Действие «Сканирование интерфейсов» убрано с листов ` +
      `${normalized.netrunnerActionsRemoved} персонаж(а/ей); оно осталось в журнале.`
    : "";
  const descriptionDetails = normalized.descriptionMetadata
    ? ` Описание стало источником параметров у ${normalized.descriptionMetadata} имплант(а/ов).`
    : "";
  ui.notifications.info(
    "SF2E Cyberpunk Remaster: миграция данных завершена." +
      implantDetails +
      netrunnerDetails +
      descriptionDetails,
  );
}

Hooks.once("ready", () => {
  if (!game.user.isGM) return;
  const activeGM = game.users?.activeGM;
  if (activeGM && activeGM.id !== game.user.id) return;
  void migrateWorld().catch((error) => {
    console.error(`${MODULE_ID} | Migration failed`, error);
    ui.notifications.error(
      `SF2E Cyberpunk Remaster: миграция не завершена — ${error.message}`,
    );
  });
});
