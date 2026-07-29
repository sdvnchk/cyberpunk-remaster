import { FORGE_FLAG, FORGE_VERSION, MODULE_ID } from "./constants.mjs";
import { deriveSeed, pick, seededRandom } from "./random.mjs";

const COMPLICATIONS = Object.freeze([
  "Местная Сеть фиксирует перестрелку и начинает Трассировку.",
  "Через 1d4 раунда прибывает третья сторона, которой нужна та же цель.",
  "Один из противников хочет сдаться и продать информацию.",
  "Здание переходит в аварийный режим: двери блокируются, свет гаснет.",
  "Наниматель пытается зачистить обе стороны, чтобы убрать свидетелей.",
  "В зоне боя находится гражданский, важный для одной из сторон.",
]);

const CLUES = Object.freeze([
  "Серийные номера оружия ведут к корпоративному складу.",
  "В агенте одного из противников осталось сообщение нанимателя.",
  "Состав хрома указывает на конкретную клинику или риппера.",
  "У группы есть одноразовый код доступа к следующему узлу.",
  "На броне заметен удалённый знак подразделения или банды.",
  "Боевой маршрут выдаёт запасной вход в охраняемую область.",
]);

const PEACEFUL = Object.freeze([
  "Предложить деньги, ремонт или безопасный отход.",
  "Доказать, что настоящий наниматель подставил обе стороны.",
  "Получить Доступ к командному устройству и показать компромат.",
  "Убедить лидера, что продолжение боя дороже провала задания.",
  "Отключить наблюдение и дать группе исчезнуть без потери репутации.",
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildEncounterBriefing(results, form) {
  const seed = form.randomSeed || `${form.preset}:${form.level}`;
  const random = seededRandom(deriveSeed(seed, "briefing"));
  const actors = results.map((result) => result.actor).filter(Boolean);
  const title =
    actors.length > 1
      ? `${actors[0]?.name ?? "Группа"} и союзники — сводка`
      : `${actors[0]?.name ?? "NPC"} — сводка`;
  const participants = results
    .map(
      (result) =>
        `<li>@UUID[${result.actor.uuid}]{${escapeHtml(
          result.actor.name,
        )}} — ${escapeHtml(result.role?.label ?? "NPC")}; предметов: ${
          result.itemCount
        }.</li>`,
    )
    .join("");
  const tactics = results
    .map((result) => {
      const notes = result.actor.system?.details?.privateNotes ?? "";
      return `<h3>${escapeHtml(result.actor.name)}</h3>${notes}`;
    })
    .join("");
  const content = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p><strong>Уровень:</strong> ${form.level}. <strong>Количество:</strong> ${actors.length}.</p>`,
    `<h2>Участники</h2><ul>${participants}</ul>`,
    `<h2>Проведение сцены</h2>`,
    `<p><strong>Мирное решение:</strong> ${escapeHtml(
      pick(PEACEFUL, random),
    )}</p>`,
    `<p><strong>Улика:</strong> ${escapeHtml(pick(CLUES, random))}</p>`,
    `<p><strong>Осложнение:</strong> ${escapeHtml(
      pick(COMPLICATIONS, random),
    )}</p>`,
    `<h2>Тактика и снаряжение</h2>${tactics}`,
  ].join("");
  return { title, content };
}

export async function createEncounterBriefing(results, form) {
  const briefing = buildEncounterBriefing(results, form);
  if (!form.createBriefing) return { ...briefing, journal: null, warnings: [] };
  try {
    const created = await globalThis.JournalEntry.create({
      name: briefing.title,
      pages: [
        {
          name: "Сводка ведущего",
          type: "text",
          text: { content: briefing.content, format: 1 },
          ownership: { default: 0 },
        },
      ],
      ownership: { default: 0 },
      flags: {
        [MODULE_ID]: {
          [FORGE_FLAG]: {
            generated: true,
            version: FORGE_VERSION,
            kind: "encounter-briefing",
          },
        },
      },
    });
    return {
      ...briefing,
      journal: Array.isArray(created) ? created[0] : created,
      warnings: [],
    };
  } catch (error) {
    return {
      ...briefing,
      journal: null,
      warnings: [`Сводку не удалось сохранить: ${error.message}`],
    };
  }
}
