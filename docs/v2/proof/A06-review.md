# Independent review — A06 local fallback Adventure renderer

- **Base SHA:** `38700ac840591966d3bcc4a68034b6c4ff70110d`
- **Implementation commit:** `dc6623460a24e9ee0801128e2cd3d4b0c86fcadf`
- **Branch:** `feat/v2-adventure-fallback`
- **Worktree:** `/Users/andrew/AtlasOfOne-adventure-fallback`
- **Implementation source:** preserved uncommitted A06 lane draft present when this continuation pass began; original draft author was not established in this pass
- **Independent review / validation:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

A06 provides one deterministic, generic, no-provider Adventure fallback renderer over the already-merged A01/A03 state machine. It maps the current validated six-beat role to fixed local presentation copy and exposes one minimal production-bundle world-screen rendering path while provider inference is disabled or the app is offline.

Changed files:
- `src/App.tsx` — minimal read-only world-screen fallback wiring
- `src/adventure/fallback.ts`
- `src/adventure/FallbackAdventureCard.tsx`
- `src/adventure/FallbackAdventureCard.css`
- `tests/adventure/fallback.test.ts`
- `tests/browser/adventure-fallback.test.ts`

No contracts, game engine/events, seeds/runs/runtime authority, persistence, provider implementation, Knowledge/Reflection, combat, dependencies, canonical docs, or assets changed in the implementation commit.

## Deterministic local fallback

`LOCAL_FALLBACK_ADVENTURE_TEMPLATE` is one deliberately generic investigation template that validates against the A03 exact six-role contract:

`hook -> approach -> complication -> encounter -> choice -> consequence`

The renderer:
- validates the template before use;
- requires the requested run to be the unique active A01 run;
- requires its seed to remain `started`;
- requires seed/template kind + learning-target compatibility;
- requires territory and logical-location consistency;
- requires the run's current beat ID to exist in the template;
- returns fixed role-based local copy, three bounded approach suggestions and a terminal flag;
- returns `null` for pending, missing, incompatible, completed or invalid-template state;
- is read-only and deterministic for identical state/template/beat input.

The fallback does not advance a beat, complete/withdraw a run, create actions or observations, call combat, award progression or produce Reflection/evidence. A03/A01 remain the only authorities for their state transitions; A02/A05 own later action/observation and withdrawal behavior.

## Privacy / human-authority boundary

Fallback rendering intentionally does not read or emit:
- Journal text;
- evidence claims;
- Knowledge-gap summaries;
- seed premise prose;
- Reflection text;
- private source material.

The visible copy is fixed generic game copy. It explicitly states that a fictional choice is not evidence about the player. No model/provider or semantic classifier participates.

## User-facing path

When the app is on the world screen and an A03-compatible active Adventure exists, `App.tsx` renders the fallback card only when:
- the app is offline; or
- the configured provider is `disabled`.

The card is ordinary document flow, not a fixed/absolute/pointer-blocking overlay. It contains no new state-changing controls; later action submission belongs to A04 and fallback continuation orchestration belongs to P10/A06-adjacent work.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Deterministic bounded output for all six canonical beat roles | A06 unit traversal fixture | PASS |
| Same state/template/beat yields identical output | pure replay fixture | PASS |
| No Journal/evidence/Knowledge/private/premise prose emitted | unit canaries + source scan + browser canaries | PASS |
| No provider/network call required | production-bundle `/api/turn` count remains zero | PASS |
| Rendering is read-only | unit structural equality + browser persisted state equality | PASS |
| Invalid/incompatible/pending/completed state fails closed | focused negative fixtures | PASS |
| Consequence is honestly terminal presentation only | six-beat fixture | PASS |
| Production bundle can display fallback while offline/provider-disabled | A06 browser canary | PASS |
| Fallback survives reload without mutation | A06 browser reload assertion | PASS |
| Mobile world path remains usable | A06 390px no-overflow + existing journey mobile checks | PASS |
| Protected Worldwalker journey remains intact | `journey.test.ts` 18/18 | PASS |
| No AdventureAction/Observation/A05/combat/reflection/progression authority | diff/source scans | PASS |
| TTS remains absent | final source/test scan | PASS |
| Synthetic fixture data only | real-data canary scan | PASS |

## Validation

- `git diff --check` / cached diff check — **PASS**.
- `npx tsc --noEmit` — **PASS**.
- Focused Adventure stack (`fallback`, `runtime`, `runs`, `seeds`) — **26/26 PASS**.
- Full unit suite — **437/437 PASS across 51 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-a06-wrangler.log npm run build -- --configLoader runner` — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `tests/browser/adventure-fallback.test.ts` — **1/1 PASS** against the production bundle.
- `tests/browser/journey.test.ts` — **18/18 PASS**, including reload/export/import and phone-width usability.
- Final scope/privacy/provider/mutation/TTS/real-data/pointer-overlay scans — **PASS**.
- Implementation commit contains exactly the six authorized A06 files.

### Baseline-stale `overworld-verbs` suite

An additional, non-mandatory `tests/browser/overworld-verbs.test.ts` run failed **7/10** on the A06 worktree. The exact same suite, after a fresh build of untouched integration base `38700ac`, also failed **7/10** with the same root signature.

The first failure expects the legacy prompted Talk behavior (`prompt-question`) after opening the conversation surface. Current product authority intentionally makes Journal the primary blank input surface, so that assertion is stale. Because the suite reuses one browser page and the failed test exits before its cleanup, the Journal overlay remains open and intercepts later map clicks, cascading the remaining failures. This is a pre-existing stale regression suite, not an A06 collateral regression. A06 does not modify `tests/browser/overworld-verbs.test.ts` or the Journal interaction path.

The preserved core Worldwalker `journey.test.ts` passed **18/18** on the A06 production bundle, so the project-purpose user path remains verified within A06's impact radius.

## Boundaries / next dependency state

- A06 is complete and `MERGE_READY` locally.
- P10 may later consume this fallback after its provider/adventure-scene dependencies exist.
- A06 does not implement A02 action/observation recording, A05 withdrawal, A09 pure-fun seed generation, W01/W02 markers, P03/P05 provider adventure scenes, combat or Reflection handoff.
- `overworld-verbs.test.ts` should be reconciled with the Journal-first product behavior in a separate QA/test-maintenance packet rather than changed inside A06.

## Merge boundary

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
