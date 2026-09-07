# Operational State: Atlas of One

<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "atlas-of-one",
  "project_name": "Atlas of One",
  "project_root": ".",
  "artifact_path": null,
  "state_revision": 4,
  "last_updated": "2026-09-07",
  "current_baseline": {
    "identity": "a50ffe4619e9856208e602e0bd99e72f886a2d78",
    "state": "partially-verified",
    "last_verified": "2026-09-07"
  },
  "scope_boundaries": [
    "mobile-first React/TypeScript PWA, deterministic campaign engine, local persistence, mock Cartographer, canonical Aerron/Greyson map assets, Cloudflare Worker foundation"
  ],
  "linked_parent_state": null
}
-->

## 1. Project Identity and Scope

- **Project ID:** `atlas-of-one`
- **Purpose:** Build Atlas of One, beginning with The Greyson Map: an adaptive, gamified personality-cartography experience whose game progression remains deterministic and whose personal campaign data is local-first.
- **Project type:** Mobile-first React/TypeScript PWA with a Cloudflare Worker API boundary.
- **Primary root or artifact:** repository root.
- **Target environment:** Current evergreen mobile browsers first; installable PWA; Cloudflare Worker deployment later.
- **Canonical authority:** Current explicit user instructions, then repository source-of-truth documents distilled from supplied planning/source material and accepted asset mapping.
- **Governed scope:** Phase 1 complete and Phase 2 substantially advanced using a mock Cartographer, with canonical Aerron/Greyson map sprites integrated.
- **Explicitly not governed:** Paid-model integration, production access secret, production voice transcription, real Greyson campaign content, 3D/native/account systems.

## 2. Current Baseline

- **Primary artifact:** `westkitty/AtlasOfOne` on `main`.
- **Code baseline:** `a50ffe4619e9856208e602e0bd99e72f886a2d78`.
- **Baseline state:** `partially-verified` — source, deterministic behavior, synthetic 100-turn campaign behavior, IndexedDB unit behavior, canonical map-asset structure/dimensions, and production build are verified; real-browser/mobile/PWA install behavior remains unverified.
- **Validation identity:** GitHub Actions run `34129810055` passed dependency installation, 18 tests, production Worker/client builds, and PWA generation.
- **Active default user route:** Map screen in source; browser journey remains implemented-unverified.
- **Delivery state:** GitHub repository; no Cloudflare production deployment asserted.

## 3. Artifact Contract

The current artifact contains the requested source-of-truth documents, React/TypeScript/Vite/Cloudflare/Dexie/Zod/PWA/Vitest stack, four-screen mobile shell, deterministic campaign engine, automatic local persistence, import/export/delete foundations, mock Cartographer, synthetic fixtures, a sustained 100-turn campaign test, curated canonical Aerron/Greyson map sprites, and CI. No paid AI is connected.

## 4. Active Invariants

- **INV-001:** Model output never owns game progression.
- **INV-002:** PASS, PRIVATE, STOP, SERIOUS, HELP, and sass controls remain available independently of progression.
- **INV-003:** Private topics are not intentionally revisited by the mock selector.
- **INV-004:** Quiet/serious presentation suppresses celebratory UI while retaining state progress.
- **INV-005:** Campaign persistence is local-first and versioned.
- **INV-006:** No real Greyson answers/private transcripts enter source or synthetic tests.
- **INV-007:** No provider/access secret is committed.
- **INV-008:** No D1, KV, R2, analytics, accounts, SSR, Next.js, native wrapper, or 3D infrastructure is introduced.
- **INV-009:** `Aerron` is Greyson's former asset/code name. Only Aerron-side material from the supplied mixed Aerron/Andrew pack is canonical for Greyson; Andrew-side assets are unrelated and must not be imported into Atlas.
- **INV-010:** Runtime asset cleanup may curate/rename redundant source files but must preserve Greyson/Aerron's visual identity and provenance.

## 5. Verified Working Behavior

- **VER-001:** GitHub Actions installed dependencies successfully on Node 22.
- **VER-002:** 18 synthetic tests across assets, game, sustained campaign, model contract, persistence transfer, and IndexedDB passed on code baseline `a50ffe4...`.
- **VER-003:** The sustained synthetic campaign test executes 100 turns, deeply charts every bootstrap territory, creates exactly one map fragment per territory, reaches Level 8, completes bootstrap quests, and unlocks all bootstrap abilities without a real AI provider.
- **VER-004:** `npm run build` passed with the Cloudflare Vite plugin; both Worker and client production bundles were generated.
- **VER-005:** PWA build generated a manifest, service worker, and 11 precache entries, including all five canonical runtime map sprites.
- **VER-006:** Model-contract tests prove extra progression-looking fields (`xp`, `level`, quest completion, unlocks) do not enter parsed Cartographer output.
- **VER-007:** Tests prove PRIVATE filtering, quiet-state progression, deterministic XP/levels/territory coverage, evidence retraction, duplicate-evidence XP protection, import validation, and IndexedDB save/restore/delete.
- **VER-008:** Asset tests prove the curated Greyson map set contains exactly five 48×64 PNG sprite slots and no Andrew-named file inside the Greyson asset tree.
- **VER-009:** Repository asset manifest records byte-level source provenance and SHA-256 values for the five runtime Aerron sprites plus the canonical detailed turnaround source.

## 6. Known Not Working

No confirmed defect remains from automated Phase 1/2 validation. Real AI and production voice are intentionally not implemented in this phase.

## 7. Implemented but Unverified

- **UNV-001:** Real-browser Map/Talk/Vault/Me user journey and responsive layout.
- **UNV-002:** Automatic IndexedDB hydration/autosave through an actual browser reload rather than fake IndexedDB unit proof.
- **UNV-003:** PWA installability/offline behavior on Android/mobile browser.
- **UNV-004:** Worker `/api/health` behavior in a running Vite/Cloudflare dev or deployed runtime.
- **UNV-005:** Export download and file-picker import through an actual browser.
- **UNV-006:** Actual browser rendering/scale of the canonical Aerron/Greyson pixel sprite in Map and Me screens; source integration and build are verified but visual runtime inspection remains pending.

## 8. Unknown or Evidence-Stale State

- **UNK-002:** The available source requires all territories/levels but does not enumerate canonical names/details for each; political dimensions and a Level 8 reveal are explicit. Bootstrap labels/thresholds are reversible and documented as non-canonical defaults.

## 9. Pending Work

- **PND-001:** Finish Phase 2 browser-runtime proof and remaining mock-game depth, notably real Boss Fight/Mystery Door mock flows rather than unlock labels alone.
- **PND-002:** Phase 3 real Cartographer provider, context compiler, evidence-model integration, and provider failure states.
- **PND-003:** Phase 4 voice state machine, access gate, Cloudflare deployment, and real-device PWA checks.
- **PND-004:** Phase 5 adversarial release QA and final assessment.
- **PND-005:** Integrate the supplied canonical `sheets/aerron_turnaround_hires.png` when the later Character/Vault/final progression reveal is implemented; it is deliberately not shipped in the current runtime subset yet.

## 10. Active Decisions, Defaults, and Prohibitions

- **DEC-001:** React + TypeScript + Vite + Cloudflare Vite plugin + Worker + Dexie + Zod + PWA + Vitest.
- **DEC-002:** Local `MockCartographer` is the only Cartographer implementation in Phase 1/2.
- **DEC-003:** No paid AI service is connected.
- **DEC-004:** Campaign `schemaVersion` starts at `1` with an explicit migration boundary.
- **DEC-005:** Bootstrap territory labels and numeric Level 1–8 thresholds are source-derived implementation defaults, not invented canon declarations.
- **DEC-006:** Asset alias is locked: Aerron = Greyson's former code name. Andrew assets from the mixed source archive are excluded from Atlas.
- **DEC-007:** The Phase 2 runtime ships only the five exact 48×64 game-ready Aerron sprite bytes, renamed under `public/assets/greyson/map/`; raw renders, enlarged previews, contact sheets, and the later turnaround reward remain outside the current runtime payload.

## 11. Validation and Evidence Matrix

| ID | Claim or behavior | State | Evidence | Validation method | Artifact/revision | Last checked | Recheck trigger |
|---|---|---|---|---|---|---|---|
| INV-001 | Model cannot mutate progression | verified | model schema + engine test | Vitest | `a50ffe4`, rev 4 | 2026-09-07 | model/game contract changes |
| INV-002 | Core controls not progression-gated | partially-verified | source + CORE_COMMANDS test | source + Vitest; browser pending | `a50ffe4`, rev 4 | 2026-09-07 | action-bar changes |
| INV-003 | PRIVATE filtered by mock | verified | game test | Vitest | `a50ffe4`, rev 4 | 2026-09-07 | prompt selection changes |
| INV-004 | quiet retains progress | verified | game test + source | Vitest | `a50ffe4`, rev 4 | 2026-09-07 | presentation changes |
| INV-005 | versioned local persistence | partially-verified | schema/migration + fake IndexedDB test | Vitest; real reload pending | `a50ffe4`, rev 4 | 2026-09-07 | persistence changes |
| GAME-001 | sustained mock campaign reaches end-state safely | verified | 100-turn campaign test | Vitest | `a50ffe4`, rev 4 | 2026-09-07 | progression changes |
| ASSET-001 | only canonical Aerron/Greyson runtime sprites ship in Greyson tree | verified | asset manifest + asset tests | source + Vitest | `a50ffe4`, rev 4 | 2026-09-07 | asset changes |
| ASSET-002 | canonical sprite looks correct in real Map/Me UI | implemented-unverified | source/build only | mobile/browser visual check | `a50ffe4`, rev 4 | 2026-09-07 | sprite/CSS changes |
| BUILD-001 | production build succeeds | verified | Actions run `34129810055` | `npm run build` | `a50ffe4`, rev 4 | 2026-09-07 | dependency/build changes |

## 12. Current Change Scope and Impact Radius

- **Allowed to change next:** Remaining Phase 2 mock/runtime surfaces, then Phase 3 provider work.
- **Must remain unchanged:** privacy, deterministic progression authority, always-available agency controls, Aerron→Greyson canonical asset mapping, Andrew-asset exclusion, source gap labels, and explicit non-goals.
- **Potentially affected behavior:** mock campaign progression, local state persistence, mobile UI, PWA build, canonical sprite presentation.
- **Mandatory checks:** synthetic tests, production build, repository secret/private-data scan; browser/runtime checks when available.
- **Repair class:** Greenfield bounded implementation.

## 13. Compact Revision Log

### Revision 4 — 2026-09-07

- **Artifact/source identity:** code baseline `a50ffe4619e9856208e602e0bd99e72f886a2d78`.
- **State deltas:** Accepted asset mapping propagated: Aerron is Greyson's former code name; five canonical Aerron game-ready sprites curated into runtime; Andrew assets explicitly excluded; old missing-asset unknown resolved.
- **New evidence:** Actions run `34129810055` passed dependency install, 18 tests including two asset invariants, production Worker/client builds, and PWA generation with 11 precache entries.
- **Validation not performed:** actual mobile/browser interaction, real reload, PWA installation/offline journey, visual sprite rendering in target browser, production deployment.
