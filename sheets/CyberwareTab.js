import {
  HUMANITY_RULE_KEY,
  HUMANITY_SYNTHETIC_KEY,
} from "../rule-elements/HumanityRuleElement.js";
import {
  IMPLANT_TYPE_LABELS as TYPE_LABELS,
  KNOWN_IMPLANT_TYPES as KNOWN_TYPES,
  LEGACY_MODULE_ID,
  MAX_SLOT_DOTS,
  MAX_SLOTS,
  MODULE_ID,
  RULE_SETTING_DEFAULTS,
  descriptionText as schemaDescriptionText,
  isKnownPktBiosystem,
  isKnownPktBody,
  itemSourceId as schemaItemSourceId,
  parseCyberwareDescription,
  pktBodyQuality,
  safeInt,
} from "../runtime/cyberware-schema.mjs";
import { enqueueActorOperation } from "../runtime/actor-operation-queue.mjs";
import {
  applyHumanityAdjustments as applyHumanityAdjustmentList,
  calculateHumanity,
  humanityState,
} from "../runtime/humanity.mjs";
import {
  clearPktCatalogCache,
  loadPktCatalog,
} from "../runtime/pkt-catalog.mjs";
import {
  buildPktInstallationPlan,
  parseStressDice,
  summarizePktHumanityLoss,
} from "../runtime/pkt-model.mjs";

const activeTabs = new Set();
const scrollPositions = new Map();

const renderTemplate =
  globalThis.foundry?.applications?.handlebars?.renderTemplate ??
  globalThis.renderTemplate;

const PKT_ITEM_PACK = `${MODULE_ID}.cyberpunk-items`;
const PKT_JOURNAL_PACK = `${MODULE_ID}.cyberpunk-journals`;

const PHYSICAL_TYPES = new Set([
  "ammo",
  "armor",
  "backpack",
  "consumable",
  "equipment",
  "shield",
  "treasure",
  "weapon",
]);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

function getChange(changes, path) {
  if (hasOwn(changes, path)) return changes[path];
  return globalThis.foundry?.utils?.getProperty?.(changes, path);
}

function hasChange(changes, path) {
  return (
    hasOwn(changes, path) ||
    globalThis.foundry?.utils?.hasProperty?.(changes, path) === true
  );
}

function isInvestedItem(item) {
  return (
    item.traits?.has?.("invested") ||
    item.system?.traits?.value?.includes?.("invested") === true
  );
}

function notifyError(error, fallback) {
  console.error(`${MODULE_ID} | ${fallback}`, error);
  globalThis.ui?.notifications?.error?.(error?.message || fallback);
}

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  return [...collection].map((value) =>
    Array.isArray(value) && value.length === 2 ? value[1] : value,
  );
}

function compareByName(left, right) {
  return String(left?.name ?? "").localeCompare(
    String(right?.name ?? ""),
    "ru",
    { sensitivity: "base", numeric: true },
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export class CyberwareTab {
  static getRuleSetting(key) {
    const fallback = RULE_SETTING_DEFAULTS[key];
    try {
      const value = globalThis.game?.settings?.get?.(MODULE_ID, key);
      return value ?? fallback;
    } catch {
      // Tests, pack-building scripts, and worlds from before the setting was
      // registered all retain the rules that were previously hard-coded.
      return fallback;
    }
  }

  static getHardCostMultiplier() {
    const configured = Number(this.getRuleSetting("hardCostMultiplier"));
    return Number.isFinite(configured)
      ? Math.min(2, Math.max(0, configured))
      : RULE_SETTING_DEFAULTS.hardCostMultiplier;
  }

  static sheetKey(app) {
    return String(
      app?.id ??
        app?.appId ??
        `${app?.constructor?.name ?? "ActorSheet"}:${app?.actor?.uuid ?? app?.actor?.id ?? "unknown"}`,
    );
  }

  static clearSheetState(app) {
    const key = this.sheetKey(app);
    activeTabs.delete(key);
    scrollPositions.delete(key);
  }

  static canMutate(app) {
    const actor = app?.actor;
    const editable = app?.isEditable ?? actor?.isOwner;
    return Boolean(
      editable &&
      actor?.isOwner &&
      !(actor.limited && !globalThis.game?.user?.isGM),
    );
  }

  static inject(app, element) {
    const actor = app?.actor;
    if (!actor || (actor.limited && !globalThis.game?.user?.isGM)) return;
    const sheetKey = this.sheetKey(app);

    const nav = element.querySelector(
      "nav.sheet-navigation, nav.sheet-tabs, nav.tabs",
    );
    const content =
      element.querySelector("section.sheet-body .sheet-content") ||
      element.querySelector(".sheet-content") ||
      element.querySelector("section.sheet-body, .sheet-body");
    if (!nav || !content || nav.querySelector('[data-tab="cyberware"]')) return;

    const group = nav.dataset.group || "primary";
    const label = "Хром";
    const navItem = document.createElement("a");
    navItem.className = "item";
    navItem.dataset.tab = "cyberware";
    navItem.dataset.group = group;
    navItem.dataset.tooltip = label;
    navItem.title = label;
    navItem.setAttribute("aria-label", label);
    navItem.setAttribute("role", "tab");
    navItem.setAttribute("tabindex", "0");
    navItem.innerHTML =
      '<i class="fa-solid fa-microchip" aria-hidden="true"></i>';

    const manageButton = nav.querySelector(
      ".manage-tabs, [data-action='manage-tabs']",
    );
    if (manageButton) nav.insertBefore(navItem, manageButton);
    else nav.appendChild(navItem);

    const tabElement = document.createElement("section");
    tabElement.className = "tab cyberware";
    tabElement.dataset.tab = "cyberware";
    tabElement.dataset.group = group;
    content.appendChild(tabElement);

    const setPanelTitle = () => {
      const title = nav.querySelector(":scope > .panel-title");
      if (title) title.textContent = label;
    };

    const activate = (name) => {
      if (typeof app.activateTab === "function") {
        app.activateTab(name, { triggerCallback: true });
      } else {
        nav.querySelectorAll("[data-tab]").forEach((item) => {
          item.classList.toggle("active", item.dataset.tab === name);
          item.setAttribute(
            "aria-selected",
            item.dataset.tab === name ? "true" : "false",
          );
        });
        content.querySelectorAll(":scope > .tab").forEach((tab) => {
          tab.classList.toggle("active", tab.dataset.tab === name);
        });
      }
      if (name === "cyberware") setPanelTitle();
    };

    const openCyberware = (event) => {
      event.preventDefault();
      event.stopPropagation();
      activeTabs.add(sheetKey);
      activate("cyberware");
    };

    navItem.addEventListener("click", openCyberware);
    navItem.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openCyberware(event);
    });

    nav.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-tab]");
      if (!tab || tab.dataset.tab === "cyberware") return;
      activeTabs.delete(sheetKey);
    });

    void this.render(app, tabElement).catch((error) => {
      notifyError(error, "Не удалось отрисовать вкладку «Хром».");
    });

    if (activeTabs.has(sheetKey)) {
      activate("cyberware");
      setPanelTitle();
    }
  }

  static async render(app, container) {
    if (typeof renderTemplate !== "function") {
      throw new Error("Foundry renderTemplate API is unavailable.");
    }

    let pktModels = [];
    let pktReplacements = [];
    let pktModelsError = "";
    try {
      const pktContent = await this.loadPktContent();
      pktModels = pktContent.models;
      pktReplacements = pktContent.replacements;
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to load PKT models`, error);
      pktModelsError = error?.message || "Не удалось загрузить модели ПКТ.";
    }
    const data = this.prepareData(app.actor, {
      editable: this.canMutate(app),
      pktModels,
      pktReplacements,
      pktModelsError,
    });
    const domKey = this.sheetKey(app).replace(/[^A-Za-z0-9_-]/g, "-");
    data.humanityHeadingId = `cw-humanity-heading-${domKey}`;
    data.humanityInputId = `cw-humanity-current-${domKey}`;
    const html = await renderTemplate(
      `modules/${MODULE_ID}/templates/cyberware-tab.hbs`,
      data,
    );
    if (!container.isConnected) return;

    container.innerHTML = html;
    const scroller = container.querySelector(".cw-tab");
    if (scroller) {
      scroller.scrollTop = scrollPositions.get(this.sheetKey(app)) ?? 0;
    }
    this.activateListeners(app, container);
  }

  static prepareData(
    actor,
    {
      editable = true,
      pktModels = [],
      pktReplacements = [],
      pktModelsError = "",
    } = {},
  ) {
    const cyberware = actor.items.filter((item) => this.isCyberware(item));
    const installed = cyberware.filter((item) => this.isInstalled(item));
    const typeOf = (item) => this.getImplantType(item);
    const ignoreSlotLimits = this.getRuleSetting("ignoreSlotLimits") === true;

    const pktBodies = installed.filter((item) => this.isPktBody(item));
    const bases = installed
      .filter((item) => !this.isPktBody(item) && typeOf(item) === "base")
      .sort(compareByName);
    const internals = installed.filter(
      (item) => !this.isPktBody(item) && typeOf(item) === "internal",
    );
    const externals = installed.filter(
      (item) => !this.isPktBody(item) && typeOf(item) === "external",
    );
    const fashion = installed.filter(
      (item) => !this.isPktBody(item) && typeOf(item) === "fashion",
    );
    const modules = installed.filter(
      (item) => !this.isPktBody(item) && typeOf(item) === "module",
    );
    const baseIds = new Set(bases.map((base) => base.id));

    const baseUsage = new Map(
      bases.map((base) => {
        const used = modules
          .filter((module) => this.getFlag(module, "parentId") === base.id)
          .reduce((sum, module) => sum + this.getSlotsUsed(module), 0);
        return [base.id, used];
      }),
    );

    const baseOptions = (module, currentBaseId = null) => {
      const slotsUsed = this.getSlotsUsed(module);
      return bases.map((base) => {
        const total = this.getSlots(base);
        const used =
          (baseUsage.get(base.id) ?? 0) -
          (base.id === currentBaseId ? slotsUsed : 0);
        const remaining = Math.max(0, total - used);
        return {
          id: base.id,
          name: base.name,
          remaining,
          canFit: ignoreSlotLimits || used + slotsUsed <= total,
          current: base.id === currentBaseId,
        };
      });
    };

    const moduleView = (module, currentBaseId = null) => {
      const options = baseOptions(module, currentBaseId);
      return {
        id: module.id,
        name: module.name,
        img: module.img,
        installed: this.isInstalled(module),
        slotsUsed: this.getSlotsUsed(module),
        baseOptions: options,
        hasCompatibleBase: options.some(
          (option) => option.canFit && !option.current,
        ),
      };
    };

    const basesData = bases.map((base) => {
      const totalSlots = this.getSlots(base);
      const attached = modules.filter(
        (module) => this.getFlag(module, "parentId") === base.id,
      );
      const usedSlots = baseUsage.get(base.id) ?? 0;
      const dotCount = Math.min(totalSlots, MAX_SLOT_DOTS);
      const replacementAllowed = this.isPktModelBaseReplaceable(base);
      const replacementOptions = replacementAllowed
        ? this.pktBaseReplacementOptions(
            actor,
            base,
            pktReplacements,
            usedSlots,
          )
        : [];
      return {
        id: base.id,
        name: base.name,
        img: base.img,
        totalSlots,
        usedSlots,
        full: usedSlots >= totalSlots,
        hiddenSlotDots: Math.max(0, totalSlots - dotCount),
        pktModelBase: Boolean(this.getFlag(base, "pktModelKey")),
        replacementAllowed,
        replacementLocked:
          Boolean(this.getFlag(base, "pktModelKey")) && !replacementAllowed,
        replacementOptions,
        hasUsableReplacement: replacementOptions.some(
          (option) => option.canUse,
        ),
        slotDots: Array.from({ length: dotCount }, (_, index) => ({
          filled: index < Math.min(usedSlots, dotCount),
        })),
        modules: attached.map((module) => moduleView(module, base.id)),
      };
    });

    const unlinked = modules
      .filter((module) => {
        const parentId = this.getFlag(module, "parentId");
        return !parentId || !baseIds.has(parentId);
      })
      .map((module) => moduleView(module));

    const notInstalled = cyberware
      .filter((item) => !this.isInstalled(item))
      .map((item) => {
        const type = typeOf(item);
        const options = type === "module" ? baseOptions(item) : [];
        return {
          id: item.id,
          name: item.name,
          img: item.img,
          type,
          typeLabel: this.isPktBody(item)
            ? "Корпус ПКТ"
            : (TYPE_LABELS[type] ?? ""),
          hardCost: this.getHardCost(item),
          draggableModule: type === "module",
          baseOptions: options,
          hasCompatibleBase: options.some((option) => option.canFit),
        };
      });

    const unconfigured = installed
      .filter((item) => !this.isPktBody(item) && !typeOf(item))
      .map((item) => ({
        id: item.id,
        name: item.name,
        img: item.img,
        installed: true,
      }));

    const humanity = this.getHumanity(actor, installed);
    const hardCostMultiplier = this.getHardCostMultiplier();
    const humanityStatePercent =
      humanity.maxPossible > 0
        ? Math.min(
            100,
            Math.round((humanity.current / humanity.maxPossible) * 100),
          )
        : 0;
    const humanityCapacityPercent =
      humanity.max > 0
        ? Math.min(100, Math.round((humanity.current / humanity.max) * 100))
        : 0;
    const installedPktModelKey = collectionValues(actor.items)
      .map((item) => this.getFlag(item, "pktModelKey"))
      .find(Boolean);
    const visiblePktModels =
      installedPktModelKey &&
      pktModels.some((model) => model.key === installedPktModelKey)
        ? pktModels.filter((model) => model.key === installedPktModelKey)
        : pktModels;
    const pktModelViews = visiblePktModels.map((model) =>
      this.pktModelView(actor, model, { editable }),
    );
    const hasInstalledPktBiosystem = installed.some((item) =>
      this.isPktBiosystem(item),
    );

    return {
      editable,
      readOnly: !editable,
      humanity,
      humanityHardCostTitle:
        hardCostMultiplier === 1
          ? "Предел − суммарный Hard Cost установленных имплантов"
          : "Предел − округлённый вверх суммарный Hard Cost × " +
            new Intl.NumberFormat("ru-RU", {
              maximumFractionDigits: 1,
            }).format(hardCostMultiplier),
      humanityPercent: humanityStatePercent,
      humanityStatePercent,
      humanityCapacityPercent,
      humanityState: this.getHumanityState(humanityStatePercent),
      hasCyberware: cyberware.length > 0,
      unconfigured,
      notInstalled,
      pktBodies: pktBodies.map((item) => ({
        id: item.id,
        name: item.name,
        img: item.img,
      })),
      hasPktBody: pktBodies.length > 0,
      multiplePktBodies:
        this.getRuleSetting("allowMultiplePktBodies") !== true &&
        pktBodies.length > 1,
      missingPktBiosystem:
        this.getRuleSetting("allowPktBodyWithoutBiosystem") !== true &&
        pktBodies.length > 0 &&
        !installed.some((item) => this.isPktBiosystem(item)),
      pktModels: pktModelViews,
      pktModelsError,
      hasPktModels: pktModelViews.length > 0,
      showPktModels:
        hasInstalledPktBiosystem ||
        (this.getRuleSetting("allowPktBodyWithoutBiosystem") === true &&
          pktBodies.length > 0),
      pktImplants: installed
        .filter((item) => this.isPktOnly(item))
        .map((item) => ({ id: item.id, name: item.name, img: item.img })),
      bases: basesData,
      baseDock: basesData.map((base) => ({
        id: base.id,
        name: base.name,
        usedSlots: base.usedSlots,
        totalSlots: base.totalSlots,
      })),
      internals: internals.map((item) => this.simpleItemView(item)),
      externals: externals.map((item) => this.simpleItemView(item)),
      fashion: fashion.map((item) => this.simpleItemView(item)),
      unlinked,
    };
  }

  static simpleItemView(item) {
    return { id: item.id, name: item.name, img: item.img };
  }

  static clearPktContentCache() {
    clearPktCatalogCache();
  }

  static async loadPktContent({ refresh = false } = {}) {
    return loadPktCatalog({
      game: globalThis.game,
      itemPackId: PKT_ITEM_PACK,
      journalPackId: PKT_JOURNAL_PACK,
      getFlag: (item, key) => this.getFlag(item, key),
      getImplantType: (item) => this.getImplantType(item),
      getSlots: (item) => this.getSlots(item),
      readCyberwareDescription: (item) => this.readCyberwareDescription(item),
      refresh,
    });
  }

  static async loadPktModels(options = {}) {
    return (await this.loadPktContent(options)).models;
  }

  static itemSourceId(item) {
    return schemaItemSourceId(item) ?? this.getFlag(item, "sourceId") ?? "";
  }

  static pktModelValidation(actor, model) {
    const items = collectionValues(actor?.items);
    const modelItem = items.find((item) => this.getFlag(item, "pktModelKey"));
    if (modelItem) {
      const key = this.getFlag(modelItem, "pktModelKey");
      return key === model.key
        ? `Модель «${model.name}» уже установлена или установлена частично.`
        : `Сначала демонтируйте установленную модель ПКТ «${key}».`;
    }

    const biosystem = items.find(
      (item) => this.isPktBiosystem(item) && this.isInstalled(item),
    );
    if (
      !biosystem &&
      this.getRuleSetting("allowPktBodyWithoutBiosystem") !== true
    ) {
      return "Сначала установите Биосистему.";
    }

    const bodies = items.filter(
      (item) => this.isPktBody(item) && this.isInstalled(item),
    );
    if (!bodies.length) {
      return "Сначала установите корпус Полной Конверсии Тела.";
    }

    if (
      this.getRuleSetting("ignorePktQualityLimits") !== true &&
      !bodies.some((body) => this.pktBodyMatchesModel(body, model))
    ) {
      return `Нужен корпус качества не ниже «${model.requiredBodyName}».`;
    }
    return null;
  }

  static pktBodyMatchesModel(body, model) {
    const bodyQuality = this.getPktBodyQuality(body);
    return (
      this.itemSourceId(body) === model.requiredBodyId ||
      (Number.isFinite(bodyQuality) && bodyQuality >= Number(model.bodyQuality))
    );
  }

  static pktModelBody(actor, model) {
    const bodies = collectionValues(actor?.items).filter(
      (item) => this.isPktBody(item) && this.isInstalled(item),
    );
    if (this.getRuleSetting("ignorePktQualityLimits") === true) {
      return bodies[0] ?? null;
    }
    return bodies.find((body) => this.pktBodyMatchesModel(body, model)) ?? null;
  }

  static pktModelView(actor, model, { editable = true } = {}) {
    const entries = [...(model.unique ?? []), ...(model.components ?? [])];
    const quantityOf = (entry) => Math.max(1, safeInt(entry.quantity));
    const fixedCount = entries.reduce(
      (sum, entry) => sum + quantityOf(entry),
      0,
    );
    const choiceCount = (model.choices ?? []).reduce(
      (sum, choice) => sum + Math.max(1, safeInt(choice.choose)),
      0,
    );
    const validation = this.pktModelValidation(actor, model);
    const installedItems = collectionValues(actor?.items).filter(
      (item) => this.getFlag(item, "pktModelKey") === model.key,
    );
    return {
      ...model,
      priceLabel: new Intl.NumberFormat("ru-RU").format(
        safeInt(model.priceEddies, { max: Number.MAX_SAFE_INTEGER }),
      ),
      componentCount: fixedCount + choiceCount,
      entries: entries.map((entry) => ({
        ...entry,
        quantity: quantityOf(entry),
      })),
      choices: (model.choices ?? []).map((choice) => ({
        ...choice,
        choose: Math.max(1, safeInt(choice.choose)),
      })),
      validation,
      canInstall: editable && !validation,
      installed: installedItems.length > 0,
      installedCount: installedItems.length,
    };
  }

  static stressDiceForFormula(formula) {
    return parseStressDice(formula);
  }

  static pktHumanityLossSummary(plan, sources = null) {
    return summarizePktHumanityLoss(plan, {
      sources,
      getStressFormula: (item) => this.getStressFormula(item),
      parseStressDice: (formula) => this.stressDiceForFormula(formula),
    });
  }

  static pktInstallationPlan(model, selections = {}) {
    return buildPktInstallationPlan(model, selections);
  }

  static getFlag(item, key) {
    return (
      item.flags?.[MODULE_ID]?.[key] ?? item.flags?.[LEGACY_MODULE_ID]?.[key]
    );
  }

  static getGrantItemUuids(item) {
    const value = this.getFlag(item, "grantItemUuids");
    return Array.isArray(value)
      ? [...new Set(value.filter((uuid) => typeof uuid === "string" && uuid))]
      : [];
  }

  static getExclusiveFamily(item) {
    const value = this.getFlag(item, "exclusiveFamily");
    return typeof value === "string" && value ? value : null;
  }

  static validationSnapshot(item, installed = this.isInstalled(item)) {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      flags: {
        [MODULE_ID]: {
          ...(item.flags?.[MODULE_ID] ?? {}),
          installed,
        },
        [LEGACY_MODULE_ID]: {
          ...(item.flags?.[LEGACY_MODULE_ID] ?? {}),
        },
      },
      system: {
        description: {
          value: item.system?.description?.value ?? "",
        },
        equipped: {
          ...(item.system?.equipped ?? {}),
          carryType: installed ? "implanted" : item.system?.equipped?.carryType,
        },
        traits: {
          value: [...(item.system?.traits?.value ?? [])],
        },
        usage: item.system?.usage,
      },
    };
  }

  static descriptionText(item) {
    return schemaDescriptionText(item);
  }

  static readCyberwareDescription(item) {
    return parseCyberwareDescription(item);
  }

  static getHardCost(item) {
    const described = this.readCyberwareDescription(item).hardCost;
    if (described !== null) return described;
    const flagged = this.getFlag(item, "hardCost");
    if (flagged !== undefined && flagged !== null) return safeInt(flagged);
    return 0;
  }

  static getStressFormula(item) {
    const described = this.readCyberwareDescription(item).stressFormula;
    if (described !== null) return described;
    const flagged = this.getFlag(item, "stressFormula");
    if (typeof flagged === "string" && flagged) return flagged;
    return null;
  }

  static getImplantType(item) {
    const described = this.readCyberwareDescription(item).implantType;
    if (described) return described;
    if (this.isPktBiosystem(item)) return "internal";
    const flagged = this.getFlag(item, "implantType");
    return KNOWN_TYPES.includes(flagged) ? flagged : null;
  }

  static getSlotsValue(item, flagKey) {
    const described = this.readCyberwareDescription(item).slots;
    if (described !== null) return described;
    const flagged = this.getFlag(item, flagKey);
    if (flagged !== undefined && flagged !== null) return safeInt(flagged);
    return 0;
  }

  static getSlots(item) {
    return this.getSlotsValue(item, "slots");
  }

  static getSlotsUsed(item) {
    return this.getSlotsValue(item, "slotsUsed");
  }

  static isPktBody(item) {
    return (
      this.getFlag(item, "pktBody") === true ||
      isKnownPktBody(item) ||
      /^Полная\s+Конверсия\s+Тела\b/i.test(item.name ?? "")
    );
  }

  static getPktBodyQuality(item) {
    const known = pktBodyQuality(item);
    if (known !== undefined) return known;

    const name = String(item?.name ?? "");
    const names = [
      [/\[Серийная\]/iu, 0],
      [/\[Тактическая\]/iu, 1],
      [/\[Продвинутая\]/iu, 2],
      [/\[Превосходная\]/iu, 3],
      [/\[Элитная\]/iu, 4],
      [/\[Абсолютная\]/iu, 5],
    ];
    const named = names.find(([pattern]) => pattern.test(name));
    if (named) return named[1];

    const flagged = this.getFlag(item, "pktQuality");
    const quality = Number(flagged);
    return flagged !== undefined && flagged !== null && Number.isFinite(quality)
      ? quality
      : Number.NaN;
  }

  static isPktModelBaseReplaceable(item) {
    if (
      this.getImplantType(item) !== "base" ||
      !this.getFlag(item, "pktModelKey")
    ) {
      return false;
    }
    const explicit = this.getFlag(item, "pktReplaceableBase");
    if (typeof explicit === "boolean") return explicit;

    // Components installed by earlier module versions do not have the
    // per-model flag. Standard catalog bases are replaceable; unique bases
    // carry pktReplaceable=false and remain locked.
    return this.getFlag(item, "pktReplaceable") === true;
  }

  static pktBaseReplacementOptions(actor, base, catalog, usedSlots = null) {
    if (!this.isPktModelBaseReplaceable(base)) return [];
    const boundBodyId = this.getFlag(base, "pktBodyId");
    const bodies = collectionValues(actor?.items).filter(
      (item) => this.isPktBody(item) && this.isInstalled(item),
    );
    const body = bodies.find((item) => item.id === boundBodyId) ?? bodies[0];
    const bodyQuality = this.getPktBodyQuality(body);
    const family = this.getFlag(base, "pktFamily");
    if (!family || !Number.isFinite(bodyQuality)) return [];

    const currentSourceId =
      this.getFlag(base, "pktModelSourceId") || this.itemSourceId(base);
    const occupied =
      usedSlots ??
      collectionValues(actor?.items)
        .filter(
          (item) =>
            this.isInstalled(item) &&
            this.getImplantType(item) === "module" &&
            this.getFlag(item, "parentId") === base.id,
        )
        .reduce((sum, item) => sum + this.getSlotsUsed(item), 0);
    const ignoreQuality =
      this.getRuleSetting("ignorePktQualityLimits") === true;
    const ignoreSlots = this.getRuleSetting("ignoreSlotLimits") === true;

    return collectionValues(catalog)
      .filter(
        (candidate) =>
          candidate.itemId !== currentSourceId &&
          candidate.family === family &&
          candidate.replaceable === true &&
          Number.isFinite(candidate.quality) &&
          (ignoreQuality || candidate.quality <= bodyQuality + 1),
      )
      .map((candidate) => ({
        ...candidate,
        canUse: ignoreSlots || candidate.slots >= occupied,
        occupiedSlots: occupied,
      }))
      .sort(compareByName);
  }

  static isPktBiosystem(item) {
    return (
      this.getFlag(item, "pktBiosystem") === true ||
      isKnownPktBiosystem(item) ||
      /^Биосистема$/iu.test(item.name ?? "")
    );
  }

  static isPktOnly(item) {
    return (
      this.getFlag(item, "pktOnly") === true ||
      item.traits?.has?.("pkt") ||
      item.system?.traits?.value?.includes?.("pkt") === true
    );
  }

  static isCyberware(item) {
    const described = this.readCyberwareDescription(item);
    if (
      described.implantType ||
      described.hardCost !== null ||
      described.stressFormula !== null
    ) {
      return true;
    }
    if (this.isPktBody(item) || this.isPktBiosystem(item)) return true;
    const usage = item.system?.usage;
    if (usage?.type === "implanted" || usage?.value === "implanted")
      return true;
    return (
      this.getFlag(item, "cyberware") === true ||
      this.getImplantType(item) !== null
    );
  }

  static isInstalled(item) {
    const installed = this.getFlag(item, "installed");
    if (typeof installed === "boolean") return installed;
    return item.system?.equipped?.carryType === "implanted";
  }

  static getHumanity(actor, installed = null) {
    const implanted =
      installed ??
      actor.items.filter(
        (item) => this.isCyberware(item) && this.isInstalled(item),
      );
    return calculateHumanity({
      actor,
      installed: implanted,
      adjustments:
        actor?.synthetics?.[HUMANITY_SYNTHETIC_KEY]?.humanityAdjustments,
      getHardCost: (item) => this.getHardCost(item),
      hardCostMultiplier: this.getHardCostMultiplier(),
    });
  }

  static applyHumanityAdjustments(actor, baseValue) {
    const adjustments =
      actor?.synthetics?.[HUMANITY_SYNTHETIC_KEY]?.humanityAdjustments ?? [];
    return applyHumanityAdjustmentList(adjustments, baseValue);
  }

  static hasHumanityRule(item) {
    return (item?.system?.rules ?? []).some(
      (rule) => rule?.key === HUMANITY_RULE_KEY,
    );
  }

  static async reconcileHumanity(actor) {
    const humanity = this.getHumanity(actor);
    const stored =
      actor.flags?.[MODULE_ID]?.humanity ??
      actor.flags?.[LEGACY_MODULE_ID]?.humanity ??
      {};
    if (
      stored.current === humanity.current &&
      actor.flags?.[MODULE_ID]?.humanity
    ) {
      return;
    }
    await actor.setFlag(MODULE_ID, "humanity", {
      current: humanity.current,
    });
  }

  static async reconcileGrantedItems(actor) {
    const items = collectionValues(actor?.items);
    const installed = items.filter(
      (item) => this.isCyberware(item) && this.isInstalled(item),
    );
    const expected = new Map();
    for (const implant of installed) {
      for (const uuid of this.getGrantItemUuids(implant)) {
        expected.set(`${implant.id}:${uuid}`, { implant, uuid });
      }
    }

    const managed = items.filter(
      (item) =>
        typeof this.getFlag(item, "grantedByImplantId") === "string" &&
        typeof this.getFlag(item, "grantedSourceUuid") === "string",
    );
    const retainedKeys = new Set();
    const deleteIds = [];
    for (const item of managed) {
      const key =
        `${this.getFlag(item, "grantedByImplantId")}:` +
        this.getFlag(item, "grantedSourceUuid");
      if (expected.has(key) && !retainedKeys.has(key)) {
        retainedKeys.add(key);
      } else {
        deleteIds.push(item.id);
      }
    }

    if (deleteIds.length) {
      await actor.deleteEmbeddedDocuments("Item", deleteIds, {
        cyberpunkRemasterManaged: true,
      });
    }

    const ownedSources = new Set(
      items
        .filter((item) => !managed.includes(item))
        .map(
          (item) =>
            item.sourceId ??
            item._stats?.compendiumSource ??
            item._source?._stats?.compendiumSource,
        )
        .filter(Boolean),
    );
    const createData = [];
    const fromUuid = globalThis.fromUuid;
    for (const [key, grant] of expected) {
      if (retainedKeys.has(key) || ownedSources.has(grant.uuid)) continue;
      if (typeof fromUuid !== "function") {
        throw new Error(
          `Foundry не может загрузить выданный предмет ${grant.uuid}.`,
        );
      }
      const document = await fromUuid(grant.uuid);
      if (!document?.toObject) {
        throw new Error(`Не найден выданный предмет ${grant.uuid}.`);
      }
      const source = document.toObject();
      delete source._id;
      delete source.folder;
      delete source.ownership;
      source.flags ??= {};
      source.flags[MODULE_ID] = {
        ...(source.flags[MODULE_ID] ?? {}),
        grantedByImplantId: grant.implant.id,
        grantedSourceUuid: grant.uuid,
      };
      source._stats ??= {};
      source._stats.compendiumSource = grant.uuid;
      createData.push(source);
    }

    const created = createData.length
      ? await actor.createEmbeddedDocuments("Item", createData, {
          cyberpunkRemasterManaged: true,
        })
      : [];
    return { created, deleted: deleteIds.length };
  }

  static getHumanityState(percent) {
    return humanityState(percent);
  }

  static installationValidation(actor, item) {
    const hasTrait = (candidate, trait) =>
      candidate.traits?.has?.(trait) ||
      candidate.system?.traits?.value?.includes?.(trait) === true;

    const exclusiveFamily = this.getExclusiveFamily(item);
    if (
      exclusiveFamily &&
      !(
        exclusiveFamily === "cyberdeck" &&
        this.getRuleSetting("allowMultipleCyberdecks") === true
      )
    ) {
      const existing = actor.items.find(
        (candidate) =>
          candidate.id !== item.id &&
          this.isInstalled(candidate) &&
          this.getExclusiveFamily(candidate) === exclusiveFamily,
      );
      if (existing) {
        return exclusiveFamily === "cyberdeck"
          ? `Уже установлена кибердека «${existing.name}». Одновременно разрешена только одна.`
          : `Уже установлен имплант этой серии «${existing.name}». Одновременно разрешён только один.`;
      }
    }

    if (
      hasTrait(item, "neironn-uskoritell") &&
      this.getRuleSetting("allowMultipleNeuralAccelerators") !== true
    ) {
      const existing = actor.items.find(
        (candidate) =>
          candidate.id !== item.id &&
          this.isInstalled(candidate) &&
          hasTrait(candidate, "neironn-uskoritell"),
      );
      if (existing) {
        return `Уже установлен нейронный ускоритель «${existing.name}». Одновременно разрешён только один.`;
      }
    }

    if (
      this.isPktOnly(item) &&
      this.getRuleSetting("allowPktWithoutBody") !== true
    ) {
      const hasBody = actor.items.some(
        (candidate) =>
          candidate.id !== item.id &&
          this.isPktBody(candidate) &&
          this.isInstalled(candidate),
      );
      if (!hasBody) {
        return "Имплант с признаком ПКТ требует установленный корпус Полной Конверсии Тела.";
      }
    }

    if (this.isPktBody(item)) {
      const hasBiosystem = actor.items.some(
        (candidate) =>
          candidate.id !== item.id &&
          this.isPktBiosystem(candidate) &&
          this.isInstalled(candidate),
      );
      if (
        !hasBiosystem &&
        this.getRuleSetting("allowPktBodyWithoutBiosystem") !== true
      ) {
        return "Корпус Полной Конверсии Тела требует установленную Биосистему.";
      }
      const otherBody = actor.items.find(
        (candidate) =>
          candidate.id !== item.id &&
          this.isPktBody(candidate) &&
          this.isInstalled(candidate),
      );
      if (otherBody && this.getRuleSetting("allowMultiplePktBodies") !== true) {
        return `Уже установлен корпус ПКТ «${otherBody.name}». Сначала извлеките его.`;
      }
    }
    return null;
  }

  static removalValidation(actor, item) {
    if (
      this.getFlag(item, "pktLocked") === true &&
      this.getFlag(item, "pktModelKey")
    ) {
      return "Компонент входит в заблокированную комплектацию ПКТ. Демонтируйте всю модель во вкладке «Хром».";
    }
    if (
      this.isPktBody(item) &&
      this.isInstalled(item) &&
      collectionValues(actor?.items).some((candidate) =>
        this.getFlag(candidate, "pktModelKey"),
      )
    ) {
      return "Сначала демонтируйте установленную модель ПКТ во вкладке «Хром».";
    }
    if (
      this.isPktBiosystem(item) &&
      this.isInstalled(item) &&
      this.getRuleSetting("allowPktBodyWithoutBiosystem") !== true &&
      actor.items.some(
        (candidate) =>
          candidate.id !== item.id &&
          this.isPktBody(candidate) &&
          this.isInstalled(candidate),
      )
    ) {
      return "Нельзя извлечь Биосистему, пока установлен корпус Полной Конверсии Тела. Сначала извлеките корпус.";
    }
    return null;
  }

  static previousCarryState(item) {
    return {
      carryType: item.system?.equipped?.carryType ?? "worn",
      handsHeld: safeInt(item.system?.equipped?.handsHeld, { max: 2 }),
      inSlot: item.system?.equipped?.inSlot === true,
      invested:
        typeof item.system?.equipped?.invested === "boolean"
          ? item.system.equipped.invested
          : null,
      containerId: item.system?.containerId ?? null,
    };
  }

  static installationUpdate(item, installed) {
    const update = {
      _id: item.id,
      [`flags.${MODULE_ID}.installed`]: installed,
    };

    if (installed) {
      if (!this.getFlag(item, "previousCarryState")) {
        update[`flags.${MODULE_ID}.previousCarryState`] =
          this.previousCarryState(item);
      }

      // Equipment with implanted usage must use SF2e's real implanted carry
      // state or its Rule Elements are ignored. Weapons and armor keep their
      // native equip semantics and are tracked by the module flag only.
      if (item.type === "equipment") {
        update["system.containerId"] = null;
        update["system.equipped.carryType"] = "implanted";
        update["system.equipped.handsHeld"] = 0;
        if (isInvestedItem(item)) {
          update["system.equipped.invested"] = true;
        }
      }
    } else {
      update[`flags.${MODULE_ID}.-=parentId`] = null;
      const previous = this.getFlag(item, "previousCarryState") ?? {
        carryType: item.type === "equipment" ? "worn" : undefined,
        handsHeld: 0,
        inSlot: false,
        invested: false,
        containerId: null,
      };

      if (item.type === "equipment") {
        const containerExists =
          previous.containerId &&
          item.actor?.items?.has?.(previous.containerId);
        update["system.containerId"] = containerExists
          ? previous.containerId
          : null;
        update["system.equipped.carryType"] =
          previous.carryType && previous.carryType !== "implanted"
            ? previous.carryType
            : "worn";
        update["system.equipped.handsHeld"] = safeInt(previous.handsHeld, {
          max: 2,
        });
        update["system.equipped.inSlot"] = previous.inSlot === true;
        if (isInvestedItem(item)) {
          update["system.equipped.invested"] = previous.invested === true;
        }
      }
      update[`flags.${MODULE_ID}.-=previousCarryState`] = null;
    }
    return update;
  }

  static preCreateInstallationSource(item) {
    const update = this.installationUpdate(item, true);
    delete update._id;
    return update;
  }

  static async setInstalled(actor, item, installed) {
    const currentlyInstalled = this.isInstalled(item);
    if (currentlyInstalled === installed) return true;

    if (installed) {
      const validation = this.installationValidation(actor, item);
      if (validation) {
        globalThis.ui?.notifications?.warn?.(validation);
        return false;
      }
    }

    if (!installed) {
      const validation = this.removalValidation(actor, item);
      if (validation) {
        globalThis.ui?.notifications?.warn?.(validation);
        return false;
      }

      const updates = [this.installationUpdate(item, false)];
      if (this.isPktBody(item)) {
        updates.push(...this.pktEjectionUpdates(actor, item.id));
      }
      if (this.getImplantType(item) === "base") {
        updates.push(...this.moduleDetachUpdates(actor, item.id));
      }
      await actor.updateEmbeddedDocuments(
        "Item",
        this.mergeItemUpdates(updates),
        { cyberpunkRemasterManaged: true },
      );
      await this.reconcileHumanity(actor);
      await this.reconcileGrantedItems(actor);
      return true;
    }

    const update = this.installationUpdate(item, installed);
    delete update._id;
    await item.update(update, { cyberpunkRemasterManaged: true });
    await this.reconcileHumanity(actor);
    await this.reconcileGrantedItems(actor);
    return true;
  }

  static mergeItemUpdates(updates) {
    const merged = new Map();
    for (const update of updates) {
      if (!update?._id) continue;
      const current = merged.get(update._id) ?? { _id: update._id };
      Object.assign(current, update);
      merged.set(update._id, current);
    }
    return [...merged.values()];
  }

  static moduleDetachUpdates(actor, baseId) {
    return actor.items
      .filter((item) => this.getFlag(item, "parentId") === baseId)
      .map((item) => ({
        _id: item.id,
        [`flags.${MODULE_ID}.-=parentId`]: null,
      }));
  }

  static async detachModules(actor, baseId) {
    const updates = this.moduleDetachUpdates(actor, baseId);
    if (updates.length) {
      await actor.updateEmbeddedDocuments("Item", updates, {
        cyberpunkRemasterManaged: true,
      });
    }
  }

  static pktEjectionUpdates(actor, bodyId = null) {
    if (this.getRuleSetting("allowPktWithoutBody") === true) return [];
    const anotherBodyRemains =
      bodyId &&
      actor.items.some(
        (item) =>
          item.id !== bodyId && this.isPktBody(item) && this.isInstalled(item),
      );
    return actor.items
      .filter(
        (item) =>
          this.isPktOnly(item) &&
          this.isInstalled(item) &&
          !this.isPktBody(item) &&
          (!bodyId ||
            this.getFlag(item, "pktBodyId") === bodyId ||
            (!this.getFlag(item, "pktBodyId") && !anotherBodyRemains)),
      )
      .map((item) => this.installationUpdate(item, false));
  }

  static async ejectPktComponents(actor, bodyId = null) {
    const updates = this.pktEjectionUpdates(actor, bodyId);
    if (updates.length) {
      await actor.updateEmbeddedDocuments("Item", updates, {
        cyberpunkRemasterManaged: true,
      });
    }
    return updates.length;
  }

  static async attachModule(actor, module, base) {
    const liveModule =
      actor.items.get?.(module.id) ??
      actor.items.find((item) => item.id === module.id);
    const liveBase =
      actor.items.get?.(base.id) ??
      actor.items.find((item) => item.id === base.id);
    if (!liveModule || !liveBase) {
      throw new Error("Модуль или база больше не принадлежит персонажу.");
    }
    if (this.getImplantType(liveModule) !== "module") {
      throw new Error(`«${liveModule.name}» не является модулем импланта.`);
    }
    if (
      this.getImplantType(liveBase) !== "base" ||
      !this.isInstalled(liveBase)
    ) {
      throw new Error("Цель не является установленной базой.");
    }
    const installationError = this.installationValidation(actor, liveModule);
    if (installationError) {
      throw new Error(installationError);
    }

    // Capacity is checked against fresh actor documents before any write. The
    // installation state and parent link are then committed in one Item update,
    // so a rejected drop cannot partially install the module or spend Humanity.
    const totalSlots = this.getSlots(liveBase);
    const usedSlots = actor.items
      .filter(
        (item) =>
          item.id !== liveModule.id &&
          this.isInstalled(item) &&
          this.getImplantType(item) === "module" &&
          this.getFlag(item, "parentId") === liveBase.id,
      )
      .reduce((sum, item) => sum + this.getSlotsUsed(item), 0);
    const moduleSlots = this.getSlotsUsed(liveModule);
    if (
      this.getRuleSetting("ignoreSlotLimits") !== true &&
      usedSlots + moduleSlots > totalSlots
    ) {
      throw new Error(`Недостаточно слотов в «${liveBase.name}».`);
    }

    const update = this.installationUpdate(liveModule, true);
    delete update._id;
    update[`flags.${MODULE_ID}.parentId`] = liveBase.id;
    await liveModule.update(update, { cyberpunkRemasterManaged: true });
    await this.reconcileHumanity(actor);
    await this.reconcileGrantedItems(actor);
    return true;
  }

  static pktModuleLinkUpdates(created) {
    const basesByFamily = new Map();
    for (const item of created) {
      if (this.getImplantType(item) !== "base") continue;
      const family = this.getFlag(item, "pktFamily");
      if (!family) continue;
      const values = basesByFamily.get(family) ?? [];
      values.push({
        item,
        used: 0,
        capacity: this.getSlots(item),
      });
      basesByFamily.set(family, values);
    }

    const nextBaseByFamily = new Map();
    const updates = [];
    for (const item of created) {
      const parentFamily = this.getFlag(item, "pktParentFamily");
      if (!parentFamily) continue;
      if (this.getImplantType(item) !== "module") {
        throw new Error(
          `Компонент «${item.name}» требует базу, но не является модулем.`,
        );
      }
      const bases = basesByFamily.get(parentFamily) ?? [];
      if (!bases.length) {
        throw new Error(
          `Для «${item.name}» не создана база семейства ${parentFamily}.`,
        );
      }

      const slots = this.getSlotsUsed(item);
      const start = nextBaseByFamily.get(parentFamily) ?? 0;
      let selected = null;
      if (this.getRuleSetting("ignoreSlotLimits") === true) {
        const index = start % bases.length;
        selected = { candidate: bases[index], index };
      } else {
        for (let offset = 0; offset < bases.length; offset++) {
          const index = (start + offset) % bases.length;
          const candidate = bases[index];
          if (candidate.used + slots <= candidate.capacity) {
            selected = { candidate, index };
            break;
          }
        }
      }
      if (!selected) {
        throw new Error(
          `В базах семейства ${parentFamily} не хватает слотов для «${item.name}».`,
        );
      }
      selected.candidate.used += slots;
      nextBaseByFamily.set(parentFamily, (selected.index + 1) % bases.length);
      updates.push({
        _id: item.id,
        [`flags.${MODULE_ID}.parentId`]: selected.candidate.item.id,
      });
    }
    return updates;
  }

  static pktBaseReplacementValidation(actor, base, replacement) {
    if (
      !base ||
      !this.isInstalled(base) ||
      !this.isPktModelBaseReplaceable(base)
    ) {
      return "Эта база не является заменяемой базой установленной модели ПКТ.";
    }
    if (
      this.getImplantType(replacement) !== "base" ||
      this.getFlag(replacement, "pktReplaceable") !== true
    ) {
      return "Выбранный имплант не является стандартной заменяемой базой ПКТ.";
    }

    const oldFamily = this.getFlag(base, "pktFamily");
    const newFamily = this.getFlag(replacement, "pktFamily");
    if (!oldFamily || oldFamily !== newFamily) {
      return "Новая база должна принадлежать тому же семейству имплантов.";
    }

    const boundBodyId = this.getFlag(base, "pktBodyId");
    const bodies = collectionValues(actor?.items).filter(
      (item) => this.isPktBody(item) && this.isInstalled(item),
    );
    const body = bodies.find((item) => item.id === boundBodyId) ?? bodies[0];
    const bodyQuality = this.getPktBodyQuality(body);
    const replacementQuality = Number(
      this.getFlag(replacement, "pktComponentQuality"),
    );
    if (!body || !Number.isFinite(bodyQuality)) {
      return "Не найден установленный корпус ПКТ с известным качеством.";
    }
    if (
      this.getRuleSetting("ignorePktQualityLimits") !== true &&
      (!Number.isFinite(replacementQuality) ||
        replacementQuality > bodyQuality + 1)
    ) {
      return "Качество новой базы может быть максимум на одну ступень выше качества корпуса ПКТ.";
    }

    const replacementId = replacement.id ?? replacement._id;
    const currentSourceId =
      this.getFlag(base, "pktModelSourceId") || this.itemSourceId(base);
    if (replacementId && replacementId === currentSourceId) {
      return "Эта база уже установлена.";
    }

    const usedSlots = collectionValues(actor?.items)
      .filter(
        (item) =>
          this.isInstalled(item) &&
          this.getImplantType(item) === "module" &&
          this.getFlag(item, "parentId") === base.id,
      )
      .reduce((sum, item) => sum + this.getSlotsUsed(item), 0);
    if (
      this.getRuleSetting("ignoreSlotLimits") !== true &&
      usedSlots > this.getSlots(replacement)
    ) {
      return `Новая база не вмещает установленные модули: нужно ${usedSlots} слотов.`;
    }

    const installationError = this.installationValidation(actor, replacement);
    return installationError;
  }

  static pktBaseReplacementSource(sourceDocument, base, body) {
    const source = sourceDocument.toObject();
    const sourceId = sourceDocument.id ?? sourceDocument._id ?? source._id;
    delete source._id;
    delete source.folder;
    delete source.ownership;
    source._stats ??= {};
    source._stats.compendiumSource = `Compendium.${PKT_ITEM_PACK}.Item.${sourceId}`;
    source.flags ??= {};
    source.flags[MODULE_ID] = {
      ...(source.flags[MODULE_ID] ?? {}),
      pktModelKey: this.getFlag(base, "pktModelKey"),
      pktComponentKey: this.getFlag(base, "pktComponentKey"),
      pktModelSourceId: sourceId,
      pktLocked: true,
      pktStress: "normal",
      pktBodyId: body.id,
      pktParentFamily: null,
      pktQuantityIndex: this.getFlag(base, "pktQuantityIndex") ?? 0,
      pktReplaceableBase: true,
    };
    if (hasOwn(source.system, "quantity")) source.system.quantity = 1;
    return source;
  }

  static async replacePktBase(
    actor,
    base,
    replacementId,
    { sourceDocument = null } = {},
  ) {
    const liveBase =
      actor.items.get?.(base.id) ??
      collectionValues(actor.items).find((item) => item.id === base.id);
    if (!liveBase) {
      throw new Error("Заменяемая база больше не принадлежит персонажу.");
    }

    const itemPack = globalThis.game?.packs?.get?.(PKT_ITEM_PACK);
    const replacement =
      sourceDocument ?? (await itemPack?.getDocument?.(replacementId));
    if (!replacement) {
      throw new Error(`В компендии не найдена база ${replacementId}.`);
    }
    const validation = this.pktBaseReplacementValidation(
      actor,
      liveBase,
      replacement,
    );
    if (validation) throw new Error(validation);

    const boundBodyId = this.getFlag(liveBase, "pktBodyId");
    const bodies = collectionValues(actor.items).filter(
      (item) => this.isPktBody(item) && this.isInstalled(item),
    );
    const body = bodies.find((item) => item.id === boundBodyId) ?? bodies[0];
    const attached = collectionValues(actor.items).filter(
      (item) =>
        this.isInstalled(item) &&
        this.getImplantType(item) === "module" &&
        this.getFlag(item, "parentId") === liveBase.id,
    );
    let created = null;
    let modulesRelinked = false;
    try {
      const sources = [
        this.pktBaseReplacementSource(replacement, liveBase, body),
      ];
      const createdItems = await actor.createEmbeddedDocuments(
        "Item",
        sources,
        { cyberpunkRemasterModelOperation: true },
      );
      created = createdItems[0] ?? null;
      if (createdItems.length !== 1 || !created || !this.isInstalled(created)) {
        throw new Error(
          "Foundry не создал новую базу в установленном состоянии.",
        );
      }

      if (attached.length) {
        await actor.updateEmbeddedDocuments(
          "Item",
          attached.map((item) => ({
            _id: item.id,
            [`flags.${MODULE_ID}.parentId`]: created.id,
          })),
          { cyberpunkRemasterModelOperation: true },
        );
        modulesRelinked = true;
      }
      await actor.deleteEmbeddedDocuments("Item", [liveBase.id], {
        cyberpunkRemasterModelOperation: true,
      });
    } catch (error) {
      const rollbackErrors = [];
      if (modulesRelinked) {
        try {
          await actor.updateEmbeddedDocuments(
            "Item",
            attached.map((item) => ({
              _id: item.id,
              [`flags.${MODULE_ID}.parentId`]: liveBase.id,
            })),
            { cyberpunkRemasterModelOperation: true },
          );
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError.message);
        }
      }
      if (created) {
        try {
          await actor.deleteEmbeddedDocuments("Item", [created.id], {
            cyberpunkRemasterModelOperation: true,
          });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError.message);
        }
      }
      if (rollbackErrors.length) {
        throw new Error(
          `${error.message} Откат замены не завершён: ` +
            rollbackErrors.join("; "),
        );
      }
      throw error;
    }

    let reconciliationError = null;
    try {
      await this.reconcileHumanity(actor);
      await this.reconcileGrantedItems(actor);
    } catch (error) {
      reconciliationError = error;
      console.error(
        `${MODULE_ID} | Reconciliation after base replacement failed`,
        error,
      );
      globalThis.ui?.notifications?.warn?.(
        "База заменена, но итоговое состояние Человечности или выданных " +
          "эффектов не удалось сохранить. Повторно откройте лист; если " +
          "проблема останется, сообщите ведущему.",
      );
    }
    return {
      replacement: created,
      transferredModules: attached.length,
      reconciliationError,
    };
  }

  static pktItemSource(sourceDocument, model, entry, body) {
    const source = sourceDocument.toObject();
    delete source._id;
    delete source.folder;
    delete source.ownership;
    source._stats ??= {};
    source._stats.compendiumSource = `Compendium.${PKT_ITEM_PACK}.Item.${entry.itemId}`;
    source.flags ??= {};
    source.flags[MODULE_ID] = {
      ...(source.flags[MODULE_ID] ?? {}),
      pktModelKey: model.key,
      pktComponentKey: entry.componentKey,
      pktModelSourceId: entry.itemId,
      pktFamily: entry.family ?? source.flags[MODULE_ID]?.pktFamily ?? null,
      pktLocked: entry.locked !== false,
      pktStress: entry.stress ?? "normal",
      pktBodyId: body.id,
      pktParentFamily: entry.parentFamily ?? null,
      pktQuantityIndex: entry.quantityIndex,
      pktReplaceableBase: entry.replaceableBase === true,
    };
    if (hasOwn(source.system, "quantity")) source.system.quantity = 1;
    return source;
  }

  static async installPktModel(actor, model, selections = {}) {
    const validation = this.pktModelValidation(actor, model);
    if (validation) throw new Error(validation);

    const body = this.pktModelBody(actor, model);
    const plan = this.pktInstallationPlan(model, selections);
    if (!plan.length) throw new Error("Комплектация модели ПКТ пуста.");

    const itemPack = globalThis.game?.packs?.get?.(PKT_ITEM_PACK);
    if (!itemPack) throw new Error("Компендий предметов ПКТ недоступен.");
    const sourceIds = [...new Set(plan.map((entry) => entry.itemId))];
    const sourcePairs = await Promise.all(
      sourceIds.map(async (itemId) => [
        itemId,
        await itemPack.getDocument(itemId),
      ]),
    );
    const sources = new Map(sourcePairs);
    const missing = sourcePairs.find(([, document]) => !document);
    if (missing) {
      throw new Error(`В компендии не найден компонент ПКТ ${missing[0]}.`);
    }
    const humanityLossSummary = this.pktHumanityLossSummary(plan, sources);

    const beforeIds = new Set(
      collectionValues(actor.items).map((item) => item.id),
    );
    let created = [];
    try {
      const createData = plan.map((entry) =>
        this.pktItemSource(sources.get(entry.itemId), model, entry, body),
      );
      created = await actor.createEmbeddedDocuments("Item", createData, {
        cyberpunkRemasterModelOperation: true,
      });
      if (
        created.length !== createData.length ||
        created.some((item) => !this.isInstalled(item))
      ) {
        throw new Error(
          "Foundry создал не все компоненты модели в установленном состоянии.",
        );
      }

      const linkUpdates = this.pktModuleLinkUpdates(created);
      if (linkUpdates.length) {
        await actor.updateEmbeddedDocuments("Item", linkUpdates, {
          cyberpunkRemasterModelOperation: true,
        });
      }
      await this.reconcileHumanity(actor);
      await this.reconcileGrantedItems(actor);
    } catch (error) {
      const rollbackIds = new Set(created.map((item) => item.id));
      for (const item of collectionValues(actor.items)) {
        if (
          !beforeIds.has(item.id) &&
          this.getFlag(item, "pktModelKey") === model.key
        ) {
          rollbackIds.add(item.id);
        }
      }
      if (rollbackIds.size) {
        try {
          await actor.deleteEmbeddedDocuments("Item", [...rollbackIds], {
            cyberpunkRemasterModelOperation: true,
          });
        } catch (rollbackError) {
          console.error(
            `${MODULE_ID} | PKT model rollback failed`,
            rollbackError,
          );
          throw new Error(
            `${error.message} Автоматический откат не завершён: ${rollbackError.message}`,
          );
        }
      }
      throw error;
    }

    return { created, humanityLoss: humanityLossSummary };
  }

  static async removePktModel(actor, modelKey) {
    const items = collectionValues(actor.items).filter(
      (item) => this.getFlag(item, "pktModelKey") === modelKey,
    );
    if (!items.length) return 0;
    await actor.deleteEmbeddedDocuments(
      "Item",
      items.map((item) => item.id),
      { cyberpunkRemasterModelOperation: true },
    );
    await this.reconcileHumanity(actor);
    await this.reconcileGrantedItems(actor);
    return items.length;
  }

  static async confirmDialog({ title, content }) {
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (typeof DialogV2?.confirm === "function") {
      return DialogV2.confirm({
        window: { title },
        content,
        yes: { default: true },
      });
    }
    if (typeof globalThis.Dialog?.confirm === "function") {
      return globalThis.Dialog.confirm({ title, content });
    }
    return globalThis.confirm?.(title) ?? false;
  }

  static pktConfirmationContent(model, plan) {
    const counts = new Map();
    for (const entry of plan) {
      const key = entry.itemId;
      const current = counts.get(key) ?? {
        name: entry.name ?? `Предмет ${entry.itemId}`,
        count: 0,
        stress: entry.stress,
      };
      current.count++;
      counts.set(key, current);
    }
    const rows = [...counts.values()]
      .map((entry) => `<li>${escapeHtml(entry.name)} × ${entry.count}</li>`)
      .join("");
    const price = new Intl.NumberFormat("ru-RU").format(
      safeInt(model.priceEddies, { max: Number.MAX_SAFE_INTEGER }),
    );
    const humanityLoss = this.pktHumanityLossSummary(plan);
    const humanityText = humanityLoss.complete
      ? humanityLoss.formula === "0"
        ? "Потеря Человечности для этой комплектации не бросается."
        : `Потеря Человечности: <strong>${escapeHtml(humanityLoss.formula)}</strong>. ` +
          "Игрок выполняет один общий бросок по inline-формуле на странице модели в журнале."
      : "Один общий бросок Потери Человечности находится на странице модели в журнале.";
    return (
      `<p><strong>${escapeHtml(model.name)}</strong></p>` +
      `<ul>${rows}</ul>` +
      `<p>Цена без корпуса: <strong>${price} эдди</strong>. ` +
      "Валюта автоматически не списывается.</p>" +
      `<p>${humanityText}</p>` +
      "<p>Hard Cost каждого импланта сохраняется и отдельно уменьшает " +
      "максимум Человечности.</p>"
    );
  }

  static pktBaseReplacementConfirmationContent(base, replacement, actor) {
    const attachedCount = collectionValues(actor?.items).filter(
      (item) => this.getFlag(item, "parentId") === base.id,
    ).length;
    const priceValue = replacement.system?.price?.value;
    const printedPrice = priceValue?.toString?.();
    const price =
      printedPrice && printedPrice !== "[object Object]"
        ? printedPrice
        : Number.isFinite(Number(priceValue?.sp))
          ? `${new Intl.NumberFormat("ru-RU").format(Number(priceValue.sp))} эдди`
          : "уточните в описании предмета";
    return (
      `<p>Заменить <strong>${escapeHtml(base.name)}</strong> на ` +
      `<strong>${escapeHtml(replacement.name)}</strong>?</p>` +
      `<p>Цена новой базы: <strong>${escapeHtml(price)}</strong>. ` +
      "Валюта автоматически не списывается.</p>" +
      `<p>Привязанные модули: <strong>${attachedCount}</strong>. ` +
      "Они будут перенесены в новую базу.</p>" +
      "<p><strong>Stress Cost новой базы применяется полностью</strong> " +
      "и обрабатывается вручную.</p>"
    );
  }

  static async runMutation(control, callback, actor = null) {
    if (control) control.disabled = true;
    try {
      await enqueueActorOperation(actor, callback);
    } catch (error) {
      notifyError(error, "Операция с имплантом не выполнена.");
    } finally {
      if (control?.isConnected) control.disabled = false;
    }
  }

  static activateListeners(app, container) {
    const actor = app.actor;
    const scroller = container.querySelector(".cw-tab");
    scroller?.addEventListener(
      "scroll",
      () => {
        scrollPositions.set(this.sheetKey(app), scroller.scrollTop);
      },
      { passive: true },
    );

    container
      .querySelectorAll(".cw-item-name[data-item-id]")
      .forEach((control) => {
        control.addEventListener("click", (event) => {
          event.preventDefault();
          actor.items
            .get(event.currentTarget.dataset.itemId)
            ?.sheet?.render(true);
        });
      });

    if (!this.canMutate(app)) return;

    container
      .querySelectorAll(".cw-humanity-input[data-field='current']")
      .forEach((input) => {
        input.addEventListener("change", (event) => {
          void this.runMutation(
            input,
            async () => {
              if (!this.canMutate(app)) return;
              const maximum = safeInt(event.currentTarget.max);
              const value = Math.min(
                maximum,
                safeInt(event.currentTarget.value),
              );
              await actor.setFlag(MODULE_ID, "humanity", { current: value });
            },
            actor,
          );
        });
      });

    container.querySelectorAll(".cw-unlink-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.runMutation(
          button,
          async () => {
            if (!this.canMutate(app)) return;
            const item = actor.items.get(button.dataset.itemId);
            if (item) await item.unsetFlag(MODULE_ID, "parentId");
          },
          actor,
        );
      });
    });

    container.querySelectorAll(".cw-pkt-model-install").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.runMutation(
          button,
          async () => {
            if (!this.canMutate(app)) return;
            const models = await this.loadPktModels();
            const model = models.find(
              (candidate) => candidate.key === button.dataset.modelKey,
            );
            if (!model) throw new Error("Выбранная модель ПКТ не найдена.");
            const selections = {};
            container.querySelectorAll(".cw-pkt-choice").forEach((select) => {
              if (select.dataset.modelKey === model.key) {
                selections[select.dataset.choiceKey] = select.value;
              }
            });
            const plan = this.pktInstallationPlan(model, selections);
            const confirmed = await this.confirmDialog({
              title: "Установить модель ПКТ",
              content: this.pktConfirmationContent(model, plan),
            });
            if (!confirmed) return;

            const result = await this.installPktModel(actor, model, selections);
            const loss = result.humanityLoss;
            const lossText =
              loss.formula === "0"
                ? " Потери Человечности нет."
                : ` Бросок Потери Человечности ${loss.formula} находится в журнале модели.`;
            globalThis.ui?.notifications?.info?.(
              `Модель «${model.name}» установлена.${lossText}`,
            );
          },
          actor,
        );
      });
    });

    container.querySelectorAll(".cw-pkt-model-remove").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.runMutation(
          button,
          async () => {
            if (!this.canMutate(app)) return;
            const modelName =
              button.dataset.modelName ?? button.dataset.modelKey;
            const confirmed = await this.confirmDialog({
              title: "Демонтировать модель ПКТ",
              content:
                `<p>Удалить все компоненты модели ` +
                `<strong>${escapeHtml(modelName)}</strong>?</p>` +
                "<p>Корпус и Биосистема останутся у персонажа.</p>",
            });
            if (!confirmed) return;
            const count = await this.removePktModel(
              actor,
              button.dataset.modelKey,
            );
            globalThis.ui?.notifications?.info?.(
              `Модель «${modelName}» демонтирована: удалено компонентов — ${count}.`,
            );
          },
          actor,
        );
      });
    });

    container.querySelectorAll(".cw-pkt-base-replace").forEach((select) => {
      select.addEventListener("change", (event) => {
        const replacementId = event.currentTarget.value;
        event.currentTarget.value = "";
        if (!replacementId) return;
        void this.runMutation(
          select,
          async () => {
            if (!this.canMutate(app)) return;
            const base = actor.items.get(select.dataset.itemId);
            if (!base) throw new Error("Заменяемая база не найдена.");
            const itemPack = globalThis.game?.packs?.get?.(PKT_ITEM_PACK);
            const replacement = await itemPack?.getDocument?.(replacementId);
            if (!replacement) {
              throw new Error(`В компендии не найдена база ${replacementId}.`);
            }
            const validation = this.pktBaseReplacementValidation(
              actor,
              base,
              replacement,
            );
            if (validation) throw new Error(validation);
            const confirmed = await this.confirmDialog({
              title: "Заменить базу ПКТ",
              content: this.pktBaseReplacementConfirmationContent(
                base,
                replacement,
                actor,
              ),
            });
            if (!confirmed) return;

            const result = await this.replacePktBase(
              actor,
              base,
              replacementId,
              { sourceDocument: replacement },
            );
            globalThis.ui?.notifications?.info?.(
              `«${base.name}» заменена на «${result.replacement.name}». ` +
                `Перенесено модулей: ${result.transferredModules}. ` +
                "Примените обычный Stress Cost новой базы.",
            );
          },
          actor,
        );
      });
    });

    container.querySelectorAll(".cw-install-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.runMutation(
          button,
          async () => {
            if (!this.canMutate(app)) return;
            const item = actor.items.get(button.dataset.itemId);
            if (!item) return;
            await this.setInstalled(actor, item, !this.isInstalled(item));
          },
          actor,
        );
      });
    });

    container.querySelectorAll(".cw-base-select").forEach((select) => {
      select.addEventListener("change", (event) => {
        const baseId = event.currentTarget.value;
        if (!baseId) return;
        void this.runMutation(
          select,
          async () => {
            if (!this.canMutate(app)) return;
            const item = actor.items.get(select.dataset.itemId);
            const base = actor.items.get(baseId);
            if (item && base) await this.attachModule(actor, item, base);
          },
          actor,
        );
      });
    });

    this.activateDragDrop(app, container);
  }

  static activateDragDrop(app, container) {
    if (!this.canMutate(app)) return;
    const actor = app.actor;
    const scroller = container.querySelector(".cw-tab");

    let autoScrollFrame = null;
    let autoScrollSpeed = 0;
    const stopAutoScroll = () => {
      if (autoScrollFrame !== null) cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
      autoScrollSpeed = 0;
    };
    const stepAutoScroll = () => {
      if (!scroller?.isConnected || !autoScrollSpeed) {
        return stopAutoScroll();
      }
      scroller.scrollTop += autoScrollSpeed;
      autoScrollFrame = requestAnimationFrame(stepAutoScroll);
    };

    scroller?.addEventListener("dragover", (event) => {
      const rect = scroller.getBoundingClientRect();
      const edge = Math.min(80, rect.height / 4);
      const fromTop = event.clientY - rect.top;
      const fromBottom = rect.bottom - event.clientY;
      const speed =
        fromTop < edge
          ? -Math.ceil((edge - fromTop) / 6)
          : fromBottom < edge
            ? Math.ceil((edge - fromBottom) / 6)
            : 0;
      autoScrollSpeed = speed;
      if (speed && autoScrollFrame === null) {
        autoScrollFrame = requestAnimationFrame(stepAutoScroll);
      } else if (!speed) {
        stopAutoScroll();
      }
    });

    container.querySelectorAll("[data-draggable-module]").forEach((element) => {
      element.setAttribute("draggable", "true");
      element.addEventListener("dragstart", (event) => {
        if (!this.canMutate(app)) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/cyberpunk-module",
          element.dataset.itemId,
        );
      });
      element.addEventListener("dragend", stopAutoScroll);
    });

    container.querySelectorAll(".cw-drop-zone").forEach((zone) => {
      zone.addEventListener("dragover", (event) => {
        if (!this.canMutate(app)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        zone.classList.add("cw-drop-hover");
      });
      zone.addEventListener("dragleave", (event) => {
        if (!zone.contains(event.relatedTarget)) {
          zone.classList.remove("cw-drop-hover");
        }
      });
      zone.addEventListener("drop", (event) => {
        event.preventDefault();
        stopAutoScroll();
        zone.classList.remove("cw-drop-hover");
        // DataTransfer enters protected mode after the drop event returns, so
        // capture its values before the per-actor mutation queue yields.
        const itemId = event.dataTransfer.getData(
          "application/cyberpunk-module",
        );
        const baseId = zone.dataset.baseId;
        if (!itemId || !baseId) return;
        void this.runMutation(
          zone,
          async () => {
            if (!this.canMutate(app)) return;
            const item = actor.items.get(itemId);
            const base = actor.items.get(baseId);
            if (item && base) await this.attachModule(actor, item, base);
          },
          actor,
        );
      });
    });
  }

  static synchronizeCarryChange(item, changes) {
    if (!item.actor || item.type !== "equipment") return;
    const path = "system.equipped.carryType";
    if (!hasChange(changes, path)) return;
    const carryType = getChange(changes, path);
    if (!this.isCyberware(item) && carryType !== "implanted") return;

    const installed = carryType === "implanted";
    if (installed === this.isInstalled(item)) return;

    if (installed) {
      const update = this.installationUpdate(item, true);
      delete update._id;
      Object.assign(changes, update);
      return;
    }

    changes[`flags.${MODULE_ID}.installed`] = false;
    changes[`flags.${MODULE_ID}.-=parentId`] = null;
    const previous = this.getFlag(item, "previousCarryState");
    if (isInvestedItem(item)) {
      changes["system.equipped.invested"] = previous?.invested === true;
    }
    changes[`flags.${MODULE_ID}.-=previousCarryState`] = null;
  }
}

export {
  LEGACY_MODULE_ID,
  MAX_SLOT_DOTS,
  MAX_SLOTS,
  MODULE_ID,
  PHYSICAL_TYPES,
  RULE_SETTING_DEFAULTS,
  safeInt,
};
