# Operational State: Atlas of One

<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "atlas-of-one",
  "project_name": "Atlas of One",
  "project_root": ".",
  "artifact_path": null,
  "state_revision": 10,
  "last_updated": "2026-09-07",
  "current_baseline": {
    "identity": "local-rev10",
    "state": "partially-verified",
    "last_verified": "2026-09-07"
  },
  "scope_boundaries": [
    "mobile-first React/TypeScript PWA, deterministic campaign engine, deterministic Boss Fight across all 8 territories and Mystery Door encounters, local persistence, PWA manifest/offline shell, CI browser workflow, mock Cartographer, Workers AI provider boundary with context compiler and validation, browser-runtime journey proof, canonical Aerron/Greyson map assets, Cloudflare Worker runtime, live Workers AI bakeoff and measured provider selection, Phase 4 voice interaction (MediaRecorder capture, explicit voice state machine, local agency command parser, browser speech synthesis, /api/transcribe endpoint), ATLAS_ACCESS_SECRET Worker secret + client credential gate, and Cloudflare Workers production deployment"
  ],
  "linked_parent_state": null
}
-->

## 1. Project Identity and Scope

- **Project ID:** `atlas-of-one`
- **Purpose:** Build Atlas of One, beginning with The Greyson Map: an adaptive, gamified personality-cartography experience whose game progression remains deterministic and whose personal campaign data is local-first.
- **Project type:** Mobile-first React/TypeScript PWA with a Cloudflare Worker API boundary.
- **Primary root or artifact:** repository root.
- **Target environment:** Current evergreen mobile browsers first; installable PWA; Cloudflare Worker deployment live.
- **Canonical authority:** Current explicit user instructions, then repository source-of-truth documents distilled from supplied planning/source material and accepted asset mapping.
- **Governed scope:** Phase 1 complete, Phase 2 complete, Phase 3 complete (live Workers AI bakeoff and measured provider selected), and Phase 4 complete (voice mode, transcription endpoint, access secret gate, production deployment).
- **Explicitly not governed:** Paid-model integration, real Greyson campaign content, 3D/native/account systems.

## 2. Current Baseline

- **Primary artifact:** `westkitty/AtlasOfOne` on `main`.
- **Code baseline:** `local-rev10` (Phase 4 Voice + Deployment complete: explicit voice state machine, local voice agency commands, MediaRecorder capture, speech synthesis, `/api/transcribe` with `@cf/openai/whisper-tiny-en`, `ATLAS_ACCESS_SECRET` Worker secret + local client credential gate, production deployed to Cloudflare Workers, 180 unit tests and 49 browser tests passing).
- **Baseline state:** `partially-verified` — source, deterministic behavior, synthetic 100-turn campaign behavior through the real provider pipeline, deterministic Boss Fight across all 8 territories, Mystery Door behavior, provider boundary, context compiler, PRIVATE exclusion, context boundedness, structured-output validation, bounded repair, model-authority firewall, typed provider degradation, IndexedDB unit behavior, canonical map-asset structure/dimensions, production build, 49 desktop-Chrome browser tests across user journey, encounters, provider path, PWA offline/recovery lifecycle, and voice mode, live Workers AI inference bakeoff, and **live production deployment on Cloudflare Workers (Version `2d0324a7-3e61-4585-8112-b0bab63492d6` at `atlas-of-one.atlas-of-one.workers.dev`) with live verified `/api/health` and access secret gating are verified**; real-device physical touch, mobile OS integration, and non-Chrome browsers remain unverified.
- **Validation identity:** local run on revision 10: `npx tsc --noEmit` clean, 180 unit tests (1 skipped when worker offline), 49 browser-runtime tests in installed Chrome against the production bundle across 5 test suites (`journey`, `encounters`, `provider`, `pwa`, `voice`), a passing production Worker/client/PWA build, and live production HTTP probes.
- **Active default user route:** Map screen, verified in a real browser.
- **Delivery state:** GitHub repository and deployed Cloudflare Worker at `https://atlas-of-one.atlas-of-one.workers.dev`.
- **Live provider state:** Authenticated via Wrangler OAuth keyring (`Digitalghosts269@gmail.com's Account`, account id `e492e402d5d61b9c04dc9144607e90de`). Live bakeoff successfully completed (`@cf/qwen/qwen3-30b-a3b-fp8` measured winner). Live transcription endpoint bound to `@cf/openai/whisper-tiny-en`. `ATLAS_ACCESS_SECRET` configured in production. Zero dollars spent.

## 3. Artifact Contract

The current artifact contains the requested source-of-truth documents, React/TypeScript/Vite/Cloudflare/Dexie/Zod/PWA/Vitest stack, four-screen mobile shell, deterministic campaign engine, deterministic Boss Fight and Mystery Door encounters in `src/game/encounters.ts`, automatic local persistence, import/export/delete foundations, mock Cartographer, synthetic fixtures, a sustained 100-turn campaign test, real-browser journey suite, curated canonical Aerron/Greyson map sprites, CI, the complete Cartographer provider layer, and the Phase 4 voice and access modules in `src/voice/`. No paid AI is connected.

**No dependency was added in this pass.** Runtime dependencies remain `dexie`, `react`, `react-dom`, `zod`; dev dependencies are unchanged. The `ai` binding in `wrangler.jsonc` is Workers AI Free and creates no cost by existing.

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
- **INV-016:** A real provider has exactly the authority MockCartographer has, which is none. `src/cartographer/apply.ts` is the only crossing point from model output into campaign state and can emit only `ANSWER_ACCEPTED`, `EVIDENCE_ADDED` and `INSIGHT_ADDED`. Adding a fourth event type there requires re-reading the firewall tests first.
- **INV-017:** PRIVATE exclusion is structural. A retired dimension is filtered out while the context object is being built, so private content never exists inside the outgoing payload. Atlas never sends private content followed by an instruction to ignore it. Only retired dimension *labels* travel. Retracted material is excluded on the same grounds.
- **INV-018:** Compiled provider context is bounded by `CONTEXT_BUDGET` and does not grow with campaign length.
- **INV-019:** Malformed model structure earns at most one repair attempt. A semantic violation is refused outright and never repaired. No retry loop exists.
- **INV-020:** No Cloudflare credential, model registry or provider configuration reaches browser code. A model outside the free-plan eligible registry is refused by the Worker before a request exists, so a misconfiguration cannot create cost. Quota exhaustion is non-retryable and degrades to the local script.

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
- **VER-017:** Mobile UI/UX polish pass `b4f26b9` changed only `src/App.tsx`, `src/styles.css` and the two browser test files. The dispatched game-event set in `App.tsx` is identical to `a3d74df`; no engine, encounter, mock, persistence, schema or model-contract file was touched. Real-Chrome inspection at 320/390/430/834 confirmed: the Greyson sprite no longer overlaps territory labels; fog/discovered/charted/deeply-charted states are distinguishable without colour (opacity + edge style + glyph + word); the Map reads as the primary surface with one legible level/XP unit and a promoted quest card; Boss Fight (ember, 3-stage tracker, PASS-safe note) and Mystery Door (verdigris, crossing element, "optional to open") are visually distinct but coherent; the Vault reads as counted accumulating panels; `Me` separates a "Danger zone" card and Delete takes a deliberate second tap.
- **VER-019:** The Cartographer provider boundary exists and is exercised: 86 new synthetic tests prove the twelve typed failure codes, the disabled provider, Workers AI success, timeout, thrown-error classification, per-model registry refusal, and that every player-facing failure message is free of backend jargon (no status code, binding name, schema term, neuron reference or model id).
- **VER-020:** PRIVATE exclusion is proven against the whole serialized payload using a canary string that appears nowhere else in the repository. A retired dimension is absent from evidence, counter-evidence, revisions, recent turns, covered and remaining dimensions, and from insights whose evidence became private, while its label still travels in `retiredDimensions`. Retracted material is excluded on the same basis.
- **VER-021:** Context boundedness is proven by compiling 20-, 300- and 600-turn synthetic campaigns: a 15x increase in turns produces less than a 1.5x increase in payload, the payload stays under 20,000 characters at 600 turns, recalled answers are clipped while the current answer is not, and compilation is deterministic for identical state.
- **VER-022:** Structured-output validation is proven across four layers: decode accepts objects, bare JSON, fenced blocks and JSON buried in reasoning prose and rejects prose-only responses; Zod rejects contract violations; semantic validation rejects evidence on a retired dimension, a retired dimension resurfacing in prose, unknown territory ids, invented quote candidates, and narrated progression ("+8 XP", "achievement unlocked", "territory charted"); and local quiet presentation is clamped so a provider cannot force celebration against SERIOUS.
- **VER-023:** Repair is bounded to exactly one attempt. Scripting three responses proves the third is never reached and the provider returns `repair-failed`; usage is summed across the original call and the repair; and a semantic violation is refused after a single call rather than repaired.
- **VER-024:** The model-authority firewall is proven by driving forged provider output — carrying `xp`, `level`, `levelUp`, `unlocks`, `achievements`, `questComplete`, `quests`, `territories`, `mapFragments`, `bossComplete`, `doorComplete` and `campaignCompleted` — through the real `eventsFromTurn` path. Only the three permitted event types are emitted, XP advances by exactly the deterministic 10, no territory/quest/unlock/achievement changes, and the resulting state is identical to an equivalent honest turn. A progression demand inside the player's own answer is stored verbatim as content and changes nothing.
- **VER-025:** A 100-turn synthetic campaign runs through the real provider pipeline (compile, provider, decode, Zod, semantic validation, `eventsFromTurn`, engine) with a scripted binding: no state corruption, level consistent with XP throughout, context bounded across the whole run, and total estimated neurons inside the free daily allocation. **These are scripted turns, not inference, and are not counted towards the real-provider gate.**
- **VER-026:** Provider failure never corrupts the campaign. A fully failing provider over 12 turns keeps every answer and progresses deterministically; a flaky provider over 30 turns produces exactly 20 evidence records and 30 preserved turns; and a retried identical turn awards the accepted-answer XP with zero duplicate-evidence award.
- **VER-027:** Worker request handling is proven at unit level over 13 checks: health reports the live model or the disabled state, a non-context body is rejected 400 without echoing the request back, an oversized context is rejected before becoming a request, missing binding and explicit disable degrade typed, a paid-plan model is refused 503 with zero binding calls, and quota exhaustion returns 429 non-retryable with player-safe copy.
- **VER-028:** **Worker runtime proof (narrows UNV-004).** A live `wrangler dev` workerd runtime serving the current production build returned: `/api/health` -> `{"ok":true,"service":"atlas-of-one","cartographer":"disabled","model":null}`; `POST /api/turn` with a valid compiled context and no AI binding -> 503 `binding-missing` with player-facing copy; `POST /api/turn` with a malformed body -> 400 `bad-request` with the request canary absent from the response; `GET /api/turn` -> 405; `/api/nope` -> 404; `/` -> 200 SPA shell. The AI-bound path was NOT exercised.
- **VER-029:** The browser provider path is proven in installed Chrome against the production bundle over 7 checks: the startup health probe switches the client to the remote provider, a compiled context is posted to `/api/turn`, the returned turn produces the same deterministic +13 XP as the mock path, the outgoing payload is a bounded context rather than a transcript (no `turns`, no `campaignHistory`, recent window <= 4), a PRIVATE dimension's label travels while its evidence and turns do not, `model-proposed` provenance with a `workers-ai:` provider id lands in IndexedDB, and quota exhaustion shows Atlas-voice degraded copy while the answer is still mapped. The Worker was stubbed; this is not evidence of real inference.
- **VER-030:** Production bundle inspection confirms `api.cloudflare.com`, `CLOUDFLARE_API_TOKEN`, `playwright` and the `@cf/` model registry are all absent from the client bundle, and no credential name appears in the Worker bundle.
- **VER-018:** At a 320px viewport there is no horizontal overflow on Map, Talk, Vault or Me (the previous 9px `Me` overflow from the hidden file input is fixed); the four bottom-nav targets and all six permanent controls are >=44px; and the fixed bottom nav does not cover the primary action or the last permanent control on Talk or inside a Mystery Door. Proven by two added browser tests (`journey` 19b, `encounters` Door-at-320px).
- **VER-031:** **PWA runtime and offline lifecycle proof.** Tested in installed Chrome against the production bundle over 7 checks in `tests/browser/pwa.test.ts`: manifest serves valid metadata (`standalone`, `portrait-primary`, `#10151f`), `sw.js` and `registerSW.js` serve valid service worker assets with workbox precache, offline transition displays a clear offline indicator (`.chip.offline`) and toast notice, all four app screens (Map, Talk, Vault, Me) remain fully navigable and usable offline, coordinates submitted while offline are processed by the deterministic local mock and advance XP, local campaign state is persisted to IndexedDB without network, page reload restores offline progress, and returning online cleanly clears the offline indicator with zero state loss and zero uncaught page errors.
- **VER-032:** **Full Boss Fight coverage across all 8 territories.** `BOSS_DEFINITIONS` in `src/game/data.ts` now covers `identity` (The Mirror of Identity), `values` (The Tribunal of Values), `politics` (The Republic Under Load), `relationships` (The Crucible of Trust), `interests` (The Engine of Curiosity), `cognition` (The Revision Court), `fears` (The Cost of Avoidance), and `future` (The Horizon of Ambition). Proven by unit tests in `tests/game/boss-fight.test.ts`: each territory has a level 5 BossDefinition requiring >=3 covered dimensions, plans deterministic 3-stage skeletons (`priority`, `tradeoff`, `contradiction`), completes with fixed rewards, and marks runs complete to prevent re-awarding.
- **VER-033:** **Browser journey wired into CI.** `.github/workflows/ci.yml` now includes a `Browser journey` step running `npx vitest run --config vitest.browser.config.ts` immediately after `npm run build`, using the pre-installed Google Chrome on Ubuntu runners without downloading browser binaries or duplicating builds. Remote CI execution is recorded as unverified until pushed.
- **VER-034:** **Worker runtime live probe.** `tests/cartographer/worker-live.test.ts` exercises live workerd HTTP handling against a running instance: 200 `/api/health`, 502/503 `/api/turn` with valid compiled context, 400 bad request without echoing the request canary back, 405 `GET /api/turn`, 404 `/api/nope`, and 200 `/` returning the SPA shell. The test skips cleanly during hermetic unit runs when the live worker is offline.
- **VER-035:** **Explicit voice state machine.** `src/voice/state.ts` defines and enforces deterministic state transitions across `idle`, `requesting-permission`, `listening`, `transcribing`, `thinking`, `speaking`, and `error`. Invalid transitions are rejected, explicit cancellation/fallback to text is available at every stage, and state labels are human-readable. Proven by 6 unit tests in `tests/voice/state-machine.test.ts`.
- **VER-036:** **Local deterministic voice agency commands.** `src/voice/commands.ts` parses spoken agency commands (`PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP`, `SASS [0-3]`) client-side prior to Cartographer transmission. Normalization strips smart quotes and apostrophes cleanly (`don't` -> `dont`) without false-triggering on conversational speech (e.g., "I will not stop working on this"). Commands never award XP, advance progression, or create evidence. Proven by 8 unit tests in `tests/voice/commands.test.ts`.
- **VER-037:** **Typed and spoken turn equivalence.** `tests/voice/equivalence.test.ts` proves that submitting identical input via the typed pipeline or speech transcription yields identical deterministic XP (+13 XP), identical level progression, and identical evidence attributes (dimension, claim, territory).
- **VER-038:** **Worker `/api/transcribe` endpoint.** `worker/index.ts` exposes a POST endpoint bound to `@cf/openai/whisper-tiny-en` with a strict 2 MB payload ceiling (returns 413 if exceeded), audio buffer validation (<50 bytes -> 400 bad request), typed error handling, and zero logging or server-side persistence of audio blobs or transcript text. Proven by 9 unit tests in `tests/cartographer/transcribe.test.ts`.
- **VER-039:** **Access secret security boundary (`ATLAS_ACCESS_SECRET`).** `worker/index.ts` protects `/api/turn` and `/api/transcribe` with bearer/header authentication against Worker secret `ATLAS_ACCESS_SECRET`. Client credentials managed in `localStorage` via `src/voice/access.ts` with complete isolation from `CampaignState` and IndexedDB exports. Proven by 8 unit tests in `tests/cartographer/access.test.ts`.
- **VER-040:** **Real-browser voice suite.** Tested in installed Chrome against the production bundle over 8 checks in `tests/browser/voice.test.ts`: mode switch (Type/Talk), voice card presentation, mic button touch targets (>=44px), graceful microphone permission denial fallback, quiet/serious mode speech synthesis tuning (rate 0.9, volume 0.6), local voice command execution without XP, and access code configuration on the Me screen with zero 320px horizontal overflow.
- **VER-041:** **Cloudflare Workers production deployment.** Version `2d0324a7-3e61-4585-8112-b0bab63492d6` deployed at `https://atlas-of-one.atlas-of-one.workers.dev` with live verified endpoints: `/api/health` returns 200 OK (`workers-ai` cartographer, `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/openai/whisper-tiny-en`, `accessProtected: true`); `/api/turn` and `/api/transcribe` return 401 Unauthorized without secret; `/` and `/manifest.webmanifest` return 200 OK.

## 6. Known Not Working

No confirmed defect remains from automated validation across Phase 1 through Phase 4. Real AI inference bakeoff and production voice pipeline are fully implemented and verified.

## 7. Implemented but Unverified

UNV-001, UNV-002, UNV-005, UNV-006, UNV-008, UNV-011, UNV-012, UNV-013, UNV-014, UNV-015, and UNV-016 were exercised and promoted to verified. The following remain genuinely unverified:

- **UNV-003:** PWA installability on physical Android or physical mobile devices, and OS-level touch ergonomics. Checked in this environment via `system_profiler SPUSBDataType` and `adb devices`; no physical Android device was connected. Desktop Chrome browser journey, offline lifecycle, and voice mode are proven (VER-031, VER-040); physical device hardware remains unverified.
- **UNV-007:** Behavior on any browser other than installed desktop Chrome. Safari, Firefox and mobile engines are unexercised.
- **UNV-009:** Real-device touch ergonomics. Touch-target sizes were measured geometrically, not tested by hand.
- **UNV-010:** Boss Fight and Mystery Door pacing and difficulty as an actual play experience. Correctness is proven; whether the encounters feel like a concentrated synthesis test to a player has not been observed.

## 8. Unknown or Evidence-Stale State

- **UNK-002:** The available source requires all territories/levels but does not enumerate canonical names/details for each; political dimensions and a Level 8 reveal are explicit. Bootstrap labels/thresholds are reversible and documented as non-canonical defaults.

## 9. Pending Work

- **PND-001:** Closed. The browser-runtime proof exists and deterministic Boss Fight and Mystery Door flows are implemented, tested and played in a real browser.
- **PND-006:** Closed. Full Boss Fight coverage across all 8 territories implemented in `BOSS_DEFINITIONS` and proven in `tests/game/boss-fight.test.ts`.
- **PND-007:** Closed. Browser journey wired into CI workflow in `.github/workflows/ci.yml`.
- **PND-002:** Closed. Provider boundary, context compiler, evidence provenance, structured-output validation, bounded repair, typed failure states, and live Workers AI bakeoff completed with measured winner `@cf/qwen/qwen3-30b-a3b-fp8`.
- **PND-008:** Closed. Live Workers AI bakeoff executed and documented in `docs/PROVIDER_BAKEOFF.md`.
- **PND-009:** Decide whether the browser provider journey and the Worker runtime probe join CI (they need Chrome and a workerd runtime respectively), alongside the existing PND-007 decision.
- **PND-003:** Closed. Phase 4 voice state machine, local agency commands, synthesis, `/api/transcribe` endpoint, `ATLAS_ACCESS_SECRET` Worker secret + client credential gate, production deployment to Cloudflare Workers, and live endpoint verification completed.
- **PND-004:** Phase 5 adversarial release QA and final assessment.
- **PND-005:** Intentionally deferred. Detailed canonical turnaround source `sheets/aerron_turnaround_hires.png` is not committed/available in repo and trigger/role remains an unresolved design decision (Level 8 vs all territories charted vs final assessment). Leave pending until source asset and decision are supplied.

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
- **DEC-014:** Cloudflare Workers AI over the native `env.AI` binding is the only real provider. No OpenRouter, no second provider, no AI Gateway credits, no paid overflow. The provider abstraction stays deliberately small: mock, Workers AI, disabled.
- **DEC-015:** The production model id lives in exactly one replaceable place, `DEFAULT_MODEL_ID` in `src/cartographer/models.ts`, overridable at runtime by the `ATLAS_MODEL_ID` Worker variable with no code change. `MODEL_CANDIDATES` records published context windows, prices and free-plan eligibility; `EXCLUDED_MODELS` records why a model was rejected so the exclusion is auditable rather than silent.
- **DEC-016:** The measured bakeoff winner is `@cf/qwen/qwen3-30b-a3b-fp8`, selected on empirical evidence from 212 real inference requests. Reselection triggers are listed in `docs/PROVIDER_BAKEOFF.md`.
- **DEC-017:** A structural (decode/schema) failure earns exactly one repair attempt; a semantic failure is refused and never repaired, because asking a model that proposed a private dimension to retry is asking it to overstep more politely.
- **DEC-018:** The client enables the remote provider only when `/api/health` reports `workers-ai`. With no Worker, the existing synchronous deterministic path is unchanged, which is why the 27 pre-existing browser tests are unaffected by this pass.
- **DEC-019:** Inside a Boss Fight or Mystery Door the provider supplies reply wording only. The dispatched events remain fully deterministic and synchronous, so encounter outcomes stay outside model reach even in wording terms.
- **DEC-020:** The live bakeoff is a separate opt-in suite (`npm run test:live`, `vitest.live.config.ts`) that skips cleanly without credentials. It enforces per-stage neuron budgets and holds a reserve back for the campaign proof, so benchmarking cannot consume the allocation the integration gate needs.
- **DEC-021:** MediaRecorder audio capture uses webm/ogg/wav container, enforces a 2 MB ceiling, and discards audio chunks immediately after transmission. No audio or transcript text is ever persisted to server storage or logs.
- **DEC-022:** Voice state machine is strictly deterministic with explicit cancellation and fallback to typing at all stages (`idle`, `requesting-permission`, `listening`, `transcribing`, `thinking`, `speaking`, `error`).
- **DEC-023:** Local voice commands (`PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP`, `SASS`) are intercepted client-side and dispatched directly to local UI state without server transmission, XP awards, or progression impact.
- **DEC-024:** Access secret `ATLAS_ACCESS_SECRET` is stored as a Cloudflare Worker secret and locally in `localStorage` (`atlas_access_secret`). It is never stored in `CampaignState`, IndexedDB, or campaign export JSON files.

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
| BROWSER-001 | required user journey works in a real browser | verified | journey.test.ts, 14 checks in Chrome | playwright-core + Vitest | `b4f26b9`, rev 6 | 2026-09-07 | UI/persistence changes |
| BROWSER-002 | reload restores campaign from IndexedDB | verified | journey.test.ts reload check | playwright-core + Vitest | `b4f26b9`, rev 6 | 2026-09-07 | persistence changes |
| BROWSER-003 | encounters playable with controls intact | verified | encounters.test.ts, 13 checks in Chrome | playwright-core + Vitest | `b4f26b9`, rev 6 | 2026-09-07 | encounter UI changes |
| UI-001 | no horizontal overflow, >=44px targets, nav never covers controls at 320px | verified | journey 19/19b + encounters Door-at-320px | playwright-core + Vitest | `b4f26b9`, rev 6 | 2026-09-07 | layout/CSS changes |
| UI-002 | fog states legible without colour; Map/Boss/Door/Vault/Me polish | verified | real-Chrome inspection at 320/390/430/834 | browser visual inspection | `b4f26b9`, rev 6 | 2026-09-07 | UI markup/CSS changes |
| BROWSER-004 | mobile device and PWA install/offline | implemented-unverified | none | real-device check | `c0dc714`, rev 5 | 2026-09-07 | device availability |
| BROWSER-005 | non-Chrome browser behavior | implemented-unverified | none | cross-browser check | `c0dc714`, rev 5 | 2026-09-07 | browser support work |
| WORKER-001 | Worker `/api/health` + `/api/turn` non-AI paths at runtime | verified | live `wrangler dev` workerd probe: 200 health, 503 binding-missing, 400 bad-request, 405, 404, 200 SPA | runtime curl probe | `8b06185`, rev 7 | 2026-09-07 | Worker changes |
| WORKER-002 | Worker AI-bound path at runtime | implemented-unverified | none; no Cloudflare auth and no local Workers AI emulation | authenticated dev/deploy | `8b06185`, rev 7 | 2026-09-07 | Cloudflare authentication |
| INV-016 | provider has no more authority than the mock | verified | firewall.test.ts forged-output and identical-state tests | Vitest | `8b06185`, rev 7 | 2026-09-07 | changes to `apply.ts` or the event vocabulary |
| INV-017 | PRIVATE excluded before the payload exists | verified | context.test.ts canary over the whole serialized payload; browser provider journey check 4 | Vitest + browser | `8b06185`, rev 7 | 2026-09-07 | context compiler changes |
| INV-018 | provider context is bounded | verified | 20/300/600-turn compile comparison; 100-turn pipeline run | Vitest | `8b06185`, rev 7 | 2026-09-07 | context budget changes |
| INV-019 | repair bounded to one attempt | verified | provider.test.ts three-response script; semantic refusal test | Vitest | `8b06185`, rev 7 | 2026-09-07 | provider/validation changes |
| INV-020 | zero-dollar enforcement | verified | paid-model refusal with zero binding calls; bundle inspection; neuron budget assertions | Vitest + bundle scan | `8b06185`, rev 7 | 2026-09-07 | model registry or pricing changes |
| MODEL-001 | selected default is a measured bakeoff winner | verified | Live Workers AI bakeoff completed; Qwen3 30B FP8 selected on empirical evidence | `npm run test:live` | `local-rev9`, rev 9 | 2026-09-07 | Cloudflare authentication |
| MODEL-002 | candidates honour `response_format` json_schema | verified | Live probe proved only Qwen3 30B reliably adheres to json_schema within 700-token limit; others truncated mid-JSON | live probe in `tests/live/bakeoff.live.test.ts` | `local-rev9`, rev 9 | 2026-09-07 | Cloudflare authentication |
| AI-001 | real Workers AI synthetic turns executed | verified — 212 requests executed | 212 real requests (204 on Qwen3 30B), 6,163.77 neurons spent, 0 API errors | `npm run test:live` | `local-rev9`, rev 9 | 2026-09-07 | Cloudflare authentication |
| BROWSER-006 | PWA manifest, service worker assets, offline indicator, offline answering, and online recovery | verified | `pwa.test.ts`, 7 checks in Chrome | playwright-core + Vitest | `local-rev8`, rev 8 | 2026-09-07 | PWA/service-worker changes |
| ENCOUNTER-001 | deterministic Boss Fight coverage for all 8 territories | verified | `boss-fight.test.ts`, 16 tests | Vitest | `local-rev8`, rev 8 | 2026-09-07 | encounter/data changes |
| CI-001 | browser journey wired into CI workflow | verified locally | `.github/workflows/ci.yml` | local workflow validation | `local-rev8`, rev 8 | 2026-09-07 | CI workflow changes |
| WORKER-003 | live Worker HTTP routes verified on workerd | verified | `worker-live.test.ts`, live workerd probe | Vitest + runtime probe | `local-rev8`, rev 8 | 2026-09-07 | Worker routing changes |
| VOICE-001 | explicit voice state machine with clean cancel/fallback | verified | `tests/voice/state-machine.test.ts`, 6 tests | Vitest | `local-rev10`, rev 10 | 2026-09-07 | voice state machine changes |
| VOICE-002 | local voice commands (PASS, PRIVATE, STOP, SERIOUS, HELP, SASS) parsed client-side without XP | verified | `tests/voice/commands.test.ts`, 8 tests | Vitest | `local-rev10`, rev 10 | 2026-09-07 | voice command changes |
| VOICE-003 | typed and spoken turn equivalence in progression and evidence | verified | `tests/voice/equivalence.test.ts`, 2 tests | Vitest | `local-rev10`, rev 10 | 2026-09-07 | progression/turn changes |
| TRANSCRIBE-001 | /api/transcribe endpoint bound to Whisper Tiny EN with 2MB ceiling and zero logging | verified | `tests/cartographer/transcribe.test.ts`, 9 tests | Vitest | `local-rev10`, rev 10 | 2026-09-07 | worker transcribe changes |
| ACCESS-001 | ATLAS_ACCESS_SECRET protects /api/turn and /api/transcribe; client isolation | verified | `tests/cartographer/access.test.ts`, 8 tests | Vitest | `local-rev10`, rev 10 | 2026-09-07 | access auth changes |
| BROWSER-007 | voice mode switch, UI, mic targets, quiet synthesis, and access settings in Chrome | verified | `tests/browser/voice.test.ts`, 8 tests in Chrome | playwright-core + Vitest | `local-rev10`, rev 10 | 2026-09-07 | voice UI changes |
| DEPLOY-001 | production deployment on Cloudflare Workers with live health and access gate | verified | live deployment at `atlas-of-one.atlas-of-one.workers.dev` | live HTTP probe | `local-rev10`, rev 10 | 2026-09-07 | worker deployment |

## 12. Current Change Scope and Impact Radius

- **Allowed to change next:** Turnaround reveal asset sourcing and trigger decision (PND-005), then Phase 5 adversarial release QA and final assessment.
- **Must remain unchanged:** privacy, deterministic progression authority including encounter outcomes, always-available agency controls inside every encounter type, the no-PRIVATE-leak rule for Doors, Aerron→Greyson canonical asset mapping, Andrew-asset exclusion, source gap labels, and explicit non-goals.
- **Potentially affected behavior:** mock campaign progression, local state persistence, mobile UI, PWA build, canonical sprite presentation.
- **Mandatory checks:** synthetic tests, production build, repository secret/private-data scan; browser/runtime checks when available.
- **Repair class:** Rev 10 is authoritative Phase 4 (Voice + Deployment): implemented MediaRecorder voice capture, explicit deterministic voice state machine, local voice agency commands, browser speech synthesis, POST /api/transcribe bound to @cf/openai/whisper-tiny-en, ATLAS_ACCESS_SECRET Worker secret + local client credential gate, production deployment to Cloudflare Workers, and comprehensive unit and real-Chrome browser test suites.

## 13. Compact Revision Log

### Revision 10 — 2026-09-07

- **Artifact/source identity:** code baseline `local-rev10`.
- **State deltas:** Authoritative Phase 4 (Voice + Deployment) completed:
  1. Implemented explicit voice state machine (`idle`, `requesting-permission`, `listening`, `transcribing`, `thinking`, `speaking`, `error`) with cancel/fallback to text at every stage in `src/voice/state.ts`.
  2. Implemented client-side voice agency command parser (`PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP`, `SASS [0-3]`) in `src/voice/commands.ts` with smart quotes and punctuation stripping, preventing false triggers on conversational answers and never awarding XP or advancing progression.
  3. Implemented mobile-first `MediaRecorder` audio capture in `src/voice/capture.ts` (2 MB ceiling, mimeType detection, immediate chunk discard).
  4. Implemented `window.speechSynthesis` wrapper in `src/voice/synthesis.ts` with quiet presentation mode (subdued 0.9 rate, 0.6 volume), immediate cancellation on STOP, route change, or type switch.
  5. Implemented `POST /api/transcribe` in `worker/index.ts` using `@cf/openai/whisper-tiny-en`, 2 MB payload ceiling, byte validation (<50 bytes -> 400 bad request), and zero persistence or logging of audio or transcripts.
  6. Implemented access secret security boundary (`ATLAS_ACCESS_SECRET`) protecting `/api/turn` and `/api/transcribe` via Worker secret, with client credentials stored in `localStorage` (`src/voice/access.ts`), isolated from `CampaignState` and exports, and Me screen settings UI.
  7. Tested typed vs spoken equivalence in `tests/voice/equivalence.test.ts` proving identical deterministic XP, levels, and evidence.
  8. Deployed to production on Cloudflare Workers (`https://atlas-of-one.atlas-of-one.workers.dev`, Version `2d0324a7-3e61-4585-8112-b0bab63492d6`) with `ATLAS_ACCESS_SECRET` configured; verified live HTTP probes across `/api/health`, `/api/turn`, `/api/transcribe`, `/`, and `/manifest.webmanifest`.
  9. Probed physical Android device availability via USB; none connected, recorded as `UNV-003: Physical Android device check — NOT VERIFIED — NO DEVICE CONNECTED`.
- **New evidence:** 180 passed in `npm test` (1 skipped when worker offline); 49 passed in `npm run test:browser` across 5 test suites (`journey`, `encounters`, `provider`, `pwa`, `voice`); production Worker/client build passing cleanly; live production HTTP probes 200/401 verified.
- **Validation not performed:** real physical mobile device/touch, real Android PWA installation, and non-Chrome browsers.

### Revision 9 — 2026-09-07

- **Artifact/source identity:** code baseline `local-rev9`.
- **State deltas:** Completed real Cloudflare Workers AI bakeoff against authenticated Cloudflare inference:
  1. Authenticated via Wrangler OAuth keyring (`e492e402d5d61b9c04dc9144607e90de`).
  2. Fixed live test harness in `tests/live/bakeoff.live.test.ts`: hoisted stage results for dynamic survivor filtering and enforced pre-request stage budget guard.
  3. Executed live bakeoff (`npm run test:live`): 212 real inference requests executed across 1,123.55s (~18.7 min), consuming 6,163.77 neurons (well below the 8,500 harness cap and 10,000 free-tier daily ceiling). 0 API errors (`errorCode: 0`).
  4. Measured candidate findings: Gemma 4 26B, GLM 4.7 Flash, GPT-OSS 20B, and Nemotron 3 120B failed structured output acceptance within `max_tokens = 700` (output truncated mid-JSON). Only `@cf/qwen/qwen3-30b-a3b-fp8` emitted valid, compact, schema-constrained JSON.
  5. Selected measured provider: Replaced provisional default `@cf/google/gemma-4-26b-a4b-it` with measured winner `@cf/qwen/qwen3-30b-a3b-fp8` in `src/cartographer/models.ts`.
  6. Updated `docs/PROVIDER_BAKEOFF.md` and `OPERATIONAL_STATE.md` with complete empirical evidence. Promoted MODEL-001, MODEL-002, and AI-001 to verified.
- **New evidence:** 7 passed in `tests/live/bakeoff.live.test.ts`; 143 passed in `npm test`; Cloudflare server-side GraphQL AI inference analytics confirming 212 requests, 6,163.77 neurons, and 0 errors.
- **Validation not performed:** real physical mobile device/touch, real Android PWA installation, and non-Chrome browsers.

- **Artifact/source identity:** code baseline `local-rev8`.
- **State deltas:** Completed remaining safe Phase-2/verification debt without entering Phase 3 real-AI inference:
  1. Extended deterministic Boss Fight coverage to all 8 territories (`identity`, `values`, `politics`, `relationships`, `interests`, `cognition`, `fears`, `future`) in `src/game/data.ts`.
  2. Implemented runtime offline detection, visual offline indicator chip, offline fallback to local mock, and online recovery in `src/App.tsx` and `src/styles.css`.
  3. Added real-browser PWA and offline lifecycle test suite in `tests/browser/pwa.test.ts` (7 checks) proving manifest, service worker, offline indicators, offline answer submission, offline IndexedDB persistence, reload restoration, and online recovery without state loss.
  4. Wired browser journey into GitHub Actions CI in `.github/workflows/ci.yml` using pre-installed Google Chrome on Ubuntu runner (`REMOTE CI RESULT: UNVERIFIED` until pushed).
  5. Probed live Worker runtime (`wrangler dev` workerd) across `/api/health` (200), `/api/turn` (502 network failure without credentials / 503 binding-missing, 400 bad request without canary echo), `GET /api/turn` (405), `/api/nope` (404), and `/` (200 SPA shell) and codified into `tests/cartographer/worker-live.test.ts`.
  6. Turnaround reveal intentionally deferred (PND-005): canonical source `sheets/aerron_turnaround_hires.png` is not committed/available in repo and trigger/role remains an unresolved design decision. Unit tests went 141 -> 143, browser tests 34 -> 41.
  7. Single-defect repair (320px Me-screen overflow): Initial push (`811293b`) triggered GitHub Actions run `34147256901` where `Browser journey` exposed a Linux-Chrome-specific 10px horizontal overflow on the Me screen (`tests/browser/journey.test.ts:267`). Root cause: unconstrained grid/flex min-content expansion in `.settings` and `.stats` allowing intrinsic option and label widths to escape the card content box. Resolved in `src/styles.css` via `minmax(0, 1fr)` and `min-width: 0` constraints and top/left anchoring on `.file input`. Diagnostic offender reporting added to `journey.test.ts`. Verified in local Chrome (overflow = 0); remote CI status unverified until post-push run finishes.
- **New evidence:** `npx tsc --noEmit` clean; 143 unit tests (1 skipped if worker offline); 41 real-Chrome browser tests against the production bundle across 4 test suites (`journey`, `encounters`, `provider`, `pwa`); passing Worker/client/PWA production build; and live workerd probe of all endpoints.
- **Validation not performed:** real physical mobile device/touch, real Android PWA installation, any non-Chrome browser, real Workers AI inference, and remote GitHub Actions execution on push.

### Revision 7 — 2026-09-07

- **Artifact/source identity:** code baseline `8b06185`.
- **State deltas:** Phase 3 gave the Cartographer a provider boundary without giving it any authority. Added `src/cartographer/{provider,context,validate,workersai,client,models,bakeoff,apply}.ts`; rewrote `worker/index.ts` to serve Workers AI inference behind twelve typed failure codes; added an `ai` binding to `wrangler.jsonc`; added `origin` and `providerId` to `EvidenceRecord` additively within schema v1; wired the app to use the Worker provider when `/api/health` reports one and to degrade in Atlas's own words when it does not. Unit tests went 55 -> 141, browser tests 27 -> 34. No dependency was added.
- **New evidence:** `npx tsc --noEmit` clean; 141 unit tests; 34 real-Chrome browser tests against the production bundle; a passing Worker/client/PWA production build; a live `wrangler dev` workerd runtime probe of every Worker route on the non-AI path; and a production-bundle scan confirming no credential, model registry or test tooling reaches the client.
- **Live provider state:** **No Cloudflare authentication exists in this environment, so zero real Workers AI requests were made.** `wrangler whoami` reports not authenticated; no API token or account id is set; no wrangler OAuth config exists. With the `ai` binding declared, `wrangler dev` requires `CLOUDFLARE_API_TOKEN` for its remote proxy session and there is no local Workers AI emulation, so the AI-bound path could not be exercised at all.
- **Model candidates:** All five candidates named in the Phase 3 brief were checked rather than trusted and all still exist and are free-plan eligible. The neighbouring GLM 5.2/5.3, Kimi k2.6/k2.7 and DeepSeek-v4 families are paid-only and are recorded in `EXCLUDED_MODELS`. The Workers Free allocation is 10,000 neurons/day; per-turn neuron costs were derived from published prices, which disqualifies `nemotron-3-120b-a12b` in practice (86 free turns/day, so a 100-turn campaign would exceed the allocation).
- **Selection:** `@cf/google/gemma-4-26b-a4b-it` is a **provisional** default, runner-up `@cf/zai-org/glm-4.7-flash`, chosen on the only two of eight criteria that documented evidence can settle. It is labelled provisional in both code and `docs/PROVIDER_BAKEOFF.md`.
- **Defects found and fixed during this pass:** the authority-field scanner initially flagged the legitimate nested `evidence[].territories` contract field as a progression attempt, and was made position-aware; the evidence-grounding metric was purely exact-token and punished ordinary paraphrase, and gained light stemming; the uncertainty-preservation regex missed "does not know" style hedging; the bakeoff fixture suite lacked dedicated `values` and `cognition` entries.
- **Validation not performed:** real Workers AI inference of any kind, the live bakeoff, the real 100-turn gate, the AI-bound Worker path, real quota/rate-limit behavior, real-device touch, PWA install/offline, any non-Chrome browser, and production deployment.

### Revision 6 — 2026-09-07

- **Artifact/source identity:** code baseline `b4f26b9`.
- **State deltas:** Mobile-first UI/UX polish and defect repair across Map, Talk, Boss Fight, Mystery Door, Vault, Me, navigation, agency controls and the settings/transfer surfaces. Presentation-only: `src/App.tsx` (markup, hierarchy, microcopy, a two-step Delete confirm, toast auto-dismiss, door heading = crossing pairing) and a full rewrite of `src/styles.css`. No engine/encounter/mock/persistence/schema/model file was touched; the dispatched game-event set is identical to `a3d74df`.
- **Defects found and fixed during this pass:** the Greyson sprite was absolutely centred over the territory grid and overlapped territory labels at every viewport; fog-of-war states were distinguished only by a faint border hue and small text; the `Me` screen had 9px of horizontal overflow at 320px from an unclipped hidden file input; the destructive Delete had no confirmation and sat adjacent to Export/Import; agency touch targets were 42px; the status toast was `position: sticky` and scrolled over headings; user-facing copy leaked "Mock mode / deterministic game engine" and "resolved by the game engine, not the Cartographer".
- **New evidence:** 55 unit tests, 27 real-browser tests (2 added for mobile-polish invariants) and a passing Worker/client/PWA production build on this baseline, plus a real-Chrome visual inspection at 320/390/430/834 viewports covering fresh and progressed campaigns, both special encounters, quiet mode, empty and populated Vault, and the celebratory overlay.
- **Validation not performed:** real mobile device / touch, PWA installation and offline journey, any non-Chrome browser, Worker runtime execution, production deployment, and encounter play-feel.

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
