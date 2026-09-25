import { describe, expect, it } from 'vitest';
import {
  assertPureFunQuota,
  PURE_FUN_MIN_SHARE,
  pureFunSeedShare,
  pureFunTemplateShare
} from '../../../src/adventure/content/quota';
import { CORE_ADVENTURE_TEMPLATES } from '../../../src/adventure/content/templates';
import type { AdventureSeed } from '../../../src/adventure/schema';

const seed = (id: string, learningTarget: AdventureSeed['learningTarget'], status: AdventureSeed['status'] = 'available'): AdventureSeed => ({
  id, sourceGapIds: learningTarget === 'none' ? [] : ['gap_a'], kind: learningTarget === 'none' ? 'pure-fun' : 'investigation',
  territoryId: 'identity', premise: 'Synthetic.', learningTarget, status
});

describe('CT05 >=20% pure-fun ordinary content', () => {
  it('the core template bank meets the quota (count test)', () => {
    const result = pureFunTemplateShare(CORE_ADVENTURE_TEMPLATES);
    expect(PURE_FUN_MIN_SHARE).toBe(0.2);
    expect(result).toMatchObject({ pureFun: 5, total: 12, meetsQuota: true });
    expect(() => assertPureFunQuota(result, 'core templates')).not.toThrow();
  });

  it('exactly 20% passes, just under fails', () => {
    const atQuota = [seed('a', 'none'), ...['b', 'c', 'd', 'e'].map((id) => seed(id, 'reflection-eligible'))];
    expect(pureFunSeedShare(atQuota)).toMatchObject({ pureFun: 1, total: 5, share: 0.2, meetsQuota: true });
    const under = [...atQuota, seed('f', 'reflection-eligible')];
    expect(pureFunSeedShare(under).meetsQuota).toBe(false);
    expect(() => assertPureFunQuota(pureFunSeedShare(under), 'seeds')).toThrow(/1\/6/);
  });

  it('counts only available seeds', () => {
    const seeds = [
      seed('fun_started', 'none', 'started'), seed('fun_retired', 'none', 'retired'),
      seed('r1', 'reflection-eligible'), seed('r2', 'reflection-eligible')
    ];
    expect(pureFunSeedShare(seeds)).toMatchObject({ pureFun: 0, total: 2, meetsQuota: false });
  });

  it('an empty bank never meets the quota', () => {
    expect(pureFunSeedShare([]).meetsQuota).toBe(false);
    expect(pureFunTemplateShare([]).meetsQuota).toBe(false);
  });
});
