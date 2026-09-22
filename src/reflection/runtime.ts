import type { CampaignState } from '../game/types';
import { detectChangeOverTimeCandidates, refreshSupportedContradictions } from './deltas';

export interface ReconcileRevisionCounterEvidenceOptions {
  now?: () => string;
}

const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (ids: string[]) => [...new Set(ids)].sort(compareText);

/**
 * Adds only the structural links selected by RF07 after an ordinary turn has
 * crossed the Cartographer event firewall.  It never reads semantic prose or
 * gives provider output authority to declare a contradiction.
 */
export function reconcileRevisionCounterEvidence(
  previousState: CampaignState,
  nextState: CampaignState,
  options: ReconcileRevisionCounterEvidenceOptions = {}
): CampaignState {
  const previousEvidenceIds = new Set(previousState.evidence.map((evidence) => evidence.id));
  const evidenceById = new Map(nextState.evidence.map((evidence) => [evidence.id, evidence]));
  const links = new Map<string, Set<string>>();

  for (const candidate of detectChangeOverTimeCandidates(nextState)) {
    if (previousEvidenceIds.has(candidate.newerEvidenceId)) continue;
    const older = evidenceById.get(candidate.olderEvidenceId);
    const newer = evidenceById.get(candidate.newerEvidenceId);
    if (!older || !newer) continue;
    (links.get(older.id) ?? links.set(older.id, new Set()).get(older.id)!).add(newer.id);
    (links.get(newer.id) ?? links.set(newer.id, new Set()).get(newer.id)!).add(older.id);
  }

  if (links.size === 0) return nextState;
  let changed = false;
  const evidence = nextState.evidence.map((record) => {
    const additions = links.get(record.id);
    if (!additions) return record;
    const counterEvidenceIds = sortedUnique([...record.counterEvidenceIds, ...additions]);
    if (counterEvidenceIds.length === record.counterEvidenceIds.length && counterEvidenceIds.every((id, index) => id === record.counterEvidenceIds[index])) return record;
    changed = true;
    return { ...record, counterEvidenceIds };
  });
  if (!changed) return nextState;

  const at = options.now?.() ?? new Date().toISOString();
  const linked = { ...nextState, evidence, updatedAt: at };
  return refreshSupportedContradictions(linked, { now: () => at });
}
