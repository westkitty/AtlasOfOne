import { useEffect, useRef, useState } from 'react';
import type { CombatCommand } from '../contracts/combat';
import { resolveAct } from './act';
import { checkLeaveAvailability } from './leave';
import { sessionIntents, type CombatLogEntry, type CombatSession } from './session';
import { MVP_TECHNIQUES, checkTechniqueAvailability } from './techniques';
import { COMBAT_OBJECTIVE_RULES } from './rules';
import { playCombatSound } from '../world/audio';
import './CombatPanel.css';

export interface CombatPanelProps {
  session: CombatSession;
  title: string;
  objectiveCopy: string;
  names: Record<string, string>;
  paused: boolean;
  quiet: boolean;
  onCommand: (command: CombatCommand, expectedTurn: number) => void;
}

const INTENT_COPY: Record<string, string> = {
  attack: 'will strike',
  'objective-action': 'is going for',
  charge: 'is gathering power',
  recover: 'is reeling — loses its action',
  defend: 'is backing down',
  hazard: 'is disturbing the ground',
  'special-act-reactive': 'is watching you'
};

const INTENT_GLYPH: Record<string, string> = {
  attack: '⚔',
  'objective-action': '◆',
  charge: '⚡',
  recover: '◌',
  defend: '🛡',
  hazard: '≋',
  'special-act-reactive': '👁'
};

function logLine(entry: CombatLogEntry | undefined, names: Record<string, string>): string {
  if (!entry) return 'Your move. Nothing here is a test of who you are.';
  const name = (id: string) => names[id] ?? id;
  switch (entry.kind) {
    case 'attack': return `You hit ${name(entry.targetId)} for ${entry.damage}.`;
    case 'counter': return `${name(entry.enemyId)} countered for ${entry.damage}.`;
    case 'guard': return 'You braced.';
    case 'technique': return `Technique: ${entry.techniqueId.replace(/-/g, ' ')}.`;
    case 'act': return 'You tried something other than force.';
    case 'enemy': return entry.damage > 0 ? `${name(entry.enemyId)} dealt ${entry.damage}${entry.targetId ? ` to ${name(entry.targetId)}` : ''}.` : `${name(entry.enemyId)} ${INTENT_COPY[entry.intent] ?? 'acted'}.`;
    case 'resolved': return 'The encounter is over.';
  }
}

/**
 * C13 mobile CombatPanel. Pure presentation over a deterministic CombatSession:
 * every button's enabled state comes from the same pure availability checks
 * the engine uses, and every press carries the turn it was rendered for, so a
 * double tap is refused as stale instead of acting twice.
 */
/** How long the enemy's answer stays on screen before the next command unlocks. */
export const COMBAT_SETTLE_MS = 450;

export function CombatPanel({ session, title, objectiveCopy, names, paused, quiet, onCommand }: CombatPanelProps) {
  // A double tap re-renders between taps, so the second tap would carry the NEW
  // turn and look like a legitimate second command. The latch is synchronous
  // (a ref, not state/effects) so it holds even before React re-renders; the
  // settle state only mirrors it visually by disabling the buttons.
  const lastPressAt = useRef(-Infinity);
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    if (session.turn === 0) return;
    setSettling(true);
    const timer = window.setTimeout(() => setSettling(false), COMBAT_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [session.turn]);

  // Audio feedback for combat resolutions & enemy attacks
  const lastLogEntry = session.log[session.log.length - 1];
  useEffect(() => {
    if (!lastLogEntry) return;
    if (lastLogEntry.kind === 'enemy' && lastLogEntry.damage > 0) {
      playCombatSound('hit', quiet);
    } else if (lastLogEntry.kind === 'resolved') {
      playCombatSound('victory', quiet);
    }
  }, [session.log.length, quiet]);

  const { definition, state } = session;
  const combatants = definition.combatants.map((entry) => ({ ...entry, current: state.combatants.find((c) => c.id === entry.id)!.currentHp }));
  const enemies = combatants.filter((c) => c.team === 'enemy' && c.current > 0);
  const allies = combatants.filter((c) => c.team === 'ally' && c.current > 0);
  const target = enemies[0];
  const intents = sessionIntents(session);
  const hasDanger = intents.some((i) => i.kind === 'attack' || i.kind === 'charge');
  const progressTarget = COMBAT_OBJECTIVE_RULES[definition.objective].progressTarget;
  const leave = checkLeaveAvailability(definition, state);
  const locked = paused || settling || state.phase !== 'player';
  const send = (command: CombatCommand) => {
    const at = performance.now();
    if (locked || at - lastPressAt.current < COMBAT_SETTLE_MS) return;
    lastPressAt.current = at;
    switch (command.kind) {
      case 'ATTACK': playCombatSound('attack', quiet); break;
      case 'GUARD': playCombatSound('guard', quiet); break;
      case 'TECHNIQUE': playCombatSound('technique', quiet); break;
      case 'ACT':
      case 'LEAVE': playCombatSound('act', quiet); break;
    }
    onCommand(command, session.turn);
  };
  const recent = session.log.slice(-3);

  return <section className={`combat-panel${quiet ? ' is-quiet' : ''}${hasDanger ? ' has-danger' : ''}`} data-testid="combat-panel" aria-label={`Encounter: ${title}`}>
    <header className="combat-head">
      <div className="combat-kicker">ENCOUNTER · ROUND {state.round}</div>
      <h2 data-testid="combat-title">{title}</h2>
      <p className="combat-objective" data-testid="combat-objective">{objectiveCopy}{progressTarget !== undefined && <strong> {state.objectiveProgress}/{progressTarget}</strong>}</p>
    </header>

    <ul className="combat-roster" aria-label="Combatants">
      {combatants.map((c) => <li key={c.id} className={`team-${c.team}${c.current <= 0 ? ' is-down' : ''}`} data-testid={`combatant-${c.id}`}>
        <span className="combat-name">{names[c.id] ?? c.id}</span>
        <meter min={0} max={c.maxHp} value={c.current} aria-label={`${names[c.id] ?? c.id} health`} />
        <span className="combat-hp">{c.current}/{c.maxHp}</span>
        {(state.combatants.find((s) => s.id === c.id)?.statuses ?? []).map((status) => <span key={status} className="combat-status">{status}</span>)}
      </li>)}
    </ul>

    {intents.length > 0 && <ul className="combat-intents" data-testid="combat-intents" aria-label="What they will do next">
      {intents.map((intent) => <li key={intent.enemyId}><span className="intent-glyph" aria-hidden="true">{INTENT_GLYPH[intent.kind] ?? '✦'}</span> {names[intent.enemyId] ?? intent.enemyId} {INTENT_COPY[intent.kind] ?? intent.kind}{intent.targetId && intent.kind !== 'charge' ? ` ${names[intent.targetId] ?? intent.targetId}` : ''}{intent.damage > 0 ? ` (${intent.damage})` : ''}</li>)}
    </ul>}

    <p className="combat-log" role="status" aria-live="polite" data-testid="combat-log">{recent.length ? recent.map((entry) => logLine(entry, names)).join(' ') : logLine(undefined, names)}</p>
    {paused && <p className="combat-paused" data-testid="combat-paused">Paused. Nothing moves until you resume.</p>}

    <div className="combat-commands" role="group" aria-label="Commands">
      <button type="button" data-testid="combat-attack" disabled={locked || !target} onClick={() => target && send({ kind: 'ATTACK', targetId: target.id })}>Attack</button>
      <button type="button" data-testid="combat-guard" disabled={locked} onClick={() => send({ kind: 'GUARD' })}>Guard</button>
      <button type="button" data-testid="combat-leave" className="combat-leave" disabled={locked || !leave.available} onClick={() => send({ kind: 'LEAVE' })}>Step away</button>
    </div>

    <div className="combat-options" role="group" aria-label={`Techniques, ${session.techniques.chargesRemaining} charges left`}>
      <span className="combat-options-label">Techniques · {session.techniques.chargesRemaining} left</span>
      {MVP_TECHNIQUES.map((technique) => {
        const pool = technique.context.targetTeam === 'ally' ? allies : enemies;
        const candidate = pool.find((c) => checkTechniqueAvailability(definition, state, session.techniques, technique.id, c.id).available);
        return <button type="button" key={technique.id} data-testid={`combat-technique-${technique.id}`} disabled={locked || !candidate} onClick={() => candidate && send({ kind: 'TECHNIQUE', techniqueId: technique.id, targetId: candidate.id })}>{technique.label}</button>;
      })}
    </div>

    {session.scenario.options.length > 0 && <div className="combat-options" role="group" aria-label="Act">
      <span className="combat-options-label">Act</span>
      {session.scenario.options.map((option) => {
        const targetId = option.targetTeam === 'none' ? undefined : (option.targetTeam === 'ally' ? allies : enemies)[0]?.id;
        const ok = resolveAct(definition, state, session.acts, session.scenario, option.id, targetId).accepted;
        return <button type="button" key={option.id} data-testid={`combat-act-${option.id}`} disabled={locked || !ok} onClick={() => send({ kind: 'ACT', actId: option.id, ...(targetId ? { targetId } : {}) })}>{option.label}</button>;
      })}
    </div>}
  </section>;
}
