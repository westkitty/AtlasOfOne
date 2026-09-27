# Atlas of One

Mobile-first PWA for adaptive, gamified personality cartography. The first campaign is **The Greyson Map**.

Atlas is a game with a strict boundary running through it. Campaign truth and progression are deterministic TypeScript state; a language model proposes wording and evidence only, and can never award XP, levels, unlocks, achievements, quests or territory completion. Campaign data is local-first in IndexedDB — there is no server database, no account system and no analytics.

## What exists today

Two lines of code exist and must not be confused:

- **`main`** — what is deployed. The v1 product: Map/Talk/Vault/Me, a questioning Cartographer, browser speech synthesis, and a single Final Atlas Assessment.
- **v2 integration branches** (`integration/atlas-v2-journal-adventure-combat`, and `feat/v2-combat-mechanics` on top of it) — **not merged, not deployed**. Journal-first Atlas:
  - A blank-page **Journal** (typed or optional speech-to-text; text-to-speech is removed), with privacy/retraction, an optional prompt, and a **Journey** list of adventures (fiction, labelled as not evidence).
  - **Reflection** as the only path from anything to evidence about Greyson; fictional choices are recorded as `AdventureObservation`s, never evidence.
  - **Worldwalker adventures**: Journal → knowledge gap → explicit seed → world marker → a six-beat local adventure with a deterministic **JRPG encounter** (ATTACK / TECHNIQUE / GUARD / ACT / LEAVE, visible enemy intent, pacify/defeat/interrupt objectives, fail-forward), persisted mid-combat; completed adventures leave **memory markers** in the world.
  - **Atlas Snapshots**: dated, immutable syntheses with "what changed since the last one", replacing the terminal Final Assessment; legacy assessments migrate into history.
- Both lines keep: deterministic TypeScript authority over all progression and combat, permanent agency controls (`PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP`, sass), local-first IndexedDB with export/import/delete, and Cloudflare Workers AI (free plan) as a validated, subordinate provider behind an access secret.

Atlas has not been validated by a real player. Verification is automated tests plus desktop Chrome (headless); no physical mobile device and no browser other than Chrome has been exercised.

## Status

Pushing `main` auto-deploys via Cloudflare Workers Builds, so a push to `main` is a deployment decision. `OPERATIONAL_STATE.md` is the evidence ledger and separates repository HEAD, deployed application content and branch state. Read it before trusting any completion claim, including one in a commit message.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run test:browser   # real-browser journey; needs Chrome installed
```

`npm run test:live` is an opt-in Workers AI bakeoff that needs Cloudflare credentials, spends the free daily neuron allocation, and skips cleanly without them.

## Source of truth

Read `AGENTS.md` and `OPERATIONAL_STATE.md`, then the documents in `docs/`, before changing architecture or gameplay rules.

## Privacy

Do not commit real campaign answers, transcripts, access tokens, or provider secrets. Synthetic fixtures only. Private material is excluded structurally while an outgoing payload is built — it is never sent with an instruction to ignore it.
