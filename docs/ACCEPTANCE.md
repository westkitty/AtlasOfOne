# Atlas of One — Acceptance Criteria

These are product invariants, not suggestions. Synthetic automated tests should cover everything that can be proved without a real browser/provider/device.

## Agency and privacy

- [ ] `PASS` is always available.
- [ ] `PRIVATE` is always available.
- [ ] `STOP` is always available.
- [ ] `SERIOUS` is always available.
- [ ] `HELP` is always available.
- [ ] sass controls are always available.
- [ ] None of those controls depends on level/unlock state.
- [ ] A private topic/dimension is excluded from intentional subsequent mock question selection.
- [ ] No real Greyson answer/transcript/private conversation content exists in tests or committed source.

## Game authority

- [ ] Cartographer/model output cannot directly mutate XP, levels, unlocks, achievements, quest completion, territory thresholds, map fragments, or campaign completion.
- [ ] XP is deterministic for identical event input/state.
- [ ] Levels are deterministic from XP.
- [ ] Levels do not unlock twice.
- [ ] Unlocks do not unlock twice.
- [ ] Achievements do not unlock twice.
- [ ] Territory state derives from evidence-dimension coverage rather than turn count alone.
- [ ] Every accepted substantive answer produces deterministic progress.
- [ ] Vulnerability/pain is not an XP multiplier.

## Boss Fights and Mystery Doors

- [ ] Boss Fight availability derives from deterministic campaign state, never from model output.
- [ ] A Boss Fight can be completed entirely with the Mock Cartographer.
- [ ] Boss stages are built only from evidence the player already produced.
- [ ] The model cannot mark a Boss Fight complete or award its reward.
- [ ] Mystery Door eligibility, opening, completion and reward are decided by the game engine.
- [ ] A Mystery Door never reveals PRIVATE material and never requires a private topic.
- [ ] A Mystery Door may remain unopened indefinitely without blocking campaign completion.
- [ ] `PASS`, `PRIVATE`, `STOP`, `SERIOUS`, `HELP` and sass remain available inside both encounter types.
- [ ] Neither encounter can trap the player; withdrawing preserves progress.
- [ ] Encounter completion occurs in quiet mode with celebration suppressed.
- [ ] No encounter awards bonus XP for a painful disclosure.

## Presentation

- [ ] `SERIOUS` can immediately set quiet presentation.
- [ ] Quiet mode suppresses celebratory presentation UI.
- [ ] Internal progression can still persist in quiet mode without losing state.

## Evidence

- [ ] Evidence records identify source turn IDs, dimension, claim, basis, strength/confidence, territories, and status.
- [ ] Retraction marks/removes derived evidence from the retracted answer and recomputes territory coverage.
- [ ] Insight status can be confirmed or rejected without deleting history.
- [ ] Contradictions/revisions remain representable rather than silently overwritten.

## Persistence

- [ ] `schemaVersion` exists from first campaign creation.
- [ ] A migration boundary exists for future schema versions.
- [ ] State is automatically persisted after hydrated state transitions.
- [ ] Export/import round-trips semantically without state loss.
- [ ] Invalid/malformed import is rejected before replacing current state.
- [ ] Campaign can be deleted locally.
- [ ] Reload restoration is designed and requires browser-runtime verification.

## UI/UX

- [ ] Mobile bottom navigation exposes Map, Talk, Vault, and Me.
- [ ] Map displays avatar support, XP, level, territory progress, quest, and fragment/unlock state.
- [ ] Talk presents the current question and answer path plus permanent controls.
- [ ] Vault presents Insights/evidence/achievements and empty states.
- [ ] Me presents character/progress/settings/accessibility and transfer/delete foundation.
- [ ] Reduced-motion preference is respected by CSS.
- [ ] Critical controls are semantic buttons with visible keyboard focus.

## Build/security

- [ ] `npm test` passes.
- [ ] `npm run build` passes using the Cloudflare Vite plugin.
- [ ] `npm run test:browser` passes the real-browser user journey.
- [ ] No secret or access token is committed.
- [ ] No D1, KV, R2, analytics, account auth, SSR, Next.js, native wrapper, or 3D dependency/config is added.
- [ ] Worker API is same-origin and returns a health response.
- [ ] Paid AI service is not connected in Phase 1/2.

## Provider boundary (Phase 3)

- [ ] The model never gains authority beyond the MockCartographer: only
      `ANSWER_ACCEPTED`, `EVIDENCE_ADDED` and `INSIGHT_ADDED` can be produced
      from provider output.
- [ ] Forged progression fields in a provider response produce campaign state
      identical to an equivalent honest turn.
- [ ] A PRIVATE dimension's content never appears anywhere in the outgoing
      provider payload; only its label travels.
- [ ] Retracted material never appears in the outgoing payload.
- [ ] Compiled context does not grow linearly with campaign length.
- [ ] Structured provider output is decoded, schema-validated and
      semantically validated before acceptance.
- [ ] Malformed model structure earns at most ONE repair attempt.
- [ ] A semantic violation is refused rather than repaired.
- [ ] Every provider failure is typed and has player-facing copy free of backend
      jargon.
- [ ] A provider failure never loses the player's answer, corrupts state, double
      awards, retries without bound, or switches to a paid service.
- [ ] A model requiring a paid plan is refused before any request is made.
- [ ] A 100-turn campaign is affordable within the Workers Free daily neuron
      allocation on the selected model.
- [ ] No Cloudflare credential or model registry reaches the browser bundle.
- [ ] The Worker persists no transcript.

## Voice and Deployment (Phase 4)

- [x] Text and voice modes coexist cleanly on the Talk screen.
- [x] Spoken local agency commands (PASS, PRIVATE, STOP, SERIOUS, HELP, SASS) execute client-side before sending text to Cartographer; never award XP or progression.
- [x] Voice state machine visibly distinguishes idle, requesting-permission, listening, transcribing, thinking, speaking, error.
- [x] Cancel and fallback to typing is available at every state.
- [x] Browser MediaRecorder capture is mobile-first, requires explicit player action, and discards audio blobs immediately after use.
- [x] Browser speech synthesis reads Cartographer responses in voice mode, cancellable on STOP, mode toggle, navigation, or unmount.
- [x] Quiet/serious presentation mode suppresses celebratory voice inflection with subdued volume and rate.
- [x] Same-origin `POST /api/transcribe` endpoint converts audio to text using free-plan eligible Workers AI model without logging audio or transcripts.
- [x] Worker access secret `ATLAS_ACCESS_SECRET` guards `/api/turn` and `/api/transcribe` with 401 unauthorized rejection.
- [x] Access secret is stored as a local client credential in `localStorage`, completely isolated from CampaignState and IndexedDB export.
- [x] Production Worker and PWA client deployed live to Cloudflare Workers with asset serving.
- [x] Physical Android device check executed and recorded (no physical device connected).

## Later-phase acceptance retained from source

Not expected to be fully proven in this pass, but must remain protected:

- offline shell/local map/Vault access works after PWA caching
- provider failure never corrupts local campaign state
- final assessment separates fact/evidence/inference/uncertainty
- final Atlas covers political, ideological, relationship, interest, fear, hope, dream/future, contradiction, and character assessment domains
- browser-print final assessment can be saved as PDF
