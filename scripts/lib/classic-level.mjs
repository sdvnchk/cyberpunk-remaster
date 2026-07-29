import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function loadClassicLevel() {
  const candidates = [
    process.env.CLASSIC_LEVEL_PATH,
    process.env.FOUNDRY_APP_PATH
      ? path.join(
          process.env.FOUNDRY_APP_PATH,
          "resources",
          "app",
          "node_modules",
          "classic-level",
        )
      : null,
    "classic-level",
  ].filter(Boolean);

  const errors = [];
  for (const candidate of candidates) {
    try {
      const loaded = require(candidate);
      if (loaded?.ClassicLevel) return loaded.ClassicLevel;
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }

  throw new Error(
    [
      "classic-level 3.0.0 was not found.",
      "Run npm install, or set FOUNDRY_APP_PATH to the Foundry App directory.",
      ...errors,
    ].join("\n"),
  );
}
