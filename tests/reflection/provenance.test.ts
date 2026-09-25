import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import { createJournalEntry } from '../../src/journal/domain';
import { createReflectionRecord, decideReflection, retractReflection } from '../../src/reflection/domain';
import { buildReflectionProvenanceDelta } from '../../src/reflection/provenance';
import type { CampaignState } from '../../src/game/types';

function journalState() {
  const initial = createInitialCampaign();
  const journal = createJournalEntry({
    id: 'journal_provenance_fixture',
    createdAt: '2026-01-02T03:00:00.000Z',
    text: 'Synthetic source.',
    inputMode: 'typed'
  });
  const reflection = createReflectionRecord({
    id: 'reflection_provenance_fixture',
    sourceKind: 'journal',
    sourceIds: [journal.id],
    question: 'Synthetic question?',
    interpretation: 'I always choose the risky option.',
    createdAt: '2026-01-02T03:04:05.000Z'
  });
  return {
    state: { ...initial, journalEntries: [journal], reflections: [reflection] } as CampaignState,
    reflection
  };
}

describe('Reflection partial/revision provenance (RF05)', () => {
  it('preserves the original interpretation beside Greyson\'s narrower PARTIAL wording', () => {
    const { state, reflection } = journalState();
    const partial = decideReflection(
      reflection,
      'partial',
      'Sometimes, when I know the downside is limited.'
    );
    state.reflections = [partial];

    expect(buildReflectionProvenanceDelta(state, partial.id)).toEqual({
      kind: 'partial',
      reflectionId: 'reflection_provenance_fixture',
      sourceKind: 'journal',
      sourceIds: ['journal_provenance_fixture'],
      acceptedClaim: 'Sometimes, when I know the downside is limited.',
      originalInterpretation: 'I always choose the risky option.',
      createdAt: '2026-01-02T03:04:05.000Z'
    });

    // RF05 creates proposal data; the historical Reflection itself is unchanged.
    expect(state.reflections[0].interpretation).toBe('I always choose the risky option.');
  });

  it('does not promote the full interpretation for PARTIAL when Greyson supplied narrower text', () => {
    const { state, reflection } = journalState();
    const partial = decideReflection(reflection, 'partial', 'Only in specific situations.');
    state.reflections = [partial];

    const delta = buildReflectionProvenanceDelta(state, partial.id);
    expect(delta?.kind).toBe('partial');
    if (delta?.kind !== 'partial') throw new Error('Expected partial delta.');

    expect(delta.acceptedClaim).toBe('Only in specific situations.');
    expect(delta.acceptedClaim).not.toBe(reflection.interpretation);
  });

  it('keeps revision replacement text and prior source lineage together without overwriting history', () => {
    const { state, reflection } = journalState();
    const revised = decideReflection(
      reflection,
      'revise',
      'I usually avoid risk unless somebody else needs me to act.'
    );
    state.reflections = [revised];

    expect(buildReflectionProvenanceDelta(state, revised.id)).toEqual({
      kind: 'revision',
      reflectionId: 'reflection_provenance_fixture',
      sourceKind: 'journal',
      sourceIds: ['journal_provenance_fixture'],
      replacementClaim: 'I usually avoid risk unless somebody else needs me to act.',
      priorSourceIds: ['journal_provenance_fixture'],
      originalInterpretation: 'I always choose the risky option.',
      createdAt: '2026-01-02T03:04:05.000Z'
    });

    expect(state.reflections[0].interpretation).toBe('I always choose the risky option.');
    expect(state.reflections[0].response).toBe(
      'I usually avoid risk unless somebody else needs me to act.'
    );
  });

  it('emits no provenance delta for Confirm, Reject, Uncertain, Private or pending state', () => {
    for (const decision of ['confirm', 'reject', 'uncertain', 'private'] as const) {
      const { state, reflection } = journalState();
      state.reflections = [decideReflection(reflection, decision, 'Synthetic response.')];
      expect(buildReflectionProvenanceDelta(state, reflection.id)).toBeNull();
    }

    const { state, reflection } = journalState();
    expect(buildReflectionProvenanceDelta(state, reflection.id)).toBeNull();
  });

  it('fails closed when the Reflection or its source becomes private/retracted', () => {
    const first = journalState();
    const partial = decideReflection(first.reflection, 'partial', 'Some of it.');
    first.state.reflections = [partial];
    first.state.journalEntries = first.state.journalEntries.map((entry) => ({
      ...entry,
      privacy: 'private' as const
    }));
    expect(buildReflectionProvenanceDelta(first.state, partial.id)).toBeNull();

    const second = journalState();
    const revised = decideReflection(second.reflection, 'revise', 'Replacement.');
    second.state.reflections = [retractReflection(revised)];
    expect(buildReflectionProvenanceDelta(second.state, revised.id)).toBeNull();
  });

  it('requires real response text for revision provenance', () => {
    const { state, reflection } = journalState();
    state.reflections = [{
      ...reflection,
      decision: 'revise',
      epistemicStatus: 'pending',
      response: '   '
    }];

    expect(buildReflectionProvenanceDelta(state, reflection.id)).toBeNull();
  });

  it('copies provenance arrays so consumers cannot mutate stored Reflection history through the delta', () => {
    const { state, reflection } = journalState();
    state.reflections = [decideReflection(reflection, 'revise', 'Replacement.')];

    const delta = buildReflectionProvenanceDelta(state, reflection.id);
    expect(delta?.kind).toBe('revision');
    if (delta?.kind !== 'revision') throw new Error('Expected revision delta.');

    delta.sourceIds.push('mutated');
    delta.priorSourceIds.push('mutated-again');

    expect(state.reflections[0].sourceIds).toEqual(['journal_provenance_fixture']);
  });
});
