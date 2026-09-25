import type { CampaignState } from '../../game/types';
import {
  selectJournalEntriesNewestFirst,
  selectProviderEligibleJournalEntries
} from '../../journal/domain';
import { createV2ProvenanceVisibility } from '../../persistence/retirement';
import { MODE_CONTEXT_BUDGET, clipText, takeWithinBudget } from './budget';

export interface JournalModeTask {
  journalEntryId: string;
}

export interface JournalModeContext {
  mode: 'journal';
  entry: { id: string; text: string; truncated: boolean };
  recentEntries: Array<{ id: string; createdAt: string; text: string }>;
  openGaps: Array<{ id: string; kind: string; summary: string }>;
  territories: Array<{ id: string; label: string; dimensionIds: string[] }>;
  /** Exactly the IDs placed in this context; provider citations must be a subset. */
  allowedIds: {
    journalEntryIds: string[];
    gapIds: string[];
    territoryIds: string[];
    dimensionIds: string[];
  };
}

/**
 * P05 Journal-mode bounded context.
 *
 * Built only from `selectProviderEligibleJournalEntries` (active + normal
 * privacy) and structurally visible KnowledgeGaps. PRIVATE dimensions are
 * dropped from the territory list. The current entry must itself be eligible:
 * a PRIVATE/retracted entry never reaches a provider, so this throws and the
 * caller uses the P08 local acknowledgement instead.
 */
export function compileJournalModeContext(state: CampaignState, task: JournalModeTask): JournalModeContext {
  const budget = MODE_CONTEXT_BUDGET.journal;
  const eligible = selectProviderEligibleJournalEntries(state.journalEntries);
  const current = eligible.find((entry) => entry.id === task.journalEntryId);
  if (!current) throw new Error('Journal entry is not provider-eligible.');

  const remaining = { remaining: budget.totalChars };
  const entryText = clipText(current.text, budget.currentEntryChars);
  remaining.remaining -= entryText.length;

  const recentEntries = takeWithinBudget(
    selectJournalEntriesNewestFirst(eligible)
      .filter((entry) => entry.id !== current.id)
      .map((entry) => ({ id: entry.id, createdAt: entry.createdAt, text: clipText(entry.text, budget.recentEntryChars) })),
    budget.recentEntries,
    remaining,
    (entry) => entry.text.length
  );

  const visibility = createV2ProvenanceVisibility(state);
  const openGaps = takeWithinBudget(
    state.knowledgeGaps
      .filter((gap) => (gap.status === 'open' || gap.status === 'seeded')
        && visibility.knowledgeGapIsStructurallyVisible(gap.id))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
      .map((gap) => ({ id: gap.id, kind: gap.kind, summary: clipText(gap.summary, budget.gapSummaryChars) })),
    budget.knowledgeGaps,
    remaining,
    (gap) => gap.summary.length
  );

  const privateDims = new Set(state.privateTopics);
  const territories = [...state.territories]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((territory) => ({
      id: territory.id,
      label: territory.label,
      dimensionIds: territory.requiredDimensions.filter((dim) => !privateDims.has(dim))
    }));

  return {
    mode: 'journal',
    entry: { id: current.id, text: entryText, truncated: entryText !== current.text },
    recentEntries,
    openGaps,
    territories,
    allowedIds: {
      journalEntryIds: [current.id, ...recentEntries.map((entry) => entry.id)],
      gapIds: openGaps.map((gap) => gap.id),
      territoryIds: territories.map((territory) => territory.id),
      dimensionIds: [...new Set(territories.flatMap((territory) => territory.dimensionIds))].sort()
    }
  };
}
