export const MODULE_ID = "cyberpunk-remaster";
export const LEGACY_MODULE_ID = "cyberpunk-cyberware";

export const RULE_SETTING_DEFAULTS = Object.freeze({
  allowMultipleCyberdecks: false,
  allowMultipleNeuralAccelerators: false,
  allowMultiplePktBodies: false,
  allowPktWithoutBody: false,
  allowPktBodyWithoutBiosystem: false,
  ignoreSlotLimits: false,
  ignorePktQualityLimits: false,
  hardCostMultiplier: 1,
});

export const KNOWN_IMPLANT_TYPES = Object.freeze([
  "base",
  "internal",
  "external",
  "fashion",
  "module",
]);

export const IMPLANT_TYPE_LABELS = Object.freeze({
  base: "База",
  internal: "Внутренний",
  external: "Внешний",
  fashion: "Стилевой",
  module: "Модуль",
});

export const IMPLANT_TYPE_ALIASES = Object.freeze(
  Object.fromEntries(
    Object.entries(IMPLANT_TYPE_LABELS).flatMap(([key, label]) => [
      [key, key],
      [label.toLocaleLowerCase("ru"), key],
    ]),
  ),
);

export const PKT_BODY_QUALITIES = new Map([
  ["uvmhsMeuPT9EsaH8", 0],
  ["tg2eHjiZMoKUxtTR", 1],
  ["tkeQt2AZwYxlo0G4", 2],
  ["Y6CGkTe62Gray49S", 3],
  ["Ozh4qKfrpO3vIyXD", 4],
  ["tVLVycxfLpejAKaO", 5],
]);

export const PKT_BODY_IDS = new Set(PKT_BODY_QUALITIES.keys());
export const PKT_BIOSYSTEM_ID = "CNILbId2Wtv3BJm6";
export const MAX_SLOTS = 1000;
export const MAX_SLOT_DOTS = 20;

const HTML_ENTITIES = Object.freeze({
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
});

function decodeCodePoint(digits, radix) {
  const codePoint = Number.parseInt(digits, radix);
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : "\uFFFD";
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_match, digits) => decodeCodePoint(digits, 10))
    .replace(/&#x([0-9a-f]+);/gi, (_match, digits) =>
      decodeCodePoint(digits, 16),
    )
    .replace(
      /&([a-z]+);/gi,
      (match, name) => HTML_ENTITIES[name.toLocaleLowerCase("en")] ?? match,
    );
}

export function safeInt(value, { max = MAX_SLOTS } = {}) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(0, Math.trunc(number)))
    : 0;
}

export function descriptionLines(html) {
  const raw = String(html ?? "");
  if (!raw) return [];

  let text;
  if (globalThis.document?.createElement) {
    const element = document.createElement("div");
    element.innerHTML = raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|h[1-6]|li|p|section|tr)>/gi, "$&\n");
    text = element.textContent ?? "";
  } else {
    text = decodeHtmlEntities(
      raw
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:div|h[1-6]|li|p|section|tr)>/gi, "\n")
        .replace(/<hr\b[^>]*>/gi, "\n")
        .replace(/<[^>]*>/g, " "),
    );
  }

  return text
    .replace(/[\u00a0\u202f]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function descriptionText(itemOrHtml) {
  const html =
    typeof itemOrHtml === "string"
      ? itemOrHtml
      : itemOrHtml?.system?.description?.value;
  return descriptionLines(html).join(" ");
}

function lastCanonicalMatch(lines, pattern) {
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = lines[index].match(pattern);
    if (match) return match;
  }
  return null;
}

function fallbackMatch(text, pattern) {
  return text.match(pattern);
}

export function parseCyberwareDescription(itemOrHtml) {
  const html =
    typeof itemOrHtml === "string"
      ? itemOrHtml
      : itemOrHtml?.system?.description?.value;
  const lines = descriptionLines(html);
  const text = lines.join(" ");
  const stressPattern = "((?:\\d*d(?:4|6))(?:\\s*\\+\\s*\\d*d(?:4|6))*|0)";

  const canonical = {
    implantType: lastCanonicalMatch(
      lines,
      /^Тип\s*импланта\s*:?\s*([А-Яа-яЁёA-Za-z]+)\s*$/iu,
    ),
    hardCost: lastCanonicalMatch(lines, /^Hard\s*Cost\s*:?\s*(\d+)\s*$/iu),
    stressFormula: lastCanonicalMatch(
      lines,
      new RegExp(
        `^Stress\\s*Cost\\s*:?\\s*(?:\\[\\[\\/r\\s*)?${stressPattern}`,
        "iu",
      ),
    ),
    slots: lastCanonicalMatch(lines, /^Слот[А-Яа-яЁё]*\s*:?\s*(\d+)\s*$/iu),
  };

  const legacy = {
    implantType:
      canonical.implantType ??
      fallbackMatch(text, /Тип\s*импланта\s*:?\s*([А-Яа-яЁёA-Za-z]+)/iu),
    hardCost:
      canonical.hardCost ?? fallbackMatch(text, /\bHard\s*Cost\s*:?\s*(\d+)/iu),
    stressFormula:
      canonical.stressFormula ??
      fallbackMatch(
        text,
        new RegExp(
          `\\bStress\\s*Cost\\s*:?\\s*(?:\\[\\[\\/r\\s*)?${stressPattern}`,
          "iu",
        ),
      ),
    slots:
      canonical.slots ?? fallbackMatch(text, /Слот[А-Яа-яЁё]*\s*:?\s*(\d+)/iu),
  };

  const implantType = legacy.implantType
    ? (IMPLANT_TYPE_ALIASES[legacy.implantType[1].toLocaleLowerCase("ru")] ??
      null)
    : null;
  const stressFormula = legacy.stressFormula
    ? legacy.stressFormula[1]
        .toLocaleLowerCase("en")
        .replace(/\s*\+\s*/g, " + ")
    : null;
  const fallbackFields = Object.entries(canonical)
    .filter(([key, value]) => !value && legacy[key])
    .map(([key]) => key);

  return {
    implantType,
    hardCost: legacy.hardCost ? safeInt(legacy.hardCost[1]) : null,
    stressFormula,
    slots: legacy.slots ? safeInt(legacy.slots[1]) : null,
    fallbackFields,
  };
}

export function itemSourceId(item) {
  const sourceId =
    item?.sourceId ??
    item?._stats?.compendiumSource ??
    item?.flags?.core?.sourceId;
  const match = String(sourceId ?? "").match(/\.Item\.([A-Za-z0-9]{16})$/);
  return match?.[1] ?? item?.id ?? item?._id ?? null;
}

export function isKnownPktBody(item) {
  const sourceId = itemSourceId(item);
  return (
    PKT_BODY_IDS.has(sourceId) ||
    PKT_BODY_IDS.has(item?.id) ||
    PKT_BODY_IDS.has(item?._id)
  );
}

export function pktBodyQuality(item) {
  return (
    PKT_BODY_QUALITIES.get(itemSourceId(item)) ??
    PKT_BODY_QUALITIES.get(item?.id) ??
    PKT_BODY_QUALITIES.get(item?._id)
  );
}

export function isKnownPktBiosystem(item) {
  return (
    itemSourceId(item) === PKT_BIOSYSTEM_ID ||
    item?.id === PKT_BIOSYSTEM_ID ||
    item?._id === PKT_BIOSYSTEM_ID
  );
}
