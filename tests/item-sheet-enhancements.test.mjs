import assert from "node:assert/strict";
import test from "node:test";

globalThis.Hooks = {
  on() {},
  once() {},
};
globalThis.document = {
  createElement() {
    return {
      attributes: {},
      className: "",
      textContent: "",
      setAttribute(key, value) {
        this.attributes[key] = value;
      },
    };
  },
};

const { appendUpgradeBadge, itemGrade, upgradeMaximum } =
  await import("../runtime/item-sheet-enhancements.mjs?tests");

function item(type, traits) {
  return {
    system: { traits: { value: traits } },
    isOfType(...types) {
      return types.includes(type);
    },
  };
}

test("upgrade grade is derived from traits and item type", () => {
  assert.equal(itemGrade(item("weapon", ["technical", "paragon"])), "paragon");
  assert.equal(upgradeMaximum(item("weapon", ["paragon"])), 3);
  assert.equal(upgradeMaximum(item("armor", ["paragon"])), 3);
  assert.equal(upgradeMaximum(item("equipment", ["paragon"])), 0);
});

test("upgrade badge is appended to collapsed inventory descriptions", () => {
  const paragraph = {
    textContent: "Улучшения: 1",
    appended: [],
    appendChild(child) {
      this.appended.push(child);
    },
  };
  const preview = {
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      return selector === "p" ? [paragraph] : [];
    },
  };

  appendUpgradeBadge([preview], item("weapon", ["elite"]));
  assert.equal(paragraph.appended.length, 1);
  assert.equal(paragraph.appended[0].textContent, " (+2)");
  assert.equal(paragraph.appended[0].className, "sf2eu-overlay");
});
