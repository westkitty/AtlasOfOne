import type { CombatDefinition } from '../contracts/combat';
import type { ActScenario } from '../combat/act';

/**
 * Local, deterministic encounter bank for the no-provider adventure path.
 * Three shapes from the Appendix-A matrix so the first slice already shows
 * objective + gimmick variety: a nonviolent pacify, a shielded defeat, and an
 * interrupt. Copy is fiction only; nothing here describes the player.
 */
export interface LocalEncounter {
  key: string;
  name: string;
  intro: string;
  enemyName: string;
  allyName?: string;
  objectiveCopy: string;
  build: (encounterId: string) => { definition: CombatDefinition; scenario: ActScenario };
  outcomeCopy: Record<'victory' | 'pacified' | 'escaped' | 'defeat' | 'story', string>;
}

const PLAYER = { id: 'greyson', templateId: 'greyson-combat', team: 'player' as const, maxHp: 100 };

export const LOCAL_ENCOUNTERS: readonly LocalEncounter[] = [
  {
    key: 'lantern-beast',
    name: 'The Frightened Lantern-Beast',
    intro: 'A lantern-beast blocks the path, snapping at the dark. It is scared, not cruel.',
    enemyName: 'Lantern-beast',
    objectiveCopy: 'Calm it (3 steps) — or fight, or step away.',
    build: (encounterId) => ({
      definition: {
        id: `${encounterId}:combat`, encounterId, objective: 'pacify', gimmicks: ['morale-fear'],
        combatants: [PLAYER, { id: 'lantern-beast', templateId: 'lantern-beast', team: 'enemy', maxHp: 48 }],
        rewards: [{ id: 'story', kind: 'story' }], fleeRule: 'always'
      },
      scenario: { options: [
        { id: 'listen', label: 'Listen to what it is afraid of', targetTeam: 'enemy', effect: 'reveal', repeatable: false, observationKey: 'listened-to-lantern-beast' },
        { id: 'lower-light', label: 'Lower your light and speak softly', targetTeam: 'enemy', effect: 'act-progress', repeatable: true, requiresUsed: ['listen'], requiredTargetStatuses: ['pacifiable'] }
      ] }
    }),
    outcomeCopy: {
      pacified: 'The lantern-beast settled and let you pass. Its light follows you a little way.',
      victory: 'The lantern-beast fled into the dark. The path is open.',
      escaped: 'You stepped back and found another way around.',
      defeat: 'You retreated to the sanctuary to catch your breath. The path will still be there.',
      story: 'The story carried you past the lantern-beast.'
    }
  },
  {
    key: 'archive-construct',
    name: 'The Archive Construct',
    intro: 'An armored archive construct grinds awake. Its shield soaks up blunt hits.',
    enemyName: 'Archive construct',
    objectiveCopy: 'Defeat it. Expose its shield for full damage.',
    build: (encounterId) => ({
      definition: {
        id: `${encounterId}:combat`, encounterId, objective: 'defeat', gimmicks: ['shielded'],
        combatants: [PLAYER, { id: 'archive-construct', templateId: 'archive-construct', team: 'enemy', maxHp: 54 }],
        rewards: [{ id: 'story', kind: 'story' }], fleeRule: 'always'
      },
      scenario: { options: [
        { id: 'study-plates', label: 'Study the shield plates', targetTeam: 'enemy', effect: 'reveal', repeatable: false, observationKey: 'studied-archive-construct' }
      ] }
    }),
    outcomeCopy: {
      victory: 'The construct powered down. Its archive drawer slid open.',
      pacified: 'The construct went still.',
      escaped: 'You slipped past while it recalibrated.',
      defeat: 'You retreated to the sanctuary. The construct stays where it is.',
      story: 'The story carried you past the construct.'
    }
  },
  {
    key: 'ritual-engine',
    name: 'The Ritual Engine',
    intro: 'A ritual engine hums and starts to gather a pulse. You can see it coming.',
    enemyName: 'Ritual engine',
    objectiveCopy: 'Interrupt its charged pulse.',
    build: (encounterId) => ({
      definition: {
        id: `${encounterId}:combat`, encounterId, objective: 'interrupt-charged-action', gimmicks: ['charging'],
        combatants: [PLAYER, { id: 'ritual-engine', templateId: 'ritual-engine', team: 'enemy', maxHp: 60 }],
        rewards: [{ id: 'story', kind: 'story' }], fleeRule: 'always'
      },
      scenario: { options: [
        { id: 'read-glyphs', label: 'Read the engine glyphs', targetTeam: 'enemy', effect: 'reveal', repeatable: false, observationKey: 'read-ritual-engine' }
      ] }
    }),
    outcomeCopy: {
      victory: 'The pulse collapsed mid-gather. The engine sputtered out.',
      pacified: 'The engine went quiet.',
      escaped: 'You left the engine humming behind you.',
      defeat: 'The pulse knocked you back to the sanctuary. The engine can be tried again later.',
      story: 'The story carried you past the engine.'
    }
  }
];

/** Stable, order-independent choice: same run id, same encounter, on every device. */
export function localEncounterForRun(runId: string): LocalEncounter {
  let hash = 0;
  for (const char of runId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return LOCAL_ENCOUNTERS[hash % LOCAL_ENCOUNTERS.length];
}

export function localEncounterForDefinition(definition: CombatDefinition): LocalEncounter | undefined {
  const enemyTemplates = definition.combatants.filter((combatant) => combatant.team === 'enemy').map((combatant) => combatant.templateId);
  return LOCAL_ENCOUNTERS.find((encounter) => enemyTemplates.includes(encounter.key));
}
