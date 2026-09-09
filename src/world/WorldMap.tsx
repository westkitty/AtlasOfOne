import { CAPE, MAINLAND, REGIONS, REGION_SHAPES, TRAIL_SHAPES, WORLD, regionFor, revealFor, type LandmarkKind, type Reveal } from './geography';
import type { CampaignState, TerritoryStatus } from '../game/types';

/**
 * The Greyson Map as a place.
 *
 * Presentation only. Every visual decision reads from `CampaignState`; nothing
 * here mutates it, computes progression, or decides what the player has earned.
 *
 * The map deliberately withholds: an unvisited region is an unnamed silhouette
 * under fog, and its landmark, name and trails appear only as evidence
 * accumulates. Watching the island resolve IS the reward, so it must not be
 * given away at turn zero.
 */

export interface WorldMapProps {
  state: CampaignState;
  facing: 'front' | 'back' | 'left' | 'right';
  travelling: boolean;
  /** Transient mark left by the answer that just committed. */
  mark: { xp: number; territoryId: string; key: number } | null;
  sprite: string;
  onSelectRegion?: (territoryId: string) => void;
  reducedMotion: boolean;
}

/** Small motifs that make a region a somewhere rather than a shape. */
function Landmark({ kind, x, y, detailed }: { kind: LandmarkKind; x: number; y: number; detailed: boolean }) {
  const common = { className: 'wm-landmark-ink' };
  switch (kind) {
    case 'city':
      return <g transform={`translate(${x} ${y})`} className="wm-landmark">
        <path {...common} d="M -26 6 L -26 -10 L -18 -10 L -18 -18 L -10 -18 L -10 -10 L 10 -10 L 10 -20 L 20 -20 L 20 -10 L 27 -10 L 27 6 Z" />
        <path {...common} d="M -20 6 L -20 -4 M -6 6 L -6 -2 M 8 6 L 8 -4 M 22 6 L 22 -2" />
        {detailed && <path {...common} d="M 20 -20 L 20 -30 L 32 -26 L 20 -22" />}
      </g>;
    case 'cairn':
      return <g transform={`translate(${x} ${y})`} className="wm-landmark">
        <path {...common} d="M -12 8 L 12 8 M -8 8 L -5 -2 L 5 -2 L 8 8 M -5 -2 L -3 -10 L 3 -10 L 5 -2 M -3 -10 L 0 -17 L 3 -10" />
        {detailed && <path {...common} d="M 0 -17 L 0 -24" />}
      </g>;
    case 'labyrinth':
      return <g transform={`translate(${x} ${y})`} className="wm-landmark">
        <path {...common} d="M 0 8 L 0 3 M -5 8 A 5 5 0 0 1 5 8 M -10 8 A 10 10 0 0 1 10 8 M -15 8 A 15 15 0 0 1 15 8" />
        {detailed && <path {...common} d="M -20 8 A 20 20 0 0 1 20 8" />}
      </g>;
    case 'stones':
      return <g transform={`translate(${x} ${y})`} className="wm-landmark">
        <path {...common} d="M -16 8 L -16 -6 A 4 4 0 0 1 -8 -6 L -8 8 Z M -3 8 L -3 -12 A 4 4 0 0 1 5 -12 L 5 8 Z M 11 8 L 11 -4 A 4 4 0 0 1 19 -4 L 19 8 Z" />
        {detailed && <path {...common} d="M -20 8 L 23 8" />}
      </g>;
    case 'settlement':
      return <g transform={`translate(${x} ${y})`} className="wm-landmark">
        <path {...common} d="M -18 8 L -18 0 L -11 -7 L -4 0 L -4 8 Z M 3 8 L 3 -3 L 10 -10 L 17 -3 L 17 8 Z" />
        {detailed && <path {...common} d="M -22 8 L 21 8 M -11 8 L -11 3 M 10 8 L 10 2" />}
      </g>;
    case 'grove':
      return <g transform={`translate(${x} ${y})`} className="wm-landmark">
        <path {...common} d="M -14 8 L -14 1 M -14 1 A 8 8 0 1 1 -14 0 Z M 6 8 L 6 -2 M 6 -2 A 10 10 0 1 1 6 -3 Z" />
        {detailed && <path {...common} d="M -22 8 L 18 8" />}
      </g>;
    case 'chasm':
      return <g transform={`translate(${x} ${y})`} className="wm-landmark">
        <path {...common} d="M -20 8 L -12 -8 L -6 4 L 0 -12 L 7 2 L 13 -6 L 20 8 Z" />
        {detailed && <path {...common} d="M -8 8 L -4 0 M 6 8 L 9 1" />}
      </g>;
    case 'lighthouse':
    default:
      return <g transform={`translate(${x} ${y})`} className="wm-landmark">
        <path {...common} d="M -7 8 L -4 -12 L 4 -12 L 7 8 Z M -6 -1 L 6 -1" />
        <path {...common} d="M -5 -12 L 5 -12 L 3 -18 L -3 -18 Z" />
        {detailed && <path {...common} d="M 6 -16 L 16 -20 M 6 -14 L 16 -10" />}
      </g>;
  }
}

const STATUS_WORD: Record<TerritoryStatus, string> = {
  fogged: 'Unknown', discovered: 'Glimpsed', exploring: 'Explored', charted: 'Charted', 'deeply-charted': 'Deeply charted'
};

export function WorldMap({ state, facing, travelling, mark, sprite, onSelectRegion, reducedMotion }: WorldMapProps) {
  const statusOf = (id: string) => state.territories.find((territory) => territory.id === id)?.status ?? 'fogged';
  const here = regionFor(state.activeTerritory);
  const activeTerritory = state.territories.find((territory) => territory.id === state.activeTerritory);

  /** A trail is only drawn once at least one end has been visited. */
  const trailReveal = (from: string, to: string): Reveal => {
    const a = revealFor(statusOf(from));
    const b = revealFor(statusOf(to));
    return a === 'hidden' || b === 'hidden' ? (a === 'hidden' && b === 'hidden' ? 'hidden' : 'glimpsed') : 'known';
  };

  return (
    <div className="world" data-testid="world" data-travelling={travelling ? 'true' : 'false'}>
      <svg
        className="world-svg"
        viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`The Greyson Map. ${state.territories.filter((t) => t.status !== 'fogged').length} of ${state.territories.length} regions discovered. Greyson is in ${activeTerritory?.label ?? 'the map'}.`}
      >
        <defs>
          <radialGradient id="wm-sea">
            <stop offset="0%" stopColor="#101b28" />
            <stop offset="100%" stopColor="#080d14" />
          </radialGradient>
          <filter id="wm-fog" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="26" />
            <feGaussianBlur stdDeviation="11" />
          </filter>
          <filter id="wm-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id="wm-here">
            <stop offset="0%" stopColor="#e8d3a0" stopOpacity="0.30" />
            <stop offset="70%" stopColor="#e8d3a0" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#e8d3a0" stopOpacity="0" />
          </radialGradient>
          <pattern id="wm-swell" width="26" height="16" patternUnits="userSpaceOnUse">
            <path d="M 0 8 Q 6.5 2, 13 8 T 26 8" fill="none" stroke="#1b2b3d" strokeWidth="0.8" />
          </pattern>
        </defs>

        <rect className="wm-sea" width={WORLD.width} height={WORLD.height} fill="url(#wm-sea)" />
        <rect width={WORLD.width} height={WORLD.height} fill="url(#wm-swell)" opacity="0.5" />

        {/* Land */}
        <path className="wm-coast-glow" d={MAINLAND} filter="url(#wm-soft)" />
        <path className="wm-land" d={MAINLAND} />
        <path className="wm-coast-glow" d={CAPE} filter="url(#wm-soft)" />
        <path className="wm-land" d={CAPE} />

        {/* Trails. Sea crossings are dashed because they are not walked. */}
        <g className="wm-trails">
          {TRAIL_SHAPES.map((trail) => {
            const reveal = trailReveal(trail.from, trail.to);
            if (reveal === 'hidden') return null;
            return <path
              key={`${trail.from}-${trail.to}`}
              className={`wm-trail is-${reveal}${trail.sea ? ' is-sea' : ''}`}
              d={trail.d}
              data-testid={`trail-${trail.from}-${trail.to}`}
            />;
          })}
        </g>

        {/* Regions */}
        <g className="wm-regions">
          {REGIONS.map((region) => {
            const territory = state.territories.find((item) => item.id === region.id);
            if (!territory) return null;
            const isHere = territory.id === state.activeTerritory;
            // You can always see the ground you are standing on, even before any
            // evidence exists for it. That is sight, not progression.
            const surveyed = revealFor(territory.status);
            const reveal: Reveal = isHere && surveyed === 'hidden' ? 'glimpsed' : surveyed;
            const covered = territory.coveredDimensions.length;
            const total = territory.requiredDimensions.length;
            const named = reveal !== 'hidden';
            const label = named
              ? `${territory.label}: ${STATUS_WORD[territory.status]}, ${covered} of ${total} mapped${isHere ? ', Greyson is here' : ''}`
              : 'Unexplored country';

            return <g
              key={region.id}
              className={`wm-region r-${territory.status} rv-${reveal}${isHere ? ' is-here' : ''}`}
              data-testid={`region-${region.id}`}
              data-status={territory.status}
              data-reveal={reveal}
              role={onSelectRegion ? 'button' : undefined}
              tabIndex={onSelectRegion && named ? 0 : undefined}
              aria-label={label}
              aria-current={isHere ? 'true' : undefined}
              onClick={onSelectRegion && named ? () => onSelectRegion(region.id) : undefined}
              onKeyDown={onSelectRegion && named ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectRegion(region.id); }
              } : undefined}
            >
              <path className="wm-region-fill" d={REGION_SHAPES[region.id]} />
              <path className="wm-region-edge" d={REGION_SHAPES[region.id]} />
              {reveal !== 'hidden' && <Landmark kind={region.landmark} x={region.centre.x} y={region.centre.y - 4} detailed={reveal === 'detailed'} />}
              {named && <text className="wm-region-name" x={region.centre.x} y={region.centre.y + region.ry - 6} textAnchor="middle">{territory.label}</text>}
              {reveal === 'detailed' && <text className="wm-region-sub" x={region.centre.x} y={region.centre.y + region.ry + 6} textAnchor="middle">{covered}/{total}</text>}
            </g>;
          })}
        </g>

        {/* Fog rolls over everything not yet known, above the land it hides. */}
        <g className="wm-fogbank" aria-hidden="true">
          {REGIONS.map((region) => {
            const isHere = region.id === state.activeTerritory;
            const surveyed = revealFor(statusOf(region.id));
            const reveal: Reveal = isHere && surveyed === 'hidden' ? 'glimpsed' : surveyed;
            if (reveal === 'detailed' || reveal === 'known') return null;
            return <path
              key={region.id}
              className={`wm-fog is-${reveal}`}
              data-testid={`fog-${region.id}`}
              d={REGION_SHAPES[region.id]}
              filter="url(#wm-fog)"
              transform={`translate(${region.centre.x} ${region.centre.y}) scale(1.3) translate(${-region.centre.x} ${-region.centre.y})`}
            />;
          })}
        </g>

        <circle className="wm-here-glow" cx={here.stand.x} cy={here.stand.y - 8} r={64} fill="url(#wm-here)" aria-hidden="true" />
        {mark && <circle key={mark.key} className="wm-ping" cx={regionFor(mark.territoryId).stand.x} cy={regionFor(mark.territoryId).stand.y - 6} r={16} aria-hidden="true" />}
      </svg>

      {/* Greyson lives on the island. He walks; he does not teleport. */}
      <div
        className={`avatar world-greyson face-${facing}${travelling ? ' is-walking' : ''}`}
        data-testid="world-greyson"
        data-territory={state.activeTerritory}
        style={{
          left: `${(here.stand.x / WORLD.width) * 100}%`,
          top: `${(here.stand.y / WORLD.height) * 100}%`,
          transitionDuration: reducedMotion ? '0ms' : undefined
        }}
      >
        <img src={sprite} alt={`Greyson, in ${activeTerritory?.label ?? 'the map'}`} draggable={false} />
      </div>

      {mark && <div
        key={mark.key}
        className="world-mark"
        data-testid="world-mark"
        style={{
          left: `${(regionFor(mark.territoryId).stand.x / WORLD.width) * 100}%`,
          top: `${(regionFor(mark.territoryId).stand.y / WORLD.height) * 100}%`
        }}
        aria-hidden="true"
      >+{mark.xp}</div>}
    </div>
  );
}
