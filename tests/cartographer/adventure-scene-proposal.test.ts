import { describe, expect, it } from 'vitest';
import {
  adventureSceneProposalSchema,
  parseAdventureSceneProposalForContext
} from '../../src/cartographer/adventureSceneProposal';
import { ProposalProvenanceError } from '../../src/cartographer/proposalErrors';

const base = {
  kind: 'adventure-scene',
  mode: 'adventure',
  sceneProse: 'Synthetic fog rolls over a synthetic bridge.'
} as const;

const allowed = {
  entityIds: ['entity_bridge'],
  npcIds: ['npc_ferryman'],
  memoryIds: ['memory_synthetic_1']
};

describe('AdventureSceneProposal schema (P03)', () => {
  it('accepts prose-only scenes and defaults collections', () => {
    const parsed = adventureSceneProposalSchema.parse(base);
    expect(parsed.dialogue).toEqual([]);
    expect(parsed.choices).toEqual([]);
    expect(parsed.continuationCandidate).toBeUndefined();
  });

  it('accepts dialogue, continuation, choices and allowed references', () => {
    const parsed = parseAdventureSceneProposalForContext({
      ...base,
      mode: 'world-interaction',
      dialogue: [{ speakerNpcId: 'npc_ferryman', line: 'Synthetic greeting.' }],
      continuationCandidate: 'The ferryman gestures toward the far bank.',
      choices: [{ label: 'Cross' }, { label: 'Wait' }],
      referencedEntityIds: ['entity_bridge'],
      referencedNpcIds: ['npc_ferryman'],
      referencedMemoryIds: ['memory_synthetic_1']
    }, allowed);
    expect(parsed.choices).toHaveLength(2);
  });

  it('rejects HP/damage/outcome/reward/XP/objective/world-flag authority', () => {
    for (const extra of [
      { hp: 3 },
      { damage: 5 },
      { outcome: 'victory' },
      { reward: 'gold' },
      { xp: 10 },
      { objectiveProgress: 1 },
      { worldFlags: { bridgeOpen: true } },
      { gameEvent: { type: 'X' } }
    ]) {
      expect(() => adventureSceneProposalSchema.parse({ ...base, ...extra })).toThrow();
    }
  });

  it('rejects authority smuggled inside nested choice objects', () => {
    expect(() => adventureSceneProposalSchema.parse({
      ...base,
      choices: [{ label: 'Attack', damage: 9 }]
    })).toThrow();
  });

  it('rejects references outside caller-supplied IDs, including dialogue speakers', () => {
    const cases = [
      { referencedEntityIds: ['entity_invented'] },
      { referencedNpcIds: ['npc_invented'] },
      { referencedMemoryIds: ['memory_invented'] },
      { dialogue: [{ speakerNpcId: 'npc_invented', line: 'Hi.' }] }
    ];
    for (const extra of cases) {
      expect(() => parseAdventureSceneProposalForContext({ ...base, ...extra }, allowed))
        .toThrow(ProposalProvenanceError);
    }
  });

  it('does not let an NPC ID stand in for an entity or memory ID', () => {
    expect(() => parseAdventureSceneProposalForContext({
      ...base,
      referencedMemoryIds: ['npc_ferryman']
    }, allowed)).toThrow('outside bounded context: npc_ferryman');
  });

  it('rejects cross-mode use', () => {
    expect(() => adventureSceneProposalSchema.parse({ ...base, mode: 'combat' })).toThrow();
  });
});
