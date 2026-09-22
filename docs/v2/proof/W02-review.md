# Independent review — W02 deterministic available-seed world marker state

- **Base SHA:** `b5b47962422d4dcb205464c4bffffca0ca8e5015`
- **Implementation commit:** `a3b212f83bd42cdf974ee6f0264cf7436d5939c2`
- **Branch:** `feat/v2-world-seed-markers`
- **Worktree:** `/Users/andrew/AtlasOfOne-world-seed-markers`
- **Implementation / independent review:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

W02 adds a pure derived world-marker-state selector over A00's existing `selectAvailableAdventureSeeds` authority and the W01 public marker contract. It does not persist a marker table, alter seed/run state, start Adventures, render or interact with markers in App/WorldMap, or call a provider.

Changed files:
- `src/world/adventureMarkers.ts`
- `tests/world/adventureMarkers.test.ts`

No App, game engine, AdventureSeed implementation, Knowledge/Reflection, persistence, provider, combat, dependency, canonical state or asset files changed in the implementation commit.

## Derived marker state

`selectAdventureWorldMarkers(state)`:
- consumes only A00's sorted/private-safe/unused `selectAvailableAdventureSeeds` result;
- skips imported seeds whose territory is not canonical geography;
- maps ordinary Adventure kinds through W01 to public `adventure` and pure-fun to `pure-fun`;
- compiles marker identity/label/glyph/accessibility through the W01 allowlisted render model;
- adds only `seedId`, canonical `territoryId` and derived `x/y` coordinates;
- never emits seed premise, source gap IDs, Knowledge summary/priority/evidence, Journal text, private topic data or status internals.

The view is recomputed from authoritative local state and is never persisted separately.

## Deterministic placement

Markers anchor around each territory's canonical geography `stand` point. Same-territory markers receive deterministic golden-angle slots with bounded margins inside the world coordinate rectangle. The A00 selector sorts seed IDs first, so source array ordering cannot change marker order or coordinates.

Marker placement never mutates `AdventureSeed.locationId`, `CampaignState.worldJourney`, seed status, Knowledge state or progression. Invalid/unknown territory imports fail closed by producing no marker.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Only A00-selected available/private-safe/unused seeds become markers | mixed-status/private/used fixture | PASS |
| Started/retired/used/private-ineligible seeds excluded | mixed-status fixture | PASS |
| Unknown territory fails closed | imported unknown-territory fixture | PASS |
| Ordinary Adventure kinds stay generic | investigation + mystery fixtures | PASS |
| Pure-fun remains distinct | source-less pure-fun fixture | PASS |
| Premise/source-gap/Knowledge/Journal/private prose excluded | serialization canaries | PASS |
| Marker identity deterministic | W01 ID assertion | PASS |
| Coordinates deterministic across source ordering | reversed-input equality fixture | PASS |
| Same-territory marker coordinates non-identical and bounded | four-seed coordinate fixture | PASS |
| Input CampaignState remains unchanged | deep structural equality fixture | PASS |
| No separate persisted marker authority | output-shape fixture + source scan | PASS |
| No provider/progression/TTS/real-user data | final source/test scans | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- W02 focused marker-state suite — **6/6 PASS**.
- Seed/privacy/world impact bundle (`W02`, `W01`, A00 seeds, RF09 privacy, Knowledge gaps) — **61/61 PASS across 5 files**.
- Full unit suite — **449/449 PASS across 53 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-w02-wrangler.log npm run build -- --configLoader runner` — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` / cached diff check — **PASS**.
- Implementation commit contains exactly the two authorized World lane files.
- Final scans found no premise/source-gap/Knowledge/Journal field reads, CampaignState mutation, provider/network call, progression authority, TTS API or real-person fixture data.
- One initial test assertion incorrectly expected W01 IDs to URL-encode the source ID. Production code was unchanged; the test was corrected to compare against W01's actual length-prefixed `worldMarkerId` contract, after which the suite passed.
- Browser proof is deferred: W02 creates derived marker state only. I00/I01/W03 own the player-visible seed-to-marker/start journey.

## Boundaries / next dependency state

- W02 is complete and `MERGE_READY` locally.
- The next visible-loop blocker is I00 (Journal/Gap -> durable seed) before I01 can prove Seed -> World marker -> Adventure start in the real browser.
- W02 does not render a live marker, attach an interaction target, start A01, persist placement, or add provider/world consequence behavior.

## Merge boundary

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
