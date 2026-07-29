const FIRST_NAMES = Object.freeze([
  "Алекс",
  "Бек",
  "Вика",
  "Грэй",
  "Данте",
  "Джей",
  "Ирис",
  "Кай",
  "Кира",
  "Лекс",
  "Мара",
  "Ника",
  "Оскар",
  "Рэй",
  "Рин",
  "Саша",
  "Тала",
  "Фокс",
  "Хан",
  "Эш",
]);

const CALLSIGNS = Object.freeze([
  "Байт",
  "Блик",
  "Вольт",
  "Гвоздь",
  "Грейв",
  "Дельта",
  "Дым",
  "Кобра",
  "Лис",
  "Молот",
  "Ноль",
  "Оникс",
  "Пиксель",
  "Реле",
  "Ржавый",
  "Сетка",
  "Слэш",
  "Тень",
  "Фантом",
  "Шрам",
]);

const LAST_NAMES = Object.freeze([
  "Адамс",
  "Вальдес",
  "Вега",
  "Громов",
  "Дюран",
  "Кейн",
  "Коваль",
  "Ли",
  "Мартинес",
  "Мори",
  "Новак",
  "Ортега",
  "Пак",
  "Рид",
  "Сато",
  "Силва",
  "Танака",
  "Фишер",
  "Хейз",
  "Чен",
]);

export function hashSeed(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    const values = new Uint32Array(2);
    cryptoObject.getRandomValues(values);
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function deriveSeed(seed, salt) {
  return `${hashSeed(`${seed}:${salt}`).toString(36)}-${salt}`;
}

export function pick(values, random = Math.random) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values[Math.floor(random() * values.length)] ?? values[0];
}

export function randomInt(minimum, maximum, random = Math.random) {
  const min = Math.ceil(Math.min(minimum, maximum));
  const max = Math.floor(Math.max(minimum, maximum));
  return min + Math.floor(random() * (max - min + 1));
}

export function randomName(seed, { prefix = "", callsignChance = 0.35 } = {}) {
  const random = seededRandom(seed);
  const first = pick(FIRST_NAMES, random);
  const last = pick(LAST_NAMES, random);
  const callsign =
    random() < callsignChance ? ` «${pick(CALLSIGNS, random)}»` : "";
  return `${prefix ? `${prefix} ` : ""}${first}${callsign} ${last}`.trim();
}
