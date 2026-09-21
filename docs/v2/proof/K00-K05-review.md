# Independent review — K00/K01/K02/K05 Knowledge Gap foundation

- **Base SHA:** `a3f21b2546f354dbe27346c12f014d733a6750d6`
- **Codex implementation commit:** `59ac15f9acd4e8f7d55e7ea259f19e299d8bc467`
- **Reviewer repair commit:** `bca5eb3f6b3e057d396b088554ee7bca4e80b50a`
- **Branch:** `feat/v2-knowledge-gap-foundation`
- **Worktree:** `/Users/andrew/AtlasOfOne-knowledge`
- **Executor:** Codex
- **Independent reviewer:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for K00, K01, K02 and K05 on the local v2 integration branch only. K03/K04/K06/K07 remain separate packets.

## Scope

This packet adds one lane-owned deterministic Knowledge module and its synthetic tests only:
- `src/knowledge/gaps.ts`
- `tests/knowledge/gaps.test.ts`

No frozen contract, game engine/type/data, persistence, provider, Journal, Reflection, Adventure, Combat, World/UI, Worker, dependency, migration, schema or TTS surface changed.

## Implemented behavior

### K00 — deterministic gap generation and selection

Passive coverage candidates are generated from territory `requiredDimensions` in stable territory/dimension order. Evidence counts only when it is active, matches both exact dimension and territory, has non-empty turn provenance, and every source turn resolves to a non-retracted/non-private turn. Missing provenance fails closed.

- zero eligible evidence -> `unknown`
- existing but insufficiently broad/strong evidence -> `underexplored`
- sufficiently covered -> no passive gap
- no `contradiction` or `change` inference in this packet

Generated summaries contain only neutral territory/dimension coverage wording; they never copy evidence claims, answers, Journal text or emotional analysis.

Persisted selection uses the RF09-filtered v2 gap view, then additionally rejects gaps naming a current `privateTopics` dimension, selects open gaps by default, orders priority descending then ID ascending, and supports a bounded limit.

`refreshCoverageGaps` mutates only `knowledgeGaps` and `updatedAt`: it adds missing generated coverage gaps, updates matching OPEN generated gaps, resolves stale OPEN generated gaps without deletion, and leaves seeded/resolved/retired generated gaps plus manual/curiosity gaps untouched.

### K01 — explicit content-blind score

Coverage points:
- 0 eligible evidence: 60
- exactly 1: 30
- 2+ but still weak/repetitive: 15
- sufficiently covered: no gap

Age points from newest eligible source Turn:
- never explored / no valid eligible timestamp: 30
- <14 days: 0
- 14–59 days: 10
- 60–179 days: 20
- >=180 days: 30

Priority is the sum. Exact 14/60/180-day boundaries are fixture-tested. The score reads only evidence count, sufficient-coverage state and timestamps; trauma/pain/vulnerability labels or claim wording have no scoring path.

### K02 — explicit curiosity only

`markJournalForExploration` creates a priority-100 `curiosity` gap only after an explicit action on an RF09-eligible Journal entry. It does not infer curiosity from text, copies no Journal prose, uses current active territory only as context, and never duplicates/reopens an existing deterministic curiosity gap. PRIVATE, retracted and Reflection-masked Journal entries are refused.

### K05 — privacy/retraction exclusion

- private dimensions generate no passive gaps;
- retracted/private-turn evidence is excluded from coverage;
- RF09-masked/private/retracted Journal entries cannot create curiosity gaps;
- RF09-retired persisted gaps are absent from selectors;
- stale source-less persisted gaps naming a newly private dimension are withheld by the Knowledge selector;
- content equality alone never triggers privacy or priority behavior.

## Independent findings and bounded repair

1. **Lossy deterministic-ID collision — real defect.** The Codex candidate slugged IDs, so distinct values such as `self description` and `self-description` collapsed to the same generated gap ID; Journal IDs had the same risk. Reviewer repair uses URI-encoded JSON identity tuples, preserving exact input identity without randomness. Collision fixtures now prove distinct inputs remain distinct.
2. **Generated-prefix ownership was too broad.** Any manually authored gap whose ID merely began with `knowledge_gap_coverage_` could be treated as engine-generated and resolved/overwritten. `isGeneratedCoverageGap` now requires a valid passive kind, exactly one territory/dimension, no Journal source and an exact recomputed deterministic ID.
3. **Stale source-less private-dimension gap could be selected.** RF09 retires by provenance; an `unknown` coverage gap legitimately has no source IDs, so a previously persisted open gap could survive if that dimension later became PRIVATE. Selection now has a defense-in-depth `dimensionIds` privacy check and a canary proving the private gap cannot surface.
4. **Exact score thresholds were under-proven.** Reviewer added fixtures for the 14/60/180-day boundaries and the 2+ weak-evidence 15-point coverage case. No scoring implementation change was needed.

This was the single bounded repair pass.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Zero evidence -> unknown priority 90 | focused fixture | PASS |
| One recent evidence -> underexplored priority 30 | focused fixture | PASS |
| One 75-day evidence -> priority 50 | focused fixture | PASS |
| Exact 14/60/180 age buckets | reviewer boundary fixture | PASS |
| Two distinct source turns + strength >=2 -> sufficiently covered | focused fixture | PASS |
| Repeated evidence from one turn remains underexplored | focused fixture | PASS |
| Stable deterministic collision-safe IDs | adversarial identity fixtures | PASS |
| Generated refresh cannot seize arbitrary prefixed manual gap | exact-identity predicate fixture | PASS |
| Private dimension produces/selects no passive gap | generation + stale-selection canaries | PASS |
| Retracted/private provenance does not reduce undercoverage | focused fixture | PASS |
| Explicit eligible Journal action creates one priority-100 curiosity gap | focused fixture | PASS |
| Curiosity is never inferred from prose and copies no Journal text | source inspection + canary | PASS |
| Existing curiosity gap is never duplicated/reopened | all-status identity fixture | PASS |
| PRIVATE/retracted/RF09-masked Journal cannot create curiosity | focused fixture | PASS |
| Selectors use RF09 view, open-only default, priority-desc/ID-asc, limit | focused fixture | PASS |
| Refresh changes only gaps + updatedAt and resolves stale generated OPEN gaps | structural-state fixture | PASS |
| Scoring is content-blind / no drama weighting | `trauma` vs `bananas` fixture + source inspection | PASS |
| No contradiction/change gap is auto-generated | focused fixture + source inspection | PASS |
| No real-person/private fixture data | negative scan | PASS |
| No game/progression/provider authority added | path/symbol negative scan | PASS |

## Validation after repair

- `npx tsc --noEmit` — **PASS**.
- `npx vitest run --configLoader runner tests/knowledge/gaps.test.ts` — **15/15 PASS**.
- `npx vitest run --configLoader runner tests/reflection/privacy-propagation.test.ts` — **10/10 PASS**.
- Full unit suite — **346/346 PASS** across 43 files.
- `WRANGLER_LOG_PATH=/tmp/atlas-knowledge-review-wrangler.log npm run build -- --configLoader runner` — **PASS**; Worker + client/PWA bundles generated. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` — **PASS**.
- Base-to-review scope contains only the two authorized Knowledge files before review documentation.
- Negative scan found no TTS API, evidence/progression event authority or real-person fixture content in `src/knowledge/**` / `tests/knowledge/**`.
- No browser test was required because this packet adds no user-facing runtime/UI wiring.

## Boundary / deferred work

- **K03** remains blocked on RF06/RF07; this packet intentionally does not infer contradiction/change gaps.
- **K04** theme diversity/cooldown/repetition suppression is now dependency-ready after K01 integration.
- **K06** explicit user gap retirement / “do not explore this” is now dependency-ready after K00 integration.
- **K07** gap -> seed request remains blocked until K01–K06 are complete.
- Future provider/adventure integration should consume the Knowledge selector/K07 boundary, not blindly read raw `state.knowledgeGaps`. Source-less `unknown` gaps require the Knowledge selector's private-dimension check in addition to provenance retirement.

## Merge boundary

This receipt authorizes only fast-forward integration into local `integration/atlas-v2-journal-adventure-combat` after environment/ancestry verification. It does not authorize push, deployment or merge to `main`.
