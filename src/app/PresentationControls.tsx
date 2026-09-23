import type { Ref } from 'react';
import type { SassLevel } from '../game/types';

export interface ProgressDisplayProps {
  xp: number;
  level: number;
  atMaxLevel: boolean;
  current: number;
  required: number;
  percent: number;
}

export function ProgressDisplay({ xp, level, atMaxLevel, current, required, percent }: ProgressDisplayProps) {
  return (
    <div className="xp">
      <div className="xp-head">
        <span>XP {xp}</span>
        <b className="level">L{level}</b>
        <span className="xp-into">{atMaxLevel ? 'Highest level reached' : `${current} / ${required} to L${level + 1}`}</span>
      </div>
      <div className="xp-track"><i style={{ width: `${atMaxLevel ? 100 : percent}%` }} /></div>
    </div>
  );
}

export interface AgencyControlsProps {
  paused: boolean;
  quiet: boolean;
  onPass: () => void;
  onPrivate: () => void;
  onStopToggle: () => void;
  onSerious: () => void;
  onHelp: () => void;
  onSass: () => void;
}

export function AgencyControls({
  paused,
  quiet,
  onPass,
  onPrivate,
  onStopToggle,
  onSerious,
  onHelp,
  onSass
}: AgencyControlsProps) {
  return (
    <div className="agency" data-testid="agency" role="group" aria-label="Always-available controls">
      <button className="agency-util" data-testid="agency-pass" onClick={onPass}>PASS</button>
      <button className="agency-protect" data-testid="agency-private" onClick={onPrivate}>PRIVATE</button>
      <button className={`agency-protect${paused ? ' is-active' : ''}`} data-testid="agency-stop" aria-pressed={paused} onClick={onStopToggle}>{paused ? 'RESUME' : 'STOP'}</button>
      <button className={`agency-protect${quiet ? ' is-active' : ''}`} data-testid="agency-serious" aria-pressed={quiet} onClick={onSerious}>SERIOUS</button>
      <button className="agency-util" data-testid="agency-help" onClick={onHelp}>HELP</button>
      <button className="agency-util" data-testid="agency-sass" onClick={onSass}>SASS</button>
    </div>
  );
}

export interface AgencySheetProps {
  open: boolean;
  sheetRef: Ref<HTMLDivElement>;
  paused: boolean;
  quiet: boolean;
  sass: SassLevel;
  onClose: () => void;
  onStopToggle: () => void;
  onPrivate: () => void;
  onSerious: () => void;
  onHelp: () => void;
  onSass: () => void;
  onStatus: () => void;
}

export function AgencySheet({
  open,
  sheetRef,
  paused,
  quiet,
  sass,
  onClose,
  onStopToggle,
  onPrivate,
  onSerious,
  onHelp,
  onSass,
  onStatus
}: AgencySheetProps) {
  if (!open) return null;
  return (
    <div ref={sheetRef} className="more-sheet" data-testid="more-sheet" role="dialog" aria-label="Agency controls and moves" onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
      <div className="more-head">
        <span className="eyebrow">ALWAYS AVAILABLE</span>
        <button className="more-close" data-testid="more-close" aria-label="Close controls" onClick={onClose}>×</button>
      </div>
      <div className="agency" data-testid="agency" role="group" aria-label="Always-available controls">
        <button className={`agency-protect${paused ? ' is-active' : ''}`} data-testid="agency-stop" aria-pressed={paused} onClick={onStopToggle}>{paused ? 'RESUME' : 'STOP'}</button>
        <button className="agency-protect" data-testid="agency-private" onClick={onPrivate}>PRIVATE</button>
        <button className={`agency-protect${quiet ? ' is-active' : ''}`} data-testid="agency-serious" aria-pressed={quiet} onClick={onSerious}>SERIOUS</button>
        <button className="agency-util" data-testid="agency-help" onClick={onHelp}>HELP</button>
        <button className="agency-util" data-testid="agency-sass" onClick={onSass}>SASS</button>
        <button className="agency-util" data-testid="agency-status" onClick={onStatus}>STATUS</button>
      </div>
      <p className="more-note">Sass: {sass}. None of these cost you progress.</p>
    </div>
  );
}

export interface PrimaryActionMove {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

export interface PrimaryActionBarProps {
  paused: boolean;
  moves: PrimaryActionMove[];
  moreOpen: boolean;
  onResume: () => void;
  onPass: () => void;
  onToggleMore: () => void;
}

export function PrimaryActionBar({
  paused,
  moves,
  moreOpen,
  onResume,
  onPass,
  onToggleMore
}: PrimaryActionBarProps) {
  return (
    <div className="action-bar" data-testid="action-bar" role="group" aria-label="Encounter actions">
      {paused
        ? <button className="action action-resume" data-testid="action-resume" onClick={onResume}>Resume</button>
        : <button className="action" data-testid="agency-pass" onClick={onPass}>Pass</button>}
      {moves.slice(0, 2).map((move) => (
        <button key={move.id} className="action action-move" data-testid={`move-${move.id}`} aria-label={`${move.label}: ${move.hint}`} onClick={move.run} disabled={paused}>{move.label}</button>
      ))}
      <button className="action action-more" data-testid="action-more" aria-expanded={moreOpen} aria-haspopup="dialog" aria-label="More controls, including stop, private and serious" onClick={onToggleMore}>More</button>
    </div>
  );
}
