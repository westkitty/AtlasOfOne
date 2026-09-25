import type { CombatActDefinition, CombatActJob, CombatActTargetKind } from '../types';

/**
 * CT09 ACT option bank.
 *
 * Labels describe a fictional action in the scene, never a verdict about the
 * player. Observation keys name what happened in the fiction ("offered bread
 * to the hound"), never what it supposedly means about Greyson. The lint
 * test in tests/combat/act-bank.test.ts forbids diagnostic/judgment language.
 */
export interface ActTemplate {
  templateId: string;
  label: string;
  job: CombatActJob;
  targetKind: CombatActTargetKind;
  requiredSteps: 0 | 1 | 2 | 3;
  /** Fiction-only hook; an Observation, never Evidence. */
  observationKey: string;
}

export const ACT_BANK: readonly ActTemplate[] = [
  // pacify-progress (enemy)
  { templateId: 'offer_bread', label: 'Offer a heel of bread', job: 'pacify-progress', targetKind: 'enemy', requiredSteps: 2, observationKey: 'act.offered_food' },
  { templateId: 'hum_tune', label: 'Hum the old road tune', job: 'pacify-progress', targetKind: 'enemy', requiredSteps: 2, observationKey: 'act.hummed_tune' },
  { templateId: 'lower_blade', label: 'Lower your blade slowly', job: 'pacify-progress', targetKind: 'enemy', requiredSteps: 1, observationKey: 'act.lowered_blade' },
  { templateId: 'return_trinket', label: 'Hold out the lost trinket', job: 'pacify-progress', targetKind: 'enemy', requiredSteps: 2, observationKey: 'act.returned_trinket' },
  { templateId: 'mirror_stance', label: 'Mirror its stance', job: 'pacify-progress', targetKind: 'enemy', requiredSteps: 3, observationKey: 'act.mirrored_stance' },
  { templateId: 'name_the_song', label: 'Name the song it is singing', job: 'pacify-progress', targetKind: 'enemy', requiredSteps: 1, observationKey: 'act.named_song' },
  { templateId: 'step_aside', label: 'Step aside from its path', job: 'pacify-progress', targetKind: 'enemy', requiredSteps: 2, observationKey: 'act.stepped_aside' },
  // interrupt (enemy)
  { templateId: 'toss_pebble', label: 'Toss a pebble at the glow', job: 'interrupt', targetKind: 'enemy', requiredSteps: 1, observationKey: 'act.tossed_pebble' },
  { templateId: 'ring_bell', label: 'Ring the hand bell', job: 'interrupt', targetKind: 'enemy', requiredSteps: 1, observationKey: 'act.rang_bell' },
  // C17: two-step interrupts leave one charged release unanswered (real pressure).
  { templateId: 'close_shutters', label: 'Close the lamp shutters', job: 'interrupt', targetKind: 'enemy', requiredSteps: 2, observationKey: 'act.closed_shutters' },
  { templateId: 'muffle_clapper', label: 'Muffle the bell clapper', job: 'interrupt', targetKind: 'enemy', requiredSteps: 2, observationKey: 'act.muffled_clapper' },
  { templateId: 'shout_name', label: 'Call out its true name', job: 'interrupt', targetKind: 'enemy', requiredSteps: 1, observationKey: 'act.called_name' },
  // reveal-information
  { templateId: 'read_runes', label: 'Read the runes on its collar', job: 'reveal-information', targetKind: 'enemy', requiredSteps: 0, observationKey: 'act.read_runes' },
  { templateId: 'study_ground', label: 'Study the cracked ground', job: 'reveal-information', targetKind: 'terrain', requiredSteps: 0, observationKey: 'act.studied_ground' },
  { templateId: 'check_lantern', label: 'Check the lantern oil', job: 'reveal-information', targetKind: 'object', requiredSteps: 0, observationKey: 'act.checked_lantern' },
  // redirect
  { templateId: 'point_to_river', label: 'Point toward the river', job: 'redirect', targetKind: 'enemy', requiredSteps: 1, observationKey: 'act.pointed_river' },
  { templateId: 'wave_ally_back', label: 'Wave your companion back', job: 'redirect', targetKind: 'ally', requiredSteps: 1, observationKey: 'act.waved_ally' },
  { templateId: 'kick_bucket', label: 'Kick the bucket into the aisle', job: 'redirect', targetKind: 'object', requiredSteps: 1, observationKey: 'act.kicked_bucket' },
  // objective-progress
  { templateId: 'wedge_door', label: 'Wedge the door shut', job: 'objective-progress', targetKind: 'objective', requiredSteps: 2, observationKey: 'act.wedged_door' },
  { templateId: 'relight_beacon', label: 'Relight the beacon', job: 'objective-progress', targetKind: 'objective', requiredSteps: 3, observationKey: 'act.relit_beacon' },
  { templateId: 'shore_bridge', label: 'Shore up the bridge plank', job: 'objective-progress', targetKind: 'terrain', requiredSteps: 2, observationKey: 'act.shored_bridge' }
];

export function actTemplate(templateId: string): ActTemplate {
  const template = ACT_BANK.find((item) => item.templateId === templateId);
  if (!template) throw new Error(`Unknown ACT bank template: ${templateId}`);
  return template;
}

/**
 * Instantiate a bank template as an encounter ACT. `targetId` is required for
 * enemy/ally/object/terrain targets and forbidden for objective targets
 * (validateCombatDefinition enforces this).
 */
export function actFromBank(templateId: string, targetId?: string, id = templateId): CombatActDefinition {
  const template = actTemplate(templateId);
  return {
    id,
    label: template.label,
    job: template.job,
    targetKind: template.targetKind,
    ...(targetId === undefined ? {} : { targetId }),
    requiredSteps: template.requiredSteps,
    observationKey: template.observationKey
  };
}
