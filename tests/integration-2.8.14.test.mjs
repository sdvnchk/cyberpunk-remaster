import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const controllerModule = await import("../runtime/neuro-archive-controller.mjs?integration-2814-gm-network");

test("2.8.14 GM network indexes every player contact, including contacts without a conversation", () => {
  assert.equal(typeof controllerModule.collectGmNeuroThreads, "function");
  const threads = controllerModule.collectGmNeuroThreads({
    currentUserId: "gm",
    readAt: {
      "player-a:actor-a:contact-a": "2026-09-02T10:00:00.000Z",
    },
    archives: [
      {
        userId: "gm",
        userName: "GM",
        isGM: true,
        store: { notebooks: {} },
      },
      {
        userId: "player-a",
        userName: "Player A",
        isGM: false,
        store: {
          notebooks: {
            "actor-a": {
              actorName: "V",
              actorImg: "v.webp",
              entries: {
                people: [
                  {
                    id: "contact-a",
                    title: "Raven",
                    image: "raven.webp",
                    updatedAt: "2026-09-02T10:30:00.000Z",
                    messages: [
                      { id: "m1", direction: "out", body: "ping", createdAt: "2026-09-02T10:00:00.000Z" },
                      { id: "m2", direction: "in", body: "pong", createdAt: "2026-09-02T10:15:00.000Z" },
                      { id: "m3", direction: "out", body: "again", createdAt: "2026-09-02T10:30:00.000Z" },
                    ],
                  },
                  {
                    id: "contact-b",
                    title: "Fixer Zero",
                    image: "",
                    updatedAt: "2026-09-01T18:00:00.000Z",
                    messages: [],
                  },
                ],
              },
            },
          },
        },
      },
    ],
  });

  assert.equal(threads.length, 2);
  assert.equal(threads[0].key, "player-a:actor-a:contact-a");
  assert.equal(threads[0].unread, 1);
  assert.equal(threads[0].latestMessage.body, "again");
  assert.equal(threads[1].contactName, "Fixer Zero");
  assert.equal(threads[1].messageCount, 0);
});

test("2.8.14 GM gets a dedicated neuro-network workspace with player, actor and contact selectors", () => {
  const controller = read("runtime/neuro-archive-controller.mjs");
  const styles = read("styles/neuro-archive.css");

  assert.match(controller, /GM\s*\/\/\s*НЕЙРО-СЕТЬ/u);
  assert.match(controller, /function gmNetworkView\(/u);
  assert.match(controller, /data-gm-player/u);
  assert.match(controller, /data-gm-actor/u);
  assert.match(controller, /data-gm-contact/u);
  assert.match(controller, /send-gm-contact-message/u);
  assert.match(styles, /\.pcm-gm-network/u);
  assert.match(styles, /\.pcm-gm-player-list/u);
  assert.match(styles, /\.pcm-gm-thread-pane/u);
});

test("2.8.14 versions and changelog describe the integrated GM neuro-network", () => {
  const manifest = JSON.parse(read("module.json"));
  const pkg = JSON.parse(read("package.json"));
  const constants = read("runtime/neuro-archive-constants.mjs");
  const changelog = read("CHANGELOG.md");

  assert.equal(manifest.version, pkg.version);
  assert.match(constants, /NEURO_ARCHIVE_VERSION\s*=\s*"4\.3\.0"/u);
  assert.match(changelog, /^## 2\.8\.14\b/mu);
  assert.match(changelog, /GM\s*\/\/\s*НЕЙРО-СЕТЬ/u);
});


test("2.8.14 GM network renders without requiring the GM to own a character Actor", () => {
  const { NODE_V8_COVERAGE: _coverage, ...environment } = process.env;
  execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("./fixtures/neuro-archive-gm-network-smoke.mjs", import.meta.url),
      ),
    ],
    { env: environment, stdio: "pipe" },
  );
});
