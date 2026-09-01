import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const controllerModule = await import("../runtime/neuro-archive-controller.mjs?integration-287-red");

test("2.8.7 Neuro Archive exposes contact messaging recipient selection", () => {
  assert.equal(
    typeof controllerModule.selectContactMessageRecipientIds,
    "function",
  );

  const sender = { id: "sender", active: true, isGM: false };
  const owner = { id: "owner", active: true, isGM: false };
  const gm = { id: "gm", active: true, isGM: true };
  const actor = {
    testUserPermission(user, level) {
      return level === "OWNER" && user.id === "owner";
    },
  };

  assert.deepEqual(
    controllerModule.selectContactMessageRecipientIds({
      users: [sender, owner, gm],
      senderId: sender.id,
      actor,
    }),
    ["owner", "sender"],
  );
  assert.deepEqual(
    controllerModule.selectContactMessageRecipientIds({
      users: [sender, gm],
      senderId: sender.id,
      actor: null,
    }),
    ["gm", "sender"],
  );
});

test("2.8.7 contact overview has a persistent message composer and thread", () => {
  const controller = read("runtime/neuro-archive-controller.mjs");
  assert.match(controller, /data-action="compose-person-message"/u);
  assert.match(controller, /data-action="send-person-message"/u);
  assert.match(controller, /data-person-message-input/u);
  assert.match(controller, /person\.messages/u);
  assert.match(controller, /ChatMessage\.create/u);
});

test("2.8.7 exposes a framebuffer-first Foundry viewport extractor", async () => {
  assert.equal(typeof controllerModule.extractFoundryViewportBase64, "function");

  const calls = [];
  const texture = { id: "framebuffer-texture" };
  const canvas = {
    app: { renderer: { id: "renderer" } },
    snapshot: {
      getFramebufferTexture(renderer) {
        calls.push(["snapshot", renderer.id]);
        return texture;
      },
    },
  };
  const imageHelper = {
    async textureToImage(received, options) {
      calls.push(["textureToImage", received.id, options.format]);
      return "data:image/webp;base64,FRAME";
    },
  };

  assert.equal(
    await controllerModule.extractFoundryViewportBase64(canvas, imageHelper),
    "data:image/webp;base64,FRAME",
  );
  assert.deepEqual(calls, [
    ["snapshot", "renderer"],
    ["textureToImage", "framebuffer-texture", "image/webp"],
  ]);
});

test("2.8.7 scene capture persists token vision instead of raw scene background", () => {
  const controller = read("runtime/neuro-archive-controller.mjs");
  assert.match(controller, /extractFoundryViewportBase64/u);
  assert.match(controller, /sceneCaptureMode\s*=\s*"token-vision"/u);
  assert.match(controller, /location\.image\s*=\s*image/u);
  assert.doesNotMatch(controller, /location\.image\s*=\s*rawBackground/u);
});

test("2.8.7 changelog and integrated Implant Creator documentation remain preserved", () => {
  const changelog = read("CHANGELOG.md");
  const readme = read("README.md");
  assert.match(changelog, /^## 2\.8\.7\b/mu);
  assert.match(changelog, /сообщен/u);
  assert.match(changelog, /сним/u);
  assert.match(changelog, /Конструктор имплантов/u);
  assert.match(readme, /CyberpunkRemaster\.implantCreator/u);
});
