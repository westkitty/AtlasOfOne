# Independent review — RF06 contradiction foundation + RF07 change-over-time detection

- **Base SHA:** `b8d41a751bba28c675ee3246b65f7d5edb05415b`
- **Codex implementation commit:** `ef032d755a9ea3fe9a06fc83bd09812db9d09634`
- **Reviewer repair commit:** `86f2b7171c2b5d84a6a0bb9a1f3e89f92dac6e88`
- **Branch:** `feat/v2-reflection-deltas`
- **Worktree:** `/Users/andrew/AtlasOfOne-reflection-deltas`
- **Executor:** Codex
- **Independent reviewer:** GPT-5.6 Sol
- **Split verdict:** `RF07 MERGE_READY`; `RF06 BLOCKED` on real-play reachability. The RF06 detector/refresh foundation is scope-safe and may integrate, but its packet exit condition is not satisfied and must not unblock K03.

## Scope

Implementation changes before this receipt are exactly:
- `src/reflection/deltas.ts`
- `tests/reflection/deltas.test.ts`

No contract, game engine, persistence, provider/cartographer, Knowledge, Journal, Adventure, Combat, UI, Worker, dependency, schema, migration or TTS surface changed.

## RF07 — PASS

`detectChangeOverTimeCandidates` is pure, non-mutating and provenance-only. It never compares claims, answers, questions, interpretations or emotional/content vocabulary.

A newer record can become a change-over-time candidate only when:
- evidence is active and non-private;
- all source Turns exist, are non-retracted and non-private;
- every source Turn dimension exactly matches the evidence dimension;
- all source Turn timestamps are finite;
- evidence basis is `revision`;
- at least one source Turn carries the player/app-side `revision === true` signal.

An older record must be eligible, on the exact same dimension and strictly earlier. Explicit counter-linkage is preferred; otherwise the closest earlier evidence is selected. The result remains a candidate only and carries structural IDs/provenance rather than a conclusion about Greyson.

### Reviewer repair

The Codex candidate trusted `EvidenceRecord.dimension` even though the current provider semantic validator does not require evidence proposals to match the source Turn dimension. A provider could therefore label a revision about Y as evidence about X and produce a false “changed mind on X” candidate.

A reviewer canary failed exactly as predicted. The single bounded repair makes timed RF07 evidence fail closed when any source Turn dimension disagrees with the evidence dimension. Previously valid synthetic fixtures were corrected to carry internally consistent dimension provenance; the deliberate mismatch fixture remains and now passes.

## RF06 — detector foundation PASS, packet exit BLOCKED

`detectSupportedContradictionCandidates` and `refreshSupportedContradictions` are structurally sound:
- only eligible active evidence participates;
- one-way explicit `counterEvidenceIds` linkage is sufficient;
- mutual/reversed/duplicate links dedupe to one order-independent pair;
- missing/self/ineligible links fail closed;
- candidate output is prose-free structural provenance;
- refresh appends one neutral unresolved `ContradictionRecord` and preserves prior history;
- later source ineligibility does not delete, rewrite or reopen contradiction history.

However, the controlling master plan requires RF06 to **“Make contradiction creation reachable from active supported claims”** and separately says **“Make contradiction creation reachable in real play.”** Current runtime evidence creation does not satisfy that condition:

- `recordsFromMockTurn` initializes every newly created EvidenceRecord with `counterEvidenceIds: []`.
- Repository inspection found no runtime writer that populates `counterEvidenceIds` after creation.
- `refreshSupportedContradictions` has no normal runtime caller outside the new module/tests.
- Existing final-assessment trust tests still describe contradictions as seeded because no normal producer exists.

Therefore synthetic detector tests do not prove real-play reachability. RF06 remains BLOCKED until an authority-safe producer/caller path exists. This review does **not** authorize semantic claim comparison, same-dimension contradiction invention, provider-only contradiction authority, or automatic replacement of older evidence.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| RF06 explicit counter-link detector deterministic/deduped | focused fixtures | PASS |
| RF06 private/retracted/missing provenance fails closed | focused fixtures | PASS |
| RF06 neutral append preserves contradiction history | focused fixtures | PASS |
| RF06 contradiction creation reachable in normal play | source scan: new evidence counter links always empty; no runtime writer/caller | **BLOCKED** |
| RF07 requires provider revision basis + player/app revision Turn | focused fixtures | PASS |
| RF07 exact chronology / closest-prior selection | focused fixtures | PASS |
| RF07 counter-linked prior outranks closer unlinked prior | focused fixture | PASS |
| RF07 invalid/equal/missing/private/retracted provenance excluded | focused fixtures | PASS |
| RF07 provider/source-dimension mismatch fails closed | reviewer adversarial fixture | PASS after repair |
| RF07 output is structural and non-mutating | canary/history fixture + source scan | PASS |
| RF07 content-blind / no drama weighting | `trauma` vs `bananas` fixture | PASS |
| Reflection lane still cannot create EvidenceRecord/GameEvent/progression | existing authority tests + negative scan | PASS |
| No real Greyson/private fixture content | negative scan | PASS |

## Validation after reviewer repair

- `npx tsc --noEmit` — **PASS**.
- Reflection focused bundle (`deltas` + existing authority + RF09 privacy) — **36/36 PASS** across 3 files.
- Full unit suite — **373/373 PASS** across 44 files.
- `WRANGLER_LOG_PATH=/tmp/atlas-rf-deltas-review-wrangler.log npm run build -- --configLoader runner` — **PASS**; Worker/client/PWA bundles generated. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` — **PASS**.
- Scope scan — only the two authorized Reflection implementation/test files changed before review documentation.
- New-module authority scan — no `EvidenceRecord`, `EVIDENCE_ADDED`, `GameEvent`, TTS API or progression authority symbols.
- New-module prose scan — no `.claim`, `.answer`, `.question`, interpretation/emotion/drama inspection.
- Synthetic-data scan — no real Greyson/Andrew/Bryan/Dexter/Aerron fixture content.
- No browser test was required for RF07/domain detector code. RF06 real-play reachability remains explicitly BLOCKED rather than waived.

## Required RF06 follow-up

The narrow missing interface is a human-authority-safe way to create/persist explicit counter-evidence linkage and invoke contradiction refresh during normal state evolution. The existing RF02/RF05 seam carries a player-authored Reflection evidence-conversion request and explicit `revisionTargetId`, but there is currently no runtime consumer that converts that request into durable evidence or counter-link state.

The follow-up must preserve:
1. provider output alone cannot declare contradiction or changed mind;
2. player response/revision provenance remains mandatory;
3. old evidence/history is preserved;
4. counter-link creation is structural and explicit;
5. PRIVATE/retracted sources remain excluded;
6. no new progression authority is introduced.

## Integration boundary

The reviewed branch may be fast-forwarded into local `integration/atlas-v2-journal-adventure-combat` **only if** the ledger records RF07 as complete/merged and RF06 as blocked/partial-foundation, and K03 remains blocked on RF06. This receipt does not authorize push, deployment or merge to `main`.
