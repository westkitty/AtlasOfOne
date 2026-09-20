# Atlas v2 Interface Contracts

**Status:** frozen at Wave 1. The compileable public surface is
[`src/contracts/`](/Users/andrew/Atlas_Of_One/src/contracts/index.ts). These are
semantic contracts, not schema-v2 persistence or runtime implementations.

## Public domain contracts

| Domain | Frozen public records | Authority boundary |
|---|---|---|
| Journal | `JournalEntry` | Journal text is provenance; private/retracted entries are structurally excluded from later provider context. |
| Reflection / Knowledge | `ReflectionRecord`, `KnowledgeGap` | Only the player can CONFIRM, PARTIAL, REJECT, UNCERTAIN, REVISE, or PRIVATE a durable interpretation. Local TypeScript calculates gap priority. |
| Adventure | `AdventureSeed`, `AdventureRun`, `AdventureAction`, `AdventureObservation`, `AdventureMemory`, `AdventureTemplate`, `AdventureKind` | An observation is fictional world state, never evidence about Greyson without a reflection. Pure-fun seeds (`learningTarget: 'none'`) are first-class. |
| Combat | `CombatDefinition`, `CombatState`, `CombatCommand` | The deterministic combat lane owns HP, outcomes, rewards, status, and turn rules. Its permanent commands are ATTACK, TECHNIQUE, GUARD, ACT, LEAVE. |
| Atlas | `AtlasSnapshot` | Snapshot eligibility is deterministic. Synthesis prose is proposal data and snapshots are dated historical records, not permanent completion. |
| Provider | `ProviderMode`, `ProviderProposal` | A provider may propose narration, scenes, reflection wording, ACT wording, or Snapshot prose. It cannot author progression, combat state, rewards, outcomes, or eligibility. |

`AdventureKind` normalizes the master-plan catalog to lowercase kebab-case. The
machine names are intentionally stable; user-facing copy is not fixed here.

## Mutation ownership

| Lane | May do | Must not do |
|---|---|---|
| Journal | Create drafts/entries through future persistence APIs and link contract IDs. | Invent progression events, alter combat, bypass privacy/provenance. |
| Reflection / Knowledge | Derive local eligible gaps, create reflection state, request evidence conversion through existing authority. | Infer personal facts from fictional actions, revive private/retracted sources, let a provider rank gaps. |
| Adventure | Consume seeds; produce runs, actions, observations, and memories; request encounters. | Create confirmed evidence, award progression, mutate combat internals. |
| Combat | Deterministically resolve the five commands and emit bounded results. | Decide personality evidence or trust model-supplied HP/reward/success values. |
| Provider | Produce typed proposals/narration for a `ProviderMode`. | Mutate game state, receive private/retracted text, award progression, or emit combat authority. |
| Assets | Target frozen IDs and state names. | Invent engine behavior or IDs. |
| QA | Test contract and product behavior. | Repair production architecture without a separately authorized packet. |

## Dispatch firewall

`src/contracts/dispatch.ts` freezes request/result shapes for later wiring.
They are deliberately not `GameEvent`s. The only future cross-domain requests
currently named are reflection, combat start, adventure withdrawal, and
Snapshot synthesis; the integration owner decides when and how to wire them.

No feature lane may add an event awarding XP, levels, achievements, quest
completion, world unlocks, combat rewards, or Snapshot eligibility. The
current Cartographer crossing remains `src/cartographer/apply.ts`, which may
emit only `ANSWER_ACCEPTED`, `EVIDENCE_ADDED`, and `INSIGHT_ADDED`.

## Hot-zone and path ownership

| Owner | Integration hot zone | Lane-owned paths after this freeze |
|---|---|---|
| Integration owner | `src/App.tsx`, `src/game/types.ts`, `src/game/engine.ts` (cross-domain wiring), `src/persistence/migrations.ts`, `src/cartographer/schema.ts`, `worker/index.ts`, `package.json`, `AGENTS.md`, `OPERATIONAL_STATE.md`, `docs/MASTER_INTEGRATION_PLAN.md`, central asset manifests | `src/contracts/**` until this freeze is merged; later changes use the procedure below. |
| Journal | — | `src/journal/**` |
| Reflection / Knowledge | — | `src/reflection/**`, `src/knowledge/**` |
| Adventure | — | `src/adventure/**` |
| Combat | — | `src/combat/**` |
| Provider | — | `src/cartographer/modes/**` and explicitly assigned bounded context/compiler files |
| Atlas / Snapshots | — | `src/atlas/**` |
| World / UI | — | `src/world/**`, dedicated components only |
| Assets | — | `.art-src/**`, `tools/art/**`, `public/assets/atlas/v4/**` via pipeline |
| QA | — | `tests/**`, `docs/v2/proof/**` |

Feature lanes must not casually edit `App.tsx` or the other hot-zone files.
The current 1,810-line `App.tsx` still requires a separately scoped,
behavior-preserving decomposition packet before multiple UI lanes edit it.

## Persistence and migration obligations

`CURRENT_SCHEMA_VERSION` remains **1**. No v2 record is persisted in this
packet. The first durable Journal/Adventure state must raise the version and
provide a deterministic migration that preserves Turn history, question/answer
provenance, evidence, insights, Boss/Mystery and journey state, settings,
legacy FinalAssessment as historical snapshot-shaped data, and compatible
`campaignCompleted` behavior. Privacy/retraction must retire dependents by
provenance (including evidence, insights, contradictions, gaps, seeds,
memories, and Snapshot eligibility), never by prose searching.

## Interface change procedure

1. A lane returns an interface-change request instead of editing a frozen
   shared contract in place.
2. The request states the current contract, proposed delta, reason, affected
   lanes, migration/persistence impact, authority impact, and tests to change.
3. The integration owner approves and lands the shared change centrally.
4. Feature branches synchronize from that new contract baseline using ordinary
   safe Git practice. No lane silently forks a shared type's meaning.

## Wave-2 readiness

| Lane | Status | Exact condition |
|---|---|---|
| Journal | READY WITH DEPENDENCY | May build `src/journal/**`; durable entry work waits for the dedicated schema-v2 migration lane. |
| Reflection / Knowledge | READY | May implement local gap/reflection logic behind these contracts. |
| Adventure | READY | May implement its runtime in `src/adventure/**`; central event wiring remains integration-owned. |
| Combat | READY | May implement deterministic reducer work in `src/combat/**`; no engine event wiring yet. |
| Provider | READY WITH DEPENDENCY | May build `src/cartographer/modes/**`; changes to the existing shared Zod union require integration-owner synchronization. |
| Assets | READY | May target frozen IDs/contracts without changing engine behavior. |
| World / UI | BLOCKED | Needs Adventure/Combat runtime interfaces in use and the dedicated App decomposition packet before shared UI integration. |
| QA | READY | May add contract/privacy/firewall coverage without architecture mutation. |
| Persistence / Migration | READY | Dedicated owner may begin v2 migration from this contract; it owns the hot-zone migration change. |
