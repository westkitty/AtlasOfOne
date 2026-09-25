# Atlas v2 Autonomy Ledger

This ledger is derived execution state for the Atlas v2 integration cycle. It does not override `OPERATIONAL_STATE.md` or `docs/MASTER_INTEGRATION_PLAN.md`.

## Execution surface

- repository: `westkitty/AtlasOfOne`
- integration branch: `integration/atlas-v2-journal-adventure-combat`
- integration base: `1b5103333f09884bf87286787e29885fd53d447c`
- execution environment: GitHub remote branch only
- local MacBook worktree: used from revision 28 onward (separate worktrees; user checkout untouched)
- main: release/deployment surface; no routine v2 feature work goes directly to main

## Packet ledger

Regenerated at state revision 28 from receipts present on the integration branch. MERGED means: receipt on integration + integration gate passed; see each receipt for exact evidence and what was not executed.

| receipt | status |
|---|---|
| docs/v2/proof/A00.md | MERGED |
| docs/v2/proof/A01.md | MERGED |
| docs/v2/proof/A02.md | MERGED |
| docs/v2/proof/A03.md | MERGED |
| docs/v2/proof/A05.md | MERGED |
| docs/v2/proof/A06.md | MERGED |
| docs/v2/proof/A07.md | MERGED |
| docs/v2/proof/A08.md | MERGED |
| docs/v2/proof/A09.md | MERGED |
| docs/v2/proof/A09-slice.md | MERGED |
| docs/v2/proof/A10.md | MERGED |
| docs/v2/proof/C00.md | MERGED |
| docs/v2/proof/C01.md | MERGED |
| docs/v2/proof/C02.md | MERGED |
| docs/v2/proof/C03.md | MERGED |
| docs/v2/proof/C04.md | MERGED |
| docs/v2/proof/C05.md | MERGED |
| docs/v2/proof/C06.md | MERGED |
| docs/v2/proof/C07.md | MERGED |
| docs/v2/proof/C08.md | MERGED |
| docs/v2/proof/C09.md | MERGED |
| docs/v2/proof/C10.md | MERGED |
| docs/v2/proof/C11.md | MERGED |
| docs/v2/proof/C12.md | MERGED |
| docs/v2/proof/C13.md | MERGED |
| docs/v2/proof/C14.md | MERGED |
| docs/v2/proof/C15.md | MERGED |
| docs/v2/proof/C16.md | MERGED |
| docs/v2/proof/CT00.md | MERGED |
| docs/v2/proof/CT01.md | MERGED |
| docs/v2/proof/CT04.md | MERGED |
| docs/v2/proof/CT05.md | MERGED |
| docs/v2/proof/CT09.md | MERGED |
| docs/v2/proof/D00.md | MERGED |
| docs/v2/proof/D01.md | MERGED |
| docs/v2/proof/D02.md | MERGED |
| docs/v2/proof/D03.md | MERGED |
| docs/v2/proof/D04.md | MERGED |
| docs/v2/proof/D05.md | MERGED |
| docs/v2/proof/D06.md | MERGED |
| docs/v2/proof/D07.md | MERGED |
| docs/v2/proof/F00.md | MERGED |
| docs/v2/proof/F04.md | MERGED |
| docs/v2/proof/F05.md | MERGED |
| docs/v2/proof/F07.md | MERGED |
| docs/v2/proof/F08.md | MERGED |
| docs/v2/proof/F09.md | MERGED |
| docs/v2/proof/I00-I04.md | MERGED |
| docs/v2/proof/I06.md | MERGED |
| docs/v2/proof/J00.md | MERGED |
| docs/v2/proof/J01.md | MERGED |
| docs/v2/proof/J02.md | MERGED |
| docs/v2/proof/J03.md | MERGED |
| docs/v2/proof/J04.md | MERGED |
| docs/v2/proof/J05.md | MERGED |
| docs/v2/proof/J06.md | MERGED |
| docs/v2/proof/J07.md | MERGED |
| docs/v2/proof/J08.md | MERGED |
| docs/v2/proof/K00.md | MERGED |
| docs/v2/proof/K01.md | MERGED |
| docs/v2/proof/K02.md | MERGED |
| docs/v2/proof/K03.md | MERGED |
| docs/v2/proof/K04.md | MERGED |
| docs/v2/proof/K05.md | MERGED |
| docs/v2/proof/K06.md | MERGED |
| docs/v2/proof/K07.md | MERGED |
| docs/v2/proof/M00.md | MERGED |
| docs/v2/proof/M01.md | MERGED |
| docs/v2/proof/M02.md | MERGED |
| docs/v2/proof/M03.md | MERGED |
| docs/v2/proof/M04.md | MERGED |
| docs/v2/proof/M05.md | MERGED |
| docs/v2/proof/M06.md | MERGED |
| docs/v2/proof/M07.md | MERGED |
| docs/v2/proof/N00.md | MERGED |
| docs/v2/proof/N01.md | MERGED |
| docs/v2/proof/N02.md | MERGED |
| docs/v2/proof/N03.md | MERGED |
| docs/v2/proof/N04.md | MERGED |
| docs/v2/proof/N05.md | MERGED |
| docs/v2/proof/N06.md | MERGED |
| docs/v2/proof/P00.md | MERGED |
| docs/v2/proof/P01.md | MERGED |
| docs/v2/proof/P02.md | MERGED |
| docs/v2/proof/P03.md | MERGED |
| docs/v2/proof/P04.md | MERGED |
| docs/v2/proof/P05.md | MERGED |
| docs/v2/proof/P07.md | MERGED |
| docs/v2/proof/P08.md | MERGED |
| docs/v2/proof/P09.md | MERGED |
| docs/v2/proof/P10.md | MERGED |
| docs/v2/proof/P12.md | MERGED |
| docs/v2/proof/Q02.md | MERGED |
| docs/v2/proof/Q04.md | MERGED |
| docs/v2/proof/Q05.md | MERGED |
| docs/v2/proof/RF00.md | MERGED |
| docs/v2/proof/RF01.md | MERGED |
| docs/v2/proof/RF02-RF03.md | MERGED |
| docs/v2/proof/RF04.md | MERGED |
| docs/v2/proof/RF05.md | MERGED |
| docs/v2/proof/RF06.md | MERGED |
| docs/v2/proof/RF07.md | MERGED |
| docs/v2/proof/RF08.md | MERGED |
| docs/v2/proof/RF09.md | MERGED |
| docs/v2/proof/S00.md | MERGED |
| docs/v2/proof/S01.md | MERGED |
| docs/v2/proof/S02.md | MERGED |
| docs/v2/proof/S04-I07-I08.md | MERGED |
| docs/v2/proof/S05.md | MERGED |
| docs/v2/proof/V00.md | MERGED |
| docs/v2/proof/V01.md | MERGED |
| docs/v2/proof/V02.md | MERGED |
| docs/v2/proof/V03.md | MERGED |
| docs/v2/proof/V04.md | MERGED |
| docs/v2/proof/V05.md | MERGED |
| docs/v2/proof/V06.md | MERGED |
| docs/v2/proof/V07.md | MERGED |
| docs/v2/proof/V08.md | MERGED |
| docs/v2/proof/W01.md | MERGED |
| docs/v2/proof/W02.md | MERGED |
| docs/v2/proof/W03.md | MERGED |
| docs/v2/proof/W04.md | MERGED |
| docs/v2/proof/W09.md | MERGED |

### Not yet merged / open

| packet | status | note |
|---|---|---|
| J09 | READY | provider acknowledgement path; needs P06 + provider route |
| P06, S03, P11 (worker part), Q06 | READY | v2 provider modes -> route, remote Snapshot proposal, quota/offline degradation proof |
| W02/W03/W06/W07/W08/W10 UI | READY | world markers + contact encounters on the Worldwalker map |
| W05 | BLOCKED | needs `worldConsequences` persisted field (proposal in A07 receipt) |
| C17, CT10 | IN_PROGRESS | tuning + content lint lane |
| Q10, Q11 | IN_PROGRESS | mobile/a11y browser proof lane |
| AS03-AS18 | BLOCKED | visual generation tooling not available in this environment |
| Q12, Q13 | BLOCKED | physical iPhone/Android not reachable |
| Q14-Q19, I09 | READY | release-candidate review after the above |
| Q20 | HUMAN | merge to main requires explicit Andrew release authority |

## Shared-file hot zone

The controlling matrix is `docs/v2/OWNERSHIP_MATRIX.md`. The ledger mirrors its integration-owner surfaces so active packets cannot plead an outdated list.

Integration-owner only unless a packet row and proof receipt explicitly grant the mutation:

- `src/App.tsx`
- `src/game/types.ts`
- `src/game/engine.ts`
- `src/persistence/migrations.ts`
- `src/persistence/schema.ts`
- `src/cartographer/schema.ts`
- `worker/index.ts`
- `package.json`
- `AGENTS.md`
- `OPERATIONAL_STATE.md`
- `docs/MASTER_INTEGRATION_PLAN.md`
- central generated asset manifests

## Lane-drift enforcement

1. One active owner per hot-zone surface.
2. A lane may freely read hot-zone files but may mutate only its owned paths unless an explicit authority-transfer packet grants otherwise.
3. New durable v2 fields must follow D05 and the migration lane; feature lanes do not add them ad hoc.
4. Until D06 merges, no lane may add a shared progression-bearing `GameEvent`.
5. After D06, shared-event widening still requires the D06 authority-transfer contract; provider/model proposals never gain direct dispatch rights.
6. Unexplained edits from another lane are a STOP condition, not a merge conflict to bulldoze through.
7. A packet that needs another domain's internal reducer/controller must stop and request a public-interface change.
8. No ordinary packet targets `main`; `main` remains release/deployment authority only.
9. Packet status is evidence-based: executor claims do not advance `IN_REVIEW` to `MERGED`.
10. Proof receipts use `docs/v2/PROOF_RECEIPT_CONTRACT.md` and must name validation that was not executed.

## Merge rule

No packet is merge-ready from executor claims alone.

A packet enters integration only when the F08 merge-queue contract is satisfied: dependencies are present, changed-file envelope still matches, required proof passed, proof receipt exists, consequential work has independent review, shared-interface drift is reconciled, and merge order respects dependencies.

High-risk persistence, privacy, migration, provider-authority, combat-authority, import/export, deployment, security, and shared source-of-truth changes require independent proof.

Integration merge is not release authority. Only the final release workflow may propose a merge to `main`.
