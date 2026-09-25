import type { CombatDefinition } from '../types';
import { actFromBank } from './actBank';
import { BREAK_FOCUS, COVER, buildEncounter } from './encounters';

/**
 * C15/C16 vertical encounter fixtures. Each is a complete, deterministic,
 * synthetic encounter with an authored scripted playthrough used as a proof
 * trace and as the integration owner's browser-journey seed.
 */

/** C15: nonviolent route. Completes via ACT only; the enemy is never KO'd. */
export const PACIFY_VERTICAL: CombatDefinition = buildEncounter({
  id: 'vertical_pacify_orchard_bear',
  objective: 'pacify',
  gimmicks: ['non-kill-target'],
  enemies: [{ id: 'bear', label: 'Orchard Bear', hp: 60 }],
  acts: [
    actFromBank('read_runes', 'bear'),
    actFromBank('offer_bread', 'bear')
  ],
  fleeRule: 'after-turn'
});

/** C16: protect the porter for 3 rounds. */
export const PROTECT_VERTICAL: CombatDefinition = buildEncounter({
  id: 'vertical_protect_ferry_crossing',
  objective: 'protect',
  gimmicks: [],
  enemies: [{ id: 'eel', label: 'Ferry Eel', hp: 60 }],
  ally: { id: 'wren', label: 'Wren the Porter', hp: 30 },
  turnLimit: 3,
  techniques: [COVER]
});

/** C16: break the charge before it lands. */
export const INTERRUPT_VERTICAL: CombatDefinition = buildEncounter({
  id: 'vertical_interrupt_storm_kite',
  objective: 'interrupt',
  gimmicks: ['charging'],
  enemies: [{ id: 'kite', label: 'Storm Kite', hp: 54 }],
  techniques: [BREAK_FOCUS]
});

/** C16: hold out until the tide turns. */
export const SURVIVE_VERTICAL: CombatDefinition = buildEncounter({
  id: 'vertical_survive_tide_cave',
  objective: 'survive',
  gimmicks: ['swarm'],
  enemies: [{ id: 'crabs', label: 'Tide Crabs', hp: 66 }],
  turnLimit: 4,
  fleeRule: 'story-gated'
});
