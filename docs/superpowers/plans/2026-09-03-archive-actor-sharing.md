# Actor-targeted Archive Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add actor-specific, accept/decline archive sharing shared by Neuro, Cyber, and Neo Archive.

**Architecture:** Keep pending packets in a separate User flag so existing whole-store archive saves cannot erase them. Put packet creation, conflict resolution, socket delivery, and overlay dialogs in one shared runtime module; controllers expose minimal snapshots and call the same entry-sharing API.

**Tech Stack:** Foundry VTT 14 ApplicationV2/module sockets, native ES modules, Node test runner, CSS.

**Spec:** `docs/superpowers/specs/2026-09-03-archive-actor-sharing-design.md`

## Global Constraints
- Target platform: Foundry VTT 14.365 / SF2e 1.4.0.
- Canonical content data stays in `flags.cyberpunkRemaster.neuroArchive.data`.
- Pending packets stay separate at `flags.cyberpunkRemaster.neuroArchive.shareInbox`.
- Every delivery requires a concrete `targetActorId`.
- Actor groups in the target selector are collapsed by default.
- All three archive modes use the same sharing service and inbox.
- Existing independent archive themes, text scaling, context-overlay behavior, GM neural network, and PKT/CIC features must remain intact.
- Release version: 2.8.22.

---

### Task 1: Sharing data model and conflict resolution

**Files:**
- Create: `runtime/archive-share-service.mjs`
- Test: `tests/archive-share-service.test.mjs`

**Interfaces:**
- Produces: `buildShareTargetDirectory`, `createArchiveSharePacket`, `readArchiveShareInbox`, `enqueueArchiveSharePacket`, `declineArchiveSharePacket`, `inspectArchiveShareConflicts`, `acceptArchiveSharePacket`.

- [ ] Write failing unit tests for Actor-only target grouping, pending inbox isolation by Actor, origin/title conflict detection, update-with-local-message-preservation, copy-with-new-ID, and decline.
- [ ] Run `node --test tests/archive-share-service.test.mjs` and verify RED.
- [ ] Implement pure data helpers and User-flag read/write helpers in `runtime/archive-share-service.mjs`.
- [ ] Run the unit test and verify GREEN.

### Task 2: Online/offline delivery transport

**Files:**
- Modify: `runtime/archive-share-service.mjs`
- Test: `tests/archive-share-service.test.mjs`

**Interfaces:**
- Produces: `initializeArchiveSharing`, `sendArchiveSharePacket`; module socket event types `archive-share-deliver` and `archive-share-ack`.

- [ ] Add failing tests for online target self-persistence, offline active-GM relay, no-route rejection, ownership validation, and acknowledgement routing.
- [ ] Run the focused tests and verify RED.
- [ ] Implement one idempotent socket listener plus request/ack delivery with timeout and GM offline relay.
- [ ] Run the focused tests and verify GREEN.

### Task 3: Shared target selector, inbox, and conflict UI

**Files:**
- Modify: `runtime/archive-share-service.mjs`
- Modify: `styles/neuro-archive.css`
- Test: `tests/integration-2.8.22.test.mjs`

**Interfaces:**
- Produces: `openArchiveShareDialog`, `openArchiveShareScopePicker`, `openArchiveShareInbox`, `countArchiveShareInbox`.

- [ ] Add failing integration assertions for body-level share overlay, collapsed User groups, explicit Actor selection, primary-character marker, accept/decline controls, and stable grid CSS.
- [ ] Run `node --test tests/integration-2.8.22.test.mjs` and verify RED.
- [ ] Implement overlay dialogs and responsive layout CSS with fixed icon/avatar columns and collapsed Actor groups.
- [ ] Run the integration test and verify GREEN.

### Task 4: Integrate all three archive controllers and hub

**Files:**
- Modify: `runtime/neuro-archive-controller.mjs`
- Modify: `runtime/cyber-archive-controller.mjs`
- Modify: `runtime/neo-archive-controller.mjs`
- Modify: `runtime/neuro-archive-runtime.mjs`
- Modify: `templates/neuro-archive.hbs`
- Test: `tests/integration-2.8.22.test.mjs`

**Interfaces:**
- Each controller produces `getShareSnapshot()` with current Actor, current section, and cloned notebook content.
- Runtime uses the common service for entry/section/archive send and inbox accept/decline.

- [ ] Add failing assertions that every context menu has `Поделиться`, every controller exposes `getShareSnapshot`, hub has `Поделиться` and `Входящие`, and runtime initializes socket sharing.
- [ ] Run the integration test and verify RED.
- [ ] Wire the common share service into all three entry context menus and controller APIs.
- [ ] Add hub controls; flush before acceptance and remount the active mode after accepted canonical changes.
- [ ] Run the integration test and verify GREEN.

### Task 5: Release metadata and regression verification

**Files:**
- Modify: `module.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Test: `tests/integration-2.8.22.test.mjs`

**Interfaces:**
- Produces release `2.8.22`.

- [ ] Add failing metadata/changelog assertions for 2.8.22.
- [ ] Run focused test and verify RED.
- [ ] Update metadata and document actor-targeted sharing, pending acceptance, conflict choices, and collapsed actor groups.
- [ ] Run focused test and verify GREEN.
- [ ] Run all runtime/integration tests excluding `build-pipeline.test.mjs`.
- [ ] Run JS/MJS syntax checks, JSON parse checks, CSS delimiter checks, and `node scripts/audit-pkt-bonuses.mjs`.
- [ ] Build a clean ZIP, extract it to a fresh verification directory, and repeat focused tests/static checks against the extracted artifact.
