# Atlas of One — Agent Contract

Before substantive work, read in this order:

1. `AGENTS.md`
2. `OPERATIONAL_STATE.md`
3. `docs/PRODUCT_SPEC.md`
4. `docs/ARCHITECTURE.md`
5. `docs/GAME_SYSTEM.md`
6. `docs/MODEL_CONTRACT.md`
7. `docs/ACCEPTANCE.md`
8. `docs/MASTER_BUILD_PLAN.md`

Those files outrank implementation assumptions.

## Non-negotiable rules

- Atlas of One is a mobile-first PWA. The first campaign is **The Greyson Map** for Greyson (he/they).
- Campaign truth and progression are deterministic TypeScript state. A model may propose language/evidence only; it never awards XP, levels, unlocks, achievements, territory completion, or quest completion. `src/cartographer/apply.ts` is the single crossing point from model output into state and may emit only `ANSWER_ACCEPTED`, `EVIDENCE_ADDED` and `INSIGHT_ADDED`.
- Private content is removed while the provider context is built, so it never exists in an outgoing payload. Never send private material followed by an instruction to ignore it.
- `PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP`, and sass controls are always available. They are never progression-gated.
- Private topics are not intentionally revisited.
- Serious/quiet state suppresses celebratory presentation.
- Campaign data is local-first in IndexedDB. No server database is part of v1.
- Never commit real Greyson answers, private conversation content, transcripts, API keys, access tokens, or provider secrets.
- Tests and examples use synthetic data only.
- Keep the dependency set small. Do not add D1, KV, R2, analytics, auth accounts, SSR, Next.js, native wrappers, 3D, or unnecessary infrastructure.
- Production is designed for Cloudflare Workers Free. Quota exhaustion must degrade functionality rather than generate cost.
- `Aerron` is Greyson's former asset/code name. In the supplied mixed Aerron/Andrew pack, **only Aerron assets are canonical for Greyson**. Andrew assets are unrelated to Atlas and must not be imported.
- Preserve Aerron/Greyson asset provenance. Sharp 48×64 pixel renders are for the map/avatar; the detailed Aerron turnaround is reserved for later Character/Vault/final progression.

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

It drives the production bundle through `playwright-core` with `channel: "chrome"`, so no browser binary is downloaded. Use synthetic answers only — never real Greyson material.

The live Workers AI bakeoff is opt-in and needs a Cloudflare account. It skips
cleanly without credentials and never exceeds the free daily neuron allocation:

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run test:live
```

Never commit or print a credential. See `docs/PROVIDER_BAKEOFF.md` for the model
registry, the free-allocation arithmetic and what is still unverified.

Also inspect the repository for secrets/private data. Do not claim runtime behavior that was not actually exercised.

## Handoff format

Report:

- STATUS
- PHASE COMPLETED
- APPROXIMATE PROJECT COMPLETION %
- FILES CREATED/CHANGED
- WORKING FEATURES
- TEST RESULTS
- BUILD RESULT
- BLOCKERS
- EXACT NEXT BEST ACTION
