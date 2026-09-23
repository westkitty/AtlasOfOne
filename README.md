# Atlas of One

**Atlas of One / The Greyson Map** is a mobile-first, local-first journaling adventure game built for Greyson.

Atlas is not fundamentally a personality questionnaire. Greyson can journal freely, explore a living Worldwalker map, encounter stories and lightweight JRPG-style conflicts, and decide for himself what any of it means. Fictional actions are never automatically treated as evidence about him.

## Product loop

```text
JOURNAL
-> notice interest / uncertainty / change / contradiction
-> optional adventure
-> explore Worldwalker
-> encounter
-> consequence
-> optional reflection
-> Greyson confirms / revises / rejects / leaves uncertain
-> Atlas changes
-> world remembers
```

Adventures must still be worth playing when Atlas learns nothing useful.

## Core boundaries

- **Greyson owns claims about Greyson.** Atlas may notice, ask, hypothesize, connect evidence, remember corrections, and show provenance; it does not diagnose or turn inference into fact.
- **TypeScript owns game truth.** Progression, world state, combat outcomes, rewards, persistence, migrations, privacy, retraction, and Snapshot eligibility remain deterministic.
- **Reflection is the firewall.** Adventure/combat behavior can create observations, but only later real-world reflection can support personal interpretation.
- **Privacy is structural.** PRIVATE and retracted material is excluded from provider context and provenance-dependent derived state.
- **Local-first means local state.** Journal and campaign data live in IndexedDB with local export/import/delete. There is no server campaign database, analytics platform, account system, cloud journal store, or vector database.
- **Zero-surprise cost.** Quota exhaustion degrades AI functionality instead of silently creating cost.

## Experience

Primary surfaces are:

- **World** — Worldwalker, discoveries, NPCs, sanctuaries, adventure markers, encounters, Mystery Doors, Boss events, memories, and pure-fun content.
- **Journal** — free writing first; optional speech-to-text may place editable text into the composer.
- **Atlas / Vault** — evidence, contradictions, revisions, memories, reflections, adventure history, and dated Atlas Snapshots.
- **Me** — settings, accessibility, progression, privacy explanation, Snapshot history, and local data controls.

Combat is deliberately lightweight:

`ATTACK / TECHNIQUE / GUARD / ACT / LEAVE`

No grinding, loot treadmill, gacha, or giant RPG optimization layer.

## Text-to-speech

Text-to-speech is removed from the current product.

Optional speech-to-text input may remain, but Atlas replies visually in text. Reintroducing TTS requires a new explicit product decision.

## Current repository state

The proven Worldwalker-era application remains the runtime baseline on `main`.

The v2 Journal/Adventure/Combat direction is being adopted through a controlled integration cycle. The controlling plan is:

`docs/MASTER_INTEGRATION_PLAN.md`

Read the source of truth before changing implementation:

1. `AGENTS.md`
2. `OPERATIONAL_STATE.md`
3. `docs/MASTER_INTEGRATION_PLAN.md`
4. specialist canonical docs under `docs/`

`main` is a release surface because Cloudflare Workers Builds auto-deploys it. Feature and authority work belongs on branches until the relevant proof gate passes.

## Existing architecture to preserve

- React + TypeScript + Vite PWA
- Cloudflare Worker boundary
- IndexedDB local persistence
- deterministic game/world engines
- local export/import/delete
- bounded provider context
- canonical Greyson/Aerron visual identity
- Worldwalker movement, sanctuaries, encounters, map state, and procedural audio foundation

No runtime AI image generation.

## Development commands

```bash
npm install
npm test
npm run build
npm run test:browser
```

Use synthetic data only. Never place real Greyson journal text, transcripts, private campaign material, or personal evidence into Git fixtures or external development/evaluation prompts.

## Status and proof

`OPERATIONAL_STATE.md` is the evidence ledger for what is actually verified, broken, unverified, pending, or deployed.

A commit message saying "done" is not proof. Neither is an agent saying it.
