import React, { useEffect, useRef, useState } from 'react';
import { CHARACTER, asset } from './geography';
import type { InteriorProp, InteriorRoom } from './interiors';

export interface InteriorCanvasProps {
  room: InteriorRoom;
  player: {
    x: number;
    y: number;
    facing: 'front' | 'back' | 'left' | 'right';
    isMoving: boolean;
  };
  nearbyProp: InteriorProp | null;
  isInspecting?: boolean;
  isAtDais: boolean;
  isAtDoor: boolean;
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

export function InteriorCanvas({
  room,
  player,
  nearbyProp,
  isInspecting,
  isAtDais,
  isAtDoor,
  reducedMotion
}: InteriorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const animTimeRef = useRef(0);
  const frameRef = useRef(0);

  // Preload character sprites
  useEffect(() => {
    let cancelled = false;
    async function loadAssets() {
      const urls: string[] = [];
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
      const t = animTimeRef.current;

      // 1. Clear full canvas (void darkness outside room)
      ctx.clearRect(0, 0, room.width, room.height);
      ctx.fillStyle = '#060a0f';
      ctx.fillRect(0, 0, room.width, room.height);

      // 2. Draw interior floor with 16-bit stone pavers
      const b = room.bounds;
      ctx.save();
      ctx.fillStyle = room.floorColor;
      ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);

      // Stone tile grid pattern
      ctx.lineWidth = 1;
      const tileSize = 20;
      for (let x = b.minX; x < b.maxX; x += tileSize) {
        for (let y = b.minY; y < b.maxY; y += tileSize) {
          const tileCol = Math.floor((x - b.minX) / tileSize);
          const tileRow = Math.floor((y - b.minY) / tileSize);
          if ((tileCol + tileRow) % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
            ctx.fillRect(x, y, tileSize, tileSize);
          }
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.strokeRect(x, y, tileSize, tileSize);
        }
      }

      // 3. Velvet sanctuary ceremonial runner carpet leading from door to dais
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(162, 115, 36, 175); // Carpet shadow
      ctx.fillStyle = room.accentColor;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(164, 115, 32, 170); // Carpet body
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = room.accentColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(164, 115, 32, 170); // Carpet border
      // Gold fringe pattern along carpet
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = '#f4dfa2';
      ctx.strokeRect(165, 116, 30, 168);
      ctx.setLineDash([]);
      ctx.restore();

      // 4. Draw North, West, East, and South Walls
      ctx.save();
      // North Wall (upper facade)
      ctx.fillStyle = room.wallColor;
      ctx.fillRect(b.minX - 10, 20, b.maxX - b.minX + 20, b.minY - 20);

      // Wall crown molding & cornice
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(b.minX - 10, 20, b.maxX - b.minX + 20, 8);
      ctx.fillStyle = room.accentColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(b.minX - 10, 28, b.maxX - b.minX + 20, 3);
      ctx.globalAlpha = 1.0;

      // Stone pillars flanking North wall
      const pillarW = 20;
      ctx.fillStyle = '#0a1016';
      ctx.fillRect(b.minX - 12, 20, pillarW, b.minY - 14);
      ctx.fillRect(b.maxX - 8, 20, pillarW, b.minY - 14);

      // West and East depth walls
      ctx.fillStyle = room.wallColor;
      ctx.fillRect(b.minX - 12, b.minY, 12, b.maxY - b.minY);
      ctx.fillRect(b.maxX, b.minY, 12, b.maxY - b.minY);

      // South Wall with doorway threshold cut
      ctx.fillStyle = room.wallColor;
      ctx.fillRect(b.minX - 12, b.maxY, room.doorway.x - room.doorway.width / 2 - (b.minX - 12), 24);
      ctx.fillRect(
        room.doorway.x + room.doorway.width / 2,
        b.maxY,
        b.maxX + 12 - (room.doorway.x + room.doorway.width / 2),
        24
      );

      // 5. Stained glass wall sconces & ambient light shafts
      if (!reducedMotion) {
        // Sconce left
        ctx.fillStyle = room.accentColor;
        ctx.globalAlpha = 0.7 + Math.sin(t * 4) * 0.15;
        ctx.beginPath();
        ctx.arc(100, 48, 4, 0, Math.PI * 2);
        ctx.fill();
        // Sconce right
        ctx.beginPath();
        ctx.arc(260, 48, 4, 0, Math.PI * 2);
        ctx.fill();

        // Angled celestial light shaft from upper center
        ctx.globalAlpha = 0.07 + Math.sin(t * 1.5) * 0.02;
        ctx.fillStyle = room.accentColor;
        ctx.beginPath();
        ctx.moveTo(150, 28);
        ctx.lineTo(210, 28);
        ctx.lineTo(260, b.maxY);
        ctx.lineTo(100, b.maxY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 6. Doorway Exit Mat
      const d = room.doorway;
      ctx.save();
      // Doorway threshold frame
      ctx.fillStyle = '#1c2533';
      ctx.fillRect(d.x - d.width / 2, d.y - d.height / 2, d.width, d.height);
      ctx.strokeStyle = isAtDoor ? '#4ae3b5' : '#45596e';
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x - d.width / 2, d.y - d.height / 2, d.width, d.height);

      // Doorway threshold mat light
      ctx.fillStyle = isAtDoor ? 'rgba(74, 227, 181, 0.35)' : 'rgba(244, 223, 162, 0.15)';
      ctx.fillRect(d.x - d.width / 2 + 3, d.y - d.height / 2 + 3, d.width - 6, d.height - 6);

      // Downward exit chevron
      ctx.fillStyle = isAtDoor ? '#4ae3b5' : '#88a6c7';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', d.x, d.y + 4);
      ctx.restore();

      // 7. Cartographer Dais Platform
      const dais = room.cartographerDais;
      ctx.save();
      // Dais bottom step
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(dais.x - 36, dais.y - 14, 72, 34);
      ctx.fillStyle = '#1e2632';
      ctx.fillRect(dais.x - 34, dais.y - 16, 68, 30);
      ctx.strokeStyle = room.accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(dais.x - 34, dais.y - 16, 68, 30);

      // Dais top platform
      ctx.fillStyle = '#2d3848';
      ctx.fillRect(dais.x - 26, dais.y - 24, 52, 22);
      ctx.strokeRect(dais.x - 26, dais.y - 24, 52, 22);

      // Glowing celestial projection / hovering astrolabe
      const daisPulse = Math.sin(t * 3) * 3;
      ctx.fillStyle = room.accentColor;
      ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.12;
      ctx.beginPath();
      ctx.arc(dais.x, dais.y - 28 + daisPulse, 16, 0, Math.PI * 2);
      ctx.fill();

      // Glowing core icon
      ctx.globalAlpha = 0.95;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◈', dais.x, dais.y - 22 + daisPulse);
      ctx.restore();

      // 8. Authored Props & Furnishings
      for (const prop of room.props) {
        ctx.save();
        const isNear = nearbyProp?.id === prop.id;

        // Drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(prop.x, prop.y + prop.height / 2 - 2, prop.width / 2 + 2, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pedestal base
        ctx.fillStyle = '#1a222e';
        ctx.fillRect(prop.x - prop.width / 2, prop.y - prop.height / 2, prop.width, prop.height);
        ctx.strokeStyle = isNear ? '#f4dfa2' : prop.color;
        ctx.lineWidth = isNear ? 2 : 1;
        ctx.strokeRect(prop.x - prop.width / 2, prop.y - prop.height / 2, prop.width, prop.height);

        // Prop Glyph
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(prop.glyph, prop.x, prop.y);

        // Proximity glow ring if selected
        if (isNear) {
          const glow = Math.sin(t * 6) * 2;
          ctx.strokeStyle = '#f4dfa2';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(prop.x, prop.y, Math.max(prop.width, prop.height) / 2 + 8 + glow, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 9. Ambient Sanctuary Particles (dust motes / incense)
      if (!reducedMotion) {
        ctx.save();
        for (let i = 0; i < 14; i++) {
          const px = ((Math.sin(i * 47.1 + t * 0.25) * 0.5 + 0.5) * (b.maxX - b.minX)) + b.minX;
          const py = ((i * 27.3 + t * 11) % (b.maxY - b.minY)) + b.minY;
          ctx.fillStyle = room.accentColor;
          ctx.globalAlpha = 0.2 + Math.sin(t * 2.5 + i) * 0.12;
          ctx.beginPath();
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 10. Greyson Character Sprite
      const baseFacing = player.facing === 'right' ? 'left' : player.facing;
      const family = isInspecting ? 'think-front' : `${player.isMoving ? 'walk' : 'idle'}-${baseFacing}`;
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

      // Character shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(Math.round(player.x), Math.round(player.y) - 2, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

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

      // 11. Contextual Action Prompts
      ctx.save();
      const promptBounce = Math.sin(t * 6) * 3;
      let promptText: string | null = null;
      let promptX = player.x;
      let promptY = player.y - 74 + promptBounce;

      if (nearbyProp) {
        promptText = `[A] Inspect ${nearbyProp.label}`;
        promptX = nearbyProp.x;
        promptY = nearbyProp.y - 28 + promptBounce;
      } else if (isAtDais) {
        promptText = `[A] Consult ${dais.label}`;
        promptX = dais.x;
        promptY = dais.y - 46 + promptBounce;
      } else if (isAtDoor) {
        promptText = `[A] Exit to Island`;
        promptX = d.x;
        promptY = d.y - 24 + promptBounce;
      }

      if (promptText) {
        ctx.fillStyle = 'rgba(16, 21, 31, 0.9)';
        ctx.strokeStyle = '#f4dfa2';
        ctx.lineWidth = 1.5;
        ctx.font = '11px sans-serif';
        const textWidth = ctx.measureText(promptText).width;

        ctx.beginPath();
        ctx.roundRect(promptX - textWidth / 2 - 8, promptY - 14, textWidth + 16, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f4dfa2';
        ctx.textAlign = 'center';
        ctx.fillText(promptText, promptX, promptY);
      }
      ctx.restore();

      // 12. Top Sanctuary Title Banner
      ctx.save();
      ctx.fillStyle = 'rgba(10, 15, 23, 0.85)';
      ctx.strokeStyle = room.accentColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(room.width / 2 - 120, 6, 240, 20, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = room.accentColor;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`◆ ${room.title} ◆`, room.width / 2, 19);
      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [loaded, room, player, nearbyProp, isInspecting, isAtDais, isAtDoor, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="interior-canvas"
      width={room.width}
      height={room.height}
      data-testid="interior-canvas"
      aria-hidden="true"
    />
  );
}
