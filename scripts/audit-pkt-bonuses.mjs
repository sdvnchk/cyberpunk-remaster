import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CyberwareTab } from "../sheets/CyberwareTab.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relative) =>
  JSON.parse(await fs.readFile(path.join(root, relative), "utf8"));

const [items, models] = await Promise.all([
  readJson("items-export.json"),
  readJson("data/pkt-models.json"),
]);
const itemById = new Map(items.map((item) => [item._id, item]));
const PKT_ITEM_FOLDERS = new Set([
  "hAjxPF8rxyrHozYl",
  "ahY6bGvcjTypaV6b",
]);

function selectors(rule) {
  const value = Array.isArray(rule.selector)
    ? rule.selector
    : [rule.selector];
  return value.filter((selector) => typeof selector === "string");
}

function predicateKey(rule) {
  return JSON.stringify(rule.predicate ?? []);
}

function typedModifiers(item) {
  return (item?.system?.rules ?? []).flatMap((rule) => {
    if (
      rule?.key !== "FlatModifier" ||
      typeof rule.type !== "string" ||
      rule.type === "untyped"
    ) {
      return [];
    }
    return selectors(rule).map((selector) => ({
      itemId: item._id,
      itemName: item.name,
      selector,
      type: rule.type,
      value: rule.value,
      predicate: rule.predicate ?? [],
      predicateKey: predicateKey(rule),
    }));
  });
}

const rows = [];
for (const model of models) {
  const entries = [...(model.unique ?? []), ...(model.components ?? [])];
  const seenItems = new Set();
  const modifiers = [];
  for (const entry of entries) {
    if (seenItems.has(entry.itemId)) continue;
    seenItems.add(entry.itemId);
    modifiers.push(...typedModifiers(itemById.get(entry.itemId)));
  }

  for (let left = 0; left < modifiers.length; left++) {
    for (let right = left + 1; right < modifiers.length; right++) {
      const a = modifiers[left];
      const b = modifiers[right];
      if (
        a.itemId === b.itemId ||
        a.selector !== b.selector ||
        a.type !== b.type
      ) {
        continue;
      }
      const definite =
        a.predicate.length === 0 ||
        b.predicate.length === 0 ||
        a.predicateKey === b.predicateKey;
      rows.push({
        model: model.name,
        selector: a.selector,
        type: a.type,
        overlap: definite ? "точное" : "возможное",
        first: `${a.itemName} (${a.value >= 0 ? "+" : ""}${a.value})`,
        second: `${b.itemName} (${b.value >= 0 ? "+" : ""}${b.value})`,
      });
    }
  }
}

if (rows.length) {
  console.table(rows);
} else {
  console.log("Пересечений типизированных бонусов в комплектах ПКТ нет.");
}

const duplicateEntries = [];
for (const model of models) {
  const entries = [...(model.unique ?? []), ...(model.components ?? [])];
  const counts = new Map();
  for (const entry of entries) {
    counts.set(entry.itemId, (counts.get(entry.itemId) ?? 0) + 1);
  }
  for (const [itemId, count] of counts) {
    if (count > 1) {
      duplicateEntries.push({
        model: model.name,
        item: itemById.get(itemId)?.name ?? itemId,
        entries: count,
      });
    }
  }
}

if (duplicateEntries.length) {
  console.table(duplicateEntries);
  process.exitCode = 1;
} else {
  console.log("Повторяющихся записей одного предмета в комплектах нет.");
}

const usedItemIds = new Set();
for (const model of models) {
  if (model.requiredBodyId) usedItemIds.add(model.requiredBodyId);
  for (const entry of [
    ...(model.unique ?? []),
    ...(model.components ?? []),
  ]) {
    usedItemIds.add(entry.itemId);
  }
  for (const choice of model.choices ?? []) {
    for (const itemId of choice.itemIds ?? []) usedItemIds.add(itemId);
  }
}

const unusedPktItems = items
  .filter(
    (item) =>
      PKT_ITEM_FOLDERS.has(item.folder) ||
      (item.system?.traits?.value ?? []).includes("pkt"),
  )
  .filter((item) => !usedItemIds.has(item._id))
  .sort((left, right) =>
    String(left.name).localeCompare(String(right.name), "ru")
  );

if (unusedPktItems.length) {
  console.log("Предметы библиотеки ПКТ, не входящие ни в одну модель:");
  console.table(
    unusedPktItems.map((item) => ({
      item: item.name,
      level: item.system?.level?.value ?? "—",
      id: item._id,
    })),
  );
} else {
  console.log("Все предметы библиотеки ПКТ входят хотя бы в одну модель.");
}

const humanityRows = models.map((model) => {
  const selections = Object.fromEntries(
    (model.choices ?? []).map((choice) => [
      choice.key,
      choice.itemIds[0],
    ]),
  );
  const plan = CyberwareTab.pktInstallationPlan(model, selections);
  const humanity = CyberwareTab.pktHumanityLossSummary(plan, itemById);
  const hardCost = plan.reduce(
    (sum, entry) =>
      sum + CyberwareTab.getHardCost(itemById.get(entry.itemId)),
    0,
  );
  return {
    model: model.name,
    hardCost,
    humanityRoll: humanity.formula,
    averageLoss: humanity.average,
  };
});
console.log("Нагрузка моделей на Человечность:");
console.table(humanityRows);

console.log(
  `Пересечения: ${rows.length}, из них точных: ` +
    `${rows.filter((row) => row.overlap === "точное").length}.`,
);
