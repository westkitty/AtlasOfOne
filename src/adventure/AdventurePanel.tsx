import { useState } from 'react';
import type { CombatCommand } from '../contracts/combat';
import { CombatPanel } from '../combat/CombatPanel';
import type { AdventurePlayView } from './play';
import './AdventurePanel.css';

export interface AdventurePanelProps {
  view: AdventurePlayView;
  paused: boolean;
  quiet: boolean;
  onContinue: () => void;
  onFaceEncounter: () => void;
  onCombatCommand: (command: CombatCommand, expectedTurn: number) => void;
  onToggleStop: () => void;
  onSerious: () => void;
  onHelp: () => void;
}

/**
 * The deterministic local adventure: scene copy, the one next step, and the
 * encounter when the story reaches it. Nothing here reads Journal text,
 * evidence or provider output.
 */
export function AdventurePanel({ view, paused, quiet, onContinue, onFaceEncounter, onCombatCommand, onToggleStop, onSerious, onHelp }: AdventurePanelProps) {
  const { scene, encounter, combat, encounterResolved, outcomeCopy } = view;
  const atEncounter = scene.role === 'encounter';
  const [minimized, setMinimized] = useState(false);
  const names: Record<string, string> = { greyson: 'Greyson' };
  if (combat) for (const c of combat.definition.combatants) if (c.team === 'enemy') names[c.id] = encounter.enemyName;

  if (minimized) {
    return <button type="button" className="adventure-resume-chip" data-testid="adventure-resume" onClick={() => setMinimized(false)}>
      {combat ? 'Encounter waiting' : 'Adventure in progress'} · Resume
    </button>;
  }

  return (
    <div className="adventure-overlay" data-testid="adventure-overlay">
    <section className="fallback-adventure-card" data-testid="fallback-adventure" data-beat={scene.role} aria-label="Local adventure scene">
      <button type="button" className="adventure-minimize" data-testid="adventure-minimize" onClick={() => setMinimized(true)}>Back to the world</button>
      <div className="fallback-adventure-kicker">LOCAL ADVENTURE · {scene.kicker}</div>
      <h2 data-testid="fallback-adventure-title">{scene.title}</h2>
      <p data-testid="fallback-adventure-body">{scene.body}</p>
      {!combat && <div className="fallback-adventure-suggestions" aria-label="Possible approaches">
        {scene.suggestions.map((suggestion) => <span key={suggestion}>{suggestion}</span>)}
      </div>}
      {atEncounter && !encounterResolved && !combat && <p className="adventure-encounter-intro" data-testid="adventure-encounter-intro"><strong>{encounter.name}.</strong> {encounter.intro}</p>}
      {outcomeCopy && !combat && <p className="adventure-outcome" data-testid="adventure-outcome">{outcomeCopy}</p>}
      {combat && <CombatPanel session={combat} title={encounter.name} objectiveCopy={encounter.objectiveCopy} names={names} paused={paused} quiet={quiet} onCommand={onCombatCommand} />}
      {!combat && <div className="adventure-actions">
        {atEncounter && !encounterResolved
          ? <button type="button" data-testid="adventure-face-encounter" disabled={paused} onClick={onFaceEncounter}>Face it</button>
          : <button type="button" data-testid="adventure-continue" disabled={paused} onClick={onContinue}>{scene.terminal ? 'Return to the world' : 'Continue'}</button>}
      </div>}
      <div className="agency adventure-agency" data-testid="adventure-agency" role="group" aria-label="Always-available controls">
        <button type="button" className={`agency-protect${paused ? ' is-active' : ''}`} data-testid="adventure-stop" aria-pressed={paused} onClick={onToggleStop}>{paused ? 'RESUME' : 'STOP'}</button>
        <button type="button" className={`agency-protect${quiet ? ' is-active' : ''}`} data-testid="adventure-serious" aria-pressed={quiet} onClick={onSerious}>SERIOUS</button>
        <button type="button" className="agency-util" data-testid="adventure-help" onClick={onHelp}>HELP</button>
      </div>
      <p className="fallback-adventure-note">Runs on this device. A fictional choice is not evidence about you.</p>
    </section>
    </div>
  );
}
