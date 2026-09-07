# Operational State: Atlas of One

<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "atlas-of-one",
  "project_name": "Atlas of One",
  "project_root": ".",
  "artifact_path": null,
  "state_revision": 2,
  "last_updated": "2026-09-07",
  "current_baseline": {
    "identity": "0f90ade85a5d55509774701aea8149a56e0323b4",
    "state": "partially-verified",
    "last_verified": "2026-09-07"
  },
  "scope_boundaries": [
    "mobile-first React/TypeScript PWA, deterministic campaign engine, local persistence, mock Cartographer, Cloudflare Worker foundation"
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
- **Canonical authority:** Current explicit user instructions, then repository source-of-truth documents distilled from the supplied planning material.
- **Governed scope:** Phase 1 complete and Phase 2 advanced using a mock Cartographer.
- **Explicitly not governed:** Paid-model integration, production access secret, production voice transcription, real Greyson campaign content, 3D/native/account systems.

## 2. Current Baseline

- **Primary artifact:** `westkitty/AtlasOfOne` on `main`.
- **Baseline state:** `partially-verified` — source, automated deterministic behavior, IndexedDB unit behavior, and production build are verified; real-browser/mobile/PWA install behavior is not yet verified.
- **Source/build identity:** implementation commit `0f90ade85a5d55509774701aea8149a56e0323b4`; GitHub Actions run `34127513805` passed install, tests, and production build.
- **Active default user route:** Map screen in source; browser journey remains implemented-unverified.
- **Delivery state:** GitHub repository; no Cloudflare production deployment asserted.

## 3. Artifact Contract

The current artifact contains the requested source-of-truth documents, React/TypeScript/Vite/Cloudflare/Dexie/Zod/PWA/Vitest stack, four-screen mobile shell, deterministic campaign engine, automatic local persistence, import/export/delete foundations, mock Cartographer, synthetic fixtures, and CI. No paid AI is connected.

## 4. Active Invariants

- **INV-001:** Model output never owns game progression.
- **INV-002:** PASS, PRIVATE, STOP, SERIOUS, HELP, and sass controls remain available independently of progression.
- **INV-003:** Private topics are not intentionally revisited by the mock selector.
- **INV-004:** Quiet/serious presentation suppresses celebratory UI while retaining state progress.
- **INV-005:** Campaign persistence is local-first and versioned.
- **INV-006:** No real Greyson answers/private transcripts enter source or synthetic tests.
- **INV-007:** No provider/access secret is committed.
- **INV-008:** No D1, KV, R2, analytics, accounts, SSR, Next.js, native wrapper, or 3D infrastructure is introduced.
- **INV-009:** Supplied Greyson assets remain canonical; missing assets are not fabricated as canon.

## 5. Verified Working Behavior

- **VER-001:** GitHub Actions installed dependencies successfully on Node 22.
- **VER-002:** 15 synthetic tests across game, model contract, persistence transfer, and IndexedDB passed on commit `0f90ade...`.
- **VER-003:** `npm run build` passed with Cloudflare Vite plugin; both Worker and client production bundles were generated.
- **VER-004:** PWA build generated a manifest, service worker, and six precache entries.
- **VER-005:** Model-contract tests prove extra progression-looking fields (`xp`, `level`, quest completion, unlocks) are not accepted into parsed Cartographer output.
- **VER-006:** Tests prove PRIVATE filtering, quiet-state progression, deterministic XP/levels/territory coverage, evidence retraction, duplicate-evidence XP protection, import validation, and IndexedDB save/restore/delete.

## 6. Known Not Working

No confirmed defect remains from the first CI gate. Real AI and production voice are intentionally not implemented in this phase.

## 7. Implemented but Unverified

- **UNV-001:** Real-browser Map/Talk/Vault/Me user journey and responsive layout.
- **UNV-002:** Automatic IndexedDB hydration/autosave through an actual browser reload rather than fake IndexedDB unit proof.
- **UNV-003:** PWA installability/offline behavior on Android/mobile browser.
- **UNV-004:** Worker `/api/health` behavior in a running Vite/Cloudflare dev or deployed runtime.
- **UNV-005:** Export download and file-picker import through an actual browser.

## 8. Unknown or Evidence-Stale State

- **UNK-001:** Canonical Greyson image files referenced by the source are not present in the accessible repository/attachment set. Canonical slots are documented under `public/assets/greyson/` and the UI uses a non-canonical fallback glyph.
- **UNK-002:** The available source requires all territories/levels but does not enumerate canonical names/details for each; political dimensions and a Level 8 reveal are explicit. Bootstrap labels/thresholds are reversible and documented as non-canonical defaults.

## 9. Pending Work

- **PND-001:** Finish Phase 2 browser-runtime proof and remaining mock-game depth (notably richer Boss Fight/Mystery Door mechanics rather than unlock labels alone).
- **PND-002:** Phase 3 real Cartographer provider, context compiler, evidence-model integration, and provider failure states.
- **PND-003:** Phase 4 voice state machine, access gate, Cloudflare deployment, and real-device PWA checks.
- **PND-004:** Phase 5 adversarial release QA and final assessment.
- **PND-005:** Add canonical Greyson binary assets when actually supplied.

## 10. Active Decisions, Defaults, and Prohibitions

- **DEC-001:** React + TypeScript + Vite + Cloudflare Vite plugin + Worker + Dexie + Zod + PWA + Vitest.
- **DEC-002:** Local `MockCartographer` is the only Cartographer implementation in Phase 1/2.
- **DEC-003:** No paid AI service is connected.
- **DEC-004:** Campaign `schemaVersion` starts at `1` with an explicit migration boundary.
- **DEC-005:** Bootstrap territory labels and numeric Level 1–8 thresholds are source-derived implementation defaults, not invented canon declarations.

## 11. Validation and Evidence Matrix

| ID | Claim or behavior | State | Evidence | Validation method | Artifact/revision | Last checked | Recheck trigger |
|---|---|---|---|---|---|---|---|
| INV-001 | Model cannot mutate progression | verified | model schema + engine test | Vitest | `0f90ade`, rev 2 | 2026-09-07 | model/game contract changes |
| INV-002 | Core controls not gated | partially-verified | source + CORE_COMMANDS test | source + Vitest; browser pending | `0f90ade`, rev 2 | 2026-09-07 | action-bar changes |
| INV-003 | PRIVATE filtered by mock | verified | game test | Vitest | `0f90ade`, rev 2 | 2026-09-07 | prompt selection changes |
| INV-004 | quiet retains progress | verified | game test + source | Vitest | `0f90ade`, rev 2 | 2026-09-07 | presentation changes |
| INV-005 | versioned local persistence | partially-verified | schema/migration + fake IndexedDB test | Vitest; real reload pending | `0f90ade`, rev 2 | 2026-09-07 | persistence changes |
| BUILD-001 | production build succeeds | verified | Actions run `34127513805` | `npm run build` | `0f90ade`, rev 2 | 2026-09-07 | dependency/build changes |

## 12. Current Change Scope and Impact Radius

- **Allowed to change:** Phase 1/2 implementation surfaces.
- **Must remain unchanged:** privacy, deterministic progression authority, always-available agency controls, source gap labels, and explicit non-goals.
- **Potentially affected behavior:** mock campaign progression, local state persistence, mobile UI, PWA build.
- **Mandatory checks:** synthetic tests, production build, repository secret/private-data scan; browser runtime checks when a browser runtime is available.
- **Repair class:** Greenfield bounded implementation.

## 13. Compact Revision Log

### Revision 2 — 2026-09-07

- **Artifact/source identity:** implementation commit `0f90ade85a5d55509774701aea8149a56e0323b4`.
- **State deltas:** Phase 1 source/docs/app/test foundation implemented; Phase 2 deterministic game/persistence substantially advanced.
- **New evidence:** Actions run `34127513805` passed dependency install, 15 tests, production Worker/client builds, and PWA generation.
- **Validation not performed:** actual mobile/browser interaction, reload, PWA install/offline, canonical Greyson assets, production deployment.
