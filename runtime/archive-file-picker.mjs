/**
 * Shared Foundry image picker bridge for all archive variants.
 *
 * Foundry V14 exposes FilePicker as an ApplicationV2 under
 * foundry.applications.apps.FilePicker. Older worlds may still expose the
 * legacy global FilePicker. Prefer the V14 implementation so we do not mix
 * ApplicationV1 positioning code with ApplicationV2 windows.
 */

function warn(message) {
  globalThis.ui?.notifications?.warn?.(message);
}

function pickerCandidate(value, { applicationV2 = false } = {}) {
  if (typeof value !== "function") return null;
  return { Picker: value, applicationV2 };
}

export function resolveArchiveFilePicker() {
  const modern = globalThis.foundry?.applications?.apps?.FilePicker;
  const modernImplementation = modern?.implementation;
  const modernResolved =
    pickerCandidate(modernImplementation, { applicationV2: true }) ??
    pickerCandidate(modern, { applicationV2: true });
  if (modernResolved) return modernResolved;

  const configured = globalThis.CONFIG?.ux?.FilePicker;
  const configuredResolved =
    pickerCandidate(configured?.implementation, { applicationV2: true }) ??
    pickerCandidate(configured, { applicationV2: false });
  if (configuredResolved) return configuredResolved;

  return pickerCandidate(globalThis.FilePicker, { applicationV2: false });
}

function selectionPath(selection) {
  if (typeof selection === "string") return selection.trim();
  return String(selection?.path ?? selection?.target ?? selection?.file ?? "").trim();
}

export async function chooseArchiveImage(current = "", callback = () => {}) {
  const resolved = resolveArchiveFilePicker();
  if (!resolved) {
    warn("File Picker этой версии Foundry не найден. Вставьте путь к картинке вручную.");
    return null;
  }

  const { Picker, applicationV2 } = resolved;
  const accept = (selection) => {
    const path = selectionPath(selection);
    if (!path) {
      warn("File Picker не вернул путь к изображению.");
      return;
    }
    try {
      const result = callback(path);
      if (result && typeof result.then === "function") {
        void result.catch((error) => console.error("Cyberpunk Remaster | image picker callback failed", error));
      }
    } catch (error) {
      console.error("Cyberpunk Remaster | image picker callback failed", error);
    }
  };

  try {
    const picker = new Picker({
      type: "image",
      current: String(current ?? ""),
      callback: accept,
    });

    if (typeof picker.render === "function") {
      // ApplicationV2 uses an options object. Legacy ApplicationV1 uses a
      // boolean force argument. Keeping the two paths separate avoids the V14
      // null-element positioning race seen through legacy FilePicker.
      if (applicationV2) await Promise.resolve(picker.render({ force: true }));
      else await Promise.resolve(picker.render(true));
      return picker;
    }

    if (typeof picker.browse === "function") {
      await Promise.resolve(picker.browse(String(current ?? "")));
      return picker;
    }

    warn("File Picker найден, но не поддерживает открытие окна выбора файла.");
    return null;
  } catch (error) {
    console.error("Cyberpunk Remaster | FilePicker failed", error);
    warn("Не удалось открыть File Picker. Путь к изображению можно вставить вручную.");
    return null;
  }
}
