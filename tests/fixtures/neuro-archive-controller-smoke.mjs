import assert from "node:assert/strict";
import { createNeuroArchiveController } from "../../runtime/neuro-archive-controller.mjs";

const actor = {
  id: "actor-one",
  _id: "actor-one",
  name: "Оперативник",
  img: "icons/svg/mystery-man.svg",
  type: "character",
  testUserPermission: () => true,
};
const user = {
  id: "user-one",
  _id: "user-one",
  name: "Игрок",
  isGM: false,
  character: actor,
  flags: {
    personalChronicleMacro: {
      data: {
        version: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
        activeActorId: actor.id,
        notebooks: {
          [actor.id]: {
            actorId: actor.id,
            actorName: actor.name,
            actorImg: actor.img,
            entries: {
              notes: [
                {
                  id: "legacy-note",
                  type: "notes",
                  title: "Старая запись",
                  content: "Данные прежнего макроса",
                },
              ],
            },
          },
        },
      },
    },
  },
};

globalThis.game = {
  world: { id: "test-world" },
  user,
  users: { contents: [user] },
  actors: { contents: [actor] },
};
globalThis.ui = {
  notifications: {
    info() {},
    warn() {},
    error() {},
  },
};
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
};
globalThis.document = {
  activeElement: null,
  addEventListener() {},
  removeEventListener() {},
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
const notebook = controller.state.store.notebooks[actor.id];
const note = notebook.entries.notes[0];

assert.equal(note.title, "Старая запись");
assert.equal(note.content, "Данные прежнего макроса");
assert.deepEqual(note.fragments, []);
assert.deepEqual(note.gallery, []);
assert.deepEqual(note.locationIds, []);
assert.ok(notebook.entries.people);
assert.ok(notebook.entries.locations);
assert.match(archiveWindow.innerHTML, /НЕЙРО-АРХИВ RED/u);
assert.doesNotMatch(archiveWindow.innerHTML, /data-action="close"/u);

controller.destroy();
assert.equal(controller.state.root, null);
