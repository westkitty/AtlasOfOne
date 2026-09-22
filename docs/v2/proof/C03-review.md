# Independent review — C03 deterministic GUARD mechanics

- **Base:** `7df4f48de6255b7553d2d52b3c3103c2386c9d9f`
- **Implementation:** `393e87d036d448db721b399371a9369b2b591ef9`
- **Branch/worktree:** `feat/v2-combat-guard` / `/Users/andrew/AtlasOfOne-combat-guard`
- **Verdict:** `MERGE_READY`, then locally fast-forwarded. No push/main/deploy.

## Contract

C03 adds exactly three lane-owned files: `guard.ts`, its tests, and contract doc.

`beginGuard` requires C00-valid definition, C01-valid player-phase state, living player, valid `base|timed` grade, and no existing guard. It adds only the pre-frozen `guarded` status and returns a transient `PendingGuard {combatantId,timing}`. The timing grade is deliberately not encoded as a new durable status.

`resolveGuardedIncomingDamage` requires enemy phase, matching receipt, still-present `guarded`, living player and positive-integer incoming damage. Base uses C00 50% mitigation, timed uses 75%; it removes only `guarded`, preserves unrelated statuses and delegates HP mutation to C01. If the reducer rejects, the original guarded state is returned, so consumption+damage are atomic to the caller.

Guard is one-shot. A second guarded-resolution attempt fails `not-guarding`; normal unguarded damage remains outside C03.

## Boundaries

No phase handoff, enemy intent, general status engine, objective/outcome, reward/progression, persistence, provider, UI/timing measurement or Adventure integration was added. No shared/hot-zone file changed.

## Validation

- focused C00-C03/Wave-1 stack: **42/42 PASS**
- full unit: **493/493 PASS across 58 files**
- typecheck/build: **PASS**
- post-integration focused: **42/42 + typecheck PASS**
- status-scope/authority/RNG/network/persistence/TTS/real-data scans: **PASS**

No browser proof is relevant before C13/C14.
