# C02 amendment — defeated player could still ATTACK

- **Detected during:** independent reconstruction/review after C01-C03 had already been integrated by another local actor
- **Affected verified state:** C02 ATTACK mechanics at integration revision 52
- **Failing baseline:** `d639e3c635de74ef25caa6e765eae087deb61e37`
- **Repair commit:** `7cb337f13f3ead3901b8dfed5c466d804e086218`
- **Repair branch/worktree:** `fix/v2-combat-attack-defeated-player` / `/Users/andrew/AtlasOfOne-combat-attack-defeated-player`
- **Verdict:** confirmed C02 defect, repaired and fast-forwarded locally. No push, `main` merge, deployment or live inference.

## What was wrong

The original C02 review proved that ATTACK required player phase and a living enemy target, but it did **not** prove that the acting player was alive.

C01 intentionally permits `currentHp = 0` as a valid in-memory combat state because defeat/outcome resolution belongs to later mechanics. `resolveAttack` therefore accepted this valid state:

- player HP = 0;
- phase = `player`;
- enemy HP > 0.

It then applied normal ATTACK damage to the enemy. C03 already rejected GUARD for a defeated player, so the command set was internally inconsistent.

## Proof before repair

A new regression fixture reduced the player to 0 HP with the C01 `DAMAGE` primitive, then called:

`resolveAttack(definition, defeatedPlayerState, 'enemy', 'base')`

Against unchanged C02, the fixture failed exactly as expected: ATTACK was accepted and the enemy fell from 54 HP to 36 HP.

## Repair

`resolveAttack` now resolves the sole C00-valid player combatant after definition/state/phase/timing validation and rejects when the player is missing or has `currentHp <= 0` with:

`issue: 'player-defeated'`

No other ATTACK semantics changed.

## Validation

- Regression before repair — **FAIL as expected**: 1 failed / 8 passed in `tests/combat/attack.test.ts`; received accepted 18-damage ATTACK from a 0-HP player.
- C00-C03 + Wave-1 focused stack after repair — **43/43 PASS across 5 files** + typecheck.
- Full unit suite after repair — **494/494 PASS across 58 files**.
- Production build — **PASS**; existing non-fatal >500 kB client chunk warning remains.
- Post-fast-forward merged-tree focused gate — **43/43 PASS** + typecheck.
- Scope/static scan — exactly `src/combat/attack.ts` and `tests/combat/attack.test.ts`; no provider/network/persistence/progression/evidence/TTS/private-user content.

## Amendment to the original C02 verdict

The original C02 review was incomplete on actor eligibility. Its other findings remain supported. The corrected C02 invariant is now:

> ATTACK requires a C00-valid definition, C01-valid state, player phase, valid timing grade, **living player actor**, and existing living enemy target.

C02 remains `MERGED` after repair; C03 is unaffected. C04 remains the next combat packet.
