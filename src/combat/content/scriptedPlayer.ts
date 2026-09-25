import { hasStatus } from '../statuses';
import type { CombatPlayerIntent, ScriptedPlayer } from '../runner';
import type { CombatDefinition, CombatState, CombatTechniqueDefinition } from '../types';

function player(state: CombatState) {
  return state.combatants.find((combatant) => combatant.side === 'player')!;
}

export function techniqueUsable(state: CombatState, technique: CombatTechniqueDefinition): boolean {
  return (state.techniqueReadyRound[technique.id] ?? 1) <= state.round
    && player(state).techniqueCharges >= technique.chargeCost;
}

function usableTechnique(
  definition: CombatDefinition,
  state: CombatState,
  job: CombatTechniqueDefinition['job']
) {
  return (definition.techniques ?? []).find(
    (technique) => technique.job === job && techniqueUsable(state, technique)
  );
}

/**
 * CT04/C15/C16 simple scripted player. It never supplies timed inputs, so
 * every simulated win is also proof that timing is optional (C14).
 */
export const simpleScriptedPlayer: ScriptedPlayer = (definition, state): CombatPlayerIntent => {
  const livingEnemies = state.combatants.filter(
    (combatant) => combatant.side === 'enemy' && combatant.hp > 0
  );
  switch (definition.objective) {
    case 'pacify': {
      const act = (definition.actOptions ?? []).find(
        (item) => item.job === 'pacify-progress' && !state.completedActIds.includes(item.id)
      );
      return act ? { verb: 'act', actId: act.id } : { verb: 'guard' };
    }
    case 'interrupt': {
      const charging = livingEnemies.find((enemy) => hasStatus(state, 'charging', enemy.id));
      if (charging) {
        const technique = usableTechnique(definition, state, 'interrupt-charge');
        if (technique) return { verb: 'technique', techniqueId: technique.id, targetId: charging.id };
        const act = (definition.actOptions ?? []).find(
          (item) => item.job === 'interrupt'
            && item.targetId === charging.id
            && !state.completedActIds.includes(item.id)
        );
        if (act) return { verb: 'act', actId: act.id };
      }
      return { verb: 'guard' };
    }
    case 'protect': {
      const ally = state.combatants.find((combatant) => combatant.side === 'ally' && combatant.hp > 0);
      const technique = usableTechnique(definition, state, 'protect-ally');
      if (ally && technique) return { verb: 'technique', techniqueId: technique.id, targetId: ally.id };
      return { verb: 'guard' };
    }
    case 'survive':
      return { verb: 'guard' };
    default: {
      const target = [...livingEnemies].sort((a, b) => a.hp - b.hp)[0];
      if (definition.gimmicks.includes('shielded') && !hasStatus(state, 'exposed', target.id)) {
        const technique = usableTechnique(definition, state, 'expose-shield');
        if (technique) return { verb: 'technique', techniqueId: technique.id, targetId: target.id };
      }
      return { verb: 'attack', targetId: target.id };
    }
  }
};

/**
 * C17 cautious scripted player: GUARDs whenever a heavy blow (a charged
 * release) is telegraphed at the player and the simple plan would merely
 * ATTACK; otherwise it plays like simpleScriptedPlayer. Metrics-only.
 */
export const cautiousScriptedPlayer: ScriptedPlayer = (definition, state): CombatPlayerIntent => {
  const intent = simpleScriptedPlayer(definition, state);
  const playerId = player(state).id;
  const heavyIncoming = (state.telegraphedIntents ?? []).some(
    (plan) => plan.targetId === playerId && plan.telegraphKey === 'charged-release'
  );
  return heavyIncoming && intent.verb === 'attack' ? { verb: 'guard' } : intent;
};
