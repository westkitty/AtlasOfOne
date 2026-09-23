import type {
  CombatDefinition,
  CombatLifecycleEvent,
  CombatState,
  CombatantDefinition,
  CombatantState,
  FixedCombatReward
} from './types';

export const DEFAULT_COMBAT_HP = 100;
export const DEFAULT_TECHNIQUE_CHARGES = 2;

const positiveInteger = (value: number) => Number.isInteger(value) && value > 0;
const nonNegativeInteger = (value: number) => Number.isInteger(value) && value >= 0;

function uniqueIds(items: readonly { id: string }[], label: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id) throw new Error(`${label} id must not be empty.`);
    if (ids.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
    ids.add(item.id);
  }
}

function validateCombatant(definition: CombatantDefinition): void {
  if (!definition.label.trim()) throw new Error(`Combatant ${definition.id} needs a label.`);
  if (!positiveInteger(definition.maxHp)) {
    throw new Error(`Combatant ${definition.id} maxHp must be a positive integer.`);
  }
  if (
    definition.startingHp !== undefined
    && (!positiveInteger(definition.startingHp) || definition.startingHp > definition.maxHp)
  ) {
    throw new Error(`Combatant ${definition.id} startingHp must be within 1..maxHp.`);
  }
  if (definition.techniqueCharges !== undefined && !nonNegativeInteger(definition.techniqueCharges)) {
    throw new Error(`Combatant ${definition.id} techniqueCharges must be a non-negative integer.`);
  }
}

function validateReward(reward: FixedCombatReward): void {
  if (reward.amount !== undefined && (!Number.isFinite(reward.amount) || reward.amount < 0)) {
    throw new Error(`Combat reward ${reward.id} amount must be a non-negative finite number.`);
  }
  if (reward.kind === 'xp' && reward.amount === undefined) {
    throw new Error(`Combat XP reward ${reward.id} requires a fixed amount.`);
  }
}

/**
 * Deterministic structural validation for authored encounter definitions.
 *
 * This validates the C01 foundation only. Objective reachability, gimmick
 * compatibility and anti-grind simulation are later C07-C17 gates.
 */
export function validateCombatDefinition(definition: CombatDefinition): CombatDefinition {
  if (!definition.id) throw new Error('CombatDefinition id must not be empty.');
  if (!definition.encounterId) throw new Error('CombatDefinition encounterId must not be empty.');
  if (definition.combatants.length < 2) throw new Error('CombatDefinition needs at least two combatants.');

  uniqueIds(definition.combatants, 'combatant');
  uniqueIds(definition.rewards, 'combat reward');

  for (const combatant of definition.combatants) validateCombatant(combatant);
  for (const reward of definition.rewards) validateReward(reward);

  const players = definition.combatants.filter((combatant) => combatant.side === 'player');
  const enemies = definition.combatants.filter((combatant) => combatant.side === 'enemy');

  if (players.length !== 1) throw new Error('CombatDefinition requires exactly one player combatant.');
  if (enemies.length < 1) throw new Error('CombatDefinition requires at least one enemy combatant.');

  const player = players[0];
  if (player.maxHp !== DEFAULT_COMBAT_HP) {
    throw new Error(`C01 player maxHp must use the C00 baseline of ${DEFAULT_COMBAT_HP}.`);
  }

  if (definition.turnLimit !== undefined && !positiveInteger(definition.turnLimit)) {
    throw new Error('CombatDefinition turnLimit must be a positive integer when present.');
  }

  return definition;
}

function initialCombatant(definition: CombatantDefinition): CombatantState {
  return {
    id: definition.id,
    side: definition.side,
    maxHp: definition.maxHp,
    hp: definition.startingHp ?? definition.maxHp,
    techniqueCharges: definition.techniqueCharges
      ?? (definition.side === 'player' ? DEFAULT_TECHNIQUE_CHARGES : 0)
  };
}

export function createCombatState(definition: CombatDefinition): CombatState {
  validateCombatDefinition(definition);

  return {
    definitionId: definition.id,
    round: 1,
    phase: definition.openingPhase ?? 'player',
    combatants: definition.combatants.map(initialCombatant),
    statuses: [],
    objectiveProgress: 0
  };
}

/**
 * Pure C01 lifecycle reducer.
 *
 * Invalid phase changes are refused instead of silently repaired. Later Combat
 * mechanic packets may compute HP/objective/status changes, but provider output
 * never enters this reducer as mechanics authority.
 */
export function reduceCombatLifecycle(
  state: CombatState,
  event: CombatLifecycleEvent
): CombatState {
  if (event.type === 'RESOLVE') {
    if (state.phase === 'resolved') {
      if (state.outcome === event.outcome) return state;
      throw new Error(`Combat ${state.definitionId} is already resolved as ${state.outcome}.`);
    }
    return { ...state, phase: 'resolved', outcome: event.outcome };
  }

  if (state.phase === 'resolved') {
    throw new Error(`Combat ${state.definitionId} is already resolved.`);
  }

  if (event.type === 'END_PLAYER_PHASE') {
    if (state.phase !== 'player') {
      throw new Error(`END_PLAYER_PHASE requires player phase, got ${state.phase}.`);
    }
    return { ...state, phase: 'enemy' };
  }

  if (state.phase !== 'enemy') {
    throw new Error(`END_ENEMY_PHASE requires enemy phase, got ${state.phase}.`);
  }
  return { ...state, phase: 'player', round: state.round + 1 };
}
