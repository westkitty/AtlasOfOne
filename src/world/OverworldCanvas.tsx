import React, { useEffect, useRef, useState } from 'react';
import {
  CHARACTER,
  LAYERS,
  REGIONS,
  TRAILS,
  WORLD,
  asset,
  layerOpacity,
  regionFor,
  revealFor,
  routeBetween
} from './geography';
import type { CampaignState } from '../game/types';
import type { InteractableTarget, PlayerState } from './playerController';
import { availableBosses, availableDoors } from '../game/encounters';
import { WAYSTONES } from './props';

export interface OverworldCanvasProps {
  state: CampaignState;
  player: PlayerState;
  mark: { xp: number; territoryId: string; key: number } | null;
  nearbyTarget: InteractableTarget | null;
  reducedMotion: boolean;
}

/** Preload image helper */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    if (img.complete) {
      resolve(img);
    } else {
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
    }
  });
}

export function OverworldCanvas({
  state,
  player,
  mark,
  nearbyTarget,
  reducedMotion
}: OverworldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // Animation frame timing
  const animTimeRef = useRef(0);
  const frameRef = useRef(0);

  // Load world and character image assets
  useEffect(() => {
    let cancelled = false;
    async function loadAssets() {
      const urls: string[] = [
        asset(LAYERS.hidden),
        asset(LAYERS.glimpsed),
        asset(LAYERS.revealed),
        asset(LAYERS.sea)
      ];

      // Region masks
      for (const region of REGIONS) {
        if (region.mask) urls.push(asset(region.mask));
      }

      // Greyson walk & idle frames
      const animations = CHARACTER.animations as Record<
        string,
        { frames: number; src: string } | undefined
      >;
      for (const spec of Object.values(animations)) {
        if (!spec) continue;
        for (let i = 0; i < spec.frames; i++) {
          urls.push(asset(spec.src.replace('{n}', String(i).padStart(2, '0'))));
        }
      }

      const map = new Map<string, HTMLImageElement>();
      await Promise.all(
        urls.map(async (url) => {
          const img = await loadImage(url);
          map.set(url, img);
        })
      );

      if (!cancelled) {
        imagesRef.current = map;
        setLoaded(true);
      }
    }

    void loadAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  // Render loop
  useEffect(() => {
    if (!loaded) return;
    let animationId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      animTimeRef.current += dt;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const images = imagesRef.current;

      // Clear
      ctx.clearRect(0, 0, WORLD.width, WORLD.height);

      // 1. Draw base ocean/island layer
      const seaImg = images.get(asset(LAYERS.sea));
      if (seaImg) {
        ctx.drawImage(seaImg, 0, 0, WORLD.width, WORLD.height);
      }
      const hiddenImg = images.get(asset(LAYERS.hidden));
      if (hiddenImg) {
        ctx.drawImage(hiddenImg, 0, 0, WORLD.width, WORLD.height);
      }

      // 2. Draw revealed and glimpsed regions using masks
      for (const region of REGIONS) {
        const territory = state.territories.find((t) => t.id === region.id);
        const status = territory?.status ?? 'fogged';
        const reveal = revealFor(status);
        const { glimpsed, revealed } = layerOpacity(reveal);

        if (glimpsed === 0 && revealed === 0) continue;
        const maskImg = images.get(asset(region.mask));

        if (maskImg && maskImg.complete && maskImg.naturalWidth > 0) {
          ctx.save();

          // Create temporary offscreen layer for masked rendering
          if (revealed > 0) {
            const revImg = images.get(asset(LAYERS.revealed));
            if (revImg) {
              ctx.globalAlpha = revealed;
              ctx.drawImage(revImg, 0, 0, WORLD.width, WORLD.height);
            }
          } else if (glimpsed > 0) {
            const glimpImg = images.get(asset(LAYERS.glimpsed));
            if (glimpImg) {
              ctx.globalAlpha = glimpsed;
              ctx.drawImage(glimpImg, 0, 0, WORLD.width, WORLD.height);
            }
          }

          ctx.restore();
        }
      }

      // 3. Draw drifting ambient fog overlay
      if (!reducedMotion) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        const fogOffset = (animTimeRef.current * 8) % 120;
        ctx.fillStyle = '#b8cde3';
        for (let i = -1; i < 6; i++) {
          ctx.beginPath();
          ctx.ellipse(
            180 + Math.sin(animTimeRef.current * 0.4 + i) * 60,
            i * 120 + fogOffset,
            140,
            45,
            0.1,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.restore();
      }

      // 3b. Biome ambient floating particles (pollen / embers / sea mist)
      if (!reducedMotion) {
        ctx.save();
        const t = animTimeRef.current;
        for (let i = 0; i < 18; i++) {
          const px = ((Math.sin(i * 99.3 + t * 0.3) * 0.5 + 0.5) * (WORLD.width - 40)) + 20;
          const py = ((i * 35.7 + t * 14) % (WORLD.height - 60)) + 30;
          const isGold = i % 3 === 0;
          ctx.fillStyle = isGold ? '#f4dfa2' : '#88d8b0';
          ctx.globalAlpha = 0.22 + Math.sin(t * 2 + i) * 0.12;
          ctx.beginPath();
          ctx.arc(px, py, isGold ? 1.5 : 1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 4. Draw interactive landmarks on the island with progression reactivity
      for (const region of REGIONS) {
        const territory = state.territories.find((t) => t.id === region.id);
        const status = territory?.status ?? 'fogged';
        const isDiscovered = status !== 'fogged';
        const isCurrent = region.id === player.territoryId;

        ctx.save();
        // Landmark aura / pulse
        if (isDiscovered) {
          const pulseAlpha = 0.35 + Math.sin(animTimeRef.current * 3) * 0.15;
          ctx.fillStyle = isCurrent ? '#f4dfa2' : '#88a6c7';
          ctx.globalAlpha = pulseAlpha;
          ctx.beginPath();
          ctx.arc(region.centre.x, region.centre.y, isCurrent ? 14 : 10, 0, Math.PI * 2);
          ctx.fill();

          // Reactive landmark progression
          if (status === 'deeply-charted') {
            // Radiant rotating celestial rays
            const rayCount = 6;
            const rayAngle = animTimeRef.current * 0.8;
            ctx.strokeStyle = '#f4dfa2';
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = 0.5 + Math.sin(animTimeRef.current * 4) * 0.2;
            for (let k = 0; k < rayCount; k++) {
              const a = rayAngle + (k * Math.PI * 2) / rayCount;
              ctx.beginPath();
              ctx.moveTo(region.centre.x + Math.cos(a) * 8, region.centre.y + Math.sin(a) * 8);
              ctx.lineTo(region.centre.x + Math.cos(a) * 16, region.centre.y + Math.sin(a) * 16);
              ctx.stroke();
            }
          } else if (status === 'charted') {
            // Steady bright beacon ring
            ctx.strokeStyle = '#f4dfa2';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(region.centre.x, region.centre.y, 11, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Landmark icon/motif
        ctx.fillStyle = isCurrent ? '#f4dfa2' : isDiscovered ? '#cbdbe8' : '#495a6a';
        ctx.globalAlpha = isDiscovered ? 0.95 : 0.4;
        ctx.beginPath();
        ctx.arc(region.centre.x, region.centre.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4b. Draw discoverable Waystones along trails
      for (const stone of WAYSTONES) {
        ctx.save();
        const isNear = nearbyTarget?.id === stone.id;
        // Stone obelisk
        ctx.fillStyle = isNear ? '#f4dfa2' : '#7b8c9d';
        ctx.fillRect(stone.x - 3, stone.y - 7, 6, 10);
        // Etched rune dot
        ctx.fillStyle = isNear ? '#ffffff' : '#344556';
        ctx.fillRect(stone.x - 1, stone.y - 4, 2, 3);
        if (isNear) {
          ctx.strokeStyle = '#f4dfa2';
          ctx.lineWidth = 1;
          ctx.strokeRect(stone.x - 4, stone.y - 8, 8, 12);
        }
        ctx.restore();
      }

      // 4c. Draw luminous stepping stones along trails between charted territories
      for (const trail of TRAILS) {
        if (trail.sea) continue;
        const fromStatus = state.territories.find((t) => t.id === trail.from)?.status ?? 'fogged';
        const toStatus = state.territories.find((t) => t.id === trail.to)?.status ?? 'fogged';
        const isMapped =
          (fromStatus === 'charted' || fromStatus === 'deeply-charted') &&
          (toStatus === 'charted' || toStatus === 'deeply-charted');
        if (isMapped && trail.waypoints.length > 0) {
          ctx.save();
          ctx.fillStyle = '#f4dfa2';
          for (let i = 2; i < trail.waypoints.length - 2; i += 3) {
            const pt = trail.waypoints[i];
            const pulse = 0.35 + Math.sin(animTimeRef.current * 3 + i) * 0.2;
            ctx.globalAlpha = pulse;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // 5. Draw active Mystery Doors & Crossing Leylines
      const openDoors = availableDoors(state);
      for (const door of openDoors) {
        const route = routeBetween(door.territoryIds[0], door.territoryIds[1]);
        if (route && route.length > 0) {
          // 5a. Ethereal animated crossing leyline between regions
          ctx.save();
          ctx.strokeStyle = '#4ae3b5';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.45 + Math.sin(animTimeRef.current * 3) * 0.15;
          if (!reducedMotion) {
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -animTimeRef.current * 14;
          }
          ctx.beginPath();
          ctx.moveTo(route[0].x, route[0].y);
          for (let i = 1; i < route.length; i++) {
            ctx.lineTo(route[i].x, route[i].y);
          }
          ctx.stroke();
          ctx.restore();

          // 5b. Ethereal verdigris door gateway at midpoint
          const mid = route[Math.floor(route.length / 2)];
          ctx.save();
          const glow = 0.5 + Math.sin(animTimeRef.current * 4) * 0.25;
          ctx.fillStyle = '#4ae3b5';
          ctx.globalAlpha = glow;
          ctx.beginPath();
          ctx.arc(mid.x, mid.y, 12, 0, Math.PI * 2);
          ctx.fill();

          // Door gateway icon
          ctx.strokeStyle = '#e6fff7';
          ctx.lineWidth = 2;
          ctx.strokeRect(mid.x - 5, mid.y - 8, 10, 16);
          ctx.restore();
        }
      }

      // 6. Draw active / available Boss monoliths
      const openBosses = availableBosses(state);
      for (const boss of openBosses) {
        const region = REGIONS.find((r) => r.id === boss.territoryId);
        if (region) {
          const bx = region.centre.x + 16;
          const by = region.centre.y - 18;
          ctx.save();
          // Ember trial glow
          const emberGlow = 0.55 + Math.sin(animTimeRef.current * 5) * 0.25;
          ctx.fillStyle = '#ff6b35';
          ctx.globalAlpha = emberGlow;
          ctx.beginPath();
          ctx.arc(bx, by, 11, 0, Math.PI * 2);
          ctx.fill();

          // Monolith rune
          ctx.fillStyle = '#fff0e6';
          ctx.beginPath();
          ctx.moveTo(bx, by - 8);
          ctx.lineTo(bx + 6, by + 6);
          ctx.lineTo(bx - 6, by + 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // 7. Draw floating XP mark if active
      if (mark) {
        const markRegion = regionFor(mark.territoryId);
        ctx.save();
        ctx.fillStyle = '#f4dfa2';
        ctx.font = 'bold 16px monospace';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';
        ctx.fillText(`+${mark.xp}`, markRegion.stand.x, markRegion.stand.y - 12);
        ctx.restore();
      }

      // 8. Draw Greyson character sprite
      const baseFacing = player.facing === 'right' ? 'left' : player.facing;
      const family = `${player.isMoving ? 'walk' : 'idle'}-${baseFacing}`;
      const animations = CHARACTER.animations as Record<
        string,
        { frames: number; fps: number; src: string } | undefined
      >;
      const spec = animations[family] ?? animations['idle-front']!;

      if (!reducedMotion) {
        frameRef.current = Math.floor(animTimeRef.current * spec.fps) % spec.frames;
      } else {
        frameRef.current = 0;
      }

      const frameIndex = Math.min(frameRef.current, spec.frames - 1);
      const spritePath = asset(spec.src.replace('{n}', String(frameIndex).padStart(2, '0')));
      const spriteImg = images.get(spritePath);

      if (spriteImg && spriteImg.complete) {
        ctx.save();
        const drawX = Math.round(player.x);
        const drawY = Math.round(player.y);

        if (player.facing === 'right') {
          // Mirror horizontally for rightwards facing
          ctx.translate(drawX, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(spriteImg, -24, -64, 48, 64);
        } else {
          ctx.drawImage(spriteImg, drawX - 24, drawY - 64, 48, 64);
        }
        ctx.restore();
      }

      // 9. Draw interactive prompt indicator above target
      if (nearbyTarget) {
        ctx.save();
        const bounce = Math.sin(animTimeRef.current * 6) * 3;
        const promptY = nearbyTarget.y - 28 + bounce;

        ctx.fillStyle = 'rgba(16, 21, 31, 0.85)';
        ctx.strokeStyle = '#f4dfa2';
        ctx.lineWidth = 1.5;
        const promptText = `[A] ${
          nearbyTarget.type === 'door'
            ? 'Open Door'
            : nearbyTarget.type === 'boss'
            ? 'Boss Trial'
            : nearbyTarget.type === 'waystone'
            ? 'Read Sign'
            : nearbyTarget.label
        }`;
        ctx.font = '11px sans-serif';
        const textWidth = ctx.measureText(promptText).width;

        ctx.beginPath();
        ctx.roundRect(nearbyTarget.x - textWidth / 2 - 8, promptY - 14, textWidth + 16, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f4dfa2';
        ctx.textAlign = 'center';
        ctx.fillText(promptText, nearbyTarget.x, promptY);
        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [loaded, state, player, mark, nearbyTarget, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="overworld-canvas"
      width={WORLD.width}
      height={WORLD.height}
      data-testid="overworld-canvas"
      aria-hidden="true"
    />
  );
}
