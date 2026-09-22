# Independent review — C01 deterministic CombatState reducer foundation

- **Base SHA:** `8c76db318eaf4d8a498746a7a781988bbeda9a30`
- **Implementation commit:** `995e6384c4300cf0fd646864c4ad5ffb572e2cd8`
- **Branch:** `feat/v2-combat-reducer`
- **Worktree:** `/Users/andrew/AtlasOfOne-combat-reducer`
- **Implementation / independent review:** GPT-5.6 Sol
- **Verdict:** `MERGE_READY`, then fast-forwarded locally into `integration/atlas-v2-journal-adventure-combat`. No push, deployment, or `main` merge was authorized or performed.

## Scope

C01 turns the C00 policy into a pure in-memory combat state foundation. Exactly three files were added:

- `src/combat/engine.ts`
- `tests/combat/engine.test.ts`
- `docs/v2/COMBAT_REDUCER_C01.md`

No shared contract, persistence, game engine, App, Worldwalker, Cartographer/provider, Worker, package/dependency, UI or operational-state file changed in the implementation packet.

## Canonical initialization

`initializeCombatState(definition)` first applies the C00 fail-closed definition validator.

Invalid definition:
- returns `{ok:false, issues}`;
- returns no partial `CombatState`.

Valid definition:
- copies `definition.id` to `definitionId`;
- begins at round 1 / player phase;
- creates exactly one state combatant per definition combatant;
- initializes `currentHp=maxHp`;
- initializes per-combatant/global statuses empty;
- initializes objective progress 0;
- carries no outcome;
- grants no reward/progression.

## Runtime-state gate

`validateCombatStateAgainstDefinition` intentionally sits above persistence-schema shape acceptance. It verifies:

- definition identity;
- exact combatant-ID set and uniqueness;
- integer HP in `[0,maxHp]` using definition max HP as authority;
- only the C00 status vocabulary and no duplicate statuses;
- round integer >= 1;
- explicit valid phase;
- explicit valid outcome vocabulary even if malformed data bypasses TypeScript;
- non-negative integer objective progress, capped when C00 supplies a fixed target;
- resolved state requires outcome;
- unresolved state forbids outcome.

C01 does not rewrite the existing schema-only v2 persistence fixture. C11 owns persistence/reload/runtime-fixture reconciliation.

## Primitive reducer contract

C01 exposes only internal mechanics primitives:

- `DAMAGE`
- `HEAL`
- `OBJECTIVE_PROGRESS_SET`
- `PLAYER_PHASE_ENDED`
- `ROUND_ADVANCED`
- `COMBAT_RESOLVED`

These are **not** the permanent player commands and do not preempt C02-C06.

### Damage / heal

- amount finite, integer, non-negative;
- unknown target fails closed;
- damage clamps to zero;
- healing clamps to definition max HP;
- source state remains unchanged.

### Phase / round

- player -> enemy only via `PLAYER_PHASE_ENDED`;
- enemy -> next player round only via `ROUND_ADVANCED`;
- invalid phase transitions reject without mutation.

C09 still owns enemy intent/action selection.

### Objective progress

C01 only supplies a bounded progress primitive. Fixed C00 targets cannot be exceeded. It deliberately does not decide whether progress is earned, monotonic, or completes an objective; C05/C07 own those semantics.

### Resolution

`COMBAT_RESOLVED` only records a valid outcome and moves the state to resolved. It does not grant definition rewards, XP, world state, AdventureObservation, Reflection or evidence.

Resolved combat is terminal. Every later reducer action rejects and returns the same state object.

## Purity / authority boundary

- no RNG;
- no wall clock;
- no network/provider call;
- no IndexedDB/localStorage;
- no CampaignState mutation;
- no game/progression event;
- no command implementation;
- no status mutation;
- no provider proposal input type;
- no TTS;
- no real-user fixture content.

The only runtime inputs are a C00-valid `CombatDefinition`, a definition-coherent `CombatState`, and a typed combat-lane primitive action.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Valid definition initializes canonical state | focused initialization fixture | PASS |
| Invalid C00 definition returns no partial state | negative initialization fixture | PASS |
| Definition/state identity mismatch fails closed | validator/reducer fixture | PASS |
| Exact combatant set enforced | malformed-state fixture | PASS |
| HP bound by definition authority | state validator + damage/heal clamp fixture | PASS |
| Invalid/negative/fractional/nonfinite amounts reject | table fixture | PASS |
| Explicit player->enemy->next-round lifecycle | phase transition fixture | PASS |
| Objective progress bounded by fixed target | pacify fixture | PASS |
| Runtime malformed phase/outcome reject | cast-garbage fixture | PASS |
| Resolved combat terminal | post-resolution rejection fixture | PASS |
| Rewards/progression never applied | initialization/resolution assertions + scope scan | PASS |
| Player commands not implemented in C01 | action union/source scan | PASS |
| Status system not preempted | source scan; validation/type guard only | PASS |
| Reducer pure / rejected actions preserve identity | source-state + exact-identity fixtures | PASS |
| No provider/network/persistence/RNG/TTS/private-data authority | static scans | PASS |
| No shared/hot-zone drift | exact three-file diff | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- Focused C00/C01/Wave-1 domain contract set — **26/26 PASS across 3 files**.
- Full unit suite — **477/477 PASS across 56 files**.
- Production build — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- Post-fast-forward integration focused gate — **26/26 PASS + typecheck**.
- Post-fast-forward production build — **PASS**.
- Diff/scope/provider/progression/RNG/network/persistence/TTS/real-data scans — **PASS**.

No browser proof is required for C01 because there is intentionally no player-visible runtime path yet.

## Next dependency state

C01 is complete and locally integrated.

Now READY in parallel: C02 ATTACK, C03 GUARD, C04 TECHNIQUE, C05 ACT, C06 LEAVE, C07 objectives, C08 gimmicks, C10 statuses. C09 remains blocked on C08. C13 remains blocked on C02-C10.
