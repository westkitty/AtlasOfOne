import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHARACTER, LAYERS, REGIONS, WORLD, asset, layerOpacity, pointAlong,
  regionFor, revealFor, routeBetween, routeLength, type Point, type Reveal
} from './geography';
import type { CampaignState, TerritoryStatus } from '../game/types';

/**
 * The Greyson Map.
 *
 * Presentation only. Every visual decision reads from `CampaignState`; nothing
 * here mutates it, awards anything, or decides what the player has earned.
 *
 * The island is ONE piece of art shown at three levels of resolution. A region
 * becoming known does not swap in a different picture of that region — it fades
 * the same island up through `glimpsed` and `revealed`, masked to that region's
 * own soft footprint. That is why the map has no visible seams between
 * territories: there are no per-region pictures to seam.
 */

export interface WorldMapProps {
  state: CampaignState;
  facing: 'front' | 'back' | 'left' | 'right';
  travelling: boolean;
  /** Where the expedition is walking from, when a journey is in progress. */
  travelFrom?: string | null;
  /** Transient mark left by the answer that just committed. */
  mark: { xp: number; territoryId: string; key: number } | null;
  onSelectRegion?: (territoryId: string) => void;
  /** Regions the player may legitimately travel to right now. */
  reachable?: string[];
  reducedMotion: boolean;
}

const STATUS_WORD: Record<TerritoryStatus, string> = {
  fogged: 'Unknown', discovered: 'Glimpsed', exploring: 'Explored',
  charted: 'Charted', 'deeply-charted': 'Deeply charted'
};

/** Direction of travel picks the animation family; right mirrors left. */
function familyFor(facing: string, moving: boolean) {
  const base = facing === 'right' ? 'left' : facing;
  return `${moving ? 'walk' : 'idle'}-${base}`;
}

/**
 * Cycle an animation's frames.
 *
 * Reduced motion holds frame 00, which every animation authors as a readable
 * still, so the character is never mid-stride when motion is suppressed.
 */
function useAnimationFrame(family: string, reducedMotion: boolean) {
  const animations = CHARACTER.animations as Record<string, { frames: number; fps: number } | undefined>;
  const spec = animations[family] ?? animations['idle-front'];
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    if (reducedMotion || !spec || spec.frames <= 1) return;
    const timer = window.setInterval(() => setFrame((f) => (f + 1) % spec.frames), Math.round(1000 / spec.fps));
    return () => window.clearInterval(timer);
  }, [family, reducedMotion, spec]);
  return frame;
}

/** Preload every frame once, so a walk cycle never flickers on first play. */
function usePreloadedFrames() {
  useEffect(() => {
    const animations = CHARACTER.animations as Record<string, { frames: number; src: string }>;
    const images: HTMLImageElement[] = [];
    for (const spec of Object.values(animations)) {
      for (let index = 0; index < spec.frames; index += 1) {
        const img = new Image();
        img.src = asset(spec.src.replace('{n}', String(index).padStart(2, '0')));
        images.push(img);
      }
    }
    return () => { images.length = 0; };
  }, []);
}

export function WorldMap({
  state, facing, travelling, travelFrom, mark, onSelectRegion, reachable = [], reducedMotion
}: WorldMapProps) {
  usePreloadedFrames();
  const here = regionFor(state.activeTerritory);
  const activeTerritory = state.territories.find((t) => t.id === state.activeTerritory);

  const family = familyFor(facing, travelling);
  const frame = useAnimationFrame(family, reducedMotion);
  const animations = CHARACTER.animations as Record<string, { frames: number; src: string } | undefined>;
  const spec = animations[family] ?? animations['idle-front']!;
  const sprite = asset(spec.src.replace('{n}', String(Math.min(frame, spec.frames - 1)).padStart(2, '0')));

  /**
   * Walk the route rather than sliding across the terrain.
   *
   * The journey is paced by the actual length of the trail, so a long crossing
   * takes longer than a short one, with an upper bound so travel never becomes
   * tedious. Reduced motion arrives immediately.
   */
  const route = useMemo(
    () => (travelling && travelFrom ? routeBetween(travelFrom, state.activeTerritory) : null),
    [travelling, travelFrom, state.activeTerritory]
  );
  const [progress, setProgress] = useState(1);
  const raf = useRef(0);

  useEffect(() => {
    if (!route || reducedMotion) { setProgress(1); return; }
    const duration = Math.min(2600, Math.max(900, routeLength(route) * 7));
    const start = performance.now();
    setProgress(0);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setProgress(t);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [route, reducedMotion]);

  const position: Point = route && progress < 1 ? pointAlong(route, progress) : here.stand;
  const left = `${(position.x / WORLD.width) * 100}%`;
  const top = `${(position.y / WORLD.height) * 100}%`;

  const statusOf = (id: string) => state.territories.find((t) => t.id === id)?.status ?? 'fogged';
  const discovered = state.territories.filter((t) => t.status !== 'fogged').length;

  return (
    <div className="world" data-testid="world" data-travelling={travelling ? 'true' : 'false'} data-pack={CHARACTER.anchor}>
      <div
        className="world-frame"
        style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
        role="img"
        aria-label={`The Greyson Map. ${discovered} of ${state.territories.length} regions discovered. Greyson is in ${activeTerritory?.label ?? 'the map'}.`}
      >
        {/* One island, three resolutions. Unknown country stays a silhouette. */}
        <img className="world-layer" src={asset(LAYERS.hidden)} alt="" draggable={false} />
        {REGIONS.map((region) => {
          const reveal: Reveal = revealFor(statusOf(region.id));
          const { glimpsed, revealed } = layerOpacity(reveal);
          if (glimpsed === 0 && revealed === 0) return null;
          const maskUrl = `url(${asset(region.mask)})`;
          const maskStyle = {
            maskImage: maskUrl, WebkitMaskImage: maskUrl,
            maskSize: '100% 100%', WebkitMaskSize: '100% 100%'
          } as const;
          return (
            <div key={region.id} data-testid={`region-${region.id}`} data-status={statusOf(region.id)} data-reveal={reveal}>
              {glimpsed > 0 && (
                <img className="world-layer" style={{ ...maskStyle, opacity: glimpsed }}
                     src={asset(LAYERS.glimpsed)} alt="" draggable={false} />
              )}
              {revealed > 0 && (
                <img className="world-layer" style={{ ...maskStyle, opacity: revealed }}
                     src={asset(LAYERS.revealed)} alt="" draggable={false} />
              )}
            </div>
          );
        })}

        {/* Fog sits over what is still unknown, and drifts. */}
        <div className={`world-fog${reducedMotion ? ' is-still' : ''}`} aria-hidden="true" />

        {/* Places. Named only once seen; reachable ones invite a journey. */}
        {REGIONS.map((region) => {
          const status = statusOf(region.id);
          const reveal = revealFor(status);
          const isHere = region.id === state.activeTerritory;
          const named = reveal !== 'hidden' || isHere;
          const canGo = reachable.includes(region.id) && !isHere;
          const territory = state.territories.find((t) => t.id === region.id);
          const label = named
            ? `${region.label}: ${STATUS_WORD[status]}, ${territory?.coveredDimensions.length ?? 0} of ${territory?.requiredDimensions.length ?? 0} mapped${isHere ? ', Greyson is here' : ''}${canGo ? '. Travel here' : ''}`
            : 'Unexplored country';
          return (
            <button
              key={region.id}
              type="button"
              className={`world-place${isHere ? ' is-here' : ''}${canGo ? ' can-travel' : ''}${!named && !canGo ? ' is-unknown' : ''}`}
              data-testid={`place-${region.id}`}
              data-reachable={canGo ? 'true' : 'false'}
              aria-label={label}
              aria-current={isHere ? 'true' : undefined}
              disabled={!named && !canGo}
              style={{ left: `${(region.centre.x / WORLD.width) * 100}%`, top: `${(region.centre.y / WORLD.height) * 100}%` }}
              onClick={() => onSelectRegion?.(region.id)}
            >
              {named && <span className="world-place-name">{region.label}</span>}
            </button>
          );
        })}

        {mark && (
          <div key={mark.key} className="world-mark" data-testid="world-mark" aria-hidden="true"
               style={{ left: `${(regionFor(mark.territoryId).stand.x / WORLD.width) * 100}%`,
                        top: `${(regionFor(mark.territoryId).stand.y / WORLD.height) * 100}%` }}>
            +{mark.xp}
          </div>
        )}

        {/* Greyson lives on the island. He walks the trails; he does not teleport. */}
        <div
          className={`avatar world-greyson face-${facing}${travelling ? ' is-walking' : ''}`}
          data-testid="world-greyson"
          data-territory={state.activeTerritory}
          data-animation={family}
          style={{ left, top }}
        >
          <img src={sprite} alt={`Greyson, in ${activeTerritory?.label ?? 'the map'}`} draggable={false} />
        </div>
      </div>
    </div>
  );
}
