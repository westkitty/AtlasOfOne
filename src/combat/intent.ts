import type { CombatDefinition, CombatState } from '../contracts/combat';
import { COMBAT_OBJECTIVE_RULES, type CombatIntentKind } from './rules';
import { COMBAT_ENEMY_TUNING, enemyAttackDamage, hasGimmick } from './gimmicks';

export interface EnemyIntent {
  enemyId: string;
  kind: CombatIntentKind;
  targetId?: string;
  damage: number;
  /** True when this attack is the release of a telegraphed charge. */
  release?: boolean;
}

/**
 * C09 deterministic enemy intent. Intent is a pure function of definition and
 * current state: no RNG, no clock, no provider. The same function supplies the
 * visible telegraph during the player phase and the action taken in the enemy
 * phase, so a player response (interrupt, calm, protect) visibly changes it.
 */
export function enemyIntent(definition: CombatDefinition, state: CombatState, enemyId: string): EnemyIntent | undefined {
  const enemyDefinition = definition.combatants.find((combatant) => combatant.id === enemyId && combatant.team === 'enemy');
  const enemy = state.combatants.find((combatant) => combatant.id === enemyId);
  const player = definition.combatants.find((combatant) => combatant.team === 'player');
  if (!enemyDefinition || !enemy || !player || enemy.currentHp <= 0) return undefined;

  if (enemy.statuses.includes('staggered')) return { enemyId, kind: 'recover', damage: 0 };
  if (enemy.statuses.includes('charging')) {
    return { enemyId, kind: 'attack', targetId: player.id, damage: COMBAT_ENEMY_TUNING.chargedReleaseDamage, release: true };
  }
  if (hasGimmick(definition, 'charging')) return { enemyId, kind: 'charge', damage: 0 };

  const progressTarget = COMBAT_OBJECTIVE_RULES[definition.objective].progressTarget;
  if (enemy.statuses.includes('pacifiable') && progressTarget !== undefined && state.objectiveProgress >= progressTarget - 1) {
    return { enemyId, kind: 'defend', damage: 0 };
  }

  if (definition.objective === 'protect-target') {
    const ally = definition.combatants.find((combatant) => combatant.team === 'ally'
      && (state.combatants.find((entry) => entry.id === combatant.id)?.currentHp ?? 0) > 0);
    if (ally) return { enemyId, kind: 'objective-action', targetId: ally.id, damage: enemyAttackDamage(definition) };
  }

  return { enemyId, kind: 'attack', targetId: player.id, damage: enemyAttackDamage(definition) };
}

/** Visible telegraphs for every living enemy, in definition order. */
export function enemyIntents(definition: CombatDefinition, state: CombatState): EnemyIntent[] {
  return definition.combatants
    .filter((combatant) => combatant.team === 'enemy')
    .map((combatant) => enemyIntent(definition, state, combatant.id))
    .filter((intent): intent is EnemyIntent => intent !== undefined);
}
