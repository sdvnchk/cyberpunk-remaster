import assert from "node:assert/strict";
import test from "node:test";

const share = await import("../runtime/archive-share-service.mjs?2822-share-test");

function makeActor(id, name, owners = [], { type = "character" } = {}) {
  return {
    id,
    name,
    type,
    img: `${id}.webp`,
    ownership: Object.fromEntries(owners.map((userId) => [userId, 3])),
    testUserPermission(user, permission) {
      return permission === "OWNER" && owners.includes(String(user?.id ?? user?._id ?? ""));
    },
  };
}

function makeUser(id, name, { active = true, isGM = false, character = null } = {}) {
  const updates = [];
  return {
    id,
    name,
    active,
    isGM,
    character,
    flags: {},
    updates,
    async update(payload) {
      updates.push(structuredClone(payload));
      const data = payload["flags.cyberpunkRemaster.neuroArchive.data"];
      const inbox = payload["flags.cyberpunkRemaster.neuroArchive.shareInbox"];
      this.flags.cyberpunkRemaster ??= {};
      this.flags.cyberpunkRemaster.neuroArchive ??= {};
      if (data) this.flags.cyberpunkRemaster.neuroArchive.data = structuredClone(data);
      if (inbox) this.flags.cyberpunkRemaster.neuroArchive.shareInbox = structuredClone(inbox);
    },
  };
}

function baseStore(actorId = "a1") {
  return {
    version: 3,
    activeActorId: actorId,
    notebooks: {
      [actorId]: {
        actorId,
        actorName: "V",
        entries: {
          people: [], gangs: [], corporations: [], fixers: [], rippers: [], lawmen: [], noosphere: [], nomads: [],
          subscriptions: [], locations: [], quests: [], clues: [], books: [], sessions: [], notes: [],
        },
      },
    },
  };
}

test("target directory groups only owned character Actors and marks the primary Actor", () => {
  const u1 = makeUser("u1", "Alice", { character: { id: "a2" } });
  const u2 = makeUser("u2", "Bob", { active: false, character: { id: "b1" } });
  const actors = [
    makeActor("a1", "Solo", ["u1"]),
    makeActor("a2", "Netrunner", ["u1"]),
    makeActor("b1", "Tech", ["u2"]),
    makeActor("shared", "Shared", ["u1", "u2"]),
    makeActor("npc", "NPC", ["u1"], { type: "npc" }),
  ];
  const directory = share.buildShareTargetDirectory({ users: [u1, u2], actors, currentUserId: "u1", hasActiveGM: true });
  assert.equal(directory.length, 2);
  assert.deepEqual(directory[0].actors.map((a) => a.id), ["a2", "a1", "shared"]);
  assert.equal(directory[0].actors[0].primary, true);
  assert.equal(directory[1].actors.some((a) => a.id === "a1"), false);
  assert.equal(directory[1].deliveryAvailable, true);
});

test("pending inbox is isolated by target Actor", async () => {
  const user = makeUser("u2", "Bob");
  const packetA = share.createArchiveSharePacket({
    senderUser: { id: "u1", name: "Alice" },
    sourceActor: { id: "a1", name: "Solo" },
    targetUserId: "u2",
    targetActorId: "b1",
    scope: "entry",
    records: [{ section: "notes", entry: { id: "n1", title: "Note A", type: "notes" } }],
  });
  const packetB = share.createArchiveSharePacket({
    senderUser: { id: "u1", name: "Alice" },
    sourceActor: { id: "a1", name: "Solo" },
    targetUserId: "u2",
    targetActorId: "b2",
    scope: "entry",
    records: [{ section: "notes", entry: { id: "n2", title: "Note B", type: "notes" } }],
  });
  await share.enqueueArchiveSharePacket(user, packetA);
  await share.enqueueArchiveSharePacket(user, packetB);
  assert.equal(share.readArchiveShareInbox(user, "b1").length, 1);
  assert.equal(share.readArchiveShareInbox(user, "b2").length, 1);
  assert.equal(share.readArchiveShareInbox(user, "other").length, 0);
});

test("conflicts use share origin first and title fallback second", () => {
  const store = baseStore("b1");
  store.notebooks.b1.entries.people.push({
    id: "local-raven",
    title: "Raven",
    type: "people",
    _shareOrigin: { sourceUserId: "u1", sourceActorId: "a1", section: "people", entryId: "remote-raven" },
  });
  const originPacket = share.createArchiveSharePacket({
    senderUser: { id: "u1", name: "Alice" }, sourceActor: { id: "a1", name: "Solo" }, targetUserId: "u2", targetActorId: "b1",
    records: [{ section: "people", entry: { id: "remote-raven", title: "Different title", type: "people" } }],
  });
  assert.equal(share.inspectArchiveShareConflicts(store, "b1", originPacket)[0].existing.id, "local-raven");

  const titlePacket = share.createArchiveSharePacket({
    senderUser: { id: "u9", name: "Other" }, sourceActor: { id: "z1", name: "Other Actor" }, targetUserId: "u2", targetActorId: "b1",
    records: [{ section: "people", entry: { id: "other-id", title: "Raven", type: "people" } }],
  });
  assert.equal(share.inspectArchiveShareConflicts(store, "b1", titlePacket)[0].existing.id, "local-raven");
});

test("update resolution preserves local contact messages and local id", async () => {
  const user = makeUser("u2", "Bob");
  user.flags.cyberpunkRemaster = { neuroArchive: { data: baseStore("b1") } };
  user.flags.cyberpunkRemaster.neuroArchive.data.notebooks.b1.entries.people.push({
    id: "local-raven", title: "Raven", type: "people", role: "Old role", pinned: true,
    messages: [{ id: "local-msg", body: "keep me" }],
    _shareOrigin: { sourceUserId: "u1", sourceActorId: "a1", section: "people", entryId: "remote-raven" },
  });
  const packet = share.createArchiveSharePacket({
    senderUser: { id: "u1", name: "Alice" }, sourceActor: { id: "a1", name: "Solo" }, targetUserId: "u2", targetActorId: "b1",
    records: [{ section: "people", entry: { id: "remote-raven", title: "Raven", type: "people", role: "New role", messages: [{ id: "remote", body: "discard remote history" }] } }],
  });
  await share.enqueueArchiveSharePacket(user, packet);
  const result = await share.acceptArchiveSharePacket(user, "b1", packet.id, "update");
  const person = user.flags.cyberpunkRemaster.neuroArchive.data.notebooks.b1.entries.people[0];
  assert.equal(result.accepted, true);
  assert.equal(person.id, "local-raven");
  assert.equal(person.role, "New role");
  assert.equal(person.pinned, true);
  assert.deepEqual(person.messages, [{ id: "local-msg", body: "keep me" }]);
  assert.equal(share.readArchiveShareInbox(user, "b1").length, 0);
});

test("copy resolution creates a fresh independent id", async () => {
  const user = makeUser("u2", "Bob");
  user.flags.cyberpunkRemaster = { neuroArchive: { data: baseStore("b1") } };
  user.flags.cyberpunkRemaster.neuroArchive.data.notebooks.b1.entries.notes.push({ id: "existing", title: "Intel", type: "notes" });
  const packet = share.createArchiveSharePacket({
    senderUser: { id: "u1", name: "Alice" }, sourceActor: { id: "a1", name: "Solo" }, targetUserId: "u2", targetActorId: "b1",
    records: [{ section: "notes", entry: { id: "existing", title: "Intel", type: "notes", content: "new" } }],
  });
  await share.enqueueArchiveSharePacket(user, packet);
  const result = await share.acceptArchiveSharePacket(user, "b1", packet.id, "copy");
  const notes = user.flags.cyberpunkRemaster.neuroArchive.data.notebooks.b1.entries.notes;
  assert.equal(result.accepted, true);
  assert.equal(notes.length, 2);
  assert.notEqual(notes[1].id, "existing");
  assert.equal(notes[1].content, "new");
});

test("decline removes only the selected Actor packet", async () => {
  const user = makeUser("u2", "Bob");
  const packet = share.createArchiveSharePacket({
    senderUser: { id: "u1", name: "Alice" }, sourceActor: { id: "a1", name: "Solo" }, targetUserId: "u2", targetActorId: "b1",
    records: [{ section: "notes", entry: { id: "n1", title: "N", type: "notes" } }],
  });
  await share.enqueueArchiveSharePacket(user, packet);
  assert.equal(await share.declineArchiveSharePacket(user, "b1", packet.id), true);
  assert.equal(share.readArchiveShareInbox(user, "b1").length, 0);
});

test("delivery rejects a target Actor not owned by the target User", async () => {
  const u1 = makeUser("u1", "Alice");
  const u2 = makeUser("u2", "Bob");
  const actor = makeActor("b1", "Tech", ["u1"]);
  const packet = share.createArchiveSharePacket({
    senderUser: u1, sourceActor: { id: "a1", name: "Solo" }, targetUserId: "u2", targetActorId: "b1",
    records: [{ section: "notes", entry: { id: "n", title: "N", type: "notes" } }],
  });
  await assert.rejects(() => share.persistIncomingArchiveShare({ game: { users: { contents: [u1, u2] }, actors: { contents: [actor] } }, targetUser: u2, packet }), /не принадлежит/i);
});

test("offline delivery requires an active GM for a non-GM sender", async () => {
  const u1 = makeUser("u1", "Alice");
  const u2 = makeUser("u2", "Bob", { active: false });
  const actor = makeActor("b1", "Tech", ["u2"]);
  const packet = share.createArchiveSharePacket({ senderUser: u1, sourceActor: { id: "a1", name: "Solo" }, targetUserId: "u2", targetActorId: "b1", records: [{ section: "notes", entry: { id: "n", title: "N", type: "notes" } }] });
  const game = { user: u1, users: { contents: [u1, u2], activeGM: null }, actors: { contents: [actor] }, socket: { emit() {} } };
  await assert.rejects(() => share.sendArchiveSharePacket(packet, { game, timeoutMs: 5 }), /нет активного GM/i);
});

test("offline target is delivered through the active GM relay and acknowledged to a non-GM sender", async () => {
  const senderShare = await import("../runtime/archive-share-service.mjs?2822-relay-sender");
  const gmShare = await import("../runtime/archive-share-service.mjs?2822-relay-gm");
  const u1 = makeUser("u1", "Alice");
  const u2 = makeUser("u2", "Bob", { active: false });
  const gm = makeUser("gm", "GM", { active: true, isGM: true });
  const actor = makeActor("b1", "Tech", ["u2"]);
  const listeners = new Map();
  const socket = {
    on(channel, callback) {
      const callbacks = listeners.get(channel) ?? [];
      callbacks.push(callback);
      listeners.set(channel, callbacks);
    },
    emit(channel, message) {
      for (const callback of listeners.get(channel) ?? []) callback(structuredClone(message));
    },
  };
  const users = { contents: [u1, u2, gm], activeGM: gm };
  const actors = { contents: [actor] };
  const senderGame = { user: u1, users, actors, socket };
  const gmGame = { user: gm, users, actors, socket };
  gmShare.initializeArchiveSharing({ game: gmGame });
  const packet = senderShare.createArchiveSharePacket({
    senderUser: u1,
    sourceActor: { id: "a1", name: "Solo" },
    targetUserId: "u2",
    targetActorId: "b1",
    records: [{ section: "notes", entry: { id: "n-relay", title: "Relay note", type: "notes" } }],
  });
  const result = await senderShare.sendArchiveSharePacket(packet, { game: senderGame, timeoutMs: 100 });
  assert.equal(result.ok, true);
  assert.equal(senderShare.readArchiveShareInbox(u2, "b1").length, 1);
  assert.equal(senderShare.readArchiveShareInbox(u2, "b1")[0].records[0].entry.id, "n-relay");
});

test("share theme capture preserves active archive palette variables", () => {
  const values = new Map([
    ["--bg", "#f4efe3"],
    ["--panel", "#fffaf0"],
    ["--ink", "#241d15"],
    ["--gold", "#9b5d16"],
    ["--theme-node", "#d13f72"],
    ["--archive-user-font-size", "18px"],
  ]);
  const themeSource = {
    style: { getPropertyValue(name) { return values.get(name) ?? ""; } },
  };
  const theme = share.captureArchiveShareTheme(themeSource, "neo");
  assert.equal(theme.mode, "neo");
  assert.equal(theme.variables["--bg"], "#f4efe3");
  assert.equal(theme.variables["--panel"], "#fffaf0");
  assert.equal(theme.variables["--ink"], "#241d15");
  assert.equal(theme.variables["--gold"], "#9b5d16");
  assert.equal(theme.variables["--theme-node"], "#d13f72");
  assert.equal(theme.variables["--archive-user-font-size"], "18px");
});
