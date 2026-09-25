import { techniqueUsable } from '../content/scriptedPlayer';
import { evaluateObjective } from '../objectives';
import type { CombatPlayerIntent } from '../runner';
import type {
  CombatDefinition,
  CombatIntent,
  CombatLeaveContext,
  CombatObjective,
  CombatOutcome,
  CombatState,
  CombatStatusId,
  CombatVerb
} from '../types';

/**
 * C13 pure view-model for the mobile CombatPanel. Reads engine state only and
 * never mutates it; the panel renders this and emits CombatPlayerIntent.
 */

export interface CombatantView {
  id: string;
  label: string;
  side: 'player' | 'enemy' | 'ally';
  hp: number;
  maxHp: number;
  /** Always-present text form so HP never relies on the bar/colour alone. */
  hpText: string;
  hpPercent: number;
  down: boolean;
}

export interface IntentView {
  enemyId: string;
  enemyLabel: string;
  intent: CombatIntent;
  /** Short word shown with a glyph; non-colour distinction. */
  label: string;
  glyph: string;
  targetLabel: string;
  damage: number;
  text: string;
}

export interface StatusView {
  key: string;
  status: CombatStatusId;
  label: string;
  /** Distinct shape/glyph per status so meaning never depends on colour. */
  glyph: string;
  targetLabel: string;
  remainingRounds: number;
  explanation: string;
}

export interface VerbOptionView {
  id: string;
  label: string;
  enabled: boolean;
  reason?: string;
  intent?: CombatPlayerIntent;
}

export interface VerbView {
  verb: CombatVerb;
  label: string;
  enabled: boolean;
  /** Human reason when disabled; always present for a disabled verb. */
  reason?: string;
  options: VerbOptionView[];
}

export interface CombatPanelView {
  encounterId: string;
  round: number;
  phase: CombatState['phase'];
  outcome?: CombatOutcome;
  player: CombatantView;
  allies: CombatantView[];
  enemies: CombatantView[];
  objective: { id: CombatObjective; line: string; progress: number; required: number; progressText: string };
  intents: IntentView[];
  statuses: StatusView[];
  verbs: VerbView[];
}

const INTENT_COPY: Record<CombatIntent, { label: string; glyph: string }> = {
  attack: { label: 'Strike', glyph: '⚔' },
  defend: { label: 'Brace', glyph: '⛨' },
  charge: { label: 'Charging', glyph: '⚡' },
  recover: { label: 'Recovering', glyph: '…' },
  hazard: { label: 'Hazard', glyph: '⚠' },
  'objective-action': { label: 'Threat', glyph: '➤' },
  'special-act-reactive': { label: 'Reacting', glyph: '?' }
};

export const STATUS_COPY: Record<CombatStatusId, { label: string; glyph: string; explanation: string }> = {
  guarded: { label: 'Guarded', glyph: '▣', explanation: 'Incoming damage is halved this round.' },
  exposed: { label: 'Exposed', glyph: '◇', explanation: 'Shield and counter are open; attacks land fully.' },
  charging: { label: 'Charging', glyph: '▲', explanation: 'A big hit lands next turn unless interrupted.' },
  staggered: { label: 'Staggered', glyph: '✕', explanation: 'Off balance; will recover instead of acting.' },
  pacifiable: { label: 'Calming', glyph: '○', explanation: 'Open to a peaceful resolution.' },
  'protected-target': { label: 'Covered', glyph: '◎', explanation: 'Threats against this ally are blocked this round.' }
};

const OBJECTIVE_LINE: Record<string, string> = {
  defeat: 'Defeat every foe',
  survive: 'Hold out',
  protect: 'Keep your ally standing',
  interrupt: 'Break the charge',
  pacify: 'Calm them without a knockout'
};

const VERB_LABEL: Record<CombatVerb, string> = {
  attack: 'Attack',
  technique: 'Technique',
  guard: 'Guard',
  act: 'Act',
  leave: 'Leave'
};

function combatantView(definition: CombatDefinition, state: CombatState, id: string): CombatantView {
  const live = state.combatants.find((combatant) => combatant.id === id)!;
  const authored = definition.combatants.find((combatant) => combatant.id === id);
  return {
    id,
    label: authored?.label ?? id,
    side: live.side,
    hp: live.hp,
    maxHp: live.maxHp,
    hpText: `${live.hp} / ${live.maxHp} HP`,
    hpPercent: Math.round((Math.max(0, live.hp) / live.maxHp) * 100),
    down: live.hp <= 0
  };
}

function objectiveProgressText(objective: CombatObjective, progress: number, required: number): string {
  switch (objective) {
    case 'survive':
    case 'protect':
      return `Round ${progress} of ${required} held`;
    case 'defeat':
      return `${progress} of ${required} down`;
    case 'pacify':
      return `${progress} of ${required} calming steps`;
    default:
      return progress >= required ? 'Done' : 'Not yet';
  }
}

/** Deterministic LEAVE gate matching resolveLeave; null when LEAVE is allowed. */
export function leaveBlockedReason(
  definition: CombatDefinition,
  state: CombatState,
  context: CombatLeaveContext = {}
): string | null {
  if (definition.fleeRule === 'after-turn' && state.round <= 1) return 'You can withdraw after the first round.';
  if (definition.fleeRule === 'story-gated' && context.storyGateOpen !== true) return 'The way out is blocked for now.';
  return null;
}

export function buildCombatPanelView(
  definition: CombatDefinition,
  state: CombatState,
  leaveContext: CombatLeaveContext = {}
): CombatPanelView {
  const label = (id: string) => definition.combatants.find((combatant) => combatant.id === id)?.label ?? id;
  const playerState = state.combatants.find((combatant) => combatant.side === 'player')!;
  const evaluation = evaluateObjective(definition, state);
  const living = state.combatants.filter((combatant) => combatant.side === 'enemy' && combatant.hp > 0);
  const allyLiving = state.combatants.filter((combatant) => combatant.side === 'ally' && combatant.hp > 0);

  const turnReason = state.phase === 'resolved'
    ? 'The encounter is over.'
    : state.phase === 'enemy' ? 'Wait for the enemy turn.' : null;

  const verb = (
    id: CombatVerb,
    options: VerbOptionView[],
    ownReason: string | null
  ): VerbView => {
    const reason = turnReason ?? ownReason ?? undefined;
    return {
      verb: id,
      label: VERB_LABEL[id],
      enabled: reason === undefined,
      ...(reason === undefined ? {} : { reason }),
      options: reason === undefined ? options : options.map((option) => ({ ...option, enabled: false, reason }))
    };
  };

  const attackOptions: VerbOptionView[] = living.map((enemy) => ({
    id: enemy.id,
    label: label(enemy.id),
    enabled: true,
    intent: { verb: 'attack', targetId: enemy.id }
  }));

  const techniqueOptions: VerbOptionView[] = (definition.techniques ?? []).flatMap((technique) => {
    const targets = technique.job === 'protect-ally' ? allyLiving : living;
    const ready = state.techniqueReadyRound[technique.id] ?? 1;
    const reason = playerState.techniqueCharges < technique.chargeCost
      ? `Needs ${technique.chargeCost} charge; ${playerState.techniqueCharges} left.`
      : state.round < ready
        ? `Ready on round ${ready}.`
        : targets.length === 0 ? 'No valid target.' : undefined;
    const usable = reason === undefined && techniqueUsable(state, technique);
    if (targets.length === 0) return [{ id: technique.id, label: technique.label, enabled: false, reason }];
    return targets.map((target) => ({
      id: `${technique.id}:${target.id}`,
      label: targets.length > 1 ? `${technique.label} → ${label(target.id)}` : technique.label,
      enabled: usable,
      ...(reason === undefined ? {} : { reason }),
      ...(usable ? { intent: { verb: 'technique' as const, techniqueId: technique.id, targetId: target.id } } : {})
    }));
  });

  const actOptions: VerbOptionView[] = (definition.actOptions ?? [])
    .filter((act) => !state.completedActIds.includes(act.id))
    .filter((act) => !(act.targetKind === 'enemy' && act.targetId && !living.some((enemy) => enemy.id === act.targetId)))
    .map((act) => {
      const steps = act.requiredSteps > 0 ? ` (${state.actProgressById[act.id] ?? 0}/${act.requiredSteps})` : '';
      return { id: act.id, label: `${act.label}${steps}`, enabled: true, intent: { verb: 'act' as const, actId: act.id } };
    });

  const leaveReason = leaveBlockedReason(definition, state, leaveContext);

  const verbs: VerbView[] = [
    verb('attack', attackOptions, attackOptions.length === 0 ? 'No foe to strike.' : null),
    verb('technique', techniqueOptions,
      techniqueOptions.length === 0
        ? 'No technique here.'
        : techniqueOptions.some((option) => option.enabled) ? null : techniqueOptions[0].reason ?? 'Not ready.'),
    verb('guard', [{ id: 'guard', label: 'Guard', enabled: true, intent: { verb: 'guard' } }], null),
    verb('act', actOptions, actOptions.length === 0 ? 'Nothing to try here right now.' : null),
    verb('leave', [{ id: 'leave', label: 'Leave', enabled: true, intent: { verb: 'leave' } }], leaveReason)
  ];

  return {
    encounterId: definition.encounterId,
    round: state.round,
    phase: state.phase,
    ...(state.outcome ? { outcome: state.outcome } : {}),
    player: combatantView(definition, state, playerState.id),
    allies: state.combatants.filter((c) => c.side === 'ally').map((c) => combatantView(definition, state, c.id)),
    enemies: state.combatants.filter((c) => c.side === 'enemy').map((c) => combatantView(definition, state, c.id)),
    objective: {
      id: definition.objective,
      line: OBJECTIVE_LINE[definition.objective] ?? definition.objective,
      progress: evaluation.progress,
      required: evaluation.required,
      progressText: objectiveProgressText(definition.objective, evaluation.progress, evaluation.required)
    },
    intents: (state.telegraphedIntents ?? []).map((plan) => {
      const copy = INTENT_COPY[plan.intent];
      const damage = plan.rawDamage > 0 ? ` for ${plan.rawDamage}` : '';
      return {
        enemyId: plan.enemyId,
        enemyLabel: label(plan.enemyId),
        intent: plan.intent,
        label: copy.label,
        glyph: copy.glyph,
        targetLabel: label(plan.targetId),
        damage: plan.rawDamage,
        text: plan.rawDamage > 0
          ? `${label(plan.enemyId)}: ${copy.label} → ${label(plan.targetId)}${damage}`
          : `${label(plan.enemyId)}: ${copy.label}`
      };
    }),
    statuses: state.statuses.map((status) => ({
      key: status.id,
      status: status.status,
      label: STATUS_COPY[status.status].label,
      glyph: STATUS_COPY[status.status].glyph,
      targetLabel: label(status.targetId),
      remainingRounds: status.remainingRounds,
      explanation: STATUS_COPY[status.status].explanation
    })),
    verbs
  };
}
