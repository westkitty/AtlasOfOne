# C02 — Deterministic ATTACK Mechanics

**Status:** candidate combat-lane command mechanics. No timing UI, CombatPanel, enemy turn, objective resolution or integration is part of C02.

## Purpose

C02 is the smallest player-command consumer of C00 + C01:

1. validate the definition/state through the existing gates;
2. require player phase;
3. require an existing living enemy target;
4. validate the runtime timing grade against `base | timed`;
5. calculate the already-frozen C00 damage;
6. delegate HP mutation to C01 `DAMAGE`;
7. return deterministic mechanics data only.

ATTACK does not own any other combat lifecycle transition.

## Damage

- base ATTACK = 18;
- optional timed ATTACK = 24;
- the timing hook receives a normalized C00 grade, not a timestamp;
- malformed runtime grades fail closed rather than silently becoming base damage;
- timing is optional: base ATTACK always remains valid.

C14 later owns accessible timing input/touch/keyboard/reduced-motion UI.

## Target contract

ATTACK requires:

- player phase;
- target exists in both definition/state;
- target team is `enemy`;
- target current HP > 0.

Player, ally, missing and already-defeated targets reject without state mutation.

## C01 composition

C02 does not mutate HP directly. It calls C01 `reduceCombatState(...DAMAGE...)`, so definition max HP/state validation/terminal-combat behavior remain one authority.

A lethal ATTACK may reduce HP to zero, but C02 does **not** auto-resolve combat or infer victory. C07 owns objective completion and outcome justification.

ATTACK also does not end player phase. Later command/turn orchestration will decide when the player action is committed and hand control to C09 enemy intent/turn execution.

## Output

`AttackResolution` contains only deterministic mechanics:

- accepted/rejected;
- resulting CombatState;
- target ID;
- validated timing grade when accepted/reducer-rejected;
- deterministic damage amount when calculated;
- typed issue code when rejected.

No provider prose or psychological interpretation belongs in this surface.

## Explicit non-scope

C02 does not implement:

- timing UI or animation timing measurement;
- GUARD / TECHNIQUE / ACT / LEAVE;
- phase handoff/enemy action;
- target auto-selection;
- status effects;
- objective progress/completion;
- combat outcome;
- rewards/XP/world consequences;
- persistence;
- provider narration;
- CombatPanel;
- Adventure -> Combat integration.

Combat actions remain fictional game actions, not evidence about the player.
