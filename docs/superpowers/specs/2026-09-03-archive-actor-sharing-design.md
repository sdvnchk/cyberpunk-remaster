# Actor-targeted Archive Sharing Design

## Goal
Add one shared transfer system for all three archive interfaces (Neuro, Cyber, Neo) so a player can send any archive record to one specific Actor owned by a selected Foundry User. Incoming data must remain pending until the recipient accepts it.

## Shared data model
Pending transfers are stored outside the canonical archive payload at `flags.cyberpunkRemaster.neuroArchive.shareInbox`. The inbox is keyed by target Actor ID so a packet sent to one character never appears for another character owned by the same User. Canonical archive data remains at `flags.cyberpunkRemaster.neuroArchive.data` and is changed only after acceptance.

Each packet contains sender User metadata, source Actor metadata, target User/Actor IDs, scope (`entry`, `section`, or `archive`), label, timestamp, and a list of records. Each record stores its archive section plus a cloned entry and a stable source-origin tuple (`sourceUserId`, `sourceActorId`, `section`, `entryId`).

## Delivery
Use the module socket channel. If the target User is online, that User persists their own inbox and acknowledges the request. If the target is offline, the active GM persists the packet for that User. A non-GM sender must refuse an offline delivery when no active GM is available. The receiving side validates that the selected Actor is actually owned by the target User.

## Recipient flow
The archive hub exposes a common `Входящие` control in every mode. Pending packets are shown only for the currently selected Actor. `Отклонить` removes the pending packet. `Принять` checks for conflicts before modifying canonical archive data.

Conflict detection first uses the stable share origin, then exact source ID, then normalized title within the same section. When a conflict exists the recipient chooses:
- `Обновить существующее`: keep the local record ID and local-only fields, apply incoming content, preserve local contact message history, and retain the share origin.
- `Создать копию`: create independent records with fresh IDs.
- `Отмена`: make no change and keep the packet pending.

## Sender flow
Every record context menu in Neuro, Cyber, and Neo gets `Поделиться`. The archive hub also exposes a shared control for `Текущий раздел` and `Весь архив`. `Весь архив` means all content records from the fifteen unified archive sections; UI appearance/settings are not transferred.

Target selection is always `User -> owned Actor`. User rows start collapsed. Expanding a User reveals only their owned character Actors. `User.character` is marked as the primary character. Send is disabled until a specific Actor is selected. Offline Users remain selectable only when the sender is GM or an active GM can relay the packet.

## UI constraints
The share selector and inbox use a body-level overlay so they are not clipped by archive overflow/transform rules. Rows use fixed icon/avatar columns plus `minmax(0,1fr)` text columns, `min-width:0`, and wrapping/ellipsis rules so labels do not drift when the Foundry window or archive text size changes.

## Synchronization
Before accepting a packet through the open Archive application, flush the active controller. After canonical data is updated, remount the active archive mode from server data without flushing the stale controller again. Pending inbox storage is separate, so normal archive autosaves cannot overwrite newly delivered pending packets.

## Versioning
Ship as Cyberpunk Remaster 2.8.22 and document the feature in `CHANGELOG.md`.
