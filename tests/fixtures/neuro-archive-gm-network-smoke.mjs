import assert from "node:assert/strict";
import { createNeuroArchiveController } from "../../runtime/neuro-archive-controller.mjs";

const gm = {
  id: "gm-one",
  _id: "gm-one",
  name: "GM",
  isGM: true,
  flags: {},
};
const player = {
  id: "player-one",
  _id: "player-one",
  name: "Player One",
  isGM: false,
  flags: {
    cyberpunkRemaster: {
      neuroArchive: {
        data: {
          version: 2,
          updatedAt: "2026-09-02T12:00:00.000Z",
          activeActorId: "actor-v",
          notebooks: {
            "actor-v": {
              actorId: "actor-v",
              actorName: "V",
              actorImg: "v.webp",
              entries: {
                people: [
                  {
                    id: "contact-raven",
                    type: "people",
                    title: "Raven",
                    role: "Фиксер",
                    attitude: "Союзник",
                    image: "raven.webp",
                    messages: [
                      {
                        id: "message-one",
                        direction: "out",
                        body: "Есть работа?",
                        createdAt: "2026-09-02T12:00:00.000Z",
                        archiveUserId: "player-one",
                        archiveActorId: "actor-v",
                        contactId: "contact-raven",
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
};

globalThis.game = {
  world: { id: "gm-network-world" },
  user: gm,
  users: { contents: [gm, player] },
  actors: { contents: [] },
};
globalThis.ui = {
  notifications: {
    info() {},
    warn() {},
    error() {},
  },
};
globalThis.localStorage = {
  values: new Map(),
  getItem(key) {
    return this.values.get(key) ?? null;
  },
  setItem(key, value) {
    this.values.set(key, value);
  },
};
globalThis.document = {
  activeElement: null,
  addEventListener() {},
  removeEventListener() {},
  querySelector() {
    return null;
  },
  createElement() {
    return {};
  },
};
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
};

const archiveWindow = { innerHTML: "" };
const root = {
  isConnected: true,
  innerHTML: "",
  style: { setProperty() {} },
  addEventListener() {},
  querySelector(selector) {
    return selector === ".pcm-window" ? archiveWindow : null;
  },
  querySelectorAll() {
    return [];
  },
};

const controller = createNeuroArchiveController(root);
assert.match(archiveWindow.innerHTML, /GM \/\/ НЕЙРО-СЕТЬ/u);
assert.match(archiveWindow.innerHTML, /data-section="gm-network"/u);

controller.state.section = "gm-network";
controller.open();

assert.match(archiveWindow.innerHTML, /MASTER CONTROL SPACE/u);
assert.match(archiveWindow.innerHTML, /Player One/u);
assert.match(archiveWindow.innerHTML, />V</u);
assert.match(archiveWindow.innerHTML, /Raven/u);
assert.match(archiveWindow.innerHTML, /Есть работа\?/u);
assert.match(archiveWindow.innerHTML, /data-gm-player="player-one"/u);
assert.match(archiveWindow.innerHTML, /data-gm-actor/u);
assert.match(archiveWindow.innerHTML, /data-gm-contact="contact-raven"/u);
assert.match(archiveWindow.innerHTML, /send-gm-contact-message/u);

controller.destroy();
assert.equal(controller.state.root, null);
