import { describe, expect, it } from 'vitest';
import { findNearbyWaystone, WAYSTONES } from '../../src/world/props';
import { isWalkable } from '../../src/world/collision';

describe('environmental waystones and trail props', () => {
  it('all authored waystones sit on or immediately near walkable terrain', () => {
    for (const stone of WAYSTONES) {
      // Waystone or immediately adjacent tile should be walkable
      const walkable =
        isWalkable(stone.x, stone.y) ||
        isWalkable(stone.x + 4, stone.y) ||
        isWalkable(stone.x - 4, stone.y) ||
        isWalkable(stone.x, stone.y + 4) ||
        isWalkable(stone.x, stone.y - 4);
      expect(walkable, `Waystone ${stone.id} at (${stone.x}, ${stone.y}) should be accessible`).toBe(true);
    }
  });

  it('all waystones have titles and non-empty inscriptions', () => {
    for (const stone of WAYSTONES) {
      expect(stone.title).toBeTruthy();
      expect(stone.inscription.length).toBeGreaterThan(15);
    }
  });

  it('finds nearby waystone within proximity radius', () => {
    const first = WAYSTONES[0];
    const found = findNearbyWaystone(first.x + 5, first.y - 5, 20);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(first.id);

    const none = findNearbyWaystone(0, 0, 20);
    expect(none).toBeNull();
  });
});
