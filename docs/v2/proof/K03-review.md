# Independent review — K03 contradiction/change Knowledge inputs

- **Base SHA:** `57d5070b72490f96ac8ef8d720529bade1969d4d`
- **Implementation commit:** `7bebdd50f24ff51fb3887cdc9aba3941cd601888`
- **Branch:** `feat/v2-knowledge-contradiction-change`
- **Worktree:** `/Users/andrew/AtlasOfOne-knowledge-deltas`
- **Implementation source:** preserved uncommitted K03 lane draft present at review start; original draft author was not established in this pass
- **Independent reviewer / bounded repair:** GPT-5.6 Sol
- **Codex advisory review:** attempted against the preserved draft; it made no edits and was stopped after its process guard repeatedly misidentified its own executor as a conflicting Codex process
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

K03 converts already-authoritative RF06/RF07 structural state into deterministic `KnowledgeGap` inputs. It does not infer contradiction or changed mind from source prose and it does not add any runtime, provider, progression, persistence, UI, Adventure, combat, schema, migration, dependency, or TTS authority.

Changed product/test surfaces:
- `src/knowledge/deltas.ts`
- `tests/knowledge/deltas.test.ts`

No other product files changed in the implementation commit.

## Implemented behavior

### Contradiction gaps

A contradiction gap is generated only when all of the following hold:
- the durable contradiction is still `open`;
- the contradiction ID is RF09/K05 eligible through `providerEligibleV2State`;
- the evidence pair is also returned by RF06 `detectSupportedContradictionCandidates`;
- the structural candidate has at least one dimension and one routable territory.

Duplicate or reversed durable contradiction records collapse to one collision-safe evidence-pair identity. The generated summary is fixed and neutral: source contradiction/evidence/Turn prose is never copied.

### Change gaps

A change gap is generated only from RF07 `detectChangeOverTimeCandidates`. K03 therefore inherits RF07's requirements for active/non-private evidence, complete non-retracted provenance, exact source/evidence dimension agreement, finite strict chronology, provider `basis: revision`, and a player/app-side source Turn with `revision === true`.

The two structural change relationships have fixed deterministic priorities:
- counter-linked revision: `80`;
- same-dimension revision without an explicit counter-link: `75`.

No claim, answer, question, Journal text, interpretation, Adventure prose, sentiment, keyword, or emotional-content classifier participates.

### Contradiction and change coexist

The preserved draft originally suppressed a `change` gap whenever the same evidence pair also had an eligible open `contradiction`. No controlling source authorized that precedence rule, and normal RF06 revision flow now creates counter-links plus an open contradiction for the same old/new evidence pair. Keeping the suppression would make the distinct `change over time` Knowledge concept effectively disappear from the ordinary RF06 path while the contradiction remained open.

The bounded reviewer repair removed that suppression. An eligible revision pair may now expose both distinct concepts:
- contradiction priority `85`;
- counter-linked change priority `80`.

This preserves the master plan's requirement that both contradictions and change over time remain reachable product concepts. K04 may later rerank or suppress recent repetition without deleting either semantic category or mutating stored priorities.

## Fixed structural ranking

K03 adds fixed, content-blind category priorities rather than prose-derived importance:
- explicit curiosity: existing `100`;
- zero-evidence unknown: existing `90` maximum passive coverage score;
- supported contradiction: `85`;
- counter-linked change: `80`;
- same-dimension revision change: `75`;
- ordinary underexplored coverage remains governed by existing K01 coverage/age scoring.

These numbers are implementation policy for deterministic structural ordering; the master plan specifies contradiction relevance and no-drama weighting but does not prescribe exact numeric weights. Tests lock the resulting order and prove that structurally identical `trauma` and `bananas` fixtures behave identically.

## Privacy and provenance

K03 composes with the existing RF09/K05 boundary instead of inventing a second privacy system:
- contradiction generation requires an RF09-eligible contradiction ID and an RF06-supported eligible evidence pair;
- change generation inherits RF07's private/retracted/missing/invalid provenance exclusions;
- private dimensions fail closed;
- generated K03 gaps retain evidence IDs as explicit provenance so existing retirement/provider-eligibility logic can retire them when their support becomes ineligible;
- source Turns, evidence, contradictions, and reflections are never mutated by K03.

Historical non-open K03 gaps (`seeded`, `resolved`, `retired`) are preserved and never reopened by refresh. Only exact collision-safe generated `open` K03 identities are reconciled.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Open eligible contradiction inputs only | RF06-supported + RF09-eligible contradiction fixtures | PASS |
| Unsupported/resolved/private/retracted contradiction state fails closed | focused negative fixtures | PASS |
| Change input comes only from RF07 candidates | same-dimension/counter-linked/missing/private fixtures | PASS |
| Contradiction and change are both reachable concepts | same-pair coexistence fixture | PASS after reviewer repair |
| No claim/answer/question/Journal/Adventure prose in production generation or rank | source scan + prose canary fixture | PASS |
| No trauma/pain/vulnerability drama weighting | production vocabulary scan + `trauma` vs `bananas` fixture | PASS |
| Deterministic collision-safe IDs and ordering | ambiguous-ID + reversed-input fixtures | PASS |
| Stable composition with K00/K04 selectors | rank-order + K04 no-priority-mutation fixtures | PASS |
| RF09/private/retracted exclusion | K03 negatives + RF09 impact bundle | PASS |
| Refresh idempotent and owns only exact generated OPEN K03 records | lifecycle fixtures | PASS |
| RF06/RF07 source state remains immutable | structural before/after fixture | PASS |
| No provider/game/progression/TTS authority added | scope/symbol scan | PASS |
| No real Greyson/private fixture data | negative scan | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- `npx vitest run --configLoader runner tests/knowledge/deltas.test.ts` — **21/21 PASS**.
- Impact bundle (`knowledge/deltas`, `knowledge/gaps`, `reflection/deltas`, `reflection/privacy-propagation`) — **73/73 PASS**.
- Full unit suite — **399/399 PASS across 46 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-k03-wrangler.log npm run build -- --configLoader runner` — **PASS**; Worker/client/PWA bundles generated. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` / staged diff check — **PASS**.
- Implementation commit contains exactly the two authorized Knowledge files.
- Production K03 source scan found no `.claim`, `.answer`, `.question`, Journal/Adventure prose reads, dramatic-content vocabulary, provider events, progression authority, TTS APIs, or real-person fixture material.
- Browser proof was not required: K03 is a domain-only input/ranking packet and `OPERATIONAL_STATE.md` explicitly requires rank-order fixtures rather than a browser surface.

## Boundaries / next dependency state

- K03 is complete at the domain level and can move to `MERGE_READY`.
- K06 remains `READY` and intentionally deferred to a real user-facing "do not explore this" / retirement surface because its exit evidence requires browser + unit proof.
- K07 remains blocked only on K06 after K03 integration; it must consume eligible Knowledge state through the established selector/retirement boundary rather than raw unfiltered gaps.
- Adventure A00 remains blocked on K07.

## Merge boundary

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
