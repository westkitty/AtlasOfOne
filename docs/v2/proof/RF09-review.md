# Independent review — RF09 Reflection privacy/retraction propagation

- **Base SHA:** `04768883e1baf3eefe764e841c8660fd3daf56e6`
- **Codex implementation commit:** `ec441ac3c24313dc1d5c29682a2d35da0e878062`
- **Reviewer repair commit:** `bfa2645b94a983eb51afcabde027582e5943e162`
- **Branch:** `fix/v2-reflection-privacy-propagation`
- **Worktree:** `/Users/andrew/AtlasOfOne-rf09`
- **Executor:** Codex
- **Independent reviewer:** GPT-5.6 Sol
- **Review verdict:** `MERGE_READY` for local `integration/atlas-v2-journal-adventure-combat` only. No push, deployment, or `main` merge authorized.

## Scope

RF09 adds structural, ID/provenance-based privacy propagation for `PRIVATE` Reflection records while preserving raw local source history. It extends the existing retirement graph and current outbound Cartographer/final-assessment filters; it does not add UI, GameEvents, dependencies, schema/migration changes, source deletion, or progression authority.

Changed product surfaces are exactly:
- `src/reflection/privacy.ts`
- `src/persistence/retirement.ts`
- `src/cartographer/context.ts`
- `src/cartographer/finalize.ts`

Focused proof lives in `tests/reflection/privacy-propagation.test.ts`.

## Privacy model

`reflectionPrivacyMask()` builds fresh source-kind sets from every `PRIVATE` Reflection using the union of `sourceIds` and `privacyRetiredSourceIds`. Blank IDs are ignored; mismatched imported source sets fail closed by masking both. The mask is ID-only and never inspects prose.

Masked source kinds:
- journal
- adventure-observation
- insight
- contradiction
- snapshot

Raw source records remain present in `CampaignState`; privacy changes eligibility, not history.

## Independent findings and bounded repair

1. **Transitive Adventure provenance gap — blocking defect found.** The Codex candidate retired a private Journal-backed gap and seed, but still treated all AdventureRuns and AdventureActions as eligible. An observation, Reflection, or AdventureMemory downstream of a retired seed could therefore remain eligible. Reviewer repair now derives eligibility transitively: eligible gap -> seed -> run -> action -> observation -> reflection -> memory.
2. **Broken observation provenance was trusted.** An AdventureObservation with a valid run ID but missing/ineligible `sourceActionIds` could remain eligible. Observation eligibility now requires an eligible run and all action provenance to be eligible.
3. **Provenance-free AdventureMemory was trusted.** An empty `sourceIds` array previously remained active. AdventureMemory now fails closed when provenance is absent, matching Atlas's provenance-first privacy model.
4. **Positive-path protection added.** The review test proves a valid unmasked run/action/observation/memory chain remains eligible, preventing the privacy repair from becoming blanket retirement.
5. **Full-suite timing discriminator.** One broad-suite run under host contention timed out the 600-turn context ceiling test while that same test had already passed in focused execution. Immediate isolated rerun passed 12/12 with the ceiling case at ~0.7s; a fresh full-suite rerun then passed 331/331. No product change was made for the transient timing event.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| PRIVATE mask is structural and ID-based | `reflectionPrivacyMask`; prose-equality canary | PASS |
| Raw source history is preserved | Journal/Observation/Insight/Contradiction/Snapshot assertions inspect unchanged input records | PASS |
| Journal PRIVATE propagates to dependent gap/seed/reflection/memory | RF09 focused tests including transitive adventure chain | PASS |
| AdventureObservation PRIVATE/retraction becomes ineligible | source-kind canaries + action/run provenance checks | PASS |
| Insight PRIVATE is withheld from provider/finalization/local synthesis | unique canary absent from `compileContext`, `compileFinalizeContext`, `generateLocalAssessment` | PASS |
| Contradiction PRIVATE is withheld from provider/finalization/local synthesis | unique canary absent from all three paths | PASS |
| Snapshot PRIVATE retires provider eligibility and dependents | snapshot source-kind canary; positive unmasked snapshot-backed memory check | PASS |
| Mixed eligible provenance remains usable where current semantics allow | private Journal + independent eligible Evidence keeps gap open | PASS |
| Journal retraction propagates through Reflection-backed memory | focused retraction test | PASS |
| Malformed PRIVATE source sets fail closed | union of `sourceIds` + `privacyRetiredSourceIds` test | PASS |
| Broken/absent provenance fails closed | malformed observation + provenance-free memory tests | PASS |
| Prose does not control privacy | identical canary prose in unmasked Journal remains eligible | PASS |
| Current provider/finalization wire schemas remain unchanged | source diff + typecheck | PASS |
| No forbidden-path/dependency/schema/engine/UI changes | total base-to-review diff inspection | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- `npx vitest run --configLoader runner tests/reflection/privacy-propagation.test.ts` — **10/10 PASS**.
- Impacted privacy/finalization group — **52/52 PASS** across 5 files.
- Isolated `tests/cartographer/context.test.ts` discriminator — **12/12 PASS** after one host-contention timeout in an earlier broad run.
- Fresh full unit rerun — **331/331 PASS** across 42 files.
- `WRANGLER_LOG_PATH=/tmp/atlas-rf09-review-wrangler.log npm run build -- --configLoader runner` — **PASS**; Worker + client/PWA bundles generated. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` — **PASS**.
- Negative scan — no TTS APIs, evidence/progression event authority, real-person fixture content, dependency changes, schema/migration changes, Worker changes, or UI changes in the packet.

## Diff-scope verdict

**PASS.** Base-to-review implementation changes are confined to the four authorized product files plus one authorized focused test file. No deletion, rename, dependency/config drift, generated artifact, or unrelated formatting change is present. The untracked `node_modules` symlink is the known worktree dependency link and is not part of the diff.

## Protected result

- Privacy/retraction acts on eligibility, not destructive history rewriting.
- PRIVATE Reflection never creates evidence or progression authority.
- Fictional Adventure behavior still cannot become personal evidence without explicit Reflection.
- A private/retracted source cannot remain indirectly provider-eligible through a retired Adventure seed chain.
- Unknown provenance is withheld rather than assumed safe.
- Valid, unmasked provenance remains eligible.

## Merge boundary

This receipt authorizes only fast-forward integration of the reviewed branch into local `integration/atlas-v2-journal-adventure-combat` after environment, ancestry, and dirty-state verification. It does not authorize push, deployment, or merge to `main`.
