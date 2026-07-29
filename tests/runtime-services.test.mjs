import assert from "node:assert/strict";
import test from "node:test";
import {
  clearActorOperationQueues,
  enqueueActorOperation,
} from "../runtime/actor-operation-queue.mjs";
import { parseCyberwareDescription } from "../runtime/cyberware-schema.mjs";
import {
  clearPktCatalogCache,
  loadPktCatalog,
} from "../runtime/pkt-catalog.mjs";

test("description parser uses the final canonical block", () => {
  const parsed = parseCyberwareDescription(`
    <p>Реклама обещает Hard Cost 99, но это не блок правил.</p>
    <p>Тип импланта: Модуль</p>
    <p>Слоты: 2</p>
    <p>Stress Cost: [[/r 2d6 + 1d4]]</p>
    <p>Hard Cost: 3</p>
  `);
  assert.deepEqual(parsed, {
    implantType: "module",
    slots: 2,
    stressFormula: "2d6 + 1d4",
    hardCost: 3,
    fallbackFields: [],
  });
});

test("actor operations share one serial queue", async () => {
  clearActorOperationQueues();
  const actor = { uuid: "Actor.queue-test" };
  const events = [];
  let releaseFirst;
  let markStarted;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const firstStarted = new Promise((resolve) => {
    markStarted = resolve;
  });
  const first = enqueueActorOperation(actor, async () => {
    events.push("first:start");
    markStarted();
    await firstGate;
    events.push("first:end");
  });
  const second = enqueueActorOperation(actor, async () => {
    events.push("second");
  });
  await firstStarted;
  assert.deepEqual(events, ["first:start"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first:start", "first:end", "second"]);
});

test("PKT catalog loads choices and only fetches required item documents", async () => {
  clearPktCatalogCache();
  const requested = [];
  const entries = new Map(
    [
      ["body", "Тактический корпус"],
      ["fixed", "Фиксированный модуль"],
      ["choice-a", "Вариант A"],
      ["choice-b", "Вариант B"],
      ["replacement", "Заменяемая база"],
      ["unrelated", "Посторонний предмет"],
    ].map(([id, name]) => [
      id,
      {
        _id: id,
        name,
        img: `${id}.webp`,
        flags: {
          "cyberpunk-remaster":
            id === "replacement"
              ? {
                  pktFamily: "eyes",
                  pktComponentQuality: 1,
                  pktReplaceable: true,
                }
              : {},
        },
        system: {
          description: {
            value:
              "<p>Тип импланта: База</p><p>Слоты: 2</p>" +
              "<p>Stress Cost: 1d6</p><p>Hard Cost: 1</p>",
          },
        },
      },
    ]),
  );
  const game = {
    packs: new Map([
      [
        "journals",
        {
          async getDocuments() {
            return [
              {
                pages: [
                  {
                    flags: {
                      "cyberpunk-remaster": {
                        pktModel: {
                          key: "test-model",
                          requiredBodyId: "body",
                          unique: [{ itemId: "fixed" }],
                          choices: [
                            {
                              key: "choice",
                              itemIds: ["choice-a", "choice-b"],
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            ];
          },
        },
      ],
      [
        "items",
        {
          async getIndex() {
            return [...entries.values()];
          },
          async getDocument(id) {
            requested.push(id);
            return entries.get(id);
          },
        },
      ],
    ]),
  };
  const getFlag = (entry, key) => entry.flags?.["cyberpunk-remaster"]?.[key];
  const result = await loadPktCatalog({
    game,
    itemPackId: "items",
    journalPackId: "journals",
    getFlag,
    getImplantType: (entry) => parseCyberwareDescription(entry).implantType,
    getSlots: (entry) => parseCyberwareDescription(entry).slots,
    readCyberwareDescription: parseCyberwareDescription,
  });

  assert.deepEqual(
    result.models[0].choices[0].options.map((entry) => entry.itemId),
    ["choice-a", "choice-b"],
  );
  assert.equal(result.replacements[0].itemId, "replacement");
  assert.deepEqual(requested.sort(), [
    "body",
    "choice-a",
    "choice-b",
    "fixed",
    "replacement",
  ]);
});
