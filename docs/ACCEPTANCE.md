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
- [ ] No secret or access token is committed.
- [ ] No D1, KV, R2, analytics, account auth, SSR, Next.js, native wrapper, or 3D dependency/config is added.
- [ ] Worker API is same-origin and returns a health response.
- [ ] Paid AI service is not connected in Phase 1/2.

## Later-phase acceptance retained from source

Not expected to be fully proven in this pass, but must remain protected:

- text and voice modes coexist
- voice state machine visibly distinguishes listening/transcribing/thinking/speaking
- offline shell/local map/Vault access works after PWA caching
- provider failure never corrupts local campaign state
- final assessment separates fact/evidence/inference/uncertainty
- final Atlas covers political, ideological, relationship, interest, fear, hope, dream/future, contradiction, and character assessment domains
- browser-print final assessment can be saved as PDF
