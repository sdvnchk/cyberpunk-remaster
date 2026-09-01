import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const controllerModule = await import("../runtime/neuro-archive-controller.mjs?integration-289-red");

test("2.8.9 viewport capture rejects a bad framebuffer and falls back to the rendered stage", async () => {
  const calls = [];
  const canvas = {
    app: {
      renderer: {
        id: "renderer",
        extract: {
          async base64(options) {
            calls.push(["extract", options.target.id, options.format]);
            return "data:image/webp;base64,STAGE";
          },
        },
      },
    },
    stage: { id: "stage" },
    snapshot: {
      getFramebufferTexture(renderer) {
        calls.push(["snapshot", renderer.id]);
        return { id: "framebuffer" };
      },
    },
  };
  const imageHelper = {
    async textureToImage(texture) {
      calls.push(["texture", texture.id]);
      return "data:image/webp;base64,RED";
    },
  };
  const validate = async (value) => !value.endsWith(",RED");

  assert.equal(
    await controllerModule.extractFoundryViewportBase64(canvas, imageHelper, validate),
    "data:image/webp;base64,STAGE",
  );
  assert.deepEqual(calls, [
    ["snapshot", "renderer"],
    ["texture", "framebuffer"],
    ["extract", "stage", "webp"],
  ]);
});

test("2.8.9 marks messages written by a GM inside another user's archive as incoming contact replies", () => {
  assert.equal(typeof controllerModule.contactMessageDirection, "function");
  assert.equal(
    controllerModule.contactMessageDirection({
      isGM: true,
      archiveUserId: "player",
      currentUserId: "gm",
    }),
    "in",
  );
  assert.equal(
    controllerModule.contactMessageDirection({
      isGM: false,
      archiveUserId: "player",
      currentUserId: "player",
    }),
    "out",
  );
});

test("2.8.9 GM replies are persisted to the remote archive and mirrored live through chat flags", () => {
  const controller = read("runtime/neuro-archive-controller.mjs");
  assert.match(controller, /direction:\s*messageDirection/u);
  assert.match(controller, /archiveUserId:/u);
  assert.match(controller, /archiveActorId:/u);
  assert.match(controller, /await saveServer\(true\)/u);
  assert.match(controller, /createChatMessage/u);
  assert.match(controller, /ingestContactMessage/u);
});

test("2.8.9 changelog keeps the framebuffer and GM reply fixes documented", () => {
  const changelog = read("CHANGELOG.md");
  assert.match(changelog, /^## 2\.8\.9\b/mu);
  assert.match(changelog, /красн|однотон/u);
  assert.match(changelog, /ответ.*GM|GM.*ответ|ответ.*мастер/iu);
});
