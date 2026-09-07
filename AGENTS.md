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
- Campaign truth and progression are deterministic TypeScript state. A model may propose language/evidence only; it never awards XP, levels, unlocks, achievements, territory completion, or quest completion.
- `PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP`, and sass controls are always available. They are never progression-gated.
- Private topics are not intentionally revisited.
- Serious/quiet state suppresses celebratory presentation.
- Campaign data is local-first in IndexedDB. No server database is part of v1.
- Never commit real Greyson answers, private conversation content, transcripts, API keys, access tokens, or provider secrets.
- Tests and examples use synthetic data only.
- Keep the dependency set small. Do not add D1, KV, R2, analytics, auth accounts, SSR, Next.js, native wrappers, 3D, or unnecessary infrastructure.
- Production is designed for Cloudflare Workers Free. Quota exhaustion must degrade functionality rather than generate cost.
- Supplied Greyson art, when present, is canonical. Pixel renders are for the map avatar; detailed turnaround art is reserved for later Character/Vault progression.

## Validation before handoff

Run all applicable checks:

```bash
npm test
npm run build
```

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
