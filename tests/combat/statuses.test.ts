import { describe, expect, it } from 'vitest';
import { createCombatState, reduceCombatLifecycle } from '../../src/combat/engine';
import {
  applyStatus,
  declareGuard,
  DEFAULT_STATUS_DURATION,
  hasStatus,
  removeStatus,
  STATUS_RESOLUTION_ORDER,
  tickStatuses
} from '../../src/combat/statuses';
import { COMBAT_STATUS_IDS } from '../../src/combat/types';
import type { CombatStatusId } from '../../src/combat/types';
import { objectiveFixture } from './fixtures';

const start = () => createCombatState(objectiveFixture('protect'));

describe('C10 status resolution order', () => {
  it('orders exactly the six MVP statuses', () => {
    expect([...STATUS_RESOLUTION_ORDER].sort()).toEqual([...COMBAT_STATUS_IDS].sort());
    expect(STATUS_RESOLUTION_ORDER).toHaveLength(6);
  });

  it('keeps every default duration inside the 1-2 round target', () => {
    for (const id of COMBAT_STATUS_IDS) {
      expect([1, 2]).toContain(DEFAULT_STATUS_DURATION[id]);
    }
  });

  it('stores statuses in frozen order regardless of application order', () => {
    const forward = STATUS_RESOLUTION_ORDER.reduce(
      (state, status) => applyStatus(state, status, 'enemy_1'),
      start()
    );
    const reversed = [...STATUS_RESOLUTION_ORDER].reverse().reduce(
      (state, status) => applyStatus(state, status, 'enemy_1'),
      start()
    );
    expect(forward.statuses).toEqual(reversed.statuses);
    expect(forward.statuses.map((s) => s.status)).toEqual([...STATUS_RESOLUTION_ORDER]);
  });

  it('orders same-status entries by target id', () => {
    const state = applyStatus(applyStatus(start(), 'exposed', 'greyson'), 'exposed', 'enemy_1');
    expect(state.statuses.map((s) => s.targetId)).toEqual(['enemy_1', 'greyson']);
  });
});

describe('C10 status idempotency', () => {
  it('re-applying a status never stacks and refreshes to the longer duration', () => {
    const once = applyStatus(start(), 'exposed', 'enemy_1', 1);
    const twice = applyStatus(once, 'exposed', 'enemy_1', 1);
    expect(twice).toBe(once);
    const refreshed = applyStatus(twice, 'exposed', 'enemy_1', 2);
    expect(refreshed.statuses).toEqual([
      { id: 'exposed:enemy_1', status: 'exposed', targetId: 'enemy_1', remainingRounds: 2 }
    ]);
    expect(applyStatus(refreshed, 'exposed', 'enemy_1', 1)).toBe(refreshed);
  });

  it('removal of an absent status is a no-op', () => {
    const state = start();
    expect(removeStatus(state, 'charging', 'enemy_1')).toBe(state);
  });

  it('ticks down and expires deterministically', () => {
    let state = applyStatus(applyStatus(start(), 'guarded', 'greyson'), 'charging', 'enemy_1');
    state = tickStatuses(state);
    expect(hasStatus(state, 'guarded', 'greyson')).toBe(false);
    expect(hasStatus(state, 'charging', 'enemy_1')).toBe(true);
    state = tickStatuses(state);
    expect(state.statuses).toEqual([]);
    expect(tickStatuses(state).statuses).toEqual([]);
  });

  it('does not mutate the input state', () => {
    const state = Object.freeze(start());
    const next = applyStatus(state, 'staggered', 'enemy_1');
    expect(state.statuses).toEqual([]);
    expect(next).not.toBe(state);
  });
});

describe('C10 status validation', () => {
  it('rejects unknown ids, out-of-range durations, unknown targets and resolved state', () => {
    expect(() => applyStatus(start(), 'poison' as CombatStatusId, 'enemy_1')).toThrow(/Unknown combat status/);
    expect(() => applyStatus(start(), 'exposed', 'enemy_1', 3)).toThrow(/duration/);
    expect(() => applyStatus(start(), 'exposed', 'enemy_1', 0)).toThrow(/duration/);
    expect(() => applyStatus(start(), 'exposed', 'enemy_1', 1.5)).toThrow(/duration/);
    expect(() => applyStatus(start(), 'exposed', 'ghost')).toThrow(/Unknown status target/);
    const resolved = reduceCombatLifecycle(start(), { type: 'RESOLVE', outcome: 'escaped' });
    expect(() => applyStatus(resolved, 'exposed', 'enemy_1')).toThrow(/resolved/);
  });

  it('declareGuard marks only the living player during the player phase', () => {
    const guarded = declareGuard(start(), 'greyson');
    expect(hasStatus(guarded, 'guarded', 'greyson')).toBe(true);
    expect(declareGuard(guarded, 'greyson')).toBe(guarded);
    expect(() => declareGuard(start(), 'enemy_1')).toThrow(/not the player/);
    const enemyPhase = reduceCombatLifecycle(start(), { type: 'END_PLAYER_PHASE' });
    expect(() => declareGuard(enemyPhase, 'greyson')).toThrow(/player phase/);
  });
});
