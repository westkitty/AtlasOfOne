# C04 — Deterministic TECHNIQUE Registry, Charges and Cooldowns

**Status:** candidate combat-lane resource/context contract. C04 does not apply Technique effects to CombatState.

## Purpose

Appendix I gives Technique one tactical job at a time, two encounter-local charges, and explicitly rejects a large skill tree. C04 turns that into a small deterministic registry plus pure availability/resource bookkeeping.

## Initial registry

The initial registry has three source-backed tactical jobs:

| ID | Label | Cost | Cooldown | Context | Descriptor |
| --- | --- | ---: | ---: | --- | --- |
| `interrupt-charge` | Interrupt | 1 | 1 skipped future player round | living enemy + `charging` gimmick | `interrupt-charge` |
| `cover-ally` | Cover | 1 | 1 skipped future player round | living ally | `protect-ally` |
| `expose-shield` | Expose | 1 | 1 skipped future player round | living enemy + `shielded` gimmick | `expose-target` |

These are compact tactical tools, not unlock-tree content. C04 deliberately does not add damage/status/objective effects for them.

## Resource ledger

`TechniqueLedger` is encounter-local runtime adjunct state:

- starts with exactly **2 charges** from C00/Appendix I;
- charges are integer `0..2`;
- cooldown entries are unique by Technique ID;
- each entry stores deterministic `nextReadyRound` only;
- no wall clock, random roll, account unlock, gear or permanent progression participates.

C11 owns persistence/reload. C04 does not change `CombatState` or the v2 persistence schema.

## Cooldown semantics

`cooldownRounds` means the number of **future player rounds that must be skipped** after use.

The deterministic formula is:

`nextReadyRound = usedRound + cooldownRounds + 1`

Therefore an initial Technique with cooldown 1 used on round 1 is unavailable on round 2 and becomes eligible again on round 3, assuming charges/context still permit it.

## Context predicates

Technique eligibility may use only finite typed mechanics state:

- current combat phase;
- living player actor;
- target existence/team/liveness;
- required `CombatGimmick` values;
- required/forbidden C00 target statuses;
- encounter-local charge count;
- deterministic round cooldown.

No prose, personality interpretation, model output or open-ended evaluator is accepted.

Registry validation rejects:

- blank/duplicate IDs;
- blank labels;
- costs outside `1..2` for the initial charge budget;
- negative/fractional cooldowns;
- unknown target-team or effect-descriptor enum values at runtime;
- duplicate gimmicks/status predicates;
- unknown C00 statuses;
- a status simultaneously required and forbidden.

## Use contract

`checkTechniqueAvailability` validates C00 definition, C01 runtime state, registry and ledger before mechanics eligibility.

`useTechnique` then consumes only:

- Technique charges;
- that Technique's cooldown bookkeeping.

It returns the **same CombatState object unchanged** plus one bounded effect descriptor. The descriptor is not success authority:

- `interrupt-charge` must later be interpreted by the objective/gimmick/status lanes;
- `protect-ally` must later be interpreted by objective/status mechanics;
- `expose-target` must later be interpreted by gimmick/status mechanics.

C04 therefore cannot declare an interrupt succeeded, mark a target exposed, protect an ally, change objective progress, damage HP or resolve combat.

## Failure behavior

Unknown Technique, malformed registry/ledger, insufficient charges, active cooldown, wrong phase, defeated player, missing/wrong/dead target, missing required gimmick/status or forbidden status all fail closed without state/ledger mutation.

## Explicit non-scope

C04 does **not** implement:

- ATTACK/GUARD changes;
- ACT;
- LEAVE/flee;
- objective earning/completion;
- gimmick state machines;
- general status application or duration;
- enemy intent;
- rewards/XP/unlocks;
- persistence/reload;
- provider mechanics;
- CombatPanel/UI;
- permanent Technique unlock trees or equipment;
- Technique animation/assets.

Those remain C05-C17/AS04 work.
