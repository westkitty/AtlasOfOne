import { describe, expect, it } from 'vitest';
import {
  atlasProviderModeSchema,
  modelProposalEnvelopeSchema,
  proposalContainsForbiddenAuthority
} from '../../src/cartographer/proposals';

describe('v2 provider proposal envelope (P00)', () => {
  it('freezes all nine explicit provider modes', () => {
    expect(atlasProviderModeSchema.options).toEqual([
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
  });

  it.each([
    [{ kind: 'journal', mode: 'journal' }],
    [{ kind: 'reflection', mode: 'reflection' }],
    [{ kind: 'adventure-scene', mode: 'adventure' }],
    [{ kind: 'adventure-scene', mode: 'world-interaction' }],
    [{ kind: 'adventure-scene', mode: 'pure-fun' }],
    [{ kind: 'encounter-flavor', mode: 'combat' }],
    [{ kind: 'encounter-flavor', mode: 'boss-synthesis' }],
    [{ kind: 'encounter-flavor', mode: 'mystery-door' }],
    [{ kind: 'snapshot', mode: 'snapshot' }]
  ])('accepts one valid strict mode/family envelope %#', (value) => {
    expect(modelProposalEnvelopeSchema.parse(value)).toEqual(value);
  });

  it.each([
    { kind: 'journal', mode: 'combat' },
    { kind: 'reflection', mode: 'journal' },
    { kind: 'adventure-scene', mode: 'snapshot' },
    { kind: 'encounter-flavor', mode: 'adventure' },
    { kind: 'snapshot', mode: 'boss-synthesis' }
  ])('rejects cross-mode proposal authority: %#', (value) => {
    expect(() => modelProposalEnvelopeSchema.parse(value)).toThrow();
  });

  it.each([
    { kind: 'combat', mode: 'combat' },
    { kind: 'final-assessment', mode: 'snapshot' },
    { kind: 'unknown', mode: 'journal' }
  ])('rejects unknown proposal families: %#', (value) => {
    expect(() => modelProposalEnvelopeSchema.parse(value)).toThrow();
  });

  it('rejects mechanics/progression fields at the strict P00 boundary', () => {
    for (const forbidden of [
      { xp: 500 },
      { damage: 999 },
      { outcome: 'victory' },
      { objective: 'pacify' },
      { statuses: ['pacifiable'] },
      { intent: 'attack' },
      { turnOrder: ['enemy', 'player'] },
      { techniqueCharges: 99 },
      { rewards: ['loot'] },
      { gameEvent: { type: 'LEVEL_UP' } },
      { snapshotEligible: true }
    ]) {
      expect(() => modelProposalEnvelopeSchema.parse({
        kind: 'encounter-flavor',
        mode: 'combat',
        ...forbidden
      })).toThrow();
    }
  });

  it('provides a recursive exact-key authority guard for future content schemas', () => {
    expect(proposalContainsForbiddenAuthority({
      kind: 'journal',
      acknowledgement: 'Synthetic safe wording.',
      suggestions: [{ label: 'safe' }]
    })).toBe(false);

    expect(proposalContainsForbiddenAuthority({
      kind: 'adventure-scene',
      scene: { narration: 'Synthetic.', outcome: 'victory' }
    })).toBe(true);

    expect(proposalContainsForbiddenAuthority({
      kind: 'reflection',
      nested: [{ mechanics: { hp: 100 } }]
    })).toBe(true);
  });

  it('does not confuse ordinary prose values with authority keys', () => {
    expect(proposalContainsForbiddenAuthority({
      narration: 'The reward was knowing where the trail went.',
      dialogue: 'My HP is none of your business.'
    })).toBe(false);
  });
});
