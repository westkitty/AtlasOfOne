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

## Shared-file hot zone

Integration-owner only unless a packet explicitly grants ownership:

- `src/App.tsx`
- `src/game/types.ts`
- `src/game/engine.ts`
- `src/persistence/migrations.ts`
- `src/cartographer/schema.ts`
- `worker/index.ts`
- `package.json`
- `AGENTS.md`
- `OPERATIONAL_STATE.md`
- `docs/MASTER_INTEGRATION_PLAN.md`
- central generated asset manifests

## Merge rule

No packet is merge-ready from executor claims alone. High-risk persistence, privacy, migration, provider-authority, combat-authority, import/export, deployment, security, and shared source-of-truth changes require independent proof.
