# Atlas of One

Mobile-first PWA for adaptive, gamified personality cartography. The first campaign is **The Greyson Map**.

This repository implements the Phase 1/Phase 2 mock vertical slice: deterministic game progression, deterministic Boss Fight and Mystery Door encounters, local IndexedDB persistence, Map/Talk/Vault/Me UI, synthetic tests, a real-browser journey suite, PWA foundation, and a Cloudflare Worker API boundary. No paid AI service is connected.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
npm run test:browser   # real-browser journey; needs Chrome installed
```

## Source of truth

Read `AGENTS.md` and `OPERATIONAL_STATE.md`, then the documents in `docs/` before changing architecture or gameplay rules.

## Privacy

Do not commit real campaign answers, transcripts, access tokens, or provider secrets. Synthetic fixtures only.
