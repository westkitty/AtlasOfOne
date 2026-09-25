import type { CampaignState } from '../../game/types';
import { createV2ProvenanceVisibility } from '../../persistence/retirement';
import type { ReflectionRecord } from '../../reflection/schema';
import { MODE_CONTEXT_BUDGET, clipText, takeWithinBudget } from './budget';
import { compileDoNotReassert, type DoNotReassertItem } from './doNotReassert';

export type ReflectionModeSourceKind = 'journal' | 'adventure' | 'insight' | 'contradiction';

export interface ReflectionModeTask {
  sourceKind: ReflectionModeSourceKind;
  sourceIds: readonly string[];
}

export interface ReflectionModeContext {
  mode: 'reflection';
  sourceKind: ReflectionModeSourceKind;
  sources: Array<{ id: string; text: string }>;
  /** Greyson's own confirmed/partial Reflections, for continuity only. */
  reflectionHistory: Array<{ id: string; question: string; interpretation?: string; status: string }>;
  /** RF04: interpretations Greyson rejected. Do not reassert. Not citable. */
  doNotReassert: DoNotReassertItem[];
  /** Exactly the source IDs placed in `sources`; pass to parseReflectionProposalForContext. */
  allowedSourceIds: string[];
}

/**
 * P05 Reflection-mode bounded context.
 *
 * Each requested source ID is kept only if the v2 provenance graph says it is
 * eligible for its kind; ineligible IDs are dropped silently (no text, no ID,
 * no count). If nothing eligible remains, this throws so the caller uses the
 * P09 local wording.
 */
export function compileReflectionModeContext(
  state: CampaignState,
  task: ReflectionModeTask
): ReflectionModeContext {
  const budget = MODE_CONTEXT_BUDGET.reflection;
  const visibility = createV2ProvenanceVisibility(state);
  const requested = [...new Set(task.sourceIds)].sort();

  const resolve = (id: string): { id: string; text: string } | undefined => {
    switch (task.sourceKind) {
      case 'journal': {
        const entry = state.journalEntries.find((item) => item.id === id);
        return entry && visibility.journalEntryIsEligible(id) ? { id, text: entry.text } : undefined;
      }
      case 'adventure': {
        const obs = state.adventureObservations.find((item) => item.id === id);
        return obs && visibility.adventureObservationIsEligible(id) ? { id, text: obs.observation } : undefined;
      }
      case 'insight': {
        const insight = state.insights.find((item) => item.id === id);
        return insight && visibility.insightIsEligible(id)
          ? { id, text: `${insight.title}. ${insight.summary}` }
          : undefined;
      }
      case 'contradiction': {
        const record = state.contradictions.find((item) => item.id === id);
        return record && visibility.contradictionIsEligible(id) ? { id, text: record.claim } : undefined;
      }
    }
  };

  const remaining = { remaining: budget.totalChars };
  const sources = takeWithinBudget(
    requested
      .map(resolve)
      .filter((item): item is { id: string; text: string } => Boolean(item))
      .map((item) => ({ id: item.id, text: clipText(item.text, budget.sourceChars) })),
    budget.sources,
    remaining,
    (item) => item.text.length
  );
  if (sources.length === 0) throw new Error('No provider-eligible Reflection sources.');

  const doNotReassert = compileDoNotReassert(state, budget.rejectedInterpretations, budget.rejectedChars, remaining);
  const reflectionHistory = compileReflectionHistory(state, budget.reflectionHistory, budget.historyChars, remaining);

  return {
    mode: 'reflection',
    sourceKind: task.sourceKind,
    sources,
    reflectionHistory,
    doNotReassert,
    allowedSourceIds: sources.map((item) => item.id)
  };
}

/** Eligible confirmed/partial Reflections, newest first, bounded. */
export function compileReflectionHistory(
  state: CampaignState,
  maxItems: number,
  maxChars: number,
  remaining: { remaining: number }
): ReflectionModeContext['reflectionHistory'] {
  const visibility = createV2ProvenanceVisibility(state);
  const decided = state.reflections
    .filter((record: ReflectionRecord) =>
      (record.epistemicStatus === 'confirmed' || record.epistemicStatus === 'partial')
      && visibility.reflectionIsEligible(record.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .map((record) => ({
      id: record.id,
      question: clipText(record.question, maxChars),
      ...(record.interpretation ? { interpretation: clipText(record.interpretation, maxChars) } : {}),
      status: record.epistemicStatus
    }));
  return takeWithinBudget(decided, maxItems, remaining,
    (item) => item.question.length + (item.interpretation?.length ?? 0));
}
