import { describe, expect, it } from 'vitest';
import { reflectionProposalSchema } from '../../src/cartographer/reflectionProposal';

describe('ReflectionProposal schema (P02)', () => {
  it('accepts a question-only Reflection without forcing an interpretation', () => {
    const parsed = reflectionProposalSchema.parse({
      kind: 'reflection',
      mode: 'reflection',
      question: 'What does that mean to you?'
    });

    expect(parsed.interpretationCandidate).toBeUndefined();
    expect(parsed.supportingSourceIds).toEqual([]);
    expect(parsed.uncertaintyStatement).toBeUndefined();
  });

  it('accepts an interpretation candidate only with explicit supporting source IDs', () => {
    const parsed = reflectionProposalSchema.parse({
      kind: 'reflection',
      mode: 'reflection',
      question: 'Does this fit outside the story?',
      interpretationCandidate: 'You may value direct responsibility.',
      supportingSourceIds: ['observation_1'],
      uncertaintyStatement: 'This is only a possibility until you decide.'
    });

    expect(parsed.supportingSourceIds).toEqual(['observation_1']);
    expect(parsed.uncertaintyStatement).toContain('possibility');
  });

  it('rejects an interpretation candidate with no provenance IDs', () => {
    expect(() => reflectionProposalSchema.parse({
      kind: 'reflection',
      mode: 'reflection',
      question: 'Synthetic question?',
      interpretationCandidate: 'Synthetic interpretation.'
    })).toThrow('requires at least one supporting source ID');
  });

  it('rejects provider attempts to decide the Reflection or confirm Evidence', () => {
    for (const extra of [
      { decision: 'confirm' },
      { epistemicStatus: 'confirmed' },
      { confirmed: true },
      { evidence: [{ claim: 'provider-owned' }] },
      { privacy: 'normal' },
      { recordStatus: 'active' }
    ]) {
      expect(() => reflectionProposalSchema.parse({
        kind: 'reflection',
        mode: 'reflection',
        question: 'Synthetic question?',
        ...extra
      })).toThrow();
    }
  });

  it('rejects progression and mechanics authority fields', () => {
    for (const extra of [
      { xp: 100 },
      { reward: 'bonus' },
      { outcome: 'confirmed' },
      { eligible: true },
      { gameEvent: { type: 'EVIDENCE_ADDED' } }
    ]) {
      expect(() => reflectionProposalSchema.parse({
        kind: 'reflection',
        mode: 'reflection',
        question: 'Synthetic question?',
        ...extra
      })).toThrow();
    }
  });

  it('rejects cross-mode use', () => {
    expect(() => reflectionProposalSchema.parse({
      kind: 'reflection',
      mode: 'journal',
      question: 'Synthetic question?'
    })).toThrow();
  });
});
