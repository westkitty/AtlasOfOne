# Atlas of One — Product Specification

## 1. Product identity

**Atlas of One** is a mobile-first, local-first journaling adventure game. Its first campaign is **The Greyson Map**.

Atlas is not fundamentally a personality questionnaire. Greyson can journal freely without first being asked a question. The world, adventures, encounters, memories, reflections, and Atlas records evolve around what he actually chooses to explore.

The strongest product test is simple: **Greyson wants to come back.**

## 2. Canonical loop

```text
JOURNAL
-> Atlas notices interest / uncertainty / change / contradiction
-> optional adventure seed
-> explore Worldwalker
-> encounter
-> consequence
-> optional reflection
-> Greyson confirms / partially accepts / rejects / revises / marks private / leaves uncertain
-> Atlas changes
-> world remembers
```

Every adventure must satisfy both of these:

- it is worth playing even if Atlas learns nothing useful about Greyson;
- nothing becomes a durable claim about Greyson merely because he chose it in fiction.

## 3. Human authority

Greyson has final authority over claims about himself.

Atlas may notice, ask, hypothesize, connect evidence, remember corrections, and show provenance. It must not diagnose, claim unsupported certainty, turn inference into fact, reward painful disclosure, reassert rejected interpretations as truth, or treat roleplay/combat behavior as psychological proof.

Supported outcomes for interpretations:

- **CONFIRM**
- **PARTIAL**
- **REJECT**
- **UNCERTAIN**
- **REVISE**
- **PRIVATE**

Rejected and revised interpretations remain history-bearing without counting as accepted self-knowledge.

## 4. Primary product surfaces

### World

The living Worldwalker island. Greyson moves through territory geography, sanctuaries, discoveries, NPCs, routes, memories, visible encounters, Mystery Doors, Boss events, and pure-fun content.

### Journal

The primary self-discovery input surface.

Greyson can:

- write immediately with no prompt;
- optionally dictate speech-to-text into editable text;
- save without answering a question;
- ask Atlas to respond;
- request a prompt only when he wants one;
- mark an entry PRIVATE;
- retract an entry while preserving history;
- link entries to reflections, adventures, evidence, and memories;
- choose **Explore this later** when something should become an adventure seed.

Journal responses may acknowledge, reflect a theme, ask one optional follow-up, notice possible change/contradiction, suggest an existing memory, or decline to analyze when analysis is unnecessary.

### Atlas / Vault

The inspectable record of what Atlas currently believes it knows, why, what Greyson confirmed or rejected, contradictions, memories, adventure history, revisions, and dated Atlas Snapshots.

### Me

Settings, accessibility, input mode, local data controls, export/import/delete, progression, privacy explanation, and Snapshot history.

## 5. Permanent agency controls

These remain available independently of progression:

- **PASS**
- **PRIVATE**
- **STOP**
- **SERIOUS**
- **HELP**
- sass controls

SERIOUS switches immediately to quiet/respectful presentation and suppresses celebratory presentation without deleting earned state.

## 6. Worldwalker adventures

Ordinary adventure shape:

1. **Hook**
2. **Approach**
3. **Complication**
4. **Encounter**
5. **Choice / Consequence**
6. **Optional Reflection**

Natural-language actions are supported. Adventures may be social, investigative, exploratory, absurd, ethical, creative, relational, puzzle-based, survival-oriented, combat-forward, or pure fun.

Pure-fun adventures are a required content type. A mature ordinary seed bank should keep at least 20% with no learning target.

Withdrawal, escape, defeat, or strange choices should usually fail forward rather than produce a dead-end game-over state.

## 7. Lightweight JRPG combat

Combat is a storytelling verb, not a grind loop.

Universal actions:

- **ATTACK**
- **TECHNIQUE**
- **GUARD**
- **ACT**
- **LEAVE**

Combat must be short, deterministic, accessible, and varied primarily by objective + gimmick + fiction.

No loot treadmill, gacha, required grinding, equipment spreadsheet, random stat rolls, or large permanent skill tree belongs in this cycle.

Combat actions create observations about what happened in the game. They are not evidence about Greyson until a later real-world reflection supports an interpretation.

## 8. Deterministic progression

TypeScript owns:

- XP and level;
- territory/map state;
- quests and objectives;
- achievements and unlocks;
- world consequences;
- combat HP, damage, turn order, objectives, outcomes, and rewards;
- persistence and migrations;
- privacy/retraction propagation;
- Snapshot eligibility.

The model cannot own any of these.

Do not award extra progression for painful disclosure, vulnerability, or trauma intensity.

## 9. Evidence, contradiction, and revision

Evidence preserves:

- provenance;
- explicit vs inferred basis;
- strength/confidence;
- territory links;
- counter-evidence;
- status;
- revision history.

Contradictions are valid state, not errors to erase.

A retracted or PRIVATE source must retire or withhold every derived item that depends exclusively on it, including evidence, insights, contradictions, knowledge gaps, adventure seeds, memories, and Snapshot eligibility.

Propagation is provenance-based, never prose-search-based.

## 10. Atlas Snapshots

Greyson never becomes permanently complete.

The former terminal Final Assessment model is replaced by immutable, dated, revisable **Atlas Snapshots**.

A Snapshot may include:

- confirmed self-knowledge;
- uncertainty;
- contradictions;
- recent changes;
- representative Greyson words where provenance permits;
- territory summaries;
- relationships and social world;
- values and moral architecture;
- interests and ordinary preferences;
- cognitive style;
- motivations, hopes, fears, and aversions;
- open questions;
- relevant adventure history;
- **What changed since the previous Snapshot?**

Later evidence never rewrites an older Snapshot.

## 11. Privacy and locality

- Campaign and journal state are local-first in IndexedDB.
- No server campaign database.
- No analytics platform.
- No account system.
- No vector database.
- No cloud journal store.
- No real Greyson journal text, transcript, private campaign material, or personal evidence in Git fixtures, public repositories, LM Arena, Grok Build, AI Studio, or generic evaluation prompts.
- Remote inference receives only the minimum eligible non-private bounded context for an explicitly invoked provider operation.
- Quota exhaustion must degrade capability rather than silently create cost.

## 12. Speech input and TTS lock

Optional speech-to-text may remain:

```text
Tap mic
-> listening
-> local silence detection or Done
-> transcribing
-> editable transcript appears in Journal
-> Greyson edits or submits
-> Atlas responds in text
```

Text-to-speech is removed.

There is no browser `speechSynthesis`, no assistant-spoken output, no voice picker, no TTS provider, and no microphone auto-restart tied to assistant speech.

Reintroducing TTS requires a new explicit product decision.

## 13. Accessibility

Atlas must preserve:

- semantic controls;
- keyboard access;
- visible focus;
- sufficiently large touch targets;
- reduced-motion support;
- readable contrast;
- non-color-only distinctions;
- editable speech-to-text transcripts;
- agency controls in every relevant mode;
- optional timed combat input that never blocks accessibility.

## 14. Canonical Greyson / Aerron assets

- Aerron is Greyson's former asset/code name.
- Only Aerron-side material from the mixed Aerron/Andrew source is canonical for Greyson.
- Andrew-side assets are unrelated and must not enter Atlas.
- Existing approved Greyson/Aerron visual identity is preserved.
- No runtime AI image generation.
- Candidate v4 assets must use stable IDs, provenance, hashes, and manifest-driven integration before replacing proven v3 runtime assets.

## 15. Explicit non-goals in this integration cycle

Do not introduce:

- native mobile wrappers;
- account/login systems;
- cloud campaign sync databases;
- analytics;
- vector databases/embeddings;
- multiplayer/social sharing;
- paid TTS;
- runtime AI character art;
- 3D map replacement;
- grind/loot/gacha systems;
- a terminal "Greyson is complete" state.
