# Independent review — C04 deterministic TECHNIQUE registry/resources

- **Base SHA:** `4a9d933c67302d9a20ff5c95536a3f56f3823190`
- **Implementation commit:** `82c89a26190649667a7119d15bbe27366bd71b73`
- **Branch/worktree:** `feat/v2-combat-techniques` / `/Users/andrew/AtlasOfOne-combat-techniques`
- **Implementation / review:** GPT-5.6 Sol
- **Verdict:** `MERGE_READY`, then fast-forwarded locally into `integration/atlas-v2-journal-adventure-combat`. No push, `main` merge, deployment or live inference.

## Scope

C04 adds exactly three lane-owned files:

- `src/combat/techniques.ts`
- `tests/combat/techniques.test.ts`
- `docs/v2/COMBAT_TECHNIQUES_C04.md`

No shared contracts, persistence, CampaignState/game engine, App/Worldwalker, provider/Worker, dependency, asset, objective, status-engine or UI file changed.

## Registry and resource contract

The initial registry stays deliberately small and source-backed by Appendix I's Technique philosophy:

1. `interrupt-charge` — cost 1; one skipped future player round; enemy + `charging` gimmick; emits `interrupt-charge` descriptor.
2. `cover-ally` — cost 1; one skipped future player round; living ally; emits `protect-ally` descriptor.
3. `expose-shield` — cost 1; one skipped future player round; enemy + `shielded` gimmick; emits `expose-target` descriptor.

The encounter-local ledger starts with exactly two charges, the C00/Appendix-I baseline. C04 does not create permanent Technique unlocks, equipment, gear progression or a skill tree.

Cooldown meaning is deterministic:

`nextReadyRound = usedRound + cooldownRounds + 1`

Thus cooldown 1 used on round 1 is unavailable on round 2 and eligible again on round 3 if charges/context permit it.

## Context boundary

Technique availability may inspect only typed mechanics data:

- player phase;
- living player actor;
- target existence/team/liveness;
- required `CombatGimmick` values;
- required/forbidden C00 target statuses;
- charge ledger;
- round/cooldown ledger.

It does not inspect prose, player personality, Journal/Reflection evidence, provider output or inferred meaning.

The registry validator rejects blank/duplicate IDs, blank labels, invalid costs/cooldowns, duplicate predicates, unknown C00 statuses, contradictory status predicates, and malformed runtime target-team/effect enum values even when bad JavaScript bypasses TypeScript.

## Effect authority

`useTechnique` intentionally returns the exact same `CombatState` object unchanged. Successful use mutates only a newly returned Technique ledger and emits one bounded descriptor:

- `interrupt-charge`
- `protect-ally`
- `expose-target`

Those descriptors are **not** mechanics success authority. C07/C08/C10 later decide objective/gimmick/status effects. C04 cannot damage HP, apply/remove status, advance objectives, resolve combat, grant rewards or hand off phases.

## Failure behavior

Malformed registry/ledger, unknown Technique, insufficient charges, active cooldown, invalid phase, defeated player, unknown/wrong/dead target, missing required gimmick/status or forbidden status fail closed without changing source state/ledger.

## Reviewer hardening

The initial candidate relied on compile-time TypeScript for `targetTeam` and `effect`. Before commit, review added runtime allowlists and explicit `invalid-target-team` / `invalid-effect` registry issues so malformed JS/imported values cannot reach effect output.

No product semantics changed beyond stricter failure handling.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Starts with exactly two encounter-local charges | ledger fixture | PASS |
| Registry stays small and tactical | exact 3-entry fixture | PASS |
| Costs explicit, positive and <= initial charge budget | registry validation | PASS |
| Cooldowns deterministic, no wall clock | round-1 -> round-2 blocked -> round-3 ready fixture | PASS |
| Context uses finite mechanics predicates only | gimmick/team/status fixtures + source scan | PASS |
| Living player required | defeated-player fixture | PASS |
| Living correct-team target required | team/dead-target fixtures | PASS |
| Malformed registry/ledger fail closed | negative fixtures | PASS |
| Unknown Technique / no charges / cooldown fail closed | negative fixtures | PASS |
| Technique use does not mutate CombatState | identity + structured-clone fixtures | PASS |
| Effect output is descriptor-only | source review + exact descriptor fixtures | PASS |
| No status/objective/reward/progression/provider/persistence authority | exact diff/static scans | PASS |
| No permanent skill tree/equipment/grind | source/document review | PASS |
| No shared/hot-zone drift | exact three-file diff | PASS |

## Validation

- Typecheck — **PASS**.
- Focused C00-C04 + Wave-1 contract stack — **53/53 PASS across 6 files**.
- First broad 8-worker run — **503/504** with the sole failure an unrelated 5-second timeout in `tests/cartographer/context.test.ts` 600-turn boundedness case while DEX reported CPU saturation + memory warning.
- Isolated context file at one worker — **12/12 PASS**; 600-turn case **670 ms**.
- Full suite at four workers before final runtime-hardening edit — **504/504 PASS across 59 files**; 600-turn case **1.2 s**.
- Full suite at four workers after final runtime-hardening edit — **504/504 PASS across 59 files**.
- Candidate production build — **PASS**, including PWA generation.
- Post-fast-forward focused merged-tree gate — **53/53 PASS + typecheck**.
- First post-merge build compiled Worker/client but exited before PWA close-bundle output under recent machine pressure; no source/config error appeared and no PWA files were emitted. One bounded normal-build retry with the full connector ceiling then **PASSed completely**, including `sw.js` and Workbox generation. No code repair was made.
- `git diff --check`, scope/provider/RNG/network/persistence/progression/evidence/TTS/real-data scans — **PASS**.

No browser proof is relevant before C13 because C04 has no player-visible path.

## Next dependency state

C04 is complete and locally integrated. C05, C06, C07, C08 and C10 remain READY; C09 still waits on C08. C05 ACT is the next critical-path packet because C15's nonviolent pacify fixture depends on C05+C07+C08 and C13 still waits on all C02-C10 mechanics.
