# Atlas of One — Master Build Plan

## Locked operating rule

**Parallel cognition. Serial integration.** One implementation owner edits the repository at a time; other models/tools may critique, simulate, benchmark, or produce isolated candidates.

## Phase 1 — Lock + Bootstrap (~15%)

Deliver:

- authoritative docs
- React/TypeScript/Vite app
- Cloudflare Vite plugin + Worker API boundary
- Dexie/Zod/PWA/Vitest foundations
- Map/Talk/Vault/Me mobile shell
- mock Cartographer vertical slice
- XP/level/territory/quest/unlock/Insight presentation
- synthetic tests

Gate: `npm test` and `npm run build` pass; browser vertical slice is then the remaining runtime check.

## Phase 2 — Build the game offline/mock (~42%)

Complete deterministic campaign engine before real AI:

- versioned CampaignState
- deterministic events/history
- XP/levels
- evidence-coverage territory progression
- quests, achievements, unlocks, map fragments
- private topics
- quiet/serious state
- Insight confirmations/rejections
- retraction
- automatic IndexedDB persistence
- export/import/delete
- synthetic full-campaign capability

Gate: scripted/mock campaign can progress end-to-end with no network or AI.

## Phase 3 — Give the Cartographer a brain (~66%)

- provider interface
- current free Workers AI model bakeoff rather than brand precommitment
- context compiler
- evidence ledger/provenance
- structured-output validation/repair
- real-provider error/quota states
- optional disabled fallback provider
- 100-turn synthetic AI campaign

The model still never owns game progression.

## Phase 4 — Voice + deployment (~83%)

- `MediaRecorder` voice capture
- `/api/transcribe`
- browser speech synthesis
- explicit voice state machine
- local voice commands
- PWA offline shell
- invite/access secret stored only as Worker secret
- Cloudflare Git deployment
- Android install/device check

## Phase 5 — Break it deliberately (~96%)

Adversarially test short/long/contradictory/private/serious/unusual-political/revision-heavy/voice-fragment players, long-session state, retraction, export/delete/import, security, accessibility, service worker, and final assessment. Add every reproduced break as a regression fixture.

## Phase 6 — Give it to Greyson (100%)

Minimal onboarding:

1. Begin.
2. Choose sass: Low / Medium / I Understand the Risks.
3. Choose Talk / Type.
4. Learn permanent Pass / Private / Stop / Serious controls.
5. Start.

Observe product friction only; do not siphon campaign answers into development tools.

## Cut line — not v1

No native wrapper, account system, cloud sync database, multiplayer, paid TTS, custom domain requirement, 3D map, analytics, embeddings/vector DB, admin dashboard, full-duplex WebRTC voice, or runtime AI character art.

## Future-only

- fully local WebGPU model experiment
- New Game+ comparison campaign
- encrypted `.atlas` backup
- optional higher-quality voice services if zero-cost constraints are intentionally revised

## Zero-dollar rule

The app may stop/degrade AI functionality on quota exhaustion. It may not silently create cost.
