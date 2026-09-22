# Independent review — I00 Journal -> Gap -> explicit Explore-this seed

- **Base SHA:** `0e264ac641edcfb3cd0a805b1dbc60e8a0b68abf`
- **Implementation commit:** `9f7882fadc4d54f682076b6e89b34cbd36375cfb`
- **Branch:** `feat/v2-journal-explore-seed`
- **Worktree:** `/Users/andrew/AtlasOfOne-journal-explore-seed`
- **Implementation / independent review:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

I00 closes the real product gap between a player-owned Journal curiosity marker and a durable AdventureSeed. The flow remains explicitly two-stage:

1. **Explore later** — existing K02/K06 behavior; creates one durable curiosity `KnowledgeGap` only.
2. **Explore this** — new I00 behavior; explicitly materializes exactly one A00 AdventureSeed for that exact open Journal curiosity path.

Saving a Journal entry by itself still creates neither a gap nor a seed.

Changed files:
- `src/App.tsx` — minimal explicit Journal action wiring
- `src/journal/JournalPanel.tsx`
- `src/adventure/journalSeed.ts`
- `src/adventure/seeds.ts` — narrow exact-Journal-curiosity revalidation path
- `src/knowledge/seed-request.ts` — explicit-player single-gap K07 request compiler
- `tests/adventure/journalSeed.test.ts`
- `tests/knowledge/seed-request.test.ts`
- `tests/browser/journal-seed-integration.test.ts`

No game engine/events, persistence implementation/schema, provider/Cartographer, world marker placement, combat, Reflection, dependencies, canonical state docs or assets changed in the implementation commit.

## Exact-player targeting

The ordinary K07 path still uses K04 diversity/cooldown to choose automatic candidates. I00 adds `buildGapSeedRequestForGap` for surfaces where the player has already named the exact thing to explore.

That targeted K07 path:
- requires the exact gap to be currently K05/RF09-eligible and `open`;
- uses the same territory/privacy/evidence-budget compiler as ordinary K07;
- returns only one exact gap ID;
- never reads Journal prose;
- does not create a seed by itself.

A00's `requestStillCurrent` accepts targeted revalidation only for the exact K02 Journal-curiosity shape:
- kind `curiosity`;
- exactly one Journal source;
- zero evidence sources;
- zero dimensions.

All ordinary/automatic K07 requests retain their original full-context validation.

## Adversarial repair during implementation

The first targeted A00 revalidation attempt was too broad: it accepted any one-gap targeted request. Existing A00 regression `rejects forged kind/learning target, malformed empty premise, and stale partial gap sets` caught that weakening by demonstrating a forged one-gap slice of a multi-gap underexplored request could materialize.

The implementation was narrowed to K02 Journal-curiosity shape only and the original A00 regression returned to green. A later tightening also rejects imported curiosity records with evidence or dimension fields. This bounded repair is part of the final implementation evidence, not an unresolved defect.

## Journal -> seed bridge

`materializeJournalAdventureSeed` requires:
- active + normal Journal entry;
- exact `curiosityGapId(entry.id)` gap;
- gap kind `curiosity`, status `open`;
- exact one-entry Journal provenance;
- no evidence sources or dimensions;
- a valid targeted K07 request.

It then delegates all durable seed mutation to A00 `materializeAdventureSeed` using generic local game copy such as `An adventure is waiting in <territory>.` The premise uses only the public territory label and never Journal text.

A00 remains responsible for:
- structural seed identity;
- current privacy/eligibility revalidation;
- deduplication;
- gap `open -> seeded` transition;
- durable seed insertion.

Repeated activation is idempotent. A synchronous browser double-click still creates exactly one seed.

## Journal UX

For an active normal Journal entry:
- no curiosity path -> **Explore later**;
- open exact curiosity path -> **Explore this** + **Don't explore this**;
- seeded exact path -> **Adventure ready** + **Don't explore this**;
- retired -> **Not exploring**;
- resolved -> **Explored**.

Private/retracted entries remain unable to enter the path. K06 retirement remains intact after seeding: retiring the seeded gap structurally retires its dependent seed while leaving the Journal entry unchanged.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Journal save alone creates no gap/seed | I00 unit + production browser state | PASS |
| Explore later remains gap-only | production browser before/after state | PASS |
| Explore this targets exact clicked Journal path | two-curiosity unit fixture | PASS |
| Exactly one durable seed is created | unit + double-click browser canary | PASS |
| Seed request remains structurally revalidated | K07 targeted tests + A00 regression suite | PASS |
| Automatic A00 stale-partial protection remains intact | original A00 forged partial regression | PASS after bounded repair |
| Imported/malformed curiosity shape fails closed | I00 negative fixtures | PASS |
| Journal text never enters request/premise | source scan + prose canaries | PASS |
| Private/retracted/retired/resolved paths cannot seed | unit negative fixtures | PASS |
| Gap becomes seeded only after successful materialization | unit + browser persisted state | PASS |
| Adventure ready UI visible after seed | production browser assertion | PASS |
| Don't explore this still retires gap + dependent seed | I00 unit + production browser after reload | PASS |
| No provider call | `/api/turn` browser count remains zero | PASS |
| No XP/progression/worldJourney/AdventureRun mutation | unit + browser protected-state comparisons | PASS |
| Seed persists across reload | production browser reload assertion | PASS |
| 390px Journal remains overflow-safe / controls >=44px | I00 browser assertions | PASS |
| Existing K06 retirement journey preserved | K06 browser 1/1 | PASS |
| Existing Journal foundation preserved | Journal browser 4/4 incl. 320/390px | PASS |
| No TTS or real-user fixture data | final scans | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- Focused K07/A00/I00/K06/Journal domain bundle after repair — **58/58 PASS across 5 files**.
- Final targeted A00/I00/K07 hardening gate — **23/23 PASS across 3 files**.
- Full unit suite after final tightening — **456/456 PASS across 54 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-i00-final-wrangler.log npm run build -- --configLoader runner` — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `tests/browser/journal-seed-integration.test.ts` — **1/1 PASS** against the final production bundle.
- `tests/browser/knowledge-retirement.test.ts` — **1/1 PASS** after I00 UI wiring.
- `tests/browser/journal-foundation.test.ts` — **4/4 PASS**, including 320/390px no-overflow.
- `git diff --check` / cached diff check — **PASS**.
- Final scans found no Journal prose reads in the bridge, no provider/progression/world mutation path, no TTS APIs, no real-person fixture material and no automatic production caller other than the explicit Journal handler.

## Boundaries / next dependency state

- I00 is complete and `MERGE_READY` locally.
- I01 becomes READY after integration: combine the already-derived W02 marker state with an actual world-visible marker/contact path and A01 Adventure start in the real browser.
- I00 does not render the W02 marker, move Greyson to it, start an AdventureRun, submit Adventure actions, call a provider, enter combat or perform Reflection/evidence conversion.

## Merge boundary

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
