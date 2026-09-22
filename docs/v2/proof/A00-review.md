# Independent review — A00 AdventureSeed state / eligibility / deduplication

- **Base SHA:** `1cfa3f0af6d2853af59e957d892122264dafd62d`
- **Implementation commit:** `19f9d127a5d0ac4474996a50e8f53a7e50983708`
- **Branch:** `feat/v2-adventure-seeds`
- **Worktree:** `/Users/andrew/AtlasOfOne-adventure-seeds`
- **Implementation / independent review:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

A00 introduces the first lane-owned Adventure runtime state helper for durable `AdventureSeed` records. It consumes the already-reviewed K07 request boundary, revalidates that request against current eligible Knowledge state, materializes one deterministic seed, marks its exact source gaps `seeded`, and exposes a deterministic available-seed selector for later A01/W02 consumers.

Changed files:
- `src/adventure/seeds.ts`
- `tests/adventure/seeds.test.ts`

No shared contracts, `CampaignState` types, game engine/events, persistence/migration/schema, provider, App/UI, World, Combat, Reflection, Knowledge implementation, dependencies, canonical state docs, or assets changed in the implementation commit.

## Materialization authority

`materializeAdventureSeed(state, request, premise, options)` is the only A00 state-creation primitive.

A request is accepted only when:
- no structurally equivalent seed already exists in any seed lifecycle state;
- premise language is nonblank;
- the full bounded K07 request is still current against present campaign state;
- structural identity, permitted themes, forbidden dimensions and bounded evidence claims still match the current K07 compiler output.

This full-context revalidation means a stale request cannot materialize after supporting evidence is retracted, made private, becomes ineligible, changes bounded claim context, or loses selector eligibility.

On acceptance only:
- one `AdventureSeed` is appended with `status: available`;
- exact selected source gaps still `open` transition to `seeded`;
- `updatedAt` advances once;
- unrelated campaign authority remains unchanged.

No `AdventureRun`, world marker, combat state, provider call, game event, progression reward, Snapshot state, or UI is created.

## Deterministic identity / recurrence

Seed identity is based only on a collision-safe JSON structural key containing:
- sorted unique source gap IDs;
- territory ID;
- Adventure kind;
- learning target.

Premise wording is deliberately excluded. Reordered equivalent gap sets therefore map to the same seed ID, while ambiguous string sets such as `['a|b','c']` and `['a','b|c']` remain distinct.

Materialization refuses regeneration when any structurally equivalent seed already exists, regardless of:
- seed ID being deterministic or a legacy arbitrary ID;
- status being `available`, `started`, or `retired`;
- premise wording;
- whether a historical `AdventureRun` already references the seed.

The independent review strengthened the later-consumer selector as well: if malformed/imported state contains multiple structurally equivalent available seed IDs, `selectAvailableAdventureSeeds` returns only the lexicographically first eligible representative without rewriting stored history.

## Location boundary

The frozen v2 `AdventureSeed` contract requires `locationId`, while K07 intentionally owns no world-placement decision and W02 later owns deterministic world-marker placement.

A00 therefore uses the request `territoryId` as the seed's logical baseline `locationId`.

This satisfies the frozen record contract without inventing a sub-location taxonomy or preempting W01/W02. No sanctuary, geography, region, route, landmark, or marker module is imported.

## Premise boundary

`premise` is caller-supplied non-authoritative narrative language for the durable seed record. A00 does not generate it and does not call a model. Its only semantic validation is nonblank text. Premise content cannot change:
- seed identity;
- source gap IDs;
- eligibility;
- territory/location;
- kind;
- learning target;
- deduplication.

A later provider/local proposal lane may supply premise wording under its own typed boundary.

## Available-seed selection

`selectAvailableAdventureSeeds`:
- starts from the existing structurally privacy-retired eligible v2 view;
- keeps only `status: available`;
- excludes seeds already referenced by any AdventureRun;
- sorts by ID;
- deduplicates structurally equivalent available seeds for later consumers without mutating durable history.

Started, retired, source-ineligible, historically used, and duplicate-equivalent records do not appear as new available opportunities.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Deterministic collision-safe seed identity | delimiter-ambiguity + reordered-gap fixtures | PASS |
| Premise wording cannot alter identity/dedup | alternate-premise fixture + source inspection | PASS |
| Full eligibility revalidated at creation time | retired/resolved/retracted/private/changed-context fixtures | PASS |
| Forged kind/learning target/partial request fails closed | malformed-request fixtures | PASS |
| Source gaps transition only when a new seed is accepted | accepted-materialization fixture | PASS |
| Equivalent available/started/retired/history seed never regenerates | lifecycle/legacy-ID fixtures | PASS |
| Legacy-equivalent available seeds dedupe for consumers | selector dedupe fixture | PASS after reviewer strengthening |
| Unrelated gap/seed state is preserved | explicit historical-gap/seed preservation fixture | PASS |
| Ineligible/started/retired/used seeds excluded from available selector | selector eligibility fixture | PASS |
| No AdventureRun creation or mutation | structural before/after fixture + source scan | PASS |
| No world-marker/location-system ownership leak | source scan; territory ID used as logical location only | PASS |
| No provider/game/progression/UI/persistence mutation | diff/symbol scans + structural comparisons | PASS |
| Existing v2 persistence accepts seed state unchanged | schema-v2 + torture impact tests | PASS |
| No TTS or real-user fixture data | final scans | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- A00 focused suite — **7/7 PASS**.
- Adventure/Knowledge/privacy/persistence impact bundle — **72/72 PASS across 6 files**.
- Full unit suite — **418/418 PASS across 48 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-a00-review-wrangler.log npm run build -- --configLoader runner` — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` / cached diff check — **PASS**.
- Implementation commit contains exactly the two authorized Adventure files.
- Source scans found no provider call, GameEvent, progression authority, App/UI mutation, persistence write, world geography/marker dependency, AdventureRun creation, TTS API, or real-person fixture material.
- Browser proof is not required: A00 exit evidence is unit-level seed state/eligibility/deduplication and no UI/runtime journey exists yet.

## Boundaries / next dependency state

- A00 is complete and `MERGE_READY` locally.
- A01 becomes unblocked after A00 integration and owns deterministic `AdventureRun` lifecycle.
- A09 and W01 also become dependency-ready after A00, but the critical path remains A01 before six-beat runtime/world integration.
- A00 does not implement pure-fun seed generation (`learningTarget:none`), run lifecycle, withdrawal, scene templates, model proposals, world markers, natural-language actions, combat, or UI.

## Merge boundary

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
