# Atlas of One — Deterministic Game System

## Prime directive

TypeScript owns game truth. The model does not.

Atlas is a journaling adventure game with deterministic progression, world state, encounters, combat, persistence, privacy, and Snapshot eligibility.

## Canonical product loop

```text
JOURNAL
-> notice interest / uncertainty / change / contradiction
-> optional AdventureSeed
-> Worldwalker exploration
-> story / puzzle / social / combat encounter
-> deterministic consequence
-> optional Reflection
-> Greyson confirms / partially accepts / rejects / revises / marks private / leaves uncertain
-> Atlas updates
-> world remembers
```

## Core durable records

Schema v2 introduces first-class records for:

- `JournalEntry`
- `KnowledgeGap`
- `AdventureSeed`
- `AdventureRun`
- `AdventureAction`
- `AdventureObservation`
- `ReflectionRecord`
- `AdventureMemory`
- `AtlasSnapshot`

Legacy turns, Boss/Mystery state, evidence, worldJourney, and settings remain valid provenance through migration.

## Human authority

Adventure or combat behavior alone never becomes self-knowledge.

A fictional action may create an `AdventureObservation`.

Example:

```text
Observation: Greyson guarded the companion three turns in a row.
NOT evidence: Greyson always prioritizes others over himself.
```

Only later real-world reflection can support a durable interpretation.

Reflection outcomes:

- CONFIRM
- PARTIAL
- REJECT
- UNCERTAIN
- REVISE
- PRIVATE

Rejected interpretations remain remembered strongly enough not to be repeatedly reasserted.

## Journal

Journal is the primary self-discovery input.

A saved journal entry does not require a preceding question.

Entries support:

- typed input;
- optional speech-to-text input;
- privacy;
- retraction;
- linked reflections;
- linked adventures;
- provenance.

Participation may earn ordinary deterministic progress, but emotional intensity must never produce bonus rewards.

## Knowledge Gap Engine

Gap types:

- unknown;
- contradiction;
- change;
- underexplored;
- curiosity.

Selection is deterministic.

Scoring may consider:

- undercoverage;
- age since last exploration;
- explicit Greyson interest;
- contradiction relevance;
- recent journal salience;
- theme diversity;
- privacy eligibility;
- recent-domain cooldown.

Do not rank trauma, pain, or vulnerability higher because they are dramatic.

## Adventure engine

Adventure kinds include:

- social dilemma;
- investigation;
- rescue/support;
- exploration;
- negotiation;
- absurd comedy;
- ethical conflict;
- creative/building challenge;
- memory echo;
- relationship/companion scene;
- mystery/puzzle;
- survival/escape;
- combat-forward story;
- pure-fun wildcard.

Ordinary structure:

1. Hook
2. Approach
3. Complication
4. Encounter
5. Choice / Consequence
6. Optional Reflection

The engine owns lifecycle, eligibility, persistence, completion/withdrawal, consequences, and recurrence rules.

Natural-language actions enter through a bounded submission boundary. The model may explain impossible actions in-world but cannot silently mutate deterministic state to make them true.

Completed adventures stay in history. The same seed cannot regenerate as though it never happened. Recurring themes require materially different forms and cooldown.

Greyson may permanently retire an unwanted exploration path.

## Pure-fun law

Some adventures intentionally have no learning target.

Pure-fun play is not failed analysis. It is required product behavior.

## Combat

Universal actions:

- ATTACK
- TECHNIQUE
- GUARD
- ACT
- LEAVE

Initial objective families:

- defeat;
- survive N turns;
- escape;
- protect;
- interrupt;
- pacify/calm;
- break/reach object;
- hold position;
- escort;
- discover correct ACT interaction.

Initial gimmick families may include shielded, charging, counterattacking, enraged, healing, swarm, linked pair, stance-changing, mimic/disguise, unstable terrain, morale/fear, timed vulnerability, environmental hazard, ally in danger, or an enemy that should not be killed.

Ordinary encounters should usually resolve in roughly 2–5 meaningful player turns.

### Deterministic combat authority

The combat engine owns:

- HP;
- damage;
- turn order;
- technique costs/cooldowns;
- statuses;
- enemy intent;
- objective progress;
- outcome;
- rewards;
- persistence.

The model may provide:

- narration;
- contextual description;
- enemy flavor from approved content;
- ACT wording;
- consequence prose;
- permitted encounter skin.

The model may not author authoritative HP changes, rewards, success flags, or turn order.

### Leave/fail-forward

LEAVE is a first-class action where permitted.

Escape, withdrawal, defeat, surrender, or pacification should usually create a different story state rather than a punishment loop.

### No grind

Forbidden:

- random encounter spam;
- required grinding;
- farmable low-information fights for XP;
- loot treadmill;
- gacha;
- escalating gear rarity;
- large optimization trees.

## Progression

Progression remains deterministic.

Existing XP/level/territory systems may continue while v2 evolves, but they must not become the emotional center of the product.

Useful progress increasingly comes from:

- charting regions through supported evidence;
- completing adventures;
- discoveries;
- resolving reflections;
- revising old beliefs;
- cross-region connections;
- story objectives;
- fixed non-grindable combat/story milestones.

No bonus for painful disclosure.

## Evidence and provenance

Evidence may derive from explicit real-world journal/reflection material under the evidence rules.

Model inferences remain model-proposed.

Adventure behavior alone cannot produce confirmed evidence.

Retraction/PRIVATE propagation must retire every derived item that depends exclusively on the retired source.

Contradictions remain explicit history-bearing state.

## Adventure memory

Memory records may describe:

- characters;
- places;
- events;
- relationships;
- promises;
- objects.

Each memory has stable identity, provenance, privacy state, retirement state, and bounded retrieval rules.

## Atlas Snapshots

Snapshot eligibility is deterministic.

Snapshots are immutable historical syntheses. New evidence creates a new Snapshot rather than rewriting the old one.

There is no terminal "Greyson is complete" game state.

Legacy `CAMPAIGN_COMPLETED` may remain only for compatibility while it is retired from new product semantics.

## Bosses and Mystery Doors

Existing deterministic Boss Fight and Mystery Door authority remains protected.

They migrate into the new adventure grammar without surrendering:

- eligibility;
- availability;
- rewards;
- privacy;
- PASS/PRIVATE/STOP behavior;
- withdrawal safety;
- deterministic completion authority.

Bosses become multi-scene synthesis adventures.

Mystery Doors become cross-region story events.

Neither is mandatory and neither may trap the player.

## World consequences

Adventure outcomes may deterministically affect:

- NPC availability;
- route traces;
- environmental state;
- props;
- dialogue;
- promises;
- recurring enemies;
- future scene eligibility;
- cosmetic world state.

All consequence state persists locally and round-trips through export/import.

## Accessibility mechanics

Timed attack/guard input is optional.

Rules:

- generous timing;
- base action still occurs on a miss;
- reduced-motion mode does not depend on motion-only timing cues;
- no frame-perfect mechanic;
- deterministic test hooks replace wall-clock flakiness.
