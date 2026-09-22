# Independent review — K06 explicit Knowledge gap retirement

- **Base SHA:** `4189c36678f2538133d88976a4b4e3d0c915c199`
- **Implementation commit:** `6745d1f2132f4c29e3b3371ff478df485dabce90`
- **Branch:** `feat/v2-knowledge-retirement`
- **Worktree:** `/Users/andrew/AtlasOfOne-knowledge-retirement`
- **Implementation / independent review:** GPT-5.6 Sol
- **Codex attempt:** one bounded executor attempt was started from the clean worktree, but its code-mode host timed out twice before any edit; the executor was stopped and the tree was verified untouched before direct implementation began.
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

K06 provides explicit player authority over one known Journal-derived exploration path without exposing internal Knowledge analytics. The player can opt an eligible Journal entry into **Explore later**, then explicitly say **Don't explore this**. The exact durable curiosity gap is retained as history with `status: retired`; the source Journal entry is not deleted or rewritten.

Changed product/test surfaces:
- `src/knowledge/gaps.ts`
- `src/journal/JournalPanel.tsx`
- `src/journal/JournalPanel.css`
- `src/App.tsx` — Journal-only integration wiring
- `tests/knowledge/gaps.test.ts`
- `tests/browser/knowledge-retirement.test.ts`

No contracts, game engine/events, K03 deltas, Reflection, persistence implementation, Cartographer/provider, Adventure runtime, combat, Worker, dependencies, canonical state docs, or asset files changed in the feature commit.

## Implemented behavior

### Explicit opt-in

The existing K02 `markJournalForExploration` and collision-safe `curiosityGapId` are now reachable from Journal history through a visible **Explore later** button. The control is shown only for `active + normal` Journal entries whose exact curiosity path has not already existed.

The resulting gap remains the existing K02 shape:
- kind `curiosity`;
- priority `100`;
- source Journal entry ID preserved structurally;
- no source prose copied into the summary;
- no progression or provider event.

### Explicit retirement

`retireKnowledgeGap(state, gapId, options)` is a deterministic exact-ID lifecycle helper:
- only `open` or `seeded` may transition to `retired`;
- missing, `resolved`, and already-`retired` are by-reference no-ops;
- source Journal/evidence/history is preserved;
- kind, priority, summary, territory/dimension IDs, and provenance IDs are preserved;
- only lifecycle state plus aggregate `updatedAt` changes directly;
- the existing structural `retireIneligibleV2State` boundary is composed afterward so dependent seeds with no remaining eligible gap support retire canonically;
- mixed-support and unrelated seeds remain available;
- no Adventure run withdrawal semantics were invented.

Retired gaps are excluded by the existing `selectKnowledgeGaps` / `selectDiverseKnowledgeGaps` eligibility path and therefore cannot become future eligible K07 inputs.

### Journal UX

No generic KnowledgeGap dashboard or hidden reasoning surface was introduced. Journal history shows only presentation-safe lifecycle state for the exact entry:
- no path -> **Explore later**;
- `open` / `seeded` -> **Don't explore this**;
- `retired` -> **Not exploring**;
- `resolved` -> **Explored**.

Private/retracted entries do not expose exploration controls. Existing privacy and retraction controls remain intact. Visible feedback is non-clinical:
- `Saved for later exploration.`
- `Removed from Explore later. The entry stays in your journal.`

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Explicit player action creates Explore-later path | production-bundle browser visible button + IndexedDB assertion | PASS |
| Explicit player action retires exact path | production-bundle browser `Don't explore this` + persisted exact gap | PASS |
| Journal source remains unchanged | unit structural comparison + browser persisted equality | PASS |
| Missing/resolved/retired no-op; seeded may retire | K06 unit fixtures | PASS |
| Retired gaps excluded from normal selectors | K06 selector fixture | PASS |
| Dependent single-support seed retires structurally | K06 seed fixture | PASS |
| Mixed/unrelated seed support preserved | K06 seed fixture | PASS |
| Private/retracted entries cannot opt in | K02 unit fixtures + K06 browser private entry | PASS |
| No hidden analytics screen/priority disclosure | diff inspection; Journal-only lifecycle projection | PASS |
| No provider/model retirement authority | product diff scan + browser `/api/turn` count remains zero | PASS |
| No XP/world/progression mutation | unit before/after comparisons + browser persisted comparisons | PASS |
| Mobile controls remain usable | K06 44px assertions; Journal 320/390px regression | PASS |
| Decision survives reload | K06 production-bundle browser reload assertion | PASS |
| No K07 or Adventure runtime work | scope diff | PASS |
| TTS remains absent | final diff/TTS scan | PASS |
| Synthetic fixtures only | real-data canary scan | PASS |

## Validation

- `git diff --check` / cached diff check — **PASS**.
- `npx tsc --noEmit` — **PASS**.
- focused Knowledge + Journal unit gate — **35/35 PASS**.
- full unit suite — **403/403 PASS across 46 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-k06-wrangler.log npm run build -- --configLoader runner` — **PASS**; Worker/client/PWA bundles generated. Existing non-fatal >500 kB client chunk warning remains.
- `tests/browser/knowledge-retirement.test.ts` — **1/1 PASS** against the production bundle.
- `tests/browser/journal-foundation.test.ts` — **4/4 PASS**, including no horizontal overflow at 320px or 390px.
- final forbidden-path, TTS, provider/game-authority, hidden-analytics, semantic-match and real-data scans — **PASS**. The only `/api/turn` reference in K06 scope is the browser canary deliberately counting/aborting provider requests.
- implementation commit contains exactly the six authorized files.

## Boundaries / next dependency state

- K06 is complete and `MERGE_READY` locally.
- K07 becomes unblocked after K06 integration. K07 must construct a bounded gap-to-seed request from eligible Knowledge state without leaking hidden analytics or private/retracted material.
- Adventure A00 remains blocked until K07 is integrated.
- This packet does not define Adventure withdrawal, seed presentation, or runtime refusal semantics beyond the generic durable gap retirement primitive future surfaces may reuse.

## Merge boundary

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
