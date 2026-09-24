import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import { createJournalEntry } from '../../src/journal/domain';
import { linkJournalEntry } from '../../src/journal/links';
import { createReflectionRecord } from '../../src/reflection/domain';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';

function fixtureState() {
  const initial = createInitialCampaign();
  const journal = createJournalEntry({
    id: 'journal_link_fixture',
    createdAt: '2026-01-02T03:04:05.000Z',
    text: 'Synthetic Journal source.',
    inputMode: 'typed'
  });
  const reflection = createReflectionRecord({
    id: 'reflection_link_fixture',
    sourceKind: 'journal',
    sourceIds: [journal.id],
    question: 'Synthetic reflection?',
    createdAt: '2026-01-02T03:05:05.000Z'
  });

  return {
    ...initial,
    journalEntries: [journal],
    reflections: [reflection],
    adventureSeeds: [{
      id: 'seed_link_fixture',
      sourceGapIds: [],
      kind: 'pure-fun' as const,
      territoryId: 'identity',
      premise: 'Synthetic seed.',
      learningTarget: 'none' as const,
      status: 'started' as const
    }],
    adventureRuns: [{
      id: 'run_link_fixture',
      seedId: 'seed_link_fixture',
      territoryId: 'identity',
      status: 'active' as const,
      currentBeat: 'hook',
      characterIds: [],
      memoryIds: [],
      startedAt: '2026-01-02T03:06:05.000Z'
    }]
  };
}

describe('Journal links (J07)', () => {
  it('links one Journal entry to an existing active Reflection record', () => {
    const state = fixtureState();
    const linked = linkJournalEntry(state, 'journal_link_fixture', {
      kind: 'reflection',
      id: 'reflection_link_fixture'
    });

    expect(linked.journalEntries[0].linkedReflectionIds).toEqual(['reflection_link_fixture']);
    expect(linked.journalEntries[0].linkedAdventureIds).toEqual([]);
    expect(state.journalEntries[0].linkedReflectionIds).toEqual([]);
  });

  it('links an AdventureRun id, not an AdventureSeed id', () => {
    const state = fixtureState();

    expect(() => linkJournalEntry(state, 'journal_link_fixture', {
      kind: 'adventure',
      id: 'seed_link_fixture'
    })).toThrow('Unknown AdventureRun id: seed_link_fixture');

    const linked = linkJournalEntry(state, 'journal_link_fixture', {
      kind: 'adventure',
      id: 'run_link_fixture'
    });
    expect(linked.journalEntries[0].linkedAdventureIds).toEqual(['run_link_fixture']);
  });

  it('is idempotent and refuses dangling target ids', () => {
    const state = fixtureState();
    const once = linkJournalEntry(state, 'journal_link_fixture', {
      kind: 'reflection',
      id: 'reflection_link_fixture'
    });
    const twice = linkJournalEntry(once, 'journal_link_fixture', {
      kind: 'reflection',
      id: 'reflection_link_fixture'
    });

    expect(twice).toBe(once);
    expect(twice.journalEntries[0].linkedReflectionIds).toEqual(['reflection_link_fixture']);
    expect(() => linkJournalEntry(state, 'journal_link_fixture', {
      kind: 'reflection',
      id: 'missing'
    })).toThrow('Unknown ReflectionRecord id: missing');
  });

  it('preserves private local Journal links but refuses new links after retraction', () => {
    const state = fixtureState();
    state.journalEntries[0] = { ...state.journalEntries[0], privacy: 'private' };

    const privateLinked = linkJournalEntry(state, 'journal_link_fixture', {
      kind: 'reflection',
      id: 'reflection_link_fixture'
    });
    expect(privateLinked.journalEntries[0].privacy).toBe('private');
    expect(privateLinked.journalEntries[0].linkedReflectionIds).toEqual(['reflection_link_fixture']);

    const retracted = {
      ...state,
      journalEntries: [{ ...state.journalEntries[0], status: 'retracted' as const }]
    };
    expect(() => linkJournalEntry(retracted, 'journal_link_fixture', {
      kind: 'reflection',
      id: 'reflection_link_fixture'
    })).toThrow('Cannot add a new link to retracted JournalEntry');
  });

  it('persists reflection and adventure links through the public export/import boundary', () => {
    let state = fixtureState();
    state = linkJournalEntry(state, 'journal_link_fixture', {
      kind: 'reflection',
      id: 'reflection_link_fixture'
    });
    state = linkJournalEntry(state, 'journal_link_fixture', {
      kind: 'adventure',
      id: 'run_link_fixture'
    });

    const restored = deserializeCampaign(serializeCampaign(state));
    expect(restored.journalEntries[0].linkedReflectionIds).toEqual(['reflection_link_fixture']);
    expect(restored.journalEntries[0].linkedAdventureIds).toEqual(['run_link_fixture']);
  });
});
