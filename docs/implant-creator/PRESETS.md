# Rule Elements и пресеты — v1.2.0

Конструктор содержит библиотеку Rule Elements из официального PF2e Quickstart Guide и дополнительные элементы Cyberpunk Remaster.

## Универсальный выбор проверки / selector

Для Rule Elements, работающих через selector/selectors, можно выбрать готовую цель или вписать собственную.

Встроены, в частности:

- perception, initiative;
- saving-throw, fortitude, reflex, will;
- skill-check;
- athletics, acrobatics, stealth, thievery, medicine, crafting;
- computers, piloting;
- society, arcana, nature, occultism, religion;
- diplomacy, deception, intimidation, survival;
- attack, attack-roll, strike-attack-roll;
- damage, strike-damage;
- ac, class;
- fortitude-dc, reflex-dc, will-dc, perception-dc, inline-dc;
- hp, hp-per-level;
- damage-received, healing-received;
- all-speeds, land-speed, fly-speed, swim-speed, climb-speed, burrow-speed.

Свое значение всегда имеет приоритет. Через запятую можно задать несколько selectors, если Rule Element это поддерживает.

## Predicate

Простой режим:

```text
item:trait:fear, cyberware-boost
```

Сложный JSON:

```json
[
  {
    "or": ["target:trait:robot", "target:trait:construct"]
  },
  {"not": "self:condition:blinded"}
]
```

## Библиотека PF2e Quickstart

Встроены пресеты:

- ActiveEffectLike
- ActorTraits
- AdjustDegreeOfSuccess
- AdjustModifier
- AdjustStrike
- Aura
- BaseSpeed
- BattleForm
- ChoiceSet
- CraftingAbility
- CreatureSize
- CriticalSpecialization
- DamageAlteration
- DamageDice
- DexterityModifierCap
- EphemeralEffect
- FastHealing
- FlatModifier
- GrantItem
- LoseHitPoints
- ItemAlteration
- Immunity
- Weakness
- Resistance
- MartialProficiency
- MultipleAttackPenalty
- Note
- RollOption
- RollTwice
- Sense
- SpecialResource
- SpecialStatistic
- Strike
- SubstituteRoll
- TempHP
- TokenEffectIcon
- TokenImage
- TokenLight
- TokenMark
- TokenName

Дополнительно из Remaster:

- ItemCast
- CyberpunkHumanity
- комбо RollOption + FlatModifier
- переключаемый фонарик
- ИК/УФ режим зрения
- ChoiceSet + Resistance

## Универсальные поля Rule Element

Перед добавлением пресета доступны `selector`, `predicate`, `value`, `type`, `mode`, `slug`, `label`, `uuid`, `path`, параметры кубов/типа урона.

Если конкретному Rule Element нужен параметр, которого нет отдельным полем, используйте **JSON patch**. Например:

```json
{
  "priority": 10,
  "phase": "afterDerived"
}
```

Patch объединяется с выбранным пресетом последним, поэтому им можно изменить любое поле пресета.

## Редкость

Редкость сохраняется в нативном SF2e поле:

```text
system.traits.rarity
```

Доступны `common`, `uncommon`, `rare`, `unique`.

## Stress Cost и Проверка

Это два независимых поля, как в предметах Remaster.

Stress Cost:

```text
[[/r 2d6 + 1d4 #Потеря Человечности]]
```

Проверка:

```text
@Check[flat|dc:8|showDC:all]
```
## Активация: пассивные правила против временного Effect

В v1.4.0 каждый Rule Element можно добавить в одну из двух целей:

1. **Пассивные Rule Elements импланта** — работают всегда, пока сам Item активен по правилам SF2e/Remaster.
2. **Эффект активации** — хранятся в `flags.cyberpunk-implant-creator.activation.effectRules` и превращаются в отдельный `effect` только при нажатии кнопки активации.

Для Сандевистана рекомендуется держать `system.rules` самого импланта пустым, а бонусы ускорения создавать в активируемом Effect. Условия и состояния можно выдавать через `GrantItem` по UUID.


## Характеристики как цель Rule Element (v1.10.0)

В selector-поле доступны STR, DEX, CON, INT, WIS и CHA. Для `FlatModifier` и `ActiveEffectLike` конструктор трактует этот выбор как изменение самой характеристики и создаёт `ActiveEffectLike` по `system.abilities.<ability>.mod`. Для `Strike` выбор записывается в `ability`, для `SpecialStatistic` — в `attribute`. Это сделано специально, потому что характеристика не является обычным roll selector.


## Выносливость / Stamina (v1.13.1)

Готовый пресет **«Выносливость / Stamina — изменить максимум SP»**:

```json
{
  "key": "ActiveEffectLike",
  "mode": "add",
  "path": "system.attributes.hp.sp.max",
  "value": 1,
  "phase": "afterDerived"
}
```

- `Value` — сколько SP добавить/убрать/задать.
- `Mode: add` — прибавить к максимуму.
- `Mode: subtract` — уменьшить максимум.
- `Mode: override` — полностью заменить максимум.
- Для временного бонуса выберите **«Эффект активации»** в поле «Добавлять в».

Текущее значение SP не следует постоянно форсировать этим Rule Element: пресет предназначен для максимума ресурса.
