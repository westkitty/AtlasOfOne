import { describe, expect, it } from 'vitest';
import {
  ATLAS_PROVIDER_MODES,
  MODEL_PROPOSAL_KINDS,
  atlasProviderModeSchema,
  modelProposalRoutingSchema,
  routeModelProposalKind
} from '../../src/cartographer/proposals';
import { cartographerTurnSchema } from '../../src/cartographer/schema';

describe('v2 provider proposal routing contract (P00)', () => {
  it('freezes all nine explicit request modes from D05', () => {
    expect(ATLAS_PROVIDER_MODES).toEqual([
      'journal',
      'reflection',
      'adventure',
      'world-interaction',
      'combat',
      'boss-synthesis',
      'mystery-door',
      'snapshot',
      'pure-fun'
    ]);

    for (const mode of ATLAS_PROVIDER_MODES) {
      expect(atlasProviderModeSchema.parse(mode)).toBe(mode);
    }
    expect(() => atlasProviderModeSchema.parse('guess-the-mode')).toThrow();
  });

  it('freezes the five section-23 proposal families behind a kind discriminator', () => {
    expect(MODEL_PROPOSAL_KINDS).toEqual([
      'journal',
      'reflection',
      'adventure-scene',
      'encounter-flavor',
      'snapshot'
    ]);

    for (const kind of MODEL_PROPOSAL_KINDS) {
      expect(routeModelProposalKind({ kind, futureField: 'unvalidated-by-P00' })).toBe(kind);
    }
  });

  it('rejects missing or unknown proposal kinds before mode-specific validation', () => {
    expect(() => routeModelProposalKind({ response: 'no discriminator' })).toThrow();
    expect(() => routeModelProposalKind({ kind: 'cartographer-turn' })).toThrow();
    expect(() => routeModelProposalKind(null)).toThrow();
  });

  it('does not confuse request mode with response proposal kind', () => {
    expect(atlasProviderModeSchema.parse('combat')).toBe('combat');
    expect(() => routeModelProposalKind({ kind: 'combat' })).toThrow();

    expect(routeModelProposalKind({ kind: 'encounter-flavor' })).toBe('encounter-flavor');
    expect(() => atlasProviderModeSchema.parse('encounter-flavor')).toThrow();
  });

  it('separates the new proposal target from the legacy universal CartographerTurn shape', () => {
    const legacy = cartographerTurnSchema.parse({
      reply: 'Legacy reply.',
      nextQuestion: 'Legacy question?',
      presentation: 'normal',
      evidence: [],
      connections: [],
      quoteCandidates: [],
      summaryPatch: '',
      achievementCandidates: []
    });

    expect(() => modelProposalRoutingSchema.parse(legacy)).toThrow();
  });

  it('routes only; P00 deliberately does not validate future payload fields', () => {
    const raw = {
      kind: 'journal',
      response: 'Future P01 field.',
      arbitraryFutureField: { still: 'untrusted' }
    };

    const routed = modelProposalRoutingSchema.parse(raw);
    expect(routed.kind).toBe('journal');
    expect(routed.response).toBe('Future P01 field.');
    expect(routed.arbitraryFutureField).toEqual({ still: 'untrusted' });
  });
});
