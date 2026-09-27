# Combat mechanics C05-C10 — ACT, LEAVE, objectives, gimmicks, intent, resolution order

**Status:** SELF_VERIFIED on `feat/v2-combat-mechanics` (executor: Claude Opus 5.5).
Not independently reviewed, so not `MERGE_READY` under master plan §2A.6.
No persistence, CampaignState, App/UI, provider, Worker, dependency or asset
file changed. `src/combat/attack.ts` gained one optional, lower-only damage
modifier hook; its C02 tests are unchanged and green.

## Files

| Packet | File | Owns |
|---|---|---|
| C05 | `src/combat/act.ts` | scenario-owned ACT options, discovery prerequisites, act-progress, reveal |
| C06 | `src/combat/leave.ts` | `always` / `after-turn` / `story-gated` LEAVE, fail-forward defeat |
| C07 | `src/combat/objectives.ts` | defeat, survive-turns, protect-target, interrupt-charged-action, pacify |
| C08 | `src/combat/gimmicks.ts` | shielded, charging, counterattacking, swarm, morale-fear (pacify/ACT state) |
| C09 | `src/combat/intent.ts` | deterministic, visible enemy intent |
| C10 | `src/combat/gimmicks.ts`, `src/combat/session.ts` | status lifetimes, fixed resolution order, pure session |

## Decisions

- **ACT authority.** Only options in a deterministic `ActScenario` resolve. A provider may re-word a label later; it cannot add an option, a predicate or an effect. `act-progress` moves objective progress exactly one step through the C01 reducer and never resolves combat. The validator refuses a scenario whose progress target is unreachable (a nonviolent route that could never end), prerequisite cycles, and untargeted status predicates.
- **LEAVE is not failure.** No penalty field exists on any exit. `story-gated` reads `LeaveContext.storyExitOpen` from application-owned runtime state; the command cannot open its own gate. Defeat resolves only at 0 HP and returns `retreat-to-sanctuary` with retry available (Appendix I.8).
- **Status lifetimes without timers.** exposed: consumed by the next ATTACK on that target. staggered: consumed when the enemy would act. charging: consumed on release or interrupt. guarded / protected-target: consumed by a hit, else cleared at round end. pacifiable: whole encounter.
- **Intent is a pure function of state.** The telegraph shown in the player phase and the action taken in the enemy phase come from the same function, so a response (Interrupt, Calm, Cover) visibly changes the threat. No RNG, clock or provider input.
- **Resolution order (C10).** player action → objective check → player phase ends → each living enemy acts in definition order with intent recomputed, objective checked after each → round-scoped statuses clear → round advances → round-end objective check. Evaluation priority: player down > protected ally down > objective success > all enemies down > turn limit.
- **Session.** `CombatSession` is plain JSON data (C11 persistence can store it as-is). `applyCombatCommand` is pure; `expectedTurn` refuses stale or duplicate submissions. Extra provider-shaped fields on a command (`outcome`, `damage`, `reward`) have no effect. The combat log is fictional, bounded to 16 entries and never evidence.
- **Enemy tuning defaults** (C17 owns retuning): attack 12, swarm 10, charged release 22, counter 6, shield halves ATTACK (ceil). All inside the Appendix-I 10-22 envelope. A plain 54-HP ordinary enemy falls in 3 base ATTACKs.

## Evidence

- `tests/combat/act.test.ts` 10, `leave.test.ts` 7, `session.test.ts` 17; combat lane total 80/80.
- Mutation proof: removing any of these guards fails at least one test — unreachable-progress check, ACT prerequisites, progress cap, stale-turn guard, protected-target negation, exposed consumption, interrupt-only-counts-when-charging, round-end status clear, session validation.

## Not done here

C11 persistence, C12 provider firewall wiring, C13 CombatPanel, C14 timing accessibility, C15/C16 vertical fixtures, rewards/consequences (Adventure lane).
