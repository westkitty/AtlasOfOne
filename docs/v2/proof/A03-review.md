# Independent review — A03 six-beat bounded Adventure runtime skeleton

- **Base SHA:** `e99b740981904ca082770fb28f54598ab9287431`
- **Implementation commit:** `ba5faa4b00d0c951c77f602691350443f0a57842`
- **Branch:** `feat/v2-adventure-runtime`
- **Worktree:** `/Users/andrew/AtlasOfOne-adventure-runtime`
- **Implementation / independent review:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

A03 adds the deterministic six-beat Adventure runtime skeleton against the already-frozen `AdventureTemplate` contract. It validates the mechanical template shape, enters one A01 `pending` run at the hook, advances only one declared adjacent exit at a time, and exposes a read-only consequence-completion handoff check.

Changed files:
- `src/adventure/runtime.ts`
- `tests/adventure/runtime.test.ts`

No contracts, CampaignState types, seeds/runs implementation, game engine/events, persistence, provider, App/UI, World, Combat, Reflection, Knowledge, dependencies, canonical state docs, or assets changed in the implementation commit.

## Six-beat mechanical contract

The A03 gate requires exactly these ordered roles:

`hook -> approach -> complication -> encounter -> choice -> consequence`

A template is accepted only when:
- template ID, cooldown class and listed territory IDs are nonblank;
- kind and learning target are valid frozen-contract values;
- territory IDs, required-input IDs and memory-output IDs are unique;
- exactly six beats exist in the canonical role order;
- every beat has a nonblank unique ID, boolean `required`, at least one valid unique encounter kind, and unique nonblank exit IDs;
- each nonterminal beat has exactly one exit to the immediately following beat;
- the consequence beat has no exits.

This is deliberately the A03 mechanical skeleton. CT00 may later add content-bank/schema governance, but A03 does not introduce prose quality classification or model-authored template semantics.

## Runtime ownership

### Enter

`enterAdventureTemplate` succeeds only when:
- the template passes A03 validation;
- exactly one active AdventureRun exists and matches the requested run ID;
- its seed still exists and is `started`;
- seed kind and learning target match the template;
- the run territory is listed by the template;
- seed/run territory and logical location remain consistent;
- the run is still at A01's neutral `pending` beat.

A successful enter changes only `currentBeatId` to the template hook and `updatedAt`. Repeating the same enter is by-reference idempotent.

### Advance

`advanceAdventureBeat` changes only the active run's `currentBeatId` and aggregate `updatedAt`, and only when the requested target is the current beat's one declared exit.

Skip, backward, unknown, invalid-template and terminal-consequence moves fail closed. Repeating an already-applied target is by-reference idempotent.

### Consequence handoff

`adventureRunReadyForCompletion` is read-only and becomes true only when the compatible active run is on the terminal consequence beat with no exits.

A03 does **not** call A01 completion and never creates `complete` or `withdrawn` state. Later orchestration owns completion; A05 owns withdrawal/fail-forward.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Exactly six canonical ordered roles | template validation fixture | PASS |
| Stable unique beat IDs and deterministic adjacent exits | schema/exit fixtures | PASS |
| Invalid order/duplicate/skip/backward/nonterminal consequence fails closed | malformed-template fixtures | PASS |
| Template compatible with active seed/run kind/territory/learning target | compatibility fixtures | PASS |
| `pending` enters only at hook | enter fixture | PASS |
| Legal transitions follow one declared exit | transition fixture | PASS |
| Repeated identical transition input is idempotent | replay fixture | PASS |
| Skip/backward/unknown transition fails closed | transition negatives | PASS |
| Consequence is terminal and only exposes completion readiness | terminal fixture | PASS |
| A03 does not complete or withdraw runs | terminal fixture + source scan | PASS |
| No AdventureAction/Observation/Memory creation | structural fixture + source scan | PASS |
| No provider/world/combat/reflection/progression authority | source/diff scan | PASS |
| No prose/personality/diagnostic classification | source/test scan | PASS |
| Existing A00/A01/K07/v2 persistence behavior preserved | impact bundle | PASS |
| No TTS or real-user fixture data | final scans | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- A03 focused suite — **7/7 PASS**.
- Adventure/K07/contracts/persistence impact bundle — **53/53 PASS across 7 files**.
- Full unit suite — **433/433 PASS across 50 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-a03-wrangler.log npm run build -- --configLoader runner` — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` / cached diff check — **PASS**.
- Implementation commit contains exactly the two authorized Adventure runtime files.
- Source scans found no provider calls, GameEvents, completion/withdrawal mutation, AdventureAction/Observation/Memory creation, world/combat/provider imports, narrative/premise/personality analysis, TTS APIs, or real-person fixture material.
- Browser proof is not required: A03 is a domain-only mechanical runtime packet with no user-facing surface yet.

## Boundaries / next dependency state

- A03 is complete and `MERGE_READY` locally.
- A06 local fallback template, CT00 AdventureTemplate content-schema work, and I02 time-boxed input adapter become dependency-ready after integration.
- A04 remains blocked on P05 despite A03 completion.
- A05/A08/A09/N00/W01 remain separately READY from prior gates.
- A03 does not implement A02 actions, A05 withdrawal, A06 content, provider narrative, world placement, combat, or reflection.

## Merge boundary

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
