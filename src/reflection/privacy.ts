import type { ReflectionRecord } from '../contracts/reflection';
import type { CampaignState } from '../game/types';

/**
 * Structural Reflection privacy boundary. PRIVATE records withhold source IDs;
 * raw history remains untouched so it can retain its local provenance.
 */
export interface ReflectionPrivacyMask {
  journalIds: Set<string>;
  adventureObservationIds: Set<string>;
  insightIds: Set<string>;
  contradictionIds: Set<string>;
  snapshotIds: Set<string>;
}

function sourceIdUnion(reflection: ReflectionRecord): string[] {
  return [...reflection.sourceIds, ...(reflection.privacyRetiredSourceIds ?? [])]
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Computes a fresh fail-closed ID mask from PRIVATE Reflection provenance only.
 * Mismatched imported source sets deliberately withhold their union.
 */
export function reflectionPrivacyMask(state: Pick<CampaignState, 'reflections'>): ReflectionPrivacyMask {
  const mask: ReflectionPrivacyMask = {
    journalIds: new Set(),
    adventureObservationIds: new Set(),
    insightIds: new Set(),
    contradictionIds: new Set(),
    snapshotIds: new Set()
  };

  for (const reflection of state.reflections) {
    if (reflection.outcome !== 'PRIVATE') continue;
    const ids = sourceIdUnion(reflection);
    switch (reflection.sourceKind) {
      case 'journal': ids.forEach((id) => mask.journalIds.add(id)); break;
      case 'adventure-observation': ids.forEach((id) => mask.adventureObservationIds.add(id)); break;
      case 'insight': ids.forEach((id) => mask.insightIds.add(id)); break;
      case 'contradiction': ids.forEach((id) => mask.contradictionIds.add(id)); break;
      case 'snapshot': ids.forEach((id) => mask.snapshotIds.add(id)); break;
    }
  }

  return mask;
}
