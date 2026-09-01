export function directoryRoot(app, html) {
  const ElementClass = globalThis.HTMLElement;
  if (ElementClass && html instanceof ElementClass) return html;
  if (ElementClass && html?.[0] instanceof ElementClass) return html[0];
  if (ElementClass && app?.element instanceof ElementClass) return app.element;
  return app?.element?.[0] ?? null;
}

export function ensureDirectoryLauncherGroup(app, html) {
  const root = directoryRoot(app, html);
  if (!root) return null;

  const existing = root.querySelector("[data-cyberpunk-directory-tools]");
  if (existing) return existing;

  const nativeActions = root.querySelector(".header-actions");
  const host =
    nativeActions ??
    root.querySelector(".directory-header") ??
    root.querySelector("header");
  if (!host) return null;

  const group = globalThis.document.createElement("div");
  group.dataset.cyberpunkDirectoryTools = "true";
  group.className = "header-actions action-buttons flexrow";
  if (typeof nativeActions?.after === "function") nativeActions.after(group);
  else host.append(group);
  return group;
}
