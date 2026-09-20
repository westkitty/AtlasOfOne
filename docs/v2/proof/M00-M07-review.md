# Independent review — M00-M07 schema-v2 persistence foundation

- **Implementation commit:** `c7f87cc0209e020b70daddd201136d9af98eec69`
- **Bounded review repair:** `f0d9c93a974dc910c9c1a3f0d8a436422902e6d8`
- **Reviewer:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for `integration/atlas-v2-journal-adventure-combat`; not authorized for `main`.

## Scope review

The packet changes persistence/schema code, persistent campaign types, synthetic fixtures, persistence/browser assertions, ledger/proof files, and one integration-hot-zone initializer in `src/game/engine.ts`.

The `src/game/engine.ts` edit is an integration-owner exception approved during review because `createInitialCampaign()` must construct the new current schema-v2 aggregate. The edit is limited to `schemaVersion: 2` and empty v2 durable collections; no event, progression, encounter, or combat behavior changed.

No dependency, Worker, provider/network, `App.tsx`, asset, package, push, deployment, or `main` mutation is present.

## Findings and bounded repair

1. **Privacy eligibility drift.** `providerEligibleV2State()` treated an Insight/Contradiction as eligible when any supporting evidence remained visible, while existing Atlas privacy authority requires the whole evidence provenance chain to be visible. Repaired to conservative all-source evidence provenance.
2. **Reflection-to-memory propagation gap.** A memory could remain active through a non-PRIVATE Reflection even after that Reflection's underlying Journal/Insight/Contradiction/Snapshot source became ineligible. Repaired by resolving Reflection eligibility through source IDs before allowing Reflection-backed memory provenance.
3. **Snapshot/memory prose safety.** Prose-bearing records now require all referenced provenance to remain eligible; structural gap/seed records may preserve mixed support when an eligible source remains.
4. **Historical FinalAssessment representation.** The migrated historical Snapshot previously used territory labels as its territory summaries. Repaired to preserve the actual legacy FinalAssessment domain summaries while retaining the full legacy object verbatim and historical-ineligible status.
5. **Proof metadata.** The executor receipt did not contain its exact commit SHA. Reconciled to `c7f87cc`.

## Validation after repair

- `npx tsc --noEmit` — PASS.
- `npx vitest run tests/persistence tests/adversarial/persistence-torture.test.ts` — PASS, **30/30** across 6 files.
- `npm test` — PASS, **306/306** across 39 files.
- `npm run build` — PASS; existing non-fatal >500 kB client chunk warning remains.
- `tests/browser/onboarding-continuity.test.ts` — PASS, **6/6**.
- `tests/browser/phase5-long-session.test.ts` — PASS, **6/6**, including real retraction -> export -> delete -> import -> local finalization.
- The executor's original three-file browser subset reported **30/30** before review repair. A combined post-repair rerun was abandoned because duplicate/hung browser-harness processes made that run non-authoritative; the two highest-value files above were rerun cleanly in isolation and passed.

## Privacy / migration verdict

- Schema version 2 is justified by durable v2 state.
- v1 -> v2 migration remains deterministic and non-mutating.
- v1 state preservation, IndexedDB torture, malformed-import protection, and unsupported-future-version rejection remain covered.
- Provider-eligible v2 derived state is now conservative with respect to private/retracted provenance.
- No prose search participates in privacy retirement.
- No real Greyson/private data appears in fixtures.

## Merge boundary

This review authorizes only integration of the reviewed packet into `integration/atlas-v2-journal-adventure-combat`. It does not authorize push, deployment, or merge to `main`.
