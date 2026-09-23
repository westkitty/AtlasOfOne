# Atlas v2 Ownership Matrix

This matrix operationalizes the shared-file hot-zone and lane ownership rules in `docs/MASTER_INTEGRATION_PLAN.md`.

It does not create new product authority.

## Integration-owner hot zone

These files/surfaces require explicit integration-owner mutation rights:

| Surface | Why hot | Default lane rights |
|---|---|---|
| `src/App.tsx` | cross-domain orchestration and global user paths | integration owner only after D01-D04 |
| `src/game/types.ts` | shared durable/game contracts | D05/M01 integration owner |
| `src/game/engine.ts` | deterministic progression/game authority | integration owner; domain lanes through frozen interfaces |
| `src/persistence/migrations.ts` | destructive compatibility boundary | migration lane + independent review |
| `src/persistence/schema.ts` | durable validation boundary | migration lane + integration owner |
| `src/cartographer/schema.ts` | shared model proposal boundary | provider lane after D05/D06 |
| `worker/index.ts` | provider/security/cost/runtime boundary | provider/integration owner |
| `package.json` | dependency/runtime surface | integration owner; new dependencies require explicit justification |
| `AGENTS.md` | repository execution authority | integration owner |
| `OPERATIONAL_STATE.md` | current verified/broken/release truth | integration owner |
| `docs/MASTER_INTEGRATION_PLAN.md` | controlling target architecture | explicit authority-change packet only |
| central generated asset manifests | runtime ID/provenance switchboard | asset integration owner |

Feature lanes must not use “while I am here” edits to these surfaces.

## Lane-owned paths after contract freeze

| Lane | Primary owned paths | May emit | Must not own |
|---|---|---|---|
| Journal | `src/journal/**`, focused Journal tests | journal intent/domain records | game progression, provider authority, migration |
| Reflection | `src/reflection/**`, focused Reflection tests | reflection decisions/proposals | fictional-action -> evidence shortcut |
| Knowledge | `src/knowledge/**` or accepted seed module | gaps/seed requests | model-selected priority, privacy eligibility |
| Adventure | `src/adventure/**` | run/actions/observations/consequences through frozen contracts | campaign rewards, confirmed self-evidence |
| Combat | `src/combat/**` | deterministic combat state/outcomes | model-owned HP/damage/reward |
| World/UI | `src/world/**`, dedicated World UI components | world interaction intents | progression/reward authority |
| Provider | `src/cartographer/modes/**`, context compilers | typed proposals only | deterministic mutations |
| Atlas/Snapshots | `src/atlas/**` | snapshot candidate/output | snapshot eligibility rules outside deterministic contract |
| Asset factory | `.art-src/**`, `tools/art/**`, `public/assets/atlas/v4/**` generated output | versioned assets/manifests | runtime rule changes |
| QA | `tests/**`, proof receipts | evidence/fixtures | product mutation except bounded returned repairs |

## Authority transfer rules

A domain lane may ask the integration owner for a shared-interface change, but may not silently make one.

Required handoff:

1. exact public type/event/interface needed;
2. reason existing frozen interface is insufficient;
3. affected domains;
4. privacy/progression/migration impact;
5. rollback consequence;
6. focused tests;
7. proof receipt.

The integration owner may accept, narrow, or reject the change.

## Concurrent edit rules

- One active owner per hot-zone file.
- Parallel lanes may read hot-zone files freely.
- Parallel lanes must work behind frozen public interfaces.
- If two packets need the same hot-zone mutation, integration owns the combined change.
- Do not resolve a conflict by choosing whichever branch completed first.
- Do not force-merge, overwrite, or recreate another lane’s edits.

## Schema/migration rights

Before M01:

- no feature lane adds durable v2 fields ad hoc;
- D05 owns semantic contract freeze.

After M01:

- lane types may specialize local in-memory structures;
- durable additions still require schema/migration coordination;
- v1 fixture preservation remains mandatory.

## Event authority rights

Until D06 freezes the shared event-dispatch rules:

- existing `GameEvent` authority remains unchanged;
- no new domain may invent a progression-bearing shared event;
- provider output cannot dispatch game/combat authority directly.

After D06, all domain lanes follow its explicit event/firewall contract.

## Stop conditions

Stop the packet and return to integration ownership if work requires:

- a new dependency/service;
- shared schema/event change not frozen by D05/D06;
- privacy/provenance behavior change outside the packet;
- migration changes from a non-migration lane;
- weakening a protected invariant;
- unexplained edits to another lane;
- direct mutation of `main`.

## F09 verdict

The hot-zone and lane boundaries are explicit enough for parallel v2 domain work after D05/D06 contract freeze.
