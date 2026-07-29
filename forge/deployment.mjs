// Adapted from PF2E NPC Forge 0.13.0 under the MIT License.
// See licenses/PF2E_NPC_FORGE_LICENSE.txt.

export const DEPLOYMENT_MODES = Object.freeze({
  none: { label: "Не размещать" },
  cluster: { label: "Компактная группа" },
  line: { label: "Линия" },
  wedge: { label: "Клин" },
  ring: { label: "Кольцо" },
});

export function formationOffsets(count, mode = "cluster", spacing = 1) {
  const total = Math.max(0, Number(count) || 0);
  const step = Math.max(1, Number(spacing) || 1);
  if (!total || mode === "none") return [];
  if (mode === "line") {
    const center = (total - 1) / 2;
    return Array.from({ length: total }, (_, index) => ({
      x: Math.round((index - center) * step),
      y: 0,
    }));
  }
  if (mode === "wedge") {
    const result = [{ x: 0, y: 0 }];
    let row = 1;
    while (result.length < total) {
      result.push({ x: -row * step, y: row * step });
      if (result.length < total) {
        result.push({ x: row * step, y: row * step });
      }
      row += 1;
    }
    return result;
  }
  if (mode === "ring") {
    if (total === 1) return [{ x: 0, y: 0 }];
    const radius = Math.max(2, Math.ceil(total / 3)) * step;
    return Array.from({ length: total }, (_, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      return {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
      };
    });
  }
  const width = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / width);
  return Array.from({ length: total }, (_, index) => ({
    x: Math.round(((index % width) - (width - 1) / 2) * step),
    y: Math.round((Math.floor(index / width) - (rows - 1) / 2) * step),
  }));
}

function sceneOrigin(scene) {
  const selected = globalThis.canvas?.tokens?.controlled?.[0]?.document;
  if (selected) return { x: selected.x, y: selected.y };
  const grid = Number(scene.grid?.size ?? globalThis.canvas?.grid?.size ?? 100);
  const width = Number(
    scene.width ?? scene.dimensions?.sceneWidth ?? grid * 20,
  );
  const height = Number(
    scene.height ?? scene.dimensions?.sceneHeight ?? grid * 20,
  );
  return {
    x: Math.max(0, Math.floor(width / 2 / grid) * grid),
    y: Math.max(0, Math.floor(height / 2 / grid) * grid),
  };
}

async function addTokensToCombat(scene, tokens, warnings) {
  if (!tokens.length) return null;
  try {
    let combat = globalThis.game?.combat;
    if (!combat || combat.scene?.id !== scene.id) {
      const created = await globalThis.Combat.create({
        scene: scene.id,
        active: true,
      });
      combat = Array.isArray(created) ? created[0] : created;
    }
    const existing = new Set(
      [...(combat?.combatants ?? [])].map((combatant) => combatant.tokenId),
    );
    const combatants = tokens
      .filter((token) => !existing.has(token.id))
      .map((token) => ({
        actorId: token.actorId,
        tokenId: token.id,
        sceneId: scene.id,
        hidden: false,
      }));
    if (combatants.length) {
      await combat.createEmbeddedDocuments("Combatant", combatants);
    }
    return combat;
  } catch (error) {
    warnings.push(
      `Жетоны размещены, но добавить их в бой не удалось: ${error.message}`,
    );
    return null;
  }
}

export async function deployActorsToScene(results, form) {
  const warnings = [];
  const mode = form.deploymentMode ?? "none";
  if (mode === "none" || !results?.length) {
    return { tokens: [], combat: null, warnings };
  }
  const scene = globalThis.canvas?.scene;
  if (!scene || typeof scene.createEmbeddedDocuments !== "function") {
    warnings.push("Нет активной сцены: NPC созданы, но жетоны не размещены.");
    return { tokens: [], combat: null, warnings };
  }

  const grid = Number(scene.grid?.size ?? globalThis.canvas?.grid?.size ?? 100);
  const origin = sceneOrigin(scene);
  const offsets = formationOffsets(results.length, mode, 2);
  const tokenData = results.map((result, index) => {
    const actor = result.actor;
    const prototype =
      actor.prototypeToken?.toObject?.() ?? actor.prototypeToken ?? {};
    const offset = offsets[index] ?? { x: 0, y: 0 };
    const source = structuredClone(prototype);
    delete source._id;
    return {
      ...source,
      actorId: actor.id,
      actorLink: true,
      name: actor.name,
      x: origin.x + offset.x * grid,
      y: origin.y + offset.y * grid,
      delta: {},
    };
  });

  let tokens = [];
  try {
    tokens = await scene.createEmbeddedDocuments("Token", tokenData);
  } catch (error) {
    warnings.push(
      `NPC созданы, но разместить жетоны не удалось: ${error.message}`,
    );
    return { tokens: [], combat: null, warnings };
  }
  const combat = form.addToCombat
    ? await addTokensToCombat(scene, tokens, warnings)
    : null;
  return { tokens, combat, warnings };
}
