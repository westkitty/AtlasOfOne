# Independent review — K04 Knowledge theme diversity / cooldown

- **Base SHA:** `0af043b7c386f5a9b6946b3cac2b4b1dc99b7e58`
- **Codex implementation commit:** `3b929cf8659a94ed2d5e016f838886875d2af709`
- **Reviewer repair commit:** `cf482ac525fa19f86b4c22729113f2ab484903cb`
- **Branch:** `feat/v2-knowledge-diversity`
- **Worktree:** `/Users/andrew/AtlasOfOne-knowledge-diversity`
- **Executor:** Codex
- **Independent reviewer:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

K04 adds one deterministic, pure reranking layer over the existing K00/K01/K02/K05 selector. Existing gap generation, stored priorities, curiosity creation, privacy filtering, persistence, contracts and runtime mutation authority remain unchanged.

Changed product/test surfaces before this proof receipt:
- `src/knowledge/gaps.ts`
- `tests/knowledge/gaps.test.ts`

No contract, persistence, Journal, Reflection, Adventure runtime, provider/cartographer, game engine, UI, Worker, schema, migration, dependency or TTS surface changed.

## Implemented selection behavior

`selectDiverseKnowledgeGaps`:
- starts from the existing RF09/K05-safe open `selectKnowledgeGaps` result;
- preserves stored `KnowledgeGap.priority` values exactly;
- uses only eligible Adventure seed/run IDs, territory IDs, dimension IDs and valid timestamps;
- applies exact-gap cooldown over the two most recent valid eligible runs by default;
- applies bounded recent-theme penalties over six valid eligible runs by default;
- greedily applies bounded same-batch territory/dimension redundancy penalties;
- exempts explicit curiosity from broad theme penalties while retaining exact-gap cooldown;
- uses deterministic tie-breaking and bounded options;
- never reads gap summary, evidence claim, Journal text, Adventure premise/action/observation text, emotional wording or semantic topic content.

Penalty policy:
- recent territory: `8 * count`, capped at 24;
- recent dimension: `4 * count`, capped at 12;
- already-selected non-curiosity territory overlap: 10;
- already-selected non-curiosity dimension overlap: 6.

The selector may return fewer than `limit` when exact-gap cooldown removes candidates; it does not violate cooldown merely to fill a quota.

## Independent finding and bounded repair

**Invalid timestamp was incorrectly allowed to create recency.** The Codex candidate sorted invalid run timestamps after valid history, but if invalid-dated runs were the only available history, they still entered the exact-gap cooldown and recent-theme windows. That treated unknown time as recent and could suppress the current top gap without chronological proof.

An adversarial fixture with one invalid-only historical run failed exactly as predicted: the current top gap was suppressed. The single bounded reviewer repair now filters history to entries with finite timestamps before any cooldown or repetition penalty is calculated. If no valid timestamped history remains, K04 returns the base selector order unchanged. Invalid records remain deterministic historical data but never manufacture recency.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| No eligible history -> exact base selector order | focused fixture | PASS |
| Exact recent passive gap cooldown | focused fixture | PASS |
| Gap becomes eligible after cooldown ages out | focused fixture | PASS |
| Repeated territory receives bounded penalty | focused fixture | PASS |
| Repeated dimension receives independent bounded penalty | focused fixture | PASS |
| Stored priorities never mutate | structural before/after fixture | PASS |
| Greedy batch avoids redundant near-priority themes | three-gap fixture | PASS |
| Curiosity retains priority / no broad theme penalty | focused fixture | PASS |
| Curiosity still obeys exact-gap cooldown | focused fixture | PASS |
| PRIVATE/retracted/RF09-retired seed histories do not influence reranking | focused privacy-history fixture | PASS |
| Invalid timestamp sorts deterministically behind valid history | focused fixture | PASS |
| Invalid-only history creates no cooldown or novelty penalty | reviewer adversarial fixture | PASS after repair |
| Repeated identical input returns stable ordered IDs | focused determinism fixture | PASS |
| Long synthetic history suppresses repetition without priority mutation | focused long-history fixture | PASS |
| Content-blind `trauma` vs `bananas` structures rerank identically | no-drama fixture | PASS |
| No real-person/private fixture data | negative scan | PASS |
| No provider/game/progression authority added | scope/symbol scan | PASS |

## Validation after repair

- `npx tsc --noEmit` — **PASS**.
- `npx vitest run --configLoader runner tests/knowledge/gaps.test.ts` — **27/27 PASS**.
- `npx vitest run --configLoader runner tests/reflection/privacy-propagation.test.ts` — **10/10 PASS**.
- Full unit suite — **358/358 PASS** across 43 files.
- `WRANGLER_LOG_PATH=/tmp/atlas-k04-review-wrangler.log npm run build -- --configLoader runner` — **PASS**; Worker/client/PWA bundles generated. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` — **PASS**.
- Negative scan — no TTS API, evidence/progression authority or real-person fixture content in the Knowledge packet.
- No browser suite required: K04 is a pure domain selector with no UI/runtime wiring.

## Boundaries / next dependency state

- K04 is complete at the domain level.
- K06 remains READY but should be completed with a real user-facing “do not explore this” path so its browser acceptance criterion can be proved rather than claimed.
- K03 remains blocked on RF06/RF07.
- K07 remains blocked on K03 and K06 after K04 integration.

## Merge boundary

This receipt authorizes only fast-forward integration into local `integration/atlas-v2-journal-adventure-combat` after environment/ancestry verification. It does not authorize push, deployment or merge to `main`.
