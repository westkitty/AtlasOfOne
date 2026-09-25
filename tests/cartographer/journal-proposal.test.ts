import { describe, expect, it } from 'vitest';
import { journalProposalSchema } from '../../src/cartographer/journalProposal';

describe('JournalProposal schema (P01)', () => {
  it('accepts a pure acknowledgement with no follow-up question', () => {
    const parsed = journalProposalSchema.parse({
      kind: 'journal',
      mode: 'journal',
      response: 'That makes sense. I can leave it there.'
    });

    expect(parsed.optionalFollowUp).toBeUndefined();
    expect(parsed.evidence).toEqual([]);
    expect(parsed.possibleGapCandidates).toEqual([]);
    expect(parsed.exploreLaterSuggestion).toBeUndefined();
  });

  it('allows one optional follow-up without making it mandatory', () => {
    const parsed = journalProposalSchema.parse({
      kind: 'journal',
      mode: 'journal',
      response: 'I noticed a theme there.',
      optionalFollowUp: 'Want to say more about that?'
    });

    expect(parsed.optionalFollowUp).toBe('Want to say more about that?');
  });

  it('accepts bounded evidence and gap candidates without durable authority fields', () => {
    const parsed = journalProposalSchema.parse({
      kind: 'journal',
      mode: 'journal',
      response: 'There may be something worth revisiting later.',
      evidence: [{
        dimension: 'values-autonomy',
        claim: 'Synthetic candidate claim.',
        basis: 'inference',
        strength: 1,
        territories: ['values']
      }],
      possibleGapCandidates: [{
        kind: 'underexplored',
        summary: 'Synthetic underexplored candidate.',
        territoryIds: ['values'],
        dimensionIds: ['autonomy']
      }],
      exploreLaterSuggestion: {
        label: 'Explore this later',
        gapCandidateIndex: 0
      }
    });

    expect(parsed.evidence).toHaveLength(1);
    expect(parsed.possibleGapCandidates).toHaveLength(1);
    expect(parsed.exploreLaterSuggestion?.gapCandidateIndex).toBe(0);
  });

  it('refuses an explore-later suggestion that does not reference a candidate', () => {
    expect(() => journalProposalSchema.parse({
      kind: 'journal',
      mode: 'journal',
      response: 'Synthetic response.',
      exploreLaterSuggestion: {
        label: 'Explore this later',
        gapCandidateIndex: 0
      }
    })).toThrow('must reference an existing gap candidate');
  });

  it('rejects questionnaire-era nextQuestion and deterministic authority fields', () => {
    for (const extra of [
      { nextQuestion: 'This must not become mandatory.' },
      { xp: 100 },
      { reward: 'bonus' },
      { eligible: true },
      { gameEvent: { type: 'LEVEL_UP' } }
    ]) {
      expect(() => journalProposalSchema.parse({
        kind: 'journal',
        mode: 'journal',
        response: 'Synthetic response.',
        ...extra
      })).toThrow();
    }
  });

  it('rejects durable KnowledgeGap fields supplied by the provider', () => {
    for (const extra of [
      { priority: 99 },
      { status: 'open' },
      { sourceEvidenceIds: ['ev_1'] },
      { sourceJournalEntryIds: ['journal_1'] },
      { learningTarget: 'reflection-eligible' }
    ]) {
      expect(() => journalProposalSchema.parse({
        kind: 'journal',
        mode: 'journal',
        response: 'Synthetic response.',
        possibleGapCandidates: [{
          kind: 'curiosity',
          summary: 'Synthetic candidate.',
          territoryIds: ['identity'],
          dimensionIds: ['self-description'],
          ...extra
        }]
      })).toThrow();
    }
  });

  it('rejects mechanics authority hidden inside an evidence candidate', () => {
    expect(() => journalProposalSchema.parse({
      kind: 'journal',
      mode: 'journal',
      response: 'Synthetic response.',
      evidence: [{
        dimension: 'identity-self-description',
        claim: 'Synthetic claim.',
        basis: 'explicit',
        strength: 2,
        territories: ['identity'],
        reward: 500
      }]
    })).toThrow();
  });

  it('keeps model gap suggestions as candidate content rather than AdventureSeed objects', () => {
    const parsed = journalProposalSchema.parse({
      kind: 'journal',
      mode: 'journal',
      response: 'Synthetic response.',
      possibleGapCandidates: [{
        kind: 'curiosity',
        summary: 'Synthetic curiosity.',
        territoryIds: ['identity'],
        dimensionIds: ['self-description']
      }]
    });

    expect(parsed.possibleGapCandidates[0]).not.toHaveProperty('id');
    expect(parsed.possibleGapCandidates[0]).not.toHaveProperty('priority');
    expect(parsed.possibleGapCandidates[0]).not.toHaveProperty('status');
    expect(parsed.possibleGapCandidates[0]).not.toHaveProperty('sourceJournalEntryIds');
  });
});
