# Atlas of One — Acceptance Criteria

These are product invariants, not suggestions. Synthetic automated tests should cover everything that can be proved without a real browser/provider/device.

## How to read the boxes

One convention applies to the whole file.

- `[x]` — **verified**, with identified evidence: a named test, suite, runtime probe or direct source inspection.
- `[ ]` — **open**: unverified, only partially true, or contradicted. A trailing *(note)* says which.

Before revision 14 this file mixed two conventions — Phase 1–3 criteria were left `[ ]` by historical habit while Phase 4–6 used `[x]` — which made long-proven invariants read as unverified and unproven ones read as settled. Every box below has been re-scored conservatively against evidence that actually exists.

Scope: everything checked below is verified against the deployed application
unless its note says otherwise. `OPERATIONAL_STATE.md` holds the current
application-content baseline and its deployment evidence; this file records
whether a criterion is *proven*, not which commit is live.

## Agency and privacy

- [x] `PASS` is always available. *(VER-013 browser check 8; VER-014 all six controls inside both encounter types.)*
- [x] `PRIVATE` is always available. *(VER-013 check 9; VER-014.)*
- [x] `STOP` is always available. *(VER-013 check 10; VER-014.)*
- [x] `SERIOUS` is always available. *(VER-013 check 11-13; VER-014.)*
- [x] `HELP` is always available. *(VER-014 — all six permanent controls present and enabled.)*
- [x] sass controls are always available. *(VER-013 check 14 — adjustable at every level and in quiet mode.)*
- [x] None of those controls depends on level/unlock state. *(INV-002; shared permanent control bar exercised in ordinary and both encounter contexts.)*
- [x] A private topic/dimension is excluded from intentional subsequent mock question selection. *(INV-003; VER-007; VER-013 check 9.)*
- [x] No real Greyson answer/transcript/private conversation content exists in tests or committed source. *(VER-016; re-scanned at rev 14 — only the character name, pronouns, sprite, territory label and invented template prose appear.)*

## Game authority

- [x] Cartographer/model output cannot directly mutate XP, levels, unlocks, achievements, quest completion, territory thresholds, map fragments, or campaign completion. *(VER-024 firewall drives forged output through the real `eventsFromTurn`; `apply.ts` can emit only three event types.)*
- [x] XP is deterministic for identical event input/state. *(VER-007; VER-003.)*
- [x] Levels are deterministic from XP. *(VER-007; `levelForXp`.)*
- [x] Levels do not unlock twice. *(VER-003 sustained 100-turn campaign; `reconcileProgression` guards on `unlockedAt`.)*
- [x] Unlocks do not unlock twice. *(VER-003; VER-010 fixed reward paid exactly once.)*
- [x] Achievements do not unlock twice. *(VER-003; VER-010.)*
- [x] Territory state derives from evidence-dimension coverage rather than turn count alone. *(VER-007; `reconcileTerritories`.)*
- [x] Every accepted substantive answer produces deterministic progress. *(VER-013 check 4-5 — the deterministic +13 XP in a real browser.)*
- [x] Vulnerability/pain is not an XP multiplier. *(VER-010; INV-015 equal-length neutral vs painful answer tests.)*

## Boss Fights and Mystery Doors

- [x] Boss Fight availability derives from deterministic campaign state, never from model output. *(VER-010; INV-011.)*
- [x] A Boss Fight can be completed entirely with the Mock Cartographer. *(VER-014 browser encounter suite.)*
- [x] Boss stages are built only from evidence the player already produced. *(VER-010; VER-014.)*
- [x] The model cannot mark a Boss Fight complete or award its reward. *(VER-010 forged-event tests; DEC-019.)*
- [x] Mystery Door eligibility, opening, completion and reward are decided by the game engine. *(VER-011; INV-012.)*
- [x] A Mystery Door never reveals PRIVATE material and never requires a private topic. *(VER-011; INV-013.)*
- [x] A Mystery Door may remain unopened indefinitely without blocking campaign completion. *(VER-011 — a campaign deeply charts every territory with zero doors opened.)*
- [x] `PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP` and sass remain available inside both encounter types. *(VER-014.)*
- [x] Neither encounter can trap the player; withdrawing preserves progress. *(VER-010; VER-014; INV-014.)*
- [x] Encounter completion occurs in quiet mode with celebration suppressed. *(VER-010.)*
- [x] No encounter awards bonus XP for a painful disclosure. *(VER-010; INV-015.)*

## Presentation

- [x] `SERIOUS` can immediately set quiet presentation. *(VER-013 check 11-13.)*
- [x] Quiet mode suppresses celebratory presentation UI. *(VER-013 — eight further turns with no celebratory overlay.)*
- [x] Internal progression can still persist in quiet mode without losing state. *(INV-004; VER-013.)*

## Evidence

- [x] Evidence records identify source turn IDs, dimension, claim, basis, strength/confidence, territories, and status. *(`EvidenceRecord` in `src/game/types.ts`; VER-007; provenance fields per MODEL_CONTRACT.)*
- [x] Retraction marks/removes derived evidence from the retracted answer and recomputes territory coverage, and is reachable by the player from the Vault. *(VER-061 adds the real UI path, which did not exist before; VER-007; `ANSWER_RETRACTED` marks derived evidence `retracted` and `reconcileTerritories` re-derives coverage; re-proven at rev 14 by final-assessment-trust check 3.)*
- [ ] Insight status can be confirmed or rejected without deleting history. *(Open: `INSIGHT_CONFIRMED`/`INSIGHT_REJECTED` exist in the engine and confirmed/rejected Insights are consumed by the context compiler, but no test exercises the transition itself. Implemented, unverified.)*
- [ ] Contradictions/revisions remain representable rather than silently overwritten. *(Open and partial: revisions are represented — `TurnRecord.revision` and evidence `basis: 'revision'` are tested. `ContradictionRecord` is representable in the schema and correctly handled by consumers, but NO engine event ever creates one, so the contradiction half is untested and unreachable in play. Same class of gap as KNOWN-003.)*

## Persistence

- [x] `schemaVersion` exists from first campaign creation. *(`createInitialCampaign`; VER-007.)*
- [x] A migration boundary exists for future schema versions. *(`src/persistence/migrations.ts`; DEC-012; VER-012.)*
- [x] State is automatically persisted after hydrated state transitions. *(VER-007; VER-013 check 6-7 reload restoration.)*
- [x] Export/import round-trips semantically without state loss. *(VER-013 checks 15-18 in a real browser; VER-012 for encounter state.)*
- [x] Invalid/malformed import is rejected before replacing current state. *(VER-007; VER-046 persistence torture — corrupted JSON, schema mismatch and missing keys all rejected.)*
- [x] Campaign can be deleted locally. *(VER-013 checks 15-18 — export, delete, re-import.)*
- [x] Reload restoration is designed and requires browser-runtime verification. *(Now verified: VER-013 check 6-7 restores XP and level from IndexedDB across a full page reload.)*

## UI/UX

- [x] Mobile bottom navigation exposes Map, Talk, Vault, and Me. *(VER-013 check 3.)*
- [x] Map displays avatar support, XP, level, territory progress, quest, and fragment/unlock state. *(VER-013; VER-017.)*
- [x] Talk presents the current question and answer path plus permanent controls. *(VER-013; VER-014.)*
- [x] Vault presents Insights/evidence/achievements and empty states. *(VER-014; VER-017.)*
- [x] Me presents character/progress/settings/accessibility and transfer/delete foundation. *(VER-013 checks 15-18; VER-017.)*
- [x] Reduced-motion preference is respected by CSS. *(VER-051 browser onboarding check 14 asserts the `data-reduced-motion` root attribute.)*
- [ ] Critical controls are semantic buttons with visible keyboard focus. *(Open and partial: controls are semantic `<button>` elements and keyboard activation is proven — VER-051 check 10 focuses Start and presses Enter. The VISIBLE focus indicator is styled but never asserted by a test.)*

## Build/security

- [x] `npm test` passes. *(237 passed, 1 skipped, 30 files.)*
- [x] `npm run build` passes using the Cloudflare Vite plugin. *(Worker + client + PWA, 11 precache entries.)*
- [x] `npm run test:browser` passes the real-browser user journey. *(105 passed across 12 suites in installed Chrome.)*
- [x] No secret or access token is committed. *(VER-016; full-history scan — the built bundles contain only the identifiers `atlas_access_secret` and `ATLAS_ACCESS_SECRET`, never a value.)*
- [x] No D1, KV, R2, analytics, account auth, SSR, Next.js, native wrapper, or 3D dependency/config is added. *(VER-016; `wrangler.jsonc` declares only `ai` and `assets`. The `.wrangler/state/v3/{d1,kv,r2}` directories are gitignored miniflare scaffolding, not bindings.)*
- [x] Worker API is same-origin and returns a health response. *(VER-028 workerd probe; live production `/api/health` returns 200.)*
- [x] Paid AI service is not connected in Phase 1/2. *(DEC-003/DEC-014 — still true at rev 14: Workers AI Free is the only provider and no paid overflow exists.)*

## Provider boundary (Phase 3)

- [x] The model never gains authority beyond the MockCartographer: only
      `ANSWER_ACCEPTED`, `EVIDENCE_ADDED` and `INSIGHT_ADDED` can be produced
      from provider output. *(VER-024; INV-016.)*
- [x] Forged progression fields in a provider response produce campaign state
      identical to an equivalent honest turn. *(VER-024.)*
- [x] A PRIVATE dimension's content never appears anywhere in the outgoing
      provider payload; only its label travels. *(VER-020 whole-payload canary; VER-029 browser check 4.)*
- [x] Retracted material never appears in the outgoing payload. *(VER-020.)*
- [x] Compiled context does not grow linearly with campaign length. *(VER-021 — 20/300/600-turn comparison, under 20,000 characters at 600 turns.)*
- [x] Structured provider output is decoded, schema-validated and
      semantically validated before acceptance. *(VER-022 four-layer proof.)*
- [x] Malformed model structure earns at most ONE repair attempt. *(VER-023 — a third scripted response is never reached.)*
- [x] A semantic violation is refused rather than repaired. *(VER-023; DEC-017.)*
- [x] Every provider failure is typed and has player-facing copy free of backend
      jargon. *(VER-019 — twelve typed codes, no status code, binding name, schema term, neuron reference or model id; confirmed against the live production 401 body.)*
- [x] A provider failure never loses the player's answer, corrupts state, double
      awards, retries without bound, or switches to a paid service. *(VER-026; VER-045.)*
- [x] A model requiring a paid plan is refused before any request is made. *(VER-027 — 503 with zero binding calls. Applies to `/api/turn` and `/api/finalize`; see the Phase 4 transcription note for the one path where this guard is missing.)*
- [x] A 100-turn campaign is affordable within the Workers Free daily neuron
      allocation on the selected model. *(`estimateNeurons` gives 17.8 neurons/turn and 562 free turns/day for `@cf/qwen/qwen3-30b-a3b-fp8`; arithmetic independently recomputed at rev 14.)*
- [x] No Cloudflare credential or model registry reaches the browser bundle. *(VER-030 bundle inspection.)*
- [x] The Worker persists no transcript. *(Source inspection — no database binding, no logging of any request body; DEC-014.)*

## Opening presentation and conversational Talk (Phase 6 presentation)

Accepted after real first-impression observation; implemented in `31b01b0`, not
yet deployed at the time of writing.

- [x] Every launch opens dormant: near-black cinematic space with no Map, Talk, Vault, Me, navigation, cards, XP, controls, toasts or onboarding choices. *(`tests/browser/onboarding.test.ts` check 1; `hydration-race.test.ts` asserts no chrome can be painted even while hydration is pending.)*
- [x] The dormant screen carries no branding, tagline or instruction either — only a faint atmospheric mark. *(`onboarding.test.ts` check 1 asserts the shell's entire text content is empty and no `h1` exists before engagement.)*
- [x] Identity is revealed BY the wake: the mark blooms and the name arrives with the illumination, before Atlas hands over. *(`onboarding.test.ts` check 3b.)*
- [x] The application tree is not rendered before engagement, so nothing underneath is focusable or clickable. *(The cold open returns early; the app tree does not exist yet.)*
- [x] The first deliberate interaction — pointer or keyboard — wakes Atlas, and the whole viewport is the activation surface rather than a conventional button. *(`onboarding.test.ts` checks 3, 4 and keyboard activation.)*
- [x] Waking IS "Begin": a new campaign goes straight to the sass choice with no second Begin. *(`onboarding.test.ts` check 4; the unreachable Begin card was removed.)*
- [x] A returning campaign wakes into its existing state without replaying onboarding. *(`onboarding-continuity.test.ts` cases B–E; `onboarding.test.ts` check 12.)*
- [x] Illumination is short and decisive, and is skipped under reduced motion. *(260ms brightness bloom; disabled by `prefers-reduced-motion` and the in-app setting.)*
- [x] 320px cold open has no horizontal overflow. *(`onboarding.test.ts` check 2.)*
- [x] Talk is a continuous turn-taking conversation: one activation, then Atlas states the prompt, listens, answers, establishes the next prompt and listens again with no tap between turns. *(`voice-conversation.test.ts` checks 1 and 4 — two spoken turns, no microphone interaction between them.)*
- [x] Spoken turns end on locally detected sustained silence, never before speech begins and not on an ordinary mid-sentence pause. *(`voice-conversation.test.ts` check 3.)*
- [x] "Done speaking" remains available as a fallback and keeps the conversation running. *(check 5.)*
- [x] The microphone visualizer responds to real measured amplitude and is present only while capture is live. *(check 2; louder audio reads measurably higher and silence does not look loud.)*
- [x] Cancel, STOP and switching to Type all end the loop, and no stale callback can reopen the microphone. *(checks 6, 7, 8; generation tokens invalidate obsolete cycles.)*
- [x] The player can interrupt the Cartographer and take the turn immediately, with the conversation still alive. *(check 9.)*
- [x] A spoken local command stays client-side, reaches no provider, awards nothing, and the conversation continues. *(check 10.)*
- [x] Recording still works when audio analysis is unavailable, with a truthful indicator and the manual fallback. *(check 11.)*
- [x] Microphone levels are never persisted, exported or transmitted. *(Levels live only in component state; nothing enters CampaignState or any request.)*
- [ ] Acoustic barge-in — speaking over the Cartographer without touching anything. *(Open and deliberately deferred: doing it safely needs echo handling so synthesis cannot retrigger itself through the microphone. Tap-to-interrupt covers the need.)*
- [ ] Real-device confirmation that the cold open and spoken conversation feel right in the hand. *(Open — this is exactly what the Greyson session is for; UNV-021, and UNV-007 for non-Chrome speech behaviour.)*

## Voice and Deployment (Phase 4)

- [x] Text and voice modes coexist cleanly on the Talk screen. *(VER-040. Talk is now a continuous conversation rather than per-answer recording — see the presentation block above.)*
- [x] Spoken local agency commands (PASS, PRIVATE, STOP, SERIOUS, HELP, SASS) execute client-side before sending text to Cartographer; never award XP or progression. *(VER-036, 8 unit checks; VER-040.)*
- [x] Voice state machine visibly distinguishes idle, requesting-permission, listening, transcribing, thinking, speaking, error. *(VER-035, 6 unit checks.)*
- [x] Cancel and fallback to typing is available at every state. *(VER-035; VER-040.)*
- [x] Browser MediaRecorder capture is mobile-first, requires explicit player action, and discards audio blobs immediately after use. *(DEC-021; `src/voice/capture.ts` clears chunks on success, abort and error paths.)*
- [x] Browser speech synthesis reads Cartographer responses in voice mode, cancellable on STOP, mode toggle, navigation, or unmount. *(VER-040.)*
- [x] Quiet/serious presentation mode suppresses celebratory voice inflection with subdued volume and rate. *(VER-040 — rate 0.9, volume 0.6.)*
- [x] Same-origin `POST /api/transcribe` endpoint converts audio to text using free-plan eligible Workers AI model without logging audio or transcripts. *(VER-038, 9 unit checks; the configured model `@cf/openai/whisper-tiny-en` is free-plan eligible and is confirmed by the live `/api/health` response. Eligibility on an `ATLAS_TRANSCRIBE_MODEL_ID` override is now enforced fail-closed before any binding call — KNOWN-004 resolved, VER-058. One caveat remains: it has never been exercised against real audio, so accuracy, latency and cost are unmeasured, and the model is English-only — UNV-017.)*
- [x] Worker access secret `ATLAS_ACCESS_SECRET` guards `/api/turn` and `/api/transcribe` with 401 unauthorized rejection. *(VER-039, 8 unit checks; confirmed live in production for `/api/turn`, `/api/transcribe` and `/api/finalize`, with `accessProtected: true` on `/api/health`.)*
- [x] Access secret is stored as a local client credential in `localStorage`, completely isolated from CampaignState and IndexedDB export. *(VER-039; `src/voice/access.ts`; the secret appears in no state type, schema or export path.)*
- [x] Production Worker and PWA client deployed live to Cloudflare Workers with asset serving. *(VER-041; re-confirmed at rev 14 — deployed asset hashes match a local build of `60ce565`.)*
- [x] Cloudflare Git deployment / Workers Builds connected to `westkitty/AtlasOfOne` on production branch `main`. *(DEPLOY-002; three auto-deployments observed landing 30-48s after pushes to `main`.)*
- [ ] Physical Android device install and hardware verification. *(Open — UNV-003 / KNOWN-006: no reachable device. `docs/MASTER_BUILD_PLAN.md` requires this in Phase 4, so Phase 4 remains PARTIAL. Offline/PWA/viewport behavior is verified in Chromium only; UNV-007 and UNV-009 remain open alongside it.)*

## Adversarial Release QA and Final Assessment (Phase 5)

- [x] Adversarially tested all player archetypes (short, long, contradictory, private, serious, political, revision-heavy, voice command protection). *(VER-043, 8 checks against real engine and context code.)*
- [x] Asynchronous hammer and race condition safety: double-submit (BUG-001), stale closure overwrite (BUG-002), cross-campaign import race (BUG-003), voice capture state desync (BUG-004). *(KNOWN-002 resolved. `tests/browser/concurrency.test.ts` drives the real application with mutation proof for every guard; the former self-referential fixture was deleted. BUG-001 turned out to be a live defect — two same-task clicks started two `/api/turn` requests — and was repaired with a synchronous lock. See VER-054.)*
- [x] Network degradation resilience: 401, 413, 429 quota, 429 rate limit, 502/503/504 gateway failures, malformed JSON, and network timeouts degrade safely to local deterministic Cartographer. *(VER-045, 7 checks against the real client and worker.)*
- [x] Persistence torture & migration: corrupted JSON rejected, schema version mismatch rejected, missing keys rejected, assessment round-trip preserved. *(VER-046, 5 checks.)*
- [x] Streaming defensive security bounds on `/api/turn` and `/api/transcribe`: chunked transfer bypass closed with strict byte counting (BUG-005), auth gates enforced, forged progression stripped, and private/retracted canaries structurally excluded from the PER-TURN payload. *(VER-047, 8 checks importing the real `worker/index`. This is the one BUG whose repair has genuine regression protection. The equivalent guarantee for the FINALIZE payload is scored separately below — it did not hold at this revision.)*
- [x] Final Atlas Assessment synthesis engine: `POST /api/finalize` + deterministic offline generator `generateLocalAssessment(state)` in `src/cartographer/finalize.ts`. *(VER-048.)*
- [x] Zero progression authority: Final Assessment emits `FINAL_ASSESSMENT_SET` with 0 XP, 0 level change, and 0 territory/unlock change. *(FINAL-001; re-proven at rev 14 including on the semantic-refusal path.)*
- [x] Browser presentation and print export: Final Assessment UI rendered on Me screen, 0 horizontal overflow at 320px, and `@media print` styles format clean Save as PDF. *(BROWSER-008, journey checks 21a/21b and 22.)*
- [x] Long-session end-to-end proof: one continuous session covering retraction, export, delete, import and finalization. *(PND-004 closed. `tests/browser/phase5-long-session.test.ts` is one browser context and one page carrying a single state lineage: a 45-turn campaign with all eight territories deeply charted, a real Vault retraction, a real export whose downloaded bytes are re-imported after a real delete, and deterministic local finalization from the restored state. The retracted answer's canary reaches neither the eligible evidence nor the assessment. See VER-061.)*

## Final Assessment trust boundary (Phase 5A — deployed)

Every box in this block is verified and shipped: `e940788` was released and
KNOWN-001 is resolved. Each was mutation-tested — the repair was reverted, the
named check was observed to fail, and the file was restored.

- [x] Derived Insight privacy follows `evidenceIds`, not prose. *(final-assessment-trust check 1.)*
- [x] Derived Contradiction privacy follows `evidenceIds`, not prose. *(check 2 uses a contradiction whose wording never names the private dimension.)*
- [x] Material derived from retracted or otherwise non-visible evidence is structurally excluded from finalization. *(check 3, which also asserts the material IS visible before retraction.)*
- [x] A derived record with no evidence provenance is withheld rather than assumed safe. *(check 4.)*
- [x] Zero-evidence state produces no invented personality claim, no default contradiction, no framework estimate and no placeholder quotation. *(check 5 names all eleven previously shipped fabrications.)*
- [x] Domain inferences reach a domain only when their own evidence sits in it. *(check 6. Previously the first three Insights were repeated under all eight headings.)*
- [x] `whoIsGreyson` is evidence-grounded or explicitly states that evidence is insufficient. *(checks 5 and 6.)*
- [x] Remote Final Assessment receives semantic validation beyond Zod shape validation, covering the complete assessment. *(checks 8-12 through the real Worker route, including an acceptance check so the validator is not a blanket refusal.)*
- [x] An invented quotation is rejected. *(check 9.)*
- [x] A reference to a topic the player closed is rejected. *(check 10.)*
- [x] A semantic refusal falls back safely and mutates no campaign state or progression. *(check 13.)*
- [x] Final Assessment is unavailable before the campaign reaches its deterministic end state. *(browser check 21a; gate reads `campaignReachedEndState`. Note KNOWN-003: nothing dispatches `CAMPAIGN_COMPLETED`, so the territory-coverage fallback carries the gate in practice.)*
- [ ] The `/api/finalize` semantic validator behaves acceptably against the real model. *(Open — UNV-018. Never exercised against live Workers AI, so the practical rejection rate is unmeasured. The failure mode is safe: fallback to the deterministic local synthesis.)*

## Greyson Onboarding and First-Run Handoff (Phase 6)

Phase 6 in `docs/MASTER_BUILD_PLAN.md` is **"Give it to Greyson"**. The
onboarding implementation below is the preparation for that phase, not the
phase itself. Phase 6 is INCOMPLETE.

- [x] Canonical minimal onboarding flow: 5-step sequence (1. Begin, 2. Sass: Low/Medium/Risks, 3. Mode: Talk/Type, 4. Agency controls: Pass/Private/Stop/Serious, 5. Start). *(VER-050, 4 unit checks; VER-051, 14 browser checks.)*
- [x] Zero progression impact: onboarding completes with 0 XP, Level 1, 0 unlocks, 0 territories. *(VER-050; `ONBOARDING_COMPLETED` touches only `settings` and the completion flag.)*
- [x] Dual local persistence: `state.onboardingCompleted` (IndexedDB) + `localStorage.atlas_onboarding_completed` prevents re-prompting after a local delete and re-import. *(VER-050; VER-051 check 12.)*
- [x] Pre-existing campaigns (with turns or existing state) backward-compatible bypass. *(The earlier CONTRADICTED annotation was wrong: the visible bypass always worked, because the render gate carries its own `turns.length === 0` term. What was actually broken was state normalization — the flag was written back false — and that is repaired with one shared predicate used by both load and render. Proven across six persistence cases in `tests/browser/onboarding-continuity.test.ts`. See VER-059.)*
- [x] Real-browser verification: 0 horizontal overflow at 320px, >=44px touch targets, keyboard activation, reload persistence in Chrome. *(VER-051, 14 checks.)*
- [x] Production access secret rotated, loaded as a Worker secret, and stored in the macOS Keychain. *(VER-041 lineage; corroborated at rev 14 by a `Secret Change` deployment event immediately preceding the `60ce565` deployment, and by `accessProtected: true` on live `/api/health`.)*
- [ ] Physical Android device install and hardware verification. *(Open — UNV-003 / KNOWN-006: no reachable device.)*
- [ ] Behavior verified on any browser other than desktop Chrome. *(Open — UNV-007. Safari, Firefox and all mobile engines are unexercised. This matters for voice: `MediaRecorder` codec support and `speechSynthesis` behavior differ on iOS Safari.)*
- [ ] Real-device touch ergonomics tested by hand rather than measured geometrically. *(Open — UNV-009.)*
- [ ] **Greyson has actually received and used Atlas, and product friction has been observed.** *(Open — UNV-021. This is the criterion that closes Phase 6. Until it is met, Phase 6 is incomplete regardless of how much onboarding exists.)*
