import { describe, expect, it } from 'vitest';
import { evaluateSnapshotEligibility } from '../../src/atlas/eligibility';
import { synthesizeLocalSnapshot } from '../../src/atlas/synthesize';
import type { CampaignState } from '../../src/game/types';
import { createJournalEntry } from '../../src/journal/domain';
import { markJournalEntryPrivate, retractJournalEntry } from '../../src/journal/domain';
import { createReflectionRecord, decideReflection } from '../../src/reflection/domain';
import { buildReflectionEvidenceProposal } from '../../src/reflection/evidence';
import {
  privatizeReflectionInCampaign,
  propagateSourceAuthorityChange,
  retractReflectionInCampaign
} from '../../src/reflection/propagation';
import { chartedState } from '../atlas/fixtures';

const T_SNAP = '2026-02-01T00:00:00.000Z';
const T_NOW = '2026-03-01T00:00:00.000Z';

function reflection(id: string, sourceKind: 'journal' | 'insight' | 'contradiction' | 'snapshot', sourceIds: string[]) {
  return decideReflection(
    createReflectionRecord({ id, sourceKind, sourceIds, question: 'Synthetic question?', interpretation: `Synthetic reading ${id}.`, createdAt: T_SNAP }),
    'confirm',
    'Synthetic confirming response.'
  );
}

/** Charted state with a historical Snapshot plus Reflections on every source kind. */
function graph(): CampaignState {
  const base = chartedState();
  const journal = createJournalEntry({ id: 'journal_1', createdAt: T_SNAP, text: 'Synthetic journal text.', inputMode: 'typed' });
  const withJournal: CampaignState = { ...base, journalEntries: [journal] };
  const request = evaluateSnapshotEligibility(withJournal, { trigger: 'milestone', requestedAt: T_SNAP });
  if (!request.eligible) throw new Error('fixture');
  const snapshot = synthesizeLocalSnapshot(withJournal, { id: 'snapshot_1', request: request.request });
  return {
    ...withJournal,
    atlasSnapshots: [snapshot],
    reflections: [
      reflection('reflection_journal', 'journal', ['journal_1']),
      reflection('reflection_insight', 'insight', ['insight_1']),
      reflection('reflection_contradiction', 'contradiction', ['contradiction_1']),
      reflection('reflection_snapshot', 'snapshot', ['snapshot_1'])
    ],
    adventureMemories: [
      { id: 'memory_only_reflection', type: 'event', summary: 'Synthetic.', triggerTerms: [], sourceIds: ['reflection_journal'], privacy: 'normal', status: 'active' },
      { id: 'memory_mixed', type: 'event', summary: 'Synthetic.', triggerTerms: [], sourceIds: ['reflection_journal', 'ev_6'], privacy: 'normal', status: 'active' }
    ]
  };
}

const retractEvidence = (state: CampaignState, id: string): CampaignState => ({
  ...state,
  evidence: state.evidence.map((record) => (record.id === id ? { ...record, status: 'retracted' as const } : record))
});

describe('Reflection privacy/retraction propagation (RF09)', () => {
  it('journal PRIVATE withholds its Reflection, blocks evidence proposals and retires exclusive memory', () => {
    const before = graph();
    const changed = { ...before, journalEntries: markJournalEntryPrivate(before.journalEntries, 'journal_1') };
    const { state, withdrawn } = propagateSourceAuthorityChange(before, changed);

    expect(withdrawn.reflectionIds).toEqual(['reflection_journal']);
    expect(withdrawn.adventureMemoryIds).toEqual(['memory_only_reflection']);
    expect(state.adventureMemories.find((m) => m.id === 'memory_mixed')?.status).toBe('active');
    expect(buildReflectionEvidenceProposal(state, 'reflection_journal')).toBeNull();
    // History preserved: the Reflection record itself is not deleted or rewritten.
    expect(state.reflections.find((r) => r.id === 'reflection_journal'))
      .toEqual(before.reflections.find((r) => r.id === 'reflection_journal'));
  });

  it('journal retraction propagates identically', () => {
    const before = graph();
    const changed = { ...before, journalEntries: retractJournalEntry(before.journalEntries, 'journal_1') };
    expect(propagateSourceAuthorityChange(before, changed).withdrawn.reflectionIds).toEqual(['reflection_journal']);
  });

  it('canary: evidence retraction flows reflection -> insight -> contradiction -> snapshot eligibility', () => {
    const before = graph();
    const frozenSnapshot = JSON.stringify(before.atlasSnapshots);
    const changed = retractEvidence(retractEvidence(before, 'ev_1'), 'ev_3');
    const { state, withdrawn } = propagateSourceAuthorityChange(before, changed);

    expect(withdrawn.insightIds).toEqual(['insight_1']);
    expect(withdrawn.contradictionIds).toEqual(['contradiction_1']);
    expect(withdrawn.reflectionIds).toEqual(['reflection_contradiction', 'reflection_insight', 'reflection_snapshot']);
    // Historical Snapshot is excluded, never rewritten.
    expect(withdrawn.atlasSnapshotIds).toEqual(['snapshot_1']);
    expect(JSON.stringify(state.atlasSnapshots)).toBe(frozenSnapshot);

    const next = evaluateSnapshotEligibility(state, { trigger: 'explicit-request', requestedAt: T_NOW });
    const serialized = JSON.stringify(next);
    for (const id of ['"ev_1"', '"ev_3"', 'insight_1', 'contradiction_1']) {
      expect(serialized).not.toContain(id);
    }
  });

  it('canary: when every source is retracted or PRIVATE, snapshot eligibility closes with no IDs', () => {
    const before = graph();
    let changed = before;
    for (const record of before.evidence.slice(0, 3)) changed = retractEvidence(changed, record.id);
    changed = { ...changed, privateTopics: before.evidence.slice(3).map((record) => record.dimension) };
    const { state, withdrawn } = propagateSourceAuthorityChange(before, changed);

    expect(withdrawn.atlasSnapshotIds).toEqual(['snapshot_1']);
    const result = evaluateSnapshotEligibility(state, { trigger: 'explicit-request', requestedAt: T_NOW });
    expect(result).toEqual({ eligible: false, reasons: ['insufficient-evidence', 'no-new-material'] });
    expect(JSON.stringify(result)).not.toMatch(/ev_|insight_|contradiction_/);
  });

  it('keeps unrelated derived records eligible (no over-withdrawal)', () => {
    const before = graph();
    const { withdrawn } = propagateSourceAuthorityChange(before, retractEvidence(before, 'ev_6'));
    expect(withdrawn.insightIds).toEqual([]);
    expect(withdrawn.contradictionIds).toEqual([]);
    expect(withdrawn.reflectionIds).toEqual(['reflection_snapshot']);
    expect(withdrawn.adventureMemoryIds).toEqual([]);
  });

  it('Reflection PRIVATE / retraction retires memory that relied exclusively on it', () => {
    const before = graph();
    const privatized = privatizeReflectionInCampaign(before, 'reflection_journal', T_NOW);
    expect(privatized.state.reflections.find((r) => r.id === 'reflection_journal')?.privacy).toBe('private');
    expect(privatized.state.updatedAt).toBe(T_NOW);
    expect(privatized.withdrawn.reflectionIds).toEqual(['reflection_journal']);
    expect(privatized.withdrawn.adventureMemoryIds).toEqual(['memory_only_reflection']);

    const retracted = retractReflectionInCampaign(before, 'reflection_journal', T_NOW);
    expect(retracted.state.reflections.find((r) => r.id === 'reflection_journal')?.recordStatus).toBe('retracted');
    expect(retracted.withdrawn.adventureMemoryIds).toEqual(['memory_only_reflection']);
  });

  it('is a no-op report when nothing changed and throws on unknown Reflection ids', () => {
    const before = graph();
    const { withdrawn } = propagateSourceAuthorityChange(before, before);
    expect(Object.values(withdrawn).flat()).toEqual([]);
    expect(() => privatizeReflectionInCampaign(before, 'missing', T_NOW)).toThrow(/Unknown/);
  });
});
