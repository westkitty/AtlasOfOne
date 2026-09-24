# Atlas v2 Autonomy Ledger

This ledger is derived execution state for the Atlas v2 integration cycle. It does not override `OPERATIONAL_STATE.md` or `docs/MASTER_INTEGRATION_PLAN.md`.

## Execution surface

- repository: `westkitty/AtlasOfOne`
- integration branch: `integration/atlas-v2-journal-adventure-combat`
- integration base: `1b5103333f09884bf87286787e29885fd53d447c`
- execution environment: GitHub remote branch only
- local MacBook worktree: not touched; remote bridge unavailable at branch creation
- main: release/deployment surface; no routine v2 feature work goes directly to main

## Packet ledger

| packet_id | status | lane | base_sha | branch | executor | reviewer | astra_eligible | required_checks | proof_receipt | blocker | next_packets |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F00 | MERGED | foundation | 87d57f3 | docs/atlas-v2-authority-adoption | GPT-5.6 Sol | GitHub evidence | NO | remote baseline/scope proof | docs/v2/proof/F00.md | none on remote execution path | F01 |
| F01 | MERGED | foundation | 87d57f3 | docs/atlas-v2-authority-adoption | GPT-5.6 Sol | independent scope review | NO | master plan present; no runtime diff | PR #11 | none | F02 |
| F02 | MERGED | foundation | 87d57f3 | docs/atlas-v2-authority-adoption | GPT-5.6 Sol | independent scope review | NO | authority read order reconciled | PR #11 | none | F03,F04 |
| F03 | MERGED | foundation | 87d57f3 | docs/atlas-v2-authority-adoption | GPT-5.6 Sol | independent scope review | YES only on unresolved conflict | canonical docs reconciled | PR #11 | none | F04 |
| F04 | MERGED | foundation | 1b51033 | integration/atlas-v2-journal-adventure-combat | GPT-5.6 Sol | CI/scope evidence | NO | branch identity + ledger | docs/v2/proof/F04.md | none | F05,F06,F08,F09 |
| F05 | MERGED | foundation | 1b51033 | integration/atlas-v2-journal-adventure-combat | GitHub Actions | GPT-5.6 Sol review | NO | 304 unit; build; 143 browser | docs/v2/proof/F05.md | none | V00,D00,M00 |
| V00 | MERGED | voice | 24631bf | integration/atlas-v2-journal-adventure-combat | GPT-5.6 Sol | source inventory review | NO | exact TTS reference inventory | docs/v2/proof/V00.md | none | V01 |
| V01 | MERGED | voice | 24631bf | feat/v2-stt-only-voice | implementation lane | GPT-5.6 Sol | NO | no-TTS source/bundle; STT; typing; no auto-reopen; background cancel; merged integration CI | docs/v2/proof/V01.md | none | V02-V08 |
| D00 | MERGED | decomposition | 8d7c222 | refactor/v2-domain-boundaries | GPT-5.6 Sol | GitHub Actions + GPT-5.6 Sol review | NO | App responsibility/seam map; 284 unit; build; 130 browser | docs/v2/proof/D00.md | none | D01 |
| M00 | MERGED | migration | acc8246 | test/v2-v1-canonical-fixtures | GPT-5.6 Sol | GitHub Actions + GPT-5.6 Sol review | NO | 2 canonical fixtures; 306 unit; build; 143 browser | docs/v2/proof/M00.md | none | M01 |
| F07 | MERGED | foundation | 909eba4 | docs/v2-capability-invariants | GPT-5.6 Sol | GitHub Actions + GPT-5.6 Sol review | NO | verified/requested invariant manifest + impact-radius gates | docs/v2/proof/F07.md | none | D06 |
| D01 | MERGED | decomposition | b8048b9 | refactor/v2-presentational-extraction | GPT-5.6 Sol | GitHub Actions + GPT-5.6 Sol review | NO | presentation-only diff; 284 unit; build; 130 browser; merged integration CI | docs/v2/proof/D01.md | none | D02,D03,D04 |
| D02 | MERGED | decomposition | 0f45266 | refactor/v2-journal-shell | GPT-5.6 Sol | GitHub Actions + GPT-5.6 Sol review | NO | Journal shell; 286 unit; build; 130 browser; combined integration #82 | docs/v2/proof/D02.md | none | D05 |
| D03 | MERGED | decomposition | 0f45266 | refactor/v2-encounter-shell | GPT-5.6 Sol | GitHub Actions + GPT-5.6 Sol review | NO | encounter shell; encounters 13; concurrency 5; combined integration #82 | docs/v2/proof/D03.md | none | D05 |
| D04 | MERGED | decomposition | 0f45266 | refactor/v2-world-interaction-hook | GPT-5.6 Sol | GitHub Actions + GPT-5.6 Sol review | NO | Worldwalker hook; overworld verbs 10; combined integration #82 | docs/v2/proof/D04.md | none | D05 |
| F08 | MERGED | foundation | 1c0b749 | docs/v2-execution-contracts | GPT-5.6 Sol | GitHub Actions + GPT-5.6 Sol review | NO | proof-receipt + merge-queue contract; CI #90 | docs/v2/proof/F08.md | none | F09,all later packets |
| F09 | MERGED | foundation | 1c0b749 | docs/v2-execution-contracts | GPT-5.6 Sol | GitHub Actions + GPT-5.6 Sol review | NO | ownership matrix + lane stop rules; CI #90 | docs/v2/proof/F09.md | none | D05,D06,D07 |
| D05 | MERGED | decomposition | d21c234 | docs/v2-domain-interface-freeze | GPT-5.6 Sol | adversarial semantic review + GitHub Actions | YES only on unresolved contract conflict | reviewed domain interfaces; CI #91; upstream integration #82 | docs/v2/proof/D05.md | none | D06,D07,M01,P00,AS00 |
| D06 | MERGED | decomposition | 798e3b1 | docs/v2-event-authority-contract | GPT-5.6 Sol | adversarial contract review + GitHub Actions | YES only on unresolved authority conflict | event/mutation authority contract; final CI #97; prior firewall 7/7 | docs/v2/proof/D06.md | none | D07,authority-sensitive lanes |
| D07 | MERGED | decomposition | 798e3b1 | docs/v2-ledger-enforcement | GPT-5.6 Sol | GitHub Actions + scope review | NO | ledger/hot-zone enforcement | docs/v2/proof/D07.md | none | parallel lane enforcement |
| M01 | MERGED | migration | 798e3b1 | feat/v2-schema-surface | GPT-5.6 Sol | diff-scope review + GitHub Actions | YES only on unresolved schema conflict | schema-v2 6/6; 292 unit; build; 130 browser; final CI #98 | docs/v2/proof/M01.md | none | M02,M06,J00,RF00,K00,N00,S00 |
| M02 | MERGED | migration | ca794c0 | feat/v2-migration | GPT-5.6 Sol | diff-scope review + GitHub Actions | YES only on unresolved migration conflict | v1->v2 activation; final CI #121 | docs/v2/proof/M02.md | none | M03,M04,M05,M07,J01 |
| M03 | MERGED | migration | 58cd4a9 | feat/v2-final-assessment-snapshot-migration | GPT-5.6 Sol | provenance review + GitHub Actions | YES only on provenance ambiguity | legacy FinalAssessment->historical Snapshot; CI #119 | docs/v2/proof/M03.md | none | M07,S-lane |
| M04 | MERGED | migration | 58cd4a9 | test/v2-migration-compatibility | GPT-5.6 Sol | migration parity review + GitHub Actions | NO | legacy turns/encounters/worldJourney/settings preservation | docs/v2/proof/M04.md | none | M07 |
| M05 | MERGED | migration | 58cd4a9 | test/v2-migration-compatibility | GPT-5.6 Sol | transfer-boundary review + GitHub Actions | NO | schema-v2 export/import validation | docs/v2/proof/M05.md | none | J01,M07 |
| M06 | MERGED | migration | 6802a34 | feat/v2-wave2-foundations-core | GPT-5.6 Sol | privacy/provenance review + GitHub Actions | YES on unresolved privacy ambiguity | structural v2 retirement/visibility hooks | docs/v2/proof/M06.md | none | K05,J05,RF09,M07 |
| M07 | MERGED | migration | 47060a0 | test/v2-persistence-torture | GPT-5.6 Sol | persistence-scope review + GitHub Actions | NO | v1/v2 persistence torture; CI #142 integrated | docs/v2/proof/M07.md | none | migration lane closed |
| J00 | MERGED | journal | ca794c0 | feat/v2-journal-domain | GPT-5.6 Sol | scope review + GitHub Actions | NO | Journal domain selectors/helpers | docs/v2/proof/J00.md | none | J01,J02,J07 |
| J01 | MERGED | journal | b5a6e4b | feat/v2-journal-save-path-integrated | GPT-5.6 Sol | persistence review + GitHub Actions | NO | Journal persists in whole CampaignState | docs/v2/proof/J01.md | none | J03,J06 |
| J02 | MERGED | journal | b5a6e4b | feat/v2-journal-save-path-integrated | GPT-5.6 Sol | browser/mobile review + GitHub Actions | NO | one-action blank Journal composer | docs/v2/proof/J02.md | none | J03,J04 |
| J03 | MERGED | journal | b5a6e4b | feat/v2-journal-save-path-integrated | GPT-5.6 Sol | browser/concurrency review + GitHub Actions | NO | typed local save; no provider/progression | docs/v2/proof/J03.md | none | J04,J05,J06 |
| J04 | READY | journal | c14b4b7 | pending | unassigned | pending | NO | STT into same Journal composer | pending | V05 merged; implementation not yet present | J09 |
| J05 | MERGED | journal | f452a10 | feat/v2-journal-privacy-integrated | GPT-5.6 Sol | privacy/provenance review + GitHub Actions | YES only on privacy ambiguity | latest-entry PRIVATE/retract + M06 retirement; CI #144 integrated | docs/v2/proof/J05.md | none | J06,J07 |
| J06 | READY | journal | c14b4b7 | pending | unassigned | pending | NO | date/history navigation | pending | J01/J05 merged | J07 |
| J07 | READY | journal | c14b4b7 | pending | unassigned | pending | NO | link Journal to Reflection/Adventure | pending | J00/J05/D06 merged | RF/Adventure lanes |
| J08 | READY | journal | c14b4b7 | pending | unassigned | pending | NO | optional Atlas prompt affordance | pending | J02 merged | J09 |
| J09 | BLOCKED | journal | c14b4b7 | pending | unassigned | pending | NO | provider acknowledgement/prompt behavior | pending | depends J04/J07/J08/P-lane | vertical slice |
| RF00 | MERGED | reflection | ca794c0 | feat/v2-reflection-state-machine | GPT-5.6 Sol | semantic review + GitHub Actions | YES only on authority ambiguity | Reflection state machine | docs/v2/proof/RF00.md | none | RF01,RF02,RF03 |
| C00 | MERGED | combat | ca794c0 | docs/v2-combat-contract | GPT-5.6 Sol | adversarial contract review + GitHub Actions | YES only on combat-contract ambiguity | deterministic combat contract | docs/v2/proof/C00.md | none | C01 |
| C01 | MERGED | combat | 6802a34 | feat/v2-wave2-foundations-core | GPT-5.6 Sol | game-authority review + GitHub Actions | YES only on mechanics ambiguity | CombatDefinition/State/lifecycle | docs/v2/proof/C01.md | none | C02-C10 |
| C02 | MERGED | combat | 47060a0 | feat/v2-combat-attack | GPT-5.6 Sol | C00/D06 review + GitHub Actions | NO | deterministic ATTACK 18/+6 optional timing; CI #143/#144 | docs/v2/proof/C02.md | none | C03,C04,C07 |
| K00 | MERGED | knowledge | 6802a34 | feat/v2-wave2-foundations-core | GPT-5.6 Sol | selector review + GitHub Actions | NO | deterministic Knowledge selectors | docs/v2/proof/K00.md | none | K01-K07 |
| K01 | IN_REVIEW | knowledge | c14b4b7 | feat/v2-knowledge-scoring-privacy | GPT-5.6 Sol | static review + GitHub Actions pending | NO | undercoverage+age score | docs/v2/proof/K01.md | PR #38 CI #145 in progress | K02,K04 |
| K05 | IN_REVIEW | knowledge | c14b4b7 | feat/v2-knowledge-scoring-privacy | GPT-5.6 Sol | M06 privacy review + GitHub Actions pending | YES only on privacy conflict | structural privacy/retraction eligibility | docs/v2/proof/K05.md | PR #38 CI #145 in progress | K06,K07 |
| V02 | MERGED | voice | b5a6e4b | integration | GPT-5.6 Sol | current integration proof | NO | browser speech synthesis removed | docs/v2/proof/V02.md | none | voice closeout |
| V03 | MERGED | voice | b5a6e4b | integration | GPT-5.6 Sol | current integration proof | NO | retired voice-output UI/state cleanup | docs/v2/proof/V03.md | none | voice closeout |
| V04 | MERGED | voice | b5a6e4b | integration | GPT-5.6 Sol | current integration proof | NO | no spoken Cartographer output | docs/v2/proof/V04.md | none | voice closeout |
| V05 | MERGED | voice | b5a6e4b | integration | GPT-5.6 Sol | current integration proof | NO | bounded STT input path preserved | docs/v2/proof/V05.md | none | J04 |
| V06 | MERGED | voice | b5a6e4b | integration | GPT-5.6 Sol | current integration proof | NO | typing fallback complete | docs/v2/proof/V06.md | none | J04 |
| V07 | MERGED | voice | f452a10 | integration | GPT-5.6 Sol | copy/source review + GitHub Actions | NO | stale onboarding TTS promise removed | docs/v2/proof/V07.md | none | voice closed |
| V08 | MERGED | voice | b5a6e4b | integration | GPT-5.6 Sol | source/bundle negative proof | NO | no-TTS production bundle/source proof | docs/v2/proof/V08.md | none | voice closed |

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
