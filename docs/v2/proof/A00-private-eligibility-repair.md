# A00 follow-up repair — private-dimension seed availability

- **Parent state SHA:** `b5aab5ec7f6993202c92f44c3b3192af325244b7`
- **Repair commit:** `fd2b3ce34e2fe096571df0748d91075eca7f71b3`
- **Branch:** `feat/v2-adventure-runs`
- **Worktree:** `/Users/andrew/AtlasOfOne-adventure-runs`
- **Discovered by:** A01 private-source start canary
- **Implementation / review:** GPT-5.6 Sol
- **Verdict:** required predecessor repair; independently validated before A01 acceptance

## Defect

A01's first lifecycle run proved a real A00 availability gap: an `AdventureSeed` backed only by a Knowledge gap whose dimension had subsequently become PRIVATE could still appear in `selectAvailableAdventureSeeds` and therefore could be started.

The generic v2 provenance-retirement layer correctly handles source-ID eligibility, but source-less/passive Knowledge gaps intentionally remain structurally supported there. K05's actual Knowledge selector adds a separate defense-in-depth rule: gaps whose `dimensionIds` include a private dimension are not selectable. A00's available-seed view had not composed that rule.

## Repair

`selectAvailableAdventureSeeds` now also derives the current private-safe gap-ID set through:

`selectKnowledgeGaps(state, { includeNonOpen: true })`

A gap-backed seed is available only if at least one `sourceGapId` is still private-safe. This preserves the existing any-eligible-support semantics for mixed-support seeds.

Source-less seeds remain eligible by design so future A09 pure-fun adventures (`sourceGapIds: []`, `learningTarget: 'none'`) are not accidentally blocked by the repair.

No seed record is deleted or rewritten by this selector repair. It is a read-only eligibility boundary.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Private-only gap-backed seed is unavailable | dedicated A00 selector fixture | PASS |
| Mixed private + safe support remains eligible | dedicated A00 selector fixture | PASS |
| Source-less pure-fun seed remains eligible | dedicated A00 selector fixture | PASS |
| Existing Knowledge private-dimension rule reused, not duplicated semantically | source inspection | PASS |
| No provider/progression/world/UI authority added | two-file diff inspection | PASS |
| No real-user fixture data | fixture scan | PASS |

## Validation

- A00 + Knowledge + RF09 privacy focused repair bundle — **49/49 PASS**.
- A00 + A01 focused after repair — **15/15 PASS**.
- A01 impact bundle after repair — **80/80 PASS**.
- Full suite on the repaired A01 branch — **426/426 PASS across 49 files**.
- Production build — **PASS**.

## Scope

Repair commit changes only:
- `src/adventure/seeds.ts`
- `tests/adventure/seeds.test.ts`

No contracts, persistence, provider, UI, world, combat, game engine, dependencies, or canonical state files changed in the repair commit.
