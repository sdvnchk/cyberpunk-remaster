import { safeInt } from "./cyberware-schema.mjs";

export function parseStressDice(formula) {
  const normalized = String(formula ?? "")
    .toLocaleLowerCase("en")
    .replace(/\s+/g, "");
  if (normalized === "0") return { d4: 0, d6: 0 };
  let d4 = 0;
  let d6 = 0;
  for (const term of normalized.split("+")) {
    const match = term.match(/^(\d*)d(4|6)$/);
    if (!match) {
      throw new Error(
        `Формулу Stress Cost «${formula}» нельзя объединить автоматически.`,
      );
    }
    const count = match[1] ? safeInt(match[1]) : 1;
    if (match[2] === "4") d4 += count;
    else d6 += count;
  }
  return { d4, d6 };
}

export function summarizePktHumanityLoss(
  plan,
  {
    sources = null,
    getStressFormula = (entry) => entry.stressFormula,
    parseStressDice: parseDice = parseStressDice,
  } = {},
) {
  let d4 = 0;
  let d6 = 0;
  let complete = true;
  for (const entry of plan) {
    if (entry.stress !== "normal") continue;
    let stressFormula;
    if (sources) {
      const source = sources.get(entry.itemId);
      if (!source) {
        throw new Error(`Не найден источник Stress Cost для ${entry.itemId}.`);
      }
      stressFormula = getStressFormula(
        typeof source.toObject === "function" ? source.toObject() : source,
      );
    } else if (typeof entry.stressFormula === "string" && entry.stressFormula) {
      stressFormula = entry.stressFormula;
    } else {
      complete = false;
      continue;
    }
    if (!stressFormula) {
      throw new Error(`У компонента ${entry.itemId} не указан Stress Cost.`);
    }
    const dice = parseDice(stressFormula);
    d4 += dice.d4;
    d6 += dice.d6;
  }
  const formula =
    [d6 ? `${d6}d6` : "", d4 ? `${d4}d4` : ""].filter(Boolean).join(" + ") ||
    "0";
  return {
    complete,
    d4,
    d6,
    formula,
    average: d6 * 3.5 + d4 * 2.5,
  };
}

export function buildPktInstallationPlan(model, selections = {}) {
  const plan = [];
  const addEntry = (entry, componentKey) => {
    const quantity = Math.max(1, safeInt(entry.quantity));
    for (let index = 0; index < quantity; index++) {
      plan.push({
        ...entry,
        componentKey,
        quantityIndex: index,
      });
    }
  };

  for (const [index, entry] of (model.unique ?? []).entries()) {
    addEntry(entry, entry.key ?? `unique-${index + 1}`);
  }
  for (const [index, entry] of (model.components ?? []).entries()) {
    addEntry(entry, entry.key ?? `component-${index + 1}`);
  }
  for (const choice of model.choices ?? []) {
    const choose = Math.max(1, safeInt(choice.choose));
    const selected = Array.isArray(selections[choice.key])
      ? selections[choice.key]
      : [selections[choice.key]].filter(Boolean);
    const allowed = new Set(choice.itemIds ?? []);
    if (
      selected.length !== choose ||
      selected.some((itemId) => !allowed.has(itemId))
    ) {
      throw new Error(`Выберите ${choose} вариант для «${choice.key}».`);
    }
    for (const [index, itemId] of selected.entries()) {
      const option = (choice.options ?? []).find(
        (candidate) => candidate.itemId === itemId,
      );
      plan.push({
        ...choice,
        ...option,
        itemId,
        componentKey: `choice-${choice.key}`,
        quantityIndex: index,
        quantity: 1,
      });
    }
  }
  return plan;
}
