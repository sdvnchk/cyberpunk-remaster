import { registerHumanityRuleElement } from "../rule-elements/HumanityRuleElement.js";

const MODULE_ID = "cyberpunk-remaster";
const actorUpgradeObservers = new WeakMap();
const scheduleMicrotask =
  globalThis.queueMicrotask ?? ((callback) => Promise.resolve().then(callback));

const WEAPON_UPGRADES = {
  commercial: 0,
  tactical: 0,
  advanced: 1,
  superior: 1,
  elite: 2,
  ultimate: 2,
  paragon: 3,
};

const ARMOR_UPGRADES = {
  commercial: 0,
  tactical: 1,
  advanced: 1,
  superior: 2,
  elite: 2,
  ultimate: 3,
  paragon: 3,
};

const KNOWN_GRADES = new Set(Object.keys(WEAPON_UPGRADES));

function rootElement(html) {
  const ElementClass = globalThis.HTMLElement;
  if (!ElementClass) return null;
  if (html instanceof ElementClass) return html;
  return html?.[0] instanceof ElementClass ? html[0] : null;
}

function itemGrade(item) {
  const traits = item.system?.traits?.value ?? [];
  for (const trait of traits) {
    const grade = String(trait).toLocaleLowerCase("en");
    if (KNOWN_GRADES.has(grade)) return grade;
  }
  const value = item.system?.grade?.value ?? item.system?.grade;
  const grade = String(value ?? "").toLocaleLowerCase("en");
  return KNOWN_GRADES.has(grade) ? grade : null;
}

function upgradeMaximum(item) {
  if (!item?.isOfType?.("weapon", "armor")) return 0;
  const grade = itemGrade(item);
  if (!grade) return 0;
  const table = item.isOfType("armor") ? ARMOR_UPGRADES : WEAPON_UPGRADES;
  return table[grade] ?? 0;
}

function appendUpgradeBadge(previews, item) {
  const maximum = upgradeMaximum(item);
  if (maximum <= 0) return;

  for (const preview of previews) {
    if (preview.querySelector(".sf2eu-overlay")) continue;
    for (const paragraph of preview.querySelectorAll("p")) {
      const text = paragraph.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!/(?:Улучшения|Upgrades?)\s*:/iu.test(text) || !/\d/.test(text)) {
        continue;
      }
      const badge = document.createElement("span");
      badge.className = "sf2eu-overlay";
      badge.textContent = ` (+${maximum})`;
      badge.setAttribute(
        "aria-label",
        `Дополнительные улучшения от качества: ${maximum}`,
      );
      paragraph.appendChild(badge);
      return;
    }
  }
}

function injectUpgradeBadge(html, item) {
  const root = rootElement(html);
  if (!root) return;
  root
    .querySelectorAll(".sf2eu-overlay")
    .forEach((element) => element.remove());
  appendUpgradeBadge(
    root.querySelectorAll(
      ".editor-content[data-edit='system.description.value']:not(.ProseMirror)",
    ),
    item,
  );
}

function injectActorSummaryUpgradeBadges(root, actor) {
  if (!root || !actor?.items) return;
  for (const summary of root.querySelectorAll(".item-summary")) {
    const itemRow = summary.closest("[data-item-id]");
    const item = actor.items.get?.(itemRow?.dataset?.itemId);
    const description = summary.querySelector(".description");
    if (item && description) appendUpgradeBadge([description], item);
  }
}

function observeActorUpgradeSummaries(app, html) {
  const root = rootElement(html);
  const actor = app.actor ?? app.document;
  if (!root || !actor) return;

  actorUpgradeObservers.get(app)?.observer?.disconnect();
  injectActorSummaryUpgradeBadges(root, actor);

  const Observer = globalThis.MutationObserver;
  if (!Observer) return;
  const state = { observer: null, pending: false };
  const observer = new Observer(() => {
    if (state.pending) return;
    state.pending = true;
    scheduleMicrotask(() => {
      state.pending = false;
      if (root.isConnected) injectActorSummaryUpgradeBadges(root, actor);
    });
  });
  observer.observe(root, { childList: true, subtree: true });
  state.observer = observer;
  actorUpgradeObservers.set(app, state);
}

function disconnectActorUpgradeObserver(app) {
  actorUpgradeObservers.get(app)?.observer?.disconnect();
  actorUpgradeObservers.delete(app);
}

function onRenderItemSheet(app, html) {
  const item = app.item ?? app.document;
  if (!item) return;
  injectUpgradeBadge(html, item);

  const root = rootElement(html);
  root?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-tab]")) return;
    globalThis.setTimeout(() => injectUpgradeBadge(root, item), 50);
  });
}

Hooks.on("renderItemSheet", onRenderItemSheet);
Hooks.on("renderItemSheetV2", onRenderItemSheet);
Hooks.on("renderActorSheet", observeActorUpgradeSummaries);
Hooks.on("renderActorSheetV2", observeActorUpgradeSummaries);
Hooks.on("closeActorSheet", disconnectActorUpgradeObserver);
Hooks.on("closeActorSheetV2", disconnectActorUpgradeObserver);

function extendRussianGrammaticalGenders() {
  const replacement = globalThis.CONFIG?.["pf2e-ru"]?.itemNameReplacement;
  if (!replacement?.weapons || !replacement?.armor) {
    console.debug(
      `${MODULE_ID} | Optional pf2e-ru name-replacement API is unavailable.`,
    );
    return;
  }

  Object.assign(replacement.weapons, {
    "tyazhelyy-pistolet": "m",
    "shturmovaya-vintovka": "f",
    "snaypers-kaya-vintovka": "f",
    "tyazhelyy-pistolet-pulyomyot": "m",
    "pistolet-pulyomyot": "m",
    "reaktivnyy-granatomyot": "m",
    "massivnyy-pistolet": "m",
    pistolet: "m",
    "svetovie-povyazki": "p",
  });

  Object.assign(replacement.armor, {
    "podkozhnaya-bronya": "f",
    "tyazhelaya-podkozhnaya-bronya": "f",
    tkanekozha: "f",
    bronezhilet: "m",
    "delovoy-kostyum": "m",
    "kevlarovyy-zhilet": "m",
    "bronekostyum-talos": "m",
    "bronya-bravada": "f",
    "bronya-flibuster": "f",
    "bronya-shkura-drakona": "f",
    "bronya-mtv": "f",
    "bronekostyum-metallgir": "m",
  });
}

let retryHumanityRegistration = false;
Hooks.once("init", () => {
  retryHumanityRegistration = !registerHumanityRuleElement();
  const ammoTypes = globalThis.CONFIG?.PF2E?.ammoTypes;
  if (!ammoTypes) {
    console.warn(`${MODULE_ID} | CONFIG.PF2E.ammoTypes is unavailable.`);
    return;
  }

  Object.assign(ammoTypes, {
    "pistoletnyye-patrony": {
      label: "Пистолетные патроны",
      magazine: false,
      parent: null,
      stackGroup: null,
      weapon: null,
    },
    "vintovochnyye-patrony": {
      label: "Винтовочные патроны",
      magazine: false,
      parent: null,
      stackGroup: null,
      weapon: null,
    },
    drob: {
      label: "Дробь",
      magazine: false,
      parent: null,
      stackGroup: null,
      weapon: null,
    },
    zhakan: {
      label: "Жакан",
      magazine: false,
      parent: null,
      stackGroup: null,
      weapon: null,
    },
    raketa: {
      label: "Ракета",
      magazine: false,
      parent: null,
      stackGroup: null,
      weapon: null,
    },
  });
});

Hooks.once("setup", () => {
  if (retryHumanityRegistration && !registerHumanityRuleElement()) {
    console.error(`${MODULE_ID} | SF2e Rule Element API is unavailable.`);
  }
  extendRussianGrammaticalGenders();
});

export {
  appendUpgradeBadge,
  injectActorSummaryUpgradeBadges,
  injectUpgradeBadge,
  itemGrade,
  upgradeMaximum,
};
