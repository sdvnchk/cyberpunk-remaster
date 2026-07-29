export const HUMANITY_RULE_KEY = "CyberpunkHumanity";
export const HUMANITY_SYNTHETIC_KEY = "cyberpunk-remaster";

export function addHumanityAdjustment(
  actor,
  { mode = "add", value = 0, label = "", source = null } = {},
) {
  actor.synthetics ??= {};
  const namespace = actor.synthetics[HUMANITY_SYNTHETIC_KEY] ??= {};
  const adjustments = namespace.humanityAdjustments ??= [];
  if (
    source &&
    adjustments.some((adjustment) => adjustment.source === source)
  ) {
    return false;
  }
  adjustments.push({
    mode: mode === "override" ? "override" : "add",
    value: Math.trunc(Number(value)),
    label: String(label ?? ""),
    source,
  });
  return true;
}

export function createHumanityRuleElement(
  BaseRuleElement,
  fields,
) {
  if (!BaseRuleElement || !fields?.NumberField || !fields?.StringField) {
    return null;
  }

  return class CyberpunkHumanityRuleElement extends BaseRuleElement {
    static validActorTypes = ["character"];
    static autogenForms = true;

    static get defaultKey() {
      return HUMANITY_RULE_KEY;
    }

    static get description() {
      return "Изменяет предел Человечности персонажа до вычитания Hard Cost.";
    }

    static defineSchema() {
      return {
        ...super.defineSchema(),
        mode: new fields.StringField({
          required: true,
          nullable: false,
          choices: ["add", "override"],
          initial: "add",
        }),
        value: new fields.NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 0,
        }),
      };
    }

    beforePrepareData() {
      if (!this.test()) return;
      const value = Number(this.resolveValue(this.value));
      if (!Number.isFinite(value)) {
        this.failValidation("value must resolve to a finite number");
        return;
      }
      addHumanityAdjustment(this.actor, {
        mode: this.mode,
        value,
        label: this.label,
        source: `${this.item.id}:${this.sourceIndex ?? 0}`,
      });
    }
  };
}

export function registerHumanityRuleElement() {
  const BaseRuleElement =
    globalThis.game?.pf2e?.RuleElement ??
    globalThis.game?.pf2e?.RuleElementPF2e;
  const registry = globalThis.game?.pf2e?.RuleElements;
  const fields = globalThis.foundry?.data?.fields;
  if (!BaseRuleElement || !registry?.custom || !fields) {
    return false;
  }
  if (registry.custom[HUMANITY_RULE_KEY]) return true;

  const HumanityRuleElement = createHumanityRuleElement(
    BaseRuleElement,
    fields,
  );
  if (!HumanityRuleElement) return false;
  registry.custom[HUMANITY_RULE_KEY] = HumanityRuleElement;

  const ruleElementTypes = globalThis.CONFIG?.PF2E?.ruleElementTypes;
  if (ruleElementTypes) {
    ruleElementTypes[HUMANITY_RULE_KEY] = "Предел человечности";
  }
  const translations = globalThis.game?.i18n?.translations;
  if (translations) {
    translations.PF2E ??= {};
    translations.PF2E.RuleElement ??= {};
    translations.PF2E.RuleElement[HUMANITY_RULE_KEY] =
      "Предел человечности";
  }

  const module = globalThis.game?.modules?.get?.("cyberpunk-remaster");
  if (module) {
    module.api = {
      ...(module.api ?? {}),
      HumanityRuleElement,
    };
  }
  return true;
}
