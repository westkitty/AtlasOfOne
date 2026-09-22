# Independent review — C02 deterministic ATTACK mechanics

- **Base SHA:** `7564eb7cee98af8283e32afac7d8df808bca2fd2`
- **Implementation commit:** `2f6d203ec079da09fab2dff96053afe7beb6bd0f`
- **Branch/worktree:** `feat/v2-combat-attack` / `/Users/andrew/AtlasOfOne-combat-attack`
- **Verdict:** `MERGE_READY`, then fast-forwarded locally into `integration/atlas-v2-journal-adventure-combat`. No push, deployment or `main` merge.

## Scope

C02 adds only:
- `src/combat/attack.ts`
- `tests/combat/attack.test.ts`
- `docs/v2/COMBAT_ATTACK_C02.md`

No shared contracts, persistence, CampaignState/game engine, App/Worldwalker, provider, Worker, UI, dependencies or operational state changed in the implementation packet.

## Mechanics

`resolveAttack` is a thin command adapter over C00 + C01:
- C00 definition validation;
- C01 state validation;
- player phase required;
- runtime timing grade must be exactly `base | timed`;
- target must exist, be an enemy, and be alive;
- damage is C00's fixed 18 base / 24 timed;
- HP mutation delegates to C01 `DAMAGE`.

C02 does **not** end the player phase, select an enemy action, resolve victory, change objective progress, apply status, grant rewards/progression, persist state or narrate.

A lethal ATTACK clamps HP to zero through C01 and still leaves phase/outcome/objective unchanged for C07/turn orchestration to justify later.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Base ATTACK always works in valid player phase | base fixture | PASS |
| Timed grade is fixed optional +6 only | timed fixture | PASS |
| Malformed runtime grade fails closed | cast-garbage fixture | PASS |
| Only living enemies are legal targets | player/ally/missing/dead fixtures | PASS |
| ATTACK only in player phase | enemy-phase fixture | PASS |
| HP mutation uses C01 | source review + clamp fixture | PASS |
| Lethal attack does not auto-resolve | lethal fixture | PASS |
| No implicit phase handoff | base/timed fixtures | PASS |
| Definition/state invalidity fails before damage | negative fixtures | PASS |
| Pure/deterministic inputs | repeat + structured-clone fixture | PASS |
| No provider/RNG/network/persistence/progression/evidence/TTS/private data | static scans | PASS |
| No shared/hot-zone drift | exact three-file diff | PASS |

## Validation

- Typecheck — **PASS**.
- Focused C00/C01/C02/Wave-1 stack — **34/34 PASS across 4 files**.
- Full unit suite — **485/485 PASS across 57 files**.
- Production build — **PASS**; existing non-fatal >500 kB client chunk warning remains.
- Post-fast-forward focused gate — **34/34 PASS + typecheck**.
- Post-fast-forward production build — **PASS**.
- Scope/authority/privacy/RNG/network/persistence/TTS scans — **PASS**.

No browser proof is required before C13/C14 because C02 has no player-visible path.

## Next dependency state

C02 is complete and locally integrated. C03, C04, C05, C06, C07, C08 and C10 remain independently READY. C09 remains blocked on C08. C13 still waits on C03-C10 (C02 is now satisfied).
