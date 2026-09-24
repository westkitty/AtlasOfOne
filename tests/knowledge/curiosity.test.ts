import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { createJournalEntry } from '../../src/journal/domain';
import { buildJournalCuriosityGap } from '../../src/knowledge/curiosity';

function fixtureState(): CampaignState {
  const state = createInitialCampaign();
  const journal = createJournalEntry({
    id: 'journal_curiosity_fixture',
    createdAt: '2026-01-02T03:04:05.000Z',
    text: 'This prose is intentionally irrelevant to K02 interpretation.',
    inputMode: 'typed'
  });
  return { ...state, journalEntries: [journal] };
}

function marker() {
  return {
    id: 'gap_curiosity_fixture',
    journalEntryId: 'journal_curiosity_fixture',
    territoryIds: ['identity'],
    dimensionIds: ['self-description'],
    summary: 'Explore how I describe myself in different settings.'
  };
}

describe('explicit curiosity markers (K02)', () => {
  it('creates a curiosity gap only from an explicit eligible Journal action', () => {
    const state = fixtureState();
    const gap = buildJournalCuriosityGap(state, marker());

    expect(gap).toEqual({
      id: 'gap_curiosity_fixture',
      kind: 'curiosity',
      territoryIds: ['identity'],
      dimensionIds: ['self-description'],
      sourceEvidenceIds: [],
      sourceJournalEntryIds: ['journal_curiosity_fixture'],
      summary: 'Explore how I describe myself in different settings.',
      status: 'open',
      priority: 0
    });
    expect(state.knowledgeGaps).toEqual([]);
  });

  it('does not derive summary, territory, dimension, or priority from Journal prose', () => {
    const state = fixtureState();
    state.journalEntries[0] = {
      ...state.journalEntries[0],
      text: 'Completely different synthetic prose mentioning danger pain trauma drama etc.'
    };

    const gap = buildJournalCuriosityGap(state, marker());
    expect(gap.summary).toBe('Explore how I describe myself in different settings.');
    expect(gap.territoryIds).toEqual(['identity']);
    expect(gap.dimensionIds).toEqual(['self-description']);
    expect(gap.priority).toBe(0);
  });

  it('fails closed for PRIVATE or retracted Journal sources', () => {
    const privateState = fixtureState();
    privateState.journalEntries[0] = {
      ...privateState.journalEntries[0],
      privacy: 'private'
    };
    expect(() => buildJournalCuriosityGap(privateState, marker()))
      .toThrow('JournalEntry is not eligible for curiosity seeding');

    const retractedState = fixtureState();
    retractedState.journalEntries[0] = {
      ...retractedState.journalEntries[0],
      status: 'retracted'
    };
    expect(() => buildJournalCuriosityGap(retractedState, marker()))
      .toThrow('JournalEntry is not eligible for curiosity seeding');
  });

  it('validates territory and dimension IDs instead of accepting provider free text', () => {
    const state = fixtureState();

    expect(() => buildJournalCuriosityGap(state, {
      ...marker(),
      territoryIds: ['not-a-territory']
    })).toThrow('Unknown territory id: not-a-territory');

    expect(() => buildJournalCuriosityGap(state, {
      ...marker(),
      dimensionIds: ['not-a-dimension']
    })).toThrow('not mapped by the selected curiosity territories');
  });

  it('normalizes explicit target sets deterministically without mutating caller arrays', () => {
    const state = fixtureState();
    const input = {
      ...marker(),
      territoryIds: ['identity', 'identity'],
      dimensionIds: ['self-description', 'self-description']
    };
    const originalTerritories = [...input.territoryIds];
    const originalDimensions = [...input.dimensionIds];

    const gap = buildJournalCuriosityGap(state, input);
    expect(gap.territoryIds).toEqual(['identity']);
    expect(gap.dimensionIds).toEqual(['self-description']);
    expect(input.territoryIds).toEqual(originalTerritories);
    expect(input.dimensionIds).toEqual(originalDimensions);
  });

  it('deduplicates the same open curiosity marker and rejects conflicting ID reuse', () => {
    const state = fixtureState();
    const existing = buildJournalCuriosityGap(state, marker());
    state.knowledgeGaps = [existing];

    expect(buildJournalCuriosityGap(state, {
      ...marker(),
      id: 'another_candidate_id'
    })).toBe(existing);

    expect(buildJournalCuriosityGap(state, marker())).toBe(existing);

    expect(() => buildJournalCuriosityGap(state, {
      ...marker(),
      summary: 'Different explicit curiosity.'
    })).toThrow('KnowledgeGap id already exists');
  });

  it('requires explicit non-empty marker identity, target, and wording', () => {
    const state = fixtureState();

    expect(() => buildJournalCuriosityGap(state, { ...marker(), id: ' ' }))
      .toThrow('id must not be empty');
    expect(() => buildJournalCuriosityGap(state, { ...marker(), summary: ' ' }))
      .toThrow('summary must not be empty');
    expect(() => buildJournalCuriosityGap(state, { ...marker(), territoryIds: [] }))
      .toThrow('at least one territory');
    expect(() => buildJournalCuriosityGap(state, { ...marker(), dimensionIds: [] }))
      .toThrow('at least one dimension');
    expect(() => buildJournalCuriosityGap(state, {
      ...marker(),
      journalEntryId: 'missing'
    })).toThrow('Unknown JournalEntry id: missing');
  });
});
