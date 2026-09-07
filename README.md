# Atlas of One

Mobile-first PWA for adaptive, gamified personality cartography. The first campaign is **The Greyson Map**.

This repository currently implements the Phase 1/early Phase 2 mock vertical slice: deterministic game progression, local IndexedDB persistence, Map/Talk/Vault/Me UI, synthetic tests, PWA foundation, and a Cloudflare Worker API boundary. No paid AI service is connected.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

## Source of truth

Read `AGENTS.md` and `OPERATIONAL_STATE.md`, then the documents in `docs/` before changing architecture or gameplay rules.

## Privacy

Do not commit real campaign answers, transcripts, access tokens, or provider secrets. Synthetic fixtures only.
