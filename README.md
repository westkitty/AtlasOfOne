# Atlas of One

Mobile-first PWA for adaptive, gamified personality cartography. The first campaign is **The Greyson Map**.

Atlas is a game with a strict boundary running through it. Campaign truth and progression are deterministic TypeScript state; a language model proposes wording and evidence only, and can never award XP, levels, unlocks, achievements, quests or territory completion. Campaign data is local-first in IndexedDB — there is no server database, no account system and no analytics.

## What exists today

- React 19 + TypeScript + Vite PWA with a four-screen mobile shell (Map, Talk, Vault, Me).
- Deterministic campaign engine: XP, levels, evidence-coverage territory progression, quests, unlocks, map fragments, Boss Fights and Mystery Doors across all eight territories.
- Permanent agency controls — `PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP` and sass — always available and never progression-gated.
- Cartographer backed by **Cloudflare Workers AI** on the free plan, behind a typed failure boundary with a bounded context compiler, structured-output validation and a one-attempt repair limit. Configured model: `@cf/qwen/qwen3-30b-a3b-fp8`.
- Voice path: `MediaRecorder` capture, an explicit voice state machine, client-side agency commands, `/api/transcribe` (`@cf/openai/whisper-tiny-en`), and browser speech synthesis. Text always remains a full alternative.
- Local-first persistence with export, import and delete; a Final Atlas Assessment; and a five-step first-run onboarding.
- Deployed as a Cloudflare Worker serving the PWA, with `/api/turn`, `/api/transcribe` and `/api/finalize` behind an access secret.

Atlas is pre-v1 and has not been validated by a real player. Verification to date is automated tests plus desktop Chrome; no physical mobile device and no browser other than Chrome has been exercised.

## Status

| | Commit | State |
|---|---|---|
| **Production** | `60ce565` | Deployed at `atlas-of-one.atlas-of-one.workers.dev` |
| **Development candidate** | `e940788` | Locally verified — **not pushed, not deployed** |

`e940788` hardens the Final Assessment trust boundary. It is not in production. Pushing `main` auto-deploys via Cloudflare Workers Builds, so a push is a deployment decision.

`OPERATIONAL_STATE.md` is the evidence ledger and records what is verified, what is merely reported, and what is still open. Read it before trusting any completion claim, including one in a commit message.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run test:browser   # real-browser journey; needs Chrome installed
```

`npm run test:live` is an opt-in Workers AI bakeoff that needs Cloudflare credentials, spends the free daily neuron allocation, and skips cleanly without them.

## Source of truth

Read `AGENTS.md` and `OPERATIONAL_STATE.md`, then the documents in `docs/`, before changing architecture or gameplay rules.

## Privacy

Do not commit real campaign answers, transcripts, access tokens, or provider secrets. Synthetic fixtures only. Private material is excluded structurally while an outgoing payload is built — it is never sent with an instruction to ignore it.
