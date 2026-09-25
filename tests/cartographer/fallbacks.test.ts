import { describe, expect, it } from 'vitest';
import {
  JOURNAL_ACKNOWLEDGEMENT_BANK,
  localJournalAcknowledgement
} from '../../src/cartographer/fallbacks/journalAcknowledgement';
import {
  REFLECTION_QUESTION_BANK,
  localReflectionWording
} from '../../src/cartographer/fallbacks/reflectionWording';
import { journalProposalSchema } from '../../src/cartographer/journalProposal';
import { reflectionProposalSchema } from '../../src/cartographer/reflectionProposal';

const seeds = ['entry_1', 'entry_2', 'entry_abc', '', 'x'.repeat(500)];

describe('local journal acknowledgement fallback (P08)', () => {
  it('is deterministic for a given seed', () => {
    for (const seed of seeds) {
      expect(localJournalAcknowledgement(seed)).toEqual(localJournalAcknowledgement(seed));
    }
  });

  it('validates against JournalProposal with no follow-up, evidence or gaps', () => {
    for (const seed of seeds) {
      const p = localJournalAcknowledgement(seed);
      expect(journalProposalSchema.parse(p)).toEqual(p);
      expect(p.optionalFollowUp).toBeUndefined();
      expect(p.evidence).toEqual([]);
      expect(p.possibleGapCandidates).toEqual([]);
    }
  });

  it('is never interrogative', () => {
    for (const line of JOURNAL_ACKNOWLEDGEMENT_BANK) expect(line).not.toContain('?');
  });

  it('cannot echo private content: seed text never appears in output', () => {
    const secret = 'SYNTHETIC_PRIVATE_MARKER_42';
    const out = JSON.stringify(localJournalAcknowledgement(secret));
    expect(out).not.toContain(secret);
    expect(localJournalAcknowledgement.length).toBe(1);
  });

  it('spreads across the bank', () => {
    const responses = new Set(
      Array.from({ length: 50 }, (_, i) => localJournalAcknowledgement(`entry_${i}`).response)
    );
    expect(responses.size).toBeGreaterThan(1);
  });
});

describe('local reflection wording fallback (P09)', () => {
  it('is deterministic and validates against ReflectionProposal', () => {
    for (const seed of seeds) {
      const p = localReflectionWording(seed);
      expect(p).toEqual(localReflectionWording(seed));
      expect(reflectionProposalSchema.parse(p)).toEqual(p);
    }
  });

  it('is question-only with no interpretation and no provenance claims', () => {
    for (const seed of seeds) {
      const p = localReflectionWording(seed);
      expect(p.interpretationCandidate).toBeUndefined();
      expect(p.supportingSourceIds).toEqual([]);
      expect(p.question.endsWith('?')).toBe(true);
    }
    for (const q of REFLECTION_QUESTION_BANK) expect(q.endsWith('?')).toBe(true);
  });

  it('never includes the seed text', () => {
    const secret = 'SYNTHETIC_PRIVATE_MARKER_43';
    expect(JSON.stringify(localReflectionWording(secret))).not.toContain(secret);
  });
});
