import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { appendJournalEntry, createJournalEntry, journalEntryIsProviderEligible } from '../../src/journal/domain';
import { privatizeJournalEntry, retractJournalEntryFromCampaign } from '../../src/journal/privacy';
import { createV2ProvenanceVisibility } from '../../src/persistence/retirement';

function sourcedState(): CampaignState {
  const initial = createInitialCampaign();
  const entry = createJournalEntry({
    id: 'journal_canary',
    createdAt: '2026-01-02T03:04:05.000Z',
    text: 'PRIVATE_RETRACTION_CANARY',
    inputMode: 'typed'
  });

  return {
    ...initial,
    journalEntries: appendJournalEntry(initial.journalEntries, entry),
    knowledgeGaps: [{
      id: 'gap_canary',
      kind: 'curiosity' as const,
      territoryIds: ['identity'],
      dimensionIds: ['self-description'],
      sourceEvidenceIds: [],
      sourceJournalEntryIds: ['journal_canary'],
      summary: 'CANARY_GAP',
      status: 'open' as const,
      priority: 5
    }],
    adventureSeeds: [{
      id: 'seed_canary',
      sourceGapIds: ['gap_canary'],
      kind: 'social-dilemma' as const,
      territoryId: 'identity',
      premise: 'CANARY_SEED',
      learningTarget: 'reflection-eligible' as const,
      status: 'available' as const
    }],
    adventureMemories: [{
      id: 'memory_canary',
      type: 'event' as const,
      summary: 'CANARY_MEMORY',
      triggerTerms: ['canary'],
      sourceIds: ['seed_canary'],
      privacy: 'normal' as const,
      status: 'active' as const
    }]
  };
}

describe('Journal PRIVATE/retraction campaign boundary (J05)', () => {
  it('PRIVATE preserves local history and retires exclusively derived state', () => {
    const before = sourcedState();
    const after = privatizeJournalEntry(before, 'journal_canary', '2026-01-03T00:00:00.000Z');

    expect(after.journalEntries[0]).toMatchObject({
      id: 'journal_canary',
      text: 'PRIVATE_RETRACTION_CANARY',
      privacy: 'private',
      status: 'active'
    });
    expect(journalEntryIsProviderEligible(after.journalEntries[0])).toBe(false);
    expect(after.knowledgeGaps[0].status).toBe('retired');
    expect(after.adventureSeeds[0].status).toBe('retired');
    expect(after.adventureMemories[0].status).toBe('retired');
    expect(createV2ProvenanceVisibility(after).journalEntryIsEligible('journal_canary')).toBe(false);
  });

  it('retraction preserves the Journal record while retiring its authority transitively', () => {
    const before = sourcedState();
    const after = retractJournalEntryFromCampaign(before, 'journal_canary', '2026-01-03T00:00:00.000Z');

    expect(after.journalEntries[0]).toMatchObject({
      id: 'journal_canary',
      text: 'PRIVATE_RETRACTION_CANARY',
      privacy: 'normal',
      status: 'retracted'
    });
    expect(journalEntryIsProviderEligible(after.journalEntries[0])).toBe(false);
    expect(after.knowledgeGaps[0].status).toBe('retired');
    expect(after.adventureSeeds[0].status).toBe('retired');
    expect(after.adventureMemories[0].status).toBe('retired');
    expect(createV2ProvenanceVisibility(after).journalEntryIsEligible('journal_canary')).toBe(false);
  });

  it('fails closed for an unknown Journal id instead of mutating some other entry', () => {
    const state = sourcedState();
    expect(() => privatizeJournalEntry(state, 'missing', '2026-01-03T00:00:00.000Z'))
      .toThrow('Unknown JournalEntry id: missing');
    expect(() => retractJournalEntryFromCampaign(state, 'missing', '2026-01-03T00:00:00.000Z'))
      .toThrow('Unknown JournalEntry id: missing');
  });
});
