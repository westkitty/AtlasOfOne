# Independent review — I01 Seed -> World marker -> Adventure start

- **Base SHA:** `ef59019e0ad9eb2c1f59c676b35a7afb47f3bdfd`
- **Implementation commit:** `320fc9264df31b7bc5ae2bb177a090858e31191b`
- **Branch:** `feat/v2-world-adventure-start`
- **Worktree:** `/Users/andrew/AtlasOfOne-world-adventure-start`
- **Implementation / independent review:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY`, then fast-forwarded locally into `integration/atlas-v2-journal-adventure-combat`. No push, deployment, or `main` merge authorized or performed.

## Scope

I01 closes the visible start gap between the already-integrated I00/W02/A01/A03/A06 pieces:

1. an explicit Journal `Explore this` path creates one available AdventureSeed;
2. W02 derives a public, privacy-safe marker coordinate;
3. Worldwalker renders that marker using the W01 generic Adventure icon contract;
4. Greyson must physically enter the normal interaction radius;
5. the existing `[A]` interaction changes to `Start` only while nearby;
6. explicit activation starts exactly one A01 AdventureRun and enters the A03 hook;
7. the W02 marker disappears because the seed is no longer available;
8. in provider-disabled/offline mode the existing A06 local hook renders.

No Adventure action submission, combat, consequence/observation creation, Reflection, evidence conversion, provider Adventure proposal, reward or world-consequence persistence is added here.

## Changed implementation surfaces

- `src/App.tsx` — derives W02 markers, passes them to Worldwalker, and composes explicit marker activation through A01 + A03.
- `src/world/WorldwalkerPanel.tsx` — forwards public Adventure marker state.
- `src/world/WorldMap.tsx` — renders public markers and includes them in normal proximity resolution.
- `src/world/playerController.ts` — accepts read-only external interactables through the existing interaction-radius resolver.
- `src/world/TouchControls.tsx` — labels nearby Adventure interaction `Start`.
- `src/styles.css` — small pointer-transparent marker presentation with reduced-motion-safe transition removal.
- `src/adventure/fallback.ts` — narrow compatibility adapter so the existing generic six-beat local fallback can enter an already-authoritative reflection-eligible seed kind without rewriting seed identity or provenance.
- focused Adventure/World unit tests plus `tests/browser/world-adventure-start.test.ts`.

No dependency, package manifest, persistence schema, game engine event, provider schema, worker route, asset, combat or Reflection implementation changed.

## Physical interaction authority

Adventure markers are not buttons layered over the world. W02 coordinates are mapped into the same WorldMap coordinate space as Greyson. The marker is pointer-transparent and becomes an `adventure` interactable only through the existing `findNearbyInteractable` distance calculation.

Rendering a marker starts nothing. The browser proof confirms `adventureRuns` remains empty until Greyson reaches the marker and explicitly activates the normal interaction control. A synchronous double activation still creates only one active run because A01 remains the lifecycle authority.

When marker state appears or disappears while Greyson is stationary, WorldMap recomputes nearby-target state so the `[A]` verb cannot remain stale until the next movement frame.

## Privacy / human-authority boundary

The rendered Worldwalker surface receives only the W02 public marker projection:

- generic W01 marker kind;
- seed ID as stable interaction identity;
- territory/public coordinate data;
- generic accessible label.

It never reads or renders Journal text, seed premise, Knowledge summary, gap priority, evidence claims, private topics, trait labels or personality interpretation. The production-browser canary carries a synthetic Journal prose canary and asserts that neither it nor the seed premise appears in the world or fallback surface.

Starting the Adventure changes only the authoritative Adventure lifecycle state expected from A01/A03. The browser proof holds XP, level, turns, evidence, reflections, contradictions, worldJourney, Boss runs and Door runs fixed across start. `/api/turn` remains at zero.

## A06 compatibility adapter

I00 currently produces an `exploration-expedition` seed while A06 was originally authored as one `investigation` fallback template. A03 correctly refuses kind-mismatched entry, so the unadapted pieces could not form the I01 local vertical.

`localFallbackTemplateForSeed` keeps the existing fixed six-beat structure and copy while mechanically matching the already-authoritative reflection-eligible seed kind. It does **not** change:

- seed ID;
- seed kind;
- source gap IDs;
- premise;
- territory/location;
- learning target;
- AdventureRun identity;
- provider or game authority.

`learningTarget: none` fails closed. Existing explicit-template mismatch behavior remains tested.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Only W02-selected available markers render | W02 selector unchanged + I01 browser seed/marker lifecycle | PASS |
| Marker uses W01-safe public semantics | marker icon/ARIA assertions + source scan | PASS |
| Hidden Journal/Knowledge/private rationale never renders | prose canaries + boundary scan | PASS |
| Marker is physically reachable through existing controller | player-controller unit + real D-pad browser journey | PASS |
| Seed existence/rendering alone starts no run | browser persisted state before contact | PASS |
| Explicit nearby activation required | `[A] Start` appears only after movement into radius | PASS |
| Double activation creates at most one run | same-task double activation browser assertion | PASS |
| Started seed leaves available-marker state | marker disappears after start and after reload | PASS |
| A03 hook is entered | persisted `currentBeatId` + A06 hook render | PASS |
| No provider call | `/api/turn` count remains zero | PASS |
| No XP/progression/combat/Reflection/evidence mutation | protected-state comparison | PASS |
| Started run survives reload | browser reload assertion | PASS |
| 390px path has no horizontal overflow | browser geometry assertion | PASS |
| Existing A06 fallback preserved | A06 production browser 1/1 | PASS |
| Existing retirement path preserved | K06 production browser 1/1 | PASS |
| Core Worldwalker behavior preserved | `journey.test.ts` 18/18 | PASS |
| No TTS or real-user fixture data introduced | final scans | PASS |

## Validation

- `npx tsc --noEmit` — **PASS** before and after fast-forward integration.
- Focused Adventure/World impact set — **44/44 PASS across 7 files** before and after integration.
- Full unit suite with bounded worker count — **458/458 PASS across 54 files**.
- Initial unconstrained full-unit run — **457/458**, one unrelated 5-second timeout in the 600-turn context-budget test under 54-worker contention; the isolated context file then passed **12/12**, and the bounded-worker full rerun passed **458/458**, so no product repair was made.
- `WRANGLER_LOG_PATH=/tmp/atlas-i01-postmerge-wrangler.log npm run build -- --configLoader runner` — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `tests/browser/world-adventure-start.test.ts` — **1/1 PASS** on candidate and **1/1 PASS post-integration** against the production bundle.
- `tests/browser/adventure-fallback.test.ts` — **1/1 PASS**.
- `tests/browser/knowledge-retirement.test.ts` — **1/1 PASS**.
- `tests/browser/journey.test.ts` — **18/18 PASS**, including map-position reload and narrow-phone usability.
- `git diff --check` and staged diff check — **PASS**.
- Scope/privacy/provider/progression/TTS/real-data scans — **PASS**.

## Baseline-parity test debt discovered

`tests/browser/journal-seed-integration.test.ts` is currently timing-flaky in this environment. On the I01 candidate it failed twice at different IndexedDB polling checkpoints: once after reload retirement and once after the initial `Explore later` transition. A fresh production build of untouched integration base `ef59019` reproduced the same line-62 initial `Explore later` polling timeout.

That evidence does **not** justify a product repair:

- the failure reproduces on untouched base;
- the shorter K06 production-browser path proves Explore-later -> retire -> reload on the I01 build;
- the new I01 browser path itself successfully executes Explore-later -> Explore-this before physical world start;
- I00 domain/unit protections remain green in the 458/458 full unit gate.

Record this as bounded browser-harness/test-runtime debt (`PND-017`), not an I01 regression and not a green I00 browser result.

## Deliberate limitation

A06 is a no-provider/offline fallback. I01 therefore proves the local fallback start journey by stubbing `/api/health` as provider-disabled. Provider-authored Adventure scene proposals are a separate Phase 2A/provider lane and are not silently implemented here. Because this branch is local integration only and not a release candidate, that boundary does not block I01's defined exit evidence.

## Boundary / next dependency state

- I01 is complete and locally integrated.
- I02 is unblocked **only with respect to I01**; its other dependency `C13` still governs whether the Adventure -> Combat/ACT vertical can start.
- A02/A05/A08/A09/N00/CT00 remain independently READY work and were not absorbed into I01.
- No push, `main` merge, deployment, live inference, real Greyson campaign data or private fixture content occurred.
