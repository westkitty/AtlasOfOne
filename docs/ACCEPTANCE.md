# Atlas of One — Acceptance and Proof Obligations

## Product authority

- [ ] Journal is reachable without first answering a question.
- [ ] A journal entry can be saved with no preceding prompt.
- [ ] Atlas may respond without forcing a follow-up question.
- [ ] Greyson can CONFIRM / PARTIAL / REJECT / UNCERTAIN / REVISE / PRIVATE an interpretation.
- [ ] Rejected interpretations do not return later as accepted truth.
- [ ] Fictional adventure/combat behavior alone cannot create confirmed real-world evidence.
- [ ] Pure-fun adventures can complete with no reflection target.
- [ ] Atlas Snapshots are dated and revisable; no terminal "Greyson is complete" state governs the product.

## Permanent agency

- [x] PASS remains available.
- [x] PRIVATE remains available.
- [x] STOP remains available.
- [x] SERIOUS remains available.
- [x] HELP remains available.
- [x] Sass controls remain available.
- [ ] These controls remain available across Journal, Adventure, Combat, Boss, Mystery, and Reflection modes where applicable.

## Game authority

- [x] Model output cannot mutate XP/level/unlocks/achievements/quest completion through the existing firewall.
- [ ] Model output cannot mutate adventure eligibility/lifecycle.
- [ ] Model output cannot mutate combat HP/damage/turn order/objectives/outcomes/rewards.
- [ ] Model output cannot decide Snapshot eligibility.
- [ ] Mechanics can complete without a narrative provider call.

## Privacy and provenance

- [x] Existing PRIVATE filtering is structural for current provider context.
- [x] Existing answer retraction invalidates current derived evidence paths.
- [ ] PRIVATE/retracted Journal sources are excluded before provider payload construction.
- [ ] Derived v2 evidence/insights/contradictions/gaps/seeds/memories/Snapshot eligibility retire when they depend exclusively on PRIVATE/retracted sources.
- [ ] No real Greyson journal text/transcript/private evidence enters Git or synthetic fixtures.
- [ ] No development/evaluation prompt sent to LM Arena, Grok Build, AI Studio, or similar contains real Greyson campaign material.

## Schema v2 and migration

- [ ] `CURRENT_SCHEMA_VERSION` advances to 2 when the first durable Journal/Adventure state lands.
- [ ] Canonical synthetic v1 exports migrate deterministically to v2.
- [ ] Legacy turns survive migration.
- [ ] Boss/Mystery state survives migration.
- [ ] worldJourney survives migration.
- [ ] Existing FinalAssessment content migrates into historical Snapshot-shaped state.
- [ ] Export/import validates both valid and malformed v2 inputs.
- [ ] Save/reload/export/delete/import preserves v2 state.

## Journal

- [ ] Typed Journal entry save/reload works.
- [ ] Speech-to-text transcript enters an editable Journal composer.
- [ ] Journal PRIVATE works.
- [ ] Journal retraction works.
- [ ] Journal history is inspectable.
- [ ] Journal entry links to Reflection/Adventure state persist.

## Knowledge gaps

- [ ] Unknown / contradiction / change / underexplored / curiosity gaps are deterministic.
- [ ] Gap scoring does not privilege pain or trauma.
- [ ] PRIVATE/retracted material cannot create an eligible gap.
- [ ] Recent-topic cooldown prevents repetitive seed selection.
- [ ] Greyson can retire a theme from future adventures.

## Adventure

- [ ] AdventureSeed deduplicates correctly.
- [ ] AdventureRun persists/reloads mid-beat.
- [ ] Hook -> Approach -> Complication -> Encounter -> Choice/Consequence -> optional Reflection works with local/mock content.
- [ ] Natural-language action boundary rejects malformed/impossible state changes safely.
- [ ] Withdrawal/fail-forward preserves valid state.
- [ ] Completed adventure history persists.
- [ ] World consequences persist.
- [ ] Observation -> Reflection handoff is optional and gated by eligibility.

## Combat

- [ ] ATTACK works deterministically.
- [ ] TECHNIQUE works deterministically.
- [ ] GUARD works deterministically.
- [ ] ACT works deterministically.
- [ ] LEAVE/flee/story exit works deterministically.
- [ ] At least five objective types exist.
- [ ] At least five gimmicks exist.
- [ ] Enemy intent is deterministic.
- [ ] Mid-combat persistence/reload works.
- [ ] Timed hooks have accessible fallback and deterministic tests.
- [ ] At least one nonviolent pacify/ACT encounter works.
- [ ] At least three visibly distinct objective/gimmick combinations work in-browser.
- [ ] Ordinary tuning usually resolves in roughly 2–5 meaningful player turns.

## Memory and recurrence

- [ ] AdventureMemory is typed and provenance-aware.
- [ ] Retrieval is bounded without vectors.
- [ ] PRIVATE/retracted source retirement removes derived memory eligibility.
- [ ] A recurring NPC can reference a prior synthetic adventure.
- [ ] Long-campaign memory/context size remains bounded.

## World integration

- [ ] Available adventure seeds can appear as deterministic world markers.
- [ ] Visible encounter entities can transition into encounters.
- [ ] Journal is reachable from World in one practical action.
- [ ] World consequences visibly alter appropriate props/routes/NPC availability.
- [ ] Markers are not color-only.
- [ ] World -> Adventure -> Combat -> World transitions do not horizontally overflow at 320/390/430 widths.

## Atlas Snapshots

- [ ] Snapshot record/history persists locally.
- [ ] Eligibility is deterministic.
- [ ] Snapshot synthesis uses provenance-visible material only.
- [ ] Two Snapshots coexist without rewriting the older one.
- [ ] "What changed" reflects supported deltas only.
- [ ] Legacy final-assessment data migrates without being treated as current terminal truth.

## TTS removal

- [ ] Production source contains no active `speechSynthesis` path.
- [ ] Production source contains no `SpeechSynthesisUtterance`.
- [ ] No voice picker is rendered.
- [ ] No assistant-spoken prompt/reply requirement remains in canonical docs.
- [ ] Speech-to-text remains functional where available.
- [ ] Typing remains complete fallback.
- [ ] Backgrounding/leaving cancels capture.
- [ ] Microphone does not automatically reopen after a text response.

## PWA / resilience

- [x] Existing PWA shell/build exists.
- [x] Existing campaign state survives reload in browser tests.
- [x] Existing export/import/delete foundation exists.
- [ ] Offline shell and local Journal/Atlas/World access survive the v2 integration.
- [ ] Provider timeout/quota/malformed response degrades without state corruption.
- [ ] No provider failure can double-award or replay deterministic state transitions.

## Assets and content

- [ ] v4 asset IDs/manifest/provenance contract is frozen before runtime switch.
- [ ] Candidate assets are integrity-checked for dimensions, hashes, paths, duplicates/orphans, provenance, and family completeness.
- [ ] Greyson/Aerron continuity passes human visual review.
- [ ] No Andrew asset enters the Greyson runtime pack.
- [ ] No runtime AI image generation is introduced.
- [ ] Twelve adventure templates validate against the runtime schema.
- [ ] At least thirty combat encounter definitions pass deterministic simulation.
- [ ] At least 20% of ordinary mature seed content has `learningTarget: 'none'`.

## Full vertical slice

Before content scale-up, one synthetic real-browser journey must prove:

```text
journal
-> deterministic gap/curiosity
-> Explore this
-> world marker
-> physical Worldwalker travel
-> adventure
-> combat/ACT
-> consequence + observation
-> first reflection rejected
-> rejection preserved
-> second explicit reflection supports evidence
-> Atlas/Vault update
-> reload
-> export
-> delete
-> import
```

No Workers AI dependency is allowed for this gate.

## Release hardening

Before a v2 release candidate can merge to `main`:

- [ ] full unit suite passes;
- [ ] full production/PWA browser suite passes;
- [ ] TypeScript/build clean;
- [ ] v1/v2 migration torture passes;
- [ ] PRIVATE/retraction canary is absent from every derived/runtime/provider surface;
- [ ] adventure/combat double-submit concurrency checks pass;
- [ ] provider malformed/timeout/quota/offline degradation passes;
- [ ] long-campaign context remains bounded;
- [ ] asset integrity scan passes;
- [ ] no-TTS source/bundle/canonical-doc scan passes;
- [ ] 320/390/430/tablet mobile pass completes;
- [ ] reduced-motion/keyboard/touch/semantic accessibility pass completes;
- [ ] clean-clone reproducible build passes;
- [ ] sensitive-data/repository secret audit passes;
- [ ] a fresh agent can resume from repo docs alone;
- [ ] full synthetic lifecycle through at least two Snapshots and import passes;
- [ ] final diff scope matches the accepted integration plan;
- [ ] remaining unknowns are explicitly recorded.

## Human closure

Atlas is not product-complete until a real Greyson pilot occurs.

Observe only product friction categories unless Greyson explicitly chooses to preserve personal content.

Questions include:

- Does he journal without being pushed?
- Does he understand what the world is for?
- Does he want to follow adventure markers?
- Is combat fun rather than intrusive?
- Does reflection feel respectful rather than like a disguised test?
- Does he correct Atlas when it is wrong?
- Does Atlas remember the correction?
- Does the world feel personal without feeling invasive?
- Does he want to come back?
