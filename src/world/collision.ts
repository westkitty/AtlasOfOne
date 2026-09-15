import { TRAILS } from './geography';

/**
 * Island Overworld Collision System
 *
 * Checks whether Greyson can walk to a given (x, y) position on the 360x640 island.
 * Movement is constrained by:
 * - World canvas bounds [14, 346] x [28, 624]
 * - Island landmasses and trails
 * - Ocean water and steep out-of-bounds drop-offs
 */

export const WORLD_BOUNDS = {
  minX: 14,
  maxX: 346,
  minY: 28,
  maxY: 624
};

/** Landmass ellipses: [cx, cy, rx, ry] */
const LAND_MASSES: readonly [number, number, number, number][] = [
  [186, 108, 100, 75], // northern plateau (Republic)
  [183, 232, 122, 104], // central massif
  [92, 208, 74, 62], // western highland (Values)
  [286, 216, 70, 62], // eastern terraces (Cognition)
  [178, 330, 100, 88], // central basin (Identity origin)
  [146, 412, 104, 74], // south-west lowland
  [88, 436, 70, 56], // coastal flat (Relationships)
  [288, 438, 72, 60], // south-east marsh (Fears)
  [166, 524, 78, 54], // southern valley (Interests)
  [206, 486, 58, 48], // dividing ridge
  [118, 512, 48, 36], // south-west headland
  [268, 592, 44, 32] // offshore islet (Future)
];

/** Distance from point (px, py) to line segment (ax, ay)-(bx, by) */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-4) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/** Check if point is near any charted trail */
function isNearTrail(x: number, y: number, corridorRadius = 18): boolean {
  for (const trail of TRAILS) {
    const pts = trail.waypoints;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= corridorRadius) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Returns true if position (x, y) is solid, walkable terrain on the island.
 */
export function isWalkable(x: number, y: number): boolean {
  if (x < WORLD_BOUNDS.minX || x > WORLD_BOUNDS.maxX || y < WORLD_BOUNDS.minY || y > WORLD_BOUNDS.maxY) {
    return false;
  }

  // Trails and crossings are always walkable
  if (isNearTrail(x, y)) {
    return true;
  }

  // Check landmass ellipses
  for (const [cx, cy, rx, ry] of LAND_MASSES) {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1.0) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves movement with wall sliding: attempts to move by (dx, dy).
 * If diagonal movement hits an obstacle, tests X-only or Y-only movement.
 */
export function resolveMovement(
  curX: number,
  curY: number,
  dx: number,
  dy: number
): { x: number; y: number; moved: boolean } {
  const targetX = curX + dx;
  const targetY = curY + dy;

  // Try full step
  if (isWalkable(targetX, targetY)) {
    return { x: targetX, y: targetY, moved: true };
  }

  // Try X only (sliding along vertical surface)
  if (dx !== 0 && isWalkable(targetX, curY)) {
    return { x: targetX, y: curY, moved: true };
  }

  // Try Y only (sliding along horizontal surface)
  if (dy !== 0 && isWalkable(curX, targetY)) {
    return { x: curX, y: targetY, moved: true };
  }

  return { x: curX, y: curY, moved: false };
}
