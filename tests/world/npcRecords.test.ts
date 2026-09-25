import { describe, expect, it } from 'vitest';
import {
  createNpcRegistry,
  initialNpcState,
  npcIdentitySchema,
  recordNpcAppearance,
  withNpcArt,
  type NpcIdentity
} from '../../src/world/npcRecords';

// Synthetic fixture only.
const keeper: NpcIdentity = {
  id: 'npc_lantern_keeper', name: 'Tamsin the Lantern Keeper', territoryId: 'future',
  role: 'keeps the spire lamps', artAssetId: 'npc-lantern-keeper-v1'
};

describe('W04 NPC identity/state separated from art', () => {
  it('recurrence fixture: same identity across runs, appearances recorded idempotently', () => {
    const registry = createNpcRegistry([keeper]);
    let state = initialNpcState(keeper.id);
    state = recordNpcAppearance(registry, state, 'run_2');
    state = recordNpcAppearance(registry, state, 'run_1');
    state = recordNpcAppearance(registry, state, 'run_2');
    expect(state.appearedInRunIds).toEqual(['run_1', 'run_2']);
    expect(registry.get(keeper.id)).toEqual(keeper);
  });

  it('art swap keeps identity fields intact', () => {
    const swapped = withNpcArt(keeper, 'npc-lantern-keeper-v2');
    expect({ ...swapped, artAssetId: keeper.artAssetId }).toEqual(keeper);
  });

  it('art is an opaque asset id only: paths/URLs/filenames rejected', () => {
    for (const bad of ['art/npc.png', 'https://x/y', 'npc.png', '../npc', 'C:npc', '']) {
      expect(() => withNpcArt(keeper, bad)).toThrow();
    }
  });

  it('identity schema is strict (no smuggled art or state fields)', () => {
    expect(() => npcIdentitySchema.parse({ ...keeper, spriteUrl: 'x' })).toThrow();
    expect(() => npcIdentitySchema.parse({ ...keeper, availability: 'present' })).toThrow();
  });

  it('registry rejects duplicates and frozen records cannot be mutated', () => {
    expect(() => createNpcRegistry([keeper, keeper])).toThrow();
    const record = createNpcRegistry([keeper]).get(keeper.id)!;
    expect(Object.isFrozen(record)).toBe(true);
  });

  it('unknown or departed NPCs fail closed', () => {
    const registry = createNpcRegistry([keeper]);
    expect(() => recordNpcAppearance(registry, initialNpcState('npc_stranger'), 'run_1')).toThrow();
    expect(() => recordNpcAppearance(registry, { ...initialNpcState(keeper.id), availability: 'departed' }, 'run_1')).toThrow();
    expect(() => recordNpcAppearance(registry, initialNpcState(keeper.id), ' ')).toThrow();
  });
});
