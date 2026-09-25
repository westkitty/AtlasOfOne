import type { AdventureSeed } from '../schema';
import type { AdventureTemplate } from './templateSchema';

/**
 * CT05 pure-fun quota (section 19.3): at least 20% of available ordinary
 * adventure content has learningTarget 'none'.
 */
export const PURE_FUN_MIN_SHARE = 0.2;

export interface PureFunShare {
  pureFun: number;
  total: number;
  share: number;
  meetsQuota: boolean;
}

function share(pureFun: number, total: number): PureFunShare {
  const ratio = total === 0 ? 0 : pureFun / total;
  // Integer comparison avoids floating-point edge cases at exactly 20%.
  return { pureFun, total, share: ratio, meetsQuota: total > 0 && pureFun * 5 >= total };
}

/** Only `available` seeds count; started/retired seeds are history, not the bank. */
export function pureFunSeedShare(seeds: readonly AdventureSeed[]): PureFunShare {
  const available = seeds.filter((seed) => seed.status === 'available');
  return share(available.filter((seed) => seed.learningTarget === 'none').length, available.length);
}

export function pureFunTemplateShare(templates: readonly AdventureTemplate[]): PureFunShare {
  return share(templates.filter((entry) => entry.learningTarget === 'none').length, templates.length);
}

export function assertPureFunQuota(result: PureFunShare, label: string): void {
  if (!result.meetsQuota) {
    throw new Error(`${label} pure-fun share ${result.pureFun}/${result.total} is below ${PURE_FUN_MIN_SHARE * 100}%.`);
  }
}
