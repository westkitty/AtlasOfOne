import { DEFAULT_COMBAT_HP } from '../../src/combat/engine';
import type { CombatDefinition, CombatObjective } from '../../src/combat/types';

/** Synthetic-only encounter fixtures for C07-C12. No personal content. */
export function objectiveFixture(
  objective: CombatObjective,
  overrides: Partial<CombatDefinition> = {}
): CombatDefinition {
  const base: CombatDefinition = {
    id: `combat_${objective}_fixture`,
    encounterId: `encounter_${objective}_fixture`,
    objective,
    gimmicks: [],
    combatants: [
      { id: 'greyson', label: 'Greyson', side: 'player', maxHp: DEFAULT_COMBAT_HP },
      { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 54 }
    ],
    rewards: [{ id: 'fixed_xp', kind: 'xp', amount: 10 }],
    fleeRule: 'always'
  };

  switch (objective) {
    case 'survive':
      base.turnLimit = 3;
      break;
    case 'protect':
      base.turnLimit = 3;
      base.combatants = [
        ...base.combatants,
        { id: 'ally_1', label: 'Synthetic Ally', side: 'ally', maxHp: 30 }
      ];
      base.techniques = [
        { id: 'cover', label: 'Cover', job: 'protect-ally', chargeCost: 1, cooldownRounds: 0 }
      ];
      break;
    case 'interrupt':
      base.gimmicks = ['charging'];
      base.techniques = [
        { id: 'break_focus', label: 'Break Focus', job: 'interrupt-charge', chargeCost: 1, cooldownRounds: 0 }
      ];
      break;
    case 'pacify':
      base.gimmicks = ['non-kill-target'];
      base.actOptions = [
        {
          id: 'calm_foe',
          label: 'Speak calmly',
          job: 'pacify-progress',
          targetKind: 'enemy',
          targetId: 'enemy_1',
          requiredSteps: 2
        }
      ];
      break;
    default:
      break;
  }

  return { ...base, ...overrides };
}
