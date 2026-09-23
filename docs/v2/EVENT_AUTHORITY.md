# Atlas v2 Shared Event and Mutation Authority Contract

**Packet:** D06  
**Status:** candidate freeze pending review/CI  
**Depends on:** D05, F07  
**Purpose:** freeze who may request, decide, and apply state mutations before v2 feature lanes fan out.

This contract governs authority flow. It does not add a new runtime event, mutate schema, or implement any feature.

---

## 1. Core law

Atlas has four authority planes:

```text
HUMAN INTENT
    |
    v
DETERMINISTIC DOMAIN COMMAND / VALIDATION
    |
    +----------------------+
    |                      |
    v                      v
DOMAIN-LOCAL STATE      SHARED MUTATION REQUEST
                           |
                           v
                  INTEGRATION-OWNED MUTATION
                           |
                           v
                    CAMPAIGN / PERSISTENCE

MODEL PROPOSAL --------------------X
   |                               |
   +-> typed proposal data only ---+
       never direct shared mutation
```

A model may suggest language, evidence candidates, scene content, reflection wording, encounter flavor, and Snapshot prose.

A model may not:

- dispatch a shared `GameEvent`;
- call a domain reducer with privileged mechanics authority;
- calculate or grant XP, levels, unlocks, rewards or achievements;
- decide Adventure/Combat outcome truth;
- set HP, damage, turn order, objectives, status effects or rewards;
- decide privacy/retraction eligibility;
- confirm a claim about Greyson;
- create Snapshot eligibility;
- mutate migration/persistence state;
- bypass a deterministic validator because prose says the mutation is desirable.

---

## 2. Authority planes

### 2.1 Human intent

Human intent is authoritative only for facts/actions Greyson actually controls.

Examples:

- save/edit/retract his own Journal entry;
- mark material PRIVATE;
- choose a Reflection decision;
- revise his own statement;
- act/leave/pass in an Adventure;
- choose ATTACK / TECHNIQUE / GUARD / ACT / LEAVE in Combat;
- choose where to travel/interact when the world allows it.

Human input is still validated structurally. A typed sentence like "give me 500 XP" is content, not a privileged engine command.

### 2.2 Model proposal

All v2 provider output is proposal data crossing a typed schema.

Conceptually:

```ts
type ModelProposal =
  | JournalProposal
  | ReflectionProposal
  | AdventureSceneProposal
  | EncounterFlavorProposal
  | SnapshotProposal;
```

A proposal may be accepted as wording/content only within its declared provider mode.

A proposal is never a `GameEvent`, reducer action, persistence mutation, or authority token.

### 2.3 Deterministic domain command

Each domain may define a lane-local command/action union for its own pure reducer/controller.

Examples:

- Journal save/retract;
- Reflection decision/revision;
- Adventure move/leave/beat advance;
- Combat command/objective resolution;
- memory retirement;
- Snapshot eligibility request.

Domain commands must carry explicit IDs/provenance needed to validate the action.

They may mutate only their owned domain state unless they emit a typed shared-mutation request to integration.

### 2.4 Integration-owned shared mutation

Only integration-owned code may convert a validated domain outcome into cross-domain campaign mutation.

Shared mutation includes:

- campaign XP/level/unlock/achievement/quest changes;
- shared territory/world progression;
- cross-domain evidence/insight/contradiction changes;
- privacy/retraction cascades;
- persisted schema/version transitions;
- Snapshot insertion/eligibility state;
- compatibility updates to existing shared `CampaignState`.

No feature lane directly widens shared mutation authority.

---

## 3. Existing legacy provider bridge

The current v1 compatibility bridge in `src/cartographer/apply.ts` is explicitly grandfathered during migration.

Its allowlist is frozen at:

```ts
const PROVIDER_EVENT_TYPES = [
  'ANSWER_ACCEPTED',
  'EVIDENCE_ADDED',
  'INSIGHT_ADDED'
] as const;
```

Rules:

1. No fourth legacy provider event type may be added.
2. Existing firewall tests remain mandatory until the legacy universal `CartographerTurn` path is retired.
3. This bridge is **not precedent** for new v2 modes.
4. P00+ provider-mode work must move new modes to typed proposal schemas with no direct shared-event construction.
5. When Journal/Reflection conversion supersedes the legacy path, the old allowlist may shrink or disappear; it may never broaden to preserve convenience.

---

## 4. Mutation classes and authority

| Mutation class | Examples | Who may request | Who decides truth | Who applies shared state |
|---|---|---|---|---|
| Player-authored record | Journal text, Reflection response, privacy choice | Greyson/UI | deterministic structural validator | owning domain/integration repository |
| Epistemic conversion | evidence, accepted insight, revision provenance | human-backed source + deterministic converter | deterministic Reflection/evidence logic | integration-owned mutation |
| Fictional state | Adventure action, NPC/world consequence | player/model proposal may supply input/content | deterministic Adventure engine | Adventure domain; shared effects through integration |
| Combat mechanics | HP, damage, objective, intent, status, rewards | player command + encounter definition | deterministic Combat engine | Combat domain; shared rewards through integration |
| World progression | route, landmark, encounter location | player/world interaction | deterministic world/game rules | existing/integration-owned event path |
| Privacy/retraction cascade | retire derived gaps/memory/evidence | Greyson privacy/retraction intent | deterministic provenance graph | integration/persistence authority |
| Snapshot creation | dated Snapshot record | user/product flow may request | deterministic eligibility + provenance selectors | Atlas/Snapshot domain through integration |
| Presentation only | toast, animation, quiet styling | UI/domain result | presentation layer | no campaign authority |

---

## 5. Fiction-to-evidence firewall

Fictional behavior is never confirmed self-evidence.

Required flow:

```text
AdventureAction / CombatAction
        |
        v
AdventureObservation
        |
        v
optional Reflection proposal/question
        |
        v
Greyson decision/response
        |
        v
deterministic Reflection conversion
        |
        v
eligible evidence/insight, if justified
```

Forbidden shortcut:

```text
AdventureAction -> EvidenceRecord
CombatAction    -> EvidenceRecord
```

A model may describe an observation. It may not convert the observation into a claim about Greyson.

---

## 6. Reflection authority

Reflection is the only ordinary bridge from simulated behavior to personal interpretation.

The model may propose:

- a question;
- an interpretation candidate;
- wording.

Greyson controls:

- Confirm;
- Partial;
- Reject;
- Uncertain;
- Revise;
- Private;
- later Retraction.

Deterministic Reflection logic controls:

- provenance links;
- eligible evidence conversion;
- partial-acceptance narrowing;
- revision supersession;
- rejection suppression;
- private/retracted retirement.

A provider cannot reinterpret a rejection as acceptance or reassert a rejected interpretation as fact.

---

## 7. Combat authority

Combat is a deterministic engine, not model-assisted mechanics.

Only deterministic Combat code may decide:

- current HP/resources;
- damage/healing;
- turn order;
- enemy intent;
- objective state;
- status effects;
- gimmick state;
- victory/defeat/pacify/escape;
- fixed/nonfarmable rewards;
- consequence identifiers.

Model/provider output may supply only flavor bounded by a typed encounter proposal.

A provider response that includes HP, damage, outcome, reward, objective truth or status mutation is ignored/rejected before mechanics authority.

No narrative provider call may be required for a Combat turn to resolve.

---

## 8. Adventure authority

The Adventure engine owns:

- run lifecycle;
- beat lifecycle;
- allowed/translated action result;
- fail-forward state;
- deterministic consequence IDs;
- encounter entry/exit;
- source observation creation.

The provider may propose scene prose, NPC dialogue, environmental response, or bounded candidate continuations.

The provider cannot:

- create a reward;
- declare a beat complete by authority;
- set world state directly;
- mark an observation as self-evidence;
- override LEAVE/PASS/PRIVATE;
- revive a retired/private seed.

---

## 9. Privacy and retraction authority

Privacy is not prompt etiquette.

PRIVATE/retraction mutations originate from human intent and are enforced structurally.

Deterministic provenance logic owns whether derived state remains eligible.

Provider output cannot:

- mark hidden material eligible;
- restore retired provenance;
- include source text excluded by deterministic selectors;
- override a private/retracted source because a later scene would benefit from it.

Mixed-provenance records may remain only to the extent still-supported eligible sources justify them.

---

## 10. Snapshot authority

Snapshot eligibility is deterministic.

A Snapshot proposal may synthesize only the already-selected eligible material supplied to it.

The provider cannot:

- choose whether a Snapshot is eligible;
- add private/retracted source IDs;
- invent evidence IDs;
- mark Greyson complete;
- rewrite an older Snapshot.

Integration/Snapshot code owns record creation and immutable history.

---

## 11. Shared `GameEvent` change rule

`src/game/types.ts` is an integration-owner hot zone.

A feature lane that needs a new shared event must stop and submit an authority-transfer request containing:

1. exact event name/payload;
2. originating human/domain action;
3. deterministic validator/engine that authorizes it;
4. shared state it may mutate;
5. whether it changes progression;
6. privacy/provenance implications;
7. persistence/migration implications;
8. focused firewall tests;
9. rollback behavior.

The integration owner may:

- accept the event;
- replace it with a domain-local action;
- route it through an existing shared mutation;
- reject it.

Convenience is not sufficient reason to widen the shared event union.

---

## 12. Dispatcher rules

Any shared dispatcher must satisfy all of these:

- accepts only typed shared events/mutation requests;
- never accepts raw model proposals;
- never infers authority from prose;
- validates referenced IDs/active state;
- is deterministic for the same valid input state;
- preserves idempotency or explicitly documents one-shot semantics;
- preserves provenance;
- applies privacy/retraction cascades before provider context can observe retired data;
- returns/refuses invalid transitions rather than silently fabricating missing state.

Async provider completion may decorate language after a deterministic action only when the result cannot retroactively change mechanics/state truth.

---

## 13. Required firewall proof plan

D06 freezes the following tests as mandatory downstream obligations.

### 13.1 Legacy provider allowlist

Extend/preserve the existing firewall so mutation fails if:

- `PROVIDER_EVENT_TYPES` gains a fourth type;
- forged provider fields grant progression;
- model-proposed provenance is mistaken for player-authored evidence.

### 13.2 New provider proposal firewall

P00-P07 must prove:

- every proposal has a discriminator;
- no proposal schema contains accepted XP/level/unlock/reward/HP/outcome authority fields;
- new provider-mode adapters return proposal data rather than `GameEvent[]`;
- semantic authority violations are refused, not repaired into valid mechanics.

### 13.3 Fiction firewall

A/RF/C packets must prove:

- AdventureAction -> Evidence direct conversion is impossible;
- CombatAction -> Evidence direct conversion is impossible;
- AdventureObservation alone has zero confirmed-evidence authority;
- rejected/uncertain Reflection cannot create confirmed evidence;
- PRIVATE Reflection/source material is excluded structurally.

### 13.4 Combat firewall

C12 must mutation-prove that forged provider:

- HP;
- damage;
- reward;
- outcome;
- objective;
- status

cannot change deterministic Combat state.

### 13.5 Snapshot firewall

S/P packets must prove forged model:

- eligibility;
- source IDs;
- private/retracted source inclusion;
- completion/finality

cannot alter Snapshot authority.

### 13.6 Mutation testing

At least the strongest authority tests must fail when the protection is deliberately removed.

Required mutation candidates:

- wire AdventureObservation directly to evidence;
- allow provider-authored Combat outcome;
- widen legacy provider event allowlist;
- bypass private/retraction selector for one derived context path.

A test that still passes after its firewall is removed is not evidence.

---

## 14. Domain-lane stop conditions

A lane stops and returns to integration ownership when it needs:

- a new shared `GameEvent`;
- mutation of another domain's durable state;
- a new progression/reward category;
- a privacy/provenance exception;
- a migration/schema version change not already frozen;
- provider output to decide deterministic truth;
- a direct route from fictional action to evidence;
- a raw proposal passed to a shared dispatcher.

Do not broaden authority to unblock a feature packet.

---

## 15. D06 freeze verdict

**CANDIDATE FREEZE.**

Once reviewed and merged:

- existing legacy provider authority remains exactly three compatibility events;
- all new v2 provider modes are proposal-only;
- feature lanes may own domain-local commands/reducers;
- integration alone owns cross-domain/shared mutation widening;
- fiction-to-evidence requires explicit Reflection authority;
- Combat/Adventure/Snapshot/privacy truth stays deterministic.

This is the authority contract M01/J/RF/A/C/P/S lanes must obey.
