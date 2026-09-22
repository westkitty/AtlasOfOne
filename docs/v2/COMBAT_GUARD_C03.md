# C03 — Deterministic GUARD Mechanics

C03 implements the GUARD command and one-hit mitigation without inventing new durable combat state.

## Setup

`beginGuard(definition,state,timing)` requires:
- C00-valid definition;
- C01-valid state;
- player phase;
- timing exactly `base | timed`;
- living player;
- no existing `guarded` marker.

It adds only the already-frozen `guarded` status to the player and returns a transient `PendingGuard {combatantId,timing}`. It does not end the player phase.

The timing grade is intentionally **not** encoded as `perfect-guard`, `guarded-timed`, or another persisted status. C00 froze one generic `guarded` vocabulary entry. C14 owns the future timing input UI; C11 owns persistence.

## Incoming hit

`resolveGuardedIncomingDamage` requires enemy phase, the matching pending receipt, a still-present `guarded` marker, a living player, and a positive integer incoming damage value.

- base: C00 `ceil(incoming * .50)`;
- timed: C00 `ceil(incoming * .25)`;
- guard is consumed exactly once;
- unrelated statuses remain;
- HP loss delegates to C01 `DAMAGE`;
- a reducer failure returns the original guarded state, so guard removal and damage are atomic to the caller.

Zero/negative/fractional/nonfinite incoming damage is rejected at the C03 command boundary; C00's raw formula remains a lower-level non-negative integer formula.

## Non-scope

C03 does not implement phase handoff, enemy intent, status duration/order beyond consuming its own `guarded` marker, other commands, objectives/outcomes, rewards/progression, persistence, provider narration, CombatPanel, timing UI or Adventure integration.

GUARD is fictional game state only and creates no player evidence.
