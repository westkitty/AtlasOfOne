import { describe, expect, it } from 'vitest';
import {
  INTERIOR_ROOMS,
  interiorFor,
  isInteriorWalkable,
  findNearbyInteriorProp,
  isAtDoorwayExit
} from '../../src/world/interiors';
import { REGIONS } from '../../src/world/geography';

describe('Landmark Interior Sanctuaries', () => {
  it('defines an interior sanctuary for all 8 geographical regions', () => {
    for (const region of REGIONS) {
      const room = interiorFor(region.id);
      expect(room.territoryId).toBe(region.id);
      expect(room.title.length).toBeGreaterThan(5);
      expect(room.width).toBe(360);
      expect(room.height).toBe(360);
      expect(room.props.length).toBeGreaterThanOrEqual(2);
      expect(room.floorColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(room.wallColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(room.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('contains expected 8 canonical territory rooms', () => {
    const keys = Object.keys(INTERIOR_ROOMS);
    expect(keys).toEqual([
      'identity',
      'values',
      'politics',
      'relationships',
      'cognition',
      'interests',
      'fears',
      'future'
    ]);
  });

  it('provides a graceful fallback for unknown territory ids', () => {
    const fallback = interiorFor('non-existent');
    expect(fallback.territoryId).toBe('identity');
    expect(fallback.title).toBe('Origin Grove Shrine Sanctuary');
  });

  it('verifies spawn points are always walkable in all rooms', () => {
    for (const room of Object.values(INTERIOR_ROOMS)) {
      expect(isInteriorWalkable(room.spawnPoint.x, room.spawnPoint.y, room)).toBe(true);
    }
  });

  it('correctly blocks movement outside room bounds', () => {
    const room = interiorFor('identity');
    // Out of bounds positions
    expect(isInteriorWalkable(10, 10, room)).toBe(false);
    expect(isInteriorWalkable(350, 180, room)).toBe(false);
    expect(isInteriorWalkable(180, 20, room)).toBe(false);
  });

  it('permits movement through doorway threshold', () => {
    const room = interiorFor('identity');
    expect(isInteriorWalkable(room.doorway.x, room.doorway.y, room)).toBe(true);
  });

  it('blocks movement directly colliding with props', () => {
    const room = interiorFor('identity');
    const firstProp = room.props[0];
    expect(isInteriorWalkable(firstProp.x, firstProp.y, room)).toBe(false);
  });

  it('finds nearby props within interaction distance', () => {
    const room = interiorFor('identity');
    const firstProp = room.props[0]; // (180, 110)
    // Standing 20px below the altar
    const found = findNearbyInteriorProp(firstProp.x, firstProp.y + 20, room, 35);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(firstProp.id);
  });

  it('returns null when player is far away from all props', () => {
    const room = interiorFor('identity');
    // Near bottom center spawn point (180, 280), props are around y=110..150
    const found = findNearbyInteriorProp(room.spawnPoint.x, room.spawnPoint.y, room, 30);
    expect(found).toBeNull();
  });

  it('detects doorway exit standing on doorway mat', () => {
    const room = interiorFor('identity');
    expect(isAtDoorwayExit(room.doorway.x, room.doorway.y, room)).toBe(true);
    expect(isAtDoorwayExit(room.spawnPoint.x, room.spawnPoint.y, room)).toBe(false);
  });
});
