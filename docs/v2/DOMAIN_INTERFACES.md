# Atlas v2 Domain Interface Freeze

**Packet:** D05  
**Status:** candidate contract pending independent review and merged-integration proof  
**Authority:** `docs/MASTER_INTEGRATION_PLAN.md`, current verified integration state, and the v2 capability invariant manifest

This document freezes the shared semantic interfaces that independent v2 lanes may build against.

It does **not** implement schema v2, add persistence wiring, add shared GameEvents, or make any unimplemented behavior verified.

---

## 1. Contract laws

1. Durable records carry stable string IDs and explicit provenance links.
2. PRIVATE/retracted eligibility is structural and provenance-based.
3. Fictional Adventure/Combat actions are never confirmed self-evidence by themselves.
4. Greyson has final authority over interpretations about himself.
5. Provider/model output is always proposal data and never deterministic game authority.
6. Progression, combat truth, persistence, migration, privacy retirement, and Snapshot eligibility remain deterministic TypeScript authority.
7. Domain lanes exchange frozen public records/intents; they do not import one another's internal reducers/controllers.
8. No v2 lane may add a shared progression-bearing `GameEvent` until D06 freezes event-dispatch authority.
9. This contract may be extended only through an explicit integration-owner contract-change packet with downstream impact analysis.

---

## 2. Durable v2 record contracts

The following are the semantic record shapes M01 must implement in schema v2. Exact module locations may follow lane ownership, but field meaning is frozen here.

### 2.1 JournalEntry

```ts
interface JournalEntry {
  id: string;
  createdAt: string;
  text: string;
  inputMode: 'typed' | 'speech-to-text';
  privacy: 'normal' | 'private';
  status: 'active' | 'retracted';
  sourcePrompt?: string;
  linkedReflectionIds: string[];
  linkedAdventureIds: string[];
}
```

Rules:

- `text` is Greyson-authored input, not model prose.
- `sourcePrompt` is optional; blank/self-initiated Journal entries are first-class.
- PRIVATE or retracted entries are ineligible for provider context and exclusive downstream derivation.
- Retraction preserves history; it does not erase the record.

### 2.2 KnowledgeGap

```ts
interface KnowledgeGap {
  id: string;
  kind: 'unknown' | 'contradiction' | 'change' | 'underexplored' | 'curiosity';
  territoryIds: string[];
  dimensionIds: string[];
  sourceEvidenceIds: string[];
  sourceJournalEntryIds: string[];
  summary: string;
  status: 'open' | 'seeded' | 'resolved' | 'retired';
  priority: number;
}
```

Rules:

- eligibility and `priority` are deterministic;
- the model may propose wording but may not decide what Greyson "needs" to explore;
- a gap exclusively dependent on PRIVATE/retracted sources retires.

### 2.3 AdventureSeed

```ts
interface AdventureSeed {
  id: string;
  sourceGapIds: string[];
  kind: AdventureKind;
  territoryId: string;
  premise: string;
  learningTarget: 'none' | 'reflection-eligible';
  status: 'available' | 'started' | 'retired';
}
```

`AdventureKind` is an Adventure-lane registry type, not provider-free text. The plan requires initial investigation, social-dilemma, and pure-fun templates, but D05 does not invent or freeze their exact registry IDs as an exhaustive permanent union. A00/content-contract work owns that registry behind this stable type.

Rules:

- `learningTarget: 'none'` is a valid successful adventure;
- seed eligibility/deduplication is deterministic;
- source gaps remain inspectable provenance;
- the model may propose `premise` only inside an eligible deterministic request.

### 2.4 AdventureRun

```ts
interface AdventureRun {
  id: string;
  seedId: string;
  territoryId: string;
  status: 'active' | 'complete' | 'withdrawn';
  currentBeat: string;
  characterIds: string[];
  memoryIds: string[];
  startedAt: string;
  completedAt?: string;
}
```

Rules:

- run lifecycle is deterministic;
- withdrawal is not failure or punishment;
- run completion alone does not create self-evidence.

### 2.5 AdventureAction

```ts
interface AdventureAction {
  id: string;
  runId: string;
  createdAt: string;
  kind: 'say' | 'do' | 'inspect' | 'travel' | 'combat' | 'leave';
  text: string;
}
```

Rules:

- action text records what the player chose in fiction;
- an action may support an AdventureObservation;
- an action is never automatically evidence about Greyson.

### 2.6 AdventureObservation

```ts
interface AdventureObservation {
  id: string;
  runId: string;
  sourceActionIds: string[];
  observation: string;
  status: 'unreflected' | 'reflected' | 'discarded';
}
```

Rules:

- observations are candidates for reflection, not self-claims;
- `unreflected` observations have zero evidence authority;
- `discarded` observations remain history-bearing but cannot re-enter evidence eligibility.

### 2.7 ReflectionRecord

#### Authority resolution

The master plan contains two descriptions that look inconsistent only if one assumes every UI choice must be the same field:

- **S01 — section 7.2 illustrative type:** the record carries epistemic states `pending | confirmed | partial | rejected | uncertain`, while explicitly saying exact TypeScript naming may change but semantic contracts should not.
- **S02 — section 13.2:** the user-facing Reflection choices are Confirm, Partial, Reject, Uncertain, Revise, Private.
- **S03 — section 3.1:** Greyson must be able to confirm, partially accept, reject, revise, retract, mark private, or leave uncertain.
- **S04 — RF05 and RF09:** revision provenance and Reflection privacy/retraction are separate implementation packets.

**Resolution:** there is no need to collapse all six UI decisions into one status enum. The governing contract is three orthogonal facts:

1. the explicit decision Greyson made;
2. the epistemic state of the interpretation;
3. whether the record is private.

That preserves S01's five epistemic states while also preserving every S02/S03 user action and the independent privacy/provenance work required by S04.

```ts
type ReflectionDecision =
  | 'confirm'
  | 'partial'
  | 'reject'
  | 'uncertain'
  | 'revise'
  | 'private';

type ReflectionEpistemicStatus =
  | 'pending'
  | 'confirmed'
  | 'partial'
  | 'rejected'
  | 'uncertain';

interface ReflectionRecord {
  id: string;
  sourceKind: 'journal' | 'adventure' | 'contradiction' | 'insight';
  sourceIds: string[];
  question: string;
  response: string;
  interpretation?: string;
  decision?: ReflectionDecision;
  epistemicStatus: ReflectionEpistemicStatus;
  privacy: 'normal' | 'private';
  recordStatus: 'active' | 'retracted';
  createdAt: string;
}
```

Decision rules:

- no `decision` means Greyson has not acted yet and `epistemicStatus` is `pending`;
- `confirm` resolves the interpretation to `confirmed`;
- `partial` resolves it to `partial` and deterministic conversion must preserve the rejected/unaccepted remainder;
- `reject` resolves it to `rejected`, remains history-bearing anti-repeat context, and has zero confirmed-evidence authority;
- `uncertain` resolves it to `uncertain` and has zero confirmed-evidence authority;
- `revise` records that Greyson supplied a replacement/amendment; RF05 owns the provenance update and the revised response may become explicit player-stated evidence only through deterministic conversion;
- `private` sets `privacy: 'private'`, closes the topic under RF09/M06 rules, and does **not** falsely imply rejection, uncertainty, or confirmation;
- privacy remains orthogonal so an already-confirmed/partial/revised historical record can later be withheld without destroying its epistemic history;
- retraction is not a seventh initial decision: it is a later lifecycle action recorded as `recordStatus: 'retracted'`; the record remains in history while its authority and exclusive derived state retire.

No AdventureObservation may transition directly into confirmed evidence without a Reflection response or another explicit real-world source.

### 2.8 AdventureMemory

```ts
interface AdventureMemory {
  id: string;
  type: 'character' | 'place' | 'event' | 'relationship' | 'promise' | 'object';
  summary: string;
  triggerTerms: string[];
  sourceIds: string[];
  privacy: 'normal' | 'private';
  status: 'active' | 'retired';
  lastUsedAt?: string;
}
```

Rules:

- memories are bounded recurrence aids, not psychological evidence;
- source IDs are mandatory provenance;
- exclusive PRIVATE/retracted provenance retires the memory;
- model output may propose wording, not privacy eligibility.

### 2.9 AtlasSnapshot

```ts
interface AtlasSnapshot {
  id: string;
  createdAt: string;
  evidenceIds: string[];
  insightIds: string[];
  contradictionIds: string[];
  synthesis: FinalAssessmentLikeShape;
  previousSnapshotId?: string;
}
```

Rules:

- Snapshots are immutable historical artifacts once written;
- multiple snapshots may coexist;
- Snapshot creation never marks Greyson complete;
- eligibility is deterministic;
- synthesis uses provenance-visible eligible material only;
- M03 must preserve an existing v1 `FinalAssessment` by converting it into the first historical snapshot-shaped record rather than discarding it;
- the first schema-v2 implementation may use the existing validated FinalAssessment-compatible synthesis shape until the Snapshot provider proposal receives its own versioned contract.

---

## 3. Schema-v2 collection surface

M01 must add durable v2 collections with empty defaults, without feature wiring:

```ts
journalEntries: JournalEntry[];
knowledgeGaps: KnowledgeGap[];
adventureSeeds: AdventureSeed[];
adventureRuns: AdventureRun[];
adventureActions: AdventureAction[];
adventureObservations: AdventureObservation[];
reflections: ReflectionRecord[];
adventureMemories: AdventureMemory[];
atlasSnapshots: AtlasSnapshot[];
```

Contract rules:

- schema version becomes `2` when these durable fields enter the schema;
- M01 changes shape only; it does not invent populated data;
- M02 owns deterministic v1 -> v2 migration;
- M03 owns historical FinalAssessment -> Snapshot migration;
- legacy `turns`, Boss/Mystery state, `worldJourney`, settings, and legacy `finalAssessment` compatibility remain preserved through the migration sequence;
- later schema-v2 additions must remain explicit/defaulted and cannot silently reinterpret existing values.

No combat collection is forced into M01. Combat persistence is added behind its own frozen C-lane types once C00 establishes the deterministic engine shape.

---

## 4. Typed provider mode discriminator

Provider compilation must receive an explicit mode. The model never infers its authority from prose.

```ts
type AtlasProviderMode =
  | 'journal'
  | 'reflection'
  | 'adventure'
  | 'world-interaction'
  | 'combat'
  | 'boss-synthesis'
  | 'mystery-door'
  | 'snapshot'
  | 'pure-fun';
```

Mode is an input to context compilation and proposal validation. It does not grant deterministic mutation rights.

The future provider proposal union is conceptually:

```ts
type ModelProposal =
  | JournalProposal
  | ReflectionProposal
  | AdventureSceneProposal
  | EncounterFlavorProposal
  | SnapshotProposal;
```

P-lane packets own exact proposal schemas. D05 freezes only the discriminated-mode requirement and authority ceiling.

---

## 5. Public lane handoffs

### Journal -> Reflection / Knowledge / Adventure

Journal may expose:

- JournalEntry IDs;
- eligible non-private active entry content through a bounded context compiler;
- explicit player curiosity/explore-later intent;
- linked Reflection/Adventure IDs.

Journal must not:

- create a confirmed model inference directly;
- choose gap priority;
- start an Adventure merely because a model suggested one.

### Reflection -> Evidence

Reflection may expose:

- ReflectionRecord;
- explicit decision;
- source IDs;
- response text eligible under privacy rules.

Only deterministic RF02/RF05 conversion may produce evidence changes.

### Knowledge -> Adventure

Knowledge may expose an eligible seed request containing stable gap IDs, territory, deterministic privacy exclusions, learning target, and bounded eligible claims.

The model may propose a premise. It may not change gap priority, eligibility, privacy, or `learningTarget`.

### Adventure -> Reflection

Adventure may expose AdventureObservation IDs and the run/action provenance beneath them.

It may never expose an AdventureAction as confirmed real-world evidence.

### Adventure -> Combat

Adventure may request a deterministic Combat definition/encounter through a stable encounter ID and receive a deterministic resolution/consequence record.

The C lane owns HP, damage, turn order, objective truth, status effects, outcome, and rewards.

### Combat -> Reflection

Combat may create fictional observations eligible for optional Reflection. Combat commands/outcomes alone have zero self-evidence authority.

### Atlas/Snapshot

Snapshot synthesis receives only IDs/material already eligible under deterministic privacy/provenance rules. It never reaches around those selectors to raw private history.

---

## 6. Ownership and import boundaries

After D05 merges:

- Journal public contracts live under `src/journal/**`;
- Reflection public contracts live under `src/reflection/**`;
- Knowledge public contracts live under `src/knowledge/**` or the accepted Adventure seed boundary;
- Adventure public contracts live under `src/adventure/**`;
- Combat public contracts live under `src/combat/**`;
- World public interaction contracts live under `src/world/**`;
- Atlas/Snapshot contracts live under `src/atlas/**`;
- provider mode contracts live under `src/cartographer/**`.

Lane internals may import shared public types. They must not import another lane's reducer/controller/private helper to bypass the public handoff.

Shared `src/game/types.ts`, `src/game/engine.ts`, migration files, provider root schema, Worker, package manifest, App, Operational State, and master authority remain integration-owner hot zones.

---

## 7. D06 boundary: no shared event invention yet

D05 freezes data and handoff semantics only.

Until D06 is complete:

- existing `GameEvent` behavior remains authoritative;
- no v2 lane adds a new progression-bearing shared event;
- no provider proposal dispatches game/combat mutations directly;
- new domain engines may define local pure reducers/actions inside their lane, but crossing into shared CampaignState waits for the D06 event/firewall contract.

This prevents M01/J/R/A/C lanes from independently inventing incompatible mutation paths.

---

## 8. Privacy/retraction contract

For every durable v2 record with provenance:

1. determine eligibility from source IDs/status/privacy, not prose;
2. if all supporting sources become PRIVATE/retracted, retire or withhold the derived item;
3. mixed provenance may remain only from still-eligible support;
4. rejected/uncertain fictional interpretations never become confirmed support;
5. provider payload construction receives only the already-filtered eligible view;
6. deletion/retraction never requires erasing history to remove authority.

M06 owns implementation of derived-state retirement hooks and canary proof.

---

## 9. Compatibility contract

Schema v2 must preserve:

- legacy `TurnRecord` history;
- evidence provenance and statuses;
- Boss/Mystery runs;
- `worldJourney`;
- settings and agency state;
- export/import behavior;
- historical FinalAssessment through Snapshot migration;
- current Greyson/Aerron runtime asset identity.

M00 canonical synthetic v1 fixtures are the required migration inputs. They are not optional examples.

---

## 10. Contract-change protocol

A lane that cannot implement its packet behind D05 must stop and return:

- exact missing interface;
- why the frozen interface is insufficient;
- affected lane(s);
- privacy/progression/migration impact;
- rollback impact;
- proposed minimal change;
- focused test obligation.

No lane may silently widen a public interface to keep moving.

---

## D05 verdict

**CANDIDATE FREEZE — implementation-safe pending combined D02/D03/D04 integration CI and independent contract review.**

Once those gates pass, this document may become the public interface authority for M01 and the parallel Journal/Reflection/Adventure/Combat/Provider lanes.
