const GENERIC_LAST = Object.freeze([
  "Адамс", "Вальдес", "Вега", "Громов", "Дюран", "Кейн", "Коваль", "Ли", "Мартинес", "Мори",
  "Новак", "Ортега", "Пак", "Рид", "Силва", "Фишер", "Хейз", "Чен", "Рамирес", "Уокер",
  "Окафор", "Сингх", "Наварро", "Беккер", "Росси", "Ким", "Моралес", "Патель", "Коста", "Мерсер",
  "Картер", "Мортон", "Майлс", "Маккенна", "Бронсон", "Хьюз", "Уилер", "Паркер", "Куинн", "Линг",
]);

const JAPANESE_LAST = Object.freeze([
  "Акияма", "Фудзивара", "Хасэгава", "Ито", "Кобаяси", "Кондо", "Мацуда", "Мори", "Накамура", "Окамото",
  "Сайто", "Сакаи", "Сато", "Сибата", "Судзуки", "Такахаси", "Танака", "Ватанабэ", "Ямада", "Ямамото",
  "Маэда", "Осава", "Обата", "Тиба", "Адзаэгами", "Кэнмоти",
]);

const KOREAN_LAST = Object.freeze([
  "Ким", "Ли", "Пак", "Чхве", "Чон", "Кан", "Чо", "Юн", "Чан", "Хан", "Лим", "Син", "Со", "Квон", "Хван",
]);

const CHINESE_LAST = Object.freeze([
  "Ли", "Ван", "Чжан", "Лю", "Чэнь", "Ян", "Хуан", "Чжао", "У", "Чжоу", "Сюй", "Сунь", "Ма", "Чжу", "Го",
]);

const SLAVIC_LAST = Object.freeze([
  "Белов", "Волков", "Громов", "Дроздов", "Ермаков", "Зорин", "Карпов", "Коваленко", "Лебедев", "Морозов",
  "Орлов", "Петров", "Романов", "Соколов", "Тарасов", "Фёдоров", "Чернов", "Шевченко", "Яковлев", "Зайцев",
  "Ковач", "Колев", "Марков", "Богданов", "Воронцов", "Драгунов",
]);

const SLAVIC_FEMALE_LAST = Object.freeze([
  "Белова", "Волкова", "Громова", "Дроздова", "Ермакова", "Зорина", "Карпова", "Коваленко", "Лебедева", "Морозова",
  "Орлова", "Петрова", "Романова", "Соколова", "Тарасова", "Фёдорова", "Чернова", "Шевченко", "Яковлева", "Зайцева",
  "Ковач", "Колева", "Маркова", "Богданова", "Воронцова", "Драгунова",
]);

const LATINO_LAST = Object.freeze([
  "Альварес", "Кастильо", "Кортес", "Крус", "Дельгадо", "Диас", "Эспиноса", "Флорес", "Гарсия", "Герреро",
  "Мартинес", "Мендоса", "Моралес", "Наварро", "Ортега", "Рамирес", "Рейес", "Ривера", "Вега", "Салазар",
  "Ибарра", "Родригес", "Паласио", "Санчес", "Руис", "Алонсо",
]);

const HAITIAN_LAST = Object.freeze([
  "Батист", "Бовуар", "Дезир", "Дюваль", "Этьен", "Флеримон", "Фонтен", "Жан-Батист", "Жозеф", "Лафлер",
  "Лоран", "Пьер", "Сен-Флер", "Симон", "Туссен", "Винсент", "Вольтер", "Шарль", "Лувертюр", "Моро",
  "Дюпон", "Орест", "Лагерр", "Дессалин",
]);

const MALE_FIRST_POOLS = Object.freeze({
  generic: Object.freeze([
    "Алекс", "Бек", "Грэй", "Данте", "Джей", "Кай", "Лекс", "Оскар", "Рэй", "Рин", "Хан", "Эш", "Роуэн", "Лео",
    "Сэм", "Джакс", "Вал", "Коул", "Маркус", "Декстер", "Нико", "Тео", "Крис", "Кейд", "Майло", "Роук", "Эван",
    "Тревор", "Дарио", "Дэмиен", "Уилл", "Рик", "Нолан", "Дариус", "Логан", "Скотт", "Джесси",
  ]),
  japanese: Object.freeze([
    "Акира", "Даити", "Хару", "Хикару", "Кайто", "Кэндзи", "Макото", "Масару", "Наоки", "Рю", "Сора", "Такэси", "Юки",
    "Кэй", "Рэн", "Син", "Котаро", "Томо", "Хирото", "Сёта", "Юто", "Кадзуо", "Тэцуя", "Рё", "Кэнта", "Норио", "Дзюн",
    "Такэхиро", "Масаки", "Хироми", "Дзётаро",
  ]),
  korean: Object.freeze([
    "Минсу", "Джунхо", "Хёнсу", "Джинву", "Тэхён", "Сынмин", "Донхён", "Чанмин", "Кихён", "Уджин", "Сонхо", "Ёнджин",
    "Джихун", "Хёнву", "Тэсу", "Минджэ", "Сынхо", "Джунсок",
  ]),
  chinese: Object.freeze([
    "Вэй", "Хао", "Цзюнь", "Лэй", "Мин", "Тао", "Чэнь", "Цзянь", "Лун", "Бо", "Цян", "Юй", "Фэн", "Сян", "Жэнь", "И",
    "Гуан", "Чжэн",
  ]),
  slavic: Object.freeze([
    "Алексей", "Антон", "Виктор", "Дмитрий", "Илья", "Кирилл", "Лев", "Максим", "Никита", "Олег", "Павел", "Роман", "Юрий",
    "Арсений", "Борис", "Владислав", "Георгий", "Денис", "Егор", "Михаил", "Сергей", "Степан", "Дамир", "Антон", "Милан",
  ]),
  latino: Object.freeze([
    "Алехандро", "Диего", "Эстебан", "Хавьер", "Марко", "Матео", "Мигель", "Нико", "Рафаэль", "Сантьяго", "Тео", "Адриан",
    "Карлос", "Дамиан", "Элиас", "Габриэль", "Хулиан", "Леон", "Лоренсо", "Рикардо", "Густаво", "Хосе", "Хулио", "Себастьян",
    "Клаудио", "Рохелио",
  ]),
  haitian: Object.freeze([
    "Батист", "Даниэль", "Эммануэль", "Этьен", "Фабиан", "Жан", "Жозеф", "Люк", "Мишель", "Ноэль", "Рене", "Тьерри", "Венсан",
    "Андре", "Клод", "Франсуа", "Луи", "Марсель", "Паскаль", "Пьер", "Жозюэ", "Филипп", "Вилки", "Леон",
  ]),
});

const FEMALE_FIRST_POOLS = Object.freeze({
  generic: Object.freeze([
    "Вика", "Ирис", "Кира", "Мара", "Ника", "Саша", "Тала", "Мэй", "Нова", "Реми", "Тэсс", "Мина", "Лена", "Зои", "Кэсс",
    "Рейна", "Элли", "Джун", "Морган", "Скай", "Рокси", "Валери", "Наоми", "Лив", "Ринн", "Астрид", "Кармен", "Шэй", "Мика",
    "Дана", "Марта", "Хилари", "Ольга", "Анна", "Рита", "Эвелин", "Сюзанна",
  ]),
  japanese: Object.freeze([
    "Акико", "Аой", "Харука", "Каори", "Май", "Рина", "Юки", "Юна", "Мию", "Эми", "Нацуми", "Саюри", "Ая", "Мегуми", "Нанами",
    "Рэйна", "Сакура", "Хина", "Мисаки", "Юрико", "Кэйко", "Норико", "Рико", "Томоми", "Мидори", "Маико", "Таки", "Хиямэ",
  ]),
  korean: Object.freeze([
    "Соджин", "Джию", "Минджи", "Хаын", "Соён", "Йерин", "Дахён", "Суджин", "Наён", "Юна", "Хеджин", "Бора", "Ари", "Джиа", "Сомин",
  ]),
  chinese: Object.freeze([
    "Мэй", "Лин", "Сюин", "Янь", "Цзин", "Сяо", "Жуй", "Лань", "Юэ", "Фан", "Цяо", "Ли", "Синь", "Цзы", "Нин", "Хуа",
  ]),
  slavic: Object.freeze([
    "Алина", "Вера", "Дарья", "Ирина", "Катя", "Мила", "Светлана", "Анна", "Валерия", "Елена", "Марина", "Надежда", "Наталья", "Ольга",
    "Полина", "Софья", "Татьяна", "Юлия", "Ксения", "Лидия", "Анастасия", "Виктория", "Мира", "Злата",
  ]),
  latino: Object.freeze([
    "Ана", "Елена", "Габриэла", "Карла", "Лус", "Роза", "София", "Валерия", "Химена", "Алехандра", "Беатрис", "Камила", "Даниэла", "Эва",
    "Изабель", "Лола", "Лусия", "Марисоль", "Наталия", "Паула", "Рената", "Селена", "Зои", "Алма", "Мария",
  ]),
  haitian: Object.freeze([
    "Мари", "Надеж", "Розали", "Сабин", "Селин", "Зои", "Амели", "Анаис", "Клодетт", "Элиза", "Эстер", "Фабиенн", "Жизель", "Жюли", "Люси",
    "Мадлен", "Мирей", "Натали", "Софи", "Валери", "Брижит", "Фара", "Ловели",
  ]),
});

const CALLSIGNS = Object.freeze([
  "Байт", "Блик", "Вольт", "Гвоздь", "Грейв", "Дельта", "Дым", "Кобра", "Лис", "Молот", "Ноль", "Оникс", "Пиксель", "Реле",
  "Ржавый", "Сетка", "Слэш", "Тень", "Фантом", "Шрам", "Ронин", "Клинок", "Синк", "Глитч", "Бастион", "Пульс", "Скат", "Ворон",
  "Нитро", "Свитч", "Рэйзор", "Эхо", "Драйв", "Болт", "Фьюз", "Прайм",
]);

const ROLE_CALLSIGNS = Object.freeze({
  netrunner: Object.freeze(["Байт", "Ноль", "Пиксель", "Сетка", "Слэш", "Синк", "Глитч", "Свитч", "Эхо", "Прокси", "Хэш"]),
  sniper: Object.freeze(["Тень", "Фантом", "Ворон", "Шрам", "Оникс", "Холод", "Дальний"]),
  assault: Object.freeze(["Молот", "Кобра", "Нитро", "Клинок", "Бастион", "Таран", "Шок"]),
  heavy: Object.freeze(["Молот", "Бастион", "Гвоздь", "Скат", "Бык", "Блок"]),
  infiltrator: Object.freeze(["Тень", "Фантом", "Лис", "Ронин", "Мираж", "Шёпот"]),
  technician: Object.freeze(["Реле", "Вольт", "Синк", "Свитч", "Фьюз", "Ключ"]),
  medic: Object.freeze(["Пульс", "Реле", "Дельта", "Шов", "Нуль-Боль"]),
  driver: Object.freeze(["Драйв", "Апекс", "Дрифт", "Турбо", "Ось"]),
  demolitions: Object.freeze(["Фьюз", "Бум", "Капсюль", "Искра", "Шнур"]),
  droneOperator: Object.freeze(["Рой", "Пилот", "Линк", "Орбита", "Глаз"]),
});

const FACTION_PROFILES = Object.freeze([
  // Cyberpunk 2020/RED old Voodoo Boys are a distinct drug/poser gang. Keep
  // them separate from the Haitian netrunner community that uses the same
  // outsider name in the 2070s.
  {
    test: /voodoo-boys-2045|voodoo boys — наркобанда/iu,
    cultures: [["generic", 0.78], ["latino", 0.1], ["slavic", 0.07], ["japanese", 0.05]],
    callsignChance: 0.68,
    callsigns: Object.freeze(["Кость", "Ритуал", "Череп", "Клык", "Дым", "Шрам", "Куриер", "Шип", "Кровник", "Нокс"]),
  },
  // RED Scavvers are ruin/scrap crews, not the organ-harvesting Scavs of 2077.
  {
    test: /scavvers|поисковая бригада|бригада мусорщиков/iu,
    cultures: [["generic", 0.62], ["slavic", 0.18], ["latino", 0.12], ["japanese", 0.08]],
    callsignChance: 0.42,
    callsigns: Object.freeze(["Лом", "Патч", "Ключ", "Скрап", "Шестерня", "Крюк", "Трос", "Искра", "Болт", "Кэш"]),
  },
  {
    test: /iron sights|iron-sights|железн.*прицел/iu,
    cultures: [["generic", 0.62], ["slavic", 0.16], ["latino", 0.12], ["japanese", 0.1]],
    callsignChance: 0.7,
    callsigns: Object.freeze(["Риппер", "Прицел", "Хром", "Калибр", "Срез", "Шрапнель", "Сталь", "Бренди", "Резак", "Трассер"]),
  },
  {
    test: /albino alligator|albino-alligator|альбинос.*аллигатор/iu,
    cultures: [["generic", 0.72], ["latino", 0.16], ["slavic", 0.07], ["japanese", 0.05]],
    callsignChance: 0.56,
    callsigns: Object.freeze(["Алли", "Гатор", "Белый", "Пена", "Воск", "Таркин", "Син-Джин", "Крок", "Брызги", "Полоскун"]),
  },
  {
    test: /prime-time players|prime-time|prime time players/iu,
    cultures: [["generic", 0.72], ["latino", 0.12], ["japanese", 0.08], ["slavic", 0.08]],
    callsignChance: 0.72,
    callsigns: Object.freeze(["Прайм", "Капитан", "Звезда", "Шериф", "Док", "Ситком", "Космо", "Камео", "Винтаж", "Эфир", "Реран", "Финал"]),
  },
  {
    test: /reckoners|reckoner|реконер|апокалиптическ.*культ/iu,
    cultures: [["generic", 0.7], ["slavic", 0.12], ["latino", 0.12], ["haitian", 0.06]],
    callsignChance: 0.7,
    callsigns: Object.freeze(["Жатва", "Пепел", "Пророк", "Знамение", "Суд", "Последний", "Вестник", "Прах", "Откровение", "Колокол"]),
  },
  {
    test: /generation red|generation-red|gen red/iu,
    cultures: [["generic", 0.7], ["latino", 0.12], ["slavic", 0.08], ["japanese", 0.06], ["haitian", 0.04]],
    callsignChance: 0.92,
    callsigns: Object.freeze(["Апекс", "Лукаут", "Блейдс", "Тетра", "Уили", "Хай-Стик", "Иззи", "Шреддер", "Спайк", "Скут", "Рифт", "Кид"]),
  },
  {
    test: /maelstrom|мальстр[её]м/iu,
    cultures: [["generic", 0.55], ["slavic", 0.25], ["japanese", 0.1], ["latino", 0.1]],
    callsignChance: 0.82,
    callsigns: Object.freeze(["Шлак", "Ротор", "Ржавь", "Шунт", "Гекс", "Клапан", "Кобальт", "Скоба", "Болт", "Резак", "Фреза", "Тесак", "Поршень", "Нейл", "Краш"]),
  },
  {
    test: /tyger|tiger|тигр|япон/iu,
    cultures: [["japanese", 0.68], ["korean", 0.16], ["chinese", 0.12], ["generic", 0.04]],
    callsignChance: 0.24,
    callsigns: Object.freeze(["Они", "Ронин", "Кицунэ", "Кобра", "Рэйдзин", "Клинок", "Неон", "Тора"]),
  },
  {
    test: /valentino|валентин|латино|hispanic/iu,
    cultures: [["latino", 0.86], ["generic", 0.14]],
    callsignChance: 0.44,
    callsigns: Object.freeze(["Торо", "Сомбра", "Дорадо", "Фуэго", "Лобо", "Калавера", "Браво", "Санто", "Гизмо", "Корона"]),
  },
  {
    test: /voodoo|вуду|hait|гаит/iu,
    cultures: [["haitian", 0.9], ["generic", 0.1]],
    callsignChance: 0.52,
    callsigns: Object.freeze(["Слайдер", "Прокси", "Блэкволл", "Эхо", "Линк", "Спектр", "Нептун", "Шифр", "Гейт", "Сигнал"]),
  },
  {
    test: /scavenger|scavs|сборщик|скав/iu,
    cultures: [["slavic", 0.72], ["generic", 0.2], ["latino", 0.08]],
    callsignChance: 0.46,
    callsigns: Object.freeze(["Клещ", "Мясник", "Лом", "Крюк", "Шов", "Бур", "Шакал", "Сборщик", "Пила", "Костыль", "Ковал", "Резак"]),
  },
  {
    test: /animals|животн/iu,
    cultures: [["generic", 0.7], ["latino", 0.15], ["slavic", 0.15]],
    callsignChance: 0.74,
    callsigns: Object.freeze(["Бизон", "Гризли", "Бык", "Клык", "Мамонт", "Горилла", "Рык", "Таран", "Вепрь", "Ягуар", "Рейзор", "Хищник"]),
  },
  {
    test: /6th street|шест(ая|ой) улиц/iu,
    cultures: [["generic", 0.8], ["latino", 0.15], ["slavic", 0.05]],
    callsignChance: 0.34,
    callsigns: Object.freeze(["Ганнер", "Серж", "Рейнджер", "Браво", "Патриот", "Капрал", "Додж", "Хок", "Страйк", "Бункер"]),
  },
  {
    test: /the mox|moxes|шельм|мокс/iu,
    cultures: [["generic", 0.58], ["latino", 0.18], ["japanese", 0.1], ["slavic", 0.08], ["haitian", 0.06]],
    callsignChance: 0.5,
    callsigns: Object.freeze(["Вельвет", "Неон", "Глоу", "Риот", "Вайолет", "Лэйс", "Спарк", "Пикси", "Кэнди", "Роуг", "Китч"]),
  },
  {
    test: /wraith|raffen|рейф|раффен|кочев|nomad/iu,
    cultures: [["generic", 0.62], ["slavic", 0.16], ["latino", 0.14], ["japanese", 0.08]],
    callsignChance: 0.5,
    callsigns: Object.freeze(["Пыль", "Ось", "Дрифт", "Шоссе", "Койот", "Ржавь", "Турбо", "Рейдер", "Шип", "Шакал"]),
  },
  {
    test: /bozos|бозо/iu,
    cultures: [["generic", 0.85], ["latino", 0.15]],
    callsignChance: 0.82,
    callsigns: Object.freeze(["Хохмач", "Конфетти", "Улыбка", "Панч", "Гэг", "Клаксон", "Фокус", "Кривляка", "Джокер", "Хихи"]),
  },
  {
    test: /phil(harmonic)? vamp|вампир/iu,
    cultures: [["generic", 0.76], ["slavic", 0.14], ["japanese", 0.1]],
    callsignChance: 0.66,
    callsigns: Object.freeze(["Ноктюрн", "Каденция", "Готика", "Веспер", "Реквием", "Ария", "Бат", "Соната", "Кровь", "Аккорд"]),
  },
  {
    test: /piranhas|пирань/iu,
    cultures: [["generic", 0.65], ["latino", 0.22], ["slavic", 0.08], ["japanese", 0.05]],
    callsignChance: 0.6,
    callsigns: Object.freeze(["Флэш", "Краш", "Басс", "Шот", "Пати", "Нитро", "Глиттер", "Рейв", "Блиц", "Смэш", "Базука", "Грязный Шот", "Ревивер"]),
  },
  {
    test: /inquisitor|инквизитор/iu,
    cultures: [["generic", 0.8], ["slavic", 0.1], ["latino", 0.1]],
    callsignChance: 0.46,
    callsigns: Object.freeze(["Пурист", "Судья", "Кредо", "Паломник", "Пепел", "Проповедник", "Гвоздь", "Завет", "Страж"]),
  },
  {
    test: /red chrome legion|красн.*хром/iu,
    cultures: [["generic", 0.55], ["slavic", 0.35], ["latino", 0.1]],
    callsignChance: 0.58,
    callsigns: Object.freeze(["Легион", "Красный", "Танк", "Штурм", "Центурион", "Бастион", "Таран", "Сталь"]),
  },
  {
    test: /arasaka|арасака/iu,
    cultures: [["japanese", 0.9], ["generic", 0.1]],
    callsignChance: 0,
  },
  {
    test: /sovoil|совойл|soviet|советск|рус/iu,
    cultures: [["slavic", 0.86], ["generic", 0.14]],
    callsignChance: 0,
  },
  {
    test: /danger gal/iu,
    cultures: [["generic", 0.5], ["japanese", 0.3], ["korean", 0.1], ["chinese", 0.1]],
    callsignChance: 0.12,
    callsigns: Object.freeze(["Пинк", "Кэт", "Спарк", "Джамп", "Джи-Джи", "Лайт"]),
  },
  {
    test: /max-?tac|макс-?так/iu,
    cultures: [["generic", 0.7], ["slavic", 0.1], ["latino", 0.1], ["japanese", 0.1]],
    callsignChance: 0.32,
    callsigns: Object.freeze(["Альфа", "Брич", "Вайпер", "Рипер", "Хок", "Ноль", "Дельта", "Бастион"]),
  },
  {
    test: /ncpd|полици|trauma team|biotechnica|militech|petrochem|rocklin|ziggurat|continental brands|network 54|zhirafa/iu,
    cultures: [["generic", 0.72], ["latino", 0.1], ["japanese", 0.07], ["slavic", 0.06], ["haitian", 0.05]],
    callsignChance: 0,
  },
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

function factionProfile({ presetId = "", faction = "" } = {}) {
  const text = `${presetId} ${faction}`.toLocaleLowerCase("ru-RU");
  return FACTION_PROFILES.find((profile) => profile.test.test(text)) ?? null;
}

function weightedCulture(weights, random) {
  if (!Array.isArray(weights) || !weights.length) return "generic";
  const total = weights.reduce((sum, [, weight]) => sum + Math.max(0, Number(weight) || 0), 0);
  if (total <= 0) return weights[0]?.[0] ?? "generic";
  let roll = random() * total;
  for (const [culture, weight] of weights) {
    roll -= Math.max(0, Number(weight) || 0);
    if (roll <= 0) return culture;
  }
  return weights.at(-1)?.[0] ?? "generic";
}

function fallbackCulture({ presetId = "", faction = "" } = {}) {
  const text = `${presetId} ${faction}`.toLocaleLowerCase("ru-RU");
  if (/arasaka|япон/iu.test(text)) return "japanese";
  if (/sovoil|soviet|рус|сов/iu.test(text)) return "slavic";
  if (/valentino|латино|hispanic/iu.test(text)) return "latino";
  if (/voodoo|hait|гаит/iu.test(text)) return "haitian";
  return "generic";
}

function poolsForCulture(culture, gender = "male") {
  const firstPools = gender === "female" ? FEMALE_FIRST_POOLS : MALE_FIRST_POOLS;
  const first = firstPools[culture] ?? firstPools.generic;
  if (culture === "japanese") return [first, JAPANESE_LAST];
  if (culture === "korean") return [first, KOREAN_LAST];
  if (culture === "chinese") return [first, CHINESE_LAST];
  if (culture === "slavic") return [first, gender === "female" ? SLAVIC_FEMALE_LAST : SLAVIC_LAST];
  if (culture === "latino") return [first, LATINO_LAST];
  if (culture === "haitian") return [first, HAITIAN_LAST];
  return [first, GENERIC_LAST];
}

export function randomName(seed, {
  prefix = "",
  callsignChance = null,
  presetId = "",
  preset = null,
  role = null,
} = {}) {
  const random = seededRandom(seed);
  const faction = preset?.faction ?? "";
  const profile = factionProfile({ presetId, faction });
  const culture = profile?.cultures
    ? weightedCulture(profile.cultures, random)
    : fallbackCulture({ presetId, faction });
  const gender = random() < 0.5 ? "female" : "male";
  const [firstPool, lastPool] = poolsForCulture(culture, gender);
  const first = pick(firstPool, random);
  const last = pick(lastPool, random);
  const group = preset?.group ?? "";
  const roleId = role?.id ?? role ?? "";

  let chance = Number.isFinite(Number(callsignChance)) ? Number(callsignChance) : 0.28;
  if (profile && Number.isFinite(Number(profile.callsignChance))) {
    chance = Number(profile.callsignChance);
  } else if (group === "corporate" || group === "law" || group === "civilian") {
    chance = 0;
  } else if (roleId === "netrunner" || group === "street") {
    chance = Math.max(chance, 0.48);
  }

  const callsignPool = profile?.callsigns ?? ROLE_CALLSIGNS[roleId] ?? CALLSIGNS;
  const callsign = random() < chance ? ` «${pick(callsignPool, random)}»` : "";
  return `${prefix ? `${prefix} ` : ""}${first}${callsign} ${last}`.trim();
}
