import type { CombatDefinition, CombatOutcome, CombatState } from '../contracts/combat';
import { COMBAT_OBJECTIVE_RULES } from './rules';

export type ObjectiveCheckpoint = 'after-action' | 'round-end';

const alive = (state: CombatState, id: string) => (state.combatants.find((combatant) => combatant.id === id)?.currentHp ?? 0) > 0;

/**
 * C07 objective evaluation for the five MVP objectives. Read-only: it proposes
 * an outcome; only the session applies it, through the C01 reducer. Player
 * defeat is reported as `defeat` and routed through C06 fail-forward.
 *
 * Order matters and is fixed: player down > protected ally down > objective
 * success > all enemies down > turn limit.
 */
export function evaluateObjective(
  definition: CombatDefinition,
  state: CombatState,
  checkpoint: ObjectiveCheckpoint
): CombatOutcome | undefined {
  if (state.phase === 'resolved') return undefined;
  const player = definition.combatants.find((combatant) => combatant.team === 'player');
  if (!player || !alive(state, player.id)) return 'defeat';

  const allies = definition.combatants.filter((combatant) => combatant.team === 'ally');
  if (definition.objective === 'protect-target' && allies.some((ally) => !alive(state, ally.id))) return 'defeat';

  const target = COMBAT_OBJECTIVE_RULES[definition.objective].progressTarget;
  if (definition.objective === 'pacify' && target !== undefined && state.objectiveProgress >= target) return 'pacified';
  if (definition.objective === 'interrupt-charged-action' && state.objectiveProgress >= 1) return 'victory';

  const enemies = definition.combatants.filter((combatant) => combatant.team === 'enemy');
  if (enemies.every((enemy) => !alive(state, enemy.id))) return 'victory';

  if (checkpoint === 'round-end' && definition.turnLimit !== undefined
    && (definition.objective === 'survive-turns' || definition.objective === 'protect-target')
    && state.round > definition.turnLimit) {
    return 'victory';
  }
  return undefined;
}
