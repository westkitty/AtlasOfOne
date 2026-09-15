import { describe, expect, it } from 'vitest';
import { isWalkable, resolveMovement } from '../../src/world/collision';
import { REGIONS, TRAILS } from '../../src/world/geography';

describe('overworld collision system', () => {
  it('every region stand coordinate is walkable', () => {
    for (const region of REGIONS) {
      expect(
        isWalkable(region.stand.x, region.stand.y),
        `Region stand for ${region.id} should be walkable`
      ).toBe(true);
    }
  });

  it('all trail waypoints are walkable', () => {
    for (const trail of TRAILS) {
      for (const pt of trail.waypoints) {
        expect(
          isWalkable(pt.x, pt.y),
          `Waypoint (${pt.x}, ${pt.y}) on trail ${trail.from}->${trail.to} should be walkable`
        ).toBe(true);
      }
    }
  });

  it('blocks deep ocean water and out-of-bounds positions', () => {
    expect(isWalkable(0, 0)).toBe(false);
    expect(isWalkable(5, 5)).toBe(false);
    expect(isWalkable(355, 10)).toBe(false);
    expect(isWalkable(10, 630)).toBe(false);
    expect(isWalkable(350, 630)).toBe(false);
  });

  it('slides along walls when blocked diagonally', () => {
    // Start at a known walkable point near the left boundary
    const startX = 20;
    const startY = 200;
    // Attempting to move further left (dx = -20) will hit water/boundary,
    // but moving along Y (dy = 5) should still slide vertically.
    const result = resolveMovement(startX, startY, -20, 5);
    expect(result.moved).toBe(true);
    expect(result.y).toBe(startY + 5);
    expect(result.x).toBe(startX); // Kept on X, slid on Y
  });
});
