# Atlas of One — Master Build Plan

This file is the compact execution map. The controlling detail lives in `docs/MASTER_INTEGRATION_PLAN.md`.

## Product direction

Atlas is now a journaling-first adventure game.

```text
JOURNAL
-> notice interest / uncertainty / change / contradiction
-> optional adventure
-> Worldwalker
-> encounter
-> consequence
-> optional reflection
-> Greyson confirms / revises / rejects / leaves uncertain
-> Atlas changes
-> world remembers
```

Fictional behavior is never automatically evidence about Greyson.

Text-to-speech is removed. Optional speech-to-text input may remain.

Terminal Final Assessment semantics are replaced by dated, revisable Atlas Snapshots.

## Execution rule

**Parallel cognition, controlled integration.**

`main` is a release surface because Workers Builds auto-deploys it.

Use the v2 integration branch and bounded lane branches/worktrees. Freeze shared interfaces before high parallelism. Every consequential packet requires proof; high-risk work requires meaningful independent review.

## Phase 0 — Authority correction, TTS removal, safe parallelization

Goal: make the repository describe the product we are actually building.

Deliver:

- adopt `docs/MASTER_INTEGRATION_PLAN.md`;
- update `AGENTS.md` authority order;
- reconcile PRODUCT_SPEC / ARCHITECTURE / GAME_SYSTEM / MODEL_CONTRACT / ACCEPTANCE / this file / OPERATIONAL_STATE;
- remove TTS runtime/UI/tests;
- preserve STT input only;
- behavior-preserving App/domain extraction;
- freeze shared schema-v2 interfaces and lane ownership.

Gate:

- no canonical document requires assistant TTS;
- no production runtime TTS path;
- existing Worldwalker movement, persistence, privacy, encounters, STT input, export/import, and agency controls remain intact;
- full baseline tests/build green.

## Phase 1 — Schema v2 and Journal foundation

Goal: make Atlas a real journal before making every entry an adventure.

Deliver:

- schema v2 migration;
- JournalEntry persistence/export/import;
- blank Journal composer reachable without a prompt;
- typed and speech-to-text input;
- PRIVATE and retraction;
- journal response that may end without another question;
- legacy turn preservation.

Gate:

- create/save/reload/export/import/private/retract Journal entry;
- no prompt required;
- private/retracted journal text cannot reach provider context;
- v1 synthetic export imports without loss.

## Phase 2 — Adventure and Combat foundations in parallel

### Adventure

- KnowledgeGap and AdventureSeed state;
- AdventureRun/actions/observations;
- three first templates: investigation, social dilemma, pure fun;
- local fallback scene path;
- mid-adventure persistence.

### Combat

- CombatDefinition/CombatState reducer;
- ATTACK / TECHNIQUE / GUARD / ACT / LEAVE;
- five MVP objectives;
- five MVP gimmicks;
- deterministic enemy intent;
- optional timed hooks;
- fail-forward outcomes;
- mid-combat persistence;
- model-authority firewall.

Gate:

- Adventure completes with local/mock content;
- Combat completes without model authority;
- reload works in both;
- roleplay/combat action alone cannot become confirmed evidence.

## Phase 3 — First complete journaling-adventure vertical slice

Required browser journey:

1. save synthetic Journal entry;
2. detect deterministic eligible gap/curiosity;
3. create **Explore this** AdventureSeed;
4. show marker in Worldwalker;
5. physically travel to marker;
6. begin adventure;
7. natural-language scene plus visible Combat/ACT encounter;
8. resolve encounter by more than one possible method;
9. record consequence + observation;
10. offer Reflection;
11. reject first interpretation;
12. preserve rejection;
13. second explicit Reflection supports evidence;
14. Atlas/Vault updates;
15. reload preserves state;
16. export/delete/import preserves state.

No Workers AI dependency for this gate.

## Phase 4 — Memory, contradictions, and Atlas Snapshots

Deliver:

- AdventureMemory;
- compact adventure summaries;
- contradiction creation in normal play;
- change-over-time detection;
- full Reflection outcomes;
- Snapshot records/history;
- migration of legacy FinalAssessment into history;
- deterministic first/later Snapshot eligibility;
- "what changed since last Snapshot".

Gate:

- recurring NPC references prior synthetic adventure;
- private/retracted source retires derived memory;
- rejected interpretation does not reappear as truth;
- contradictions remain inspectable history;
- two Snapshots coexist.

## Phase 5 — Asset and content scale-up

Parallel production:

- Greyson combat animation expansion;
- 16 ordinary creature families;
- 8 anchor NPCs, then broader recurring slots;
- elite/Boss art where justified;
- territory encounter/story backdrops;
- VFX/UI icon bank;
- compact/procedural combat audio;
- 12 adventure templates;
- 30 deterministic encounter definitions;
- Reflection prompt library;
- pure-fun content bank.

Runtime switches from v3 to v4 only after manifest/provenance/integrity/continuity approval.

## Phase 6 — Bosses, Mystery Doors, world consequences

Evolve existing special encounters into the new adventure grammar without surrendering deterministic authority.

Boss shape:

`setup -> conflict -> combat/social phase -> complication -> choice -> final phase -> reflection`

Mystery Doors become cross-region story events.

Both remain optional, non-trapping, privacy-safe, and deterministic.

## Phase 7 — Whole-product hardening

Required:

- 320/390/430 mobile widths;
- tablet;
- Safari/iPhone when available;
- Android/Chrome when available;
- keyboard/touch;
- reduced motion;
- offline/local data access;
- provider failure states;
- import/export migration torture;
- microphone cancellation;
- double-submit race protection;
- save/reload during every major mode;
- PRIVATE/retraction propagation;
- long-campaign context budgets;
- no-TTS scan;
- secret/private-data scan;
- asset integrity scan;
- clean reproducible build.

Terminal synthetic journey:

```text
wake
-> onboard
-> journal
-> seed
-> walk
-> adventure
-> combat/ACT
-> consequence
-> reflection rejection
-> reflection confirmation
-> Atlas update
-> second adventure remembers first
-> contradiction/change
-> Snapshot
-> export
-> delete
-> import
-> reload
```

## Phase 8 — Greyson pilot and product closure

Observe product behavior without storing private content in development systems.

Ask:

- Does Greyson journal naturally?
- Does he understand Worldwalker?
- Does he follow adventure markers?
- Is combat fun?
- Does Reflection feel respectful?
- Does he correct Atlas?
- Does Atlas remember correction?
- Does the world feel personal without invasive analysis?
- Does he want to come back?

Real friction becomes a bounded next revision. It does not justify reopening the entire architecture by default.

## Cut line

Do not add in this integration cycle:

- native wrapper;
- account system;
- cloud campaign database;
- analytics;
- vector DB;
- multiplayer;
- social sharing;
- paid TTS;
- 3D replacement world;
- runtime AI image generation;
- grind/loot/gacha systems.

## Zero-dollar rule

The app may stop or degrade AI functionality when quota is exhausted.

It may not silently create cost.
