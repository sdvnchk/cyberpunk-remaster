const managedFontStyles = new WeakMap();
const resizeObservers = new WeakMap();

export const FONT_AWESOME_CLASSES = Object.freeze([
  "fa", "fas", "far", "fab", "fal", "fat", "fad", "fass", "fasr", "fasl", "fast",
  "fa-solid", "fa-regular", "fa-brands", "fa-light", "fa-thin", "fa-duotone", "fa-sharp",
]);

export const ICON_ONLY_SELECTOR = [
  ".pcm-top-actions > button > b",
  "aside > button > b",
  ".pcm-nav-toggle",
  ".pcm-record-arrow",
  ".pcm-attention-sign > b",
  ".pcm-stat-grid button > i",
  ".pcm-neuro-thread-row > i",
  "[data-window-toggle-icon]",
  ".pcm-hw-key",
  ".pcm-hw-led",
  ".pcm-hw-portbay",
  ".pcm-hw-radiator",
  ".pcm-hw-grip",
  ".pcm-hw-vent",
].join(",");

const TEXT_TAGS = new Set([
  "BUTTON", "INPUT", "SELECT", "TEXTAREA", "OPTION", "LABEL", "SPAN", "SMALL", "P",
  "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TD", "TH", "LEGEND", "SUMMARY",
  "OUTPUT", "EM", "STRONG", "B", "A", "CODE", "PRE", "TIME",
]);

export function archiveFontScale(fontSize, baseFontSize) {
  const size = Number(fontSize);
  const base = Number(baseFontSize);
  if (!Number.isFinite(size) || !Number.isFinite(base) || base <= 0) return 1;
  return size / base;
}

function isFontAwesomeElement(element) {
  const classes = element?.classList;
  if (!classes) return false;
  for (const name of FONT_AWESOME_CLASSES) if (classes.contains(name)) return true;
  for (const name of classes) {
    if (/^fa-(?:solid|regular|brands|light|thin|duotone|sharp|[a-z0-9-]+)$/u.test(name)) return true;
  }
  return false;
}

function isIconOnlyElement(element) {
  if (!element || isFontAwesomeElement(element)) return true;
  try {
    if (element.matches?.(ICON_ONLY_SELECTOR)) return true;
  } catch {
    // Invalid selector support is not fatal; Foundry's browser supports it.
  }
  if (element.getAttribute?.("aria-hidden") === "true") return true;
  return ["SVG", "PATH", "IMG", "CANVAS"].includes(element.tagName);
}

function hasDirectText(element) {
  if (!element) return false;
  if (TEXT_TAGS.has(element.tagName)) return true;
  const nodes = Array.from(element.childNodes ?? []);
  return nodes.some((node) => node?.nodeType === 3 && String(node.textContent ?? "").trim());
}

function rememberOriginalFont(element) {
  if (managedFontStyles.has(element)) return managedFontStyles.get(element);
  const record = {
    value: element.style?.getPropertyValue?.("font-size") ?? "",
    priority: element.style?.getPropertyPriority?.("font-size") ?? "",
  };
  managedFontStyles.set(element, record);
  return record;
}

function restoreOriginalFont(element) {
  const record = managedFontStyles.get(element);
  if (!record || !element?.style) return;
  if (record.value) element.style.setProperty("font-size", record.value, record.priority);
  else element.style.removeProperty("font-size");
}

/**
 * Scale every real text surface from its responsive computed baseline.
 * Font Awesome and icon-only glyph cells are pinned to their baseline so text scaling
 * cannot break icon fonts or shove compact HUD symbols out of alignment.
 */
export function applyArchiveTextScale(root, { fontSize, baseFontSize } = {}) {
  if (!root?.querySelectorAll || !root?.style) return 1;
  const scale = archiveFontScale(fontSize, baseFontSize);
  root.style.setProperty("--archive-text-scale", String(scale));

  const elements = [root, ...root.querySelectorAll("*")];
  for (const element of elements) restoreOriginalFont(element);

  const getStyle = globalThis.getComputedStyle;
  if (typeof getStyle !== "function") return scale;

  const textTargets = [];
  const iconTargets = [];
  for (const element of elements) {
    if (isIconOnlyElement(element)) {
      iconTargets.push(element);
      continue;
    }
    if (hasDirectText(element)) textTargets.push(element);
  }

  const textBaselines = textTargets.map((element) => [
    element,
    Number.parseFloat(getStyle(element).fontSize),
  ]);
  const iconBaselines = iconTargets.map((element) => [
    element,
    Number.parseFloat(getStyle(element).fontSize),
  ]);

  for (const [element, baseline] of textBaselines) {
    if (!Number.isFinite(baseline) || baseline <= 0) continue;
    rememberOriginalFont(element);
    element.style.setProperty("font-size", `${Math.max(6, baseline * scale).toFixed(3)}px`, "important");
  }
  for (const [element, baseline] of iconBaselines) {
    if (!Number.isFinite(baseline) || baseline <= 0) continue;
    rememberOriginalFont(element);
    element.style.setProperty("font-size", `${baseline.toFixed(3)}px`, "important");
  }
  return scale;
}

export function observeArchiveTextScale(root, getOptions) {
  if (!root || typeof getOptions !== "function") return () => {};
  resizeObservers.get(root)?.disconnect?.();
  let frame = 0;
  let lastWidth = -1;
  let lastHeight = -1;
  const schedule = () => {
    if (frame) return;
    const run = () => {
      frame = 0;
      applyArchiveTextScale(root, getOptions() ?? {});
    };
    frame = globalThis.requestAnimationFrame?.(run) ?? globalThis.setTimeout?.(run, 0) ?? 0;
  };
  const Observer = globalThis.ResizeObserver;
  const observer = typeof Observer === "function"
    ? new Observer((entries) => {
        const rect = entries?.[0]?.contentRect;
        const width = Math.round(Number(rect?.width) || root.clientWidth || 0);
        const height = Math.round(Number(rect?.height) || root.clientHeight || 0);
        if (width === lastWidth && height === lastHeight) return;
        lastWidth = width;
        lastHeight = height;
        schedule();
      })
    : null;
  observer?.observe?.(root);
  resizeObservers.set(root, observer ?? { disconnect() {} });
  globalThis.queueMicrotask?.(schedule) ?? schedule();
  return () => {
    observer?.disconnect?.();
    resizeObservers.delete(root);
    if (frame && globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(frame);
  };
}
