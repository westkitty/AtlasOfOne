# Atlas of One — Architecture

## Locked shape

One mobile-first React + TypeScript + Vite PWA with one same-origin Cloudflare Worker boundary.

```text
Greyson
  |
  +--> Journal Input -----------------------------+
  |                                               |
  +--> World / Adventure Actions -----------------|----> Local authoritative state
  |                                               |       |
  +--> Combat Commands ---------------------------+       +--> deterministic game engine
                                                          +--> deterministic combat engine
                                                          +--> deterministic seed eligibility
                                                          +--> deterministic privacy/provenance
                                                          +--> IndexedDB persistence
                                                         |
                                                         v
                                                 Bounded Context Compiler
                                                         |
                                                         v
                                                 Model Proposal Boundary
                                                         |
                         +-------------------------------+-------------------------------+
                         |                               |                               |
                  journal response                adventure scene                reflection proposal
                         |                               |                               |
                         +-------------------------------+-------------------------------+
                                                         |
                                                 Typed validation only
                                                         |
                                                         v
                                            candidate language / evidence
                                                         |
                                                         v
                                         Greyson confirmation where required
                                                         |
                                                         v
                                             Atlas / world consequences
```

The model is never a second game engine.

## Authority

### TypeScript owns

- progression;
- world state;
- combat state and outcomes;
- persistence and migrations;
- privacy/retraction propagation;
- seed eligibility;
- Snapshot eligibility;
- import/export/delete;
- deterministic rewards and unlocks.

### Model may propose

- journal responses;
- dialogue;
- scene prose;
- adventure scene candidates;
- reflection wording;
- hypotheses;
- candidate evidence;
- Snapshot prose.

All model output crosses typed validation before any proposal can affect local state.

## Domain structure

Target module boundaries:

```text
src/
  journal/
  reflection/
  knowledge/
  adventure/
  combat/
  atlas/
  world/
  cartographer/
  game/
  persistence/
  voice/       # speech-to-text input only
```

`src/App.tsx` is orchestration, not the permanent home of every domain.

## Schema v2

The first durable Journal/Adventure integration raises the campaign schema to version 2.

New first-class concepts include:

- `JournalEntry`
- `KnowledgeGap`
- `AdventureSeed`
- `AdventureRun`
- `AdventureAction`
- `AdventureObservation`
- `ReflectionRecord`
- `AdventureMemory`
- `AtlasSnapshot`

Migration preserves:

- legacy turns;
- existing evidence;
- Boss/Mystery state;
- worldJourney;
- settings;
- historical FinalAssessment content, migrated into snapshot history rather than discarded.

## Local persistence

IndexedDB remains authoritative local persistence.

Requirements:

- automatic save after authoritative state transitions;
- deterministic migrations;
- export/import/delete;
- mid-adventure save/reload;
- mid-combat save/reload;
- provenance-based retirement of derived state after PRIVATE/retraction;
- no server campaign database.

## Context compiler

Provider context remains bounded and mode-specific.

Typed modes include:

- Journal
- Reflection
- Adventure
- World interaction
- Combat narration
- Boss synthesis
- Mystery Door
- Snapshot
- Pure fun

Context assembly uses only eligible local state and fixed budgets. It must not grow without bound with campaign age.

PRIVATE and retracted material is excluded structurally while the payload is built. Only safe labels/retirement metadata may travel when needed to prevent re-prompting.

No embeddings or vector database are required.

## Adventure memory

Use local bounded memory layers:

1. compact adventure summaries;
2. triggered memory cards for relevant characters, places, events, relationships, promises, and objects.

Retrieval is deterministic by entity/tag/recency/relevance rules, not cloud vector search.

## Worker boundary

The Worker remains same-origin and thin.

Expected routes may include:

- `/api/health`
- `/api/turn` or mode-discriminated successor
- `/api/transcribe`
- compatibility path for former `/api/finalize`, reframed toward Snapshot synthesis

Provider failure must never corrupt local state.

No provider or model configuration belongs in `src/game/`.

## Speech-to-text only

Voice output is removed.

Allowed:

- `getUserMedia`
- `MediaRecorder`
- local amplitude/silence detection
- microphone visualizer
- `/api/transcribe`
- editable transcript insertion
- typed fallback
- local agency-command interception where useful

Forbidden in the current architecture:

- `window.speechSynthesis`
- `SpeechSynthesisUtterance`
- voice picker UI
- TTS provider/model/cache
- assistant `speaking` lifecycle
- automatic mic restart after assistant output

Target microphone lifecycle:

`idle -> requesting-permission -> listening -> transcribing -> idle/error`

Provider "thinking" state belongs to request/UI state, not microphone state.

## Combat architecture

Combat is a deterministic sub-engine.

It owns:

- HP;
- damage;
- technique costs/cooldowns;
- statuses;
- turn order;
- deterministic enemy intent;
- objective progress;
- resolution;
- rewards;
- persistence.

The model may skin narration and ACT wording but cannot author authoritative HP changes, rewards, success flags, or turn order.

Timed attack/guard hooks are optional and must have deterministic test seams.

## World integration

Worldwalker remains the physical game world.

Adventure and consequence state may affect:

- NPC availability;
- routes;
- props;
- sanctuary state;
- encounter visibility;
- remembered promises;
- recurring enemies;
- future scene eligibility;
- cosmetic world details.

These effects are local and export/import cleanly.

## Main branch and parallel development

`main` is a release surface because Workers Builds auto-deploys it.

Use:

- one v2 integration branch;
- lane-owned branches/worktrees;
- frozen shared interfaces;
- bounded work packets;
- dependency-aware merges;
- proof receipts;
- independent review for high-risk changes.

Hot-zone files such as `App.tsx`, shared game types/engine, migrations, cartographer schema boundaries, Worker entrypoints, package manifest, authority docs, and central generated manifests require controlled integration ownership.

## Zero-cost invariant

Atlas must not require paid ChatGPT, paid Cloudflare Workers, paid Workers AI, paid OpenRouter, a paid database, paid speech service, paid deployment, paid analytics, or a paid domain.

Quota exhaustion is allowed to stop/degrade AI functionality. It is not allowed to surprise us with an invoice.

## Security/privacy boundary

- No real Greyson content in Git or synthetic fixtures.
- No secret in browser source or committed config.
- No transcript logging.
- No cloud journal persistence.
- No D1/KV/R2 campaign store.
- No analytics/account database.
- No model authority over privacy or progression.
- Access-secret behavior remains Worker-side and must be independently verified before release-impacting changes.
