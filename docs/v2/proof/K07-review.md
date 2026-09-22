# Independent review — K07 deterministic gap-to-seed request boundary

- **Base SHA:** `64e4b05106853c044ea4478cf519807d866bb48a`
- **Implementation commit:** `69622df9dc4b6132e40ebe9ca3a54b249e3a31ee`
- **Branch:** `feat/v2-gap-seed-request`
- **Worktree:** `/Users/andrew/AtlasOfOne-gap-seed-request`
- **Implementation / independent review:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

K07 adds a pure, read-only Knowledge -> seed-request compiler. It consumes the existing K04/RF09-safe selector output and emits a bounded §9.4 request-shaped object. It does **not** create or persist `AdventureSeed`, mutate campaign state, call a provider, add UI, or begin Adventure runtime work.

Changed files:
- `src/knowledge/seed-request.ts`
- `tests/knowledge/seed-request.test.ts`

No contracts, game engine, persistence, provider, Adventure runtime, App/UI, dependencies, state docs, or assets changed in the implementation commit.

## Request contract

`GapSeedRequest` contains only:
- `gapIds`
- `territoryId`
- `adventureKind`
- `permittedThemes`
- `forbiddenDimensions`
- `evidenceClaims`
- `learningTarget`

The compiler:
- selects through `selectDiverseKnowledgeGaps`, preserving K04 priority/cooldown authority;
- groups only selected gaps that share the primary selected gap's valid territory;
- caps gaps at 3;
- exposes only non-private structural dimension IDs as permitted themes;
- exposes `privateTopics` only as sorted forbidden dimension IDs;
- includes only active, non-private evidence referenced by selected gaps with complete, non-retracted, non-private source-Turn provenance and matching request territory;
- caps evidence at 6 claims and 240 characters per claim;
- copies no Journal text, gap summary, question, answer, Reflection prose, or Adventure prose;
- returns `null` for empty/disabled/malformed selection;
- is deterministic and leaves source state byte-for-byte unchanged.

## Deterministic routing default

The master plan requires `adventureKind` but defines no routing table. K07 therefore uses a reversible structural default based only on gap kind:
- unknown -> `exploration-expedition`
- underexplored -> `investigation`
- curiosity -> `exploration-expedition`
- contradiction -> `mystery-puzzle`
- change -> `memory-echo`

This mapping is implementation policy, not durable personality/canon inference. No source prose, emotional intensity, trauma/pain/vulnerability keywords, model opinion, or hidden trait label participates. Every K07 gap-driven request uses `learningTarget: 'reflection-eligible'`; the later A09 pure-fun path remains responsible for `learningTarget: 'none'`.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Exact bounded §9.4 request shape | exact object snapshot fixture | PASS |
| Only selector-eligible non-retired gaps cross | K04 cooldown + retired/private fixtures | PASS |
| Private dimensions only as forbidden IDs | private-topic fixture | PASS |
| Journal content excluded | normal/private Journal prose canaries absent | PASS |
| Evidence independently filtered for active/private/retracted/missing provenance | mixed-source canary fixture | PASS |
| Evidence count/character budget enforced | hard-cap fixtures | PASS |
| Stored Knowledge priority/state not mutated | structural before/after equality fixture | PASS |
| Adventure kind / learning target deterministic and content-blind | all five gap-kind fixtures | PASS |
| Cross-territory gaps do not leak into one request | same-territory grouping fixture | PASS |
| Empty/malformed/disabled selection fails closed | null-result fixtures | PASS |
| Repeated input returns same object | deterministic replay fixture | PASS |
| No durable AdventureSeed/provider/UI/runtime mutation | exact shape + diff/symbol scan | PASS |
| No drama/NLP/TTS/real-user data | source/test scans | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- K07 focused suite — **8/8 PASS**.
- Knowledge/Reflection impact bundle — **85/85 PASS**.
- Full unit suite — **411/411 PASS across 47 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-k07-wrangler.log npm run build -- --configLoader runner` — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` / cached diff check — **PASS**.
- Implementation commit contains exactly the two authorized Knowledge files.
- Source scans show no provider call, persistence mutation, game event/progression authority, Journal text access, gap-summary access, drama/NLP vocabulary, TTS API, or real-person fixture content.
- Browser proof is not required: K07 is a domain-only boundary and the master plan exit evidence is a schema snapshot test.

## Boundaries / next dependency state

- K07 is complete and `MERGE_READY` locally.
- After integration and post-integration verification, A00 becomes READY.
- A00 owns durable `AdventureSeed` state/eligibility/deduplication; K07 must remain a pure request compiler.
- P05 may later consume this request as bounded provider context; K07 itself never calls a provider.

## Merge boundary

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
