import type { ReactNode } from 'react';
import type { BossRunState, BossStage, CampaignState, DoorRunState } from '../game/types';

const GREYSON_PORTRAITS = { neutral: '/assets/atlas/v3/greyson/portrait-neutral.png', serious: '/assets/atlas/v3/greyson/portrait-serious.png', wry: '/assets/atlas/v3/greyson/portrait-wry.png' } as const;

export interface EncounterPresentation {
  kind: 'boss' | 'door'; heading: string; title?: string; step: string; dimension: string; question: string; evidenceClaims: string[];
}
export interface EncounterPanelProps {
  encounter: EncounterPresentation; state: CampaignState; bossRun: BossRunState | null; bossStage: BossStage | null | undefined; doorRun: DoorRunState | null;
  territoryLabels: Record<string, string>; reply: string; answer: string; quiet: boolean; isOffline: boolean; agencyControls: ReactNode;
  onAnswerChange: (answer: string) => void; onSubmit: () => void; onLeave: () => void;
}

export function EncounterPanel({ encounter, state, bossRun, bossStage, doorRun, territoryLabels, reply, answer, quiet, isOffline, agencyControls, onAnswerChange, onSubmit, onLeave }: EncounterPanelProps) {
  const isBoss = encounter.kind === 'boss';
  const portrait = quiet || isBoss ? GREYSON_PORTRAITS.serious : (state.settings.sass === 'risks-understood' ? GREYSON_PORTRAITS.wry : GREYSON_PORTRAITS.neutral);
  return <section className={`screen encounter-screen ${isBoss ? 'is-boss-arena' : 'is-door-chamber'}`} data-testid={`encounter-${encounter.kind}`}>
    <div className="eyebrow">{isBoss ? 'BOSS FIGHT' : 'MYSTERY DOOR'}</div><header><div><h1 className="screen-title">{encounter.kind === 'door' ? encounter.title : encounter.heading}</h1><p>{encounter.step}{encounter.kind === 'boss' ? ' · your own mapped positions, put under load' : ' · optional to open, safe to close'}</p></div>{quiet && <span className="chip">{state.presentation}</span>}{isOffline && <span className="chip offline" data-testid="offline-indicator">Offline</span>}</header>
    <div className="encounter-stage-frame" aria-hidden="true"><div className="encounter-portrait"><img src={portrait} alt="Greyson" draggable={false} /></div><div className="encounter-stage-meta"><span className="encounter-sigil-badge"><i className="encounter-sigil-glyph">{isBoss ? '🔥' : '◈'}</i><strong>{isBoss ? 'Trial Monolith' : 'Threshold Portal'}</strong></span><span className="encounter-dimension-badge">{encounter.dimension}</span></div></div>
    {encounter.kind === 'boss' && bossRun && <ol className="stage-track" aria-label={`Boss Fight progress: ${encounter.step}`}>{bossRun.stages.map((stage, index) => { const current = bossRun.stages.indexOf(bossStage!) === index; const cleared = stage.outcome !== 'pending'; return <li key={stage.id} className={cleared ? 'done' : current ? 'now' : 'next'} aria-current={current ? 'step' : undefined}><span aria-hidden="true">{cleared ? '✓' : index + 1}</span></li>; })}</ol>}
    {encounter.kind === 'door' && doorRun && <div className="crossing" aria-hidden="true"><span>{territoryLabels[doorRun.territoryIds[0]] ?? doorRun.territoryIds[0]}</span><i>⟷</i><span>{territoryLabels[doorRun.territoryIds[1]] ?? doorRun.territoryIds[1]}</span></div>}
    <article className={`card encounter ${encounter.kind}`}>{reply && <p className="reply" role="status">{reply}</p>}<h2>{encounter.question}</h2>{encounter.evidenceClaims.length > 0 && <><p className="evidence-caption">From evidence you already mapped</p><ul className="evidence-list">{encounter.evidenceClaims.map((claim, index) => <li key={index}>{claim}</li>)}</ul></>}<small>Dimension: {encounter.dimension}</small></article>
    {state.sessionStatus === 'paused' && <div className="quiet">Session paused. Your Atlas is safe.</div>}<label className="answer">Your position<textarea rows={4} value={answer} onChange={(e) => onAnswerChange(e.target.value)} disabled={state.sessionStatus === 'paused'} data-testid="encounter-input" /></label><button className="primary full" data-testid="encounter-submit" onClick={onSubmit} disabled={!answer.trim() || state.sessionStatus === 'paused'}>{encounter.kind === 'boss' ? 'Hold this position' : 'Walk through'}</button><button className="full leave" data-testid="encounter-leave" onClick={onLeave}>{encounter.kind === 'boss' ? 'Step back for now' : 'Close the door for now'}</button><p className="safe-note">PASS clears {encounter.kind === 'boss' ? 'a stage' : 'this crossing'} at no cost. Stepping back keeps every point you have earned.</p>{agencyControls}
  </section>;
}
