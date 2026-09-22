# Independent review — W01 Worldwalker marker taxonomy and icon contract

- **Base SHA:** `c09ad07e5224f72330b28fce098da0c201f17ed7`
- **Implementation commit:** `13f6c777e005329a0d980f30a287b25b0d9d39ee`
- **Branch:** `feat/v2-world-marker-render`
- **Worktree:** `/Users/andrew/AtlasOfOne-world-marker-render`
- **Implementation / independent review:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local v2 integration only. No push, deployment, or `main` merge authorized.

## Scope

W01 adds a category-only Worldwalker marker taxonomy, stable icon/glyph contract, deterministic marker identity, and a reusable semantic icon primitive. It intentionally does **not** place any new marker in the world, read CampaignState, mutate world state, or connect AdventureSeed availability to the map. Those responsibilities remain W02/W03.

Changed files:
- `src/world/markers.tsx`
- `tests/world/markers.test.ts`

No App, game engine, CampaignState, Adventure, Knowledge, Reflection, persistence, provider, combat, dependency, canonical state, or asset files changed in the implementation commit.

## Public marker taxonomy

The frozen W01 public categories are:
- `adventure` — Adventure / `◆`
- `journal-shrine` — Journal / `▤`
- `npc-conversation` — Conversation / `◌`
- `encounter` — Encounter / `!`
- `mystery-door` — Mystery Door / `◇`
- `boss-arena` — Boss / `▲`
- `memory` — Memory / `⌁`
- `discovery` — Discovery / `✧`
- `sanctuary` — Sanctuary / `⌂`
- `pure-fun` — Just for fun / `★`

Every category has a unique text glyph and accessible name. Meaning is therefore never color-only, and no color token is part of the contract.

## Hidden-analysis firewall

W01 deliberately refuses to turn the internal Adventure/Knowledge reason into a world label.

`markerKindForAdventureKind` maps:
- every ordinary/reflection-eligible `AdventureKind` -> `adventure`;
- only `pure-fun-wildcard` -> `pure-fun`.

That means a contradiction-routed `mystery-puzzle`, an underexplored-routed `investigation`, and any other analysis-linked Adventure all look simply like **Adventure** in the public marker layer. The map cannot reveal whether Atlas noticed a contradiction, underexplored dimension, change over time, curiosity source, priority, trait target, or private topic.

Imported/untrusted render input is compiled through an allowlisted `{kind, sourceId}` shape. Extra fields such as gap kind, priority, hidden summary, evidence claim, private dimension or trait target are ignored and cannot appear in the render model or markup.

## Stable identity and legacy semantics

`worldMarkerId` uses a length-prefixed collision-safe structural identity over public marker kind + stable local source ID. Blank source IDs fail closed.

Existing public Worldwalker interactable meanings map without altering current runtime behavior:
- landmark -> sanctuary
- Mystery Door -> mystery-door
- boss -> boss-arena
- waystone / prop -> discovery
- exit -> no marker category

No existing map/Canvas marker was replaced in W01; this is only the reusable contract later placement lanes can consume.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Finite deterministic marker taxonomy | exact 10-kind fixture | PASS |
| Stable unique category IDs/labels/glyphs | uniqueness fixture | PASS |
| Non-color marker identity | unique glyphs + no color property/style | PASS |
| Explicit semantic/accessibility labels | definition + static-render markup fixture | PASS |
| Ordinary Adventures hide analytic routing | all 14 AdventureKind routing fixture | PASS |
| Pure-fun path remains visibly distinct | pure-fun routing + render fixture | PASS |
| Hidden Knowledge/private/prose fields cannot leak | imported-object canary fixture | PASS |
| Unknown/malformed marker kind/source fails closed | negative fixtures | PASS |
| Stable collision-safe instance IDs | collision fixture | PASS |
| Existing landmark/door/boss/waystone semantics remain distinct | interactable mapping fixture | PASS |
| Render model is deterministic/read-only | replay + structural equality fixture | PASS |
| No CampaignState/world placement/provider/progression mutation | source/diff scan | PASS |
| No TTS or real-user fixture content | final scans | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- W01 focused marker suite — **6/6 PASS**.
- World semantic impact bundle (`markers`, `playerController`, `sanctuaries`, `interiors`, `props`) — **26/26 PASS across 5 files**.
- Full unit suite — **443/443 PASS across 52 files**.
- `WRANGLER_LOG_PATH=/tmp/atlas-w01-wrangler.log npm run build -- --configLoader runner` — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` / cached diff check — **PASS**.
- Implementation commit contains exactly the two authorized World lane files.
- Source scans found no CampaignState import, provider/network call, game/progression mutation, TTS API, real-person fixture material, or runtime analytic field exposure. The only analytic terms in production source are the comments that forbid exposing them.
- No browser proof was required because W01 does not place a live marker; W02/W03 own live world-state/browser proof.

## Boundaries / next dependency state

- W01 is complete and `MERGE_READY` locally.
- W02 becomes the next critical-path packet after integration: deterministically place eligible available AdventureSeed state into public world marker state using this category-only contract.
- W03/W09/CT08 are also dependency-unblocked by W01 but remain separate packets.
- W01 does not implement seed placement, encounter contacts, map persistence, Adventure start, provider narrative, or world consequences.

## Merge boundary

This receipt authorizes only a fast-forward into local `integration/atlas-v2-journal-adventure-combat` after machine/repo/branch/dirty-state/ancestry verification and post-integration validation. It does not authorize push, deployment, or merge to `main`.
