import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { createJournalEntry } from '../../src/journal/domain';
import { detectChangeOverTimeCandidate } from '../../src/reflection/change';
import { createReflectionRecord, decideReflection, retractReflection } from '../../src/reflection/domain';

function fixtureState(interpretation: string | null = 'I always avoid risk.') {
  const initial = createInitialCampaign();
  const journal = createJournalEntry({
    id: 'journal_change_fixture',
    createdAt: '2026-01-02T03:00:00.000Z',
    text: 'Synthetic source.',
    inputMode: 'typed'
  });
  const reflection = createReflectionRecord({
    id: 'reflection_change_fixture',
    sourceKind: 'journal',
    sourceIds: [journal.id],
    question: 'Synthetic reflection?',
    ...(interpretation === null ? {} : { interpretation }),
    createdAt: '2026-01-03T04:05:06.000Z'
  });

  return {
    state: {
      ...initial,
      journalEntries: [journal],
      reflections: [reflection]
    } as CampaignState,
    reflection
  };
}

describe('changed-mind/change-over-time candidate detection (RF07)', () => {
  it('emits one candidate only from an explicit eligible REVISE decision with old/new wording', () => {
    const { state, reflection } = fixtureState();
    state.reflections = [decideReflection(
      reflection,
      'revise',
      'I avoid unnecessary risk, but I will take it when someone needs me.'
    )];

    expect(detectChangeOverTimeCandidate(state, reflection.id)).toEqual({
      kind: 'revision-review',
      reflectionId: 'reflection_change_fixture',
      sourceKind: 'journal',
      sourceIds: ['journal_change_fixture'],
      priorInterpretation: 'I always avoid risk.',
      priorAuthority: 'atlas-interpretation',
      replacementClaim: 'I avoid unnecessary risk, but I will take it when someone needs me.',
      replacementAuthority: 'greyson-revision',
      reflectionCreatedAt: '2026-01-03T04:05:06.000Z',
      requiresChangeConfirmation: true
    });
  });

  it('never relabels Atlas\'s prior interpretation as Greyson\'s prior belief', () => {
    const { state, reflection } = fixtureState('Atlas once guessed this.');
    state.reflections = [decideReflection(reflection, 'revise', 'Greyson replaces it.')];

    const candidate = detectChangeOverTimeCandidate(state, reflection.id);
    expect(candidate).toMatchObject({
      priorInterpretation: 'Atlas once guessed this.',
      priorAuthority: 'atlas-interpretation',
      replacementClaim: 'Greyson replaces it.',
      replacementAuthority: 'greyson-revision',
      requiresChangeConfirmation: true
    });
    expect(candidate).not.toHaveProperty('priorClaim');
    expect(candidate).not.toHaveProperty('changedAt');
  });

  it('does not infer change from Confirm, Partial, Reject, Uncertain, Private, or pending state', () => {
    for (const decision of ['confirm', 'partial', 'reject', 'uncertain', 'private'] as const) {
      const { state, reflection } = fixtureState();
      state.reflections = [decideReflection(reflection, decision, 'Synthetic response.')];
      expect(detectChangeOverTimeCandidate(state, reflection.id)).toBeNull();
    }

    const { state, reflection } = fixtureState();
    expect(detectChangeOverTimeCandidate(state, reflection.id)).toBeNull();
  });

  it('fails closed when the old interpretation was never preserved', () => {
    const { state, reflection } = fixtureState(null);
    state.reflections = [decideReflection(reflection, 'revise', 'Replacement wording.')];

    expect(detectChangeOverTimeCandidate(state, reflection.id)).toBeNull();
  });

  it('suppresses a no-op revision without pretending to perform semantic analysis', () => {
    const { state, reflection } = fixtureState('I usually choose carefully.');
    state.reflections = [decideReflection(
      reflection,
      'revise',
      '  i   USUALLY choose carefully.  '
    )];

    expect(detectChangeOverTimeCandidate(state, reflection.id)).toBeNull();
  });

  it('fails closed after source privacy or Reflection retraction', () => {
    const first = fixtureState();
    first.state.reflections = [decideReflection(first.reflection, 'revise', 'Replacement.')];
    first.state.journalEntries = first.state.journalEntries.map((entry) => ({
      ...entry,
      privacy: 'private' as const
    }));
    expect(detectChangeOverTimeCandidate(first.state, first.reflection.id)).toBeNull();

    const second = fixtureState();
    const revised = decideReflection(second.reflection, 'revise', 'Replacement.');
    second.state.reflections = [retractReflection(revised)];
    expect(detectChangeOverTimeCandidate(second.state, second.reflection.id)).toBeNull();
  });

  it('returns copied provenance arrays so candidate consumers cannot mutate Reflection history', () => {
    const { state, reflection } = fixtureState();
    state.reflections = [decideReflection(reflection, 'revise', 'Replacement.')];

    const candidate = detectChangeOverTimeCandidate(state, reflection.id);
    expect(candidate).not.toBeNull();
    candidate!.sourceIds.push('mutated');

    expect(state.reflections[0].sourceIds).toEqual(['journal_change_fixture']);
  });
});
