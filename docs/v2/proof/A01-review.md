# Independent review — A01 deterministic AdventureRun lifecycle

- **Base SHA:** `b5aab5ec7f6993202c92f44c3b3192af325244b7`
- **Required predecessor repair:** `fd2b3ce34e2fe096571df0748d91075eca7f71b3`
- **A01 implementation commit:** `72fcdf51c9db93bc8eee9aa0a5a76858aaf654de`
- **Branch:** `feat/v2-adventure-runs`
- **Worktree:** `/Users/andrew/AtlasOfOne-adventure-runs`
- **Implementation / independent review:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

A01 adds deterministic `AdventureRun` lifecycle only. It consumes one currently A00-eligible available seed, atomically starts one run, and later completes that run. It does not implement scene/beat progression, actions/observations, withdrawal/fail-forward, provider narrative, world markers, combat, memory, reflection, UI, rewards, or persistence mutation.

A01 files:
- `src/adventure/runs.ts`
- `tests/adventure/runs.test.ts`

The branch also contains the separately committed A00 private-eligibility repair documented in `A00-private-eligibility-repair.md`.

## Lifecycle contract

### Start

`startAdventureRun(state, seedId, options)`:
- refuses to start when any AdventureRun is already `active`;
- resolves the requested seed only through `selectAvailableAdventureSeeds`, inheriting A00 privacy/history eligibility;
- refuses any seed already represented by run history;
- creates one stable run ID derived only from seed ID;
- copies only seed ID, territory ID, and logical location ID;
- sets `status: active`;
- initializes `currentBeatId` to the neutral placeholder `pending`;
- initializes recurring-character and memory ID arrays empty;
- stamps `startedAt` once;
- atomically changes only that exact seed `available -> started`;
- leaves unrelated campaign authority unchanged.

The `pending` beat is intentionally not a six-beat implementation. A03 owns Hook/Approach/Complication/Encounter/Choice/Consequence template state and transitions.

### Single-active-run invariant

The plan consistently describes singular active-adventure state and defines no concurrent-run semantics. A01 therefore permits at most one active run globally. Multiple available seeds may coexist; another may start only after the active run reaches a terminal state.

Corrupt state containing multiple active runs fails closed: `selectActiveAdventureRun` returns `null`, and completion does not guess which run owns authority.

### Completion

`completeAdventureRun(state, runId, options)`:
- succeeds only for the sole active run matching `runId`;
- requires its seed to remain `started`;
- changes only that run `active -> complete`;
- stamps `completedAt` once;
- preserves the seed as historical `started` state;
- repeated completion and missing/wrong run IDs are by-reference no-ops.

A01 deliberately never creates `withdrawn`. A05 owns withdrawal/escape/fail-forward behavior.

## Privacy defect discovered during A01

A01's private-source canary initially failed because A00's available-seed selector did not yet apply K05's private-dimension defense-in-depth. The predecessor was repaired in isolated commit `fd2b3ce`; see `A00-private-eligibility-repair.md`.

After that repair, a private-only seed cannot start, mixed-support remains eligible, and source-less A09 pure-fun compatibility is preserved.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Stable collision-safe run ID from seed ID | run-ID fixtures | PASS |
| Start only currently A00-eligible available seed | unavailable/private/used fixtures | PASS |
| One active AdventureRun globally | two-seed single-active fixture | PASS |
| Start atomically marks exact seed `started` and creates one active run | start fixture | PASS |
| Duplicate/repeated/history starts fail closed | repeated/lifecycle/history fixtures | PASS |
| Unrelated seed/gap/world/progression state preserved | structural before/after fixtures | PASS |
| Completion only affects sole active run | completion + corrupt-multi-active fixtures | PASS |
| `completedAt` written only on successful completion | completion/no-op fixtures | PASS |
| Terminal repeated completion is idempotent | completion fixture | PASS |
| Different seed may start after prior run completes | sequential-run fixture | PASS |
| No A05 withdrawal semantics | source scan + corrupt-state fixture | PASS |
| No A03 six-beat transition engine | source scan; only neutral `pending` placeholder | PASS |
| No A02 action/observation/memory creation | source scan + structural comparison | PASS |
| No provider/UI/world/combat/progression/persistence-write authority | source/diff scan | PASS |
| A00 private-source availability defect repaired before acceptance | predecessor repair receipt + canary | PASS |
| No TTS or real-user fixture content | final scans | PASS |

## Validation

After the A00 privacy repair:
- `npx tsc --noEmit` — **PASS**.
- A00 + A01 focused — **15/15 PASS**.
- Adventure/Knowledge/privacy/persistence impact bundle — **80/80 PASS across 7 files**.
- Full unit suite — **426/426 PASS across 49 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-a01-wrangler.log npm run build -- --configLoader runner` — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` / cached A01 diff check — **PASS**.
- A01 implementation commit contains exactly the two authorized run-lifecycle files.
- Source scans found no provider calls, GameEvents, progression authority, six-beat roles/transitions, withdrawal mutation, AdventureAction/Observation/Memory creation, world/combat/provider dependencies, TTS APIs, narrative/premise reads, or real-person fixture material.
- Browser proof is not required: A01 is a domain-only lifecycle packet with no user-facing runtime path yet.

## Boundaries / next dependency state

- A01 is complete and `MERGE_READY` locally, contingent on integrating its required A00 repair first (the branch ancestry already orders the commits correctly).
- A03 becomes the likely critical-path READY packet after integration because it depends only on A00 + A01.
- A02 remains blocked on W06 + P03 even after A01.
- A05 remains blocked on A03 + W07.
- N00 may become READY after A01; dependency state must be re-read from the master registry before promotion.
- A09 and W01 remain parallel-ready but non-critical.

## Merge boundary

This receipt authorizes only a fast-forward of the ordered repair+A01+review commits into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
