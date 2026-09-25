import { DEFAULT_COMBAT_HP } from '../engine';
import type {
  CombatActDefinition,
  CombatDefinition,
  CombatFleeRule,
  CombatGimmick,
  CombatObjective,
  CombatTechniqueDefinition
} from '../types';
import { actFromBank } from './actBank';

/**
 * CT04 authored encounter bank: 30 ordinary encounters across the MVP
 * objective x gimmick matrix. All content is synthetic fiction. Every entry is
 * validated by validateObjectiveDefinition + validateGimmicks and simulated to
 * a 2-5 turn resolution under simpleScriptedPlayer (tests/combat/encounters-bank.test.ts).
 */

interface EnemySpec { id: string; label: string; hp: number }

interface EncounterSpec {
  id: string;
  objective: CombatObjective;
  gimmicks: CombatGimmick[];
  enemies: EnemySpec[];
  ally?: { id: string; label: string; hp: number };
  turnLimit?: number;
  techniques?: CombatTechniqueDefinition[];
  acts?: CombatActDefinition[];
  fleeRule?: CombatFleeRule;
  xp?: number;
}

export const EXPOSE: CombatTechniqueDefinition = {
  id: 'pry_open', label: 'Pry Open', job: 'expose-shield', chargeCost: 1, cooldownRounds: 1
};
export const COVER: CombatTechniqueDefinition = {
  id: 'cover', label: 'Cover', job: 'protect-ally', chargeCost: 1, cooldownRounds: 0
};
export const BREAK_FOCUS: CombatTechniqueDefinition = {
  id: 'break_focus', label: 'Break Focus', job: 'interrupt-charge', chargeCost: 1, cooldownRounds: 0
};

export function buildEncounter(spec: EncounterSpec): CombatDefinition {
  return {
    id: `combat_${spec.id}`,
    encounterId: `encounter_${spec.id}`,
    objective: spec.objective,
    gimmicks: spec.gimmicks,
    combatants: [
      { id: 'greyson', label: 'Greyson', side: 'player', maxHp: DEFAULT_COMBAT_HP },
      ...spec.enemies.map((enemy) => ({ id: enemy.id, label: enemy.label, side: 'enemy' as const, maxHp: enemy.hp })),
      ...(spec.ally ? [{ id: spec.ally.id, label: spec.ally.label, side: 'ally' as const, maxHp: spec.ally.hp }] : [])
    ],
    ...(spec.techniques ? { techniques: spec.techniques } : {}),
    ...(spec.acts ? { actOptions: spec.acts } : {}),
    ...(spec.turnLimit === undefined ? {} : { turnLimit: spec.turnLimit }),
    rewards: [{ id: `${spec.id}_xp`, kind: 'xp', amount: spec.xp ?? 10 }],
    fleeRule: spec.fleeRule ?? 'always'
  };
}

const one = (id: string, label: string, hp: number): EnemySpec[] => [{ id, label, hp }];
const ALLY = { id: 'wren', label: 'Wren the Porter', hp: 30 };

export const ENCOUNTER_BANK: readonly CombatDefinition[] = [
  // ---- defeat (7) --------------------------------------------------------
  buildEncounter({ id: 'defeat_bramble_wolf', objective: 'defeat', gimmicks: [], enemies: one('wolf', 'Bramble Wolf', 54) }),
  buildEncounter({ id: 'defeat_shell_crab', objective: 'defeat', gimmicks: ['shielded'], enemies: one('crab', 'Shell Crab', 36), techniques: [EXPOSE] }),
  buildEncounter({ id: 'defeat_thorn_duelist', objective: 'defeat', gimmicks: ['counterattacking'], enemies: one('duelist', 'Thorn Duelist', 54), fleeRule: 'after-turn' }),
  buildEncounter({ id: 'defeat_moth_cloud', objective: 'defeat', gimmicks: ['swarm'], enemies: one('moths', 'Moth Cloud', 54) }),
  buildEncounter({ id: 'defeat_kiln_golem', objective: 'defeat', gimmicks: ['charging'], enemies: one('golem', 'Kiln Golem', 54) }),
  buildEncounter({
    id: 'defeat_toll_bandits', objective: 'defeat', gimmicks: [],
    enemies: [{ id: 'lookout', label: 'Bandit Lookout', hp: 18 }, { id: 'tollman', label: 'Bandit Tollman', hp: 36 }]
  }),
  buildEncounter({ id: 'defeat_bark_knight', objective: 'defeat', gimmicks: ['shielded', 'counterattacking'], enemies: one('knight', 'Bark Knight', 36), techniques: [EXPOSE] }),

  // ---- survive (6) -------------------------------------------------------
  buildEncounter({ id: 'survive_rockslide_ghoul', objective: 'survive', gimmicks: [], enemies: one('ghoul', 'Rockslide Ghoul', 70), turnLimit: 3 }),
  buildEncounter({ id: 'survive_gnat_storm', objective: 'survive', gimmicks: ['swarm'], enemies: one('gnats', 'Gnat Storm', 60), turnLimit: 4 }),
  buildEncounter({ id: 'survive_bell_ram', objective: 'survive', gimmicks: ['charging'], enemies: one('ram', 'Bell Ram', 70), turnLimit: 4, fleeRule: 'story-gated' }),
  buildEncounter({ id: 'survive_hedge_fencer', objective: 'survive', gimmicks: ['counterattacking'], enemies: one('fencer', 'Hedge Fencer', 60), turnLimit: 3 }),
  buildEncounter({ id: 'survive_beetle_tide', objective: 'survive', gimmicks: ['shielded', 'swarm'], enemies: one('beetles', 'Beetle Tide', 66), turnLimit: 5 }),
  buildEncounter({ id: 'survive_mist_warden', objective: 'survive', gimmicks: ['non-kill-target'], enemies: one('warden', 'Mist Warden', 50), turnLimit: 3 }),

  // ---- protect (5) -------------------------------------------------------
  buildEncounter({ id: 'protect_cart_raider', objective: 'protect', gimmicks: [], enemies: one('raider', 'Cart Raider', 54), ally: ALLY, turnLimit: 3, techniques: [COVER] }),
  buildEncounter({ id: 'protect_shield_boar', objective: 'protect', gimmicks: ['shielded'], enemies: one('boar', 'Shield Boar', 60), ally: ALLY, turnLimit: 4, techniques: [COVER] }),
  buildEncounter({ id: 'protect_rat_pack', objective: 'protect', gimmicks: ['swarm'], enemies: one('rats', 'Rat Pack', 48), ally: ALLY, turnLimit: 3, techniques: [COVER] }),
  buildEncounter({ id: 'protect_briar_guard', objective: 'protect', gimmicks: ['counterattacking'], enemies: one('briar', 'Briar Guard', 60), ally: ALLY, turnLimit: 4, techniques: [COVER] }),
  buildEncounter({
    id: 'protect_lost_sentinel', objective: 'protect', gimmicks: ['non-kill-target'], enemies: one('sentinel', 'Lost Sentinel', 50),
    ally: ALLY, turnLimit: 3, techniques: [COVER], acts: [actFromBank('read_runes', 'sentinel')]
  }),

  // ---- interrupt (6) -----------------------------------------------------
  buildEncounter({ id: 'interrupt_ember_adept', objective: 'interrupt', gimmicks: ['charging'], enemies: one('adept', 'Ember Adept', 54), techniques: [BREAK_FOCUS] }),
  buildEncounter({ id: 'interrupt_glass_turtle', objective: 'interrupt', gimmicks: ['charging', 'shielded'], enemies: one('turtle', 'Glass Turtle', 60), techniques: [BREAK_FOCUS] }),
  buildEncounter({ id: 'interrupt_spine_caster', objective: 'interrupt', gimmicks: ['charging', 'counterattacking'], enemies: one('caster', 'Spine Caster', 54), techniques: [BREAK_FOCUS] }),
  buildEncounter({ id: 'interrupt_wasp_choir', objective: 'interrupt', gimmicks: ['charging', 'swarm'], enemies: one('wasps', 'Wasp Choir', 54), techniques: [BREAK_FOCUS] }),
  buildEncounter({
    id: 'interrupt_dream_bell', objective: 'interrupt', gimmicks: ['charging', 'non-kill-target'], enemies: one('bellwisp', 'Bell Wisp', 45),
    acts: [actFromBank('ring_bell', 'bellwisp')]
  }),
  buildEncounter({
    id: 'interrupt_lamp_eater', objective: 'interrupt', gimmicks: ['charging'], enemies: one('lampeater', 'Lamp Eater', 54),
    acts: [actFromBank('toss_pebble', 'lampeater'), actFromBank('check_lantern', 'lamp_post')]
  }),

  // ---- pacify (6) --------------------------------------------------------
  buildEncounter({ id: 'pacify_hungry_hound', objective: 'pacify', gimmicks: ['non-kill-target'], enemies: one('hound', 'Hungry Hound', 45), acts: [actFromBank('offer_bread', 'hound')] }),
  buildEncounter({
    id: 'pacify_mirror_statue', objective: 'pacify', gimmicks: ['non-kill-target', 'shielded'], enemies: one('statue', 'Mirror Statue', 60),
    acts: [actFromBank('mirror_stance', 'statue')]
  }),
  buildEncounter({ id: 'pacify_reed_piper', objective: 'pacify', gimmicks: ['non-kill-target', 'counterattacking'], enemies: one('piper', 'Reed Piper', 50), acts: [actFromBank('hum_tune', 'piper')] }),
  buildEncounter({ id: 'pacify_sparrow_flock', objective: 'pacify', gimmicks: ['swarm'], enemies: one('sparrows', 'Sparrow Flock', 45), acts: [actFromBank('step_aside', 'sparrows')] }),
  buildEncounter({
    id: 'pacify_magpie_spirit', objective: 'pacify', gimmicks: ['charging', 'non-kill-target'], enemies: one('magpie', 'Magpie Spirit', 50),
    acts: [actFromBank('return_trinket', 'magpie')]
  }),
  buildEncounter({
    id: 'pacify_gate_twins', objective: 'pacify', gimmicks: [],
    enemies: [{ id: 'twin_a', label: 'Gate Twin Ash', hp: 30 }, { id: 'twin_b', label: 'Gate Twin Birch', hp: 30 }],
    acts: [actFromBank('lower_blade', 'twin_a', 'lower_blade_a'), actFromBank('lower_blade', 'twin_b', 'lower_blade_b')]
  })
];
