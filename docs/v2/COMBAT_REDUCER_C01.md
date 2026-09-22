# C01 — Deterministic CombatState Reducer Foundation

**Status:** candidate combat-lane runtime foundation. No App, provider, persistence, Worldwalker or CombatPanel integration is part of C01.

## Purpose

C00 froze the rules. C01 makes those rules executable as a small pure in-memory state machine that later C02-C10 packets can compose without each inventing their own HP, phase, round, objective or resolution mutation path.

## Canonical initialization

`initializeCombatState(definition)` first runs the C00 static definition gate. Invalid definitions return no partial state.

A valid definition initializes as:

- `definitionId = definition.id`;
- `round = 1`;
- `phase = player`;
- exactly one state combatant per definition combatant;
- `currentHp = maxHp`;
- per-combatant statuses empty;
- global statuses empty;
- `objectiveProgress = 0`;
- no outcome.

No reward or progression is applied during initialization.

## Runtime state validation

`validateCombatStateAgainstDefinition` is stricter than persistence-schema shape validation. It requires:

- matching definition ID;
- exactly the same combatant ID set as the definition;
- no duplicate state combatants;
- integer current HP in `[0,maxHp]`;
- only C00 status names, without duplicates;
- integer round >= 1;
- non-negative integer objective progress, capped when C00 defines a fixed target;
- phase and outcome values are explicitly validated even if malformed data bypasses TypeScript;
- resolved phase carries a valid outcome;
- unresolved phase carries no outcome.

A schema-shaped persisted fixture is not automatically runtime-valid combat. C11 owns persistence/reload and any required fixture reconciliation.

## Primitive reducer actions

C01 exposes only internal mechanics primitives:

- `DAMAGE(targetId, amount)`;
- `HEAL(targetId, amount)`;
- `OBJECTIVE_PROGRESS_SET(progress)`;
- `PLAYER_PHASE_ENDED`;
- `ROUND_ADVANCED`;
- `COMBAT_RESOLVED(outcome)`.

These are **not** the player command API. C02-C06 still own ATTACK / TECHNIQUE / GUARD / ACT / LEAVE.

### Damage / healing

- amount must be finite, integer and non-negative;
- unknown target fails closed;
- damage clamps at zero;
- healing clamps at definition max HP;
- definition max HP remains the authority; the reducer does not copy a second max-HP field into `CombatState`.

### Phase / round lifecycle

- initial phase is player;
- only `PLAYER_PHASE_ENDED` moves player -> enemy;
- only `ROUND_ADVANCED` moves enemy -> next player round and increments `round`;
- invalid phase transitions fail closed.

C09 later owns actual enemy intent/action selection. C01 only provides the phase boundary.

### Objective progress

Progress must be a non-negative integer. When the C00 objective rule has a fixed target (currently pacify/discover-ACT = 3), progress beyond that target fails closed. C07 still owns the actual conditions that justify progress changes.

### Resolution

`COMBAT_RESOLVED` changes only CombatState phase/outcome. It does not grant rewards, XP, world effects, AdventureObservations, Reflection or evidence.

Resolved combat is terminal to C01: all later reducer actions return the original state unchanged with `combat-already-resolved`.

## Purity / failure behavior

The reducer never mutates its input definition or state. Rejected actions return the original state object unchanged plus an issue code. There is no RNG, wall clock, browser state, persistence, network or provider input.

## Explicit non-scope

C01 does not implement:

- ATTACK damage selection/timing semantics (C02);
- GUARD (C03);
- Technique registry/cost/cooldown (C04);
- ACT scenario resolver (C05);
- LEAVE/flee rules (C06);
- objective completion logic (C07);
- gimmicks (C08);
- enemy intent (C09);
- status application/resolution order (C10);
- persistence/reload (C11);
- provider authority firewall proof at integration boundary (C12);
- CombatPanel/UI (C13);
- timed-input accessibility UI (C14);
- Adventure -> Combat integration (I02);
- reward/progression application.

## Authority boundary

Provider proposals are not a reducer input type. C01 accepts only a validated `CombatDefinition`, a validated `CombatState`, and a typed combat-lane reducer action.

Combat state is fictional game state. Nothing in C01 creates or confirms personal evidence.
