import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHARACTER,
  LAYERS,
  REGIONS,
  WORLD,
  asset,
  layerOpacity,
  pointAlong,
  regionFor,
  revealFor,
  routeBetween,
  routeLength,
  type Point,
  type Reveal
} from './geography';
import type { CampaignState, TerritoryStatus } from '../game/types';
import { OverworldCanvas } from './OverworldCanvas';
import { TouchControls } from './TouchControls';
import {
  updatePlayer,
  type InteractableTarget,
  type PlayerState
} from './playerController';
import {
  initAudio,
  playAmbientTick,
  playFootstep,
  playStinger
} from './audio';
import {
  interiorFor,
  isInteriorWalkable,
  findNearbyInteriorProp,
  isAtDoorwayExit,
  type InteriorProp
} from './interiors';
import { InteriorCanvas } from './InteriorCanvas';
import { sanctuaryFor } from './sanctuaries';

export interface WorldMapProps {
  state: CampaignState;
  facing: 'front' | 'back' | 'left' | 'right';
  travelling: boolean;
  travelFrom?: string | null;
  mark: { xp: number; territoryId: string; key: number } | null;
  onSelectRegion?: (territoryId: string) => void;
  reachable?: string[];
  reducedMotion: boolean;
  onInteract?: (target: InteractableTarget | null) => void;
  controlsDisabled?: boolean;
  activeInterior?: string | null;
  onInteriorChange?: (interiorId: string | null) => void;
}

const STATUS_WORD: Record<TerritoryStatus, string> = {
  fogged: 'Unknown',
  discovered: 'Glimpsed',
  exploring: 'Explored',
  charted: 'Charted',
  'deeply-charted': 'Deeply charted'
};

function familyFor(facing: string, moving: boolean) {
  const base = facing === 'right' ? 'left' : facing;
  return `${moving ? 'walk' : 'idle'}-${base}`;
}

function usePreloadedFrames() {
  useEffect(() => {
    const animations = CHARACTER.animations as Record<
      string,
      { frames: number; src: string }
    >;
    const images: HTMLImageElement[] = [];
    for (const spec of Object.values(animations)) {
      for (let index = 0; index < spec.frames; index += 1) {
        const img = new Image();
        img.src = asset(spec.src.replace('{n}', String(index).padStart(2, '0')));
        images.push(img);
      }
    }
    return () => {
      images.length = 0;
    };
  }, []);
}

export function WorldMap({
  state,
  facing,
  travelling,
  travelFrom,
  mark,
  onSelectRegion,
  reachable = [],
  reducedMotion,
  onInteract,
  controlsDisabled = false,
  activeInterior = null,
  onInteriorChange
}: WorldMapProps) {
  usePreloadedFrames();

  const here = regionFor(state.activeTerritory);
  const activeTerritory = state.territories.find((t) => t.id === state.activeTerritory);
  const isQuiet = state.presentation === 'quiet';

  // Player state
  const [player, setPlayer] = useState<PlayerState>(() => ({
    x: here.stand.x,
    y: here.stand.y,
    facing,
    isMoving: false,
    territoryId: state.activeTerritory,
    nearbyTarget: null
  }));

  const inputVectorRef = useRef({ x: 0, y: 0 });

  // Route calculation for fast-travel
  const route = useMemo(
    () => (travelling && travelFrom ? routeBetween(travelFrom, state.activeTerritory) : null),
    [travelling, travelFrom, state.activeTerritory]
  );
  const [progress, setProgress] = useState(1);
  const raf = useRef(0);

  useEffect(() => {
    if (!route || reducedMotion) {
      setProgress(1);
      return;
    }
    const duration = Math.min(2600, Math.max(900, routeLength(route) * 7));
    const start = performance.now();
    setProgress(0);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setProgress(t);
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        const dest = regionFor(state.activeTerritory).stand;
        setPlayer((prev) => ({
          ...prev,
          x: dest.x,
          y: dest.y,
          isMoving: false,
          territoryId: state.activeTerritory
        }));
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [route, reducedMotion, state.activeTerritory]);

  // Update position along fast travel route if active
  useEffect(() => {
    if (route && progress < 1) {
      const pt = pointAlong(route, progress);
      setPlayer((prev) => ({
        ...prev,
        x: pt.x,
        y: pt.y,
        isMoving: true,
        territoryId: state.activeTerritory
      }));
    }
  }, [route, progress, state.activeTerritory]);

  // Interior player state & prop inspection
  const [interiorPlayer, setInteriorPlayer] = useState<{
    x: number;
    y: number;
    facing: 'front' | 'back' | 'left' | 'right';
    isMoving: boolean;
  }>({ x: 180, y: 280, facing: 'back', isMoving: false });

  const [activeProp, setActiveProp] = useState<InteriorProp | null>(null);

  // Position player at entrance when entering interior
  useEffect(() => {
    if (activeInterior) {
      const room = interiorFor(activeInterior);
      setInteriorPlayer({
        x: room.spawnPoint.x,
        y: room.spawnPoint.y,
        facing: 'back',
        isMoving: false
      });
      setActiveProp(null);
    }
  }, [activeInterior]);

  const currentRoom = activeInterior ? interiorFor(activeInterior) : null;
  const nearbyInteriorProp = currentRoom
    ? findNearbyInteriorProp(interiorPlayer.x, interiorPlayer.y, currentRoom)
    : null;
  const isAtDais = currentRoom
    ? Math.hypot(
        interiorPlayer.x - currentRoom.cartographerDais.x,
        interiorPlayer.y - currentRoom.cartographerDais.y
      ) < 38
    : false;
  const isAtDoor = currentRoom
    ? isAtDoorwayExit(interiorPlayer.x, interiorPlayer.y, currentRoom)
    : false;

  const interiorTarget: InteractableTarget | null = useMemo(() => {
    if (!currentRoom) return null;
    if (nearbyInteriorProp) {
      return {
        type: 'prop',
        id: nearbyInteriorProp.id,
        label: nearbyInteriorProp.label,
        x: nearbyInteriorProp.x,
        y: nearbyInteriorProp.y,
        distance: 0,
        inscription: nearbyInteriorProp.inscription
      };
    }
    if (isAtDais) {
      return {
        type: 'landmark',
        id: currentRoom.territoryId,
        label: currentRoom.cartographerDais.label,
        x: currentRoom.cartographerDais.x,
        y: currentRoom.cartographerDais.y,
        distance: 0
      };
    }
    if (isAtDoor) {
      return {
        type: 'exit',
        id: 'doorway-exit',
        label: 'Exit to Island',
        x: currentRoom.doorway.x,
        y: currentRoom.doorway.y,
        distance: 0
      };
    }
    return null;
  }, [currentRoom, nearbyInteriorProp, isAtDais, isAtDoor]);

  // Main real-time player movement loop (overworld or interior)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (activeInterior && currentRoom) {
        // Interior movement loop
        if (!controlsDisabled && !activeProp) {
          const input = inputVectorRef.current;
          if (input.x !== 0 || input.y !== 0) {
            setInteriorPlayer((curr) => {
              const speed = 90;
              const nextX = curr.x + input.x * speed * dt;
              const nextY = curr.y + input.y * speed * dt;
              const nextFacing =
                Math.abs(input.x) > Math.abs(input.y)
                  ? input.x > 0
                    ? 'right'
                    : 'left'
                  : input.y > 0
                  ? 'front'
                  : 'back';

              let actualX = curr.x;
              let actualY = curr.y;

              if (isInteriorWalkable(nextX, nextY, currentRoom)) {
                actualX = nextX;
                actualY = nextY;
              } else if (isInteriorWalkable(nextX, curr.y, currentRoom)) {
                actualX = nextX;
              } else if (isInteriorWalkable(curr.x, nextY, currentRoom)) {
                actualY = nextY;
              }

              const isMoving = actualX !== curr.x || actualY !== curr.y;
              if (isMoving) {
                playFootstep('stone');
              }
              return {
                x: actualX,
                y: actualY,
                facing: nextFacing,
                isMoving
              };
            });
          } else {
            setInteriorPlayer((curr) => (curr.isMoving ? { ...curr, isMoving: false } : curr));
          }
        }
      } else {
        // Overworld movement loop (when not on a fast-travel route)
        if ((!route || progress >= 1) && !controlsDisabled) {
          const input = inputVectorRef.current;
          if (input.x !== 0 || input.y !== 0) {
            setPlayer((curr) => {
              const next = updatePlayer(curr, input, dt, state);
              if (next.isMoving) {
                playFootstep('trail');
              }
              if (next.territoryId !== curr.territoryId) {
                onSelectRegion?.(next.territoryId);
              }
              return next;
            });
          } else {
            setPlayer((curr) => {
              if (curr.isMoving) {
                return { ...curr, isMoving: false };
              }
              return curr;
            });
          }
        }

        // Play soft ambient theme notes for current territory
        playAmbientTick(player.territoryId, isQuiet);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    route,
    progress,
    controlsDisabled,
    onSelectRegion,
    state,
    player.territoryId,
    activeInterior,
    currentRoom,
    activeProp
  ]);

  // Keep player territory in sync if state.activeTerritory changes externally
  useEffect(() => {
    if (!route || progress >= 1) {
      const targetStand = regionFor(state.activeTerritory).stand;
      setPlayer((prev) => {
        if (prev.territoryId === state.activeTerritory) return prev;
        return {
          ...prev,
          x: targetStand.x,
          y: targetStand.y,
          territoryId: state.activeTerritory
        };
      });
    }
  }, [state.activeTerritory, route, progress]);

  // Play XP stinger when mark changes
  useEffect(() => {
    if (mark) {
      playStinger('xp', isQuiet);
    }
  }, [mark, isQuiet]);

  const left = `${(player.x / WORLD.width) * 100}%`;
  const top = `${(player.y / WORLD.height) * 100}%`;

  const statusOf = (id: string) =>
    state.territories.find((t) => t.id === id)?.status ?? 'fogged';
  const discovered = state.territories.filter((t) => t.status !== 'fogged').length;

  const currentFamily = familyFor(player.facing, player.isMoving || travelling);
  const animations = CHARACTER.animations as Record<
    string,
    { frames: number; src: string } | undefined
  >;
  const spec = animations[currentFamily] ?? animations['idle-front']!;
  const sprite = asset(spec.src.replace('{n}', '00'));

  const handleInteract = () => {
    if (controlsDisabled) return;
    initAudio();

    if (activeInterior && currentRoom) {
      if (nearbyInteriorProp) {
        playStinger('discover', isQuiet);
        setActiveProp(nearbyInteriorProp);
      } else if (isAtDais) {
        playStinger('dialogue', isQuiet);
        onInteract?.({
          type: 'landmark',
          id: currentRoom.territoryId,
          label: currentRoom.cartographerDais.label,
          x: currentRoom.cartographerDais.x,
          y: currentRoom.cartographerDais.y,
          distance: 0
        });
      } else if (isAtDoor) {
        playStinger('door', isQuiet);
        onInteriorChange?.(null);
      }
      return;
    }

    if (player.nearbyTarget?.type === 'door') {
      playStinger('door', isQuiet);
    } else if (player.nearbyTarget?.type === 'boss') {
      playStinger('boss', isQuiet);
    } else {
      playStinger('dialogue', isQuiet);
    }
    onInteract?.(player.nearbyTarget);
  };

  return (
    <div
      className="world"
      data-testid="world"
      data-travelling={travelling || player.isMoving ? 'true' : 'false'}
      data-pack={CHARACTER.anchor}
      data-interior={activeInterior ?? undefined}
    >
      {activeInterior && currentRoom ? (
        <div className="interior-stage" data-testid="interior-stage">
          <InteriorCanvas
            room={currentRoom}
            player={interiorPlayer}
            nearbyProp={nearbyInteriorProp}
            isInspecting={activeProp !== null}
            isAtDais={isAtDais}
            isAtDoor={isAtDoor}
            reducedMotion={reducedMotion}
          />
          <button
            type="button"
            className="interior-exit-btn"
            data-testid="exit-interior"
            aria-label="Exit to Island"
            onClick={() => {
              playStinger('door', isQuiet);
              onInteriorChange?.(null);
            }}
          >
            ◀ Exit to Island
          </button>
          {activeProp && (
            <div
              className="prop-inspection-overlay"
              data-testid="prop-inspection-overlay"
              role="dialog"
              aria-label={activeProp.label}
            >
              <div className="prop-inspection-card">
                <p className="prop-inspection-eyebrow">Sanctuary Relic</p>
                <h3 className="prop-inspection-title">
                  <span className="prop-glyph">{activeProp.glyph}</span> {activeProp.label}
                </h3>
                <p className="prop-inspection-text">{activeProp.inscription}</p>
                <button
                  type="button"
                  className="primary prop-dismiss"
                  data-testid="prop-dismiss"
                  onClick={() => setActiveProp(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className="world-frame"
          style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
          role="img"
          aria-label={`The Greyson Map. ${discovered} of ${state.territories.length} regions discovered. Greyson is in ${activeTerritory?.label ?? 'the map'}.`}
        >
          {/* Real-time Overworld 2D Canvas */}
          <OverworldCanvas
            state={state}
            player={player}
            mark={mark}
            nearbyTarget={player.nearbyTarget}
            reducedMotion={reducedMotion}
          />

          {/* DOM Layers for accessibility and test suites */}
          <img
            className="world-layer"
            src={asset(LAYERS.hidden)}
            alt=""
            draggable={false}
            style={{ opacity: 0 }}
          />

          {REGIONS.map((region) => {
            const status = statusOf(region.id);
            const reveal: Reveal = revealFor(status);
            const { glimpsed, revealed } = layerOpacity(reveal);
            if (glimpsed === 0 && revealed === 0) return null;
            const maskUrl = `url(${asset(region.mask)})`;
            const maskStyle = {
              maskImage: maskUrl,
              WebkitMaskImage: maskUrl,
              maskSize: '100% 100%',
              WebkitMaskSize: '100% 100%',
              opacity: 0 // Visuals handled by Canvas; DOM elements preserve data-reveal attributes for tests
            } as const;
            return (
              <div
                key={region.id}
                data-testid={`region-${region.id}`}
                data-status={statusOf(region.id)}
                data-reveal={reveal}
              >
                {glimpsed > 0 && (
                  <img
                    className="world-layer"
                    style={{ ...maskStyle }}
                    src={asset(LAYERS.glimpsed)}
                    alt=""
                    draggable={false}
                  />
                )}
                {revealed > 0 && (
                  <img
                    className="world-layer"
                    style={{ ...maskStyle }}
                    src={asset(LAYERS.revealed)}
                    alt=""
                    draggable={false}
                  />
                )}
              </div>
            );
          })}

          {/* Weather fog */}
          <div className={`world-fog${reducedMotion ? ' is-still' : ''}`} aria-hidden="true" />

          {/* Place nodes for fast-travel & test locators */}
          {REGIONS.map((region) => {
            const status = statusOf(region.id);
            const reveal = revealFor(status);
            const isHere = region.id === player.territoryId;
            const named = reveal !== 'hidden' || isHere;
            const canGo = reachable.includes(region.id) && !isHere;
            const territory = state.territories.find((t) => t.id === region.id);
            const label = named
              ? `${region.label}: ${STATUS_WORD[status]}, ${
                  territory?.coveredDimensions.length ?? 0
                } of ${territory?.requiredDimensions.length ?? 0} mapped${
                  isHere ? ', Greyson is here' : ''
                }${canGo ? '. Travel here' : ''}`
              : 'Unexplored country';
            return (
              <button
                key={region.id}
                type="button"
                className={`world-place${isHere ? ' is-here' : ''}${
                  canGo ? ' can-travel' : ''
                }${!named && !canGo ? ' is-unknown' : ''}`}
                data-testid={`place-${region.id}`}
                data-reachable={canGo ? 'true' : 'false'}
                aria-label={label}
                aria-current={isHere ? 'true' : undefined}
                disabled={!named && !canGo}
                style={{
                  left: `${(region.centre.x / WORLD.width) * 100}%`,
                  top: `${(region.centre.y / WORLD.height) * 100}%`
                }}
                onClick={() => {
                  if (isHere) {
                    setPlayer((prev) => ({
                      ...prev,
                      x: region.centre.x,
                      y: region.centre.y
                    }));
                  } else {
                    onSelectRegion?.(region.id);
                  }
                }}
              >
                {named && <span className="world-place-name">{region.label}</span>}
              </button>
            );
          })}

          {mark && (
            <div
              key={mark.key}
              className="world-mark"
              data-testid="world-mark"
              aria-hidden="true"
              style={{
                left: `${(regionFor(mark.territoryId).stand.x / WORLD.width) * 100}%`,
                top: `${(regionFor(mark.territoryId).stand.y / WORLD.height) * 100}%`
              }}
            >
              +{mark.xp}
            </div>
          )}

          {/* Greyson avatar element for test selectors */}
          <div
            className={`avatar world-greyson face-${player.facing}${
              player.isMoving || travelling ? ' is-walking' : ''
            }`}
            data-testid="world-greyson"
            data-territory={player.territoryId}
            data-animation={currentFamily}
            style={{ left, top }}
          >
            <img
              src={sprite}
              alt={`Greyson, in ${activeTerritory?.label ?? 'the map'}`}
              draggable={false}
            />
          </div>
        </div>
      )}

      {/* On-screen Enter Sanctuary action button when near a landmark */}
      {!activeInterior && (player.nearbyTarget?.type === 'landmark' || Math.hypot(player.x - here.centre.x, player.y - here.centre.y) < 65) && (
        <button
          type="button"
          className="enter-sanctuary-btn"
          data-testid="enter-sanctuary"
          onClick={() => {
            playStinger('door', isQuiet);
            const targetTerritory = player.nearbyTarget?.type === 'landmark' ? player.nearbyTarget.id : (player.territoryId || state.activeTerritory);
            onInteriorChange?.(targetTerritory);
          }}
        >
          Enter {sanctuaryFor(player.nearbyTarget?.type === 'landmark' ? player.nearbyTarget.id : (player.territoryId || state.activeTerritory)).name}
        </button>
      )}

      {/* Accessible Mobile & Tablet Touch Controls */}
      <TouchControls
        onMoveChange={(vec) => {
          inputVectorRef.current = vec;
        }}
        onInteract={handleInteract}
        nearbyTarget={activeInterior ? interiorTarget : player.nearbyTarget}
        disabled={controlsDisabled || Boolean(activeProp)}
      />
    </div>
  );
}
