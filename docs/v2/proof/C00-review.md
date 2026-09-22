# Independent review — C00 minimal deterministic combat contract

- **Base SHA:** `783da0ca1abbfe375f9382fb06489681a26ce352`
- **Implementation commits:** `1182142740b97f18c12697324619ac6879b3b828`, reviewer repair `d7faae9d9dd3ad31daf7f877fbf1ec96a6faaa15`
- **Branch:** `feat/v2-combat-contracts`
- **Worktree:** `/Users/andrew/AtlasOfOne-combat-contracts`
- **Implementation / independent review:** GPT-5.6 Sol
- **Verdict:** `MERGE_READY`, then fast-forwarded locally into `integration/atlas-v2-journal-adventure-combat`. No push, deployment, or `main` merge was authorized or performed.

## Scope

C00 freezes the combat-lane policy needed by C01-C10 without creating combat runtime behavior.

Exactly three feature files were added:

- `src/combat/rules.ts`
- `tests/combat/rules.test.ts`
- `docs/v2/COMBAT_CONTRACT_C00.md`

No shared `src/contracts/**`, persistence, game engine, App, Worker, provider schema, dependency, UI, asset or migration file changed.

## Why the Wave-1 shared contract did not need reopening

Wave 1 already froze the durable combat envelope: the five permanent commands, ten objective names, fifteen gimmick names, `CombatDefinition`, `CombatState`, outcomes, rewards and flee rule.

C00's missing responsibility was deterministic policy, not a new durable record shape. The lane-owned rule module therefore freezes:

- Appendix-I tuning constants;
- exact integer ATTACK/GUARD formulas;
- optional timing-grade contract (`base | timed`) independent of wall clock/animation;
- player-first initiative policy with telegraphed ambush exception reserved for later runtime work;
- six-status MVP vocabulary;
- seven enemy-intent categories;
- five initial objective implementations chosen to unlock C15/C16 (`defeat`, `survive-turns`, `protect-target`, `interrupt-charged-action`, `pacify`);
- objective prerequisites;
- read-only fail-closed definition validation.

This keeps C00 inside `src/combat/**` and avoids premature persistence or integration-owner churn.

## Numeric contract

Source: `docs/MASTER_INTEGRATION_PLAN.md` Appendix I.

- encounter-local player HP: **100**;
- ATTACK: **18**, timed **24**;
- GUARD: **50%** reduction, timed/perfect **75%**;
- Technique charges at encounter start: **2**;
- status-duration target: **1-2 rounds**;
- enemy effective HP envelopes: ordinary **35-70**, elite **80-130**, boss phase **110-180**;
- ordinary enemy action damage: **10-22**;
- ordinary enemy count: **1-3**;
- turn targets: ordinary **2-5**, elite **4-7**, boss phase **5-9**, survival **3-5**;
- default ACT/pacify progress target: **3**.

C00 deliberately does **not** invent per-Technique costs. A pre-commit semantic review removed an initial 1-2 cost assumption because C04 owns Technique registry/cost/cooldown semantics and the master plan fixes only starting charges.

## Formula policy

- `resolveAttackDamage('base') = 18`
- `resolveAttackDamage('timed') = 24`
- `resolveGuardedDamage(incoming, 'base') = ceil(incoming * 0.50)`
- `resolveGuardedDamage(incoming, 'timed') = ceil(incoming * 0.25)`
- invalid negative/fractional/non-finite incoming values fail by `RangeError` rather than silent repair.

The upward residual-damage rounding is an explicit C00 implementation-policy choice so fractional damage cannot disappear through implicit integer conversion. Retuning belongs to C17.

## Static definition gate

`validateCombatDefinitionContract` is pure/read-only. It rejects:

- blank definition/encounter/combatant/template/reward IDs;
- zero or multiple player combatants;
- no enemy combatant;
- non-positive/non-integer max HP;
- duplicate combatant IDs;
- duplicate gimmicks;
- invalid turn limits;
- missing objective prerequisites;
- invalid reward amounts;
- duplicate reward IDs.

Objective prerequisites currently include:

- `survive-turns` requires explicit turn limit;
- `protect-target` requires an ally;
- `interrupt-charged-action` requires `charging` gimmick;
- `pacify` carries deterministic progress target 3.

## Independent-review repairs

The first committed candidate published Appendix-I constants but still allowed authored definitions to contradict two of them.

1. **Player HP drift:** a content definition could set the sole player max HP to any positive integer. Reviewer repair adds `player-max-hp-mismatch` and requires the encounter-local **100 HP** baseline.
2. **Survival-duration drift:** `survive-turns` required a positive turn limit but did not constrain it to the source-backed **3-5** round MVP range. Reviewer repair adds `survival-turn-limit-out-of-range`.

The repair is commit `d7faae9` and has dedicated fixtures.

## Authority / privacy checks

- Permanent command wall remains exactly `ATTACK / TECHNIQUE / GUARD / ACT / LEAVE`.
- No RNG (`Math.random`) or wall-clock (`Date.now`) exists in the combat contract.
- No network/provider call exists.
- Existing provider forbidden-authority fields still include `combatState`, `hp`, `reward`, `outcome`.
- No XP, progression, evidence, Reflection, world, Journal or Adventure mutation is implemented.
- Combat behavior remains fictional observation territory; nothing here can become evidence about the player.
- No TTS path or dependency was introduced.
- Synthetic tests contain no real-user identity or private material.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Exact five universal commands | C00 fixture + Wave-1 contract | PASS |
| Appendix-I numeric baseline frozen | exact object fixture | PASS |
| Base action works without timed input | ATTACK/GUARD base formula fixtures | PASS |
| Timed input deterministic and optional | normalized `base/timed` formula fixtures | PASS |
| Player HP encounter-local baseline 100 | validator repair fixture | PASS |
| Survival MVP limit 3-5 | validator repair boundary fixtures | PASS |
| Small status vocabulary | exact six-status fixture | PASS |
| Enemy intent categories fixed | exact seven-intent fixture | PASS |
| Five MVP objectives support C15/C16 path | exact objective fixture | PASS |
| Missing objective data fails closed | survive/protect/interrupt negative fixtures | PASS |
| Validator is read-only | structural clone fixture | PASS |
| Provider cannot own HP/reward/outcome/state | existing forbidden-field contract + focused fixture | PASS |
| No persistent attrition/RNG/grind system added | source/diff scan; no runtime/persistence change | PASS |
| No shared/hot-zone interface drift | exact diff scope | PASS |

## Validation

- `npx tsc --noEmit` — **PASS**.
- Focused C00 + Wave-1 domain contracts after review repair — **16/16 PASS across 2 files**.
- Full unit suite after review repair with bounded workers — **467/467 PASS across 55 files**.
- Production build — **PASS**. Existing non-fatal >500 kB client chunk warning remains.
- `git diff --check` / staged diff checks — **PASS**.
- Scope/RNG/network/provider/progression/TTS/real-data scans — **PASS**.
- Post-fast-forward integration focused gate — **16/16 PASS + typecheck**.

No browser test was required or run for C00 because the packet intentionally creates no runtime or player-visible path. Browser proof becomes meaningful at C13/I02.

## Next dependency state

C00 is complete and locally integrated. C01 is now READY: implement the deterministic `CombatDefinition`/`CombatState` reducer foundation behind this contract, without App/provider/world integration. C02-C10 then fan out from C01 toward C13 and I02.
