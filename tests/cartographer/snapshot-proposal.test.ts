import { describe, expect, it } from 'vitest';
import { ProposalProvenanceError } from '../../src/cartographer/proposalErrors';
import {
  parseSnapshotProposalForContext,
  snapshotProposalSchema
} from '../../src/cartographer/snapshotProposal';

const base = {
  kind: 'snapshot',
  mode: 'snapshot',
  asOfDate: '2026-01-15',
  revisable: true,
  summary: 'A synthetic dated view that may change.',
  claims: [{ text: 'Synthetic claim.', provenanceIds: ['obs_1'] }],
  uncertainties: ['Only a few synthetic sources so far.']
};

describe('SnapshotProposal schema (P04)', () => {
  it('accepts a dated revisable Snapshot with uncertainty and default open questions', () => {
    const parsed = snapshotProposalSchema.parse(base);
    expect(parsed.openQuestions).toEqual([]);
    expect(parsed.revisable).toBe(true);
  });

  it('requires every claim to cite provenance', () => {
    expect(() => snapshotProposalSchema.parse({
      ...base,
      claims: [{ text: 'Uncited.', provenanceIds: [] }]
    })).toThrow();
    expect(() => snapshotProposalSchema.parse({
      ...base,
      claims: [{ text: 'Uncited.' }]
    })).toThrow();
  });

  it('requires at least one uncertainty and a date', () => {
    expect(() => snapshotProposalSchema.parse({ ...base, uncertainties: [] })).toThrow();
    const { asOfDate: _omit, ...undated } = base;
    expect(() => snapshotProposalSchema.parse(undated)).toThrow();
    expect(() => snapshotProposalSchema.parse({ ...base, asOfDate: 'last Tuesday' })).toThrow();
  });

  it('rejects non-revisable, finality, eligibility and diagnosis fields', () => {
    for (const extra of [
      { revisable: false },
      { final: true },
      { isFinal: true },
      { finalAssessment: true },
      { complete: true },
      { eligible: true },
      { snapshotEligible: true },
      { diagnosis: 'synthetic' },
      { diagnoses: ['synthetic'] },
      { xp: 5 }
    ]) {
      expect(() => snapshotProposalSchema.parse({ ...base, ...extra })).toThrow();
    }
  });

  it('rejects finality framing in prose', () => {
    expect(() => snapshotProposalSchema.parse({
      ...base,
      summary: 'This is the final assessment.'
    })).toThrow('must not claim finality');
    expect(() => snapshotProposalSchema.parse({
      ...base,
      claims: [{ text: 'You are now fully understood.', provenanceIds: ['obs_1'] }]
    })).toThrow('must not claim finality');
  });

  it('rejects provenance IDs outside the bounded-context allow-list', () => {
    const value = {
      ...base,
      claims: [
        { text: 'A.', provenanceIds: ['obs_1'] },
        { text: 'B.', provenanceIds: ['obs_1', 'obs_invented'] }
      ]
    };
    expect(() => parseSnapshotProposalForContext(value, ['obs_1']))
      .toThrow(ProposalProvenanceError);
    expect(parseSnapshotProposalForContext(value, ['obs_1', 'obs_invented']).claims).toHaveLength(2);
  });

  it('rejects cross-mode use', () => {
    expect(() => snapshotProposalSchema.parse({ ...base, mode: 'journal' })).toThrow();
  });
});
