import type { CampaignState } from '../game/types';
import { journalEntryIsProviderEligible } from '../journal/domain';
import { knowledgeGapSchema, type KnowledgeGap } from './schema';

export interface JournalCuriosityMarkerInput {
  id: string;
  journalEntryId: string;
  territoryIds: string[];
  dimensionIds: string[];
  /**
   * Explicit marker wording supplied by the UI/action boundary.
   *
   * K02 never derives this from Journal prose.
   */
  summary: string;
}

function stableSet(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = stableSet(left);
  const b = stableSet(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * K02 explicit-curiosity boundary.
 *
 * A curiosity gap exists because Greyson explicitly chose an "explore this"
 * action, never because code/model text-mined a Journal entry for salience.
 *
 * The returned gap starts at priority 0. K01 owns deterministic
 * undercoverage/age scoring; K04 owns diversity/cooldown. K02 does not invent a
 * hidden curiosity bonus or rank dramatic subject matter.
 *
 * This function returns a record only. It does not append to CampaignState,
 * create an AdventureSeed, call a provider, or award progression.
 */
export function buildJournalCuriosityGap(
  state: CampaignState,
  input: JournalCuriosityMarkerInput
): KnowledgeGap {
  if (!input.id.trim()) throw new Error('KnowledgeGap id must not be empty.');
  if (!input.summary.trim()) throw new Error('Curiosity summary must not be empty.');

  const journal = state.journalEntries.find((entry) => entry.id === input.journalEntryId);
  if (!journal) throw new Error(`Unknown JournalEntry id: ${input.journalEntryId}`);
  if (!journalEntryIsProviderEligible(journal)) {
    throw new Error(`JournalEntry is not eligible for curiosity seeding: ${input.journalEntryId}`);
  }

  const territoryIds = stableSet(input.territoryIds);
  const dimensionIds = stableSet(input.dimensionIds);
  if (territoryIds.length === 0) throw new Error('Curiosity marker requires at least one territory.');
  if (dimensionIds.length === 0) throw new Error('Curiosity marker requires at least one dimension.');

  const territories = territoryIds.map((territoryId) => {
    const territory = state.territories.find((item) => item.id === territoryId);
    if (!territory) throw new Error(`Unknown territory id: ${territoryId}`);
    return territory;
  });

  const allowedDimensions = new Set(territories.flatMap((territory) => territory.requiredDimensions));
  for (const dimensionId of dimensionIds) {
    if (!allowedDimensions.has(dimensionId)) {
      throw new Error(
        `Dimension ${dimensionId} is not mapped by the selected curiosity territories.`
      );
    }
  }

  const existingById = state.knowledgeGaps.find((gap) => gap.id === input.id);
  if (existingById) {
    const sameMarker =
      existingById.kind === 'curiosity'
      && existingById.summary === input.summary.trim()
      && sameSet(existingById.territoryIds, territoryIds)
      && sameSet(existingById.dimensionIds, dimensionIds)
      && sameSet(existingById.sourceJournalEntryIds, [journal.id])
      && existingById.sourceEvidenceIds.length === 0;

    if (sameMarker) return existingById;
    throw new Error(`KnowledgeGap id already exists: ${input.id}`);
  }

  const duplicate = state.knowledgeGaps.find((gap) =>
    gap.kind === 'curiosity'
    && gap.status !== 'retired'
    && sameSet(gap.territoryIds, territoryIds)
    && sameSet(gap.dimensionIds, dimensionIds)
    && sameSet(gap.sourceJournalEntryIds, [journal.id])
    && gap.sourceEvidenceIds.length === 0
  );
  if (duplicate) return duplicate;

  return knowledgeGapSchema.parse({
    id: input.id,
    kind: 'curiosity',
    territoryIds,
    dimensionIds,
    sourceEvidenceIds: [],
    sourceJournalEntryIds: [journal.id],
    summary: input.summary.trim(),
    status: 'open',
    priority: 0
  });
}
