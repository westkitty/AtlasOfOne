import type { ReactNode } from 'react';
import type { PresentationNotice } from '../game/types';

const MILESTONE_EYEBROW: Record<PresentationNotice['kind'], string> = {
  level: 'LEVEL UP', unlock: 'NEW ABILITY', quest: 'QUEST COMPLETE',
  fragment: 'ARTIFACT RECOVERED', territory: 'TERRITORY CHARTED', achievement: 'ACHIEVEMENT'
};
const MILESTONE_GLYPH: Record<PresentationNotice['kind'], string> = {
  level: '▲', unlock: '✦', quest: '◆', fragment: '◈', territory: '★', achievement: '✧'
};
const MILESTONE_ICON: Record<PresentationNotice['kind'], string> = {
  level: '/assets/atlas/v3/ui/level-up.png',
  unlock: '/assets/atlas/v3/ui/ability-unlocked.png',
  quest: '/assets/atlas/v3/ui/quest-complete.png',
  fragment: '/assets/atlas/v3/ui/artifact-recovered.png',
  territory: '/assets/atlas/v3/ui/territory-charted.png',
  achievement: '/assets/atlas/v3/ui/achievement.png'
};

export function ProgressPresentation({ xp, level, current, required, atMaxLevel, percent }: { xp: number; level: number; current: number; required: number; atMaxLevel: boolean; percent: number }) {
  return <div className="xp">
    <div className="xp-head">
      <span>XP {xp}</span><b className="level">L{level}</b>
      <span className="xp-into">{atMaxLevel ? 'Highest level reached' : `${current} / ${required} to L${level + 1}`}</span>
    </div>
    <div className="xp-track"><i style={{ width: `${atMaxLevel ? 100 : percent}%` }} /></div>
  </div>;
}

export function MilestoneBanners({ notices, quiet }: { notices: PresentationNotice[]; quiet: boolean }) {
  if (notices.length === 0) return null;
  return <div className={`banners${quiet ? ' is-quiet' : ''}`} data-testid="milestone" role="status" aria-live="polite">
    {notices.map((notice, index) => <article key={notice.id} className={`banner kind-${notice.kind}`} data-testid={`milestone-item-${notice.kind}`} style={{ animationDelay: `${index * 90}ms` }}>
      <b aria-hidden="true" className="banner-glyph">
        <img src={MILESTONE_ICON[notice.kind]} alt="" className="banner-icon-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <span className="banner-icon-fallback">{MILESTONE_GLYPH[notice.kind]}</span>
      </b>
      <div><span className="banner-eyebrow">{MILESTONE_EYEBROW[notice.kind]}</span><strong {...(index === 0 ? { 'data-testid': 'milestone-title' } : {})}>{notice.title}</strong>{notice.kind === 'level' && <small>{notice.detail}</small>}</div>
    </article>)}
  </div>;
}

export function AppSheet({ title, children, onBack }: { title: string; children: ReactNode; onBack: () => void }) {
  return <div className="sheet" data-testid="sheet"><div className="sheet-bar"><button className="sheet-back" data-testid="close-sheet" aria-label="Back to the map" onClick={onBack}><span aria-hidden="true">←</span> Map</button><span className="sheet-title">{title}</span></div><div className="sheet-body">{children}</div></div>;
}
