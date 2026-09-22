# C00 — Minimal Deterministic Combat Contract

**Status:** candidate combat-lane contract for C01-C10. This packet adds no runtime combat behavior.

## Why no shared-contract migration is required

Wave 1 already froze the durable envelope in `src/contracts/combat.ts`: `CombatDefinition`, `CombatState`, `CombatCommand`, the ten objective names, fifteen gimmick names, five permanent commands, outcome vocabulary, rewards and flee rule.

C00 does **not** change that shared or persisted shape. The missing piece was deterministic policy: numeric defaults, formula rounding, minimal status/intent vocabulary, objective prerequisites and the first objective slice. Those rules now live in `src/combat/rules.ts`, the lane-owned path intended by `docs/v2/INTERFACE_CONTRACTS.md`.

This avoids reopening `src/contracts/**`, `src/persistence/**`, `src/game/**`, `App.tsx`, or provider schemas before C01 actually exists.

## Fixed command wall

The permanent player commands remain exactly:

1. `ATTACK`
2. `TECHNIQUE`
3. `GUARD`
4. `ACT`
5. `LEAVE`

Scenario-specific ACT options may exist later, but they do not become permanent top-level commands.

## Initial deterministic tuning

These values are copied from `docs/MASTER_INTEGRATION_PLAN.md` Appendix I and are implementation defaults, not lore canon. Retuning belongs to C17 and requires simulation/browser evidence.

| Rule | C00 value |
| --- | ---: |
| Encounter-local player HP | 100 |
| Base ATTACK | 18 |
| Timed ATTACK bonus | +6 (24 total) |
| Base GUARD reduction | 50% |
| Timed/perfect GUARD reduction | 75% |
| Technique charges at start | 2 |
| Ordinary status duration target | 1-2 rounds |
| Ordinary enemy effective HP | 35-70 |
| Elite effective HP | 80-130 |
| Boss-phase effective HP | 110-180 |
| Ordinary enemy action damage | 10-22 |
| Ordinary enemy count | 1-3 |
| Ordinary turn target | 2-5 |
| Elite turn target | 4-7 |
| Boss-phase turn target | 5-9 |
| Survival turn target | 3-5 |
| Default ACT/pacify progress | 3 steps |

Player HP is encounter-local. C00 adds no persistent attrition economy.

## Formula policy

- `ATTACK(base) = 18`.
- `ATTACK(timed) = 18 + 6 = 24`.
- `GUARD(base)` resolves `ceil(incoming * 0.50)`.
- `GUARD(timed)` resolves `ceil(incoming * 0.25)`.
- Incoming formula input must be a finite non-negative integer; invalid input throws rather than being silently repaired.
- Timed input is optional. Missing it still performs the base action.
- C00 takes a normalized `base | timed` grade; it does not read wall-clock time or animation frames.

The upward residual-damage rounding is a C00 implementation-policy choice so fractional damage cannot silently disappear. It is deterministic and should not change outside C17 tuning review.

## Technique resource boundary

C00 freezes only the small encounter-local charge envelope:

- start with 2 charges;
- no permanent skill tree, equipment economy, crafting, random rolls, or dozens of permanent abilities.

C04 still owns per-Technique costs, cooldown/context rules, the registry and contextual effects. C00 deliberately does not invent those values.

## Status and intent vocabulary

Initial statuses:

- `guarded`
- `exposed`
- `charging`
- `staggered`
- `pacifiable`
- `protected-target`

Initial enemy intent categories:

- attack
- defend
- charge
- recover
- hazard
- objective action
- special / ACT-reactive

Player acts first by default. An ambush may override that only when later story state explicitly declares and telegraphs it. C00 does not add an ambush field or runtime initiative resolver.

## Objective contract

The durable objective union remains the Wave-1 ten-kind catalog. C00 freezes static prerequisites so runtime code never guesses missing state.

First C07 MVP slice, chosen to unlock the later C15/C16 vertical fixtures:

- `defeat` — baseline enemy-defeat resolution;
- `survive-turns` — requires explicit `turnLimit`;
- `protect-target` — requires an ally combatant;
- `interrupt-charged-action` — requires `charging` gimmick;
- `pacify` — deterministic ACT progress, default target 3.

`escape` remains a defined objective but its player command semantics belong to C06 `LEAVE`. The remaining objective kinds stay frozen in the durable catalog and are not silently implemented by C00.

## Static definition validator

`validateCombatDefinitionContract` is read-only and fail-closed. It checks:

- nonblank definition/encounter/combatant/template/reward IDs;
- exactly one player combatant;
- at least one enemy;
- positive integer max HP;
- the sole player combatant uses the 100 HP encounter-local baseline;
- unique combatant IDs;
- unique gimmicks;
- positive integer `turnLimit` when present;
- objective prerequisites above;
- MVP `survive-turns` limits stay inside the Appendix-I 3-5 round range;
- non-negative integer reward amounts when present;
- unique reward IDs.

It does not repair, normalize, mutate, award, persist, or infer hidden targets.

## Authority boundary

TypeScript owns HP, damage, Technique costs, statuses, turn order, enemy intent, objective progress, outcome and rewards.

Provider/model output may later supply approved narration, ACT wording, contextual descriptions, names/personality skins and story prose. It may not supply authoritative HP deltas, success flags, reward values, outcome, turn order or combat state.

Combat actions remain fictional observations. C00 creates no evidence and does not weaken the AdventureObservation -> Reflection -> evidence firewall.

## Explicit non-scope

C00 does **not** implement:

- `CombatState` reducer/runtime;
- ATTACK/GUARD command dispatch;
- Technique registry;
- ACT resolver;
- LEAVE/flee resolver;
- objective progress runtime;
- gimmick runtime;
- enemy intent selection;
- status resolution;
- persistence/reload;
- CombatPanel/UI;
- timing input UI;
- provider combat narration;
- Adventure -> Combat integration;
- progression/reward granting.

Those remain C01-C17/I02 work.
