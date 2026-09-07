# Operational State: Atlas of One

<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "atlas-of-one",
  "project_name": "Atlas of One",
  "project_root": ".",
  "artifact_path": null,
  "state_revision": 5,
  "last_updated": "2026-09-07",
  "current_baseline": {
    "identity": "c0dc714",
    "state": "partially-verified",
    "last_verified": "2026-09-07"
  },
  "scope_boundaries": [
    "mobile-first React/TypeScript PWA, deterministic campaign engine, deterministic Boss Fight and Mystery Door encounters, local persistence, mock Cartographer, browser-runtime journey proof, canonical Aerron/Greyson map assets, Cloudflare Worker foundation"
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
- **Code baseline:** `c0dc714`. Revision 5 is documented in the immediately following docs-only commit, which changes no code, so the validation evidence below still describes the current tree.
- **Baseline state:** `partially-verified` — source, deterministic behavior, synthetic 100-turn campaign behavior, deterministic Boss Fight/Mystery Door behavior, IndexedDB unit behavior, canonical map-asset structure/dimensions, production build, and the desktop-Chrome browser journey are verified; mobile-device and PWA install/offline behavior remain unverified.
- **Validation identity:** local run on `c0dc714`: 55 unit tests, 25 browser-runtime tests in installed Chrome against the production bundle, and a passing production Worker/client/PWA build. The prior CI identity for the 18-test baseline was Actions run `34129810055`.
- **Active default user route:** Map screen, verified in a real browser.
- **Delivery state:** GitHub repository; no Cloudflare production deployment asserted.

## 3. Artifact Contract

The current artifact contains the requested source-of-truth documents, React/TypeScript/Vite/Cloudflare/Dexie/Zod/PWA/Vitest stack, four-screen mobile shell, deterministic campaign engine, deterministic Boss Fight and Mystery Door encounters in `src/game/encounters.ts`, automatic local persistence, import/export/delete foundations, mock Cartographer, synthetic fixtures, a sustained 100-turn campaign test, a real-browser journey suite, curated canonical Aerron/Greyson map sprites, and CI. No paid AI is connected.

The only dependency added in this pass is the `playwright-core` devDependency, driven with `channel: "chrome"` so no browser binary is downloaded and nothing enters the production bundle. Runtime dependencies remain `dexie`, `react`, `react-dom`, `zod`.

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
- **INV-011:** Boss Fight availability, stage plan, progress, completion, XP reward and achievement are owned by `src/game/encounters.ts` and the engine. The Cartographer supplies stage wording only and has no pathway to start, advance, complete or reward a Boss Fight.
- **INV-012:** Mystery Door eligibility, pairing, opening, completion and reward are owned by the same deterministic layer. A Door is built only from active, non-private evidence on both sides.
- **INV-013:** A Mystery Door never exposes PRIVATE material and never requires a private topic to open or complete. Marking a topic private, or retracting its source answer, retires any unresolved encounter that leaned on it.
- **INV-014:** Neither encounter can trap the player. PASS resolves a stage at no XP cost, withdrawal preserves progress, STOP blocks submission until resumed, and Doors may be left closed indefinitely without blocking campaign completion.
- **INV-015:** Encounter answers earn exactly the ordinary accepted-answer XP. No bonus exists anywhere for difficulty, vulnerability or painful disclosure.

## 5. Verified Working Behavior

- **VER-001:** GitHub Actions installed dependencies successfully on Node 22.
- **VER-002:** 55 synthetic unit tests across assets, game, sustained campaign, Boss Fight, Mystery Door, model contract, persistence transfer, encounter persistence, and IndexedDB passed on code baseline `c0dc714` (18 of these are the prior baseline suite, still passing unchanged).
- **VER-003:** The sustained synthetic campaign test executes 100 turns, deeply charts every bootstrap territory, creates exactly one map fragment per territory, reaches Level 8, completes bootstrap quests, and unlocks all bootstrap abilities without a real AI provider.
- **VER-004:** `npm run build` passed with the Cloudflare Vite plugin; both Worker and client production bundles were generated.
- **VER-005:** PWA build generated a manifest, service worker, and 11 precache entries, including all five canonical runtime map sprites.
- **VER-006:** Model-contract tests prove extra progression-looking fields (`xp`, `level`, quest completion, unlocks) do not enter parsed Cartographer output.
- **VER-007:** Tests prove PRIVATE filtering, quiet-state progression, deterministic XP/levels/territory coverage, evidence retraction, duplicate-evidence XP protection, import validation, and IndexedDB save/restore/delete.
- **VER-008:** Asset tests prove the curated Greyson map set contains exactly five 48×64 PNG sprite slots and no Andrew-named file inside the Greyson asset tree.
- **VER-009:** Repository asset manifest records byte-level source provenance and SHA-256 values for the five runtime Aerron sprites plus the canonical detailed turnaround source.
- **VER-010:** Boss Fight tests prove availability derives from level plus non-private territory coverage, that the three-stage plan is built only from evidence the player already produced and is identical for identical state, that completion pays the fixed reward exactly once, that forged `ACHIEVEMENT_UNLOCKED`/`ABILITY_UNLOCKED`/`LEVEL_UP` events change nothing, that PASS costs no XP, that withdrawal preserves stage progress, that STOP blocks submission, that a PRIVATE topic retires pending stages built on it, that completion occurs in quiet mode, and that a painful framing earns no bonus.
- **VER-011:** Mystery Door tests prove eligibility requires evidence on both sides and the required level, that identifiers are stable and order-independent, that doors are built from real evidence relationships rather than question count, that private material never enters a door and is never required to open or complete one, that an open door is retired when its material becomes private or its source answer is retracted, that the fixed reward and crossing insight are granted only by engine completion, that forged model-shaped events grant nothing, and that a campaign can deeply chart every territory and complete with zero doors opened.
- **VER-012:** Encounter persistence tests prove boss and door state round-trips through export/import and through IndexedDB without loss, that stage and door identifiers survive the round trip, that schema-v1 campaigns predating these fields default cleanly, and that malformed encounter data is still rejected.
- **VER-013:** A real-browser journey in installed Chrome against the production bundle passed 13 checks covering the required user path: loads on Map; canonical sprite decoded at 48×64 with `image-rendering: pixelated`; Map→Talk→Vault→Me→Map navigation; synthetic answer producing the deterministic +13 XP; full page reload restoring XP and level from IndexedDB; PASS costing no XP; PRIVATE excluding a dimension from subsequent mock selection; STOP disabling the input and submit button until resumed; SERIOUS entering quiet presentation, continuing to progress across eight further turns, and never raising a celebratory overlay; sass adjustable at every setting while quiet; export download, local delete, and re-import producing materially matching `campaignId`, `xp`, `level`, `evidence`, `turns`, `privateTopics` and `territories`; a 320×640 viewport with no horizontal overflow and four ≥44px navigation targets; and zero page errors or unhandled rejections.
- **VER-014:** A real-browser encounter suite passed 12 checks proving Boss Fights and Mystery Doors are playable end to end in Chrome: offers appear from mapped state, stages cite already-mapped evidence, all six permanent controls are present and enabled inside both encounter types, STOP blocks submission inside an encounter, stepping back preserves progress and the Map advertises the kept run, completion pays the fixed rewards (+40 boss, +20 door) and records the `Held the Line` and `Door Opener` achievements and a `Crossing:` insight in the Vault, resolved encounters are not offered again, and results survive a page reload.
- **VER-015:** Visual inspection of real Chrome screenshots at a 390×844 phone viewport confirms the canonical Greyson sprite renders sharp and correctly scaled on the Map, and that Boss Fight and Mystery Door screens present the player's own mapped evidence with the permanent control bar intact.
- **VER-016:** The five canonical runtime sprites are byte-identical (SHA-256) to baseline `a50ffe4`, no Andrew-named file exists anywhere under `public/`, no secret or token is committed, no D1/KV/R2/analytics/auth/SSR/Next.js/native/3D dependency or config was introduced, runtime dependencies remain `dexie`/`react`/`react-dom`/`zod`, and `playwright-core` does not appear in either production bundle.

## 6. Known Not Working

No confirmed defect remains from automated Phase 1/2 validation. Real AI and production voice are intentionally not implemented in this phase.

## 7. Implemented but Unverified

UNV-001, UNV-002, UNV-005 and UNV-006 were exercised in a real browser and are promoted to VER-013 through VER-015. The following remain genuinely unverified.

- **UNV-003:** PWA installability and offline behavior on Android or any real mobile browser. The journey ran in desktop Chrome at emulated phone viewports; no service-worker offline path, install prompt or device was exercised.
- **UNV-004:** Worker `/api/health` and `/api/turn` behavior in a running Vite/Cloudflare dev or deployed runtime. The browser journey deliberately serves the built client over a plain static host, so no Worker code executed.
- **UNV-007:** Behavior on any browser other than installed desktop Chrome. Safari, Firefox and mobile engines are unexercised.
- **UNV-008:** The browser journey is not wired into CI; it currently requires a local machine with Chrome installed and is run on demand via `npm run test:browser`. CI still validates only the 55 unit tests and the production build.
- **UNV-009:** Real-device touch ergonomics. Touch-target sizes were measured geometrically, not tested by hand.
- **UNV-010:** Boss Fight and Mystery Door pacing and difficulty as an actual play experience. Correctness is proven; whether the encounters feel like a concentrated synthesis test to a player has not been observed.

## 8. Unknown or Evidence-Stale State

- **UNK-002:** The available source requires all territories/levels but does not enumerate canonical names/details for each; political dimensions and a Level 8 reveal are explicit. Bootstrap labels/thresholds are reversible and documented as non-canonical defaults.

## 9. Pending Work

- **PND-001:** Closed. The browser-runtime proof exists and deterministic Boss Fight and Mystery Door flows are implemented, tested and played in a real browser.
- **PND-006:** Extend encounter coverage: Boss Fights exist for four of eight territories, and Doors present at most three candidate pairings on the Map. Relationships, Interests and Future have no Boss Fight yet.
- **PND-007:** Decide whether to run the browser journey in CI (GitHub's Ubuntu runners ship Chrome) or keep it a local gate, and record the decision.
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
- **DEC-008:** The browser-runtime proof uses `playwright-core` driven with `channel: "chrome"` against the installed browser, so no browser binary is downloaded, and runs on the existing Vitest runner rather than adding a second test framework. It is excluded from `npm test` and invoked by `npm run test:browser`, which builds first.
- **DEC-009:** The browser journey serves the built client from a dependency-free static host in `tests/browser/server.ts`. The campaign engine and MockCartographer are entirely client-side, so exercising the Worker is not required to prove the user journey — and is recorded as UNV-004 rather than implied.
- **DEC-010:** Only one encounter runs at a time. Starting a Boss Fight or opening a Door is refused while another encounter is active, which keeps the active-encounter state single-authority and unambiguous.
- **DEC-011:** Boss stage plans and Door pairings are stored as skeletons — kind, dimensions and evidence ids — and their wording is rendered from the mock at display time. No model-authored text is persisted as game state.
- **DEC-012:** Fields added to schema v1 after its first release are additive and carry Zod defaults, so earlier exports still import. A change that alters or removes an existing v1 field must instead raise `CURRENT_SCHEMA_VERSION`. This policy is recorded in `src/persistence/migrations.ts`.
- **DEC-013:** `package-lock.json` remains untracked, matching the repository's existing convention and the CI workflow's use of `npm install`.

## 11. Validation and Evidence Matrix

| ID | Claim or behavior | State | Evidence | Validation method | Artifact/revision | Last checked | Recheck trigger |
|---|---|---|---|---|---|---|---|
| INV-001 | Model cannot mutate progression | verified | model schema + engine + encounter tests | Vitest | `c0dc714`, rev 5 | 2026-09-07 | model/game contract changes |
| INV-002 | Core controls not progression-gated | verified | shared control bar exercised in ordinary, boss and door encounters | Vitest + browser | `c0dc714`, rev 5 | 2026-09-07 | action-bar changes |
| INV-003 | PRIVATE filtered by mock | verified | game test + browser PRIVATE check | Vitest + browser | `c0dc714`, rev 5 | 2026-09-07 | prompt selection changes |
| INV-004 | quiet retains progress | verified | game test + browser quiet-mode check | Vitest + browser | `c0dc714`, rev 5 | 2026-09-07 | presentation changes |
| INV-005 | versioned local persistence | verified | schema/migration, fake IndexedDB, and real browser reload | Vitest + browser | `c0dc714`, rev 5 | 2026-09-07 | persistence changes |
| GAME-001 | sustained mock campaign reaches end-state safely | verified | 100-turn campaign test | Vitest | `c0dc714`, rev 5 | 2026-09-07 | progression changes |
| ASSET-001 | only canonical Aerron/Greyson runtime sprites ship in Greyson tree | verified | asset manifest, asset tests, SHA-256 match to `a50ffe4` | source + Vitest | `c0dc714`, rev 5 | 2026-09-07 | asset changes |
| ASSET-002 | canonical sprite looks correct in real Map/Me UI | verified | Chrome screenshots + decoded 48×64 pixelated check | browser visual inspection | `c0dc714`, rev 5 | 2026-09-07 | sprite/CSS changes |
| BUILD-001 | production build succeeds | verified | Worker+client+PWA, 11 precache entries | `npm run build` | `c0dc714`, rev 5 | 2026-09-07 | dependency/build changes |
| INV-011 | engine owns Boss Fight outcome | verified | boss-fight.test.ts forged-event and reward tests | Vitest | `c0dc714`, rev 5 | 2026-09-07 | encounter/engine changes |
| INV-012 | engine owns Mystery Door outcome | verified | mystery-door.test.ts forged-event and reward tests | Vitest | `c0dc714`, rev 5 | 2026-09-07 | encounter/engine changes |
| INV-013 | no PRIVATE leak through a Door | verified | mystery-door.test.ts privacy suite | Vitest | `c0dc714`, rev 5 | 2026-09-07 | encounter/privacy changes |
| INV-014 | encounters never trap the player | verified | PASS/withdraw/STOP/never-required tests | Vitest + browser | `c0dc714`, rev 5 | 2026-09-07 | encounter/control changes |
| INV-015 | no XP bonus for painful disclosure | verified | equal-length neutral vs painful answer tests | Vitest | `c0dc714`, rev 5 | 2026-09-07 | XP rule changes |
| BROWSER-001 | required user journey works in a real browser | verified | journey.test.ts, 13 checks in Chrome | playwright-core + Vitest | `c0dc714`, rev 5 | 2026-09-07 | UI/persistence changes |
| BROWSER-002 | reload restores campaign from IndexedDB | verified | journey.test.ts reload check | playwright-core + Vitest | `c0dc714`, rev 5 | 2026-09-07 | persistence changes |
| BROWSER-003 | encounters playable with controls intact | verified | encounters.test.ts, 12 checks in Chrome | playwright-core + Vitest | `c0dc714`, rev 5 | 2026-09-07 | encounter UI changes |
| BROWSER-004 | mobile device and PWA install/offline | implemented-unverified | none | real-device check | `c0dc714`, rev 5 | 2026-09-07 | device availability |
| BROWSER-005 | non-Chrome browser behavior | implemented-unverified | none | cross-browser check | `c0dc714`, rev 5 | 2026-09-07 | browser support work |
| WORKER-001 | Worker `/api/health` at runtime | implemented-unverified | source only | dev/deployed runtime check | `c0dc714`, rev 5 | 2026-09-07 | Worker changes |

## 12. Current Change Scope and Impact Radius

- **Allowed to change next:** Remaining encounter breadth (PND-006), CI decision for the browser journey (PND-007), then Phase 3 provider work.
- **Must remain unchanged:** privacy, deterministic progression authority including encounter outcomes, always-available agency controls inside every encounter type, the no-PRIVATE-leak rule for Doors, Aerron→Greyson canonical asset mapping, Andrew-asset exclusion, source gap labels, and explicit non-goals.
- **Potentially affected behavior:** mock campaign progression, local state persistence, mobile UI, PWA build, canonical sprite presentation.
- **Mandatory checks:** synthetic tests, production build, repository secret/private-data scan; browser/runtime checks when available.
- **Repair class:** Greenfield bounded implementation.

## 13. Compact Revision Log

### Revision 5 — 2026-09-07

- **Artifact/source identity:** code baseline `c0dc714`.
- **State deltas:** Boss Fight and Mystery Door became real deterministic gameplay owned by `src/game/encounters.ts` rather than unlock labels. `CampaignState` gained `bossRuns`, `activeBoss`, `doorRuns` and `activeDoor`, additive within schema v1 with Zod defaults. A shared permanent-control bar now serves ordinary encounters and both encounter types. A browser-runtime proof was added and run. UNV-001, UNV-002, UNV-005 and UNV-006 were promoted to verified; PND-001 closed.
- **New evidence:** 55 unit tests and 25 real-browser tests passed on this baseline, plus a passing Worker/client/PWA production build and a visual screenshot inspection of the Map, Boss Fight and Mystery Door screens in Chrome at a 390×844 viewport.
- **Defects found and fixed during this pass:** the Greyson asset invariant test compared absolute paths, so it passed or failed on the checkout directory name rather than on asset names; `BOSS_STARTED` discarded an in-progress run instead of resuming it after withdrawal; the Map offered no way to see or resume a withdrawn Boss Fight.
- **Validation not performed:** real mobile device, PWA installation/offline journey, any non-Chrome browser, Worker runtime execution, production deployment, and play-feel of the new encounters.

### Revision 4 — 2026-09-07

- **Artifact/source identity:** code baseline `a50ffe4619e9856208e602e0bd99e72f886a2d78`.
- **State deltas:** Accepted asset mapping propagated: Aerron is Greyson's former code name; five canonical Aerron game-ready sprites curated into runtime; Andrew assets explicitly excluded; old missing-asset unknown resolved.
- **New evidence:** Actions run `34129810055` passed dependency install, 18 tests including two asset invariants, production Worker/client builds, and PWA generation with 11 precache entries.
- **Validation not performed:** actual mobile/browser interaction, real reload, PWA installation/offline journey, visual sprite rendering in target browser, production deployment.
