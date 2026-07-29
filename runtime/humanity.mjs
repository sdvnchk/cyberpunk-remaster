import { LEGACY_MODULE_ID, MODULE_ID } from "./cyberware-schema.mjs";

export function applyHumanityAdjustments(adjustments, baseValue) {
  let value = Number(baseValue);
  for (const adjustment of adjustments ?? []) {
    const change = Number(adjustment?.value);
    if (!Number.isFinite(change)) continue;
    value = adjustment.mode === "override" ? change : value + change;
  }
  return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
}

export function calculateHumanity({
  actor,
  installed,
  adjustments,
  getHardCost,
  hardCostMultiplier = 1,
}) {
  const wisdomModifier = Number(actor?.system?.abilities?.wis?.mod ?? 0);
  const baseMaxPossible = Math.trunc(
    40 + (Number.isFinite(wisdomModifier) ? wisdomModifier : 0) * 10,
  );
  const maxPossible = applyHumanityAdjustments(adjustments, baseMaxPossible);
  const totalHardCost = (installed ?? []).reduce(
    (sum, item) => sum + getHardCost(item),
    0,
  );
  const multiplier = Number(hardCostMultiplier);
  const effectiveMultiplier = Number.isFinite(multiplier) ? multiplier : 1;
  const effectiveHardCost = Math.ceil(totalHardCost * effectiveMultiplier);
  const max = Math.max(0, maxPossible - effectiveHardCost);
  const stored =
    actor?.flags?.[MODULE_ID]?.humanity ??
    actor?.flags?.[LEGACY_MODULE_ID]?.humanity ??
    {};
  const rawCurrent = Number(stored.current);
  const current = Math.min(
    max,
    Math.max(0, Number.isFinite(rawCurrent) ? Math.trunc(rawCurrent) : max),
  );
  return { current, max, maxPossible };
}

export function humanityState(percent) {
  if (percent >= 70) {
    return { label: "Человек", cssClass: "cw-state-stable" };
  }
  if (percent >= 40) {
    return { label: "Отчуждение", cssClass: "cw-state-controlled" };
  }
  if (percent >= 25) {
    return { label: "Диссоциация", cssClass: "cw-state-edgy" };
  }
  if (percent > 0) {
    return { label: "Пре-Психоз", cssClass: "cw-state-danger" };
  }
  return { label: "Киберпсихоз", cssClass: "cw-state-psychosis" };
}
