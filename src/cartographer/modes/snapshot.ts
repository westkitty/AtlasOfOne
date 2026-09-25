import type { CampaignState } from '../../game/types';
import { createV2ProvenanceVisibility } from '../../persistence/retirement';
import { MODE_CONTEXT_BUDGET, clipText, takeWithinBudget } from './budget';
import { compileDoNotReassert, type DoNotReassertItem } from './doNotReassert';
import { compileReflectionHistory, type ReflectionModeContext } from './reflection';

export interface SnapshotModeTask {
  /** YYYY-MM-DD; injected, never read from a clock. */
  asOfDate: string;
}

export interface SnapshotModeContext {
  mode: 'snapshot';
  asOfDate: string;
  evidence: Array<{ id: string; dimension: string; claim: string; strength: 1 | 2 | 3 }>;
  confirmedInsights: Array<{ id: string; title: string }>;
  contradictions: Array<{ id: string; claim: string; status: string }>;
  reflectionHistory: ReflectionModeContext['reflectionHistory'];
  /** RF04: rejected interpretations. Do not reassert. Not citable provenance. */
  doNotReassert: DoNotReassertItem[];
  /** Pass to parseSnapshotProposalForContext. */
  allowedProvenanceIds: string[];
}

/**
 * P05 Snapshot-mode bounded context: provenance-visible confirmed material only
 * (plan 23.5). Evidence must pass `evidenceIsEligible` (which also enforces the
 * I06 Reflection chain); insights must be `confirmed` AND eligible;
 * contradictions and reflections must be eligible.
 */
export function compileSnapshotModeContext(state: CampaignState, task: SnapshotModeTask): SnapshotModeContext {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.asOfDate)) throw new Error('asOfDate must be YYYY-MM-DD');
  const budget = MODE_CONTEXT_BUDGET.snapshot;
  const visibility = createV2ProvenanceVisibility(state);
  const remaining = { remaining: budget.totalChars };

  const evidence = takeWithinBudget(
    state.evidence
      .filter((record) => record.status === 'active' && visibility.evidenceIsEligible(record.id))
      .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
      .map((record) => ({
        id: record.id,
        dimension: record.dimension,
        claim: clipText(record.claim, budget.claimChars),
        strength: record.strength
      })),
    budget.evidence,
    remaining,
    (item) => item.claim.length
  );

  const confirmedInsights = takeWithinBudget(
    state.insights
      .filter((insight) => insight.status === 'confirmed' && visibility.insightIsEligible(insight.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((insight) => ({ id: insight.id, title: clipText(insight.title, budget.insightChars) })),
    budget.confirmedInsights,
    remaining,
    (item) => item.title.length
  );

  const contradictions = takeWithinBudget(
    state.contradictions
      .filter((record) => visibility.contradictionIsEligible(record.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((record) => ({ id: record.id, claim: clipText(record.claim, budget.contradictionChars), status: record.status })),
    budget.contradictions,
    remaining,
    (item) => item.claim.length
  );

  const doNotReassert = compileDoNotReassert(state, budget.rejectedInterpretations, budget.rejectedChars, remaining);
  const reflectionHistory = compileReflectionHistory(state, budget.reflectionHistory, budget.historyChars, remaining);

  return {
    mode: 'snapshot',
    asOfDate: task.asOfDate,
    evidence,
    confirmedInsights,
    contradictions,
    reflectionHistory,
    doNotReassert,
    allowedProvenanceIds: [
      ...evidence.map((item) => item.id),
      ...confirmedInsights.map((item) => item.id),
      ...contradictions.map((item) => item.id),
      ...reflectionHistory.map((item) => item.id)
    ]
  };
}
