# Atlas of One — Agent Contract

Before substantive work, read in this order:

1. `AGENTS.md`
2. `OPERATIONAL_STATE.md`
3. `docs/MASTER_INTEGRATION_PLAN.md`
4. `docs/PRODUCT_SPEC.md`
5. `docs/ARCHITECTURE.md`
6. `docs/GAME_SYSTEM.md`
7. `docs/MODEL_CONTRACT.md`
8. `docs/ACCEPTANCE.md`
9. `docs/MASTER_BUILD_PLAN.md`

Those files outrank implementation assumptions. When they conflict, apply the authority order in `docs/MASTER_INTEGRATION_PLAN.md` and do not leave contradictory canonical instructions active.

## Product identity

- Atlas of One is a mobile-first, local-first journaling adventure game. The first campaign is **The Greyson Map**.
- Journal is the primary self-discovery input. Greyson must be able to write without first being asked a question.
- Worldwalker is the living game world and Adventure Director surface, not decoration.
- Adventures must be worth playing even when Atlas learns nothing useful about Greyson.
- Fictional actions, combat choices, and roleplay are observations only. They are never automatically evidence about Greyson.
- Reflection is the firewall between fictional behavior and durable self-interpretation.
- Greyson has final authority over claims about himself and may confirm, partially accept, reject, revise, retract, mark private, or leave uncertain.
- Atlas uses dated, revisable Snapshots. It does not treat Greyson as permanently complete.

## Non-negotiable technical rules

- Campaign truth and progression are deterministic TypeScript state. A model may propose language, scenes, dialogue, reflections, hypotheses, candidate evidence, and Snapshot prose only.
- A model never awards XP, levels, unlocks, achievements, territory completion, quest completion, combat outcomes, rewards, persistence changes, migrations, privacy decisions, or Snapshot eligibility.
- Model output must cross typed validation boundaries before any proposal can affect local state.
- Private/retracted content is structurally excluded while provider context is built. Never send private material followed by an instruction to ignore it.
- Derived state that depends only on PRIVATE or retracted sources must be retired through provenance.
- `PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP`, and sass controls remain available independently of progression.
- Serious/quiet state suppresses celebratory presentation.
- Campaign data is local-first in IndexedDB. No server campaign database, analytics platform, vector database, account system, or cloud journal store belongs in this integration cycle.
- Production remains zero-surprise-cost. Quota exhaustion must degrade functionality rather than create cost.
- Never commit real Greyson answers, journal text, private campaign content, transcripts, API keys, access tokens, or provider secrets.
- Tests and examples use synthetic data only.
- Keep the dependency set small. Do not add D1, KV, R2 campaign storage, analytics, auth accounts, SSR, Next.js, native wrappers, 3D, or unnecessary infrastructure without a new explicit product decision.
- `Aerron` is Greyson's former asset/code name. Only Aerron-side material from the supplied mixed Aerron/Andrew pack is canonical for Greyson. Andrew-side assets are unrelated and must not be imported.
- Preserve Greyson/Aerron visual identity and provenance. No runtime AI image generation.

## TTS removal lock

Text-to-speech is removed from the current product.

- No `window.speechSynthesis`.
- No `SpeechSynthesisUtterance`.
- No assistant-spoken prompts or replies.
- No voice picker or TTS provider.
- No automatic microphone restart tied to assistant speech.
- Speech-to-text input may remain and must return editable text to the visual interface.
- Reintroducing TTS requires a new explicit product decision.

## Gameplay authority

- Adventure shape is bounded: Hook -> Approach -> Complication -> Encounter -> Choice/Consequence -> optional Reflection.
- Natural-language actions are supported.
- Combat is lightweight JRPG-style storytelling using ATTACK / TECHNIQUE / GUARD / ACT / LEAVE.
- Combat is deterministic, short, fail-forward where reasonable, and non-grindable.
- Combat actions create AdventureObservations, not personality evidence.
- Pure-fun adventures are a required content type.
- Existing Boss Fight and Mystery Door authority remains deterministic while those systems are migrated into the new adventure grammar.

## Development and integration

- `main` is a release surface because Workers Builds auto-deploys it.
- Do not push feature or authority-adoption work directly to `main`.
- Use the integration branch/worktree topology defined by `docs/MASTER_INTEGRATION_PLAN.md`.
- Parallel cognition is allowed; uncontrolled concurrent edits to shared hot-zone files are not.
- Work from explicit bounded packets with dependencies, allowed paths, acceptance criteria, validation, stop conditions, and proof receipts.
- Treat another agent's claims of done/fixed/tested/pushed/deployed as claims until evidence supports them.
- Stop rather than improvise when branch/base, source-of-truth, privacy, persistence, migration, security, or dependency boundaries unexpectedly change.

## Validation before handoff

Run all applicable checks:

```bash
npm test
npm run build
```

The real-browser user journey runs separately and needs Chrome installed locally:

```bash
npm run test:browser
```

Use synthetic data only. Never use real Greyson material in fixtures, screenshots, LM Arena, Grok Build, AI Studio, or other development/evaluation prompts.

The live Workers AI bakeoff is opt-in and requires Cloudflare credentials:

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run test:live
```

Never commit or print a credential. Do not claim runtime behavior that was not actually exercised.

## Handoff format

Report:

- STATUS
- PACKET / PHASE
- BASE SHA
- HEAD SHA
- FILES CHANGED
- ACCEPTANCE -> EVIDENCE
- VALIDATION RUN
- VALIDATION NOT RUN
- PRIVACY / PERSISTENCE / MIGRATION IMPACT
- KNOWN UNKNOWNS
- BLOCKERS
- EXACT NEXT BEST ACTION
