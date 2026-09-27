import type { CombatCommand, CombatDefinition, CombatOutcome, CombatState } from '../contracts/combat';
import { createActLedger, resolveAct, validateActScenario, type ActLedger, type ActScenario } from './act';
import { resolveAttack } from './attack';
import { initializeCombatState, reduceCombatState, validateCombatStateAgainstDefinition } from './engine';
import {
  clearRoundScopedStatuses,
  counterDamageFor,
  initialEnemyStatuses,
  shieldedAttackDamage,
  withStatus,
  withoutStatus
} from './gimmicks';
import { beginGuard, resolveGuardedIncomingDamage, type PendingGuard } from './guard';
import { enemyIntent, enemyIntents, type EnemyIntent } from './intent';
import { resolveLeave, resolvePlayerDefeat, type FailForwardDescriptor, type LeaveContext } from './leave';
import { evaluateObjective, type ObjectiveCheckpoint } from './objectives';
import { COMBAT_TIMING_GRADES, type CombatTimingGrade } from './rules';
import { createTechniqueLedger, useTechnique, validateTechniqueLedger, type TechniqueEffectDescriptor, type TechniqueLedger } from './techniques';

/**
 * Fictional, bounded record of what happened. These are game observations only:
 * they are never evidence and never a claim about the real player.
 */
export type CombatLogEntry =
  | { kind: 'attack'; targetId: string; damage: number }
  | { kind: 'counter'; enemyId: string; damage: number }
  | { kind: 'guard' }
  | { kind: 'technique'; techniqueId: string; effect: TechniqueEffectDescriptor['kind']; targetId: string }
  | { kind: 'act'; optionId: string; observationKey?: string }
  | { kind: 'enemy'; enemyId: string; intent: EnemyIntent['kind']; targetId?: string; damage: number }
  | { kind: 'resolved'; outcome: CombatOutcome };

export const COMBAT_LOG_LIMIT = 16;

/** Plain-data, JSON-serializable combat session. Replace it wholesale; never mutate. */
export interface CombatSession {
  definition: CombatDefinition;
  scenario: ActScenario;
  state: CombatState;
  /** Monotonic count of accepted player commands; stale submissions are refused. */
  turn: number;
  techniques: TechniqueLedger;
  acts: ActLedger;
  pendingGuard?: PendingGuard;
  failForward?: FailForwardDescriptor;
  log: CombatLogEntry[];
}

/** What CampaignState persists beside `combatDefinitions` + `activeCombat` (C11). */
export type PersistedCombatRuntime = Omit<CombatSession, 'definition' | 'state' | 'failForward'> & { definitionId: string };

export function dehydrateCombatSession(session: CombatSession): PersistedCombatRuntime {
  const { definition, state, failForward, ...runtime } = session;
  void state; void failForward;
  return { ...runtime, definitionId: definition.id };
}

/**
 * Rebuild a session from persisted parts. Any mismatch or invalid part fails
 * closed (null) rather than guessing: the caller keeps the saved data intact
 * and simply offers no resumable combat.
 */
export function hydrateCombatSession(
  definitions: readonly CombatDefinition[],
  state: CombatState | null,
  runtime: PersistedCombatRuntime | null
): CombatSession | null {
  if (!state || !runtime || runtime.definitionId !== state.definitionId) return null;
  const definition = definitions.find((candidate) => candidate.id === state.definitionId);
  if (!definition) return null;
  const { definitionId, ...rest } = runtime;
  void definitionId;
  const session: CombatSession = { ...rest, definition, state };
  return validateCombatSession(session) ? session : null;
}

export type SessionIssueCode =
  | 'invalid-definition'
  | 'invalid-scenario'
  | 'invalid-session'
  | 'combat-resolved'
  | 'stale-command'
  | 'invalid-command'
  | 'invalid-timing-grade'
  | 'command-rejected';

export type CombatSessionCreation = { ok: true; session: CombatSession } | { ok: false; issue: SessionIssueCode };

export interface CommandOptions {
  timing?: CombatTimingGrade;
  /** The session.turn the player saw when submitting. Mismatch = stale/duplicate submission. */
  expectedTurn?: number;
  leaveContext?: LeaveContext;
}

export interface CommandResult {
  session: CombatSession;
  accepted: boolean;
  issue?: SessionIssueCode;
  detail?: string;
}

const TIMING_SET = new Set<string>(COMBAT_TIMING_GRADES);

function appendLog(log: readonly CombatLogEntry[], ...entries: CombatLogEntry[]): CombatLogEntry[] {
  return [...log, ...entries].slice(-COMBAT_LOG_LIMIT);
}

export function createCombatSession(definition: CombatDefinition, scenario: ActScenario = { options: [] }): CombatSessionCreation {
  const initialized = initializeCombatState(definition);
  if (!initialized.ok) return { ok: false, issue: 'invalid-definition' };
  if (!validateActScenario(definition, scenario).ok) return { ok: false, issue: 'invalid-scenario' };
  let state = initialized.state;
  for (const enemy of definition.combatants.filter((combatant) => combatant.team === 'enemy')) {
    for (const status of initialEnemyStatuses(definition)) state = withStatus(state, enemy.id, status);
  }
  return { ok: true, session: { definition, scenario, state, turn: 0, techniques: createTechniqueLedger(), acts: createActLedger(), log: [] } };
}

/** Structural check used on load and before every command, so persisted garbage fails closed. */
export function validateCombatSession(session: CombatSession): boolean {
  if (!session || typeof session !== 'object') return false;
  if (!Number.isInteger(session.turn) || session.turn < 0 || !Array.isArray(session.log)) return false;
  if (!validateCombatStateAgainstDefinition(session.definition, session.state).ok) return false;
  if (!validateActScenario(session.definition, session.scenario).ok) return false;
  if (!validateTechniqueLedger(session.techniques).ok) return false;
  if (!Array.isArray(session.acts?.usedOptionIds)) return false;
  return true;
}

/** Visible telegraphs for the current player phase. */
export function sessionIntents(session: CombatSession): EnemyIntent[] {
  return session.state.phase === 'player' ? enemyIntents(session.definition, session.state) : [];
}

function resolveWith(session: CombatSession, outcome: CombatOutcome): CombatSession {
  if (outcome === 'defeat') {
    const player = session.definition.combatants.find((combatant) => combatant.team === 'player');
    const playerDown = (session.state.combatants.find((combatant) => combatant.id === player?.id)?.currentHp ?? 0) <= 0;
    if (playerDown) {
      const defeat = resolvePlayerDefeat(session.definition, session.state);
      if (defeat.accepted) return { ...session, state: defeat.state, failForward: defeat.failForward, pendingGuard: undefined, log: appendLog(session.log, { kind: 'resolved', outcome }) };
    }
    // A protected ally fell: same fail-forward retreat, no judgment attached.
    const reduced = reduceCombatState(session.definition, session.state, { type: 'COMBAT_RESOLVED', outcome: 'defeat' });
    return { ...session, state: reduced.state, failForward: { kind: 'retreat-to-sanctuary', retryAvailable: true }, pendingGuard: undefined, log: appendLog(session.log, { kind: 'resolved', outcome }) };
  }
  const reduced = reduceCombatState(session.definition, session.state, { type: 'COMBAT_RESOLVED', outcome });
  return { ...session, state: reduced.state, pendingGuard: undefined, log: appendLog(session.log, { kind: 'resolved', outcome }) };
}

function checkObjective(session: CombatSession, checkpoint: ObjectiveCheckpoint): CombatSession {
  const outcome = evaluateObjective(session.definition, session.state, checkpoint);
  return outcome ? resolveWith(session, outcome) : session;
}

function applyTechniqueEffect(session: CombatSession, effect: TechniqueEffectDescriptor): CombatSession {
  let state = session.state;
  const target = state.combatants.find((combatant) => combatant.id === effect.targetId);
  switch (effect.kind) {
    case 'interrupt-charge': {
      const wasCharging = target?.statuses.includes('charging') ?? false;
      state = withStatus(withoutStatus(state, effect.targetId, 'charging'), effect.targetId, 'staggered');
      if (wasCharging && session.definition.objective === 'interrupt-charged-action') {
        state = reduceCombatState(session.definition, state, { type: 'OBJECTIVE_PROGRESS_SET', progress: state.objectiveProgress + 1 }).state;
      }
      break;
    }
    case 'protect-ally':
      state = withStatus(state, effect.targetId, 'protected-target');
      break;
    case 'expose-target':
      state = withStatus(state, effect.targetId, 'exposed');
      break;
  }
  return { ...session, state };
}

function runEnemyAction(session: CombatSession, intent: EnemyIntent): CombatSession {
  const { definition } = session;
  let state = session.state;
  let pendingGuard = session.pendingGuard;
  let dealt = 0;
  switch (intent.kind) {
    case 'recover':
      state = withoutStatus(state, intent.enemyId, 'staggered');
      break;
    case 'charge':
      state = withStatus(state, intent.enemyId, 'charging');
      break;
    case 'attack':
    case 'objective-action': {
      if (intent.release) state = withoutStatus(state, intent.enemyId, 'charging');
      const targetId = intent.targetId!;
      const target = state.combatants.find((combatant) => combatant.id === targetId);
      if (!target || target.currentHp <= 0) break;
      if (target.statuses.includes('protected-target')) {
        state = withoutStatus(state, targetId, 'protected-target');
      } else if (pendingGuard && pendingGuard.combatantId === targetId && target.statuses.includes('guarded')) {
        const guarded = resolveGuardedIncomingDamage(definition, state, pendingGuard, intent.damage);
        if (guarded.accepted) { state = guarded.state; dealt = guarded.appliedDamage ?? 0; pendingGuard = undefined; }
      } else {
        const hit = reduceCombatState(definition, state, { type: 'DAMAGE', targetId, amount: intent.damage });
        state = hit.state;
        dealt = intent.damage;
      }
      break;
    }
    default:
      break;
  }
  return {
    ...session,
    state,
    pendingGuard,
    log: appendLog(session.log, { kind: 'enemy', enemyId: intent.enemyId, intent: intent.kind, ...(intent.targetId ? { targetId: intent.targetId } : {}), damage: dealt })
  };
}

/**
 * C10 fixed resolution order after an accepted player action:
 *   1. objective check (after-action)
 *   2. player phase ends
 *   3. each living enemy acts in definition order, intent recomputed from
 *      current state; objective checked after each enemy action
 *   4. round-scoped statuses clear, round advances
 *   5. objective check (round-end)
 */
function finishTurn(session: CombatSession): CombatSession {
  let next = checkObjective(session, 'after-action');
  if (next.state.phase === 'resolved') return next;

  next = { ...next, state: reduceCombatState(next.definition, next.state, { type: 'PLAYER_PHASE_ENDED' }).state };
  for (const enemy of next.definition.combatants.filter((combatant) => combatant.team === 'enemy')) {
    const intent = enemyIntent(next.definition, next.state, enemy.id);
    if (!intent) continue;
    next = runEnemyAction(next, intent);
    next = checkObjective(next, 'after-action');
    if (next.state.phase === 'resolved') return next;
  }

  const cleared = clearRoundScopedStatuses(next.state);
  next = { ...next, pendingGuard: undefined, state: reduceCombatState(next.definition, cleared, { type: 'ROUND_ADVANCED' }).state };
  return checkObjective(next, 'round-end');
}

/**
 * Apply one player command. Pure: returns a new session and never mutates the
 * input. Exactly one command resolves per player turn. A provider has no path
 * into this function; its only inputs are typed player intent and runtime
 * story context owned by the application.
 */
export function applyCombatCommand(session: CombatSession, command: CombatCommand, options: CommandOptions = {}): CommandResult {
  const refuse = (issue: SessionIssueCode, detail?: string): CommandResult => ({ session, accepted: false, issue, ...(detail ? { detail } : {}) });
  if (!validateCombatSession(session)) return refuse('invalid-session');
  if (session.state.phase === 'resolved') return refuse('combat-resolved');
  if (options.expectedTurn !== undefined && options.expectedTurn !== session.turn) return refuse('stale-command');
  const timing = options.timing ?? 'base';
  if (!TIMING_SET.has(timing as string)) return refuse('invalid-timing-grade');

  const { definition, state } = session;
  const accepted = (next: CombatSession): CommandResult => ({ session: { ...next, turn: session.turn + 1 }, accepted: true });

  switch (command?.kind) {
    case 'ATTACK': {
      const targetId = command.targetId ?? '';
      const targetStatuses = state.combatants.find((combatant) => combatant.id === targetId)?.statuses ?? [];
      const attack = resolveAttack(definition, state, targetId, timing, (damage) => shieldedAttackDamage(definition, targetStatuses, damage));
      if (!attack.accepted) return refuse('command-rejected', attack.issue);
      let nextState = withoutStatus(attack.state, targetId, 'exposed');
      const log: CombatLogEntry[] = [{ kind: 'attack', targetId, damage: attack.damage ?? 0 }];
      const target = nextState.combatants.find((combatant) => combatant.id === targetId)!;
      const counter = counterDamageFor(definition, target.statuses, target.currentHp);
      if (counter > 0) {
        const player = definition.combatants.find((combatant) => combatant.team === 'player')!;
        nextState = reduceCombatState(definition, nextState, { type: 'DAMAGE', targetId: player.id, amount: counter }).state;
        log.push({ kind: 'counter', enemyId: targetId, damage: counter });
      }
      return accepted(finishTurn({ ...session, state: nextState, log: appendLog(session.log, ...log) }));
    }
    case 'GUARD': {
      const guard = beginGuard(definition, state, timing);
      if (!guard.accepted) return refuse('command-rejected', guard.issue);
      return accepted(finishTurn({ ...session, state: guard.state, pendingGuard: guard.pending, log: appendLog(session.log, { kind: 'guard' }) }));
    }
    case 'TECHNIQUE': {
      const used = useTechnique(definition, state, session.techniques, command.techniqueId ?? '', command.targetId ?? '');
      if (!used.available || !used.effect) return refuse('command-rejected', used.issue);
      const withEffect = applyTechniqueEffect({ ...session, techniques: used.ledger }, used.effect);
      return accepted(finishTurn({ ...withEffect, log: appendLog(session.log, { kind: 'technique', techniqueId: used.techniqueId, effect: used.effect.kind, targetId: used.targetId }) }));
    }
    case 'ACT': {
      const act = resolveAct(definition, state, session.acts, session.scenario, command.actId ?? '', command.targetId);
      if (!act.accepted) return refuse('command-rejected', act.issue);
      const option = session.scenario.options.find((candidate) => candidate.id === act.optionId);
      const entry: CombatLogEntry = { kind: 'act', optionId: act.optionId, ...(option?.observationKey ? { observationKey: option.observationKey } : {}) };
      return accepted(finishTurn({ ...session, state: act.state, acts: act.ledger, log: appendLog(session.log, entry) }));
    }
    case 'LEAVE': {
      const leave = resolveLeave(definition, state, options.leaveContext);
      if (!leave.accepted) return refuse('command-rejected', leave.issue);
      return accepted({ ...session, state: leave.state, pendingGuard: undefined, failForward: leave.failForward, log: appendLog(session.log, { kind: 'resolved', outcome: leave.state.outcome! }) });
    }
    default:
      return refuse('invalid-command');
  }
}
