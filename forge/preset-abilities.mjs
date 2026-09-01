export const PRESET_ABILITIES = Object.freeze({
  "corporate-patrol": {
    name: "Протокол задержания",
    actionType: "action",
    actions: 1,
    category: "interaction",
    traits: ["auditory", "concentrate"],
    description:
      "<p>Оперативник назначает видимого врага в пределах 60 футов целью задержания. До начала следующего хода оперативника первая атака одного из его союзников по этой цели получает обстоятельственный бонус +1.</p>",
  },
  "corporate-response": {
    name: "Синхронный вход",
    actionType: "action",
    actions: 2,
    category: "offensive",
    traits: ["flourish", "move"],
    description:
      "<p>Оперативник Перемещается вплоть до своей Скорости, затем наносит Удар. После Удара один видящий его союзник может реакцией Шагнуть.</p>",
  },
  "corporate-sniper": {
    name: "Нейрооптическая поправка",
    actionType: "action",
    actions: 1,
    category: "offensive",
    traits: ["concentrate"],
    description:
      "<p>Снайпер рассчитывает траекторию. Его следующая дистанционная атака до конца текущего хода получает обстоятельственный бонус +1 и игнорирует состояние скрыт от маскировки, но не невидимость.</p>",
  },
  "corporate-netwatch": {
    name: "Контур изоляции",
    actionType: "reaction",
    actions: null,
    category: "defensive",
    traits: ["concentrate", "netrunner"],
    description:
      "<p><strong>Триггер:</strong> оперативник становится целью программы или квикхака. Он получает обстоятельственный бонус +2 к защите от вызвавшего реакцию эффекта. При успехе оперативник также определяет интерфейс устройства, с которого пришёл сигнал.</p>",
  },
  "street-ganger": {
    name: "Навалиться толпой",
    actionType: "passive",
    actions: null,
    category: "offensive",
    traits: [],
    description:
      "<p>Удары бандита наносят 1 дополнительный урон существу, рядом с которым находится хотя бы один союзник бандита.</p>",
  },
  "street-enforcer": {
    name: "Снести с ног",
    actionType: "action",
    actions: 2,
    category: "offensive",
    traits: ["flourish", "move"],
    description:
      "<p>Громила Перемещается вплоть до своей Скорости и наносит ближний Удар. При попадании цель должна пройти @Check[reflex|dc:{dc}] или упасть ничком.</p>",
  },
  scavenger: {
    name: "Кустарный обход",
    actionType: "reaction",
    actions: null,
    category: "interaction",
    traits: ["concentrate", "manipulate"],
    description:
      "<p><strong>Триггер:</strong> мусорщик проваливает проверку Ремесла, Компьютеров или Воровства для работы с устройством. Он перебрасывает проверку и обязан использовать новый результат. После этого способность недоступна 1 час.</p>",
  },
  "street-ripperdoc": {
    name: "Экстренная стимуляция",
    actionType: "action",
    actions: 2,
    category: "interaction",
    traits: ["healing", "manipulate"],
    description:
      "<p>Риппер вводит препарат себе или соседнему живому существу. Цель восстанавливает @Damage[{healing}[healing]] ОЗ и получает иммунитет к этой способности на 10 минут.</p>",
  },
  solo: {
    name: "Оценка угрозы",
    actionType: "free",
    actions: null,
    category: "offensive",
    traits: ["concentrate"],
    description:
      "<p><strong>Частота:</strong> один раз за столкновение. Соло выбирает видимого врага. До конца первого раунда первая атака соло по нему и первый спасбросок соло против его эффекта получают обстоятельственный бонус +1.</p>",
  },
  fixer: {
    name: "Отвлекающий приказ",
    actionType: "action",
    actions: 1,
    category: "interaction",
    traits: ["auditory", "linguistic", "mental"],
    description:
      "<p>Фиксер отдаёт уверенный ложный приказ одному слышащему существу в пределах 30 футов. Цель проходит @Check[will|dc:{dc}]. При провале она застигнута врасплох для союзников фиксера до начала его следующего хода.</p>",
  },
  nomad: {
    name: "Стрельба на ходу",
    actionType: "passive",
    actions: null,
    category: "offensive",
    traits: [],
    description:
      "<p>Если кочевник переместился как минимум на 10 футов с начала своего хода, его первая дистанционная атака в этом ходу получает обстоятельственный бонус +1.</p>",
  },
  investigator: {
    name: "Сканировать поведение",
    actionType: "action",
    actions: 1,
    category: "interaction",
    traits: ["concentrate"],
    description:
      "<p>Детектив изучает видимую цель и проводит проверку Восприятия против её КС Воли. При успехе он узнаёт её самый низкий спасбросок, а цель застигнута врасплох для следующей атаки детектива до конца его следующего хода.</p>",
  },
  netrunner: {
    name: "Приоритетный эксплойт",
    actionType: "free",
    actions: null,
    category: "offensive",
    traits: ["concentrate", "netrunner"],
    description:
      "<p><strong>Частота:</strong> один раз за раунд. Перед запуском программы или квикхака по совместимому устройству нетраннер получает обстоятельственный бонус +1 к броску атаки программы либо увеличивает её КС на 1.</p>",
  },
  technician: {
    name: "Аварийная перегрузка",
    actionType: "action",
    actions: 2,
    category: "offensive",
    traits: ["manipulate", "tech"],
    description:
      "<p>Техник перегружает видимое устройство в пределах 30 футов. Его носитель проходит @Check[reflex|dc:{dc}|basic] и получает @Damage[{damage}[electricity]|options:area-damage] урона. Требуется подходящий интерфейс устройства.</p>",
  },
  medic: {
    name: "Боевой стим",
    actionType: "action",
    actions: 1,
    category: "interaction",
    traits: ["healing", "manipulate"],
    description:
      "<p>Медик вводит стим себе или соседнему живому союзнику. Цель получает {tempHp} временных ОЗ и бонус состояния +5 футов к Скорости до начала следующего хода медика. После этого цель временно невосприимчива на 10 минут.</p>",
  },
  cyberpsycho: {
    name: "Ломая строй",
    actionType: "action",
    actions: 2,
    category: "offensive",
    traits: ["flourish", "move"],
    description:
      "<p>Киберпсих Перемещается вплоть до своей Скорости и может проходить через пространства существ. Каждое существо, через пространство которого он прошёл, один раз проходит @Check[reflex|dc:{dc}]. При провале оно падает ничком.</p>",
  },
  "pkt-operative": {
    name: "Переключить боевой контур",
    actionType: "free",
    actions: null,
    category: "interaction",
    traits: ["concentrate"],
    description:
      "<p>Оперативник выбирает контур до начала своего следующего хода: <strong>Штурм</strong> даёт +1 обстоятельственный бонус к атакам; <strong>Бастион</strong> даёт +1 обстоятельственный бонус к КБ; <strong>Преследование</strong> даёт +5 футов к Скорости. Один контур нельзя выбирать два раунда подряд.</p>",
  },
});

export function presetAbility(id) {
  return PRESET_ABILITIES[id] ?? null;
}
