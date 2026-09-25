import { describe, expect, it } from 'vitest';
import { reflectionProposalSchema } from '../../src/cartographer/reflectionProposal';
import { snapshotProposalSchema } from '../../src/cartographer/snapshotProposal';
import type { CampaignState } from '../../src/game/types';
import { createJournalEntry, markJournalEntryPrivate } from '../../src/journal/domain';
import {
  findRejectedReassertions,
  interpretationsMatch,
  proposalReassertsRejected,
  selectRejectedInterpretations
} from '../../src/reflection/antiRepeat';
import { createReflectionRecord, decideReflection, retractReflection } from '../../src/reflection/domain';
import { chartedState } from '../atlas/fixtures';

const T = '2026-02-01T00:00:00.000Z';
const REJECTED_TEXT = 'Synthetic reading: you avoid conflict to keep the peace.';

function rejectedReflection(id: string, interpretation = REJECTED_TEXT) {
  return decideReflection(
    createReflectionRecord({ id, sourceKind: 'journal', sourceIds: ['journal_1'], question: 'Synthetic question?', interpretation, createdAt: T }),
    'reject',
    'No, that does not fit.'
  );
}

function state(): CampaignState {
  const base = chartedState();
  return {
    ...base,
    journalEntries: [createJournalEntry({ id: 'journal_1', createdAt: T, text: 'Synthetic journal text.', inputMode: 'typed' })],
    insights: [
      ...base.insights,
      { id: 'insight_rejected', title: 'Synthetic rejected insight title', summary: 'Synthetic.', evidenceIds: ['ev_5'], confidence: 'low', status: 'rejected', createdAt: T }
    ],
    reflections: [
      rejectedReflection('reflection_rejected'),
      decideReflection(
        createReflectionRecord({ id: 'reflection_confirmed', sourceKind: 'journal', sourceIds: ['journal_1'], question: 'Q?', interpretation: 'Synthetic confirmed reading.', createdAt: T }),
        'confirm',
        'Yes.'
      )
    ]
  };
}

const reflectionProposal = (interpretationCandidate: string) => reflectionProposalSchema.parse({
  kind: 'reflection', mode: 'reflection', question: 'Synthetic follow-up?', interpretationCandidate, supportingSourceIds: ['journal_1']
});

const snapshotProposal = (claim: string) => snapshotProposalSchema.parse({
  kind: 'snapshot', mode: 'snapshot', asOfDate: '2026-02-02', revisable: true, summary: 'Synthetic dated summary.',
  claims: [{ text: claim, provenanceIds: ['ev_1'] }], uncertainties: ['Synthetic uncertainty.']
});

describe('RF04 rejected interpretation selector', () => {
  it('lists rejected Reflection interpretations and rejected Insights, not confirmed ones', () => {
    expect(selectRejectedInterpretations(state())).toEqual([
      { id: 'insight_rejected', kind: 'insight', text: 'Synthetic rejected insight title' },
      { id: 'reflection_rejected', kind: 'reflection', text: REJECTED_TEXT }
    ]);
  });

  it('excludes retracted rejected Reflections entirely', () => {
    const s = state();
    s.reflections = s.reflections.map((r) => (r.id === 'reflection_rejected' ? retractReflection(r) : r));
    expect(selectRejectedInterpretations(s).map((r) => r.id)).toEqual(['insight_rejected']);
  });

  it('excludes a rejection later marked PRIVATE entirely', () => {
    const s = state();
    s.reflections = s.reflections.map((r) => (r.id === 'reflection_rejected' ? decideReflection(r, 'private', r.response) : r));
    const out = selectRejectedInterpretations(s);
    expect(out.map((r) => r.id)).toEqual(['insight_rejected']);
    expect(JSON.stringify(out)).not.toContain('avoid conflict');
  });

  it('excludes a rejection whose source journal became PRIVATE', () => {
    const s = state();
    s.journalEntries = markJournalEntryPrivate(s.journalEntries, 'journal_1');
    expect(selectRejectedInterpretations(s).map((r) => r.id)).toEqual(['insight_rejected']);
  });

  it('excludes a rejected Insight whose evidence was retracted', () => {
    const s = state();
    s.evidence = s.evidence.map((e) => (e.id === 'ev_5' ? { ...e, status: 'retracted' as const } : e));
    expect(selectRejectedInterpretations(s).map((r) => r.id)).toEqual(['reflection_rejected']);
  });

  it('dedupes repeated rejections of the same normalized text (stable lowest ID)', () => {
    const s = state();
    s.reflections = [...s.reflections, rejectedReflection('reflection_again', '  SYNTHETIC reading — you avoid conflict to keep the peace!! ')];
    const ids = selectRejectedInterpretations(s).map((r) => r.id);
    expect(ids).toEqual(['insight_rejected', 'reflection_again']);
  });
});

describe('RF04 reassertion guard (recurrence)', () => {
  it('flags an exact recurrence of a rejected interpretation in a Reflection proposal', () => {
    const rejected = selectRejectedInterpretations(state());
    expect(proposalReassertsRejected(reflectionProposal(REJECTED_TEXT), rejected)).toBe(true);
  });

  it('flags normalized recurrence (case, punctuation, whitespace)', () => {
    const rejected = selectRejectedInterpretations(state());
    expect(proposalReassertsRejected(reflectionProposal('synthetic READING you avoid conflict, to keep the peace'), rejected)).toBe(true);
  });

  it('flags near-exact recurrence within a small edit distance', () => {
    const rejected = selectRejectedInterpretations(state());
    expect(proposalReassertsRejected(reflectionProposal('Synthetic reading: you avoids conflict to keep the peace.'), rejected)).toBe(true);
  });

  it('flags a Snapshot claim that reasserts a rejected Insight title', () => {
    const rejected = selectRejectedInterpretations(state());
    const matches = findRejectedReassertions(snapshotProposal('Synthetic rejected insight title.'), rejected);
    expect(matches).toEqual([{ rejectedId: 'insight_rejected', proposalText: 'Synthetic rejected insight title.' }]);
  });

  it('does not flag a genuinely different interpretation', () => {
    const rejected = selectRejectedInterpretations(state());
    expect(proposalReassertsRejected(reflectionProposal('Synthetic reading: you enjoy quiet mornings.'), rejected)).toBe(false);
    expect(proposalReassertsRejected(snapshotProposal('Synthetic unrelated claim.'), rejected)).toBe(false);
  });

  it('does not flag a question-only Reflection proposal', () => {
    const proposal = reflectionProposalSchema.parse({ kind: 'reflection', mode: 'reflection', question: REJECTED_TEXT });
    expect(proposalReassertsRejected(proposal, selectRejectedInterpretations(state()))).toBe(false);
  });

  it('once the rejection is retracted the guard no longer suppresses it', () => {
    const s = state();
    s.reflections = s.reflections.map((r) => (r.id === 'reflection_rejected' ? retractReflection(r) : r));
    expect(proposalReassertsRejected(reflectionProposal(REJECTED_TEXT), selectRejectedInterpretations(s))).toBe(false);
  });

  it('short strings require exact normalized match', () => {
    expect(interpretationsMatch('calm', 'calm.')).toBe(true);
    expect(interpretationsMatch('calm', 'palm')).toBe(false);
    expect(interpretationsMatch('', '')).toBe(false);
  });
});
