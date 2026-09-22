# Independent review — RF06 real-play contradiction reachability

- **Base SHA:** `832d624bc0c0e3d5f75d60e5c32df8cb6fe4c5c7`
- **Implementation/review commit:** `333ca7c1e3380a80d8352accba5cc393f086b688`
- **Branch:** `fix/v2-rf06-runtime-reachability`
- **Worktree:** `/Users/andrew/AtlasOfOne-rf06-runtime`
- **Executor:** Codex, with bounded independent reviewer repairs by GPT-5.6 Sol before commit
- **Independent reviewer:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local `integration/atlas-v2-journal-adventure-combat` only. No push, deployment, or `main` merge authorized.

## Scope

This packet closes the RF06 blocker recorded in `docs/v2/proof/RF06-RF07-review.md`: the deterministic contradiction detector/refresh already existed, but normal play had no producer for explicit `counterEvidenceIds` and no runtime caller that invoked contradiction refresh.

The reviewed runtime seam is intentionally narrow:
- `src/reflection/runtime.ts` — new deterministic post-event reconciliation helper.
- `src/App.tsx` — one integration-owner call inside `commitTurn`, after ordinary Cartographer events cross the existing firewall.
- `tests/reflection/runtime.test.ts` — focused authority/progression/idempotence proof.
- `tests/browser/rf06-reachability.test.ts` — production-bundle real-play reachability and reload persistence proof.

No contract, GameEvent vocabulary, game engine, Cartographer apply/mock/schema, persistence, Worker, dependency, Journal, Knowledge, Adventure, Combat, or World implementation changed.

## Runtime authority path

`commitTurn` remains provider-firewall first:
1. `eventsFromTurn(...)` still emits only `ANSWER_ACCEPTED`, `EVIDENCE_ADDED`, and `INSIGHT_ADDED`.
2. `applyGameEvents` applies those ordinary deterministic events and all their existing progression effects.
3. `reconcileRevisionCounterEvidence(previousState, appliedState)` examines only the deterministic records already present after that crossing.
4. It reuses the independently reviewed RF07 detector. Therefore a new counter-link exists only when the newly added EvidenceRecord is `basis: revision`, its source Turn is locally/player-side `revision === true`, provenance is complete/eligible, chronology is strict, and an older same-dimension eligible evidence record exists under RF07 rules.
5. The chosen pair receives symmetric, sorted, deduplicated `counterEvidenceIds`.
6. Existing RF06 `refreshSupportedContradictions` persists the neutral unresolved contradiction immediately.

The provider cannot call this helper or emit a contradiction event directly. Provider-only `basis: revision` remains insufficient.

## Independent findings and bounded repair

1. **Single-timestamp contract.** The candidate passed the same `now` callback to link update and contradiction refresh, but could call it twice and receive different timestamps. Reviewer repair snapshots one timestamp and supplies a constant callback to RF06 refresh. A fixture proves exactly one callback invocation.
2. **Weak provider/ordinary negative assertion.** The first unit fixture only checked that one ordinary result was “defined.” It now proves provider-only and non-revision evidence both return the already-applied state by reference.
3. **Browser proof had brittle assumptions.** Exact XP `+12` and a fixed contradiction evidence-ID order were not RF06 authority contracts. The browser test now asserts ordinary progression still occurs while focused unit proof establishes RF06 adds no additional non-evidence/non-contradiction mutation; contradiction IDs are compared order-independently.
4. **Browser seed raced live hydration/autosave.** The test now settles onboarding before seeding and waits for IndexedDB transaction completion.
5. **Initial browser scenario was not a legitimate revision state.** Seeding one prior `self-description` evidence correctly made Atlas advance the next prompt to `temperament`. The final fixture models real play: all four Identity dimensions have eligible prior evidence and the territory is deeply charted, so the deterministic prompt selector cycles back to `self-description`; the visible revision submission can then revise real prior evidence on that dimension.
6. **Validation orchestration.** Codex spawned duplicate RF06 browser runs; those timing results were discarded. All review browser evidence below was rerun sequentially with one runner at a time.
7. **Broad-suite host contention.** One full-unit run timed out only the Greyson asset manifest check (377/378). The same asset suite immediately passed 8/8 in 201 ms, and a fresh quiet full-suite rerun passed 378/378. No product or asset change was made for that transient timeout.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Normal runtime can create supported counter-links | production-bundle RF06 browser canary | PASS |
| Counter-link requires player revision signal, not provider alone | focused runtime unit negatives + RF07 detector | PASS |
| Same-dimension strict chronology/provenance remains RF07 authority | existing RF07 tests + runtime helper delegates selection to RF07 | PASS |
| Counter-links are symmetric, sorted, deduped | focused runtime unit tests + browser persisted state | PASS |
| Existing unrelated counter-links are preserved | focused runtime unit test | PASS |
| One neutral unresolved contradiction is persisted | focused unit + production-bundle browser | PASS |
| Old/new evidence claim/status/provenance remain unchanged except counter links | focused unit + browser old-evidence assertion | PASS |
| RF06 adds no XP/progression/world/quest authority | focused structural comparison against already-applied state | PASS |
| Ordinary existing answer/evidence progression still occurs | production-bundle browser | PASS |
| Reconciliation is idempotent | focused unit | PASS |
| PRIVATE/retracted/missing provenance/invalid time/dimension mismatch fail closed | focused unit + preserved RF07/RF09 suites | PASS |
| Same deterministic timestamp is used for reconciliation + contradiction refresh | single-call timestamp fixture | PASS |
| Provider event firewall remains exactly three event types | source inspection of `PROVIDER_EVENT_TYPES` | PASS |
| Journal/provider/concurrency impact radius remains intact | Journal 4/4; provider 7/7; concurrency 7/7 | PASS |
| Contradiction survives IndexedDB reload | production-bundle RF06 browser reload assertion | PASS |
| No TTS/real-person fixture content/dependency/shared-schema drift | negative/scope scans | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- Reflection authority bundle (`runtime`, `deltas`, `state`, `privacy-propagation`) — **41/41 PASS**.
- First broad unit run — **377/378**, with only `tests/assets/greyson-assets.test.ts` manifest integrity timing out at the generic 5s limit under suite contention.
- Immediate isolated asset discriminator — **8/8 PASS** in ~0.2s.
- Fresh quiet full-unit rerun — **378/378 PASS** across 45 files.
- `WRANGLER_LOG_PATH=/tmp/atlas-rf06-runtime-review-wrangler.log npm run build -- --configLoader runner` — **PASS**; Worker + client/PWA bundles generated. Existing non-fatal >500 kB client chunk warning remains.
- Production-bundle `tests/browser/rf06-reachability.test.ts` — **1/1 PASS** after the fixture was corrected to a legitimate fully-covered revision state.
- Production-bundle `tests/browser/journal-foundation.test.ts` — **4/4 PASS**.
- Production-bundle `tests/browser/provider.test.ts` — **7/7 PASS** from the durable serialized rerun. The preceding connector-timeout run was treated as unverifiable and not counted.
- Production-bundle `tests/browser/concurrency.test.ts` — **7/7 PASS** from the durable serialized rerun. The preceding connector-timeout run was treated as unverifiable and not counted.
- `git diff --check` / staged diff check — **PASS**.
- Provider firewall source scan — still exactly `ANSWER_ACCEPTED / EVIDENCE_ADDED / INSIGHT_ADDED`.
- Negative scan — no `speechSynthesis`/`SpeechSynthesisUtterance`, real Greyson/Andrew/Bryan/Dexter fixture data, dependency changes, engine/event/schema/migration/Worker changes, or unrelated lane drift.

## Diff-scope verdict

**PASS.** Exactly four authorized files changed. `src/App.tsx` contains only the import and post-event reconciliation call; all new logic lives in the Reflection runtime helper and focused tests. The worktree `node_modules` symlink remains untracked infrastructure and is not part of the packet.

## Product result

RF06 is now genuinely reachable through normal player play without widening provider authority. A human-authored revision recognized by the existing local revision signal, combined with revision-basis evidence and eligible prior same-dimension evidence, creates deterministic counter-links and an unresolved contradiction. History remains intact; the system records tension instead of declaring which belief is “true.”

## Merge boundary / next dependency

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after environment, dirty-state, and ancestry verification. Once integrated and reverified, RF06 can move to `MERGED` and K03 becomes `READY` because RF07 is already merged. K06 remains separately READY/deferred; K07 remains blocked on K03 + K06.
